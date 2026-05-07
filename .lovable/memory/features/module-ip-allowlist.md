---
name: Module IP Allowlist
description: Restrição opcional por módulo (farmacia/nir/gestor/dev_console/validacao_farmaceutica) usando edge function check-ip-access + componente IpRestricted; admin gerencia em /admin/ip-allowlist.
type: feature
---

# Restrição de acesso por IP em módulos

Camada extra de segurança no frontend que bloqueia o acesso a determinados módulos quando o IP do usuário não está em uma allowlist.

## Componentes

- **Tabelas**: `module_ip_allowlist` (IPs/CIDRs por módulo), `module_ip_settings` (`enforce`, `bypass_for_admin` por módulo), `ip_access_log` (auditoria).
- **Função SQL**: `is_ip_allowed_for_module(module, ip)`.
- **Edge function** `check-ip-access`: lê IP real de `x-forwarded-for`/`cf-connecting-ip`, valida JWT, retorna `{ allowed, ip, reason }`. Se `enforce=false`, sempre libera. Se `bypass_for_admin=true` e usuário tem role admin, libera.
- **Hook** `useIpAccess(moduleKey)` com cache 60s na sessão.
- **Componente** `<IpRestricted moduleKey>` envolve a página e mostra tela de bloqueio.
- **Admin**: `/admin/ip-allowlist` (apenas admin) — CRUD da allowlist, toggles enforce/bypass, log das últimas 50 tentativas.

## Módulos cobertos

`farmacia`, `nir`, `gestor`, `dev_console`, `validacao_farmaceutica` (todos com `enforce=false` por padrão para evitar lockout). Rotas envolvidas em `src/App.tsx`: `/painel-gestor`, `/validacao-farmaceutica`, `/nir`, `/dev-console`.

## Limitações

- Só protege a UI (RLS continua valendo no banco).
- Usuários em VPN/4G externos serão bloqueados quando enforce=on (comportamento desejado).
- IP dinâmico do hospital exige cadastrar faixa CIDR ampla.
