import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import socorraoLogo from "@/assets/socorrao1-logo.png";
import { whitelabel } from "@/config/whitelabel";

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
};

const PRIORITY_LABELS: Record<string, string> = {
  urgente: "⚡ URGENTE",
  rotina: "🔵 ROTINA",
  programado: "📅 PROGRAMADO",
};

export function PrintableRequisitionGuide({ request, sectorLabel }: PrintableRequisitionGuideProps) {
  const now = new Date();
  const items = Array.isArray(request.items) ? request.items : [];
  const categoryLabel = CATEGORY_LABELS[request.category] || request.category;
  const priorityLabel = PRIORITY_LABELS[request.priority] || request.priority;

  // Extract scheduled info from notes
  const scheduledMatch = request.notes?.match(/\[PROGRAMADO: ([^\]]+)\]/);
  const scheduledInfo = scheduledMatch?.[1] || null;
  // Clean notes (remove [PROGRAMADO:...] tag)
  const cleanNotes = request.notes?.replace(/\[PROGRAMADO: [^\]]+\]\n?/, "").trim() || null;

  const sectorName = sectorLabel ? sectorLabel(request.patient_sector || null) : (request.patient_sector || "");

  return (
    <div className="print-guide" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-guide, .print-guide * { visibility: visible; }
          .print-guide {
            position: fixed;
            left: 0; top: 0;
            width: 100%;
            background: white;
            z-index: 99999;
          }
        }
        .print-guide {
          width: 210mm;
          min-height: 148mm;
          padding: 10mm 12mm;
          background: white;
          color: #000;
          font-size: 11px;
          line-height: 1.4;
        }
        .print-guide table {
          width: 100%;
          border-collapse: collapse;
        }
        .print-guide td, .print-guide th {
          border: 0.5px solid #333;
          padding: 4px 6px;
          text-align: left;
          vertical-align: top;
        }
        .print-guide th {
          background: #f0f0f0;
          font-weight: bold;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .print-guide .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #000;
          padding-bottom: 6px;
          margin-bottom: 8px;
        }
        .print-guide .logo-area {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .print-guide .logo-area img {
          height: 44px;
          object-fit: contain;
        }
        .print-guide .title-area {
          text-align: center;
          flex: 1;
        }
        .print-guide .title-area h1 {
          font-size: 14px;
          font-weight: bold;
          margin: 0;
          text-transform: uppercase;
        }
        .print-guide .title-area p {
          font-size: 10px;
          margin: 2px 0 0;
          color: #555;
        }
        .print-guide .priority-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 4px;
          font-weight: bold;
          font-size: 12px;
          text-align: center;
        }
        .print-guide .priority-urgente {
          background: #fee2e2;
          color: #b91c1c;
          border: 1.5px solid #b91c1c;
        }
        .print-guide .priority-rotina {
          background: #dbeafe;
          color: #1d4ed8;
          border: 1.5px solid #1d4ed8;
        }
        .print-guide .priority-programado {
          background: #e0f2fe;
          color: #0369a1;
          border: 1.5px solid #0369a1;
        }
        .print-guide .section-title {
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 8px 0 4px;
          color: #333;
        }
        .print-guide .items-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
        }
        .print-guide .item-cell {
          border: 0.5px solid #333;
          padding: 3px 6px;
          font-size: 10px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .print-guide .item-checkbox {
          width: 10px;
          height: 10px;
          border: 1px solid #000;
          display: inline-block;
          flex-shrink: 0;
        }
        .print-guide .footer-area {
          margin-top: 16px;
          border-top: 1px solid #999;
          padding-top: 8px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .print-guide .signature-line {
          border-top: 1px solid #000;
          width: 180px;
          text-align: center;
          padding-top: 3px;
          font-size: 9px;
          color: #555;
        }
        .print-guide .footer-note {
          font-size: 8px;
          color: #777;
          text-align: center;
          margin-top: 8px;
        }
      `}</style>

      {/* Header */}
      <div className="header-row">
        <div className="logo-area">
          <img src={socorraoLogo} alt="Socorrão I" />
        </div>
        <div className="title-area">
          <h1>Guia de Requisição</h1>
          <p>{categoryLabel}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className={`priority-badge priority-${request.priority}`}>
            {priorityLabel}
          </span>
        </div>
      </div>

      {/* Patient Info Table */}
      <table>
        <tbody>
          <tr>
            <th style={{ width: "20%" }}>Paciente</th>
            <td colSpan={3} style={{ fontWeight: "bold", fontSize: "12px" }}>{request.patient_name}</td>
          </tr>
          <tr>
            <th>Setor</th>
            <td>{sectorName || "—"}</td>
            <th style={{ width: "12%" }}>Leito</th>
            <td style={{ width: "15%" }}>{request.patient_bed || "—"}</td>
          </tr>
          <tr>
            <th>Solicitante</th>
            <td>{request.requested_by_name || "—"}</td>
            <th>Data/Hora</th>
            <td>{format(new Date(request.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</td>
          </tr>
          <tr>
            <th>Prioridade</th>
            <td>{priorityLabel}</td>
            <th>Categoria</th>
            <td>{categoryLabel}</td>
          </tr>
          {scheduledInfo && (
            <tr>
              <th>Agendamento</th>
              <td colSpan={3}>📅 {scheduledInfo}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Clinical Justification */}
      {request.clinical_indication && (
        <>
          <div className="section-title">Justificativa Clínica</div>
          <table>
            <tbody>
              <tr>
                <td style={{ fontSize: "10px", minHeight: "30px" }}>{request.clinical_indication}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Requested Items */}
      <div className="section-title">Itens Solicitados ({items.length})</div>
      <div className="items-grid">
        {items.map((item: any, idx: number) => (
          <div key={idx} className="item-cell">
            <span className="item-checkbox" />
            <span>{typeof item === "string" ? item : item.name || item}</span>
          </div>
        ))}
        {items.length % 2 !== 0 && <div className="item-cell" style={{ borderColor: "transparent" }} />}
      </div>

      {/* Notes */}
      {cleanNotes && (
        <>
          <div className="section-title">Observações</div>
          <table>
            <tbody>
              <tr>
                <td style={{ fontSize: "10px" }}>{cleanNotes}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Footer with signatures */}
      <div className="footer-area">
        <div className="signature-line">Médico Solicitante</div>
        <div className="signature-line">Setor Executor</div>
      </div>

      <div className="footer-note">
        {whitelabel.print.documentFooter(
          format(now, "dd/MM/yyyy", { locale: ptBR }),
          format(now, "HH:mm", { locale: ptBR })
        )} • {whitelabel.print.systemLabel}
      </div>
    </div>
  );
}

export function printRequisitionGuide(request: any, sectorLabel?: (s: string | null) => string) {
  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) {
    alert("Permita pop-ups para imprimir a guia.");
    return;
  }

  const items = Array.isArray(request.items) ? request.items : [];
  const categoryLabel = CATEGORY_LABELS[request.category] || request.category;
  const priorityLabel = PRIORITY_LABELS[request.priority] || request.priority;
  const scheduledMatch = request.notes?.match(/\[PROGRAMADO: ([^\]]+)\]/);
  const scheduledInfo = scheduledMatch?.[1] || null;
  const cleanNotes = request.notes?.replace(/\[PROGRAMADO: [^\]]+\]\n?/, "").trim() || null;
  const sectorName = sectorLabel ? sectorLabel(request.patient_sector || null) : (request.patient_sector || "");
  const now = new Date();

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Guia de Requisição - ${request.patient_name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.4; color: #000; background: #fff; padding: 10mm 12mm; }
  @page { size: A4 portrait; margin: 10mm 12mm; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 0.5px solid #333; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; font-weight: bold; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .header-row { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
  .logo-area { display: flex; align-items: center; gap: 10px; }
  .logo-area img { height: 44px; object-fit: contain; }
  .title-area { text-align: center; flex: 1; }
  .title-area h1 { font-size: 14px; font-weight: bold; margin: 0; text-transform: uppercase; }
  .title-area p { font-size: 10px; margin: 2px 0 0; color: #555; }
  .priority-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; }
  .priority-urgente { background: #fee2e2; color: #b91c1c; border: 1.5px solid #b91c1c; }
  .priority-rotina { background: #dbeafe; color: #1d4ed8; border: 1.5px solid #1d4ed8; }
  .priority-programado { background: #e0f2fe; color: #0369a1; border: 1.5px solid #0369a1; }
  .section-title { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin: 8px 0 4px; color: #333; }
  .items-grid { display: grid; grid-template-columns: 1fr 1fr; }
  .item-cell { border: 0.5px solid #333; padding: 3px 6px; font-size: 10px; display: flex; align-items: center; gap: 4px; }
  .item-checkbox { width: 10px; height: 10px; border: 1px solid #000; display: inline-block; flex-shrink: 0; }
  .footer-area { margin-top: 20px; border-top: 1px solid #999; padding-top: 10px; display: flex; justify-content: space-between; }
  .signature-line { border-top: 1px solid #000; width: 180px; text-align: center; padding-top: 3px; font-size: 9px; color: #555; margin-top: 40px; }
  .footer-note { font-size: 8px; color: #777; text-align: center; margin-top: 12px; }
</style></head><body>
<div class="header-row">
  <div class="logo-area"><img src="${window.location.origin}/assets/socorrao1-logo.png" alt="Socorrão I" onerror="this.style.display='none'" /></div>
  <div class="title-area"><h1>Guia de Requisição</h1><p>${categoryLabel}</p></div>
  <div style="text-align:right"><span class="priority-badge priority-${request.priority}">${priorityLabel}</span></div>
</div>
<table><tbody>
  <tr><th style="width:20%">Paciente</th><td colspan="3" style="font-weight:bold;font-size:12px">${request.patient_name}</td></tr>
  <tr><th>Setor</th><td>${sectorName || "—"}</td><th style="width:12%">Leito</th><td style="width:15%">${request.patient_bed || "—"}</td></tr>
  <tr><th>Solicitante</th><td>${request.requested_by_name || "—"}</td><th>Data/Hora</th><td>${format(new Date(request.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</td></tr>
  <tr><th>Prioridade</th><td>${priorityLabel}</td><th>Categoria</th><td>${categoryLabel}</td></tr>
  ${scheduledInfo ? `<tr><th>Agendamento</th><td colspan="3">📅 ${scheduledInfo}</td></tr>` : ""}
</tbody></table>
${request.clinical_indication ? `<div class="section-title">Justificativa Clínica</div><table><tbody><tr><td style="font-size:10px;min-height:30px">${request.clinical_indication}</td></tr></tbody></table>` : ""}
<div class="section-title">Itens Solicitados (${items.length})</div>
<div class="items-grid">
  ${items.map((item: any) => `<div class="item-cell"><span class="item-checkbox"></span><span>${typeof item === "string" ? item : item.name || item}</span></div>`).join("")}
  ${items.length % 2 !== 0 ? '<div class="item-cell" style="border-color:transparent"></div>' : ""}
</div>
${cleanNotes ? `<div class="section-title">Observações</div><table><tbody><tr><td style="font-size:10px">${cleanNotes}</td></tr></tbody></table>` : ""}
<div class="footer-area"><div class="signature-line">Médico Solicitante</div><div class="signature-line">Setor Executor</div></div>
<div class="footer-note">Documento gerado automaticamente • ${format(now, "dd/MM/yyyy", { locale: ptBR })} às ${format(now, "HH:mm", { locale: ptBR })} • BigHelp Map - Mapa de Cuidados Intensivos</div>
</body></html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 500);
}
