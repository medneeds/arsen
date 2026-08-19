/**
 * Módulo de Documentos Médicos — Atestado, Relatório e Termo/Declaração.
 *
 * Extraído do MedicalDocumentDialog para poder ser reaproveitado tanto na
 * emissão (live) quanto na reimpressão a partir do histórico — mesmo padrão
 * já usado em receituario.ts.
 */

import {
  buildNormaZeroDocument,
  openPrintWindow,
  prepareLogo,
} from "@/lib/printNormaZero";
import type { DocumentoMedicoData, DocumentoMedicoType } from "@/hooks/useDocumentoMedico";

const TYPE_META: Record<DocumentoMedicoType, { title: string; prefix: string }> = {
  atestado: { title: "Atestado médico", prefix: "ATEST" },
  relatorio: { title: "Relatório médico", prefix: "RELAT" },
  termo: { title: "Termo / declaração", prefix: "TERMO" },
};

const esc = (s: string | null | undefined) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");

function buildDocumentoMedicoBody(data: DocumentoMedicoData): string {
  const sector = data.patient_bed || data.patient_sector
    ? `${data.patient_bed || ""}${data.patient_bed && data.patient_sector ? " • " : ""}${data.patient_sector || ""}`
    : "";

  const patientLine = `
    <div style="border:1px solid #cbd5e1;border-radius:4pt;padding:6pt 10pt;margin-bottom:10pt;font-size:9pt;background:#f8fafc">
      <div><b>PACIENTE:</b> ${esc((data.patient_name || "").toUpperCase())}</div>
      ${sector ? `<div><b>LEITO:</b> ${esc(sector)}</div>` : ""}
      ${data.cid ? `<div><b>CID-10:</b> ${esc(data.cid)}</div>` : ""}
    </div>`;

  return `${patientLine}
    <div style="font-size:10pt;line-height:1.55;text-align:justify;white-space:pre-wrap;padding:4pt 2pt">${esc(data.body)}</div>
  `;
}

export async function printDocumentoMedico(
  data: DocumentoMedicoData,
  opts: {
    hospitalName?: string;
    doctorName?: string;
    doctorCrm?: string;
    doctorSpecialty?: string;
  } = {},
): Promise<void> {
  const logoDataUrl = await prepareLogo();
  const bodyHtml = buildDocumentoMedicoBody(data);
  const { title, prefix } = TYPE_META[data.type];
  const subtitle = data.type === "atestado" && data.days ? `Afastamento de ${data.days} dia(s)` : undefined;

  const html = buildNormaZeroDocument({
    title,
    subtitle,
    sectorLabel: "Assistência Médica",
    hospitalName: opts.hospitalName || "Hospital Municipal Djalma Marques (Socorrão I)",
    docCodePrefix: prefix,
    bodyHtml,
    signatures: [
      {
        label: (opts.doctorName || data.signed_by_name || "MÉDICO ASSISTENTE").toUpperCase(),
        caption: [
          (opts.doctorCrm || data.signed_by_crm) && `CRM ${opts.doctorCrm || data.signed_by_crm}`,
          opts.doctorSpecialty,
        ].filter(Boolean).join(" • ") || "Carimbo e assinatura",
      },
    ],
    logoDataUrl,
  });

  openPrintWindow(html, "Preparando documento…");
}
