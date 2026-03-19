import { forwardRef } from "react";
import { ROUND_SECTIONS, STATUS_OPTIONS, type RoundStatus } from "@/data/roundChecklistSchema";
import { format } from "date-fns";

interface PrintableRoundProps {
  patientName: string;
  patientSector: string;
  patientBed: string;
  patientAge: string | null;
  roundDate: string;
  responses: Record<string, { status: RoundStatus | null; observation: string }>;
  goals: Record<string, string>;
  observations: string;
}

const PrintableRound = forwardRef<HTMLDivElement, PrintableRoundProps>(
  ({ patientName, patientSector, patientBed, patientAge, roundDate, responses, goals, observations }, ref) => {
    const formattedDate = (() => {
      try {
        return format(new Date(roundDate + "T12:00:00"), "dd/MM/yyyy");
      } catch {
        return roundDate;
      }
    })();

    return (
      <div ref={ref} className="print-round-container" style={{ display: "none" }}>
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            .print-round-container, .print-round-container * { visibility: visible !important; }
            .print-round-container {
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
              padding: 8mm;
            }
            @page {
              size: A4 portrait;
              margin: 6mm;
            }
          }
        `}</style>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "4mm", borderBottom: "1px solid #000", paddingBottom: "3mm" }}>
          <div style={{ fontSize: "8pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Hospital Municipal Djalma Marques – Socorrão I
          </div>
          <div style={{ fontSize: "10pt", fontWeight: "bold", margin: "2mm 0" }}>
            ROUND DIÁRIO MULTIPROFISSIONAL
          </div>
        </div>

        {/* Patient info */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "3mm", fontSize: "7pt" }}>
          <tbody>
            <tr>
              <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", fontWeight: "bold", width: "15%" }}>Paciente</td>
              <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", width: "35%" }}>{patientName}</td>
              <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", fontWeight: "bold", width: "10%" }}>Data</td>
              <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", width: "15%" }}>{formattedDate}</td>
              <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", fontWeight: "bold", width: "8%" }}>Idade</td>
              <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", width: "17%" }}>{patientAge || ""}</td>
            </tr>
            <tr>
              <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", fontWeight: "bold" }}>Setor</td>
              <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm" }}>{patientSector}</td>
              <td style={{ border: "0.5px solid #000", padding: "1.5mm 2mm", fontWeight: "bold" }}>Leito</td>
              <td colSpan={3} style={{ border: "0.5px solid #000", padding: "1.5mm 2mm" }}>{patientBed}</td>
            </tr>
          </tbody>
        </table>

        {/* Legend */}
        <div style={{ display: "flex", gap: "4mm", marginBottom: "3mm", fontSize: "6pt", flexWrap: "wrap" }}>
          {STATUS_OPTIONS.map((s) => (
            <span key={s.code} style={{ fontWeight: "bold" }}>
              {s.code} = {s.label}
            </span>
          ))}
        </div>

        {/* Sections */}
        {ROUND_SECTIONS.map((section) => (
          <div key={section.code} style={{ marginBottom: "2mm", pageBreakInside: "avoid" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "7pt" }}>
              <thead>
                <tr>
                  <th colSpan={4} style={{
                    border: "0.5px solid #000",
                    padding: "1.5mm 2mm",
                    textAlign: "left",
                    fontSize: "7.5pt",
                    fontWeight: "bold",
                    background: "#e5e7eb",
                  }}>
                    {section.title}
                  </th>
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
                  const resp = responses[key];
                  return (
                    <tr key={item.id}>
                      <td style={{ border: "0.5px solid #000", padding: "1mm 2mm", textAlign: "center" }}>{item.id}</td>
                      <td style={{ border: "0.5px solid #000", padding: "1mm 2mm" }}>{item.text}</td>
                      <td style={{ border: "0.5px solid #000", padding: "1mm 2mm", textAlign: "center", fontWeight: "bold" }}>
                        {resp?.status || ""}
                      </td>
                      <td style={{ border: "0.5px solid #000", padding: "1mm 2mm", fontSize: "6.5pt" }}>
                        {resp?.observation || ""}
                      </td>
                    </tr>
                  );
                })}
                {/* Goal row */}
                <tr>
                  <td colSpan={4} style={{
                    border: "0.5px solid #000",
                    padding: "1.5mm 2mm",
                    fontSize: "6.5pt",
                  }}>
                    <strong>Meta do dia:</strong> {goals[section.code] || "____________________"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        {/* Observations */}
        {observations && (
          <div style={{ marginTop: "2mm", border: "0.5px solid #000", padding: "2mm", fontSize: "7pt", pageBreakInside: "avoid" }}>
            <strong>Observações importantes:</strong> {observations}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: "4mm", fontSize: "6pt", textAlign: "center", color: "#666", borderTop: "0.5px solid #999", paddingTop: "2mm" }}>
          Documento gerado eletronicamente em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")} • Round Diário Multiprofissional • Socorrão I
        </div>
      </div>
    );
  }
);

PrintableRound.displayName = "PrintableRound";

export default PrintableRound;
