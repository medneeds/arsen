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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEVICES_CATALOG,
  DETAIL_OTHER_LABEL,
  type DeviceCatalogItem,
  type EvolutionDevice,
  deviceAlertTone,
  deviceCatalogId,
  makeDeviceInstanceId,
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

  const updateCustomLabel = (id: string, label: string) => {
    onDevicesChange(devices.map((d) => (d.id === id && d.custom ? { ...d, label } : d)));
  };

  const removeCustom = (id: string) => {
    onDevicesChange(devices.filter((d) => !(d.id === id && d.custom)));
  };

  // ── Dispositivos de unidade múltipla (ex.: dreno) ────────────────────────
  // O checkbox é só o INTERRUPTOR: cada unidade vira uma linha própria com
  // tipo + data + lixeira, todas no mesmo formato. Marcar já cria a primeira,
  // pronta para preencher; desmarcar remove todas.
  const instancesOf = (catalogId: string) =>
    devices.filter((d) => deviceCatalogId(d) === catalogId);

  // Instâncias em modo texto livre. Derivado OU explícito: subtipo fora das
  // opções já entra como livre (cobre registro antigo salvo à mão), e escolher
  // "Outro (digitar)" marca o modo antes de existir texto algum.
  const [freeIds, setFreeIds] = useState<Set<string>>(new Set());

  const isFreeDetail = (d: EvolutionDevice) => {
    if (freeIds.has(d.id)) return true;
    const item = DEVICES_CATALOG.find((c) => c.id === deviceCatalogId(d));
    return !!d.detail && !(item?.detailOptions ?? []).includes(d.detail);
  };

  const markFree = (id: string, on: boolean) =>
    setFreeIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const patchInstance = (id: string, patch: Partial<EvolutionDevice>) =>
    onDevicesChange(devices.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const addInstance = (item: DeviceCatalogItem) =>
    onDevicesChange([
      ...devices,
      {
        id: makeDeviceInstanceId(item.id),
        catalogId: item.id,
        label: item.label,
        insertedAt: "",
      },
    ]);

  const removeInstance = (id: string) => {
    markFree(id, false);
    onDevicesChange(devices.filter((d) => d.id !== id));
  };

  const chooseDetail = (id: string, value: string) => {
    const livre = value === DETAIL_OTHER_LABEL;
    markFree(id, livre);
    patchInstance(id, { detail: livre ? "" : value });
  };

  const toggleMultiple = (item: DeviceCatalogItem, checked: boolean) => {
    if (checked) {
      if (instancesOf(item.id).length > 0) return;
      addInstance(item);
      return;
    }
    const ids = new Set(instancesOf(item.id).map((d) => d.id));
    setFreeIds((prev) => new Set([...prev].filter((x) => !ids.has(x))));
    onDevicesChange(devices.filter((d) => !ids.has(d.id)));
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
            // ── Dispositivo de unidade múltipla: interruptor + N linhas ──
            if (item.multiple) {
              const insts = instancesOf(item.id);
              const on = insts.length > 0;
              return (
                <div key={item.id} className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`dev-${item.id}`}
                      checked={on}
                      onCheckedChange={(v) => toggleMultiple(item, !!v)}
                    />
                    <Label
                      htmlFor={`dev-${item.id}`}
                      className="text-xs font-medium cursor-pointer min-w-[120px]"
                    >
                      {item.label}
                    </Label>
                    {on && (
                      <span className="text-[10px] text-muted-foreground">
                        {insts.length} {insts.length === 1 ? "unidade" : "unidades"}
                      </span>
                    )}
                  </div>

                  {on && (
                    <div className="mt-1.5 space-y-1.5 pl-6">
                      {insts.map((d, i) => {
                        const days = d.insertedAt ? calcDIH(d.insertedAt) : null;
                        const tone = deviceAlertTone(days);
                        const livre = isFreeDetail(d);
                        return (
                          <div key={d.id} className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-muted-foreground w-4 shrink-0 text-right">
                              {i + 1}.
                            </span>

                            {livre ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={d.detail ?? ""}
                                  onChange={(e) => patchInstance(d.id, { detail: e.target.value })}
                                  placeholder={item.detailLabel ?? "Tipo"}
                                  aria-label={item.detailLabel ?? `Tipo de ${item.label}`}
                                  className="h-7 text-xs w-[190px]"
                                />
                                <button
                                  type="button"
                                  onClick={() => { markFree(d.id, false); patchInstance(d.id, { detail: "" }); }}
                                  className="shrink-0 h-7 px-2 rounded border border-border bg-muted/40 text-muted-foreground text-[9px] font-semibold hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap"
                                  title="Voltar para a lista de tipos"
                                >
                                  Lista
                                </button>
                              </div>
                            ) : (
                              <Select value={d.detail || ""} onValueChange={(v) => chooseDetail(d.id, v)}>
                                <SelectTrigger className="h-7 text-xs w-[230px]">
                                  <SelectValue placeholder={item.detailLabel ?? "Tipo"} />
                                </SelectTrigger>
                                <SelectContent className="z-[90]">
                                  {(item.detailOptions ?? []).map((opt) => (
                                    <SelectItem key={opt} value={opt} className="text-xs">
                                      {opt}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value={DETAIL_OTHER_LABEL} className="text-xs italic">
                                    {DETAIL_OTHER_LABEL}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}

                            <div className="flex items-center gap-1.5 flex-1 min-w-[180px] max-w-[300px]">
                              <DateBRPicker
                                value={d.insertedAt}
                                onChange={(v) => patchInstance(d.id, { insertedAt: v })}
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
                                  onClick={() => patchInstance(d.id, { insertedAt: admissionDateBR })}
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

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => removeInstance(d.id)}
                              title={`Remover ${item.label.toLowerCase()} ${i + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => addInstance(item)}
                        className="inline-flex items-center gap-1 h-7 px-2 rounded border border-dashed border-border text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:border-solid transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        Adicionar {item.label.toLowerCase()}
                      </button>
                    </div>
                  )}
                </div>
              );
            }

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
            onClick={() => addCustom()}
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
