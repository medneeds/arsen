---
name: Pre-registration Public Flow
description: Tela pública /pre-cadastro grava em pre_registration_requests; aba "Pré-cadastros" em /gestao-usuarios aprova via edge admin-create-user gerando senha provisória
type: feature
---

**Tela pública**: `/pre-cadastro` (`src/pages/PreCadastroPage.tsx`) acessível sem login (rota fora de `ProtectedRoute`). Coleta nome, email, CPF, telefone, CRM (obrigatório só para perfil médico/CCIH), função pretendida (`access_profile` exceto `desenvolvedor` e `gestor`), unidade hospitalar (auto-seleciona Socorrão 1/HMDM se encontrar), justificativa. Valida CPF (11 dígitos), email e duplicidade na própria tabela antes de inserir.

**Tabela**: `public.pre_registration_requests` — RLS permite INSERT por `anon` e `authenticated` (status forçado a `pending`); SELECT/UPDATE só para `admin` ou `access_profile=gestor`; DELETE só admin. `updated_at` via trigger padrão.

**Painel de aprovação**: `src/components/users/PreRegistrationApprovalsPanel.tsx` exibido como aba "Pré-cadastros" em `/gestao-usuarios`. Mostra link público para copiar, KPIs (Pendentes/Aprovados/Recusados/Total), filtros e tabela. Aprovação dispara edge function `admin-create-user` no modo `password` com senha provisória editável/gerada (8 chars), grava `created_user_id` e `reviewed_by/at`. Recusa apenas atualiza status + `reviewer_notes`. Toda decisão registra em `user_admin_audit` via `logUserAdminAction` com action `prereg.approved`/`prereg.rejected`.

**Importante**: o painel só aparece para admin/gestor (mesma trava do resto da página); contador de pendentes é buscado uma vez via `count: exact, head: true`.
