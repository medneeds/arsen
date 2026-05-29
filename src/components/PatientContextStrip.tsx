import { User, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface PatientContextStripProps {
  name?: string;
  bed?: string;
  unit?: string;
  age?: string;
  birthDate?: string;
  className?: string;
}

/**
 * Faixa horizontal de identidade do paciente para o corpo dos módulos clínicos
 * (Prescrição, Evolução, Requisições, Documentos). Aparece logo abaixo do
 * título da página para o médico confirmar de quem é a tela sem precisar
 * abrir a cockpit/sidebar à direita.
 *
 * Layout: [LEITO destacado] | [👤 NOME] | [SETOR] [IDADE] [DOB]
 * Não aparece em impressão (`print:hidden`).
 */
export function PatientContextStrip({
  name,
  bed,
  unit,
  age,
  birthDate,
  className,
}: PatientContextStripProps) {
  if (!name && !bed) return null;

  return (
    <div
      className={cn(
        "patient-id print:hidden",
        "flex items-center gap-0 flex-wrap",
        "rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm",
        "overflow-hidden shadow-sm",
        className,
      )}
    >
      {/* LEITO — bloco destacado à esquerda */}
      {bed && (
        <div className="flex flex-col items-center justify-center px-4 py-2 bg-primary/10 border-r border-border/40 shrink-0 min-w-[72px]">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary/70 leading-none">
            Leito
          </span>
          <span className="text-lg font-extrabold text-primary leading-tight tracking-tight mt-0.5">
            {bed}
          </span>
        </div>
      )}

      {/* Nome + metadados */}
      <div className="flex items-center gap-4 px-4 py-2 flex-1 min-w-0 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-bold text-foreground uppercase tracking-wide truncate">
            {name || "Paciente não identificado"}
          </span>
        </div>

        {(age || unit || birthDate) && (
          <div className="h-5 w-px bg-border/60 shrink-0 hidden sm:block" />
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {unit && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
              {unit}
            </span>
          )}
          {age && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-semibold">
              {age}
            </span>
          )}
          {birthDate && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-muted/70 text-muted-foreground text-[11px]">
              <Calendar className="h-3 w-3" />
              {birthDate}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
