/**
 * Módulo de Receituário — Alta hospitalar e Ambulatorial
 *
 * Interface estruturada de medicamentos com texto livre ao final.
 * Impressão via Norma Zero (timbrado institucional HMDM).
 */

import {
  buildNormaZeroDocument,
  openPrintWindow,
  prepareLogo,
} from "@/lib/printNormaZero";

// ── Tipos ───────────────────────────────────────────────────────────────────

export type ReceituarioType = "alta" | "ambulatorial";

export interface ReceituarioItem {
  id: string;
  name: string;       // nome do medicamento
  dose: string;       // ex.: "500mg", "1 comprimido"
  route: string;      // ex.: "VO", "SC"
  frequency: string;  // ex.: "8/8h", "1x/dia", "SOS"
  duration: string;   // ex.: "5 dias", "uso contínuo"
}

export interface ReceituarioData {
  id?: string;
  type: ReceituarioType;
  patient_id?: string | null;
  patient_name: string;
  patient_bed?: string;
  patient_sector?: string;
  items: ReceituarioItem[];
  free_text?: string;
  signed_by_name?: string;
  signed_by_crm?: string;
  created_at?: string;
  updated_at?: string;
}

// ── Vias de administração disponíveis ───────────────────────────────────────

export const RECEITUARIO_ROUTES = [
  "VO",         // via oral
  "SL",         // sublingual
  "SC",         // subcutâneo
  "IM",         // intramuscular
  "Tópico",
  "Inalatório",
  "Ocular",
  "Nasal",
  "Retal",
  "Transdérmico",
] as const;

// ── Frequências pré-definidas ────────────────────────────────────────────────

export const RECEITUARIO_FREQUENCIES = [
  "1x/dia",
  "2x/dia",
  "3x/dia",
  "4x/dia",
  "6/6h",
  "8/8h",
  "12/12h",
  "24/24h",
  "SOS (se necessário)",
  "Conforme dor",
  "Ao deitar",
  "Em jejum",
  "Uso contínuo",
] as const;

// ── Impressão ────────────────────────────────────────────────────────────────

function buildReceituarioBody(data: ReceituarioData): string {
  const isAlta = data.type === "alta";
  const sector = data.patient_bed && data.patient_sector
    ? `${data.patient_bed} · ${data.patient_sector}`
    : data.patient_bed || data.patient_sector || "";

  const header = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr>
        <td style="padding:4px 0;font-size:11px;"><strong>Paciente:</strong> ${data.patient_name}</td>
        ${sector ? `<td style="padding:4px 0;font-size:11px;text-align:right;"><strong>Leito/Setor:</strong> ${sector}</td>` : ""}
      </tr>
    </table>
    <hr style="border:none;border-top:1px solid #cbd5e1;margin:0 0 16px;" />
  `;

  const itemsHtml = data.items.length === 0
    ? `<p style="font-size:11px;color:#94a3b8;font-style:italic;">Nenhum medicamento registrado.</p>`
    : data.items.map((item, idx) => `
      <div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px dashed #e2e8f0;">
        <div style="font-size:12px;font-weight:700;color:#0f172a;">${idx + 1}. ${item.name}</div>
        <div style="font-size:11px;color:#334155;margin-top:2px;padding-left:14px;">
          ${item.dose ? `<strong>Dose:</strong> ${item.dose} &nbsp;·&nbsp; ` : ""}
          ${item.route ? `<strong>Via:</strong> ${item.route} &nbsp;·&nbsp; ` : ""}
          ${item.frequency ? `<strong>Freq.:</strong> ${item.frequency} &nbsp;·&nbsp; ` : ""}
          ${item.duration ? `<strong>Duração:</strong> ${item.duration}` : ""}
        </div>
      </div>
    `).join("");

  const freeTextHtml = data.free_text ? `
    <div style="margin-top:18px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;margin-bottom:6px;">
        Orientações gerais
      </div>
      <div style="font-size:11px;color:#334155;white-space:pre-wrap;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;background:#f8fafc;">
        ${data.free_text}
      </div>
    </div>
  ` : "";

  const titleSection = `
    <div style="text-align:center;margin-bottom:18px;">
      <div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#0f172a;border:2px solid #0f172a;display:inline-block;padding:5px 20px;border-radius:4px;">
        ${isAlta ? "Receituário de Alta" : "Receituário Médico"}
      </div>
    </div>
  `;

  return titleSection + header + itemsHtml + freeTextHtml;
}

export async function printReceituario(
  data: ReceituarioData,
  hospitalName?: string,
): Promise<void> {
  const logoDataUrl = await prepareLogo();
  const bodyHtml = buildReceituarioBody(data);

  const html = buildNormaZeroDocument({
    title: data.type === "alta" ? "Receituário de Alta" : "Receituário Médico",
    subtitle: data.patient_name,
    sectorLabel: data.type === "alta" ? "Alta Hospitalar" : "Ambulatório",
    hospitalName: hospitalName || "Hospital Municipal Djalma Marques (Socorrão I)",
    docCodePrefix: data.type === "alta" ? "RX-ALTA" : "RX-AMB",
    bodyHtml,
    signatures: [
      {
        label: data.signed_by_name || "Médico Responsável",
        caption: data.signed_by_crm ? `CRM: ${data.signed_by_crm}` : undefined,
      },
    ],
    logoDataUrl,
    orientation: "portrait",
  });

  openPrintWindow(html);
}
