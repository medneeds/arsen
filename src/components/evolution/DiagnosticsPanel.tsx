import { useState } from "react";
import { Stethoscope, CalendarClock, HeartHandshake, ShieldAlert, Plus, X, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CidSearchInput } from "@/components/CidSearchInput";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DiagnosticsPanelProps {
  cidPrimary?: string;
  cidSecondary?: string[];
  onCidPrimaryChange?: (value: string) => void;
  onCidSecondaryChange?: (values: string[]) => void;

  dischargePrediction: string;
  onDischargePredictionChange: (value: string) => void;

  isPalliative: boolean;
  onPalliativeChange: (value: boolean) => void;

  isolationPrecautions: string;
  onIsolationChange: (value: string) => void;

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

const QUICK_DATES = [
  { label: "Hoje", offset: 0 },
  { label: "Amanhã", offset: 1 },
  { label: "48h", offset: 2 },
  { label: "72h", offset: 3 },
  { label: "7 dias", offset: 7 },
];

export function DiagnosticsPanel({
  cidPrimary,
  cidSecondary = [],
  onCidPrimaryChange,
  onCidSecondaryChange,
  dischargePrediction,
  onDischargePredictionChange,
  isPalliative,
  onPalliativeChange,
  isolationPrecautions,
  onIsolationChange,
  className,
}: DiagnosticsPanelProps) {
  const hasIsolation = !!isolationPrecautions?.trim();

  return (
    <section
      className={cn(
        "rounded-xl border border-border/60 bg-card/80 p-3 space-y-3",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
          <Stethoscope className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="leading-tight">
          <h2 className="text-sm font-semibold text-foreground">Diagnósticos</h2>
          <p className="text-[10px] text-muted-foreground">
            CID-10, previsão de alta, paliativo e precauções — sincronizados com a admissão
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
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
      </div>

      {/* CID chips line */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium w-16">
          CID-10
        </Label>
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

      {/* Two-column grid: discharge prediction + paliativo / precaução */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Previsão de alta */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> Previsão de alta
            </Label>
            <div className="flex items-center gap-0.5">
              {QUICK_DATES.map(q => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + q.offset);
                    const formatted = format(d, "dd/MM/yyyy", { locale: ptBR });
                    onDischargePredictionChange(formatted);
                  }}
                  className="text-[9px] px-1.5 h-5 rounded border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title={`Em ${q.offset} dia(s)`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
          <Input
            value={dischargePrediction}
            onChange={(e) => onDischargePredictionChange(e.target.value)}
            placeholder="Ex: 25/04/2026, em 3 dias, sem previsão…"
            className="h-7 text-xs"
          />
        </div>

        {/* Paliativo + Precaução combined */}
        <div className="space-y-2">
          {/* Paliativo */}
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <HeartHandshake className={cn("h-3.5 w-3.5 shrink-0", isPalliative ? "text-purple-500" : "text-muted-foreground")} />
              <div className="leading-tight">
                <p className="text-[11px] font-medium text-foreground">Cuidados Paliativos</p>
                <p className="text-[9px] text-muted-foreground">
                  Manejo focado em conforto
                </p>
              </div>
            </div>
            <Switch
              checked={isPalliative}
              onCheckedChange={onPalliativeChange}
              className="data-[state=checked]:bg-purple-500"
            />
          </div>

          {/* Precaução / Isolamento */}
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> Precaução / Isolamento
              </Label>
              <PrecautionPicker
                value={isolationPrecautions}
                onSelect={onIsolationChange}
              />
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
      </div>
    </section>
  );
}

/* ---------- CID chip (mirrors CompactPatientHeader) ---------- */
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
