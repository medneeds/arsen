---
name: Prescription Assistant Suggestion Pattern
description: Padrão "Prescrição sugerida" do assistente — 2-3 opções com embasamento e fonte
type: feature
---
Padrão de UX dos assistentes de prescrição (Reposição, Hidratação, Nutrição):
- Rótulo SEMPRE: "Prescrição sugerida" (nunca "Receita sugerida").
- Cada cenário oferece 2 a 3 opções selecionáveis (radio cards), pré-selecionada a primeira.
- Cada opção tem: title, rationale (1 linha clínica), source (UpToDate/AMIB/ACLS/KDIGO/etc), items[].
- Sem alucinação — basear em práticas amplamente aceitas (UpToDate, Surviving Sepsis 2021, AMIB, KDIGO, AHA/ACLS, Endocrine Society, ASPEN).
- Ao confirmar, somente os items da opção selecionada vão para a prescrição.
- Implementação de referência: `src/components/ReplacementWizard.tsx` (função buildSuggestions).
- Aplicar este mesmo padrão a HydrationWizard, NutritionWizard e futuros wizards.
