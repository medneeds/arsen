import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEncounterId } from "@/hooks/useActiveEncounterId";
import { useResolvedRegistryId } from "@/hooks/useResolvedRegistryId";

export interface PatientMovement {
  id: string;
  movementType: string;
  destination: string | null;
  patientSector: string | null;
  patientBed: string | null;
  releaseStatus: string;
  releasedAt: string | null;
  createdAt: string;
  notes: string | null;
}

// MIGRAÇÃO: patient_movements (morta) → logs_auditoria.
// A nova `transferencias` só modela transferência leito→leito (leito_destino_id NOT
// NULL) e não cabe em alta/óbito/evasão/sinalização sem destino; por isso o registro
// de movimentação foi migrado para `logs_auditoria` (tipo_evento='movimentacao_*' e
// 'sinalizacao_transferencia_*'), com os campos ricos preservados em `dados_novos`.
// Ver MIGRACAO_DEGRADACOES.md. patientId == internacoes.id.
const MOVEMENT_EVENT_PREFIXES = ["movimentacao_", "sinalizacao_transferencia_"];
const isMovementEvent = (tipo: string | null | undefined) =>
  !!tipo && MOVEMENT_EVENT_PREFIXES.some((p) => tipo.startsWith(p));

/**
 * Realtime list of patient movements for a given patient, from logs_auditoria.
 * DEGRADADO: o fallback por patient_name + hospital_unit_id (colunas inexistentes
 * em logs_auditoria) foi removido — só o caminho por patientId (=internacao_id) resolve.
 */
export function usePatientMovements(
  patientId: string | null,
  patientName: string | null,
  hospitalUnitId: string | null,
) {
  const [movements, setMovements] = useState<PatientMovement[]>([]);
  const [loading, setLoading] = useState(false);

  // Fase B.1 — isola pelo atendimento ativo (encounter = a própria internação)
  const { encounterId: activeEncounterId } = useActiveEncounterId(patientId);
  // 🔒 Mantido por compatibilidade de assinatura; no schema novo o histórico segue a internação.
  const { registryId: resolvedRegistryId } = useResolvedRegistryId(patientId);

  const fetchMovements = useCallback(async () => {
    // MIGRAÇÃO: sem patientId (=internacao_id) não há como escopar em logs_auditoria.
    if (!patientId) { setMovements([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("logs_auditoria")
      .select("*")
      .eq("internacao_id", patientId)
      .order("criado_em", { ascending: false })
      .limit(30);

    if (!error && data) {
      const rows = (data as any[]).filter((r) => isMovementEvent(r.tipo_evento));
      setMovements(rows.slice(0, 15).map((r: any) => {
        const dn = (r.dados_novos ?? {}) as Record<string, any>;
        return {
          id: r.id,
          // dados_novos.movement_type preserva o subtipo original; senão deriva do tipo_evento.
          movementType: dn.movement_type ?? String(r.tipo_evento).replace(/^movimentacao_/, ""),
          destination: dn.destination ?? null,
          patientSector: dn.patient_sector ?? null,
          patientBed: dn.patient_bed ?? null,
          releaseStatus: dn.release_status ?? "pending_release",
          releasedAt: dn.released_at ?? null,
          createdAt: r.criado_em,
          notes: dn.notes ?? r.motivo ?? null,
        };
      }));
    }
    setLoading(false);
  }, [patientId, patientName, hospitalUnitId, activeEncounterId, resolvedRegistryId]);

  const fetchMovementsRef = useRef(fetchMovements);
  useEffect(() => { fetchMovementsRef.current = fetchMovements; }, [fetchMovements]);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  useEffect(() => {
    // MIGRAÇÃO: realtime em logs_auditoria; match por internacao_id (=patientId).
    if (!patientId) return;
    const channel = supabase
      .channel(`patient-movements-${patientId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "logs_auditoria" },
        (payload) => {
          const row: any = payload.new || payload.old;
          if (!row) return;
          if (row.internacao_id === patientId && isMovementEvent(row.tipo_evento)) {
            fetchMovementsRef.current();
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId, patientName, hospitalUnitId]);

  return { movements, loading, refresh: fetchMovements };
}
