import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  UtensilsCrossed, Soup, Droplets, AlertTriangle, Check,
  Ban, ChevronRight, ChevronLeft, Sparkles, Activity, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MedicationEntry } from "@/data/medicationsDatabase";
import { normalizeEnteralRoute } from "@/lib/enteralRoutes";
import type { NutritionPlan, ProteinOverride, ProteinRouteKind } from "@/lib/nutritionPlan";
import { DIET_PROFILE_OPTIONS, keysToLabels } from "@/lib/dietProfiles";
import { ORAL_DIET_CONSISTENCIES } from "@/lib/oralConsistency";
import {
  WaterOfferingFields,
  DEFAULT_WATER_STATE,
  WATER_TYPES,
  WATER_ROUTES,
  buildWaterEntryName,
  buildWaterInstruction,
  computeWaterTotal24h,
  type WaterOfferingState,
} from "@/components/shared/WaterOfferingFields";

/**
 * Nutrition Wizard — Terapia Nutricional Hospitalar
 * Suporte a dieta MISTA (multi-modalidade), sistema enteral aberto/fechado,
 * água enteral programada, e personalização manual por modalidade.
 */

export type NutritionModality = "zero" | "oral" | "enteral" | "parenteral";

/**
 * Perfil do paciente — a MESMA lista usada no corpo da prescricao.
 * Antes chamava-se "Comorbidades" aqui e "Perfil" la, com vocabularios
 * diferentes: o medico preenchia a mesma informacao duas vezes e nenhuma das
 * duas chegava inteira ao item. Ver src/lib/dietProfiles.ts.
 */
const COMORBIDITIES = DIET_PROFILE_OPTIONS.map(o => ({
  key: o.key, label: o.label, hint: o.efeito,
}));
type ComorbKey = string;

/**
 * Consistencias vindas da fonte unica — a MESMA lista do corpo da prescricao.
 * Antes havia duas listas e um mapa achatando 7 opcoes em 5, o que fazia
 * "Semilíquida" virar "Pastosa" e "Líquida espessada" virar "Líquida" ao
 * chegar no item. Ver src/lib/oralConsistency.ts.
 */
const ORAL_CONSISTENCIES = ORAL_DIET_CONSISTENCIES.map(label => ({ key: label, label }));


const ENTERAL_VIAS = [
  { key: "sng", label: "SNG", desc: "Sonda nasogástrica" },
  { key: "sne", label: "SNE", desc: "Sonda nasoentérica" },
  { key: "sog", label: "SOG", desc: "Sonda orogástrica" },
  { key: "soe", label: "SOE", desc: "Sonda oroentérica" },
  { key: "gtt", label: "GTT", desc: "Gastrostomia" },
  { key: "jtt", label: "JTT", desc: "Jejunostomia" },
] as const;

// Helper de rótulo de via para defaultRoute das entries enterais
function enteralRouteLabel(via: string): string {
  if (via === "gtt") return "Gastrostomia";
  if (via === "jtt") return "Jejunostomia";
  if (via === "sog") return "Sonda orogástrica";
  return "Enteral (SNE/SNG)";
}

// ──────────────────────────────────────────────
// APORTE PROTEICO E CALÓRICO-PROTEICO
// Catálogo genérico (sem marcas) baseado em ESPEN/ASPEN/BRASPEN.
// SNO = Suplemento Nutricional Oral (líquidos prontos / pudim).
// Módulos = aditivos em pó/sachê para enriquecer dieta oral OU diluir e
// administrar pela sonda enteral.
// ──────────────────────────────────────────────
interface ProteinSupplementDef {
  key: string;
  label: string;
  group: "sno" | "modular";
  routes: ProteinRouteKind[];   // vias permitidas
  defaultDose: string;          // dose textual padrão
  defaultPosology: string;      // frequência padrão
  note: string;                 // contexto clínico
}

// Observação clínica: SNOs líquidos podem ser ofertados VO ou, quando indicado,
// administrados pela sonda enteral (após diluição/checagem de osmolaridade).
// Módulos (pó/sachê) podem ir VO, pela sonda, e alguns aminoácidos (glutamina,
// arginina) também podem ser ofertados por via parenteral em formulações específicas.
const PROTEIN_SUPPLEMENTS: ProteinSupplementDef[] = [
  // ── SNO (Suplemento Nutricional Oral / pode ir por sonda) ──
  { key: "sno_hchp",      label: "Suplemento hipercalórico-hiperproteico (HC-HP)",
    group: "sno", routes: ["oral", "enteral"],
    defaultDose: "200 mL", defaultPosology: "2x/dia entre refeições",
    note: "~300 kcal e ~18-20 g proteína por unidade. VO: gelado entre refeições. Por sonda: diluir e checar osmolaridade." },
  { key: "sno_hp",        label: "Suplemento hiperproteico concentrado",
    group: "sno", routes: ["oral", "enteral"],
    defaultDose: "200 mL", defaultPosology: "2x/dia",
    note: "Indicado quando déficit proteico é o principal alvo (sarcopenia, cicatrização, oncológico)." },
  { key: "sno_dm",        label: "Suplemento específico para diabetes",
    group: "sno", routes: ["oral", "enteral"],
    defaultDose: "200 mL", defaultPosology: "1-2x/dia",
    note: "Baixo índice glicêmico, fibras solúveis. Monitorar glicemia capilar." },
  { key: "sno_renal_nd",  label: "Suplemento para nefropata não-dialítico",
    group: "sno", routes: ["oral", "enteral"],
    defaultDose: "200 mL", defaultPosology: "1x/dia",
    note: "Densidade calórica alta, restrição de K/P/Na, proteína moderada." },
  { key: "sno_renal_d",   label: "Suplemento para nefropata em diálise",
    group: "sno", routes: ["oral", "enteral"],
    defaultDose: "200 mL", defaultPosology: "2x/dia (preferir nos dias de diálise)",
    note: "Hiperproteico, hipercalórico, com perfil de eletrólitos para HD/DP." },
  { key: "sno_imuno",     label: "Suplemento imunomodulador (oncológico/cirúrgico)",
    group: "sno", routes: ["oral", "enteral"],
    defaultDose: "200 mL", defaultPosology: "2-3x/dia por 5-7 dias pré e pós-op",
    note: "Arginina + EPA/DHA + nucleotídeos. Evitar em sepse grave." },
  { key: "sno_disfagia",  label: "Espessante alimentar (disfagia)",
    group: "sno", routes: ["oral"],
    defaultDose: "Conforme consistência (néctar/mel/pudim)", defaultPosology: "Em todos os líquidos",
    note: "Padronizar consistência conforme avaliação fonoaudiológica (IDDSI). Uso exclusivo VO." },

  // ── Módulos (pó/sachê — VO, sonda, e quando aplicável parenteral) ──
  { key: "mod_whey",      label: "Módulo de proteína do soro do leite (Whey)",
    group: "modular", routes: ["oral", "enteral"],
    defaultDose: "20 g", defaultPosology: "2x/dia",
    note: "Alta digestibilidade, rico em leucina. Diluir em 50-100 mL de água/dieta. Evitar em APLV." },
  { key: "mod_caseinato", label: "Módulo de caseinato de cálcio",
    group: "modular", routes: ["oral", "enteral"],
    defaultDose: "15 g", defaultPosology: "2x/dia",
    note: "Liberação prolongada de aminoácidos. Boa estabilidade térmica." },
  { key: "mod_proteina_isolada", label: "Módulo de proteína isolada (alta pureza)",
    group: "modular", routes: ["oral", "enteral"],
    defaultDose: "20 g", defaultPosology: "2-3x/dia",
    note: "≥ 90% de proteína por porção. Útil quando meta proteica > 1,5 g/kg/dia." },
  { key: "mod_glutamina", label: "Módulo de glutamina (L-Glutamina / Dipeptiven®)",
    group: "modular", routes: ["oral", "enteral", "parenteral"],
    defaultDose: "10 g (VO/SNE) ou 0,3-0,5 g/kg/dia (IV — dipeptídeo)", defaultPosology: "3x/dia (VO/SNE) ou infusão contínua (IV)",
    note: "Trofismo intestinal, estresse metabólico, queimados. IV apenas como dipeptídeo (Ala-Gln). Cautela em hepatopatas graves e IRA." },
  { key: "mod_leucina_hmb", label: "Módulo de leucina enriquecido com HMB",
    group: "modular", routes: ["oral", "enteral"],
    defaultDose: "1 sachê", defaultPosology: "2x/dia",
    note: "Anabólico em sarcopenia/idoso frágil/UTI. Contém ~3 g HMB e leucina." },
  { key: "mod_arginina",  label: "Módulo de arginina",
    group: "modular", routes: ["oral", "enteral", "parenteral"],
    defaultDose: "5 g (VO/SNE) ou conforme NPT", defaultPosology: "2x/dia (VO/SNE) ou na bolsa de NPT",
    note: "Cicatrização e imunomodulação. Parenteral apenas como componente da NPT. Evitar em sepse grave e instabilidade hemodinâmica." },
  { key: "mod_aa_essenciais", label: "Solução de aminoácidos essenciais (NPT)",
    group: "modular", routes: ["parenteral"],
    defaultDose: "Conforme meta proteica (g/kg/dia)", defaultPosology: "Infusão contínua na bolsa de NPT",
    note: "Componente proteico da nutrição parenteral. Ajustar conforme função renal/hepática e meta calórico-proteica." },
  { key: "mod_fibras",    label: "Módulo de fibras (FOS/prebiótico)",
    group: "modular", routes: ["oral", "enteral"],
    defaultDose: "5 g", defaultPosology: "2x/dia",
    note: "Regulação do trânsito e microbiota. Diluir bem; risco de obstrução de sonda fina." },
  { key: "mod_tcm",       label: "Módulo de TCM (triglicerídeo de cadeia média)",
    group: "modular", routes: ["oral", "enteral"],
    defaultDose: "10 mL", defaultPosology: "3x/dia",
    note: "Aumento de aporte calórico em má absorção/quilotórax. Não usar isolado em deficiência de carnitina." },
];

const ENTERAL_FORMULAS = [
  { key: "polim_padrao",  label: "Polimérica padrão",       desc: "1.0 kcal/mL — paciente estável" },
  { key: "polim_hiper",   label: "Polimérica hipercalórica",desc: "1.5 kcal/mL — restrição hídrica" },
  { key: "polim_fibras",  label: "Polimérica c/ fibras",    desc: "Trânsito intestinal" },
  { key: "oligom",        label: "Oligomérica/semi",        desc: "Má absorção, pancreatite" },
  { key: "elementar",     label: "Elementar",               desc: "Síndrome do intestino curto" },
  { key: "diabete",       label: "Específica DM",           desc: "Baixo IG, fibras solúveis" },
  { key: "renal",         label: "Específica renal",        desc: "Baixo K/P, alta densidade" },
  { key: "hepato",        label: "Específica hepatopata",   desc: "Rica em AAR, baixa AAA" },
  { key: "imuno",         label: "Imunomoduladora",         desc: "Glutamina/arginina/ômega-3" },
  { key: "pulm",          label: "Pulmonar (DPOC/SARA)",    desc: "Maior % lipídeos" },
] as const;

const ENTERAL_MODES = [
  { key: "continua",      label: "Contínua (BIC)",          desc: "24h em bomba — UTI/intolerância" },
  { key: "intermitente",  label: "Intermitente",            desc: "300-500 mL em 30-60 min, 4-6x/dia" },
  { key: "bolus",         label: "Bolus / Gravitacional",   desc: "Em 15-20 min, 4-6x/dia" },
  { key: "ciclica",       label: "Cíclica noturna",         desc: "12-16h, complementar à VO" },
] as const;

/** Vias possiveis para sonda de drenagem/descompressao. */
const DRENAGEM_VIAS = [
  { key: "sng", label: "SNG", desc: "Sonda nasogástrica" },
  { key: "sog", label: "SOG", desc: "Sonda orogástrica" },
] as const;

/** Para que a sonda foi passada. Muda o que a equipe registra. */
const DRENAGEM_FINALIDADES = [
  { key: "descompressao", label: "Descompressão gástrica", desc: "Aliviar distensão, íleo, obstrução" },
  { key: "quantificacao", label: "Quantificação de resíduo", desc: "Medir e registrar débito por turno" },
  { key: "ambas",         label: "Descompressão + quantificação", desc: "As duas finalidades" },
] as const;

/** Como a sonda fica entre as verificações. */
const DRENAGEM_POSICOES = [
  { key: "sifonagem",     label: "Aberta em sifonagem", desc: "Drenagem passiva contínua em frasco" },
  { key: "intermitente",  label: "Fechada c/ aspirações", desc: "Fechada, aspirar nos horários" },
] as const;

const ZERO_REASONS = [
  { key: "preop",      label: "Pré-operatório" },
  { key: "posop",      label: "Pós-operatório imediato" },
  { key: "abdome",     label: "Abdome agudo / íleo" },
  { key: "rnc",        label: "RNC / Glasgow ≤ 8" },
  { key: "iot",        label: "Pré-IOT / pós-IOT recente" },
  { key: "vomitos",    label: "Vômitos incoercíveis" },
  { key: "hda",        label: "HDA ativa" },
  { key: "pancreat",   label: "Pancreatite aguda grave" },
  { key: "exame",      label: "Aguardando exame" },
  { key: "outros",     label: "Outros" },
] as const;

function uid() { return crypto.randomUUID(); }

// Campos estruturados de nutrição que o wizard emite junto com cada entry.
// Sincronização wizard → item (16/07/2026): antes o wizard emitia só texto
// (defaultDose/instructions) e o item nascia com os campos estruturados
// vazios — o editor inline, o resumo compacto e os impressos (que leem os
// campos estruturados) mostravam a dieta "zerada", como se a configuração
// do assistente não persistisse.
export interface NutritionStructured {
  nutritionType?: string;
  dietType?: string;
  /** Perfil da dieta oral (livre, sem açúcar…) e sistema da enteral. */
  dietProfile?: string;
  nutConsistency?: string;
  dietInterval?: string;
  nutScheduleMode?: string;
  /** Tomadas por dia. Mesmo conceito que "etapas/dia" no corpo da prescrição. */
  nutSteps?: string;
  nutVolDay?: string;
  nutMode?: string;
  nutFraction?: string;
  infusionRate?: string;
  nutProgression?: string;
  nutBedHead?: string;
  /** Via enteral (SNE/SNG/GTT) ou acesso parenteral (central/periférico). */
  nutAccess?: string;
  nutZeroReason?: string;
  nutWaterVolPerAdmin?: string;
  nutWaterFreq?: string;
  dietProfile?: string;
  nutAccess?: string;
}

/**
 * Chaves de NutritionStructured em tempo de execucao.
 *
 * FONTE UNICA. Antes o PrescricaoPage mantinha uma copia manual desta lista
 * (NUT_STRUCT_KEYS) para decidir o que copiar do entry para o item. A copia
 * nao acompanhou o crescimento do assistente: dietProfile e nutAccess passaram
 * a ser emitidos aqui e lidos pelo corpo do item, mas nunca eram copiados —
 * o perfil da dieta oral, a via enteral e o tipo de acesso parenteral
 * desapareciam entre o assistente e o item, na tela e no impresso.
 *
 * Acrescentou um campo na interface acima? Acrescente aqui, ao lado. Sao os
 * dois unicos lugares, e ficam a cinco linhas de distancia.
 *
 * Coberto por src/tests/nutricao-campos-estruturados.test.ts, que compara esta
 * lista com o que o corpo do item consome e falha quando divergem.
 */
export const NUTRITION_STRUCTURED_KEYS = [
  "nutritionType",
  "dietType",
  "dietProfile",
  "nutConsistency",
  "dietInterval",
  "nutScheduleMode",
  "nutSteps",
  "nutVolDay",
  "nutMode",
  "nutFraction",
  "infusionRate",
  "nutProgression",
  "nutBedHead",
  "nutAccess",
  "nutZeroReason",
  "nutWaterVolPerAdmin",
  "nutWaterFreq",
] as const satisfies ReadonlyArray<keyof NutritionStructured>;
export type NutritionWizardEntry = MedicationEntry & NutritionStructured & {
  /** Configuração completa do assistente, viaja junto com a entry. */
  nutritionPlan?: NutritionPlan;
  /**
   * Orientação DERIVADA da configuração (sistema fechado, cabeceira elevada,
   * checar resíduo, comorbidades…). Campo separado de `instructions`, que
   * pertence ao médico.
   */
  guidance?: string;
};

interface NutritionWizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (entries: NutritionWizardEntry[]) => void;
  patientWeight?: string;
  /**
   * Plano ja existente na prescricao. Quando presente, o assistente abre
   * PREENCHIDO com ele — deixa de ser gerador de uso unico e vira editor.
   * Antes, ajustar a via de uma dieta ja prescrita exigia refazer o fluxo
   * inteiro do zero, e por isso ninguem reabria: editava-se campo solto no
   * item, sem o raciocinio clinico que o fluxo carrega.
   */
  initialPlan?: NutritionPlan | null;
}

export function NutritionWizard({ open, onOpenChange, onAdd, patientWeight, initialPlan }: NutritionWizardProps) {
  const [step, setStep] = useState(0);
  const [modalities, setModalities] = useState<Set<NutritionModality>>(new Set(["oral"]));
  const [comorbs, setComorbs] = useState<Set<ComorbKey>>(new Set());

  // Oral
  const [oralConsist, setOralConsist] = useState<string>("");
  // Mantido apenas para ler planos salvos antes da unificacao do Perfil: o
  // campo oral.profiles do NutritionPlan ainda existe no banco. Nao alimenta
  // mais nenhuma entry — o perfil vem de `comorbs`.
  const [oralProfiles, setOralProfiles] = useState<Set<string>>(new Set());
  const [oralFraction, setOralFraction] = useState<string>("6x/dia");
  const [oralWaterFree, setOralWaterFree] = useState(false);
  const [oralCustom, setOralCustom] = useState("");

  // Enteral
  const [entSystem, setEntSystem] = useState<"aberto" | "fechado">("fechado");
  // Sem pre-selecao nos campos clinicos da enteral: via, formula, modo e
  // esquema de progressao sao decisoes do medico. Um valor ja marcado e
  // assinado sem ninguem ter olhado -- o fluxo passa a exigir a escolha
  // explicita antes de avancar (ver pendenciasDoPasso).
  const [entVia, setEntVia] = useState<string>("");
  const [entFormula, setEntFormula] = useState<string>("");
  const [entMode, setEntMode] = useState<string>("");
  const [entRate, setEntRate] = useState<string>("25");
  const [entVolDay, setEntVolDay] = useState<string>("1500");
  const [entFractions, setEntFractions] = useState<string>("6");
  const [entProgression, setEntProgression] = useState<boolean | null>(null);
  const [entCustom, setEntCustom] = useState("");

  // Água enteral
  const [waterFlush, setWaterFlush] = useState(true);
  // Mantido so para ler planos salvos antes da unificacao: quem tinha
  // "hidratacao programada" marcada e migrado para o catalogo em applyPlan.
  const [waterScheduled, setWaterScheduled] = useState(false);
  const [waterVol, setWaterVol] = useState("100");
  const [waterFreq, setWaterFreq] = useState("4/4h");

  // Parenteral
  const [parType, setParType] = useState<"central" | "periferica">("central");
  const [parVolume, setParVolume] = useState<string>("1500");
  const [parKcal, setParKcal] = useState<string>("");
  const [parRate, setParRate] = useState<string>("");
  const [parObs, setParObs] = useState<string>("");
  const [parCustom, setParCustom] = useState("");

  // Zero
  /**
   * Sonda de drenagem — cuidado com DISPOSITIVO, independente da modalidade.
   *
   * Uma sonda naso ou orogastrica aberta em sifonagem, para descompressao e
   * quantificacao de residuo, e prescricao ATIVA: tem material, cuidado de
   * enfermagem e dado a registrar por turno. Nao e ausencia de dieta.
   *
   * Vale junto de dieta zero (o caso mais comum) e tambem junto de dieta
   * enteral — sonda de descompressao em paralelo a alimentacao por jejunostomia,
   * por exemplo em gastroparesia. Por isso fica fora do bloco de modalidade.
   */
  const [drenagemAtiva, setDrenagemAtiva] = useState(false);
  const [drenagemVia, setDrenagemVia] = useState<string>("");
  const [drenagemFinalidade, setDrenagemFinalidade] = useState<string>("");
  const [drenagemPosicao, setDrenagemPosicao] = useState<string>("");
  const [drenagemFreq, setDrenagemFreq] = useState<string>("6/6h");

  const [zeroReason, setZeroReason] = useState<string>("preop");
  const [zeroSince, setZeroSince] = useState<string>("");
  const [zeroHydrate, setZeroHydrate] = useState(true);
  const [zeroCustom, setZeroCustom] = useState("");

  // Aporte proteico (multi-select com overrides por item)
  const [proteinSelected, setProteinSelected] = useState<Set<string>>(new Set());
  const [proteinOverrides, setProteinOverrides] = useState<Record<string, ProteinOverride>>({});

  // Free notes
  const [notes, setNotes] = useState<string>("");

  // Hidratação programada — opt-in, aditiva.
  // Pode coexistir com "Água oral livre" e "Água via sonda programada"; cada
  // entrada vira uma linha extra na prescrição.
  const [waterOfferEnabled, setWaterOfferEnabled] = useState(false);
  const [waterOffer, setWaterOffer] = useState<WaterOfferingState>(DEFAULT_WATER_STATE);

  // Corrige combinacao INCOMPATIVEL entre sistema e modo, sem preencher escolha
  // vazia: antes este efeito marcava um modo sozinho quando o sistema mudava, o
  // que reintroduzia pre-selecao por outra porta. Se o modo ainda nao foi
  // escolhido, nada acontece — o medico escolhe.
  useEffect(() => {
    if (!modalities.has("enteral") || !entMode) return;
    if (entSystem === "aberto" && entMode === "continua") setEntMode("");
    if (entSystem === "fechado" && entMode !== "continua" && entMode !== "ciclica") setEntMode("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entSystem]);

  const reset = () => {
    setStep(0); setModalities(new Set(["oral"])); setComorbs(new Set());
    setOralConsist(""); setOralProfiles(new Set(["livre"])); setOralFraction("6x/dia"); setOralWaterFree(true); setOralCustom("");
    setEntSystem("fechado"); setEntVia(""); setEntFormula(""); setEntMode("");
    setEntRate("25"); setEntVolDay("1500"); setEntFractions("6"); setEntProgression(true); setEntCustom("");
    setWaterFlush(true); setWaterScheduled(false); setWaterVol("100"); setWaterFreq("4/4h");
    setParType("central"); setParVolume("1500"); setParKcal(""); setParRate(""); setParObs(""); setParCustom("");
    setDrenagemAtiva(false); setDrenagemVia(""); setDrenagemFinalidade(""); setDrenagemPosicao(""); setDrenagemFreq("6/6h");
    setZeroReason("preop"); setZeroSince(""); setZeroHydrate(true); setZeroCustom("");
    setProteinSelected(new Set()); setProteinOverrides({});
    setNotes("");
    setWaterOfferEnabled(false); setWaterOffer(DEFAULT_WATER_STATE);
  };

  const toggleProtein = (key: string) => {
    setProteinSelected(prev => {
      const n = new Set(prev);
      if (n.has(key)) {
        n.delete(key);
        setProteinOverrides(o => { const c = { ...o }; delete c[key]; return c; });
      } else {
        n.add(key);
        const def = PROTEIN_SUPPLEMENTS.find(p => p.key === key)!;
        // Default route: prioriza enteral se sonda foi selecionada e via oral não.
        const route: ProteinRouteKind = def.routes.includes("enteral") && modalities.has("enteral") && !modalities.has("oral")
          ? "enteral"
          : def.routes[0];
        setProteinOverrides(o => ({ ...o, [key]: { dose: def.defaultDose, posology: def.defaultPosology, route } }));
      }
      return n;
    });
  };

  const updateProteinOverride = (key: string, patch: Partial<ProteinOverride>) => {
    setProteinOverrides(o => ({ ...o, [key]: { ...o[key], ...patch } }));
  };

  const toggleModality = (k: NutritionModality) => {
    setModalities(prev => {
      const n = new Set(prev);
      if (n.has(k)) {
        if (n.size === 1) return n; // não permite ficar vazio
        n.delete(k);
      } else {
        // Dieta zero exclui as vias que alimentam pelo TRATO DIGESTIVO (oral e
        // enteral), mas CONVIVE com a parenteral. "Jejum por via digestiva com
        // NPT plena" e situacao corrente em pancreatite grave, ileo prolongado
        // e pos-operatorio de trato digestivo.
        //
        // Antes marcar zero apagava todas as outras, e essa combinacao era
        // impossivel de prescrever pelo fluxo — o medico tinha de montar na mao.
        if (k === "zero") {
          n.delete("oral");
          n.delete("enteral");
          n.add("zero");
        } else if (k === "parenteral") {
          n.add(k);                 // convive com zero
        } else {
          n.delete("zero");         // oral ou enteral desfazem o jejum
          n.add(k);
        }
      }
      return n;
    });
  };

  /**
   * Antes esta funcao mantinha um mapa que traduzia comorbidade -> perfil oral
   * (has -> hipossodica, celiaco -> sem_gluten…), justamente porque eram duas
   * listas para a mesma coisa. Com o Perfil unificado, a traducao deixou de
   * existir: a condicao E o perfil, e o efeito sobre a dieta vem junto dela.
   */
  const toggleComorb = (k: ComorbKey) => {
    setComorbs(prev => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  };




  const buildEntries = (): NutritionWizardEntry[] => {
    // Perfil do paciente, compartilhado por todas as modalidades.
    const perfilDoPaciente = keysToLabels(comorbs).join(", ");
    const entries: NutritionWizardEntry[] = [];
    // Tradução wizard → vocabulário do editor inline (NutritionFields)
    const ENT_MODE_LABEL: Record<string, string> = {
      continua: "Contínua BIC", ciclica: "Bomba ciclada",
      intermitente: "Gravitacional intermitente", bolus: "Bolus",
    };
    const ENT_DIETTYPE: Record<string, string> = {
      polim_padrao: "Polimérica padrão", polim_hiper: "Polimérica hipercalórica",
      polim_fibras: "Polimérica padrão", oligom: "Oligomérica", elementar: "Oligomérica",
      diabete: "Específica diabético", renal: "Específica renal",
      hepato: "Específica hepatopata", imuno: "Imunomoduladora",
    };
    // ORAL_DIETTYPE foi removido: traduzia 7 consistencias em 5 e perdia
    // justamente as duas mais especificas, que sao as que importam em disfagia.
    // dietType passa a receber o proprio rotulo escolhido.
    const comorbStr = Array.from(comorbs)
      .map(k => COMORBIDITIES.find(c => c.key === k)?.label)
      .filter(Boolean)
      .join(", ");
    const comorbSuffix = comorbStr ? ` — Comorbidades: ${comorbStr}` : "";
    /**
     * Orientação DERIVADA da configuração — sistema fechado, cabeceira elevada,
     * checagem de resíduo, comorbidades. É consequência do que foi escolhido no
     * fluxo e se atualiza quando a configuração muda.
     *
     * Vai para `guidance`, NÃO para `instructions`. Os dois textos disputavam o
     * mesmo campo, e a saída encontrada tinha sido apagar o do assistente na
     * conversão — o médico configurava e a orientação sumia do item e do
     * impresso. Separados, cada um tem dono: guidance é do sistema,
     * instructions é do médico e nunca é sobrescrito.
     */
    const buildGuidance = (parts: (string | null | undefined)[]) =>
      parts.filter(Boolean).join(" · ");

    /** Texto do MÉDICO: personalização da modalidade e observações gerais. */
    const doctorNote = (custom: string) =>
      [custom || null, notes || null].filter(Boolean).join(" · ");

    // ── Sonda de drenagem ──
    // Linha PROPRIA, fora da modalidade: e cuidado com dispositivo, nao dieta.
    // Sai do fluxo mesmo quando ha dieta enteral em curso (descompressao em
    // paralelo a alimentacao), caso em que a equipe precisa ver as duas linhas.
    if (drenagemAtiva && drenagemVia) {
      const via = DRENAGEM_VIAS.find(v => v.key === drenagemVia);
      const fin = DRENAGEM_FINALIDADES.find(f => f.key === drenagemFinalidade);
      const pos = DRENAGEM_POSICOES.find(p => p.key === drenagemPosicao);
      const quantifica = drenagemFinalidade === "quantificacao" || drenagemFinalidade === "ambas";
      entries.push({
        id: `nut-dren-${uid()}`,
        nutritionType: "care",
        name: `${via?.label} para drenagem — ${fin?.label ?? "descompressão"}`,
        presentation: via?.desc ?? "-",
        defaultDose: "-",
        defaultRoute: via?.label ?? "-",
        defaultPosology: pos?.label ?? "-",
        defaultSchedule: quantifica ? drenagemFreq : "Contínuo",
        category: "nutrition" as const,
        guidance: buildGuidance([
          pos?.desc ?? null,
          quantifica ? `Medir e registrar o débito a cada ${drenagemFreq}` : null,
          quantifica ? "Anotar volume, aspecto e presença de borra de café ou sangue" : null,
          "Confirmar posicionamento antes de cada uso e manter cabeceira elevada",
          "Comunicar o médico se o débito aumentar de forma abrupta",
        ]),
        instructions: "",
      });
    }

    if (modalities.has("zero")) {
      const reason = ZERO_REASONS.find(r => r.key === zeroReason)?.label || "";
      entries.push({
        id: `nut-zero-${uid()}`,
        nutritionType: "zero",
        nutZeroReason: [reason, zeroSince ? `desde ${zeroSince}` : null].filter(Boolean).join(" — "),
        // Com NPT associada, o rotulo precisa dizer que o jejum e da VIA
        // DIGESTIVA, nao do paciente: ele esta sendo nutrido, por outra via.
        // "Dieta zero" sozinho, ao lado de uma NPT, e leitura ambigua num
        // documento que a equipe inteira consulta.
        name: modalities.has("parenteral")
          ? "Dieta zero por via digestiva (nutrição exclusiva por NPT)"
          : "Dieta zero (NPO)",
        presentation: "-",
        defaultDose: "-",
        defaultRoute: "-",
        defaultPosology: "Contínuo",
        defaultSchedule: "-",
        guidance: buildGuidance([
          `Motivo: ${reason}`,
          zeroSince ? `Em jejum desde: ${zeroSince}` : null,
          "Reavaliar reintrodução de dieta a cada 12-24h",
          modalities.has("parenteral")
            ? "Aporte nutricional por NPT — ver linha própria"
            : null,
          comorbSuffix.trim(),
        ]),
        instructions: doctorNote(zeroCustom),
        category: "nutrition",
      });
      if (zeroHydrate) {
        entries.push({
          id: `nut-zero-hidr-${uid()}`,
          name: "Hidratação venosa de manutenção",
          presentation: "-",
          defaultDose: "30-35 mL/kg/dia",
          defaultRoute: "Intravenosa",
          defaultPosology: "Contínuo",
          defaultSchedule: "ACM",
          guidance: "Ajustar conforme balanço hídrico, função renal e cardiopatia",
          category: "hydration",
        });
      }
    }

    if (modalities.has("oral")) {
      const consist = ORAL_CONSISTENCIES.find(c => c.key === oralConsist)?.label || "";
      const isMixed = modalities.size > 1;
      entries.push({
        id: `nut-oral-${uid()}`,
        nutritionType: "diet_oral",
        dietType: oralConsist,
        nutConsistency: consist,
        dietInterval: oralFraction,
        // Perfil = condicoes do paciente, a MESMA lista do corpo da prescricao.
        // Vale para todas as modalidades, nao so a oral: antes a enteral usava
        // este campo para "Sistema fechado" e a parenteral nao mandava nada.
        dietProfile: perfilDoPaciente || undefined,
        name: isMixed ? "Dieta mista" : "Dieta via oral",
        presentation: "-",
        defaultDose: "-",
        defaultRoute: "Oral",
        defaultPosology: oralFraction,
        defaultSchedule: "07h, 10h, 12h, 15h, 18h, 21h",
        guidance: buildGuidance([
          "Ofertar conforme aceitação; observar resíduo e tolerância",
          isMixed && modalities.has("enteral") ? "Em progressão de dieta oral — acompanhar com fonoterapia/nutrição" : null,
          comorbSuffix.trim(),
        ]),
        instructions: doctorNote(oralCustom),
        category: "nutrition",
      });
      if (oralWaterFree) {
        entries.push({
          id: `nut-oral-h2o-${uid()}`,
        nutritionType: "water",
          name: "Água oral livre",
          presentation: "-",
          defaultDose: "-",
          defaultRoute: "Oral",
          defaultPosology: "Livre demanda",
          defaultSchedule: "ACM",
          guidance: comorbs.has("ic") ? "Atenção: restrição hídrica em cardiopata — limitar a 1000-1500 mL/dia" : "Estimular ingesta hídrica",
          category: "nutrition",
        });
      }
    }

    if (modalities.has("enteral")) {
      const via = ENTERAL_VIAS.find(v => v.key === entVia)?.label || "";
      const formula = ENTERAL_FORMULAS.find(f => f.key === entFormula)?.label || "";
      const mode = ENTERAL_MODES.find(m => m.key === entMode)?.label || "";
      const dose = entMode === "continua"
        ? `${entRate} mL/h (${entVolDay} mL/dia)`
        : `${entVolDay} mL/dia em ${entFractions} tomadas`;
      const isMixed = modalities.size > 1;
      const sysLabel = entSystem === "aberto" ? "Sistema aberto" : "Sistema fechado";
      entries.push({
        id: `nut-ent-${uid()}`,
        nutritionType: "diet_enteral",
        dietType: ENT_DIETTYPE[entFormula],
        nutVolDay: entVolDay,
        nutMode: ENT_MODE_LABEL[entMode],
        infusionRate: entMode === "continua" ? entRate : undefined,
        // SINCRONIA COM O CORPO DA PRESCRICAO.
        //
        // O editor tem um alternador Intervalo x Etapas: em "Intervalo" ele le
        // dietInterval, em "Etapas" le nutSteps. O assistente gravava sempre
        // nutScheduleMode: "interval" e punha as tomadas em nutFraction — que
        // NENHUM dos dois modos le. As tomadas configuradas no fluxo nunca
        // apareciam no item.
        //
        // "Tomadas por dia" e o mesmo conceito que "etapas/dia" do editor
        // (DIET_STEPS e a lista 1..8). Entao: modo continuo grava intervalo;
        // modo em tomadas grava ETAPAS, que e onde o editor vai buscar.
        nutScheduleMode: entMode === "continua" ? "interval" : "steps",
        dietInterval: entMode === "continua" ? "Contínua" : undefined,
        nutSteps: entMode !== "continua" ? String(entFractions) : undefined,
        // Mantido para o impresso e para a frase de detalhe, que leem este campo.
        nutFraction: entMode !== "continua" ? `${entFractions}x` : undefined,
        nutProgression: entProgression ? "Iniciar 20 mL/h; progredir +20 mL/h a cada 6-8h conforme tolerância" : undefined,
        nutBedHead: "30-45",
        nutAccess: via || undefined,
        // O sistema (aberto/fechado) saiu daqui: dietProfile passou a significar
        // o perfil do paciente, igual ao corpo da prescricao. O sistema segue
        // aparecendo na orientacao, onde ja estava.
        dietProfile: perfilDoPaciente || undefined,
        name: isMixed ? "Dieta mista" : "Dieta enteral",
        presentation: "-",
        defaultDose: dose,
        // Sigla canonica: e o que o seletor do editor espera. Antes saia
        // "Enteral (SNE/SNG)", que nao existia na lista do editor — a via
        // escolhida aqui chegava ao item e o campo abria vazio.
        defaultRoute: normalizeEnteralRoute(via) || via,
        defaultPosology: mode,
        defaultSchedule: entMode === "continua" ? "Contínua 24h" : "06h, 10h, 14h, 18h, 22h, 02h",
        guidance: buildGuidance([
          entSystem === "aberto"
            ? "Sistema aberto: trocar equipo e frasco a cada 4h; lavar utensílios entre tomadas; manipulação asséptica"
            : "Sistema fechado: bolsa pré-pronta pendura até 24h; programar BIC; trocar equipo conforme rotina (24-72h)",
          entProgression ? "Iniciar com 20 mL/h; progredir 20 mL/h a cada 6-8h conforme tolerância (resíduo, distensão, diarreia)" : null,
          "Cabeceira elevada a 30-45° durante e até 1h após a infusão",
          "Avaliar resíduo gástrico a cada 6h (suspender se > 250 mL)",
          comorbs.has("uti") ? "Meta: 25-30 kcal/kg/dia + 1,2-2 g/kg/dia de proteína" : null,
          comorbSuffix.trim(),
        ]),
        instructions: doctorNote(entCustom),
        category: "nutrition",
      });
      // Água via sonda — flush
      if (waterFlush) {
        entries.push({
          id: `nut-ent-flush-${uid()}`,
        nutritionType: "water",
          nutWaterVolPerAdmin: "30",
          name: "Água via sonda — flush de manutenção",
          presentation: "-",
          defaultDose: "30 mL",
          // Sigla canonica: e o que o seletor do editor espera. Antes saia
        // "Enteral (SNE/SNG)", que nao existia na lista do editor — a via
        // escolhida aqui chegava ao item e o campo abria vazio.
        defaultRoute: normalizeEnteralRoute(via) || via,
          defaultPosology: "Antes/após dieta e medicações",
          defaultSchedule: "ACM",
          guidance: "Manter pérvia a sonda; usar água potável/filtrada à temperatura ambiente",
          category: "nutrition",
        });
      }
      // A "hidratacao enteral programada" foi UNIFICADA com a oferta hidrica
      // ampliada (catalogo de aguas). Eram a mesma prescricao escrita duas
      // vezes: o catalogo ja tem volume, frequencia e via, e ainda tipo de agua
      // e temperatura. Marcar as duas gerava DUAS linhas de hidratacao para o
      // mesmo paciente. Ver o bloco do catalogo mais abaixo.
      // Correção de DHE
      // "Correcao de disturbio hidroeletrolitico" foi removida do assistente:
      // e esquema terapeutico de eletrolitos, nao hidratacao de rotina, e
      // pertence a prescricao de eletrolitos. Manter aqui dava a entender que
      // agua corrige hiponatremia.
    }

    if (modalities.has("parenteral")) {
      const isMixed = modalities.size > 1;
      entries.push({
        id: `nut-par-${uid()}`,
        nutritionType: "diet_parenteral",
        nutVolDay: parVolume,
        infusionRate: parRate || undefined,
        // Tipo de acesso agora em nutAccess para sair na frase de detalhe
        // (saiu do nome na Opção B — 07/08/2026).
        nutAccess: parType === "central" ? "Central (PICC/CVC)" : "Periférico",
        name: isMixed ? "Dieta mista" : "NPT",
        presentation: "Bolsa NPT",
        defaultDose: `${parVolume} mL${parKcal ? ` (${parKcal} kcal)` : ""}`,
        defaultRoute: "Intravenosa",
        defaultPosology: "Contínuo",
        defaultSchedule: "Infusão contínua 24h",
        guidance: buildGuidance([
          parType === "central" ? "Acesso venoso central exclusivo (PICC/CVC) — não infundir junto com medicações" : "Acesso periférico — osmolaridade ≤ 900 mOsm/L",
          parRate ? `Vazão: ${parRate} mL/h (BIC)` : "Programar BIC",
          "Monitorar glicemia 6/6h, ionograma diário, função hepática 2x/sem",
          "Trocar bolsa a cada 24h; não exceder 24h após manipulação",
          parObs,
          isMixed && modalities.has("enteral") ? "NPT complementar à enteral — ajustar oferta calórica conforme aceitação enteral" : null,
          comorbSuffix.trim(),
        ]),
        instructions: doctorNote(parCustom),
        category: "nutrition",
      });
    }

    // ── APORTE PROTEICO / SUPLEMENTAÇÃO ──
    // Cada produto selecionado vira uma linha independente na prescrição.
    const enteralViaLabel = ENTERAL_VIAS.find(v => v.key === entVia)?.label || "";
    const enteralRoute = enteralRouteLabel(enteralViaLabel);
    Array.from(proteinSelected).forEach(key => {
      const def = PROTEIN_SUPPLEMENTS.find(p => p.key === key);
      if (!def) return;
      const ov = proteinOverrides[key] || { dose: def.defaultDose, posology: def.defaultPosology, route: def.routes[0] };
      const route = ov.route === "enteral" ? enteralRoute : "Oral";
      const viaLabel = ov.route === "enteral" ? `via ${enteralViaLabel || "sonda"}` : "VO";
      entries.push({
        id: `nut-prot-${key}-${uid()}`,
        nutritionType: "supplement",
        name: `${def.label} — ${viaLabel}`,
        presentation: def.group === "sno" ? "Frasco/sachê pronto" : "Pó / sachê modular",
        defaultDose: ov.dose,
        defaultRoute: route,
        defaultPosology: ov.posology,
        defaultSchedule: ov.route === "enteral" ? "Conforme aprazamento" : "10h, 16h, 22h",
        guidance: [
          def.note,
          ov.route === "enteral"
            ? "Diluir em 50-100 mL de água potável; lavar a sonda com 20-30 mL antes e após a administração."
            : "Ofertar em temperatura agradável; estimular ingesta entre as refeições.",
          comorbSuffix.trim(),
        ].filter(Boolean).join(" · "),
        category: "nutrition",
      });
    });

    // ── OFERTA HÍDRICA AMPLIADA (catálogo de águas) ──
    if (waterOfferEnabled) {
      const routeLabel = WATER_ROUTES.find(r => r.key === waterOffer.route)?.label || "VO";
      // Meta/24h do item le nutVolDay. O total ja era calculado e exibido na
      // revisao ("Total estimado 1000mL/24h"), mas nao seguia na entry: o campo
      // chegava vazio ao item e o editor mostrava so o placeholder.
      const totalDia = computeWaterTotal24h(waterOffer);
      const isEnteralRoute = ["sng", "sne", "sog", "gtt", "jtt"].includes(waterOffer.route);
      entries.push({
        id: `nut-water-offer-${uid()}`,
        nutritionType: "water",
        // Sem unidade: o campo guarda o NUMERO. O editor inline usa
        // NutSuffixInput com suffix="mL" e buildNutritionParts concatena " mL".
        // Com "250 mL" aqui, a unidade saía duplicada ("250 mL mL") e o campo
        // numerico do editor nao aceitava o valor.
        nutWaterVolPerAdmin: `${waterOffer.volumePerOffering}`,
        nutWaterFreq: waterOffer.fraction,
        ...(totalDia !== null ? { nutVolDay: `${totalDia}` } : {}),
        nutAccess: routeLabel,
        name: buildWaterEntryName(waterOffer),
        presentation: WATER_TYPES.find(t => t.key === waterOffer.type)?.label || "Água",
        defaultDose: `${waterOffer.volumePerOffering} mL/oferta`,
        defaultRoute: routeLabel,
        defaultPosology: waterOffer.fraction,
        defaultSchedule: "Conforme aprazamento",
        guidance: [
          buildWaterInstruction(waterOffer),
          isEnteralRoute ? "Lavar a sonda com 20-30 mL antes e após a oferta" : null,
          waterOffer.type === "destilada" ? "Água destilada — uso APENAS para manutenção de pérvio (não ingerir)" : null,
        ].filter(Boolean).join(" · "),
        category: "nutrition",
      });
    }

    return entries;
  };

  const entries = useMemo(buildEntries, [
    modalities, comorbs,
    oralConsist, oralProfiles, oralFraction, oralWaterFree, oralCustom,
    entSystem, entVia, entFormula, entMode, entRate, entVolDay, entFractions, entProgression, entCustom,
    waterFlush, waterScheduled, waterVol, waterFreq,
    parType, parVolume, parKcal, parRate, parObs, parCustom,
    zeroReason, zeroSince, zeroHydrate, zeroCustom,
    proteinSelected, proteinOverrides,
    notes,
    waterOfferEnabled, waterOffer,
  ]);

  /** Estado atual do assistente como plano persistivel. */
  const buildPlan = (): NutritionPlan => ({
    v: 1,
    modalities: [...modalities],
    comorbs: [...comorbs],
    oral: {
      consistency: oralConsist, profiles: [...oralProfiles], fraction: oralFraction,
      waterFree: oralWaterFree, custom: oralCustom,
    },
    enteral: {
      system: entSystem, via: entVia, formula: entFormula, mode: entMode,
      rate: entRate, volDay: entVolDay, fractions: entFractions,
      progression: entProgression, custom: entCustom,
    },
    water: {
      flush: waterFlush, scheduled: waterScheduled, vol: waterVol, freq: waterFreq,
      // Campos mantidos no plano so para ler configuracoes salvas antes da
      // remocao da "correcao de disturbio" do assistente.
      correction: false, correctionVol: "", correctionObs: "",
    },
    waterOffer: { enabled: waterOfferEnabled, state: waterOffer },
    parenteral: {
      type: parType, volume: parVolume, kcal: parKcal, rate: parRate,
      obs: parObs, custom: parCustom,
    },
    zero: { reason: zeroReason, since: zeroSince, hydrate: zeroHydrate, custom: zeroCustom },
    protein: { selected: [...proteinSelected], overrides: proteinOverrides },
    notes,
  });

  /** Aplica um plano salvo ao estado — o caminho inverso de buildPlan. */
  const applyPlan = (p: NutritionPlan) => {
    setModalities(new Set(p.modalities));
    setComorbs(new Set(p.comorbs as ComorbKey[]));
    setOralConsist(p.oral.consistency);
    setOralProfiles(new Set(p.oral.profiles));
    setOralFraction(p.oral.fraction);
    setOralWaterFree(p.oral.waterFree);
    setOralCustom(p.oral.custom);
    setEntSystem(p.enteral.system);
    setEntVia(p.enteral.via);
    setEntFormula(p.enteral.formula);
    setEntMode(p.enteral.mode);
    setEntRate(p.enteral.rate);
    setEntVolDay(p.enteral.volDay);
    setEntFractions(p.enteral.fractions);
    setEntProgression(p.enteral.progression);
    setEntCustom(p.enteral.custom);
    setWaterFlush(p.water.flush);
    setWaterScheduled(false);
    // Plano antigo com hidratacao programada: migra para o catalogo, que e
    // agora o unico caminho. Sem isto, reabrir uma dieta antiga perderia a
    // hidratacao silenciosamente.
    if (p.water.scheduled && !p.waterOffer.enabled) {
      setWaterOfferEnabled(true);
      setWaterOffer(o => ({
        ...o,
        volumePerOffering: p.water.vol || o.volumePerOffering,
        fraction: p.water.freq || o.fraction,
      }));
    }
    setWaterVol(p.water.vol);
    setWaterFreq(p.water.freq);
    setWaterOfferEnabled(p.waterOffer.enabled);
    setWaterOffer(p.waterOffer.state);
    setParType(p.parenteral.type);
    setParVolume(p.parenteral.volume);
    setParKcal(p.parenteral.kcal);
    setParRate(p.parenteral.rate);
    setParObs(p.parenteral.obs);
    setParCustom(p.parenteral.custom);
    setZeroReason(p.zero.reason);
    setZeroSince(p.zero.since);
    setZeroHydrate(p.zero.hydrate);
    setZeroCustom(p.zero.custom);
    setProteinSelected(new Set(p.protein.selected));
    setProteinOverrides(p.protein.overrides);
    setNotes(p.notes);
  };

  // Hidrata ao abrir sobre uma prescricao que ja tem plano. So no ABRIR: durante
  // a edicao o estado local manda, senao cada tecla seria sobrescrita.
  useEffect(() => {
    if (open && initialPlan) applyPlan(initialPlan);
  }, [open, initialPlan]);

  const handleConfirm = () => {
    // O plano vai junto de CADA entry: o item passa a carregar a configuracao
    // inteira, e nao uma projecao achatada dela. Persiste sozinho — items e
    // JSONB no banco.
    const plan = buildPlan();
    // Cada entry ja traz guidance (orientacao derivada, do sistema) e
    // instructions (nota do medico) separados na origem — ver buildGuidance e
    // doctorNote. Nao se remapeia nada aqui: fazer isso sobrescreveria a nota
    // do medico com a orientacao do sistema.
    onAdd(entries.map(e => ({ ...e, nutritionPlan: plan })));
    reset();
    onOpenChange(false);
  };

  const STEPS = ["Modalidades", "Detalhes", "Água", "Perfil", "Aporte proteico", "Revisão"];
  /**
   * O que falta preencher no passo atual.
   *
   * O fluxo deixava avancar com campos clinicos vazios e, como havia
   * pre-selecao, o medico assinava valores que nunca conferiu. Agora nada vem
   * marcado e o avanco fica travado ate a escolha existir — com a lista do que
   * falta visivel no topo, para ele nao precisar cacar o campo pendente.
   */
  const pendenciasDoPasso = (() => {
    const faltam: string[] = [];
    if (step === 0 && modalities.size === 0) faltam.push("escolha ao menos uma modalidade");
    if (step === 1) {
      if (modalities.has("enteral")) {
        if (!entVia) faltam.push("via de acesso");
        if (!entFormula) faltam.push("tipo de fórmula");
        if (!entMode) faltam.push("modo de infusão");
        if (!entVolDay.trim()) faltam.push("volume total/dia");
        if (entMode === "continua" ? !entRate.trim() : !entFractions.trim()) {
          faltam.push(entMode === "continua" ? "vazão" : "tomadas/dia");
        }
      }
      if (modalities.has("parenteral") && !parVolume.trim()) faltam.push("volume da NPT");
    }
    return faltam;
  })();
  const canAdvance = pendenciasDoPasso.length === 0;

  const MODALITY_OPTIONS = [
    { k: "zero" as const,       icon: Ban,             label: "Dieta zero",       desc: "Jejum / NPO com motivo (exclusiva)" },
    { k: "oral" as const,       icon: UtensilsCrossed, label: "Via oral",         desc: "Consistência + perfil" },
    { k: "enteral" as const,    icon: Soup,            label: "Enteral",          desc: "Sonda — sistema + fórmula + infusão" },
    { k: "parenteral" as const, icon: Droplets,        label: "Parenteral (NPT)", desc: "Central ou periférica" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[min(64rem,calc(100vw-2rem))] h-[calc(100svh-8rem)] max-h-[calc(100svh-8rem)] top-4 translate-y-0 sm:top-4 z-[80] overflow-hidden flex flex-col p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-released" />
            Assistente de Terapia Nutricional
          </DialogTitle>
          <DialogDescription className="text-xs">
            Fluxo guiado com suporte a dieta mista, sistema enteral aberto/fechado e personalização por modalidade.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 px-1 py-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex items-center gap-1">
              <div className={cn(
                "flex items-center gap-2 text-xs px-2 py-1 rounded-md font-medium transition-all whitespace-nowrap",
                i === step ? "bg-released/15 text-released-on-soft" :
                i < step ? "text-muted-foreground" : "text-muted-foreground/50"
              )}>
                <span className={cn(
                  "inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-semibold",
                  i === step ? "bg-released text-white" :
                  i < step ? "bg-released/30 text-released-on-soft" : "bg-muted text-muted-foreground"
                )}>
                  {i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}
                </span>
                {s}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
            </div>
          ))}
        </div>

        {/* Pendencias do passo, logo abaixo da trilha: o medico ve o que falta
            sem precisar procurar o campo vazio no meio do formulario. */}
        {pendenciasDoPasso.length > 0 && (
          <div className="mx-1 mb-2 flex items-start gap-2 rounded-md border border-warning-border bg-warning-soft px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" aria-hidden />
            <p className="text-xs text-warning-on-soft">
              <span className="font-medium">Para avançar, falta preencher:</span>{" "}
              {pendenciasDoPasso.join(" · ")}
            </p>
          </div>
        )}

        <ScrollArea className="flex-1 pr-3 -mr-3">
          {/* STEP 0 — Modalidades (multi) */}
          {step === 0 && (
            <div className="space-y-3 p-1">
              <div className="text-xs text-muted-foreground bg-released-soft/40 border border-released-border/60 rounded-lg px-3 py-2">
                <span className="font-medium text-released-on-soft">Dieta mista permitida.</span>{" "}
                Selecione mais de uma modalidade quando aplicável (ex.: oral em progressão + enteral, ou enteral + parenteral). "Dieta zero" é exclusiva.
              </div>
              <div className="grid grid-cols-2 gap-3">
                {MODALITY_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const sel = modalities.has(opt.k);
                  return (
                    <button
                      key={opt.k}
                      type="button"
                      onClick={() => toggleModality(opt.k)}
                      className={cn(
                        "relative p-4 rounded-lg border-2 text-left transition-all hover:shadow-md",
                        sel ? "border-released bg-released-soft shadow-md ring-2 ring-released/20"
                            : "border-border hover:border-released-border"
                      )}
                    >
                      <div className={cn(
                        "absolute top-2 right-2 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all",
                        sel ? "bg-released border-released" : "border-border bg-background"
                      )}>
                        {sel && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <Icon className={cn("h-6 w-6 mb-2", sel ? "text-released-on-soft" : "text-muted-foreground")} />
                      <div className={cn("font-medium text-sm", sel && "text-released-on-soft")}>{opt.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
              {modalities.size > 1 && !modalities.has("zero") && (
                <div className="text-xs text-warning-on-soft bg-warning-soft border border-warning-border rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Dieta mista selecionada ({Array.from(modalities).join(" + ")}). Cada modalidade gerará uma linha independente na prescrição.</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 1 — Detalhes por modalidade */}
          {step === 1 && (
            <div className="space-y-4 p-1">
              {modalities.has("zero") && (
                <section className="rounded-lg border border-border/60 p-3 space-y-3">
                  <h3 className="text-xs font-semibold text-released-on-soft flex items-center gap-2"><Ban className="h-3.5 w-3.5" /> Dieta zero (NPO)</h3>
                  <div>
                    <Label className="text-xs font-medium">Motivo do jejum</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {ZERO_REASONS.map(r => (
                        <button key={r.key} type="button" onClick={() => setZeroReason(r.key)}
                          className={cn("text-xs px-3 py-2 rounded-lg border text-left transition-all",
                            zeroReason === r.key ? "border-released bg-released-soft text-released-on-soft" : "border-border hover:border-released-border"
                          )}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Em jejum desde (data/hora)</Label>
                    <Input type="datetime-local" value={zeroSince} onChange={e => setZeroSince(e.target.value)} className="mt-2 h-9 text-sm" />
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={zeroHydrate} onChange={e => setZeroHydrate(e.target.checked)} className="rounded-md" />
                    Adicionar hidratação venosa de manutenção (30-35 mL/kg/dia)
                  </label>
                  <div>
                    <Label className="text-xs font-medium">Ajustes manuais / observações desta dieta</Label>
                    <Textarea value={zeroCustom} onChange={e => setZeroCustom(e.target.value)} placeholder="Ex.: aguardar resultado de TC abdome para reintrodução..." className="mt-2 text-xs min-h-[50px]" />
                  </div>
                </section>
              )}

              {modalities.has("oral") && (
                <section className="rounded-lg border border-border/60 p-3 space-y-3">
                  <h3 className="text-xs font-semibold text-released-on-soft flex items-center gap-2"><UtensilsCrossed className="h-3.5 w-3.5" /> Via oral</h3>
                  {/* Sem subdescricao: o nome da consistencia e o que a cozinha
                      executa, e a explicacao embaixo de cada opcao ocupava duas
                      linhas por cartao sem acrescentar decisao — era boa parte
                      da rolagem deste passo. */}
                  <div>
                    <Label className="text-xs font-medium">
                      Consistência
                      {!oralConsist && <span className="ml-1.5 text-xs font-normal text-warning-on-soft">selecione</span>}
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1.5">
                      {ORAL_CONSISTENCIES.map(c => (
                        <button key={c.key} type="button" onClick={() => setOralConsist(c.key)}
                          className={cn("text-xs px-2 py-1.5 rounded-lg border text-left font-medium transition-all",
                            oralConsist === c.key ? "border-released bg-released text-white" : "border-border hover:border-released-border"
                          )}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* O perfil terapeutico saiu daqui: virou o passo "Perfil",
                      com a mesma lista usada no corpo da prescricao, e vale
                      para todas as modalidades — nao so a oral. */}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium">Fracionamento</Label>
                      <Select value={oralFraction} onValueChange={setOralFraction}>
                        <SelectTrigger className="mt-2 h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3x/dia">3x/dia (refeições principais)</SelectItem>
                          <SelectItem value="4x/dia">4x/dia</SelectItem>
                          <SelectItem value="5x/dia">5x/dia</SelectItem>
                          <SelectItem value="6x/dia">6x/dia (padrão hospitalar)</SelectItem>
                          <SelectItem value="Livre demanda">Livre demanda</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* "Agua oral livre" saiu daqui: virou "Agua livre" no passo
                        Agua, ao lado da hidratacao programada. Aqui, no meio da
                        dieta oral, ficava desconectada do resto da hidratacao —
                        o medico configurava agua em dois lugares que nao se
                        conheciam. */}
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Ajustes manuais / observações desta dieta</Label>
                    <Textarea value={oralCustom} onChange={e => setOralCustom(e.target.value)} placeholder="Ex.: progressão conforme avaliação fonoaudiológica; teste de deglutição..." className="mt-2 text-xs min-h-[50px]" />
                  </div>
                </section>
              )}

              {modalities.has("enteral") && (
                <section className="rounded-lg border border-border/60 p-3 space-y-3">
                  <h3 className="text-xs font-semibold text-released-on-soft flex items-center gap-2"><Soup className="h-3.5 w-3.5" /> Enteral</h3>

                  {/* Sistema aberto/fechado */}
                  <div>
                    <Label className="text-xs font-medium">Sistema (padrão hospitalar)</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {[
                        { k: "aberto" as const,  label: "Sistema aberto",  desc: "Frasco/copo dosador, troca a cada 4h. Maior flexibilidade gravitacional/intermitente." },
                        { k: "fechado" as const, label: "Sistema fechado", desc: "Bolsa pré-pronta, pendura até 24h. Indicado para BIC contínua." },
                      ].map(o => (
                        <button key={o.k} type="button" onClick={() => setEntSystem(o.k)}
                          className={cn("text-xs px-3 py-2 rounded-lg border text-left transition-all",
                            entSystem === o.k ? "border-released bg-released-soft text-released-on-soft" : "border-border hover:border-released-border"
                          )}>
                          <div className="font-medium">{o.label}</div>
                          <div className="text-xs text-muted-foreground">{o.desc}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Trocar o sistema sugere automaticamente o modo de infusão (pode sobrescrever abaixo).
                    </p>
                  </div>

                  {/* Via: pilulas numa linha so. Cada uma ocupava um cartao de
                      duas linhas numa grade 4x2, o que empurrava todo o resto
                      do passo para fora da tela. O nome por extenso vive no
                      title e na legenda abaixo. */}
                  <div>
                    <Label className="text-xs font-medium">
                      Via de acesso
                      {!entVia && <span className="ml-1.5 text-xs font-normal text-warning-on-soft">selecione</span>}
                    </Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {ENTERAL_VIAS.map(v => (
                        <button key={v.key} type="button" title={v.desc} onClick={() => setEntVia(v.key)}
                          className={cn("text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
                            entVia === v.key ? "border-released bg-released text-white" : "border-border hover:border-released-border"
                          )}>
                          {v.label}
                        </button>
                      ))}
                    </div>
                    {entVia && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ENTERAL_VIAS.find(v => v.key === entVia)?.desc}
                      </p>
                    )}
                  </div>
                  {/* Formula: grade de 3 e descricao apenas da selecionada.
                      Dez cartoes de duas linhas ocupavam meia tela. Nenhuma vem
                      marcada: a escolha da formula e clinica e nao deve ser
                      herdada de um padrao que o medico nao conferiu. */}
                  <div>
                    <Label className="text-xs font-medium">
                      Tipo de fórmula
                      {!entFormula && <span className="ml-1.5 text-xs font-normal text-warning-on-soft">selecione</span>}
                    </Label>
                    <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                      {ENTERAL_FORMULAS.map(f => (
                        <button key={f.key} type="button" title={f.desc} onClick={() => setEntFormula(f.key)}
                          className={cn("text-xs px-2 py-1.5 rounded-lg border text-left font-medium transition-all",
                            entFormula === f.key ? "border-released bg-released text-white" : "border-border hover:border-released-border"
                          )}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                    {entFormula && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ENTERAL_FORMULAS.find(f => f.key === entFormula)?.desc}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium">
                      Modo de infusão
                      {!entMode && <span className="ml-1.5 text-xs font-normal text-warning-on-soft">selecione</span>}
                    </Label>
                    <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                      {ENTERAL_MODES.map(m => (
                        <button key={m.key} type="button" title={m.desc} onClick={() => setEntMode(m.key)}
                          className={cn("text-xs px-2 py-1.5 rounded-lg border text-left font-medium transition-all",
                            entMode === m.key ? "border-released bg-released text-white" : "border-border hover:border-released-border"
                          )}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {entMode && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ENTERAL_MODES.find(m => m.key === entMode)?.desc}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {entMode === "continua" ? (
                      <div>
                        <Label className="text-xs font-medium">Vazão (mL/h)</Label>
                        <Input value={entRate} onChange={e => setEntRate(e.target.value)} className="mt-2 h-9 text-sm" />
                      </div>
                    ) : (
                      <div>
                        <Label className="text-xs font-medium">Tomadas/dia</Label>
                        <Input value={entFractions} onChange={e => setEntFractions(e.target.value)} className="mt-2 h-9 text-sm" />
                      </div>
                    )}
                    <div>
                      <Label className="text-xs font-medium">Volume total/dia (mL)</Label>
                      <Input value={entVolDay} onChange={e => setEntVolDay(e.target.value)} className="mt-2 h-9 text-sm" />
                    </div>
                    <div className="flex items-end">
                      <div className="text-xs text-muted-foreground">
                        {patientWeight ? `Peso ${patientWeight}kg → ~${Math.round(Number(entVolDay) / Number(patientWeight) * 10) / 10} mL/kg` : "Informe peso para kcal/kg"}
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={entProgression} onChange={e => setEntProgression(e.target.checked)} className="rounded-md" />
                    Incluir esquema de progressão (20 mL/h a cada 6-8h)
                  </label>

                </section>
              )}

              {modalities.has("parenteral") && (
                <section className="rounded-lg border border-border/60 p-3 space-y-3">
                  <h3 className="text-xs font-semibold text-released-on-soft flex items-center gap-2"><Droplets className="h-3.5 w-3.5" /> Parenteral (NPT)</h3>
                  <div>
                    <Label className="text-xs font-medium">Tipo de NPT</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {[
                        { k: "central",    label: "Central (CVC/PICC)", desc: "Osmolaridade alta, longa duração" },
                        { k: "periferica", label: "Periférica",          desc: "Curta duração, ≤ 900 mOsm/L" },
                      ].map(o => (
                        <button key={o.k} type="button" onClick={() => setParType(o.k as any)}
                          className={cn("text-xs px-3 py-2 rounded-lg border text-left transition-all",
                            parType === o.k ? "border-released bg-released-soft text-released-on-soft" : "border-border hover:border-released-border"
                          )}>
                          <div className="font-medium">{o.label}</div>
                          <div className="text-xs text-muted-foreground">{o.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-xs font-medium">Volume (mL)</Label><Input value={parVolume} onChange={e => setParVolume(e.target.value)} className="mt-2 h-9 text-sm" /></div>
                    <div><Label className="text-xs font-medium">Kcal totais</Label><Input value={parKcal} onChange={e => setParKcal(e.target.value)} placeholder="ex: 1500" className="mt-2 h-9 text-sm" /></div>
                    <div><Label className="text-xs font-medium">Vazão (mL/h)</Label><Input value={parRate} onChange={e => setParRate(e.target.value)} className="mt-2 h-9 text-sm" /></div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Composição (macros, eletrólitos, multivitamínico)</Label>
                    <Textarea value={parObs} onChange={e => setParObs(e.target.value)}
                      placeholder="ex: AA 10% 500mL + Glicose 50% 500mL + Lipídeo 20% 250mL + multivit + oligoelementos + KCl 30 mEq + NaCl 60 mEq"
                      className="mt-2 text-xs min-h-[60px]" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Ajustes manuais / observações desta dieta</Label>
                    <Textarea value={parCustom} onChange={e => setParCustom(e.target.value)} placeholder="Ex.: ajuste após glicemia; transição gradual para enteral em 48h..." className="mt-2 text-xs min-h-[50px]" />
                  </div>
                </section>
              )}


              {/* ── Sonda de drenagem ──
                  Fora do bloco de modalidade de proposito: e cuidado com
                  DISPOSITIVO, nao dieta. Vale junto de dieta zero (o caso mais
                  comum) e tambem junto de dieta enteral — descompressao em
                  paralelo a alimentacao por jejunostomia, por exemplo. */}
              <section className={cn(
                "rounded-lg border p-3 space-y-3 transition-all",
                drenagemAtiva ? "border-border bg-muted/40" : "border-dashed border-border/60",
              )}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-released" />
                      Sonda para drenagem ou quantificação de resíduo
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gera linha própria. Independe da dieta — pode coexistir com nutrição enteral.
                    </p>
                  </div>
                  <Switch checked={drenagemAtiva} onCheckedChange={setDrenagemAtiva} />
                </div>

                {drenagemAtiva && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <Label className="text-xs font-medium">
                        Via
                        {!drenagemVia && <span className="ml-1.5 text-xs font-normal text-warning-on-soft">selecione</span>}
                      </Label>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {DRENAGEM_VIAS.map(v => (
                          <button key={v.key} type="button" title={v.desc}
                            onClick={() => setDrenagemVia(v.key)}
                            className={cn("text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
                              drenagemVia === v.key ? "border-released bg-released text-white" : "border-border hover:border-released-border")}>
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-medium">Finalidade</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mt-1.5">
                        {DRENAGEM_FINALIDADES.map(f => (
                          <button key={f.key} type="button" title={f.desc}
                            onClick={() => setDrenagemFinalidade(f.key)}
                            className={cn("text-xs px-2 py-1.5 rounded-lg border text-left font-medium transition-all",
                              drenagemFinalidade === f.key ? "border-released bg-released text-white" : "border-border hover:border-released-border")}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-medium">Posição entre as verificações</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1.5">
                        {DRENAGEM_POSICOES.map(o => (
                          <button key={o.key} type="button" title={o.desc}
                            onClick={() => setDrenagemPosicao(o.key)}
                            className={cn("text-xs px-2 py-1.5 rounded-lg border text-left font-medium transition-all",
                              drenagemPosicao === o.key ? "border-released bg-released text-white" : "border-border hover:border-released-border")}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(drenagemFinalidade === "quantificacao" || drenagemFinalidade === "ambas") && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-medium">Quantificar a cada</Label>
                        <Select value={drenagemFreq} onValueChange={setDrenagemFreq}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2/2h">2/2h</SelectItem>
                            <SelectItem value="4/4h">4/4h</SelectItem>
                            <SelectItem value="6/6h">6/6h</SelectItem>
                            <SelectItem value="12/12h">12/12h</SelectItem>
                            <SelectItem value="Por turno">Por turno</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}


          {/* STEP 2 — Água e hidratação
              Antes isto vivia no fim do passo de Detalhes: a água via sonda
              ficava DENTRO da seção enteral e a oferta hídrica logo abaixo,
              exigindo rolar a tela até o fim para descobrir que existiam.
              Como passo próprio, aparece na trilha de progresso e o médico vê
              que há uma decisão de hidratação a tomar. */}
          {step === 2 && (
            <div className="space-y-4 p-1">
              <p className="text-xs text-muted-foreground">
                A hidratação é prescrita em linha própria, separada da dieta. Nenhuma das opções é obrigatória — marque só o que o paciente precisa.
              </p>
                {/* ── Como a agua e ofertada ──
                    Duas formas EXCLUDENTES, lado a lado: ou a oferta e
                    controlada em volume e horario (programada), ou e livre.
                    Ter as duas marcadas nao faz sentido clinico.

                    A "agua livre" estava antes dentro da dieta oral, longe
                    daqui: o medico configurava agua em dois lugares que nao se
                    conheciam. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setWaterOfferEnabled(true); setOralWaterFree(false); }}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-all",
                      waterOfferEnabled
                        ? "border-released bg-released-soft"
                        : "border-border hover:border-released-border",
                    )}
                  >
                    <div className="text-xs font-semibold flex items-center gap-2">
                      <Droplets className="h-3.5 w-3.5" />
                      Hidratação programada
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Volume por oferta e horário definidos. Gera linha própria na prescrição.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setOralWaterFree(true); setWaterOfferEnabled(false); }}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-all",
                      oralWaterFree
                        ? "border-released bg-released-soft"
                        : "border-border hover:border-released-border",
                    )}
                  >
                    <div className="text-xs font-semibold flex items-center gap-2">
                      <Droplets className="h-3.5 w-3.5" />
                      Água livre
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sem restrição de volume ou horário, conforme aceitação do paciente.
                    </p>
                  </button>
                </div>

                <section className={cn(
                  "rounded-lg border p-3 space-y-3 transition-all",
                  waterOfferEnabled ? "border-border bg-muted/40" : "hidden"
                )}>
                  {waterOfferEnabled && (
                    <WaterOfferingFields
                      value={waterOffer}
                      onChange={setWaterOffer}
                      accentClassName="border-border bg-muted/60"
                      accentTextClassName="text-foreground"
                    />
                  )}
                </section>

                {/* ── Complementos da hidratação ──
                    Reordenado: a hidratação programada (o catálogo, logo
                    abaixo) é a decisão principal e vem primeiro; o flush é
                    complemento e fica aqui, como interruptor.

                    "Correção de distúrbio hidroeletrolítico" foi REMOVIDA: e
                    esquema terapêutico de eletrólitos, não hidratação de
                    rotina, e pertence à prescrição de eletrólitos. Manter aqui
                    dava a entender que água corrige hiponatremia. */}
                <Separator />
                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div>
                    <div className="text-xs font-medium flex items-center gap-2">
                      <Droplets className="h-3.5 w-3.5 text-released" />
                      Flush de manutenção
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      30 mL antes e após dieta e medicações, para manter a sonda pérvia.
                    </p>
                  </div>
                  <Switch checked={waterFlush} onCheckedChange={setWaterFlush} />
                </div>
                <div>
                  <Label className="text-xs font-medium">Ajustes manuais / observações desta dieta</Label>
                  <Textarea value={entCustom} onChange={e => setEntCustom(e.target.value)} placeholder="Ex.: pausa para fisioterapia respiratória 14h; ajuste conforme glicemia; fórmula caseira do hospital..." className="mt-2 text-xs min-h-[50px]" />
                </div>
            </div>
          )}

          {/* STEP 3 — Perfil do paciente */}
          {step === 3 && (
            <div className="space-y-3 p-1">
              <p className="text-xs text-muted-foreground">
                Selecione todas as condições do paciente. Cada uma impõe uma característica à dieta, e as recomendações terapêuticas são incorporadas automaticamente.
              </p>
              <div className="flex flex-wrap gap-2">
                {COMORBIDITIES.map(c => {
                  const sel = comorbs.has(c.key);
                  return (
                    <button key={c.key} type="button" onClick={() => toggleComorb(c.key)}
                      className={cn("text-xs px-3 py-2 rounded-lg border transition-all flex items-center gap-2",
                        sel ? "border-warning bg-warning-soft text-warning-on-soft" : "border-border hover:border-warning-border"
                      )}>
                      {sel && <Check className="h-3 w-3" />}
                      <span className="font-medium">{c.label}</span>
                      <span className="text-muted-foreground text-xs">— {c.hint}</span>
                    </button>
                  );
                })}
              </div>
              <Separator />
              <div>
                <Label className="text-xs font-medium">Observações gerais (aplicam-se a todas as modalidades)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: avaliação de fonoaudiologia; reavaliação nutricional em 48h; meta nutricional plena em 72h..."
                  className="mt-2 text-xs min-h-[60px]" />
              </div>
            </div>
          )}

          {/* STEP 4 — Aporte proteico (catálogo genérico) */}
          {step === 4 && (
            <div className="space-y-3 p-1">
              <div className="text-xs text-muted-foreground bg-released-soft/40 border border-released-border/60 rounded-lg px-3 py-2">
                <span className="font-medium text-released-on-soft">Suplementação proteica/calórico-proteica</span> — selecione os produtos a anexar à prescrição.
                Cada item gera linha própria. Vias disponíveis variam por produto: <strong>oral (VO)</strong>, <strong>enteral</strong> (SNG/SOG/SNE/GTT/JTT) e, quando aplicável, <strong>parenteral</strong> (NPT / dipeptídeo IV).
              </div>

              {(["sno", "modular"] as const).map(group => {
                const groupItems = PROTEIN_SUPPLEMENTS.filter(p => p.group === group);
                const groupLabel = group === "sno"
                  ? "Suplementos nutricionais (VO ou por sonda)"
                  : "Módulos (pó/sachê / aminoácidos) — VO, sonda ou parenteral";
                return (
                  <section key={group} className="rounded-lg border border-border/60 p-3 space-y-2">
                    <h3 className="text-xs font-semibold text-released-on-soft">{groupLabel}</h3>
                    <div className="space-y-2">
                      {groupItems.map(p => {
                        const sel = proteinSelected.has(p.key);
                        const ov = proteinOverrides[p.key];
                        return (
                          <div key={p.key} className={cn(
                            "rounded-md border transition-all",
                            sel ? "border-released bg-released-soft/30" : "border-border/60"
                          )}>
                            <button
                              type="button"
                              onClick={() => toggleProtein(p.key)}
                              className="w-full text-left px-3 py-2 flex items-start gap-2"
                            >
                              <div className={cn(
                                "mt-1 h-4 w-4 rounded-md border flex items-center justify-center shrink-0",
                                sel ? "bg-released border-released" : "border-border bg-background"
                              )}>
                                {sel && <Check className="h-2.5 w-2.5 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium">{p.label}</div>
                                <div className="text-xs text-muted-foreground">{p.note}</div>
                              </div>
                            </button>
                            {sel && ov && (
                              <div className="px-3 pb-2 pt-0 grid grid-cols-3 gap-2 border-t border-border/40 bg-background/40">
                                <div>
                                  <Label className="text-xs font-medium">Dose</Label>
                                  <Input value={ov.dose} onChange={e => updateProteinOverride(p.key, { dose: e.target.value })} className="mt-1 h-8 text-xs" />
                                </div>
                                <div>
                                  <Label className="text-xs font-medium">Posologia</Label>
                                  <Input value={ov.posology} onChange={e => updateProteinOverride(p.key, { posology: e.target.value })} className="mt-1 h-8 text-xs" />
                                </div>
                                <div>
                                  <Label className="text-xs font-medium">Via</Label>
                                  <Select value={ov.route} onValueChange={(v) => updateProteinOverride(p.key, { route: v as ProteinRouteKind })}>
                                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {p.routes.includes("oral") && <SelectItem value="oral">Oral (VO)</SelectItem>}
                                      {p.routes.includes("enteral") && (
                                        <SelectItem value="enteral">
                                          Enteral ({ENTERAL_VIAS.find(v => v.key === entVia)?.label || "SNG/SNE/GTT/JTT"})
                                        </SelectItem>
                                      )}
                                      {p.routes.includes("parenteral") && (
                                        <SelectItem value="parenteral">Parenteral (NPT / IV)</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {proteinSelected.size === 0 && (
                <div className="text-xs text-muted-foreground text-center py-2">
                  Nenhum aporte proteico selecionado — esta etapa é opcional. Avance para revisar.
                </div>
              )}
            </div>
          )}

          {/* STEP 5 — Revisão */}
          {step === 5 && (
            <div className="space-y-2 p-1">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Activity className="h-3.5 w-3.5 text-released" />
                  Itens que serão adicionados à prescrição:
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setStep(0)}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar outra modalidade
                </Button>
              </div>
              {entries.map((e, i) => (
                <div key={e.id} className="rounded-lg border border-released-border bg-released-soft/40 p-3">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs bg-released-soft text-released-on-soft border-released-border">{i + 1}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-released-on-soft">{e.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {[e.defaultDose !== "-" ? e.defaultDose : null,
                          e.defaultRoute !== "-" ? e.defaultRoute : null,
                          e.defaultPosology !== "-" ? e.defaultPosology : null].filter(Boolean).join(" · ")}
                      </div>
                      {e.instructions && (
                        <div className="text-xs text-muted-foreground mt-1 italic border-l-2 border-released-border pl-2">
                          {e.instructions}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {entries.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">Nenhum item gerado.</div>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
            {step < STEPS.length - 1 ? (
              <Button size="sm" className="bg-released hover:bg-released" disabled={!canAdvance} onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}>
                Avançar <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : (
              <Button size="sm" className="bg-released hover:bg-released" onClick={handleConfirm} disabled={entries.length === 0}>
                <Check className="h-3.5 w-3.5 mr-1" /> Adicionar à prescrição ({entries.length})
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
