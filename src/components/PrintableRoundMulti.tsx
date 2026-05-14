import { forwardRef } from "react";
import { ROUND_SECTIONS, STATUS_OPTIONS, type RoundStatus } from "@/data/roundChecklistSchema";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
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

interface Props {
  items: RoundPrintItem[];
  /** Quando true, renderiza só identificação preenchida (campos vazios para preenchimento manual). */
  blank?: boolean;
}

/**
 * Versão multipáginas do PrintableRound. 1 leito por página, A4 retrato.
 * Usado tanto para impressão em lote do setor quanto individual.
 */
const PrintableRoundMulti = forwardRef<HTMLDivElement, Props>(({ items, blank = false }, ref) => {
  const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm");

  return (
    <div ref={ref} className="print-round-multi" style={{ display: "none" }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-round-multi, .print-round-multi * { visibility: visible !important; }
          .print-round-multi {
            display: block !important;
            position: fixed !important;
            left: 0; top: 0;
            width: 100%;
            z-index: 99999;
            background: white !important;
            color: black !important;
            font-family: Arial, sans-serif;
            font-size: 7pt;
            line-height: 1.3;
          }
          .round-page {
            page-break-after: always;
            break-after: page;
            padding: 6mm 8mm;
            box-sizing: border-box;
          }
          .round-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
        }
      `}</style>

      {items.map((it, idx) => {
        const formattedDate = (() => {
          try {
            return format(new Date(it.roundDate + "T12:00:00"), "dd/MM/yyyy");
          } catch {
            return it.roundDate;
          }
        })();
        return (
          <div className="round-page" key={`${it.patientName}-${it.patientBed}-${idx}`}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "4mm", borderBottom: "1px solid #000", paddingBottom: "3mm" }}>
              <div style={{ fontSize: "8pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Hospital Municipal Djalma Marques – Socorrão I
              </div>
              <div style={{ fontSize: "10pt", fontWeight: "bold", margin: "2mm 0" }}>
                ROUND DIÁRIO MULTIPROFISSIONAL{blank ? " — FOLHA DE PREENCHIMENTO" : ""}
              </div>
            </div>

            {/* Patient info */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "3mm", fontSize: "7pt" }}>
              <tbody>
                <tr>
                  <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", fontWeight: "bold", width: "15%" }}>Paciente</td>
                  <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", width: "35%" }}>{it.patientName}</td>
                  <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", fontWeight: "bold", width: "10%" }}>Data</td>
                  <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", width: "15%" }}>{formattedDate}</td>
                  <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", fontWeight: "bold", width: "8%" }}>Idade</td>
                  <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", width: "17%" }}>{it.patientAge || ""}</td>
                </tr>
                <tr>
                  <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", fontWeight: "bold" }}>Setor</td>
                  <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm" }}>{getSectorDisplayLabel(it.patientSector)}</td>
                  <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", fontWeight: "bold" }}>Leito</td>
                  <td colSpan={3} style={{ border: "0.5px solid #000", padding: "1.5mm 2mm" }}>{it.patientBed}</td>
                </tr>
              </tbody>
            </table>

            {/* Legend */}
            <div style={{ display: "flex", gap: "4mm", marginBottom: "3mm", fontSize: "6pt", flexWrap: "wrap" }}>
              {STATUS_OPTIONS.map((s) => (
                <span key={s.code} style={{ fontWeight: "bold" }}>{s.code} = {s.label}</span>
              ))}
            </div>

            {/* Sections */}
            {ROUND_SECTIONS.map((section) => (
              <div key={section.code} style={{ marginBottom: "2mm", pageBreakInside: "avoid" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "7pt" }}>
                  <thead>
                    <tr>
                      <th colSpan={4} style={{
                        border: "0.5px solid #000", padding: "1.5mm 2mm", textAlign: "left",
                        fontSize: "7.5pt", fontWeight: "bold", background: "#e5e7eb",
                      }}>{section.title}</th>
                    </tr>
                    <tr>
                      <th style={{ border: "0.5px solid #000", padding: "1mm 2mm", width: "5%", textAlign: "center" }}>Nº</th>
                      <th style={{ border: "0.5px solid #000", padding: "1mm 2mm", width: "55%", textAlign: "left" }}>Item</th>
                      <th style={{ border: "0.5px solid #000", padding: "1mm 2mm", width: "8%", textAlign: "center" }}>Status</th>
                      <th style={{ border: "0.5px solid #000", padding: "1mm 2mm", width: "32%", textAlign: "left" }}>Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((item) => {
                      const key = `${section.code}_${item.id}`;
                      const resp = !blank ? it.responses?.[key] : undefined;
                      return (
                        <tr key={item.id}>
                          <td style={{ border: "0.5px solid #000", padding: "1mm 2mm", textAlign: "center" }}>{item.id}</td>
                          <td style={{ border: "0.5px solid #000", padding: "1mm 2mm" }}>{item.text}</td>
                          <td style={{ border: "0.5px solid #000", padding: "1mm 2mm", textAlign: "center", fontWeight: "bold", minHeight: "5mm" }}>
                            {resp?.status || ""}
                          </td>
                          <td style={{ border: "0.5px solid #000", padding: "1mm 2mm", fontSize: "6.5pt" }}>
                            {resp?.observation || ""}
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td colSpan={4} style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", fontSize: "6.5pt" }}>
                        <strong>Meta do dia:</strong> {(!blank && it.goals?.[section.code]) || "____________________________________________"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}

            {/* Observations */}
            <div style={{ marginTop: "2mm", border: "0.5px solid #000", padding: "2mm", fontSize: "7pt", pageBreakInside: "avoid", minHeight: "10mm" }}>
              <strong>Observações importantes:</strong> {(!blank && it.observations) || ""}
            </div>

            {/* Footer */}
            <div style={{ marginTop: "4mm", fontSize: "6pt", textAlign: "center", color: "#666", borderTop: "0.5px solid #999", paddingTop: "2mm" }}>
              Documento gerado eletronicamente em {generatedAt} • Round Diário Multiprofissional • Socorrão I
            </div>
          </div>
        );
      })}
    </div>
  );
});

PrintableRoundMulti.displayName = "PrintableRoundMulti";
export default PrintableRoundMulti;
