import { supabase } from "@/integrations/supabase/client";
import { formatDeviceLabel, type EvolutionDevice } from "@/lib/devicesCatalog";

/**
 * SEED do formulario de admissao a partir da historia JA persistida na propria
 * internacao (ancorada em internacao_id).
 *
 * MOTIVACAO: na transferencia interna (completeInternalTransfer) a MESMA linha de
 * `internacoes` e reusada (mesmo internacao_id). Historia/CID/antecedentes/vitais
 * ja estao gravados em `internacoes` e na ultima `evolucoes`. Ao reabrir /admissao
 * para um paciente transferido em cadeia (Sala Vermelha -> Laranja -> UTI), o
 * medico nao deveria redigitar tudo. Este helper le essa historia e devolve um
 * objeto PARCIAL no formato que o AdmissionForm consome.
 *
 * CONTRATO DE TOLERANCIA: qualquer leitura e envolta em try/catch. Qualquer erro
 * (RLS, coluna ausente, JSON corrompido, internacao inexistente) resulta em um
 * objeto vazio ou parcial — NUNCA lanca. O seed e auxiliar; falhar nele jamais
 * pode quebrar a abertura da admissao. So inclui no retorno o que de fato existir.
 */
export interface AdmissionSeed {
  hda?: string;
  planItems?: string[];
  hypothesesItems?: string[];
  antecedentesItems?: string[];
  cidPrimary?: string;
  cidSecondary?: string;
  paSys?: string;
  paDia?: string;
  fc?: string;
  fr?: string;
  tax?: string;
  spo2?: string;
  glasgowEye?: number;
  glasgowVerbal?: number;
  glasgowMotor?: number;
  devices?: string;
  /** Dispositivos estruturados (soap.devices) — fonte compartilhada com a evolucao. */
  devicesStructured?: EvolutionDevice[];
  /** Resultado de culturas (soap.culturesHtml) — HTML rico. */
  culturesHtml?: string;
  /** Antibioticos em curso (soap.antibioticos) — HTML rico. */
  antibioticos?: string;
}

/** Texto limpo, ou "" se nao for string util. */
const asText = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** String multilinha -> array de linhas nao-vazias (conduta/hipotese). */
const splitLines = (v: unknown): string[] =>
  typeof v === "string"
    ? v.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];

/** Vital como string: aceita string ou number; descarta vazio/NaN. */
const asVital = (v: unknown): string => {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
};

/** Componente de Glasgow como number, ou undefined se ausente/invalido. */
const asGlasgow = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
};

export async function seedAdmissionFromHistory(internacaoId: string): Promise<AdmissionSeed> {
  const seed: AdmissionSeed = {};
  if (!internacaoId) return seed;

  try {
    // ── 1) internacoes: historia admissional + hipotese + conduta ────────────
    // historia_clinica guarda a HDA (historia admissional). queixa_principal e
    // fallback (so e usada se a historia estiver vazia). pendencias e lida por
    // completude do contrato, mas o AdmissionForm nao tem campo proprio para ela.
    try {
      const { data } = await supabase
        .from("internacoes")
        .select("historia_clinica, hipotese_diagnostica, conduta_inicial, pendencias, queixa_principal")
        .eq("id", internacaoId)
        .maybeSingle();
      if (data) {
        const hda = asText(data.historia_clinica) || asText(data.queixa_principal);
        if (hda) seed.hda = hda;
        const planItems = splitLines(data.conduta_inicial);
        if (planItems.length) seed.planItems = planItems;
        const hypothesesItems = splitLines(data.hipotese_diagnostica);
        if (hypothesesItems.length) seed.hypothesesItems = hypothesesItems;
      }
    } catch {
      /* leitura best-effort — ignora */
    }

    // ── 2) ultima evolucao: antecedentes, CID, vitais, Glasgow, dispositivos ──
    // soap guarda os campos degradados (prefixo __) alem de antecedentes/devices.
    try {
      const { data } = await supabase
        .from("evolucoes")
        .select("soap")
        .eq("internacao_id", internacaoId)
        .order("data_hora", { ascending: false })
        .limit(1)
        .maybeSingle();
      const soap = (data?.soap ?? null) as Record<string, unknown> | null;
      if (soap && typeof soap === "object") {
        // Antecedentes morbidos pessoais (array de strings).
        if (Array.isArray(soap.antecedentes)) {
          const ant = soap.antecedentes.map((s) => String(s).trim()).filter(Boolean);
          if (ant.length) seed.antecedentesItems = ant;
        }

        // CID primario/secundario (secundario pode ser string ou array).
        const cidPrimary = asText(soap.__cid_primary);
        if (cidPrimary) seed.cidPrimary = cidPrimary;
        const cidSecRaw = soap.__cid_secondary;
        const cidSecondary = Array.isArray(cidSecRaw)
          ? cidSecRaw.map((s) => String(s).trim()).filter(Boolean).join(", ")
          : asText(cidSecRaw);
        if (cidSecondary) seed.cidSecondary = cidSecondary;

        // Sinais vitais: PA "120/80" -> paSys/paDia; demais 1:1.
        const vs = soap.__vital_signs;
        if (vs && typeof vs === "object") {
          const v = vs as Record<string, unknown>;
          const pa = asVital(v.pa);
          if (pa.includes("/")) {
            const [sys, dia] = pa.split("/");
            if (sys?.trim()) seed.paSys = sys.trim();
            if (dia?.trim()) seed.paDia = dia.trim();
          } else if (pa) {
            seed.paSys = pa;
          }
          const fc = asVital(v.fc);
          if (fc) seed.fc = fc;
          const fr = asVital(v.fr);
          if (fr) seed.fr = fr;
          const tax = asVital(v.temp);
          if (tax) seed.tax = tax;
          const spo2 = asVital(v.spo2);
          if (spo2) seed.spo2 = spo2;

          const ovm = v.glasgow_ovm;
          if (ovm && typeof ovm === "object") {
            const g = ovm as Record<string, unknown>;
            const eye = asGlasgow(g.ocular);
            if (eye != null) seed.glasgowEye = eye;
            const verbal = asGlasgow(g.verbal);
            if (verbal != null) seed.glasgowVerbal = verbal;
            const motor = asGlasgow(g.motora);
            if (motor != null) seed.glasgowMotor = motor;
          }
        }

        // Dispositivos: a evolucao grava soap.devices (array estruturado). O campo
        // devices do AdmissionForm e texto livre, entao juntamos os rotulos. Como
        // fallback (admissao anterior), le soap.__uti_dispositivos.detalhe.
        const devs = soap.devices;
        if (Array.isArray(devs)) {
          // Estruturado: preserva o array inteiro (fonte compartilhada com a
          // DevicesCulturesSection da admissao) e, por compatibilidade, tambem
          // devolve os rotulos como texto no campo legado `devices`.
          const structured = devs.filter(
            (d): d is EvolutionDevice => !!d && typeof d === "object",
          );
          if (structured.length) seed.devicesStructured = structured;
          const labels = structured
            .map((d) => {
              const label = typeof d.label === "string" ? d.label : "";
              const detail = typeof d.detail === "string" ? d.detail : undefined;
              return label ? formatDeviceLabel({ label, detail }).trim() : "";
            })
            .filter(Boolean);
          if (labels.length) seed.devices = labels.join("\n");
        } else {
          const utiDisp = soap.__uti_dispositivos;
          if (utiDisp && typeof utiDisp === "object") {
            const det = asText((utiDisp as { detalhe?: unknown }).detalhe);
            if (det) seed.devices = det;
          }
        }

        // Culturas e antibioticos em curso — chaves compartilhadas com a evolucao.
        const cultures = asText(soap.culturesHtml);
        if (cultures) seed.culturesHtml = cultures;
        const atb = asText(soap.antibioticos);
        if (atb) seed.antibioticos = atb;
      }
    } catch {
      /* leitura best-effort — ignora */
    }
  } catch {
    /* blindagem final — nunca lanca */
  }

  return seed;
}
