import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

/**
 * Banner global de "Modo Manutenção".
 * Lê o singleton public.system_maintenance_mode (id=1) e ouve realtime para
 * refletir mudanças instantaneamente em toda a aplicação. Aparece para
 * QUALQUER usuário (autenticado ou não) sempre que `is_active = true`.
 */
export function MaintenanceModeBanner() {
  const [state, setState] = useState<{ active: boolean; reason: string | null; startedAt: string | null }>({
    active: false, reason: null, startedAt: null,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("system_maintenance_mode")
        .select("is_active, reason, started_at")
        .eq("id", 1)
        .maybeSingle();
      if (cancelled || !data) return;
      setState({ active: !!data.is_active, reason: data.reason ?? null, startedAt: data.started_at ?? null });
    };
    load();
    const ch = supabase
      .channel("system_maintenance_mode_banner")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_maintenance_mode", filter: "id=eq.1" },
        (payload: any) => {
          const row = payload.new ?? payload.old;
          if (!row) return;
          setState({ active: !!row.is_active, reason: row.reason ?? null, startedAt: row.started_at ?? null });
        },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

  if (!state.active) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] bg-amber-500 text-amber-950 shadow-lg border-b-2 border-amber-700">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 animate-pulse" />
        <div className="flex-1 text-sm font-medium">
          <span className="font-bold uppercase tracking-wide">SISTEMA EM MODO MANUTENÇÃO</span>
          <span className="ml-2 hidden md:inline">
            Operações de escrita estão temporariamente bloqueadas (restore de banco em andamento).
            {state.reason ? ` Motivo: ${state.reason.slice(0, 120)}` : ""}
          </span>
        </div>
        {state.startedAt && (
          <span className="text-xs opacity-80 tabular-nums hidden sm:inline">
            iniciado às {new Date(state.startedAt).toLocaleTimeString("pt-BR")}
          </span>
        )}
      </div>
    </div>
  );
}
