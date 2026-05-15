import { useState } from "react";
import { Copy, IdCard, ChevronDown, ShieldAlert } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePrivacy, maskName } from "@/contexts/PrivacyContext";
import { useHospital } from "@/contexts/HospitalContext";
import { usePatientLive } from "@/hooks/usePatientLive";
import { usePatientIdentifiers } from "@/hooks/usePatientIdentifiers";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";

/**
 * Cabeçalho unificado de identificação do paciente.
 *
 * Fonte única da verdade para Nome, Idade, Setor, Leito, Status,
 * Prontuário, Atendimento e dados completos do registry.
 *
 * Usado em: PatientCockpit (rail direito) e AdmissionDialog (banner do form).
 *
 * Realtime: usePatientIdentifiers escuta postgres_changes em
 * patients, medical_records, patient_encounters e patient_registry.
 */
export interface PatientIdentityHeaderProps {
  patientId: string | null;
  /** Fallback enquanto carrega — vindo do contexto (mapa de leitos, etc) */
  fallbackName?: string | null;
  fallbackBed?: string | null;
  fallbackSector?: string | null;
  fallbackAge?: string | number | null;
  fallbackClinicalStatus?: string | null;
  variant?: "cockpit" | "dialog";
  className?: string;
  /** Mostra/oculta o painel "Ver dados do prontuário" (default: true) */
  showFullDetailsToggle?: boolean;
}

const clinicalStatusConfig: Record<string, { label: string; dot: string; bg: string }> = {
  gravissimo: { label: "Gravíssimo", dot: "bg-destructive", bg: "bg-destructive/10 text-destructive" },
  grave: { label: "Grave", dot: "bg-destructive", bg: "bg-destructive/10 text-destructive" },
  grave_estavel: { label: "Grave estável", dot: "bg-warning", bg: "bg-warning/15 text-warning" },
  potencialmente_grave: { label: "Potencialmente grave", dot: "bg-warning", bg: "bg-warning/15 text-warning" },
  regular: { label: "Regular", dot: "bg-primary", bg: "bg-primary/10 text-primary" },
  paliativado: { label: "Cuidados paliativos", dot: "bg-accent", bg: "bg-accent/10 text-accent" },
};

function formatDate(d?: string | null): string {
  if (!d) return "—";
  try {
    const date = parseISO(d);
    if (!isValid(date)) return "—";
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

function copyValue(value: string | null | undefined, label: string) {
  if (!value) return;
  navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copiado`),
    () => toast.error("Falha ao copiar"),
  );
}

export function PatientIdentityHeader({
  patientId,
  fallbackName,
  fallbackBed,
  fallbackSector,
  fallbackAge,
  fallbackClinicalStatus,
  variant = "dialog",
  className,
  showFullDetailsToggle = true,
}: PatientIdentityHeaderProps) {
  const { namesHidden } = usePrivacy();
  const { currentHospital } = useHospital();
  const [showFullId, setShowFullId] = useState(false);

  const { patient: livePatient } = usePatientLive(patientId || null);
  const { prontuario, atendimento, registry } = usePatientIdentifiers(
    patientId || null,
    livePatient?.name || fallbackName || null,
    currentHospital?.id || null,
  );

  const name = registry?.fullName || livePatient?.name || fallbackName || "—";
  const sectorCode = livePatient?.sector || fallbackSector || "";
  const sector = sectorLabelFromCode(sectorCode);
  const bed = livePatient?.bedNumber || fallbackBed || "—";
  const age = livePatient?.age || fallbackAge || null;
  const clinicalStatusKey =
    livePatient?.clinicalStatus || (fallbackClinicalStatus || "regular");
  const status = clinicalStatusConfig[clinicalStatusKey] || clinicalStatusConfig.regular;
  const displayName = maskName(name, namesHidden);

  const isCockpit = variant === "cockpit";

  return (
    <div className={cn("w-full", className)}>
      {/* ===== Linha 1: Nome + Idade · Setor · Leito + Status ===== */}
      <div className={cn(
        "flex items-start justify-between gap-2",
        isCockpit ? "mb-2" : "mb-2"
      )}>
        <div className="min-w-0 flex-1">
          <h3 className={cn(
            "patient-id font-bold leading-tight text-foreground truncate",
            isCockpit ? "text-sm" : "text-base"
          )}>
            {displayName}
          </h3>
          <p className={cn(
            "text-muted-foreground mt-0.5 preserve-case",
            isCockpit ? "text-[11px]" : "text-xs"
          )}>
            {age ? `${age} anos` : "—"} • {sector || "—"} • Leito{" "}
            <span className="font-medium text-foreground">{bed}</span>
          </p>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap",
          status.bg
        )}>
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          {status.label}
        </div>
      </div>

      {/* ===== Linha 2: Prontuário + Atendimento ===== */}
      <div className={cn(
        "grid gap-1",
        isCockpit ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
      )}>
        <IdRow label="Prontuário" value={prontuario} mono />
        <IdRow label="Atendimento" value={atendimento} mono />
      </div>

      {/* ===== Painel "Ver dados do prontuário" ===== */}
      {showFullDetailsToggle && (
        <>
          <button
            type="button"
            onClick={() => setShowFullId((v) => !v)}
            className="mt-2 w-full inline-flex items-center justify-between gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border/50 hover:bg-muted/40"
          >
            <span className="inline-flex items-center gap-1.5">
              <IdCard className="h-3 w-3" />
              {showFullId ? "Ocultar dados completos" : "Ver dados do prontuário"}
            </span>
            <ChevronDown className={cn("h-3 w-3 transition-transform", showFullId && "rotate-180")} />
          </button>
          {showFullId && (
            <div className="mt-2 rounded-md border border-border/60 bg-background/60 p-2.5 space-y-1.5 text-[11px]">
              <FullIdRow label="Nome social" value={registry?.socialName} />
              <FullIdRow label="CPF" value={registry?.cpf} mono />
              <FullIdRow label="CNS" value={registry?.cns} mono />
              <FullIdRow label="Nascimento" value={formatDate(registry?.birthDate || undefined)} />
              <FullIdRow label="Sexo" value={registry?.sex} />
              <FullIdRow label="Tipo sanguíneo" value={registry?.bloodType} />
              <FullIdRow label="Mãe" value={registry?.motherName} />
              <FullIdRow label="Telefone" value={registry?.phone} />
              <FullIdRow
                label="Endereço"
                value={
                  [registry?.address, registry?.neighborhood, registry?.city, registry?.state]
                    .filter(Boolean)
                    .join(", ") || null
                }
              />
              <FullIdRow label="Alergias" value={registry?.allergies} />
              <FullIdRow label="Comorbidades" value={registry?.comorbidities} />
              {registry?.isUnidentified && (
                <div className="text-[10px] uppercase font-semibold text-warning inline-flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  Paciente não identificado · {registry.unidentifiedCode || "—"}
                </div>
              )}
              {patientId && (
                <div className="pt-1 border-t border-border/40 text-[10px] text-muted-foreground/80 font-mono break-all">
                  ID interno: {patientId}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function IdRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  const has = !!value;
  return (
    <div className="group flex items-center justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground uppercase tracking-wide text-[10px]">{label}</span>
      <span className="flex items-center gap-1 min-w-0">
        <span className={cn("truncate font-medium", has ? "text-foreground" : "text-muted-foreground/60", mono && "font-mono")}>
          {value || "—"}
        </span>
        {has && (
          <button
            type="button"
            onClick={() => copyValue(value, label)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted/60"
            title={`Copiar ${label}`}
          >
            <Copy className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </span>
    </div>
  );
}

function FullIdRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 items-start">
      <span className="text-muted-foreground uppercase tracking-wide text-[10px]">{label}</span>
      <span className={cn("text-foreground break-words", mono && "font-mono", !value && "text-muted-foreground/60")}>
        {value || "—"}
      </span>
    </div>
  );
}
