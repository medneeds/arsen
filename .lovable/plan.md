Escopo: somente `supabase/functions/backup-restore/index.ts`. Sem migration nova. Auditoria/manutenção intactas. Regra de produto mantida: **backup vence em conflito UNIQUE**.

## Diagnóstico

### Problema 1 — `min(uuid) does not exist` em `prescriptions.part-0000`

Não há `MIN()`/`MAX()` no nosso código TypeScript, nenhum trigger em `prescriptions` e nenhuma policy/função SQL que agregue UUID (verifiquei via `pg_trigger`, `pg_policies` e `pg_proc`). A origem é **PostgREST**: quando o payload de `upsert` contém **duas linhas com o mesmo valor na coluna de `onConflict`**, PostgREST gera internamente uma agregação por coluna para "achatar" as duplicatas em uma única linha antes do `INSERT ... ON CONFLICT`. Para colunas UUID (sem operador de ordenação total registrado), essa agregação dispara exatamente `function min(uuid) does not exist`.

Por que só em `prescriptions`: é a tabela com `parent_id` (auto-FK de versionamento), então o backup costuma trazer várias linhas com o mesmo `id` reaparecendo entre partes ou a mesma linha exportada duas vezes por arquivamento. Em outras tabelas isso é raro o suficiente para não ter aparecido.

**Correção:** deduplicar o `slice` em memória **antes** de qualquer `upsert`, com Map chaveado pela tupla de `onConflict` (last-wins). Aplicado em todos os três ramos: catálogo (branch já é por-linha, ok), `user_roles` (chave `user_id,role`), e ramo genérico não-catálogo (chave = PK), e também no ramo especial de `patients` (chave = `id`). Também deduplicar por `bed_number` no slice de `patients` (last-wins) para evitar duas linhas do backup brigando pelo mesmo leito dentro do mesmo batch.

### Problema 2 — `patients_bed_number_key` ainda viola

A liberação atual roda por slice e cobre `bed_number` ocupado por **id diferente no destino**, mas falha em três cenários:

1. **Duplicata no próprio slice do backup**: duas linhas do backup com mesmo `bed_number`. O upsert não tem chance — a UNIQUE estoura antes. Resolvido pela dedupe do Problema 1 + dedupe por `bed_number`.
2. **Cross-slice no destino**: paciente do destino com bed `L05` pode não aparecer no slice atual mas aparecer num slice posterior. Mais robusto rodar a liberação **uma vez por arquivo** (sobre todos os `rows`), antes do laço de slices, em vez de por slice.
3. **`.update().in()` silenciosamente bloqueado por RLS** se a service_role tiver gatilho `BEFORE UPDATE`. Vamos ler o `count` retornado e contabilizar; se vier 0 e havia conflitos, emite errorSample didático.

**Correção:**
- Mover a liberação de `bed_number` para **antes** do laço `for (i ...)` em `patients`, usando o conjunto de beds extraído de **todos os `rows`** já traduzidos+dedupados.
- Adicionar `count: 'exact'` no `update` para auditoria e log se mismatch.
- Dedupe local por `bed_number` (last-wins) garante que o slice nunca leve dois ocupantes para o mesmo leito.

### Problema 3 — `hospital_units.state_id` órfão (efeito colateral do "backup vence")

Causa raiz no código: o ramo `isCatalog` (linhas 371-429) chama `cleanRow` mas **não** chama `translateRow`. Como `hospital_units` é catálogo, seu `state_id` segue com o id do backup e quebra a FK. Funcionou em `patients` etc. só porque o ramo não-catálogo (linha 450) chama `translateRow`.

**Correção:** aplicar `translateRow(cleaned)` no ramo de catálogo, tanto no `updatePayload` quanto no `insert`. Como `FK_TRANSLATIONS` já contém `state_id → states` e `states` é processado **antes** de `hospital_units` pela ordem topológica, o `id_maps.states` já estará populado.

### Cascata (confirmação)

`prescriptions_encounter_id_fkey`, `prescriptions_parent_id_fkey`, `prescription_validations`, `discharge_documents`, `patient_movements_encounter_id_fkey`, `medical_record_edit_history`: todos dependem de `patients`/`patient_encounters`/`prescriptions` entrarem 100%. Resolvendo 1 (prescriptions entra) e 2 (patients entra), a cascata cai sozinha. Se sobrar erro residual nessas três, será motivo novo (UNIQUE própria) e tratamos no próximo round.

## Mudanças no arquivo

`supabase/functions/backup-restore/index.ts`:

1. **Helper `dedupeBy(rows, keyFn)`** — Map last-wins, retorna array. Adicionar perto de `cleanRow`/`translateRow`.

2. **Ramo catálogo (linhas 371-429)**:
   - `const cleaned = translateRow(cleanRow(raw))` (acrescenta `translateRow`).
   - Sem outras mudanças estruturais.

3. **Ramo `user_roles` (linha 432-445)**:
   - Após montar o slice, `dedupeBy(slice, r => \`${r.user_id}::${r.role}\`)`.

4. **Ramo genérico não-catálogo (linha 446-491)** — reestruturar:
   - **Antes do laço de slices**, montar `allRows = rows.map(r => translateRow(cleanRow(r)))` e `allRows = dedupeBy(allRows, r => pk.map(c => r[c]).join('::'))`.
   - **Se `table === "patients"`**: rodar a liberação de `bed_number` **uma vez**, usando todos os `bed_number` distintos de `allRows`. Depois, dedupe extra por `bed_number` (last-wins) sobre `allRows`.
   - Loop em `allRows` (não mais `rows`): `upsert(slice, { onConflict })`. Já dedupado → não dispara `min(uuid)`.

5. **`bedNumberReassigned`**: contador acumulado igual hoje; report final inalterado.

6. **Novo contador `slice_dedupes_dropped`** opcional no `progress` para auditoria (quantas linhas duplicadas foram colapsadas) — útil para ver no relatório se o backup vinha realmente com duplicatas.

## Ordem de execução (inalterada)

```text
handlePlan → topoOrder (states antes de hospital_units, hospital_units antes do resto)
handleStep __auth_users__
handleStep catálogos (states → hospital_units → ...)  [agora com translateRow]
handleStep tabelas filhas                              [agora com dedupe por PK]
  ↳ patients: liberação de bed_number 1x + dedupe por bed_number
  ↳ user_roles: dedupe por (user_id, role)
handleFinalize
```

## O que ainda pode sobrar

1. Outras UNIQUEs secundárias específicas (além de `patients.bed_number` e `user_roles(user_id,role)`) — só aparecem com o próximo relatório; padrão de allowlist por tabela já existe.
2. `bed_number` liberado em uma linha do destino pode entrar em conflito com outra UNIQUE da mesma linha (raro). Tratável caso a caso.
3. Catálogos com UNIQUE composta ainda não listada em `CATALOG_NATURAL_KEYS`.
4. Senhas em `auth.users` continuam sem migrar; FKs para usuários inexistentes seguem órfãs (fora de escopo desta correção).
5. CHECK/trigger BEFORE INSERT novos no destino — rejeição válida.
