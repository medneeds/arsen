import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Wand2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Generic assistant wizard for refining an already-prescribed item with
 * click-driven steps. Pre-fills with the item's current values and emits a
 * partial patch that the page applies to the item.
 *
 * Supported categories: replacement, hydration, nutrition.
 */

export interface AssistantItemSnapshot {
  id: string;
  name: string;
  category: string;
  // generic infusion fields
  diluent?: string;
  diluentVolume?: string;
  volumeTotal?: string;
  route?: string;
  accessType?: string;
  infusionMode?: 'BIC' | 'gts';
  infusionRate?: string;
  infusionTime?: string;
  infusionTimeUnit?: 'min' | 'h';
  posology?: string;
  instructions?: string;
  // nutrition fields
  nutVolDay?: string;
  nutMode?: string;
  nutFraction?: string;
  nutNightPause?: string;
  nutBedHead?: string;
  nutResidualCheck?: string;
}

export type AssistantPatch = Partial<AssistantItemSnapshot>;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: AssistantItemSnapshot | null;
  onApply: (patch: AssistantPatch) => void;
}

const DILUENTS = [
  { v: 'SF 0,9%', label: 'SF 0,9%', hint: 'Cristaloide isotônico — padrão' },
  { v: 'SG 5%', label: 'SG 5%', hint: 'Reposição de água livre · KCl' },
  { v: 'AD', label: 'Água destilada', hint: 'Reconstituição apenas' },
  { v: 'Ringer Lactato', label: 'Ringer Lactato', hint: 'Reposição balanceada' },
];

const VOLUMES = ['50', '100', '250', '500', '1000'];
const ACCESS = [
  { v: 'Periférico', label: 'EV Periférico', hint: 'Limita K a 20 mEq/h' },
  { v: 'Central (CVC)', label: 'EV Central (CVC)', hint: 'Permite soluções hipertônicas' },
  { v: 'PICC', label: 'PICC', hint: 'Acesso central de inserção periférica' },
];
const ROUTES_NUT = ['Oral', 'SNE', 'SNG', 'Gastrostomia', 'Jejunostomia'];

export function ItemAssistantWizard({ open, onOpenChange, item, onApply }: Props) {
  const isNutrition = item?.category === 'nutrition';
  const isReplacement = item?.category === 'replacement';
  const totalSteps = isNutrition ? 3 : 3;

  const [step, setStep] = useState(0);
  const [patch, setPatch] = useState<AssistantPatch>({});

  useEffect(() => {
    if (open && item) {
      setStep(0);
      setPatch({});
    }
  }, [open, item?.id]);

  if (!item) return null;

  const cur = { ...item, ...patch };
  const set = (p: AssistantPatch) => setPatch(prev => ({ ...prev, ...p }));

  const apply = () => {
    onApply(patch);
    onOpenChange(false);
  };

  const Chip = ({ active, onClick, children, hint }: { active: boolean; onClick: () => void; children: React.ReactNode; hint?: string }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all",
        active ? "bg-sky-600 text-white border-sky-600" : "bg-background text-foreground border-border hover:border-sky-400 hover:bg-sky-50/40 dark:hover:bg-sky-950/20"
      )}
    >
      <div>{children}</div>
      {hint && <div className={cn("text-[10px] mt-0.5 font-normal", active ? "text-sky-50" : "text-muted-foreground")}>{hint}</div>}
    </button>
  );

  // ===== Render steps =====
  const renderInfusionStep = () => {
    if (step === 0) {
      // Diluente + volume
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Diluente</Label>
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              {DILUENTS.map(d => (
                <Chip key={d.v} active={cur.diluent === d.v} onClick={() => set({ diluent: d.v })} hint={d.hint}>{d.label}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Volume total (mL)</Label>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {VOLUMES.map(v => (
                <Chip key={v} active={cur.volumeTotal === v || cur.diluentVolume === v} onClick={() => set({ volumeTotal: v, diluentVolume: v })}>{v} mL</Chip>
              ))}
              <Input
                value={cur.volumeTotal || ''}
                onChange={(e) => set({ volumeTotal: e.target.value, diluentVolume: e.target.value })}
                className="h-8 w-24 text-xs"
                placeholder="custom"
              />
            </div>
          </div>
        </div>
      );
    }
    if (step === 1) {
      // Via / acesso
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Via de administração</Label>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {['Intravenosa', 'Oral', 'Subcutânea', 'Intramuscular'].map(r => (
                <Chip key={r} active={cur.route === r} onClick={() => set({ route: r })}>{r}</Chip>
              ))}
            </div>
          </div>
          {(cur.route || '').toLowerCase().includes('intraven') && (
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo de acesso</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mt-1.5">
                {ACCESS.map(a => (
                  <Chip key={a.v} active={cur.accessType === a.v} onClick={() => set({ accessType: a.v })} hint={a.hint}>{a.label}</Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    // step 2 — velocidade/tempo
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Modo de infusão</Label>
          <div className="flex gap-1.5 mt-1.5">
            <Chip active={cur.infusionMode === 'BIC'} onClick={() => set({ infusionMode: 'BIC' })} hint="mL/h em bomba">BIC</Chip>
            <Chip active={cur.infusionMode === 'gts'} onClick={() => set({ infusionMode: 'gts' })} hint="gotas/min em gravitacional">Gravitacional</Chip>
            <Chip active={cur.posology?.toLowerCase().includes('bolus')} onClick={() => set({ posology: 'Bolus', infusionTime: '10', infusionTimeUnit: 'min' })} hint="Push direto">Bolus</Chip>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">Vazão</Label>
            <Input value={cur.infusionRate || ''} onChange={(e) => set({ infusionRate: e.target.value })} className="h-8 text-xs" placeholder={cur.infusionMode === 'gts' ? 'gts/min' : 'mL/h'} />
          </div>
          <div>
            <Label className="text-[10px]">Correr em</Label>
            <div className="flex gap-1">
              <Input value={cur.infusionTime || ''} onChange={(e) => set({ infusionTime: e.target.value })} className="h-8 text-xs" placeholder="tempo" />
              <Chip active={cur.infusionTimeUnit === 'min'} onClick={() => set({ infusionTimeUnit: 'min' })}>min</Chip>
              <Chip active={cur.infusionTimeUnit === 'h'} onClick={() => set({ infusionTimeUnit: 'h' })}>h</Chip>
            </div>
          </div>
        </div>
        <div>
          <Label className="text-[10px]">Observações adicionais (opcional)</Label>
          <Textarea
            value={cur.instructions || ''}
            onChange={(e) => set({ instructions: e.target.value })}
            className="min-h-[40px] text-xs"
            placeholder="Ex: monitorizar ECG, repetir ionograma após infusão..."
          />
        </div>
        {isReplacement && cur.diluent && cur.volumeTotal && (
          <div className="rounded-md border border-sky-200 dark:border-sky-900 bg-sky-50/40 dark:bg-sky-950/20 p-2 text-[11px] text-sky-700 dark:text-sky-300">
            <Sparkles className="h-3 w-3 inline mr-1" />
            Receita: <strong>{cur.name}</strong> diluído em <strong>{cur.volumeTotal} mL de {cur.diluent}</strong>
            {cur.route && <> · via <strong>{cur.route}</strong>{cur.accessType && ` (${cur.accessType})`}</>}
            {cur.infusionRate && <> · <strong>{cur.infusionRate} {cur.infusionMode === 'gts' ? 'gts/min' : 'mL/h'}</strong></>}
            {cur.infusionTime && <> em <strong>{cur.infusionTime} {cur.infusionTimeUnit || 'min'}</strong></>}
          </div>
        )}
      </div>
    );
  };

  const renderNutritionStep = () => {
    if (step === 0) {
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Via</Label>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {ROUTES_NUT.map(r => (
                <Chip key={r} active={cur.route === r} onClick={() => set({ route: r })}>{r}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Modo</Label>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {['Contínua BIC', 'Gravitacional intermitente', 'Bolus', 'Bomba ciclada', 'VO fracionada'].map(m => (
                <Chip key={m} active={cur.nutMode === m} onClick={() => set({ nutMode: m })}>{m}</Chip>
              ))}
            </div>
          </div>
        </div>
      );
    }
    if (step === 1) {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Volume / dia (mL)</Label>
              <Input value={cur.nutVolDay || ''} onChange={(e) => set({ nutVolDay: e.target.value })} className="h-8 text-xs" placeholder="1500" />
            </div>
            <div>
              <Label className="text-[10px]">Vazão (mL/h)</Label>
              <Input value={cur.infusionRate || ''} onChange={(e) => set({ infusionRate: e.target.value })} className="h-8 text-xs" placeholder="80" />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Fracionamento</Label>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {['6x/dia', '4/4h', '3/3h', '2/2h'].map(f => (
                <Chip key={f} active={cur.nutFraction === f} onClick={() => set({ nutFraction: f })}>{f}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Pausa noturna</Label>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {['Sem pausa', '23h-6h', '22h-5h'].map(p => (
                <Chip key={p} active={cur.nutNightPause === p} onClick={() => set({ nutNightPause: p })}>{p}</Chip>
              ))}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cabeceira</Label>
          <div className="flex gap-1.5 mt-1.5">
            {['30°', '45°', '≥30°'].map(b => (
              <Chip key={b} active={cur.nutBedHead === b} onClick={() => set({ nutBedHead: b })}>{b}</Chip>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[10px]">Checagem de resíduo</Label>
          <Input value={cur.nutResidualCheck || ''} onChange={(e) => set({ nutResidualCheck: e.target.value })} className="h-8 text-xs" placeholder="aspirar 6/6h, suspender se >250mL" />
        </div>
        <div>
          <Label className="text-[10px]">Observações</Label>
          <Textarea value={cur.instructions || ''} onChange={(e) => set({ instructions: e.target.value })} className="min-h-[40px] text-xs" />
        </div>
      </div>
    );
  };

  const stepLabels = isNutrition
    ? ['Via & modo', 'Volume & ritmo', 'Segurança']
    : ['Diluente & volume', 'Via & acesso', 'Velocidade & tempo'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-[min(36rem,calc(100vw-2rem))] max-h-[calc(100svh-6rem)] top-4 translate-y-0 z-[80] overflow-y-auto p-4">
        <DialogHeader className="pb-1">
          <DialogTitle className="flex items-center gap-2 text-sky-700 dark:text-sky-300 text-base">
            <Wand2 className="h-4 w-4" /> Configurar com assistente
          </DialogTitle>
          <DialogDescription className="text-xs">
            <span className="font-medium text-foreground">{item.name}</span> — preencha por cliques. Os campos do detalhamento serão atualizados automaticamente.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1.5 pb-1">
          {stepLabels.map((lbl, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "flex-1 text-[10px] py-1 rounded border transition-all",
                step === i ? "bg-sky-600 text-white border-sky-600 font-semibold" : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
              )}
            >
              {i + 1}. {lbl}
            </button>
          ))}
        </div>

        <div className="py-1">
          {isNutrition ? renderNutritionStep() : renderInfusionStep()}
        </div>

        <DialogFooter className="pt-2 gap-1.5 sm:gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>
            <ChevronLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
          {step < totalSteps - 1 ? (
            <Button size="sm" onClick={() => setStep(s => Math.min(totalSteps - 1, s + 1))} className="bg-sky-600 hover:bg-sky-700 text-white">
              Avançar <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="sm" onClick={apply} className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Aplicar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
