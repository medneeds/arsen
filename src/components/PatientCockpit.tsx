import { Patient } from "@/types/patient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Activity, AlertTriangle, ChevronRight,
  ClipboardList, FileText, Heart, LogOut, Pill, Plus,
  ShieldAlert, Stethoscope, TestTubes, TrendingUp, User2
} from "lucide-react";
import { differenceInDays, parseISO, isValid, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { usePrivacy, maskName } from "@/contexts/PrivacyContext";
import { useNavigate } from "react-router-dom";

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

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <div className="text-muted-foreground">
              Internação: <span className="text-foreground font-medium"><StayDays admissionDate={patient.admissionDate} /></span>
            </div>
            <div className="text-muted-foreground truncate">
              Adm: <span className="text-foreground font-medium">{formatDate(patient.admissionDate)}</span>
            </div>
            <div className="text-muted-foreground col-span-2 truncate">
              ID: <span className="text-foreground font-medium font-mono">{patient.id}</span>
            </div>
          </div>
        </div>

        {/* ===== ZONA 2: AÇÕES PRIMÁRIAS ===== */}
        <div className="px-3 py-3 border-b border-border grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="default"
            className="h-8 text-xs gap-1.5"
            onClick={() => goPatient("/evolucao")}
          >
            <Plus className="h-3.5 w-3.5" />
            Evolução
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={() => goPatient("/prescricao")}
          >
            <Pill className="h-3.5 w-3.5" />
            Prescrever
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={() => goPatient("/monitoramento")}
          >
            <Activity className="h-3.5 w-3.5" />
            Sinais Vitais
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={() => goPatient("/alta-desfecho")}
          >
            <LogOut className="h-3.5 w-3.5" />
            Alta
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

        {/* ===== ZONA 4: ABAS OTIMIZADAS ===== */}
        <Tabs defaultValue="resumo" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="mx-3 mt-2 grid grid-cols-4 h-8 p-0.5">
            <TabsTrigger value="resumo" className="text-[11px] h-7 px-1">Resumo</TabsTrigger>
            <TabsTrigger value="exames" className="text-[11px] h-7 px-1">Exames</TabsTrigger>
            <TabsTrigger value="condutas" className="text-[11px] h-7 px-1">Condutas</TabsTrigger>
            <TabsTrigger value="alta" className="text-[11px] h-7 px-1">Alta</TabsTrigger>
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

            {/* ABA EXAMES: exames relevantes + dispositivos */}
            <TabsContent value="exames" className="px-3 pb-3 space-y-3 mt-2 data-[state=inactive]:hidden">
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

            {/* ABA ALTA: previsão de alta */}
            <TabsContent value="alta" className="px-3 pb-3 space-y-3 mt-2 data-[state=inactive]:hidden">
              <CockpitSection icon={TrendingUp} title="Previsão de alta">
                <div className="text-xs text-foreground preserve-case">
                  {patient.utiDischargePrediction && patient.utiDischargePrediction.length > 0
                    ? patient.utiDischargePrediction.join(" • ")
                    : <EmptyMsg>Sem previsão definida.</EmptyMsg>}
                </div>
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

interface CockpitAccordionProps {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  children: React.ReactNode;
}

function CockpitAccordion({ value, icon: Icon, title, count, children }: CockpitAccordionProps) {
  return (
    <AccordionItem value={value} className="border-b border-border/60 last:border-b-0">
      <AccordionTrigger className="py-2.5 hover:no-underline group">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span>{title}</span>
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">
              {count}
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-3 pt-0.5">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground italic preserve-case">{children}</p>;
}
