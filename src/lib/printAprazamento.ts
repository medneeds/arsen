/**
 * Impressao do aprazamento e checagem — PDF ENF-APZ, Norma Zero, A4 paisagem.
 * Identificacao do paciente SO via resolveHeaderPatient (fonte unica dos impressos).
 * Assinaturas: enfermeiro (aprazamento) e tecnico (checagem).
 */
import { buildNormaZeroDocument, buildStandardHeaderHtml, prepareLogo } from "@/lib/printNormaZero";
import { resolveHeaderPatient } from "@/lib/headerPatient";
import { withTimeout } from "@/lib/resolvePatientHeader";
import type { HeaderInput, HeaderPatient } from "@/lib/documentHeaderLayout";
import { DOC_PREFIXES } from "@/lib/docPrefixes";
import { buildAprazamentoBody, APRAZAMENTO_STYLES, type AprazamentoDocInput } from "@/lib/aprazamentoDoc";

export async function printAprazamento(
  internacaoId: string,
  base: HeaderPatient,
  doc: AprazamentoDocInput,
  preOpenedWindow?: Window | null,
): Promise<void> {
  const win = preOpenedWindow ?? window.open("", "_blank", "width=1123,height=794");
  if (win && !preOpenedWindow) {
    win.document.write(`<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#475569">Preparando aprazamento…</body></html>`);
  }
  try {
    const logo = await withTimeout(prepareLogo(), 6000, "");
    const patient = await withTimeout(resolveHeaderPatient(internacaoId, base), 7000, base);
    const header: HeaderInput = {
      model: "assistencial",
      title: "Aprazamento e checagem",
      complement: `Vigência ${doc.vigencia}`,
      emission: "",
      patient,
    };
    const body = `<table style="width:100%;border-collapse:collapse"><thead style="display:table-header-group"><tr><td style="padding:0;border:none">${buildStandardHeaderHtml(header, logo, "grid")}</td></tr></thead><tbody><tr><td style="padding:0;border:none">${buildAprazamentoBody(doc)}</td></tr></tbody></table>`;
    const html = buildNormaZeroDocument({
      title: "Aprazamento e Checagem",
      standardHeader: header,
      standardHeaderTopOnly: true,
      sectorLabel: patient.sector || "Enfermagem",
      docCodePrefix: DOC_PREFIXES.enfAprazamento,
      bodyHtml: body,
      logoDataUrl: logo,
      orientation: "landscape",
      signatures: [
        { label: doc.aprazadoPor || "Enfermeiro(a)", caption: "Aprazamento — COREN e assinatura" },
        { label: "Técnico(a) de enfermagem", caption: "Checagem — COREN e assinatura" },
      ],
      extraStyles: APRAZAMENTO_STYLES,
    });
    if (win) { win.document.open(); win.document.write(html); win.document.close(); }
  } catch (err) {
    console.error("[printAprazamento] falha ao gerar:", err);
    if (win) {
      win.document.open();
      win.document.write(`<html><body style="font-family:sans-serif;padding:24px;color:#991b1b"><h2>Não foi possível gerar o aprazamento</h2><p style="color:#334155">Tente novamente. Detalhe: ${String(err instanceof Error ? err.message : err).replace(/[<>&]/g, "")}</p></body></html>`);
      win.document.close();
    }
  }
}
