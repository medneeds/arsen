/**
 * Anotacoes de enfermagem — frases clicaveis do tecnico, intercorrencia,
 * evolucao do enfermeiro e SBAR de passagem. Puro: monta o conteudo (jsonb) e
 * o texto final (texto_gerado) que vai para a tela e para os PDFs.
 * Campo vazio vira "—"; sexo nunca e presumido (texto impessoal: "Paciente").
 */
import { FUGULIN_CATEGORIAS, type FugulinCategoria } from "./fugulin.ts";
import { RISCO_BRADEN_LABEL, RISCO_MORSE_LABEL, type RiscoBraden, type RiscoMorse } from "./escalasEnfermagem.ts";

const limpa = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const fimPonto = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
const traco = (s: string | null | undefined) => limpa(s) || "—";

// ── Anotacao do tecnico ─────────────────────────────────────────────────────
export const FRASES_TECNICO: readonly { grupo: string; frases: readonly string[] }[] = [
  { grupo: "Estado geral", frases: ["Paciente consciente e orientado", "Paciente sonolento, despertando ao chamado", "Paciente sedado", "Paciente agitado", "Paciente calmo, sem queixas", "Paciente queixa-se de dor"] },
  { grupo: "Higiene e conforto", frases: ["Realizado banho no leito", "Realizada higiene oral", "Realizada higiene íntima", "Realizada troca de roupa de cama", "Realizada mudança de decúbito", "Mantida cabeceira elevada a 30–45°"] },
  { grupo: "Alimentação", frases: ["Aceitou bem a dieta oferecida", "Aceitou parcialmente a dieta", "Recusou a dieta", "Dieta enteral em curso, sem intercorrências", "Dieta enteral pausada"] },
  { grupo: "Eliminações", frases: ["Diurese espontânea", "Diurese por sonda vesical de demora", "Evacuação presente", "Sem evacuação no período"] },
  { grupo: "Dispositivos", frases: ["Acesso venoso periférico pérvio, sem sinais flogísticos", "Acesso venoso central pérvio, curativo íntegro", "Sonda enteral fixada e pérvia", "Sonda vesical fixada e drenando", "Dreno pérvio"] },
  { grupo: "Procedimentos", frases: ["Aferidos sinais vitais", "Realizado HGT", "Realizado curativo", "Encaminhado para exame", "Retornou de exame"] },
];

export interface ConteudoAnotacaoTecnico { frases: string[]; livre: string }

export function montarAnotacaoTecnico(c: ConteudoAnotacaoTecnico): string {
  const partes = [...c.frases.map(limpa).filter(Boolean), limpa(c.livre)].filter(Boolean);
  return partes.map(fimPonto).join(" ");
}

// ── Intercorrencia ──────────────────────────────────────────────────────────
export const TIPOS_INTERCORRENCIA = [
  "Queda", "Perda de dispositivo (acesso, sonda, dreno)", "Extubação acidental", "Piora clínica / alteração de sinais vitais",
  "Dor intensa", "Agitação / risco de autolesão", "Reação a medicamento ou hemoderivado", "Sangramento", "Vômito / broncoaspiração", "Outra",
] as const;

export interface ConteudoIntercorrencia { tipo: string; descricao: string; condutaImediata: string; medicoComunicado: boolean }

export function validarIntercorrencia(c: ConteudoIntercorrencia): string[] {
  const e: string[] = [];
  if (!limpa(c.tipo)) e.push("informe o tipo");
  if (limpa(c.descricao).length < 5) e.push("descreva o que aconteceu");
  return e;
}

export function montarIntercorrencia(c: ConteudoIntercorrencia): string {
  return [
    `Intercorrência: ${limpa(c.tipo)}.`,
    fimPonto(limpa(c.descricao)),
    limpa(c.condutaImediata) ? `Conduta imediata: ${fimPonto(limpa(c.condutaImediata))}` : "",
    c.medicoComunicado ? "Médico plantonista comunicado." : "",
  ].filter(Boolean).join(" ");
}

// ── Evolucao do enfermeiro ──────────────────────────────────────────────────
export const SISTEMAS_EXAME = [
  { key: "neurologico", label: "Neurológico" },
  { key: "respiratorio", label: "Respiratório" },
  { key: "cardiovascular", label: "Cardiovascular" },
  { key: "gastrointestinal", label: "Gastrointestinal / nutrição" },
  { key: "geniturinario", label: "Geniturinário / eliminações" },
  { key: "pele", label: "Pele e mucosas" },
  { key: "dispositivos", label: "Dispositivos / acessos" },
] as const;
export type SistemaKey = (typeof SISTEMAS_EXAME)[number]["key"];

export interface EscalaResumo<R extends string> { escore: number; risco: R }

export interface ConteudoEvolucao {
  sistemas: Partial<Record<SistemaKey, string>>;
  fugulin: { escore: number; categoria: FugulinCategoria } | null;
  braden: EscalaResumo<RiscoBraden> | null;
  morse: EscalaResumo<RiscoMorse> | null;
  /** SAE: diagnosticos de enfermagem (NANDA, texto) e intervencoes */
  diagnosticos: string;
  intervencoes: string;
  /** NEWS2 / BH no momento da evolucao (texto ja formatado pela tela) */
  contexto: string[];
  /** anotacoes e intercorrencias do turno lidas pelo enfermeiro (texto) */
  anotacoesTurno: string[];
  observacoes: string;
}

export interface SecaoTexto { titulo: string; linhas: string[] }

export function secoesEvolucao(c: ConteudoEvolucao): SecaoTexto[] {
  const exame = SISTEMAS_EXAME.map((s) => `${s.label}: ${traco(c.sistemas[s.key])}`);
  const escalas = [
    c.fugulin ? `Fugulin ${c.fugulin.escore} — ${FUGULIN_CATEGORIAS[c.fugulin.categoria].label}` : "Fugulin: —",
    c.braden ? `Braden ${c.braden.escore} — ${RISCO_BRADEN_LABEL[c.braden.risco]}` : "Braden: —",
    c.morse ? `Morse ${c.morse.escore} — ${RISCO_MORSE_LABEL[c.morse.risco]}` : "Morse: —",
  ];
  const out: SecaoTexto[] = [];
  if (c.contexto.length) out.push({ titulo: "Dados do período", linhas: c.contexto });
  out.push({ titulo: "Exame físico por sistemas", linhas: exame });
  out.push({ titulo: "Escalas", linhas: escalas });
  out.push({ titulo: "Diagnósticos de enfermagem (SAE)", linhas: [traco(c.diagnosticos)] });
  out.push({ titulo: "Intervenções / prescrição de cuidados", linhas: [traco(c.intervencoes)] });
  if (c.anotacoesTurno.length) out.push({ titulo: "Anotações e intercorrências do turno", linhas: c.anotacoesTurno });
  if (limpa(c.observacoes)) out.push({ titulo: "Observações", linhas: [limpa(c.observacoes)] });
  return out;
}

export function montarEvolucao(c: ConteudoEvolucao): string {
  return secoesEvolucao(c).map((s) => `${s.titulo.toUpperCase()}: ${s.linhas.join("; ")}`).join("\n");
}

/** Evolucao minima: ao menos um sistema descrito ou um diagnostico de enfermagem. */
export function validarEvolucao(c: ConteudoEvolucao): string[] {
  const temExame = Object.values(c.sistemas).some((v) => limpa(v).length > 0);
  return temExame || limpa(c.diagnosticos) ? [] : ["descreva ao menos um sistema ou um diagnóstico de enfermagem"];
}

// ── SBAR de passagem ────────────────────────────────────────────────────────
export interface SbarLeitoInput {
  leito: string;
  paciente: string;
  idade?: string | null;
  diasInternacao?: number | null;
  diagnosticos: string[];
  precaucao?: string | null;
  paliativo?: boolean;
  alergias?: string | null;
  news2Texto?: string | null;
  news2Alerta?: boolean;
  ssvvTexto?: string | null;
  bhTurnoTexto?: string | null;
  fugulinTexto?: string | null;
  intercorrencias: string[];
  pendencias: string[];
  recomendacao?: string;
}

export interface SbarLeito { leito: string; paciente: string; s: string[]; b: string[]; a: string[]; r: string[]; alerta: boolean }

export function montarSbarLeito(i: SbarLeitoInput): SbarLeito {
  const s = [
    i.news2Texto ? `${i.news2Texto}${i.news2Alerta ? " — em alerta" : ""}` : "Sem SSVV registrado",
    ...i.intercorrencias.map((x) => `Intercorrência: ${x}`),
  ];
  const b = [
    `Diagnóstico: ${i.diagnosticos.length ? i.diagnosticos.join("; ") : "—"}`,
    `${i.idade ? `${i.idade} · ` : ""}${i.diasInternacao != null ? `D${i.diasInternacao} de internação` : "internação —"}`,
    i.precaucao ? `Precaução: ${i.precaucao}` : "",
    i.paliativo ? "Em cuidados paliativos" : "",
    i.alergias ? `Alergias: ${i.alergias}` : "",
  ].filter(Boolean);
  const a = [
    i.ssvvTexto ? `Último SSVV: ${i.ssvvTexto}` : "",
    i.bhTurnoTexto ? `BH do turno: ${i.bhTurnoTexto}` : "",
    i.fugulinTexto ? `Fugulin: ${i.fugulinTexto}` : "Fugulin: —",
  ].filter(Boolean);
  const r = [...i.pendencias, ...(limpa(i.recomendacao) ? [limpa(i.recomendacao as string)] : [])];
  return { leito: i.leito, paciente: i.paciente, s, b, a, r: r.length ? r : ["Sem pendências registradas"], alerta: !!i.news2Alerta || i.intercorrencias.length > 0 };
}

/**
 * Diagnosticos legiveis da internacao. Ha registros antigos com a lista gravada
 * como texto JSON ('["A","B"]' ou '[]') dentro do array — le como lista.
 */
export function diagnosticosLegiveis(diagnoses: readonly unknown[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of diagnoses ?? []) {
    const t = String(raw ?? "").trim();
    if (!t) continue;
    if (t.startsWith("[")) {
      try {
        const arr = JSON.parse(t);
        if (Array.isArray(arr)) { arr.map((x) => String(x ?? "").trim()).filter(Boolean).forEach((x) => out.push(x)); continue; }
      } catch { /* nao era JSON: usa o texto */ }
    }
    out.push(t);
  }
  return [...new Set(out)];
}
