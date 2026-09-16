import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getClinicalDayWindowSP } from "@/lib/clinicalDay";

export type TodaysPrescriptionStatus = "signed" | "validated" | "pending";

/**
 * Detecta prescrições validadas no DIA CLÍNICO ATUAL por hospital_unit_id.
 *
 * Dia clínico: 05:00 SP → 04:59:59 SP do dia seguinte (via getClinicalDayWindowSP).
 * Ao virar 05h, o status reseta: apenas prescrições validadas APÓS o corte de 05h
 * são consideradas "Validada". Prescrições de antes das 05h precisam ser revalidadas.
 *
 * Retorna dois mapas para lookup robusto:
 *  - validatedRegistryIds: por patient_registry_id (mais confiável, sem ambiguidade de nome)
 *  - validatedNames: por patient_name normalizado (fallback)
 *
 * Detecção em 3 camadas:
 *  1. status = 'signed' ou 'validated' (prescrições pós-fix)
 *  2. items[].validatedAt dentro do dia clínico atual (principal)
 *  3. Todos items ativos com validated=true e sem validatedAt (legado)
 *     — só conta se a prescrição foi criada/atualizada no dia clínico atual
 */
export function useTodaysPrescriptions(hospitalUnitId: string | null) {
  const [validatedRegistryIds, setValidatedRegistryIds] = useState<Set<string>>(new Set());
  const [validatedNames, setValidatedNames] = useState<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    if (!hospitalUnitId) {
      setValidatedRegistryIds(new Set());
      setValidatedNames(new Set());
      return;
    }

    // Janela do dia clínico atual (05:00 SP → 04:59:59 SP do dia seguinte)
    const { start: clinicalStart } = getClinicalDayWindowSP();

    // Buscar prescrições do hospital com criação nos últimos 2 dias clínicos
    // (cobrindo prescrições criadas antes das 5h mas validadas depois)
    const since = new Date(clinicalStart.getTime() - 24 * 60 * 60 * 1000);

    // MIGRAÇÃO: prescriptions → prescricoes. patient_name/patient_registry_id/
    // hospital_unit_id NÃO têm coluna → nome e paciente_id vêm do join
    // internacoes→pacientes; o filtro por hospital foi REMOVIDO (escopo via RLS).
    // items→itens, created_at→criado_em, updated_at→atualizado_em.
    const { data, error } = await supabase
      .from("prescricoes")
      .select("status, itens, criado_em, atualizado_em, internacao:internacoes(paciente:pacientes(id, nome_completo, nome_social))")
      .gte("criado_em", since.toISOString())
      .order("criado_em", { ascending: false })
      .limit(500);

    if (error || !data) {
      setValidatedRegistryIds(new Set());
      setValidatedNames(new Set());
      return;
    }

    const normName = (n: string) => String(n).replace(/\s+/g, " ").trim().toUpperCase();

    const isValidatedInCurrentClinicalDay = (row: any): boolean => {
      // Parse items defensivo
      const items: any[] = Array.isArray(row.itens)
        ? row.itens
        : typeof row.itens === "string"
          ? (() => { try { return JSON.parse(row.itens); } catch { return []; } })()
          : [];

      // Camada 1 — status explícito de validação
      // Para status 'signed'/'validated', verificar se foi validado no dia clínico atual
      // via validatedAt dos itens (para não exibir validações do dia anterior)
      if (row.status === "signed" || row.status === "validated") {
        // Se tem items com validatedAt, verificar se algum está no dia clínico atual
        const hasValidatedAt = items.some((i: any) => i && i.validatedAt);
        if (hasValidatedAt) {
          return items.some((i: any) =>
            i && i.validatedAt && new Date(i.validatedAt) >= clinicalStart
          );
        }
        // Sem validatedAt mas com status validated — assumir que é do dia atual
        // se foi atualizado após o início do dia clínico
        const updatedAt = row.atualizado_em ? new Date(row.atualizado_em) : null;
        if (updatedAt && updatedAt >= clinicalStart) return true;
        // Fallback: assumir validado (compatibilidade com registros antigos)
        return true;
      }

      if (items.length === 0) return false;

      // Camada 2 — validatedAt dos itens no dia clínico atual (principal)
      const hasRecentValidation = items.some((i: any) =>
        i && i.validatedAt && new Date(i.validatedAt) >= clinicalStart
      );
      if (hasRecentValidation) return true;

      // Camada 3 — fallback legado: todos ativos validados, sem validatedAt
      // Só conta se a prescrição foi criada/atualizada no dia clínico atual
      const active = items.filter((i: any) => i && i.status === "active");
      if (active.length > 0 && active.every((i: any) => !!i.validated)) {
        const rowDate = row.atualizado_em || row.criado_em;
        return rowDate ? new Date(rowDate) >= clinicalStart : false;
      }

      return false;
    };

    const nextIds = new Set<string>();
    const nextNames = new Set<string>();

    for (const row of data as any[]) {
      if (!isValidatedInCurrentClinicalDay(row)) continue;
      const pac = row.internacao?.paciente || null;
      // registryId agora = paciente_id (identidade permanente).
      if (pac?.id) nextIds.add(String(pac.id));
      const nome = pac?.nome_social || pac?.nome_completo;
      if (nome) nextNames.add(normName(nome));
    }

    setValidatedRegistryIds(nextIds);
    setValidatedNames(nextNames);
  }, [hospitalUnitId]);

  const fetchAllRef = useRef(fetchAll);
  useEffect(() => { fetchAllRef.current = fetchAll; }, [fetchAll]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Revalidar automaticamente quando virar 05h (início do novo dia clínico)
  useEffect(() => {
    const { end } = getClinicalDayWindowSP();
    const msUntilReset = end.getTime() - Date.now() + 100; // +100ms buffer
    if (msUntilReset > 0 && msUntilReset < 25 * 60 * 60 * 1000) {
      const timer = setTimeout(() => fetchAllRef.current(), msUntilReset);
      return () => clearTimeout(timer);
    }
  }, []);

  // Realtime — qualquer mudança na tabela atualiza o mapa
  useEffect(() => {
    if (!hospitalUnitId) return;
    // MIGRAÇÃO: canal prescriptions → prescricoes. Sem filtro por hospital
    // (coluna inexistente) → assina todas as mudanças e refaz o fetch (escopo RLS).
    const channel = supabase
      .channel(`prescricoes-today-${hospitalUnitId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "prescricoes",
      }, () => fetchAllRef.current())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hospitalUnitId]);

  const getStatus = useCallback(
    (patientName: string | null | undefined, registryId?: string | null): TodaysPrescriptionStatus => {
      // Lookup por registry_id primeiro (mais confiável — imune a diferença de nome)
      if (registryId && validatedRegistryIds.has(String(registryId))) return "validated";
      // Fallback por nome normalizado
      if (!patientName) return "pending";
      const normalized = String(patientName).replace(/\s+/g, " ").trim().toUpperCase();
      return validatedNames.has(normalized) ? "validated" : "pending";
    },
    [validatedRegistryIds, validatedNames],
  );

  return { getStatus, validatedRegistryIds, validatedNames, refresh: fetchAll };
}
