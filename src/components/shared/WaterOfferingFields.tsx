import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Droplet, AlertTriangle } from "lucide-react";

/**
 * Catálogo de tipos de água ofertáveis no hospital.
 * Inclui água potável, mineral natural, água de coco, soro caseiro,
 * água para manutenção de pérvio em sondas, etc.
 */
export const WATER_TYPES = [
  { key: "filtrada",   label: "Água filtrada",            detail: "Padrão hospitalar potável" },
  { key: "fervida",    label: "Água fervida (resfriada)", detail: "Quando filtrada não disponível" },
  { key: "mineral",    label: "Água mineral natural",     detail: "Sem gás, garrafa lacrada" },
  { key: "coco",       label: "Água de coco natural",     detail: "Eletrólitos: K, Mg" },
  { key: "soro_caseiro", label: "Soro caseiro",           detail: "1L água + 1 col. chá sal + 2 col. sopa açúcar" },
  { key: "destilada",  label: "Água destilada",           detail: "Manutenção de pérvio (sonda) — não ingerir" },
] as const;
export type WaterType = typeof WATER_TYPES[number]["key"];

/** Vias relevantes para oferta hídrica enteral/oral. */
export const WATER_ROUTES = [
  { key: "vo_livre",   label: "VO livre demanda" },
  { key: "vo_ofertada", label: "VO ofertada (auxiliada)" },
  { key: "sng",        label: "SNG" },
  { key: "sne",        label: "SNE" },
  { key: "sog",        label: "SOG" },
  { key: "gtt",        label: "Gastrostomia (GTT)" },
  { key: "jtt",        label: "Jejunostomia (JTT)" },
  { key: "hipodermo",  label: "Hipodermóclise" },
] as const;
export type WaterRoute = typeof WATER_ROUTES[number]["key"];

export const WATER_FRACTIONS = [
  "Livre demanda",
  "Após cada dieta",
  "Antes de cada medicação",
  "Após cada medicação",
  "1/1h",
  "2/2h",
  "3/3h",
  "4/4h",
  "6/6h",
  "8/8h",
] as const;

export const WATER_TEMPERATURES = [
  { key: "ambiente", label: "Ambiente" },
  { key: "gelada",   label: "Gelada" },
  { key: "morna",    label: "Morna" },
] as const;
export type WaterTemperature = typeof WATER_TEMPERATURES[number]["key"];

export interface WaterOfferingState {
  type: WaterType;
  route: WaterRoute;
  volumePerOffering: string;   // mL por oferta
  fraction: string;            // ex: "4/4h"
  temperature: WaterTemperature;
  restriction: boolean;
  restrictionLimit: string;    // mL/24h máx (string para input)
  notes: string;
}

export const DEFAULT_WATER_STATE: WaterOfferingState = {
  type: "filtrada",
  route: "vo_livre",
  volumePerOffering: "100",
  fraction: "4/4h",
  temperature: "ambiente",
  restriction: false,
  restrictionLimit: "1000",
  notes: "",
};

/** Calcula volume total estimado em 24h a partir do fracionamento. */
export function computeWaterTotal24h(state: WaterOfferingState): number | null {
  const vol = parseFloat(state.volumePerOffering) || 0;
  if (!vol) return null;
  const f = state.fraction;
  // Fracionamentos com periodicidade conhecida em horas
  const map: Record<string, number> = {
    "1/1h": 24,
    "2/2h": 12,
    "3/3h": 8,
    "4/4h": 6,
    "6/6h": 4,
    "8/8h": 3,
  };
  if (map[f]) return vol * map[f];
  // Demais (livre demanda / após dieta / após med) — não dá pra prever
  return null;
}

/** Constrói o nome curto da prescrição: "Água filtrada · 100mL VO 4/4h". */
export function buildWaterEntryName(state: WaterOfferingState): string {
  const type = WATER_TYPES.find(t => t.key === state.type)?.label ?? "Água";
  const vol = parseFloat(state.volumePerOffering) || 0;
  const route = WATER_ROUTES.find(r => r.key === state.route)?.label ?? "";
  return `${type} — ${vol > 0 ? `${vol}mL · ` : ""}${route} · ${state.fraction}`;
}

/** Linha de instrução estendida (temperatura, total/24h, restrição). */
export function buildWaterInstruction(state: WaterOfferingState): string {
  const total = computeWaterTotal24h(state);
  const temp = WATER_TEMPERATURES.find(t => t.key === state.temperature)?.label ?? "";
  const parts = [
    total !== null ? `Total estimado ${total}mL/24h` : "Volume conforme demanda",
    temp ? `Temperatura ${temp.toLowerCase()}` : null,
    state.restriction ? `⚠ Restrição hídrica: máx ${state.restrictionLimit}mL/24h` : null,
    state.notes || null,
  ].filter(Boolean);
  return parts.join(" · ");
}

interface Props {
  value: WaterOfferingState;
  onChange: (next: WaterOfferingState) => void;
  /** Cor de destaque (border/text) — segue identidade do wizard pai. */
  accentClassName?: string; // ex: "border-blue-500 bg-blue-50"
  accentTextClassName?: string; // ex: "text-blue-700"
}

export function WaterOfferingFields({
  value,
  onChange,
  accentClassName = "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30",
  accentTextClassName = "text-cyan-700 dark:text-cyan-300",
}: Props) {
  const total = computeWaterTotal24h(value);
  const set = <K extends keyof WaterOfferingState>(k: K, v: WaterOfferingState[K]) =>
    onChange({ ...value, [k]: v });

  const overLimit = value.restriction
    && total !== null
    && parseFloat(value.restrictionLimit) > 0
    && total > parseFloat(value.restrictionLimit);

  return (
    <div className="space-y-3">
      {/* Tipo de água */}
      <div>
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Droplet className="h-3 w-3" /> Tipo de água
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1.5">
          {WATER_TYPES.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => set("type", t.key)}
              className={cn(
                "text-left p-2 rounded-md border transition-all",
                value.type === t.key
                  ? accentClassName
                  : "border-border bg-background hover:border-muted-foreground/40"
              )}
            >
              <p className="text-xs font-semibold">{t.label}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{t.detail}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Via</Label>
          <Select value={value.route} onValueChange={(v) => set("route", v as WaterRoute)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[90]">
              {WATER_ROUTES.map(r => (
                <SelectItem key={r.key} value={r.key} className="text-xs">{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Volume / oferta (mL)</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={value.volumePerOffering}
            onChange={(e) => set("volumePerOffering", e.target.value)}
            className="h-7 text-xs"
          />
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Fracionamento</Label>
          <Select value={value.fraction} onValueChange={(v) => set("fraction", v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[90]">
              {WATER_FRACTIONS.map(f => (
                <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Temperatura</Label>
          <Select value={value.temperature} onValueChange={(v) => set("temperature", v as WaterTemperature)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[90]">
              {WATER_TEMPERATURES.map(t => (
                <SelectItem key={t.key} value={t.key} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <Checkbox checked={value.restriction} onCheckedChange={(v) => set("restriction", !!v)} />
          Restrição hídrica
        </label>
        {value.restriction && (
          <div className="flex items-center gap-1">
            <Label className="text-[10px] text-muted-foreground">Máx mL/24h</Label>
            <Input
              type="number"
              value={value.restrictionLimit}
              onChange={(e) => set("restrictionLimit", e.target.value)}
              className="h-7 text-xs w-20"
            />
          </div>
        )}
      </div>

      {/* Resumo / alerta */}
      <div className={cn(
        "rounded-md border p-2 text-xs flex items-center justify-between gap-2",
        overLimit
          ? "border-red-300 bg-red-50/60 dark:bg-red-950/20"
          : "border-border bg-muted/30"
      )}>
        <div className="flex flex-col">
          <span className={cn("text-[10px] uppercase tracking-wider font-semibold", accentTextClassName)}>
            Total estimado
          </span>
          <span className="font-semibold">
            {total !== null ? `${total}mL / 24h` : "Volume conforme demanda (não calculável)"}
          </span>
        </div>
        {overLimit && (
          <div className="flex items-center gap-1 text-red-700 dark:text-red-300 text-[11px]">
            <AlertTriangle className="h-3.5 w-3.5" />
            Excede o limite de restrição
          </div>
        )}
      </div>
    </div>
  );
}
