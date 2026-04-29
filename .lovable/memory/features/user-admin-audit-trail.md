---
name: User Admin Audit Trail
description: Auditoria imutável de cadastros e mudanças de permissões em /gestao-usuarios; tabela user_admin_audit + edge function admin-create-user + helper logUserAdminAction
type: feature
---

Trilha de auditoria de gestão de usuários — conformidade LGPD.

## Tabela
`public.user_admin_audit` (imutável: sem UPDATE/DELETE policies)
- Atores: `actor_id`, `actor_email`, `actor_name`
- Alvos: `target_user_id`, `target_email`, `target_name`
- `action` (text), `access_profile`, `app_role`, `departments[]`, `hospital_unit_id`
- `old_data`, `new_data`, `metadata` (JSONB), `ip_address`, `user_agent`
- RLS leitura: `has_role(admin)` OU `profiles.access_profile = 'gestor'`
- RLS insert: qualquer autenticado (na prática só edge functions / fluxos internos chamam)
- Índices: target, actor, action, created_at

## Ações registradas (`action`)
- `user.created.password` / `user.created.invite` — edge `admin-create-user`
- `user.role.updated` — `handleUpdateRole` em UserManagementPage
- `user.permissions.updated` — `UserPermissionsDialog.handleSave` (só registra se houve diff)
- `user.status.approved` / `rejected` / `suspended` / `reactivated` — UserManagementPage
- (extensível) `user.password.reset`, `user.hospital.updated`

## Camadas
- Edge function `admin-create-user` insere via service role (não bloqueante; try/catch separado).
- Cliente: helper `src/lib/userAdminAudit.ts → logUserAdminAction({...})`. Sempre best-effort; nunca quebra fluxo do usuário.

## UI
- Aba **Histórico** em /gestao-usuarios (`UserAuditHistoryPanel`):
  - Filtro por tipo de ação + busca livre (NFD-normalized) por nome/email/role.
  - Paginação 50/pág via `range` + `count: 'exact'`.
  - Export CSV client-side dos rows filtrados.
  - Drawer de detalhes mostra antes/depois (JSON) + IP + user agent.
