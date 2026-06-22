# Plano — rodada 2 do `backup-restore`

Escopo: somente `supabase/functions/backup-restore/index.ts`. Sem migration nova (as RPCs `get_public_table_columns` / `get_public_unique_constraints` já existem). Auditoria e manutenção ficam intactas.

## Decisão de produto (nova)

**Em todo conflito UNIQUE entre backup e destino, o BACKUP VENCE.** Isso muda o comportamento atual do branch de catálogo, que hoje preserva a linha local e só mapeia o id.

## Causa raiz #1 — `states` fora do tratamento de catálogo (efetivo)

Diagnóstico:
- `states` já está em `CATALOG_NATURAL_KEYS`, **mas com `["code"]`**.
- O erro real é `states_name_key` (UNIQUE em `name`), não em `code`. Como `get_public_unique_constraints` não devolve uma UNIQUE para `(code)`, `catalogStrategyByTable["states"]` cai em `null` → vira upsert por PK → colide em `states_name_key`.
- `states` então não restaura, `id_maps.states` fica vazio, e toda FK `state_id` quebra (patient_registry e cascata).

Correção:
- Trocar `states: [["code"]]` por `states: [["name"], ["code"]]` (ordem = prioridade). O matcher já escolhe o primeiro candidato cuja UNIQUE existe no destino — então pega `name` automaticamente, e segue tolerante se algum dia a UNIQUE migrar para `code`.

Como o remapeamento chega nas filhas (confirmação pedida):
- `FK_TRANSLATIONS` já inclui `state_id → states` e `hospital_unit_id → hospital_units` (linhas 44–45).
- Em `handleStep`, `translateRow` (linha ~358) percorre cada coluna da row; se o nome está em `FK_TRANSLATIONS`, troca `row[col]` por `id_maps[<catalog>][backup_id]`.
- `id_maps` é persistido em `progress.id_maps` e relido a cada step → tabelas-filha processadas **depois** do catálogo recebem a tradução. Mesma mecânica que já funciona para `hospital_units` (motivo de `hospital_unit_id` ter sumido dos erros). Basta `states` entrar no fluxo de catálogo para herdar o mesmo comportamento — sem código novo de propagação.

## Mudança de semântica — "backup vence" no branch de catálogo

Hoje (linhas 396–413): se `existing` é encontrado por chave natural, só popula `id_map` e **pula o update** (`skipped_updates++`).

Novo comportamento:
1. `SELECT id FROM <tabela> WHERE <chave_natural>` (igual hoje).
2. Se existe:
   - `id_maps[t][backup_id] = local_id` (igual hoje, preserva FKs que já apontavam para o id local).
   - **`UPDATE <tabela> SET <cleaned sem pk> WHERE id = local_id`** — backup sobrescreve campos não-chave do destino.
   - Contador novo: `catalog_overwritten` (substitui `skipped_updates` no relatório).
3. Se não existe: `INSERT` preservando id do backup (igual hoje).

Riscos controlados: o `cleaned` já removeu colunas generated/identity-always e colunas inexistentes; o `UPDATE` exclui as colunas do PK (não realoca id) e não toca em FKs órfãs porque a tradução é feita só para tabelas-filha não-catálogo.

## Pendência #2 — `patients.bed_number` UNIQUE (backup vence)

Cenário: backup e destino têm pacientes diferentes ocupando o mesmo `bed_number`. Upsert por PK não resolve a UNIQUE secundária.

Estratégia (executada apenas para `patients`, em branch dedicado dentro de `handleStep`):
1. Antes do upsert do slice, coletar `bed_numbers = slice.map(r => r.bed_number).filter(Boolean)`.
2. `UPDATE patients SET bed_number = NULL WHERE bed_number = ANY(bed_numbers) AND id <> ANY(slice_ids)` — libera o leito nas linhas do destino que não pertencem ao backup. Isso não viola FK (`bed_number` é só string em `patients`; quem referencia leito o faz por `patient_id`, não por `bed_number`).
3. Em seguida o `upsert` normal por PK roda como hoje; o paciente do backup assume o `bed_number`.
4. Tracking: contador `bed_number_reassigned` no `progress` para auditoria.

Por que não usar `onConflict: "bed_number"`: o upsert do PostgREST aceita só uma `onConflict`; trocar PK por `bed_number` faria a row do backup atualizar o paciente local (mudando id), o que quebra todas as FKs filhas que apontam para o id do backup. A liberação prévia é mais segura.

## Pendência #3 — `user_roles` UNIQUE em `(user_id, role)`

Hoje: upsert por PK `id` → colide em `user_roles_user_id_role_key`.

Correção: caso especial em `handleStep` — se `table === "user_roles"`, usar `onConflict: "user_id,role"` e omitir `id` do slice (deixa o destino manter o `id` local, ou gerar novo). `ignoreDuplicates: false` mantém "backup vence" nos demais campos (não há outros — só `created_at`).

Generalização opcional: como `get_public_unique_constraints` já devolve as UNIQUEs, dá para escolher automaticamente o melhor `onConflict` por tabela. Mantenho fora deste round para não regredir tabelas hoje funcionando — só `user_roles` em allowlist.

## Pendência #4 — cascata neta (`prescription_validations`, `discharge_documents`, `medical_record_edit_history`)

Confirmo: são netos de `patient_registry`, que depende de `states`. Corrigindo `states` + cascata de `state_id` em `patient_registry`, `medical_records`, `prescriptions`, `patient_encounters` voltam, e os netos param de quebrar por FK. Se algum erro residual sobrar nesses três, será por causa **diferente** (provavelmente UNIQUE própria) e tratamos no próximo round com o relatório novo.

## Ordem de execução durante o restore (inalterada, só comportamento)

```text
handlePlan
  → schema discovery (já existe)
  → injeta __auth_users__ (já existe)
  → marca catalog (agora states entra também via name)

handleStep __auth_users__   (1º)
handleStep catálogos        (2º)  → backup vence: UPDATE em vez de skip
handleStep tabelas filhas   (3º)  → tradução de FK (states_id agora populado)
                                   → branch especial: patients (libera bed_number)
                                   → branch especial: user_roles (onConflict user_id,role)
handleFinalize              → report inclui catalog_overwritten, bed_number_reassigned
```

## Arquivos a tocar

- `supabase/functions/backup-restore/index.ts`:
  - `CATALOG_NATURAL_KEYS.states` → `[["name"], ["code"]]`.
  - Branch `isCatalog` em `handleStep`: substituir skip por `UPDATE` (backup vence) + renomear contador.
  - Branch não-catálogo em `handleStep`: detectar `table === "patients"` e fazer liberação prévia de `bed_number`; detectar `table === "user_roles"` e usar `onConflict: "user_id,role"` sem `id`.
  - `handleFinalize`: adicionar `catalog_overwritten` e `bed_number_reassigned` ao report.

## O que ainda pode sobrar

1. Outras UNIQUEs secundárias em tabelas não-catálogo (além de `patients.bed_number` e `user_roles`) — só aparecem no próximo relatório; padrão de allowlist por tabela já está pronto para estender.
2. Catálogo cuja UNIQUE no destino é composta e não bate com nenhum candidato em `CATALOG_NATURAL_KEYS` — basta adicionar o candidato correto.
3. `UPDATE` de catálogo (backup vence) pode tocar campos que o destino usa em outras integrações (ex: renomear `hospital_units.name`); é o efeito desejado pela decisão de produto, mas vale notar.
4. Senhas continuam sem migrar; FKs para usuários ausentes em `auth/users.json` continuam órfãs.
5. CHECK/trigger BEFORE INSERT novos no destino seguem fora de cobertura — rejeição válida.
