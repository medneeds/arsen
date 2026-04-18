---
name: cockpit-prontuario-atendimento-veremais
description: PatientCockpit exibe Prontuário e Atendimento direto na zona de identidade + botão "Ver dados do prontuário" expansível com dados completos do registry; cabeçalhos de paciente removidos das páginas clínicas
type: feature
---
- Hook `usePatientIdentifiers(patientId, patientName, hospitalUnitId)` busca `medical_records.numero_prontuario` (latest) e `patient_encounters.encounter_code` (latest), além do row de `patient_registry` (CPF, CNS, nascimento, mãe, endereço, sangue, alergias, comorbidades, etc.).
- `<PatientCockpit />` renderiza `IdRow` com **Prontuário** e **Atendimento** sempre visíveis (com botão de copiar no hover) e botão `Ver dados do prontuário` que abre painel com dados completos do registry e ID interno.
- Páginas que removeram o cabeçalho redundante (`<PatientInfoHeader>`/`<CompactPatientHeader>` de identificação): `EvolucaoPage` (mantém apenas chips de CID inline), `RequisicaoUnificadaPage`, `DocumentosPacientePage`, `MovimentacoesPage`. PrescricaoPage já usava header próprio.
- A identificação do paciente passa a ser uma só, no rail direito, eliminando duplicidade e liberando espaço vertical no corpo das páginas.
