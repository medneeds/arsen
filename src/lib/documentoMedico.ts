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
  const leitoStr = [data.patient_bed, data.patient_sector].filter(Boolean).join(" · ");

  const birthFmt = data.patient_birth_date
    ? (() => { try { return new Date(data.patient_birth_date + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return data.patient_birth_date; } })()
    : null;

  const cidStr = data.cid ? data.cid.split(" - ").slice(0, 2).join(" — ") : null;

  // Cabeçalho padrão Arsen — mesmo layout de tabela da Guia ATM e Evolução
  const patientLine = `
    <table class="nz" style="margin-bottom:10pt">
      <tbody>
        <tr>
          <th style="width:14%">Paciente</th>
          <td style="width:36%"><strong>${esc((data.patient_name || "").toUpperCase())}</strong></td>
          <th style="width:10%">Leito</th>
          <td colspan="3"><strong>${esc(leitoStr || "—")}</strong></td>
        </tr>
        <tr>
          <th>Idade</th>
          <td>${esc(data.patient_age || "—")}</td>
          <th>Prontuário</th>
          <td colspan="3">${esc(data.patient_medical_record || "—")}</td>
        </tr>
        <tr>
          <th>Data de nascimento</th>
          <td>${esc(birthFmt || "—")}</td>
          <th>CID-10</th>
          <td colspan="3">${esc(cidStr || "—")}</td>
        </tr>
      </tbody>
    </table>`;

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
