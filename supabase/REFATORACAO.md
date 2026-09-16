# Briefing para reescrita do frontend — Arsen (schema refatorado)

## 1. Conexão com o Supabase novo

Trocar no `.env` do projeto (raiz do repo):

```
VITE_SUPABASE_URL="https://newsb.arsen.com.br"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MTc4NTM2LCJleHAiOjIxMDM1Mzg1MzZ9.wmbv0QOtFg2WepTYpF9KpxW2fzDy2NEhMJppHe0NM-w"
```

> Essa é a `ANON_KEY` gerada para a instância `newsb.arsen.com.br` — pública
> por design (é a mesma que vai para o frontend), então pode ficar commitada
> em `.env.example`. **Nunca** faça o mesmo com `SERVICE_ROLE_KEY`,
> `JWT_SECRET`, `POSTGRES_PASSWORD` ou `VAULT_ENC_KEY` dessa instância —
> essas continuam só no cofre de senhas / env vars do Dokploy.

Depois, regenerar `src/integrations/supabase/types.ts` (hoje com 6012 linhas,
gerado em cima do schema antigo — está totalmente desatualizado):

```bash
npx supabase gen types typescript --db-url "postgresql://postgres:<POSTGRES_PASSWORD>@<host-da-vps>:<POSTGRES_PORT>/postgres" > src/integrations/supabase/types.ts
```

(usar a `POSTGRES_PORT` que foi remapeada pra evitar conflito com o outro
Supabase na mesma VPS, e o host/porta expostos publicamente pela VPS — não
o `db:5432` interno do Docker.)

## 2. Mudança estrutural mais importante

O antigo `patients` misturava **leito físico + identidade do paciente +
internação** numa linha só. Isso está separado agora em três tabelas:

| Conceito | Tabela antiga | Tabelas novas |
|---|---|---|
| Leito físico | `patients.bed_number` / `bed_census` | `leitos` (via `setores` → `alas` → `hospitais`) |
| Identidade do paciente | `patients.name/cpf/...` | `pacientes` |
| Internação (estadia) | `patients` + `patient_encounters` + `admission_histories` | `internacoes` |

Qualquer query que hoje faz `.from('patients').select('*')` esperando um
objeto único com leito+paciente+internação precisa virar um `select` com
`join` (ou 3 queries) em `internacoes` (com `leito_id` e `paciente_id`) +
`pacientes` + `leitos`.

## 3. Tabela de-para completa (78 tabelas antigas → 54 novas)

### Estrutura física / identidade
| Antiga | Nova |
|---|---|
| `hospital_units` | `hospitais` |
| `states` (setor/estado do paciente) | `setores` (agora FK real, não texto livre) |
| — (não existia como entidade própria) | `alas` (nova camada entre hospital e setor) |
| `bed_census`, `bed_status_history` | `leitos` |
| `patients`, `patient_registry` | `pacientes` |
| `profiles`, `user_roles`, `user_hospital_assignments`, `user_departments` | `profissionais` + `profissionais_hospitais` + `profissionais_setores` |

### Fluxo assistencial
| Antiga | Nova |
|---|---|
| `patient_encounters`, `admission_histories`, `internment_requests` | `internacoes` |
| `clinical_evolutions` | `evolucoes` |
| `vital_signs` | `sinais_vitais` |
| `internal_transfer_requests`, `patient_movements` | `transferencias` |
| `discharge_documents` | `altas` |
| `regulation_requests` | `regulacoes` |
| `bed_allocation_requests` | `solicitacoes_leito` |
| `pre_admissions` | `pre_admissoes` |

### Medicamentos e prescrição
| Antiga | Nova |
|---|---|
| `medication_catalog` | `catalogo_medicamentos` |
| `medication_presentations` | `apresentacoes_medicamento` |
| `medication_aliases` | `sinonimos_medicamento` |
| `medication_favorites` | `medicamentos_favoritos` |
| `prescriptions` | `prescricoes` (agora presa a `internacao_id`, não `patient_id` solto) |
| `prescriptions_archive` | evento em `logs_auditoria` (`tipo_evento='arquivamento_prescricao'`) |
| `prescription_validations` | `validacoes_prescricao` |
| `prescription_quick_templates` | `modelos` (`tipo='prescricao_rapida'`) |
| `prescription_draft_deletion_audit` | evento em `logs_auditoria` |
| `prescription_affinity_audit` | evento em `logs_auditoria` |
| `dispensations` | `dispensacoes` |
| `receituarios` | `receituarios` (mesmo nome) |
| `therapeutic_templates` | `modelos` (`tipo='protocolo_terapeutico'`) |
| `regulatory_guides` | `guias_regulatorias` |

### Exames, culturas e escores
| Antiga | Nova |
|---|---|
| `exam_requests` | `solicitacoes_exame` |
| `culture_results` | `resultados_cultura` |
| `saps3_assessments` | `avaliacoes_saps3` |
| `sepsis_protocols` | `protocolos_sepse` |
| `cid10_codes` | `codigos_referencia` (`tipo='cid10'`) |
| `medical_codes` | `codigos_referencia` (`tipo` = exame/procedimento/material/medicacao) |

### Auditoria (tudo isso virou UMA tabela genérica)
| Antiga | Nova |
|---|---|
| `audit_logs` | `logs_auditoria` |
| `conduct_history` | `logs_auditoria` (`tipo_evento='edicao_conduta'`) |
| `medical_record_edit_history` | `logs_auditoria` (`tipo_evento='edicao_prontuario'`) |
| `patient_registry_edit_history` | `logs_auditoria` (`tipo_evento='edicao_cadastro_paciente'`) |
| `patient_versions` | `logs_auditoria` (`tipo_evento='versao_paciente'`) |
| `patient_admission_date_history` | `logs_auditoria` (`tipo_evento='alteracao_data_internacao'`) |
| `patient_merge_audit` | `logs_auditoria` (`tipo_evento='fusao_pacientes'`) |
| `user_admin_audit` | `logs_auditoria` (`tipo_evento='admin_usuario'`) |
| `medical_records` | (conteúdo distribuído entre `internacoes`/`evolucoes`) |

### Config / auth
| Antiga | Nova |
|---|---|
| `module_ip_allowlist` | `config_ip_permitido` |
| `module_ip_settings` | `config_ip_modulo` |
| `ip_access_log` | `log_acesso_ip` |
| `system_maintenance_mode` | `modo_manutencao` |
| `data_retention_policies` | `politicas_retencao_dados` |
| `institution_branding` | `identidade_visual_hospital` |
| `field_text_templates` | `modelos` (`tipo='texto_campo'`) |

### Backup / infra
| Antiga | Nova |
|---|---|
| `backup_jobs`, `db_backups` | `jobs_backup` |
| `restore_jobs`, `db_restore_audit` | `jobs_restauracao` |
| `backup_audit` | `auditoria_backup` |
| `locked_sector_cleanup_log` | `log_limpeza_setor_bloqueado` |

### Operações diversas
| Antiga | Nova |
|---|---|
| `shift_handovers` | `passagens_plantao` |
| `round_sessions` | `sessoes_visita` |
| `round_responses` | `respostas_visita` |
| `round_section_goals` | `metas_secao_visita` |
| `notes_reminders` | `notas_lembretes` |
| `reception_desk_sessions` | `sessoes_recepcao` |
| `pre_registration_requests` | `solicitacoes_pre_cadastro` |
| `password_reset_requests` | `solicitacoes_redefinicao_senha` |
| `data_requests` | `solicitacoes_dados_lgpd` |
| `user_consents` | `consentimentos_usuario` |
| `dhd_patients` | `pacientes_dhd` |
| `unidentified_sequences`, `medical_record_sequences` | `contadores` |
| `dev_pendencies` | (sem equivalente — avaliar se ainda é necessária) |

## 4. Papéis (roles)

`profissionais.papel` agora é o enum `papel_profissional`:
`super_admin, admin, medico, enfermeiro, tecnico, regulador, farmacia, nir, porta, visitante, coordenador, dev`

`admin` = gestor de UM hospital (RLS trava isso no banco). `super_admin` =
dono do sistema, sem `hospital_id`.

## 5. Ordem sugerida de ataque no Claude Code

1. Trocar `.env` e regenerar `types.ts` primeiro — o TypeScript vai passar
   a acusar erro em toda query que referencia tabela/coluna que não existe
   mais. Use isso como guia (compilador encontra os 57 arquivos por você).
2. Começar pelos hooks/serviços centrais de dados (provavelmente em
   `src/hooks/` ou `src/services/` — o que centraliza `patients` e
   `patient_encounters`), não pelas telas — a maioria das telas consome
   esses hooks.
3. Ir módulo por módulo na ordem: estrutura física → pacientes/internação
   → prescrição → exames/escores → auditoria/config → backup/operações.
4. Rodar `npm run build` (ou `tsc --noEmit`) a cada módulo fechado.