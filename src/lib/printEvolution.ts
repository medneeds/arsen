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

const isIntercurrence = (evo: EvolutionRecord) =>
  (evo.soap_data as any)?.type === "intercurrence";

export interface PrintEvolutionContext {
  patientName?: string;
  patientBed?: string;
  patientSector?: string;
  patientRecord?: string;
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

  const patientHeader = `
    <table class="nz" style="margin-bottom:8pt">
      <tbody>
        <tr>
          <th style="width:120px">Paciente</th>
          <td>${escape(ctx?.patientName || evo.patient_name || "—")}</td>
          <th style="width:90px">Leito</th>
          <td style="width:90px">${escape(ctx?.patientBed || evo.patient_bed || "—")}</td>
        </tr>
        <tr>
          <th>Setor</th>
          <td>${escape(ctx?.patientSector || evo.patient_sector || "—")}</td>
          <th>Prontuário</th>
          <td>${escape(ctx?.patientRecord || "—")}</td>
        </tr>
        <tr>
          <th>Registro em</th>
          <td>${createdAt}</td>
          <th>${validatedAt ? "Validada em" : "Status"}</th>
          <td>${validatedAt ? validatedAt : escape(evo.status)}</td>
        </tr>
      </tbody>
    </table>
  `;

  let bodyHtml = patientHeader;

  if (intercurrence) {
    bodyHtml += `
      <h2 class="nz-section">Intercorrência</h2>
      <div style="padding:8pt 10pt;background:#fffbeb;border:1px solid #fde68a;border-radius:3pt;font-size:10pt;line-height:1.5">
        ${escape(evo.soap_data.subjective) || "<em>—</em>"}
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
          `<tr><th style="width:130px">${f.label}</th><td>${escape(evo.physical_exam[f.key])}</td></tr>`
      )
      .join("");

    // Unifica Subjetivo + Avaliação em "Evolução"
    const evolucaoTexto = [s.subjective, s.assessment]
      .map(t => (t || "").trim())
      .filter(Boolean)
      .join("\n\n");

    bodyHtml += `
      ${
        vitalsRow
          ? `<h2 class="nz-section">Sinais Vitais</h2><div style="padding:6pt 8pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:9pt">${vitalsRow}</div>`
          : ""
      }
      <h2 class="nz-section">Evolução</h2>
      <div style="padding:8pt 10pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:10pt;line-height:1.5">
        ${escape(evolucaoTexto) || "<em>—</em>"}
      </div>
      ${examRows ? `<h2 class="nz-section">Exame Físico</h2><table class="nz"><tbody>${examRows}</tbody></table>` : ""}
      ${
        s.objective?.trim()
          ? `<h2 class="nz-section">Exames Complementares</h2><div style="padding:8pt 10pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:10pt;line-height:1.5">${escape(s.objective)}</div>`
          : ""
      }
      <h2 class="nz-section">Plano</h2>
      <div style="padding:8pt 10pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3pt;font-size:10pt;line-height:1.5">
        ${escape(s.plan) || "<em>—</em>"}
      </div>
    `;
  }

  const doctorName = evo.validated_by_name || evo.created_by_name || "Médico Assistente";

  const html = buildNormaZeroDocument({
    title: intercurrence ? "Intercorrência Clínica" : "Evolução Clínica",
    subtitle: intercurrence ? "Registro de intercorrência" : "Registro de evolução",
    sectorLabel: ctx?.patientSector || evo.patient_sector || "Assistência Médica",
    docCodePrefix: intercurrence ? "INTC" : "EVOL",
    bodyHtml,
    logoDataUrl: logo,
    signatures: [
      {
        label: doctorName,
        caption: validatedAt ? `Validada em ${validatedAt}` : "CRM e assinatura",
      },
    ],
  });

  openPrintWindow(
    html,
    intercurrence ? "Preparando intercorrência…" : "Preparando evolução…"
  );
};
