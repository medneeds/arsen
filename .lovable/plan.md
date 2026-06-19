# Diagnóstico — agrimario33@gmail.com (somente leitura, nenhuma alteração)

## Conclusão
**Não há problema no backend.** O usuário está íntegro, logou com sucesso às 20:15:29 UTC, e tem privilégios máximos (`admin` + `super_admin`). O erro "JWS" é **client-side** — token antigo no `localStorage` do navegador, assinado com JWT secret diferente do atual ou pertencente a outra origem.

## Evidências coletadas

### auth.users — OK
- `id`: 99c4d8b1-b9cc-4e14-82a1-9c3f70fc795f
- `email_confirmed_at`: 2026-04-29 ✅
- `banned_until`: null · `deleted_at`: null
- `last_sign_in_at`: **2026-06-19 20:15:29 UTC** (login bem-sucedido recentíssimo)

### profiles — OK
- `status`: approved
- `access_profile`: desenvolvedor (+ 11 perfis em access_profiles[])
- `must_change_password`: false · `terms_version`: 1.0.0

### user_roles — OK
- admin
- super_admin

### Auth logs (deste user_id) — todos 200
- 20:15:29 POST /token password → 200
- 20:13:01 POST /token password → 200
- 20:10:27 POST /token refresh → 200
- 1x 400 invalid_credentials às 20:12:28 (senha errada digitada uma vez em arsen.com.br)
- 1x 400 refresh_token_not_found às 20:15:36 (refresh expirado em arsen.com.br)

### Busca por "JWS" / "invalid signature" / "JWT expired"
- Zero ocorrências em auth_logs e postgres_logs.

### Mudanças recentes (super_admin/maintenance/setup)
- Nenhuma afeta este user_id; ele já é super_admin e nenhum trigger novo bloqueia login.

## Causa raiz provável
`JWSError` / `JWSInvalidSignature` é lançado pelo cliente `@supabase/supabase-js` quando o access_token salvo no `localStorage` foi assinado com um JWT secret antigo ou pertence a outro projeto Supabase. Cenários compatíveis com os logs:
1. Token órfão em `localStorage` de um dos domínios (arsen.com.br, arsen.lovable.app, id-preview…lovable.app) — cada origin tem storage isolado.
2. Refresh token revogado (vimos 400 refresh_token_not_found em arsen.com.br) + access token ainda em cache.

**Camada do erro:** frontend (cliente Supabase no navegador). Não é Auth, RLS, trigger nem edge function.

## Próximos passos sugeridos (a serem aprovados antes de qualquer mudança)

### A) Coletar evidência adicional do usuário (sem código)
1. Em qual URL exata vê o erro (arsen.com.br / arsen.lovable.app / preview)?
2. Mensagem literal do console (distinguir `JWSError JWSInvalidSignature` de `JWT expired`).
3. Print das chaves `sb-*-auth-token` em Application → Local Storage.

### B) Correção imediata (sem deploy)
Pedir que ele rode no console do domínio com erro:
```
localStorage.clear(); sessionStorage.clear(); location.reload()
```
Ou DevTools → Application → Clear site data. Em seguida fazer login normalmente.

### C) Mitigação preventiva (opcional, requer aprovação)
Adicionar no `AuthContext` um handler global para detectar `JWSError`/`AuthApiError` no `onAuthStateChange` e fazer `supabase.auth.signOut()` + redirect para `/auth` automaticamente, evitando que outros usuários fiquem presos quando o token local fica inválido. Mudança restrita a `src/contexts/AuthContext.tsx`.

Aguardando sua decisão sobre A/B/C antes de qualquer alteração.
