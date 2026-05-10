/**
 * Impressão isolada de Prescrição Extra (anexo) no padrão Norma Zero.
 * Gera apenas os itens marcados como "isExtra=true" em folha A4 separada,
 * referenciando a prescrição diária à qual o extra está vinculado.
 */
import { buildNormaZeroDocument, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";

export interface ExtraPrintItem {
  id: string;
  name: string;
  presentation?: string;
  dose: string;
  route: string;
  posology: string;
  schedule?: string;
  instructions?: string;
  flags?: readonly string[];
  highAlert?: boolean;
  category?: string;
}

export interface ExtraPrintPatient {
  name: string;
  bed?: string;
  unit?: string;
  age?: string;
  record?: string;
  weight?: string;
  allergies?: string;
}

export interface ExtraPrintOptions {
  patient: ExtraPrintPatient;
  items: ExtraPrintItem[];
  parentPrescriptionId?: string | null;
  parentPrescriptionVersion?: number | null;
  hospitalName?: string;
  sectorLabel?: string;
  doctorName?: string;
  doctorCrm?: string;
  categoryLabel?: string;
}

const escape = (s: string | undefined | null) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

export async function printExtraPrescription(opts: ExtraPrintOptions) {
  const {
    patient,
    items,
    parentPrescriptionId,
    parentPrescriptionVersion,
    hospitalName,
    sectorLabel = "Prescrição Médica — Anexo Extra",
    doctorName,
    doctorCrm,
    categoryLabel,
  } = opts;

  const logoDataUrl = await prepareLogo();

  const itemsHtml = items.length
    ? items
        .map(
          (it, idx) => `
        <tr>
          <td class="nz-c" style="width:24pt;font-weight:600;color:#475569">${idx + 1}</td>
          <td>
            <div style="font-weight:700;color:#0a1628;font-size:9pt">
              ${it.highAlert ? '<span style="display:inline-block;background:#fee2e2;color:#991b1b;font-size:6.5pt;font-weight:800;padding:0.5pt 4pt;border-radius:2pt;margin-right:4pt;border:0.5pt solid #fecaca">MAV</span>' : ""}
              ${escape(it.name)}
              ${it.presentation && it.presentation !== "-" ? `<span style="color:#64748b;font-weight:500;font-size:8pt"> — ${escape(it.presentation)}</span>` : ""}
              <span style="background:#fff7ed;color:#9a3412;font-size:6.5pt;font-weight:800;padding:0.5pt 4pt;border-radius:2pt;margin-left:4pt;border:0.5pt solid #fdba74;letter-spacing:0.3pt">EXTRA</span>
            </div>
            ${it.instructions ? `<div style="font-size:7.5pt;color:#475569;font-style:italic;margin-top:1.5pt">${escape(it.instructions)}</div>` : ""}
          </td>
          <td class="nz-c" style="width:60pt;font-weight:600">${escape(it.dose)}</td>
          <td class="nz-c" style="width:55pt">${escape(it.route)}</td>
          <td class="nz-c" style="width:55pt">${escape(it.posology)}</td>
          <td class="nz-c" style="width:60pt">${escape(it.schedule || "—")}</td>
          <td class="nz-c" style="width:60pt;font-size:7.5pt">${(it.flags || []).join(", ").toUpperCase() || "—"}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="7" class="nz-empty">Nenhum item extra para imprimir</td></tr>`;

  const parentRef = parentPrescriptionId
    ? `Anexo à prescrição #${parentPrescriptionId.slice(0, 8).toUpperCase()}${parentPrescriptionVersion ? ` (v${parentPrescriptionVersion})` : ""}`
    : "Anexo avulso (sem prescrição diária vinculada)";

  const bodyHtml = `
    <table class="nz" style="margin-bottom:8pt;border:1pt solid #e2e8f0;border-radius:3pt;overflow:hidden">
      <tr>
        <th style="width:25%">Paciente</th>
        <td>${escape(patient.name) || "—"}</td>
        <th style="width:15%">Leito</th>
        <td>${escape(patient.bed) || "—"}</td>
      </tr>
      <tr>
        <th>Idade</th>
        <td>${escape(patient.age) || "—"}</td>
        <th>Peso</th>
        <td>${escape(patient.weight) || "—"}</td>
      </tr>
      <tr>
        <th>Prontuário</th>
        <td>${escape(patient.record) || "—"}</td>
        <th>Alergias</th>
        <td style="${patient.allergies ? "color:#b91c1c;font-weight:600" : ""}">${escape(patient.allergies) || "Nega"}</td>
      </tr>
      <tr>
        <th>Vínculo</th>
        <td colspan="3" style="font-weight:600;color:#0054A6">${escape(parentRef)}</td>
      </tr>
      ${categoryLabel ? `<tr><th>Tipo</th><td colspan="3"><span style="background:#fff7ed;color:#9a3412;font-size:8pt;font-weight:700;padding:1pt 6pt;border-radius:3pt;border:0.5pt solid #fdba74">${escape(categoryLabel)}</span></td></tr>` : ""}
    </table>

    <h2 class="nz-section">Itens Extras Prescritos (${items.length})</h2>
    <table class="nz">
      <thead>
        <tr>
          <th class="nz-c">#</th>
          <th>Medicação</th>
          <th class="nz-c">Dose</th>
          <th class="nz-c">Via</th>
          <th class="nz-c">Posologia</th>
          <th class="nz-c">Aprazamento</th>
          <th class="nz-c">Sinalizações</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div style="margin-top:10pt;padding:6pt 8pt;background:#fefce8;border:0.5pt solid #fde68a;border-radius:3pt;font-size:8pt;color:#713f12">
      <b>OBSERVAÇÃO:</b> Esta folha é um <b>ANEXO</b> à prescrição médica diária do paciente.
      Itens marcados como "Agora" não são renovados automaticamente; itens com aprazamento
      são incorporados à rotina na próxima renovação.
    </div>
  `;

  const html = buildNormaZeroDocument({
    title: "Prescrição Extra — Anexo",
    subtitle: categoryLabel || "Itens avulsos do plantão",
    sectorLabel,
    hospitalName,
    docCodePrefix: "PRESC-EXT",
    bodyHtml,
    signatures: [
      {
        label: doctorName ? `Dr(a). ${doctorName}` : "Médico Responsável",
        caption: doctorCrm ? `CRM ${doctorCrm}` : "Carimbo e assinatura",
      },
      { label: "Enfermagem — Conferência", caption: "Visto e horário" },
    ],
    logoDataUrl,
    orientation: "portrait",
  });

  openPrintWindow(html, "Preparando prescrição extra…");
}
