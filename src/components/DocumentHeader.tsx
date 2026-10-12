/**
 * Cabecalho padronizado dos impressos — versao React (impressao por DOM).
 * Desenha o MESMO layout de lib/documentHeaderLayout.ts que o renderizador
 * HTML (lib/documentHeaderHtml.ts) usa nas janelas de impressao.
 *
 * Modelos: "assistencial" (com alergias), "documental" (cadastro completo, sem
 * alergias) e "semPaciente" (so timbrado + faixa).
 */
import { Fragment } from "react";
import socorraoCross from "@/assets/socorrao-cross-logo.png";
import { whitelabel, getInstitutionalHeaderLines } from "@/config/whitelabel";
import {
  buildHeaderLayout,
  type HeaderInput,
  type HeaderCell,
} from "@/lib/documentHeaderLayout";
import { HEADER_STYLE as S } from "@/lib/documentHeaderHtml";

export interface DocumentHeaderProps extends HeaderInput {
  /** Largura util (default 186mm, a da prescricao). */
  width?: string;
}

const cell: React.CSSProperties = {
  border: S.cellBorder,
  padding: "3px 6px",
  fontSize: "7.5pt",
  lineHeight: 1.3,
  verticalAlign: "top",
};
const labelCell: React.CSSProperties = {
  ...cell,
  fontWeight: 700,
  fontSize: "6.2pt",
  backgroundColor: S.labelBg,
  color: S.labelInk,
  textTransform: "uppercase",
  letterSpacing: "0.3px",
  whiteSpace: "nowrap",
};

function valueStyle(c: HeaderCell): React.CSSProperties {
  const st: React.CSSProperties = { ...cell };
  if (c.strong) st.fontWeight = 700;
  if (c.label === "Paciente") Object.assign(st, { fontWeight: 800, fontSize: "8.6pt", letterSpacing: "-0.01em" });
  if (c.tone === "allergyOk") Object.assign(st, { color: S.allergyOkInk, backgroundColor: S.allergyOkBg });
  if (c.tone === "allergyAlert") Object.assign(st, { color: S.allergyAlertInk, backgroundColor: S.allergyAlertBg });
  return st;
}

export function DocumentHeader({ width = "186mm", ...input }: DocumentHeaderProps) {
  const layout = buildHeaderLayout(input);
  const colors = whitelabel.theme.institutionalColors;
  const lines = getInstitutionalHeaderLines();
  return (
    <div style={{ width, margin: "0 auto", position: "relative", zIndex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingBottom: "4px" }}>
        <img
          src={socorraoCross}
          alt={whitelabel.institution.hospitalLogoAlt}
          style={{ width: "40px", height: "40px", objectFit: "contain", flexShrink: 0 }}
        />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "6.5pt", fontWeight: 600, color: S.inkSoft, letterSpacing: "0.5px", textTransform: "uppercase" }}>
            {lines[0]} · {lines[1]}
          </div>
          <div style={{ fontSize: "10pt", fontWeight: 800, color: S.ink, letterSpacing: "0.7px", textTransform: "uppercase", marginTop: "2px", lineHeight: 1.15 }}>
            {lines[2]}
          </div>
        </div>
        <div style={{ minWidth: "120px", textAlign: "right", borderLeft: `1px solid ${S.line}`, paddingLeft: "10px" }}>
          <div style={{ fontSize: "6pt", color: S.inkMuted, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 700 }}>Emissão</div>
          <div style={{ fontSize: "9pt", fontWeight: 800, color: S.ink, marginTop: "2px", letterSpacing: "0.3px" }}>{layout.emission}</div>
        </div>
      </div>
      <div style={{ display: "flex", height: "3px" }}>
        <div style={{ flex: 1, backgroundColor: colors.red }} />
        <div style={{ flex: 1, backgroundColor: colors.orange }} />
        <div style={{ flex: 1, backgroundColor: colors.yellow }} />
        <div style={{ flex: 1, backgroundColor: colors.green }} />
        <div style={{ flex: 1, backgroundColor: colors.blue }} />
      </div>
      <div
        style={{
          backgroundColor: S.band,
          color: "#fff",
          ...(layout.complement
            ? { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", columnGap: "8px" }
            : { textAlign: "center" as const }),
          padding: "5px 9px",
          marginTop: "4px",
          marginBottom: layout.rows.length ? 0 : "6px",
        }}
      >
        <b style={{ ...(layout.complement ? { gridColumn: 2 } : {}), textAlign: "center", fontSize: "8.6pt", letterSpacing: "0.9px", textTransform: "uppercase" }}>{layout.title}</b>
        {layout.complement && (
          <span style={{ gridColumn: 3, justifySelf: "end", textAlign: "right", fontSize: "7pt", letterSpacing: "0.4px", textTransform: "uppercase", opacity: 0.92, lineHeight: 1.2 }}>
            {layout.complement}
          </span>
        )}
      </div>
      {layout.rows.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6pt", pageBreakInside: "avoid", breakInside: "avoid" }}>
          <tbody>
            {layout.rows.map((row, i) => (
              <tr key={i}>
                {row.map((c) => (
                  <Fragment key={c.label}>
                    <td style={c.alertLabel ? { ...labelCell, color: S.allergyLabelInk } : labelCell}>{c.label}</td>
                    <td style={valueStyle(c)} colSpan={c.span && c.span > 1 ? c.span : undefined}>
                      {c.value}
                      {c.sub && <div style={{ fontSize: "6.5pt", fontWeight: 400, color: S.labelInk, marginTop: "1px" }}>{c.sub}</div>}
                    </td>
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
