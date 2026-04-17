import React from "react";
import { BedDouble, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface PatientInfoHeaderProps {
  name: string;
  bed: string;
  unit: string;
  age: string;
  sex: string;
  weight: string;
  allergies: string;
  record?: string;
  birthDate?: string;
  admissionDate?: string;
  utiAdmissionDate?: string;
  motherName?: string;
  address?: string;
  city?: string;
  encounterCode?: string;
  /** Show additional detail fields (admissions, address, etc) */
  showDetails?: boolean;
}

/**
 * Standardized read-only patient identification header
 * shared across Prescrição, Evolução, and Requisições modules.
 */
export function PatientInfoHeader({
  name, bed, unit, age, sex, weight, allergies,
  record, birthDate, admissionDate, utiAdmissionDate,
  motherName, address, city, encounterCode,
  showDetails = false,
}: PatientInfoHeaderProps) {
  const formatDate = (d?: string) => {
    if (!d) return "—";
    try { return format(new Date(d + "T12:00:00"), "dd/MM/yyyy"); } catch { return "—"; }
  };

  return (
    <div className="patient-id rounded-xl border border-border bg-card overflow-hidden print:hidden">
      {/* Top bar: name + bed + weight/allergies */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border/50 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{name ? name.charAt(0).toUpperCase() : "?"}</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground leading-tight truncate">{name || "Paciente não identificado"}</h2>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <BedDouble className="h-3 w-3" />
              Leito {bed || "—"} · {unit || "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">Peso</Label>
            <span className="text-xs font-semibold text-foreground">{weight ? `${weight} kg` : "—"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] text-muted-foreground font-medium flex items-center gap-0.5 whitespace-nowrap">
              <AlertTriangle className="h-3 w-3 text-destructive" /> Alergias
            </Label>
            <Badge variant={allergies === "NDAM" ? "secondary" : "destructive"} className="text-[10px]">
              {allergies || "—"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="px-4 py-2.5">
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
          {[
            { label: "Idade", value: age || "—" },
            { label: "Sexo", value: sex || "—" },
            ...(record ? [{ label: "Prontuário", value: record }] : []),
            ...(showDetails ? [
              { label: "Nascimento", value: formatDate(birthDate) },
              ...(encounterCode ? [{ label: "Cód. Atendimento", value: encounterCode }] : []),
              ...(motherName ? [{ label: "Nome da Mãe", value: motherName }] : []),
              { label: "Admissão Hospital", value: formatDate(admissionDate) },
              ...(utiAdmissionDate ? [{ label: "Admissão UTI", value: formatDate(utiAdmissionDate) }] : []),
              ...(address ? [{ label: "Endereço", value: `${address}${city ? ` — ${city}` : ""}` }] : []),
            ] : [
              { label: "Admissão", value: formatDate(admissionDate) },
            ]),
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{label}:</span>
              <span className="font-medium text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
