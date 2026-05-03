import { useState, useEffect, useRef } from "react";
import { Patient } from "@/types/patient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Activity, AlertTriangle, ArrowRight, BedDouble, ChevronDown, ChevronRight,
  ClipboardList, Copy, Droplet, FileText, Heart, IdCard, LogOut, NotebookPen, Pill, Plus, Route,
  ShieldAlert, Stethoscope, Syringe, TestTubes, TrendingUp, User2, Users
} from "lucide-react";
import { differenceInDays, parseISO, isValid, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePrivacy, maskName } from "@/contexts/PrivacyContext";
import { useNavigate } from "react-router-dom";
import { useHospital } from "@/contexts/HospitalContext";
import { useActivePrescription } from "@/hooks/useActivePrescription";
import { usePatientPendingItems } from "@/hooks/usePatientPendingItems";
import { usePatientMovements } from "@/hooks/usePatientMovements";
import { usePatientIdentifiers } from "@/hooks/usePatientIdentifiers";
import { useLatestEvolution } from "@/hooks/useLatestEvolution";
import { usePatientBedWatcher } from "@/hooks/usePatientBedWatcher";
import { useLatestVitalSigns } from "@/hooks/useLatestVitalSigns";
import { useLatestRoundSession } from "@/hooks/useLatestRoundSession";
import { usePatientNirRequest } from "@/hooks/usePatientNirRequest";
import { useBedAllocationRequests } from "@/hooks/useBedAllocationRequests";
import { Check as CheckIcon, Clock as ClockIcon } from "lucide-react";
import { usePatientSpecialRequests } from "@/hooks/usePatientSpecialRequests";
import { usePatientLive } from "@/hooks/usePatientLive";
import { formatDistanceToNow } from "date-fns";

interface PatientCockpitProps {
  patient: Patient | null;
  className?: string;
  /** Show as a fixed sidebar (desktop) or as inline content (mobile) */
  variant?: "fixed" | "inline";
}

const sectorLabels: Record<string, string> = {
  red: "UTI 1",
  yellow: "UTI 2",
  blue: "UCI 1",
  outside: "UCI 2",
  ucc: "UCC",
};

const clinicalStatusConfig: Record<string, { label: string; dot: string; bg: string }> = {
  gravissimo: { label: "Gravíssimo", dot: "bg-destructive", bg: "bg-destructive/10 text-destructive" },
  grave: { label: "Grave", dot: "bg-destructive", bg: "bg-destructive/10 text-destructive" },
  grave_estavel: { label: "Grave estável", dot: "bg-warning", bg: "bg-warning/15 text-warning" },
  potencialmente_grave: { label: "Potencialmente grave", dot: "bg-warning", bg: "bg-warning/15 text-warning" },
  regular: { label: "Regular", dot: "bg-primary", bg: "bg-primary/10 text-primary" },
  paliativado: { label: "Cuidados paliativos", dot: "bg-accent", bg: "bg-accent/10 text-accent" },
};

const parseList = (value: string | string[] | null | undefined): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value.split("\n").filter((l) => l.trim());
};

function StayDays({ admissionDate }: { admissionDate?: string }) {
  if (!admissionDate) return <span className="text-muted-foreground">—</span>;
  try {
    const d = parseISO(admissionDate);
    if (!isValid(d)) return <span className="text-muted-foreground">—</span>;
    const days = differenceInDays(new Date(), d);
    return (
      <span>
        <strong className="text-foreground">{days}</strong>{" "}
        <span className="text-muted-foreground">{days === 1 ? "dia" : "dias"}</span>
      </span>
    );
  } catch {
    return <span className="text-muted-foreground">—</span>;
  }
}

function formatDate(d?: string): string {
  if (!d) return "—";
  try {
    const date = parseISO(d);
    if (!isValid(date)) return "—";
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

export function PatientCockpit({ patient: patientProp, className, variant = "fixed" }: PatientCockpitProps) {
  const { namesHidden } = usePrivacy();
  const navigate = useNavigate();
  const { currentHospital } = useHospital();
  const [showFullId, setShowFullId] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  const isExpanded = variant === "inline" || pinned || hovering;

  // Live patient data — sync sector, bed, allergies, medical responsibility, etc.
  const { patient: livePatient } = usePatientLive(patientProp?.id || null);
  const patient = livePatient || patientProp;

  // Watch for medical responsibility changes from other users
  const lastResponsibilityRef = useRef<string | null>(
    patientProp?.medicalResponsibility?.leaderNames || null,
  );
  useEffect(() => {
    const newResp = livePatient?.medicalResponsibility?.leaderNames || null;
    if (
      newResp &&
      lastResponsibilityRef.current &&
      newResp !== lastResponsibilityRef.current
    ) {
      toast.info("Responsável médico atualizado", {
        description: `Novo responsável: ${newResp}`,
        duration: 6000,
      });
    }
    if (newResp) lastResponsibilityRef.current = newResp;
  }, [livePatient?.medicalResponsibility?.leaderNames]);

  const { prescription } = useActivePrescription(
    patient?.name || null,
    currentHospital?.id || null,
  );
  const { summary: pendingSummary, items: pendingItems } = usePatientPendingItems(
    patient?.id || null,
    patient?.name || null,
    currentHospital?.id || null,
  );
  const { movements } = usePatientMovements(
    patient?.id || null,
    patient?.name || null,
    currentHospital?.id || null,
  );
  const { prontuario, atendimento, registry } = usePatientIdentifiers(
    patient?.id || null,
    patient?.name || null,
    currentHospital?.id || null,
  );
  const { evolution } = useLatestEvolution(
    patient?.id || null,
    patient?.name || null,
    currentHospital?.id || null,
  );
  const { vitals } = useLatestVitalSigns(patient?.id || null);
  const { round } = useLatestRoundSession(patient?.id || null);
  const { request: nirRequest } = usePatientNirRequest(patient?.id || null);
  const { approveRequest } = useBedAllocationRequests();
  const [approvingBed, setApprovingBed] = useState(false);
  // Tick para refresh do cronômetro a cada 60s
  const [, setNowTick] = useState(0);
  useEffect(() => {
    if (!nirRequest || nirRequest.status !== "pending") return;
    const id = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [nirRequest?.status]);
  const { items: specialItems, summary: specialSummary } = usePatientSpecialRequests(
    patient?.id || null,
    patient?.name || null,
    currentHospital?.id || null,
  );
  usePatientBedWatcher(patient?.id || null, patient?.bedNumber || null, patient?.sector || null);

  if (!patient) {
    return (
      <aside
        className={cn(
          variant === "fixed" && "hidden lg:flex w-80 shrink-0 border-l border-border bg-card",
          variant === "inline" && "w-full bg-card border border-border rounded-lg",
          "flex-col items-center justify-center p-8 text-center",
          className
        )}
      >
        <User2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Selecione um paciente para visualizar o cockpit clínico.
        </p>
      </aside>
    );
  }

  const status = clinicalStatusConfig[patient.clinicalStatus || "regular"] || clinicalStatusConfig.regular;
  const sector = sectorLabels[patient.sector] || patient.sector;
  const allergies = parseList(patient.utiAllergies);
  const diagnoses = parseList(patient.diagnoses);
  const medHistory = parseList(patient.medicalHistory);
  const pendencies = parseList(patient.pendencies);
  const exams = parseList(patient.relevantExams);
  const conducts = parseList(patient.utiDailyConducts);
  const devices = parseList(patient.utiDevices);

  const displayName = maskName(patient.name, namesHidden);

  const goPatient = (path: string) => {
    const params = new URLSearchParams({
      patientId: patient.id,
      patientName: patient.name,
      patientBed: patient.bedNumber,
      patientSector: patient.sector,
    });
    if (patient.age) params.set("patientAge", patient.age.toString());
    navigate(`${path}?${params.toString()}`);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        onMouseEnter={() => variant === "fixed" && setHovering(true)}
        onMouseLeave={() => variant === "fixed" && setHovering(false)}
        className={cn(
          variant === "fixed" && [
            "hidden lg:flex shrink-0 border-l border-border bg-card sticky top-0 h-screen",
            "transition-[width] duration-200 ease-out overflow-hidden",
            isExpanded ? "w-80" : "w-12",
          ],
          variant === "inline" && "w-full bg-card border border-border rounded-lg",
          "flex-col print:hidden",
          className
        )}
      >
        {/* Collapsed rail (desktop, only when retracted) */}
        {variant === "fixed" && !isExpanded && (
          <div className="flex flex-col items-center gap-3 pt-3 text-muted-foreground">
            <button
              type="button"
              title="Fixar painel do paciente"
              onClick={() => setPinned(true)}
              className="p-1.5 rounded hover:bg-muted/40 hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
            </button>
            <div className={cn("h-2 w-2 rounded-full", status.dot)} title={status.label} />
            <div className="text-[10px] font-bold tracking-wide writing-mode-vertical text-foreground" style={{ writingMode: "vertical-rl" as any, transform: "rotate(180deg)" }}>
              {patient.bedNumber} · {sector}
            </div>
            {allergies.length > 0 && (
              <span title={`Alergia: ${allergies.join(", ")}`}>
                <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
              </span>
            )}
          </div>
        )}
        {/* Expanded content */}
        <div className={cn("flex flex-col flex-1 min-h-0", variant === "fixed" && !isExpanded && "hidden")}>
        {variant === "fixed" && isExpanded && (
          <div className="flex justify-end px-2 pt-2">
            <button
              type="button"
              title={pinned ? "Desafixar (recolher ao tirar o mouse)" : "Fixar painel aberto"}
              onClick={() => setPinned((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full transition-all duration-200",
                pinned
                  ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-sm hover:shadow-md"
                  : "bg-muted/60 text-muted-foreground hover:bg-primary/10 hover:text-primary"
              )}
            >
              <ChevronRight className={cn("h-3 w-3 transition-transform", pinned ? "rotate-90" : "rotate-180")} />
              {pinned ? "Fixado" : "Fixar"}
            </button>
          </div>
        )}
        {/* ===== ZONA 1: IDENTIDADE (sticky) ===== */}
        <div className="px-4 pt-4 pb-3 border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <h3 className="patient-id text-sm font-bold leading-tight text-foreground truncate">
                {displayName}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 preserve-case">
                {patient.age ? `${patient.age} anos` : "—"} • {sector} • Leito{" "}
                <span className="font-medium text-foreground">{patient.bedNumber}</span>
              </p>
            </div>
            <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap", status.bg)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
              {status.label}
            </div>
          </div>

          {/* Identificadores oficiais — sempre visíveis */}
          <div className="grid grid-cols-1 gap-1 mb-2">
            <IdRow label="Prontuário" value={prontuario} mono />
            <IdRow label="Atendimento" value={atendimento} mono />
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <div className="text-muted-foreground">
              Internação: <span className="text-foreground font-medium"><StayDays admissionDate={patient.admissionDate} /></span>
            </div>
            <div className="text-muted-foreground truncate">
              Adm: <span className="text-foreground font-medium">{formatDate(patient.admissionDate)}</span>
            </div>
          </div>

          {/* Botão Ver mais — abre painel completo do prontuário */}
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
                <div className="text-[10px] uppercase font-semibold text-warning">
                  Paciente não identificado · {registry.unidentifiedCode || "—"}
                </div>
              )}
              <div className="pt-1 border-t border-border/40 text-[10px] text-muted-foreground/80 font-mono break-all">
                ID interno: {patient.id}
              </div>
            </div>
          )}
        </div>

        {/* ===== ZONA 2: AÇÕES PRIMÁRIAS ===== */}
        <div className="px-3 py-3 border-b border-border grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="default"
            className="h-8 text-xs gap-1.5"
            onClick={() => goPatient("/prescricao")}
          >
            <Stethoscope className="h-3.5 w-3.5" />
            Abrir Atendimento
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={() => goPatient("/historico-paciente")}
          >
            <FileText className="h-3.5 w-3.5" />
            Histórico
          </Button>
        </div>

        {/* ===== ZONA 3: ALERTAS CLÍNICOS ===== */}
        <div className="px-3 py-2.5 border-b border-border space-y-1.5">
          {allergies.length > 0 ? (
            <AlertChip
              icon={ShieldAlert}
              tone="danger"
              label="Alergia"
              value={allergies.slice(0, 2).join(" • ")}
              count={allergies.length > 2 ? `+${allergies.length - 2}` : undefined}
            />
          ) : (
            <AlertChip icon={ShieldAlert} tone="muted" label="Sem alergias registradas" />
          )}

          <AlertChip
            icon={AlertTriangle}
            tone={patient.clinicalStatus === "gravissimo" || patient.clinicalStatus === "grave" ? "danger" : "warning"}
            label="Risco TEV"
            value="Alto • Profilaxia ativa"
          />

          {pendencies.length > 0 && (
            <AlertChip
              icon={ClipboardList}
              tone="warning"
              label={`${pendencies.length} pendência${pendencies.length > 1 ? "s" : ""}`}
              value={pendencies[0]}
            />
          )}
        </div>

        {/* ===== ZONA 3.5: PRESCRIÇÃO ATIVA (realtime) ===== */}
        {prescription && (
          <button
            onClick={() => goPatient("/prescricao")}
            className="mx-3 mt-2 mb-1 flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition px-2.5 py-1.5 text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Pill className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-foreground">
                    Prescrição v{prescription.version}
                  </span>
                  <PrescriptionStatusBadge status={prescription.status} signed={prescription.signed} />
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {prescription.itemsCount} {prescription.itemsCount === 1 ? "item" : "itens"} •{" "}
                  {(() => {
                    try {
                      return formatDistanceToNow(new Date(prescription.updatedAt), {
                        addSuffix: true,
                        locale: ptBR,
                      });
                    } catch {
                      return "—";
                    }
                  })()}
                </p>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        )}

        {/* ===== ZONA 3.6: ÚLTIMA EVOLUÇÃO (realtime) ===== */}
        {evolution && (
          <button
            onClick={() => goPatient("/evolucao")}
            className="mx-3 mt-1 mb-1 flex items-start justify-between gap-2 rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition px-2.5 py-1.5 text-left"
          >
            <div className="flex items-start gap-2 min-w-0">
              <NotebookPen className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-foreground">Última evolução</span>
                  <EvolutionStatusBadge status={evolution.status} validatedAt={evolution.validatedAt} />
                </div>
                {evolution.preview && (
                  <p className="text-[10px] text-foreground/80 leading-tight line-clamp-2 preserve-case mt-0.5">
                    {evolution.preview}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 preserve-case">
                  {evolution.createdByName ? `${evolution.createdByName} • ` : ""}
                  {(() => {
                    try {
                      return formatDistanceToNow(new Date(evolution.createdAt), {
                        addSuffix: true,
                        locale: ptBR,
                      });
                    } catch {
                      return "—";
                    }
                  })()}
                </p>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          </button>
        )}

        {/* ===== ZONA 3.7: ÚLTIMOS SINAIS VITAIS (realtime) ===== */}
        {vitals && (
          <button
            onClick={() => goPatient("/monitoramento")}
            className="mx-3 mt-1 mb-1 flex items-start justify-between gap-2 rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition px-2.5 py-1.5 text-left"
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <Activity className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-foreground">Sinais vitais</span>
                  {vitals.news2Risk && <News2Badge risk={vitals.news2Risk} score={vitals.news2Score} />}
                </div>
                <div className="grid grid-cols-3 gap-x-2 gap-y-0 mt-0.5 text-[10px] text-foreground/90 tabular-nums">
                  {vitals.systolicBp != null && vitals.diastolicBp != null && (
                    <span>PA <strong>{vitals.systolicBp}/{vitals.diastolicBp}</strong></span>
                  )}
                  {vitals.heartRate != null && <span>FC <strong>{vitals.heartRate}</strong></span>}
                  {vitals.spo2 != null && <span>SpO₂ <strong>{vitals.spo2}%</strong></span>}
                  {vitals.respiratoryRate != null && <span>FR <strong>{vitals.respiratoryRate}</strong></span>}
                  {vitals.temperature != null && <span>T <strong>{vitals.temperature}°</strong></span>}
                  {vitals.lactate != null && (
                    <span className={cn(Number(vitals.lactate) > 4 && "text-destructive font-semibold")}>
                      Lac <strong>{vitals.lactate}</strong>
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 preserve-case">
                  {vitals.recordedByName ? `${vitals.recordedByName} • ` : ""}
                  {(() => {
                    try {
                      return formatDistanceToNow(new Date(vitals.recordedAt), {
                        addSuffix: true,
                        locale: ptBR,
                      });
                    } catch {
                      return "—";
                    }
                  })()}
                </p>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          </button>
        )}

        {/* ===== ZONA 3.8: ROUND MULTIPROFISSIONAL (realtime) ===== */}
        {round && (
          <button
            onClick={() => goPatient("/round")}
            className="mx-3 mt-1 mb-1 flex items-start justify-between gap-2 rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition px-2.5 py-1.5 text-left"
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <Users className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-foreground">Round multiprofissional</span>
                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide bg-primary/10 text-primary">
                    {formatDate(round.roundDate)}
                  </span>
                </div>
                <p className="text-[10px] text-foreground/80 leading-tight mt-0.5 tabular-nums">
                  {round.responsesCount} {round.responsesCount === 1 ? "resposta" : "respostas"} • {round.goalsCount} {round.goalsCount === 1 ? "meta" : "metas"}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  {(() => {
                    try {
                      return `Atualizado ${formatDistanceToNow(new Date(round.updatedAt), { addSuffix: true, locale: ptBR })}`;
                    } catch { return "—"; }
                  })()}
                </p>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          </button>
        )}

        {/* ===== ZONA 3.9: SOLICITAÇÃO NIR (realtime, com tracking + autonomia médica) ===== */}
        {nirRequest && (() => {
          const elapsedMin = Math.max(0, Math.floor((Date.now() - new Date(nirRequest.createdAt).getTime()) / 60000));
          const isPending = nirRequest.status === "pending";
          const trackingTone =
            elapsedMin > 180 ? "bg-destructive/10 text-destructive border-destructive/30" :
            elapsedMin > 120 ? "bg-amber-500/10 text-amber-700 border-amber-500/30" :
            elapsedMin > 60  ? "bg-yellow-400/10 text-yellow-700 border-yellow-400/30" :
                               "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
          const fmtElapsed = elapsedMin < 60
            ? `${elapsedMin}min`
            : `${Math.floor(elapsedMin / 60)}h${String(elapsedMin % 60).padStart(2, "0")}`;

          const handleApproveBed = async (e: React.MouseEvent) => {
            e.stopPropagation();
            if (approvingBed) return;
            setApprovingBed(true);
            const ok = await approveRequest(nirRequest.id);
            setApprovingBed(false);
            if (ok) toast.success("Leito alocado com autonomia médica");
          };

          return (
            <div className="mx-3 mt-1 mb-1 rounded-md border border-border bg-muted/40">
              <button
                onClick={() => goPatient("/nir")}
                className="w-full flex items-start justify-between gap-2 hover:bg-muted/70 transition px-2.5 py-1.5 text-left rounded-t-md"
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <BedDouble className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-foreground">Solicitação NIR</span>
                      <NirStatusBadge status={nirRequest.status} />
                      {isPending && (
                        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide", trackingTone)}>
                          <ClockIcon className="h-2.5 w-2.5" />
                          {fmtElapsed} aguardando
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-foreground/80 leading-tight mt-0.5 preserve-case">
                      Setor <strong>{nirRequest.requestedSector}</strong>
                      {nirRequest.requestedBed ? ` • Leito ${nirRequest.requestedBed}` : ""}
                    </p>
                    {nirRequest.status === "rejected" && nirRequest.rejectionReason && (
                      <p className="text-[10px] text-destructive leading-tight mt-0.5 preserve-case line-clamp-2">
                        {nirRequest.rejectionReason}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 preserve-case">
                      {nirRequest.requestingDoctorName ? `${nirRequest.requestingDoctorName} • ` : ""}
                      {(() => {
                        try {
                          return formatDistanceToNow(new Date(nirRequest.createdAt), { addSuffix: true, locale: ptBR });
                        } catch { return "—"; }
                      })()}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              </button>
              {/* Autonomia médica — aparece em pending após 30min ou imediatamente se >60min */}
              {isPending && (
                <div className="border-t border-border/60 px-2.5 py-1.5 flex items-center justify-between gap-2">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                    Autonomia médica
                  </span>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-6 text-[10px] px-2 gap-1"
                    disabled={approvingBed}
                    onClick={handleApproveBed}
                  >
                    <CheckIcon className="h-3 w-3" />
                    {approvingBed ? "Alocando…" : "Aprovar e alocar leito"}
                  </Button>
                </div>
              )}
            </div>
          );
        })()}

        {/* ===== ZONA 3.10: REQUISIÇÕES ESPECIAIS (realtime) ===== */}
        {specialSummary.total > 0 && (
          <div className="mx-3 mt-1 mb-1 rounded-md border border-border bg-muted/40">
            <button
              onClick={() => {
                const params = new URLSearchParams({
                  patientId: patient.id,
                  patientName: patient.name,
                  patientBed: patient.bedNumber,
                  patientSector: patient.sector,
                });
                navigate(`/requisicoes?${params.toString()}&especial=apac`);
              }}
              className="w-full flex items-center justify-between gap-2 hover:bg-muted/70 transition px-2.5 py-1.5 text-left rounded-md"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileCheckIcon />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-foreground">
                      Requisições especiais
                    </span>
                    {specialSummary.pending > 0 && (
                      <span className="inline-flex items-center rounded px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide bg-warning/15 text-warning">
                        {specialSummary.pending} pendente{specialSummary.pending > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground mt-0.5">
                    {specialSummary.hemocomponente > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Droplet className="h-2.5 w-2.5 text-rose-500" />
                        Hemo <strong className="text-foreground">{specialSummary.hemocomponente}</strong>
                      </span>
                    )}
                    {specialSummary.sat > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Syringe className="h-2.5 w-2.5 text-amber-500" />
                        SAT <strong className="text-foreground">{specialSummary.sat}</strong>
                      </span>
                    )}
                    {specialSummary.apac > 0 && (
                      <span>APAC <strong className="text-foreground">{specialSummary.apac}</strong></span>
                    )}
                    {specialSummary.cultura > 0 && (
                      <span>Cult. <strong className="text-foreground">{specialSummary.cultura}</strong></span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
            {specialItems.length > 0 && (
              <ul className="border-t border-border/60 px-2.5 py-1.5 space-y-1">
                {specialItems.slice(0, 3).map((it) => (
                  <li
                    key={`${it.kind}-${it.id}`}
                    className="flex items-center justify-between gap-2 text-[10px]"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <SpecialKindDot kind={it.kind} />
                      <span className="truncate text-foreground preserve-case">{it.label}</span>
                    </span>
                    <span className={cn(
                      "text-[9px] uppercase font-semibold px-1 rounded shrink-0",
                      it.status === "completed" && "text-emerald-700 dark:text-emerald-400",
                      it.status === "pending" && "text-warning",
                    )}>
                      {it.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Tabs defaultValue="resumo" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="mx-3 mt-2 grid grid-cols-4 h-8 p-0.5">
            <TabsTrigger value="resumo" className="text-[11px] h-7 px-1">Resumo</TabsTrigger>
            <TabsTrigger value="exames" className="text-[11px] h-7 px-1">Exames</TabsTrigger>
            <TabsTrigger value="condutas" className="text-[11px] h-7 px-1">Condutas</TabsTrigger>
            <TabsTrigger value="trajeto" className="text-[11px] h-7 px-1">Trajeto</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0 mt-1">
            {/* ABA RESUMO: diagnósticos + antecedentes + responsável */}
            <TabsContent value="resumo" className="px-3 pb-3 space-y-3 mt-2 data-[state=inactive]:hidden">
              <CockpitSection icon={Stethoscope} title="Diagnósticos" count={diagnoses.length}>
                <ItemList items={diagnoses} emptyMsg="Sem diagnósticos registrados." />
              </CockpitSection>
              <CockpitSection icon={FileText} title="Antecedentes" count={medHistory.length}>
                <ItemList items={medHistory} emptyMsg="Nenhum antecedente registrado." />
              </CockpitSection>
              <CockpitSection icon={User2} title="Responsável médico">
                <div className="text-xs text-foreground preserve-case">
                  {patient.medicalResponsibility?.leaderNames || (
                    <EmptyMsg>Sem responsável definido.</EmptyMsg>
                  )}
                </div>
              </CockpitSection>
            </TabsContent>

            {/* ABA EXAMES: realtime + relevantes + dispositivos */}
            <TabsContent value="exames" className="px-3 pb-3 space-y-3 mt-2 data-[state=inactive]:hidden">
              <CockpitSection icon={TestTubes} title="Atividade em tempo real">
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  <PendingStat label="Exames pendentes" value={pendingSummary.pendingExams} tone="warning" />
                  <PendingStat label="Exames concluídos" value={pendingSummary.completedExams} tone="success" />
                  <PendingStat label="Culturas pendentes" value={pendingSummary.pendingCultures} tone="warning" />
                  <PendingStat label="Culturas positivas" value={pendingSummary.positiveCultures} tone="danger" />
                </div>
                {pendingItems.length === 0 ? (
                  <EmptyMsg>Nenhum exame ou cultura registrado.</EmptyMsg>
                ) : (
                  <ul className="space-y-1">
                    {pendingItems.slice(0, 5).map((it) => (
                      <li
                        key={`${it.kind}-${it.id}`}
                        className="flex items-center justify-between gap-2 text-[11px] py-1 border-b border-border/50 last:border-0"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {it.kind === "culture" ? (
                            <ShieldAlert className={cn("h-3 w-3 shrink-0", it.critical ? "text-destructive" : "text-muted-foreground")} />
                          ) : (
                            <TestTubes className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                          <span className="truncate preserve-case">{it.label}</span>
                        </div>
                        <span className={cn(
                          "text-[9px] uppercase font-semibold px-1 rounded shrink-0",
                          it.status === "completed" && "text-emerald-700 dark:text-emerald-400",
                          it.status === "pending" && "text-warning",
                          it.critical && "text-destructive",
                        )}>
                          {it.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CockpitSection>
              <CockpitSection icon={TestTubes} title="Exames relevantes" count={exams.length}>
                <ItemList items={exams} emptyMsg="Sem exames destacados." />
              </CockpitSection>
              <CockpitSection icon={Activity} title="Dispositivos" count={devices.length}>
                <ItemList items={devices} emptyMsg="Sem dispositivos invasivos registrados." />
              </CockpitSection>
            </TabsContent>

            {/* ABA CONDUTAS: condutas do dia + pendências */}
            <TabsContent value="condutas" className="px-3 pb-3 space-y-3 mt-2 data-[state=inactive]:hidden">
              <CockpitSection icon={Heart} title="Condutas do dia" count={conducts.length}>
                <ItemList items={conducts} emptyMsg="Nenhuma conduta lançada." />
              </CockpitSection>
              <CockpitSection icon={ClipboardList} title="Pendências" count={pendencies.length}>
                <ItemList items={pendencies} emptyMsg="Sem pendências." />
              </CockpitSection>
            </TabsContent>

            {/* ABA TRAJETO: previsão de alta + movimentações realtime */}
            <TabsContent value="trajeto" className="px-3 pb-3 space-y-3 mt-2 data-[state=inactive]:hidden">
              <CockpitSection icon={TrendingUp} title="Previsão de alta">
                <div className="text-xs text-foreground preserve-case">
                  {patient.utiDischargePrediction && patient.utiDischargePrediction.length > 0
                    ? patient.utiDischargePrediction.join(" • ")
                    : <EmptyMsg>Sem previsão definida.</EmptyMsg>}
                </div>
              </CockpitSection>

              <CockpitSection icon={Route} title="Movimentações" count={movements.length}>
                {movements.length === 0 ? (
                  <EmptyMsg>Nenhuma movimentação registrada.</EmptyMsg>
                ) : (
                  <ul className="space-y-1.5">
                    {movements.slice(0, 5).map((m) => {
                      const origin = [m.patientSector, m.patientBed].filter(Boolean).join(" · ");
                      const released = m.releaseStatus === "released";
                      return (
                        <li key={m.id} className="text-[11px] border-b border-border/40 last:border-0 pb-1.5 last:pb-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground uppercase tracking-wide text-[10px]">
                              {m.movementType.replace(/_/g, " ")}
                            </span>
                            <span className={cn(
                              "text-[9px] uppercase font-semibold px-1 rounded",
                              released ? "text-emerald-700 dark:text-emerald-400" : "text-warning",
                            )}>
                              {released ? "liberado" : "pendente"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground preserve-case mt-0.5">
                            <span className="truncate">{origin || "—"}</span>
                            {m.destination && (
                              <>
                                <ArrowRight className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate text-foreground">{m.destination}</span>
                              </>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {(() => {
                              try {
                                return formatDistanceToNow(new Date(m.createdAt), { addSuffix: true, locale: ptBR });
                              } catch { return "—"; }
                            })()}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CockpitSection>

              <Button
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs gap-1.5"
                onClick={() => goPatient("/alta-desfecho")}
              >
                <LogOut className="h-3.5 w-3.5" />
                Abrir fluxo de alta
              </Button>
            </TabsContent>
          </ScrollArea>
        </Tabs>
        </div>
      </aside>
    </TooltipProvider>
  );
}

/* ===== Subcomponentes ===== */

function FileCheckIcon() {
  return <ClipboardList className="h-3.5 w-3.5 text-primary shrink-0" />;
}

function SpecialKindDot({ kind }: { kind: "hemocomponente" | "sat" | "apac" | "cultura" }) {
  const map: Record<string, string> = {
    hemocomponente: "bg-rose-500",
    sat: "bg-amber-500",
    apac: "bg-indigo-500",
    cultura: "bg-emerald-500",
  };
  return <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", map[kind])} />;
}

interface AlertChipProps {
  icon: React.ComponentType<{ className?: string }>;
  tone: "danger" | "warning" | "success" | "muted";
  label: string;
  value?: string;
  count?: string;
}

function AlertChip({ icon: Icon, tone, label, value, count }: AlertChipProps) {
  const toneStyles = {
    danger: { wrap: "border-l-destructive/70", icon: "text-destructive", count: "text-destructive" },
    warning: { wrap: "border-l-warning/70", icon: "text-warning", count: "text-warning" },
    success: { wrap: "border-l-emerald-500/70", icon: "text-emerald-600 dark:text-emerald-400", count: "text-emerald-600 dark:text-emerald-400" },
    muted: { wrap: "border-l-border", icon: "text-muted-foreground", count: "text-muted-foreground" },
  }[tone];

  return (
    <div
      className={cn(
        "flex items-start gap-2 px-2.5 py-1.5 rounded-md border border-border/60 bg-muted/30 border-l-2",
        toneStyles.wrap,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", toneStyles.icon)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold leading-tight text-foreground">{label}</span>
          {count && <span className={cn("text-[10px] font-bold", toneStyles.count)}>{count}</span>}
        </div>
        {value && (
          <p className="text-[11px] leading-snug text-muted-foreground truncate preserve-case mt-0.5">{value}</p>
        )}
      </div>
    </div>
  );
}

interface CockpitSectionProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  children: React.ReactNode;
}

function CockpitSection({ icon: Icon, title, count, children }: CockpitSectionProps) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{title}</span>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">
            {count}
          </Badge>
        )}
      </div>
      <div className="pl-1">{children}</div>
    </section>
  );
}

function ItemList({ items, emptyMsg }: { items: string[]; emptyMsg: string }) {
  if (items.length === 0) return <EmptyMsg>{emptyMsg}</EmptyMsg>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="text-xs text-foreground leading-snug flex gap-1.5">
          <ChevronRight className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
          <span className="preserve-case">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground italic preserve-case">{children}</p>;
}

function PrescriptionStatusBadge({ status, signed }: { status: string; signed: boolean }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
    pending_validation: { label: "Aguard. validação", className: "bg-warning/15 text-warning" },
    validated: { label: "Validada", className: "bg-primary/10 text-primary" },
    suspended: { label: "Suspensa", className: "bg-destructive/10 text-destructive" },
    finalized: { label: "Finalizada", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  };
  const cfg = map[status] || map.draft;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide", cfg.className)}>
      {cfg.label}
      {signed && <span className="opacity-80">• assinada</span>}
    </span>
  );
}

function EvolutionStatusBadge({ status, validatedAt }: { status: string; validatedAt: string | null }) {
  const isValidated = !!validatedAt || status === "validated";
  const isSuspended = status === "suspended";
  const cfg = isSuspended
    ? { label: "Suspensa", className: "bg-destructive/10 text-destructive" }
    : isValidated
      ? { label: "Validada", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" }
      : { label: "Em andamento", className: "bg-warning/15 text-warning" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide", cfg.className)}>
      {cfg.label}
    </span>
  );
}

function News2Badge({ risk, score }: { risk: string; score: number | null }) {
  const cfg =
    risk === "high"
      ? { label: `NEWS2 ${score ?? "?"}`, className: "bg-destructive/15 text-destructive" }
      : risk === "medium"
        ? { label: `NEWS2 ${score ?? "?"}`, className: "bg-warning/15 text-warning" }
        : { label: `NEWS2 ${score ?? "?"}`, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide", cfg.className)}>
      {cfg.label}
    </span>
  );
}

function NirStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pendente", className: "bg-warning/15 text-warning" },
    discussing: { label: "Em discussão", className: "bg-primary/10 text-primary" },
    approved: { label: "Aprovada", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    rejected: { label: "Rejeitada", className: "bg-destructive/10 text-destructive" },
  };
  const cfg = map[status] || map.pending;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide", cfg.className)}>
      {cfg.label}
    </span>
  );
}

function PendingStat({ label, value, tone }: { label: string; value: number; tone: "warning" | "success" | "danger" }) {
  const toneClasses = {
    warning: "bg-warning/10 text-warning border-warning/20",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    danger: "bg-destructive/10 text-destructive border-destructive/20",
  }[tone];
  return (
    <div className={cn("rounded-md border px-2 py-1 flex items-center justify-between gap-1", toneClasses)}>
      <span className="text-[9.5px] font-medium leading-tight uppercase tracking-tight">{label}</span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </div>
  );
}

/* ===== Identity rows ===== */

function IdRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  const display = value || "—";
  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(
      () => toast.success(`${label} copiado`),
      () => toast.error("Não foi possível copiar"),
    );
  };
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] group">
      <span className="text-muted-foreground uppercase tracking-wide text-[9.5px] font-semibold">
        {label}
      </span>
      <div className="flex items-center gap-1 min-w-0">
        <span
          className={cn(
            "text-foreground font-semibold truncate",
            mono && "font-mono",
            !value && "text-muted-foreground italic font-normal",
          )}
          title={display}
        >
          {display}
        </span>
        {value && (
          <button
            type="button"
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label={`Copiar ${label}`}
          >
            <Copy className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function FullIdRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2 text-[11px] preserve-case">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span
        className={cn(
          "text-foreground text-right truncate",
          mono && "font-mono",
          !value && "text-muted-foreground italic",
        )}
        title={value || ""}
      >
        {value || "—"}
      </span>
    </div>
  );
}
