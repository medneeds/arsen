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
  const pending = useSapsPending(patientName);
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
          ? `${pending.patient_name}: ficha SAPS 3 ultrapassou 24h. Complete agora para liberar o gate clínico.`
          : `${pending.patient_name}: complete a ficha SAPS 3 (faltam ${elapsed.remaining} para vencer).`,
        variant: elapsed.over || elapsed.criticalSoon ? "destructive" : "default",
      });
    };
    // Fire once on mount
    fire();
    const id = window.setInterval(fire, Math.max(1, reminderMinutes) * 60_000);
    return () => window.clearInterval(id);
  }, [pending, reminderMinutes]);

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

  return (
    <div
      className={cn(
        "rounded-xl border-l-4 p-3 mb-3 shadow-sm flex items-center gap-3 print:hidden animate-pulse-slow",
        elapsed.over
          ? "border-red-600 bg-red-50 dark:bg-red-950/30"
          : elapsed.criticalSoon
          ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
          : "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
        className,
      )}
      role="alert"
    >
      <AlertTriangle
        className={cn(
          "h-5 w-5 shrink-0",
          elapsed.over ? "text-red-600" : elapsed.criticalSoon ? "text-orange-600" : "text-amber-600",
        )}
      />
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-semibold",
          elapsed.over ? "text-red-800 dark:text-red-200" : "text-amber-900 dark:text-amber-100",
        )}>
          SAPS 3 PENDENTE — {pending.patient_name}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> Pendente há {elapsed.label}
          </span>
          <span className={cn(
            "inline-flex items-center gap-1 font-medium",
            elapsed.over ? "text-red-700" : elapsed.criticalSoon ? "text-orange-700" : "text-amber-700",
          )}>
            {elapsed.over ? "Prazo de 24h vencido — fluxo será travado" : `Faltam ${elapsed.remaining} (limite 24h)`}
          </span>
        </p>
      </div>
      <Button
        size="sm"
        variant={elapsed.over ? "destructive" : "default"}
        onClick={handleComplete}
        className="shrink-0 gap-1.5"
      >
        <ClipboardList className="h-4 w-4" />
        Completar SAPS 3
      </Button>
    </div>
  );
}
