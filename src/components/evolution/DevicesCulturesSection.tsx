import React, { useMemo, useState } from "react";
import { Plus, Trash2, Activity, FlaskConical, CalendarCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateBRPicker } from "@/components/ui/DateBRPicker";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { CVCChecklistDialog } from "@/components/CVCChecklistDialog";
import { cn } from "@/lib/utils";
import {
  DEVICES_CATALOG,
  type EvolutionDevice,
  deviceAlertTone,
  suggestDetailForLabel,
} from "@/lib/devicesCatalog";
import { calcDIH } from "@/lib/dihCalc";

interface DevicesCulturesSectionProps {
  devices: EvolutionDevice[];
  onDevicesChange: (next: EvolutionDevice[]) => void;
  culturesHtml: string;
  onCulturesChange: (html: string) => void;
  /** Data base p/ presets do date picker (admissão no setor). Aceita ISO ou BR. */
  admissionDate?: string | null;
  /** Identificação do paciente — necessária para o Checklist/Bundle de CVC. */
  patientId?: string | null;
  patientName?: string;
}

/** Normaliza admissionDate (ISO yyyy-MM-dd ou BR dd/MM/yyyy) para DD/MM/YYYY */
function parseAdmissionDateBR(date?: string | null): string | null {
  if (!date) return null;
  // já está em BR
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date.trim())) return date.trim();
  // ISO yyyy-MM-dd
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return null;
}

export const DevicesCulturesSection: React.FC<DevicesCulturesSectionProps> = ({
  devices,
  onDevicesChange,
  culturesHtml,
  onCulturesChange,
  admissionDate,
  patientId,
  patientName,
}) => {
  const admissionDateBR = parseAdmissionDateBR(admissionDate);
  const [cvcChecklistOpen, setCvcChecklistOpen] = useState(false);
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

  const setDetail = (id: string, custom: boolean, value: string) => {
    onDevicesChange(
      devices.map((d) =>
        d.id === id && !!d.custom === custom ? { ...d, detail: value } : d
      )
    );
  };

  const updateCustomLabel = (id: string, label: string) => {
    onDevicesChange(devices.map((d) => (d.id === id && d.custom ? { ...d, label } : d)));
  };

  const removeCustom = (id: string) => {
    onDevicesChange(devices.filter((d) => !(d.id === id && d.custom)));
  };

  const addCustom = (initialLabel = "") => {
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    onDevicesChange([...devices, { id, label: initialLabel, insertedAt: "", custom: true }]);
  };

  const cvcActive = catalogIndex.get("cvc");

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
            const cvcActive = catalogIndex.get("cvc");

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
                    <div className="flex items-center gap-1.5 flex-1 min-w-[180px] max-w-[320px]">
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
                      {admissionDateBR && (
                        <button
                          type="button"
                          onClick={() => setInsertedAt(item.id, false, admissionDateBR)}
                          className="shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[9px] font-semibold hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
                          title={`Usar data de admissão: ${admissionDateBR}`}
                        >
                          <CalendarCheck className="h-3 w-3" />
                          Admissão
                        </button>
                      )}
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
                    {/* Subtipo — aparece p/ dispositivos que declaram detailOptions (ex.: Dreno) */}
                    {item.detailOptions && item.detailOptions.length > 0 && (
                      <div className="flex items-center gap-1.5 basis-full sm:basis-auto sm:min-w-[200px] sm:max-w-[260px]">
                        <Input
                          value={active!.detail ?? ""}
                          onChange={(e) => setDetail(item.id, false, e.target.value)}
                          placeholder={item.detailLabel ?? "Tipo"}
                          list={`dev-detail-${item.id}`}
                          aria-label={item.detailLabel ?? `Tipo de ${item.label}`}
                          className="h-7 text-xs"
                        />
                        <datalist id={`dev-detail-${item.id}`}>
                          {item.detailOptions.map((opt) => (
                            <option key={opt} value={opt} />
                          ))}
                        </datalist>
                      </div>
                    )}

                    {/* Atalho p/ paciente com mais de um do mesmo dispositivo
                        (ex.: dois drenos). O catálogo tem 1 checkbox por
                        dispositivo, então o segundo entra como customizado —
                        este botão já o cria com o rótulo certo e o campo de
                        tipo pronto, em vez de exigir digitar "Dreno" na mão. */}
                    {item.detailOptions && item.detailOptions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => addCustom(item.label)}
                        className="shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded border border-border bg-muted/40 text-muted-foreground text-[9px] font-semibold hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap"
                        title={`Adicionar outro ${item.label.toLowerCase()}`}
                      >
                        <Plus className="h-3 w-3" />
                        Outro
                      </button>
                    )}

                    {/* Checklist de inserção — aparece quando CVC está ativo */}
                    {item.id === "cvc" && (
                      <button
                        type="button"
                        onClick={() => setCvcChecklistOpen(true)}
                        className="shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded border border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[9px] font-semibold hover:bg-blue-500/20 transition-colors whitespace-nowrap"
                        title="Preencher checklist de inserção CVC (bundle CCIH)"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        Checklist
                      </button>
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
            const cvcActive = catalogIndex.get("cvc");

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
                <div className="flex items-center gap-1.5 flex-1 min-w-[180px] max-w-[320px]">
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
                  {admissionDateBR && (
                    <button
                      type="button"
                      onClick={() => setInsertedAt(d.id, true, admissionDateBR)}
                      className="shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[9px] font-semibold hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
                      title={`Usar data de admissão: ${admissionDateBR}`}
                    >
                      <CalendarCheck className="h-3 w-3" />
                      Admissão
                    </button>
                  )}
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
                {/* Subtipo do customizado — inferido do rótulo digitado, para
                    que o segundo dreno tenha as MESMAS sugestões do primeiro.
                    Casa "Dreno", "dreno 2", "dreno torácico E" etc. */}
                {(() => {
                  const sug = suggestDetailForLabel(d.label);
                  if (!sug?.detailOptions?.length) return null;
                  return (
                    <div className="flex items-center gap-1.5 basis-full sm:basis-auto sm:min-w-[200px] sm:max-w-[260px]">
                      <Input
                        value={d.detail ?? ""}
                        onChange={(e) => setDetail(d.id, true, e.target.value)}
                        placeholder={sug.detailLabel ?? "Tipo"}
                        list={`dev-detail-custom-${d.id}`}
                        aria-label={sug.detailLabel ?? `Tipo de ${d.label}`}
                        className="h-7 text-xs"
                      />
                      <datalist id={`dev-detail-custom-${d.id}`}>
                        {sug.detailOptions.map((opt) => (
                          <option key={opt} value={opt} />
                        ))}
                      </datalist>
                    </div>
                  );
                })()}
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
      <CVCChecklistDialog
        open={cvcChecklistOpen}
        onOpenChange={setCvcChecklistOpen}
        insertedAt={cvcActive?.insertedAt || ""}
        patientId={patientId}
        patientName={patientName}
      />
    </div>
  );
};
