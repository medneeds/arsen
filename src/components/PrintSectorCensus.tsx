import type { Patient } from "@/types/patient";
import { getMainPageTitle } from "@/config/whitelabel";

/**
 * Censo do setor para impressao (documento administrativo em lista) — o que o
 * botao "imprimir mapa do setor" gera no lugar do detalhamento clinico (que
 * migrou para a Passagem de Plantao).
 *
 * Colunas (ordem definida pelo Artur): Leito, Prontuario, Atendimento, Paciente,
 * Idade, Nascimento, Adm. hospital, Adm. setor, Prev. alta do setor.
 *
 * Orientacao PAISAGEM: nao existe @page no index.css (so um @media print), entao
 * sem isto a folha sai em retrato e as colunas estouram. O @page vive num <style>
 * escopado aqui — como o componente so e montado durante a impressao do censo
 * (printMode no mapa), a regra landscape nao vaza para outros impressos (ex.: a
 * prescricao, que e retrato).
 *
 * ATENDIMENTO: internacoes.numero_atendimento resolvido FORA da query principal
 * do mapa (leitura tolerante, ver Index.tsx) e entregue aqui por atendimentoById,
 * chaveado pelo patient.id (= internacao_id quando o leito esta ocupado). Ausente
 * => "—" (coluna recem-criada; pode nao estar aplicada no banco ainda).
 *
 * Renderizado dentro de .print-layout-container (escondido na tela, visivel na
 * impressao). Estilos inline para nao depender de classes externas no papel.
 */

interface Props {
  patients: Patient[];
  sectorLabel?: string;
  atendimentoById?: Map<string, string | null>;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  color: "#222",
  borderBottom: "1.5px solid #111",
  padding: "6px 8px",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  fontSize: 10,
  color: "#111",
  borderBottom: "1px solid #ddd",
  padding: "5px 8px",
  verticalAlign: "top",
};

export function PrintSectorCensus({ patients, sectorLabel, atendimentoById }: Props) {
  const rows = patients
    .filter((p) => !p.isVacant && p.name?.trim() && p.bedNumber)
    .sort((a, b) => (a.bedNumber || "").localeCompare(b.bedNumber || "", "pt-BR", { numeric: true }));

  const dateStr = new Date().toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div
      className="censo-doc"
      style={{ fontFamily: "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif", color: "#111", padding: "2px 2px" }}
    >
      {/* Orientacao paisagem + comportamento de tabela em quebra de pagina.
          Escopo do documento do censo (classe .censo-doc) — nao afeta outros
          impressos do app. */}
      <style>{`
        @page { size: A4 landscape; margin: 8mm 10mm; }
        @media print {
          .censo-doc table { page-break-inside: auto; }
          .censo-doc thead { display: table-header-group; }
          .censo-doc tfoot { display: table-footer-group; }
          .censo-doc tr { page-break-inside: avoid; }
        }
      `}</style>

      {/* Cabecalho do documento: identidade (sistema/hospital) + titulo + meta. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #111", paddingBottom: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#555" }}>
            {getMainPageTitle()}
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>
            Censo do Setor — {sectorLabel || "Setor"}
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#444", textAlign: "right", lineHeight: 1.5 }}>
          <div>Emitido em {dateStr}</div>
          <div style={{ fontWeight: 700, color: "#111" }}>
            {rows.length} paciente{rows.length !== 1 ? "s" : ""}
          </div>
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
              <th style={th}>Prontuário</th>
              <th style={th}>Atendimento</th>
              <th style={th}>Paciente</th>
              <th style={{ ...th, textAlign: "center" }}>Idade</th>
              <th style={th}>Nascimento</th>
              <th style={th}>Adm. hospital</th>
              <th style={th}>Adm. setor</th>
              <th style={th}>Prev. alta setor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const prevAlta = Array.isArray(p.utiDischargePrediction) ? p.utiDischargePrediction[0] : undefined;
              const atendimento = atendimentoById?.get(p.id) ?? null;
              return (
                <tr key={p.id}>
                  <td style={{ ...td, fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 700, whiteSpace: "nowrap" }}>{p.bedNumber}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{p.prontuario || "—"}</td>
                  <td style={{ ...td, fontFamily: "ui-monospace, Menlo, monospace", whiteSpace: "nowrap" }}>{atendimento || "—"}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{p.age || "—"}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(p.birthDate)}</td>
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
