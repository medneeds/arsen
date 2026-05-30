/**
 * Geração de PDF Norma Zero para uma evolução clínica ou intercorrência.
 * Reutilizável a partir do EvolutionForm e da Timeline.
 *
 * Layout unificado: Subjetivo + Avaliação aparecem como uma única seção "Evolução".
 * Para registros antigos, concatenamos os dois campos com um separador suave.
 */
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { buildNormaZeroDocument, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";
import { toRichHtml, richHtmlToPlainText } from "@/components/ui/rich-text-editor";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import type { EvolutionRecord } from "@/hooks/useEvolutions";

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

// 🔒 Considera como complementar qualquer tipo específico:
// intercurrence (intercorrência), vespertina, noturna.
// Esses tipos têm apenas campo 'subjective' — sem Plano.
const isIntercurrence = (evo: EvolutionRecord) => {
  const t = (evo.soap_data as any)?.type;
  return t === "intercurrence" || t === "vespertina" || t === "noturna";
};

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
  ctx?: PrintEvolutionContext
) => {
  const logo = await prepareLogo();
  const intercurrence = isIntercurrence(evo);

  const createdAt = format(new Date(evo.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const validatedAt = evo.validated_at
    ? format(new Date(evo.validated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;

  // Nome impresso (com nome social, se houver)
  const baseName = ctx?.patientName || evo.patient_name || "—";
  const fullName = ctx?.patientSocialName
    ? `${baseName} (NOME SOCIAL: ${ctx.patientSocialName})`
    : baseName;

  const doctorName = evo.validated_by_name || evo.created_by_name || "Médico Assistente";

  const SEP = `<span style="color:#94a3b8;margin:0 3pt">|</span>`;
  const F = (label: string, value: string) =>
    `<span style="font-weight:600">${label}</span>&nbsp;${value}`;

  const birthDisplay = ctx?.patientBirthDate ? ctx.patientBirthDate : "—";

  // Estilos da tabela de paciente — idêntico ao PrintablePrescription
  const cellS = "border:0.5px solid #94a3b8;padding:3px 6px;font-size:7.5pt;line-height:1.3;vertical-align:top";
  const labelS = `${cellS};font-weight:700;font-size:6.5pt;background:#f1f5f9;color:#334155;text-transform:uppercase;letter-spacing:0.3px`;

  const patientHeader = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:6pt;page-break-inside:avoid">
      <tbody>
        <tr>
          <td style="${labelS}">Paciente</td>
          <td style="${cellS};font-weight:800;font-size:9pt;letter-spacing:-0.01em" colspan="7">
            ${escape(fullName.toUpperCase())}
          </td>
        </tr>
        <tr>
          <td style="${labelS}">Leito</td>
          <td style="${cellS};font-weight:700">${escape(ctx?.patientBed || evo.patient_bed || "—")}</td>
          <td style="${labelS}">Setor / Unidade</td>
          <td style="${cellS};font-weight:600">${escape(getSectorDisplayLabel(ctx?.patientSector || evo.patient_sector) || "—")}</td>
          <td style="${labelS}">Prontuário</td>
          <td style="${cellS};font-weight:700">${escape(ctx?.patientRecord || "—")}</td>
          <td style="${labelS}">Nº Atendimento</td>
          <td style="${cellS};font-weight:700">${ctx?.patientAtendimento ? "#" + escape(ctx.patientAtendimento) : "—"}</td>
        </tr>
        <tr>
          <td style="${labelS}">Data de Nasc.</td>
          <td style="${cellS}">${escape(birthDisplay)}</td>
          <td style="${labelS}">Médico</td>
          <td style="${cellS}" colspan="3">${escape(doctorName)}</td>
          <td style="${labelS};color:#dc2626;font-size:6pt">⚠ ALERGIAS</td>
          <td style="${cellS};font-weight:700;color:#991b1b;background:#fef2f2;font-size:7.5pt">—</td>
        </tr>
      </tbody>
    </table>
  `;

  const hypothesesText = (evo as any).diagnostic_hypotheses?.toString().trim() || "";
  const cidPrimary = ctx?.cidPrimary?.trim() || "";
  const cidSecondary = ctx?.cidSecondary?.trim() || "";
  const hasDiagnostics = hypothesesText || cidPrimary || cidSecondary;

  const diagnosticsHtml = hasDiagnostics
    ? `
      <h2 class="nz-section">Diagnósticos</h2>
      <table class="nz" style="font-size:8.5pt;margin-bottom:6pt"><tbody>
        ${cidPrimary ? `<tr><th style="width:140px">CID-10 Primário</th><td>${escape(cidPrimary)}</td></tr>` : ""}
        ${cidSecondary ? `<tr><th>CID-10 Secundário</th><td>${escape(cidSecondary)}</td></tr>` : ""}
        ${hypothesesText ? `<tr><th>Hipóteses Diagnósticas</th><td>${escape(hypothesesText)}</td></tr>` : ""}
      </tbody></table>
    `
    : "";

  // Antecedentes clínicos — exibidos no PDF logo após diagnósticos
  const soapAntecedentes: string[] = Array.isArray((evo.soap_data as any)?.antecedentes)
    ? (evo.soap_data as any).antecedentes.filter(Boolean)
    : [];
  // Fallback: ctx pode trazer antecedentes se o chamador os conhecer
  const antecedentesArr = soapAntecedentes;

  const antecedentesHtml = antecedentesArr.length > 0
    ? `<h2 class="nz-section">Antecedentes Clínicos</h2>
       <table style="width:100%;border-collapse:collapse;background:#fffbeb;border:1px solid #fde68a;border-radius:3pt;margin-bottom:6pt">
         <tbody>
           ${antecedentesArr.map((a, i) =>
             `<tr><td style="width:18pt;padding:2pt 4pt;font-weight:700;color:#b45309;vertical-align:top;font-size:8pt">${i+1}.</td><td style="padding:2pt 4pt;font-size:8.5pt;line-height:1.35">${escape(a)}</td></tr>`
           ).join("")}
         </tbody>
       </table>`
    : "";

  let bodyHtml = patientHeader + diagnosticsHtml + antecedentesHtml;

  if (intercurrence) {
    bodyHtml += `
      <h2 class="nz-section">Intercorrência</h2>
      <div class="nz-rich" style="padding:6pt 8pt;background:#fffbeb;border:1px solid #fde68a;border-radius:3pt;font-size:8.5pt;line-height:1.35">
        ${renderRich(evo.soap_data.subjective)}
      </div>
    `;
  } else {
    const s = evo.soap_data;
    const v = evo.vital_signs;
    const vitalsRow = [
      v.pa && `PA ${v.pa}`,
      v.fc && `FC ${v.fc}`,
      v.fr && `FR ${v.fr}`,
      v.temp && `T ${v.temp}°C`,
      v.spo2 && `SpO<sub>2</sub> ${v.spo2}%`,
      v.glasgow && `Glasgow ${v.glasgow}`,
      v.diurese && `Diurese ${v.diurese} mL/24h`,
      v.dor && `Dor ${v.dor}`,
    ]
      .filter(Boolean)
      .join(" • ");

    const examRows = EXAM_LABELS.filter((f) => evo.physical_exam[f.key])
      .map(
        (f) =>
          `<tr><th style="width:120px">${f.label}</th><td>${escape(evo.physical_exam[f.key])}</td></tr>`
      )
      .join("");

    // Unifica Subjetivo + Avaliação em "Evolução" preservando HTML rico
    const subjHtml = toRichHtml(s.subjective);
    const assessHtml = toRichHtml(s.assessment);
    const evolucaoHtml = [subjHtml, assessHtml].filter((h) => richHtmlToPlainText(h)).join("");
    const evolucaoOut = evolucaoHtml || "<em>—</em>";

    bodyHtml += `
      ${
        vitalsRow
          ? `<h2 class="nz-section">Sinais Vitais</h2><div style="padding:5pt 7pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:8pt">${vitalsRow}</div>`
          : ""
      }
      <h2 class="nz-section">Evolução</h2>
      <div class="nz-rich" style="padding:6pt 8pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:8.5pt;line-height:1.35">
        ${evolucaoOut}
      </div>
      ${examRows ? `<h2 class="nz-section">Exame Físico</h2><table class="nz" style="font-size:8.5pt"><tbody>${examRows}</tbody></table>` : ""}
      ${
        richHtmlToPlainText(toRichHtml(s.objective))
          ? `<h2 class="nz-section">Exames Complementares</h2><div class="nz-rich" style="padding:6pt 8pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:8.5pt;line-height:1.35">${renderRich(s.objective)}</div>`
          : ""
      }
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
        const rows = pendArr.map((item, i) =>
          `<tr><td style="width:18pt;padding:2pt 4pt;font-weight:700;color:#c2410c;vertical-align:top;font-size:8pt">${i+1}.</td><td style="padding:2pt 4pt;font-size:8.5pt;line-height:1.35">${escape(item)}</td></tr>`
        ).join("");
        return `<h2 class="nz-section">Programações e Pendências</h2><table style="width:100%;border-collapse:collapse;background:#fff7ed;border:1px solid #fed7aa;border-radius:3pt"><tbody>${rows}</tbody></table>`;
      })()}
    `;
  }



  const html = buildNormaZeroDocument({
    title: intercurrence ? "Intercorrência Clínica" : "Evolução Clínica",
    subtitle: intercurrence ? "Registro de intercorrência" : "Registro de evolução",
    sectorLabel: getSectorDisplayLabel(ctx?.patientSector || evo.patient_sector) || "Assistência Médica",
    docCodePrefix: intercurrence ? "INTC" : "EVOL",
    bodyHtml,
    logoDataUrl: logo,
    signatures: [
      {
        label: doctorName,
        caption: validatedAt ? `Validada em ${validatedAt}` : "CRM e assinatura",
      },
    ],
    extraStyles: `
      .nz-section { font-size: 9pt; margin-top: 7pt; margin-bottom: 3pt; }
      .nz-rich p { margin: 0 0 4pt 0; }
      .nz-rich p:last-child { margin-bottom: 0; }
      .nz-rich ul, .nz-rich ol { margin: 3pt 0 4pt 16pt; padding: 0; }
      .nz-rich li { margin: 0 0 1pt 0; }
      .nz-rich strong, .nz-rich b { font-weight: 600; }
      .nz-rich em, .nz-rich i { font-style: italic; }
      .nz-rich u { text-decoration: underline; }
    `,
  });

  openPrintWindow(
    html,
    intercurrence ? "Preparando intercorrência…" : "Preparando evolução…"
  );
};
