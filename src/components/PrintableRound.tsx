import { forwardRef } from "react";
import { ROUND_SECTIONS, STATUS_OPTIONS, type RoundStatus } from "@/data/roundChecklistSchema";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { format } from "date-fns";
import socorraoCross from "@/assets/socorrao-cross-logo.png";

interface PrintableRoundProps {
  patientName: string;
  patientSector: string;
  patientBed: string;
  patientAge: string | null;
  patientRecord?: string | null;
  diagnosis?: string | null;
  roundDate: string;
  responses: Record<string, { status: RoundStatus | null; observation: string }>;
  goals: Record<string, string>;
  observations: string;
}

const PrintableRound = forwardRef<HTMLDivElement, PrintableRoundProps>(
  ({ patientName, patientSector, patientBed, patientAge, patientRecord, diagnosis, roundDate, responses, goals, observations }, ref) => {
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
              line-height: 1.12;
              padding: 5mm;
            }
            @page {
              size: A4 portrait;
              margin: 6mm;
            }
          }
        `}</style>

        {/* Header — logo do hospital + identificacao institucional */}
        <div style={{ display: "flex", alignItems: "center", gap: "3mm", marginBottom: "2mm", borderBottom: "1px solid #000", paddingBottom: "1.5mm" }}>
          <img src={socorraoCross} alt="Socorrão I" style={{ height: "11mm", width: "11mm", objectFit: "contain", flexShrink: 0 }} />
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: "8pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Hospital Municipal Djalma Marques – Socorrão I
            </div>
            <div style={{ fontSize: "10pt", fontWeight: "bold", marginTop: "0.5mm" }}>
              ROUND DIÁRIO MULTIPROFISSIONAL
            </div>
          </div>
          {/* espacador para centralizar o titulo com a logo a esquerda */}
          <div style={{ width: "11mm", flexShrink: 0 }} />
        </div>

        {/* Patient info */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "2mm", fontSize: "7pt" }}>
          <tbody>
            <tr>
              <td style={{ border: "0.5px solid #000", padding: "0.8mm 1.5mm", fontWeight: "bold", width: "13%" }}>Paciente</td>
              <td style={{ border: "0.5px solid #000", padding: "0.8mm 1.5mm", width: "37%" }}>{patientName}</td>
              <td style={{ border: "0.5px solid #000", padding: "0.8mm 1.5mm", fontWeight: "bold", width: "13%" }}>Prontuário</td>
              <td style={{ border: "0.5px solid #000", padding: "0.8mm 1.5mm", width: "15%" }}>{patientRecord || "—"}</td>
              <td style={{ border: "0.5px solid #000", padding: "0.8mm 1.5mm", fontWeight: "bold", width: "7%" }}>Idade</td>
              <td style={{ border: "0.5px solid #000", padding: "0.8mm 1.5mm", width: "15%" }}>{patientAge || ""}</td>
            </tr>
            <tr>
              <td style={{ border: "0.5px solid #000", padding: "0.8mm 1.5mm", fontWeight: "bold" }}>Setor</td>
              <td style={{ border: "0.5px solid #000", padding: "0.8mm 1.5mm" }}>{getSectorDisplayLabel(patientSector)}</td>
              <td style={{ border: "0.5px solid #000", padding: "0.8mm 1.5mm", fontWeight: "bold" }}>Leito</td>
              <td style={{ border: "0.5px solid #000", padding: "0.8mm 1.5mm" }}>{patientBed}</td>
              <td style={{ border: "0.5px solid #000", padding: "0.8mm 1.5mm", fontWeight: "bold" }}>Data</td>
              <td style={{ border: "0.5px solid #000", padding: "0.8mm 1.5mm" }}>{formattedDate}</td>
            </tr>
            <tr>
              <td style={{ border: "0.5px solid #000", padding: "0.8mm 1.5mm", fontWeight: "bold" }}>Hipóteses diagnósticas</td>
              <td colSpan={5} style={{ border: "0.5px solid #000", padding: "0.8mm 1.5mm" }}>{diagnosis || "—"}</td>
            </tr>
          </tbody>
        </table>

        {/* Legend */}
        <div style={{ display: "flex", gap: "3mm", marginBottom: "1.5mm", fontSize: "6pt", flexWrap: "wrap" }}>
          {STATUS_OPTIONS.map((s) => (
            <span key={s.code} style={{ fontWeight: "bold" }}>
              {s.code} = {s.label}
            </span>
          ))}
        </div>

        {/* Sections */}
        {ROUND_SECTIONS.map((section) => (
          <div key={section.code} style={{ marginBottom: "1mm", pageBreakInside: "avoid" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "7pt" }}>
              <thead>
                <tr>
                  <th colSpan={4} style={{
                    border: "0.5px solid #000",
                    padding: "0.8mm 1.5mm",
                    textAlign: "left",
                    fontSize: "7.5pt",
                    fontWeight: "bold",
                    background: "#e5e7eb",
                  }}>
                    {section.title}
                  </th>
                </tr>
                <tr>
                  <th style={{ border: "0.5px solid #000", padding: "0.6mm 1.5mm", width: "5%", textAlign: "center" }}>Nº</th>
                  <th style={{ border: "0.5px solid #000", padding: "0.6mm 1.5mm", width: "55%", textAlign: "left" }}>Item</th>
                  <th style={{ border: "0.5px solid #000", padding: "0.6mm 1.5mm", width: "8%", textAlign: "center" }}>Status</th>
                  <th style={{ border: "0.5px solid #000", padding: "0.6mm 1.5mm", width: "32%", textAlign: "left" }}>Observação</th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item) => {
                  const key = `${section.code}_${item.id}`;
                  const resp = responses[key];
                  return (
                    <tr key={item.id}>
                      <td style={{ border: "0.5px solid #000", padding: "0.6mm 1.5mm", textAlign: "center" }}>{item.id}</td>
                      <td style={{ border: "0.5px solid #000", padding: "0.6mm 1.5mm" }}>{item.text}</td>
                      <td style={{ border: "0.5px solid #000", padding: "0.6mm 1.5mm", textAlign: "center", fontWeight: "bold" }}>
                        {resp?.status || ""}
                      </td>
                      <td style={{ border: "0.5px solid #000", padding: "0.6mm 1.5mm", fontSize: "6.5pt" }}>
                        {resp?.observation || ""}
                      </td>
                    </tr>
                  );
                })}
                {/* Goal row */}
                <tr>
                  <td colSpan={4} style={{
                    border: "0.5px solid #000",
                    padding: "0.8mm 1.5mm",
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
          <div style={{ marginTop: "1.5mm", border: "0.5px solid #000", padding: "2mm", fontSize: "7pt", pageBreakInside: "avoid" }}>
            <strong>Observações importantes:</strong> {observations}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: "2mm", fontSize: "6pt", textAlign: "center", color: "#666", borderTop: "0.5px solid #999", paddingTop: "2mm" }}>
          Documento gerado eletronicamente em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")} • Round Diário Multiprofissional • Socorrão I
        </div>
      </div>
    );
  }
);

PrintableRound.displayName = "PrintableRound";

export default PrintableRound;
