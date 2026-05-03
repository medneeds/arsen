---
name: Admin Reports - Gestão Executiva
description: Sprint 3 — 6 relatórios executivos plugáveis em /relatorios na categoria "Gestão Executiva"
type: feature
---
Categoria `gestao` (fuchsia-600) em `reportDefinitions.ts` com 6 relatórios:
1. `gestao_occupancy_by_sector` — bed_census agrupado por setor (vago/ocupado/bloqueado/reservado + ocupação %).
2. `gestao_stay_by_sector` — LOS médio/min/max por setor de destino (patient_encounters com outcome_date).
3. `gestao_discharge_death_rate` — taxas de desfecho (alta, óbito, evasão...) com summary destacando óbito e alta.
4. `gestao_production_per_doctor` — combina patient_encounters (atendimentos/altas/óbitos) + clinical_evolutions (evoluções) por nome.
5. `gestao_nir_queue` — bed_allocation_requests com idade, status e flag SLA ≤2h.
6. `gestao_triage_sla` — pre_admissions, SLA Manchester (vermelho 0, laranja 10, amarelo 60, verde 120, azul 240 min) com aderência.

Arquitetura plugável: novos relatórios = adicionar entrada em REPORT_DEFINITIONS + case no switch de `useReportData.executeQuery`. Categoria nova = adicionar enum + entrada em REPORT_CATEGORIES.
