import type { Patient } from "@/types/patient";
import { calcDIH } from "@/lib/dihCalc";
import { getMainPageTitle } from "@/config/whitelabel";

/**
 * Censo do setor para impressao (lista administrativa) — o que o botao "imprimir
 * mapa do setor" gera agora, no lugar do detalhamento clinico (que migrou para a
 * Passagem de Plantao). Colunas: Leito, Paciente, Prontuario, Atendimento, DIH,
 * TPS, Adm. hospital, Adm. setor, Prev. alta do setor.
 *
 * DIH (dias de internacao hospitalar) = desde a admissao hospitalar (data_entrada),
 * nao reinicia na transferencia. TPS (tempo de permanencia no setor) = desde a
 * entrada no setor atual (sectorSince; fallback data_entrada).
 *
 * Renderizado dentro de .print-layout-container (escondido na tela, visivel na
 * impressao). Estilos inline para nao depender de classes externas no papel.
 */

interface Props {
  patients: Patient[];
  sectorLabel?: string;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDays(n: number | null): string {
  return n == null ? "—" : `${n}d`;
}

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  color: "#333",
  borderBottom: "1.5px solid #222",
  padding: "5px 6px",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  fontSize: 10,
  color: "#111",
  borderBottom: "1px solid #ddd",
  padding: "4px 6px",
  verticalAlign: "top",
};

export function PrintSectorCensus({ patients, sectorLabel }: Props) {
  const rows = patients
    .filter((p) => !p.isVacant && p.name?.trim() && p.bedNumber)
    .sort((a, b) => (a.bedNumber || "").localeCompare(b.bedNumber || "", "pt-BR", { numeric: true }));

  const dateStr = new Date().toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div style={{ fontFamily: "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif", color: "#111", padding: "6px 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #111", paddingBottom: 6, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Censo do Setor — {sectorLabel || "Setor"}</div>
          <div style={{ fontSize: 10, color: "#444" }}>{getMainPageTitle()}</div>
        </div>
        <div style={{ fontSize: 10, color: "#444", textAlign: "right" }}>
          {dateStr}<br />
          {rows.length} paciente{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "#777", padding: "24px 0", textAlign: "center" }}>
          Nenhum paciente ativo neste setor.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Leito</th>
              <th style={th}>Paciente</th>
              <th style={th}>Prontuário</th>
              <th style={th}>Atendimento</th>
              <th style={{ ...th, textAlign: "center" }}>DIH</th>
              <th style={{ ...th, textAlign: "center" }}>TPS</th>
              <th style={th}>Adm. hospital</th>
              <th style={th}>Adm. setor</th>
              <th style={th}>Prev. alta setor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const dih = calcDIH(p.admissionDate);
              const tps = calcDIH(p.sectorSince ?? p.admissionDate);
              const prevAlta = Array.isArray(p.utiDischargePrediction) ? p.utiDischargePrediction[0] : undefined;
              return (
                <tr key={p.id}>
                  <td style={{ ...td, fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 700, whiteSpace: "nowrap" }}>{p.bedNumber}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{p.prontuario || "—"}</td>
                  {/* Atendimento: sem coluna no schema novo (degradado) — placeholder. */}
                  <td style={{ ...td, whiteSpace: "nowrap", color: "#999" }}>—</td>
                  <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{fmtDays(dih)}</td>
                  <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{fmtDays(tps)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(p.admissionDate)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(p.sectorSince ?? p.admissionDate)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(prevAlta)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default PrintSectorCensus;
