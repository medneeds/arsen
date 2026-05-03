---
name: Perfil Desenvolvedor
description: Perfil "desenvolvedor" com Dev Console + radar de pendências, restrito ao Arthur Batista
type: feature
---

Perfil de acesso `desenvolvedor` (AccessProfile) com rota inicial `/dev-console`. O Dev Console deixou de aparecer na sidebar — passa a ser acessado apenas por quem tem esse perfil ativo (via ProfileSwitcher).

- Adicionado em `src/config/userProfiles.ts` (AccessProfile + ACCESS_PROFILES + PROFILE_TO_ROLE_HINT) com role hint `admin`.
- Defaults em `src/config/profileDefaults.ts`: role admin, sem setores, landingRoute `/dev-console`.
- `AppSidebar` não renderiza mais `DevConsoleLink` no footer.
- Aba **Pendências** (`PendenciesTab`) é a tab default do `DevConsolePage`. Backed pela tabela `public.dev_pendencies` (RLS via `is_dev_user`).
  - Campos: title, description, category, priority (baixa/media/alta/critica), status (aberta/em_andamento/bloqueada/concluida/arquivada), tags[], notes.
  - Permite criar/editar prioridade e status inline, KPIs no topo (críticas pendentes etc).
- Atualmente só Arthur Batista (`artur.batista@sistema.local`) tem `desenvolvedor` na lista `access_profiles`.
