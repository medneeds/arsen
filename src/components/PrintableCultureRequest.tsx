/**
 * Solicitação de Exame Microbiológico — padrão hospitalar (estrutura tabular única).
 *
 * Espelha o formulário oficial da unidade: tabela única estilo planilha,
 * cabeçalho institucional Norma Zero (mantém branding atual da plataforma),
 * linhas com label + valor, seção "Exames Solicitados" com checkboxes verticais,
 * dados da mãe quando paciente < 18 anos, observação importante no rodapé.
 *
 * - `printCultureRequest(...)` abre janela popup para impressão real.
 * - `<PrintableCultureRequest />` renderiza pré-visualização idêntica em diálogo.
 */

import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  buildNormaZeroDocument,
  openPrintWindow,
  prepareLogo,
  generateDocCode,
} from "@/lib/printNormaZero";
import {
  NormaZeroPrintHeader,
  NormaZeroPrintFooter,
} from "@/components/NormaZeroPrintHeader";
import { whitelabel } from "@/config/whitelabel";


/* ───────────────────────── Tipos & catálogos ───────────────────────── */

export interface CultureRequestData {
  patient_name: string;
  patient_social_name?: string | null;
  patient_birth_date?: string | null; // ISO YYYY-MM-DD
  patient_cns?: string | null;
  patient_cpf?: string | null;
  patient_record?: string | null; // prontuário
  patient_sector?: string | null;
  patient_bed?: string | null;
  // Dados da mãe (obrigatório se < 18)
  mother_name?: string | null;
  mother_birth_date?: string | null;
  // Antecedentes para cultura
  hospitalized_last_30d?: boolean | null;
  used_antibiotic_last_24h?: boolean | null;
  antibiotic_name?: string | null;
  antibiotic_start_date?: string | null;
  // Tipo de antibiótico em uso
  antibiotic_use?: "profilatico" | "terapeutico" | null;
  // Itens (lista de strings ou {name, samples?})
  items: Array<string | { name: string; samples?: number | string }>;
  clinical_indication?: string | null;
  notes?: string | null;
  requested_by_name?: string | null;
  created_at: string; // ISO
}

interface PrintableCultureRequestProps {
  request: CultureRequestData;
  sectorLabel?: (s: string | null) => string;
}

/** Catálogo padronizado da imagem de referência. Aceita sufixo "amostras". */
const CULTURE_CATALOG: Array<{ key: string; label: string; sampleField?: boolean }> = [
  { key: "hemo_aerobio", label: "Hemocultura para aeróbios", sampleField: true },
  { key: "hemo_anaerobio", label: "Hemocultura para anaeróbios", sampleField: true },
  { key: "hemo_fungos", label: "Hemocultura para fungos" },
  { key: "urocultura", label: "Urocultura" },
  { key: "secrecao", label: "Secreção" },
  { key: "fragmento", label: "Fragmento" },
  { key: "swab", label: "SWAB" },
  { key: "outros", label: "Outros" },
];

const escapeHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* ───────────────────────── Helpers de mapeamento ───────────────────────── */

/** Para cada item do catálogo, decide se está marcado e extrai amostras (se aplicável). */
function mapCatalog(items: CultureRequestData["items"]) {
  const normalized = items.map((it) => {
    const name = typeof it === "string" ? it : it?.name || "";
    const samples =
      typeof it === "object" && it !== null && "samples" in it ? it.samples : undefined;
    return { raw: name, lower: name.toLowerCase(), samples };
  });

  const matchKey = (key: string, label: string) => {
    const lc = label.toLowerCase();
    return normalized.find((n) => {
      if (key === "hemo_aerobio") return n.lower.includes("aer");
      if (key === "hemo_anaerobio") return n.lower.includes("anaer");
      if (key === "hemo_fungos")
        return n.lower.includes("fung") && n.lower.includes("hemo");
      if (key === "urocultura") return n.lower.includes("urocult");
      if (key === "secrecao") return n.lower.includes("secre");
      if (key === "fragmento") return n.lower.includes("fragment");
      if (key === "swab") return n.lower.includes("swab");
      if (key === "outros")
        return (
          n.lower.includes("outr") ||
          (!n.lower.includes("hemo") &&
            !n.lower.includes("uro") &&
            !n.lower.includes("secre") &&
            !n.lower.includes("fragment") &&
            !n.lower.includes("swab") &&
            n.raw.length > 0)
        );
      return n.lower === lc;
    });
  };

  return CULTURE_CATALOG.map((entry) => {
    const found = matchKey(entry.key, entry.label);
    return {
      ...entry,
      checked: Boolean(found),
      samples: found?.samples ?? undefined,
      detail: found?.raw && !entry.label.toLowerCase().startsWith(found.lower)
        ? found.raw
        : undefined,
    };
  });
}

/** Calcula idade aproximada em anos a partir de ISO date. */
function ageInYears(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;
  return years;
}

const fmtDate = (iso?: string | null) =>
  iso ? format(new Date(iso + (iso.length === 10 ? "T12:00:00" : "")), "dd/MM/yyyy", { locale: ptBR }) : "";

/* ───────────────────────── Estilos compartilhados ───────────────────────── */

const ink = "#0a1628";
const inkSoft = "#475569";
const lineColor = "#1e293b";
const lineSoft = "#cbd5e1";

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "9pt",
  border: `1px solid ${lineColor}`,
  marginTop: "8px",
};

const cellBase: React.CSSProperties = {
  border: `1px solid ${lineColor}`,
  padding: "5px 8px",
  color: ink,
  verticalAlign: "middle",
};

const labelCell: React.CSSProperties = {
  ...cellBase,
  fontWeight: 500,
  color: ink,
  background: "#fff",
  width: "22%",
  whiteSpace: "nowrap",
};

const valueCell: React.CSSProperties = {
  ...cellBase,
  fontWeight: 700,
};

const sectionRow: React.CSSProperties = {
  ...cellBase,
  background: "#fff",
  textAlign: "center",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  fontSize: "9pt",
  color: ink,
};

const noteRow: React.CSSProperties = {
  ...cellBase,
  background: "#f8fafc",
  fontSize: "8pt",
  color: ink,
  fontStyle: "italic",
};

/** Checkbox quadrado de impressão. */
const Checkbox: React.FC<{ checked?: boolean }> = ({ checked }) => (
  <span
    style={{
      display: "inline-block",
      width: 9,
      height: 9,
      border: `1px solid ${ink}`,
      marginRight: 6,
      verticalAlign: "middle",
      background: checked ? ink : "transparent",
      flexShrink: 0,
    }}
  />
);

/* ───────────────────────── Pré-visualização React ───────────────────────── */

export function PrintableCultureRequest({
  request,
  sectorLabel,
}: PrintableCultureRequestProps) {
  const items = mapCatalog(request.items || []);
  const docCode = React.useMemo(() => generateDocCode("REQ-CULT"), []);

  const sectorName = sectorLabel
    ? sectorLabel(request.patient_sector || null)
    : request.patient_sector || "";

  const createdAt = new Date(request.created_at);
  const createdStr = format(createdAt, "dd/MM/yyyy", { locale: ptBR });

  const age = ageInYears(request.patient_birth_date);
  const isMinor = age !== null && age < 18;

  return (
    <div
      style={{
        background: "#fff",
        color: ink,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "16px 18px",
        borderRadius: "6px",
        border: `1px solid ${lineSoft}`,
      }}
    >
      <NormaZeroPrintHeader
        documentLabel="Solicitação de Cultura"
        documentCode={docCode}
        documentSubtitle={createdStr}
        width="100%"
      />

      {/* Título do formulário */}
      <div
        style={{
          textAlign: "center",
          margin: "10px 0 0",
          fontSize: "12pt",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
          color: ink,
        }}
      >
        Solicitação de Exame Microbiológico
      </div>

      {/* TABELA ÚNICA — estrutura tipo formulário hospitalar */}
      <table style={tableStyle}>
        <tbody>
          {/* Identificação do paciente */}
          <tr>
            <td style={labelCell}>Nome completo:</td>
            <td style={valueCell} colSpan={3}>
              {request.patient_name?.toUpperCase() || ""}
            </td>
          </tr>
          <tr>
            <td style={labelCell}>Nome social:</td>
            <td style={valueCell} colSpan={3}>
              {request.patient_social_name || ""}
            </td>
          </tr>
          <tr>
            <td style={labelCell}>Data de nascimento:</td>
            <td style={valueCell}>{fmtDate(request.patient_birth_date)}</td>
            <td style={{ ...labelCell, width: "12%" }}>CNS:</td>
            <td style={valueCell}>{request.patient_cns || ""}</td>
          </tr>
          <tr>
            <td style={labelCell}>CPF:</td>
            <td style={valueCell} colSpan={3}>
              {request.patient_cpf || ""}
            </td>
          </tr>
          <tr>
            <td style={labelCell}>Prontuário:</td>
            <td style={valueCell}>{request.patient_record || ""}</td>
            <td style={labelCell}>Setor:</td>
            <td style={valueCell}>
              {sectorName} {request.patient_bed ? `· Leito ${request.patient_bed}` : ""}
            </td>
          </tr>

          {/* Dados da mãe — sempre visível, com nota explicativa */}
          <tr>
            <td style={sectionRow} colSpan={4}>
              Se paciente menor de 18 anos, preencher os dados da mãe
            </td>
          </tr>
          <tr>
            <td style={labelCell}>Nome da mãe:</td>
            <td style={valueCell} colSpan={3}>
              {(request.mother_name || (isMinor ? "" : "—"))?.toUpperCase?.() || ""}
            </td>
          </tr>
          <tr>
            <td style={labelCell}>Data de nascimento:</td>
            <td style={valueCell} colSpan={3}>
              {fmtDate(request.mother_birth_date)}
            </td>
          </tr>

          {/* Antecedentes */}
          <tr>
            <td style={cellBase} colSpan={4}>
              Esteve internado nos últimos 30 dias?{" "}
              <Checkbox checked={request.hospitalized_last_30d === true} /> Sim{"  "}
              <Checkbox checked={request.hospitalized_last_30d === false} /> Não
            </td>
          </tr>
          <tr>
            <td style={cellBase} colSpan={4}>
              Fez uso de antibiótico nas últimas 24h?{" "}
              <Checkbox checked={request.used_antibiotic_last_24h === true} /> Sim{"  "}
              <Checkbox checked={request.used_antibiotic_last_24h === false} /> Não
              <div style={{ marginTop: 4, fontSize: "8.5pt" }}>
                Se sim, qual?{" "}
                <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: "55%", padding: "0 4px" }}>
                  {request.antibiotic_name || ""}
                </span>{" "}
                Início:{" "}
                <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: "20%", padding: "0 4px" }}>
                  {fmtDate(request.antibiotic_start_date)}
                </span>
              </div>
            </td>
          </tr>

          {/* Exames solicitados */}
          <tr>
            <td style={sectionRow} colSpan={4}>
              Exames Solicitados
            </td>
          </tr>
          <tr>
            <td style={cellBase} colSpan={4}>
              <Checkbox checked={request.antibiotic_use === "profilatico"} /> Antibiótico profilático
              <span style={{ display: "inline-block", width: 28 }} />
              <Checkbox checked={request.antibiotic_use === "terapeutico"} /> Antibiótico terapêutico
            </td>
          </tr>
          <tr>
            <td style={cellBase} colSpan={4}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Culturas solicitadas com TSA:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {items.map((it) => (
                  <div key={it.key} style={{ display: "flex", alignItems: "center", fontSize: "8.5pt" }}>
                    <Checkbox checked={it.checked} />
                    <span>{it.label}</span>
                    {it.sampleField && (
                      <>
                        <span
                          style={{
                            borderBottom: `1px solid ${ink}`,
                            display: "inline-block",
                            minWidth: 60,
                            margin: "0 6px",
                            padding: "0 4px",
                            textAlign: "center",
                          }}
                        >
                          {String(it.samples ?? "")}
                        </span>
                        <span style={{ color: inkSoft }}>amostras</span>
                      </>
                    )}
                    {!it.sampleField && it.detail && (
                      <span
                        style={{
                          marginLeft: 6,
                          borderBottom: `1px solid ${ink}`,
                          flex: 1,
                          padding: "0 4px",
                          fontSize: "8pt",
                        }}
                      >
                        {it.detail}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </td>
          </tr>

          {/* Justificativa clínica (se houver) */}
          {request.clinical_indication && (
            <>
              <tr>
                <td style={sectionRow} colSpan={4}>
                  Justificativa Clínica
                </td>
              </tr>
              <tr>
                <td style={{ ...cellBase, minHeight: 30 }} colSpan={4}>
                  {request.clinical_indication}
                </td>
              </tr>
            </>
          )}

          {/* Data da solicitação + Assinatura */}
          <tr>
            <td style={labelCell}>Data da solicitação:</td>
            <td style={valueCell}>{createdStr}</td>
            <td
              style={{ ...cellBase, textAlign: "center", verticalAlign: "bottom", paddingTop: 28 }}
              colSpan={2}
            >
              <div style={{ borderTop: `1px solid ${ink}`, marginTop: 18, paddingTop: 4, fontSize: "8pt" }}>
                Assinatura e carimbo do médico
                {request.requested_by_name && (
                  <div style={{ marginTop: 2, fontWeight: 700, color: ink }}>
                    {request.requested_by_name}
                  </div>
                )}
              </div>
            </td>
          </tr>

          {/* Observação importante */}
          <tr>
            <td style={noteRow} colSpan={4}>
              <strong>Observação importante:</strong> para solicitação de cultura de paciente sem
              documentação, é obrigatório o número do prontuário e data de nascimento fictícia.
            </td>
          </tr>
        </tbody>
      </table>

      <NormaZeroPrintFooter width="100%" />
    </div>
  );
}

/* ───────────────────────── Impressão real (popup) ───────────────────────── */

export async function printCultureRequest(
  request: CultureRequestData,
  sectorLabel?: (s: string | null) => string,
  opts?: { duplicate?: boolean },
) {
  const duplicate = !!opts?.duplicate;
  const items = mapCatalog(request.items || []);
  const sectorName = sectorLabel
    ? sectorLabel(request.patient_sector || null)
    : request.patient_sector || "";
  const createdAt = new Date(request.created_at);
  const createdStr = format(createdAt, "dd/MM/yyyy", { locale: ptBR });

  const checkbox = (checked?: boolean) =>
    `<span class="cb${checked ? " on" : ""}"></span>`;

  const fillLine = (val: string, minWidth = "60pt") =>
    `<span class="fill" style="min-width:${minWidth}">${escapeHtml(val)}</span>`;

  const itemsHtml = items
    .map((it) => {
      const samples = it.sampleField
        ? `${fillLine(String(it.samples ?? ""), "40pt")} <span class="muted">amostras</span>`
        : it.detail
        ? fillLine(it.detail, "200pt")
        : "";
      return `<div class="item-row">${checkbox(it.checked)}<span>${escapeHtml(it.label)}</span> ${samples}</div>`;
    })
    .join("");

  const formTable = `
    <table class="nz cult">
      <tbody>
        <tr><th>Nome completo:</th><td colspan="3" class="bold">${escapeHtml((request.patient_name || "").toUpperCase())}</td></tr>
        <tr><th>Nome social:</th><td colspan="3">${escapeHtml(request.patient_social_name || "")}</td></tr>
        <tr>
          <th>Data de nascimento:</th><td class="bold">${escapeHtml(fmtDate(request.patient_birth_date))}</td>
          <th style="width:12%">CNS:</th><td>${escapeHtml(request.patient_cns || "")}</td>
        </tr>
        <tr><th>CPF:</th><td colspan="3">${escapeHtml(request.patient_cpf || "")}</td></tr>
        <tr>
          <th>Prontuário:</th><td class="bold">${escapeHtml(request.patient_record || "")}</td>
          <th>Setor:</th><td class="bold">${escapeHtml(sectorName)}${request.patient_bed ? " · Leito " + escapeHtml(request.patient_bed) : ""}</td>
        </tr>

        <tr><td colspan="4" class="section">Se paciente menor de 18 anos, preencher os dados da mãe</td></tr>
        <tr><th>Nome da mãe:</th><td colspan="3" class="bold">${escapeHtml((request.mother_name || "").toUpperCase())}</td></tr>
        <tr><th>Data de nascimento:</th><td colspan="3">${escapeHtml(fmtDate(request.mother_birth_date))}</td></tr>

        <tr><td colspan="4">Esteve internado nos últimos 30 dias? ${checkbox(request.hospitalized_last_30d === true)} Sim &nbsp; ${checkbox(request.hospitalized_last_30d === false)} Não</td></tr>
        <tr><td colspan="4">
          Fez uso de antibiótico nas últimas 24h? ${checkbox(request.used_antibiotic_last_24h === true)} Sim &nbsp; ${checkbox(request.used_antibiotic_last_24h === false)} Não
          <div class="sub">Se sim, qual? ${fillLine(request.antibiotic_name || "", "55%")} &nbsp; Início: ${fillLine(fmtDate(request.antibiotic_start_date), "20%")}</div>
        </td></tr>

        <tr><td colspan="4" class="section">Exames Solicitados</td></tr>
        <tr><td colspan="4">
          ${checkbox(request.antibiotic_use === "profilatico")} Antibiótico profilático
          &nbsp;&nbsp;&nbsp;
          ${checkbox(request.antibiotic_use === "terapeutico")} Antibiótico terapêutico
        </td></tr>
        <tr><td colspan="4">
          <div class="culturas-title">Culturas solicitadas com TSA:</div>
          <div class="culturas-list">${itemsHtml}</div>
        </td></tr>

        ${
          request.clinical_indication
            ? `<tr><td colspan="4" class="section">Justificativa Clínica</td></tr>
               <tr><td colspan="4" style="min-height:24pt">${escapeHtml(request.clinical_indication)}</td></tr>`
            : ""
        }

        <tr>
          <th>Data da solicitação:</th><td class="bold">${escapeHtml(createdStr)}</td>
          <td colspan="2" class="sig-cell">
            <div class="sig-line">Assinatura e carimbo do médico</div>
            ${request.requested_by_name ? `<div class="sig-name">${escapeHtml(request.requested_by_name)}</div>` : ""}
          </td>
        </tr>

        <tr><td colspan="4" class="note"><strong>Observação importante:</strong> para solicitação de cultura de paciente sem documentação, é obrigatório o número do prontuário e data de nascimento fictícia.</td></tr>
      </tbody>
    </table>
  `;

  const logoDataUrl = await prepareLogo();
  const inst = whitelabel.print.institutionalHeader;
  const colors = whitelabel.theme.institutionalColors;
  const hospitalFull = whitelabel.institution.hospitalFullName;
  const docNoDuo = generateDocCode("REQ-CULT");
  const nowDuo = new Date();
  const dateStrDuo = nowDuo.toLocaleDateString("pt-BR");
  const timeStrDuo = nowDuo.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const logoBlockDuo = logoDataUrl
    ? `<img src="${logoDataUrl}" class="mini-logo" alt="${whitelabel.institution.hospitalAbbreviation}"/>`
    : `<div class="mini-logo" style="background:#0054A6;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;border-radius:6pt">${whitelabel.institution.hospitalAbbreviation}</div>`;

  const miniHeader = `
    <div class="mini-header">
      <div class="mini-header-inner">
        <div class="mini-logo-wrap">${logoBlockDuo}</div>
        <div class="mini-h-text">
          <div class="mini-h-line1">${inst.line1}</div>
          <div class="mini-h-line2">${inst.line2}</div>
          <div class="mini-h-line3">${inst.line3}</div>
          <div class="mini-h-tag">${whitelabel.institution.address}</div>
        </div>
      </div>
      <div class="mini-cruz-bar">
        <div style="background:${colors.red}"></div>
        <div style="background:${colors.orange}"></div>
        <div style="background:${colors.yellow}"></div>
        <div style="background:${colors.green}"></div>
        <div style="background:${colors.blue}"></div>
      </div>
      <div class="mini-doc-bar">
        <span><b>Doc:</b> ${docNoDuo}</span>
        <span><b>Setor:</b> ${escapeHtml(sectorName || "Assistência Hospitalar")}</span>
        <span><b>Emissão:</b> ${dateStrDuo} ${timeStrDuo}</span>
      </div>
    </div>
  `;

  const oneViaFull = (label: string) => `
    <div class="via">
      <div class="via-tag">${label}</div>
      ${miniHeader}
      <h1 class="mini-title">Solicitação de Exame Microbiológico</h1>
      <div class="mini-subtitle">${escapeHtml(hospitalFull)} • Emitida em ${createdStr}</div>
      ${formTable}
    </div>
  `;

  const bodyHtml = duplicate
    ? `<div class="duo">${oneViaFull("1ª via — Laboratório")}<div class="cut-line" aria-hidden="true"></div>${oneViaFull("2ª via — Prontuário")}</div>`
    : formTable;

  const extraStyles = `
    table.nz.cult { width:100%; border-collapse:collapse; font-size:9pt; border:1pt solid #1e293b; margin-top:6pt; }
    table.nz.cult th, table.nz.cult td { border:1pt solid #1e293b; padding:4pt 7pt; color:#0a1628; vertical-align:middle; text-align:left; font-weight:500; background:#fff; }
    table.nz.cult th { width:22%; white-space:nowrap; font-weight:500; }
    table.nz.cult td.bold, table.nz.cult .bold { font-weight:700; }
    table.nz.cult td.section { text-align:center; font-weight:700; text-transform:uppercase; letter-spacing:0.4pt; background:#fff; }
    table.nz.cult td.note { background:#f8fafc; font-size:8pt; font-style:italic; }
    table.nz.cult td.sig-cell { text-align:center; vertical-align:bottom; padding-top:24pt; }
    table.nz.cult .sig-line { border-top:1pt solid #0a1628; margin-top:14pt; padding-top:3pt; font-size:8pt; }
    table.nz.cult .sig-name { font-weight:700; font-size:8.5pt; margin-top:1pt; }
    table.nz.cult .sub { margin-top:3pt; font-size:8.5pt; }
    table.nz.cult .culturas-title { font-weight:700; margin-bottom:3pt; }
    table.nz.cult .culturas-list .item-row { display:flex; align-items:center; font-size:8.5pt; padding:1.5pt 0; }
    .cb { display:inline-block; width:8pt; height:8pt; border:1pt solid #0a1628; margin-right:5pt; vertical-align:middle; }
    .cb.on { background:#0a1628; }
    .fill { display:inline-block; border-bottom:1pt solid #0a1628; padding:0 3pt; min-width:60pt; }
    .muted { color:#475569; }

    /* === Modo duas vias (paisagem): cada metade traz seu próprio cabeçalho === */
    .duo { display:grid; grid-template-columns: 1fr 6pt 1fr; gap:0; align-items:start; }
    .duo .cut-line { border-left: 1pt dashed #64748b; margin: 0 3pt; align-self:stretch; }
    .duo .via { padding: 0 4pt; }
    .duo .via-tag { font-size:7pt; font-weight:700; color:#0054A6; text-transform:uppercase; letter-spacing:0.5pt; margin-bottom:2pt; text-align:right; }

    /* Mini cabeçalho institucional replicado por via */
    .mini-header { border-bottom: 2pt solid #0054A6; padding-bottom: 3pt; margin-bottom: 4pt; }
    .mini-header-inner { display:grid; grid-template-columns: 36px 1fr; align-items:center; gap:6pt; }
    .mini-logo { height: 34px; width: 34px; object-fit: contain; }
    .mini-h-text { text-align:center; }
    .mini-h-line1, .mini-h-line2 { font-size:6pt; font-weight:600; color:#475569; letter-spacing:0.3pt; text-transform:uppercase; line-height:1.15; }
    .mini-h-line3 { font-size:8pt; font-weight:700; color:#0a1628; margin-top:1pt; letter-spacing:0.2pt; line-height:1.15; }
    .mini-h-tag { font-size:5.5pt; color:#64748b; font-style:italic; margin-top:1pt; line-height:1.1; }
    .mini-cruz-bar { display:flex; height:2.5pt; margin-top:3pt; border-radius:1.5pt; overflow:hidden; }
    .mini-cruz-bar > div { flex:1; }
    .mini-doc-bar { display:flex; justify-content:space-between; align-items:center; background:#f1f5f9; border:0.5pt solid #cbd5e1; padding:2pt 5pt; font-size:6.5pt; margin-top:3pt; border-radius:2pt; }
    .mini-doc-bar b { color:#0a1628; }
    .mini-title { font-size:10pt; margin:3pt 0 1pt; color:#0a1628; text-align:center; letter-spacing:0.3pt; text-transform:uppercase; font-weight:800; }
    .mini-subtitle { text-align:center; color:#64748b; font-size:6.5pt; margin-bottom:2pt; }

    /* Compactar tabela na paisagem dividida */
    .duo table.nz.cult { font-size:7pt; margin-top:2pt; }
    .duo table.nz.cult th, .duo table.nz.cult td { padding:2pt 4pt; }
    .duo table.nz.cult td.note { font-size:6pt; padding:2pt 4pt; }
    .duo table.nz.cult td.sig-cell { padding-top:12pt; }
    .duo table.nz.cult .sig-line { margin-top:8pt; font-size:6.5pt; }
    .duo table.nz.cult .culturas-list .item-row { font-size:7pt; padding:0.5pt 0; }
    .duo .cb { width:6.5pt; height:6.5pt; margin-right:3pt; }

    /* Esconder cabeçalho/rodapé externos do wrapper Norma Zero quando duo */
    body.duo-mode > .nz-header,
    body.duo-mode > .nz-doc-bar,
    body.duo-mode > h1.nz-title,
    body.duo-mode > .nz-subtitle,
    body.duo-mode > .nz-footer { display:none !important; }
    body.duo-mode { margin:0 !important; }

    @media print {
      .duo { page-break-inside: avoid; break-inside: avoid; }
      .duo .via { page-break-inside: avoid; break-inside: avoid; }
      @page { size: A4 landscape; margin: 6mm 8mm; }
    }
  `;

  const html = buildNormaZeroDocument({
    title: duplicate ? "Solicitação de Exame Microbiológico — 2 vias" : "Solicitação de Exame Microbiológico",
    subtitle: `Emitida em ${createdStr}${duplicate ? " · impressão em duas vias" : ""}`,
    sectorLabel: sectorName || "Assistência Hospitalar",
    docCodePrefix: "REQ-CULT",
    bodyHtml,
    signatures: [],
    logoDataUrl,
    extraStyles,
    orientation: duplicate ? "landscape" : "portrait",
  });

  // Quando duplicado, injeta a classe duo-mode no <body> para esconder o cabeçalho externo
  const finalHtml = duplicate
    ? html.replace("<body>", '<body class="duo-mode">')
    : html;


  const w = openPrintWindow(finalHtml, "Preparando solicitação de cultura…");
  if (!w) {
    alert("Permita pop-ups para imprimir a solicitação.");
  }
}

