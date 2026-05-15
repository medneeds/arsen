---
name: patient-identity-header-unificado
description: Componente único PatientIdentityHeader (variants cockpit/dialog) usa usePatientIdentifiers com realtime (patients/medical_records/patient_encounters/patient_registry). Aplicado em PatientCockpit e AdmissionDialog. Setor via sectorLabelFromCode (hospitalSectors).
type: feature
---
- `src/components/PatientIdentityHeader.tsx` é a fonte única de Nome, Idade, Setor, Leito, Status, Prontuário, Atendimento e painel "Ver dados do prontuário" (CPF, CNS, nascimento, mãe, endereço, tipo sanguíneo, alergias, comorbidades, NI).
- Variants: `cockpit` (vertical, compacto) usado em `PatientCockpit.tsx` (Zona 1 de Identidade); `dialog` (mais espaçado) usado em `AdmissionDialog.tsx` dentro do `DialogHeader`.
- Realtime no `usePatientIdentifiers`: subscribe em postgres_changes filtrando por `patient_id` em patients/medical_records/patient_encounters + match por `registryIdRef` em patient_registry. Refaz a query via `reloadTick`.
- Setor exibido sempre via `sectorLabelFromCode` (`src/lib/hospitalSectors.ts`) — proibido recriar mapas locais como o antigo `{ red, yellow, blue, outside, ucc }` que ignorava setores específicos.
- AdmissionDialog: o título virou só "Admissão Hospitalar" — nome/leito/setor agora aparecem dentro do PatientIdentityHeader, evitando divergência com o rail.
- Botão "Editar prontuário / ficha cadastral" do Cockpit ficou fora do toggle, logo abaixo da identidade.
