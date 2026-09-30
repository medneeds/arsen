import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * CID-10 codes for a patient. Used by CompactPatientHeader / DiagnosticsPanel so
 * doctors can adjust diagnoses inline on the Evolution / Prescription screens.
 *
 * MIGRAÇÃO: `internacoes` NÃO tem colunas de CID (só `hipotese_diagnostica` em
 * texto livre), então não há onde gravar o CID no nível do paciente/internação.
 *
 * MAS o CID JÁ é persistido no snapshot `soap.__cid_primary` / `__cid_secondary`
 * de cada evolução (ver useEvolutions.createEvolution) e o design do produto é
 * que o CID PERTENCE AO PACIENTE e "continua aparecendo" entre evoluções (ver
 * EvolucaoPage.handleOpenNewEvolution). A degradação anterior — estado só em
 * memória, zerado a cada montagem — quebrava isso: ao recarregar ou reentrar na
 * tela o CID sumia, e como o gate de validação exige CID primário, a validação
 * da evolução ficava bloqueada mesmo em paciente que já tinha CID registrado.
 *
 * Correção SEM mudança de banco: REIDRATAR o estado a partir do CID da evolução
 * mais recente (rascunho ou validada) que tenha CID primário, ao montar/trocar
 * de paciente. A ESCRITA continua sendo o snapshot no soap da próxima evolução
 * criada — nada muda no banco. Ver supabase/MIGRACAO_DEGRADACOES.md.
 */
export function usePatientCid(patientId: string | null) {
  const [cidPrimary, setCidPrimary] = useState<string>("");
  const [cidSecondary, setCidSecondary] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving] = useState(false);
  const lastPatientRef = useRef<string | null>(null);

  const load = useCallback(async (id: string | null) => {
    if (!id) { setCidPrimary(""); setCidSecondary([]); return; }
    setLoading(true);
    // Fonte que já persiste hoje: soap das evoluções desta internação
    // (internacao_id = patientId). Lê as mais recentes e usa a PRIMEIRA que
    // tenha CID primário — o CID se propaga entre evoluções, mas alguns tipos
    // de evolução podem não capturar CID, então não basta a evolução do topo.
    const { data, error } = await supabase
      .from("evolucoes")
      .select("soap, data_hora")
      .eq("internacao_id", id)
      .order("data_hora", { ascending: false })
      .limit(5);
    // Paciente trocou durante o fetch — descarta este resultado.
    if (lastPatientRef.current !== id) return;
    if (!error && Array.isArray(data)) {
      const withCid = (data as { soap?: Record<string, unknown> }[])
        .map((r) => (r?.soap ?? {}) as Record<string, unknown>)
        .find((soap) => typeof soap.__cid_primary === "string" && !!(soap.__cid_primary as string));
      if (withCid) {
        const secRaw = withCid.__cid_secondary;
        const secondary: string[] = Array.isArray(secRaw)
          ? (secRaw as unknown[]).filter((x): x is string => typeof x === "string" && !!x)
          : typeof secRaw === "string" && secRaw ? [secRaw] : [];
        setCidPrimary(withCid.__cid_primary as string);
        setCidSecondary(secondary);
      } else {
        setCidPrimary("");
        setCidSecondary([]);
      }
    }
    setLoading(false);
  }, []);

  // Ao trocar de paciente, reidrata do banco (evolução mais recente com CID).
  useEffect(() => {
    if (lastPatientRef.current !== patientId) {
      lastPatientRef.current = patientId;
      setCidPrimary("");
      setCidSecondary([]);
      void load(patientId);
    }
  }, [patientId, load]);

  const refresh = useCallback(async () => { await load(lastPatientRef.current); }, [load]);

  const updatePrimary = useCallback(async (value: string) => {
    // Apenas estado local — a persistência é o snapshot no soap da próxima
    // evolução criada (sem coluna de destino no nível do paciente).
    setCidPrimary(value);
  }, []);

  const updateSecondary = useCallback(async (values: string[]) => {
    setCidSecondary(values);
  }, []);

  return {
    cidPrimary, cidSecondary,
    loading, saving,
    updatePrimary, updateSecondary,
    refresh,
  };
}
