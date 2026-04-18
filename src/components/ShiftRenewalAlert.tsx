import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShiftRenewalAlertProps {
  /** Quantidade de itens ativos não revalidados após o corte 05:00 */
  pendingCount: number;
  /** Total de itens ativos */
  activeCount: number;
  /** Já passou da troca de plantão (05:00 de hoje) */
  isPastRenewal: boolean;
  /** Ação para revalidar todos */
  onRenewAll: () => void;
  /** Prescrição está travada/bloqueada (ex: sem paciente) */
  disabled?: boolean;
}

/**
 * Banner que avisa o médico sobre necessidade de revalidação na troca de plantão (05:00).
 * - Pré-aviso amarelo entre 04:00 e 05:00
 * - Alerta vermelho após 05:00 enquanto houver itens não revalidados
 */
export function ShiftRenewalAlert({
  pendingCount,
  activeCount,
  isPastRenewal,
  onRenewAll,
  disabled,
}: ShiftRenewalAlertProps) {
  const [now, setNow] = useState(() => new Date());

  // Atualiza a cada 30s para acompanhar a janela de pré-aviso
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(i);
  }, []);

  const minutesToRenewal = useMemo(() => {
    const h = now.getHours();
    const m = now.getMinutes();
    // Janela de pré-aviso: 04:00 → 05:00 (60 minutos antes da troca)
    if (h === 4) return 60 - m;
    return null;
  }, [now]);

  const showPreAlert = minutesToRenewal !== null && activeCount > 0;
  const showPostAlert = isPastRenewal && pendingCount > 0;

  if (!showPreAlert && !showPostAlert) return null;

  // PÓS-troca: alerta crítico
  if (showPostAlert) {
    return (
      <div
        role="alert"
        className={cn(
          "rounded-lg border-l-4 border-destructive bg-destructive/10 px-4 py-3",
          "flex items-start gap-3 mb-3"
        )}
      >
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-destructive">
            Renovação de plantão pendente
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {pendingCount} de {activeCount} {pendingCount === 1 ? "item ativo precisa" : "itens ativos precisam"} ser revalidad{pendingCount === 1 ? "o" : "os"} após a troca de plantão das <strong>05:00</strong>.
          </div>
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={onRenewAll}
          disabled={disabled}
          className="gap-2 shrink-0"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Revalidar agora
        </Button>
      </div>
    );
  }

  // PRÉ-aviso (entre 04:00 e 05:00)
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-4 py-3",
        "flex items-start gap-3 mb-3"
      )}
    >
      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Troca de plantão em {minutesToRenewal} min
        </div>
        <div className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
          Às <strong>05:00</strong> a prescrição precisará ser revalidada. Considere revisar e revalidar antecipadamente os {activeCount} {activeCount === 1 ? "item ativo" : "itens ativos"}.
        </div>
      </div>
    </div>
  );
}
