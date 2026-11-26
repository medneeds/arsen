/**
 * Impressao do balanco hidrico 24h — PDF ENF-BH, Norma Zero, A4 paisagem.
 * Identificacao do paciente SO via resolveHeaderPatient (fonte unica dos impressos).
 * Assinaturas: tecnico (fechamento) e enfermeiro (validacao).
 */
import { buildNormaZeroDocument, buildStandardHeaderHtml, prepareLogo } from "@/lib/printNormaZero";
import { resolveHeaderPatient } from "@/lib/headerPatient";
import { withTimeout } from "@/lib/resolvePatientHeader";
import type { HeaderInput, HeaderPatient } from "@/lib/documentHeaderLayout";
import { DOC_PREFIXES } from "@/lib/docPrefixes";
import { buildBalancoHidricoBody, BALANCO_HIDRICO_STYLES, type BalancoDocInput } from "@/lib/balancoHidricoDoc";

export async function printBalancoHidrico(
  internacaoId: string,
  base: HeaderPatient,
  doc: BalancoDocInput,
  docCode: string | null,
  preOpenedWindow?: Window | null,
): Promise<void> {
  const win = preOpenedWindow ?? window.open("", "_blank", "width=1123,height=794");
  if (win && !preOpenedWindow) {
    win.document.write(`<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#475569">Preparando balanço hídrico…</body></html>`);
  }
  try {
    const logo = await withTimeout(prepareLogo(), 6000, "");
    const patient = await withTimeout(resolveHeaderPatient(internacaoId, base), 7000, base);
    const header: HeaderInput = {
      model: "assistencial",
      title: "Balanço hídrico 24h",
      complement: doc.status === "aberto" ? "Parcial — não fechado" : undefined,
      emission: "",
      patient,
    };
    const body = `<table style="width:100%;border-collapse:collapse"><thead style="display:table-header-group"><tr><td style="padding:0;border:none">${buildStandardHeaderHtml(header, logo, "grid")}</td></tr></thead><tbody><tr><td style="padding:0;border:none">${buildBalancoHidricoBody(doc)}</td></tr></tbody></table>`;
    const html = buildNormaZeroDocument({
      title: "Balanço Hídrico 24h",
      standardHeader: header,
      standardHeaderTopOnly: true,
      sectorLabel: patient.sector || "Enfermagem",
      docCodePrefix: DOC_PREFIXES.enfBalanco,
      bodyHtml: body,
      logoDataUrl: logo,
      orientation: "landscape",
      signatures: [
        { label: doc.fechadoPor || "Técnico(a) de enfermagem", caption: "Fechamento do balanço" },
        { label: doc.validadoPor || "Enfermeiro(a)", caption: doc.validadoEm ? `Validado em ${doc.validadoEm}` : "COREN e assinatura" },
      ],
      extraStyles: BALANCO_HIDRICO_STYLES,
    });
    // Codigo do documento = o gravado no fechamento (reimpressao traz o mesmo codigo).
    const finalHtml = docCode ? html.replace(/ENF-BH-\d{8}-\d{4}/g, docCode) : html;
    if (win) { win.document.open(); win.document.write(finalHtml); win.document.close(); }
  } catch (err) {
    console.error("[printBalancoHidrico] falha ao gerar:", err);
    if (win) {
      win.document.open();
      win.document.write(`<html><body style="font-family:sans-serif;padding:24px;color:#991b1b"><h2>Não foi possível gerar o balanço hídrico</h2><p style="color:#334155">Tente novamente. Detalhe: ${String(err instanceof Error ? err.message : err).replace(/[<>&]/g, "")}</p></body></html>`);
      win.document.close();
    }
  }
}
