---
name: Separação Equipe Multi × Classificação de Risco
description: Perfis de login independentes — Multi sem triagem, Classificação de Risco com acesso exclusivo à fila
type: feature
---

A partir desta separação, **Equipe Multi** e **Classificação de Risco** são dois perfis de acesso (`AccessProfile`) totalmente independentes:

- **`multi`** (Equipe Multiprofissional): rota inicial `/mapa`. Sidebar com Mapa de Leitos, sub-menu da equipe multi (Enfermagem, Nutrição, Fisio, etc.) e Round Multiprofissional. **Não tem acesso à fila de triagem**.
- **`classificacao_risco`** (Classificação de Risco): rota inicial `/triagem-fila`. Sidebar enxuta com Fila de Triagem e Painel TV. **Acesso exclusivo ao fluxo de triagem (Protocolo de Manchester)**.

Login legado sugerido para o novo perfil: `classificacao@sistema.local` (incluído em `LEGACY_GENERIC_USERS` no `ProtectedRoute`).

Arquivos-chave:
- `src/config/userProfiles.ts` — enum `AccessProfile`, `ACCESS_PROFILES`, `PROFILE_TO_ROLE_HINT`
- `src/pages/AuthPage.tsx` — opção no select e `getRedirectRoute`
- `src/components/AppSidebar.tsx` — `buildFilteredMenu` com branches dedicados
- `src/components/ProtectedRoute.tsx` — `LEGACY_GENERIC_USERS`
