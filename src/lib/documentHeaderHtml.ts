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
  /** Sigla exibida quando o logo nao carrega (ex.: HMDM). */
  abbr?: string;
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
/** Tamanhos do cabecalho: normal (folha inteira) e compacto (2 vias lado a lado, paisagem). */
const SIZES = {
  normal: { cell: "3px 6px", val: "7.5pt", lab: "6.2pt", name: "8.6pt", sub: "6.5pt", logo: 40, line1: "6.5pt", line3: "10pt", emLab: "6pt", emVal: "9pt", band: "8.6pt", bandPad: "5px 9px", cmp: "7pt", gap: "10px", emW: "120px", bar: 3, after: "6pt" },
  compact: { cell: "1.5px 3px", val: "6pt", lab: "5pt", name: "7pt", sub: "5pt", logo: 28, line1: "5pt", line3: "7.5pt", emLab: "4.5pt", emVal: "6.5pt", band: "7pt", bandPad: "3px 6px", cmp: "5pt", gap: "6px", emW: "78px", bar: 2.5, after: "4pt" },
} as const;
type Sz = (typeof SIZES)[keyof typeof SIZES];

const cellOf = (z: Sz) => `border:${S.cellBorder};padding:${z.cell};font-size:${z.val};line-height:1.3;vertical-align:top`;
const labelCellOf = (z: Sz) => `${cellOf(z)};font-weight:700;font-size:${z.lab};background:${S.labelBg};color:${S.labelInk};text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap`;

function valueStyle(c: HeaderCell, z: Sz): string {
  let st = cellOf(z);
  if (c.strong) st += ";font-weight:700";
  if (c.label === "Paciente") st += `;font-weight:800;font-size:${z.name};letter-spacing:-0.01em`;
  if (c.tone === "allergyOk") st += `;color:${S.allergyOkInk};background:${S.allergyOkBg}`;
  if (c.tone === "allergyAlert") st += `;color:${S.allergyAlertInk};background:${S.allergyAlertBg}`;
  return st;
}

/**
 * part: "all" (padrao), "top" (timbrado + faixa, sem a grade) ou "grid" (so a grade do
 * paciente — usada quando a grade precisa repetir em cada pagina via thead).
 */
export type HeaderPart = "all" | "top" | "grid";

export function renderHeaderHtml(layout: HeaderLayout, brand: HeaderBrand, part: HeaderPart = "all", opts: { compact?: boolean } = {}): string {
  const z: Sz = opts.compact ? SIZES.compact : SIZES.normal;
  const labelCell = labelCellOf(z);
  const logo = brand.logoSrc
    ? `<img src="${esc(brand.logoSrc)}" alt="" style="width:${z.logo}px;height:${z.logo}px;object-fit:contain;flex-shrink:0"/>`
    : `<div style="width:${z.logo}px;height:${z.logo}px;background:${brand.colors.blue};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:8pt;border-radius:6px;flex-shrink:0">${esc(brand.abbr ?? "")}</div>`;
  const c = brand.colors;
  const rows = layout.rows
    .map(
      (row) =>
        "<tr>" +
        row
          .map((cl) => {
            const lab = `<td style="${labelCell}${cl.alertLabel ? `;color:${S.allergyLabelInk}` : ""}">${esc(cl.label)}</td>`;
            const span = cl.span && cl.span > 1 ? ` colspan="${cl.span}"` : "";
            const sub = cl.sub ? `<div style="font-size:${z.sub};font-weight:400;color:${S.labelInk};margin-top:1px">${esc(cl.sub)}</div>` : "";
            return `${lab}<td style="${valueStyle(cl, z)}"${span}>${esc(cl.value)}${sub}</td>`;
          })
          .join("") +
        "</tr>",
    )
    .join("");
  const complement = layout.complement
    ? `<span style="position:absolute;right:9px;top:50%;transform:translateY(-50%);font-size:${z.cmp};letter-spacing:0.4px;text-transform:uppercase;opacity:0.92">${esc(layout.complement)}</span>`
    : "";
  const table = layout.rows.length
    ? `<table style="width:100%;border-collapse:collapse;margin-bottom:${z.after};page-break-inside:avoid"><tbody>${rows}</tbody></table>`
    : "";
  if (part === "grid") return `<div class="dh-root" style="font-family:'Helvetica Neue','Segoe UI',Inter,Arial,sans-serif;color:#1e293b">${table}</div>`;
  const showGrid = part === "all" && layout.rows.length > 0;
  return `<div class="dh-root" style="font-family:'Helvetica Neue','Segoe UI',Inter,Arial,sans-serif;color:#1e293b">
  <div style="display:flex;align-items:center;gap:${z.gap};padding-bottom:4px">${logo}
    <div style="flex:1;text-align:center">
      <div style="font-size:${z.line1};font-weight:600;color:${S.inkSoft};letter-spacing:0.5px;text-transform:uppercase">${esc(brand.line1)} · ${esc(brand.line2)}</div>
      <div style="font-size:${z.line3};font-weight:800;color:${S.ink};letter-spacing:0.7px;text-transform:uppercase;margin-top:2px;line-height:1.15">${esc(brand.line3)}</div>
    </div>
    <div style="min-width:${z.emW};text-align:right;border-left:1px solid ${S.line};padding-left:${z.gap}">
      <div style="font-size:${z.emLab};color:${S.inkMuted};letter-spacing:0.8px;text-transform:uppercase;font-weight:700">Emissão</div>
      <div style="font-size:${z.emVal};font-weight:800;color:${S.ink};margin-top:2px;letter-spacing:0.3px">${esc(layout.emission)}</div>
    </div>
  </div>
  <div style="display:flex;height:${z.bar}px"><div style="flex:1;background:${c.red}"></div><div style="flex:1;background:${c.orange}"></div><div style="flex:1;background:${c.yellow}"></div><div style="flex:1;background:${c.green}"></div><div style="flex:1;background:${c.blue}"></div></div>
  <div style="background:${S.band};color:#fff;position:relative;text-align:center;padding:${z.bandPad};margin-top:4px;margin-bottom:${showGrid ? "0" : "6px"}">
    <b style="font-size:${z.band};letter-spacing:0.9px;text-transform:uppercase">${esc(layout.title)}</b>${complement}
  </div>
  ${showGrid ? table : ""}
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
