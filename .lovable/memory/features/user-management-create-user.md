---
name: User Management — Create User
description: Subseção "Cadastrar Usuário" em /gestao-usuarios. Acesso admin+gestor, dois modos (senha provisória/convite), perfis globais (admin/gestor) ignoram setores
type: feature
---

Em `/gestao-usuarios`, página `UserManagementPage` agora tem duas abas:
- **Lista de Usuários** (todos os usuários autenticados que já tinham acesso veem)
- **Cadastrar Usuário** — visível apenas para `currentUserRole === 'admin' || useIsGestor()`

Componente: `src/components/users/CreateUserForm.tsx` envia para edge function `admin-create-user`.

**Modos**:
- `password`: cria com `auth.admin.createUser` + `email_confirm: true` (acesso imediato; user_metadata.must_change_password=true)
- `invite`: `auth.admin.inviteUserByEmail` com `redirectTo: /auth`

**Campos obrigatórios**: nome, email, CPF (único, validado 11 dígitos), telefone, unidade hospitalar (`hospital_units`).

**Perfil + Setores**:
- `accessProfile === 'gestor'` ou `role === 'admin'` → considerados "globais": ignoram seleção de setores (UI mostra card explicativo).
- Demais → exigem ≥1 setor via `SectorPermissionsPicker`.
- `PROFILE_TO_ROLE_HINT` sugere role automaticamente ao mudar perfil.

**Persistência**: profiles (upsert com status=approved), user_roles, user_hospital_assignments, user_departments.

**Schema**: `profiles.cpf` (text, indexado quando não-nulo) adicionado para suportar este fluxo.

**Guard server-side**: edge function valida que o caller tem role=admin OU access_profile=gestor antes de qualquer mutação.
