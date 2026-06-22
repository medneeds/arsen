# Backup & Restore Multi-Instância — Plano

## Escopo

Construir módulo completo de Backup & Restauração com migração entre instâncias, incluindo schema, dados, usuários Auth, profiles, roles, storage e configurações. UI 100% pt-BR, acesso restrito a `admin` e `super_admin`, todas operações auditadas.

> ⚠️ **Aviso de realidade técnica importante (Lovable Cloud)**
> Algumas exigências do pedido **não são executáveis** no ambiente atual e precisam ser ajustadas antes de implementar. Por favor leia esta seção antes de aprovar:
>
> 1. **Schema SQL (DDL) completo NÃO pode ser exportado nem restaurado pela aplicação.** `pg_dump` está bloqueado no Lovable Cloud (ver regra de exportação CSV-only). DDL (CREATE TABLE/FUNCTION/TRIGGER/POLICY/EXTENSION) é controlado por **migrations versionadas** no próprio projeto — a instância destino precisa ter as MESMAS migrations aplicadas antes do restore. O backup vai conter um **snapshot de dados**, não DDL.
> 2. **`auth.users` não pode ser exportado com hash de senha.** A Admin API do Supabase só permite criar usuário com senha nova ou enviar magic link. Portanto: ou (a) restore gera senha temporária + email de reset, ou (b) usa convite por e-mail. **Login com a mesma senha antiga é impossível** sem acesso ao banco do Auth (que nenhum tenant tem). Isso é limitação do Supabase, não desta implementação.
> 3. **MFA factors, sessions e identities externas (Google/Apple)** também não são restauráveis via Admin API — usuário precisa reconfigurar.
> 4. **Storage**: este projeto **não usa Storage buckets de aplicação** hoje (só `db-backups` interno do super admin). Vou pular Storage até existir bucket de domínio.
> 5. **Rollback transacional de um restore completo é inviável** com volumes reais (115k+ audit_logs). Vou implementar **isolamento por job** + marcação de linhas restauradas (`restored_from_backup_id`) e ação de "desfazer" por tabela, em vez de transação única.
> 6. **Princípios imutáveis do projeto (mem://preferences/immutable-principles)** proíbem mudanças não-triviais sem confirmação camada-por-camada. Este módulo toca **Dados + Auditoria + Movimentação** simultaneamente — exige aprovação explícita.
>
> Se concordar com esses ajustes, o plano abaixo é o que de fato funciona.

## Arquitetura

```text
UI (/admin/backup-restore)
  │
  ├─ Aba "Backups"        → criar / listar / baixar / excluir
  ├─ Aba "Restaurar"      → upload → validar → dry-run → confirmar → executar
  └─ Aba "Histórico"      → jobs de backup e restore + relatórios

Edge Functions (service role)
  ├─ backup-create        → snapshot de dados + auth users + profiles → ZIP em storage
  ├─ backup-validate      → checa manifest, checksum, versão, conflitos
  ├─ restore-dry-run      → simula, retorna relatório de conflitos
  ├─ restore-execute      → executa em ordem fixa, atualiza progresso
  └─ backup-job-status    → polling de progresso

Tabelas novas
  ├─ backup_jobs          → 1 linha por backup (status, progress, file path, manifest, checksum)
  ├─ restore_jobs         → 1 linha por restore (status, progress, dry_run, conflict_resolution, error)
  └─ backup_audit         → trilha imutável de TODAS operações
```

## Conteúdo do ZIP

```text
backup-<id>.zip
├── manifest.json          versão, contagens, hash, autor, instância origem
├── data/                  uma pasta por tabela pública
│   ├── patients.jsonl
│   ├── prescriptions.jsonl
│   └── ... (todas as 73 tabelas, ordenadas por FK)
├── auth/
│   └── users.json         id, email, phone, metadata, app_metadata, role,
│                          email_confirmed_at, created_at, last_sign_in_at, banned
├── profiles.json          (já está em public.profiles, separado para conveniência)
├── roles.json             user_roles + user_departments + user_hospital_assignments
├── settings.json          institution_branding, hospital_units, states, system_maintenance_mode
└── checksum.sha256        hash de cada arquivo + hash do conjunto
```

`schema.sql` NÃO entra (ver aviso #1). Manifest declara `schema_migration_version` exigida no destino.

## Fluxo de Restore (ordem fixa, imutável)

1. **Validate** — manifest, checksum, versão de schema, contagens
2. **Dry-run** — detecta conflitos (emails duplicados, FKs órfãs, registros existentes), gera relatório
3. **Confirm** — admin escolhe estratégia global e por categoria: `ignorar | substituir | mesclar | criar novo`
4. **Auth Users** — `supabase.auth.admin.createUser` com `email_confirm: true`, senha provisória, email de reset enviado
5. **Profiles** — `upsert` por id (já existe linha criada pelo trigger de signup)
6. **Roles** — `user_roles`, `user_departments`, `user_hospital_assignments`
7. **Settings** — tabelas de configuração
8. **Dados clínicos** — todas tabelas restantes em ordem de FK (mesmo algoritmo topológico de `db-restore`)
9. **Validation** — recontagem, checksum pós-restore, relatório final

Cada etapa grava progresso em `restore_jobs.progress` (JSONB) → UI faz polling a cada 2s.

## Controle de Acesso

- Rota `/admin/backup-restore` protegida por `useIsAdmin() || useIsSuperAdmin()`.
- Edge functions verificam `user_roles` server-side antes de qualquer ação.
- Operações destrutivas (restaurar, excluir backup) exigem **reconfirmação de senha** (mesmo padrão do `db-restore` existente).
- Modo Manutenção ativado durante restore (reusa `system_maintenance_mode` que já existe).

## Auditoria

`backup_audit` (imutável, sem UPDATE/DELETE):
- `actor_id, actor_email, action, job_id, started_at, finished_at, duration_ms, result, error, ip_address, user_agent, source_instance, target_instance, payload jsonb`

Ações: `BACKUP_CREATE_START/DONE/FAIL`, `BACKUP_DOWNLOAD`, `RESTORE_VALIDATE`, `RESTORE_DRY_RUN`, `RESTORE_START`, `RESTORE_STEP_DONE`, `RESTORE_DONE/FAIL`, `RESTORE_ROLLBACK`.

## UI (pt-BR)

- Página `/admin/backup-restore` com 3 abas (Backups, Restaurar, Histórico).
- Componente de Progress (já existe `Progress` em ui/) com etapa atual + tempo decorrido + estimado.
- Diálogos de confirmação no padrão `MovementConfirmDialog` (resumo + bloqueios + consequências didáticas) — preferência imutável do projeto.
- Sidebar: novo item "Backup & Restauração" no grupo Admin, ícone Database/Archive.

## Entregáveis por sprint

**Sprint 1 — Fundação (este PR)**
- Migration: `backup_jobs`, `restore_jobs`, `backup_audit` + RLS + GRANT
- Edge function `backup-create` (snapshot de dados + auth + profiles + roles + settings → ZIP em bucket `db-backups`)
- Edge function `backup-job-status` (polling)
- Página `/admin/backup-restore` com aba **Backups** (criar, listar, baixar, progresso, auditoria)
- Item de sidebar + rota protegida

**Sprint 2 — Validação e Dry-run**
- Edge function `backup-validate` (manifest, checksum, versão)
- Edge function `restore-dry-run` (relatório de conflitos sem mudar nada)
- Aba **Restaurar**: upload, validação, relatório, escolha de estratégia

**Sprint 3 — Execução**
- Edge function `restore-execute` em ordem fixa, com modo Manutenção
- Restore de Auth users com email de reset
- Progresso em tempo real + rollback parcial por tabela
- Relatório PDF final

**Sprint 4 — Histórico e polimento**
- Aba **Histórico** com filtros, drawer de detalhes, export CSV
- Testes (vitest) cobrindo dry-run, ordem topológica, conflito de email
- Documentação `/docs/backup-restore.md`

## Confirmação necessária antes de codar

Por favor responda:

1. **Aceita os 6 ajustes técnicos do aviso?** (especialmente: sem DDL no backup, senha NÃO migra, sem rollback transacional global)
2. **Senha dos usuários restaurados**: (a) senha provisória + email de reset automático, (b) convite por email, ou (c) admin define senha única temporária?
3. **Posso começar pelo Sprint 1** ou prefere ver mockup da UI antes?
4. **Confirma que o projeto NÃO usa Storage buckets de aplicação hoje?** Se usa, me diga quais buckets para incluir.
