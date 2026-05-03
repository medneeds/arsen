## Objetivo
Tornar o assistente de nutrição mais acessível e clinicamente fiel à realidade do Socorrão I, permitindo dietas mistas, sistema enteral aberto/fechado, prescrição de água enteral e ajustes manuais.

## 1. Atalho do chip "Nutrição" (topo da prescrição)
`src/pages/PrescricaoPage.tsx` (linhas 3856-3880, chips "Ir para")

- Manter o comportamento atual de scroll para a categoria.
- Quando o chip clicado for `nutrition`, **também** abrir o `NutritionWizard` (`setNutritionWizardOpen(true)`) imediatamente após o scroll.
- Adicionar `title`/tooltip "Abrir assistente de nutrição" no chip de nutrição para deixar a ação clara.
- Os demais chips (hidratação, medicação etc.) continuam só navegando.

## 2. NutritionWizard — dieta mista (multi-modalidade)
`src/components/NutritionWizard.tsx`

- Trocar `modality: NutritionModality` por `modalities: Set<NutritionModality>` (multi-seleção). O Step 0 passa a permitir marcar 1+ cards.
- Step 1 ("Detalhes") renderiza os blocos das modalidades selecionadas em sequência, cada um dentro de um card colapsável com o título da modalidade.
- Step 3 (revisão) lista as entradas geradas por todas as modalidades, agrupadas por seção.
- `buildEntries()` itera sobre o `Set` e concatena as entradas (NPO + oral + enteral + parenteral conforme marcado).
- Adicionar, abaixo do Step 0, um aviso curto: "Dieta mista permitida — selecione mais de uma modalidade quando aplicável (ex.: oral em progressão + enteral)".
- Botão extra na revisão: **"Adicionar outra modalidade"** que volta ao Step 0 mantendo as modalidades já configuradas (permite empilhar).

## 3. Sistema enteral aberto vs. fechado
Bloco enteral do Step 1:

- Novo seletor `entSystem`: `aberto` | `fechado`, dois cards no topo do bloco enteral.
  - **Aberto**: descrição "Frasco/copo dosador, troca a cada 4h. Maior flexibilidade gravitacional/intermitente."
  - **Fechado**: descrição "Bolsa pré-pronta, pendura até 24h. Indicado para BIC contínua."
- Ao trocar o sistema, **sugerir** automaticamente o modo de infusão (aberto → `intermitente`/`bolus`; fechado → `continua`), sem travar — médico pode sobrescrever.
- A label da prescrição passa a incluir o sistema: `"Dieta enteral [aberto|fechado] — <fórmula> via <via>"`.
- Instruções automáticas adicionais:
  - Aberto: "Trocar equipo e frasco a cada 4h; lavar utensílios entre tomadas."
  - Fechado: "Bolsa pendura até 24h; programar BIC; trocar equipo conforme rotina (24-72h)."

## 4. Água enteral prescritível
Bloco enteral do Step 1:

- Substituir o checkbox simples de "flush" por uma sub-seção **"Água via sonda"** com 3 modos:
  - **Flush de manutenção** (atual: 30 mL antes/após dieta e medicação).
  - **Hidratação enteral programada**: campos `Volume por tomada (mL)` + `Frequência` (2/2h, 4/4h, 6/6h, 8/8h) — gera entrada própria "Água via sonda" com posologia escolhida.
  - **Esquema para distúrbio hidroeletrolítico**: campo livre `Volume total/dia (mL)` + observações; gera entrada com instrução "Correção de distúrbio hidroeletrolítico — ofertar conforme balanço hídrico e Na sérico".
- As três opções podem ser combinadas; cada uma vira uma `MedicationEntry` separada (categoria `nutrition`).

## 5. Campo personalizável (ajustes manuais)
Em **cada** bloco de modalidade (oral, enteral, parenteral, zero) do Step 1:

- Adicionar um `Textarea` "Ajustes manuais / observações específicas desta dieta" no final do bloco.
- O conteúdo entra na coluna `instructions` da entrada gerada **daquela modalidade** (concatenado com as instruções automáticas, prefixado por "Personalização: ").
- Já existe um `notes` global no Step 2 — manter como está; os campos novos são por modalidade, com escopo localizado.

## 6. Visual do Step 0 (cards de modalidade)
- Como agora é multi-seleção, mudar visual: cards com checkbox no canto superior direito; selecionados ganham ring esmeralda + check; deselecionar com clique novamente.
- Botão "Avançar" só habilita com pelo menos 1 selecionado.

## Detalhes técnicos

```ts
// NutritionWizard.tsx
const [modalities, setModalities] = useState<Set<NutritionModality>>(new Set(["oral"]));
const [entSystem, setEntSystem] = useState<"aberto" | "fechado">("fechado");

// Água enteral
const [waterFlush, setWaterFlush] = useState(true);
const [waterScheduled, setWaterScheduled] = useState(false);
const [waterVol, setWaterVol] = useState("100");
const [waterFreq, setWaterFreq] = useState("4/4h");
const [waterCorrection, setWaterCorrection] = useState(false);
const [waterCorrectionVol, setWaterCorrectionVol] = useState("");
const [waterCorrectionObs, setWaterCorrectionObs] = useState("");

// Personalização por modalidade
const [oralCustom, setOralCustom] = useState("");
const [entCustom, setEntCustom] = useState("");
const [parCustom, setParCustom] = useState("");
const [zeroCustom, setZeroCustom] = useState("");
```

`buildEntries()` passa a iterar `modalities` e usar `entSystem` na label/instruções. Sugestão automática de modo:
```ts
useEffect(() => {
  if (entSystem === "aberto" && entMode === "continua") setEntMode("intermitente");
  if (entSystem === "fechado" && entMode !== "continua") setEntMode("continua");
}, [entSystem]);
```

## Arquivos afetados
- `src/components/NutritionWizard.tsx` — refatoração do estado, Step 0 multi-select, novos campos no enteral, água enteral expandida, personalização por modalidade, revisão atualizada.
- `src/pages/PrescricaoPage.tsx` — chip "nutrition" abre o wizard além de fazer scroll.

## Não muda
- Estrutura de `MedicationEntry`, persistência, demais categorias, layout do PDF.
