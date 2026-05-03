import { useMemo, useState } from "react";
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
  UtensilsCrossed, Soup, Milk, Pill, Droplets, AlertTriangle, Check,
  Ban, ChevronRight, ChevronLeft, Sparkles, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MedicationEntry } from "@/data/medicationsDatabase";

/**
 * Nutrition Wizard — Terapia Nutricional Hospitalar
 * Fluxo guiado para prescrição de:
 *  - Dieta zero (NPO) com motivo/tempo
 *  - Via oral (consistência + perfil terapêutico)
 *  - Enteral (via, fórmula, modo de infusão, progressão)
 *  - Parenteral (central/periférica, volume, observações)
 *
 * Inclui chips de comorbidades para ajustar automaticamente o perfil.
 * Retorna entradas no formato MedicationEntry para reaproveitar o fluxo
 * de adição de itens da prescrição (categoria nutrition).
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
  { key: "pastosa",     label: "Pastosa",              desc: "Liquidificada/amassada, sem necessidade de mastigar" },
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
  { key: "gtt", label: "GTT", desc: "Gastrostomia" },
  { key: "jtt", label: "JTT", desc: "Jejunostomia" },
] as const;

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
  const [modality, setModality] = useState<NutritionModality>("oral");
  const [comorbs, setComorbs] = useState<Set<ComorbKey>>(new Set());

  // Oral
  const [oralConsist, setOralConsist] = useState<string>("geral");
  const [oralProfiles, setOralProfiles] = useState<Set<string>>(new Set(["livre"]));
  const [oralFraction, setOralFraction] = useState<string>("6x/dia");
  const [oralWaterFree, setOralWaterFree] = useState(true);

  // Enteral
  const [entVia, setEntVia] = useState<string>("sne");
  const [entFormula, setEntFormula] = useState<string>("polim_padrao");
  const [entMode, setEntMode] = useState<string>("continua");
  const [entRate, setEntRate] = useState<string>("25");      // mL/h
  const [entVolDay, setEntVolDay] = useState<string>("1500"); // mL/dia
  const [entFractions, setEntFractions] = useState<string>("6");
  const [entProgression, setEntProgression] = useState(true);
  const [entFlush, setEntFlush] = useState(true);

  // Parenteral
  const [parType, setParType] = useState<"central" | "periferica">("central");
  const [parVolume, setParVolume] = useState<string>("1500");
  const [parKcal, setParKcal] = useState<string>("");
  const [parRate, setParRate] = useState<string>("");
  const [parObs, setParObs] = useState<string>("");

  // Zero
  const [zeroReason, setZeroReason] = useState<string>("preop");
  const [zeroSince, setZeroSince] = useState<string>("");
  const [zeroHydrate, setZeroHydrate] = useState(true);

  // Free notes
  const [notes, setNotes] = useState<string>("");

  const reset = () => {
    setStep(0); setModality("oral"); setComorbs(new Set());
    setOralConsist("geral"); setOralProfiles(new Set(["livre"])); setOralFraction("6x/dia"); setOralWaterFree(true);
    setEntVia("sne"); setEntFormula("polim_padrao"); setEntMode("continua");
    setEntRate("25"); setEntVolDay("1500"); setEntFractions("6"); setEntProgression(true); setEntFlush(true);
    setParType("central"); setParVolume("1500"); setParKcal(""); setParRate(""); setParObs("");
    setZeroReason("preop"); setZeroSince(""); setZeroHydrate(true);
    setNotes("");
  };

  const toggleComorb = (k: ComorbKey) => {
    setComorbs(prev => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      // Sugestões automáticas: ao marcar HAS, sugerir hipossódica; DM → para diabético, etc.
      const profileMap: Record<string, string> = {
        has: "hipossodica", dm: "dm", drc: "hipoprot", hepato: "hipoprot",
        ic: "hipossodica", celiaco: "sem_gluten", lactose: "sem_lactose",
        constip: "rica_fibras", diarreia: "pobre_fibras", pancrea: "hipolip",
        obeso: "hipocal", desnut: "hipercal",
      };
      if (modality === "oral" && profileMap[k] && n.has(k as any)) {
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

  // Build prescription entries from wizard state
  const buildEntries = (): MedicationEntry[] => {
    const entries: MedicationEntry[] = [];
    const comorbStr = Array.from(comorbs)
      .map(k => COMORBIDITIES.find(c => c.key === k)?.label)
      .filter(Boolean)
      .join(", ");
    const comorbSuffix = comorbStr ? ` — Comorbidades: ${comorbStr}` : "";

    if (modality === "zero") {
      const reason = ZERO_REASONS.find(r => r.key === zeroReason)?.label || "";
      entries.push({
        id: `nut-zero-${uid()}`,
        name: "Dieta zero (NPO)",
        presentation: "-",
        defaultDose: "-",
        defaultRoute: "-",
        defaultPosology: "Contínuo",
        defaultSchedule: "-",
        instructions: [
          `Motivo: ${reason}`,
          zeroSince ? `Em jejum desde: ${zeroSince}` : null,
          "Reavaliar reintrodução de dieta a cada 12-24h",
          comorbSuffix.trim(),
          notes,
        ].filter(Boolean).join(" · "),
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
      return entries;
    }

    if (modality === "oral") {
      const consist = ORAL_CONSISTENCIES.find(c => c.key === oralConsist)?.label || "";
      const profiles = Array.from(oralProfiles)
        .map(k => ORAL_PROFILES.find(p => p.key === k)?.label)
        .filter(Boolean)
        .join(" + ");
      entries.push({
        id: `nut-oral-${uid()}`,
        name: `Dieta via oral — ${consist}${profiles ? ` (${profiles})` : ""}`,
        presentation: "-",
        defaultDose: "-",
        defaultRoute: "Oral",
        defaultPosology: oralFraction,
        defaultSchedule: "07h, 10h, 12h, 15h, 18h, 21h",
        instructions: [
          "Ofertar conforme aceitação; observar resíduo e tolerância",
          comorbSuffix.trim(),
          notes,
        ].filter(Boolean).join(" · "),
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
      return entries;
    }

    if (modality === "enteral") {
      const via = ENTERAL_VIAS.find(v => v.key === entVia)?.label || "";
      const formula = ENTERAL_FORMULAS.find(f => f.key === entFormula)?.label || "";
      const mode = ENTERAL_MODES.find(m => m.key === entMode)?.label || "";
      const dose = entMode === "continua"
        ? `${entRate} mL/h (${entVolDay} mL/dia)`
        : `${entVolDay} mL/dia em ${entFractions} tomadas`;
      entries.push({
        id: `nut-ent-${uid()}`,
        name: `Dieta enteral — ${formula} via ${via}`,
        presentation: "-",
        defaultDose: dose,
        defaultRoute: via === "GTT" ? "Gastrostomia" : "Enteral (SNE/SNG)",
        defaultPosology: mode,
        defaultSchedule: entMode === "continua" ? "Contínua 24h" : "06h, 10h, 14h, 18h, 22h, 02h",
        instructions: [
          entProgression ? "Iniciar com 20 mL/h; progredir 20 mL/h a cada 6-8h conforme tolerância (resíduo gástrico, distensão, diarreia)" : null,
          "Cabeceira elevada a 30-45° durante e até 1h após a infusão",
          "Avaliar resíduo gástrico a cada 6h (suspender se > 250 mL)",
          comorbs.has("uti") ? "Meta: 25-30 kcal/kg/dia + 1,2-2 g/kg/dia de proteína" : null,
          comorbSuffix.trim(),
          notes,
        ].filter(Boolean).join(" · "),
        category: "nutrition",
      });
      if (entFlush) {
        entries.push({
          id: `nut-ent-flush-${uid()}`,
          name: "Flush de água via sonda",
          presentation: "-",
          defaultDose: "30 mL",
          defaultRoute: via === "GTT" ? "Gastrostomia" : "Enteral (SNE/SNG)",
          defaultPosology: "4/4h",
          defaultSchedule: "ACM",
          instructions: "Antes e após dieta/medicações para manter pérvia a sonda",
          category: "nutrition",
        });
      }
      return entries;
    }

    if (modality === "parenteral") {
      entries.push({
        id: `nut-par-${uid()}`,
        name: `NPT ${parType === "central" ? "central" : "periférica"}`,
        presentation: "Bolsa NPT",
        defaultDose: `${parVolume} mL${parKcal ? ` (${parKcal} kcal)` : ""}`,
        defaultRoute: "Intravenosa",
        defaultPosology: "Contínuo",
        defaultSchedule: "Infusão contínua 24h",
        instructions: [
          parType === "central" ? "Acesso venoso central exclusivo (PICC/CVC) — não infundir junto com medicações" : "Acesso periférico — osmolaridade ≤ 900 mOsm/L",
          parRate ? `Vazão: ${parRate} mL/h (BIC)` : "Programar BIC",
          "Monitorar glicemia 6/6h, ionograma diário, função hepática 2x/sem",
          "Trocar bolsa a cada 24h; não exceder 24h após manipulação",
          parObs,
          comorbSuffix.trim(),
          notes,
        ].filter(Boolean).join(" · "),
        category: "nutrition",
      });
      return entries;
    }

    return entries;
  };

  const entries = useMemo(buildEntries, [
    modality, comorbs, oralConsist, oralProfiles, oralFraction, oralWaterFree,
    entVia, entFormula, entMode, entRate, entVolDay, entFractions, entProgression, entFlush,
    parType, parVolume, parKcal, parRate, parObs,
    zeroReason, zeroSince, zeroHydrate, notes,
  ]);

  const handleConfirm = () => {
    onAdd(entries);
    reset();
    onOpenChange(false);
  };

  const STEPS = ["Modalidade", "Detalhes", "Comorbidades", "Revisão"];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            Assistente de Terapia Nutricional
          </DialogTitle>
          <DialogDescription className="text-xs">
            Fluxo guiado para prescrição nutricional baseada em consistência, perfil terapêutico e comorbidades.
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
          {/* STEP 0 — Modalidade */}
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3 p-1">
              {[
                { k: "zero",       icon: Ban,             label: "Dieta zero",       desc: "Jejum / NPO com motivo" },
                { k: "oral",       icon: UtensilsCrossed, label: "Via oral",         desc: "Consistência + perfil" },
                { k: "enteral",    icon: Soup,            label: "Enteral",          desc: "Sonda — fórmula + infusão" },
                { k: "parenteral", icon: Droplets,        label: "Parenteral (NPT)", desc: "Central ou periférica" },
              ].map(opt => {
                const Icon = opt.icon;
                const sel = modality === opt.k;
                return (
                  <button
                    key={opt.k}
                    type="button"
                    onClick={() => setModality(opt.k as NutritionModality)}
                    className={cn(
                      "p-4 rounded-xl border-2 text-left transition-all hover:shadow-md",
                      sel ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-md"
                          : "border-border hover:border-emerald-300"
                    )}
                  >
                    <Icon className={cn("h-6 w-6 mb-2", sel ? "text-emerald-600" : "text-muted-foreground")} />
                    <div className={cn("font-semibold text-sm", sel && "text-emerald-700 dark:text-emerald-300")}>{opt.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP 1 — Detalhes por modalidade */}
          {step === 1 && (
            <div className="space-y-4 p-1">
              {modality === "zero" && (
                <>
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
                </>
              )}

              {modality === "oral" && (
                <>
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
                </>
              )}

              {modality === "enteral" && (
                <>
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
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={entProgression} onChange={e => setEntProgression(e.target.checked)} className="rounded" />
                      Incluir esquema de progressão (20 mL/h a cada 6-8h)
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={entFlush} onChange={e => setEntFlush(e.target.checked)} className="rounded" />
                      Adicionar flush de água via sonda (30 mL 4/4h)
                    </label>
                  </div>
                </>
              )}

              {modality === "parenteral" && (
                <>
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
                    <Label className="text-xs font-semibold">Composição/observações (macros, eletrólitos, multivitamínico)</Label>
                    <Textarea value={parObs} onChange={e => setParObs(e.target.value)}
                      placeholder="ex: AA 10% 500mL + Glicose 50% 500mL + Lipídeo 20% 250mL + multivit + oligoelementos + KCl 30 mEq + NaCl 60 mEq"
                      className="mt-1.5 text-xs min-h-[70px]" />
                  </div>
                </>
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
                <Label className="text-xs font-semibold">Observações adicionais</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: avaliação de fonoaudiologia para deglutição; reavaliação nutricional em 48h; meta nutricional plena em 72h..."
                  className="mt-1.5 text-xs min-h-[70px]" />
              </div>
            </div>
          )}

          {/* STEP 3 — Revisão */}
          {step === 3 && (
            <div className="space-y-2 p-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Activity className="h-3.5 w-3.5 text-emerald-500" />
                Itens que serão adicionados à prescrição:
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
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} className="bg-emerald-600 hover:bg-emerald-700">
                Continuar <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700">
                <Check className="h-3.5 w-3.5 mr-1" /> Adicionar à prescrição ({entries.length})
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
