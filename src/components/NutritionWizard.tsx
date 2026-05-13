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
import {
  UtensilsCrossed, Soup, Droplets, AlertTriangle, Check,
  Ban, ChevronRight, ChevronLeft, Sparkles, Activity, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MedicationEntry } from "@/data/medicationsDatabase";

/**
 * Nutrition Wizard — Terapia Nutricional Hospitalar
 * Suporte a dieta MISTA (multi-modalidade), sistema enteral aberto/fechado,
 * água enteral programada, e personalização manual por modalidade.
 */

export type NutritionModality = "zero" | "oral" | "enteral" | "parenteral";

const COMORBIDITIES = [
  { key: "has",        label: "HAS",                 hint: "Hipossódica" },
  { key: "dm",         label: "Diabetes",            hint: "Controle glicêmico" },
  { key: "drc",        label: "DRC",                 hint: "Restrição K/P/Na" },
  { key: "hepato",     label: "Hepatopata",          hint: "Hipoproteica c/ AAR" },
  { key: "ic",         label: "Cardiopata/IC",       hint: "Hipossódica + restrição hídrica" },
  { key: "disfagia",   label: "Disfagia",            hint: "Pastosa/Líquida espessada" },
  { key: "celiaco",    label: "Doença celíaca",      hint: "Sem glúten" },
  { key: "lactose",    label: "Intol. lactose",      hint: "Sem lactose" },
  { key: "appl",       label: "APLV",                hint: "Sem prot. leite" },
  { key: "constip",    label: "Constipação",         hint: "Rica em fibras" },
  { key: "diarreia",   label: "Diarreia",            hint: "Pobre em fibras" },
  { key: "pancrea",    label: "Pancreatite",         hint: "Hipolipídica" },
  { key: "obeso",      label: "Obesidade",           hint: "Hipocalórica" },
  { key: "desnut",     label: "Desnutrição",         hint: "Hipercalórica/proteica" },
  { key: "gestante",   label: "Gestante",            hint: "+ Ácido fólico/Fe" },
  { key: "oncolog",    label: "Oncológico",          hint: "Imunomoduladora" },
  { key: "uti",        label: "Crítico/UTI",         hint: "25-30 kcal/kg + 1,2-2 g/kg ptn" },
] as const;
type ComorbKey = typeof COMORBIDITIES[number]["key"];

const ORAL_CONSISTENCIES = [
  { key: "geral",       label: "Geral / Livre",        desc: "Sem restrições de consistência" },
  { key: "branda",      label: "Branda",               desc: "Cocção mais prolongada, fácil mastigação" },
  { key: "pastosa",     label: "Pastosa",              desc: "Liquidificada/amassada, sem mastigar" },
  { key: "liquida_c",   label: "Líquida completa",     desc: "Líquidos e semilíquidos, com leite/suplementos" },
  { key: "liquida_r",   label: "Líquida restrita",     desc: "Apenas líquidos claros (água, chá, gelatina)" },
  { key: "semiliq",     label: "Semilíquida",          desc: "Mingaus e cremes" },
  { key: "espess",      label: "Líquida espessada",    desc: "Para disfagia (néctar/mel/pudim)" },
] as const;

const ORAL_PROFILES = [
  { key: "livre",       label: "Livre" },
  { key: "hipossodica", label: "Hipossódica" },
  { key: "dm",          label: "Para diabético" },
  { key: "hipolip",     label: "Hipolipídica" },
  { key: "hipoprot",    label: "Hipoproteica (renal)" },
  { key: "hiperprot",   label: "Hiperproteica" },
  { key: "hipercal",    label: "Hipercalórica" },
  { key: "hipocal",     label: "Hipocalórica" },
  { key: "sem_lactose", label: "Sem lactose" },
  { key: "sem_gluten",  label: "Sem glúten" },
  { key: "vegetar",     label: "Vegetariana" },
  { key: "hipouric",    label: "Hipouricêmica" },
  { key: "rica_fibras", label: "Rica em fibras" },
  { key: "pobre_fibras",label: "Pobre em fibras" },
  { key: "cetog",       label: "Cetogênica" },
] as const;

const ENTERAL_VIAS = [
  { key: "sng", label: "SNG", desc: "Sonda nasogástrica" },
  { key: "sne", label: "SNE", desc: "Sonda nasoentérica" },
  { key: "sog", label: "SOG", desc: "Sonda orogástrica" },
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
type ProteinRouteKind = "oral" | "enteral";
interface ProteinSupplementDef {
  key: string;
  label: string;
  group: "sno" | "modular";
  routes: ProteinRouteKind[];   // vias permitidas
  defaultDose: string;          // dose textual padrão
  defaultPosology: string;      // frequência padrão
  note: string;                 // contexto clínico
}

const PROTEIN_SUPPLEMENTS: ProteinSupplementDef[] = [
  // ── SNO (Suplemento Nutricional Oral) ──
  { key: "sno_hchp",      label: "Suplemento hipercalórico-hiperproteico (HC-HP) — oral",
    group: "sno", routes: ["oral"],
    defaultDose: "200 mL", defaultPosology: "2x/dia entre refeições",
    note: "~300 kcal e ~18-20 g proteína por unidade. Ofertar gelado, entre refeições, evitando saciedade na principal." },
  { key: "sno_hp",        label: "Suplemento hiperproteico concentrado — oral",
    group: "sno", routes: ["oral"],
    defaultDose: "200 mL", defaultPosology: "2x/dia",
    note: "Indicado quando déficit proteico é o principal alvo (sarcopenia, cicatrização, oncológico)." },
  { key: "sno_dm",        label: "Suplemento oral específico para diabetes",
    group: "sno", routes: ["oral"],
    defaultDose: "200 mL", defaultPosology: "1-2x/dia",
    note: "Baixo índice glicêmico, fibras solúveis. Monitorar glicemia capilar." },
  { key: "sno_renal_nd",  label: "Suplemento oral para nefropata não-dialítico",
    group: "sno", routes: ["oral"],
    defaultDose: "200 mL", defaultPosology: "1x/dia",
    note: "Densidade calórica alta, restrição de K/P/Na, proteína moderada." },
  { key: "sno_renal_d",   label: "Suplemento oral para nefropata em diálise",
    group: "sno", routes: ["oral"],
    defaultDose: "200 mL", defaultPosology: "2x/dia (preferir nos dias de diálise)",
    note: "Hiperproteico, hipercalórico, com perfil de eletrólitos para HD/DP." },
  { key: "sno_imuno",     label: "Suplemento oral imunomodulador (oncológico/cirúrgico)",
    group: "sno", routes: ["oral"],
    defaultDose: "200 mL", defaultPosology: "2-3x/dia por 5-7 dias pré e pós-op",
    note: "Arginina + EPA/DHA + nucleotídeos. Evitar em sepse grave." },
  { key: "sno_disfagia",  label: "Espessante alimentar (disfagia)",
    group: "sno", routes: ["oral"],
    defaultDose: "Conforme consistência (néctar/mel/pudim)", defaultPosology: "Em todos os líquidos",
    note: "Padronizar consistência conforme avaliação fonoaudiológica (IDDSI)." },

  // ── Módulos (oral ou via sonda) ──
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
  { key: "mod_glutamina", label: "Módulo de glutamina (L-Glutamina)",
    group: "modular", routes: ["oral", "enteral"],
    defaultDose: "10 g", defaultPosology: "3x/dia (30 g/dia)",
    note: "Trofismo intestinal, estresse metabólico, queimados. Cautela em hepatopatas graves." },
  { key: "mod_leucina_hmb", label: "Módulo de leucina enriquecido com HMB",
    group: "modular", routes: ["oral", "enteral"],
    defaultDose: "1 sachê", defaultPosology: "2x/dia",
    note: "Anabólico em sarcopenia/idoso frágil/UTI. Contém ~3 g HMB e leucina." },
  { key: "mod_arginina",  label: "Módulo de arginina",
    group: "modular", routes: ["oral", "enteral"],
    defaultDose: "5 g", defaultPosology: "2x/dia",
    note: "Cicatrização e imunomodulação. Evitar em sepse grave e instabilidade hemodinâmica." },
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

interface NutritionWizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (entries: MedicationEntry[]) => void;
  patientWeight?: string;
}

export function NutritionWizard({ open, onOpenChange, onAdd, patientWeight }: NutritionWizardProps) {
  const [step, setStep] = useState(0);
  const [modalities, setModalities] = useState<Set<NutritionModality>>(new Set(["oral"]));
  const [comorbs, setComorbs] = useState<Set<ComorbKey>>(new Set());

  // Oral
  const [oralConsist, setOralConsist] = useState<string>("geral");
  const [oralProfiles, setOralProfiles] = useState<Set<string>>(new Set(["livre"]));
  const [oralFraction, setOralFraction] = useState<string>("6x/dia");
  const [oralWaterFree, setOralWaterFree] = useState(true);
  const [oralCustom, setOralCustom] = useState("");

  // Enteral
  const [entSystem, setEntSystem] = useState<"aberto" | "fechado">("fechado");
  const [entVia, setEntVia] = useState<string>("sne");
  const [entFormula, setEntFormula] = useState<string>("polim_padrao");
  const [entMode, setEntMode] = useState<string>("continua");
  const [entRate, setEntRate] = useState<string>("25");
  const [entVolDay, setEntVolDay] = useState<string>("1500");
  const [entFractions, setEntFractions] = useState<string>("6");
  const [entProgression, setEntProgression] = useState(true);
  const [entCustom, setEntCustom] = useState("");

  // Água enteral
  const [waterFlush, setWaterFlush] = useState(true);
  const [waterScheduled, setWaterScheduled] = useState(false);
  const [waterVol, setWaterVol] = useState("100");
  const [waterFreq, setWaterFreq] = useState("4/4h");
  const [waterCorrection, setWaterCorrection] = useState(false);
  const [waterCorrectionVol, setWaterCorrectionVol] = useState("");
  const [waterCorrectionObs, setWaterCorrectionObs] = useState("");

  // Parenteral
  const [parType, setParType] = useState<"central" | "periferica">("central");
  const [parVolume, setParVolume] = useState<string>("1500");
  const [parKcal, setParKcal] = useState<string>("");
  const [parRate, setParRate] = useState<string>("");
  const [parObs, setParObs] = useState<string>("");
  const [parCustom, setParCustom] = useState("");

  // Zero
  const [zeroReason, setZeroReason] = useState<string>("preop");
  const [zeroSince, setZeroSince] = useState<string>("");
  const [zeroHydrate, setZeroHydrate] = useState(true);
  const [zeroCustom, setZeroCustom] = useState("");

  // Aporte proteico (multi-select com overrides por item)
  interface ProteinOverride { dose: string; posology: string; route: ProteinRouteKind }
  const [proteinSelected, setProteinSelected] = useState<Set<string>>(new Set());
  const [proteinOverrides, setProteinOverrides] = useState<Record<string, ProteinOverride>>({});

  // Free notes
  const [notes, setNotes] = useState<string>("");

  // Sugestão automática de modo conforme sistema enteral
  useEffect(() => {
    if (!modalities.has("enteral")) return;
    if (entSystem === "aberto" && entMode === "continua") setEntMode("intermitente");
    if (entSystem === "fechado" && entMode !== "continua" && entMode !== "ciclica") setEntMode("continua");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entSystem]);

  const reset = () => {
    setStep(0); setModalities(new Set(["oral"])); setComorbs(new Set());
    setOralConsist("geral"); setOralProfiles(new Set(["livre"])); setOralFraction("6x/dia"); setOralWaterFree(true); setOralCustom("");
    setEntSystem("fechado"); setEntVia("sne"); setEntFormula("polim_padrao"); setEntMode("continua");
    setEntRate("25"); setEntVolDay("1500"); setEntFractions("6"); setEntProgression(true); setEntCustom("");
    setWaterFlush(true); setWaterScheduled(false); setWaterVol("100"); setWaterFreq("4/4h");
    setWaterCorrection(false); setWaterCorrectionVol(""); setWaterCorrectionObs("");
    setParType("central"); setParVolume("1500"); setParKcal(""); setParRate(""); setParObs(""); setParCustom("");
    setZeroReason("preop"); setZeroSince(""); setZeroHydrate(true); setZeroCustom("");
    setNotes("");
  };

  const toggleModality = (k: NutritionModality) => {
    setModalities(prev => {
      const n = new Set(prev);
      if (n.has(k)) {
        if (n.size === 1) return n; // não permite ficar vazio
        n.delete(k);
      } else {
        // Dieta zero é exclusiva — desmarca outras se zero for adicionado, ou desmarca zero se outra for adicionada
        if (k === "zero") return new Set(["zero"]);
        n.delete("zero");
        n.add(k);
      }
      return n;
    });
  };

  const toggleComorb = (k: ComorbKey) => {
    setComorbs(prev => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      const profileMap: Record<string, string> = {
        has: "hipossodica", dm: "dm", drc: "hipoprot", hepato: "hipoprot",
        ic: "hipossodica", celiaco: "sem_gluten", lactose: "sem_lactose",
        constip: "rica_fibras", diarreia: "pobre_fibras", pancrea: "hipolip",
        obeso: "hipocal", desnut: "hipercal",
      };
      if (modalities.has("oral") && profileMap[k] && n.has(k as any)) {
        setOralProfiles(p => new Set([...Array.from(p).filter(x => x !== "livre"), profileMap[k]]));
      }
      return n;
    });
  };

  const toggleOralProfile = (k: string) => {
    setOralProfiles(prev => {
      const n = new Set(prev);
      if (k === "livre") return new Set(["livre"]);
      n.delete("livre");
      if (n.has(k)) n.delete(k); else n.add(k);
      if (n.size === 0) n.add("livre");
      return n;
    });
  };

  const buildEntries = (): MedicationEntry[] => {
    const entries: MedicationEntry[] = [];
    const comorbStr = Array.from(comorbs)
      .map(k => COMORBIDITIES.find(c => c.key === k)?.label)
      .filter(Boolean)
      .join(", ");
    const comorbSuffix = comorbStr ? ` — Comorbidades: ${comorbStr}` : "";
    const withCustom = (parts: (string | null | undefined)[], custom: string) => {
      const all = [...parts.filter(Boolean), custom ? `Personalização: ${custom}` : null, notes];
      return all.filter(Boolean).join(" · ");
    };

    if (modalities.has("zero")) {
      const reason = ZERO_REASONS.find(r => r.key === zeroReason)?.label || "";
      entries.push({
        id: `nut-zero-${uid()}`,
        name: "Dieta zero (NPO)",
        presentation: "-",
        defaultDose: "-",
        defaultRoute: "-",
        defaultPosology: "Contínuo",
        defaultSchedule: "-",
        instructions: withCustom([
          `Motivo: ${reason}`,
          zeroSince ? `Em jejum desde: ${zeroSince}` : null,
          "Reavaliar reintrodução de dieta a cada 12-24h",
          comorbSuffix.trim(),
        ], zeroCustom),
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
          instructions: "Ajustar conforme balanço hídrico, função renal e cardiopatia",
          category: "hydration",
        });
      }
    }

    if (modalities.has("oral")) {
      const consist = ORAL_CONSISTENCIES.find(c => c.key === oralConsist)?.label || "";
      const profiles = Array.from(oralProfiles)
        .map(k => ORAL_PROFILES.find(p => p.key === k)?.label)
        .filter(Boolean)
        .join(" + ");
      const isMixed = modalities.size > 1;
      entries.push({
        id: `nut-oral-${uid()}`,
        name: `${isMixed ? "Dieta mista — VO" : "Dieta via oral"} — ${consist}${profiles ? ` (${profiles})` : ""}`,
        presentation: "-",
        defaultDose: "-",
        defaultRoute: "Oral",
        defaultPosology: oralFraction,
        defaultSchedule: "07h, 10h, 12h, 15h, 18h, 21h",
        instructions: withCustom([
          "Ofertar conforme aceitação; observar resíduo e tolerância",
          isMixed && modalities.has("enteral") ? "Em progressão de dieta oral — acompanhar com fonoterapia/nutrição" : null,
          comorbSuffix.trim(),
        ], oralCustom),
        category: "nutrition",
      });
      if (oralWaterFree) {
        entries.push({
          id: `nut-oral-h2o-${uid()}`,
          name: "Água oral livre",
          presentation: "-",
          defaultDose: "-",
          defaultRoute: "Oral",
          defaultPosology: "Livre demanda",
          defaultSchedule: "ACM",
          instructions: comorbs.has("ic") ? "Atenção: restrição hídrica em cardiopata — limitar a 1000-1500 mL/dia" : "Estimular ingesta hídrica",
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
        name: `${isMixed ? "Dieta mista — Enteral" : "Dieta enteral"} (${sysLabel}) — ${formula} via ${via}`,
        presentation: "-",
        defaultDose: dose,
        defaultRoute: via === "GTT" ? "Gastrostomia" : via === "JTT" ? "Jejunostomia" : via === "SOG" ? "Sonda orogástrica" : "Enteral (SNE/SNG)",
        defaultPosology: mode,
        defaultSchedule: entMode === "continua" ? "Contínua 24h" : "06h, 10h, 14h, 18h, 22h, 02h",
        instructions: withCustom([
          entSystem === "aberto"
            ? "Sistema aberto: trocar equipo e frasco a cada 4h; lavar utensílios entre tomadas; manipulação asséptica"
            : "Sistema fechado: bolsa pré-pronta pendura até 24h; programar BIC; trocar equipo conforme rotina (24-72h)",
          entProgression ? "Iniciar com 20 mL/h; progredir 20 mL/h a cada 6-8h conforme tolerância (resíduo, distensão, diarreia)" : null,
          "Cabeceira elevada a 30-45° durante e até 1h após a infusão",
          "Avaliar resíduo gástrico a cada 6h (suspender se > 250 mL)",
          comorbs.has("uti") ? "Meta: 25-30 kcal/kg/dia + 1,2-2 g/kg/dia de proteína" : null,
          comorbSuffix.trim(),
        ], entCustom),
        category: "nutrition",
      });
      // Água via sonda — flush
      if (waterFlush) {
        entries.push({
          id: `nut-ent-flush-${uid()}`,
          name: "Água via sonda — flush de manutenção",
          presentation: "-",
          defaultDose: "30 mL",
          defaultRoute: via === "GTT" ? "Gastrostomia" : via === "JTT" ? "Jejunostomia" : via === "SOG" ? "Sonda orogástrica" : "Enteral (SNE/SNG)",
          defaultPosology: "Antes/após dieta e medicações",
          defaultSchedule: "ACM",
          instructions: "Manter pérvia a sonda; usar água potável/filtrada à temperatura ambiente",
          category: "nutrition",
        });
      }
      // Água programada
      if (waterScheduled) {
        entries.push({
          id: `nut-ent-water-${uid()}`,
          name: "Água via sonda — hidratação programada",
          presentation: "-",
          defaultDose: `${waterVol} mL`,
          defaultRoute: via === "GTT" ? "Gastrostomia" : via === "JTT" ? "Jejunostomia" : via === "SOG" ? "Sonda orogástrica" : "Enteral (SNE/SNG)",
          defaultPosology: waterFreq,
          defaultSchedule: "Conforme aprazamento",
          instructions: "Hidratação enteral programada — checar aceitação e balanço hídrico",
          category: "nutrition",
        });
      }
      // Correção de DHE
      if (waterCorrection) {
        entries.push({
          id: `nut-ent-water-corr-${uid()}`,
          name: "Água via sonda — correção de distúrbio hidroeletrolítico",
          presentation: "-",
          defaultDose: `${waterCorrectionVol || "—"} mL/dia`,
          defaultRoute: via === "GTT" ? "Gastrostomia" : via === "JTT" ? "Jejunostomia" : via === "SOG" ? "Sonda orogástrica" : "Enteral (SNE/SNG)",
          defaultPosology: "Fracionado conforme prescrição",
          defaultSchedule: "Conforme aprazamento",
          instructions: [
            "Esquema de correção de DHE — ofertar conforme balanço hídrico, Na sérico e diurese",
            waterCorrectionObs,
          ].filter(Boolean).join(" · "),
          category: "nutrition",
        });
      }
    }

    if (modalities.has("parenteral")) {
      const isMixed = modalities.size > 1;
      entries.push({
        id: `nut-par-${uid()}`,
        name: `${isMixed ? "Dieta mista — NPT" : "NPT"} ${parType === "central" ? "central" : "periférica"}`,
        presentation: "Bolsa NPT",
        defaultDose: `${parVolume} mL${parKcal ? ` (${parKcal} kcal)` : ""}`,
        defaultRoute: "Intravenosa",
        defaultPosology: "Contínuo",
        defaultSchedule: "Infusão contínua 24h",
        instructions: withCustom([
          parType === "central" ? "Acesso venoso central exclusivo (PICC/CVC) — não infundir junto com medicações" : "Acesso periférico — osmolaridade ≤ 900 mOsm/L",
          parRate ? `Vazão: ${parRate} mL/h (BIC)` : "Programar BIC",
          "Monitorar glicemia 6/6h, ionograma diário, função hepática 2x/sem",
          "Trocar bolsa a cada 24h; não exceder 24h após manipulação",
          parObs,
          isMixed && modalities.has("enteral") ? "NPT complementar à enteral — ajustar oferta calórica conforme aceitação enteral" : null,
          comorbSuffix.trim(),
        ], parCustom),
        category: "nutrition",
      });
    }

    return entries;
  };

  const entries = useMemo(buildEntries, [
    modalities, comorbs,
    oralConsist, oralProfiles, oralFraction, oralWaterFree, oralCustom,
    entSystem, entVia, entFormula, entMode, entRate, entVolDay, entFractions, entProgression, entCustom,
    waterFlush, waterScheduled, waterVol, waterFreq, waterCorrection, waterCorrectionVol, waterCorrectionObs,
    parType, parVolume, parKcal, parRate, parObs, parCustom,
    zeroReason, zeroSince, zeroHydrate, zeroCustom, notes,
  ]);

  const handleConfirm = () => {
    onAdd(entries);
    reset();
    onOpenChange(false);
  };

  const STEPS = ["Modalidades", "Detalhes", "Comorbidades", "Revisão"];
  const canAdvance = step === 0 ? modalities.size > 0 : true;

  const MODALITY_OPTIONS = [
    { k: "zero" as const,       icon: Ban,             label: "Dieta zero",       desc: "Jejum / NPO com motivo (exclusiva)" },
    { k: "oral" as const,       icon: UtensilsCrossed, label: "Via oral",         desc: "Consistência + perfil" },
    { k: "enteral" as const,    icon: Soup,            label: "Enteral",          desc: "Sonda — sistema + fórmula + infusão" },
    { k: "parenteral" as const, icon: Droplets,        label: "Parenteral (NPT)", desc: "Central ou periférica" },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl w-[min(48rem,calc(100vw-2rem))] h-[calc(100svh-8rem)] max-h-[calc(100svh-8rem)] top-4 translate-y-0 sm:top-4 z-[80] overflow-hidden flex flex-col p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
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
                "flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md font-medium transition-all whitespace-nowrap",
                i === step ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
                i < step ? "text-muted-foreground" : "text-muted-foreground/50"
              )}>
                <span className={cn(
                  "inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold",
                  i === step ? "bg-emerald-500 text-white" :
                  i < step ? "bg-emerald-500/30 text-emerald-700" : "bg-muted text-muted-foreground"
                )}>
                  {i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}
                </span>
                {s}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
            </div>
          ))}
        </div>

        <ScrollArea className="flex-1 pr-3 -mr-3">
          {/* STEP 0 — Modalidades (multi) */}
          {step === 0 && (
            <div className="space-y-3 p-1">
              <div className="text-[11px] text-muted-foreground bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 rounded-lg px-3 py-2">
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">Dieta mista permitida.</span>{" "}
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
                        "relative p-4 rounded-xl border-2 text-left transition-all hover:shadow-md",
                        sel ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-md ring-2 ring-emerald-500/20"
                            : "border-border hover:border-emerald-300"
                      )}
                    >
                      <div className={cn(
                        "absolute top-2 right-2 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all",
                        sel ? "bg-emerald-500 border-emerald-500" : "border-border bg-background"
                      )}>
                        {sel && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <Icon className={cn("h-6 w-6 mb-2", sel ? "text-emerald-600" : "text-muted-foreground")} />
                      <div className={cn("font-semibold text-sm", sel && "text-emerald-700 dark:text-emerald-300")}>{opt.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
              {modalities.size > 1 && !modalities.has("zero") && (
                <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Dieta mista selecionada ({Array.from(modalities).join(" + ")}). Cada modalidade gerará uma linha independente na prescrição.</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 1 — Detalhes por modalidade */}
          {step === 1 && (
            <div className="space-y-5 p-1">
              {modalities.has("zero") && (
                <section className="rounded-lg border border-border/60 p-3 space-y-3">
                  <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5"><Ban className="h-3.5 w-3.5" /> Dieta zero (NPO)</h3>
                  <div>
                    <Label className="text-xs font-semibold">Motivo do jejum</Label>
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {ZERO_REASONS.map(r => (
                        <button key={r.key} type="button" onClick={() => setZeroReason(r.key)}
                          className={cn("text-xs px-3 py-2 rounded-lg border text-left transition-all",
                            zeroReason === r.key ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-border hover:border-emerald-300"
                          )}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Em jejum desde (data/hora)</Label>
                    <Input type="datetime-local" value={zeroSince} onChange={e => setZeroSince(e.target.value)} className="mt-1.5 h-9 text-sm" />
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={zeroHydrate} onChange={e => setZeroHydrate(e.target.checked)} className="rounded" />
                    Adicionar hidratação venosa de manutenção (30-35 mL/kg/dia)
                  </label>
                  <div>
                    <Label className="text-xs font-semibold">Ajustes manuais / observações desta dieta</Label>
                    <Textarea value={zeroCustom} onChange={e => setZeroCustom(e.target.value)} placeholder="Ex.: aguardar resultado de TC abdome para reintrodução..." className="mt-1.5 text-xs min-h-[50px]" />
                  </div>
                </section>
              )}

              {modalities.has("oral") && (
                <section className="rounded-lg border border-border/60 p-3 space-y-3">
                  <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5"><UtensilsCrossed className="h-3.5 w-3.5" /> Via oral</h3>
                  <div>
                    <Label className="text-xs font-semibold">Consistência</Label>
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {ORAL_CONSISTENCIES.map(c => (
                        <button key={c.key} type="button" onClick={() => setOralConsist(c.key)}
                          className={cn("text-xs px-3 py-2 rounded-lg border text-left transition-all",
                            oralConsist === c.key ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-border hover:border-emerald-300"
                          )}>
                          <div className="font-semibold">{c.label}</div>
                          <div className="text-[10px] text-muted-foreground">{c.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Perfil terapêutico (multi)</Label>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {ORAL_PROFILES.map(p => {
                        const sel = oralProfiles.has(p.key);
                        return (
                          <button key={p.key} type="button" onClick={() => toggleOralProfile(p.key)}
                            className={cn("text-[11px] px-2.5 py-1 rounded-full border transition-all",
                              sel ? "border-emerald-500 bg-emerald-500 text-white" : "border-border hover:border-emerald-300"
                            )}>
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Fracionamento</Label>
                      <Select value={oralFraction} onValueChange={setOralFraction}>
                        <SelectTrigger className="mt-1.5 h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3x/dia">3x/dia (refeições principais)</SelectItem>
                          <SelectItem value="4x/dia">4x/dia</SelectItem>
                          <SelectItem value="5x/dia">5x/dia</SelectItem>
                          <SelectItem value="6x/dia">6x/dia (padrão hospitalar)</SelectItem>
                          <SelectItem value="Livre demanda">Livre demanda</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={oralWaterFree} onChange={e => setOralWaterFree(e.target.checked)} className="rounded" />
                        Adicionar "Água oral livre"
                      </label>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Ajustes manuais / observações desta dieta</Label>
                    <Textarea value={oralCustom} onChange={e => setOralCustom(e.target.value)} placeholder="Ex.: progressão conforme avaliação fonoaudiológica; teste de deglutição..." className="mt-1.5 text-xs min-h-[50px]" />
                  </div>
                </section>
              )}

              {modalities.has("enteral") && (
                <section className="rounded-lg border border-border/60 p-3 space-y-3">
                  <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5"><Soup className="h-3.5 w-3.5" /> Enteral</h3>

                  {/* Sistema aberto/fechado */}
                  <div>
                    <Label className="text-xs font-semibold">Sistema (padrão hospitalar)</Label>
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {[
                        { k: "aberto" as const,  label: "Sistema aberto",  desc: "Frasco/copo dosador, troca a cada 4h. Maior flexibilidade gravitacional/intermitente." },
                        { k: "fechado" as const, label: "Sistema fechado", desc: "Bolsa pré-pronta, pendura até 24h. Indicado para BIC contínua." },
                      ].map(o => (
                        <button key={o.k} type="button" onClick={() => setEntSystem(o.k)}
                          className={cn("text-xs px-3 py-2 rounded-lg border text-left transition-all",
                            entSystem === o.k ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-border hover:border-emerald-300"
                          )}>
                          <div className="font-semibold">{o.label}</div>
                          <div className="text-[10px] text-muted-foreground">{o.desc}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Trocar o sistema sugere automaticamente o modo de infusão (pode sobrescrever abaixo).
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Via de acesso</Label>
                    <div className="grid grid-cols-4 gap-1.5 mt-2">
                      {ENTERAL_VIAS.map(v => (
                        <button key={v.key} type="button" onClick={() => setEntVia(v.key)}
                          className={cn("text-xs px-2 py-2 rounded-lg border text-center transition-all",
                            entVia === v.key ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-border hover:border-emerald-300"
                          )}>
                          <div className="font-bold">{v.label}</div>
                          <div className="text-[9px] text-muted-foreground">{v.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Tipo de fórmula</Label>
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {ENTERAL_FORMULAS.map(f => (
                        <button key={f.key} type="button" onClick={() => setEntFormula(f.key)}
                          className={cn("text-xs px-3 py-2 rounded-lg border text-left transition-all",
                            entFormula === f.key ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-border hover:border-emerald-300"
                          )}>
                          <div className="font-semibold">{f.label}</div>
                          <div className="text-[10px] text-muted-foreground">{f.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Modo de infusão</Label>
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {ENTERAL_MODES.map(m => (
                        <button key={m.key} type="button" onClick={() => setEntMode(m.key)}
                          className={cn("text-xs px-3 py-2 rounded-lg border text-left transition-all",
                            entMode === m.key ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-border hover:border-emerald-300"
                          )}>
                          <div className="font-semibold">{m.label}</div>
                          <div className="text-[10px] text-muted-foreground">{m.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {entMode === "continua" ? (
                      <div>
                        <Label className="text-xs font-semibold">Vazão (mL/h)</Label>
                        <Input value={entRate} onChange={e => setEntRate(e.target.value)} className="mt-1.5 h-9 text-sm" />
                      </div>
                    ) : (
                      <div>
                        <Label className="text-xs font-semibold">Tomadas/dia</Label>
                        <Input value={entFractions} onChange={e => setEntFractions(e.target.value)} className="mt-1.5 h-9 text-sm" />
                      </div>
                    )}
                    <div>
                      <Label className="text-xs font-semibold">Volume total/dia (mL)</Label>
                      <Input value={entVolDay} onChange={e => setEntVolDay(e.target.value)} className="mt-1.5 h-9 text-sm" />
                    </div>
                    <div className="flex items-end">
                      <div className="text-[10px] text-muted-foreground">
                        {patientWeight ? `Peso ${patientWeight}kg → ~${Math.round(Number(entVolDay) / Number(patientWeight) * 10) / 10} mL/kg` : "Informe peso para kcal/kg"}
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={entProgression} onChange={e => setEntProgression(e.target.checked)} className="rounded" />
                    Incluir esquema de progressão (20 mL/h a cada 6-8h)
                  </label>

                  {/* Água via sonda */}
                  <Separator />
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1.5"><Droplets className="h-3.5 w-3.5 text-blue-500" /> Água via sonda</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">As três opções podem ser combinadas; cada uma gera uma linha própria na prescrição.</p>

                    <div className="mt-2 space-y-2">
                      <label className="flex items-start gap-2 text-xs cursor-pointer p-2 rounded-md border border-border/60 hover:border-emerald-300">
                        <input type="checkbox" checked={waterFlush} onChange={e => setWaterFlush(e.target.checked)} className="rounded mt-0.5" />
                        <div>
                          <div className="font-semibold">Flush de manutenção</div>
                          <div className="text-[10px] text-muted-foreground">30 mL antes/após dieta e medicações para manter pérvia a sonda.</div>
                        </div>
                      </label>

                      <div className={cn("p-2 rounded-md border transition-all", waterScheduled ? "border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20" : "border-border/60")}>
                        <label className="flex items-start gap-2 text-xs cursor-pointer">
                          <input type="checkbox" checked={waterScheduled} onChange={e => setWaterScheduled(e.target.checked)} className="rounded mt-0.5" />
                          <div className="flex-1">
                            <div className="font-semibold">Hidratação enteral programada</div>
                            <div className="text-[10px] text-muted-foreground">Volume e frequência regulares.</div>
                          </div>
                        </label>
                        {waterScheduled && (
                          <div className="grid grid-cols-2 gap-2 mt-2 pl-6">
                            <div>
                              <Label className="text-[10px] font-semibold">Volume por tomada (mL)</Label>
                              <Input value={waterVol} onChange={e => setWaterVol(e.target.value)} className="mt-1 h-8 text-xs" />
                            </div>
                            <div>
                              <Label className="text-[10px] font-semibold">Frequência</Label>
                              <Select value={waterFreq} onValueChange={setWaterFreq}>
                                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="2/2h">2/2h</SelectItem>
                                  <SelectItem value="3/3h">3/3h</SelectItem>
                                  <SelectItem value="4/4h">4/4h</SelectItem>
                                  <SelectItem value="6/6h">6/6h</SelectItem>
                                  <SelectItem value="8/8h">8/8h</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className={cn("p-2 rounded-md border transition-all", waterCorrection ? "border-amber-400 bg-amber-50/30 dark:bg-amber-950/20" : "border-border/60")}>
                        <label className="flex items-start gap-2 text-xs cursor-pointer">
                          <input type="checkbox" checked={waterCorrection} onChange={e => setWaterCorrection(e.target.checked)} className="rounded mt-0.5" />
                          <div className="flex-1">
                            <div className="font-semibold flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-amber-500" /> Correção de distúrbio hidroeletrolítico</div>
                            <div className="text-[10px] text-muted-foreground">Esquema terapêutico (ex.: hipernatremia).</div>
                          </div>
                        </label>
                        {waterCorrection && (
                          <div className="space-y-2 mt-2 pl-6">
                            <div>
                              <Label className="text-[10px] font-semibold">Volume total/dia (mL)</Label>
                              <Input value={waterCorrectionVol} onChange={e => setWaterCorrectionVol(e.target.value)} placeholder="ex: 1500" className="mt-1 h-8 text-xs" />
                            </div>
                            <div>
                              <Label className="text-[10px] font-semibold">Observações (fracionamento, alvo de Na, reavaliação)</Label>
                              <Textarea value={waterCorrectionObs} onChange={e => setWaterCorrectionObs(e.target.value)} placeholder="Ex.: 250 mL 4/4h; alvo Na 145; reavaliar em 12h" className="mt-1 text-xs min-h-[40px]" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Ajustes manuais / observações desta dieta</Label>
                    <Textarea value={entCustom} onChange={e => setEntCustom(e.target.value)} placeholder="Ex.: pausa para fisioterapia respiratória 14h; ajuste conforme glicemia; fórmula caseira do hospital..." className="mt-1.5 text-xs min-h-[50px]" />
                  </div>
                </section>
              )}

              {modalities.has("parenteral") && (
                <section className="rounded-lg border border-border/60 p-3 space-y-3">
                  <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5"><Droplets className="h-3.5 w-3.5" /> Parenteral (NPT)</h3>
                  <div>
                    <Label className="text-xs font-semibold">Tipo de NPT</Label>
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {[
                        { k: "central",    label: "Central (CVC/PICC)", desc: "Osmolaridade alta, longa duração" },
                        { k: "periferica", label: "Periférica",          desc: "Curta duração, ≤ 900 mOsm/L" },
                      ].map(o => (
                        <button key={o.k} type="button" onClick={() => setParType(o.k as any)}
                          className={cn("text-xs px-3 py-2 rounded-lg border text-left transition-all",
                            parType === o.k ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-border hover:border-emerald-300"
                          )}>
                          <div className="font-semibold">{o.label}</div>
                          <div className="text-[10px] text-muted-foreground">{o.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-xs font-semibold">Volume (mL)</Label><Input value={parVolume} onChange={e => setParVolume(e.target.value)} className="mt-1.5 h-9 text-sm" /></div>
                    <div><Label className="text-xs font-semibold">Kcal totais</Label><Input value={parKcal} onChange={e => setParKcal(e.target.value)} placeholder="ex: 1500" className="mt-1.5 h-9 text-sm" /></div>
                    <div><Label className="text-xs font-semibold">Vazão (mL/h)</Label><Input value={parRate} onChange={e => setParRate(e.target.value)} className="mt-1.5 h-9 text-sm" /></div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Composição (macros, eletrólitos, multivitamínico)</Label>
                    <Textarea value={parObs} onChange={e => setParObs(e.target.value)}
                      placeholder="ex: AA 10% 500mL + Glicose 50% 500mL + Lipídeo 20% 250mL + multivit + oligoelementos + KCl 30 mEq + NaCl 60 mEq"
                      className="mt-1.5 text-xs min-h-[60px]" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Ajustes manuais / observações desta dieta</Label>
                    <Textarea value={parCustom} onChange={e => setParCustom(e.target.value)} placeholder="Ex.: ajuste após glicemia; transição gradual para enteral em 48h..." className="mt-1.5 text-xs min-h-[50px]" />
                  </div>
                </section>
              )}
            </div>
          )}

          {/* STEP 2 — Comorbidades */}
          {step === 2 && (
            <div className="space-y-3 p-1">
              <p className="text-xs text-muted-foreground">
                Selecione as comorbidades/condições do paciente. As recomendações terapêuticas serão incorporadas automaticamente.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {COMORBIDITIES.map(c => {
                  const sel = comorbs.has(c.key);
                  return (
                    <button key={c.key} type="button" onClick={() => toggleComorb(c.key)}
                      className={cn("text-[11px] px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5",
                        sel ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" : "border-border hover:border-amber-300"
                      )}>
                      {sel && <Check className="h-3 w-3" />}
                      <span className="font-semibold">{c.label}</span>
                      <span className="text-muted-foreground text-[10px]">— {c.hint}</span>
                    </button>
                  );
                })}
              </div>
              <Separator />
              <div>
                <Label className="text-xs font-semibold">Observações gerais (aplicam-se a todas as modalidades)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: avaliação de fonoaudiologia; reavaliação nutricional em 48h; meta nutricional plena em 72h..."
                  className="mt-1.5 text-xs min-h-[60px]" />
              </div>
            </div>
          )}

          {/* STEP 3 — Revisão */}
          {step === 3 && (
            <div className="space-y-2 p-1">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Activity className="h-3.5 w-3.5 text-emerald-500" />
                  Itens que serão adicionados à prescrição:
                </div>
                <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setStep(0)}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar outra modalidade
                </Button>
              </div>
              {entries.map((e, i) => (
                <div key={e.id} className="rounded-lg border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 p-3">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">{i + 1}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-emerald-800 dark:text-emerald-200">{e.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {[e.defaultDose !== "-" ? e.defaultDose : null,
                          e.defaultRoute !== "-" ? e.defaultRoute : null,
                          e.defaultPosology !== "-" ? e.defaultPosology : null].filter(Boolean).join(" · ")}
                      </div>
                      {e.instructions && (
                        <div className="text-[11px] text-muted-foreground mt-1 italic border-l-2 border-emerald-300 pl-2">
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
            {step < 3 ? (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={!canAdvance} onClick={() => setStep(s => Math.min(3, s + 1))}>
                Avançar <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirm} disabled={entries.length === 0}>
                <Check className="h-3.5 w-3.5 mr-1" /> Adicionar à prescrição ({entries.length})
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
