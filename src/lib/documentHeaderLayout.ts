/**
 * Cabecalho padronizado dos impressos — LAYOUT (puro, sem I/O).
 *
 * Um unico mecanismo para todos os documentos, com dois modelos de
 * identificacao do paciente:
 *
 *  - "assistencial": documentos de cuidado (prescricao, evolucao, admissao,
 *    ATM...). Traz Peso, Adm. no setor e ALERGIAS.
 *  - "documental": documentos burocraticos (atestado, relatorio, receituario,
 *    alta...). Sem alergias e sem peso; traz CPF, CNS, telefone e endereco
 *    quando existirem.
 *  - "semPaciente": documentos agregados (censo, dashboard, mapas). So o
 *    timbrado + faixa com o nome do documento, sem grade de paciente.
 *
 * Este modulo decide QUAIS celulas existem e em que ordem; os renderizadores
 * (HTML string e React) so desenham o que sai daqui, para o papel e a tela
 * nunca divergirem.
 *
 * Regras de preenchimento:
 *  - campos clinicos/assistenciais fixos do modelo sempre aparecem; vazio vira "—"
 *    (a ausencia precisa ser visivel);
 *  - dados de cadastro opcionais (nome da mae, CPF, CNS, telefone, endereco),
 *    nome social e linhas extras so aparecem quando preenchidos;
 *  - sexo nunca e assumido: M/MASCULINO e F/FEMININO viram por extenso; qualquer
 *    outro valor sai exatamente como esta no cadastro; vazio vira "—".
 */
import { isSemAlergia } from "./allergyStatus.ts";

export type HeaderModel = "assistencial" | "documental" | "semPaciente";

/** Valores ja formatados para exibicao (datas em dd/mm/aaaa). */
export interface HeaderPatient {
  name?: string | null;
  socialName?: string | null;
  bed?: string | null;
  /** Setor ja com o rotulo de exibicao. */
  sector?: string | null;
  record?: string | null;
  atendimento?: string | null;
  birthDate?: string | null;
  age?: string | null;
  sex?: string | null;
  weight?: string | null;
  /** Data de admissao no setor (dd/mm/aaaa). */
  sectorAdmission?: string | null;
  allergies?: string | null;
  motherName?: string | null;
  cpf?: string | null;
  cns?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface HeaderInput {
  model: HeaderModel;
  /** Nome do documento (vai na faixa azul). */
  title: string;
  /** Texto pequeno a direita da faixa (ex.: "Afastamento de 3 dias"). */
  complement?: string | null;
  /** Data/hora de emissao ja formatada. */
  emission: string;
  patient?: HeaderPatient | null;
  /**
   * Modelo assistencial que tambem mostra CPF, CNS, telefone e endereco (quando
   * existirem) — usado na admissao, que e o documento de cadastro clinico.
   * O modelo documental sempre os mostra.
   */
  includeRegistry?: boolean;
  /**
   * Grade enxuta do modelo assistencial (folhas que precisam caber em uma pagina,
   * ex.: Round): Paciente/Leito/Prontuario + Idade/Setor/Atendimento/Alergias.
   */
  dense?: boolean;
  /** Dados proprios do documento (CID, Caracter, Solicitante...). So entram se tiverem valor (ou se o 3o item for true). */
  extras?: Array<[label: string, value: string | null | undefined, always?: boolean]>;
}

export type CellTone = "default" | "allergyOk" | "allergyAlert";

export interface HeaderCell {
  label: string;
  value: string;
  /** Quantas colunas de valor ocupa (cada linha tem 8 colunas: 4 pares). */
  span?: number;
  strong?: boolean;
  /** Segunda linha pequena dentro da celula (nome social). */
  sub?: string;
  tone?: CellTone;
  /** Rotulo em vermelho (ALERGIAS). */
  alertLabel?: boolean;
}

export type HeaderRow = HeaderCell[];

export interface HeaderLayout {
  model: HeaderModel;
  title: string;
  complement: string;
  emission: string;
  rows: HeaderRow[];
}

const clean = (v: string | null | undefined): string => (v ?? "").toString().trim();
const dash = (v: string | null | undefined): string => clean(v) || "—";

/** Sexo por extenso, sem nunca assumir um valor (bug de agosto/2026). */
export function formatSexLabel(sex: string | null | undefined): string {
  const raw = clean(sex);
  if (!raw) return "—";
  const v = raw.toUpperCase();
  if (v === "M" || v === "MASCULINO") return "Masculino";
  if (v === "F" || v === "FEMININO") return "Feminino";
  return raw;
}

/** Numero de atendimento sem o "#" inicial. */
export function formatAtendimento(a: string | null | undefined): string {
  return clean(a).replace(/^#+\s*/, "");
}

const SEM_RELATO = "Sem relato";

/** Agrupa em linhas de ate 4 pares (rotulo + valor), preservando a ordem. */
function packPairs(cells: HeaderCell[]): HeaderRow[] {
  const rows: HeaderRow[] = [];
  for (let i = 0; i < cells.length; i += 4) {
    const row = cells.slice(i, i + 4).map((c) => ({ ...c }));
    // Linha incompleta: o ultimo valor ocupa as colunas que sobraram.
    if (row.length < 4) {
      const last = row[row.length - 1];
      last.span = (last.span ?? 1) + (4 - row.length) * 2;
    }
    rows.push(row);
  }
  return rows;
}

export function buildHeaderLayout(input: HeaderInput): HeaderLayout {
  const base = {
    model: input.model,
    title: clean(input.title),
    complement: clean(input.complement),
    emission: clean(input.emission),
  };
  if (input.model === "semPaciente" || !input.patient) return { ...base, rows: [] };

  const p = input.patient;
  const rows: HeaderRow[] = [];

  // Linha 1: Paciente (3 colunas de valor) + Leito + Prontuario = 8 colunas.
  rows.push([
    { label: "Paciente", value: dash(p.name), span: 3, strong: true, sub: clean(p.socialName) ? `Nome social: ${clean(p.socialName)}` : undefined },
    { label: "Leito", value: dash(p.bed), strong: true },
    { label: "Prontuário", value: dash(p.record), strong: true },
  ]);

  if (input.model === "assistencial" && input.dense) {
    const allergy = clean(p.allergies) || SEM_RELATO;
    rows.push(
      ...packPairs([
        { label: "Idade", value: dash(p.age) },
        { label: "Setor", value: dash(p.sector) },
        { label: "Atendimento", value: dash(formatAtendimento(p.atendimento)) },
        { label: "Alergias", value: allergy, alertLabel: true, tone: isSemAlergia(allergy) ? "allergyOk" : "allergyAlert", strong: true },
      ]),
    );
  } else if (input.model === "assistencial") {
    const allergy = clean(p.allergies) || SEM_RELATO;
    rows.push(
      ...packPairs([
        { label: "Idade", value: dash(p.age) },
        { label: "Peso", value: dash(p.weight) },
        { label: "Setor", value: dash(p.sector) },
        { label: "Adm. no setor", value: dash(p.sectorAdmission) },
        { label: "Nascimento", value: dash(p.birthDate) },
        { label: "Sexo", value: formatSexLabel(p.sex) },
        { label: "Atendimento", value: dash(formatAtendimento(p.atendimento)) },
        { label: "Alergias", value: allergy, alertLabel: true, tone: isSemAlergia(allergy) ? "allergyOk" : "allergyAlert", strong: true },
      ]),
    );
  } else {
    const pairs: HeaderCell[] = [
      { label: "Idade", value: dash(p.age) },
      { label: "Sexo", value: formatSexLabel(p.sex) },
      { label: "Setor", value: dash(p.sector) },
      { label: "Atendimento", value: dash(formatAtendimento(p.atendimento)) },
      { label: "Nascimento", value: dash(p.birthDate) },
    ];
    if (clean(p.cpf)) pairs.push({ label: "CPF", value: clean(p.cpf) });
    if (clean(p.cns)) pairs.push({ label: "CNS", value: clean(p.cns) });
    if (clean(p.phone)) pairs.push({ label: "Telefone", value: clean(p.phone) });
    rows.push(...packPairs(pairs));
  }

  // Linhas de largura total, so quando preenchidas.
  if (clean(p.motherName)) rows.push([{ label: "Nome da mãe", value: clean(p.motherName), span: 7 }]);
  if (input.model === "assistencial" && input.includeRegistry) {
    const reg: HeaderCell[] = [];
    if (clean(p.cpf)) reg.push({ label: "CPF", value: clean(p.cpf) });
    if (clean(p.cns)) reg.push({ label: "CNS", value: clean(p.cns) });
    if (clean(p.phone)) reg.push({ label: "Telefone", value: clean(p.phone) });
    rows.push(...packPairs(reg));
  }
  if ((input.model === "documental" || input.includeRegistry) && clean(p.address)) rows.push([{ label: "Endereço", value: clean(p.address), span: 7 }]);
  // Linha extra so com valor; com `always` a linha existe mesmo vazia (campo a preencher a mao).
  for (const [label, value, always] of input.extras ?? []) {
    if (clean(value) || always) rows.push([{ label: clean(label), value: clean(value), span: 7 }]);
  }

  return { ...base, rows };
}
