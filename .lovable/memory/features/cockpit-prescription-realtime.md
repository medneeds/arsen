---
name: cockpit-prescription-realtime
description: Cockpit clínico exibe chip de prescrição ativa em tempo real (versão, status, item count, assinatura) sincronizado com a tabela prescriptions
type: feature
---
- Hook `useActivePrescription(patientName, hospitalUnitId)` busca a prescrição mais recente do paciente (ordenada por created_at desc, limit 1) e ouve `postgres_changes` em `prescriptions` filtrado por hospital_unit_id, refazendo o fetch quando o `patient_name` do payload bate.
- Tabela `prescriptions` foi adicionada à publication `supabase_realtime` com REPLICA IDENTITY FULL.
- `PatientCockpit` consome o hook e renderiza um chip clicável (Zona 3.5) entre os alertas e as abas, mostrando: versão, status traduzido (Rascunho / Aguard. validação / Validada / Suspensa / Finalizada), badge "assinada" se digital_signature presente, contagem de itens e tempo relativo ("há 5 min").
- Clique no chip navega para `/prescricao?patientId=...&patient=...&bed=...`.
- Vínculo paciente↔prescrição é por `patient_name` + `hospital_unit_id` (mesma chave usada em PrescricaoPage.tsx para listar prescrições).
