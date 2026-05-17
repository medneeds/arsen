import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { asUuidOrNull } from "@/lib/utils";

/**
 * 🔒 FONTE ÚNICA DA VERDADE PARA RESOLUÇÃO DE PRONTUÁRIO
 *
 * Recebe `bedRowId` (= `patients.id`, vindo da URL `?patientId=`) e devolve
 * o `patient_registry_id` (= identidade clínica permanente) correspondente.
 *
 * Por que este hook existe:
 * - A URL passa `patients.id` (linha do MAPA DE LEITOS, muda quando o paciente
 *   troca de leito).
 * - Prescrições/evoluções/exames/culturas são gravados com `patient_registry_id`
 *   (IDENTIDADE clínica, vive para sempre).
 * - Usar `urlPatientId` direto em `.eq('patient_registry_id', ...)` filtra por
 *   ID errado → query retorna 0 linhas → "sumiu" (mas o dado nunca sumiu).
 *
 * Garantias:
 * - Cancela respostas antigas quando o `bedRowId` muda (anti race-condition).
 * - Cache em memória com TTL curto (30s) para evitar round-trip extra.
 * - Devolve também `hospitalUnitId` para você validar afinidade de unidade
 *   antes de gravar (defesa em profundidade contra cross-unidade).
 * - Nunca esconde estado: mantém `isResolving` para a UI mostrar skeleton em
 *   vez de "vazio silencioso".
 */

type CacheEntry = {
  registryId: string | null;
  hospitalUnitId: string | null;
  patientName: string | null;
  ts: number;
};

const TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

export interface ResolvedRegistry {
  registryId: string | null;
  hospitalUnitId: string | null;
  patientName: string | null;
  isResolving: boolean;
  error: string | null;
}

export function useResolvedRegistryId(
  bedRowId: string | null | undefined,
): ResolvedRegistry {
  const [state, setState] = useState<ResolvedRegistry>(() => {
    const normalized = asUuidOrNull(bedRowId || "");
    if (!normalized) {
      return {
        registryId: null,
        hospitalUnitId: null,
        patientName: null,
        isResolving: false,
        error: null,
      };
    }
    const cached = cache.get(normalized);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      return {
        registryId: cached.registryId,
        hospitalUnitId: cached.hospitalUnitId,
        patientName: cached.patientName,
        isResolving: false,
        error: null,
      };
    }
    return {
      registryId: null,
      hospitalUnitId: null,
      patientName: null,
      isResolving: true,
      error: null,
    };
  });

  const lastBedRowIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const normalized = asUuidOrNull(bedRowId || "");
    lastBedRowIdRef.current = normalized;

    if (!normalized) {
      setState({
        registryId: null,
        hospitalUnitId: null,
        patientName: null,
        isResolving: false,
        error: null,
      });
      return;
    }

    const cached = cache.get(normalized);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      setState({
        registryId: cached.registryId,
        hospitalUnitId: cached.hospitalUnitId,
        patientName: cached.patientName,
        isResolving: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, isResolving: true, error: null }));

    (async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("patient_registry_id, hospital_unit_id, name")
        .eq("id", normalized)
        .maybeSingle();

      if (cancelled || lastBedRowIdRef.current !== normalized) return;

      if (error) {
        console.error("[useResolvedRegistryId] resolve failed", error);
        setState({
          registryId: null,
          hospitalUnitId: null,
          patientName: null,
          isResolving: false,
          error: error.message || "Falha ao resolver prontuário",
        });
        return;
      }

      const entry: CacheEntry = {
        registryId: (data?.patient_registry_id as string | null) || null,
        hospitalUnitId: (data?.hospital_unit_id as string | null) || null,
        patientName: (data?.name as string | null) || null,
        ts: Date.now(),
      };
      cache.set(normalized, entry);

      setState({
        registryId: entry.registryId,
        hospitalUnitId: entry.hospitalUnitId,
        patientName: entry.patientName,
        isResolving: false,
        error: null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [bedRowId]);

  return state;
}

/** Invalida cache (use após relocação/transferência que muda o registry vinculado). */
export function invalidateResolvedRegistry(bedRowId: string | null | undefined) {
  const normalized = asUuidOrNull(bedRowId || "");
  if (normalized) cache.delete(normalized);
}
