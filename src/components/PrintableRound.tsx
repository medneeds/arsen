import { forwardRef, useEffect, useState } from "react";
import { ROUND_SECTIONS, STATUS_OPTIONS, type RoundStatus } from "@/data/roundChecklistSchema";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { format } from "date-fns";
import { DocumentHeader } from "@/components/DocumentHeader";
import { useHeaderPatient } from "@/hooks/useHeaderPatient";
import { asUuidOrNull } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface PrintableRoundProps {
  patientName: string;
  patientSector: string;
  patientBed: string;
  patientAge: string | null;
  patientRecord?: string | null;
  /** Id da internacao — completa alergias e atendimento a partir do cadastro. */
  patientId?: string | null;
  diagnosis?: string | null;
  roundDate: string;
  responses: Record<string, { status: RoundStatus | null; observation: string }>;
  goals: Record<string, string>;
  observations: string;
}

const PrintableRound = forwardRef<HTMLDivElement, PrintableRoundProps>(
  ({ patientName, patientSector, patientBed, patientAge, patientRecord, patientId, diagnosis, roundDate, responses, goals, observations }, ref) => {
    const formattedDate = (() => {
      try {
        return format(new Date(roundDate + "T12:00:00"), "dd/MM/yyyy");
      } catch {
        return roundDate;
      }
    })();

    const headerPatient = useHeaderPatient(asUuidOrNull(patientId), {
      name: patientName,
      bed: patientBed,
      sector: getSectorDisplayLabel(patientSector),
      record: patientRecord,
      age: patientAge,
    });

    // Seed (CID) + descricao + hipoteses diagnosticas da evolucao/admissao MAIS
    // RECENTE (soap.__cid_primary / __diagnostic_hypotheses). O D0 da admissao e uma
    // evolucao, entao quando so ha admissao vem dela; ao evoluir, o topo vence.
    const [diag, setDiag] = useState<{ cidCode: string; cidDesc: string; hypotheses: string }>(
      { cidCode: "", cidDesc: "", hypotheses: "" },
    );
    useEffect(() => {
      const id = asUuidOrNull(patientId);
      if (!id) { setDiag({ cidCode: "", cidDesc: "", hypotheses: "" }); return; }
      let alive = true;
      (async () => {
        const { data } = await supabase
          .from("evolucoes")
          .select("soap, data_hora")
          .eq("internacao_id", id)
          .order("data_hora", { ascending: false })
          .limit(5);
        if (!alive) return;
        const rows = ((data ?? []) as { soap?: Record<string, unknown> }[])
          .map((r) => (r?.soap ?? {}) as Record<string, unknown>);
        const cidRaw = String(
          (rows.find((s) => typeof s.__cid_primary === "string" && !!(s.__cid_primary as string))?.__cid_primary) ?? "",
        );
        const cidCode = cidRaw.split(/\s[-–—]\s/)[0].trim();
        const cidDesc = cidRaw.slice(cidCode.length).replace(/^\s*[-–—]\s*/, "").trim();
        const hypotheses = String(
          (rows.find((s) => typeof s.__diagnostic_hypotheses === "string" && !!(s.__diagnostic_hypotheses as string))?.__diagnostic_hypotheses) ?? "",
        ).trim();
        setDiag({ cidCode, cidDesc, hypotheses });
      })();
      return () => { alive = false; };
    }, [patientId]);

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

        {/* Cabeçalho padronizado (modelo assistencial, grade enxuta para caber em 1 folha) */}
        <DocumentHeader
          model="assistencial"
          dense
          title="Round diário multiprofissional"
          complement={`Data do round: ${formattedDate}`}
          emission={format(new Date(), "dd/MM/yyyy HH:mm:ss")}
          width="100%"
          patient={headerPatient}
          extras={[
            ["CID (seed)", diag.cidCode || undefined],
            ["Descrição do CID", diag.cidDesc || undefined],
            ["Hipóteses diagnósticas", (diag.hypotheses || diagnosis) || undefined],
          ]}
        />

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
