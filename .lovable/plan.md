# Plano de correção do `backup-restore` (5 causas)

Escopo: somente `supabase/functions/backup-restore/index.ts` + 1 nova migration com RPCs read-only de introspecção. Frontend, `backup-create`, `backup-import`, auditoria e modo manutenção ficam intactos.

## Ordem final de execução durante um restore

```text
handlePlan
  1. lê manifest
  2. chama RPCs de schema do destino (colunas + UNIQUEs)
  3. persiste schema em restore_jobs.progress.schema
  4. se manifest tem auth/users.* → injeta etapa virtual __auth_users__ no início
  5. ordena catálogos antes das tabelas filhas

handleStep __auth_users__   (1º)
  → admin.auth.admin.createUser preservando UUID
  → se já existir, updateUserById (idempotente)
  → sem senha (reset por email — decisão já documentada)

handleStep catálogos        (2º)
  → limpa colunas generated/inexistentes
  → procura linha local por chave natural (name/code)
  → se achou: id_maps[tabela][backup_id] = local_id, NÃO sobrescreve
  → se não achou: insere preservando id do backup, id_maps[backup_id] = backup_id

handleStep tabelas filhas   (3º)
  → limpa colunas generated/inexistentes
  → traduz FKs conhecidas via id_maps
  → upsert por PK (comportamento atual)

handleFinalize
  → grava report com errors_by_table, error_samples,
    dropped_columns_by_table, catalog_conflicts_by_table,
    id_map_counts
```

## Causa 1 — colunas GENERATED / IDENTITY ALWAYS

- Nova RPC `public.get_public_table_columns(tables text[])` (`SECURITY DEFINER`, `GRANT EXECUTE TO service_role`) retornando `table_name, column_name, is_generated, is_identity` de `information_schema.columns`.
- `handlePlan` chama uma vez para todas as tabelas do plano e salva em `progress.schema.cols_by_table[t] = { allowed, generated, identity_always }`.
- `handleStep`, antes de cada `upsert(slice)`, faz line-cleaning: remove qualquer coluna em `generated ∪ identity_always`.
- Contador `dropped_columns_by_table[t][col]++` propagado ao `report`.
- Resolve `patient_registry.full_name_normalized` e qualquer outra coluna gerada, sem hardcode.

## Causa 2 — colunas inexistentes no destino

- Mesma RPC fornece `allowed` (todas as colunas reais da tabela no destino).
- Line-cleaning adicional: remove do row qualquer chave fora de `allowed`.
- Conta no mesmo `dropped_columns_by_table` com flag `reason: "missing_in_target"` (chave composta `col__missing`).
- Resolve `patients.clinical_status` e qualquer renomeação/remoção futura.
- Fallback seguro: se a metadata da tabela não veio (RPC falhou para aquela tabela), pula a limpeza para não bloquear o restore.

## Causa 3 — duplicate key em UNIQUE secundária de catálogos + mapa de tradução de id

**Sim, o mapa de tradução é necessário** — sem ele, `ON CONFLICT DO NOTHING` por `name/code` preserva a linha local mas deixa as FKs filhas apontando para um id que não existe no destino.

- Nova RPC `public.get_public_unique_constraints(tables text[])` retornando UNIQUEs reais com colunas ordenadas, salva em `progress.schema.unique_by_table`.
- Allowlist `CATALOG_NATURAL_KEYS` (só é aplicada se houver UNIQUE real correspondente no destino):
  ```ts
  hospital_units: ["name"]
  states: ["code"]                    // ajustar para "name" se a UNIQUE for por nome
  cid10_codes: ["code"]
  medical_codes: ["code"]
  medication_catalog: ["name"]
  medication_presentations: ["medication_id", "presentation"]
  medication_aliases: ["alias"]
  data_retention_policies: ["data_type"]
  ```
- Fluxo por linha de catálogo:
  1. line-cleaning (causa 1+2)
  2. `SELECT id FROM <tabela> WHERE <chave_natural> = <valor>`
  3. se existe → `id_maps[tabela][backup_id] = local_id`, **não sobrescreve** (preserva dado local)
  4. se não existe → `INSERT` preservando o id do backup → `id_maps[backup_id] = backup_id`
  5. registra `catalog_conflicts_by_table[t] = { matched_existing, inserted, skipped_updates }`
- `id_maps` persistido em `progress.id_maps`; resumido como `id_map_counts` no `report`.

## Causa 4 — recriar `auth.users` antes de tudo

- `handlePlan` detecta `auth/users.json` / `auth/users.part-*.jsonl` no manifest e injeta etapa virtual `__auth_users__` como **primeira** do plano.
- `handleStep('__auth_users__')`:
  - `admin.auth.admin.createUser({ id, email, email_confirm: true, user_metadata, app_metadata })` — **preserva UUID original**.
  - Se já existe (`User already registered` ou lookup prévio): `updateUserById(id, { user_metadata, app_metadata })`, idempotente.
  - Sem migração de senha (decisão documentada em mem://features/backup-restore-module): usuário redefine via email.
  - Erros vão para `error_samples` e `errors_by_table["__auth_users__"]`.
- Só depois rodam `profiles`, `user_roles`, `user_departments`, `field_text_templates`, `db_backups`.
- Auditoria/manutenção existentes não são tocadas.

## Causa 5 — `hospital_unit_id` órfão (e demais FKs de catálogo)

- Resolvida pela combinação Causa 3 + tradução automática de FK por nome de coluna.
- `FK_TRANSLATIONS` (genérico, aplicado antes de qualquer upsert de tabela não-catálogo):
  ```ts
  hospital_unit_id        → id_maps.hospital_units
  state_id                → id_maps.states
  cid10_code_id, cid_id   → id_maps.cid10_codes
  medication_id           → id_maps.medication_catalog
  ```
- Se a linha tem `hospital_unit_id = X` e `id_maps.hospital_units[X]` existe, substitui pelo `local_id` antes do upsert. Caso contrário mantém — se ficar órfão, cai em `error_samples` com a mensagem original.
- Cobre as 6 tabelas reportadas (`user_hospital_assignments`, `saps3_assessments`, `prescription_quick_templates`, `pre_registration_requests`, `pre_admissions`, `bed_census`).

## Arquivos a tocar (quando aprovado)

1. **Nova migration** — `get_public_table_columns(text[])` e `get_public_unique_constraints(text[])`, `SECURITY DEFINER`, `GRANT EXECUTE TO service_role`. Sem alterações de RLS ou tabelas existentes.
2. **`supabase/functions/backup-restore/index.ts`** — alterações em `handlePlan` (descoberta de schema, injeção de `__auth_users__`, marcação de catálogos), `handleStep` (branch `__auth_users__`, line-cleaning, fluxo catálogo, tradução de FK) e `handleFinalize` (campos adicionais no report). Lógica de auditoria e manutenção preservada.

## Erros que ainda podem persistir após a correção

1. **Senhas não migram** — usuários recriados precisam redefinir via email (limitação Lovable Cloud, já documentada).
2. **Usuários em `auth/users.json` com email inválido/duplicado de outro provider** — `createUser` falha; FKs desses usuários continuam órfãs.
3. **Backup sem `auth/users.json`** — não há fonte para recriar; FKs para auth seguem falhando.
4. **Catálogo fora da allowlist** com UNIQUE secundária — pode continuar dando duplicate key (basta adicionar à allowlist conforme aparecer no relatório).
5. **FK por coluna não prevista em `FK_TRANSLATIONS`** — fica órfã; expansível a partir do próximo relatório de erros.
6. **CHECK/NOT NULL/trigger BEFORE INSERT novos no destino** — line-cleaning não cobre; rejeição válida.
7. **Race se o frontend disparar `handleStep` em paralelo** — `progress` é read-modify-write; o frontend atual serializa, mas paralelismo exigiria RPC atômico de merge.
8. **Atualização de catálogo pulada por design** — preserva FKs locais ao custo de não trazer mudanças de nome/metadata do backup. Aceito conscientemente.
