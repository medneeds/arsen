import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FlaskConical, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MedicationEntry } from "@/data/medicationsDatabase";

type Disorder = "hipoK" | "hipoMg" | "hipoCa" | "hipoNa" | "hipoP" | "hiperK" | "hiperNa" | "acidose";

const DISORDERS: { key: Disorder; label: string; detail: string }[] = [
  { key: "hipoK", label: "Hipocalemia", detail: "K⁺ < 3,5 mEq/L" },
  { key: "hipoMg", label: "Hipomagnesemia", detail: "Mg < 1,7 mg/dL" },
  { key: "hipoCa", label: "Hipocalcemia", detail: "Ca iônico baixo" },
  { key: "hipoNa", label: "Hiponatremia", detail: "Na < 135 mEq/L" },
  { key: "hipoP", label: "Hipofosfatemia", detail: "P < 2,5 mg/dL" },
  { key: "hiperK", label: "Hipercalemia", detail: "K⁺ > 5,5 mEq/L" },
  { key: "hiperNa", label: "Hipernatremia", detail: "Na > 145 mEq/L" },
  { key: "acidose", label: "Acidose metabólica", detail: "HCO₃⁻ baixo, pH < 7,30" },
];

type Recipe = { name: string; presentation: string; dose: string; route: string; posology: string; instructions: string };

function buildRecipe(d: Disorder, severity: "leve" | "moderada" | "grave", value: string): Recipe[] {
  switch (d) {
    case "hipoK":
      return severity === "grave"
        ? [{ name: "Cloreto de Potássio (KCl) 19,1%", presentation: "10mL — Ampola", dose: "20 mL (40 mEq)", route: "Intravenosa", posology: "Em 4h", instructions: `Diluir em 500mL SF0,9% — máx 20 mEq/h em acesso periférico (até 40 mEq/h em CVC com monitor). K atual: ${value || "—"}` }]
        : severity === "moderada"
        ? [{ name: "Cloreto de Potássio (KCl) 19,1%", presentation: "10mL — Ampola", dose: "10 mL (20 mEq)", route: "Intravenosa", posology: "8/8h", instructions: `Diluir em 250mL SF0,9%. Infundir em 2h. NUNCA bolus. K atual: ${value || "—"}` }]
        : [{ name: "Cloreto de Potássio xarope 6%", presentation: "Frasco 150mL", dose: "15 mL (12 mEq)", route: "Oral", posology: "8/8h", instructions: `Diluir em suco. K atual: ${value || "—"}` }];
    case "hipoMg":
      return [{ name: "Sulfato de Magnésio 50%", presentation: "10mL — Ampola", dose: severity === "grave" ? "4 amp (8g)" : severity === "moderada" ? "2 amp (4g)" : "1 amp (2g)", route: "Intravenosa", posology: severity === "grave" ? "Em 4h" : "24/24h", instructions: `Diluir em 100-250mL SF0,9%. Infundir em 1-4h. Mg atual: ${value || "—"}` }];
    case "hipoCa":
      return [{ name: "Gluconato de Cálcio 10%", presentation: "10mL — Ampola", dose: severity === "grave" ? "2 amp (2g)" : "1 amp (1g)", route: "Intravenosa", posology: severity === "grave" ? "Em 30 min, repetir SOS" : "8/8h", instructions: `Diluir em 100mL SG5%. Infundir em 30-60 min. Incompatível com bicarbonato. Ca iônico: ${value || "—"}` }];
    case "hipoNa":
      return severity === "grave"
        ? [{ name: "NaCl 3% (hipertônica)", presentation: "Solução preparada", dose: "150 mL", route: "Intravenosa", posology: "Bolus em 10-20 min, repetir até 3x", instructions: `Indicada em sintomas neurológicos. Meta: ↑Na 4-6 mEq/L em 6h, máx 8 mEq/L em 24h. Na atual: ${value || "—"}` }]
        : [{ name: "Restrição hídrica + SF 0,9%", presentation: "Plano clínico", dose: "—", route: "—", posology: "—", instructions: `Investigar causa (SIADH, hipovolêmica, dilucional). Corrigir lentamente — máx 8 mEq/L/24h. Na atual: ${value || "—"}` }];
    case "hipoP":
      return [{ name: "Fosfato de Potássio 2 mEq/mL", presentation: "10mL — Ampola", dose: severity === "grave" ? "30 mmol" : "15 mmol", route: "Intravenosa", posology: severity === "grave" ? "Em 6h" : "12/12h", instructions: `Diluir em 250mL SF0,9%. Infundir em 4-6h. Atenção ao K coadministrado. P atual: ${value || "—"}` }];
    case "hiperK":
      return [
        { name: "Gluconato de Cálcio 10%", presentation: "10mL — Ampola", dose: "10-20 mL", route: "Intravenosa", posology: "Bolus em 5-10 min", instructions: "Estabilização de membrana — repetir em 5 min se ECG persistir alterado." },
        { name: "Insulina Regular + Glicose 50%", presentation: "Bolus", dose: "10 UI insulina + 50 mL G50%", route: "Intravenosa", posology: "Dose única — repetir 4/4h SN", instructions: "Shift intracelular. Monitorar glicemia capilar 1/1h x 6h." },
        { name: "Bicarbonato de Sódio 8,4%", presentation: "10mL — Ampola", dose: "100 mEq", route: "Intravenosa", posology: "Em 30 min", instructions: `Apenas se acidose. K atual: ${value || "—"}` },
      ];
    case "hiperNa":
      return [{ name: "SG 5% (água livre)", presentation: "500mL — Bolsa", dose: "Calcular déficit de água livre", route: "Intravenosa", posology: "Contínuo", instructions: `Déficit = 0,6 × peso × (Na atual/140 − 1). Reduzir Na máx 0,5 mEq/L/h, 10 mEq/L/24h. Na atual: ${value || "—"}` }];
    case "acidose":
      return [{ name: "Bicarbonato de Sódio 8,4%", presentation: "10mL — Ampola", dose: "1 mEq/kg", route: "Intravenosa", posology: severity === "grave" ? "Em 30 min" : "Conforme gasometria", instructions: `Apenas se pH < 7,1 ou hipercalemia. Reavaliar gasometria. HCO₃ atual: ${value || "—"}` }];
  }
}

export function ReplacementWizard({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (entries: MedicationEntry[]) => void;
}) {
  const [disorder, setDisorder] = useState<Disorder>("hipoK");
  const [severity, setSeverity] = useState<"leve" | "moderada" | "grave">("moderada");
  const [value, setValue] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const recipes = useMemo(() => buildRecipe(disorder, severity, value), [disorder, severity, value]);

  const entries = useMemo<MedicationEntry[]>(() => recipes.map((r, i) => ({
    id: `rep-${disorder}-${Date.now()}-${i}`,
    name: r.name,
    presentation: r.presentation,
    defaultDose: r.dose,
    defaultRoute: r.route,
    defaultPosology: r.posology,
    defaultSchedule: "ACM",
    instructions: [r.instructions, notes].filter(Boolean).join(" · "),
    category: "replacement" as const,
    highAlert: ["hiperK", "hipoNa", "hipoK"].includes(disorder),
  })), [recipes, disorder, notes]);

  const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick} className={cn(
      "px-2.5 py-1 rounded-md border text-xs font-medium transition-all",
      active ? "bg-sky-600 text-white border-sky-600" : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
    )}>{children}</button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100svh-6rem)] top-4 translate-y-0 z-[80] overflow-y-auto p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
            <FlaskConical className="h-5 w-5" /> Assistente de Reposição / Correção Eletrolítica
          </DialogTitle>
          <DialogDescription className="text-xs">Selecione o distúrbio e a gravidade — o assistente sugere a receita. Você pode editar a dose na linha da prescrição.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Distúrbio</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1.5">
              {DISORDERS.map(d => (
                <button key={d.key} type="button" onClick={() => setDisorder(d.key)}
                  className={cn("text-left p-2 rounded-md border transition-all",
                    disorder === d.key ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30" : "border-border bg-background hover:border-sky-300")}>
                  <p className="text-xs font-semibold">{d.label}</p>
                  <p className="text-[10px] text-muted-foreground">{d.detail}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gravidade</Label>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                <Chip active={severity === "leve"} onClick={() => setSeverity("leve")}>Leve</Chip>
                <Chip active={severity === "moderada"} onClick={() => setSeverity("moderada")}>Moderada</Chip>
                <Chip active={severity === "grave"} onClick={() => setSeverity("grave")}>Grave</Chip>
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Valor laboratorial atual (opcional)</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} className="h-7 text-xs" placeholder="Ex: K 2,8 mEq/L" />
            </div>
          </div>

          <div>
            <Label className="text-[10px]">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[40px] text-xs" placeholder="Ex: paciente em VM, função renal..." />
          </div>

          <div className="rounded-md border border-sky-200 dark:border-sky-900 bg-sky-50/40 dark:bg-sky-950/20 p-2 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-sky-700 dark:text-sky-300 font-semibold flex items-center gap-1"><Sparkles className="h-3 w-3" /> Receita sugerida</p>
            {entries.map((e, i) => (
              <div key={i} className="text-xs">
                <p className="font-medium">{e.name} <span className="text-muted-foreground font-normal">— {e.defaultDose} · {e.defaultRoute} · {e.defaultPosology}</span></p>
                <p className="text-[11px] text-muted-foreground italic leading-snug">{e.instructions}</p>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={() => { onAdd(entries); onOpenChange(false); }} className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white">
            <Sparkles className="h-3.5 w-3.5" /> Adicionar à prescrição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
