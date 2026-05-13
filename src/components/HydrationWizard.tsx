import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Droplets, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MedicationEntry } from "@/data/medicationsDatabase";

const SOLUTIONS = [
  { key: "sf", label: "SF 0,9%", detail: "Cristaloide isotônico" },
  { key: "rl", label: "Ringer Lactato", detail: "Cristaloide balanceado" },
  { key: "rs", label: "Ringer Simples", detail: "Cristaloide sem lactato" },
  { key: "sg5", label: "SG 5%", detail: "Glicosado — água livre" },
  { key: "sg10", label: "SG 10%", detail: "Glicosado — hipoglicemia" },
  { key: "sgf", label: "Glicofisiológico", detail: "SG 5% + SF 0,9%" },
  { key: "ad", label: "Água Destilada", detail: "Diluente" },
  { key: "custom", label: "Solução preparada", detail: "Base + aditivos" },
] as const;

// Fases mapeadas a intervalo (24h / fases)
const PHASE_OPTIONS = [
  { phases: 1, interval: "24/24h" },
  { phases: 2, interval: "12/12h" },
  { phases: 3, interval: "8/8h" },
  { phases: 4, interval: "6/6h" },
  { phases: 6, interval: "4/4h" },
  { phases: 8, interval: "3/3h" },
  { phases: 12, interval: "2/2h" },
  { phases: 24, interval: "1/1h" },
];

const ACCESS_OPTIONS = [
  "Periférico", "Central (CVC)", "PICC", "Intraósseo", "Hipodermóclise", "Cateter umbilical",
];

const DRIP_FACTOR = 20; // macrogotas/mL padrão

export function HydrationWizard({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (entries: MedicationEntry[]) => void;
}) {
  const [solution, setSolution] = useState<string>("sf");
  const [base, setBase] = useState<string>("SG5%");
  const [additives, setAdditives] = useState<string>("NaCl 20% 20mL + KCl 19,1% 10mL");

  const [volumePhase, setVolumePhase] = useState<string>("500"); // mL por fase
  const [phases, setPhases] = useState<number>(4); // nº de fases
  const [phaseTimeValue, setPhaseTimeValue] = useState<string>("2");
  const [phaseTimeUnit, setPhaseTimeUnit] = useState<"h" | "min">("h");
  const [dripUnit, setDripUnit] = useState<"gtt/min" | "mL/h">("mL/h");
  const [access, setAccess] = useState<string>("Periférico");

  const [prn, setPrn] = useState(false);
  const [criterio, setCriterio] = useState(false);
  const [notes, setNotes] = useState<string>("");

  const sel = SOLUTIONS.find(s => s.key === solution)!;
  const interval = PHASE_OPTIONS.find(p => p.phases === phases)?.interval ?? "—";

  // Cálculos
  const tempoMin = (parseFloat(phaseTimeValue) || 0) * (phaseTimeUnit === "h" ? 60 : 1);
  const vol = parseFloat(volumePhase) || 0;
  const mlh = tempoMin > 0 ? (vol / (tempoMin / 60)) : 0;
  const gttMin = tempoMin > 0 ? (vol * DRIP_FACTOR) / tempoMin : 0;
  const dripValue = dripUnit === "mL/h" ? mlh : gttMin;
  const volumeTotal = vol * phases;

  const entries = useMemo<MedicationEntry[]>(() => {
    const isCustom = solution === "custom";
    const baseName = isCustom ? `${base} ${vol}mL + ${additives}` : `${sel.label} ${vol}mL`;
    const flags = [prn && "Se necessário", criterio && "A critério médico"].filter(Boolean).join(" · ");
    const dripStr = dripUnit === "mL/h" ? `${mlh.toFixed(0)} mL/h` : `${gttMin.toFixed(0)} gtt/min`;
    const instr = `${phases} fase(s) de ${vol}mL · ${interval} · ${phaseTimeValue}${phaseTimeUnit}/fase · ${dripStr} · Acesso: ${access} · Total ${volumeTotal}mL/24h`;
    return [{
      id: `hyd-${Date.now()}`,
      name: baseName,
      presentation: "Solução",
      defaultDose: `${vol}mL`,
      defaultRoute: "Intravenosa",
      defaultPosology: interval,
      defaultSchedule: interval,
      instructions: [instr, flags, notes].filter(Boolean).join(" · "),
      category: "hydration" as const,
    }];
  }, [solution, base, additives, sel.label, vol, phases, interval, phaseTimeValue, phaseTimeUnit, dripUnit, mlh, gttMin, access, volumeTotal, prn, criterio, notes]);

  const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-md border text-xs font-medium transition-all",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
      )}
    >
      {children}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100svh-6rem)] top-4 translate-y-0 z-[80] overflow-y-auto p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Droplets className="h-5 w-5" /> Assistente de Hidratação
          </DialogTitle>
          <DialogDescription className="text-xs">Defina volume por fase, número de fases (com intervalo automático), tempo por fase e acesso. Gotejamento e volume total são calculados automaticamente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Solução */}
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Solução</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1.5">
              {SOLUTIONS.map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSolution(s.key)}
                  className={cn(
                    "text-left p-2 rounded-md border transition-all",
                    solution === s.key
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                      : "border-border bg-background hover:border-blue-300"
                  )}
                >
                  <p className="text-xs font-semibold">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{s.detail}</p>
                </button>
              ))}
            </div>
          </div>

          {solution === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 rounded-md bg-muted/30 border border-border">
              <div>
                <Label className="text-[10px]">Base</Label>
                <Input value={base} onChange={(e) => setBase(e.target.value)} className="h-7 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Aditivos</Label>
                <Input value={additives} onChange={(e) => setAdditives(e.target.value)} className="h-7 text-xs" />
              </div>
            </div>
          )}

          {/* Campos otimizados em grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Volume / fase (mL)</Label>
              <Input
                type="number"
                value={volumePhase}
                onChange={(e) => setVolumePhase(e.target.value)}
                className="h-7 text-xs"
              />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Fases / intervalo</Label>
              <Select value={String(phases)} onValueChange={(v) => setPhases(Number(v))}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[90]">
                  {PHASE_OPTIONS.map(p => (
                    <SelectItem key={p.phases} value={String(p.phases)} className="text-xs">
                      {p.phases} fase{p.phases > 1 ? "s" : ""} ({p.interval})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tempo / fase</Label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  value={phaseTimeValue}
                  onChange={(e) => setPhaseTimeValue(e.target.value)}
                  className="h-7 text-xs"
                />
                <Select value={phaseTimeUnit} onValueChange={(v) => setPhaseTimeUnit(v as "h" | "min")}>
                  <SelectTrigger className="h-7 text-xs w-16"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[90]">
                    <SelectItem value="h" className="text-xs">h</SelectItem>
                    <SelectItem value="min" className="text-xs">min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Gotejamento</Label>
              <div className="flex gap-1 items-center">
                <div className="h-7 px-2 flex items-center rounded-md border border-border bg-muted/30 text-xs font-semibold flex-1">
                  {isFinite(dripValue) && dripValue > 0 ? dripValue.toFixed(0) : "—"}
                </div>
                <Select value={dripUnit} onValueChange={(v) => setDripUnit(v as "gtt/min" | "mL/h")}>
                  <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[90]">
                    <SelectItem value="mL/h" className="text-xs">mL/h</SelectItem>
                    <SelectItem value="gtt/min" className="text-xs">gtt/min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Acesso</Label>
              <Select value={access} onValueChange={setAccess}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[90]">
                  {ACCESS_OPTIONS.map(a => (
                    <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 sm:col-span-2 mt-1">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox checked={prn} onCheckedChange={(v) => setPrn(!!v)} />
                Se necessário
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox checked={criterio} onCheckedChange={(v) => setCriterio(!!v)} />
                A critério médico
              </label>
            </div>
          </div>

          <div>
            <Label className="text-[10px]">Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[40px] text-xs" placeholder="Ex: manter acesso pérvio, cuidado em IC descompensada..." />
          </div>

          {/* Resultado / Pré-visualização */}
          <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 p-2 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Resultado
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Volume da fase:</span> <strong>{vol}mL</strong></div>
              <div><span className="text-muted-foreground">Volume total (24h):</span> <strong>{volumeTotal}mL</strong></div>
            </div>
            <p className="text-xs font-medium pt-1">{entries[0].name}</p>
            <p className="text-[11px] text-muted-foreground">{entries[0].instructions}</p>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={() => { onAdd(entries); onOpenChange(false); }} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Adicionar à prescrição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
