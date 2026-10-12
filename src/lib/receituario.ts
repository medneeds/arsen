/**
 * Módulo de Receituário — Alta hospitalar e Ambulatorial
 *
 * Interface estruturada de medicamentos com texto livre ao final.
 * Impressão via Norma Zero (timbrado institucional HMDM).
 */

import {
  buildNormaZeroDocument,
  buildStandardHeaderHtml,
  openPrintWindow,
  prepareLogo,
} from "@/lib/printNormaZero";
import { resolveHeaderPatient } from "@/lib/headerPatient";
import type { HeaderInput } from "@/lib/documentHeaderLayout";
import { isBlankReceituario, buildBlankReceituarioHtml } from "@/lib/receituarioBlank";

// ── Tipos ───────────────────────────────────────────────────────────────────

export type ReceituarioType = "alta" | "ambulatorial" | "simples" | "controle_especial";

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

const TYPE_LABELS: Record<ReceituarioType, { title: string; sectorLabel: string; docPrefix: string; complement?: string }> = {
  alta: { title: "Receituário de Alta", sectorLabel: "Alta Hospitalar", docPrefix: "RX-ALTA" },
  ambulatorial: { title: "Receituário Médico", sectorLabel: "Ambulatório", docPrefix: "RX-AMB", complement: "Receituário ambulatorial" },
  simples: { title: "Receituário Médico", sectorLabel: "Assistência Médica", docPrefix: "RECEIT", complement: "Receituário simples" },
  controle_especial: { title: "Receituário de Controle Especial", sectorLabel: "Assistência Médica", docPrefix: "RECCE", complement: "Portaria SVS/MS nº 344/1998 · 2 vias" },
};

function buildReceituarioBody(data: ReceituarioData): string {
  // Receituario simples em branco (sem itens, so texto): corpo e apenas o texto digitado.
  const blank = data.type === "simples" && isBlankReceituario(data.items, data.free_text);
  // A identificação do paciente e o nome do documento vivem no cabeçalho padronizado.

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

  const especialNote = data.type === "controle_especial" ? `
    <div style="margin-top:14px;padding:8px 10px;border:1px dashed #be123c;border-radius:4px;font-size:9.5px;color:#9f1239;background:#fff1f2;">
      <strong>Receituário de Controle Especial</strong> — Portaria SVS/MS nº 344/1998. Validade: 30 dias
      a partir da data de emissão. Emitido em 2 (duas) vias: 1ª via retida pela farmácia, 2ª via do paciente.
    </div>
  ` : "";

  if (blank) return buildBlankReceituarioHtml(data.free_text ?? "");

  return itemsHtml + freeTextHtml + especialNote;
}

export async function printReceituario(
  data: ReceituarioData,
  hospitalName?: string,
): Promise<void> {
  const logoDataUrl = await prepareLogo();
  const baseBody = buildReceituarioBody(data);
  const { title, sectorLabel, docPrefix, complement } = TYPE_LABELS[data.type];
  const isControle = data.type === "controle_especial";

  // Controle especial: identificação completa (modelo assistencial); os demais:
  // modelo documental (cadastro completo, sem alergias).
  const patient = await resolveHeaderPatient(data.patient_id, {
    name: (data.patient_name || "").toUpperCase(),
    bed: data.patient_bed,
    sector: data.patient_sector,
  });
  const headerInput: HeaderInput = {
    model: isControle ? "assistencial" : "documental",
    title,
    complement,
    emission: "",
    patient,
  };

  // Controle especial sai sempre em 2 vias (farmácia + paciente), na MESMA folha,
  // cada uma com o cabeçalho padronizado completo.
  const bodyHtml = isControle
    ? `<div style="border-bottom:2px dashed #94a3b8;padding-bottom:8px;margin-bottom:8px;">${buildStandardHeaderHtml(headerInput, logoDataUrl)}<div style="font-size:8px;color:#64748b;margin-bottom:4px;"><b>1ª VIA — FARMÁCIA</b></div>${baseBody}</div>
       <div>${buildStandardHeaderHtml(headerInput, logoDataUrl)}<div style="font-size:8px;color:#64748b;margin-bottom:4px;"><b>2ª VIA — PACIENTE</b></div>${baseBody}</div>`
    : baseBody;

  const html = buildNormaZeroDocument({
    title,
    standardHeader: headerInput,
    suppressTopHeader: isControle,
    sectorLabel,
    hospitalName: hospitalName || "Hospital Municipal Djalma Marques (Socorrão I)",
    docCodePrefix: docPrefix,
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
