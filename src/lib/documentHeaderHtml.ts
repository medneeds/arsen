/**
 * Cabecalho padronizado — renderizador HTML (janelas de impressao).
 * Puro: recebe a marca (logo, linhas institucionais, cores) por parametro, para
 * poder ser testado sem depender dos assets do app. O React equivalente fica em
 * components/DocumentHeader.tsx e desenha o MESMO layout (documentHeaderLayout.ts).
 */
import type { HeaderLayout, HeaderCell } from "./documentHeaderLayout.ts";

export interface HeaderBrand {
  /** Logo ja em data URL (ou URL absoluta). */
  logoSrc?: string;
  line1: string;
  line2: string;
  line3: string;
  colors: { red: string; orange: string; yellow: string; green: string; blue: string };
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Estilos compartilhados (HTML e React usam os mesmos valores). */
export const HEADER_STYLE = {
  ink: "#0a1628",
  inkSoft: "#475569",
  inkMuted: "#94a3b8",
  line: "#cbd5e1",
  band: "#1f4e9c",
  cellBorder: "0.5px solid #94a3b8",
  labelBg: "#f1f5f9",
  labelInk: "#334155",
  allergyOkInk: "#166534",
  allergyOkBg: "#f0fdf4",
  allergyAlertInk: "#991b1b",
  allergyAlertBg: "#fef2f2",
  allergyLabelInk: "#dc2626",
} as const;

const S = HEADER_STYLE;
const cell = `border:${S.cellBorder};padding:3px 6px;font-size:7.5pt;line-height:1.3;vertical-align:top`;
const labelCell = `${cell};font-weight:700;font-size:6.2pt;background:${S.labelBg};color:${S.labelInk};text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap`;

function valueStyle(c: HeaderCell): string {
  let st = cell;
  if (c.strong) st += ";font-weight:700";
  if (c.label === "Paciente") st += ";font-weight:800;font-size:8.6pt;letter-spacing:-0.01em";
  if (c.tone === "allergyOk") st += `;color:${S.allergyOkInk};background:${S.allergyOkBg}`;
  if (c.tone === "allergyAlert") st += `;color:${S.allergyAlertInk};background:${S.allergyAlertBg}`;
  return st;
}

export function renderHeaderHtml(layout: HeaderLayout, brand: HeaderBrand): string {
  const logo = brand.logoSrc
    ? `<img src="${esc(brand.logoSrc)}" alt="" style="width:40px;height:40px;object-fit:contain;flex-shrink:0"/>`
    : `<div style="width:40px;height:40px;background:${brand.colors.blue};border-radius:6px;flex-shrink:0"></div>`;
  const c = brand.colors;
  const rows = layout.rows
    .map(
      (row) =>
        "<tr>" +
        row
          .map((cl) => {
            const lab = `<td style="${labelCell}${cl.alertLabel ? `;color:${S.allergyLabelInk}` : ""}">${esc(cl.label)}</td>`;
            const span = cl.span && cl.span > 1 ? ` colspan="${cl.span}"` : "";
            const sub = cl.sub ? `<div style="font-size:6.5pt;font-weight:400;color:${S.labelInk};margin-top:1px">${esc(cl.sub)}</div>` : "";
            return `${lab}<td style="${valueStyle(cl)}"${span}>${esc(cl.value)}${sub}</td>`;
          })
          .join("") +
        "</tr>",
    )
    .join("");
  const complement = layout.complement
    ? `<span style="position:absolute;right:9px;top:50%;transform:translateY(-50%);font-size:7pt;letter-spacing:0.4px;text-transform:uppercase;opacity:0.92">${esc(layout.complement)}</span>`
    : "";
  return `<div class="dh-root" style="font-family:'Helvetica Neue','Segoe UI',Inter,Arial,sans-serif;color:#1e293b">
  <div style="display:flex;align-items:center;gap:10px;padding-bottom:4px">${logo}
    <div style="flex:1;text-align:center">
      <div style="font-size:6.5pt;font-weight:600;color:${S.inkSoft};letter-spacing:0.5px;text-transform:uppercase">${esc(brand.line1)} · ${esc(brand.line2)}</div>
      <div style="font-size:10pt;font-weight:800;color:${S.ink};letter-spacing:0.7px;text-transform:uppercase;margin-top:2px;line-height:1.15">${esc(brand.line3)}</div>
    </div>
    <div style="min-width:120px;text-align:right;border-left:1px solid ${S.line};padding-left:10px">
      <div style="font-size:6pt;color:${S.inkMuted};letter-spacing:0.8px;text-transform:uppercase;font-weight:700">Emissão</div>
      <div style="font-size:9pt;font-weight:800;color:${S.ink};margin-top:2px;letter-spacing:0.3px">${esc(layout.emission)}</div>
    </div>
  </div>
  <div style="display:flex;height:3px"><div style="flex:1;background:${c.red}"></div><div style="flex:1;background:${c.orange}"></div><div style="flex:1;background:${c.yellow}"></div><div style="flex:1;background:${c.green}"></div><div style="flex:1;background:${c.blue}"></div></div>
  <div style="background:${S.band};color:#fff;position:relative;text-align:center;padding:5px 9px;margin-top:4px;margin-bottom:${layout.rows.length ? "0" : "6px"}">
    <b style="font-size:8.6pt;letter-spacing:0.9px;text-transform:uppercase">${esc(layout.title)}</b>${complement}
  </div>
  ${layout.rows.length ? `<table style="width:100%;border-collapse:collapse;margin-bottom:6pt;page-break-inside:avoid"><tbody>${rows}</tbody></table>` : ""}
</div>`;
}

/** Rodape do documento: linha do paciente (rastreabilidade por folha) + codigo do documento. */
export function renderFooterHtml(opts: { patientLine?: string; documentCode: string; leftLabel: string; centerLabel: string; stamp: string }): string {
  return `<div style="font-family:'Helvetica Neue','Segoe UI',Inter,Arial,sans-serif;margin-top:8px">
  ${opts.patientLine ? `<div style="font-size:6pt;font-weight:600;color:#64748b;text-align:center;border-top:0.5px dotted ${S.line};padding-top:2px;letter-spacing:0.2px">${esc(opts.patientLine)}</div>` : ""}
  <div style="display:flex;justify-content:space-between;font-size:6pt;color:#64748b;border-top:1px solid #e2e8f0;padding-top:3px;margin-top:2px">
    <span>Documento: ${esc(opts.documentCode)}</span><span>${esc(opts.leftLabel)} · ${esc(opts.centerLabel)}</span><span>${esc(opts.stamp)}</span>
  </div></div>`;
}
