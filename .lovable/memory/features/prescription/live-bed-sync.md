---
name: Prescription Live Bed Sync
description: PrescricaoPage sincroniza patient.bed/unit em tempo real via usePatientLive; loadPrescription preserva leito vivo e não herda snapshot histórico
type: feature
---

Blindagem contra "vazamento de leito" no PDF de prescrição (bug observado: PDF do L07 UTI 1 saindo com bed=L05 após troca rápida de paciente / autoload de prescrição com bed obsoleto).

**1. Sync vivo de bed/unit** em `src/pages/PrescricaoPage.tsx` (após `usePatientIdentifiers`):
```ts
const { patient: livePatientForBed } = usePatientLive(urlPatientIdForRecord);
useEffect(() => {
  if (!livePatientForBed) return;
  const liveBed = livePatientForBed.bedNumber || '';
  const liveSector = livePatientForBed.sector || '';
  const liveUnit = sectorMapInit[liveSector] || liveSector;
  setPatient(prev =>
    (prev.bed === liveBed && prev.unit === liveUnit) ? prev
    : { ...prev, bed: liveBed, unit: liveUnit }
  );
}, [livePatientForBed?.bedNumber, livePatientForBed?.sector]);
```

**2. `loadPrescription`** — ao carregar prescrição salva, NÃO sobrescreve bed/unit com o snapshot histórico do `patient_data`; preserva o valor vivo já no estado.

Junto com a memória [Patient Identity Sync Hardening](mem://features/patient-identity-sync-hardening) (que cobre admissão/evolução via `resolveCurrentBedSector`), garante que TODO PDF clínico reflete o leito ATUAL do paciente, mesmo após relocações.

Zero schema/RLS/trigger — apenas frontend.
