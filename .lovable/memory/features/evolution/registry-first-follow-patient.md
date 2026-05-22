---
name: Evolution Registry-First Follow Patient
description: useEvolutions/useLatestEvolution priorizam patient_registry_id (identidade clínica) e carimbam registry_id+encounter_id no INSERT, fazendo a documentação seguir o paciente em transferências/relocações
type: feature
---

Bug recorrente: ao transferir/realocar o paciente, evoluções "sumiam" ou apareciam evoluções de ocupantes anteriores do leito, porque a query filtrava por `patient_id` (linha do mapa de leitos, volátil) em vez de pela identidade clínica permanente.

**Fix em 2 frentes**:

1. **Filtro registry-first** em `useEvolutions` e `useLatestEvolution`:
   - Resolve `patient_registry_id` via `useResolvedRegistryId(safePatientId)`.
   - Quando resolvido: `q.or('patient_registry_id.eq.<reg>,and(patient_registry_id.is.null,patient_id.eq.<bed>)')` — traz tudo do prontuário + legados sem carimbo do leito atual (sem vazar histórico de outros pacientes).
   - Mantém filtro encounter ativo (`encounter_id.eq.<active>,encounter_id.is.null`).
   - Fallback para `patient_id` quando registry não resolveu.

2. **Carimbo no INSERT** em `createEvolution`:
   - Inclui `patient_registry_id: resolvedRegistryId` e `encounter_id: activeEncounterId` no payload.
   - Garante que toda nova evolução já nasce vinculada à identidade permanente (não depende mais de backfill).

Padrão a replicar em prescriptions/exams/cultures/admission_histories. Hooks já filtrados por encounter (Phase B.3) seguem o mesmo princípio; isso adiciona a camada de identidade clínica acima do leito.

Zero schema/RLS/trigger — apenas frontend.
