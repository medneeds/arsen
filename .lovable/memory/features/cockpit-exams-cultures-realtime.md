---
name: cockpit-exams-cultures-realtime
description: Cockpit clínico mostra atividade de exames e culturas em tempo real (pendentes, concluídos, culturas positivas) sincronizado com exam_requests e culture_results
type: feature
---
- Hook `usePatientPendingItems(patientId, patientName, hospitalUnitId)` busca os 20 mais recentes de `exam_requests` e `culture_results` filtrando por patient_id (preferido) ou patient_name (+hospital_unit_id) e ouve `postgres_changes` em ambas as tabelas.
- Tabelas `exam_requests` e `culture_results` com REPLICA IDENTITY FULL na publication `supabase_realtime`.
- Aba "Exames" do `PatientCockpit` exibe 4 mini-stats (exames pendentes, exames concluídos, culturas pendentes, culturas positivas) + lista dos 5 itens mais recentes com ícone (TestTubes/ShieldAlert), label e status colorido.
- Cultura com microorganismo identificado é tratada como crítica (tom danger).
