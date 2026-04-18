---
name: cockpit-painel-realtime-sync
description: Cockpit clínico (sidebar) sincroniza em tempo real com a tabela patients e admission_histories via Supabase Realtime, refletindo edições do Painel Clínico
type: feature
---
- Hook `usePatientLive(patientId)` busca o registro do paciente em `patients` e ouve `postgres_changes` filtrado por id, atualizando o estado local em qualquer INSERT/UPDATE/DELETE.
- `EvolucaoPage` alimenta o `PatientCockpit` com o livePatient quando disponível; CIDs vindos de `usePatientCid` são mesclados na lista de diagnósticos.
- Tabelas `patients` e `admission_histories` foram adicionadas à publication `supabase_realtime` com REPLICA IDENTITY FULL.
- Edições feitas em `/painel-clinico` aparecem imediatamente no cockpit aberto em `/evolucao` ou `/prescricao` sem reload.
