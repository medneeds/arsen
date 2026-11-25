/**
 * Geração de PDF Norma Zero para uma evolução clínica ou intercorrência.
 * Reutilizável a partir do EvolutionForm e da Timeline.
 *
 * Layout unificado: Subjetivo + Avaliação aparecem como uma única seção "Evolução".
 * Para registros antigos, concatenamos os dois campos com um separador suave.
 */
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { buildNormaZeroDocument, buildStandardHeaderHtml, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";
import { resolveHeaderPatient } from "@/lib/headerPatient";
import { withTimeout } from "@/lib/resolvePatientHeader";
import type { HeaderInput } from "@/lib/documentHeaderLayout";
import { supabase } from "@/integrations/supabase/client";
import { toRichHtml, richHtmlToPlainText } from "@/components/ui/rich-text-editor";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { formatDeviceLabel, deviceAlertTone } from "@/lib/devicesCatalog";
import { calcDIH, parseAdmissionDate } from "@/lib/dihCalc";
import type { EvolutionRecord } from "@/hooks/useEvolutions";
import {
  diagnosticContextLines,
  fromInternacaoRow,
  resolveDiagnosticContextForDisplay,
  hasActivePrecaution,
  toHypothesesList,
  type InternacaoDiagRow,
  type PatientDiagnosticContext,
} from "@/lib/internacaoDiagnosticContext";

/** Renderiza HTML rico (sanitizado) preservando formatação dos campos editáveis. */
const renderRich = (value: string | null | undefined): string => {
  const html = toRichHtml(value);
  return richHtmlToPlainText(html) ? html : "<em>—</em>";
};

const EXAM_LABELS: { key: keyof EvolutionRecord["physical_exam"]; label: string }[] = [
  { key: "general", label: "Geral" },
  { key: "cardiovascular", label: "Cardiovascular" },
  { key: "respiratory", label: "Respiratório" },
  { key: "abdomen", label: "Abdome" },
  { key: "neurological", label: "Neurológico" },
  { key: "extremities", label: "Extremidades" },
  { key: "skin", label: "Pele" },
  { key: "other", label: "Outros" },
];

const escape = (s: string) =>
  (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

/**
 * format date-fns seguro: data nula/invalida devolve `fallback` em vez de lancar
 * RangeError "Invalid time value" (que fazia o botao de impressao falhar sem gerar
 * o PDF quando created_at/validated_at vinham vazios ou nao parseaveis).
 */
const fmtSafe = (v: unknown, pattern: string, fallback = "—"): string => {
  if (!v) return fallback;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? fallback : format(d, pattern, { locale: ptBR });
};

// Classifica o tipo de evolução complementar para o PDF
const getEvolutionType = (evo: EvolutionRecord): "normal" | "intercurrence" | "vespertina" | "noturna" => {
  const t = (evo.soap_data as any)?.type ?? (evo as any).evolution_type;
  if (t === "intercurrence") return "intercurrence";
  if (t === "vespertina") return "vespertina";
  if (t === "noturna") return "noturna";
  return "normal";
};

// Retorna true apenas para intercorrência real (não vespertina/noturna)
const isIntercurrence = (evo: EvolutionRecord) =>
  getEvolutionType(evo) === "intercurrence";

export interface PrintEvolutionContext {
  patientName?: string;
  patientBed?: string;
  patientSector?: string;
  patientRecord?: string;
  /** Código de Atendimento (12 dígitos) — opcional */
  patientAtendimento?: string;
  /** Nome social — opcional */
  patientSocialName?: string;
  /** CPF — opcional */
  patientCpf?: string;
  /** CNS — opcional */
  patientCns?: string;
  /** Data de nascimento — formato DD/MM/AAAA */
  patientBirthDate?: string;
  cidPrimary?: string;
  cidSecondary?: string;
}

export const printEvolution = async (
  evo: EvolutionRecord,
  ctx?: PrintEvolutionContext,
  preOpenedWindow?: Window | null
) => {
  const intercurrence = isIntercurrence(evo);

  // 🔒 Usar janela pré-aberta pelo caller (antes de qualquer await).
  // Se não fornecida, tentar abrir aqui (pode ser bloqueado por popup blocker
  // se chamado após awaits no caller).
  const printWin = preOpenedWindow ?? window.open("", "_blank", "width=1024,height=768");
  if (printWin && !preOpenedWindow) {
    printWin.document.write(
      `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#475569">${
        intercurrence ? "Preparando intercorrência…" : "Preparando evolução…"
      }</body></html>`
    );
  }

  // Blindagem: qualquer falha/lentidao na geracao escreve uma pagina de erro na
  // janela (em vez de deixar o splash "Preparando..." eterno) e registra o erro
  // no console. Os await de rede abaixo tem teto de tempo (withTimeout) para nao
  // pendurar; o impresso sai com os dados que a tela ja tinha.
  try {
  const logo = await withTimeout(prepareLogo(), 6000, "");

  const validatedAt = fmtSafe(evo.validated_at, "dd/MM/yyyy 'às' HH:mm", "") || null;

  // Nome impresso (com nome social, se houver)
  const baseName = ctx?.patientName || evo.patient_name || "—";
  const fullName = ctx?.patientSocialName
    ? `${baseName} (NOME SOCIAL: ${ctx.patientSocialName})`
    : baseName;

  const doctorName = evo.validated_by_name || evo.created_by_name || "Médico Assistente";

  const SEP = `<span style="color:#94a3b8;margin:0 3pt">|</span>`;
  const F = (label: string, value: string) =>
    `<span style="font-weight:600">${label}</span>&nbsp;${value}`;

  // Formatar data de nascimento para padrão brasileiro DD/MM/YYYY
  const formatBirthDateBR = (d: string | undefined | null): string => {
    if (!d) return "—";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d.trim());
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return d;
  };
  // birthDisplay: prefer ctx.patientBirthDate (do registry); fallback preenchido
  // após a busca do patients (que inclui birth_date) — ver abaixo.
  let birthDisplay = formatBirthDateBR(ctx?.patientBirthDate);

  // ─── Buscar dados do paciente ANTES de montar o patientHeader ──────
  let patientAntecedentes: string[] = [];
  let patientAllergies: string = "—";
  let patientAge: string | null = null;
  // Data de admissao NO SETOR (data_admissao_uti; fallback data_entrada).
  let sectorAdmDate: string | null = null;

  // Declarado aqui (antes do uso) para evitar TDZ no bloco de fetch acima.
  const soapAntecedentes: string[] = Array.isArray((evo.soap_data as any)?.antecedentes)
    ? (evo.soap_data as any).antecedentes.filter(Boolean)
    : [];



  if ((evo as any).patient_id) {
    try {
      // MIGRAÇÃO: patients → internacoes + join pacientes. `patient_id` do
      // EvolutionRecord é internacoes.id. medical_history→pacientes.comorbidades,
      // uti_allergies→pacientes.alergias, birth_date→pacientes.data_nascimento.
      // DEGRADADO: coluna `age` não existe em pacientes → idade só via data_nascimento.
      const { data: iRow } = await withTimeout(
        (async () => {
          const r = await supabase
            .from("internacoes")
            .select("data_admissao_uti, data_entrada, paciente:pacientes(comorbidades, alergias, data_nascimento)")
            .eq("id", (evo as any).patient_id)
            .maybeSingle();
          return { data: r.data };
        })(),
        5000,
        { data: null },
      );

      const ir = iRow as { data_admissao_uti?: string | null; data_entrada?: string | null } | null;
      sectorAdmDate = ir?.data_admissao_uti || ir?.data_entrada || null;
      const pRow = (iRow as any)?.paciente ?? null;
      if (pRow) {
        if (soapAntecedentes.length === 0 && pRow.comorbidades?.trim()) {
          patientAntecedentes = pRow.comorbidades.split("\n").filter(Boolean);
        }
        patientAllergies = pRow.alergias?.trim()
          ? pRow.alergias.replace(/\n/g, " • ")
          : "SEM ALERGIAS CONHECIDAS";
        if (pRow.data_nascimento) {
          // Usar data_nascimento como fallback para birthDisplay
          if (!birthDisplay || birthDisplay === "—") {
            birthDisplay = formatBirthDateBR(pRow.data_nascimento);
          }
          // Calcular idade
          const bd = new Date(pRow.data_nascimento);
          const today = new Date();
          let age = today.getFullYear() - bd.getFullYear();
          const m = today.getMonth() - bd.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
          patientAge = `${age} anos`;
        }
      }
    } catch { /* falha silenciosa */ }
  }

  // Identificacao do paciente: cabecalho padronizado (modelo assistencial). Os dados
  // que esta funcao ja buscou valem mais; o resto (sexo, peso, mae...) vem do cadastro.
  const noAllergy = patientAllergies === "—" || patientAllergies === "SEM ALERGIAS CONHECIDAS";
  const headerBase = {
    name: baseName.toUpperCase(),
    socialName: ctx?.patientSocialName,
    bed: ctx?.patientBed || evo.patient_bed,
    sector: getSectorDisplayLabel(ctx?.patientSector || evo.patient_sector) || undefined,
    record: ctx?.patientRecord,
    atendimento: ctx?.patientAtendimento,
    birthDate: birthDisplay === "—" ? undefined : birthDisplay,
    age: patientAge ?? undefined,
    sectorAdmission: sectorAdmDate ? formatBirthDateBR(sectorAdmDate) : undefined,
    allergies: noAllergy ? undefined : patientAllergies,
  };
  // Teto de tempo: se a resolucao de identidade pendurar, usa o cabecalho base
  // (dados da tela) em vez de prender a janela no splash.
  const headerPatient = await withTimeout(resolveHeaderPatient(evo.patient_id, headerBase), 7000, headerBase);

  // ─── Buscar dados do paciente ANTES de montar o patientHeader ──────
  
  const hypothesesText = (evo as any).diagnostic_hypotheses?.toString().trim() || "";
  // CID: prefere o SNAPSHOT da evolucao (soap.__cid_*) quando presente — reflete o CID
  // daquela evolucao, inclusive edicoes por evolucao; fallback ao nivel paciente (ctx).
  const snapCid = ((evo as { soap_data?: { __cid_primary?: unknown; __cid_secondary?: unknown } }).soap_data) ?? {};
  // __cid_* pode vir STRING (uma evolucao normal) ou ARRAY (CID secundario
  // multiplo — como a admissao/D0 grava). Coagir ANTES do .trim(): sem isso,
  // (array).trim() lanca "trim is not a function" e a geracao do PDF falhava
  // em silencio (janela presa no splash "Preparando evolucao..."). Atingia toda
  // evolucao duplicada a partir de admissao.
  const cidToStr = (v: unknown): string =>
    typeof v === "string" ? v
    : Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : String(x ?? ""))).filter(Boolean).join("; ")
    : v == null ? "" : String(v);
  const cidPrimary = cidToStr(snapCid.__cid_primary).trim() || cidToStr(ctx?.cidPrimary).trim() || "";
  const cidSecondary = cidToStr(snapCid.__cid_secondary).trim() || cidToStr(ctx?.cidSecondary).trim() || "";
  // Previsoes de alta (UTI/UCI e hospitalar), precaucao e paliativo — junto do CID.
  // Validada: SO o snapshot da assinatura (soap.__diag_ctx), nunca o valor de hoje.
  // Rascunho: valor vivo da internacao (mesma fonte do mapa de leitos).
  let liveDiag: PatientDiagnosticContext | null = null;
  if (evo.status !== "validated" && evo.patient_id) {
    try {
      const interRow = await withTimeout<InternacaoDiagRow | null>(
        supabase
          .from("internacoes")
          .select("previsao_alta, previsao_alta_hospitalar, paliativo, precaucao_isolamento")
          .eq("id", evo.patient_id)
          .maybeSingle()
          .then((r) => (r.data as InternacaoDiagRow | null) ?? null),
        5000,
        null,
      );
      liveDiag = interRow ? fromInternacaoRow(interRow) : null;
    } catch { /* best-effort: imprime sem o bloco vivo */ }
  }
  const diagLines = diagnosticContextLines(
    resolveDiagnosticContextForDisplay(evo.status === "validated", evo.soap_data, liveDiag),
  );
  // ── Diagnosticos (compacto): CID 1/2 em tabela + UMA linha de caixas com as
  // previsoes de alta (por extenso: nao confundir com a alta efetiva), precaucao
  // e paliativo. Precaucao so ganha destaque quando VIGENTE ("Sem precaução" nao).
  const situShort: Record<string, string> = {
    "Precaução / Isolamento": "Precaução",
    "Cuidados paliativos": "Paliativo",
  };
  const situWidth = (label: string) =>
    label.startsWith("Previsão") ? "1.3fr" : label.startsWith("Precaução") ? "1fr" : ".7fr";
  const situHtml = diagLines.length > 0
    ? `<div class="ev-situ" style="grid-template-columns:${diagLines.map((l) => situWidth(l.label)).join(" ")}">${diagLines
        .map((l) => {
          const warn = l.label.startsWith("Precaução") && hasActivePrecaution(l.value) ? " ev-warn" : "";
          return `<div class="ev-kv${warn}"><span>${escape(situShort[l.label] ?? l.label)}</span><b>${escape(l.value)}</b></div>`;
        })
        .join("")}</div>`
    : "";
  const hasDiagnostics = cidPrimary || cidSecondary || diagLines.length > 0;
  const diagnosticsHtml = hasDiagnostics
    ? `
      <h2 class="nz-section">Diagnósticos</h2>
      ${cidPrimary || cidSecondary ? `<table class="nz" style="font-size:8.5pt;margin-bottom:3pt"><tbody>
        ${cidPrimary ? `<tr><th style="width:132px;white-space:nowrap">CID-10 Primário</th><td>${escape(cidPrimary)}</td></tr>` : ""}
        ${cidSecondary ? `<tr><th style="width:132px;white-space:nowrap">CID-10 Secundário</th><td>${escape(cidSecondary)}</td></tr>` : ""}
      </tbody></table>` : ""}
      ${situHtml}
    `
    : "";

  // ── Hipoteses diagnosticas — secao propria, numerada. Antes saiam numa celula
  // unica e as quebras de linha se perdiam ("A B C" emendado). Fonte: array do
  // soap (diagnosticHypotheses) ou o texto legado __diagnostic_hypotheses.
  const soapHypo = (evo.soap_data as { diagnosticHypotheses?: unknown } | undefined)?.diagnosticHypotheses;
  const hypothesesList = toHypothesesList(soapHypo).length > 0 ? toHypothesesList(soapHypo) : toHypothesesList(hypothesesText);
  const hypothesesHtml = hypothesesList.length > 0
    ? `<h2 class="nz-section">Hipóteses Diagnósticas</h2>
       <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;margin-bottom:3pt"><tbody>
         ${hypothesesList.map((h, i) =>
           `<tr><td style="width:18pt;padding:2pt 4pt;font-weight:700;color:#0054A6;vertical-align:top;font-size:8pt">${i + 1}.</td><td style="padding:2pt 4pt;font-size:8.5pt;line-height:1.35">${escape(h)}</td></tr>`
         ).join("")}
       </tbody></table>`
    : "";

  // Antecedentes clínicos — buscar em múltiplas fontes:
  // 1. soap_data.antecedentes (novo formato — array de itens)
  // 2. evo.antecedentes (campo raiz da tabela, legado)
  // 3. ctx.antecedentes (passado pelo chamador)
  // soapAntecedentes já declarado acima (antes do fetch de patients)




  const antecedentesArr = soapAntecedentes.length > 0 ? soapAntecedentes : patientAntecedentes;

  const antecedentesHtml = antecedentesArr.length > 0
    ? `<h2 class="nz-section">Antecedentes Clínicos</h2>
       <table style="width:100%;border-collapse:collapse;background:#eff6ff;border:1px solid #bfdbfe;border-radius:3pt;margin-bottom:3pt">
         <tbody>
           ${antecedentesArr.map((a, i) =>
             `<tr><td style="width:18pt;padding:2pt 4pt;font-weight:700;color:#1d4ed8;vertical-align:top;font-size:8pt">${i+1}.</td><td style="padding:2pt 4pt;font-size:8.5pt;line-height:1.35">${escape(a)}</td></tr>`
           ).join("")}
         </tbody>
       </table>`
    : "";

  // Pendências/Programações no PDF
  const pendItems: string[] = Array.isArray((evo.soap_data as any)?.pendenciasItems)
    ? (evo.soap_data as any).pendenciasItems.filter(Boolean)
    : [];
  const pendenciasHtml = pendItems.length > 0
    ? `<h2 class="nz-section">Programações e Pendências</h2><ul class="nz-list">${pendItems.map((p, i) => {
        const m = /^\s*\[( |x|X)\]\s?/.exec(p);
        const done = m ? m[1].toLowerCase() === "x" : false;
        const text = m ? p.replace(/^\s*\[( |x|X)\]\s?/, "") : p;
        const box = done ? "☑" : "☐";
        const style = done ? 'style="text-decoration:line-through;color:#64748b"' : '';
        return `<li ${style}>${i + 1}. ${box} ${text}</li>`;
      }).join('')}</ul>`
    : '';

  let sectionsHtml = diagnosticsHtml + hypothesesHtml + antecedentesHtml;

  if (intercurrence) {
    const evoTypeLabel = {
      intercurrence: "Intercorrência",
      vespertina:    "Evolução Vespertina",
      noturna:       "Evolução Noturna",
    }[getEvolutionType(evo)] ?? "Intercorrência";

    sectionsHtml += `
      <h2 class="nz-section">${evoTypeLabel}</h2>
      <div class="nz-rich" style="padding:6pt 8pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:8.5pt;line-height:1.35">
        ${renderRich(evo.soap_data.subjective)}
      </div>
    `;
  } else {
    const s = evo.soap_data;
    const v = evo.vital_signs;
    // ── Sinais vitais em faixa de celulas: rotulo pequeno, valor em destaque e a
    // unidade menor ao lado (nada quebra linha). So entram os preenchidos.
    const vitalsCells = [
      { l: "PA", v: v.pa, u: "mmHg" },
      { l: "FC", v: v.fc, u: "bpm" },
      { l: "FR", v: v.fr, u: "irpm" },
      { l: "Temp", v: v.temp, u: "°C" },
      { l: "SpO<sub>2</sub>", v: v.spo2, u: "%" },
      { l: "Glasgow", v: v.glasgow, u: "" },
      { l: "Diurese", v: v.diurese, u: "mL/24h" },
      { l: "Dor", v: v.dor, u: "" },
    ].filter((c) => String(c.v ?? "").trim());
    const vitalsHtml = vitalsCells.length > 0
      ? `<table class="ev-vitals"><tr>${vitalsCells
          .map((c) => `<td><span>${c.l}</span><b>${escape(String(c.v).trim())}</b>${c.u ? `<i>${c.u}</i>` : ""}</td>`)
          .join("")}</tr></table>`
      : "";

    // ── Exame fisico em 2 colunas (pares rotulo | texto), mesmo padrao de tabela.
    const examFilled = EXAM_LABELS.filter((f) => evo.physical_exam[f.key]);
    const examRowsArr: string[] = [];
    for (let i = 0; i < examFilled.length; i += 2) {
      const x = examFilled[i];
      const y = examFilled[i + 1];
      examRowsArr.push(
        `<tr><th>${x.label}</th><td>${escape(evo.physical_exam[x.key])}</td>`
        + (y ? `<th>${y.label}</th><td>${escape(evo.physical_exam[y.key])}</td>` : `<th class="ev-empty"></th><td class="ev-empty"></td>`)
        + `</tr>`,
      );
    }
    const examRows = examRowsArr.join("");

    const devCol = (() => {
        // ── Dispositivos invasivos — compacto, linha corrida ─────────────
        // A seção só existe se houver dispositivo com rótulo utilizável, e
        // cada item mostra APENAS o que está preenchido: sem data não sai
        // data, sem data não há Dn. Nada de campo vazio ocupando papel.
        //
        // Fonte do rótulo é formatDeviceLabel(), a MESMA da tela — inclui o
        // subtipo quando houver ("Dreno — Torácico"). Regra num lugar só.
        //
        // Defesa: registro gravado entre 1d9a8b20 e ab9f580a pode ter `label`
        // como objeto de evento (regressão do onClick). Item sem rótulo string
        // é descartado em vez de imprimir "[object Object]" no prontuário.
        const soapExtras = s as { devices?: unknown };
        const devs: unknown[] = Array.isArray(soapExtras.devices) ? soapExtras.devices : [];
        const itens = devs.map((raw) => {
          const d = raw as { label?: unknown; detail?: unknown; insertedAt?: unknown };
          const rotuloBase = typeof d?.label === "string" ? d.label.trim() : "";
          if (!rotuloBase) return "";
          const subtipo = typeof d?.detail === "string" ? d.detail : undefined;
          const rotulo = formatDeviceLabel({ label: rotuloBase, detail: subtipo });

          const inserido = typeof d?.insertedAt === "string" ? d.insertedAt.trim() : "";
          const dt = parseAdmissionDate(inserido);
          const dataTxt = dt ? format(dt, "dd/MM", { locale: ptBR }) : "";
          const dias = inserido ? calcDIH(inserido) : null;
          const tom = deviceAlertTone(dias);
          const cor = tom === "red" ? "#b91c1c" : tom === "amber" ? "#b45309" : "#047857";

          const sufixo = (dataTxt ? ` <span style="color:#64748b">${escape(dataTxt)}</span>` : "")
            + (dias !== null ? ` <strong style="color:${cor}">D${dias}</strong>` : "");
          return `${escape(rotulo)}${sufixo ? `<span style="white-space:nowrap">${sufixo}</span>` : ""}`;
        }).filter(Boolean);

        if (itens.length === 0) return "";
        return `<div class="ev-col"><div class="ev-h">Dispositivos invasivos</div><ul class="ev-box ev-ul">`
          + itens.map((it) => `<li>${it}</li>`).join("")
          + `</ul></div>`;
      })();
    const culCol = (() => {
        // ── Culturas — mesma regra dos dispositivos: só sai se houver ─────
        // culturesHtml é irmão de devices dentro do soap_data e sofria do
        // mesmo esquecimento: existia na tela e em nenhum impresso.
        //
        // A checagem usa richHtmlToPlainText porque o campo é rich text — um
        // editor "vazio" costuma guardar "<p></p>", que é truthy como string
        // mas não tem conteúdo algum. Testar a string crua imprimiria um
        // cabeçalho seguido de nada.
        const culturas = (s as { culturesHtml?: unknown }).culturesHtml;
        if (typeof culturas !== "string") return "";
        const html = toRichHtml(culturas);
        if (!richHtmlToPlainText(html).trim()) return "";
        return `<div class="ev-col"><div class="ev-h">Culturas</div><div class="ev-box nz-rich">${html}</div></div>`;
      })();
    const atbCol = (() => {
        // ── Antibioticos em curso — irmao de culturas/devices no soap_data.
        // Mesma regra: so sai se houver conteudo (rich text). GAP: existia na
        // tela read-only e no soap, mas nunca no impresso (culturas ja tinha
        // sido corrigida; antibioticos ficou para tras).
        const atb = (s as { antibioticos?: unknown }).antibioticos;
        if (typeof atb !== "string") return "";
        const html = toRichHtml(atb);
        if (!richHtmlToPlainText(html).trim()) return "";
        return `<div class="ev-col"><div class="ev-h">Antibióticos em curso</div><div class="ev-box nz-rich">${html}</div></div>`;
      })();

    // ── Dispositivos + Antibioticos | Culturas. Culturas costuma ser o campo
    // mais longo (antibiograma, sitio e tipo de coleta), entao fica sozinha na
    // coluna da direita com 60% da largura; dispositivos e antibioticos dividem
    // a coluna da esquerda (40%), um embaixo do outro. So entram blocos com
    // conteudo — nenhuma caixa vazia:
    //   - sem culturas: dispositivos e antibioticos lado a lado (50/50);
    //   - so culturas, ou so um dos outros: largura total.
    // O h2 oculto marca a linha para a quebra de pagina (sectionRows divide por
    // h2) e o bloco nao se parte entre paginas.
    const leftCols = [devCol, atbCol].filter(Boolean);
    let triGroupHtml = "";
    if (culCol && leftCols.length > 0) {
      triGroupHtml = `<div class="ev-g3" style="grid-template-columns:2fr 3fr">`
        + `<div class="ev-stack">${leftCols.join("")}</div>${culCol}</div>`;
    } else if (culCol) {
      triGroupHtml = `<div class="ev-g3" style="grid-template-columns:1fr">${culCol}</div>`;
    } else if (leftCols.length > 0) {
      triGroupHtml = `<div class="ev-g3" style="grid-template-columns:${leftCols.map(() => "1fr").join(" ")}">${leftCols.join("")}</div>`;
    }
    if (triGroupHtml) triGroupHtml = `<h2 class="nz-section ev-hidden"></h2>${triGroupHtml}`;


    // Unifica Subjetivo + Avaliação em "Evolução" preservando HTML rico
    const subjHtml = toRichHtml(s.subjective);
    const assessHtml = toRichHtml(s.assessment);
    const evolucaoHtml = [subjHtml, assessHtml].filter((h) => richHtmlToPlainText(h)).join("");
    const evolucaoOut = evolucaoHtml || "<em>—</em>";

    sectionsHtml += `
      ${vitalsHtml ? `<h2 class="nz-section">Sinais Vitais</h2>${vitalsHtml}` : ""}
      ${examRows ? `<h2 class="nz-section">Exame Físico</h2><table class="nz ev-exam" style="font-size:8.5pt"><tbody>${examRows}</tbody></table>` : ""}
      ${
        richHtmlToPlainText(toRichHtml(s.objective))
          ? `<h2 class="nz-section">Exames Complementares</h2><div class="nz-rich" style="padding:6pt 8pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:8.5pt;line-height:1.35">${renderRich(s.objective)}</div>`
          : ""
      }
      ${triGroupHtml}
      <h2 class="nz-section">Evolução</h2>
      <div class="nz-rich" style="padding:6pt 8pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:8.5pt;line-height:1.35">
        ${evolucaoOut}
      </div>
      ${(() => {
        // Especialidades — campo livre no soap_data, impresso ANTES do plano
        // (mesma ordem da tela). So sai se houver conteudo real.
        const esp = (s as { especialidades?: unknown }).especialidades;
        if (typeof esp !== "string") return "";
        const html = toRichHtml(esp);
        if (!richHtmlToPlainText(html).trim()) return "";
        return `<h2 class="nz-section">Especialidades</h2>`
          + `<div class="nz-rich" style="padding:5pt 7pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:8pt;line-height:1.35">${html}</div>`;
      })()}
      ${(() => {
        // Plano por itens (novo) ou texto livre (legado)
        const planItemsArr: string[] = Array.isArray((s as any).planItems) ? (s as any).planItems.filter(Boolean) : [];
        const planText = richHtmlToPlainText(toRichHtml(s.plan));
        if (planItemsArr.length > 0) {
          const rows = planItemsArr.map((item, i) =>
            `<tr><td style="width:18pt;padding:2pt 4pt;font-weight:700;color:#6d28d9;vertical-align:top;font-size:8pt">${i+1}.</td><td style="padding:2pt 4pt;font-size:8.5pt;line-height:1.35">${escape(item)}</td></tr>`
          ).join("");
          return `<h2 class="nz-section">Plano Terapêutico</h2><table style="width:100%;border-collapse:collapse;background:#faf5ff;border:1px solid #ddd6fe;border-radius:3pt"><tbody>${rows}</tbody></table>`;
        } else if (planText) {
          return `<h2 class="nz-section">Plano Terapêutico</h2><div class="nz-rich" style="padding:6pt 8pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:8.5pt;line-height:1.35">${renderRich(s.plan)}</div>`;
        }
        return "";
      })()}
      ${(() => {
        // Programações e Pendências (opcional)
        const pendArr: string[] = Array.isArray((s as any).pendenciasItems) ? (s as any).pendenciasItems.filter(Boolean) : [];
        if (pendArr.length === 0) return "";
        const rows = pendArr.map((item, i) => {
          const m = /^\s*\[( |x|X)\]\s?/.exec(item);
          const done = m ? m[1].toLowerCase() === "x" : false;
          const text = m ? item.replace(/^\s*\[( |x|X)\]\s?/, "") : item;
          const box = done ? "☑" : "☐";
          const textStyle = done ? "padding:2pt 4pt;font-size:8.5pt;line-height:1.35;text-decoration:line-through;color:#64748b" : "padding:2pt 4pt;font-size:8.5pt;line-height:1.35";
          return `<tr><td style="width:18pt;padding:2pt 4pt;font-weight:700;color:#c2410c;vertical-align:top;font-size:8pt">${i+1}.</td><td style="width:14pt;padding:2pt 2pt;font-size:10pt;vertical-align:top">${box}</td><td style="${textStyle}">${escape(text)}</td></tr>`;
        }).join("");
        return `<h2 class="nz-section">Programações e Pendências</h2><table style="width:100%;border-collapse:collapse;background:#fff7ed;border:1px solid #fed7aa;border-radius:3pt"><tbody>${rows}</tbody></table>`;
      })()}
    `;
  }

  // Divide sectionsHtml em múltiplos <tr> (um por seção h2) para que o Chrome
  // posicione cada linha APÓS o <thead> repetido em cada página, evitando corte de conteúdo.
  const sectionRows = sectionsHtml
    .split(/(?=<h2 class="nz-section)/)
    .filter(s => s.trim().length > 0)
    .map(s => `<tr style="page-break-inside:avoid"><td style="padding:0;border:none">${s}</td></tr>`)
    .join('');

  // Header repetível via <thead> NATIVO: o navegador repete o thead em cada
  // página automaticamente, reservando o espaço correto — sem position:fixed
  // nem script de runtime (que causavam sobreposição do nome e sumiço de campos).
  const evoTypeForHeader = getEvolutionType(evo);
  const headerTitleMap: Record<string, string> = {
    intercurrence: "Intercorrência clínica",
    vespertina: "Evolução complementar vespertina",
    noturna: "Evolução complementar noturna",
    normal: "Evolução clínica",
  };
  const headerComplementMap: Record<string, string> = {
    vespertina: "Turno vespertino",
    noturna: "Turno noturno",
  };
  const standardHeader: HeaderInput = {
    model: "assistencial",
    title: headerTitleMap[evoTypeForHeader] ?? "Evolução clínica",
    complement: headerComplementMap[evoTypeForHeader],
    emission: "",
    patient: headerPatient,
  };
  const patientGridHtml = buildStandardHeaderHtml(standardHeader, logo, "grid");

  const bodyHtml = `
    <table style="width:100%;border-collapse:collapse">
      <thead style="display:table-header-group">
        <tr><td style="padding:0;border:none"><div id="patient-header-repeat">${patientGridHtml}</div></td></tr>
      </thead>
      <tbody>
        ${sectionRows}
      </tbody>
    </table>
  `;



  const evoType = getEvolutionType(evo);
  const titleMap: Record<string, string> = {
    intercurrence: "Intercorrência Clínica",
    vespertina:    "Evolução Complementar Vespertina",
    noturna:       "Evolução Complementar Noturna",
    normal:        "Evolução Clínica",
  };
  const subtitleMap: Record<string, string> = {
    intercurrence: "Registro de intercorrência",
    vespertina:    "Registro de evolução complementar — turno vespertino",
    noturna:       "Registro de evolução complementar — turno noturno",
    normal:        "Registro de evolução",
  };
  const prefixMap: Record<string, string> = {
    intercurrence: "INTC",
    vespertina:    "EVOL",
    noturna:       "EVOL",
    normal:        "EVOL",
  };

  const html = buildNormaZeroDocument({
    title: titleMap[evoType] ?? "Evolução Clínica",
    standardHeader,
    standardHeaderTopOnly: true,
    sectorLabel: getSectorDisplayLabel(ctx?.patientSector || evo.patient_sector) || "Assistência Médica",
    docCodePrefix: prefixMap[evoType] ?? "EVOL",
    bodyHtml,
    logoDataUrl: logo,
    signatures: [
      {
        label: doctorName,
        caption: validatedAt ? `Validada em ${validatedAt}` : "CRM e assinatura",
      },
    ],
    extraStyles: `
      .nz-section { font-size: 9pt; margin-top: 4pt; margin-bottom: 2pt; }
      .nz-rich p { margin: 0 0 4pt 0; }
      .nz-rich p:last-child { margin-bottom: 0; }
      .nz-rich ul, .nz-rich ol { margin: 3pt 0 4pt 16pt; padding: 0; }
      .nz-rich li { margin: 0 0 1pt 0; }
      .nz-rich strong, .nz-rich b { font-weight: 600; }
      .nz-rich em, .nz-rich i { font-style: italic; }
      .nz-rich u { text-decoration: underline; }
      /* O header do paciente repete via <thead> nativo — sem position:fixed. */
      #patient-header-repeat { background: #fff; }
      /* Diagnosticos: caixas de previsao de alta / precaucao / paliativo em uma linha. */
      .ev-situ { display: grid; gap: 4pt; margin-bottom: 3pt; }
      .ev-kv { border: .75pt solid #cbd5e1; border-radius: 3pt; padding: 3pt 6pt; background: #f8fafc; }
      .ev-kv span { display: block; white-space: nowrap; font-size: 6.8pt; text-transform: uppercase; letter-spacing: .3pt; color: #64748b; font-weight: 700; }
      .ev-kv b { font-size: 9pt; color: #0f172a; }
      .ev-warn { border-color: #f59e0b; background: #fffbeb; } .ev-warn b { color: #92400e; }
      /* Sinais vitais em faixa de celulas. */
      .ev-vitals { width: 100%; border-collapse: separate; border-spacing: 3pt 0; table-layout: fixed; margin: 0 -3pt; }
      .ev-vitals td { border: .75pt solid #e2e8f0; border-radius: 3pt; padding: 3pt 5pt; background: #f8fafc; }
      .ev-vitals span { display: block; font-size: 6.8pt; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: .3pt; }
      .ev-vitals b { font-size: 9pt; white-space: nowrap; }
      .ev-vitals i { font-style: normal; font-size: 7pt; color: #64748b; margin-left: 2pt; white-space: nowrap; }
      /* Exame fisico em 2 colunas. */
      table.nz.ev-exam { table-layout: fixed; }
      table.nz.ev-exam th { width: 108px; vertical-align: top; white-space: nowrap; }
      table.nz.ev-exam td { vertical-align: top; line-height: 1.35; }
      table.nz.ev-exam .ev-empty { background: transparent; }
      /* Dispositivos | Culturas | Antibioticos lado a lado. */
      h2.nz-section.ev-hidden { display: none; }
      .ev-g3 { display: grid; column-gap: 8pt; align-items: stretch; margin-top: 6pt; break-inside: avoid; }
      .ev-col { display: flex; flex-direction: column; }
      /* Coluna da esquerda: dispositivos em cima, antibioticos embaixo; o ultimo
         bloco estica para alinhar a base com a caixa de culturas. */
      .ev-stack { display: flex; flex-direction: column; gap: 6pt; }
      .ev-stack > .ev-col:last-child { flex: 1; }
      .ev-h { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .5pt; color: #fff; background: #0054A6; padding: 2.5pt 6pt; border-radius: 3pt 3pt 0 0; }
      .ev-box { flex: 1; border: 1px solid #e2e8f0; border-top: none; background: #f8fafc; padding: 4pt 6pt; border-radius: 0 0 3pt 3pt; font-size: 8.3pt; line-height: 1.35; margin: 0; }
      .ev-ul { list-style: none; } .ev-ul li { margin: 0 0 1.5pt 0; padding-left: 7pt; text-indent: -7pt; }
      .ev-ul li::before { content: "▪"; color: #94a3b8; margin-right: 3pt; font-size: 6pt; }
    `,
  });

  // Escrever o HTML na janela já aberta (ou fallback se bloqueada)
  if (printWin) {
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  } else {
    // Fallback: tentar abrir novamente (pode falhar por popup blocker)
    openPrintWindow(
      html,
      intercurrence ? "Preparando intercorrência…" : "Preparando evolução…"
    );
  }
  } catch (err) {
    // NUNCA deixar a janela presa no splash "Preparando...": escreve uma pagina
    // de erro legivel e registra o detalhe no console (para diagnostico).
    console.error("[printEvolution] falha ao gerar o documento:", err);
    const detalhe = err instanceof Error ? err.message : String(err);
    if (printWin) {
      try {
        printWin.document.open();
        printWin.document.write(
          `<html><body style="font-family:sans-serif;padding:24px;color:#991b1b">`
          + `<h2 style="margin:0 0 8px">Nao foi possivel gerar a evolucao</h2>`
          + `<p style="color:#334155">Tente imprimir novamente. Se persistir, informe o detalhe abaixo ao suporte.</p>`
          + `<pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;padding:8px;border-radius:4px;color:#475569;font-size:12px">${detalhe.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c))}</pre>`
          + `</body></html>`,
        );
        printWin.document.close();
      } catch { /* janela pode ter sido fechada pelo usuario */ }
    }
  }
};
