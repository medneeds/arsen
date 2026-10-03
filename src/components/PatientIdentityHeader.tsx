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
import { formatAgeLabel } from "@/lib/ageLabel";

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
  /** Quando true, renderiza o painel completo sempre aberto (sem botão de toggle). */
  alwaysExpanded?: boolean;
  /** Chips extras (ex.: Admissão / Internação), renderizados logo abaixo dos dados
   *  de identificação e antes do botão "Ver dados do prontuário". Só na variante cockpit. */
  metaChips?: React.ReactNode;
  /** Quando fornecido, o botão "Ver dados do prontuário" chama isto (abrir o
   *  dialogo que mostra os dados completos + edicao) em vez de expandir o painel
   *  inline read-only. Centraliza ver+editar numa superficie so. */
  onViewFullData?: () => void;
}

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
    () => toast.error("Não foi possível copiar"),
  );
}

export function PatientIdentityHeader({
  patientId,
  fallbackName,
  fallbackBed,
  fallbackSector,
  fallbackAge,
  variant = "dialog",
  className,
  showFullDetailsToggle = true,
  alwaysExpanded = false,
  metaChips,
  onViewFullData,
}: PatientIdentityHeaderProps) {
  const { namesHidden } = usePrivacy();
  const { currentHospital } = useHospital();
  const [showFullId, setShowFullId] = useState(alwaysExpanded);

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
  // registry.age é calculado ao vivo a partir de birth_date — nunca fica
  // desatualizado. livePatient?.age e fallbackAge são o campo estático
  // (patients.age), usados só quando não há patient_registry vinculado.
  const age = formatAgeLabel(registry?.age || livePatient?.age || fallbackAge || null);
  const displayName = maskName(name, namesHidden);

  const isCockpit = variant === "cockpit";

  return (
    <div className={cn("w-full", className)}>
      {isCockpit ? (
        <>
          {/* Cockpit: nome limpo como elemento principal; dados em blocos compactos. */}
          <h3 className="patient-id text-lg font-semibold leading-snug text-foreground break-words">
            {displayName}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5 preserve-case">
            <InfoChip>{age ?? "Idade não informada"}</InfoChip>
            <InfoChip>{sector || "Setor —"}</InfoChip>
            <InfoChip label="Leito" value={bed} />
            <CopyChip label="Prontuário" value={prontuario} />
            <CopyChip label="Atendimento" value={atendimento} />
          </div>
          {metaChips && <div className="mt-1.5 flex flex-wrap gap-1.5 preserve-case">{metaChips}</div>}
        </>
      ) : (
        <>
          {/* ===== Linha 1: Nome + Idade · Setor · Leito ===== */}
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="patient-id font-semibold leading-tight text-foreground truncate text-base">
                {displayName}
              </h3>
              <p className="text-muted-foreground mt-1 preserve-case text-xs">
                {age ?? "—"} • {sector || "—"} • Leito{" "}
                <span className="font-medium text-foreground">{bed}</span>
              </p>
            </div>
          </div>

          {/* ===== Linha 2: Prontuário + Atendimento ===== */}
          <div className="grid gap-1 grid-cols-1 sm:grid-cols-2">
            <IdRow label="Prontuário" value={prontuario} mono />
            <IdRow label="Atendimento" value={atendimento} mono />
          </div>
        </>
      )}

      {/* ===== Painel "Ver dados do prontuário" ===== */}
      {showFullDetailsToggle && !alwaysExpanded && (
        <>
          <button
            type="button"
            onClick={onViewFullData ? onViewFullData : () => setShowFullId((v) => !v)}
            className="mt-2 w-full inline-flex items-center justify-between gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md border border-border/50 hover:bg-muted/40"
          >
            <span className="inline-flex items-center gap-2">
              <IdCard className="h-3 w-3" />
              {onViewFullData ? "Ver dados do prontuário" : (showFullId ? "Ocultar dados completos" : "Ver dados do prontuário")}
            </span>
            {/* Sem onViewFullData: expande o painel inline (chevron). Com
                onViewFullData: abre o dialogo (ver + editar), sem chevron. */}
            {!onViewFullData && (
              <ChevronDown className={cn("h-3 w-3 transition-transform", showFullId && "rotate-180")} />
            )}
          </button>
          {!onViewFullData && showFullId && (
            <div className="mt-2 rounded-md border border-border/60 bg-background/60 p-3 space-y-2 text-xs">
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
                <div className="text-xs uppercase tracking-wider font-medium text-warning inline-flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  Paciente não identificado · {registry.unidentifiedCode || "—"}
                </div>
              )}
              {patientId && (
                <div className="pt-1 border-t border-border/40 text-xs text-muted-foreground/80 font-mono break-all">
                  ID interno: {patientId}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Painel completo sempre aberto (usado em telas onde a revisão cadastral é prioritária) */}
      {alwaysExpanded && (
        <div className="mt-2 rounded-md border border-border/60 bg-background/60 p-3 text-xs">
          {/* Linha 1: documentos */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
            <CompactIdRow label="CPF" value={registry?.cpf} mono />
            <CompactIdRow label="CNS" value={registry?.cns} mono />
            <CompactIdRow label="Nascimento" value={formatDate(registry?.birthDate || undefined)} />
            <CompactIdRow label="Sexo" value={registry?.sex} />
            <CompactIdRow label="Tipo sanguíneo" value={registry?.bloodType} />
            <CompactIdRow label="Telefone" value={registry?.phone} />
          </div>

          <div className="my-2 border-t border-border/40" />

          {/* Linha 2: filiação + nome social (campos longos, 2 col) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
            <CompactIdRow label="Nome social" value={registry?.socialName} />
            <CompactIdRow label="Mãe" value={registry?.motherName} />
          </div>

          <div className="my-2 border-t border-border/40" />

          {/* Linha 3: endereço completo */}
          <CompactIdRow
            label="Endereço"
            value={
              [registry?.address, registry?.neighborhood, registry?.city, registry?.state]
                .filter(Boolean)
                .join(", ") || null
            }
            wide
          />

          <div className="my-2 border-t border-border/40" />

          {/* Linha 4: clínico */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
            <CompactIdRow label="Alergias" value={registry?.allergies} />
            <CompactIdRow label="Comorbidades" value={registry?.comorbidities} />
          </div>

          {registry?.isUnidentified && (
            <div className="mt-2 text-xs uppercase tracking-wider font-medium text-warning inline-flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />
              Paciente não identificado · {registry.unidentifiedCode || "—"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const chipBase =
  "inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs leading-5 text-foreground";

/** Bloco compacto de informação. Texto simples ou rótulo + valor. */
export function InfoChip({
  label,
  value,
  children,
}: {
  label?: string;
  value?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <span className={chipBase}>
      {label && <span className="text-muted-foreground">{label}</span>}
      {value !== undefined ? <span className="font-medium">{value || "—"}</span> : children}
    </span>
  );
}

/** Bloco com valor copiável (prontuário / atendimento). Vazio vira "—" sem botão. */
function CopyChip({ label, value }: { label: string; value?: string | null }) {
  if (!value) {
    return (
      <span className={chipBase}>
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground/60">—</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => copyValue(value, label)}
      title={`Copiar ${label}`}
      aria-label={`Copiar ${label} ${value}`}
      className={cn(chipBase, "group cursor-pointer hover:bg-muted/70 transition-colors")}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium font-mono">{value}</span>
      <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" />
    </button>
  );
}

function IdRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  const has = !!value;
  return (
    <div className="group flex items-center justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground uppercase tracking-wide text-[10px]">{label}</span>
      <span className="flex items-center gap-1 min-w-0">
        <span className={cn("truncate font-medium text-[11px]", has ? "text-foreground" : "text-muted-foreground/60", mono && "font-mono")}>
          {value || "—"}
        </span>
        {has && (
          <button
            type="button"
            onClick={() => copyValue(value, label)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted/60"
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
      <span className="text-muted-foreground uppercase tracking-wide text-xs">{label}</span>
      <span className={cn("text-foreground break-words", mono && "font-mono", !value && "text-muted-foreground/60")}>
        {value || "—"}
      </span>
    </div>
  );
}

/** Linha compacta vertical (label em cima, valor embaixo) — para grid multi-coluna. */
function CompactIdRow({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  wide?: boolean;
}) {
  const has = !!value;
  return (
    <div className={cn("group flex flex-col gap-1 min-w-0", wide && "col-span-full")}>
      <span className="text-muted-foreground uppercase tracking-wide text-xs leading-none">
        {label}
      </span>
      <div className="flex items-center gap-1 min-w-0">
        <span
          className={cn(
            "text-foreground break-words leading-snug",
            mono && "font-mono",
            !has && "text-muted-foreground/60 italic",
          )}
        >
          {value || "—"}
        </span>
        {has && (
          <button
            type="button"
            onClick={() => copyValue(value, label)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted/60 shrink-0"
            title={`Copiar ${label}`}
          >
            <Copy className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
