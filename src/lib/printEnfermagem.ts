/**
 * Impressao da enfermagem — PDFs Norma Zero, A4 retrato:
 *  ENF-EVO  evolucao do enfermeiro (paciente; identificacao via resolveHeaderPatient)
 *  ENF-SBAR passagem de plantao (setor; um bloco SBAR por leito)
 * O codigo do documento gravado na evolucao e o mesmo da reimpressao.
 */
import { buildNormaZeroDocument, buildStandardHeaderHtml, prepareLogo } from "@/lib/printNormaZero";
import { resolveHeaderPatient } from "@/lib/headerPatient";
import { withTimeout } from "@/lib/resolvePatientHeader";
import type { HeaderInput, HeaderPatient } from "@/lib/documentHeaderLayout";
import { DOC_PREFIXES } from "@/lib/docPrefixes";
import { buildEvolucaoEnfermagemBody, EVOLUCAO_ENFERMAGEM_STYLES, buildSbarBody, SBAR_STYLES } from "@/lib/enfermagemDocs";
import type { SecaoTexto, SbarLeito } from "@/lib/anotacoesEnfermagem";

function abrir(preOpened: Window | null | undefined, msg: string): Window | null {
  const win = preOpened ?? window.open("", "_blank", "width=794,height=1123");
  if (win && !preOpened) win.document.write(`<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#475569">${msg}</body></html>`);
  return win;
}

function falha(win: Window | null, titulo: string, err: unknown) {
  console.error(`[printEnfermagem] ${titulo}:`, err);
  if (!win) return;
  win.document.open();
  win.document.write(`<html><body style="font-family:sans-serif;padding:24px;color:#991b1b"><h2>${titulo}</h2><p style="color:#334155">Tente novamente. Detalhe: ${String(err instanceof Error ? err.message : err).replace(/[<>&]/g, "")}</p></body></html>`);
  win.document.close();
}

export async function printEvolucaoEnfermagem(
  internacaoId: string,
  base: HeaderPatient,
  doc: { secoes: SecaoTexto[]; dataHora: string; status: string; autor: string | null; docCode: string | null },
  preOpenedWindow?: Window | null,
): Promise<void> {
  const win = abrir(preOpenedWindow, "Preparando evolução de enfermagem…");
  try {
    const logo = await withTimeout(prepareLogo(), 6000, "");
    const patient = await withTimeout(resolveHeaderPatient(internacaoId, base), 7000, base);
    const header: HeaderInput = { model: "assistencial", title: "Evolução de enfermagem", emission: "", patient };
    const body = `<table style="width:100%;border-collapse:collapse"><thead style="display:table-header-group"><tr><td style="padding:0;border:none">${buildStandardHeaderHtml(header, logo, "grid")}</td></tr></thead><tbody><tr><td style="padding:0;border:none">${buildEvolucaoEnfermagemBody(doc.secoes, doc)}</td></tr></tbody></table>`;
    const html = buildNormaZeroDocument({
      title: "Evolução de Enfermagem",
      standardHeader: header,
      standardHeaderTopOnly: true,
      sectorLabel: patient.sector || "Enfermagem",
      docCodePrefix: DOC_PREFIXES.enfEvolucao,
      bodyHtml: body,
      logoDataUrl: logo,
      orientation: "portrait",
      signatures: [{ label: doc.autor || "Enfermeiro(a)", caption: "Enfermeiro(a) — COREN e assinatura" }],
      extraStyles: EVOLUCAO_ENFERMAGEM_STYLES,
    });
    const finalHtml = doc.docCode ? html.replace(/ENF-EVO-\d{8}-\d{4}/g, doc.docCode) : html;
    if (win) { win.document.open(); win.document.write(finalHtml); win.document.close(); }
  } catch (err) {
    falha(win, "Não foi possível gerar a evolução de enfermagem", err);
  }
}

export async function printSbar(
  leitos: SbarLeito[],
  meta: { turno: string; setor: string; observacoes?: string; enfermeiro: string | null },
  preOpenedWindow?: Window | null,
): Promise<void> {
  const win = abrir(preOpenedWindow, "Preparando passagem de plantão…");
  try {
    const logo = await withTimeout(prepareLogo(), 6000, "");
    const html = buildNormaZeroDocument({
      title: "Passagem de Plantão — SBAR",
      sectorLabel: meta.setor || "Enfermagem",
      docCodePrefix: DOC_PREFIXES.enfSbar,
      bodyHtml: buildSbarBody(leitos, meta),
      logoDataUrl: logo,
      orientation: "portrait",
      signatures: [
        { label: meta.enfermeiro || "Enfermeiro(a) que entrega", caption: "Entrega o plantão — COREN" },
        { label: "Enfermeiro(a) que recebe", caption: "Recebe o plantão — COREN" },
      ],
      extraStyles: SBAR_STYLES,
    });
    if (win) { win.document.open(); win.document.write(html); win.document.close(); }
  } catch (err) {
    falha(win, "Não foi possível gerar a passagem de plantão", err);
  }
}
