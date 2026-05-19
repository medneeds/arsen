---
name: encounter-id-foundation-phase-b1
description: Fase B.1 — leitura do cockpit filtrada por encounter_id ativo (não mais só por patient_id da linha-leito), com fallback para registros legados sem carimbo
type: feature
---

# Fase B.1 — Leitura do cockpit por atendimento ativo

## Contexto
Fase A (concluída) adicionou `encounter_id` em 5 tabelas filhas com triggers de
autofill e backfill. Fase B.1 migra os **filtros de leitura** do cockpit para
usar `encounter_id` ao invés de apenas `patient_id` (que é a linha-leito,
reutilizada entre ocupantes — causa raiz dos dados residuais).

## Regra única aplicada
```
WHERE patient_id = <current>
  AND ( encounter_id = <active_encounter_id>
        OR encounter_id IS NULL )
```
Implementada via `.or("encounter_id.eq.<id>,encounter_id.is.null")` nos hooks.

- Registros carimbados ficam isolados pelo encounter atual.
- Registros legados (sem carimbo) só aparecem enquanto `patient_id` da linha-leito é o mesmo — somem assim que o leito é reusado por novo paciente.
- Zero risco visual: nenhum contrato/UI/insert/print foi tocado.

## Arquivos criados
- `src/hooks/useActiveEncounterId.ts` — resolve encounter ativo (status≠'closed', fallback latest); realtime em `patient_encounters` do paciente.

## Hooks de leitura modificados (apenas query)
1. `src/hooks/useEvolutions.ts` — lista de evoluções
2. `src/hooks/useLatestEvolution.ts` — última evolução (preview/devices/culturas)
3. `src/hooks/usePatientMovements.ts` — timeline de movimentações
4. `src/hooks/useConductHistory.ts` — rail de condutas (queryKey inclui encounter)

## Fora do escopo desta entrega
- `src/hooks/useCockpitPatient.ts` — não consulta nenhuma das 5 tabelas (só monta Patient da URL + `usePatientLive`/`usePatientCid`). Sem mudança.
- Inserts/print/PDF/auditoria/realtime de outras tabelas/RLS/schema.
- B.2+: telas de setor (exames, requisições), dashboards, relatórios.

## Validação
- Tipos preservados.
- Smoke test esperado: paciente novo num leito anteriormente ocupado deixa de ver evoluções/condutas/movimentos do ocupante anterior assim que tem encounter ativo carimbado.
