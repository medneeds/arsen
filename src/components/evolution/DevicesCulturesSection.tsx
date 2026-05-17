import React, { useMemo } from "react";
import { Plus, Trash2, Activity, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateBRPicker } from "@/components/ui/DateBRPicker";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DEVICES_CATALOG,
  type EvolutionDevice,
  deviceAlertTone,
} from "@/lib/devicesCatalog";
import { calcDIH } from "@/lib/dihCalc";

interface DevicesCulturesSectionProps {
  devices: EvolutionDevice[];
  onDevicesChange: (next: EvolutionDevice[]) => void;
  culturesHtml: string;
  onCulturesChange: (html: string) => void;
  /** Data base p/ presets do date picker (admissão no setor). Aceita ISO ou BR. */
  admissionDate?: string | null;
}

export const DevicesCulturesSection: React.FC<DevicesCulturesSectionProps> = ({
  devices,
  onDevicesChange,
  culturesHtml,
  onCulturesChange,
  admissionDate,
}) => {
  const customs = useMemo(() => devices.filter((d) => d.custom), [devices]);
  const catalogIndex = useMemo(() => {
    const m = new Map<string, EvolutionDevice>();
    devices.forEach((d) => { if (!d.custom) m.set(d.id, d); });
    return m;
  }, [devices]);

  const toggleCatalog = (id: string, label: string, checked: boolean) => {
    if (checked) {
      if (catalogIndex.has(id)) return;
      onDevicesChange([...devices, { id, label, insertedAt: "" }]);
    } else {
      onDevicesChange(devices.filter((d) => !(d.id === id && !d.custom)));
    }
  };

  const setInsertedAt = (id: string, custom: boolean, value: string) => {
    onDevicesChange(
      devices.map((d) =>
        d.id === id && !!d.custom === custom ? { ...d, insertedAt: value } : d
      )
    );
  };

  const updateCustomLabel = (id: string, label: string) => {
    onDevicesChange(devices.map((d) => (d.id === id && d.custom ? { ...d, label } : d)));
  };

  const removeCustom = (id: string) => {
    onDevicesChange(devices.filter((d) => !(d.id === id && d.custom)));
  };

  const addCustom = () => {
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    onDevicesChange([...devices, { id, label: "", insertedAt: "", custom: true }]);
  };

  return (
    <div className="space-y-4">
      {/* === Dispositivos === */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-rose-500" />
            <Label className="text-[10px] font-semibold tracking-wider text-muted-foreground">
              DISPOSITIVOS INVASIVOS
            </Label>
          </div>
          <span className="text-[10px] text-muted-foreground">
            D{`{n}`} calculado a partir da inserção
          </span>
        </div>

        <div className="rounded-lg border border-border bg-muted/10 divide-y divide-border/60">
          {DEVICES_CATALOG.map((item) => {
            const active = catalogIndex.get(item.id);
            const checked = !!active;
            const days = active?.insertedAt ? calcDIH(active.insertedAt) : null;
            const tone = deviceAlertTone(days);
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-2 px-2 py-1.5"
              >
                <Checkbox
                  id={`dev-${item.id}`}
                  checked={checked}
                  onCheckedChange={(v) => toggleCatalog(item.id, item.label, !!v)}
                />
                <Label
                  htmlFor={`dev-${item.id}`}
                  className="text-xs font-medium cursor-pointer min-w-[120px]"
                >
                  {item.label}
                  {item.hint && (
                    <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                      ({item.hint})
                    </span>
                  )}
                </Label>
                {checked && (
                  <>
                    <div className="flex-1 min-w-[180px] max-w-[240px]">
                      <DateBRPicker
                        value={active!.insertedAt}
                        onChange={(v) => setInsertedAt(item.id, false, v)}
                        baseDate={admissionDate || undefined}
                        placeholder="Inserção (DD/MM/AAAA)"
                        presets={[1, 3, 5, 7, 10]}
                        presetsPlacement="popover"
                        presetsLabel="A partir da admissão no setor:"
                        allowPast
                        allowClear
                      />
                    </div>
                    {days !== null && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-5 px-1.5 text-[10px] font-semibold border",
                          tone === "ok" && "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
                          tone === "amber" && "bg-amber-500/10 text-amber-700 border-amber-500/40 dark:text-amber-400",
                          tone === "red" && "bg-red-500/10 text-red-700 border-red-500/40 dark:text-red-400",
                        )}
                        title={tone === "red"
                          ? "≥ 14 dias — reavaliar necessidade (alto risco IRAS)"
                          : tone === "amber"
                            ? "≥ 7 dias — atenção, considerar troca/retirada"
                            : undefined}
                      >
                        D{days}
                      </Badge>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {/* Dispositivos customizados */}
          {customs.map((d) => {
            const days = d.insertedAt ? calcDIH(d.insertedAt) : null;
            const tone = deviceAlertTone(days);
            return (
              <div
                key={d.id}
                className="flex flex-wrap items-center gap-2 px-2 py-1.5 bg-muted/20"
              >
                <span className="text-[10px] text-muted-foreground w-[18px] text-center">+</span>
                <Input
                  value={d.label}
                  onChange={(e) => updateCustomLabel(d.id, e.target.value)}
                  placeholder="Nome do dispositivo"
                  className="h-7 text-xs flex-1 min-w-[160px] max-w-[220px]"
                />
                <div className="flex-1 min-w-[180px] max-w-[240px]">
                  <DateBRPicker
                    value={d.insertedAt}
                    onChange={(v) => setInsertedAt(d.id, true, v)}
                    baseDate={admissionDate || undefined}
                    placeholder="Inserção (DD/MM/AAAA)"
                    presets={[1, 3, 5, 7, 10]}
                    presetsPlacement="popover"
                    presetsLabel="A partir da admissão no setor:"
                    allowPast
                    allowClear
                  />
                </div>
                {days !== null && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 px-1.5 text-[10px] font-semibold border",
                      tone === "ok" && "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
                      tone === "amber" && "bg-amber-500/10 text-amber-700 border-amber-500/40 dark:text-amber-400",
                      tone === "red" && "bg-red-500/10 text-red-700 border-red-500/40 dark:text-red-400",
                    )}
                  >
                    D{days}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCustom(d.id)}
                  title="Remover dispositivo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-[11px]"
            onClick={addCustom}
          >
            <Plus className="h-3 w-3" /> Adicionar outro
          </Button>
        </div>
      </section>

      {/* === Culturas === */}
      <section>
        <div className="flex items-center gap-1.5 mb-2">
          <FlaskConical className="h-3.5 w-3.5 text-cyan-500" />
          <Label className="text-[10px] font-semibold tracking-wider text-muted-foreground">
            RESULTADO DE CULTURAS
          </Label>
        </div>
        <RichTextEditor
          value={culturesHtml}
          onChange={onCulturesChange}
          placeholder="Ex.: Hemocultura 2 amostras (12/05) — pendente | Urocultura (10/05) — E. coli sensível a ceftriaxona | Ponta de cateter (11/05) — negativa…"
          minHeight={110}
        />
      </section>
    </div>
  );
};
