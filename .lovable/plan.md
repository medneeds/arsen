## Objetivo

Mudar o filtro de FK órfã em `supabase/functions/backup-restore/index.ts` (ramo não-catálogo, linhas 602-663) para **preservar o máximo de linhas possível**: quando a coluna de FK órfã for nullable, anular só a coluna; quando for NOT NULL, manter o drop atual.

Escopo restrito ao tratamento de FK órfã das tabelas clínicas filhas. **Não toca**: ramo catálogo (states/hospital_units/cid10_codes), `user_roles`, lógica de `patients` (bed_number), two-pass de `prescriptions.parent_id`, fail-safe de chunk=100, normalizeShape, fallback min(uuid), auditoria, manutenção. Sem migração SQL.

## Mapa de impacto (colunas em `FK_PARENTS` × tabelas filhas)

Consultado via `information_schema.columns`.

**NOT NULL — continuam sendo dropadas (não há como anular):**
- `conduct_history.patient_id`
- `patient_admission_date_history.patient_id`
- `vital_signs.patient_id`
- `patient_registry_edit_history.patient_registry_id`

**NULLABLE — passam a ser anuladas (coluna vira NULL, linha preservada):**
Todas as demais ocorrências de `patient_id`, `registry_id`, `patient_registry_id`, `encounter_id`, `medical_record_id` nas tabelas filhas — incluindo:
- `clinical_evolutions` (3 colunas)
- `exam_requests` (3)
- `culture_results` (3)
- `patient_movements` (3)
- `discharge_documents` (3)
- `admission_histories` (3)
- `medical_record_edit_history` (3)
- `round_sessions` (2)
- `prescriptions` / `prescriptions_archive` (2 cada — não têm `patient_id`)
- `bed_census`, `bed_allocation_requests`, `dhd_patients`, `locked_sector_cleanup_log`, `medical_records`, `patient_encounters` (registry_id, medical_record_id), `pre_admissions`, `prescription_affinity_audit`, `prescription_draft_deletion_audit`, `receituarios`, `regulation_requests`, `regulatory_guides`, `saps3_assessments`, `sepsis_protocols`

A nulabilidade não é hardcoded — vai ser consultada em runtime (ver "Detecção" abaixo) para ficar genérica a qualquer evolução de schema.

## Mudanças no código (`backup-restore/index.ts`)

### 1. Cache de nulabilidade por (tabela, coluna)
Helper `getColumnNullable(admin, table, column)` com cache em closure por execução. Implementação: uma única chamada inicial a `information_schema.columns` filtrando por `table_schema='public'` e `column_name IN (...FK_PARENTS keys)`, retornada via `supabase.from('information_schema.columns')` — se PostgREST não expuser, cai em chamadas pontuais via RPC `get_public_columns_nullability(p_table, p_columns text[])` já existente no projeto ou, em último caso, uma RPC nova que use SECURITY DEFINER. Decisão preferida: **pré-carregar uma única vez no início de cada `step` action**, montando `Map<"table.column", boolean>` — minimiza round-trips. (Se nenhuma RPC servir, criar `public.get_columns_nullable(p_columns text[])` retornando `setof (table_name, column_name, is_nullable)` — única migração possível; valido com o usuário antes.)

### 2. Novos contadores no escopo do `step`
- `nulledFkCounts: Record<string, number>` — chave `"<table>.<column>"`, conta linhas com coluna anulada por órfã ou por fail-safe.
- `noPatientLinkRows: number` — linhas que, após anulações, ficaram com `patient_id`, `patient_registry_id` E `encounter_id` todos NULL/ausentes simultaneamente (linha ainda inserida, conforme regra "backup vence").
- Manter `orphanFkDropped` apenas para drops verdadeiros (coluna NOT NULL ou fallback impossível).

### 3. Reescrita do loop FK órfã (linhas 602-663)

Para cada `(fkCol, parentTable)` aplicável:

a. Coleta `vals` e busca `existing` no destino com chunk 100 (igual hoje).

b. **Caminho feliz (lookupOk):** para cada linha com `v` definido e `v ∉ existing`:
   - Se `getColumnNullable(table, fkCol)` → setar `(r as any)[fkCol] = null`; incrementar `nulledFkCounts["<table>.<fkCol>"]`.
   - Senão → remover a linha de `allRows`; incrementar `orphanFkDropped[fkCol]`.

c. **Fail-safe (lookup falhou):** para cada linha com `v != null`:
   - Se NULLABLE → setar `null`; somar em `nulledFkCounts` com sufixo `" (fail-safe)"` no sample, mas mesmo bucket no contador.
   - Senão → drop, somar em `orphanFkDropped[fkCol]`.

d. **Pós-loop de TODAS as colunas FK:** varrer `allRows` uma vez e contar linhas onde `patient_id`, `patient_registry_id` e `encounter_id` estão todos null/ausentes → `noPatientLinkRows`. Linha NÃO é removida.

### 4. Reporting
- Estender `step` response e o merge em `handleStep`/`handleFinalize` para incluir `nulled_fk_counts` e `rows_without_patient_link`.
- `errorSamples` ganha amostras distintas: `"FK órfã NULLADA …"` vs `"FK órfã DROPADA (NOT NULL) …"` vs `"sem vínculo de paciente …"`.
- `db_restore_audit.metadata` (ou campo equivalente já gravado em `finalize`) recebe os dois novos agregados.

### 5. UI (`src/pages/BackupRestorePage.tsx`)
Exibir, no painel de resultado do restore, dois blocos novos abaixo do que já mostra "FK órfãs dropadas":
- "Campos de FK anulados" (tabela.coluna → contagem).
- "Linhas sem vínculo de paciente preservadas para revisão" (contagem total).

Sem mudança em filtros, fluxo de jobs, manutenção ou auditoria existente.

## O que NÃO muda
- Catálogos, user_roles, two-pass parent_id, dedupe por PK, normalizeShape, fallback min(uuid), liberação de bed_number, fail-safe de chunk 100 (mantém chunk e o caminho de erro — só troca o que faz com a linha).
- Schema do banco, exceto possivelmente uma RPC read-only nova para nulabilidade (só se nenhuma das alternativas existentes servir; valido antes).

## Pergunta antes de aplicar
Confirma a lista de 4 colunas NOT NULL acima (continuam sendo dropadas) e o uso de pré-carregamento de nulabilidade via `information_schema` (ou RPC nova se necessário)? Posso seguir?
