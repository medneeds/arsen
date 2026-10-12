import { useState, useRef, KeyboardEvent } from "react";
import { AlertTriangle, X, Plus, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isSemAlergia, SEM_RELATO } from "@/lib/allergyStatus";

interface AllergiesChipInputProps {
  /** Display value: comma-separated string (e.g. "Dipirona, Sulfa") ou "Sem relato" */
  value: string;
  onChange: (next: string) => void;
  className?: string;
}

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
}: AllergiesChipInputProps) {
  const items = parseItems(value);
  const isSemRelato = items.length === 1 && isSemAlergia(items[0]);
  const realItems = isSemRelato ? [] : items;

  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const empty = realItems.length === 0 && !isSemRelato;

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

  const setSemRelato = () => {
    onChange(SEM_RELATO);
    setDraft("");
  };

  const clearAll = () => {
    onChange("");
    setDraft("");
    inputRef.current?.focus();
  };

  // Todas as alergias ficam visiveis (sem truncar nem "+N"); se faltar espaco, quebra de linha.
  const visible = realItems;

  const baseChip =
    "inline-flex items-center gap-1 h-5 px-2 rounded-md text-xs font-medium uppercase border";

  return (
    <div
      className={cn(
        // Contorno CONTINUO com o rotulo "Alergias": o container usa a mesma borda
        // do CONTEXT_CHIP e recebe rounded-l-none via className, de modo que rotulo
        // (border-r-0) + valor formam UMA caixa so. O "Sem relato" interno segue sem
        // borda propria (evita caixa-dentro-de-caixa). bg de estado sinaliza vazio/
        // sem relato/alergia.
        "flex flex-wrap items-center gap-1 min-h-7 px-2 py-0.5 rounded-md border border-border bg-background transition-colors",
        empty
          ? "bg-warning-soft/30"
          : isSemRelato
          ? "bg-released-soft/40"
          : "bg-destructive/[0.03]",
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {isSemRelato ? (
        <span
          className={cn(
            // Sem contorno proprio: o fundo verde do container ja sinaliza — aqui
            // fica so o texto compacto (otimiza o layout, sem caixa-dentro-de-caixa).
            "inline-flex items-center gap-1 text-[10px] font-medium text-released-on-soft normal-case",
          )}
        >
          <ShieldCheck className="h-2.5 w-2.5" />
          Sem relato
          <button
            type="button"
            aria-label="Remover sem relato"
            className="ml-1 hover:text-released-on-soft"
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
                "border-destructive/40 bg-destructive/10 text-destructive",
              )}
              title={item}
            >
              <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
              <span className="whitespace-nowrap">{item}</span>
              <button
                type="button"
                aria-label={`Remover ${item}`}
                className="ml-1 shrink-0 hover:opacity-70"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(idx);
                }}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}

          <div className="flex items-center gap-1">
            {!empty && <Plus className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />}
            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (draft.trim()) commitDraft();
              }}
              placeholder={empty ? "Sem relato ou listar..." : ""}
              aria-label="Adicionar alergia"
              className={cn(
                "h-5 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                empty ? "min-w-[110px]" : "min-w-[60px] max-w-[100px]",
              )}
            />
          </div>

          {empty && (
            <button
              type="button"
              className="text-[10px] font-medium normal-case text-released-on-soft hover:underline px-1"
              onClick={(e) => {
                e.stopPropagation();
                setSemRelato();
              }}
              title="Sem relato de alergias"
            >
              Sem relato
            </button>
          )}
        </>
      )}
    </div>
  );
}
