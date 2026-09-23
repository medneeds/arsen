import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";

export interface InternalTransferRequestRow {
  id: string;
  source_patient_id: string;
  source_bed: string | null;
  source_sector: string | null;
  patient_name: string;
  patient_snapshot: any;
  encounter_code: string | null;
  target_sector_code: string;
  target_sector_label: string | null;
  classification: "escalada_critica" | "escalada_intermediaria" | "escalada_simples" | "desescalada" | "lateral_critica" | "lateral_comum";
  requires_saps: boolean;
  reason: string | null;
  status: "pending" | "completed" | "cancelled";
  signaled_by: string | null;
  signaled_at: string;
  hospital_unit_id: string;
}

// MIGRAÇÃO: `internal_transfer_requests` (tabela morta) não existe no schema novo.
// A sinalização de transferência interna passou a ser gravada em `logs_auditoria`
// (tipo_evento='sinalizacao_transferencia_interna'), pois `transferencias` exige
// leito_destino_id NOT NULL e não modela uma sinalização sem leito de destino.
// Esta fila lê esses eventos. DEGRADADO: o schema novo não marca conclusão/
// cancelamento no log, então mostramos a sinalização mais recente por internação
// (dedupe por internacao_id) e todas ficam como 'pending'. Sem coluna de hospital
// confiável no log → escopo por hospital fica a cargo da RLS (hoje 1 hospital).
export function useInternalTransferQueue(sectorCode?: string | null) {
  const { currentHospital } = useHospital();
  const [rows, setRows] = useState<InternalTransferRequestRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentHospital?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("logs_auditoria")
      .select("id, internacao_id, criado_em, ator_user_id, motivo, dados_novos")
      .eq("tipo_evento", "sinalizacao_transferencia_interna")
      .order("criado_em", { ascending: false })
      .limit(500);

    if (!error && data) {
      const seen = new Set<string>();
      const mapped: InternalTransferRequestRow[] = [];
      for (const log of data as any[]) {
        const dn = (log.dados_novos as any) || {};
        // Dedupe: só a sinalização mais recente de cada internação.
        const key = log.internacao_id || log.id;
        if (seen.has(key)) continue;
        seen.add(key);
        if (sectorCode && dn.target_sector_code !== sectorCode) continue;
        mapped.push({
          id: log.id,
          source_patient_id: log.internacao_id,
          source_bed: dn.source_bed ?? null,
          source_sector: dn.source_sector ?? null,
          patient_name: dn.patient_snapshot?.name ?? dn.patient_snapshot?.nome ?? "",
          patient_snapshot: dn.patient_snapshot ?? null,
          encounter_code: null, // MIGRAÇÃO: sem encounter_code no schema novo
          target_sector_code: dn.target_sector_code,
          target_sector_label: dn.target_sector_label ?? null,
          classification: dn.classification,
          requires_saps: !!dn.requires_saps,
          reason: log.motivo ?? null,
          status: "pending",
          signaled_by: log.ator_user_id ?? null,
          signaled_at: log.criado_em,
          hospital_unit_id: currentHospital.id,
        });
      }
      setRows(mapped);
    }
    setLoading(false);
  }, [currentHospital?.id, sectorCode]);

  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!currentHospital?.id) return;
    const ch = supabase
      .channel(`itr-${currentHospital.id}-${sectorCode ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "logs_auditoria" }, () => refreshRef.current())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentHospital?.id, sectorCode]);

  return { rows, loading, refresh };
}
