import { supabase } from "@/integrations/supabase/client";
import { fetchPatientIdentifiers } from "@/hooks/usePatientIdentifiers";
import { resolveCurrentBedSector } from "@/lib/resolvePatientHeader";
import { normalizeLegacyIntervalFlags } from "@/lib/prescriptionIntervals";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
// Somente TIPOS (apagados no build): não puxa o módulo da PrescricaoPage.
import type { DigitalSignature, PatientHeader, PrescriptionItem } from "@/pages/PrescricaoPage";

export interface PrescricaoParaImpressao {
  patient: PatientHeader;
  items: PrescriptionItem[];
  digitalSignature: DigitalSignature | null;
}

/** Alergias: formato canônico do banco (uma por linha) → exibição (", "). Igual à PrescricaoPage. */
const alergiasParaExibicao = (raw: string | null | undefined) =>
  (raw ?? "")
    .toString()
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

/**
 * Monta os dados para REIMPRIMIR uma prescrição salva no layout oficial
 * ("Prescrição médica diária", PrintablePrescription da PrescricaoPage).
 *
 * SOMENTE LEITURA: nada é gravado. A reimpressão pela tela de Prescrição
 * passaria por persistItems (que atualiza/versiona a prescrição), por isso o
 * Histórico usa este caminho próprio.
 *
 * O cabeçalho segue as mesmas fontes da tela de Prescrição: cadastro
 * (fetchPatientIdentifiers), leito/setor atuais da internação
 * (resolveCurrentBedSector), datas de admissão e peso da internação.
 * A internação usada é a DA PRÓPRIA prescrição (prescricoes.internacao_id).
 *
 * Retorna null se a prescrição não for encontrada.
 */
export async function carregarPrescricaoParaImpressao(
  prescricaoId: string,
  fallback: { name?: string | null; bed?: string | null; sector?: string | null },
): Promise<PrescricaoParaImpressao | null> {
  const { data: rx } = await supabase
    .from("prescricoes")
    .select("internacao_id, itens, assinatura_digital")
    .eq("id", prescricaoId)
    .maybeSingle();
  if (!rx) return null;

  const internacaoId = (rx as { internacao_id?: string | null }).internacao_id ?? null;

  const [ident, bedSector, datas, peso] = await Promise.all([
    fetchPatientIdentifiers(internacaoId, null).catch(() => null),
    resolveCurrentBedSector(internacaoId),
    internacaoId
      ? (async () => {
          const r = await supabase
            .from("internacoes")
            .select("data_entrada, data_admissao_uti")
            .eq("id", internacaoId)
            .maybeSingle();
          if (!r.error) return r.data as { data_entrada?: string | null; data_admissao_uti?: string | null } | null;
          // Coluna data_admissao_uti ausente: só a admissão hospitalar.
          const r2 = await supabase.from("internacoes").select("data_entrada").eq("id", internacaoId).maybeSingle();
          return (r2.data as { data_entrada?: string | null } | null) ?? null;
        })().catch(() => null)
      : Promise.resolve(null),
    internacaoId
      ? (async () => {
          // Consulta isolada: se internacoes.peso_kg não existir, só o peso fica em branco.
          const r = await supabase.from("internacoes").select("peso_kg").eq("id", internacaoId).maybeSingle();
          const v = r.error ? null : (r.data as { peso_kg?: number | string | null } | null)?.peso_kg;
          return v != null ? String(v) : "";
        })().catch(() => "")
      : Promise.resolve(""),
  ]);

  const reg = ident?.registry ?? null;
  const sectorCode = bedSector.sector || fallback.sector || "";
  const admissao = datas?.data_entrada ? String(datas.data_entrada).slice(0, 10) : "";
  const admissaoSetor = (datas as { data_admissao_uti?: string | null } | null)?.data_admissao_uti
    ? String((datas as { data_admissao_uti?: string | null }).data_admissao_uti).slice(0, 10)
    : admissao;

  const patient: PatientHeader = {
    name: reg?.fullName || fallback.name || "",
    socialName: reg?.socialName || undefined,
    birthDate: reg?.birthDate || "",
    age: reg?.age || "",
    sex: reg?.sex || "",
    bed: bedSector.bed || fallback.bed || "",
    unit: getSectorDisplayLabel(sectorCode) || sectorCode,
    record: ident?.prontuario || "",
    encounterCode: ident?.atendimento || undefined,
    admissionDate: admissao,
    utiAdmissionDate: admissaoSetor,
    weight: peso || "",
    allergies: alergiasParaExibicao(reg?.allergies),
    motherName: reg?.motherName || "",
    address: "",
    city: "",
  };

  const items = (Array.isArray((rx as { itens?: unknown }).itens) ? (rx as { itens: unknown[] }).itens : [])
    .filter((it): it is PrescriptionItem => !!it && typeof it === "object")
    .map((it) => normalizeLegacyIntervalFlags(it));

  return {
    patient,
    items,
    digitalSignature: ((rx as { assinatura_digital?: unknown }).assinatura_digital as DigitalSignature | null) ?? null,
  };
}
