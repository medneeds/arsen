import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Calculator, Info } from "lucide-react";
import {
  WEIGHT_BASED_DOSES,
  type WeightBasedDose,
  calculateBSA,
  calculateWeightBasedDose,
  findWeightBasedDose,
  getDoseUnitLabel,
} from "@/lib/weightBasedDoses";

export interface DoseCalculatorResult {
  medication: string;
  dose: string; // texto pronto p/ campo "Dose"
  schedule: string; // texto pronto p/ campo "Posologia"
  route?: string;
  diluent?: string;
  diluentVolume?: string;
  infusionTime?: string;
  rate?: string; // mL/h
  notes?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialMedication?: string;
  initialWeight?: string; // peso pré-preenchido (kg)
  initialHeight?: string; // altura pré-preenchida (cm)
  onApply: (result: DoseCalculatorResult) => void;
}

export function DoseCalculatorDialog({
  open,
  onClose,
  initialMedication,
  initialWeight,
  initialHeight,
  onApply,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [doseValue, setDoseValue] = useState<string>("");
  const [frequency, setFrequency] = useState<string>("");
  const [concentration, setConcentration] = useState<string>("");

  const ref: WeightBasedDose | null = useMemo(() => {
    if (!selectedKey) return null;
    return WEIGHT_BASED_DOSES.find((d) => d.name === selectedKey) || null;
  }, [selectedKey]);

  // Inicialização ao abrir
  useEffect(() => {
    if (!open) return;
    setWeight(initialWeight ? String(parseFloat(initialWeight) || "") : "");
    setHeight(initialHeight || "");
    if (initialMedication) {
      const found = findWeightBasedDose(initialMedication);
      if (found) setSelectedKey(found.name);
    }
  }, [open, initialMedication, initialWeight, initialHeight]);

  // Reset quando muda medicamento
  useEffect(() => {
    if (ref) {
      setDoseValue(ref.doseUsual?.toString() ?? ref.doseMin.toString());
      setFrequency(ref.defaultFrequency?.toString() ?? "");
      setConcentration("");
    }
  }, [ref]);

  const weightKg = parseFloat(weight) || 0;
  const heightCm = parseFloat(height) || 0;
  const dose = parseFloat(doseValue) || 0;
  const freq = parseInt(frequency) || ref?.defaultFrequency || 1;
  const conc = parseFloat(concentration) || 0;

  const bsa = calculateBSA(weightKg, heightCm);

  const calculation = useMemo(() => {
    if (!ref || !weightKg || !dose) return null;
    return calculateWeightBasedDose(ref, weightKg, dose, {
      frequency: freq,
      concentration: conc,
    });
  }, [ref, weightKg, dose, freq, conc]);

  const handleApply = () => {
    if (!ref || !calculation) return;
    const result: DoseCalculatorResult = {
      medication: ref.display,
      dose: calculation.formattedDose,
      schedule: calculation.formattedSchedule,
      route: ref.defaultRoute,
      diluent: ref.defaultDiluent,
      diluentVolume: ref.defaultDiluentVolume,
      infusionTime: ref.defaultInfusionTime,
      rate: calculation.formattedRate,
      notes: ref.clinicalNote,
    };
    onApply(result);
    onClose();
  };

  const isInfusion = ref?.mode === "mcg_per_kg_min" || ref?.mode === "UI_per_kg_h";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Calculadora de Dose por Peso/Superfície Corporal
          </DialogTitle>
          <DialogDescription>
            Cálculo automático para medicamentos peso-dependentes. Sempre validar com farmácia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dados antropométricos */}
          <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/30 border">
            <div>
              <Label className="text-xs">Peso (kg) *</Label>
              <Input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="70"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Altura (cm)</Label>
              <Input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="170"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Superfície Corporal</Label>
              <div className="h-9 flex items-center px-3 rounded-md border bg-background text-sm font-mono">
                {bsa > 0 ? `${bsa.toFixed(2)} m²` : "—"}
              </div>
            </div>
          </div>

          {/* Medicamento */}
          <div>
            <Label className="text-xs">Medicamento</Label>
            <Select value={selectedKey} onValueChange={setSelectedKey}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione um medicamento peso-dependente" />
              </SelectTrigger>
              <SelectContent>
                {(["antimicrobial", "vasoactive", "sedation", "analgesia", "anticoagulant"] as const).map(
                  (cat) => (
                    <div key={cat}>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {cat === "antimicrobial"
                          ? "Antimicrobianos"
                          : cat === "vasoactive"
                            ? "Vasoativos"
                            : cat === "sedation"
                              ? "Sedação"
                              : cat === "analgesia"
                                ? "Analgesia"
                                : "Anticoagulantes"}
                      </div>
                      {WEIGHT_BASED_DOSES.filter((d) => d.category === cat).map((d) => (
                        <SelectItem key={d.name} value={d.name}>
                          {d.display}
                        </SelectItem>
                      ))}
                    </div>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {ref && (
            <>
              {/* Dose e frequência */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">
                    Dose ({getDoseUnitLabel(ref)})
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={doseValue}
                    onChange={(e) => setDoseValue(e.target.value)}
                    className="h-9"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Faixa: {ref.doseMin}–{ref.doseMax}
                  </p>
                </div>

                {(ref.mode === "mg_per_kg_dose" || ref.mode === "mg_per_kg_day") &&
                  ref.frequencyOptions && (
                    <div>
                      <Label className="text-xs">Frequência (doses/dia)</Label>
                      <Select value={frequency} onValueChange={setFrequency}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ref.frequencyOptions.map((f) => (
                            <SelectItem key={f} value={f.toString()}>
                              {f}x/dia ({f === 1 ? "24/24h" : f === 2 ? "12/12h" : f === 3 ? "8/8h" : f === 4 ? "6/6h" : `${24 / f}/${24 / f}h`})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                {isInfusion && (
                  <div>
                    <Label className="text-xs">Concentração ({ref.unit}/mL)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={concentration}
                      onChange={(e) => setConcentration(e.target.value)}
                      placeholder="ex: 64"
                      className="h-9"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Para calcular mL/h
                    </p>
                  </div>
                )}
              </div>

              {/* Resultado */}
              {calculation && weightKg > 0 && (
                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Calculator className="h-4 w-4" />
                    Resultado do Cálculo
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Dose por administração</span>
                      <div className="font-mono font-bold text-base">{calculation.formattedDose}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Posologia</span>
                      <div className="font-mono font-bold text-base">{calculation.formattedSchedule}</div>
                    </div>
                    {calculation.dosePerDay && (
                      <div>
                        <span className="text-xs text-muted-foreground">Dose total diária</span>
                        <div className="font-mono">{calculation.dosePerDay.toFixed(0)} {ref.unit}</div>
                      </div>
                    )}
                    {calculation.formattedRate && (
                      <div>
                        <span className="text-xs text-muted-foreground">Vazão (BIC)</span>
                        <div className="font-mono font-bold text-base text-amber-600">{calculation.formattedRate}</div>
                      </div>
                    )}
                  </div>

                  {calculation.warnings.length > 0 && (
                    <div className="flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-300">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                        {calculation.warnings.map((w, i) => (
                          <div key={i}>{w}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Nota clínica */}
              {ref.clinicalNote && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                  <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-900 dark:text-blue-200">{ref.clinicalNote}</p>
                </div>
              )}

              {ref.renalAdjust && (
                <Badge variant="outline" className="text-xs border-orange-400 text-orange-700">
                  ⚠ Requer ajuste por função renal (ClCr)
                </Badge>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={!calculation || !ref}>
            Aplicar à Prescrição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
