Escopo: `supabase/functions/backup-restore/index.ts` apenas. Sem migration. Regra mantida: backup vence.

## Diagnóstico

### Problema 1 (raiz dominante) — `patient_encounters_patient_id_fkey`

**Não é ordem.** Verifiquei o constraint real:

```
patient_encounters.patient_id  → patients(id)        ON DELETE CASCADE
patient_encounters.registry_id → patient_registry(id)
patient_encounters.medical_record_id → medical_records(id)
patient_encounters.hospital_unit_id  → hospital_units(id)
```

E as arestas do `topoOrder` (via `get_public_fk_pairs`):

```
patient_registry → patients → patient_encounters
```

O cliente percorre `for (const t of plan)` em ordem, então quando `patient_encounters` roda, `patients` já entrou (167/0 erros, confirmado). O FK também aponta para `patients(id)` literal — não há remapeamento de id em jogo (patients usa upsert por PK preservando o id do backup).

**Causa real: encounters órfãos no backup.** O backup contém 328 encounters mas só 167 patients. Vários `patient_id` referenciados nas linhas de `patient_encounters` simplesmente não existem na exportação de `patients` (paciente arquivado/deletado na origem, exportação parcial filtrou patients). Como nenhum dos 328 encontra o pai, o slice inteiro estoura — daí `0 processed, 328 errors`.

**Correção:** filtro de integridade referencial pré-upsert, genérico e parametrizado por `FK_TRANSLATIONS` + um novo mapa `FK_PARENTS` (col → tabela pai com PK preservada por id). Antes de cada upsert de tabela filha:

1. Coletar todos os valores não-nulos de cada coluna FK no slice já traduzido/dedupado.
2. Para cada coluna, fazer um `select pk from <parent> where pk in (...)` em chunks de 500.
3. Filtrar do slice as linhas cuja FK aponta para id ausente.
4. Acumular contador `orphan_fk_dropped_by_table[table][col]` e amostra didática.

Esse mesmo mecanismo cobre a cascata: `prescriptions`, `clinical_evolutions`, `exam_requests`, `patient_movements`, `bed_census`, `saps3_assessments`, `discharge_documents`, `medical_records`, `admission_histories`, `internal_transfer_requests`, `prescription_validations`, `medical_record_edit_history`. Cada uma vai dropar suas próprias linhas órfãs em vez de explodir o slice todo. **Estimativa: derruba ~90% dos 12k erros.**

`FK_PARENTS` mínimo a registrar (FKs que já vimos quebrar; outras seguem o caminho normal):

```
patient_id           → patients
registry_id          → patient_registry
patient_registry_id  → patient_registry
encounter_id         → patient_encounters
parent_id            → (auto-FK; tratado em Problema 2)
medical_record_id    → medical_records
```

### Problema 2 — `min(uuid) does not exist` persistente em `prescriptions`

A dedupe por PK eliminou a maioria, mas algum slice ainda dispara. Possíveis raízes residuais que sobreviveram à dedupe atual:

(a) **Dedupe não normaliza id**: `String(r[pk])` deixa `null/undefined/""` como chaves distintas, então duas linhas órfãs com id ausente passam intactas e o PostgREST agrega.
(b) **Caso PostgREST**: quando o body de upsert contém o mesmo id em duas linhas com payload diferente E o cliente PostgREST resolve duplicatas internamente via `min()/max()` sobre todas as colunas para "fundir" — em algumas versões inclui colunas UUID. Mesmo após dedupe nosso por PK, pode haver duplicatas vindas de **dois arquivos `part-*` distintos** lidos em uma única chamada — não é o caso aqui (1 part por upsert), mas vale blindar.
(c) **Auto-FK `parent_id`**: `prescriptions.parent_id → prescriptions.id`. Se um slice tem filho antes do pai (e o pai está em outro part), o `upsert` não erra por isso (FK só dispara no commit). Mas o ramo de filtro de FK do Problema 1, se ingênuo, removeria o filho — temos que **excluir `parent_id` do filtro FK** (auto-referência) e tratar separadamente.

**Correção:**

1. **Dedupe robusta**: chave de dedupe deve descartar a linha quando o PK é null/undefined/"". Linhas sem PK são impossíveis em `upsert` por id mesmo — drop e contabiliza em `slice_dedupes_dropped` com nota didática.
2. **Fallback automático em `min(uuid)`**: se `error.message` contém `min(uuid)`, refazer o slice em **modo individual** (`upsert` linha-a-linha em loop) para isolar e blindar. Lento (≤ batch atual ÷ 500 chamadas) mas só dispara quando necessário. Acumula `min_uuid_retries`.
3. **Auto-FK `parent_id`**: aplicar two-pass quando `table === "prescriptions"`:
   - **Pass A**: upsert removendo temporariamente `parent_id` (envia `null`), guardando o mapa `id → parent_id` original em memória.
   - **Pass B**: após todos os parts de `prescriptions` processados, um `update` em batch reescrevendo `parent_id` (só onde o pai existe — usar filtro FK). O Pass B precisa ocorrer ao FIM da tabela, então marcamos no `restore_jobs.progress.pending_parent_id_fixups[]` cada batch e aplicamos no `handleFinalize` antes de fechar.
   - Alternativa mais simples se preferir não tocar finalize: aceitar que algumas linhas vão falhar no Pass A se `parent_id` apontar para id ainda não inserido. Não recomendo — quebra os 4322.

### Cascata (confirmação)

Com FK filter ativo, cada filha drena suas próprias órfãs sem matar o slice. Resolver Problema 1 + 2 derruba:

- `prescriptions` (4322): dropa órfãos por `patient_id`/`encounter_id`/`patient_registry_id`; parent_id via two-pass; min(uuid) via fallback.
- `clinical_evolutions` (3679), `exam_requests` (2955), demais — dropam órfãos por `patient_id`/`encounter_id` e entram.

Sobrarão apenas: linhas verdadeiramente órfãs (sem pai disponível mesmo após restore), CHECKs/triggers de domínio (`enforce_*_affinity`), e tabelas com UNIQUE composta ainda não mapeadas.

## Mudanças no arquivo

`supabase/functions/backup-restore/index.ts`:

1. **Novo mapa `FK_PARENTS`** no topo (paralelo a `FK_TRANSLATIONS`). Lista FKs do tipo "id preservado no destino" (não catálogo). `parent_id` fica de fora e é tratado à parte.

2. **Novo helper `dropOrphansByFk(admin, slice, table, fkCol, parentTable, parentPk='id')`**: query em chunks, retorna `{ kept, dropped }`. Contabiliza em `orphanFkDropped[table][fkCol]`.

3. **No ramo não-catálogo (após dedupe por PK e tradução)**: percorre `FK_PARENTS` aplicáveis ao `table`; aplica `dropOrphansByFk` sequencial; remove órfãs antes do upsert. Adiciona contador `orphan_fk_dropped_by_table` ao progress merge e ao report final.

4. **Dedupe endurecida**: `dedupeBy(allRows, r => { const k = pk.map(c => r[c]).join('::'); return k.includes('null') || k.includes('undefined') || k === '' ? `__drop__${Math.random()}` : k })` — não; melhor: filtrar `allRows.filter(r => pk.every(c => r[c] != null && r[c] !== ""))` ANTES da dedupe, contabilizando `dropped_no_pk`.

5. **Fallback `min(uuid)`**: ao detectar a mensagem no `error.message`, refazer o slice em loop linha-a-linha (`upsert([row], { onConflict })`). Acumula `min_uuid_retries`. Mantém contagem de processados/erros precisa.

6. **Two-pass `parent_id` em prescriptions**:
   - Pass A: ao iterar `allRows`, separar `originalParentById` (Map). Antes do upsert, `delete row.parent_id` (envia null). Salva o mapa em `rj.progress.pending_parent_id_fixups[<table>][id]=parentId` por part.
   - Em `handleFinalize`: ler `pending_parent_id_fixups.prescriptions`, filtrar pares cujo `parentId` existe em `prescriptions.id` (chunked select), aplicar `update({ parent_id }).eq('id', ...)` em batch. Acumula `parent_id_relinked` e `parent_id_dropped` (pai inexistente).

7. **Report final**: adicionar `orphan_fk_dropped_by_table`, `min_uuid_retries`, `parent_id_relinked`, `parent_id_dropped`, `dropped_no_pk`.

## Ordem de execução (inalterada para o usuário)

```
handlePlan → topoOrder (patient_registry → patients → patient_encounters → filhos)
handleStep auth_users
handleStep catálogos (com translateRow)
handleStep não-catálogo:
  cleanRow → translateRow → drop_no_pk → dedupe PK
  if table === patients: liberar bed_number 1x, dedupe bed_number
  drop órfãs por FK (FK_PARENTS) com select de validação
  if table === prescriptions: separar parent_id em pending_fixups
  upsert; on min(uuid) → fallback linha-a-linha
handleFinalize:
  aplicar pending_parent_id_fixups (prescriptions parent_id pass B)
  desativa manutenção, escreve report
```

## O que ainda pode sobrar

1. Encounters/prescriptions/evoluções verdadeiramente órfãs (sem pai em lugar nenhum): serão logadas em `orphan_fk_dropped_by_table` — visível e auditável, não erra mais.
2. `enforce_prescription_patient_affinity` / `enforce_encounter_patient_affinity` podem rejeitar linhas com `patient_name` divergente do `patient_registry.full_name` — não é erro de FK, é regra de negócio; sobreviverá como `errorSample` específico.
3. UNIQUEs compostas em tabelas filhas (raro hoje) ainda fora de `CATALOG_NATURAL_KEYS`.
4. `medical_records.id` é FK de `patient_encounters`; se medical_records vier vazio do backup, todos os encounters com `medical_record_id` não-nulo serão dropados. O ranking em ordem topológica garante medical_records antes (ele referencia patient_registry), mas se source não exportou, é dado faltante real.
5. Modo manutenção bloqueia escritas para não-service_role — service_role bypassa (`block_writes_during_maintenance` verifica `current_user`), confirmado OK.

## Resposta direta ao usuário

- **Problema 1 não era ordem nem remapeamento**: a ordem topológica está certa e `patient_encounters.patient_id` aponta literalmente para `patients(id)` (preservamos ids do backup). Era **órfão de dados**: 328 encounters referenciam `patient_id`s que não existem nos 167 patients exportados.
- **min(uuid) restante**: a dedupe atual mantém linhas sem PK (id null/""), e essas colidem entre si no PostgREST. Mais: não há fallback quando o erro ocorre. Adicionar (a) drop pré-dedupe das linhas sem PK e (b) fallback linha-a-linha quando `min(uuid)` aparece, blinda em definitivo. Para `parent_id` (auto-FK), two-pass.

Auditoria/manutenção: intocadas. `handleFinalize` ganha apenas o passo de reaplicar `parent_id`.
