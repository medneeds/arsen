/**
 * Guia de Requisição de Exames — agora padronizada no timbrado Norma Zero (MAN.05-001).
 *
 * Apenas a função `printRequisitionGuide` é utilizada nas páginas de Requisição
 * Unificada e nos painéis dos Setores de Imagem/Laboratório. O componente React
 * `PrintableRequisitionGuide` permanece exportado para preview opcional, mas a
 * impressão real é feita via popup com `buildNormaZeroDocument` para manter o
 * mesmo padrão visual de Prescrição, Evolução, NIR, FAT etc.
 */

import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { buildNormaZeroDocument, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";

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

const PRIORITY_BADGE: Record<string, string> = {
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

/**
 * Componente React opcional (preview em tela). A impressão real usa Norma Zero
 * via `printRequisitionGuide` abaixo. Mantido para compatibilidade.
 */
export function PrintableRequisitionGuide({ request, sectorLabel }: PrintableRequisitionGuideProps) {
  const items = Array.isArray(request.items) ? request.items : [];
  const categoryLabel = CATEGORY_LABELS[request.category] || request.category;
  const sectorName = sectorLabel ? sectorLabel(request.patient_sector || null) : (request.patient_sector || "");
  return (
    <div className="p-4 text-sm">
      <h2 className="font-bold mb-2">Pré-visualização — {categoryLabel}</h2>
      <p><strong>Paciente:</strong> {request.patient_name} · Leito {request.patient_bed || "—"} · {sectorName || "—"}</p>
      <p><strong>Itens ({items.length}):</strong></p>
      <ul className="list-disc pl-5">
        {items.map((it, i) => (
          <li key={i}>{typeof it === "string" ? it : (it as any).name || JSON.stringify(it)}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        A impressão segue o padrão Norma Zero (MAN.05-001).
      </p>
    </div>
  );
}

export async function printRequisitionGuide(
  request: any,
  sectorLabel?: (s: string | null) => string,
) {
  const items = Array.isArray(request.items) ? request.items : [];
  const categoryLabel = CATEGORY_LABELS[request.category] || request.category;
  const priorityLabel = PRIORITY_LABELS[request.priority] || (request.priority || "").toUpperCase();
  const priorityCss = PRIORITY_BADGE[request.priority] || PRIORITY_BADGE.rotina;
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

  // === Corpo HTML (entre header e assinaturas) ===
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

  // CSS específico desta guia
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
