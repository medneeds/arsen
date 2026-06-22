---
name: Backup Restore Module
description: Sprint 1 — Módulo /admin/backup-restore (admin+super_admin), edge function backup-create gera ZIP único (manifest, data/*.jsonl, profiles, roles, settings, auth/users.json, checksum.sha256) no bucket db-backups. Tabelas backup_jobs/restore_jobs/backup_audit (auditoria imutável). DDL NÃO incluído. Senhas NÃO migram — restore envia reset por email. audit_logs opt-in.
type: feature
---

## Escopo Sprint 1 entregue
- Migration: `backup_jobs`, `restore_jobs`, `backup_audit` (RLS admin/super_admin, audit append-only).
- Edge function `backup-create` (síncrona, paginação 1000 rows, JSZip, SHA-256).
- Página `/admin/backup-restore` (3 abas: Backups, Restaurar [disabled], Histórico).
- Item sidebar gestor: "Backup & Restauração".

## Decisões técnicas (limitações Lovable Cloud)
1. DDL não exportado — destino precisa das mesmas migrations.
2. Hash de senha não exportado — restore via `auth.admin.createUser` + email de reset (estratégia padrão).
3. MFA/identidades externas não migram.
4. Storage buckets de aplicação: nenhum hoje (só db-backups interno).
5. Rollback transacional inviável p/ 115k+ rows — usa marcação por job nas próximas sprints.

## Estrutura do ZIP
```
manifest.json | data/<table>.jsonl | profiles.json | roles.json | settings.json | auth/users.json | checksum.sha256
```

## Próximas sprints (não entregues)
- Sprint 2: backup-validate + restore-dry-run + aba Restaurar
- Sprint 3: restore-execute em ordem fixa (Auth → Profiles → Roles → Settings → Dados) + Modo Manutenção
- Sprint 4: filtros/export no Histórico + testes vitest
