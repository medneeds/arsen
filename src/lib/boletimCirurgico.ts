/**
 * Modulo de impressao do Boletim Cirurgico.
 *
 * Mesmo padrao de documentoMedico.ts / receituario.ts: extrai a geracao do
 * HTML para poder ser reaproveitado tanto na emissao (live, pelo dialogo)
 * quanto na reimpressao a partir da timeline de documentos do paciente.
 *
 * O boletim e um documento medico persistido em `altas`
 * (tipo:"boletim_cirurgico"); aqui so se renderiza o impresso no timbrado
 * Norma Zero.
 */

import {
  buildNormaZeroDocument,
  openPrintWindow,
  prepareLogo,
} from "@/lib/printNormaZero";
import { resolveHeaderPatient, fmtIsoDate } from "@/lib/headerPatient";
import {
  mapBoletimRow,
  type BoletimCirurgicoData,
  type BoletimCarater,
  type BoletimDestino,
} from "@/hooks/useBoletimCirurgico";
import type { Tables } from "@/integrations/supabase/types";

const CARATER_LABEL: Record<BoletimCarater, string> = {
  eletivo: "Eletivo",
  urgencia: "Urgencia",
  emergencia: "Emergencia",
};

const DESTINO_LABEL: Record<BoletimDestino, string> = {
  rpa: "RPA (sala de recuperacao pos-anestesica)",
  uti: "UTI",
  enfermaria: "Enfermaria",
};

const esc = (s: string | null | undefined) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");

/** Formata um datetime-local (ou ISO) para dd/MM/yyyy HH:mm, sem quebrar se vazio/invalido. */
function fmtDateTime(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return v;
  }
}

function buildBoletimBody(data: BoletimCirurgicoData): string {
  // A identificacao do paciente (e o Carater) vive no cabecalho padronizado.

  const inicioFmt = fmtDateTime(data.data_hora_inicio);
  const fimFmt = fmtDateTime(data.data_hora_fim);

  // Bloco de identificacao cirurgica (equipe, anestesia, tempos).
  const cirurgiaTable = `
    <table class="nz" style="margin-bottom:10pt">
      <tbody>
        <tr>
          <th style="width:22%">Cirurgiao principal</th>
          <td colspan="3">${esc(data.cirurgiao_principal || "—")}</td>
        </tr>
        <tr>
          <th>Auxiliares</th>
          <td colspan="3">${esc(data.auxiliares || "—")}</td>
        </tr>
        <tr>
          <th>Anestesista</th>
          <td style="width:28%">${esc(data.anestesista || "—")}</td>
          <th style="width:18%">Tipo de anestesia</th>
          <td>${esc(data.tipo_anestesia || "—")}</td>
        </tr>
        <tr>
          <th>Inicio</th>
          <td>${esc(inicioFmt || "—")}</td>
          <th>Termino</th>
          <td>${esc(fimFmt || "—")}</td>
        </tr>
        <tr>
          <th>Sangramento estimado</th>
          <td>${esc(data.sangramento_estimado || "—")}</td>
          <th>Destino pos-operatorio</th>
          <td>${esc(data.destino_pos_operatorio ? DESTINO_LABEL[data.destino_pos_operatorio] : "—")}</td>
        </tr>
      </tbody>
    </table>`;

  const section = (title: string, value: string | null | undefined) => `
    <h2 class="nz-section">${title}</h2>
    <div style="font-size:9.5pt;line-height:1.5;text-align:justify;white-space:pre-wrap;padding:4pt 2pt 8pt">${esc(value && value.trim() ? value : "—")}</div>`;

  return `${cirurgiaTable}
    ${section("Procedimento proposto", data.procedimento_proposto)}
    ${section("Procedimento realizado", data.procedimento_realizado)}
    ${section("Achados operatorios", data.achados_operatorios)}
    ${section("Intercorrencias", data.intercorrencias)}
    ${section("Materiais / OPME", data.materiais_opme)}
  `;
}

/**
 * Imprime o Boletim Cirurgico. Aceita tanto o shape ja mapeado
 * (BoletimCirurgicoData) quanto a linha crua de `altas` (reimpressao a partir
 * da timeline, onde `raw` e a linha do banco) — nesse caso mapeia internamente.
 */
export async function printBoletimCirurgico(
  input: BoletimCirurgicoData | Tables<"altas">,
  opts: {
    hospitalName?: string;
    doctorName?: string;
    doctorCrm?: string;
    doctorSpecialty?: string;
  } = {},
): Promise<void> {
  // Se vier a linha crua de altas (tem `conteudo`, ausente em BoletimCirurgicoData),
  // mapeia; senao usa direto. O `in` discrimina a uniao sem `any`.
  const data: BoletimCirurgicoData =
    "conteudo" in input ? mapBoletimRow(input) : input;

  const logoDataUrl = await prepareLogo();
  const bodyHtml = buildBoletimBody(data);
  const patient = await resolveHeaderPatient(data.internacao_id, {
    name: (data.patient_name || "").toUpperCase(),
    bed: data.patient_bed,
    sector: data.patient_sector,
    age: data.patient_age,
    birthDate: fmtIsoDate(data.patient_birth_date),
    record: data.patient_medical_record,
  });

  const html = buildNormaZeroDocument({
    title: "Boletim cirurgico",
    standardHeader: {
      model: "documental",
      title: "Boletim cirúrgico",
      emission: "",
      patient,
      extras: [["Caráter", data.carater ? CARATER_LABEL[data.carater] : null]],
    },
    sectorLabel: "Centro Cirurgico",
    hospitalName: opts.hospitalName || "Hospital Municipal Djalma Marques (Socorrao I)",
    docCodePrefix: "BOLCIR",
    bodyHtml,
    signatures: [
      {
        label: (opts.doctorName || data.signed_by_name || data.cirurgiao_principal || "CIRURGIAO RESPONSAVEL").toUpperCase(),
        caption: [
          (opts.doctorCrm || data.signed_by_crm) && `CRM ${opts.doctorCrm || data.signed_by_crm}`,
          opts.doctorSpecialty,
        ].filter(Boolean).join(" • ") || "Carimbo e assinatura",
      },
    ],
    logoDataUrl,
  });

  openPrintWindow(html, "Preparando boletim cirurgico…");
}
