import { supabase } from "@/integrations/supabase/client";
import { formatDeviceLabel, type EvolutionDevice } from "@/lib/devicesCatalog";
import { normalizeAdmissionSoap, parseMaybeJsonArray } from "@/lib/admissionSoapNormalizer";

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
  /** Exames complementares (lab) — separado da HDA ou de internacoes.exames_relevantes. */
  complementares?: string;
  /** Medicacoes de uso continuo (MUC). */
  muc?: string;
  /** Alergias. */
  allergies?: string;
  planItems?: string[];
  hypothesesItems?: string[];
  antecedentesItems?: string[];
  cidPrimary?: string;
  cidSecondary?: string;
  /** Rotulo cru da previsao de alta (ex.: "01/10/2026 (D+5)"). */
  dischargeLabel?: string;
  /** Peso (kg) e altura (m) da antropometria da admissao. */
  weight?: string;
  height?: string;
  /** Exame fisico por topico (coluna evolucoes.exame_fisico da admissao). */
  physGeneral?: string;
  physCv?: string;
  physResp?: string;
  physAbd?: string;
  physNeuro?: string;
  physExt?: string;
  physSkin?: string;
  physOther?: string;
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

/** Preenche sinais vitais a partir de soap.__vital_signs — so campos vazios. */
const fillVitals = (seed: AdmissionSeed, vs: unknown): void => {
  if (!vs || typeof vs !== "object") return;
  const v = vs as Record<string, unknown>;
  const pa = asVital(v.pa);
  if (pa.includes("/")) {
    const [sys, dia] = pa.split("/");
    if (sys?.trim() && !seed.paSys) seed.paSys = sys.trim();
    if (dia?.trim() && !seed.paDia) seed.paDia = dia.trim();
  } else if (pa && !seed.paSys) {
    seed.paSys = pa;
  }
  const fc = asVital(v.fc); if (fc && !seed.fc) seed.fc = fc;
  const fr = asVital(v.fr); if (fr && !seed.fr) seed.fr = fr;
  const tax = asVital(v.temp); if (tax && !seed.tax) seed.tax = tax;
  const spo2 = asVital(v.spo2); if (spo2 && !seed.spo2) seed.spo2 = spo2;
  const ovm = v.glasgow_ovm;
  if (ovm && typeof ovm === "object") {
    const g = ovm as Record<string, unknown>;
    const eye = asGlasgow(g.ocular); if (eye != null && seed.glasgowEye == null) seed.glasgowEye = eye;
    const verbal = asGlasgow(g.verbal); if (verbal != null && seed.glasgowVerbal == null) seed.glasgowVerbal = verbal;
    const motor = asGlasgow(g.motora); if (motor != null && seed.glasgowMotor == null) seed.glasgowMotor = motor;
  }
};

/** Preenche dispositivos/culturas/antibioticos a partir do soap — so vazios. */
const fillDevices = (seed: AdmissionSeed, soap: Record<string, unknown>): void => {
  const devs = soap.devices;
  if (Array.isArray(devs)) {
    const structured = devs.filter((d): d is EvolutionDevice => !!d && typeof d === "object");
    if (structured.length && !seed.devicesStructured) seed.devicesStructured = structured;
    const labels = structured
      .map((d) => {
        const label = typeof d.label === "string" ? d.label : "";
        const detail = typeof d.detail === "string" ? d.detail : undefined;
        return label ? formatDeviceLabel({ label, detail }).trim() : "";
      })
      .filter(Boolean);
    if (labels.length && !seed.devices) seed.devices = labels.join("\n");
  } else {
    const utiDisp = soap.__uti_dispositivos;
    if (utiDisp && typeof utiDisp === "object") {
      const det = asText((utiDisp as { detalhe?: unknown }).detalhe);
      if (det && !seed.devices) seed.devices = det;
    }
  }
  const cultures = asText(soap.culturesHtml);
  if (cultures && !seed.culturesHtml) seed.culturesHtml = cultures;
  const atb = asText(soap.antibioticos);
  if (atb && !seed.antibioticos) seed.antibioticos = atb;
};

/** Preenche CID e antecedentes a partir do soap — so campos vazios. */
const fillCidAntecedentes = (seed: AdmissionSeed, soap: Record<string, unknown>): void => {
  if (!seed.antecedentesItems?.length && Array.isArray(soap.antecedentes)) {
    const ant = soap.antecedentes.map((s) => String(s).trim()).filter(Boolean);
    if (ant.length) seed.antecedentesItems = ant;
  }
  if (!seed.cidPrimary) {
    const c = asText(soap.__cid_primary);
    if (c) seed.cidPrimary = c;
  }
  if (!seed.cidSecondary) {
    const raw = soap.__cid_secondary;
    const cs = Array.isArray(raw) ? raw.map((s) => String(s).trim()).filter(Boolean).join(", ") : asText(raw);
    if (cs) seed.cidSecondary = cs;
  }
};

export async function seedAdmissionFromHistory(internacaoId: string): Promise<AdmissionSeed> {
  const seed: AdmissionSeed = {};
  if (!internacaoId) return seed;

  try {
    // ── 0) Evolucao de ADMISSAO (D0) da internacao — FONTE PRIMARIA ───────────
    // A admissao (soap.__evolution_type === "admission", a mais antiga da
    // internacao) traz historia e estrutura CORRETAS, campo a campo. As colunas
    // de internacoes podem estar com dado ruim de recuperacao (ex.: historia_
    // clinica com antecedente, hipotese como JSON de array), entao a admissao vem
    // ANTES delas. O exame fisico esta na coluna propria evolucoes.exame_fisico.
    try {
      const { data } = await supabase
        .from("evolucoes")
        .select("soap, exame_fisico")
        .eq("internacao_id", internacaoId)
        .order("data_hora", { ascending: true })
        .limit(1)
        .maybeSingle();
      const soap = (data?.soap ?? null) as Record<string, unknown> | null;
      // Admissao = evolucao mais antiga marcada como "admission" OU, para dados
      // recuperados da sincronizacao com producao (que podem nao trazer o
      // marcador __evolution_type), a mais antiga que carregue uma HDA. Como e a
      // 1a evolucao da internacao, ela e a admissao (D0) de fato.
      const subjHasHda = /\bHDA\b/i.test(asText(soap?.subjective));
      if (soap && (soap.__evolution_type === "admission" || subjHasHda)) {
        const n = normalizeAdmissionSoap(soap);
        if (n.hda) seed.hda = n.hda;
        if (n.complementares) seed.complementares = n.complementares;
        if (n.muc) seed.muc = n.muc;
        if (n.allergies) seed.allergies = n.allergies;
        if (n.antecedentes.length) seed.antecedentesItems = n.antecedentes;
        if (n.hypotheses.length) seed.hypothesesItems = n.hypotheses;
        if (n.cidPrimary) seed.cidPrimary = n.cidPrimary;
        if (n.cidSecondary.length) seed.cidSecondary = n.cidSecondary.join(", ");
        if (n.planItems.length) seed.planItems = n.planItems;
        if (n.dischargeLabel) seed.dischargeLabel = n.dischargeLabel;
        if (n.weight) seed.weight = n.weight;
        if (n.height) seed.height = n.height;
        // Exame fisico por topico (coluna dedicada, nao fica no soap).
        const ef = (data as { exame_fisico?: unknown } | null)?.exame_fisico;
        if (ef && typeof ef === "object") {
          const e = ef as Record<string, unknown>;
          const g = asText(e.general); if (g) seed.physGeneral = g;
          const cv = asText(e.cardiovascular); if (cv) seed.physCv = cv;
          const rp = asText(e.respiratory); if (rp) seed.physResp = rp;
          const ab = asText(e.abdomen); if (ab) seed.physAbd = ab;
          const ne = asText(e.neurological); if (ne) seed.physNeuro = ne;
          const ex = asText(e.extremities); if (ex) seed.physExt = ex;
          const sk = asText(e.skin); if (sk) seed.physSkin = sk;
          const ot = asText(e.other); if (ot) seed.physOther = ot;
        }
      }
    } catch {
      /* leitura best-effort — ignora */
    }

    // ── 1) internacoes: fallback de HDA/plano/hipotese/complementares ─────────
    // So preenche o que a admissao (bloco 0) NAO trouxe. historia_clinica/queixa
    // (HDA), exames_relevantes (complementares), conduta_inicial (plano),
    // hipotese_diagnostica (tolera JSON de array numa string).
    try {
      const { data } = await supabase
        .from("internacoes")
        .select("historia_clinica, hipotese_diagnostica, conduta_inicial, queixa_principal, exames_relevantes")
        .eq("id", internacaoId)
        .maybeSingle();
      if (data) {
        if (!seed.hda) {
          const hda = asText(data.historia_clinica) || asText(data.queixa_principal);
          if (hda) seed.hda = hda;
        }
        if (!seed.complementares) {
          const c = asText(data.exames_relevantes);
          if (c) seed.complementares = c;
        }
        if (!seed.planItems?.length) {
          const p = splitLines(data.conduta_inicial);
          if (p.length) seed.planItems = p;
        }
        if (!seed.hypothesesItems?.length) {
          const h = asText(data.hipotese_diagnostica);
          const arr = h ? (parseMaybeJsonArray(h) ?? splitLines(h)) : [];
          if (arr.length) seed.hypothesesItems = arr;
        }
      }
    } catch {
      /* leitura best-effort — ignora */
    }

    // ── 1b) Fallback da HDA a partir da evolucao D0 (qualquer tipo) ───────────
    // Recuperados sem admissao estruturada: a historia pode estar so no soap da
    // D0 (topico "Evolucao"). O normalizador separa a HDA (de AMP/MUC/Alergias/
    // Evolucao medica) e lida com soap em HTML.
    if (!seed.hda) {
      try {
        const { data } = await supabase
          .from("evolucoes")
          .select("soap")
          .eq("internacao_id", internacaoId)
          .order("data_hora", { ascending: true })
          .limit(1)
          .maybeSingle();
        const soap = (data?.soap ?? null) as Record<string, unknown> | null;
        if (soap) {
          const hda = normalizeAdmissionSoap(soap).hda;
          if (hda) seed.hda = hda;
        }
      } catch {
        /* leitura best-effort — ignora */
      }
    }

    // ── 2) ultima evolucao: estado ATUAL (dispositivos/culturas/vitais) e, como
    //       fallback, CID/antecedentes. So preenche o que ainda estiver vazio. ──
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
        fillCidAntecedentes(seed, soap);
        fillVitals(seed, soap.__vital_signs);
        fillDevices(seed, soap);
      }
    } catch {
      /* leitura best-effort — ignora */
    }
  } catch {
    /* blindagem final — nunca lanca */
  }

  return seed;
}
