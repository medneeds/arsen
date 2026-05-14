import { useEffect, useMemo, useState } from "react";
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
import { useWizardItemQueue } from "@/hooks/useWizardItemQueue";
import { WizardItemQueue } from "@/components/shared/WizardItemQueue";
import {
  WaterOfferingFields,
  DEFAULT_WATER_STATE,
  buildWaterEntryName,
  buildWaterInstruction,
  type WaterOfferingState,
} from "@/components/shared/WaterOfferingFields";

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

const DRIP_FACTOR = 20;

type HydrationMode = "iv" | "enteral";

interface IvSnapshot {
  mode: "iv";
  solution: string;
  base: string;
  additives: string;
  volumePhase: string;
  phases: number;
  phaseTimeValue: string;
  phaseTimeUnit: "h" | "min";
  dripUnit: "gtt/min" | "mL/h";
  access: string;
  prn: boolean;
  criterio: boolean;
  notes: string;
}

interface EnteralSnapshot {
  mode: "enteral";
  water: WaterOfferingState;
}

type HydrationSnapshot = IvSnapshot | EnteralSnapshot;

function ivSnapshotToEntry(s: IvSnapshot): MedicationEntry {
  const sel = SOLUTIONS.find(x => x.key === s.solution)!;
  const interval = PHASE_OPTIONS.find(p => p.phases === s.phases)?.interval ?? "—";
  const tempoMin = (parseFloat(s.phaseTimeValue) || 0) * (s.phaseTimeUnit === "h" ? 60 : 1);
  const vol = parseFloat(s.volumePhase) || 0;
  const mlh = tempoMin > 0 ? vol / (tempoMin / 60) : 0;
  const gttMin = tempoMin > 0 ? (vol * DRIP_FACTOR) / tempoMin : 0;
  const dripStr = s.dripUnit === "mL/h" ? `${mlh.toFixed(0)} mL/h` : `${gttMin.toFixed(0)} gtt/min`;
  const volumeTotal = vol * s.phases;
  const isCustom = s.solution === "custom";
  const baseName = isCustom ? `${s.base} ${vol}mL + ${s.additives}` : `${sel.label} ${vol}mL`;
  const flags = [s.prn && "Se necessário", s.criterio && "A critério médico"].filter(Boolean).join(" · ");
  const instr = `${s.phases} fase(s) de ${vol}mL · ${interval} · ${s.phaseTimeValue}${s.phaseTimeUnit}/fase · ${dripStr} · Acesso: ${s.access} · Total ${volumeTotal}mL/24h`;
  return {
    id: `hyd-iv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: baseName,
    presentation: "Solução",
    defaultDose: `${vol}mL`,
    defaultRoute: "Intravenosa",
    defaultPosology: interval,
    defaultSchedule: interval,
    instructions: [instr, flags, s.notes].filter(Boolean).join(" · "),
    category: "hydration" as const,
  };
}

function enteralSnapshotToEntry(s: EnteralSnapshot): MedicationEntry {
  const name = buildWaterEntryName(s.water);
  const route = s.water.route.startsWith("vo")
    ? "Oral"
    : s.water.route === "hipodermo"
      ? "Hipodermóclise"
      : `Enteral (${s.water.route.toUpperCase()})`;
  return {
    id: `hyd-ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    presentation: "Oferta hídrica",
    defaultDose: `${parseFloat(s.water.volumePerOffering) || 0}mL`,
    defaultRoute: route,
    defaultPosology: s.water.fraction,
    defaultSchedule: s.water.fraction,
    instructions: buildWaterInstruction(s.water),
    category: "hydration" as const,
  };
}

function snapshotToEntry(s: HydrationSnapshot): MedicationEntry {
  return s.mode === "iv" ? ivSnapshotToEntry(s) : enteralSnapshotToEntry(s);
}

function snapshotToLabel(s: HydrationSnapshot): { label: string; sublabel: string } {
  const e = snapshotToEntry(s);
  return { label: e.name, sublabel: `${e.defaultRoute} · ${e.defaultPosology}` };
}

export function HydrationWizard({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (entries: MedicationEntry[]) => void;
}) {
  const [mode, setMode] = useState<HydrationMode>("iv");

  // IV state
  const [solution, setSolution] = useState<string>("sf");
  const [base, setBase] = useState<string>("SG5%");
  const [additives, setAdditives] = useState<string>("NaCl 20% 20mL + KCl 19,1% 10mL");
  const [volumePhase, setVolumePhase] = useState<string>("500");
  const [phases, setPhases] = useState<number>(4);
  const [phaseTimeValue, setPhaseTimeValue] = useState<string>("2");
  const [phaseTimeUnit, setPhaseTimeUnit] = useState<"h" | "min">("h");
  const [dripUnit, setDripUnit] = useState<"gtt/min" | "mL/h">("mL/h");
  const [access, setAccess] = useState<string>("Periférico");
  const [prn, setPrn] = useState(false);
  const [criterio, setCriterio] = useState(false);
  const [notes, setNotes] = useState<string>("");

  // Enteral/oral state
  const [water, setWater] = useState<WaterOfferingState>({ ...DEFAULT_WATER_STATE });

  const queue = useWizardItemQueue<HydrationSnapshot>();

  const sel = SOLUTIONS.find(s => s.key === solution)!;
  const interval = PHASE_OPTIONS.find(p => p.phases === phases)?.interval ?? "—";
  const tempoMin = (parseFloat(phaseTimeValue) || 0) * (phaseTimeUnit === "h" ? 60 : 1);
  const vol = parseFloat(volumePhase) || 0;
  const mlh = tempoMin > 0 ? vol / (tempoMin / 60) : 0;
  const gttMin = tempoMin > 0 ? (vol * DRIP_FACTOR) / tempoMin : 0;
  const dripValue = dripUnit === "mL/h" ? mlh : gttMin;
  const volumeTotal = vol * phases;

  const currentSnapshot: HydrationSnapshot = useMemo(() => {
    if (mode === "iv") {
      return { mode, solution, base, additives, volumePhase, phases, phaseTimeValue, phaseTimeUnit, dripUnit, access, prn, criterio, notes };
    }
    return { mode, water };
  }, [mode, solution, base, additives, volumePhase, phases, phaseTimeValue, phaseTimeUnit, dripUnit, access, prn, criterio, notes, water]);

  const previewEntry = useMemo(() => snapshotToEntry(currentSnapshot), [currentSnapshot]);

  // Carrega snapshot ao iniciar edição
  useEffect(() => {
    if (!queue.editingUid) return;
    const it = queue.items.find(x => x.uid === queue.editingUid);
    if (!it) return;
    const s = it.snapshot;
    setMode(s.mode);
    if (s.mode === "iv") {
      setSolution(s.solution); setBase(s.base); setAdditives(s.additives);
      setVolumePhase(s.volumePhase); setPhases(s.phases);
      setPhaseTimeValue(s.phaseTimeValue); setPhaseTimeUnit(s.phaseTimeUnit);
      setDripUnit(s.dripUnit); setAccess(s.access);
      setPrn(s.prn); setCriterio(s.criterio); setNotes(s.notes);
    } else {
      setWater(s.water);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.editingUid]);

  const resetCurrentForm = () => {
    if (mode === "iv") {
      setSolution("sf"); setBase("SG5%"); setAdditives("NaCl 20% 20mL + KCl 19,1% 10mL");
      setVolumePhase("500"); setPhases(4); setPhaseTimeValue("2"); setPhaseTimeUnit("h");
      setDripUnit("mL/h"); setAccess("Periférico"); setPrn(false); setCriterio(false); setNotes("");
    } else {
      setWater({ ...DEFAULT_WATER_STATE });
    }
  };

  const handleAddToQueue = () => {
    const { label, sublabel } = snapshotToLabel(currentSnapshot);
    queue.push(currentSnapshot, label, sublabel);
    resetCurrentForm();
  };

  const handleSaveEditing = () => {
    if (!queue.editingUid) return;
    const { label, sublabel } = snapshotToLabel(currentSnapshot);
    queue.update(queue.editingUid, currentSnapshot, label, sublabel);
    queue.stopEditing();
    resetCurrentForm();
  };

  const handleConfirmAll = () => {
    // Inclui o item em edição (se houver) ou o item atual do form se a fila estiver vazia
    const all: HydrationSnapshot[] = [...queue.items.map(i => i.snapshot)];
    if (queue.items.length === 0) {
      all.push(currentSnapshot);
    }
    const entries = all.map(snapshotToEntry);
    onAdd(entries);
    queue.clear();
    resetCurrentForm();
    onOpenChange(false);
  };

  const totalToSend = queue.items.length === 0 ? 1 : queue.items.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100svh-6rem)] top-4 translate-y-0 z-[80] overflow-y-auto p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Droplets className="h-5 w-5" /> Assistente de Hidratação
          </DialogTitle>
          <DialogDescription className="text-xs">
            Prescreva soluções IV ou ofertas hídricas VO/sonda. Use "+ Acrescentar item" para conjugar várias hidratações em uma única prescrição.
          </DialogDescription>
        </DialogHeader>

        {/* Toggle de modalidade */}
        <div className="flex gap-1 p-1 bg-muted/40 rounded-md mb-2">
          <button
            type="button"
            onClick={() => setMode("iv")}
            className={cn(
              "flex-1 text-xs font-semibold py-1.5 rounded transition-all",
              mode === "iv" ? "bg-background shadow-sm text-blue-700 dark:text-blue-300" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Hidratação IV (cristaloides / preparada)
          </button>
          <button
            type="button"
            onClick={() => setMode("enteral")}
            className={cn(
              "flex-1 text-xs font-semibold py-1.5 rounded transition-all",
              mode === "enteral" ? "bg-background shadow-sm text-cyan-700 dark:text-cyan-300" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Oferta hídrica VO / sonda
          </button>
        </div>

        <div className="space-y-3">
          {mode === "iv" ? (
            <>
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Volume / fase (mL)</Label>
                  <Input type="number" value={volumePhase} onChange={(e) => setVolumePhase(e.target.value)} className="h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Fases / intervalo</Label>
                  <Select value={String(phases)} onValueChange={(v) => setPhases(Number(v))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
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
                    <Input type="number" value={phaseTimeValue} onChange={(e) => setPhaseTimeValue(e.target.value)} className="h-7 text-xs" />
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

              {/* Pré-visualização IV */}
              <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 p-2 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Pré-visualização
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Volume da fase:</span> <strong>{vol}mL</strong></div>
                  <div><span className="text-muted-foreground">Volume total (24h):</span> <strong>{volumeTotal}mL</strong></div>
                </div>
                <p className="text-xs font-medium pt-1">{previewEntry.name}</p>
                <p className="text-[11px] text-muted-foreground">{previewEntry.instructions}</p>
              </div>
            </>
          ) : (
            <>
              <WaterOfferingFields
                value={water}
                onChange={setWater}
                accentClassName="border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30"
                accentTextClassName="text-cyan-700 dark:text-cyan-300"
              />
              <div className="rounded-md border border-cyan-200 dark:border-cyan-900 bg-cyan-50/40 dark:bg-cyan-950/20 p-2 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-cyan-700 dark:text-cyan-300 font-semibold flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Pré-visualização
                </p>
                <p className="text-xs font-medium">{previewEntry.name}</p>
                <p className="text-[11px] text-muted-foreground">{previewEntry.instructions}</p>
              </div>
            </>
          )}

          {/* Fila */}
          <WizardItemQueue
            items={queue.items}
            editingUid={queue.editingUid}
            onEdit={queue.startEditing}
            onRemove={queue.remove}
            onAddCurrent={handleAddToQueue}
            onSaveCurrent={handleSaveEditing}
            addLabel="Acrescentar este item"
            accentClassName="border-blue-300 bg-blue-50/40 text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300"
            hint="Conjugue várias hidratações (ex: SF + RL + oferta de água VO) em uma única prescrição."
          />
        </div>

        <DialogFooter className="pt-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleConfirmAll} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Adicionar {totalToSend > 1 ? `${totalToSend} itens` : "à prescrição"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
