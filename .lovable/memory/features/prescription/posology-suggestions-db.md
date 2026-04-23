---
name: prescription-posology-suggestions-db
description: PosologySuggestionsBar combina protocolos clínicos manuais (sepse/TEV/dor) com evidência farmacêutica do catálogo HMDM 2026 (diluição padrão, dose máxima diária, tempo de infusão) carregada de medication_catalog + medication_presentations
type: feature
---
- Ao adicionar um medicamento na prescrição, o `PosologySuggestionsBar` mostra sugestões de 1 clique combinando duas fontes:
  1. **Protocolos clínicos manuais** (`src/lib/posologyProtocols.ts`) — ~40 medicamentos de alto uso com protocolos por indicação (Sepse, TEV, Crise hipertensiva, Sedação UTI etc.).
  2. **Padrão HMDM 2026** (`useMedicationProtocols` → `medication_catalog` + `medication_presentations`) — ~84 apresentações com diluição padrão, dose máxima diária e tempo de infusão baseados em evidência (Micromedex/UpToDate/ISMP). Aparecem como chip "Padrão HMDM (Forma)".
- Os protocolos do banco são gerados via `presentationToProtocol()`: só viram chip se a apresentação tem pelo menos um campo de evidência preenchido (`standard_dilution`, `max_daily_dose` ou `infusion_time`).
- Cache em módulo (`cachedIndex`) — todas as 222 medicações + 322 apresentações carregadas uma única vez por sessão e indexadas por nome normalizado (sem acentos/pontuação).
- Match por nome em duas etapas: exato → inclusão (chave mais específica primeiro). Funciona com nomes vindos do `medicationsDatabase.ts` hardcoded e do banco — não depende de medication_id.
- Aplicar um chip do banco preenche `diluent`, `infusionTime` (em minutos quando extraível) e `instructions` (com dose máx) sem sobrescrever dose/posologia que o médico já ajustou.
- Edição do catálogo (incluindo `standard_dilution`, `max_daily_dose`, `infusion_time`) restrita a `has_role(auth.uid(), 'admin')` via RLS.
