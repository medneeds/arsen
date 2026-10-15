# Estratégia de execução — Assistente inteligente de Insulinoterapia

> Objetivo: o ícone do assistente, no contexto de insulina, abre o **fluxo de esquemas de
> insulinoterapia** (Basal-Bolus, Resgate, NPH fixa, EV contínua e **GIK**), e **não** o
> assistente de diluição e infusão. A medicação continua entrando direto como item; o esquema
> é o assistente. Texto para o desenvolvedor implementar.

## 1. Diagnóstico (estado atual do código)

O motor e o pop-up de insulinoterapia **já existem e são completos** — o que falta é o ponto de
entrada certo. Nada precisa ser reconstruído do zero.

**Motor — `src/lib/insulinTherapy.ts`** (pronto):
- 4 esquemas: `basal_bolus`, `sliding` (resgate), `nph_fixed`, `iv_continuous` (DKA/HHS/UTI/pós-op).
- Helpers já prontos: `isInsulinMedication(name)`, `detectInsulinKind(name)`, `computeBasalBolus`,
  `computeNphFixed`, `suggestIvProtocol`, `suggestSlidingByWeight`, `describeInsulinPlan` (fonte
  única de renderização para card e impresso).
- **Não tem GIK** (glicoinsulinoterapia / solução polarizante) — é a lacuna a adicionar.

**Pop-up — `src/components/prescription/InsulinTherapyDialog.tsx`** (pronto):
- Wizard de 3 passos (Esquema → Parâmetros → Revisão). O seletor de esquema é dirigido pelo array
  `SCHEME_OPTIONS` (linha ~44). Props: `open`, `onOpenChange`, `medicationName`, `initialWeightKg`,
  `existingPlan`, `onConfirm(plan)`.

**Ligação — `src/pages/PrescricaoPage.tsx`** (parcial):
- Estado: `insulinDialogOpen`, `pendingInsulinMed`, `editingInsulinItemId` (~4966).
- Dialog renderizado (~11147). `onConfirm` cria/atualiza o item com `insulinPlan` e, no caminho de
  item novo, renomeia para `Insulinoterapia — {headline}` (~11181).
- `onEditInsulin(id)` (~9725) abre o dialog em modo edição para um item que **já tem** `insulinPlan`.
- O bloco estruturado + botão "editar esquema" só aparece quando o item tem `insulinPlan` (~2575).
- **Onde está a divergência:**
  - Ao adicionar insulina, `addItem` (~6598) a trata como **item padrão** e **não** abre mais o
    assistente de insulinoterapia (comentário explícito nas linhas 6598-6602 — o branch que abria
    o dialog foi removido).
  - O único assistente alcançável para a categoria de insulina (`medication`/`high_alert`) é o da
    **barra de busca** (~9602-9622), rotulado "Assistente de diluição e infusão", que abre o
    `ItemAssistantWizard`. É esse que o usuário vê no lugar do fluxo de esquemas.
  - O menu por item "Configurar com assistente" (`onAssistant`) só é exibido para
    `replacement/hydration/nutrition` (~2235) — não cobre insulina.

Resumo: o fluxo de esquemas existe e funciona, mas **não há porta de entrada** para ele a partir de
um item de insulina sem plano. A porta que existe é a de diluição/infusão.

## 2. Comportamento-alvo

1. Adicionar insulina continua inserindo o item direto (sem forçar pop-up). **Mantido.**
2. No item de insulina, o **ícone do assistente** abre o `InsulinTherapyDialog` (esquemas), não o
   `ItemAssistantWizard` (diluição/infusão).
3. Os esquemas disponíveis no assistente: **Basal-Bolus, Resgate (sliding), NPH fixa, EV contínua e
   GIK (glicoinsulinoterapia)**.
4. Itens **não-insulina** da mesma categoria (eletrólitos, ATB, aminas) mantêm o assistente de
   diluição e infusão — a troca é **só para insulina**, detectada por `isInsulinMedication(item.name)`.

## 3. Mudanças (por arquivo)

### 3.1 Porta de entrada do assistente de insulinoterapia — `PrescricaoPage.tsx`

Detecção por item com o helper já existente: `import { isInsulinMedication } from "@/lib/insulinTherapy"`.

- **Menu do item (`ItemActions`, ~2234):** quando `isInsulinMedication(item.name)`, exibir a entrada
  **"Configurar insulinoterapia (assistente)"** → chama `onEditInsulin(item.id)`. Vale para item
  com ou sem `insulinPlan` (o dialog abre vazio quando não há plano — `existingPlan` fica `undefined`
  em ~11155, o que já funciona).
- **Barra de busca (~9602-9622):** manter o `ItemAssistantWizard` para a categoria em geral, mas,
  para insulina, a entrada natural é por item (acima). Opcional: se o usuário clicar no assistente da
  categoria e os itens-alvo forem insulina, rotear para o `InsulinTherapyDialog` do item (mesma regra
  `isInsulinMedication`). Decisão de UX do Artur.
- **Caminho de edição `onConfirm` (~11171):** hoje o branch de edição só grava `insulinPlan` e **não**
  renomeia o item. Definir com o Artur se, ao configurar o esquema num item de insulina recém-adicionado,
  o nome deve virar `Insulinoterapia — {headline}` (como no caminho de item novo, ~11181) ou preservar
  o nome do medicamento com o bloco do esquema abaixo. Recomendado: preservar o nome e mostrar o bloco.

> Observação: **remover** o assistente de diluição/infusão para insulina significa apenas **não
> roteá-lo** para itens `isInsulinMedication` — nunca removê-lo da categoria inteira, senão
> eletrólitos/ATB/aminas perdem o assistente.

### 3.2 Adicionar o esquema GIK (glicoinsulinoterapia) — task #25

GIK = solução polarizante (glicose + insulina regular + potássio). Entra como 5º esquema.

- **`src/lib/insulinTherapy.ts`:**
  - `InsulinScheme`: adicionar `'gik'`.
  - Novos campos em `InsulinPlan` (bloco `===== gik =====`): ex. `gikGlucosePercent` (SG 5%/10%),
    `gikVolumeML`, `gikRegularUnits`, `gikKClMeq`, `gikInfusionTime`/`gikRate`, `gikIndication`
    (ex.: hipercalemia, suporte metabólico), e reaproveitar `notes`/`hypoglycemiaProtocol`.
  - Função `suggestGik(...)` com um preset padrão editável (ex.: SG 10% 500 mL + 10 UI Regular +
    conduta de K conforme indicação) — **todos os valores editáveis pelo prescritor**, como nos
    demais esquemas.
  - `describeInsulinPlan`: novo `case 'gik'` montando headline + linhas para card e impresso (fonte
    única — cobre todas as superfícies de uma vez).
- **`InsulinTherapyDialog.tsx`:**
  - `SCHEME_OPTIONS` (~44): adicionar `{ value: 'gik', label: 'GLICOINSULINOTERAPIA (GIK)', desc: '...', icon: ... }`.
  - Passo 2 (Parâmetros): sub-formulário do GIK (glicose %, volume, UI regular, KCl, tempo/vazão,
    indicação). Passo 3 (Revisão): usar `describeInsulinPlan`.

## 4. Riscos, acoplamentos e validação

- **Risco clínico (alto para o GIK):** dose/diluição/via de solução polarizante. Exige simulação de
  casos de borda (hipercalemia x suporte; SG 5% x 10%; K presente x ausente) **antes de qualquer push**,
  e validação visual do Artur no pop-up e no impresso.
- **Risco baixo** na troca da porta de entrada (3.1): é roteamento de UI; o motor e o dialog já estão
  validados em uso.
- **Acoplamentos:**
  - `describeInsulinPlan` é fonte única (card ~2575, impresso ~12099, painel). O `case 'gik'` cobre
    as três superfícies — não duplicar lógica fora dele.
  - Dedup do item genérico "Esquema de correção de insulina (Regular SC)" (`stripGenericScheme`,
    ~11158) e o pop-up de controle glicêmico (`insulinSchemePromptOpen`): manter coerentes ao
    introduzir o novo caminho.
  - Insulina é MAV/alta vigilância — o toast de MAV ao adicionar segue valendo; não conflita.
- **Bateria obrigatória antes do commit** (CLAUDE.md): `tsc --noEmit -p tsconfig.app.json`,
  `vite build`, testes relevantes, `eslint` nos arquivos alterados — comparar contra o baseline.
- **Só o Artur valida** (visual): o seletor de esquemas, o sub-form do GIK, o bloco no card e o
  impresso em `dev`/produção.

## 5. Ordem sugerida de execução

1. Porta de entrada (3.1) — habilita o fluxo de esquemas já existente no ícone do assistente de
   insulina. Entrega rápida, risco baixo, resolve o relato principal.
2. GIK (3.2) — adiciona o 5º esquema. Fazer com simulação de casos de borda e validação do Artur.

Dividir as duas frentes por arquivo (CLAUDE.md, arquivos de alta colisão): a 3.1 vive em
`PrescricaoPage.tsx`; a 3.2 começa em `insulinTherapy.ts` + `InsulinTherapyDialog.tsx`. Evitar que
duas sessões mexam em `PrescricaoPage.tsx` ao mesmo tempo.
