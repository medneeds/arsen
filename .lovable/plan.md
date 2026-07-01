## Objetivo
Adicionar aviso reforçado no wizard de restauração quando o usuário selecionar um backup **completo** SEM marcar **Modo ESPELHO**, deixando explícito que o restore será apenas um merge (upsert) e não devolverá o banco ao estado exato do snapshot.

## Arquivo tocado
- `src/pages/BackupRestorePage.tsx` (somente UI — nenhuma mudança em edge functions, RPC ou lógica de restore).

## Mudanças de UI

### 1. Banner âmbar na Etapa 1 (seleção do backup)
Quando `mirror === false` E o backup selecionado for completo (sem `since`, sem seleção parcial de tabelas), exibir logo abaixo do checkbox "Modo ESPELHO" um alerta âmbar com ícone `AlertTriangle`:

> **Atenção: este restore NÃO devolve o banco ao estado do backup.**
> Sem o Modo ESPELHO, o restore apenas mescla (upsert por PK):
> - Registros do backup **sobrescrevem** os existentes com mesma chave.
> - Registros criados **depois** do backup **permanecem no banco**.
>
> Para reproduzir exatamente o snapshot, marque "Modo ESPELHO (destrutivo)".

### 2. Reforço no diálogo de confirmação (Etapa 2)
Quando `mirror === false`, adicionar uma linha destacada dentro do bloco de confirmação:

> ⚠️ Modo de mesclagem: linhas criadas após o backup **não serão removidas**. Se seu objetivo é restaurar o snapshot integralmente, cancele e ative o Modo ESPELHO.

### 3. Checkbox de ciência (Etapa 2, apenas quando mirror === false em backup completo)
Adicionar um `Checkbox` "Entendo que este restore é uma mesclagem e não substitui o estado atual" que precisa estar marcado para habilitar o botão de confirmação — trava explícita contra clique automático.

## O que NÃO será tocado
- `supabase/functions/backup-restore/index.ts`
- `supabase/functions/db-restore/index.ts`
- RPC `mirror_truncate_tables`
- Comportamento default do wizard (mirror continua opt-in)
- Fluxo de dry-run, seleção de tabelas, backup incremental
