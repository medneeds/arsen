Escopo: `supabase/functions/backup-restore/index.ts` e `src/pages/BackupRestorePage.tsx`. Sem migration. Regra mantida: backup vence.

## Diagnóstico (causas raiz reais)

### ROBUSTEZ 1 — manutenção presa
O `handlePlan` ativa `system_maintenance_mode` e o `handleFinalize` desativa. Quando um `step` aborta no meio (timeout, erro HTTP no client, navegador fechado, Promise rejection no front), o `finalize` simplesmente nunca é chamado e a flag fica `is_active=true` para sempre. O `try/catch` no `serve()` só roda em exceção da própria função; perda de conexão do client não dispara nada server-side.

Correção: criar `forceDeactivateMaintenance(admin)` (UPDATE puro com `is_active=false`, `started_at=null`, `started_by=null`, `reason=null`, `expected_end_at=null`) e chamá-la em **três pontos**:
1. `try/finally` envolvendo o corpo completo do `serve()` — garante limpeza no fim de qualquer chamada cujo restore esteja `failed/completed` (idempotente: se o restore segue rodando, NÃO derruba).
2. `handleFinalize` (já existe).
3. **Nova action `"force_unlock"`** — exposta para o botão admin, exige `super_admin`, escreve em `backup_audit` (`MAINTENANCE_FORCE_OFF`) com `actor_id` e motivo opcional do body, e marca como `failed` qualquer `restore_jobs.status='running'` desse user (campo `error = "force_unlock by admin"`).

Como o `try/finally` decide quando limpar: ler `restore_jobs.status` ANTES de limpar; só limpa se status ∈ `{completed, failed}` OU se a action era `force_unlock`. Para `step`/`plan` em andamento (`status='running'`), não toca. Isso evita que o finally derrube manutenção no meio de um restore válido.

### ROBUSTEZ 2 — botão "Forçar saída do modo manutenção"
Em `BackupRestorePage.tsx`, adicionar:
- Indicador visual lendo `system_maintenance_mode.is_active` (já em uso pelo `MaintenanceModeBanner`).
- Botão **destrutivo** "Forçar saída do modo manutenção" visível só se `isSuperAdmin && maintenanceActive`. Confirma via `AlertDialog` (texto "DESBLOQUEAR"), chama `supabase.functions.invoke("backup-restore", { body: { action: "force_unlock", reason } })`, recarrega lista de jobs e toast de sucesso.

### DADOS 1 — `patient_encounters` falha em `patient_id_fkey`
Verificado em `pg_constraint`:
```
patient_encounters.patient_id → patients(id)           -- preservado
patient_encounters.registry_id → patient_registry(id)  -- preservado
```
Ordem topológica está correta (`patients` → `patient_encounters`). Patients entrou com 167/0. FK aponta para `patients(id)` literal (sem catálogo, sem remapeamento). **Não é ordem nem alvo de FK.**

Causa real: o filtro de FK órfã EXISTE (linhas 547-583) mas **não está dropando todas as órfãs**. Investigando o select:

```ts
admin.from(parentTable).select("id").in("id", chunk) // CHUNK=500
```

PostgREST envia esse `in.()` como query string em GET. 500 UUIDs × 38 chars ≈ **19 KB de URL**, acima do default seguro do PostgREST/edge (16 KB típico) — a request retorna 414/silenciosamente trunca em alguns proxies, e o set `existing` fica incompleto. Linhas cujo pai REALMENTE existe ficam fora de `existing` e seriam dropadas (falso negativo); mas pior, em alguns chunks a query falha → `lookupOk=false` → `continue` PULA o filtro para essa coluna, e o slice inteiro vai para upsert sem filtro → 328 erros de FK.

Correção:
1. Reduzir `CHUNK` do FK filter para **100** (≈ 3.8 KB de URL, seguro).
2. Mudar o fallback de erro: se `selErr` ocorrer, **NÃO** pular o filtro — em vez disso, marcar a tabela como "filtro inconclusivo" e dropar **todas** as linhas com FK não-nula naquela coluna (fail-safe pela regra "backup vence só onde há integridade"). Loga em `orphanFkDropped[fkCol]` + sample.
3. Acrescentar log `console.error` com o erro real do select para diagnóstico.

Bônus: incluir filtro para **`patient_encounters` nos próprios encounters do backup** — se um encounter referencia patient_id que ESTÁ no backup mas foi dedupado em patients (ex.: colisão de bed_number na dedupe), também vira órfão. O filtro genérico já cobre esse caso porque consulta o destino real após o patients ter sido carregado.

### DADOS 2 — `min(uuid) does not exist` ainda vivo em prescriptions
Investigação no caminho atual:
- Dedupe por PK: feito (linha 496).
- Drop sem PK: feito (linha 488).
- Two-pass parent_id: feito (linha 587).

**Causa restante**: PostgREST, ao receber um array de upsert com **shapes diferentes** entre linhas (uma linha tem `parent_id`, outra não tem a chave; uma tem `validated_by`, outra não), normaliza o conjunto de colunas internamente via agregados — para colunas UUID, dispara `min(uuid) does not exist`. Isto é independente da dedupe por PK; basta haver **duas linhas com keys-set distintos** no array enviado.

Ocorre em prescriptions porque o backup pode conter rascunhos antigos sem campos novos (validated_by, parent_id, etc.) misturados com prescrições novas.

Correção: novo helper `normalizeShape(rows)` aplicado **antes de TODO upsert** no ramo não-catálogo:
1. Calcula `keysUnion = união de Object.keys de todas as rows`.
2. Para cada row, atribui `null` (não `undefined`) em cada chave de `keysUnion` ausente.
3. Resultado: array uniforme — PostgREST não precisa agregar e o min(uuid) some.

Combinado com o fallback linha-a-linha já existente (que segue ativo como rede de segurança), elimina o erro.

Confirmação parent_id auto-FK: tratado em dois passes. Pass A escreve `parent_id=null` (já feito). Pass B em `handleFinalize` valida pai no destino antes de atualizar (já feito). Mantém.

### Cascata
Resolver DADOS 1 (filtro FK confiável) destrava:
- `prescriptions` (4322): perde órfãs `patient_id`/`encounter_id`/`patient_registry_id`; entra o resto.
- `clinical_evolutions` (3679), `exam_requests` (2955), `patient_movements`, `bed_census`, `saps3_assessments`, `discharge_documents`, `medical_records`, `admission_histories`, `internal_transfer_requests`, `prescription_validations`, `medical_record_edit_history`: idem.

Estimativa: derruba ~90% dos 12k. Sobra: órfãs verdadeiras, regras de afinidade (triggers `enforce_*_affinity`), uniques compostas raras.

## Mudanças

**`supabase/functions/backup-restore/index.ts`:**
1. Helper `forceDeactivateMaintenance(admin)` no topo dos helpers.
2. Wrap do corpo do `serve()` em `try/finally` que: lê status do restore (se `restore_id` está no body) e só desativa manutenção se status ∈ `{completed, failed}` OU action === `force_unlock`.
3. Nova action `force_unlock`: super_admin obrigatório, marca restore_jobs.running do user como failed, chama `forceDeactivateMaintenance`, audita `MAINTENANCE_FORCE_OFF`.
4. FK filter chunk 500 → 100 + fail-safe (drop tudo com FK não-nula em caso de selErr) + console.error.
5. Helper `normalizeShape(rows)` e aplicação antes de cada `.upsert(slice, ...)` no ramo não-catálogo (inclui o ramo `user_roles`).

**`src/pages/BackupRestorePage.tsx`:**
1. Hook `useMaintenanceActive()` (`select is_active from system_maintenance_mode where id=1`, com realtime opcional ou refetch a cada 5s).
2. Botão destrutivo "Forçar saída do modo manutenção" com `AlertDialog`, motivo opcional, exige super_admin. Invoca `backup-restore` com `action: "force_unlock"`.
3. Toast + recarregamento de jobs e audit após sucesso.

## Resposta direta ao usuário

- **patient_encounters não era ordem nem alvo**: era o filtro de FK órfã estourando o URL do PostgREST com chunks de 500 UUIDs (~19 KB), causando falha no select → fallback ingênuo pulava o filtro → upsert recebia órfãs e falhava com `patient_id_fkey`. Reduzir o chunk para 100 + fail-safe resolve.
- **min(uuid) restante em prescriptions**: era PostgREST agregando para uniformizar shape do array quando linhas tinham conjuntos de chaves diferentes. `normalizeShape` força keys idênticas (preenchendo com `null`) e elimina a agregação.
- **try/finally do modo manutenção**: corpo do `serve()` envolto em finally que lê o status do restore antes de limpar — só desativa quando o job está em estado terminal (completed/failed) ou quando a action é a explícita `force_unlock`. Para restores ainda rodando entre chamadas, NÃO toca. O botão admin é o último recurso quando o client morre no meio.

Auditoria existente: intocada. Apenas adiciona evento novo `MAINTENANCE_FORCE_OFF`.
