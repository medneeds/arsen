// ── Discharge / Death document utilities (Norma Zero PDF) ──
// Padronizado conforme MAN.05-001 (timbrado institucional Arsen).
// Reutiliza buildNormaZeroDocument para garantir cabeçalho, banda colorida,
// código do documento, assinatura e rodapé idênticos aos demais documentos.

import {
  buildNormaZeroDocument,
  openPrintWindow,
  prepareLogo,
  type NormaZeroSignature,
} from "@/lib/printNormaZero";

export type DischargeDocType = "alta_hospitalar" | "alta_pedido" | "obito";

export const DISCHARGE_DOC_LABELS: Record<DischargeDocType, string> = {
  alta_hospitalar: "Sumário de Alta Hospitalar",
  alta_pedido: "Termo de Alta a Pedido",
  obito: "Relatório de Óbito",
};

export const DISCHARGE_DOC_SHORT: Record<DischargeDocType, string> = {
  alta_hospitalar: "Sumário de Alta",
  alta_pedido: "Alta a Pedido",
  obito: "Relatório de Óbito",
};

const DISCHARGE_DOC_PREFIX: Record<DischargeDocType, string> = {
  alta_hospitalar: "ALTA",
  alta_pedido: "APED",
  obito: "OBT",
};

export interface DischargeDocPayload {
  // Identification
  patient_name: string;
  patient_bed?: string;
  patient_sector?: string;
  patient_birth_date?: string;
  patient_record?: string;
  encounter_code?: string;
  hospital_name?: string;
  hospital_address?: string;
  // Stay
  admission_date?: string;
  discharge_date?: string;
  // Clinical
  admission_diagnosis?: string;
  final_diagnoses?: string;
  evolution_summary?: string;
  procedures?: string;
  complications?: string;
  // Discharge specifics
  discharge_type?: string;
  discharge_summary?: string;
  orientations?: string;
  return_date?: string;
  return_specialty?: string;
  restrictions?: string;
  prescription?: string;
  referral?: string;
  // Death specifics
  death_date_time?: string;
  death_place?: string;
  death_summary?: string;
  immediate_cause?: string;
  intermediate_causes?: string;
  basic_cause?: string;
  contributing_causes?: string;
  death_type?: string;
  necropsy?: string;
  do_number?: string;
  notified_family?: string;
  // Comunicação à família
  family_contact_name?: string;
  family_contact_relation?: string;
  family_contact_phone?: string;
  family_contact_email?: string;
  family_communication_mode?: string;
  family_communication_at?: string;
  family_communication_by?: string;
  family_satisfaction?: string;
  family_communication_notes?: string;
  // Sign
  signed_by_name?: string;
  signed_by_crm?: string;
  signed_at?: string;
}

const escapeHtml = (s?: string | null) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

/** Renderiza um par rótulo/valor em formato compacto Norma Zero. */
const field = (label: string, value?: string) => {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return `<div class="dz-field"><div class="dz-lb">${escapeHtml(label)}</div><div class="dz-vl">${escapeHtml(v).replace(/\n/g, "<br/>")}</div></div>`;
};

/** Estilos específicos do documento de alta/óbito (somam-se aos do Norma Zero). */
const dischargeExtraStyles = `
  .dz-id-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2pt 14pt; padding: 5pt 8pt; border: 0.5pt solid #cbd5e1; background: #fafbfc; border-radius: 3pt; margin-bottom: 8pt; }
  .dz-id-grid > div { font-size: 8.5pt; color: #0a1628; }
  .dz-id-grid .k { color: #64748b; text-transform: uppercase; font-size: 6.8pt; letter-spacing: 0.4pt; font-weight: 700; margin-right: 4pt; }
  .dz-field { margin-bottom: 4pt; page-break-inside: avoid; }
  .dz-lb { font-weight: 700; text-transform: uppercase; font-size: 7.5pt; letter-spacing: 0.4pt; color: #0054A6; border-bottom: 0.5pt solid #cbd5e1; padding-bottom: 1pt; margin-bottom: 1.5pt; }
  .dz-vl { font-size: 8.5pt; white-space: pre-wrap; color: #0a1628; }
  .dz-section-title { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; color: #475569; margin: 10pt 0 4pt; padding-bottom: 2pt; border-bottom: 1pt solid #0054A6; }
`;

function buildBody(type: DischargeDocType, p: DischargeDocPayload): string {
  const isDeath = type === "obito";

  const idGrid = `
    <div class="dz-id-grid">
      <div><span class="k">Paciente</span><b>${escapeHtml(p.patient_name)}</b></div>
      <div><span class="k">Prontuário</span>${escapeHtml(p.patient_record || "—")}</div>
      <div><span class="k">Atendimento</span>${escapeHtml(p.encounter_code || "—")}</div>
      <div><span class="k">Leito / Setor</span>${escapeHtml(`${p.patient_bed || "—"} • ${p.patient_sector || "—"}`)}</div>
      <div><span class="k">Nascimento</span>${escapeHtml(p.patient_birth_date || "—")}</div>
      <div><span class="k">Admissão</span>${escapeHtml(fmtDate(p.admission_date))}</div>
      <div><span class="k">${isDeath ? "Data/Hora do Óbito" : "Alta"}</span>${escapeHtml(fmtDate(isDeath ? p.death_date_time : p.discharge_date))}</div>
      <div><span class="k">${isDeath ? "Local do óbito" : "Tipo de alta"}</span>${escapeHtml((isDeath ? p.death_place : p.discharge_type) || "—")}</div>
    </div>`;

  const clinicalCommon = `
    <div class="dz-section-title">Quadro clínico</div>
    ${field("Diagnóstico de admissão", p.admission_diagnosis)}
    ${field(isDeath ? "Diagnósticos finais" : "Diagnósticos finais (CID e descrição)", p.final_diagnoses)}
    ${field("Resumo da evolução / quadro clínico", p.evolution_summary)}
    ${field("Procedimentos realizados", p.procedures)}
    ${field("Intercorrências / complicações", p.complications)}
  `;

  const dischargeBlocks = `
    <div class="dz-section-title">Plano de alta</div>
    ${field("Sumário de alta", p.discharge_summary)}
    ${field("Plano e orientações de alta", p.orientations)}
    ${field("Prescrição de alta", p.prescription)}
    ${field("Restrições", p.restrictions)}
    ${field("Retorno / contrarreferência", [p.return_date, p.return_specialty, p.referral].filter(Boolean).join(" • "))}
  `;

  const deathBlocks = `
    <div class="dz-section-title">Óbito</div>
    ${field("Resumo / relatório do óbito", p.death_summary)}
    ${field("Tipo de morte", p.death_type)}
    ${field("Necropsia", p.necropsy)}
    ${field("Declaração de Óbito (nº)", p.do_number)}
  `;

  const satLabel = (s?: string) => {
    const m: Record<string, string> = {
      "1": "1 — Muito insatisfeito",
      "2": "2 — Insatisfeito",
      "3": "3 — Neutro",
      "4": "4 — Satisfeito",
      "5": "5 — Muito satisfeito",
    };
    return s ? m[s] || s : "";
  };

  const familyAny =
    p.family_contact_name ||
    p.family_contact_relation ||
    p.family_contact_phone ||
    p.family_contact_email ||
    p.family_communication_mode ||
    p.family_communication_at ||
    p.family_communication_by ||
    p.family_satisfaction ||
    p.family_communication_notes;

  const familyBlocks = familyAny
    ? `
      <div class="dz-section-title">Comunicação à família</div>
      ${field("Familiar comunicado", [p.family_contact_name, p.family_contact_relation].filter(Boolean).join(" — "))}
      ${field("Contato do familiar", [p.family_contact_phone, p.family_contact_email].filter(Boolean).join(" • "))}
      ${field("Modo da comunicação", p.family_communication_mode)}
      ${field("Comunicado por / em", [p.family_communication_by, fmtDate(p.family_communication_at)].filter(Boolean).join(" • "))}
      ${field("Grau de satisfação na comunicação médica", satLabel(p.family_satisfaction))}
      ${field("Observações da comunicação", p.family_communication_notes)}
    `
    : "";

  return `${idGrid}${clinicalCommon}${isDeath ? deathBlocks : dischargeBlocks}${familyBlocks}`;
}

export async function printDischargeDocument(
  type: DischargeDocType,
  payload: DischargeDocPayload,
) {
  const title = DISCHARGE_DOC_LABELS[type];
  const sectorLabel =
    payload.patient_sector
      ? `${payload.patient_sector}${payload.patient_bed ? ` • Leito ${payload.patient_bed}` : ""}`
      : "Assistência hospitalar";

  const signatures: NormaZeroSignature[] = [
    {
      label: payload.signed_by_name || "Médico responsável",
      caption: payload.signed_by_crm
        ? `CRM: ${payload.signed_by_crm}${payload.signed_at ? ` • ${fmtDate(payload.signed_at)}` : ""}`
        : "Carimbo e assinatura",
    },
  ];

  const logoDataUrl = await prepareLogo();

  const html = buildNormaZeroDocument({
    title,
    subtitle: payload.patient_name
      ? `${payload.patient_name}${payload.patient_record ? ` • Prontuário ${payload.patient_record}` : ""}`
      : undefined,
    sectorLabel,
    hospitalName: payload.hospital_name,
    docCodePrefix: DISCHARGE_DOC_PREFIX[type],
    bodyHtml: buildBody(type, payload),
    signatures,
    logoDataUrl,
    orientation: "portrait",
    extraStyles: dischargeExtraStyles,
  });

  openPrintWindow(html, `Gerando ${title}…`);
}

/**
 * Mantido por compatibilidade — alguns módulos podem importar a versão HTML
 * direta. Agora apenas encapsula buildNormaZeroDocument com payload mínimo.
 */
export function buildDischargeDocHTML(
  type: DischargeDocType,
  p: DischargeDocPayload,
): string {
  const title = DISCHARGE_DOC_LABELS[type];
  return buildNormaZeroDocument({
    title,
    subtitle: p.patient_name,
    sectorLabel: p.patient_sector || "Assistência hospitalar",
    hospitalName: p.hospital_name,
    docCodePrefix: DISCHARGE_DOC_PREFIX[type],
    bodyHtml: buildBody(type, p),
    signatures: [
      {
        label: p.signed_by_name || "Médico responsável",
        caption: p.signed_by_crm ? `CRM: ${p.signed_by_crm}` : "Carimbo e assinatura",
      },
    ],
    orientation: "portrait",
    extraStyles: dischargeExtraStyles,
  });
}
