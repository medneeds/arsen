import { useState } from "react";
import { Patient } from "@/types/patient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Activity, AlertTriangle, ArrowRight, ChevronDown, ChevronRight,
  ClipboardList, Copy, FileText, Heart, IdCard, LogOut, Pill, Plus, Route,
  ShieldAlert, Stethoscope, TestTubes, TrendingUp, User2
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

export function PatientCockpit({ patient, className, variant = "fixed" }: PatientCockpitProps) {
  const { namesHidden } = usePrivacy();
  const navigate = useNavigate();
  const { currentHospital } = useHospital();
  const [showFullId, setShowFullId] = useState(false);
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
      patient: patient.name,
      bed: patient.bedNumber,
    });
    navigate(`${path}?${params.toString()}`);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          variant === "fixed" && "hidden lg:flex w-80 shrink-0 border-l border-border bg-card sticky top-0 h-screen",
          variant === "inline" && "w-full bg-card border border-border rounded-lg",
          "flex-col print:hidden",
          className
        )}
      >
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
            onClick={() => goPatient("/painel-clinico")}
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

        {/* ===== ZONA 4: ABAS OTIMIZADAS ===== */}
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
      </aside>
    </TooltipProvider>
  );
}

/* ===== Subcomponentes ===== */

interface AlertChipProps {
  icon: React.ComponentType<{ className?: string }>;
  tone: "danger" | "warning" | "success" | "muted";
  label: string;
  value?: string;
  count?: string;
}

function AlertChip({ icon: Icon, tone, label, value, count }: AlertChipProps) {
  const toneClasses = {
    danger: "bg-destructive/10 text-destructive border-destructive/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    muted: "bg-muted/60 text-muted-foreground border-border",
  }[tone];

  return (
    <div className={cn("flex items-start gap-2 px-2.5 py-1.5 rounded-md border", toneClasses)}>
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold leading-tight">{label}</span>
          {count && <span className="text-[10px] font-bold opacity-80">{count}</span>}
        </div>
        {value && (
          <p className="text-[11px] leading-snug opacity-90 truncate preserve-case mt-0.5">{value}</p>
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
