import { useState } from "react";
import { BedDouble, AlertTriangle, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CidSearchInput } from "@/components/CidSearchInput";
import { CopyNameButton } from "@/components/CopyNameButton";
import { cn } from "@/lib/utils";

interface CompactPatientHeaderProps {
  name: string;
  bed: string;
  unit: string;
  age: string;
  sex?: string;
  weight?: string;
  allergies?: string;
  /** Primary CID-10 ("A00 - Description") */
  cidPrimary?: string;
  /** Secondary CID-10s */
  cidSecondary?: string[];
  /** Called when primary CID changes (set/clear) */
  onCidPrimaryChange?: (value: string) => void;
  /** Called when secondary CID list changes */
  onCidSecondaryChange?: (values: string[]) => void;
  /** Hide CID chips (for pages that don't manage CID) */
  hideCid?: boolean;
  className?: string;
}

/**
 * Compact horizontal patient identification strip (~48px tall).
 * Replaces the 2-row PatientInfoHeader with a single dense line that
 * surfaces inline-editable CID chips. Designed to free vertical space
 * in clinical pages while keeping the right Patient Cockpit as the
 * source of truth for full identity.
 */
export function CompactPatientHeader({
  name,
  bed,
  unit,
  age,
  sex,
  weight,
  allergies,
  cidPrimary,
  cidSecondary = [],
  onCidPrimaryChange,
  onCidSecondaryChange,
  hideCid = false,
  className,
}: CompactPatientHeaderProps) {
  const hasAllergy = allergies && allergies !== "NDAM" && allergies.trim() !== "";

  return (
    <div
      className={cn(
        "patient-id flex items-center gap-3 flex-wrap",
        "rounded-lg border border-border/60 bg-card/80",
        "px-3 py-1.5 print:hidden",
        className,
      )}
    >
      {/* Identity */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <span className="text-[11px] font-bold text-primary">
            {name ? name.charAt(0).toUpperCase() : "?"}
          </span>
        </div>
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1">
            <span className="truncate">{name || "Paciente não identificado"}</span>
            <CopyNameButton value={name} />
          </p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <BedDouble className="h-3 w-3" />
            {bed || "—"} · {unit || "—"}
            {age && <span>· {age}</span>}
            {sex && <span>· {sex}</span>}
          </p>
        </div>
      </div>

      <div className="h-6 w-px bg-border/60 hidden sm:block" />

      {/* CID chips */}
      {!hideCid && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            CID
          </span>
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
      )}

      {/* Right-side meta */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        {weight && (
          <span className="text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground">{weight}kg</span>
          </span>
        )}
        {allergies && (
          <Badge
            variant={hasAllergy ? "destructive" : "secondary"}
            className="text-[10px] gap-1 h-5"
          >
            {hasAllergy && <AlertTriangle className="h-3 w-3" />}
            {allergies}
          </Badge>
        )}
      </div>
    </div>
  );
}

/* ---------- CID Chip with inline popover editor ---------- */

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

  const toneClass =
    tone === "primary"
      ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15"
      : tone === "ghost"
      ? "bg-transparent text-muted-foreground border-dashed border-border hover:bg-muted/50"
      : "bg-muted text-foreground border-border hover:bg-muted/80";

  const isReadOnly = !onChange;

  if (!value && tone !== "ghost") {
    if (isReadOnly) return null;
    return (
      <CidPopover
        open={open}
        onOpenChange={setOpen}
        draft={draft}
        setDraft={setDraft}
        onSelect={(v) => {
          onChange?.(v);
          setOpen(false);
          setDraft("");
        }}
      >
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 px-2 h-6 rounded-md border text-[10px] font-medium transition-colors",
            toneClass,
          )}
        >
          {label && (
            <span className="text-[9px] opacity-70 font-bold">{label}</span>
          )}
          <span>{placeholder ?? "Adicionar"}</span>
        </button>
      </CidPopover>
    );
  }

  if (!value && tone === "ghost") {
    if (isReadOnly) return null;
    return (
      <CidPopover
        open={open}
        onOpenChange={setOpen}
        draft={draft}
        setDraft={setDraft}
        onSelect={(v) => {
          onChange?.(v);
          setOpen(false);
          setDraft("");
        }}
      >
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 px-2 h-6 rounded-md border text-[10px] font-medium transition-colors",
            toneClass,
          )}
        >
          {icon}
          <span>{placeholder}</span>
        </button>
      </CidPopover>
    );
  }

  return (
    <CidPopover
      open={open}
      onOpenChange={setOpen}
      draft={draft}
      setDraft={setDraft}
      currentValue={value}
      onSelect={(v) => {
        onChange?.(v);
        setOpen(false);
        setDraft("");
      }}
      onClear={onChange ? () => { onChange(""); setOpen(false); } : undefined}
    >
      <button
        type="button"
        title={value}
        className={cn(
          "inline-flex items-center gap-1 px-2 h-6 rounded-md border text-[10px] font-mono transition-colors max-w-[180px]",
          toneClass,
          isReadOnly && "cursor-default hover:bg-muted",
        )}
      >
        {label && (
          <span className="text-[9px] opacity-70 font-bold font-sans">{label}</span>
        )}
        <span className="font-semibold">{code}</span>
        {desc && (
          <span className="font-sans truncate opacity-80 max-w-[120px]">
            · {desc}
          </span>
        )}
      </button>
    </CidPopover>
  );
}

interface CidPopoverProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: string;
  setDraft: (v: string) => void;
  onSelect: (v: string) => void;
  onClear?: () => void;
  currentValue?: string;
  children: React.ReactNode;
}

function CidPopover({
  open, onOpenChange, draft, setDraft,
  onSelect, onClear, currentValue, children,
}: CidPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            {currentValue ? "Alterar CID-10" : "Selecionar CID-10"}
          </p>
          <CidSearchInput
            value={draft}
            onChange={(v) => {
              if (v) onSelect(v);
            }}
            placeholder="Buscar por código ou descrição…"
          />
          {onClear && currentValue && (
            <button
              type="button"
              onClick={onClear}
              className="w-full mt-1 inline-flex items-center justify-center gap-1.5 text-[11px] text-destructive hover:bg-destructive/10 rounded-md py-1.5 transition-colors"
            >
              <X className="h-3 w-3" /> Remover CID
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
