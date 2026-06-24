
## Diagnóstico

**BUG 1 — Nullability sempre cai no fallback "NOT NULL".**
A RPC `get_public_columns_nullability` existe no banco, mas o PostgREST schema cache do projeto não conhece — todo `admin.rpc("get_public_columns_nullability", …)` falha com "Could not find the function … in the schema cache" e o código assume NOT NULL para tudo. Continua dropando linhas idênticas à versão anterior.

Por contraste, a RPC `get_public_table_columns` (usada na descoberta de schema em `handleStep`, linhas 230-244) funciona e está no cache. É o mesmo `information_schema.columns` por dentro — só faltou trazer `is_nullable`.

**BUG 2 — `min(uuid)` ainda no row-fallback de `prescriptions/part-0000`.**
`normalizeShape()` (linhas 153-162) tem early-return `if (rows.length <= 1) return rows;`. No fallback linha-a-linha (linhas 770-780) o payload é `[row]` (1 elemento) — `normalizeShape` é no-op, e a linha retém apenas as chaves nativas do JSONL daquela linha (sem completar o conjunto-união da tabela). O retry mantém forma diferente do batch e PostgREST volta a agregar `min(uuid)`.

## Mudanças

### 1. Migração — estender RPC já cacheada (sem criar função nova)
- `DROP FUNCTION public.get_public_table_columns(text[])` (necessário porque mudamos o RETURNS TABLE).
- `CREATE FUNCTION public.get_public_table_columns(tables text[]) RETURNS TABLE(table_name text, column_name text, is_generated boolean, is_identity boolean, is_nullable boolean)` — mesmo `SECURITY DEFINER`/`STABLE`/`search_path`, só adicionando `(c.is_nullable = 'YES')::boolean`.
- `NOTIFY pgrst, 'reload schema';` ao final, para forçar o PostgREST a recarregar.
- A `get_public_columns_nullability` permanece no banco (não removo agora — pode estar referenciada em audit/log; descontinuada de fato, sem mais chamada do código).

### 2. `supabase/functions/backup-restore/index.ts`

**a. Descoberta de schema (linhas 227-244)** — popular um terceiro mapa:
- Adicionar `const nullable_by_table: Record<string, Record<string, boolean>> = {};`
- No loop sobre `colsRows`, gravar `nullable_by_table[r.table_name][r.column_name] = r.is_nullable`.

**b. Filtro de FK órfã (linhas 613-635)** — remover a chamada `admin.rpc("get_public_columns_nullability", …)` inteira. Construir `nullableMap` lendo direto de `nullable_by_table[table]`. Default seguro continua `false` (drop) se a chave não estiver no mapa — mas agora o mapa estará populado para 100% das colunas de todas as tabelas-alvo, então o default deixa de ser exercido na prática.

**c. `normalizeShape` (linhas 153-162)** — remover o early-return `if (rows.length <= 1) return rows;` (mantém a função correta também para 0/1 elemento — só aplica `{...r}` sem mudar nada quando há 1 chave única).

**d. Upsert principal de não-catálogo (linhas 760-788)** — mover a normalização para FORA do loop de batches, aplicando-a uma vez sobre `allRows` completo (após o two-pass de `prescriptions.parent_id` zerar `parent_id`). Isso garante shape-união GLOBAL. Em seguida:
- `slice = normalizedAllRows.slice(i, i + BATCH)` (sem re-normalize por slice).
- No fallback linha-a-linha, `row` já carrega o shape-união. Como redundância defensiva, envolver em `normalizeShape` também não custa, mas o ganho real vem do shape global.

### 3. Sem mudanças
- Catálogo, `user_roles`, two-pass `parent_id`, `dedupeBy`, fallback `min(uuid)` em `user_roles` (linhas 525-543), liberação `bed_number`, auditoria, manutenção, lógica de auth.
- UI (`BackupRestorePage.tsx`) — relatório já mostra `nulled_fk_counts` e `rows_without_patient_link`, vai começar a popular sozinho após a correção de schema cache.

## Verificação esperada após aplicar
1. Próxima execução de restore: log de descoberta NÃO terá mais "nullability lookup … Could not find the function …". O painel mostrará contagem real em "Campos de FK anulados" (clinical_evolutions.patient_id, exam_requests.encounter_id, etc.) e queda equivalente em "FK órfãs dropadas".
2. `vital_signs.patient_id`, `conduct_history.patient_id`, `patient_admission_date_history.patient_id` continuam aparecendo em "dropadas" (são NOT NULL — comportamento correto).
3. `errorSamples` de `prescriptions/part-0000` não conterá mais `row-fallback prescriptions: function min(uuid) does not exist`. `minUuidRetries` deve cair para 0 ou próximo disso.

## Risco
Baixo. Mudança de RPC é aditiva (nova coluna no RETURNS TABLE) e o único consumidor é o próprio edge function. `NOTIFY pgrst` é necessário porque a alteração do RETURNS muda a assinatura no cache. Remoção do early-return do `normalizeShape` é semanticamente idêntica para 0/1 elemento.
