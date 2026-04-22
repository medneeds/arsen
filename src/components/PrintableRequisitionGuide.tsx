/**
 * Guia de Requisição de Exames — padronizada no timbrado Norma Zero (MAN.05-001).
 *
 * - `printRequisitionGuide(...)` abre janela popup com `buildNormaZeroDocument`
 *   para impressão real.
 * - `<PrintableRequisitionGuide />` renderiza, na própria interface (dialog),
 *   uma pré-visualização que espelha exatamente as seções/tabela do documento
 *   impresso (cabeçalho institucional, doc-bar, identificação, justificativa,
 *   itens em grid 2 colunas com checkbox, observações, assinaturas e rodapé).
 */

import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  buildNormaZeroDocument,
  openPrintWindow,
  prepareLogo,
  generateDocCode,
} from "@/lib/printNormaZero";
import {
  NormaZeroPrintHeader,
  NormaZeroPrintFooter,
} from "@/components/NormaZeroPrintHeader";
import {
  PrintableCultureRequest,
  printCultureRequest,
  type CultureRequestData,
} from "@/components/PrintableCultureRequest";

/** Verifica se a requisição é predominantemente de cultura microbiológica. */
const CULTURE_KEYWORDS = ["cultura", "hemocultura", "urocultura", "antibiograma", "swab", "secre"];
function isCultureRequest(items: any[]): boolean {
  if (!Array.isArray(items) || items.length === 0) return false;
  const cultureCount = items.filter((it) => {
    const name = (typeof it === "string" ? it : it?.name || "").toLowerCase();
    return CULTURE_KEYWORDS.some((kw) => name.includes(kw));
  }).length;
  return cultureCount / items.length >= 0.6; // ≥60% culturas → usar layout dedicado
}

interface PrintableRequisitionGuideProps {
  request: {
    patient_name: string;
    patient_bed?: string | null;
    patient_sector?: string | null;
    category: string;
    items: any[];
    priority: string;
    clinical_indication?: string | null;
    notes?: string | null;
    requested_by_name?: string | null;
    created_at: string;
  };
  sectorLabel?: (s: string | null) => string;
}

const CATEGORY_LABELS: Record<string, string> = {
  laboratorio: "Exames Laboratoriais",
  imagem: "Exames de Imagem",
  parecer: "Parecer Especializado",
  apac: "APAC — Alta Complexidade",
};

const CATEGORY_PREFIX: Record<string, string> = {
  laboratorio: "REQ-LAB",
  imagem: "REQ-IMG",
  parecer: "REQ-PAR",
  apac: "REQ-APAC",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgente: "URGENTE",
  rotina: "ROTINA",
  programado: "PROGRAMADO",
};

const PRIORITY_BADGE_STYLE: Record<string, React.CSSProperties> = {
  urgente: { background: "#fee2e2", color: "#b91c1c", border: "1px solid #b91c1c" },
  rotina: { background: "#dbeafe", color: "#1d4ed8", border: "1px solid #1d4ed8" },
  programado: { background: "#e0f2fe", color: "#0369a1", border: "1px solid #0369a1" },
};

const PRIORITY_BADGE_CSS: Record<string, string> = {
  urgente: "background:#fee2e2;color:#b91c1c;border:1pt solid #b91c1c;",
  rotina: "background:#dbeafe;color:#1d4ed8;border:1pt solid #1d4ed8;",
  programado: "background:#e0f2fe;color:#0369a1;border:1pt solid #0369a1;",
};

const escapeHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ─────────────────────────────────────────────────────────────────────────────
// Pré-visualização React (mesmas seções e tabelas do documento impresso)
// ─────────────────────────────────────────────────────────────────────────────

const ink = "#0a1628";
const inkSoft = "#475569";
const lineSoft = "#cbd5e1";
const sectionBg = "#0054A6";
const tableHeadBg = "#f1f5f9";
const tableZebra = "#fafbfc";

const sectionStyle: React.CSSProperties = {
  background: sectionBg,
  color: "#fff",
  fontSize: "9pt",
  fontWeight: 700,
  letterSpacing: "0.3px",
  textTransform: "uppercase",
  padding: "4px 8px",
  margin: "10px 0 4px",
  borderRadius: "2px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "9pt",
  border: `1px solid ${lineSoft}`,
};

const thStyle: React.CSSProperties = {
  background: tableHeadBg,
  color: ink,
  fontWeight: 600,
  textAlign: "left",
  padding: "5px 8px",
  border: `1px solid ${lineSoft}`,
  fontSize: "8.5pt",
};

const tdStyle: React.CSSProperties = {
  padding: "5px 8px",
  border: `1px solid ${lineSoft}`,
  color: ink,
  fontSize: "9pt",
  verticalAlign: "top",
};

export function PrintableRequisitionGuide({
  request,
  sectorLabel,
}: PrintableRequisitionGuideProps) {
  const items = Array.isArray(request.items) ? request.items : [];
  const docPrefix = CATEGORY_PREFIX[request.category] || "REQ";
  const docCode = React.useMemo(() => generateDocCode(docPrefix), [docPrefix]);

  // Roteamento: se a requisição é predominantemente de cultura microbiológica,
  // usa o layout hospitalar dedicado (estrutura tabular tipo formulário).
  if (isCultureRequest(items)) {
    const cultureData: CultureRequestData = {
      patient_name: request.patient_name,
      patient_sector: request.patient_sector,
      patient_bed: request.patient_bed,
      items,
      clinical_indication: request.clinical_indication,
      notes: request.notes,
      requested_by_name: request.requested_by_name,
      created_at: request.created_at,
    };
    return <PrintableCultureRequest request={cultureData} sectorLabel={sectorLabel} />;
  }

  const categoryLabel = CATEGORY_LABELS[request.category] || request.category;
  const priorityLabel =
    PRIORITY_LABELS[request.priority] || (request.priority || "").toUpperCase();
  const priorityStyle =
    PRIORITY_BADGE_STYLE[request.priority] || PRIORITY_BADGE_STYLE.rotina;

  const scheduledMatch = request.notes?.match(/\[PROGRAMADO: ([^\]]+)\]/);
  const scheduledInfo = scheduledMatch?.[1] || null;
  const cleanNotes =
    request.notes?.replace(/\[PROGRAMADO: [^\]]+\]\n?/, "").trim() || null;

  const sectorName = sectorLabel
    ? sectorLabel(request.patient_sector || null)
    : request.patient_sector || "";

  const createdAt = new Date(request.created_at);
  const createdStr = format(createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <div
      style={{
        background: "#fff",
        color: ink,
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "16px 18px",
        borderRadius: "6px",
        border: `1px solid ${lineSoft}`,
      }}
      className="text-foreground"
    >
      <NormaZeroPrintHeader
        documentLabel={`Guia · ${categoryLabel}`}
        documentCode={docCode}
        documentSubtitle={createdStr}
        width="100%"
      />

      {/* Doc-bar — setor · prioridade */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#eef2f7",
          border: `1px solid ${lineSoft}`,
          borderRadius: "3px",
          padding: "5px 10px",
          fontSize: "8pt",
          color: inkSoft,
          marginBottom: "8px",
        }}
      >
        <span>
          <strong style={{ color: ink }}>Setor emitente:</strong>{" "}
          {sectorName || "Assistência Hospitalar"}
        </span>
        <span
          style={{
            ...priorityStyle,
            padding: "2px 10px",
            borderRadius: "3px",
            fontWeight: 700,
            fontSize: "8pt",
            letterSpacing: "0.4px",
          }}
        >
          {priorityLabel}
        </span>
      </div>

      {/* Título principal */}
      <div style={{ textAlign: "center", margin: "6px 0 4px" }}>
        <div
          style={{
            fontSize: "13pt",
            fontWeight: 800,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: ink,
          }}
        >
          Guia de Requisição — {categoryLabel}
        </div>
        <div style={{ fontSize: "8pt", color: inkSoft, marginTop: "2px" }}>
          Solicitada em {createdStr}
        </div>
      </div>

      {/* Identificação */}
      <div style={sectionStyle}>Identificação</div>
      <table style={tableStyle}>
        <tbody>
          <tr>
            <th style={{ ...thStyle, width: "18%" }}>Paciente</th>
            <td style={{ ...tdStyle, fontWeight: 700 }} colSpan={3}>
              {request.patient_name}
            </td>
          </tr>
          <tr style={{ background: tableZebra }}>
            <th style={thStyle}>Setor</th>
            <td style={tdStyle}>{sectorName || "—"}</td>
            <th style={{ ...thStyle, width: "14%" }}>Leito</th>
            <td style={{ ...tdStyle, width: "18%" }}>
              {request.patient_bed || "—"}
            </td>
          </tr>
          <tr>
            <th style={thStyle}>Solicitante</th>
            <td style={tdStyle}>{request.requested_by_name || "—"}</td>
            <th style={thStyle}>Solicitação</th>
            <td style={tdStyle}>{createdStr}</td>
          </tr>
          <tr style={{ background: tableZebra }}>
            <th style={thStyle}>Categoria</th>
            <td style={tdStyle}>{categoryLabel}</td>
            <th style={thStyle}>Prioridade</th>
            <td style={tdStyle}>
              <span
                style={{
                  ...priorityStyle,
                  display: "inline-block",
                  padding: "1px 8px",
                  borderRadius: "3px",
                  fontWeight: 700,
                  fontSize: "8pt",
                }}
              >
                {priorityLabel}
              </span>
            </td>
          </tr>
          {scheduledInfo && (
            <tr>
              <th style={thStyle}>Agendamento</th>
              <td style={tdStyle} colSpan={3}>
                {scheduledInfo}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Justificativa Clínica */}
      {request.clinical_indication && (
        <>
          <div style={sectionStyle}>Justificativa Clínica</div>
          <table style={tableStyle}>
            <tbody>
              <tr>
                <td style={{ ...tdStyle, minHeight: 40 }}>
                  {request.clinical_indication}
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Itens Solicitados */}
      <div style={sectionStyle}>Itens Solicitados ({items.length})</div>
      {items.length === 0 ? (
        <div
          style={{
            border: `1px dashed ${lineSoft}`,
            borderRadius: "3px",
            padding: "10px",
            textAlign: "center",
            color: inkSoft,
            fontSize: "8.5pt",
          }}
        >
          Nenhum item registrado.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            border: `1px solid ${lineSoft}`,
            borderRadius: "3px",
            overflow: "hidden",
          }}
        >
          {items.map((it, i) => {
            const name =
              typeof it === "string" ? it : (it as any)?.name || String(it ?? "");
            const isLastCol = (i + 1) % 2 === 0;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 8px",
                  fontSize: "8.5pt",
                  borderBottom: `1px solid #e2e8f0`,
                  borderRight: isLastCol ? "none" : `1px solid #e2e8f0`,
                  color: ink,
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    border: `1px solid ${ink}`,
                    borderRadius: 1,
                    flexShrink: 0,
                  }}
                />
                <span>{name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Observações */}
      {cleanNotes && (
        <>
          <div style={sectionStyle}>Observações</div>
          <table style={tableStyle}>
            <tbody>
              <tr>
                <td style={tdStyle}>
                  {cleanNotes.split("\n").map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      <br />
                    </React.Fragment>
                  ))}
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Assinaturas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "30px",
          marginTop: "26px",
        }}
      >
        {[
          { label: "Médico Solicitante", caption: "CRM · Carimbo e assinatura" },
          { label: "Setor Executor", caption: "Recebimento e execução" },
        ].map((sig) => (
          <div key={sig.label} style={{ textAlign: "center" }}>
            <div
              style={{
                borderTop: `1px solid ${ink}`,
                paddingTop: "4px",
                fontSize: "8.5pt",
                fontWeight: 700,
                color: ink,
              }}
            >
              {sig.label}
            </div>
            <div style={{ fontSize: "7pt", color: inkSoft, marginTop: "2px" }}>
              {sig.caption}
            </div>
          </div>
        ))}
      </div>

      <NormaZeroPrintFooter width="100%" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Impressão real (Norma Zero via popup) — inalterada
// ─────────────────────────────────────────────────────────────────────────────

export async function printRequisitionGuide(
  request: any,
  sectorLabel?: (s: string | null) => string,
) {
  const items = Array.isArray(request.items) ? request.items : [];
  const categoryLabel = CATEGORY_LABELS[request.category] || request.category;
  const priorityLabel = PRIORITY_LABELS[request.priority] || (request.priority || "").toUpperCase();
  const priorityCss = PRIORITY_BADGE_CSS[request.priority] || PRIORITY_BADGE_CSS.rotina;
  const docPrefix = CATEGORY_PREFIX[request.category] || "REQ";

  const scheduledMatch = request.notes?.match(/\[PROGRAMADO: ([^\]]+)\]/);
  const scheduledInfo: string | null = scheduledMatch?.[1] || null;
  const cleanNotes: string | null =
    request.notes?.replace(/\[PROGRAMADO: [^\]]+\]\n?/, "").trim() || null;

  const sectorName = sectorLabel
    ? sectorLabel(request.patient_sector || null)
    : (request.patient_sector || "");

  const createdAt = new Date(request.created_at);
  const createdStr = format(createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const identificationRows = `
    <table class="nz" style="margin-bottom:6pt">
      <tbody>
        <tr>
          <th style="width:18%">Paciente</th>
          <td colspan="3" style="font-weight:700;font-size:9.5pt">${escapeHtml(request.patient_name)}</td>
        </tr>
        <tr>
          <th>Setor</th><td>${escapeHtml(sectorName || "—")}</td>
          <th style="width:14%">Leito</th><td style="width:18%">${escapeHtml(request.patient_bed || "—")}</td>
        </tr>
        <tr>
          <th>Solicitante</th><td>${escapeHtml(request.requested_by_name || "—")}</td>
          <th>Solicitação</th><td>${escapeHtml(createdStr)}</td>
        </tr>
        <tr>
          <th>Categoria</th><td>${escapeHtml(categoryLabel)}</td>
          <th>Prioridade</th>
          <td><span class="prio-badge" style="${priorityCss}">${escapeHtml(priorityLabel)}</span></td>
        </tr>
        ${
          scheduledInfo
            ? `<tr><th>Agendamento</th><td colspan="3">${escapeHtml(scheduledInfo)}</td></tr>`
            : ""
        }
      </tbody>
    </table>
  `;

  const justificationBlock = request.clinical_indication
    ? `<h2 class="nz-section">Justificativa Clínica</h2>
       <table class="nz"><tbody><tr><td style="min-height:30pt">${escapeHtml(request.clinical_indication)}</td></tr></tbody></table>`
    : "";

  const itemsCells =
    items.length > 0
      ? items
          .map((item: any) => {
            const name = typeof item === "string" ? item : item?.name || String(item ?? "");
            return `<div class="req-item"><span class="req-check"></span><span>${escapeHtml(name)}</span></div>`;
          })
          .join("")
      : `<div class="nz-empty">Nenhum item registrado.</div>`;

  const itemsBlock = `
    <h2 class="nz-section">Itens Solicitados (${items.length})</h2>
    <div class="req-grid">${itemsCells}</div>
  `;

  const notesBlock = cleanNotes
    ? `<h2 class="nz-section">Observações</h2>
       <table class="nz"><tbody><tr><td>${escapeHtml(cleanNotes).replace(/\n/g, "<br/>")}</td></tr></tbody></table>`
    : "";

  const bodyHtml = `
    <h2 class="nz-section">Identificação</h2>
    ${identificationRows}
    ${justificationBlock}
    ${itemsBlock}
    ${notesBlock}
  `;

  const extraStyles = `
    .prio-badge { display:inline-block; padding:1.5pt 8pt; border-radius:3pt; font-weight:700; font-size:8pt; letter-spacing:0.4pt; }
    .req-grid { display:grid; grid-template-columns: 1fr 1fr; gap:0; border:0.5pt solid #cbd5e1; border-radius:3pt; overflow:hidden; }
    .req-item { display:flex; align-items:center; gap:5pt; padding:4pt 7pt; font-size:8.5pt; border-bottom:0.5pt solid #e2e8f0; border-right:0.5pt solid #e2e8f0; }
    .req-item:nth-child(2n) { border-right:none; }
    .req-check { width:8pt; height:8pt; border:1pt solid #0a1628; border-radius:1pt; display:inline-block; flex-shrink:0; }
  `;

  const logoDataUrl = await prepareLogo();
  const html = buildNormaZeroDocument({
    title: `Guia de Requisição — ${categoryLabel}`,
    subtitle: `Solicitada em ${createdStr}`,
    sectorLabel: sectorName || "Assistência Hospitalar",
    docCodePrefix: docPrefix,
    bodyHtml,
    signatures: [
      { label: "Médico Solicitante", caption: "CRM · Carimbo e assinatura" },
      { label: "Setor Executor", caption: "Recebimento e execução" },
    ],
    logoDataUrl,
    extraStyles,
  });

  const w = openPrintWindow(html, "Preparando guia de requisição…");
  if (!w) {
    alert("Permita pop-ups para imprimir a guia.");
  }
}
