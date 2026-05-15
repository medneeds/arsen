import { useState } from "react";
import { CalendarClock, HeartHandshake, ShieldAlert, Plus, X, Check, RotateCcw, CalendarIcon, Hospital, Activity, Stethoscope, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CidSearchInput } from "@/components/CidSearchInput";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid as isValidDate } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DiagnosticsPanelProps {
  cidPrimary?: string;
  cidSecondary?: string[];
  onCidPrimaryChange?: (value: string) => void;
  onCidSecondaryChange?: (values: string[]) => void;

  /** ISO yyyy-MM-dd (preferido). Strings legadas livres ainda são tratadas. */
  utiDischargePrediction: string;
  onUtiDischargePredictionChange: (value: string) => void;

  hospitalDischargePrediction: string;
  onHospitalDischargePredictionChange: (value: string) => void;

  isPalliative: boolean;
  onPalliativeChange: (value: boolean) => void;

  isolationPrecautions: string;
  onIsolationChange: (value: string) => void;

  /** Texto livre de hipóteses diagnósticas (uma por linha). Sincroniza com mapa de leitos. */
  diagnosticHypotheses?: string;
  onDiagnosticHypothesesChange?: (value: string) => void;

  /** Quando true, exibe também o calendário de alta da UTI (setores UTI/UCI). */
  showUtiPrediction?: boolean;

  /** Pré-disposição: callback para limpar todos os campos (replicação anterior). */
  onClearAll?: () => void;
  /** Indica que o conteúdo veio replicado de uma evolução anterior. */
  replicated?: boolean;

  className?: string;
}

const PRECAUTION_PRESETS = [
  "Contato",
  "Gotículas",
  "Aerossóis",
  "Contato + Gotículas",
  "Contato + Aerossóis",
  "Reverso (Imunossuprimido)",
];

const QUICK_DATE_OFFSETS = [
  { label: "Hoje", offset: 0 },
  { label: "+1d", offset: 1 },
  { label: "+2d", offset: 2 },
  { label: "+3d", offset: 3 },
  { label: "+7d", offset: 7 },
];

/* ---------- Helpers ---------- */
const toDateOrNull = (value: string): Date | null => {
  if (!value) return null;
  // ISO yyyy-MM-dd
  const iso = parseISO(value);
  if (isValidDate(iso)) return iso;
  // dd/MM/yyyy fallback
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [_, d, mo, y] = m;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d));
    if (isValidDate(dt)) return dt;
  }
  return null;
};

const toIso = (d: Date | undefined | null): string => {
  if (!d || !isValidDate(d)) return "";
  return format(d, "yyyy-MM-dd");
};

const formatDisplay = (value: string): string => {
  const d = toDateOrNull(value);
  if (d) return format(d, "dd/MM/yyyy", { locale: ptBR });
  return value || "";
};

export function DiagnosticsPanel({
  cidPrimary,
  cidSecondary = [],
  onCidPrimaryChange,
  onCidSecondaryChange,
  utiDischargePrediction,
  onUtiDischargePredictionChange,
  hospitalDischargePrediction,
  onHospitalDischargePredictionChange,
  isPalliative,
  onPalliativeChange,
  isolationPrecautions,
  onIsolationChange,
  diagnosticHypotheses = "",
  onDiagnosticHypothesesChange,
  showUtiPrediction = false,
  onClearAll,
  replicated = false,
  className,
}: DiagnosticsPanelProps) {
  const hasIsolation = !!isolationPrecautions?.trim();
  const hasAnyPrediction = !!(utiDischargePrediction?.trim() || hospitalDischargePrediction?.trim());
  const [predictionEnabled, setPredictionEnabled] = useState<boolean>(hasAnyPrediction);

  const handleTogglePrediction = (on: boolean) => {
    setPredictionEnabled(on);
    if (!on) {
      // Clear both predictions when turning off
      if (utiDischargePrediction) onUtiDischargePredictionChange("");
      if (hospitalDischargePrediction) onHospitalDischargePredictionChange("");
    }
  };

  return (
    <section className={cn("space-y-3", className)}>
      {/* Replicated banner */}
      {replicated && onClearAll && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 px-2.5 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-blue-700 dark:text-blue-300">
            <RotateCcw className="h-3 w-3" />
            <span className="font-medium">Diagnósticos replicados da evolução anterior</span>
            <span className="text-blue-600/70 dark:text-blue-400/70">— revise e ajuste</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1 text-blue-700 hover:text-blue-800 hover:bg-blue-500/10 dark:text-blue-300"
            onClick={onClearAll}
          >
            <X className="h-3 w-3" /> Limpar
          </Button>
        </div>
      )}

      {/* Status badges */}
      {(isPalliative || hasIsolation) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {isPalliative && (
            <Badge className="h-5 text-[9px] gap-1 bg-purple-500/15 text-purple-600 border border-purple-500/30 dark:text-purple-300">
              <HeartHandshake className="h-3 w-3" />
              Paliativo
            </Badge>
          )}
          {hasIsolation && (
            <Badge className="h-5 text-[9px] gap-1 bg-amber-500/15 text-amber-700 border border-amber-500/30 dark:text-amber-300">
              <ShieldAlert className="h-3 w-3" />
              {isolationPrecautions}
            </Badge>
          )}
        </div>
      )}

      {/* CID chips line */}
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          CID-10
        </Label>
        <div className="flex items-center gap-1.5 flex-wrap">
          <CidChip
            label="P"
            value={cidPrimary}
            onChange={onCidPrimaryChange}
            tone="primary"
            placeholder="Primário"
          />
          {cidSecondary.map((cid, idx) => (
            <CidChip
              key={`${cid}-${idx}`}
              value={cid}
              onChange={(v) => {
                if (!onCidSecondaryChange) return;
                const next = [...cidSecondary];
                if (!v) next.splice(idx, 1);
                else next[idx] = v;
                onCidSecondaryChange(next);
              }}
              tone="muted"
            />
          ))}
          {onCidSecondaryChange && cidSecondary.length < 5 && (
            <CidChip
              tone="ghost"
              icon={<Plus className="h-3 w-3" />}
              placeholder="+ Secundário"
              onChange={(v) => {
                if (v) onCidSecondaryChange([...cidSecondary, v]);
              }}
            />
          )}
        </div>
      </div>

      {/* Hipóteses Diagnósticas (texto livre) — sincroniza com o mapa de leitos */}
      {onDiagnosticHypothesesChange && (
        <div className="rounded-md border border-border/60 bg-background/40 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1.5">
              <Stethoscope className="h-3 w-3" />
              Hipóteses / Diagnósticos
              <span className="text-[9px] normal-case tracking-normal text-muted-foreground/70">
                (uma por linha)
              </span>
            </Label>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 text-[9px] font-medium">
              <Lock className="h-2.5 w-2.5" />
              Sincroniza com o mapa
            </span>
          </div>
          <Textarea
            value={diagnosticHypotheses}
            onChange={(e) => onDiagnosticHypothesesChange(e.target.value)}
            placeholder={"1. Sepse de foco pulmonar\n2. Insuficiência renal aguda KDIGO 2\n3. Diabetes mellitus tipo 2 descompensado"}
            rows={4}
            className="text-xs resize-y min-h-[88px]"
          />
          <p className="text-[9px] text-muted-foreground leading-tight">
            O preenchimento aqui substitui as hipóteses no mapa de leitos ao salvar a evolução.
            O mapa fica bloqueado para edição direta.
          </p>
        </div>
      )}

      <div className="rounded-md border border-border/60 bg-background/40 p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className={cn("h-3.5 w-3.5", predictionEnabled ? "text-primary" : "text-muted-foreground")} />
            <div className="leading-tight">
              <p className="text-[11px] font-medium text-foreground">Tem previsão de alta?</p>
              <p className="text-[9px] text-muted-foreground">
                {showUtiPrediction ? "Registra alta da UTI/UCI e/ou alta hospitalar" : "Registra previsão de alta hospitalar"}
              </p>
            </div>
          </div>
          <Switch
            checked={predictionEnabled}
            onCheckedChange={handleTogglePrediction}
          />
        </div>

        {predictionEnabled && (
          <div className={cn("grid gap-2", showUtiPrediction ? "md:grid-cols-2" : "md:grid-cols-1")}>
            {showUtiPrediction && (
              <DatePredictionField
                icon={<Activity className="h-3 w-3" />}
                label="Alta da UTI/UCI"
                value={utiDischargePrediction}
                onChange={onUtiDischargePredictionChange}
                accent="emerald"
              />
            )}
            <DatePredictionField
              icon={<Hospital className="h-3 w-3" />}
              label="Alta Hospitalar"
              value={hospitalDischargePrediction}
              onChange={onHospitalDischargePredictionChange}
              accent="primary"
            />
          </div>
        )}
      </div>

      {/* Paliativo + Precaução grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Paliativo */}
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <HeartHandshake className={cn("h-3.5 w-3.5 shrink-0", isPalliative ? "text-purple-500" : "text-muted-foreground")} />
            <div className="leading-tight">
              <p className="text-[11px] font-medium text-foreground">Cuidados Paliativos</p>
              <p className="text-[9px] text-muted-foreground">Manejo focado em conforto</p>
            </div>
          </div>
          <Switch
            checked={isPalliative}
            onCheckedChange={onPalliativeChange}
            className="data-[state=checked]:bg-purple-500"
          />
        </div>

        {/* Precaução / Isolamento */}
        <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> Precaução / Isolamento
            </Label>
            <PrecautionPicker value={isolationPrecautions} onSelect={onIsolationChange} />
          </div>
          <Input
            value={isolationPrecautions}
            onChange={(e) => onIsolationChange(e.target.value)}
            placeholder="Ex: Contato, Gotículas, Reverso… ou nenhuma"
            className={cn(
              "h-7 text-xs",
              hasIsolation && "border-amber-500/40 bg-amber-500/5",
            )}
          />
        </div>
      </div>
    </section>
  );
}

/* ---------- Date Prediction Field with Calendar + Quick Buttons ---------- */
interface DatePredictionFieldProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (iso: string) => void;
  accent?: "primary" | "emerald";
}

function DatePredictionField({ icon, label, value, onChange, accent = "primary" }: DatePredictionFieldProps) {
  const [open, setOpen] = useState(false);
  const date = toDateOrNull(value);
  const displayValue = date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "";
  const accentClass = accent === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-primary";

  return (
    <div className="space-y-1">
      <Label className={cn("text-[10px] uppercase tracking-wide font-medium flex items-center gap-1", accentClass)}>
        {icon} {label}
      </Label>
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-7 px-2 flex-1 justify-start text-xs font-normal gap-1.5",
                !displayValue && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="h-3 w-3 shrink-0 opacity-70" />
              {displayValue || <span>Escolher data…</span>}
              {displayValue && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onChange(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onChange(""); } }}
                  className="ml-auto -mr-1 h-4 w-4 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive cursor-pointer"
                  title="Limpar"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date ?? undefined}
              onSelect={(d) => { onChange(toIso(d)); setOpen(false); }}
              initialFocus
              locale={ptBR}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex items-center gap-0.5 flex-wrap">
        {QUICK_DATE_OFFSETS.map(q => (
          <button
            key={q.label}
            type="button"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + q.offset);
              onChange(toIso(d));
            }}
            className="text-[9px] px-1.5 h-5 rounded border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={`Em ${q.offset} dia(s)`}
          >
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- CID chip ---------- */
interface CidChipProps {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  tone?: "primary" | "muted" | "ghost";
  placeholder?: string;
  icon?: React.ReactNode;
}

function CidChip({ value, onChange, label, tone = "muted", placeholder, icon }: CidChipProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const code = value ? value.split(" - ")[0] : "";
  const desc = value ? value.substring(value.indexOf(" - ") + 3) : "";
  const isReadOnly = !onChange;

  const toneClass =
    tone === "primary"
      ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15"
      : tone === "ghost"
      ? "bg-transparent text-muted-foreground border-dashed border-border hover:bg-muted/50"
      : "bg-muted text-foreground border-border hover:bg-muted/80";

  if (!value) {
    if (isReadOnly) return null;
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 px-2 h-6 rounded-md border text-[10px] font-medium transition-colors",
              toneClass,
            )}
          >
            {icon}
            {label && <span className="text-[9px] opacity-70 font-bold">{label}</span>}
            <span>{placeholder ?? "Adicionar"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
            Selecionar CID-10
          </p>
          <CidSearchInput
            value={draft}
            onChange={(v) => {
              if (v) {
                onChange?.(v);
                setOpen(false);
                setDraft("");
              }
            }}
            placeholder="Buscar por código ou descrição…"
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={value}
          className={cn(
            "inline-flex items-center gap-1 px-2 h-6 rounded-md border text-[10px] font-mono transition-colors max-w-[200px]",
            toneClass,
            isReadOnly && "cursor-default hover:bg-muted",
          )}
        >
          {label && <span className="text-[9px] opacity-70 font-bold font-sans">{label}</span>}
          <span className="font-semibold">{code}</span>
          {desc && (
            <span className="font-sans truncate opacity-80 max-w-[140px]">· {desc}</span>
          )}
        </button>
      </PopoverTrigger>
      {!isReadOnly && (
        <PopoverContent className="w-80 p-3" align="start">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
            Alterar CID-10
          </p>
          <CidSearchInput
            value={draft}
            onChange={(v) => {
              if (v) {
                onChange?.(v);
                setOpen(false);
                setDraft("");
              }
            }}
            placeholder="Buscar por código ou descrição…"
          />
          <button
            type="button"
            onClick={() => { onChange?.(""); setOpen(false); }}
            className="w-full mt-2 inline-flex items-center justify-center gap-1.5 text-[11px] text-destructive hover:bg-destructive/10 rounded-md py-1.5 transition-colors"
          >
            <X className="h-3 w-3" /> Remover CID
          </button>
        </PopoverContent>
      )}
    </Popover>
  );
}

/* ---------- Precaution picker ---------- */
function PrecautionPicker({
  value, onSelect,
}: { value: string; onSelect: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-[9px] px-1.5 h-5 rounded border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          Sugestões
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1.5" align="end">
        <div className="space-y-0.5">
          {PRECAUTION_PRESETS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => { onSelect(p); setOpen(false); }}
              className={cn(
                "w-full text-left text-[11px] px-2 py-1.5 rounded hover:bg-muted/70 flex items-center justify-between",
                value === p && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
              )}
            >
              <span>{p}</span>
              {value === p && <Check className="h-3 w-3" />}
            </button>
          ))}
          <div className="border-t border-border/60 my-1" />
          <button
            type="button"
            onClick={() => { onSelect(""); setOpen(false); }}
            className="w-full text-left text-[11px] px-2 py-1.5 rounded hover:bg-destructive/10 text-destructive flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Sem precaução
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
