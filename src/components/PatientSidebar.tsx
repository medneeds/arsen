import { Patient } from "@/types/patient";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  X, BedDouble, Calendar, Clock, Activity, FileText, Stethoscope,
  AlertTriangle, ClipboardList, Pill, TrendingUp, Heart, User, TestTubes
} from "lucide-react";
import { differenceInDays, differenceInHours, parseISO, isValid } from "date-fns";
import { formatAgeDisplay } from "@/utils/ageDisplay";
import { usePrivacy, maskName } from "@/contexts/PrivacyContext";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface PatientSidebarProps {
  patient: Patient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToEvolution?: (patientId: string) => void;
  onNavigateToPrescription?: (patientId: string) => void;
}

const parseTextArray = (value: string | string[] | null | undefined): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    if (value.startsWith('[')) {
      try { return JSON.parse(value); } catch { /* fallback */ }
    }
    return value.split('\n').filter(line => line.trim());
  }
  return [];
};

const sectorLabels: Record<string, { label: string; className: string }> = {
  red: { label: "Cuidados Especiais", className: "bg-destructive/10 text-destructive border-destructive/30" },
  yellow: { label: "Obs. Amarela", className: "bg-warning/10 text-warning border-warning/30" },
  blue: { label: "Obs. Azul", className: "bg-primary/10 text-primary border-primary/30" },
  outside: { label: "Fora das Alas", className: "bg-muted text-muted-foreground border-border" },
};

const clinicalStatusLabels: Record<string, { label: string; color: string }> = {
  gravissimo: { label: "Gravíssimo", color: "bg-red-600 text-white" },
  grave: { label: "Grave", color: "bg-orange-500 text-white" },
  grave_estavel: { label: "Grave Estável", color: "bg-amber-500 text-white" },
  potencialmente_grave: { label: "Potencialmente Grave", color: "bg-yellow-500 text-black" },
  regular: { label: "Regular", color: "bg-green-500 text-white" },
  paliativado: { label: "Paliativado", color: "bg-purple-500 text-white" },
};

function StayDuration({ admissionDate }: { admissionDate?: string }) {
  if (!admissionDate) return <span className="text-muted-foreground text-xs">—</span>;
  try {
    const date = parseISO(admissionDate);
    if (!isValid(date)) return <span className="text-muted-foreground text-xs">—</span>;
    const days = differenceInDays(new Date(), date);
    const hours = differenceInHours(new Date(), date) % 24;
    return (
      <span className="text-xs font-medium">
        {days > 0 ? `${days}d ${hours}h` : `${hours}h`}
      </span>
    );
  } catch {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
}

function InfoSection({ icon: Icon, title, items, emptyText = "Nenhum registro" }: {
  icon: React.ElementType;
  title: string;
  items: string[];
  emptyText?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
      </div>
      <ul className="space-y-0.5 pl-5">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-foreground list-disc leading-relaxed">{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function PatientSidebar({ patient, open, onOpenChange }: PatientSidebarProps) {
  const { namesHidden } = usePrivacy();
  const navigate = useNavigate();

  if (!patient) return null;

  const diagnoses = parseTextArray(patient.diagnoses);
  const medicalHistory = parseTextArray(patient.medicalHistory);
  const relevantExams = parseTextArray(patient.relevantExams);
  const pendencies = parseTextArray(patient.pendencies);
  const schedule = parseTextArray(patient.schedule);
  const sector = sectorLabels[patient.sector] || sectorLabels.outside;
  const clinicalStatus = patient.clinicalStatus ? clinicalStatusLabels[patient.clinicalStatus] : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] p-0 border-l border-border/50">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/5 to-accent/5 border-b border-border/50 p-4 space-y-3">
          <SheetHeader className="space-y-1">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base font-bold truncate">
                  {maskName(patient.name, namesHidden)}
                </SheetTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="text-[10px] font-mono gap-1">
                    <BedDouble className="h-3 w-3" />
                    {patient.bedNumber}
                  </Badge>
                  <Badge variant="outline" className={cn("text-[10px]", sector.className)}>
                    {sector.label}
                  </Badge>
                  {clinicalStatus && (
                    <Badge className={cn("text-[10px]", clinicalStatus.color)}>
                      {clinicalStatus.label}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </SheetHeader>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card/80 rounded-lg p-2 text-center border border-border/30">
              <User className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
              <p className="text-[10px] text-muted-foreground">Idade</p>
              <p className="text-xs font-semibold">{formatAgeDisplay(patient.age) || "—"}</p>
            </div>
            <div className="bg-card/80 rounded-lg p-2 text-center border border-border/30">
              <Calendar className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
              <p className="text-[10px] text-muted-foreground">Admissão</p>
              <p className="text-xs font-semibold">
                {patient.admissionDate
                  ? new Date(patient.admissionDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                  : "—"}
              </p>
            </div>
            <div className="bg-card/80 rounded-lg p-2 text-center border border-border/30">
              <Clock className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
              <p className="text-[10px] text-muted-foreground">Tempo</p>
              <p className="text-xs font-semibold">
                <StayDuration admissionDate={patient.admissionDate} />
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="h-[calc(100vh-260px)]">
          <div className="p-4 space-y-4">
            <InfoSection icon={Stethoscope} title="Hipóteses / Diagnósticos" items={diagnoses} />
            <InfoSection icon={Heart} title="Antecedentes / Comorbidades" items={medicalHistory} />
            <InfoSection icon={TrendingUp} title="Exames Relevantes" items={relevantExams} />
            <InfoSection icon={ClipboardList} title="Plano Terapêutico" items={schedule} />
            <InfoSection icon={AlertTriangle} title="Programações / Pendências" items={pendencies} />

            {patient.admissionHistory && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">História Admissional</h4>
                </div>
                <p className="text-xs text-foreground pl-5 leading-relaxed whitespace-pre-line">
                  {patient.admissionHistory}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-border/50 bg-background p-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => {
              navigate(`/evolucao?patientId=${patient.id}&patientName=${encodeURIComponent(patient.name)}&patientBed=${encodeURIComponent(patient.bedNumber)}&patientSector=${encodeURIComponent(patient.sector)}`);
              onOpenChange(false);
            }}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Evolução
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => {
              navigate('/prescricao', { state: { patientId: patient.id, patientName: patient.name } });
              onOpenChange(false);
            }}
          >
            <Pill className="h-3.5 w-3.5 mr-1.5" />
            Prescrição
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => {
              navigate('/requisicoes', { 
                state: { 
                  patientId: patient.id, 
                  patientName: patient.name, 
                  patientBed: patient.bedNumber, 
                  patientSector: patient.sector 
                } 
              });
              onOpenChange(false);
            }}
          >
            <TestTubes className="h-3.5 w-3.5 mr-1.5" />
            Requisições
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
