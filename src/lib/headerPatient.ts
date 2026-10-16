/**
 * Identificacao do paciente para o cabecalho padronizado dos impressos.
 *
 * Completa, a partir do cadastro, o que o gerador nao trouxe (sexo, nome da
 * mae, CPF/CNS, peso, alergias, admissao no setor...). O que o chamador JA
 * informou tem prioridade — nada que a tela mostrou e foi para o papel e
 * sobrescrito. Nunca lanca: se a consulta falhar, devolve o que veio.
 */
import { supabase } from "@/integrations/supabase/client";
import { resolvePatientHeader, resolveCurrentBedSector, withTimeout } from "@/lib/resolvePatientHeader";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import type { HeaderPatient } from "@/lib/documentHeaderLayout";

/** yyyy-mm-dd (ou ISO) -> dd/mm/aaaa; qualquer outra coisa volta como veio. */
export function fmtIsoDate(d: string | null | undefined): string {
  const raw = (d ?? "").toString().trim();
  if (!raw) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : raw;
}

const has = (v: string | null | undefined) => (v ?? "").toString().trim().length > 0;

/** Preenche so os campos vazios de `base`. */
export function mergeHeaderPatient(base: HeaderPatient, extra: HeaderPatient): HeaderPatient {
  const out: HeaderPatient = { ...base };
  (Object.keys(extra) as (keyof HeaderPatient)[]).forEach((k) => {
    if (!has(out[k]) && has(extra[k])) out[k] = extra[k];
  });
  return out;
}

export async function resolveHeaderPatient(
  patientId: string | null | undefined,
  base: HeaderPatient,
): Promise<HeaderPatient> {
  if (!patientId) return base;
  try {
    // Teto de tempo global: identidade/leito/peso que pendurem nao prendem a
    // janela de impressao no splash — devolve `base` (dados da tela) e o PDF sai.
    const racePromise = Promise.all([
      resolvePatientHeader(patientId, base.name, null),
      resolveCurrentBedSector(patientId),
      (async () => {
        try {
          const r = await supabase
            .from("internacoes")
            .select("peso_kg, data_entrada, data_admissao_uti")
            .eq("id", patientId)
            .maybeSingle();
          return r.data as { peso_kg?: number | null; data_entrada?: string | null; data_admissao_uti?: string | null } | null;
        } catch {
          return null;
        }
      })(),
    ]);
    const raced = await withTimeout<Awaited<typeof racePromise> | null>(racePromise, 7000, null);
    if (!raced) return base;
    const [ident, live, inter] = raced;
    const fromDb: HeaderPatient = {
      name: ident.name !== "—" ? ident.name : undefined,
      socialName: ident.socialName,
      bed: live.bed,
      sector: live.sector ? getSectorDisplayLabel(live.sector) : undefined,
      record: ident.prontuario,
      atendimento: ident.atendimento,
      birthDate: fmtIsoDate(ident.birthDate),
      age: ident.age,
      sex: ident.sex,
      weight: inter?.peso_kg != null ? `${inter.peso_kg}kg` : undefined,
      sectorAdmission: fmtIsoDate(inter?.data_admissao_uti || inter?.data_entrada),
      allergies: ident.allergies,
      motherName: ident.motherName,
      cpf: ident.cpf,
      cns: ident.cns,
      phone: ident.phone,
      address: ident.address,
    };
    const merged = mergeHeaderPatient(base, fromDb);
    // Leito e setor ATUAIS (apos relocacoes) valem mais que o snapshot da tela.
    if (has(fromDb.bed)) merged.bed = fromDb.bed;
    if (has(fromDb.sector)) merged.sector = fromDb.sector;
    return merged;
  } catch {
    return base;
  }
}
