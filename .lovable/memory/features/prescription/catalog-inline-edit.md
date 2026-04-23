---
name: medication-catalog-inline-evidence-edit
description: Página /catalogo-medicamentos permite ao admin editar inline os 3 campos de evidência (standard_dilution, max_daily_dose, infusion_time) de cada apresentação; alimenta diretamente as sugestões "Padrão HMDM" da prescrição
type: feature
---
- Em `MedicationCatalogPage`, a tabela de Apresentações ganha coluna **Ações** quando `useIsAdmin()` retorna `true`. Médicos não-admin veem badge "Somente leitura".
- Edição inline de 3 campos: `standard_dilution` (Textarea), `max_daily_dose` e `infusion_time` (Input). Salvar dispara `update` em `medication_presentations` (RLS já restringe a admin).
- Atualização otimista local — não recarrega o catálogo todo. Cache do `useMedicationProtocols` persiste por sessão; ao editar, reabrir/atualizar a prescrição reflete os novos valores na próxima sessão (TODO: invalidar cache se necessário).
- O `useIsAdmin` (`src/hooks/useIsAdmin.ts`) consulta `user_roles` server-side — nunca localStorage, para evitar privilege escalation.
- Hint visual abaixo da tabela explica que os 3 campos alimentam "Padrão HMDM" no PosologySuggestionsBar.
