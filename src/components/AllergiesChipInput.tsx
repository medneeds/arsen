import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { AlertTriangle, X, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface AllergiesChipInputProps {
  /** Display value: comma-separated string (e.g. "Dipirona, Sulfa") or "NDAM" */
  value: string;
  onChange: (next: string) => void;
  className?: string;
  maxInline?: number;
}

const NDAM = "NDAM";

function parseItems(value: string): string[] {
  return (value ?? "")
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinItems(items: string[]): string {
  // Dedup case-insensitive, preserving first occurrence
  const seen = new Set<string>();
  const dedup: string[] = [];
  for (const it of items) {
    const key = it.toLocaleLowerCase("pt-BR");
    if (!seen.has(key)) {
      seen.add(key);
      dedup.push(it);
    }
  }
  return dedup.join(", ");
}

export function AllergiesChipInput({
  value,
  onChange,
  className,
  maxInline = 3,
}: AllergiesChipInputProps) {
  const items = parseItems(value);
  const isNDAM = items.length === 1 && items[0].toUpperCase() === NDAM;
  const realItems = isNDAM ? [] : items;

  const [draft, setDraft] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const empty = realItems.length === 0 && !isNDAM;

  const commitDraft = () => {
    const parts = parseItems(draft);
    if (parts.length === 0) return;
    const next = joinItems([...realItems, ...parts]);
    onChange(next);
    setDraft("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && draft === "" && realItems.length > 0) {
      // Remove last chip when backspacing in empty draft
      e.preventDefault();
      onChange(joinItems(realItems.slice(0, -1)));
    }
  };

  const removeAt = (idx: number) => {
    onChange(joinItems(realItems.filter((_, i) => i !== idx)));
  };

  const setNDAM = () => {
    onChange(NDAM);
    setDraft("");
  };

  const clearAll = () => {
    onChange("");
    setDraft("");
    inputRef.current?.focus();
  };

  const visible = realItems.slice(0, maxInline);
  const overflow = Math.max(0, realItems.length - maxInline);

  const baseChip =
    "inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[10px] font-semibold uppercase border";

  return (
    <div
      className={cn(
        "flex items-center gap-1 min-h-7 px-1.5 py-0.5 rounded-md border bg-background transition-colors",
        empty
          ? "border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10"
          : isNDAM
          ? "border-emerald-400/50 bg-emerald-50/40 dark:bg-emerald-950/10"
          : "border-destructive/30 bg-destructive/[0.03]",
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {isNDAM ? (
        <span
          className={cn(
            baseChip,
            "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          )}
        >
          <ShieldCheck className="h-2.5 w-2.5" />
          NDAM
          <button
            type="button"
            aria-label="Remover NDAM"
            className="ml-0.5 hover:text-emerald-900 dark:hover:text-emerald-100"
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ) : (
        <>
          {visible.map((item, idx) => (
            <span
              key={`${item}-${idx}`}
              className={cn(
                baseChip,
                "border-destructive/40 bg-destructive/10 text-destructive max-w-[110px]",
              )}
              title={item}
            >
              <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{item}</span>
              <button
                type="button"
                aria-label={`Remover ${item}`}
                className="ml-0.5 shrink-0 hover:opacity-70"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(idx);
                }}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}

          {overflow > 0 && (
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    baseChip,
                    "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10",
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  +{overflow}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-72 p-3 space-y-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                    Alergias ({realItems.length})
                  </span>
                  <button
                    type="button"
                    className="text-[10px] text-muted-foreground hover:text-destructive uppercase"
                    onClick={clearAll}
                  >
                    Limpar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-auto">
                  {realItems.map((item, idx) => (
                    <span
                      key={`pop-${item}-${idx}`}
                      className={cn(
                        baseChip,
                        "border-destructive/40 bg-destructive/10 text-destructive",
                      )}
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {item}
                      <button
                        type="button"
                        aria-label={`Remover ${item}`}
                        className="ml-0.5 hover:opacity-70"
                        onClick={() => removeAt(idx)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1 pt-1 border-t border-border/40">
                  <Input
                    placeholder="Adicionar alergia..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-7 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={commitDraft}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (draft.trim()) commitDraft();
            }}
            placeholder={empty ? "NDAM ou listar..." : "+ adicionar"}
            className={cn(
              "h-6 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
              empty ? "min-w-[110px]" : "min-w-[70px] max-w-[110px]",
            )}
          />

          {empty && (
            <button
              type="button"
              className="text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300 hover:underline px-1"
              onClick={(e) => {
                e.stopPropagation();
                setNDAM();
              }}
              title="Nega Drogas, Alimentos e Medicamentos"
            >
              NDAM
            </button>
          )}
        </>
      )}
    </div>
  );
}
