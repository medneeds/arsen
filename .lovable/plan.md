# Setup Super Admin — Backup & Restore na aba Desenvolvedor

## Parte 1 — Levantamento do que já existe

### 1. Aba "Desenvolvedor" (Dev Console)
- **Existe**, em `src/pages/DevConsolePage.tsx` (rota `/dev-console`, ver `App.tsx`).
- Acesso restrito via `useIsDev()` → checa `user_roles.role IN ('dev','admin')` (server-side).
- Já é estruturado em **Tabs**: Pendências, Customização, Merges, Limpar Sinalização, Resíduo, IP Allowlist, AI Chat, Health, Audit.
- Existe perfil dedicado `desenvolvedor` em `AccessProfile` (landingRoute `/dev-console`), hoje restrito ao Arthur Batista.
- Já chama uma edge function central `dev-console-ops` para operações privilegiadas (padrão `callOps(action, params, confirm)`).

### 2. Autenticação / Autorização (RBAC)
- **Supabase Auth nativo** (e-mail + senha, sem OAuth). Login aceita usuário/CPF/e-mail via edge `resolve-login`.
- Roles em **tabela separada** `public.user_roles` (enum `app_role`):
  `admin, medico, porta, visitante, farmacia, nir, dev, coordenador`.
- Função `public.has_role(uuid, app_role)` SECURITY DEFINER usada nas RLS.
- Perfis (UI) ortogonais aos roles em `profiles.access_profile` / `access_profiles[]` (11 perfis), incluindo `desenvolvedor`, `admin`, `gestor`.
- **Não existe role `super_admin`** hoje. Hierarquia atual: `admin` é o topo; `dev` é técnico/operacional.

### 3. Backups Supabase
- Projeto Lovable Cloud (Supabase gerenciado). **PITR (Point-In-Time Recovery) não está confirmado** — depende do plano do Supabase subjacente; em projetos Cloud típicos vem **backup diário automático (snapshot)**, não PITR, salvo upgrade.
- Lovable **não expõe pg_dump nem dump completo** — só CSV por tabela (regra explícita do ambiente). Restore completo via SQL puro também é proibido pelo runtime.
- **Implicação crítica:** um "backup completo nativo" 100% fiel (incluindo `auth.users`, `storage`, sequences, triggers, extensões) **não é viável dentro do app** — só pelo painel Supabase / suporte Lovable.

### 4. Edge Functions já configuradas
23 funções, incluindo as administrativas: `admin-create-user`, `admin-approve-user`, `admin-change-email`, `reset-user-password`, `dev-console-ops`, `dev-console-ai`, `export-user-data`, `process-data-deletion`. Padrão de privilegiada = service role + `verify_jwt=false` com validação interna.

### 5. Tamanho do banco
- **72 tabelas** no schema `public`.
- DB total: **981 MB**, mas **`audit_logs` sozinho ocupa 900 MB** (≈92%). Restante clínico ≈ 80 MB.
- Top tabelas: audit_logs 900MB, prescriptions 31MB, clinical_evolutions 11MB, prescriptions_archive 4.5MB, exam_requests 3.4MB.

### 6. Auditoria
- Sim, robusta:
  - `audit_logs` (17 cols, 111k linhas) — log genérico.
  - `user_admin_audit` (imutável, 144 linhas) — gestão de usuários (LGPD).
  - Tabelas de histórico imutáveis específicas: `patient_admission_date_history`, `medical_record_edit_history`, `patient_registry_edit_history`, `patient_merge_audit`, `prescription_draft_deletion_audit`, `bed_status_history`, `locked_sector_cleanup_log`, `ip_access_log`.
- Padrão de uso: helper `logUserAdminAction` (client) + inserts dentro de RPC/edge.

### 7. Login
- 100% Supabase Auth nativo (sem custom JWT). Detalhes em `AuthContext.tsx` + edge `resolve-login`. Sessão persistida em localStorage. Suporta ProfileChooser pós-login (múltiplos `access_profiles`).

---

## Parte 2 — Realidade técnica sobre Backup/Restore (importante antes de aprovar)

Antes de planejar UI, alinhar limitações:

1. **Backup full nativo (pg_dump) é proibido** pelo ambiente Lovable. Só Supabase/suporte fazem.
2. **PITR** não é controlado pela aplicação — é flag de plano no Supabase.
3. **`auth.users`, `storage.objects` e `vault`** não podem ser tocados por migrações ou edge functions do projeto (regra de plataforma). Restore de usuários por dentro do app é **parcial** (só `public.*`).
4. **`audit_logs` (900 MB)** torna qualquer "backup full" via edge function inviável em uma chamada — limite de payload e timeout estouram.
5. Restore SQL bruto seria perigoso: precisaria desligar triggers, recriar FKs em ordem, lidar com sequences. Risco operacional alto em produção clínica.

**Conclusão:** o que dá pra entregar dentro do Arsen é um **backup/restore lógico de tabelas `public.*` selecionadas**, com auditoria forte. PITR/full real fica documentado como "operação Supabase".

---

## Parte 3 — Arquitetura proposta (para aprovar antes de codar)

### A. RBAC — novo role `super_admin`
- Adicionar `super_admin` ao enum `app_role` (migração).
- `has_role(uuid,'super_admin')` reutilizável em RLS.
- Hook `useIsSuperAdmin` (espelho de `useIsDev`).
- Setup inicial: aba "Setup Super Admin" só aparece se **nenhum** super_admin existir ainda OU se o usuário já for super_admin (bootstrap único, auditado).

### B. UI — nova tab "Backup & Restore" no DevConsolePage
Sub-abas:
1. **Visão geral** — tamanho por tabela, último backup, status PITR (info-only).
2. **Backup**
   - Botão "Backup completo (todas tabelas `public.*`)" → executa em background, gera arquivos por tabela em Storage.
   - Seleção de tabelas específicas (checkbox list) + "Backup parcial".
   - Histórico de backups (tabela `db_backups`).
3. **Restore**
   - Lista de backups disponíveis.
   - Modo "completo" (todas as tabelas do snapshot) ou "seletivo" (escolher tabelas).
   - Confirmação dupla com senha + frase digitada + motivo obrigatório.
   - Pré-visualização: linhas atuais vs linhas no backup.
4. **Documentação** — card explicando que PITR/auth/storage exige Supabase direto.

### C. Backend — 1 bucket + 1 tabela + 2 edge functions
- Bucket Storage privado `db-backups/` (service-role only).
- Tabela `public.db_backups`:
  - id, created_by, created_at, kind (`full|partial`), tables[], object_paths[], row_counts (jsonb), size_bytes, status, notes, restored_from (nullable).
  - RLS: só super_admin lê; só service_role escreve.
- Tabela `public.db_restore_audit` (imutável): id, super_admin_id, backup_id, mode, tables[], rows_before jsonb, rows_after jsonb, started_at, finished_at, status, error, reason.
- Edge function **`db-backup`**:
  - Valida JWT + checa `has_role(super_admin)`.
  - Recebe `{ mode, tables[] }`.
  - Faz `SELECT *` por tabela em lotes (cursor/keyset), serializa JSONL, faz upload incremental no bucket.
  - Pula `audit_logs` por padrão (opt-in explícito por causa do tamanho).
  - Registra em `db_backups`.
- Edge function **`db-restore`**:
  - Valida JWT + super_admin + payload (zod).
  - Para cada tabela: download do JSONL, `BEGIN` → truncate opcional → insert em lotes com `ON CONFLICT DO UPDATE` por PK → registra contagens.
  - Respeita ordem de FKs (topological sort prévio gerado no backup).
  - Sempre dentro de transação por tabela; falha rola back a tabela.
  - Registra `db_restore_audit` com antes/depois.

### D. Segurança e blindagem
- Toda operação exige reautenticação (senha) + motivo ≥ 20 caracteres.
- Restore bloqueado se houver `patient_encounters` ativo modificado nas últimas N horas (guard clínico) — override exige checkbox extra.
- Rate-limit (1 backup em andamento por vez, lock advisory Postgres).
- Logs em `audit_logs` (action `SUPER_ADMIN_BACKUP` / `SUPER_ADMIN_RESTORE`).
- Tabelas críticas (`patients`, `patient_encounters`, `prescriptions`, `clinical_evolutions`) marcadas como "alta criticidade" → confirmação extra.

### E. Fora de escopo (documentado na UI)
- Backup de `auth.users`, `storage.objects`, schemas `auth/storage/vault/realtime`.
- PITR — instruir abrir Lovable Cloud → Database, ou contatar suporte.
- Restore cross-project.

---

## Parte 4 — Perguntas para fechar antes de implementar

1. **Bootstrap do super_admin:** primeiro super_admin promovido por qual mecanismo? Opções: (a) pelo `admin` atual via aba (one-time), (b) por edge function chamada manualmente com chave de setup, (c) por migração SQL pontual.
2. **Escopo do "backup completo":** inclui `audit_logs` (900 MB)? Sugestão: NÃO por padrão, com opt-in.
3. **Política de retenção:** quantos backups manter no Storage? (custo)
4. **Restore destrutivo:** `TRUNCATE + INSERT` ou `UPSERT` (preserva linhas criadas após o backup)? Padrão sugerido = UPSERT por PK.
5. **Disponibilidade durante restore:** colocar app em "modo manutenção" (banner global + bloqueio de escrita)? Recomendado.
6. OK em assumir que `auth.users` / Storage / PITR ficam **fora** do recurso e só são documentados?

Quando responder essas 6, transformo em plano executável e abrimos a migração + edge functions.
