import { Wind, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  type InhalationMode,
  type InhalationInterface,
  type InhalationPreset,
  INHALATION_INTERFACE_LABEL,
  INHALATION_MODE_LABEL,
  getInhalationDefaults,
} from '@/data/inhalationCatalog';

const POSOLOGY_OPTIONS = ['1x/dia', '12/12h', '8/8h', '6/6h', '4/4h', 'SOS', 'Contínuo'];
const INTERFACES: InhalationInterface[] = ['mascara', 'traqueostomia', 'peca_t', 'circuito_vm', 'bocal'];

export interface InhalationItemShape {
  id: string;
  name: string;
  category: string;
  inhalationMode?: InhalationMode;
  nebDose?: string;
  nebDoseUnit?: 'mg' | 'gts' | 'mL' | 'mcg';
  diluent?: string;
  diluentVolume?: string;
  oxygenFlow?: string;
  stageDuration?: string;
  continuousDuration?: string;
  inhalationInterface?: InhalationInterface;
  posology?: string;
  puffs?: string;
  spacer?: boolean;
  gargle?: boolean;
  inhalationOrientation?: string;
}

interface Props {
  item: InhalationItemShape;
  onUpdate: (id: string, field: string, value: any) => void;
}

export function InhalationFields({ item, onUpdate }: Props) {
  const mode: InhalationMode = (item.inhalationMode as InhalationMode) || 'nebulization';
  const preset = getInhalationDefaults(item.name);

  const applyPreset = (p: InhalationPreset) => {
    if (p.mode) onUpdate(item.id, 'inhalationMode', p.mode);
    if (p.nebDose !== undefined) onUpdate(item.id, 'nebDose', p.nebDose);
    if (p.nebDoseUnit) onUpdate(item.id, 'nebDoseUnit', p.nebDoseUnit);
    if (p.diluent !== undefined) onUpdate(item.id, 'diluent', p.diluent);
    if (p.diluentVolume !== undefined) onUpdate(item.id, 'diluentVolume', p.diluentVolume);
    if (p.oxygenFlow !== undefined) onUpdate(item.id, 'oxygenFlow', p.oxygenFlow);
    if (p.stageDuration !== undefined) onUpdate(item.id, 'stageDuration', p.stageDuration);
    if (p.inhalationInterface) onUpdate(item.id, 'inhalationInterface', p.inhalationInterface);
    if (p.posology) onUpdate(item.id, 'posology', p.posology);
    if (p.puffs !== undefined) onUpdate(item.id, 'puffs', p.puffs);
    if (p.spacer !== undefined) onUpdate(item.id, 'spacer', p.spacer);
    if (p.gargle !== undefined) onUpdate(item.id, 'gargle', p.gargle);
    if (p.inhalationOrientation) onUpdate(item.id, 'inhalationOrientation', p.inhalationOrientation);
  };

  const ModeBtn = ({ value, label }: { value: InhalationMode; label: string }) => (
    <button
      type="button"
      onClick={() => onUpdate(item.id, 'inhalationMode', value)}
      className={
        'h-7 px-2.5 text-[11px] rounded-md border transition-colors ' +
        (mode === value
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-muted/20 border-border/30 hover:bg-muted/40 text-muted-foreground')
      }
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      {/* Modo de administração */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Wind className="h-3 w-3 text-primary shrink-0" />
        <span className="text-[10px] text-muted-foreground font-medium mr-1">Modo:</span>
        <ModeBtn value="nebulization" label="Nebulização" />
        <ModeBtn value="nebulization_continuous" label="Neb. contínua" />
        <ModeBtn value="pmdi" label="Spray (pMDI)" />
        <ModeBtn value="dpi" label="Pó seco (DPI)" />
        {preset && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyPreset(preset)}
                className="h-6 px-2 text-[10px] ml-auto border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Aplicar padrão
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              <div className="space-y-0.5">
                <div><b>Modo sugerido:</b> {INHALATION_MODE_LABEL[preset.mode]}</div>
                {preset.nebDose && <div><b>Dose:</b> {preset.nebDose} {preset.nebDoseUnit}</div>}
                {preset.diluent && preset.diluent !== 'puro' && <div><b>Diluente:</b> {preset.diluent} {preset.diluentVolume}mL</div>}
                {preset.oxygenFlow && <div><b>Fluxo:</b> {preset.oxygenFlow} L/min</div>}
                {preset.puffs && <div><b>Doses:</b> {preset.puffs}</div>}
                {preset.spacer && <div>Com espaçador</div>}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Campos NEBULIZAÇÃO ou CONTÍNUA */}
      {(mode === 'nebulization' || mode === 'nebulization_continuous') && (
        <>
          <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded-md bg-accent/30 border border-border/30">
            <span className="text-[10px] text-muted-foreground font-medium">Dose:</span>
            <Input
              value={item.nebDose || ''}
              onChange={(e) => onUpdate(item.id, 'nebDose', e.target.value)}
              className="h-6 text-[11px] bg-background border-border/40 w-14 text-center"
              placeholder="—"
            />
            <Select value={item.nebDoseUnit || 'gts'} onValueChange={(v) => onUpdate(item.id, 'nebDoseUnit', v)}>
              <SelectTrigger className="h-6 text-[11px] bg-background border-border/40 w-16"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gts" className="text-xs">gts</SelectItem>
                <SelectItem value="mg" className="text-xs">mg</SelectItem>
                <SelectItem value="mcg" className="text-xs">mcg</SelectItem>
                <SelectItem value="mL" className="text-xs">mL</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-muted-foreground/40">│</span>
            <span className="text-[10px] text-muted-foreground font-medium">Diluente:</span>
            <Select value={item.diluent || ''} onValueChange={(v) => onUpdate(item.id, 'diluent', v)}>
              <SelectTrigger className="h-6 text-[11px] bg-background border-border/40 w-28"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="puro" className="text-xs">Puro (s/ diluir)</SelectItem>
                <SelectItem value="SF0,9%" className="text-xs">SF 0,9%</SelectItem>
                <SelectItem value="SF3%" className="text-xs">SF 3% hipertônico</SelectItem>
                <SelectItem value="AD" className="text-xs">Água destilada</SelectItem>
              </SelectContent>
            </Select>
            {item.diluent && item.diluent !== 'puro' && (
              <>
                <Input
                  value={item.diluentVolume || ''}
                  onChange={(e) => onUpdate(item.id, 'diluentVolume', e.target.value)}
                  className="h-6 text-[11px] bg-background border-border/40 w-12 text-center"
                  placeholder="3"
                />
                <span className="text-[10px] text-muted-foreground">mL</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded-md bg-accent/30 border border-border/30">
            <span className="text-[10px] text-muted-foreground font-medium">Fluxo O₂/Ar:</span>
            <Input
              value={item.oxygenFlow || ''}
              onChange={(e) => onUpdate(item.id, 'oxygenFlow', e.target.value)}
              className="h-6 text-[11px] bg-background border-border/40 w-12 text-center"
              placeholder="6"
            />
            <span className="text-[10px] text-muted-foreground">L/min</span>
            <span className="text-muted-foreground/40">│</span>
            {mode === 'nebulization' && (
              <>
                <span className="text-[10px] text-muted-foreground font-medium">Tempo/etapa:</span>
                <Input
                  value={item.stageDuration || ''}
                  onChange={(e) => onUpdate(item.id, 'stageDuration', e.target.value)}
                  className="h-6 text-[11px] bg-background border-border/40 w-12 text-center"
                  placeholder="10"
                />
                <span className="text-[10px] text-muted-foreground">min</span>
              </>
            )}
            {mode === 'nebulization_continuous' && (
              <>
                <span className="text-[10px] text-muted-foreground font-medium">Duração total:</span>
                <Input
                  value={item.continuousDuration || ''}
                  onChange={(e) => onUpdate(item.id, 'continuousDuration', e.target.value)}
                  className="h-6 text-[11px] bg-background border-border/40 w-12 text-center"
                  placeholder="4"
                />
                <span className="text-[10px] text-muted-foreground">h</span>
              </>
            )}
            <span className="text-muted-foreground/40">│</span>
            <span className="text-[10px] text-muted-foreground font-medium">Interface:</span>
            <Select value={item.inhalationInterface || ''} onValueChange={(v) => onUpdate(item.id, 'inhalationInterface', v)}>
              <SelectTrigger className="h-6 text-[11px] bg-background border-border/40 w-32"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {INTERFACES.map(i => (
                  <SelectItem key={i} value={i} className="text-xs">{INHALATION_INTERFACE_LABEL[i]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mode === 'nebulization' && (
              <>
                <span className="text-muted-foreground/40">│</span>
                <span className="text-[10px] text-muted-foreground font-medium">Frequência:</span>
                <Select value={item.posology || ''} onValueChange={(v) => onUpdate(item.id, 'posology', v)}>
                  <SelectTrigger className="h-6 text-[11px] bg-background border-border/40 w-24"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {POSOLOGY_OPTIONS.map(p => (
                      <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </>
      )}

      {/* Campos pMDI / DPI */}
      {(mode === 'pmdi' || mode === 'dpi') && (
        <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 rounded-md bg-accent/30 border border-border/30">
          <span className="text-[10px] text-muted-foreground font-medium">
            {mode === 'pmdi' ? 'Nº de puffs:' : 'Nº de inalações:'}
          </span>
          <Input
            value={item.puffs || ''}
            onChange={(e) => onUpdate(item.id, 'puffs', e.target.value)}
            className="h-6 text-[11px] bg-background border-border/40 w-12 text-center"
            placeholder={mode === 'pmdi' ? '2' : '1'}
          />
          <span className="text-muted-foreground/40">│</span>
          <span className="text-[10px] text-muted-foreground font-medium">Frequência:</span>
          <Select value={item.posology || ''} onValueChange={(v) => onUpdate(item.id, 'posology', v)}>
            <SelectTrigger className="h-6 text-[11px] bg-background border-border/40 w-24"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {POSOLOGY_OPTIONS.map(p => (
                <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {mode === 'pmdi' && (
            <>
              <span className="text-muted-foreground/40">│</span>
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={!!item.spacer}
                  onCheckedChange={(v) => onUpdate(item.id, 'spacer', !!v)}
                  className="h-3.5 w-3.5"
                />
                Com espaçador
              </label>
            </>
          )}
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
            <Checkbox
              checked={!!item.gargle}
              onCheckedChange={(v) => onUpdate(item.id, 'gargle', !!v)}
              className="h-3.5 w-3.5"
            />
            Gargarejar após (corticoide)
          </label>
        </div>
      )}

      {/* Orientação livre (todas as modalidades) */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground font-medium shrink-0">Orientação:</span>
        <Input
          value={item.inhalationOrientation || ''}
          onChange={(e) => onUpdate(item.id, 'inhalationOrientation', e.target.value)}
          className="h-6 text-[11px] bg-muted/10 border-border/30 flex-1"
          placeholder="técnica adicional, observações…"
        />
      </div>
    </div>
  );
}
