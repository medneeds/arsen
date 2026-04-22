---
name: cockpit-painel-realtime-sync
description: Cockpit clínico (sidebar) sincroniza em tempo real com patients, admission_histories, prescriptions, exam_requests, culture_results, patient_movements e clinical_evolutions via Supabase Realtime
type: feature
---
- `usePatientLive(patientId)` ouve `patients` (INSERT/UPDATE/DELETE) — leito, setor, dados clínicos editados em /painel-clinico aparecem instantâneo.
- `usePatientBedWatcher(id, bed, sector)` dispara toast "Paciente transferido" quando outro usuário muda leito/setor (evita prescrição em leito errado).
- `useActivePrescription(name, hospital)` ouve `prescriptions` — exclui draft, mostra v{n} + status + assinatura no Cockpit.
- `useLatestEvolution(id, name, hospital)` ouve `clinical_evolutions` — card com preview SOAP, autor, status; toast em INSERT por outro médico.
- `usePatientPendingItems(id, name, hospital)` ouve `exam_requests` + `culture_results` — KPIs de pendentes/concluídos/positivos.
- `usePatientMovements(id, name, hospital)` ouve `patient_movements` — aba Trajeto com últimas 5 movimentações.
- Tabelas com REPLICA IDENTITY FULL na publication `supabase_realtime`: patients, admission_histories, clinical_evolutions, prescriptions, exam_requests, culture_results, patient_movements.
