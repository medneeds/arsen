---
name: prescription-admission-templates
description: 4 modelos institucionais de admissão (Clínica, UTI, Pós-op, Sepse) na categoria 'admissao' de prescription_quick_templates, exibidos como botões 1-clique no estado vazio da prescrição
type: feature
---
- Categoria `clinical_category='admissao'` em `prescription_quick_templates` reservada para pacotes de admissão.
- 4 templates seed compartilhados (`scope=shared`): Admissão Clínica padrão (8), Admissão UTI (12), Admissão Pós-operatório (10), Admissão Sepse / Choque séptico (8).
- Padronização: omeprazol 40 mg EV diluído em 10 mL AD; dipirona 1 g EV diluída em 10 mL AD; enoxaparina 40 mg SC 22:00; ATB sepse = ceftriaxona 2 g EV em 100 mL SF correr 30 min com culturas ANTES.
- Em `PrescricaoPage.tsx`, quando `items.length === 0`, o estado vazio renderiza grid 1/2/4 colunas dos templates da categoria `admissao` aplicáveis em 1 clique via `applyQuickTemplate`.
- Link "Ver todos os templates" abre o `quickTemplatesDialogOpen` para pesquisa completa.
