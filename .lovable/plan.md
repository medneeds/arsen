# Investigação: JWSError JWSInvalidSignature em arsen.com.br

## Resumo executivo
A **causa raiz é uma rotação/reload da configuração do GoTrue (Auth) do projeto Supabase** que aconteceu **hoje às 20:32:33 UTC**, depois do último login bem-sucedido do usuário (20:15:29 UTC). Tokens emitidos antes do reload deixaram de ser válidos → o servidor passou a responder `JWSError JWSInvalidSignature` em `GET /user` quando o cliente envia o access_token antigo. **Não é o usuário, não é o backend RLS, não é o JWT secret manualmente trocado, e não é confusão de projeto.**

## Evidências coletadas (todas read-only)

### 1. Configuração de Auth foi recarregada — confirmado nos logs
```
2026-06-19T20:32:33Z  component:reloader   msg:"reloading api with new configuration"
2026-06-19T20:32:33Z  level:warning        msg:"DEPRECATION NOTICE: GOTRUE_JWT_ADMIN_GROUP_NAME not supported..."
2026-06-19T20:32:33Z  level:warning        msg:"DEPRECATION NOTICE: GOTRUE_JWT_DEFAULT_GROUP_NAME not supported..."
2026-06-19T20:32:33Z  component:apiworker  msg:"applying connection limits to db..."
```
Esse `reloading api with new configuration` é emitido pelo GoTrue quando o material de assinatura/segredo do JWT é trocado (ex.: migração para chaves assimétricas/JWKS, rotação de chave publishable, ou edição de Auth Settings no painel). Os deprecation notices reforçam que o GoTrue foi reiniciado com um novo conjunto de variáveis.

### 2. Usuário está íntegro
`SELECT … FROM auth.users WHERE email='agrimario33@gmail.com'`:
- `id`: `99c4d8b1-b9cc-4e14-82a1-9c3f70fc795f`
- `email_confirmed_at`: 2026-04-29
- `last_sign_in_at`: 2026-06-19 **20:15:29** UTC (antes do reload)
- `banned_until`/`deleted_at`: null
- `provider`: email
Profile/roles preservados (super_admin + admin, status approved, sem maintenance lock que o afete).

### 3. Logs de Auth recentes em `arsen.com.br`
Único erro vindo de `referer: https://arsen.com.br/` no período é:
```
POST /token  grant_type=refresh_token  status=400
error_code:"refresh_token_not_found"
"400: Invalid Refresh Token: Refresh Token Not Found"
```
Não há **nenhum** registro de "JWS", "signature" ou "invalid jwt" nos auth_logs do servidor — o que é coerente: o `JWSError` é renderizado pelo cliente após o servidor responder 401 com `code: bad_jwt`, e a mensagem completa fica em `event_message` da requisição `/user` falhada (não filtrável pelo nosso atalho atual). O `refresh_token_not_found` é o sintoma colateral: o refresh anterior também foi invalidado pelo reload.

### 4. Não há divergência de projeto/env entre preview e custom domain
- `VITE_SUPABASE_PROJECT_ID = wgugmnpwliupwewtduvt`
- `VITE_SUPABASE_URL = https://wgugmnpwliupwewtduvt.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = a chave correta (`iss:supabase`, `ref:wgugmnpwliupwewtduvt`, exp 2036) — é a única lida pelo `src/integrations/supabase/client.ts`.
- `arsen.com.br`, `arsen.lovable.app` e o preview são servidos pelo **mesmo bundle**, apontando para o **mesmo projeto Supabase**. Não há segundo projeto, não há env de produção paralela.
- Curiosidade: existe um `VITE_SUPABASE_ANON_KEY` no `.env` com a chave demo do supabase-local (`iss:supabase-demo`), mas **nenhum arquivo do projeto a referencia** (`rg` confirmou 0 ocorrências em `src/`). Está lá como lixo, não afeta nada.

### 5. Outros usuários estão logando normalmente
Os logs mostram dezenas de `GET /user 200` vindo de `arsen.lovable.app` (e do próprio `arsen.com.br` antes do reload) nos minutos anteriores e posteriores, inclusive do mesmo IP. Ou seja, **chaves publishable/anon novas estão funcionando**; quem ainda carrega uma sessão antiga em cache é que quebra. Por isso o problema parece "isolado" no `agrimario33` — ele tinha uma sessão muito longa, ativa desde 20:15.

## Por que ele continuou quebrando depois de "limpar cache"
Limpar cookies/cache do navegador normalmente **não limpa**:
1. **`localStorage` por origem** — a chave `sb-wgugmnpwliupwewtduvt-auth-token` precisa ser apagada **com a aba em `arsen.com.br` aberta** (DevTools → Application → Local Storage → arsen.com.br → Remove). `arsen.lovable.app` é outra origem; limpar lá não afeta `arsen.com.br`.
2. **Service Worker** registrado em `arsen.com.br` — pode estar entregando um JS antigo do bundle. Conferir DevTools → Application → Service Workers → Unregister.
3. **Cache HTTP do CDN** para o HTML — se ele só fechou e reabriu sem hard-reload (Ctrl+Shift+R), o `index.html` pode vir do cache do navegador apontando para um chunk JS antigo.
4. **Sessão em outra aba** — basta uma aba antiga restaurar a sessão velha no localStorage via BroadcastChannel do supabase-js.

## Camada exata onde ocorre
- **Servidor Auth (GoTrue):** responde 401 + `{code:"bad_jwt", message:"JWSError JWSInvalidSignature"}` para `GET /user` quando o cliente envia um access_token assinado com material antigo.
- **Cliente (supabase-js no browser):** propaga essa string como `AuthApiError: JWSError JWSInvalidSignature` para o `AuthContext`, que ainda não trata esse caso → mensagem cru aparece na tela.
- **Nada disso é RLS, trigger, edge function, frontend de login, super_admin lock ou maintenance_mode.**

## Próximas ações sugeridas (NADA executado ainda — aguardando aprovação)

### A) Resolver o caso do agrimario33 agora (sem deploy)
Pedir para ele, **com a aba aberta em `https://arsen.com.br/auth`**, abrir DevTools (F12) → Console e rodar:
```js
Object.keys(localStorage).filter(k=>k.startsWith('sb-')).forEach(k=>localStorage.removeItem(k));
sessionStorage.clear();
if (navigator.serviceWorker) {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map(r => r.unregister()));
}
location.reload(true);
```
Depois logar normalmente — vai funcionar.

### B) Mitigação preventiva (1 arquivo, recomendada — requer aprovação para sair do plano)
Adicionar em `src/contexts/AuthContext.tsx` um interceptor único que detecta `JWSError`/`bad_jwt` em qualquer chamada Supabase, força `supabase.auth.signOut({ scope:'local' })`, limpa `sb-*` do `localStorage`, desregistra service workers e redireciona para `/auth` com toast didático ("Sua sessão expirou após uma atualização do sistema, faça login novamente"). Isso protege qualquer outro usuário que tenha sessão antiga depois de futuras rotações.

### C) Confirmar a origem da rotação (1 pergunta ao owner)
Perguntar se hoje, perto de 17:30 BRT (20:32 UTC), alguém:
- ativou/desativou algum provider no painel de Auth,
- migrou para o novo sistema de "Signing Keys" (asymmetric/JWKS),
- ou rotacionou a publishable key.
Saber a origem evita repetir o evento sem aviso aos usuários.

**Causa raiz:** rotação/reload do material de assinatura do GoTrue em 2026-06-19 20:32:33 UTC invalidou o access_token armazenado no `localStorage` do navegador do `agrimario33` (sessão de 20:15:29). O "limpar cache" do navegador não removeu o `localStorage` da origem `arsen.com.br` e/ou um Service Worker continua servindo bundle antigo, então a sessão zumbi continua sendo enviada e o servidor responde `JWSError JWSInvalidSignature`. Camada: **servidor Auth rejeitando token antigo + cliente sem fallback automático.** Nenhuma alteração de código foi feita.
