## Entendimento

Construir a aba "Restaurar" usando os backups gerados pelo novo formato v3 (chunked, `db-backups/<jobId>/...` + `manifest.json` em `backup_jobs`). O restore atual (`db-restore`) foi escrito para o formato antigo (`db_backups`, `super_admin`) e **não serve**.

## O QUE NÃO SERÁ TOCADO

- ❌ `backup-create` (já estável)
- ❌ `backup-download` (já estável)
- ❌ `db-restore` antigo (mantido como legacy, não removo)
- ❌ Tabelas clínicas em si — apenas escritas via UPSERT durante a execução do restore
- ❌ Auth de usuários (senhas não voltam — apenas metadados; quem precisar redefine)
- ❌ Nenhuma alteração de schema / migration

## Arquivos tocados

1. **Nova edge function** `supabase/functions/backup-restore/index.ts`
   - 3 actions: `plan`, `step`, `finalize`
   - `plan`: valida senha do super_admin, lê `manifest.json` do storage, calcula ordem topológica via `get_public_fk_pairs` (já existe), lista parts por tabela, cria linha em `restore_jobs`, ATIVA `system_maintenance_mode`, retorna plano
   - `step`: baixa **uma part** por chamada, faz UPSERT em batches de 500 (mesma estratégia do db-restore antigo), atualiza progresso
   - `finalize`: marca job done/failed, DESATIVA manutenção (sempre), grava `backup_audit`
   - Suporte a **dry-run**: baixa as parts, conta linhas e valida JSON, mas não escreve no banco
   - Suporte a **modo parcial**: cliente passa lista de tabelas; só essas são restauradas

2. **`src/pages/BackupRestorePage.tsx`** — habilitar aba "Restaurar"
   - Lista backups `completed` com botão "Restaurar"
   - Dialog de confirmação multietapa:
     - Etapa 1: escolher modo (Completo / Parcial com checkboxes de tabelas) + dry-run on/off
     - Etapa 2: avisos didáticos (manutenção, irreversível, senhas não voltam, MFA não volta)
     - Etapa 3: digitar a frase exata "RESTAURAR AGORA" + senha do usuário
   - Durante execução: progress bar + tabela atual + linhas processadas/erros
   - Bloqueio: só **super_admin** vê o botão (admin comum apenas baixa)

3. **`supabase/migrations/<ts>_restore_jobs_grants.sql`** (se necessário) — garantir que `restore_jobs` tem GRANTs e RLS para a UI ler (apenas super_admin SELECT). Verifico antes; se já existir, pulo.

## Pontos de segurança não-negociáveis

- Reverificação de senha via `signInWithPassword` na action `plan` (já no padrão db-restore antigo)
- `system_maintenance_mode` ATIVO durante toda execução; DESATIVA em qualquer saída (sucesso, falha, exceção)
- Conflict strategy padrão: **UPSERT por PK** (mesma da v anterior). Sem TRUNCATE — restore não apaga linhas que existem só no destino, só sobrescreve as que vieram do backup.
- Auditoria em `backup_audit` em cada transição (start/step/done/fail)
- Dry-run é o **default sugerido** na UI

## Diagrama do fluxo

```text
[UI] click Restaurar
  └─ Dialog 3 etapas (modo, avisos, senha)
       └─ plan ──────────────────────────────────► restore_jobs (running) + maintenance ON
            ├─ step (part 0) ─► UPSERT 500/500/...
            ├─ step (part 1) ─► ...
            ├─ ...
            └─ finalize ─► restore_jobs (completed/failed) + maintenance OFF
```

## O que NÃO faço nesta entrega

- Restauração de auth users (apenas relato no manifest quais sumiriam — restore de auth fica para fase futura, mais arriscada)
- Restore cross-instance (manifest informa `source_instance`; se diferente do destino, mostro aviso vermelho mas não bloqueio)
- Rollback automático em caso de falha parcial (apenas relatório; usuário decide rodar de novo)

**Confirma que posso seguir nessa direção?**
