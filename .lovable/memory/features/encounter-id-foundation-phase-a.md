---
name: encounter-id-foundation-phase-a
description: Fase A da correção arquitetural de "dados residuais no leito" — adicionou coluna encounter_id + trigger autofill + backfill em 5 tabelas clínicas filhas, sem trocar nenhum filtro de leitura (Fase B)
type: feature
---

# Fase A — `encounter_id` em tabelas filhas

## Contexto / causa raiz
`patients` é modelado como "linha = leito" (pré-semeada por `(bed_number, sector)`, mutada in-place na admissão, reusada após alta). Filhas como `clinical_evolutions`/`exam_requests`/`culture_results`/`conduct_history`/`patient_movements` referenciavam `patient_id` (= UUID da linha-leito) → ao trocar de ocupante, evoluções antigas "vazavam" para o novo paciente. Tabelas com `encounter_id`/`encounter_code` (prescriptions, discharge_documents, dispensations) não sofriam disso.

## O que a Fase A fez (migração `20260519-230658`)
1. Coluna `encounter_id uuid REFERENCES patient_encounters(id) ON DELETE SET NULL` adicionada em:
   - `clinical_evolutions`, `culture_results`, `exam_requests`, `conduct_history`, `patient_movements`
2. Índice `idx_<tabela>_encounter_id` em cada uma.
3. Função `public.resolve_active_encounter_for_patient(p_patient_id uuid)` — devolve encounter ativo (status='active') do registry do paciente atual no leito.
4. Função `public.autofill_encounter_id()` (BEFORE INSERT, SECURITY DEFINER) — se NEW.encounter_id é NULL e NEW.patient_id existe, preenche via `resolve_active_encounter_for_patient`.
5. Trigger `trg_autofill_encounter_<tabela>` instalado nas 5 tabelas.
6. Backfill: para cada linha existente com `patient_registry_id` preenchido, vincula ao encounter cujo `created_at` é o maior `<=` ao da linha (fallback = primeiro encounter do registry).

## O que NÃO foi tocado
- Nenhuma tela, hook ou query do front-end.
- Triggers existentes (audit_trigger_function, autolink_patient_registry, sync_admission_to_patient, etc.).
- RLS, realtime, dados clínicos.

## Cobertura do backfill (snapshot pós-execução)
| Tabela | Total | Com encounter | Sem registry (esperado NULL) | Com registry sem match |
|---|---:|---:|---:|---:|
| clinical_evolutions | 374 | 27 | 341 | 6 |
| exam_requests | 322 | 0 | 322 | 0 |
| patient_movements | 69 | 21 | 40 | 8 |
| culture_results / conduct_history | 0 | — | — | — |

Registros legados sem `patient_registry_id` ficam com `encounter_id NULL` propositalmente — não há âncora segura para vinculá-los sem risco de contaminar o ocupante atual. A Fase B (filtros por encounter) simplesmente não os exibirá no cockpit do novo ocupante, eliminando a contaminação por construção.

## Próximo passo (Fase B — ainda não executada)
Trocar filtros de leitura de `patient_id` → `encounter_id` uma tela por vez, começando pelo cockpit (PatientCockpit, useEvolutions, useCockpitPatient), validando cada uma antes de seguir.
