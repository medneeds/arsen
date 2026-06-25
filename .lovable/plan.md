## Diagnóstico

A prescrição tem **dois itens distintos** de insulina coexistindo:

1. **Item NPH Fixa** (correto, criado via assistente de Insulinoterapia) — possui `insulinPlan.scheme = 'nph_fixed'` e imprime corretamente.
2. **Item "Esquema de correção de insulina (Regular SC conforme HGT)"** — adicionado automaticamente pelo pop-up `insulinSchemePromptOpen` (linha 10282 de `PrescricaoPage.tsx`) quando o médico inclui o cuidado de HGT. Esse item é genérico (categoria `care`), **não tem `insulinPlan`**, traz `presentation: 'Insulina Regular 100 UI/mL'` e `instructions` com a tabela de resgate. É ele que aparece no corpo do PDF como "esquema de insulina regular de resgate".

Hoje os dois fluxos são independentes: o assistente de insulinoterapia não sabe que existe um esquema genérico no `care`, e o pop-up não sabe que já existe um `insulinPlan` ativo. Resultado: duplicidade silenciosa no PDF.

## Correção proposta (escopo cirúrgico — apenas frontend, sem mexer em DB nem em print)

### 1. `PrescricaoPage.tsx` — assistente de Insulinoterapia (`onConfirm` do `InsulinTherapyDialog`, ~linha 10169)
Ao aplicar **qualquer** `InsulinPlan` (novo ou editado), remover automaticamente o item genérico de "Esquema de correção de insulina (Regular SC conforme HGT)" caso esteja ativo, com toast informando a substituição. Critério de match: `name === 'Esquema de correção de insulina (Regular SC conforme HGT)'` **e** `status === 'active'` **e** ausência de `insulinPlan`.

### 2. `PrescricaoPage.tsx` — pop-up de sugestão (`insulinSchemePromptOpen`, ~linha 4341 e 4390)
Ampliar o predicado `hasInsulinSchemeCare(items)` (e o gate de abertura) para considerar **qualquer item com `insulinPlan` ativo** como já tendo esquema de correção. Assim, se já existe NPH Fixa/Basal-Bolus/EV/Sliding via assistente, o pop-up não dispara — evitando a criação do item genérico.

### 3. `PrescricaoPage.tsx` — adição manual do genérico (`AlertDialogAction`, ~linha 10280)
Reforço defensivo: antes do `setItems(prev => [...prev, ...])`, checar também se existe item com `insulinPlan` ativo. Se sim, exibir `toast.info('Já existe esquema de insulinoterapia ativo')` e não adicionar.

### O que NÃO será tocado
- Camada de Dados / persistência (JSONB já correto).
- `insulinTherapy.ts` / `describeInsulinPlan` (lógica de render está certa).
- `printNormaZero.ts`, `PrintablePrescription`, `printExtraPrescription.ts` (impressão já reflete corretamente o que recebe).
- Nenhum item clínico existente é apagado retroativamente — a remoção só ocorre quando o médico **confirma** um plano no assistente.

## Resultado esperado
- Médico adiciona HGT → opta por incluir esquema padrão → vira item genérico (como hoje).
- Em seguida, abre o assistente e configura NPH Fixa → **o item genérico Regular sai automaticamente**, restando apenas o NPH no corpo do PDF.
- Se já existir plano ativo (NPH/Basal-Bolus/EV), o pop-up nem aparece.

Confirmar para aplicar?
