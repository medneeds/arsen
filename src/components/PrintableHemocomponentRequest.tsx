/**
 * Solicitação de Sangue / Hemocomponentes — padrão hospitalar Socorrão I.
 *
 * Espelha o formulário oficial em uso pelo HMDM Socorrão I:
 *  - Cabeçalho tripartido (Prefeitura → SEMUS → HMDM Socorrão I) via NormaZeroPrintHeader.
 *  - Título destacado "SOLICITAÇÃO DE SANGUE / HEMOCOMPONENTES".
 *  - 5 seções com faixa cinza centralizada uppercase: Identificação · Dados da Transfusão ·
 *    Hemocomponentes Solicitados · Histórico Transfusional · Tipos de Transfusão.
 *  - Grids matriciais de checkboxes (4 colunas: PS / Centro Cirúrgico / UTI / Clínicas).
 *  - Bloco de hemocomponentes (Hemácias / Plaquetas / Plasma / Crioprecipitado) com
 *    Quantidade + atributos + Justificativa Laboratorial.
 *  - Rodapé regulatório obrigatório: RDC 153/2004 — MS, Portaria nº 05/2017.
 *
 * - `printHemocomponentRequest(...)` abre janela popup para impressão real (alta fidelidade).
 * - `<PrintableHemocomponentRequest />` renderiza pré-visualização idêntica em diálogo React.
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

/* ───────────────────────── Tipos & catálogos ───────────────────────── */

/**
 * Código de setor do hospital — mantém sincronia com `DepartmentContext`
 * e `lib/hospitalSectors`. Aceita string para compatibilidade com novos
 * setores adicionados ao catálogo institucional.
 */
export type SectorKey = string;

export type ComponentKey = "hemacias" | "plaquetas" | "plasma" | "crio";
export type TransfusionType = "programada" | "rotina" | "urgencia" | "emergencia";
export type AdminSchedule = "8_8h" | "continuo";

export interface HemocomponentRequestData {
  // Identificação do paciente
  patient_name: string;
  patient_social_name?: string | null;
  patient_birth_date?: string | null; // ISO YYYY-MM-DD
  patient_sex?: "F" | "M" | "Fem" | "Masc" | string | null;
  patient_blood_group?: string | null; // ABO/RH ex: "O+"
  patient_weight?: string | number | null;
  patient_record?: string | null; // prontuário
  patient_race?: string | null;
  patient_unit?: string | null;
  patient_bed?: string | null;
  patient_diagnosis?: string | null;

  // Setor/local da transfusão (multi-select)
  transfusion_sectors?: SectorKey[];

  // Hemocomponentes (multi-select com quantidade e atributos)
  components?: Array<{
    key: ComponentKey;
    quantity?: string | number | null;
    // Para hemácias e plaquetas:
    desleucocitado?: boolean;
    lavado?: boolean;       // somente hemácias
    irradiado?: boolean;
    // Para plasma:
    admin_schedule?: AdminSchedule | null;
    // Justificativa laboratorial
    lab_hb?: string | null;
    lab_ht?: string | null;
    lab_platelets?: string | null;
    lab_tap?: string | null;
    lab_ttpa?: string | null;
    lab_rni?: string | null;
    lab_fibrinogen?: string | null;
  }>;

  // Histórico transfusional
  previous_transfusion?: boolean | null;
  transfusion_reaction?: boolean | null;
  reaction_type?: string | null;
  obstetric_history?: { gesta?: string | number; parto?: string | number; aborto?: string | number };

  // Tipo de transfusão
  transfusion_type?: TransfusionType | null;
  scheduled_date?: string | null; // se programada
  scheduled_time?: string | null;

  // Solicitação
  requested_by_name?: string | null;
  requested_by_crm?: string | null;
  created_at: string; // ISO
}

interface PrintableHemocomponentRequestProps {
  request: HemocomponentRequestData;
  sectorLabel?: (s: string | null) => string;
}

/* Catálogo dos setores agrupados — sincronizado com hospitalSectors.ts */
import { HOSPITAL_SECTOR_GROUPS } from "@/lib/hospitalSectors";
const SECTOR_GROUPS: Array<{
  title: string;
  items: Array<{ key: SectorKey; label: string }>;
}> = HOSPITAL_SECTOR_GROUPS;

const COMPONENT_LABELS: Record<ComponentKey, string> = {
  hemacias: "Conc. de Hemácias",
  plaquetas: "Conc. de Plaquetas",
  plasma: "Plasma Fresco Congelado",
  crio: "Crioprecipitado",
};

const COMPONENT_KEYS: ComponentKey[] = ["hemacias", "plaquetas", "plasma", "crio"];

const escapeHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmtDate = (iso?: string | null) =>
  iso ? format(new Date(iso + (iso.length === 10 ? "T12:00:00" : "")), "dd/MM/yyyy", { locale: ptBR }) : "";

/* ───────────────────────── Estilos compartilhados ───────────────────────── */

const ink = "#0a1628";
const inkSoft = "#475569";
const lineColor = "#1e293b";
const lineSoft = "#cbd5e1";
const sectionBandBg = "#e2e8f0";

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "8.5pt",
  border: `1px solid ${lineColor}`,
  marginTop: "6px",
};

const cellBase: React.CSSProperties = {
  border: `1px solid ${lineColor}`,
  padding: "4px 6px",
  color: ink,
  verticalAlign: "top",
  textAlign: "left",
};

const labelCell: React.CSSProperties = {
  ...cellBase,
  fontWeight: 500,
  width: "16%",
  whiteSpace: "nowrap",
};

const valueCell: React.CSSProperties = {
  ...cellBase,
  fontWeight: 700,
};

const sectionBand: React.CSSProperties = {
  ...cellBase,
  background: sectionBandBg,
  textAlign: "center",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  fontSize: "9pt",
  color: ink,
  padding: "5px",
};

const subheadCell: React.CSSProperties = {
  ...cellBase,
  textAlign: "center",
  fontWeight: 700,
  textTransform: "uppercase",
  fontSize: "8pt",
  background: "#f8fafc",
  padding: "4px",
  letterSpacing: "0.3px",
};

const Checkbox: React.FC<{ checked?: boolean }> = ({ checked }) => (
  <span
    style={{
      display: "inline-block",
      width: 9,
      height: 9,
      border: `1px solid ${ink}`,
      marginRight: 5,
      verticalAlign: "middle",
      background: checked ? ink : "transparent",
      flexShrink: 0,
    }}
  />
);

/* ───────────────────────── Helpers de mapeamento ───────────────────────── */

function isSectorChecked(req: HemocomponentRequestData, key: SectorKey): boolean {
  return Array.isArray(req.transfusion_sectors) && req.transfusion_sectors.includes(key);
}

function getComponent(req: HemocomponentRequestData, key: ComponentKey) {
  return (req.components || []).find((c) => c.key === key);
}

function isSexFem(s?: string | null) {
  return /^f/i.test(String(s || ""));
}
function isSexMasc(s?: string | null) {
  return /^m/i.test(String(s || ""));
}

/* ───────────────────────── Pré-visualização React ───────────────────────── */

export function PrintableHemocomponentRequest({
  request,
  sectorLabel,
}: PrintableHemocomponentRequestProps) {
  const docCode = React.useMemo(() => generateDocCode("REQ-HEMO"), []);

  const sectorName = sectorLabel
    ? sectorLabel(request.patient_unit || null)
    : request.patient_unit || "";

  const createdAt = new Date(request.created_at);
  const createdStr = format(createdAt, "dd/MM/yyyy", { locale: ptBR });
  const createdTime = format(createdAt, "HH:mm", { locale: ptBR });

  return (
    <div
      style={{
        background: "#fff",
        color: ink,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "14px 16px",
        borderRadius: "6px",
        border: `1px solid ${lineSoft}`,
      }}
    >
      <NormaZeroPrintHeader
        documentLabel="Solicitação Hemocomponentes"
        documentCode={docCode}
        documentSubtitle={createdStr}
        width="100%"
      />

      {/* Título principal */}
      <div
        style={{
          textAlign: "center",
          margin: "8px 0 0",
          fontSize: "12pt",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
          color: ink,
        }}
      >
        Solicitação de Sangue / Hemocomponentes
      </div>

      {/* TABELA ÚNICA — grade de 12 colunas (sincroniza com o PDF) */}
      <table style={{ ...tableStyle, tableLayout: "fixed" }}>
        <colgroup>
          {Array.from({ length: 12 }).map((_, i) => (
            <col key={i} style={{ width: "8.333%" }} />
          ))}
        </colgroup>
        <tbody>
          {/* ── Identificação do Paciente ── */}
          <tr><td style={sectionBand} colSpan={12}>Identificação do Paciente</td></tr>
          <tr>
            <td style={labelCell} colSpan={2}>Nome:</td>
            <td style={valueCell} colSpan={10}>{(request.patient_name || "").toUpperCase()}</td>
          </tr>
          <tr>
            <td style={labelCell} colSpan={2}>Nome social:</td>
            <td style={valueCell} colSpan={10}>{request.patient_social_name || ""}</td>
          </tr>
          <tr>
            <td style={labelCell} colSpan={2}>Nascimento:</td>
            <td style={valueCell} colSpan={2}>{fmtDate(request.patient_birth_date)}</td>
            <td style={labelCell} colSpan={1}>Sexo:</td>
            <td style={cellBase} colSpan={3}>
              <Checkbox checked={isSexFem(request.patient_sex)} /> Fem
              <span style={{ display: "inline-block", width: 14 }} />
              <Checkbox checked={isSexMasc(request.patient_sex)} /> Masc
            </td>
            <td style={labelCell} colSpan={2}>Grupo (ABO/RH):</td>
            <td style={valueCell} colSpan={2}>{request.patient_blood_group || ""}</td>
          </tr>
          <tr>
            <td style={labelCell} colSpan={2}>N° prontuário:</td>
            <td style={valueCell} colSpan={3}>{request.patient_record || ""}</td>
            <td style={labelCell} colSpan={1}>Raça:</td>
            <td style={cellBase} colSpan={2}>{request.patient_race || ""}</td>
            <td style={labelCell} colSpan={1}>Peso:</td>
            <td style={valueCell} colSpan={3}>{request.patient_weight ?? ""}</td>
          </tr>
          <tr>
            <td style={labelCell} colSpan={2}>Unidade:</td>
            <td style={valueCell} colSpan={6}>{sectorName || ""}</td>
            <td style={labelCell} colSpan={1}>Leito:</td>
            <td style={valueCell} colSpan={3}>{request.patient_bed || ""}</td>
          </tr>
          <tr>
            <td style={labelCell} colSpan={2}>Diagnóstico:</td>
            <td style={cellBase} colSpan={10}>{request.patient_diagnosis || ""}</td>
          </tr>

          {/* ── Dados da Transfusão ── */}
          <tr><td style={sectionBand} colSpan={12}>Dados da Transfusão · Setor onde será realizada</td></tr>
          <tr>
            {SECTOR_GROUPS.map((g) => (
              <td key={g.title} style={subheadCell} colSpan={3}>{g.title}</td>
            ))}
          </tr>
          <tr>
            {SECTOR_GROUPS.map((g) => (
              <td key={g.title} style={{ ...cellBase, padding: "5px 8px" }} colSpan={3}>
                {g.items.map((it) => (
                  <div key={it.key} style={{ fontSize: "8pt", padding: "1.5px 0", display: "flex", alignItems: "center" }}>
                    <Checkbox checked={isSectorChecked(request, it.key)} /> {it.label}
                  </div>
                ))}
              </td>
            ))}
          </tr>

          {/* ── Hemocomponentes Solicitados ── */}
          <tr><td style={sectionBand} colSpan={12}>Hemocomponentes Solicitados</td></tr>
          <tr>
            {COMPONENT_KEYS.map((k) => {
              const c = getComponent(request, k);
              return (
                <td key={k} style={subheadCell} colSpan={3}>
                  <Checkbox checked={Boolean(c)} /> {COMPONENT_LABELS[k]}
                </td>
              );
            })}
          </tr>
          <tr>
            {COMPONENT_KEYS.map((k) => {
              const c = getComponent(request, k);
              return (
                <td key={k} style={{ ...cellBase, padding: "5px 8px" }} colSpan={3}>
                  <div style={{ fontSize: "8pt" }}>
                    <strong>Quantidade:</strong>{" "}
                    <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: "60%", paddingLeft: 4 }}>
                      {c?.quantity ?? ""}
                    </span>
                  </div>
                </td>
              );
            })}
          </tr>
          <tr>
            {COMPONENT_KEYS.map((k) => {
              const c = getComponent(request, k);
              return (
                <td key={k} style={{ ...cellBase, padding: "5px 8px", fontSize: "8pt" }} colSpan={3}>
                  {k === "hemacias" && (
                    <>
                      <div><Checkbox checked={c?.desleucocitado} /> Desleucocitado / Filtrado</div>
                      <div><Checkbox checked={c?.lavado} /> Lavado</div>
                      <div><Checkbox checked={c?.irradiado} /> Irradiado</div>
                    </>
                  )}
                  {k === "plaquetas" && (
                    <>
                      <div><Checkbox checked={c?.desleucocitado} /> Desleucocitado / Filtrado</div>
                      <div><Checkbox checked={c?.irradiado} /> Irradiado</div>
                    </>
                  )}
                  {k === "plasma" && (
                    <>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>Administração de:</div>
                      <div><Checkbox checked={c?.admin_schedule === "8_8h"} /> 8/8 Horas</div>
                      <div><Checkbox checked={c?.admin_schedule === "continuo"} /> Contínuo</div>
                    </>
                  )}
                  {k === "crio" && <div style={{ minHeight: 38 }}>&nbsp;</div>}
                </td>
              );
            })}
          </tr>
          <tr>
            {COMPONENT_KEYS.map((k) => (
              <td key={k} style={subheadCell} colSpan={3}>Justificativa Laboratorial</td>
            ))}
          </tr>
          <tr>
            {COMPONENT_KEYS.map((k) => {
              const c = getComponent(request, k);
              return (
                <td key={k} style={{ ...cellBase, padding: "5px 8px", fontSize: "8pt" }} colSpan={3}>
                  {k === "hemacias" && (
                    <>
                      <div><strong>Hb:</strong> <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: "60%", paddingLeft: 4 }}>{c?.lab_hb || ""}</span></div>
                      <div style={{ marginTop: 3 }}><strong>Ht:</strong> <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: "60%", paddingLeft: 4 }}>{c?.lab_ht || ""}</span></div>
                    </>
                  )}
                  {k === "plaquetas" && (
                    <div><strong>N° de plaquetas:</strong> <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: "55%", paddingLeft: 4 }}>{c?.lab_platelets || ""}</span></div>
                  )}
                  {k === "plasma" && (
                    <>
                      <div><strong>TAP:</strong> <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: "60%", paddingLeft: 4 }}>{c?.lab_tap || ""}</span></div>
                      <div style={{ marginTop: 3 }}><strong>TTPA:</strong> <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: "55%", paddingLeft: 4 }}>{c?.lab_ttpa || ""}</span></div>
                      <div style={{ marginTop: 3 }}><strong>RNI:</strong> <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: "60%", paddingLeft: 4 }}>{c?.lab_rni || ""}</span></div>
                    </>
                  )}
                  {k === "crio" && (
                    <div><strong>Fibrinogênio:</strong> <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: "55%", paddingLeft: 4 }}>{c?.lab_fibrinogen || ""}</span></div>
                  )}
                </td>
              );
            })}
          </tr>

          {/* ── Histórico Transfusional ── */}
          <tr><td style={sectionBand} colSpan={12}>Histórico Transfusional</td></tr>
          <tr>
            <td style={cellBase} colSpan={6}>
              Transfusões prévias:&nbsp;
              <Checkbox checked={request.previous_transfusion === true} /> Sim&nbsp;&nbsp;
              <Checkbox checked={request.previous_transfusion === false} /> Não
            </td>
            <td style={cellBase} colSpan={6}>
              Teve reação transfusional?&nbsp;
              <Checkbox checked={request.transfusion_reaction === true} /> Sim&nbsp;&nbsp;
              <Checkbox checked={request.transfusion_reaction === false} /> Não
            </td>
          </tr>
          <tr>
            <td style={cellBase} colSpan={6}>
              <strong>Tipo de reação:</strong>{" "}
              <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: "60%", paddingLeft: 4 }}>
                {request.reaction_type || ""}
              </span>
            </td>
            <td style={cellBase} colSpan={6}>
              <strong>Antecedentes Gestacionais:</strong>&nbsp;&nbsp;
              Gesta <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: 32, paddingLeft: 4, textAlign: "center" }}>{request.obstetric_history?.gesta ?? ""}</span>&nbsp;
              Parto <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: 32, paddingLeft: 4, textAlign: "center" }}>{request.obstetric_history?.parto ?? ""}</span>&nbsp;
              Aborto <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: 32, paddingLeft: 4, textAlign: "center" }}>{request.obstetric_history?.aborto ?? ""}</span>
            </td>
          </tr>

          {/* ── Tipos de Transfusão ── */}
          <tr><td style={sectionBand} colSpan={12}>Tipos de Transfusão</td></tr>
          <tr>
            <td style={cellBase} colSpan={8}>
              <Checkbox checked={request.transfusion_type === "programada"} /> Programada para{" "}
              <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: 80, paddingLeft: 4 }}>
                {fmtDate(request.scheduled_date)}
              </span>{" "}
              às{" "}
              <span style={{ borderBottom: `1px solid ${ink}`, display: "inline-block", minWidth: 50, paddingLeft: 4 }}>
                {request.scheduled_time || ""}
              </span> h
            </td>
            <td style={cellBase} colSpan={4} rowSpan={3}>
              <div style={{ fontSize: "8pt", marginBottom: 2 }}>
                <strong>Data:</strong> {createdStr}&nbsp;&nbsp;
                <strong>Hora:</strong> {createdTime}
              </div>
              <div style={{ borderTop: `1px solid ${ink}`, marginTop: 28, paddingTop: 4, fontSize: "7.5pt", textAlign: "center" }}>
                Assinatura e carimbo do médico
                {request.requested_by_name && (
                  <div style={{ marginTop: 2, fontWeight: 700, fontSize: "8pt" }}>
                    {request.requested_by_name}
                    {request.requested_by_crm && (
                      <div style={{ fontWeight: 500, fontSize: "7.5pt", color: inkSoft }}>
                        CRM {request.requested_by_crm}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </td>
          </tr>
          <tr>
            <td style={cellBase} colSpan={4}>
              <Checkbox checked={request.transfusion_type === "rotina"} /> De rotina (Dentro de 24 horas)
            </td>
            <td style={cellBase} colSpan={4}>
              <Checkbox checked={request.transfusion_type === "urgencia"} /> De urgência (Dentro de 3 horas)
            </td>
          </tr>
          <tr>
            <td style={cellBase} colSpan={8}>
              <Checkbox checked={request.transfusion_type === "emergencia"} /> De emergência (qualquer retardo acarretará risco de vida)
            </td>
          </tr>

          {/* ── Rodapé regulatório ── */}
          <tr>
            <td colSpan={12} style={{ ...cellBase, fontSize: "7pt", lineHeight: 1.4, padding: "6px 8px", textAlign: "justify" }}>
              <p style={{ margin: 0, marginBottom: 4 }}>
                <strong>UMA REQUISIÇÃO INCOMPLETA, INADEQUADA E ILEGÍVEL NÃO DEVE SER ACEITA PELO SERVIÇO DE HEMOTERAPIA.
                AS TRANSFUSÕES DEVEM SER REALIZADAS, PREFERENCIALMENTE, NO PERÍODO DIURNO (RDC 153/2004 — MINISTÉRIO DA SAÚDE).</strong>
              </p>
              <p style={{ margin: 0, marginBottom: 3 }}>
                Em cumprimento à portaria N° 05, publicada em 28/09/2017 (que substitui a RDC N° 34/2014-MS),
                é obrigatória a realização dos testes pré-transfusionais (classificação sanguínea ABO + Rh e
                provas de compatibilidade) para liberação de sangue total ou concentrado de hemácias a ser transfundido.
              </p>
              <p style={{ margin: 0 }}>
                Diante de situações emergenciais, o médico tem autoridade para dispensar a realização dos testes,
                agilizando a liberação dos produtos. Nesses casos, é <strong>IMPRESCINDÍVEL</strong> o preenchimento
                do Termo de Responsabilidade no verso desta folha pelo médico responsável.
              </p>
            </td>
          </tr>
        </tbody>
      </table>

      <NormaZeroPrintFooter width="100%" />
    </div>
  );
}

/* ───────────────────────── Impressão real (popup A4) ───────────────────────── */

export async function printHemocomponentRequest(
  request: HemocomponentRequestData,
  sectorLabel?: (s: string | null) => string,
) {
  const sectorName = sectorLabel
    ? sectorLabel(request.patient_unit || null)
    : request.patient_unit || "";

  const createdAt = new Date(request.created_at);
  const createdStr = format(createdAt, "dd/MM/yyyy", { locale: ptBR });
  const createdTime = format(createdAt, "HH:mm", { locale: ptBR });

  const cb = (checked?: boolean) => `<span class="cb${checked ? " on" : ""}"></span>`;
  const fill = (val: unknown, minWidth = "40pt") =>
    `<span class="fill" style="min-width:${minWidth}">${escapeHtml(val)}</span>`;

  const sectorsMatrix = SECTOR_GROUPS.map(
    (g) => `
      <td class="sub">${escapeHtml(g.title)}</td>
    `,
  ).join("");

  const sectorsBody = SECTOR_GROUPS.map(
    (g) => `
      <td class="cell">
        ${g.items
          .map(
            (it) =>
              `<div class="opt">${cb(isSectorChecked(request, it.key))} ${escapeHtml(it.label)}</div>`,
          )
          .join("")}
      </td>
    `,
  ).join("");

  const compHeader = COMPONENT_KEYS.map(
    (k) => `<td class="sub">${cb(Boolean(getComponent(request, k)))} ${escapeHtml(COMPONENT_LABELS[k])}</td>`,
  ).join("");

  const compQty = COMPONENT_KEYS.map((k) => {
    const c = getComponent(request, k);
    return `<td class="cell"><strong>Quantidade:</strong> ${fill(c?.quantity ?? "", "60%")}</td>`;
  }).join("");

  const compAttrs = COMPONENT_KEYS.map((k) => {
    const c = getComponent(request, k);
    let body = "";
    if (k === "hemacias") {
      body = `
        <div>${cb(c?.desleucocitado)} Desleucocitado / Filtrado</div>
        <div>${cb(c?.lavado)} Lavado</div>
        <div>${cb(c?.irradiado)} Irradiado</div>`;
    } else if (k === "plaquetas") {
      body = `
        <div>${cb(c?.desleucocitado)} Desleucocitado / Filtrado</div>
        <div>${cb(c?.irradiado)} Irradiado</div>`;
    } else if (k === "plasma") {
      body = `
        <div class="muted-bold">Administração de:</div>
        <div>${cb(c?.admin_schedule === "8_8h")} 8/8 Horas</div>
        <div>${cb(c?.admin_schedule === "continuo")} Contínuo</div>`;
    } else {
      body = `<div style="min-height:32pt">&nbsp;</div>`;
    }
    return `<td class="cell">${body}</td>`;
  }).join("");

  const compLabHead = COMPONENT_KEYS.map(() => `<td class="sub">Justificativa Laboratorial</td>`).join("");

  const compLab = COMPONENT_KEYS.map((k) => {
    const c = getComponent(request, k);
    let body = "";
    if (k === "hemacias") {
      body = `<div><strong>Hb:</strong> ${fill(c?.lab_hb, "60%")}</div>
              <div style="margin-top:3pt"><strong>Ht:</strong> ${fill(c?.lab_ht, "60%")}</div>`;
    } else if (k === "plaquetas") {
      body = `<div><strong>N° de plaquetas:</strong> ${fill(c?.lab_platelets, "55%")}</div>`;
    } else if (k === "plasma") {
      body = `<div><strong>TAP:</strong> ${fill(c?.lab_tap, "60%")}</div>
              <div style="margin-top:3pt"><strong>TTPA:</strong> ${fill(c?.lab_ttpa, "55%")}</div>
              <div style="margin-top:3pt"><strong>RNI:</strong> ${fill(c?.lab_rni, "60%")}</div>`;
    } else {
      body = `<div><strong>Fibrinogênio:</strong> ${fill(c?.lab_fibrinogen, "55%")}</div>`;
    }
    return `<td class="cell">${body}</td>`;
  }).join("");

  const sigBlock = `
    <div class="sig-meta"><strong>Data:</strong> ${escapeHtml(createdStr)}&nbsp;&nbsp;<strong>Hora:</strong> ${escapeHtml(createdTime)}</div>
    <div class="sig-line">Assinatura e carimbo do médico
      ${request.requested_by_name ? `<div class="sig-name">${escapeHtml(request.requested_by_name)}</div>` : ""}
      ${request.requested_by_crm ? `<div class="sig-crm">CRM ${escapeHtml(request.requested_by_crm)}</div>` : ""}
    </div>`;

  const bodyHtml = `
    <table class="nz hemo">
      <colgroup>
        <col style="width:8.333%"/><col style="width:8.333%"/><col style="width:8.333%"/>
        <col style="width:8.333%"/><col style="width:8.333%"/><col style="width:8.333%"/>
        <col style="width:8.333%"/><col style="width:8.333%"/><col style="width:8.333%"/>
        <col style="width:8.333%"/><col style="width:8.333%"/><col style="width:8.337%"/>
      </colgroup>
      <tbody>
        <!-- Identificação -->
        <tr><td colspan="12" class="band">Identificação do Paciente</td></tr>
        <tr><th colspan="2">Nome:</th><td colspan="10" class="bold">${escapeHtml((request.patient_name || "").toUpperCase())}</td></tr>
        <tr><th colspan="2">Nome social:</th><td colspan="10">${escapeHtml(request.patient_social_name || "")}</td></tr>
        <tr>
          <th colspan="2">Nascimento:</th><td colspan="2" class="bold">${escapeHtml(fmtDate(request.patient_birth_date))}</td>
          <th colspan="1">Sexo:</th><td colspan="3">${cb(isSexFem(request.patient_sex))} Fem &nbsp; ${cb(isSexMasc(request.patient_sex))} Masc</td>
          <th colspan="2">Grupo (ABO/RH):</th><td colspan="2" class="bold">${escapeHtml(request.patient_blood_group || "")}</td>
        </tr>
        <tr>
          <th colspan="2">N° prontuário:</th><td colspan="3" class="bold">${escapeHtml(request.patient_record || "")}</td>
          <th colspan="1">Raça:</th><td colspan="2">${escapeHtml(request.patient_race || "")}</td>
          <th colspan="1">Peso:</th><td colspan="3" class="bold">${escapeHtml(String(request.patient_weight ?? ""))}</td>
        </tr>
        <tr>
          <th colspan="2">Unidade:</th><td colspan="6" class="bold">${escapeHtml(sectorName || "")}</td>
          <th colspan="1">Leito:</th><td colspan="3" class="bold">${escapeHtml(request.patient_bed || "")}</td>
        </tr>
        <tr><th colspan="2">Diagnóstico:</th><td colspan="10">${escapeHtml(request.patient_diagnosis || "")}</td></tr>

        <!-- Dados da Transfusão -->
        <tr><td colspan="12" class="band">Dados da Transfusão · Setor onde será realizada</td></tr>
        <tr>${SECTOR_GROUPS.map((g) => `<td colspan="3" class="sub">${escapeHtml(g.title)}</td>`).join("")}</tr>
        <tr>${SECTOR_GROUPS.map((g) => `<td colspan="3" class="cell">${g.items.map((it) => `<div class="opt">${cb(isSectorChecked(request, it.key))} ${escapeHtml(it.label)}</div>`).join("")}</td>`).join("")}</tr>

        <!-- Hemocomponentes -->
        <tr><td colspan="12" class="band">Hemocomponentes Solicitados</td></tr>
        <tr>${COMPONENT_KEYS.map((k) => `<td colspan="3" class="sub">${cb(Boolean(getComponent(request, k)))} ${escapeHtml(COMPONENT_LABELS[k])}</td>`).join("")}</tr>
        <tr>${COMPONENT_KEYS.map((k) => {
          const c = getComponent(request, k);
          return `<td colspan="3" class="cell"><strong>Quantidade:</strong> ${fill(c?.quantity ?? "", "60%")}</td>`;
        }).join("")}</tr>
        <tr>${COMPONENT_KEYS.map((k) => {
          const c = getComponent(request, k);
          let body = "";
          if (k === "hemacias") body = `<div>${cb(c?.desleucocitado)} Desleucocitado / Filtrado</div><div>${cb(c?.lavado)} Lavado</div><div>${cb(c?.irradiado)} Irradiado</div>`;
          else if (k === "plaquetas") body = `<div>${cb(c?.desleucocitado)} Desleucocitado / Filtrado</div><div>${cb(c?.irradiado)} Irradiado</div>`;
          else if (k === "plasma") body = `<div class="muted-bold">Administração de:</div><div>${cb(c?.admin_schedule === "8_8h")} 8/8 Horas</div><div>${cb(c?.admin_schedule === "continuo")} Contínuo</div>`;
          else body = `<div style="min-height:32pt">&nbsp;</div>`;
          return `<td colspan="3" class="cell">${body}</td>`;
        }).join("")}</tr>
        <tr>${COMPONENT_KEYS.map(() => `<td colspan="3" class="sub">Justificativa Laboratorial</td>`).join("")}</tr>
        <tr>${COMPONENT_KEYS.map((k) => {
          const c = getComponent(request, k);
          let body = "";
          if (k === "hemacias") body = `<div><strong>Hb:</strong> ${fill(c?.lab_hb, "60%")}</div><div style="margin-top:3pt"><strong>Ht:</strong> ${fill(c?.lab_ht, "60%")}</div>`;
          else if (k === "plaquetas") body = `<div><strong>N° de plaquetas:</strong> ${fill(c?.lab_platelets, "55%")}</div>`;
          else if (k === "plasma") body = `<div><strong>TAP:</strong> ${fill(c?.lab_tap, "60%")}</div><div style="margin-top:3pt"><strong>TTPA:</strong> ${fill(c?.lab_ttpa, "55%")}</div><div style="margin-top:3pt"><strong>RNI:</strong> ${fill(c?.lab_rni, "60%")}</div>`;
          else body = `<div><strong>Fibrinogênio:</strong> ${fill(c?.lab_fibrinogen, "55%")}</div>`;
          return `<td colspan="3" class="cell">${body}</td>`;
        }).join("")}</tr>

        <!-- Histórico Transfusional -->
        <tr><td colspan="12" class="band">Histórico Transfusional</td></tr>
        <tr>
          <td colspan="6" class="cell">Transfusões prévias: ${cb(request.previous_transfusion === true)} Sim &nbsp; ${cb(request.previous_transfusion === false)} Não</td>
          <td colspan="6" class="cell">Teve reação transfusional? ${cb(request.transfusion_reaction === true)} Sim &nbsp; ${cb(request.transfusion_reaction === false)} Não</td>
        </tr>
        <tr>
          <td colspan="6" class="cell"><strong>Tipo de reação:</strong> ${fill(request.reaction_type, "60%")}</td>
          <td colspan="6" class="cell"><strong>Antecedentes Gestacionais:</strong> Gesta ${fill(request.obstetric_history?.gesta, "30pt")} Parto ${fill(request.obstetric_history?.parto, "30pt")} Aborto ${fill(request.obstetric_history?.aborto, "30pt")}</td>
        </tr>

        <!-- Tipos de Transfusão -->
        <tr><td colspan="12" class="band">Tipos de Transfusão</td></tr>
        <tr>
          <td colspan="8" class="cell">${cb(request.transfusion_type === "programada")} Programada para ${fill(fmtDate(request.scheduled_date), "80pt")} às ${fill(request.scheduled_time, "50pt")} h</td>
          <td colspan="4" rowspan="3" class="sig-cell">${sigBlock}</td>
        </tr>
        <tr>
          <td colspan="4" class="cell">${cb(request.transfusion_type === "rotina")} De rotina (Dentro de 24 horas)</td>
          <td colspan="4" class="cell">${cb(request.transfusion_type === "urgencia")} De urgência (Dentro de 3 horas)</td>
        </tr>
        <tr>
          <td colspan="8" class="cell">${cb(request.transfusion_type === "emergencia")} De emergência (qualquer retardo acarretará risco de vida)</td>
        </tr>

        <!-- Rodapé regulatório -->
        <tr><td colspan="12" class="legal">
          <p><strong>UMA REQUISIÇÃO INCOMPLETA, INADEQUADA E ILEGÍVEL NÃO DEVE SER ACEITA PELO SERVIÇO DE HEMOTERAPIA. AS TRANSFUSÕES DEVEM SER REALIZADAS, PREFERENCIALMENTE, NO PERÍODO DIURNO (RDC 153/2004 — MINISTÉRIO DA SAÚDE).</strong></p>
          <p>Em cumprimento à portaria N° 05, publicada em 28/09/2017 (que substitui a RDC N° 34/2014-MS), é obrigatória a realização dos testes pré-transfusionais (classificação sanguínea ABO + Rh e provas de compatibilidade) para liberação de sangue total ou concentrado de hemácias a ser transfundido.</p>
          <p>Diante de situações emergenciais, o médico tem autoridade para dispensar a realização dos testes, agilizando a liberação dos produtos. Nesses casos, é <strong>IMPRESCINDÍVEL</strong> o preenchimento do Termo de Responsabilidade no verso desta folha pelo médico responsável.</p>
        </td></tr>
      </tbody>
    </table>
  `;

  const extraStyles = `
    @page { size: A4 portrait; margin: 10mm 11mm; }
    table.nz.hemo { width:100%; border-collapse:collapse; font-size:8.5pt; border:1pt solid #1e293b; margin-top:6pt; table-layout:fixed; }
    table.nz.hemo th, table.nz.hemo td { border:1pt solid #1e293b; padding:3pt 5pt; color:#0a1628; vertical-align:top; text-align:left; font-weight:500; background:#fff; word-wrap:break-word; }
    table.nz.hemo th { font-weight:500; white-space:nowrap; }
    table.nz.hemo td.bold, table.nz.hemo .bold { font-weight:700; }
    table.nz.hemo td.band { background:#e2e8f0; text-align:center; font-weight:800; text-transform:uppercase; letter-spacing:0.5pt; padding:4pt; font-size:9pt; }
    table.nz.hemo td.sub { background:#f8fafc; text-align:center; font-weight:700; text-transform:uppercase; font-size:8pt; padding:3pt; letter-spacing:0.3pt; }
    table.nz.hemo td.cell { padding:4pt 6pt; }
    table.nz.hemo .opt { font-size:8pt; padding:1pt 0; line-height:1.3; }
    table.nz.hemo .muted-bold { font-weight:600; margin-bottom:2pt; }
    table.nz.hemo td.sig-cell { text-align:center; vertical-align:top; padding:5pt; }
    table.nz.hemo .sig-meta { font-size:8pt; margin-bottom:2pt; text-align:left; }
    table.nz.hemo .sig-line { border-top:1pt solid #0a1628; margin-top:24pt; padding-top:3pt; font-size:7.5pt; text-align:center; }
    table.nz.hemo .sig-name { font-weight:700; font-size:8pt; margin-top:1pt; }
    table.nz.hemo .sig-crm { font-weight:500; font-size:7.5pt; color:#475569; }
    table.nz.hemo td.legal { font-size:7pt; line-height:1.4; padding:5pt 7pt; text-align:justify; }
    table.nz.hemo td.legal p { margin:0 0 3pt 0; }
    .cb { display:inline-block; width:8pt; height:8pt; border:1pt solid #0a1628; margin-right:4pt; vertical-align:middle; }
    .cb.on { background:#0a1628; }
    .fill { display:inline-block; border-bottom:1pt solid #0a1628; padding:0 3pt; min-width:40pt; }
  `;

  const logoDataUrl = await prepareLogo();
  const html = buildNormaZeroDocument({
    title: "Solicitação de Sangue / Hemocomponentes",
    subtitle: `Emitida em ${createdStr} às ${createdTime}`,
    sectorLabel: sectorName || "Assistência Hospitalar",
    docCodePrefix: "REQ-HEMO",
    bodyHtml,
    signatures: [],
    logoDataUrl,
    extraStyles,
  });

  const w = openPrintWindow(html, "Preparando solicitação de hemocomponentes…");
  if (!w) {
    alert("Permita pop-ups para imprimir a solicitação.");
  }
}
