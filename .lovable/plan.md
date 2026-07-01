## Objetivo
Adicionar modo **incremental** ao `backup-create`, com corte por timestamp `since`, mantendo o mesmo formato de arquivo (manifest + JSONL + auth + checksum) já consumido pelo `backup-download` / `backup-import`.

## Tabelas SEM `updated_at` E SEM `created_at` (sempre completas)
Consulta no `information_schema` confirmou **7 tabelas**:

1. `db_restore_audit`
2. `locked_sector_cleanup_log`
3. `medical_record_edit_history`
4. `patient_admission_date_history`
5. `patient_registry_edit_history`
6. `prescriptions_archive`
7. `user_roles`

Observações:
- `prescriptions_archive` **não é pequena** (recebe rascunhos órfãos do pg_cron). Vai inflar o incremental. Confirmar se quer mesmo incluí-la inteira ou **pular** no modo incremental (é arquivo descartável).
- `user_roles` já é tabela "special" hoje, segue completa.
- As 5 `*_history` / `*_audit` / `cleanup_log` são append-only de auditoria — incluir inteiras é seguro/conservador.

Tabelas que têm **só `created_at`** (sem `updated_at`) — incremental filtra por `created_at > since` (append-only de fato): `audit_logs`, `backup_audit`, `bed_status_history`, `cid10_codes`, `conduct_history`, `data_requests`, `db_backups`, `dispensations`, `hospital_units`, `ip_access_log`, `medical_records`, `medication_aliases`, `medication_favorites`, `medication_presentations`, `password_reset_requests`, `patient_merge_audit`, `patient_movements`, `patient_versions`, `prescription_affinity_audit`, `prescription_draft_deletion_audit`, `reception_desk_sessions`, `shift_handovers`, `states`.

⚠️ `cid10_codes` tem `created_at` — pelo regra 2 entraria no filtro. Como é catálogo estático, sugiro forçar **sempre completo** (mover para SPECIAL). Confirmar.

Tabelas **especiais** (config/permissões) já tratadas à parte hoje em `SPECIAL_TABLES`: `profiles`, `user_roles`, `user_departments`, `user_hospital_assignments`, `institution_branding`, `hospital_units`, `states`, `system_maintenance_mode` — proposta: **sempre completas** no incremental (pequenas, restore depende íntegras).

`auth.users` (Admin API) — sempre completa (não há `updated_at` exposto confiável).

## Plano de implementação

### `supabase/functions/backup-create/index.ts`
1. Action `start` aceita `since?: string` (ISO 8601). Validação: `!isNaN(Date.parse(since))` ou 400.
2. Persistir em `state.since` e em `backup_jobs.progress.state` / `manifest`.
3. No passo `init`, nova RPC `get_public_tables_timestamp_cols()` retorna `{name, has_updated_at, has_created_at}` para todas as públicas → guardar em `state.tableMeta`.
4. Helper `applySinceFilter(query, table)`:
   - se `!since` → retorna query
   - se `SPECIAL_SET.has(table)` → retorna query (completa)
   - se `tableMeta[table].has_updated_at` → `.gt('updated_at', since)`
   - senão se `has_created_at` → `.gt('created_at', since)`
   - senão → query inalterada (completa)
5. Aplicar nas fases `data` e `special` (special já é forçada full).
6. Manifest enriquecido:
   ```json
   "incremental": { "enabled": true, "since": "2026-06-29T13:47:46Z" },
   "table_filter_mode": { "<table>": "updated_at"|"created_at"|"full" }
   ```
   `backup_version` permanece `3.0` (compat com `backup-import`).
7. Naming opcional: jobs incrementais ganham `reason` prefixado `[INCR desde …]` para listar fácil.

### Migration
- Criar RPC `public.get_public_tables_timestamp_cols()` SECURITY DEFINER, grant a `service_role`.

### UI `src/pages/BackupRestorePage.tsx`
- Toggle "Backup incremental".
- Quando ligado: campo datetime-local pré-preenchido com `finished_at` do último backup `completed` (consulta já existe). Envia ISO no body.
- Badge "Incremental desde DD/MM/AAAA HH:MM" no card do job e no histórico.

## Riscos
- **Deleções** após `since` NÃO entram no incremental (limitação sem tombstones). Documentado no manifest e em toast.
- Restore: `backup-import` faz upsert por PK → incremental se sobrepõe corretamente; novas linhas inseridas, edições sobrescrevem; deleções exigem full periódico.
- Tabelas onde `updated_at` não é atualizado por trigger em todos os UPDATEs ficariam sub-representadas (fora de escopo — auditável depois).

## Preciso confirmar antes de implementar
1. `prescriptions_archive`: incluir inteira ou **pular** no incremental?
2. `cid10_codes`: mover para SPECIAL (sempre completa) ou manter filtro por `created_at`?
3. OK manter SPECIAL_TABLES sempre completas mesmo as que têm `updated_at` (`profiles`, `institution_branding`)?
4. Confirma `2026-06-29T13:47:46Z` apenas como default da UI (não hardcode no código)?
