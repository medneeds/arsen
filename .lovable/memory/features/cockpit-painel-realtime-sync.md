---
name: cockpit-painel-realtime-sync
description: Cockpit clínico (sidebar) sincroniza em tempo real com patients (incl. responsabilidade médica), admission_histories, prescriptions, exam_requests, culture_results, patient_movements, clinical_evolutions e vital_signs via Supabase Realtime
type: feature
---
- `usePatientLive(patientId)` ouve `patients` (INSERT/UPDATE/DELETE) — leito, setor, dados clínicos, alergias, dispositivos e responsabilidade médica editados em /painel-clinico aparecem instantâneo no Cockpit.
- `usePatientBedWatcher(id, bed, sector)` dispara toast "Paciente transferido" quando outro usuário muda leito/setor.
- `useActivePrescription(name, hospital)` ouve `prescriptions` — exclui draft, mostra v{n} + status + assinatura.
- `useLatestEvolution(id, name, hospital)` ouve `clinical_evolutions` — card com preview SOAP, autor, status; toast em INSERT por outro médico.
- `useLatestVitalSigns(patientId)` ouve `vital_signs` (INSERT) — chip com PA, FC, SpO₂, FR, T°, Lactato + badge NEWS2; toast crítico para news2_risk=high, lactato>4 ou potássio>6/<2.5.
- `usePatientPendingItems(id, name, hospital)` ouve `exam_requests` + `culture_results` — KPIs de pendentes/concluídos/positivos.
- `usePatientMovements(id, name, hospital)` ouve `patient_movements` — aba Trajeto com últimas 5 movimentações.
- Toast "Responsável médico atualizado" disparado dentro do `PatientCockpit` ao detectar mudança em `medical_responsibility.leaderNames` via `usePatientLive`.
- Tabelas com REPLICA IDENTITY FULL na publication `supabase_realtime`: patients, admission_histories, clinical_evolutions, prescriptions, exam_requests, culture_results, patient_movements, vital_signs.
