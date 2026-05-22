---
name: Resolve Header Medical Record Name Guard
description: Guarda anti-vazamento no fallback 1c do resolvePatientHeader — exige match de nome (NFD/upper) entre patients.name e registry.full_name quando vincula por medical_record
type: feature
---

Blindagem permanente contra vazamento de identidade no cabeçalho dos PDFs.

**Bug observado:** L09 UCI 2 (Luis Carlos Marques Figueredo) imprimia com dados de Marilene Morais da Silva, porque a linha `patients` estava com `medical_record='182683-1'` errado (esse MR pertencia à Marilene no `patient_registry`). O fallback 1c em `resolvePatientHeader` casava cego pelo MR e devolvia o registry da outra paciente.

**Guarda em `src/lib/resolvePatientHeader.ts` (bloco 1c):** ao achar registry por `medical_record`, só aceita o vínculo se `norm(registry.full_name) === norm(patients.name)` (NFD + upper + trim). Se divergir, descarta — paciente segue sem registry (resto do fluxo cobre via 1d ou fallback).

Sem schema/RLS/trigger. Combina com [Patient Identity Sync Hardening](mem://features/patient-identity-sync-hardening) e [Active Encounter Registry Resolution](mem://features/active-encounter-registry-resolution).
