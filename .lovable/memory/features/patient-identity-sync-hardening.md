---
name: Patient Identity Sync Hardening
description: Reforço da sincronização identificação+leito; helper resolveCurrentBedSector p/ printAdmission/printEvolution e limpeza de campos do registry no reset do PrescricaoPage
type: feature
---

Camada extra de proteção contra "vazamento" de dados entre pacientes:

1. **`resolveCurrentBedSector(patientId)`** em `src/lib/resolvePatientHeader.ts` — SELECT puro em `patients(bed_number, sector)`. Use SEMPRE antes de imprimir documentos clínicos para garantir leito atual após relocações (UtiReallocationDialog, transferências internas).

2. **printAdmissionNormaZero** — todos os 3 callers (`AdmissionDialog`, `AdmissionConsultDialog`, `PacienteHubPage`) agora resolvem leito/setor ao vivo via `resolveCurrentBedSector` antes de chamar o helper, com fallback para o snapshot da prop. Mesma lógica já aplicada em `EvolutionTimeline`.

3. **PrescricaoPage reset** — quando `urlPatientId` muda (PatientSwitcher), o `setPatient` agora também zera `birthDate, sex, motherName, address, city`. Esses campos vêm do `patient_registry` via `usePatientIdentifiers` e podem "vazar" 1-2 frames até o registry novo ser resolvido. Crítico para troca rápida em UTI/UCI/UCC/Enf. Transição/Vascular/Neuro/Clín. Cirúrgica.

Zero `INSERT/UPDATE/DELETE` — apenas SELECT + sincronização de estado React.
