import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  patientName: string;
  medicalRecord?: string | null;
  birthDate?: string | null;
  sex?: string | null;
  encounterCode?: string | null;
  motherName?: string | null;
}

/**
 * Layout de impressão de pulseira de identificação hospitalar (54x25mm).
 * Renderizado dentro de um window.open() pela função `printWristband()`.
 */
export function PatientWristband({
  patientName, medicalRecord, birthDate, sex, encounterCode, motherName,
}: Props) {
  const dn = birthDate ? format(new Date(birthDate + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "—";
  return (
    <div
      style={{
        width: "54mm",
        minHeight: "25mm",
        padding: "2mm 3mm",
        fontFamily: "Inter, system-ui, sans-serif",
        border: "1px solid #000",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontSize: "8pt", fontWeight: 700, lineHeight: 1.1, textTransform: "uppercase" }}>
        {patientName}
      </div>
      {motherName && (
        <div style={{ fontSize: "5.5pt", color: "#444", lineHeight: 1.1 }}>
          Mãe: {motherName}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "6pt", marginTop: "1mm" }}>
        <span><strong>DN:</strong> {dn}</span>
        <span><strong>Sexo:</strong> {sex || "—"}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "6pt", borderTop: "1px solid #000", paddingTop: "1mm", marginTop: "1mm" }}>
        <span style={{ fontFamily: "monospace" }}>{medicalRecord || "—"}</span>
        {encounterCode && <span style={{ fontFamily: "monospace" }}>ATD: {encounterCode}</span>}
      </div>
    </div>
  );
}

/**
 * Abre janela de impressão renderizando uma pulseira simples.
 * Não depende de React no popup (gera HTML estático).
 */
export function printWristband(p: Props) {
  const w = window.open("", "_blank", "width=400,height=300");
  if (!w) return;
  const dn = p.birthDate ? format(new Date(p.birthDate + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "—";
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Pulseira — ${p.patientName}</title>
    <style>
      @page { size: 54mm 25mm; margin: 0; }
      body { margin: 0; font-family: Inter, system-ui, sans-serif; }
      .wb { width: 54mm; min-height: 25mm; padding: 2mm 3mm; border: 1px solid #000; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
      .name { font-size: 8pt; font-weight: 700; line-height: 1.1; text-transform: uppercase; }
      .mom { font-size: 5.5pt; color: #444; line-height: 1.1; }
      .row { display: flex; justify-content: space-between; font-size: 6pt; margin-top: 1mm; }
      .foot { display: flex; justify-content: space-between; font-size: 6pt; border-top: 1px solid #000; padding-top: 1mm; margin-top: 1mm; font-family: monospace; }
    </style></head>
    <body>
      <div class="wb">
        <div class="name">${escape(p.patientName)}</div>
        ${p.motherName ? `<div class="mom">Mãe: ${escape(p.motherName)}</div>` : ""}
        <div class="row"><span><strong>DN:</strong> ${dn}</span><span><strong>Sexo:</strong> ${p.sex || "—"}</span></div>
        <div class="foot"><span>${p.medicalRecord || "—"}</span>${p.encounterCode ? `<span>ATD: ${p.encounterCode}</span>` : ""}</div>
      </div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
    </body></html>`;
  w.document.write(html);
  w.document.close();
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
