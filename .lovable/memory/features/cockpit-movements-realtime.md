---
name: cockpit-movements-realtime
description: Cockpit clínico mostra trajeto do paciente (transferências/saídas) em tempo real, sincronizado com patient_movements
type: feature
---
- Hook `usePatientMovements(patientId, patientName, hospitalUnitId)` busca os 15 últimos `patient_movements` (preferindo patient_id, fallback patient_name+hospital_unit_id) e ouve `postgres_changes`.
- Tabela `patient_movements` com REPLICA IDENTITY FULL na publication `supabase_realtime`.
- Aba "Trajeto" do `PatientCockpit` (ícone Route) lista até 5 movimentações com tipo (transferencia/alta/obito/...), origem (setor·leito), destino e timestamp relativo ptBR. Status colorido: pending_release (warning) / released (success).
- Substitui aba "Alta" anterior; previsão de alta integrada no topo da nova aba.
