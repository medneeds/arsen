# Relatório DevSecOps — ARSen

**Repositório:** `/arsen/`  
**Data:** 12 de junho de 2026  
**Contexto:** Sistema hospitalar 24/7 de uso crítico (HMDM Socorrão I, ~322 leitos)  
**Stack:** Lovable + Vite/React/TypeScript + Supabase (Postgres, Realtime, Edge Functions)  
**Preocupação principal:** Escalabilidade com crescimento de uso  

**Método:** Revisão estática do código + Opsera DevSecOps (architecture-analyze parcial, security-scan com semgrep + gitleaks)

---

## Sumário executivo

O ARSen é um prontuário e gestão de leitos maduro em produção, com boas práticas pontuais (RLS tenant-scoped, RPCs atômicos, hardening cirúrgico, testes de regressão de segurança). Porém, para um sistema **24/7 com PHI**, existem **8 riscos críticos** que exigem ação imediata — principalmente Edge Functions expostas, credenciais no bundle, PHI enviado a IA externa, e uma malha Realtime que não escala com o crescimento de usuários.

| Métrica | Valor |
|---------|-------|
| Commits (6 meses) | ~6.705 |
| Migrations SQL | 274 |
| Edge Functions | 23 |
| Páginas React | 73 |
| Canais Realtime | 38+ hooks/páginas |
| Testes security-fixes | 5 arquivos (sem CI) |

### Distribuição de riscos (revisão manual)

| Severidade | Quantidade | Ação |
|------------|------------|------|
| **Crítico** | 8 | Imediata (antes do próximo deploy) |
| **Médio** | 10 | 1–2 sprints |
| **Baixo** | 5 | Backlog |

### Scan Opsera automatizado (parcial)

**Score Opsera (ferramentas executadas): 53.9/100 — High Risk**

Fórmula: `min(100, round(log10((1×100) + (1×30) + (0×10) + (4×3) + 1) × 25)) = 53.9`

| Ferramenta | Status | Achados |
|------------|--------|---------|
| **gitleaks** | Executado | 1 — JWT Supabase anon key em `.env` |
| **semgrep** | Executado | 10 — 1 ERROR (JWT), 5× dangerouslySetInnerHTML, ReDoS |
| **grype** | Não instalado | Dependências/containers não verificados |
| **checkov** | Instalado, não executado | IaC não verificado |
| **hadolint** | Não instalado | Dockerfiles não verificados |

> O score 53.9 reflete apenas gitleaks + semgrep. A revisão manual identificou **8 riscos críticos adicionais** não capturados pelo scan parcial (Edge Functions expostas, Realtime global, PHI em IA, etc.).

---

## Arquitetura atual

```
Browser (React SPA, 73 páginas)
    │
    ├── Supabase Auth (JWT em localStorage)
    ├── Postgres + RLS (274 migrations, 100+ SECURITY DEFINER)
    ├── Realtime (38+ canais postgres_changes)
    ├── Storage
    └── 23 Edge Functions (Deno, muitas com service_role)
            │
            └── ai.gateway.lovable.dev (Gemini) ← PHI em alguns fluxos

Deploy frontend: Lovable Publish
Deploy backend: Supabase CLI / Lovable sync
CI/CD: inexistente
```

### Pontos positivos

- RLS tenant-scoped em `patients` e `patient_registry` via `can_access_hospital()`
- RPCs atômicos para transferência/realocação de leitos
- Migration `20260530120000_security_hardening_cirurgico.sql` e suite `security-fixes-*.test.ts`
- Session timeout LGPD/CFM, termos de consentimento, framework IP allowlist
- `audit_logs` imutável
- Mascaramento LGPD de CPF/CNS no modo **texto** de `extract-patient-data`

---

## Riscos CRÍTICOS

### C1 — Edge Functions sem autenticação + service_role

**Arquivos:** `supabase/functions/setup-legacy-passwords/index.ts`, `seed-cid10/index.ts`, `seed-rename-catalog/index.ts`

**Achado:** Funções usam `SUPABASE_SERVICE_ROLE_KEY` sem verificar JWT do caller. `setup-legacy-passwords` reseta senhas com padrão `"HAPVID"`.

**Consequência:** Qualquer pessoa com a URL da função pode resetar contas legadas ou alterar catálogos clínicos — bypass total de autenticação.

**Solução:**
- Exigir JWT + role `admin`/`dev`
- `verify_jwt = true` no `supabase/config.toml`
- Desabilitar ou remover funções seed em produção
- Rotacionar todas as senhas legadas

---

### C2 — Senha administrativa hardcoded no bundle JavaScript

**Arquivo:** `src/config/whitelabel.ts` (linha 93) — `panelPassword: "ARSEN2025"`  
**Uso:** `src/components/AppSidebar.tsx` (linha 490)

**Consequência:** Senha extraível do JS em segundos; desbloqueia seções admin na sidebar sem verificação server-side.

**Solução:** Remover gate client-side; autorizar apenas via `user_roles` no backend.

---

### C3 — PHI enviado a IA externa (LGPD Art. 11)

**Arquivos:** `supabase/functions/extract-patient-data/index.ts`, `transcribe-audio`, `examinus-chat`, `dev-console-ai`  
**Config:** `supabase/config.toml` — `verify_jwt = false` para `extract-patient-data`

**Achado:** Documentos clínicos (RG, SUS, formulários) enviados ao gateway Lovable/Gemini. Modo **imagem** não mascara CPF/CNS antes do envio (documentado no próprio código).

**Consequência:** Dados de saúde saem do perímetro sem DPA/contrato LGPD; risco ANPD.

**Solução:**
- Bloquear modo imagem até contrato com operador
- OCR on-prem ou processor com DPA
- Habilitar `verify_jwt = true`
- Auditar todas as funções de IA

---

### C4 — Contas compartilhadas sem rastreabilidade

**Arquivo:** `src/components/ProtectedRoute.tsx` — `LEGACY_GENERIC_USERS` (medicoporta, visitante, coordenador, etc.)

**Consequência:** Contas compartilhadas pulam aprovação, termos LGPD e seleção de setor — sem accountability individual (CFM/LGPD).

**Solução:** Descomissionar logins genéricos; migrar para perfis individuais.

---

### C5 — Realtime global na timeline do paciente

**Arquivo:** `src/hooks/usePatientTimeline.ts` (linhas 54–110)

**Achado:** Escuta `postgres_changes` em **15 tabelas clínicas** sem filtro por `patient_id` ou hospital. Qualquer alteração em qualquer leito invalida cache `["patient-timeline"]` globalmente.

**Consequência:** Pico de invalidações e conexões no turno; UI lenta/intermitente.

**Solução:** Filtrar subscriptions por paciente; debounce; reduzir tabelas na publication Realtime.

---

### C6 — Malha densa de Realtime (38+ pontos)

**Arquivos:** `usePatients.ts`, `PrescricaoPage.tsx`, `DashboardPage.tsx`, `TriageQueuePage.tsx`, etc.

**Consequência:** 50+ usuários no plantão = centenas de canais Supabase Realtime; risco de atingir limites do plano.

**Solução:** Consolidar canais por sessão; subscribe só em rotas visíveis; unsubscribe agressivo ao sair da página.

---

### C7 — Sem CI/CD — deploy direto para produção 24/7

**Achado:** Deploy via Lovable Publish; `package.json` sem script `test`; testes `security-fixes-*.test.ts` não rodam automaticamente.

**Consequência:** Regressões clínicas e de segurança podem ir a produção sem gate.

**Solução:** GitHub Actions com lint, security tests e dry-run de migrations.

---

### C8 — RLS fraca em transferências internas

**Arquivo:** `supabase/migrations/20260530120000_security_hardening_cirurgico.sql` (linhas 20–34)

**Achado:** Comentário promete filtro hospitalar, mas policy só exige `auth.uid() IS NOT NULL`.

**Consequência:** Qualquer usuário autenticado lê/edita todas as solicitações de transferência interna.

**Solução:** Substituir por `can_access_hospital(hospital_unit_id)` + checagem de role.

---

## Riscos MÉDIOS

| ID | Área | Achado | Consequência | Solução |
|----|------|--------|--------------|---------|
| M1 | Arquitetura | `PrescricaoPage.tsx` com 7.000+ linhas; SPA monolítica | Bundle grande, regressões no módulo mais crítico | Code-split + extrair hooks |
| M2 | Escalabilidade | `MovementsPage` — `select('*')` sem `.limit()` | Degradação com histórico crescente | Paginação + índice temporal |
| M3 | Segurança | CORS `*` em ~22 Edge Functions | Invocação cross-origin se anon key vazar | `ALLOWED_ORIGIN` restrito |
| M4 | Segurança | `resolve-login` — service_role + rate limit in-memory | Enumeração CPF→email | Rate limit em DB; CAPTCHA |
| M5 | Segurança | JWT em `localStorage` (`client.ts`) | XSS → roubo de sessão clínica | CSP + HttpOnly cookies |
| M6 | Infra | 274 migrations misturando schema e data fixes | Deploy lento; drift | Baseline + patches separados |
| M7 | Infra | Sem APM (Sentry/Datadog) | Falhas invisíveis até reporte manual | Alertas Supabase |
| M8 | Segurança | IP allowlist com `enforce=false` | NIR/gestor acessíveis de qualquer IP | Ativar CIDR hospitalar |
| M9 | Compliance | Session timeout 30 min (CFM sugere 15) | Estação compartilhada exposta | 15 min para perfis clínicos |
| M10 | Arquitetura | 100+ funções `SECURITY DEFINER` | Superfície privilegiada ampla | Inventário + REVOKE contínuo |

---

## Riscos BAIXOS

| ID | Achado | Consequência | Solução |
|----|--------|--------------|---------|
| L1 | Testes security-fixes fora do `npm test` | Regressão silenciosa | Script `test` + CI |
| L2 | `.env` ausente do `.gitignore` | Commit acidental de anon key | Adicionar + `.env.example` |
| L3 | Playwright instalado, sem e2e | Fluxos críticos sem smoke test | Login + admissão + prescrição |
| L4 | `verify-user-password` retorna email | Vazamento menor de PII | Retornar `{ ok: true }` |
| L5 | Docs `.lovable/memory` (68 arquivos) | Dessincronia com produção | Runbook revisado a cada release |

---

## Escalabilidade — diagnóstico

O crescimento de uso **não quebra primeiro no Postgres** (322 leitos cabem bem com RLS), mas sim na **camada Realtime + SPA monolítica**:

1. **Realtime** — cada usuário abre múltiplos canais; timeline invalida cache globalmente
2. **Edge Functions** — cold starts + IA externa adicionam latência
3. **Bundle frontend** — 73 páginas sem lazy-load agressivo
4. **Limites Supabase** — conexões Realtime, invocações Edge, CPU DB

**Ordem de mitigação:**
1. Filtrar/narrow Realtime subscriptions (maior ROI)
2. Consolidar canais por sessão
3. Lazy-load de módulos clínicos
4. Monitorar dashboard Supabase antes de upgrade de plano
5. Read replicas / cache só se métricas confirmarem gargalo DB

---

## Resultados do scan Opsera (automático)

### gitleaks — 1 achado

| Regra | Arquivo | Descrição |
|-------|---------|-----------|
| `jwt` | `.env:2` | `VITE_SUPABASE_PUBLISHABLE_KEY` (anon JWT) presente no arquivo |

> A anon key é pública por design no frontend, mas `.env` no repositório é risco de vazamento de outras variáveis e má prática. Adicionar `.env` ao `.gitignore`.

### semgrep — 10 achados

| Severidade | Regra | Arquivo |
|------------|-------|---------|
| ERROR | `detected-jwt-token` | `.env:2` |
| WARNING | `react-dangerouslysetinnerhtml` | `PrintableRequisitionGuide.tsx:447` |
| WARNING | `react-dangerouslysetinnerhtml` | `EvolutionForm.tsx:880,900,933,983` |
| WARNING | `detect-non-literal-regexp` | `fuzzySearch.ts:75` |

> `dangerouslySetInnerHTML` exige revisão: se conteúdo clínico não passar por DOMPurify, há risco XSS.

---

## Roadmap recomendado

### Imediato (esta semana)

1. Bloquear `setup-legacy-passwords`, `seed-cid10`, `seed-rename-catalog`
2. Remover `ARSEN2025`, `HAPVID`, senha padrão `123456` do fluxo de produção
3. Corrigir RLS `internal_transfer_requests`
4. Restringir CORS em produção (`ALLOWED_ORIGIN`)
5. Revisão LGPD das funções de IA
6. Adicionar `.env` ao `.gitignore`

### Curto prazo (1–2 sprints)

1. Filtrar Realtime (começar por `usePatientTimeline`)
2. Descomissionar contas compartilhadas
3. CI com security-fixes tests
4. Paginar queries unbounded
5. Ativar IP allowlist em produção

### Médio prazo

1. Split `PrescricaoPage` + lazy routes
2. APM/alertas Supabase
3. Baseline de migrations
4. Smoke e2e Playwright
5. Inventário SECURITY DEFINER

---

## Como rodar o Opsera completo

### Pré-requisitos

| Item | Obrigatório | Status neste ambiente |
|------|-------------|----------------------|
| **Plugin Opsera** instalado no Cursor | Sim | OK |
| **Conta Opsera** (free trial em [agent.opsera.ai](https://agent.opsera.ai)) | Sim | Autenticado |
| **MCP autenticado** (`mcp_auth`) | Sim | OK |

### Ferramentas CLI para security-scan completo

O scan `full` do Opsera espera estas ferramentas no PATH:

| Ferramenta | Função | Instalação Windows |
|------------|--------|-------------------|
| **gitleaks** | Detecção de secrets | `winget install Gitleaks.Gitleaks` |
| **semgrep** | SAST (código) | `pip install semgrep` + adicionar Scripts ao PATH |
| **grype** | Vulnerabilidades em dependências/containers | [Install script Anchore](https://github.com/anchore/grype#installation) |
| **checkov** | IaC / secrets em infra | `pip install checkov` |
| **hadolint** | Lint de Dockerfiles | Download binário ou `choco install hadolint` |

**Adicionar Python Scripts ao PATH (Windows):**

```powershell
$scripts = "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\Scripts"
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$scripts", "User")
```

Reinicie o terminal após instalar.

### Comandos Opsera no Cursor

| Comando | O que faz |
|---------|-----------|
| `/security-scan` | Scan completo (secrets, SAST, deps, IaC) |
| `/architecture-analyze` | Análise de arquitetura em 3 passes |
| `/compliance-audit` | SOC2, HIPAA, PCI-DSS, ISO 27001 |
| `/sql-security` | SQL injection, PII, privilégios |
| `/devsecops` | Agente especializado (combina ferramentas) |

Também funciona em linguagem natural: *"faça um security scan neste repo"*.

### Hook automático

O plugin intercepta `git commit` e exige scan pre-commit se houver achados critical/high **nas linhas que você alterou**.

### O que rodou nesta sessão

- **architecture-analyze:** Pass 1 concluído; Pass 2 iniciado (análise manual complementou)
- **security-scan:** Parcial — gitleaks + semgrep executados manualmente; grype/checkov/hadolint pendentes
- **Artefatos gerados:** `semgrep-report.json`, `gitleaks-report.json` na raiz do repo (não commitar)

---

## Limitações

- Análise principalmente **estática** (código-fonte)
- Métricas runtime (conexões Realtime, slow queries, invocações Edge) no dashboard Supabase refinariam severidade
- Scan Opsera **não foi 100% completo** — faltam grype, checkov e hadolint

---

*Gerado com Opsera DevSecOps Agent + revisão manual do repositório arsen.*
