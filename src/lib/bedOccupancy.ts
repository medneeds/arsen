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
// MIGRAÇÃO: bed_census/patients → leitos.
// O modelo antigo guardava cada leito como uma linha `patients` com `is_vacant`;
// "ocupar" era um UPDATE dessa linha com ~30 colunas clínicas (patientData). No
// schema novo o leito é uma linha `leitos` (id, numero, status, tipo, setor_id) e a
// unidade clínica vive em `internacoes`. Aqui apenas marcamos o leito como
// `ocupado` (status ∈ livre/ocupado/higienizacao/bloqueado/reservado — 'vago' do
// código antigo é INVÁLIDO, vaga = 'livre'). O `patientData`/`department`/`stateId`
// NÃO têm coluna em `leitos` e são DEGRADADOS (a admissão clínica é de outro fluxo).
// O `id` do leito ocupado é devolvido como `patientId` para manter a assinatura.
// Ver MIGRACAO_DEGRADACOES.md.
export async function occupyBedInSector(params: OccupyBedParams): Promise<OccupyBedResult> {
  const { sector, hospitalUnitId } = params;

  // Resolve o setor (do hospital) por código (`tipo`) ou rótulo (`nome`).
  const { data: setoresData, error: setorErr } = await (supabase
    .from("setores")
    .select("id, nome, tipo, ala:alas!inner(hospital_id)") as any)
    .eq("ala.hospital_id", hospitalUnitId);
  if (setorErr) throw setorErr;
  const setorMatch = ((setoresData || []) as any[]).find(
    (s) => s.tipo === sector || s.nome === sector,
  );
  if (!setorMatch) throw new Error(`Setor "${sector}" não encontrado no hospital atual.`);

  const { data: rows, error: readErr } = await supabase
    .from("leitos")
    .select("id, numero, status")
    .eq("setor_id", setorMatch.id);
  if (readErr) throw readErr;

  const existentes = rows ?? [];
  const porNumero = new Map(existentes.map((r: any) => [r.numero, r]));

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
    .find((r: any) => r && r.status === "livre");

  // ── Caminho normal: ocupa o leito livre ─────────────────────────────────
  // MIGRAÇÃO: patientData/department/display_order/is_vacant não existem em `leitos` → só status.
  if (vago) {
    const { error } = await supabase
      .from("leitos")
      .update({ status: "ocupado" })
      .eq("id", vago.id);
    if (error) throw error;
    return { bedNumber: vago.numero, patientId: vago.id, isExtra: false };
  }

  // ── Faixa cheia: abre leito extra ───────────────────────────────────────
  const bedNumber = getNextBedNumber(
    sector,
    existentes.map((r: any) => r.numero),
  );
  const { data: criado, error } = await supabase
    .from("leitos")
    .insert({
      numero: bedNumber,
      setor_id: setorMatch.id,
      status: "ocupado",
      tipo: "comum", // MIGRAÇÃO: sem mapeamento de tipo → default "comum"
    } as never)
    .select("id")
    .single();
  if (error) throw error;

  return { bedNumber, patientId: (criado as any)!.id, isExtra: true };
}
