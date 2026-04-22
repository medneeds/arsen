import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Vigia mudanças de leito/setor de um paciente em realtime.
 * Quando o leito ou setor muda, dispara um toast persistente avisando
 * o usuário que está com a tela desse paciente aberta.
 *
 * Evita prescrição num leito errado após transferência feita por outro usuário.
 */
export function usePatientBedWatcher(
  patientId: string | null,
  initialBed: string | null | undefined,
  initialSector: string | null | undefined,
) {
  const lastBedRef = useRef<string | null>(initialBed ?? null);
  const lastSectorRef = useRef<string | null>(initialSector ?? null);

  // Sync refs when patient changes
  useEffect(() => {
    lastBedRef.current = initialBed ?? null;
    lastSectorRef.current = initialSector ?? null;
  }, [patientId, initialBed, initialSector]);

  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`patient-bed-watch-${patientId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "patients", filter: `id=eq.${patientId}` },
        (payload: any) => {
          const row = payload.new;
          if (!row) return;

          const newBed = row.bed_number || null;
          const newSector = row.sector || null;
          const bedChanged = lastBedRef.current && newBed && lastBedRef.current !== newBed;
          const sectorChanged = lastSectorRef.current && newSector && lastSectorRef.current !== newSector;

          if (bedChanged || sectorChanged) {
            toast.warning("Paciente transferido", {
              description: `Novo local: ${newSector || "—"} • Leito ${newBed || "—"}`,
              duration: 8000,
            });
          }
          lastBedRef.current = newBed;
          lastSectorRef.current = newSector;
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId]);
}
