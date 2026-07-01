## Objetivo
Permitir escolher, ao criar um backup, quais tabelas entram — ou marcar todas (comportamento atual).

## Backend — `supabase/functions/backup-create/index.ts`
1. Aceitar novo parâmetro opcional na action `start`:
   - `tables?: string[]` — lista de nomes de tabelas do schema `public` a incluir.
   - Se ausente / vazio → mantém comportamento atual (todas).
2. Guardar em `State`:
   - `selectedTables?: string[] | null` (persistido no `progress.state`).
3. Filtrar no `phase: "init"`:
   - Após buscar todas as tabelas + metadata de timestamps, aplicar `filter(n => !selected || selected.includes(n))` tanto para `s.tables` (fase `data`) quanto para o array de `SPECIAL_TABLES` efetivo usado no `phase: "special"` (introduzir `s.specialTables: string[]`).
   - `audit_logs` continua respeitando `include_audit_logs` mesmo se marcado.
4. Fase `auth`: incluir/pular usuários com base em um pseudo-item `__auth_users__` na lista (checkbox dedicado na UI); default = incluído para não quebrar restore.
5. Manifest ganha `selected_tables` (array ou `null` = todas) e nota didática quando parcial ("Backup PARCIAL — restauração só recompõe as tabelas listadas").
6. Registro `reason` prefixa `[PARCIAL n tabelas]` quando aplicável (junto com `[INCR ...]` se ambos).

## Frontend — `src/pages/BackupRestorePage.tsx`
1. Novos estados:
   - `selectedTables: Set<string>`, `allTables: string[]`, `tablesLoading`, `selectAuthUsers: boolean` (default true).
2. Ao montar (ou ao abrir a aba Backups pela primeira vez), chamar `supabase.rpc('get_public_tables_timestamp_cols')` para listar tabelas + juntar com SPECIAL fixas (usar o mesmo array constante do backend, replicado no front). Ordenar alfabeticamente.
3. Novo bloco "Escopo do backup" no card "Criar novo backup":
   - Botões `Marcar todas` / `Limpar` / campo de busca.
   - Lista de checkboxes em grid rolável (`max-h-72 overflow-auto`), destacando com badge quais são SPECIAL/catálogo.
   - Checkbox separado "Usuários (auth.users)" — default marcado.
   - Contador "X de Y tabelas selecionadas".
4. `handleCreateBackup`:
   - Se `selectedTables.size === allTables.length` → não envia `tables` (backup completo).
   - Caso contrário envia `tables: [...selectedTables]`.
   - Envia `include_auth_users: selectAuthUsers` (nova flag; default true).
   - Validação: bloquear se 0 tabelas E auth desmarcado.
5. Toast + histórico: exibir badge `PARCIAL (n tabelas)` na lista de jobs quando `manifest.selected_tables` presente.

## Compatibilidade / segurança
- Sem `tables` → 100% retrocompatível.
- Restore existente ignora tabelas ausentes silenciosamente (já é o comportamento). Adicionar aviso didático na UI ao selecionar backup parcial para restaurar.
- Sem mudanças no schema do banco. Sem migration.

## Arquivos tocados
- `supabase/functions/backup-create/index.ts`
- `src/pages/BackupRestorePage.tsx`

## Fora de escopo
- Backup por schema não-public.
- Seleção de subconjunto de linhas (WHERE customizado).
- Alteração da UI/lógica de restore além do aviso "backup parcial".

Aprovar para eu implementar?
