---
name: Clinical Panel Unified View
description: Prontuário eletrônico unificado com tabela de dados e PatientCockpit em abas (Resumo, Exames, Condutas, Alta) substituindo accordions
type: feature
---

PatientCockpit (sidebar direita 320px fixa) usa Tabs em vez de accordions:
- **Resumo**: Diagnósticos, Antecedentes, Responsável médico
- **Exames**: Exames relevantes, Dispositivos
- **Condutas**: Condutas do dia, Pendências
- **Alta**: Previsão de alta + botão para abrir fluxo

Identidade, ações primárias (Evolução/Prescrever/Sinais/Alta) e alertas clínicos (alergias, TEV, pendências) ficam sticky no topo. Subcomponentes: CockpitSection, ItemList, EmptyMsg, AlertChip.
