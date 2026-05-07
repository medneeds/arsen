## Restrição de Acesso por IP em Módulos Específicos

Implementar uma camada de **allowlist de IPs por módulo**, de modo que determinadas rotas (ex: Farmácia, NIR, Gestor, Validação Farmacêutica) só possam ser acessadas a partir de IPs autorizados — tipicamente os IPs fixos das estações dentro do hospital.

### Como vai funcionar

```text
[Usuário no navegador]
        │
        ▼
[Edge Function: check-ip-access]  ← retorna IP público + módulos permitidos
        │
        ▼
[ProtectedRoute + IpGuard]  ← bloqueia rota se IP não está na allowlist
        │
        ▼
[Página do módulo]
```

O IP é obtido **server-side** (edge function lê `x-forwarded-for` do request). Nunca confiar em IP detectado no client.

### Banco de dados (1 migration)

1. **Tabela `module_ip_allowlist`**
   - `id uuid pk`
   - `module_key text` (ex: `farmacia`, `nir`, `gestor`, `validacao_farmaceutica`, `dev_console`)
   - `ip_cidr cidr` (suporta IP único `200.10.5.4/32` ou faixa `200.10.5.0/24`)
   - `label text` (ex: "Farmácia Central – Estação 02")
   - `hospital_unit_id uuid` (opcional, p/ escopar por unidade)
   - `enabled boolean default true`
   - `created_by`, `created_at`, `updated_at`
   - RLS: leitura para autenticados; escrita só para `admin`.

2. **Tabela `module_ip_settings`**
   - `module_key text pk`
   - `enforce boolean` (se false → módulo aberto, allowlist ignorada)
   - `bypass_for_admin boolean default true`
   - Permite ligar/desligar a regra por módulo sem deletar registros.

3. **Função `is_ip_allowed_for_module(_module text, _ip inet) returns boolean`** (security definer) — usada pela edge function e por logs de auditoria.

4. **Tabela `ip_access_log`** (opcional, recomendado p/ LGPD): registra tentativas bloqueadas (`module_key`, `ip`, `user_id`, `at`).

### Edge function `check-ip-access`

- Lê `req.headers.get('x-forwarded-for')` (primeiro IP da lista) e `cf-connecting-ip` como fallback.
- Valida JWT do usuário.
- Recebe `{ module: string }`, retorna `{ allowed: boolean, ip: string, reason?: string }`.
- Admin → sempre permitido (se `bypass_for_admin = true`).
- Registra bloqueios em `ip_access_log`.

### Frontend

1. **Hook `useIpAccess(moduleKey)`** — chama a edge function, faz cache em memória por `moduleKey` durante a sessão. Retorna `{ loading, allowed, ip, reason }`.

2. **Componente `<IpRestricted moduleKey="farmacia">{children}</IpRestricted>`**
   - Enquanto loading: skeleton.
   - Se bloqueado: tela "Acesso restrito a esta rede" mostrando o IP detectado, módulo, contato do admin, botão de logout.
   - Se permitido: renderiza children.

3. **Aplicar nas rotas sensíveis** em `src/App.tsx`, envolvendo o componente da página:
   - `/farmacia` (ValidacaoFarmaceutica)
   - `/nir` (NirDashboard)
   - `/gestor` (GestorPanel)
   - `/dev-console`
   - (lista final definida pelo usuário — ver pergunta abaixo)

4. **Página de administração `/admin/ip-allowlist`** (apenas admin):
   - Lista módulos × IPs cadastrados.
   - CRUD de IPs/CIDRs por módulo.
   - Toggle "Enforce" por módulo.
   - Mostra log das últimas tentativas bloqueadas.
   - Adicionada ao menu admin existente (`UserManagementPage` ou novo item).

### Detalhes técnicos importantes

- **Origem real do IP**: O Lovable/Supabase fica atrás de proxies. O IP real vem em `x-forwarded-for` (primeiro item). Documentar isso para o admin saber qual IP cadastrar (a página mostra "Seu IP atual: x.x.x.x" para facilitar).
- **IPv6**: usar tipo `cidr` do Postgres (suporta v4 e v6 nativamente, com operador `<<=` para conferência de faixa).
- **Cache**: o resultado da verificação é cacheado por 60s no client p/ evitar chamada a cada navegação.
- **Bypass de emergência**: admin global sempre passa (configurável). Permite recuperar acesso se IP do hospital mudar.
- **Não substitui RLS**: continua sendo uma camada extra; RLS no banco continua valendo.

### Limitações honestas

- Usuários em VPN/4G **não passarão** — é o comportamento desejado, mas precisa ficar claro p/ a equipe.
- Se o hospital tiver IP dinâmico, será preciso usar uma faixa CIDR ampla ou um IP fixo contratado.
- Não bloqueia chamadas diretas à API do Supabase — só protege a UI. Para proteção real de dados sensíveis a IP, seria preciso replicar a verificação dentro de RLS (possível em fase 2, usando função que lê IP do JWT claims via gateway — mais complexo).

### Arquivos previstos

- `supabase/migrations/<timestamp>_module_ip_allowlist.sql`
- `supabase/functions/check-ip-access/index.ts`
- `src/hooks/useIpAccess.ts`
- `src/components/IpRestricted.tsx`
- `src/pages/admin/IpAllowlistPage.tsx`
- edição de `src/App.tsx` (envolver rotas)
- nova entrada de menu admin

### Antes de começar — preciso confirmar 2 coisas

1. **Quais módulos exatamente** devem ter restrição por IP? Sugestão inicial: Farmácia, NIR, Gestor, Dev Console, Validação Farmacêutica. Confirma ou ajusta?
2. **Admin global passa sempre** mesmo de fora do hospital? (recomendado: sim, p/ evitar lockout). Confirma?
