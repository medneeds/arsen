/**
 * Cabeçalho institucional Norma Zero (MAN.05-001) — versão React
 * para uso em layouts impressos baseados em DOM (sem janela pop-up).
 *
 * Espelha o template de src/lib/printNormaZero.ts e o cabeçalho
 * já em uso na Ficha de Atendimento Consolidada.
 */

import socorraoCross from "@/assets/socorrao-cross-logo.png";
import { whitelabel, getInstitutionalHeaderLines } from "@/config/whitelabel";

export interface NormaZeroPrintHeaderProps {
  /** Rótulo do documento exibido na coluna direita (ex: "Prescrição Médica Diária") */
  documentLabel: string;
  /** Código gerado do documento (ex: "PRESC-20260118-1422") */
  documentCode?: string;
  /** Subtítulo opcional sob o código (ex: data/turno) */
  documentSubtitle?: string;
  /** Largura útil — alinha com o layout impresso (default 182mm) */
  width?: string;
}

const ink = "#0a1628";
const inkSoft = "#475569";
const inkMuted = "#94a3b8";
const lineSoft = "#cbd5e1";

export function NormaZeroPrintHeader({
  documentLabel,
  documentCode,
  documentSubtitle,
  width = "182mm",
}: NormaZeroPrintHeaderProps) {
  const inst = whitelabel.institution;
  const colors = whitelabel.theme.institutionalColors;
  const headerLines = getInstitutionalHeaderLines();

  return (
    <div style={{ width, margin: "0 auto", position: "relative", zIndex: 1 }}>
      {/* Hierarquia institucional + logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          paddingBottom: "8px",
        }}
      >
        <img
          src={socorraoCross}
          alt={inst.hospitalLogoAlt}
          style={{
            width: "62px",
            height: "62px",
            objectFit: "contain",
            flexShrink: 0,
          }}
        />

        <div style={{ flex: 1, textAlign: "center" }}>
          <div
            style={{
              fontSize: "7.5pt",
              fontWeight: 600,
              color: inkSoft,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
            }}
          >
            {headerLines[0]}
          </div>
          <div
            style={{
              fontSize: "8pt",
              fontWeight: 600,
              color: inkSoft,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              marginTop: "1px",
            }}
          >
            {headerLines[1]}
          </div>
          <div
            style={{
              fontSize: "11pt",
              fontWeight: 800,
              color: ink,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              marginTop: "3px",
              lineHeight: 1.15,
            }}
          >
            {headerLines[2]}
          </div>
          <div
            style={{
              fontSize: "6.5pt",
              color: inkMuted,
              marginTop: "3px",
              fontStyle: "italic",
            }}
          >
            {inst.address}
          </div>
        </div>

        {/* Bloco direito — rótulo e código do documento */}
        <div
          style={{
            minWidth: "120px",
            textAlign: "right",
            borderLeft: `1px solid ${lineSoft}`,
            paddingLeft: "10px",
          }}
        >
          <div
            style={{
              fontSize: "6pt",
              color: inkMuted,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            {documentLabel}
          </div>
          {documentCode && (
            <div
              style={{
                fontSize: "10pt",
                fontWeight: 800,
                color: ink,
                marginTop: "2px",
                letterSpacing: "0.4px",
              }}
            >
              {documentCode}
            </div>
          )}
          {documentSubtitle && (
            <div
              style={{
                fontSize: "6.5pt",
                color: inkMuted,
                marginTop: "2px",
              }}
            >
              {documentSubtitle}
            </div>
          )}
        </div>
      </div>

      {/* Cruz colorida institucional — 5 cores Socorrão */}
      <div style={{ display: "flex", height: "4px", marginBottom: "8px" }}>
        <div style={{ flex: 1, backgroundColor: colors.red }} />
        <div style={{ flex: 1, backgroundColor: colors.orange }} />
        <div style={{ flex: 1, backgroundColor: colors.yellow }} />
        <div style={{ flex: 1, backgroundColor: colors.green }} />
        <div style={{ flex: 1, backgroundColor: colors.blue }} />
      </div>
    </div>
  );
}

/** Rodapé Norma Zero — código MAN.05-001 + referências legais */
export function NormaZeroPrintFooter({ width = "182mm" }: { width?: string }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      style={{
        width,
        margin: "10pt auto 0",
        paddingTop: "4pt",
        borderTop: `1px solid ${lineSoft}`,
        fontSize: "6.5pt",
        color: inkSoft,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span>
        <strong>{whitelabel.institution.hospitalAbbreviation}</strong> —{" "}
        {whitelabel.platform.fullName}
      </span>
      <span>
        {whitelabel.compliance.normaZeroCode} v{whitelabel.compliance.normaZeroVersion} •{" "}
        {whitelabel.compliance.legalReferences}
      </span>
      <span>
        {dateStr} {timeStr}
      </span>
    </div>
  );
}

/** Gera código de documento padrão Norma Zero {PREFIX}-YYYYMMDD-HHMM */
export function generatePrintDocCode(prefix: string = "DOC"): string {
  const now = new Date();
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const t = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  return `${prefix}-${d}-${t}`;
}
