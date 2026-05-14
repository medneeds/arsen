/**
 * CompoundedTabletFields
 * Builder de instrução para administração de comprimidos/cápsulas via sonda enteral
 * (SNG / SNE / GTT / Jejunostomia).
 *
 * Aparece automaticamente quando:
 *   presentation = comprimido | cápsula | drágea
 *   E route = enteral | sng | sne | gtt | sonda | gastrostomia | jejunostomia
 *
 * Inclui:
 *   - Volume de água para diluição (mL)
 *   - Volume de lavagem pré e pós (mL)
 *   - Toggle "Diluir individualmente" (não misturar com outros medicamentos)
 *   - Observação adicional livre
 *   - Botão "Aplicar à instrução" → escreve em `instructions`
 *   - Alerta vermelho bloqueante quando o medicamento está na lista NÃO TRITURAR
 *     (ISMP-Brasil / RENAME).
 */
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Pill, AlertTriangle, Droplets, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { findNotCrushable } from "@/data/notCrushableMedications";
import { toast } from "sonner";

interface PrescriptionLikeItem {
  id: string;
  name: string;
  presentation?: string;
  route?: string;
  instructions?: string;
}

interface Props {
  item: PrescriptionLikeItem;
  onUpdate: (id: string, field: 'instructions', value: string) => void;
}

export function CompoundedTabletFields({ item, onUpdate }: Props) {
  const block = useMemo(() => findNotCrushable(item.name, item.presentation), [item.name, item.presentation]);

  // Defaults práticos: ISMP-Brasil sugere 20 mL para diluir e 10 mL para lavar antes/depois.
  const [waterMl, setWaterMl] = useState<string>('20');
  const [preFlushMl, setPreFlushMl] = useState<string>('10');
  const [postFlushMl, setPostFlushMl] = useState<string>('10');
  const [individual, setIndividual] = useState<boolean>(true);
  const [extraNote, setExtraNote] = useState<string>('');

  const buildInstruction = () => {
    if (block) return null;
    const parts: string[] = [];
    parts.push(`Triturar e diluir em ${waterMl || '20'} mL de água destilada/filtrada`);
    if (preFlushMl) parts.push(`lavar sonda com ${preFlushMl} mL de água ANTES`);
    parts.push('administrar pela sonda');
    if (postFlushMl) parts.push(`lavar sonda com ${postFlushMl} mL de água APÓS`);
    if (individual) parts.push('NÃO misturar com outros medicamentos (administrar separadamente)');
    if (extraNote.trim()) parts.push(extraNote.trim());
    return parts.join('. ') + '.';
  };

  const handleApply = () => {
    const text = buildInstruction();
    if (!text) return;
    onUpdate(item.id, 'instructions', text);
    toast.success('Instrução de trituração aplicada');
  };

  return (
    <div
      className={cn(
        "rounded-md border p-2 space-y-2 mt-1",
        block
          ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 border-l-[3px] border-l-rose-500"
          : "bg-amber-50/60 dark:bg-amber-950/25 border-amber-300/70 dark:border-amber-800/50 border-l-[3px] border-l-amber-500"
      )}
    >
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "flex items-center justify-center h-5 w-5 rounded-md text-white shadow-sm",
            block ? "bg-rose-600 shadow-rose-600/30" : "bg-amber-600 shadow-amber-600/30"
          )}
        >
          {block ? <AlertTriangle className="h-3 w-3" /> : <Pill className="h-3 w-3" />}
        </div>
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.08em]",
            block ? "text-rose-800 dark:text-rose-200" : "text-amber-800 dark:text-amber-200"
          )}
        >
          {block ? 'NÃO TRITURAR — administração por sonda inviável' : 'Comprimido por sonda — diluição'}
        </span>
      </div>

      {block ? (
        <div className="space-y-1 text-[11px] text-rose-900 dark:text-rose-100 leading-relaxed">
          <p><strong>Motivo:</strong> {block.reason}</p>
          {block.alternative && (
            <p><strong>Sugestão:</strong> {block.alternative}</p>
          )}
          <p className="text-[10px] text-rose-700/80 dark:text-rose-300/80 italic">
            Considere trocar a apresentação ou a via antes de prescrever.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] text-amber-900/80 dark:text-amber-200/80">Diluir em (mL)</Label>
              <Input
                type="number"
                min={5}
                value={waterMl}
                onChange={(e) => setWaterMl(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-amber-900/80 dark:text-amber-200/80">Lavagem pré (mL)</Label>
              <Input
                type="number"
                min={0}
                value={preFlushMl}
                onChange={(e) => setPreFlushMl(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-amber-900/80 dark:text-amber-200/80">Lavagem pós (mL)</Label>
              <Input
                type="number"
                min={0}
                value={postFlushMl}
                onChange={(e) => setPostFlushMl(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch checked={individual} onCheckedChange={setIndividual} id={`indiv-${item.id}`} />
              <Label htmlFor={`indiv-${item.id}`} className="text-[10px] text-amber-900/90 dark:text-amber-100/90 cursor-pointer">
                Administrar separadamente (não misturar com outras medicações)
              </Label>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleApply}
              className="h-7 text-[10px] gap-1 border-amber-400 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/40"
            >
              <Droplets className="h-3 w-3" /> Aplicar à instrução
            </Button>
          </div>

          <div>
            <Label className="text-[10px] text-amber-900/80 dark:text-amber-200/80">Observação adicional</Label>
            <Input
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              placeholder="Ex.: ofertar com estômago vazio; pinçar sonda 30 min após"
              className="h-7 text-xs"
            />
          </div>

          <p className="text-[9px] text-amber-700/80 dark:text-amber-300/70 leading-snug flex items-start gap-1">
            <Check className="h-2.5 w-2.5 mt-0.5 shrink-0" />
            Padrão ISMP-Brasil: diluir em 20 mL de água, lavar sonda com 10 mL antes/depois, administrar separadamente.
          </p>
        </>
      )}
    </div>
  );
}
