---
name: Dev Console Residual History
description: Aba "Histórico Residual" no Dev Console para detectar e arquivar evoluções residuais por leito (paciente anterior aparecendo no cockpit do novo ocupante)
type: feature
---

Aba `/dev-console` → "Histórico Residual" (ícone Archive). Resolve contaminação cruzada quando saída/desalocação do paciente anterior não passou pelo `archive_bed_history`/`repoint_patient_history` — evoluções com `patient_bed/patient_sector` do leito atual mas `patient_id` diferente do ocupante atual (ou NULL).

**Actions** em `supabase/functions/dev-console-ops/index.ts`:
- `list_bed_residual_history` — cruza `patients` (is_vacant=false) com `clinical_evolutions` (archived_at IS NULL) por (sector|bed). Agrupa por leito com `originPatients[]` (nome + count) e `evolutionIds[]`.
- `archive_bed_residual_history` — recebe `evolutionIds[]` + `dryRun` + (não-dry exige `confirm:true`). Atualiza `archived_at=now()`, `archived_from_patient_id=patient_id` (ou NULL), `archive_reason='dev_console_residual_cleanup'`. Audita em `audit_logs` action `DEV_ARCHIVE_RESIDUAL_HISTORY`.

**Componente:** `src/components/dev/ResidualHistoryTab.tsx`. Card amarelo didático no topo, tabela leito a leito, dialog de prévia com lista das evoluções afetadas antes do arquivamento.

**Escopo cirúrgico:** somente `clinical_evolutions`. NÃO toca prescriptions, requisições, admissões, leito, paciente atual, status. Nunca apaga — apenas arquiva. Evolução permanece acessível no histórico longitudinal do paciente original.

**Causa raiz (não resolvida aqui):** fluxo de alta/desalocação não chama `repoint_patient_history`/`archive_bed_history`. Quando a row em `patients` é reaproveitada por novo ocupante, evoluções antigas passam a apontar para o novo `patient_id`. Pre_admissions stale (`status='admitido'` após saída) também ficam — não tratadas nesta aba ainda.
