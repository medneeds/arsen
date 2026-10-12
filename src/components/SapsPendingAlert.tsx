import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ClipboardList, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useSapsPending } from "@/hooks/useSapsPending";
import { cn } from "@/lib/utils";

interface SapsPendingAlertProps {
  patientName?: string | null;
  patientId?: string | null;
  patientBed?: string | null;
  patientSector?: string | null;
  /** Reminder toast interval in minutes. Default 5. */
  reminderMinutes?: number;
  className?: string;
}

const SAPS_DEADLINE_HOURS = 24;

function formatElapsed(pendingSince: string | null): { label: string; remaining: string; over: boolean; criticalSoon: boolean } {
  if (!pendingSince) return { label: "—", remaining: "—", over: false, criticalSoon: false };
  const start = new Date(pendingSince).getTime();
  const now = Date.now();
  const elapsedMs = Math.max(0, now - start);
  const elapsedH = Math.floor(elapsedMs / 3_600_000);
  const elapsedM = Math.floor((elapsedMs % 3_600_000) / 60_000);
  const deadlineMs = SAPS_DEADLINE_HOURS * 3_600_000;
  const remainingMs = deadlineMs - elapsedMs;
  const over = remainingMs <= 0;
  const remH = Math.floor(Math.max(0, remainingMs) / 3_600_000);
  const remM = Math.floor((Math.max(0, remainingMs) % 3_600_000) / 60_000);
  return {
    label: `${elapsedH}h ${String(elapsedM).padStart(2, "0")}min`,
    remaining: over ? "VENCIDO" : `${remH}h ${String(remM).padStart(2, "0")}min`,
    over,
    criticalSoon: !over && remainingMs < 4 * 3_600_000,
  };
}

/**
 * Sticky banner + recurring toast reminder for patients with pending SAPS 3.
 * Use on Evolução, Prescrição, Requisição and Painel Clínico.
 */
export function SapsPendingAlert({
  patientName,
  patientId,
  patientBed,
  patientSector,
  reminderMinutes = 5,
  className,
}: SapsPendingAlertProps) {
  const navigate = useNavigate();
  // Ancora na internacao (internacao_id), nao mais no nome do paciente.
  const pending = useSapsPending(patientId);
  const [, setTick] = useState(0);
  const lastToastRef = useRef<number>(0);

  // Tick every minute to refresh elapsed/remaining display.
  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [pending]);

  // Recurring reminder toast.
  useEffect(() => {
    if (!pending) return;
    const fire = () => {
      const elapsed = formatElapsed(pending.pending_since);
      lastToastRef.current = Date.now();
      toast({
        title: elapsed.over ? "SAPS 3 VENCIDO" : "SAPS 3 pendente",
        description: elapsed.over
          ? `${patientName ?? "Paciente"}: ficha SAPS 3 ultrapassou 24h. Complete agora para liberar o gate clínico.`
          : `${patientName ?? "Paciente"}: complete a ficha SAPS 3 (faltam ${elapsed.remaining} para vencer).`,
        variant: elapsed.over || elapsed.criticalSoon ? "destructive" : "default",
      });
    };
    // Fire once on mount
    fire();
    const id = window.setInterval(fire, Math.max(1, reminderMinutes) * 60_000);
    return () => window.clearInterval(id);
  }, [pending, reminderMinutes, patientName]);

  const elapsed = useMemo(() => formatElapsed(pending?.pending_since ?? null), [pending]);

  if (!pending) return null;

  const handleComplete = () => {
    const params = new URLSearchParams();
    params.set("completeSapsId", pending.id);
    if (patientName) params.set("patientName", patientName);
    if (patientId) params.set("patientId", patientId);
    if (patientBed) params.set("patientBed", patientBed);
    if (patientSector) params.set("patientSector", patientSector);
    navigate(`/saps3?${params.toString()}`);
  };

  const tone = elapsed.over ? "text-critical-on-soft" : "text-warning-on-soft";
  // Uma linha so (quebra sozinha em tela estreita): titulo + tempo + prazo + botao.
  return (
    <div
      className={cn(
        "rounded-lg border-l-4 px-3 py-1.5 mb-2 shadow-sm flex items-center gap-2.5 print:hidden animate-pulse-slow",
        elapsed.over
          ? "border-critical bg-critical-soft"
          : "border-warning bg-warning-soft",
        className,
      )}
      role="alert"
    >
      <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", tone)} />
      <p className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-tight">
        <span className={cn("font-semibold", tone)}>
          SAPS 3 PENDENTE — {patientName ?? "Paciente"}
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" /> Pendente há {elapsed.label}
        </span>
        <span className={cn("font-medium", tone)}>
          {elapsed.over ? "Prazo de 24h vencido — fluxo será travado" : `Faltam ${elapsed.remaining} (limite 24h)`}
        </span>
      </p>
      <Button
        size="sm"
        variant={elapsed.over ? "destructive" : "default"}
        onClick={handleComplete}
        className="shrink-0 gap-1.5 h-7 px-3 text-xs"
      >
        <ClipboardList className="h-3 w-3" />
        Completar SAPS 3
      </Button>
    </div>
  );
}
