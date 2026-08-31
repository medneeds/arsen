/**
 * Dispara, no máximo uma vez por hora por sessão de navegador,
 * a limpeza de sinalizações pendentes a setores sem implantação ativa.
 * Preserva o prontuário do paciente — apenas a sinalização é cancelada.
 */
import { supabase } from "@/integrations/supabase/client";
import { LOCKED_DEPARTMENTS } from "@/config/lockedSectors";

const STORAGE_KEY = "last_locked_sector_cleanup_at";
const ONE_HOUR_MS = 60 * 60 * 1000;

let inflight: Promise<void> | null = null;

export function maybeRunLockedSectorCleanup(): void {
  if (typeof window === "undefined") return;
  if (inflight) return;

  // Guarda: sem setor travado no app, não há o que limpar.
  //
  // POR QUE ISTO EXISTE
  // A RPC cleanup_locked_sector_pending_allocations carrega a PRÓPRIA lista de
  // setores, hardcoded no SQL — ela não lê LOCKED_DEPARTMENTS. Quando o Set foi
  // esvaziado (05/08/2026) para liberar setores em teste, a metade visual foi
  // desligada mas a metade que CANCELA registros continuou ativa, disparada por
  // esta função a cada hora. Resultado: sinalizações de paciente destinadas a
  // Sala Vermelha, Sala Laranja, Posto de Internação e outros nove setores eram
  // canceladas automaticamente após 24h, sem decisão humana.
  //
  // Enquanto as duas listas não tiverem uma fonte única, este guarda mantém as
  // metades coerentes: o app só pede limpeza se ele próprio considera algum
  // setor sem implantação.
  // Ver docs/sql-cadeado-setores-dessincronizado.md
  if (LOCKED_DEPARTMENTS.size === 0) return;

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
