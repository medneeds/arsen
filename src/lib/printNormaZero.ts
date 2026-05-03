/**
 * Padrão Norma Zero (MAN.05-001) — Timbrado institucional unificado
 * para todos os relatórios e documentos impressos da plataforma Arsen.
 *
 * Uso:
 *   const html = buildNormaZeroDocument({
 *     title: "Relatório Operacional — NIR",
 *     subtitle: "Indicadores em tempo real",
 *     sectorLabel: "Núcleo Interno de Regulação",
 *     hospitalName: "...",
 *     bodyHtml: "<h2>...</h2><table>...</table>",
 *     signatures: [{ label: "Coordenação NIR" }, { label: "Direção Técnica" }],
 *     logoDataUrl,
 *   });
 *   openPrintWindow(html);
 */

import { whitelabel } from "@/config/whitelabel";
import socorraoCrossLogo from "@/assets/socorrao-cross-logo.png";

export interface NormaZeroSignature {
  label: string;
  caption?: string;
}

export interface NormaZeroDocOptions {
  /** Título principal (será renderizado em caixa-alta) */
  title: string;
  /** Subtítulo opcional sob o título */
  subtitle?: string;
  /** Setor/área emitente para a barra de identificação do documento */
  sectorLabel: string;
  /** Nome do hospital (exibido no subtítulo) */
  hospitalName?: string;
  /** Prefixo do código do documento (ex: "NIR", "PRESC", "APAC") */
  docCodePrefix?: string;
  /** Conteúdo HTML do corpo (entre o cabeçalho e as assinaturas) */
  bodyHtml: string;
  /** Blocos de assinatura ao final (até 3) */
  signatures?: NormaZeroSignature[];
  /** Logo institucional pré-convertido em base64 (use prepareLogo()) */
  logoDataUrl?: string;
  /** Orientação da página */
  orientation?: "portrait" | "landscape";
  /** Estilos CSS adicionais específicos do documento */
  extraStyles?: string;
}

/** Converte um asset de imagem (importado) em data URL para uso em janelas pop-up */
export const prepareLogo = async (
  src: string = socorraoCrossLogo,
): Promise<string> => {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
};

/** Gera o código do documento no padrão {PREFIX}-YYYYMMDD-HHMM */
export const generateDocCode = (prefix: string = "DOC"): string => {
  const now = new Date();
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const t = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  return `${prefix}-${d}-${t}`;
};

/** CSS base do timbrado Norma Zero — compartilhado por todos os documentos */
export const normaZeroBaseStyles = (orientation: "portrait" | "landscape" = "portrait") => `
  @page { size: A4 ${orientation}; margin: ${orientation === "landscape" ? "10mm 12mm 14mm" : "12mm 14mm 16mm"}; }
  @media print {
    body { margin: 0; }
    .nz-header { page-break-after: avoid; }
    .nz-footer { page-break-before: avoid; }
    h2.nz-section { page-break-after: avoid; }
    table.nz { page-break-inside: auto; }
    table.nz tr { page-break-inside: avoid; }
  }
  :root { color-scheme: light only; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; margin: 0; font-size: 9.5pt; line-height: 1.35; }

  /* === TIMBRADO INSTITUCIONAL (Norma Zero MAN.05-001) === */
  .nz-header { background: #fff; border-bottom: 2.5pt solid #0054A6; padding: 8pt 0 6pt; margin-bottom: 8pt; }
  .nz-header-inner { display: grid; grid-template-columns: 68px 1fr 68px; align-items: center; gap: 14pt; }
  .nz-logo-wrap { display: flex; align-items: center; justify-content: center; }
  .nz-logo { height: 62px; width: 62px; object-fit: contain; }
  .nz-h-text { text-align: center; }
  .nz-h-line1, .nz-h-line2 { font-size: 8.5pt; font-weight: 600; color: #475569; letter-spacing: 0.5pt; text-transform: uppercase; }
  .nz-h-line3 { font-size: 11.5pt; font-weight: 700; color: #0a1628; margin-top: 3pt; letter-spacing: 0.3pt; }
  .nz-h-tag { font-size: 7.5pt; color: #64748b; font-style: italic; margin-top: 3pt; }
  .nz-cruz-bar { display: flex; height: 4pt; margin-top: 6pt; border-radius: 2pt; overflow: hidden; }
  .nz-cruz-bar > div { flex: 1; }

  /* === MARCAÇÃO DOCUMENTO === */
  .nz-doc-bar { display: flex; justify-content: space-between; align-items: center; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 4pt 8pt; font-size: 8pt; margin-bottom: 8pt; border-radius: 3pt; }
  .nz-doc-bar b { color: #0a1628; }

  /* === TÍTULO PADRÃO === */
  h1.nz-title { font-size: 14pt; margin: 4pt 0 2pt; color: #0a1628; text-align: center; letter-spacing: 0.4pt; text-transform: uppercase; }
  .nz-subtitle { text-align: center; color: #64748b; font-size: 8.5pt; margin-bottom: 10pt; }

  /* === SEÇÕES PADRÃO === */
  h2.nz-section { font-size: 10pt; margin: 12pt 0 4pt; padding: 3pt 6pt; background: #0054A6; color: #fff; border-radius: 3pt 3pt 0 0; letter-spacing: 0.5pt; text-transform: uppercase; }

  /* === TABELAS PADRÃO === */
  table.nz { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  table.nz th { background: #f1f5f9; font-weight: 700; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.4pt; padding: 4pt 6pt; text-align: left; border-bottom: 1.5pt solid #cbd5e1; color: #334155; }
  table.nz td { padding: 3.5pt 6pt; border-bottom: 0.5pt solid #e2e8f0; }
  table.nz tr:nth-child(even) td { background: #fafbfc; }
  .nz-c { text-align: center; }
  .nz-r { text-align: right; }

  /* === ASSINATURAS === */
  .nz-signature-area { margin-top: 24pt; padding-top: 12pt; border-top: 1pt dashed #94a3b8; display: grid; gap: 30pt; }
  .nz-sig { text-align: center; font-size: 8pt; }
  .nz-sig .nz-line { border-top: 1pt solid #475569; margin-bottom: 3pt; height: 30pt; }
  .nz-sig b { display: block; color: #0a1628; }
  .nz-sig span { color: #64748b; font-size: 7pt; }

  /* === RODAPÉ === */
  .nz-footer { border-top: 1pt solid #cbd5e1; padding-top: 4pt; margin-top: 14pt; font-size: 7pt; color: #64748b; display: flex; justify-content: space-between; align-items: center; }
  .nz-empty { text-align: center; color: #94a3b8; font-style: italic; padding: 12pt; }
`;

/** Constrói o HTML completo do documento Norma Zero */
export function buildNormaZeroDocument(opts: NormaZeroDocOptions): string {
  const {
    title,
    subtitle,
    sectorLabel,
    hospitalName,
    docCodePrefix = "DOC",
    bodyHtml,
    signatures = [],
    logoDataUrl,
    orientation = "portrait",
    extraStyles = "",
  } = opts;

  const inst = whitelabel.print.institutionalHeader;
  const colors = whitelabel.theme.institutionalColors;
  const docNo = generateDocCode(docCodePrefix);
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hospital = hospitalName || whitelabel.institution.hospitalFullName;

  const logoBlock = logoDataUrl
    ? `<img src="${logoDataUrl}" class="nz-logo" alt="${whitelabel.institution.hospitalAbbreviation}"/>`
    : `<div class="nz-logo" style="background:#0054A6;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;border-radius:8pt">${whitelabel.institution.hospitalAbbreviation}</div>`;

  const signatureCols = signatures.length || 0;
  const sigGridTemplate = signatureCols > 0 ? `repeat(${signatureCols}, 1fr)` : "1fr";
  const signaturesHtml =
    signatures.length > 0
      ? `<div class="nz-signature-area" style="grid-template-columns:${sigGridTemplate}">${signatures
          .map(
            (s) =>
              `<div class="nz-sig"><div class="nz-line"></div><b>${s.label}</b><span>${s.caption || "Carimbo e assinatura"}</span></div>`,
          )
          .join("")}</div>`
      : "";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${title} — ${docNo}</title>
<style>${normaZeroBaseStyles(orientation)}${extraStyles}</style>
</head><body>
<div class="nz-header">
  <div class="nz-header-inner">
    <div class="nz-logo-wrap">${logoBlock}</div>
    <div class="nz-h-text">
      <div class="nz-h-line1">${inst.line1}</div>
      <div class="nz-h-line2">${inst.line2}</div>
      <div class="nz-h-line3">${inst.line3}</div>
      <div class="nz-h-tag">${whitelabel.institution.address}</div>
    </div>
    <div></div>
  </div>
  <div class="nz-cruz-bar">
    <div style="background:${colors.red}"></div>
    <div style="background:${colors.orange}"></div>
    <div style="background:${colors.yellow}"></div>
    <div style="background:${colors.green}"></div>
    <div style="background:${colors.blue}"></div>
  </div>
</div>

<div class="nz-doc-bar">
  <span><b>Documento:</b> ${docNo}</span>
  <span><b>Setor:</b> ${sectorLabel}</span>
  <span><b>Emissão:</b> ${dateStr} às ${timeStr}</span>
</div>

<h1 class="nz-title">${title}</h1>
${subtitle ? `<div class="nz-subtitle">${hospital} • ${subtitle}</div>` : `<div class="nz-subtitle">${hospital}</div>`}

${bodyHtml}

${signaturesHtml}

<div class="nz-footer">
  <div><b>${whitelabel.institution.hospitalAbbreviation}</b> — ${whitelabel.platform.fullName}</div>
  <div>${whitelabel.compliance.normaZeroCode} v${whitelabel.compliance.normaZeroVersion} • ${whitelabel.compliance.legalReferences}</div>
  <div>${dateStr} ${timeStr}</div>
</div>

<script>window.onload = () => { setTimeout(() => window.print(), 350); };</script>
</body></html>`;
}

/** Abre o documento HTML em uma nova janela e dispara a impressão */
export function openPrintWindow(html: string, splash = "Preparando documento…") {
  const w = window.open("", "_blank", "width=1024,height=768");
  if (!w) return null;
  w.document.write(
    `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#475569">${splash}</body></html>`,
  );
  w.document.open();
  w.document.write(html);
  w.document.close();
  return w;
}
