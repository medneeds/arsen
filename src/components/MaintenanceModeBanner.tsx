import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

/**
 * Banner global de "Modo Manutenção".
 * Lê o singleton public.modo_manutencao (id=1) e ouve realtime para
 * refletir mudanças instantaneamente em toda a aplicação. Aparece para
 * QUALQUER usuário (autenticado ou não) sempre que `ativo = true`.
 *
 * MIGRAÇÃO: `system_maintenance_mode` (morta) → `modo_manutencao`.
 * Mapeamento: is_active→ativo, reason→motivo, started_at→iniciado_em.
 */
export function MaintenanceModeBanner() {
  const [state, setState] = useState<{ active: boolean; reason: string | null; startedAt: string | null }>({
    active: false, reason: null, startedAt: null,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("modo_manutencao")
        .select("ativo, motivo, iniciado_em")
        .eq("id", 1)
        .maybeSingle();
      if (cancelled || !data) return;
      setState({ active: !!data.ativo, reason: data.motivo ?? null, startedAt: data.iniciado_em ?? null });
    };
    load();
    const ch = supabase
      .channel("modo_manutencao_banner")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "modo_manutencao", filter: "id=eq.1" },
        (payload: any) => {
          const row = payload.new ?? payload.old;
          if (!row) return;
          setState({ active: !!row.ativo, reason: row.motivo ?? null, startedAt: row.iniciado_em ?? null });
        },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

  if (!state.active) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] bg-warning text-warning-on-soft shadow-md border-b-2 border-warning">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 animate-pulse" />
        <div className="flex-1 text-sm font-medium">
          <span className="font-semibold uppercase tracking-wide">SISTEMA EM MODO MANUTENÇÃO</span>
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
