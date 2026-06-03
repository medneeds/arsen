---
name: Discharge Prediction Sync
description: Sync bidirecional UTI/hospitalar de previsão de alta, alerta ≤24h em cards, banner na evolução, popup único por sessão no mapa e auditoria via audit_logs
type: feature
---

# Discharge Prediction Sync (≤24h)

## Campos canônicos
- `patients.uti_discharge_prediction` (texto multi-linha, refletido em `patient.utiDischargePrediction: string[]` na UI).
- `patients.hospital_discharge_prediction` (string única) — usado em enfermaria/clínica e priorizado pelo NIR/Gestor.

## Helper único
`src/lib/dischargePrediction.ts`:
- `normalizeDischargePrediction(value: string | string[] | null)` → primeira linha não-vazia.
- `parseDischargePredictionDate(...)` → Date com fim do dia em **UTC-3 (23:59 São Luís/MA)**.
- `isWithin24Hours(date)` → janela `(0, 24h]`.
- `resolvePatientDischargePrediction(patient)` → `{label, date, imminent, source: 'hospital'|'uti'|null}`. **Hospitalar tem precedência** quando ambos existem.
- `buildDischargePredictionLabel(iso)` → `"DD/MM/YYYY (D+N)"`.
- `dischargeAlertSessionKey(patientId)` → chave única para `sessionStorage`.

## Fluxo bidirecional (sem código duplicado)
- Edição na **Evolução** (`EvolucaoPage` → `DiagnosticsPanel`) escreve via `usePatientDiagnosticContext.update*` (debounce + realtime). **Não há** sync paralelo em `useEvolutions.createEvolution` — seria código morto, `soap_data.dischargePrediction` não existe.
- Edição em **Painel Clínico** / **Edição Avançada** / **Cockpit** passa pelo MESMO hook → audit log dispara em ponto único.

## Auditoria
`usePatientDiagnosticContext.persist` snapshota antes do update e, se a previsão mudou de fato, insere em `audit_logs`:
- `action='UPDATE'`, `table_name='patients'`, `record_id=patientId`
- `changed_fields=['uti_discharge_prediction'|'hospital_discharge_prediction']`
- `old_data`/`new_data` com os campos afetados
- `department='DISCHARGE_PREDICTION_SYNC'` (marcador para filtrar a trilha)

Enum `audit_action` não tem variantes específicas — por isso usamos `UPDATE` + marker no `department`, em vez de criar enum novo.

## Alertas visuais
- **Cards do mapa** (`PatientCard`, `UtiPatientCard`) — badge `border-warning bg-warning/15 text-warning-foreground` com ícone `AlertTriangle` ao lado do label "Previsão de Alta" quando `imminent`. Cobre UTI **e** enfermaria.
- **Banner na Evolução** (`EvolucaoPage`) — banner âmbar acima do `DiagnosticsPanel` quando ≤24h, com botões "Manter" (apenas dismiss da sessão via `dischargeBannerDismissed`) e "Atualizar previsão" (limpa o campo apropriado via `update*`, força o médico a reescrever no painel logo abaixo).
- **Toast no mapa** (`src/pages/Index.tsx`) — emite 1 toast `sonner.warning` por `patient.id` por sessão usando `dischargeAlertSessionKey`. **Absoluto**: não reseta mesmo se a previsão mudar — para evitar barulho de UX durante o plantão.

## Tokens de cor
Usamos exclusivamente tokens do design system (`warning`, `warning-foreground`, `border-warning`, `bg-warning/15`). **Nada de `amber-*` hard-coded.**

## Por que NÃO usamos `patient_movements`
O feed de `patient_movements` segue os 9 subtipos da memória *Movement Flow Unified* (entrada/transferência/saída). Inserir "ATUALIZAÇÃO PREVISÃO DE ALTA" lá poluiria o histórico clínico-operacional. Auditoria de campo segue o padrão consolidado do projeto (tabela dedicada `audit_logs`, ver também `medical_record_edit_history`, `patient_admission_date_history`).
