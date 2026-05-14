/**
 * InsulinTherapyDialog
 * Pop-up wizard de prescrição inteligente de insulinoterapia.
 *
 * Fluxo (slides dentro do mesmo Dialog):
 *   1. Esquema (Basal-Bolus / Resgate / NPH fixa / EV contínua)
 *   2. Parâmetros (peso, meta, escolhas específicas do esquema)
 *   3. Revisão (orientação para enfermagem montada)
 *
 * Não desmembra para outra aba — tudo acontece dentro de Medicações.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Syringe, Activity, Clock, Zap, Check, Plus, Trash2, AlertTriangle } from "lucide-react";
import {
  type InsulinPlan, type InsulinScheme, type SlidingRow, type InsulinDose,
  type BasalInsulin, type BolusInsulin,
  computeBasalBolus, computeNphFixed, suggestIvProtocol, suggestSlidingByWeight,
  describeInsulinPlan, detectInsulinKind,
  SLIDING_LOW, SLIDING_MEDIUM, SLIDING_HIGH, DEFAULT_HYPO_PROTOCOL,
} from "@/lib/insulinTherapy";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Nome da insulina que disparou o pop-up (preseleciona kind). */
  medicationName: string;
  /** Peso prévio do paciente, se disponível. */
  initialWeightKg?: number;
  /** Plano existente (modo edição). */
  existingPlan?: InsulinPlan;
  onConfirm: (plan: InsulinPlan) => void;
}

const SCHEME_OPTIONS: { value: InsulinScheme; label: string; desc: string; icon: React.ElementType }[] = [
  { value: 'basal_bolus',  label: 'BASAL-BOLUS',          desc: 'NPH/Regular ou análogos · TDD por peso, basal + bolus + correção',  icon: Activity },
  { value: 'sliding',      label: 'ESQUEMA DE RESGATE',   desc: 'Insulina Regular SC conforme HGT (sliding scale) — uso isolado',     icon: Syringe },
  { value: 'nph_fixed',    label: 'NPH FIXA',             desc: 'Doses fixas 2/3 manhã + 1/3 noite · 0,2 U/kg/dia',                   icon: Clock },
  { value: 'iv_continuous',label: 'INSULINA EV CONTÍNUA', desc: 'BIC · DKA, HHS, controle UTI ou pós-op cardíaco',                    icon: Zap },
];

export function InsulinTherapyDialog({
  open, onOpenChange, medicationName, initialWeightKg, existingPlan, onConfirm,
}: Props) {
  const detected = useMemo(() => detectInsulinKind(medicationName), [medicationName]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [plan, setPlan] = useState<InsulinPlan>(() =>
    existingPlan ?? {
      scheme: 'basal_bolus',
      weightKg: initialWeightKg,
      basalInsulin: detected.isBasal ? (detected.suggested as BasalInsulin) : 'NPH',
      bolusInsulin: detected.isBolus ? (detected.suggested as BolusInsulin) : 'Regular',
      basalPercent: 50,
      glycemicTarget: '140-180 mg/dL',
      hgtFrequency: '6/6h',
      slidingRows: suggestSlidingByWeight(initialWeightKg),
      source: 'SBD 2024 · ADA 2024 · AMIB',
    }
  );

  // Reset quando reabrir
  useEffect(() => {
    if (open) {
      setStep(1);
      if (!existingPlan) {
        setPlan(prev => ({
          ...prev,
          scheme: detected.isBasal && !detected.isBolus ? 'nph_fixed'
                : detected.isBolus && !detected.isBasal ? 'sliding'
                : prev.scheme,
        }));
      }
    }
  }, [open, existingPlan, detected.isBasal, detected.isBolus]);

  const updatePlan = (patch: Partial<InsulinPlan>) => setPlan(p => ({ ...p, ...patch }));

  // ─── Recálculos automáticos ───
  const recalcBasalBolus = () => {
    if (!plan.weightKg) return;
    const result = computeBasalBolus({
      weightKg: plan.weightKg,
      basalPercent: plan.basalPercent,
      basalInsulin: plan.basalInsulin,
      bolusInsulin: plan.bolusInsulin,
    });
    updatePlan({
      totalDailyDose: result.tdd,
      fixedDoses: result.doses,
      correctionRows: plan.correctionRows ?? suggestSlidingByWeight(plan.weightKg),
    });
  };

  const recalcNph = () => {
    if (!plan.weightKg) return;
    updatePlan({ nphDoses: computeNphFixed(plan.weightKg) });
  };

  const applyIvProtocol = (kind: InsulinPlan['ivProtocol']) => {
    const patch = suggestIvProtocol(kind, plan.weightKg);
    updatePlan(patch);
  };

  // Geração inicial ao chegar no passo 2
  useEffect(() => {
    if (step !== 2) return;
    if (plan.scheme === 'basal_bolus' && !plan.fixedDoses?.length && plan.weightKg) recalcBasalBolus();
    if (plan.scheme === 'nph_fixed'   && !plan.nphDoses?.length   && plan.weightKg) recalcNph();
    if (plan.scheme === 'iv_continuous' && !plan.ivProtocol) applyIvProtocol('uti_glicemia');
    if (plan.scheme === 'sliding' && !plan.slidingRows?.length) updatePlan({ slidingRows: suggestSlidingByWeight(plan.weightKg) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, plan.scheme]);

  const review = useMemo(() => describeInsulinPlan(plan), [plan]);

  const canAdvance = step === 1
    ? !!plan.scheme
    : step === 2
      ? validateStep2(plan)
      : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Syringe className="h-5 w-5 text-red-500" />
            ASSISTENTE DE INSULINOTERAPIA
            <Badge variant="outline" className="ml-2 text-[10px]">{medicationName}</Badge>
          </DialogTitle>
          <DialogDescription>
            Construa o esquema completo (basal · bolus · resgate · EV) com sugestões SBD 2024 / ADA 2024 / AMIB.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-1 pb-2">
          {[1, 2, 3].map(n => (
            <React.Fragment key={n}>
              <div className={cn(
                "h-8 w-8 rounded-full grid place-items-center text-xs font-semibold transition-colors",
                step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>{n}</div>
              {n < 3 && <div className={cn("flex-1 h-0.5", step > n ? "bg-primary" : "bg-muted")} />}
            </React.Fragment>
          ))}
          <span className="ml-3 text-xs text-muted-foreground">
            {step === 1 ? "Escolha o esquema" : step === 2 ? "Parâmetros" : "Revisão"}
          </span>
        </div>

        {/* ───── STEP 1: escolha do esquema ───── */}
        {step === 1 && (
          <div className="grid sm:grid-cols-2 gap-3">
            {SCHEME_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const active = plan.scheme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updatePlan({ scheme: opt.value })}
                  className={cn(
                    "text-left rounded-lg border-2 p-3 transition-all",
                    active ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/40",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm font-bold">{opt.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* ───── STEP 2: parâmetros ───── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Peso & meta — sempre visíveis */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Peso (kg)</Label>
                <Input
                  type="number" inputMode="decimal" step="0.1"
                  value={plan.weightKg ?? ''}
                  onChange={e => updatePlan({ weightKg: e.target.value ? Number(e.target.value) : undefined })}
                  onBlur={() => {
                    if (plan.scheme === 'basal_bolus') recalcBasalBolus();
                    if (plan.scheme === 'nph_fixed') recalcNph();
                    if (plan.scheme === 'sliding' && !plan.slidingRows?.length) updatePlan({ slidingRows: suggestSlidingByWeight(plan.weightKg) });
                  }}
                  placeholder="ex.: 70"
                />
              </div>
              <div>
                <Label className="text-xs">Meta glicêmica</Label>
                <Select value={plan.glycemicTarget} onValueChange={v => updatePlan({ glycemicTarget: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="80-130 mg/dL">80–130 mg/dL (enfermaria estável)</SelectItem>
                    <SelectItem value="140-180 mg/dL">140–180 mg/dL (UTI · ADA)</SelectItem>
                    <SelectItem value="150-200 mg/dL">150–200 mg/dL (DKA em resolução)</SelectItem>
                    <SelectItem value="110-150 mg/dL">110–150 mg/dL (pós-op cardíaco)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {plan.scheme === 'basal_bolus' && (
              <BasalBolusEditor plan={plan} onChange={updatePlan} onRecalc={recalcBasalBolus} />
            )}
            {plan.scheme === 'sliding' && (
              <SlidingEditor plan={plan} onChange={updatePlan} />
            )}
            {plan.scheme === 'nph_fixed' && (
              <NphFixedEditor plan={plan} onChange={updatePlan} onRecalc={recalcNph} />
            )}
            {plan.scheme === 'iv_continuous' && (
              <IvContinuousEditor plan={plan} onChange={updatePlan} onApplyProtocol={applyIvProtocol} />
            )}

            <div>
              <Label className="text-xs">Observações para enfermagem</Label>
              <Textarea
                rows={2}
                value={plan.notes ?? ''}
                onChange={e => updatePlan({ notes: e.target.value })}
                placeholder="ex.: suspender NPH se NPO; HGT extra se sintomas de hipoglicemia"
              />
            </div>
          </div>
        )}

        {/* ───── STEP 3: revisão ───── */}
        {step === 3 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Check className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">{review.headline}</h3>
            </div>
            <ul className="space-y-1 text-xs leading-relaxed">
              {review.lines.map((l, i) => (
                <li key={i} className={cn(
                  "pl-2 border-l-2",
                  l.startsWith('  •') ? "border-muted-foreground/30 ml-3 text-muted-foreground" : "border-primary/40"
                )}>{l}</li>
              ))}
            </ul>
            {plan.scheme === 'iv_continuous' && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-700 dark:text-red-300">
                  <strong>ALTA VIGILÂNCIA:</strong> bomba de infusão, dupla checagem, HGT seriado e K+ sérico monitorado.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> VOLTAR
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)} disabled={!canAdvance}>
              AVANÇAR <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => { onConfirm(plan); onOpenChange(false); }}>
              <Check className="h-4 w-4 mr-1" /> APLICAR À PRESCRIÇÃO
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function validateStep2(plan: InsulinPlan): boolean {
  switch (plan.scheme) {
    case 'basal_bolus': return !!(plan.weightKg && plan.fixedDoses?.length);
    case 'sliding':     return !!(plan.slidingRows?.length);
    case 'nph_fixed':   return !!(plan.nphDoses?.length);
    case 'iv_continuous': return !!(plan.ivProtocol && plan.ivConcentration);
  }
}

// ───────────────────────── Editores por esquema ─────────────────────────

function BasalBolusEditor({ plan, onChange, onRecalc }: { plan: InsulinPlan; onChange: (p: Partial<InsulinPlan>) => void; onRecalc: () => void }) {
  return (
    <div className="space-y-3 rounded-lg border border-border/50 p-3 bg-card/40">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Insulina Basal</Label>
          <Select value={plan.basalInsulin} onValueChange={(v: BasalInsulin) => onChange({ basalInsulin: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NPH">NPH (intermediária · 2x/dia)</SelectItem>
              <SelectItem value="Glargina">Glargina (Lantus · 1x/dia)</SelectItem>
              <SelectItem value="Detemir">Detemir (Levemir)</SelectItem>
              <SelectItem value="Degludeca">Degludeca (Tresiba · 42h)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Insulina Bolus</Label>
          <Select value={plan.bolusInsulin} onValueChange={(v: BolusInsulin) => onChange({ bolusInsulin: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Regular">Regular (30 min antes refeição)</SelectItem>
              <SelectItem value="Lispro">Lispro (Humalog · imediato)</SelectItem>
              <SelectItem value="Aspart">Aspart (Novorapid · imediato)</SelectItem>
              <SelectItem value="Glulisina">Glulisina (Apidra)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">% Basal (resto = bolus)</Label>
          <Input
            type="number" min={30} max={70}
            value={plan.basalPercent ?? 50}
            onChange={e => onChange({ basalPercent: Number(e.target.value) })}
          />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="secondary" onClick={onRecalc} className="w-full">
            RECALCULAR DOSES
          </Button>
        </div>
      </div>

      {plan.totalDailyDose !== undefined && (
        <div className="text-[11px] text-muted-foreground">
          TDD calculada: <strong>{plan.totalDailyDose} U/dia</strong> (peso × 0,4 U/kg)
        </div>
      )}

      <DoseList
        title="Tomadas fixas"
        doses={plan.fixedDoses ?? []}
        onChange={(doses) => onChange({ fixedDoses: doses })}
      />
      <SlidingEditor plan={plan} onChange={onChange} title="Escala de correção pré-refeição" rowsKey="correctionRows" />
    </div>
  );
}

function SlidingEditor({
  plan, onChange, title = "Escala de correção (sliding scale)", rowsKey = 'slidingRows',
}: { plan: InsulinPlan; onChange: (p: Partial<InsulinPlan>) => void; title?: string; rowsKey?: 'slidingRows' | 'correctionRows' }) {
  const rows = (plan[rowsKey] as SlidingRow[] | undefined) ?? [];
  const setRows = (r: SlidingRow[]) => onChange({ [rowsKey]: r } as Partial<InsulinPlan>);

  const updateRow = (i: number, patch: Partial<SlidingRow>) => {
    const copy = [...rows];
    copy[i] = { ...copy[i], ...patch };
    setRows(copy);
  };

  return (
    <div className="space-y-2 rounded-lg border border-border/50 p-3 bg-card/40">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">{title}</Label>
        {rowsKey === 'slidingRows' && (
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground">Frequência HGT</Label>
            <Select value={plan.hgtFrequency ?? '6/6h'} onValueChange={(v: NonNullable<InsulinPlan['hgtFrequency']>) => onChange({ hgtFrequency: v })}>
              <SelectTrigger className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2/2h">2/2h (UTI)</SelectItem>
                <SelectItem value="4/4h">4/4h</SelectItem>
                <SelectItem value="6/6h">6/6h (padrão)</SelectItem>
                <SelectItem value="pre_refeicoes">Pré-refeições</SelectItem>
                <SelectItem value="pre_refeicoes_bedtime">Pré-refeições + bedtime</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 mb-2">
        <Button size="sm" variant="outline" onClick={() => setRows([...((plan as any)[rowsKey === 'slidingRows' ? 'slidingRows' : 'correctionRows'] = []), ...[
          { min: 150, max: 200, units: 2 }, { min: 201, max: 250, units: 4 },
          { min: 251, max: 300, units: 6 }, { min: 301, max: 350, units: 8 },
          { min: 351, max: null, units: -1 },
        ]] as SlidingRow[])} className="text-[10px] h-7">SENSÍVEL</Button>
        <Button size="sm" variant="outline" onClick={() => setRows([
          { min: 150, max: 200, units: 4 }, { min: 201, max: 250, units: 6 },
          { min: 251, max: 300, units: 8 }, { min: 301, max: 350, units: 10 },
          { min: 351, max: null, units: -1 },
        ])} className="text-[10px] h-7">MÉDIA</Button>
        <Button size="sm" variant="outline" onClick={() => setRows([
          { min: 150, max: 200, units: 6 }, { min: 201, max: 250, units: 8 },
          { min: 251, max: 300, units: 10 }, { min: 301, max: 350, units: 12 },
          { min: 351, max: null, units: -1 },
        ])} className="text-[10px] h-7">RESISTENTE</Button>
      </div>

      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto] items-center gap-1 text-xs">
            <Input
              type="number" value={r.min}
              onChange={e => updateRow(i, { min: Number(e.target.value) })}
              className="h-7 text-xs"
            />
            <span className="text-muted-foreground">a</span>
            <Input
              type="number" value={r.max ?? ''}
              placeholder="∞"
              onChange={e => updateRow(i, { max: e.target.value ? Number(e.target.value) : null })}
              className="h-7 text-xs"
            />
            <span className="text-muted-foreground">→</span>
            <Input
              type="number" value={r.units}
              onChange={e => updateRow(i, { units: Number(e.target.value) })}
              className="h-7 text-xs"
              title="-1 = chamar médico"
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button
          size="sm" variant="ghost"
          onClick={() => setRows([...rows, { min: 0, max: 0, units: 0 }])}
          className="text-[10px] h-7"
        >
          <Plus className="h-3 w-3 mr-1" /> ADICIONAR FAIXA
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Use <code>-1</code> em "U" para "CHAMAR MÉDICO". Glicemia &lt; 70 → protocolo de hipoglicemia.
      </p>
    </div>
  );
}

function NphFixedEditor({ plan, onChange, onRecalc }: { plan: InsulinPlan; onChange: (p: Partial<InsulinPlan>) => void; onRecalc: () => void }) {
  return (
    <div className="space-y-3 rounded-lg border border-border/50 p-3 bg-card/40">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">NPH fixa (2/3 manhã + 1/3 noite)</Label>
        <Button size="sm" variant="secondary" onClick={onRecalc}>RECALCULAR</Button>
      </div>
      <DoseList
        title=""
        doses={plan.nphDoses ?? []}
        onChange={(doses) => onChange({ nphDoses: doses })}
      />
      <p className="text-[10px] text-muted-foreground">
        SBD: iniciar 0,2 U/kg/dia, ajustar conforme HGT pré-refeição. Considerar bedtime se hiperglicemia matinal.
      </p>
    </div>
  );
}

function IvContinuousEditor({
  plan, onChange, onApplyProtocol,
}: { plan: InsulinPlan; onChange: (p: Partial<InsulinPlan>) => void; onApplyProtocol: (k: InsulinPlan['ivProtocol']) => void }) {
  return (
    <div className="space-y-3 rounded-lg border border-red-200 dark:border-red-900 p-3 bg-red-50/40 dark:bg-red-950/10">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <Label className="text-xs font-semibold">PROTOCOLO EV CONTÍNUO — alta vigilância</Label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['dka', 'hhs', 'uti_glicemia', 'pos_op_cardiaco'] as const).map(k => (
          <Button
            key={k} type="button" size="sm"
            variant={plan.ivProtocol === k ? "default" : "outline"}
            onClick={() => onApplyProtocol(k)}
            className="text-[10px] h-8"
          >
            {k === 'dka' ? 'CETOACIDOSE (DKA)'
             : k === 'hhs' ? 'HIPEROSMOLAR (HHS)'
             : k === 'uti_glicemia' ? 'CONTROLE UTI (Yale)'
             : 'PÓS-OP CARDÍACO (Portland)'}
          </Button>
        ))}
      </div>

      <div>
        <Label className="text-xs">Concentração da solução</Label>
        <Input value={plan.ivConcentration ?? ''} onChange={e => onChange({ ivConcentration: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Bolus inicial (U EV)</Label>
          <Input type="number" step="0.1" value={plan.ivBolusDose ?? ''} onChange={e => onChange({ ivBolusDose: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <div>
          <Label className="text-xs">Início BIC (U/h)</Label>
          <Input type="number" step="0.1" value={plan.ivStartRate ?? ''} onChange={e => onChange({ ivStartRate: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Regra de ajuste</Label>
        <Textarea rows={3} value={plan.ivAdjustmentRule ?? ''} onChange={e => onChange({ ivAdjustmentRule: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Critério de transição p/ SC</Label>
        <Input value={plan.ivTransitionRule ?? ''} onChange={e => onChange({ ivTransitionRule: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={!!plan.ivKMonitoring} onChange={e => onChange({ ivKMonitoring: e.target.checked })} />
        Monitorar K+ sérico a cada 2-4h (DKA / HHS)
      </label>
    </div>
  );
}

function DoseList({ title, doses, onChange }: { title: string; doses: InsulinDose[]; onChange: (d: InsulinDose[]) => void }) {
  const update = (i: number, patch: Partial<InsulinDose>) => {
    const copy = [...doses];
    copy[i] = { ...copy[i], ...patch };
    onChange(copy);
  };
  return (
    <div className="space-y-1">
      {title && <Label className="text-xs">{title}</Label>}
      {doses.map((d, i) => (
        <div key={i} className="grid grid-cols-[80px_1fr_70px_1fr_auto] items-center gap-1 text-xs">
          <Input value={d.time} onChange={e => update(i, { time: e.target.value })} className="h-7 text-xs" />
          <Input value={d.insulin} onChange={e => update(i, { insulin: e.target.value })} className="h-7 text-xs" />
          <Input type="number" value={d.units} onChange={e => update(i, { units: Number(e.target.value) })} className="h-7 text-xs" />
          <Select value={d.moment ?? ''} onValueChange={(v) => update(i, { moment: (v || undefined) as InsulinDose['moment'] })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="momento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pre_cafe">pré-café</SelectItem>
              <SelectItem value="pre_almoco">pré-almoço</SelectItem>
              <SelectItem value="pre_jantar">pré-jantar</SelectItem>
              <SelectItem value="bedtime">bedtime</SelectItem>
              <SelectItem value="antes_dormir">antes de dormir</SelectItem>
              <SelectItem value="manha">manhã</SelectItem>
              <SelectItem value="noite">noite</SelectItem>
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange(doses.filter((_, j) => j !== i))}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => onChange([...doses, { time: '07:00', insulin: 'NPH', units: 0 }])} className="text-[10px] h-7">
        <Plus className="h-3 w-3 mr-1" /> ADICIONAR DOSE
      </Button>
    </div>
  );
}
