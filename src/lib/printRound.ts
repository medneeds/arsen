/**
 * Impressão do Round Diário Multiprofissional via janela popup.
 * Suporta múltiplos pacientes (uma página por leito) e modo "em branco" para
 * preenchimento manual à beira-leito.
 */
import { ROUND_SECTIONS, STATUS_OPTIONS, type RoundStatus } from "@/data/roundChecklistSchema";
import { openPrintWindow, prepareLogo, buildStandardHeaderHtml } from "@/lib/printNormaZero";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { format } from "date-fns";

export interface RoundPrintItem {
  patientName: string;
  patientSector: string;
  patientBed: string;
  patientAge?: string | null;
  patientRecord?: string | null;
  patientDiagnoses?: string[] | null;  // hipóteses diagnósticas
  patientAllergies?: string[] | null;  // alergias
  roundDate: string;
  responses?: Record<string, { status: RoundStatus | null; observation: string }>;
  goals?: Record<string, string>;
  observations?: string;
}

const escape = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function renderPage(it: RoundPrintItem, blank: boolean, logoDataUrl: string): string {
  const formattedDate = (() => {
    try {
      return format(new Date(it.roundDate + "T12:00:00"), "dd/MM/yyyy");
    } catch {
      return it.roundDate;
    }
  })();

  const legend = STATUS_OPTIONS.map((s) => `<span><b>${s.code}</b> = ${s.label}</span>`).join(
    " &nbsp;·&nbsp; ",
  );

  const sectionsHtml = ROUND_SECTIONS.map((section) => {
    const rows = section.items
      .map((item) => {
        const key = `${section.code}_${item.id}`;
        const resp = !blank ? it.responses?.[key] : undefined;
        return `<tr>
          <td class="c">${item.id}</td>
          <td>${escape(item.text)}</td>
          <td class="c b">${escape(resp?.status || "")}</td>
          <td class="obs">${escape(resp?.observation || "")}</td>
        </tr>`;
      })
      .join("");
    const goal = (!blank && it.goals?.[section.code]) || "____________________________________________";
    return `<table class="sec">
      <thead>
        <tr><th colspan="4" class="sec-title">${escape(section.title)}</th></tr>
        <tr>
          <th class="c" style="width:5%">Nº</th>
          <th style="width:55%">Item</th>
          <th class="c" style="width:8%">Status</th>
          <th style="width:32%">Observação</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr><td colspan="4" class="goal"><b>Meta do dia:</b> ${escape(goal)}</td></tr>
      </tbody>
    </table>`;
  }).join("");

  // Cabecalho padronizado (modelo assistencial, grade enxuta para caber em 1 folha).
  const diagnoses = it.patientDiagnoses?.filter(Boolean) ?? [];
  const allergies = it.patientAllergies?.filter(Boolean) ?? [];
  const header = buildStandardHeaderHtml(
    {
      model: "assistencial",
      dense: true,
      title: `Round diário multiprofissional${blank ? " — folha de preenchimento" : ""}`,
      complement: `Data do round: ${formattedDate}`,
      emission: "",
      patient: {
        name: it.patientName,
        bed: it.patientBed,
        sector: getSectorDisplayLabel(it.patientSector),
        record: it.patientRecord,
        age: it.patientAge,
        allergies: allergies.join(" • "),
      },
      extras: [["Diagnósticos", diagnoses.join(" • ")]],
    },
    logoDataUrl,
  );

  return `<section class="round-page">
    ${header}
    <div class="legend">${legend}</div>
    ${sectionsHtml}
    <div class="obsbox"><b>Observações importantes:</b> ${escape((!blank && it.observations) || "")}</div>
  </section>`;
}

export async function printRoundDocument(items: RoundPrintItem[], blank = false) {
  if (!items.length) return;
  const logoDataUrl = await prepareLogo();
  const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
  const pages = items.map((it) => renderPage(it, blank, logoDataUrl)).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Round Multiprofissional</title>
<style>
  @page { size: A4 portrait; margin: 6mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, sans-serif; font-size: 7pt; line-height: 1.3; color: #000; background: #fff; }
  .round-page { padding: 4mm 6mm; page-break-after: always; }
  .round-page:last-child { page-break-after: auto; }
  table { border-collapse: collapse; width: 100%; }
  .legend { display: flex; gap: 4mm; flex-wrap: wrap; margin: 3mm 0; font-size: 6.5pt; }
  table.sec { margin-bottom: 2mm; page-break-inside: avoid; }
  table.sec th, table.sec td { border: 0.5px solid #000; padding: 1mm 2mm; font-size: 7pt; vertical-align: top; }
  table.sec th { background: #e5e7eb; text-align: left; }
  table.sec th.sec-title { background: #d1d5db; font-size: 7.5pt; }
  table.sec .c { text-align: center; }
  table.sec .b { font-weight: bold; }
  table.sec .obs { font-size: 6.5pt; }
  table.sec .goal { font-size: 6.5pt; background: #fafafa; }
  .obsbox { border: 0.5px solid #000; padding: 2mm; margin-top: 2mm; min-height: 12mm; font-size: 7pt; page-break-inside: avoid; }
  .footer { margin-top: 4mm; font-size: 6pt; color: #555; text-align: center; border-top: 0.5px solid #999; padding-top: 2mm; }
</style></head>
<body>
  ${pages}
  <div class="footer">Documento gerado eletronicamente em ${generatedAt} • Round Diário Multiprofissional • Socorrão I</div>
  <script>window.onload = () => { setTimeout(() => { window.focus(); window.print(); }, 350); };</script>
</body></html>`;

  const w = openPrintWindow(html, "Preparando Round Multiprofissional…");
  if (!w) {
    alert("Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está desativado.");
  }
}
