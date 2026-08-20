/**
 * OCUPAÇÃO DE LEITO EM SETOR DE FAIXA FIXA
 *
 * ─── Por que este módulo existe ─────────────────────────────────────────────
 * O Arsen usa o modelo de LEITOS FIXOS: cada leito existe permanentemente como
 * uma linha em `patients` com `is_vacant = true`. Admitir um paciente é
 * OCUPAR essa linha (UPDATE) — não criar outra. É o que AdmitPatientDialog já
 * fazia, e o que os fluxos da urgência NÃO faziam: eles inseriam uma linha
 * nova a cada paciente, com numeração própria ("M-01", "M-02"…), porque o
 * Posto de Internação ainda não tinha faixa cadastrada.
 *
 * Com a faixa oficial semeada (M01–M14), manter o INSERT produziria dois
 * defeitos: os 14 leitos oficiais ficariam eternamente vazios enquanto todo
 * paciente nasceria como "EXTRA", e o INSERT colidiria com a unicidade
 * (hospital_unit_id, sector, bed_number).
 *
 * ─── Regra ──────────────────────────────────────────────────────────────────
 * 1. Percorre a faixa oficial do setor NA ORDEM (M01, M02, …) e ocupa o
 *    primeiro leito vago — o paciente cai no menor número livre, que é o que a
 *    equipe espera ao olhar o mapa.
 * 2. Faixa toda ocupada: cria um leito EXTRA. Superlotação é realidade
 *    hospitalar; o sistema não pode recusar o paciente. O extra fica visível
 *    como tal e não conta na capacidade instalada.
 */
import { supabase } from "@/integrations/supabase/client";
import { getNextBedNumber } from "@/utils/bedNaming";
import type { SectorType } from "@/types/patient";

export interface OccupyBedParams {
  sector: SectorType;
  department: string;
  hospitalUnitId: string;
  stateId: string;
  /** Campos clínicos e de identificação do paciente que ocupa o leito. */
  patientData: Record<string, unknown>;
}

export interface OccupyBedResult {
  /** Leito ocupado (ex.: "M03") ou criado ("EXTRA1"). */
  bedNumber: string;
  /** id da linha em `patients` — o mesmo id do leito, por definição do modelo. */
  patientId: string;
  /** true quando a faixa estava cheia e foi preciso abrir leito extra. */
  isExtra: boolean;
}

/**
 * Ocupa o primeiro leito vago da faixa do setor; abre um EXTRA se não houver.
 * Lança em caso de falha — o chamador trata e avisa a equipe.
 */
export async function occupyBedInSector(params: OccupyBedParams): Promise<OccupyBedResult> {
  const { sector, department, hospitalUnitId, stateId, patientData } = params;

  const { data: rows, error: readErr } = await supabase
    .from("patients")
    .select("id, bed_number, is_vacant")
    .eq("hospital_unit_id", hospitalUnitId)
    .eq("sector", sector);
  if (readErr) throw readErr;

  const existentes = rows ?? [];
  const porNumero = new Map(existentes.map((r) => [r.bed_number, r]));

  // Faixa oficial do setor, na ordem — o gerador devolve EXTRA quando acaba.
  const faixa: string[] = [];
  for (;;) {
    const proximo = getNextBedNumber(sector, faixa);
    if (proximo.startsWith("EXTRA")) break;
    faixa.push(proximo);
    if (faixa.length > 200) break; // trava de segurança: faixa não pode ser infinita
  }

  const vago = faixa
    .map((n) => porNumero.get(n))
    .find((r) => r && r.is_vacant === true);

  // ── Caminho normal: ocupa a linha vaga ──────────────────────────────────
  if (vago) {
    const ordem = faixa.indexOf(vago.bed_number) + 1;
    const { error } = await supabase
      .from("patients")
      .update({
        ...patientData,
        department,
        is_vacant: false,
        display_order: ordem,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", vago.id);
    if (error) throw error;
    return { bedNumber: vago.bed_number, patientId: vago.id, isExtra: false };
  }

  // ── Faixa cheia: abre leito extra ───────────────────────────────────────
  const bedNumber = getNextBedNumber(
    sector,
    existentes.map((r) => r.bed_number),
  );
  const { data: criado, error } = await supabase
    .from("patients")
    .insert({
      ...patientData,
      sector,
      department,
      hospital_unit_id: hospitalUnitId,
      state_id: stateId,
      bed_number: bedNumber,
      is_vacant: false,
      display_order: faixa.length + 1,
    } as never)
    .select("id")
    .single();
  if (error) throw error;

  return { bedNumber, patientId: criado!.id, isExtra: true };
}
