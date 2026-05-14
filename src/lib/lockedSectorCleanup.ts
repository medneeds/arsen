/**
 * Dispara, no máximo uma vez por hora por sessão de navegador,
 * a limpeza de sinalizações pendentes a setores sem implantação ativa.
 * Preserva o prontuário do paciente — apenas a sinalização é cancelada.
 */
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "last_locked_sector_cleanup_at";
const ONE_HOUR_MS = 60 * 60 * 1000;

let inflight: Promise<void> | null = null;

export function maybeRunLockedSectorCleanup(): void {
  if (typeof window === "undefined") return;
  if (inflight) return;

  try {
    const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
    if (Number.isFinite(last) && Date.now() - last < ONE_HOUR_MS) return;
  } catch {
    /* ignora storage indisponível */
  }

  inflight = (async () => {
    try {
      // marca antes para evitar tempestade em re-renders
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      await supabase.rpc("cleanup_locked_sector_pending_allocations");
    } catch (err) {
      // silencioso — função pode não estar disponível em ambientes legados
      console.debug("[locked-sector-cleanup] skipped", err);
    } finally {
      inflight = null;
    }
  })();
}
