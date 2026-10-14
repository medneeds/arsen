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
import { resolveHeaderPatient, fmtIsoDate } from "@/lib/headerPatient";
import { formatAge } from "@/lib/patientAge";
import type { DocumentoMedicoData, DocumentoMedicoType } from "@/hooks/useDocumentoMedico";

const TYPE_META: Record<DocumentoMedicoType, { title: string; prefix: string }> = {
  atestado: { title: "Atestado médico", prefix: "ATEST" },
  relatorio: { title: "Relatório médico", prefix: "RELAT" },
  termo: { title: "Termo / declaração", prefix: "TERMO" },
};

const esc = (s: string | null | undefined) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");

function buildDocumentoMedicoBody(data: DocumentoMedicoData): string {
  // A identificacao do paciente (e o CID) agora vive no cabecalho padronizado
  // (modelo documental); o corpo e so o texto do documento.
  return `
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
  const subtitle = data.type === "atestado" && data.days ? `Afastamento de ${data.days} ${(data.days) === 1 ? 'dia' : 'dias'}` : undefined;
  const cidStr = data.cid ? data.cid.split(" - ").slice(0, 2).join(" — ") : null;
  // Cabecalho a partir do SNAPSHOT gravado na emissao (prontuario, nascimento,
  // sexo, mae, CPF/CNS, atendimento...). resolveHeaderPatient so completa o que
  // estiver vazio e atualiza leito/setor ao vivo — entao, apos alta/migracao,
  // os dados de identificacao continuam saindo do retrato original.
  const patient = await resolveHeaderPatient(data.patient_id, {
    name: (data.patient_name || "").toUpperCase(),
    bed: data.patient_bed,
    sector: data.patient_sector,
    record: data.patient_medical_record,
    atendimento: data.patient_atendimento,
    birthDate: fmtIsoDate(data.patient_birth_date),
    age: data.patient_age || formatAge(data.patient_birth_date),
    sex: data.patient_sex,
    motherName: data.patient_mother_name,
    cpf: data.patient_cpf,
    cns: data.patient_cns,
    phone: data.patient_phone,
    address: data.patient_address,
  });

  const html = buildNormaZeroDocument({
    title,
    standardHeader: {
      model: "documental",
      title,
      complement: subtitle,
      emission: "",
      patient,
      extras: [["CID-10", cidStr]],
    },
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
