/**
 * Impressão do Round Diário Multiprofissional via janela popup.
 * Suporta múltiplos pacientes (uma página por leito) e modo "em branco" para
 * preenchimento manual à beira-leito.
 */
import { ROUND_SECTIONS, STATUS_OPTIONS, type RoundStatus } from "@/data/roundChecklistSchema";
import { openPrintWindow } from "@/lib/printNormaZero";
import { format } from "date-fns";

export interface RoundPrintItem {
  patientName: string;
  patientSector: string;
  patientBed: string;
  patientAge?: string | null;
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

function renderPage(it: RoundPrintItem, blank: boolean): string {
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

  return `<section class="round-page">
    <header class="hdr">
      <div class="hosp">Hospital Municipal Djalma Marques – Socorrão I</div>
      <div class="title">ROUND DIÁRIO MULTIPROFISSIONAL${blank ? " — FOLHA DE PREENCHIMENTO" : ""}</div>
    </header>
    <table class="ident">
      <tbody>
        <tr>
          <td class="lbl">Paciente</td><td>${escape(it.patientName)}</td>
          <td class="lbl">Data</td><td>${formattedDate}</td>
          <td class="lbl">Idade</td><td>${escape(it.patientAge || "")}</td>
        </tr>
        <tr>
          <td class="lbl">Setor</td><td>${escape(it.patientSector)}</td>
          <td class="lbl">Leito</td><td colspan="3">${escape(it.patientBed)}</td>
        </tr>
      </tbody>
    </table>
    <div class="legend">${legend}</div>
    ${sectionsHtml}
    <div class="obsbox"><b>Observações importantes:</b> ${escape((!blank && it.observations) || "")}</div>
  </section>`;
}

export function printRoundDocument(items: RoundPrintItem[], blank = false) {
  if (!items.length) return;
  const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
  const pages = items.map((it) => renderPage(it, blank)).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Round Multiprofissional</title>
<style>
  @page { size: A4 portrait; margin: 6mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, sans-serif; font-size: 7pt; line-height: 1.3; color: #000; background: #fff; }
  .round-page { padding: 4mm 6mm; page-break-after: always; }
  .round-page:last-child { page-break-after: auto; }
  .hdr { text-align: center; border-bottom: 1px solid #000; padding-bottom: 3mm; margin-bottom: 3mm; }
  .hdr .hosp { font-size: 8pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .hdr .title { font-size: 10pt; font-weight: bold; margin-top: 2mm; }
  table { border-collapse: collapse; width: 100%; }
  .ident td { border: 0.5px solid #000; padding: 1.5mm 2mm; font-size: 7pt; }
  .ident td.lbl { font-weight: bold; background: #f3f4f6; width: 12%; }
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
