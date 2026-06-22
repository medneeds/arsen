# Plano de correção do `backup-restore`

Escopo: corrigir `supabase/functions/backup-restore/index.ts` e adicionar RPCs auxiliares de leitura de schema via migration. Não alterar frontend, backup-create/import, nem schemas de negócio.

## Objetivo

Tornar o restore de backup importado resiliente quando o destino já tem dados próprios, cobrindo:

1. colunas GENERATED no destino;
2. colunas presentes no backup mas inexistentes no destino;
3. conflitos em UNIQUE secundária de catálogos;
4. recriação de `auth.users` antes das tabelas públicas dependentes;
5. FKs órfãs por diferença entre IDs do backup e IDs locais.

## Ordem de implementação

### 1. Adicionar descoberta dinâmica de schema do destino

Criar RPCs read-only, `SECURITY DEFINER`, liberadas para `service_role`:

- `public.get_public_table_columns(tables text[])`
  - retorna tabela, coluna, `is_generated`, `is_identity` usando `information_schema.columns`.
  - `is_generated = 'ALWAYS'` identifica colunas como `patient_registry.full_name_normalized`.
- `public.get_public_unique_constraints(tables text[])`
  - retorna UNIQUEs reais por tabela, com lista ordenada de colunas.

`handlePlan` chama essas RPCs uma vez para as tabelas do plano e persiste em `restore_jobs.progress.schema`:

```ts
schema: {
  cols_by_table: {
    [table]: { allowed: string[], generated: string[], identity: string[] }
  },
  unique_by_table: {
    [table]: Array<{ name: string, columns: string[] }>
  }
}
```

### 2. Filtrar colunas antes de qualquer upsert

Em `handleStep`, antes de inserir/upsertar cada batch:

- remover qualquer coluna marcada como GENERATED/identity ALWAYS;
- remover qualquer coluna que não exista no destino;
- manter comportamento atual se a metadata não estiver disponível, para não bloquear restore por falha de introspecção.

Também acumular no progresso:

```ts
dropped_columns_by_table: {
  [table]: { [column]: count }
}
```

`handleFinalize` copia isso para `report.dropped_columns_by_table`, para auditoria no Histórico.

Resultado esperado:

- causa 1 resolvida genericamente para qualquer coluna generated;
- causa 2 resolvida genericamente para qualquer coluna removida/renomeada no destino.

### 3. Recriar `auth.users` no começo do plano

`handlePlan` deve detectar `auth/users.json` ou `auth/users.part-*.jsonl` no manifest e injetar uma etapa virtual no início do plano:

```ts
{ table: "__auth_users__", parts: [...], rows_expected: ... }
```

`handleStep` terá branch especial para `__auth_users__`:

- em `dry_run`: apenas contar usuários;
- em restore real:
  - chamar `admin.auth.admin.createUser({ id, email, email_confirm: true, user_metadata, app_metadata })`;
  - se usuário já existir, tratar como idempotente e, quando possível, atualizar metadata via `updateUserById`;
  - não migrar senha/hash, seguindo decisão documentada: usuário precisa redefinir senha por email.

Resultado esperado:

- `profiles`, `user_roles`, `user_departments`, `field_text_templates`, `db_backups` deixam de falhar por FK para usuários do backup quando esses usuários existirem em `auth/users.json`.

### 4. Resolver conflitos de catálogos com chave natural e mapa de tradução de IDs

Para `hospital_units`, `states`, `cid10_codes` e demais catálogos conhecidos, o problema não é só duplicate key: se o destino já tem `name/code` igual com `id` diferente, simplesmente fazer `ON CONFLICT DO NOTHING` preserva a linha local, mas as tabelas filhas do backup continuam apontando para o ID antigo do backup.

Portanto o plano deve incluir **mapa de tradução old_id -> local_id**.

#### Catálogos inicialmente cobertos

```ts
CATALOG_NATURAL_KEYS = {
  hospital_units: [["name"]],
  states: [["code"]],
  cid10_codes: [["code"]],
  medical_codes: [["code"]],
  medication_catalog: [["name"]],
  medication_presentations: [["medication_id", "presentation"]],
  medication_aliases: [["alias"]],
  data_retention_policies: [["data_type"]]
}
```

A chave natural só será usada se existir UNIQUE real compatível no destino, consultada pelo RPC de constraints.

#### Estratégia de restore para catálogos

Para cada linha de catálogo:

1. limpar colunas generated/inexistentes;
2. consultar se já existe linha local pela chave natural;
3. se existir:
   - registrar `id_map[table][backup_id] = local_id`;
   - opcionalmente atualizar campos não-chave via upsert por chave natural **somente se for seguro**;
   - estratégia inicial recomendada: `skip existing` para preservar dado local e evitar reescrever catálogos do destino;
4. se não existir:
   - inserir linha com o ID do backup quando possível;
   - registrar `id_map[table][backup_id] = inserted_id`.

Persistir no `progress`:

```ts
id_maps: {
  hospital_units: { [backupId]: localId },
  states: { [backupId]: localId },
  cid10_codes: { [backupId]: localId }
}
```

E no relatório:

```ts
catalog_conflicts_by_table: {
  [table]: { matched_existing: number, inserted: number, skipped_updates: number }
}
```

### 5. Aplicar mapa de tradução antes das tabelas filhas

Antes do upsert de tabelas não-catálogo, `handleStep` deve traduzir FKs conhecidas que apontam para catálogos mapeados.

Exemplos iniciais, derivados dos erros:

```ts
FK_TRANSLATIONS = {
  hospital_unit_id: "hospital_units",
  state_id: "states",
  cid10_code_id: "cid10_codes",
  cid_id: "cid10_codes"
}
```

A aplicação será genérica por nome de coluna: se a linha tiver `hospital_unit_id` e existir `id_maps.hospital_units[oldValue]`, substituir pelo `local_id` antes do upsert.

Isso é necessário para a causa 5. Sem tradução, `skip` em `hospital_units` preserva o destino, mas as linhas filhas do backup ainda referenciam IDs que não existem no destino.

Resultado esperado:

- `user_hospital_assignments`, `saps3_assessments`, `prescription_quick_templates`, `pre_registration_requests`, `pre_admissions`, `bed_census` deixam de falhar quando o `hospital_unit_id` antigo tem equivalente local por `name`.

### 6. Ajustar `handleFinalize`

Incluir no `report`:

- `error_samples`;
- `errors_by_table`;
- `dropped_columns_by_table`;
- `catalog_conflicts_by_table`;
- resumo dos `id_maps` por contagem, não necessariamente o mapa completo se ficar grande.

Exemplo:

```ts
id_map_counts: {
  hospital_units: 12,
  states: 27,
  cid10_codes: 14800
}
```

## Ordem de execução durante uma restauração

```text
handlePlan
  -> lê manifest
  -> monta parts por tabela
  -> consulta schema/UNIQUEs do destino
  -> injeta __auth_users__ no início
  -> ordena tabelas públicas por FK
  -> marca catálogos com chave natural segura
  -> cria restore_job com schema + plano

handleStep __auth_users__
  -> recria/atualiza usuários no auth

handleStep catálogos
  -> filtra colunas
  -> resolve conflito por chave natural
  -> insere novos / pula existentes
  -> grava id_maps old_id -> local_id

handleStep tabelas filhas
  -> filtra colunas
  -> traduz FKs via id_maps
  -> upsert por PK como hoje

handleFinalize
  -> grava relatório final auditável
  -> desativa manutenção
```

## Decisão sobre mapa de tradução de ID

Sim, precisa de mapa de tradução de ID para pelo menos `hospital_units`.

Motivo: `ON CONFLICT DO NOTHING` por `name/code` resolve o duplicate key do catálogo, mas não resolve as FKs das tabelas filhas. Se o backup tem `hospital_units.id = A` e o destino já tem a mesma unidade com `id = B`, as linhas filhas importadas continuam vindo com `hospital_unit_id = A`. Sem tradução para `B`, elas ficam órfãs e falham.

Para `states` e `cid10_codes`, o mesmo princípio vale se houver FKs por UUID/ID. Se as tabelas filhas usam apenas `state_code`/`cid10_code`, não há tradução necessária, mas manter a tradução é seguro quando a coluna existe.

## Riscos e erros que ainda podem persistir

1. **Usuários sem email ou inválidos em `auth/users.json`**: `createUser` pode falhar; as FKs públicas desses usuários continuarão falhando.
2. **Senhas não migram**: usuários recriados precisam redefinir senha por email.
3. **Backup sem `auth/users.json`**: não há como recriar auth users; FKs para auth continuarão falhando.
4. **Catálogo sem chave natural UNIQUE confiável**: não será mapeado automaticamente; pode continuar com duplicate key ou FK órfã.
5. **FKs que usam nomes de coluna não previstos**: se não forem detectadas pelo mapa inicial, podem continuar órfãs; dá para expandir `FK_TRANSLATIONS` depois com base no relatório.
6. **Dados filhos que apontam para entidade inexistente no backup e no destino**: continuarão falhando corretamente.
7. **CHECK constraints, triggers e NOT NULL novos no destino**: podem rejeitar linhas mesmo com colunas filtradas.
8. **Races se o frontend executar steps em paralelo**: `progress` é JSON acumulado por leitura+update; o frontend atual deve executar serialmente, mas paralelismo exigiria RPC atômico para merge.
9. **Updates de catálogo serão pulados** na estratégia inicial para preservar dados locais; isso evita quebra de FKs, mas pode deixar nomes/metadados locais diferentes do backup.

## Arquivos a tocar quando aprovado

- `supabase/functions/backup-restore/index.ts`
- nova migration para os RPCs de introspecção de schema/UNIQUEs

Nada será alterado agora em plan mode.