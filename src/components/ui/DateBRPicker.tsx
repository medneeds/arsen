import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * DateBRPicker
 * Campo de data com máscara BR (DD/MM/AAAA), calendário em popover e presets opcionais.
 * Não persiste nada — apenas controla o valor exibido/digitado em formato BR.
 *
 * value/onChange usam string "DD/MM/AAAA" (ou "" quando vazio).
 */
export interface DateBRPickerProps {
  value: string;
  onChange: (next: string) => void;
  /** Data base para cálculo dos presets (ex.: admissão no setor). Aceita ISO ou BR. */
  baseDate?: string;
  /** Presets em dias a partir de baseDate. Default: [3,5,7,10]. */
  presets?: number[];
  placeholder?: string;
  className?: string;
  allowClear?: boolean;
  /** Permite escolher data anterior a hoje. Default: true. */
  allowPast?: boolean;
}

function parseBR(s: string): Date | undefined {
  const m = (s || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const d = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
  if (
    d.getDate() !== parseInt(dd, 10) ||
    d.getMonth() !== parseInt(mm, 10) - 1 ||
    d.getFullYear() !== parseInt(yyyy, 10)
  ) {
    return undefined;
  }
  return d;
}

function parseBase(s?: string): Date | undefined {
  if (!s) return undefined;
  // Tenta BR DD/MM/AAAA (com ou sem hora)
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    return new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

function toBR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function maskBR(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

export function DateBRPicker({
  value,
  onChange,
  baseDate,
  presets = [3, 5, 7, 10],
  placeholder = "DD/MM/AAAA",
  className,
  allowClear = true,
  allowPast = true,
}: DateBRPickerProps) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(value || "");

  useEffect(() => {
    setInternal(value || "");
  }, [value]);

  const selectedDate = parseBR(internal);
  const base = parseBase(baseDate) || new Date();

  const applyDate = (d: Date) => {
    const br = toBR(d);
    setInternal(br);
    onChange(br);
  };

  const applyPreset = (days: number) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
    applyDate(d);
    setOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Input
        value={internal}
        onChange={(e) => {
          const masked = maskBR(e.target.value);
          setInternal(masked);
          if (masked === "" || /^\d{2}\/\d{2}\/\d{4}$/.test(masked)) onChange(masked);
        }}
        onBlur={() => {
          // normaliza caso usuário tenha deixado parcial
          if (internal && !/^\d{2}\/\d{2}\/\d{4}$/.test(internal)) {
            setInternal(value || "");
          }
        }}
        placeholder={placeholder}
        inputMode="numeric"
        pattern="\d{2}/\d{2}/\d{4}"
        maxLength={10}
        className="h-9 text-xs uppercase tabular-nums tracking-wider"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-2 shrink-0"
            title="Abrir calendário"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 pointer-events-auto" align="end">
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
              <span className="text-[10px] text-muted-foreground self-center mr-1 uppercase">
                A partir da admissão:
              </span>
              {presets.map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => applyPreset(d)}
                >
                  +{d}d
                </Button>
              ))}
            </div>
          )}
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate || base}
            onSelect={(d) => {
              if (d) {
                applyDate(d);
                setOpen(false);
              }
            }}
            disabled={allowPast ? undefined : (d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {allowClear && internal && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 px-2 shrink-0 text-muted-foreground"
          onClick={() => {
            setInternal("");
            onChange("");
          }}
          title="Limpar"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
