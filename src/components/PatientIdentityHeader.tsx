import { useState } from "react";
import { Copy, IdCard, ChevronDown, ShieldAlert, Pin } from "lucide-react";
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
  /** Controle de "fixar painel": quando fornecido, renderiza um pino compacto a
   *  ESQUERDA do nome (cockpit fixa). Fixado, o painel não recolhe ao tirar o mouse. */
  pinControl?: { pinned: boolean; onToggle: () => void };
  /** Células extras da grade (ex.: Admissão / Internação), depois de Prontuário e
   *  Atendimento e antes da linha "Ver dados do prontuário". Só na variante cockpit. */
  metaCells?: Array<{ label: string; value: React.ReactNode }>;
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
  pinControl,
  metaCells,
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

  const toggleLabel = onViewFullData ? "Ver dados do prontuário" : (showFullId ? "Ocultar dados completos" : "Ver dados do prontuário");
  const showToggle = showFullDetailsToggle && !alwaysExpanded;

  // Grade unica, SEMPRE em 2 colunas iguais (mesmo corte em todas as linhas).
  const cells: IdCell[] = [
    { label: "Setor", value: sector || "—" },
    { label: "Leito", value: bed },
    { label: "Prontuário", value: prontuario, copy: true, mono: true },
    { label: "Atendimento", value: atendimento, copy: true, mono: true },
    ...(isCockpit && metaCells ? metaCells.map((c) => ({ label: c.label, value: c.value })) : []),
  ];

  return (
    <div className={cn("relative w-full", className)}>
      {/* Pino discreto no canto superior esquerdo (so cockpit fixa), fora do fluxo do nome. */}
      {isCockpit && pinControl && (
        <button
          type="button"
          onClick={pinControl.onToggle}
          title={pinControl.pinned ? "Desafixar (recolhe ao tirar o mouse)" : "Fixar painel aberto"}
          aria-pressed={pinControl.pinned}
          className={cn(
            "absolute -left-2 -top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-colors",
            pinControl.pinned
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-primary",
          )}
        >
          <Pin className={cn("h-3 w-3", pinControl.pinned && "fill-current")} />
        </button>
      )}

      {/* Nome + idade logo abaixo. Com pino, so a primeira linha do nome recua. */}
      <div className="flex items-start gap-1">
        <h3
          className={cn(
            "patient-id min-w-0 flex-1 font-semibold leading-tight text-foreground break-words",
            isCockpit ? "text-sm uppercase tracking-tight" : "text-base",
          )}
          style={isCockpit && pinControl ? { textIndent: "1.75rem" } : undefined}
        >
          {displayName}
        </h3>
        <CopyNameButton value={name} />
      </div>
      <p className="mt-1 mb-2 text-xs text-muted-foreground preserve-case">{age ?? "Idade não informada"}</p>

      <div className="overflow-hidden rounded-sm border border-border bg-background/60 preserve-case">
        <div className="grid grid-cols-2">
          {cells.map((c, i) => (
            <IdGridCell key={c.label} cell={c} index={i} />
          ))}
        </div>
        {showToggle && (
          <button
            type="button"
            onClick={onViewFullData ? onViewFullData : () => setShowFullId((v) => !v)}
            className="flex w-full items-center justify-between gap-1 border-t border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <span className="inline-flex items-center gap-2">
              <IdCard className="h-3 w-3" />
              {toggleLabel}
            </span>
            {/* Sem onViewFullData: expande o painel inline (chevron). Com
                onViewFullData: abre o dialogo (ver + editar), sem chevron. */}
            {!onViewFullData && (
              <ChevronDown className={cn("h-3 w-3 transition-transform", showFullId && "rotate-180")} />
            )}
          </button>
        )}
      </div>
      {showToggle && !onViewFullData && showFullId && (
        <div className="mt-2 rounded-md border border-border/60 bg-background/60 p-3 space-y-2 text-xs">
          <FullIdRow label="Nome social" value={registry?.socialName} />
          <FullIdRow label="CPF" value={registry?.cpf} mono />
          <FullIdRow label="CNS" value={registry?.cns} mono />
          <FullIdRow label="Nascimento" value={formatDate(registry?.birthDate || undefined)} />
          <FullIdRow label="Sexo" value={registry?.sex} />
        </div>
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

/** Botao compacto para copiar o nome do paciente — ao lado do nome, mesmo
 *  comportamento do copiar de Prontuario/Atendimento. */
function CopyNameButton({ value }: { value?: string | null }) {
  const v = (value || "").trim();
  if (!v || v === "—") return null;
  return (
    <button
      type="button"
      onClick={() => copyValue(v, "Nome")}
      title="Copiar nome"
      aria-label="Copiar nome do paciente"
      className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

interface IdCell {
  label: string;
  value?: React.ReactNode;
  /** Mostra o botao de copiar (valor texto). */
  copy?: boolean;
  mono?: boolean;
}

/** Celula da grade de identificacao: rotulo pequeno em cima, valor embaixo; divisores finos. */
function IdGridCell({ cell, index }: { cell: IdCell; index: number }) {
  const text = typeof cell.value === "string" ? cell.value : null;
  const has = text ? text.trim() !== "" && text !== "—" : cell.value != null;
  return (
    <div
      className={cn(
        "min-w-0 px-3 py-2",
        index % 2 === 1 && "border-l border-border",
        index >= 2 && "border-t border-border",
      )}
    >
      <div className="text-[10px] font-semibold uppercase leading-none tracking-wider text-muted-foreground">{cell.label}</div>
      <div className="mt-1 flex items-center justify-between gap-1">
        <span
          className={cn(
            "min-w-0 font-semibold tabular-nums leading-tight",
            cell.mono ? "font-mono text-xs" : "text-[13px]",
            has ? "text-foreground" : "text-muted-foreground/60",
          )}
        >
          {has ? cell.value : "—"}
        </span>
        {cell.copy && has && text && (
          <button
            type="button"
            onClick={() => copyValue(text, cell.label)}
            title={`Copiar ${cell.label}`}
            aria-label={`Copiar ${cell.label} ${text}`}
            className="shrink-0 rounded p-0.5 text-muted-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
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
