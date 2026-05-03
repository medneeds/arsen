import { useMemo } from "react";
import { format, formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BedDouble, UserRound, Clock, Stethoscope, FileCheck2, ArrowRightCircle,
  LogOut, Sparkles, Wand2, CheckCircle2, Lock, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";

interface BedRecord {
  id: string;
  bed_number: string;
  sector: string;
  status: string;
  patient_name?: string | null;
  patient_id?: string | null;
  last_patient_name?: string | null;
  block_reason?: string | null;
  admission_at?: string | null;
  occupied_at?: string | null;
  medical_discharge_at?: string | null;
  administrative_discharge_at?: string | null;
  destination_released_at?: string | null;
  deallocated_at?: string | null;
  cleaning_started_at?: string | null;
  cleaning_finished_at?: string | null;
  ready_for_admission_at?: string | null;
  status_changed_at?: string | null;
  block_started_at?: string | null;
  updated_at?: string | null;
  updated_by_name?: string | null;
}

interface Props {
  bed: BedRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  vago: { label: "Vago — disponível", color: "bg-emerald-500", icon: CheckCircle2 },
  ocupado: { label: "Ocupado", color: "bg-blue-500", icon: UserRound },
  bloqueado: { label: "Bloqueado", color: "bg-red-500", icon: Lock },
  higienizacao: { label: "Em higienização", color: "bg-amber-500", icon: Sparkles },
  reservado: { label: "Reservado", color: "bg-purple-500", icon: FileCheck2 },
  manutencao: { label: "Manutenção", color: "bg-orange-500", icon: Wand2 },
  interditado: { label: "Interditado", color: "bg-red-700", icon: AlertTriangle },
  alta_medica_dada: { label: "Alta médica dada", color: "bg-cyan-500", icon: LogOut },
};

function fmt(ts?: string | null) {
  if (!ts) return null;
  try {
    return format(new Date(ts), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return null;
  }
}

function elapsed(ts?: string | null) {
  if (!ts) return null;
  try {
    return formatDistanceStrict(new Date(ts), new Date(), { addSuffix: true, locale: ptBR });
  } catch {
    return null;
  }
}

export function BedDetailDialog({ bed, open, onOpenChange }: Props) {
  const meta = bed ? (STATUS_META[bed.status] || { label: bed.status, color: "bg-muted", icon: BedDouble }) : null;
  const StatusIcon = meta?.icon || BedDouble;

  const timeline = useMemo(() => {
    if (!bed) return [] as Array<{ key: string; label: string; ts?: string | null; icon: any; tone: string }>;
    return [
      { key: "admission_at", label: "Admissão do paciente", ts: bed.admission_at || bed.occupied_at, icon: UserRound, tone: "text-blue-500" },
      { key: "medical_discharge_at", label: "Alta médica", ts: bed.medical_discharge_at, icon: Stethoscope, tone: "text-cyan-500" },
      { key: "administrative_discharge_at", label: "Alta administrativa", ts: bed.administrative_discharge_at, icon: FileCheck2, tone: "text-rose-500" },
      { key: "destination_released_at", label: "Liberação do destino", ts: bed.destination_released_at, icon: ArrowRightCircle, tone: "text-indigo-500" },
      { key: "deallocated_at", label: "Desalocação do paciente", ts: bed.deallocated_at, icon: LogOut, tone: "text-orange-500" },
      { key: "cleaning_started_at", label: "Início do preparo (higienização)", ts: bed.cleaning_started_at, icon: Sparkles, tone: "text-amber-500" },
      { key: "cleaning_finished_at", label: "Finalização do preparo", ts: bed.cleaning_finished_at, icon: Wand2, tone: "text-amber-600" },
      { key: "ready_for_admission_at", label: "Liberação para nova admissão", ts: bed.ready_for_admission_at, icon: CheckCircle2, tone: "text-emerald-500" },
      { key: "occupied_at", label: "Ocupação efetiva", ts: bed.occupied_at, icon: BedDouble, tone: "text-blue-600" },
    ];
  }, [bed]);

  // KPIs derivados
  const kpis = useMemo(() => {
    if (!bed) return [] as Array<{ label: string; value: string }>;
    const out: Array<{ label: string; value: string }> = [];
    const now = Date.now();

    if (bed.status === "ocupado" && bed.occupied_at) {
      const h = (now - new Date(bed.occupied_at).getTime()) / 3_600_000;
      out.push({ label: "Tempo de ocupação", value: h < 24 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} dias` });
    }
    if (bed.medical_discharge_at && !bed.administrative_discharge_at) {
      const h = (now - new Date(bed.medical_discharge_at).getTime()) / 3_600_000;
      out.push({ label: "Aguardando alta administrativa", value: `${h.toFixed(1)} h` });
    }
    if (bed.cleaning_started_at && !bed.cleaning_finished_at) {
      const h = (now - new Date(bed.cleaning_started_at).getTime()) / 3_600_000;
      out.push({ label: "Em higienização há", value: `${h.toFixed(1)} h` });
    }
    if (bed.status === "vago" && bed.ready_for_admission_at) {
      const h = (now - new Date(bed.ready_for_admission_at).getTime()) / 3_600_000;
      out.push({ label: "Vago há", value: h < 24 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} dias` });
    }
    if (bed.block_started_at) {
      const h = (now - new Date(bed.block_started_at).getTime()) / 3_600_000;
      out.push({ label: "Bloqueado há", value: h < 24 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} dias` });
    }
    return out;
  }, [bed]);

  if (!bed || !meta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-primary" />
            Leito {bed.bed_number} · {sectorLabelFromCode(bed.sector)}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <span className={cn("h-2.5 w-2.5 rounded-full", meta.color)} />
            <StatusIcon className="h-3.5 w-3.5" />
            {meta.label}
            {bed.status_changed_at && (
              <span className="text-xs text-muted-foreground">· status alterado {elapsed(bed.status_changed_at)}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Paciente */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          {bed.patient_name ? (
            <div className="flex items-center gap-2 text-sm">
              <UserRound className="h-4 w-4 text-blue-500" />
              <span className="font-semibold">{bed.patient_name}</span>
            </div>
          ) : bed.last_patient_name ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserRound className="h-4 w-4" /> Último paciente: {bed.last_patient_name}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BedDouble className="h-4 w-4" /> Leito sem ocupação registrada.
            </div>
          )}
          {bed.block_reason && (
            <p className="text-xs text-destructive mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {bed.block_reason}
            </p>
          )}
        </div>

        {/* KPIs do ciclo */}
        {kpis.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-lg border border-border bg-card p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className="text-sm font-bold mt-0.5">{k.value}</p>
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Timeline de tempos */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Linha do tempo do leito
          </h4>
          <ol className="space-y-2">
            {timeline.map((step) => {
              const Icon = step.icon;
              const has = !!step.ts;
              return (
                <li
                  key={step.key}
                  className={cn(
                    "flex items-start gap-3 rounded-md border p-2",
                    has ? "border-border bg-card" : "border-dashed border-border/50 bg-muted/20",
                  )}
                >
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", has ? step.tone : "text-muted-foreground/50")} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-medium", !has && "text-muted-foreground")}>{step.label}</p>
                    {has ? (
                      <p className="text-[11px] text-muted-foreground">
                        {fmt(step.ts)} <span className="text-muted-foreground/60">· {elapsed(step.ts)}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/60">— ainda não registrado</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {bed.updated_by_name && (
          <p className="text-[10px] text-muted-foreground text-right">
            Última atualização por <span className="font-medium">{bed.updated_by_name}</span>
            {bed.updated_at ? ` · ${fmt(bed.updated_at)}` : ""}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
