import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Droplets, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MedicationEntry } from "@/data/medicationsDatabase";

const SOLUTIONS = [
  { key: "sf", label: "SF 0,9%", detail: "Cristaloide isotônico — manutenção, ressuscitação volêmica" },
  { key: "rl", label: "Ringer Lactato", detail: "Cristaloide balanceado — sepse, queimadura, perdas" },
  { key: "rs", label: "Ringer Simples", detail: "Cristaloide — sem lactato; situações pontuais" },
  { key: "sg5", label: "SG 5%", detail: "Glicosado — aporte calórico e água livre" },
  { key: "sg10", label: "SG 10%", detail: "Glicosado — hipoglicemia, aporte calórico" },
  { key: "sgf", label: "Glicofisiológico", detail: "SG 5% + SF 0,9% — manutenção pediátrica/adulto" },
  { key: "ad", label: "Água Destilada", detail: "Diluente — não usar isolada para hidratação" },
  { key: "custom", label: "Solução preparada", detail: "SG/SF + aditivos (NaCl, KCl, etc.)" },
] as const;

const VOLUMES = ["100", "250", "500", "1000"];

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
  const [volume, setVolume] = useState<string>("500");
  const [rateMode, setRateMode] = useState<"continuous" | "interval" | "fast">("continuous");
  const [rate, setRate] = useState<string>("125"); // mL/h
  const [interval, setInterval] = useState<string>("8/8h");
  const [bolusTime, setBolusTime] = useState<string>("30"); // min
  // Custom solution additives
  const [base, setBase] = useState<string>("SG5%");
  const [additives, setAdditives] = useState<string>("NaCl 20% 20mL + KCl 19,1% 10mL");
  const [notes, setNotes] = useState<string>("");

  const sel = SOLUTIONS.find(s => s.key === solution)!;

  const entries = useMemo<MedicationEntry[]>(() => {
    const isCustom = solution === "custom";
    const name = isCustom
      ? `${base} ${volume}mL + ${additives}`
      : `${sel.label} ${volume}mL`;
    const posology =
      rateMode === "continuous" ? "Contínuo" :
      rateMode === "interval" ? interval :
      "Dose única";
    const instr =
      rateMode === "continuous" ? `Infusão contínua a ${rate} mL/h em BIC` :
      rateMode === "interval" ? `${volume}mL ${interval}` :
      `Infundir ${volume}mL em ${bolusTime} min`;
    return [{
      id: `hyd-${Date.now()}`,
      name,
      presentation: "Solução",
      defaultDose: `${volume}mL`,
      defaultRoute: "Intravenosa",
      defaultPosology: posology,
      defaultSchedule: rateMode === "interval" ? interval : "ACM",
      instructions: [instr, notes].filter(Boolean).join(" · "),
      category: "hydration" as const,
    }];
  }, [solution, volume, rateMode, rate, interval, bolusTime, base, additives, notes, sel.label]);

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
          <DialogDescription className="text-xs">Selecione a solução, volume e modo de infusão. Você poderá ajustar tudo na linha da prescrição depois.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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
                <Input value={base} onChange={(e) => setBase(e.target.value)} className="h-7 text-xs" placeholder="SG5%, SF0,9%, AD" />
              </div>
              <div>
                <Label className="text-[10px]">Aditivos</Label>
                <Input value={additives} onChange={(e) => setAdditives(e.target.value)} className="h-7 text-xs" placeholder="NaCl 20% 20mL + KCl 19,1% 10mL" />
              </div>
            </div>
          )}

          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Volume da bolsa (mL)</Label>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {VOLUMES.map(v => (
                <Chip key={v} active={volume === v} onClick={() => setVolume(v)}>{v}</Chip>
              ))}
              <Input value={volume} onChange={(e) => setVolume(e.target.value)} className="h-7 w-20 text-xs" placeholder="custom" />
            </div>
          </div>

          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Modo de infusão</Label>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              <Chip active={rateMode === "continuous"} onClick={() => setRateMode("continuous")}>Contínuo (BIC)</Chip>
              <Chip active={rateMode === "interval"} onClick={() => setRateMode("interval")}>Intermitente</Chip>
              <Chip active={rateMode === "fast"} onClick={() => setRateMode("fast")}>Bolus / Rápido</Chip>
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rateMode === "continuous" && (
                <div>
                  <Label className="text-[10px]">Vazão (mL/h)</Label>
                  <Input value={rate} onChange={(e) => setRate(e.target.value)} className="h-7 text-xs" />
                </div>
              )}
              {rateMode === "interval" && (
                <div>
                  <Label className="text-[10px]">Intervalo</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {["6/6h", "8/8h", "12/12h", "24/24h"].map(i => (
                      <Chip key={i} active={interval === i} onClick={() => setInterval(i)}>{i}</Chip>
                    ))}
                  </div>
                </div>
              )}
              {rateMode === "fast" && (
                <div>
                  <Label className="text-[10px]">Tempo de infusão (min)</Label>
                  <Input value={bolusTime} onChange={(e) => setBolusTime(e.target.value)} className="h-7 text-xs" />
                </div>
              )}
            </div>
          </div>

          <div>
            <Label className="text-[10px]">Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[40px] text-xs" placeholder="Ex: manter acesso pérvio, cuidado em IC descompensada..." />
          </div>

          <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 p-2">
            <p className="text-[10px] uppercase tracking-wider text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-1"><Sparkles className="h-3 w-3" /> Pré-visualização</p>
            <p className="text-xs mt-1 font-medium">{entries[0].name}</p>
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
