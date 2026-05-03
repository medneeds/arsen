---
name: gestor-kpi-drilldown
description: Cards de KPI do Painel do Gestor são clicáveis e abrem KpiDrillDownDialog com lista subjacente
type: feature
---

Os 6 KPIs do GestorPanelPage (occupancy, vacant, door, alerts, prescriptions, requests) ficam clicáveis. O clique abre `<KpiDrillDownDialog>` com a lista detalhada.

- Datasets carregados em `fetchData`: `occupiedPatientsList`, `vacantBedsList`, `doorPatientsList`, `pendingRequestsList`, `prescriptionsList`. Alertas usam `criticalAlerts` direto.
- Estado `drillDown` (string | null) controla o modal.
- Componente reutilizável: `src/components/gestor/KpiDrillDownDialog.tsx` aceita rows `{id, primary, secondary, tertiary, badge}`.
- Para adicionar novo KPI clicável: incluir `key` no kpiCard, popular `drillRows[key]` no map.
