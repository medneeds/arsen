/**
 * Guia de Requisição de Exames — padronizada no timbrado Norma Zero (MAN.05-001).
 *
 * - `printRequisitionGuide(...)` abre janela popup com `buildNormaZeroDocument`
 *   para impressão real.
 * - `<PrintableRequisitionGuide />` renderiza, na própria interface (dialog),
 *   uma pré-visualização que espelha exatamente as seções/tabela do documento
 *   impresso (cabeçalho institucional, doc-bar, identificação, justificativa,
 *   itens em grid 2 colunas com checkbox, observações, assinaturas e rodapé).
 */

import React from "react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { whitelabel } from "@/config/whitelabel";

const PARECER_ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "span", "div"];
function sanitizeRichHtmlPrint(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: PARECER_ALLOWED_TAGS, ALLOWED_ATTR: [] });
}

/** Calcula idade aproximada em anos a partir de ISO date (YYYY-MM-DD). */
function ageInYears(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

function fmtBirthDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Busca data de nascimento, nº de prontuário e nº de atendimento (registry → patients → encounters). */
async function fetchPatientIdentifiers(req: {
  patient_registry_id?: string | null;
  patient_id?: string | null;
}): Promise<{ birth_date: string | null; medical_record: string | null; encounter_code: string | null }> {
  let birth_date: string | null = null;
  let medical_record: string | null = null;
  let encounter_code: string | null = null;
  try {
    let regId = req.patient_registry_id || null;
    if (req.patient_id) {
      const { data: pat } = await supabase
        .from("patients")
        .select("patient_registry_id, medical_record")
        .eq("id", req.patient_id)
        .maybeSingle();
      if (!regId && (pat as any)?.patient_registry_id) regId = (pat as any).patient_registry_id;
      if (!medical_record && (pat as any)?.medical_record) medical_record = (pat as any).medical_record;
    }
    if (regId) {
      const { data: reg } = await supabase
        .from("patient_registry")
        .select("birth_date, medical_record")
        .eq("id", regId)
        .maybeSingle();
      if ((reg as any)?.birth_date) birth_date = (reg as any).birth_date;
      if (!medical_record && (reg as any)?.medical_record) medical_record = (reg as any).medical_record;
    }
    // Atendimento — apenas via patient_id ou registry_id (nunca por nome)
    if (req.patient_id || regId) {
      let q = supabase
        .from("patient_encounters")
        .select("encounter_code, created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (req.patient_id) q = q.eq("patient_id", req.patient_id);
      else if (regId) q = q.eq("registry_id", regId);
      const { data: enc } = await q.maybeSingle();
      encounter_code = (enc as any)?.encounter_code || null;
    }
  } catch {
    /* silencioso */
  }
  return { birth_date, medical_record, encounter_code };
}
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
import {
  PrintableCultureRequest,
  printCultureRequest,
  type CultureRequestData,
} from "@/components/PrintableCultureRequest";

/** Verifica se a requisição é predominantemente de cultura microbiológica. */
const CULTURE_KEYWORDS = ["cultura", "hemocultura", "urocultura", "antibiograma", "swab", "secre"];
function isCultureRequest(items: any[]): boolean {
  if (!Array.isArray(items) || items.length === 0) return false;
  const cultureCount = items.filter((it) => {
    const name = (typeof it === "string" ? it : it?.name || "").toLowerCase();
    return CULTURE_KEYWORDS.some((kw) => name.includes(kw));
  }).length;
  return cultureCount / items.length >= 0.6; // ≥60% culturas → usar layout dedicado
}

interface PrintableRequisitionGuideProps {
  request: {
    patient_name: string;
    patient_bed?: string | null;
    patient_sector?: string | null;
    patient_id?: string | null;
    patient_registry_id?: string | null;
    patient_birth_date?: string | null; // ISO YYYY-MM-DD (opcional, busca automática se ausente)
    category: string;
    items: any[];
    priority: string;
    clinical_indication?: string | null;
    notes?: string | null;
    requested_by_name?: string | null;
    created_at: string;
  };
  sectorLabel?: (s: string | null) => string;
}

const CATEGORY_LABELS: Record<string, string> = {
  laboratorio: "Exames Laboratoriais",
  imagem: "Exames de Imagem",
  parecer: "Parecer Especializado",
  apac: "APAC — Alta Complexidade",
};

const CATEGORY_PREFIX: Record<string, string> = {
  laboratorio: "REQ-LAB",
  imagem: "REQ-IMG",
  parecer: "REQ-PAR",
  apac: "REQ-APAC",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgente: "URGENTE",
  rotina: "ROTINA",
  programado: "PROGRAMADO",
};

const PRIORITY_BADGE_STYLE: Record<string, React.CSSProperties> = {
  urgente: { background: "#fee2e2", color: "#b91c1c", border: "1px solid #b91c1c" },
  rotina: { background: "#dbeafe", color: "#1d4ed8", border: "1px solid #1d4ed8" },
  programado: { background: "#e0f2fe", color: "#0369a1", border: "1px solid #0369a1" },
};

const PRIORITY_BADGE_CSS: Record<string, string> = {
  urgente: "background:#fee2e2;color:#b91c1c;border:1pt solid #b91c1c;",
  rotina: "background:#dbeafe;color:#1d4ed8;border:1pt solid #1d4ed8;",
  programado: "background:#e0f2fe;color:#0369a1;border:1pt solid #0369a1;",
};

const escapeHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ─────────────────────────────────────────────────────────────────────────────
// Pré-visualização React (mesmas seções e tabelas do documento impresso)
// ─────────────────────────────────────────────────────────────────────────────

const ink = "#0a1628";
const inkSoft = "#475569";
const lineSoft = "#cbd5e1";
const sectionBg = "#0054A6";
const tableHeadBg = "#f1f5f9";
const tableZebra = "#fafbfc";

const sectionStyle: React.CSSProperties = {
  background: sectionBg,
  color: "#fff",
  fontSize: "9pt",
  fontWeight: 700,
  letterSpacing: "0.3px",
  textTransform: "uppercase",
  padding: "4px 8px",
  margin: "10px 0 4px",
  borderRadius: "2px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "9pt",
  border: `1px solid ${lineSoft}`,
};

const thStyle: React.CSSProperties = {
  background: tableHeadBg,
  color: ink,
  fontWeight: 600,
  textAlign: "left",
  padding: "5px 8px",
  border: `1px solid ${lineSoft}`,
  fontSize: "8.5pt",
};

const tdStyle: React.CSSProperties = {
  padding: "5px 8px",
  border: `1px solid ${lineSoft}`,
  color: ink,
  fontSize: "9pt",
  verticalAlign: "top",
};

export function PrintableRequisitionGuide({
  request,
  sectorLabel,
}: PrintableRequisitionGuideProps) {
  const items = Array.isArray(request.items) ? request.items : [];
  const docPrefix = CATEGORY_PREFIX[request.category] || "REQ";
  const docCode = React.useMemo(() => generateDocCode(docPrefix), [docPrefix]);

  // Hidrata data de nascimento e nº de prontuário a partir do cadastro do paciente.
  const [resolvedBirth, setResolvedBirth] = React.useState<string | null>(
    request.patient_birth_date || null,
  );
  const [resolvedRecord, setResolvedRecord] = React.useState<string | null>(
    (request as any).patient_medical_record || null,
  );
  const [resolvedEncounter, setResolvedEncounter] = React.useState<string | null>(
    (request as any).patient_encounter_code || null,
  );
  React.useEffect(() => {
    let alive = true;
    fetchPatientIdentifiers({
      patient_registry_id: request.patient_registry_id,
      patient_id: request.patient_id,
    }).then((d) => {
      if (!alive) return;
      if (!request.patient_birth_date) setResolvedBirth(d.birth_date);
      if (!(request as any).patient_medical_record) setResolvedRecord(d.medical_record);
      if (!(request as any).patient_encounter_code) setResolvedEncounter(d.encounter_code);
    });
    if (request.patient_birth_date) setResolvedBirth(request.patient_birth_date);
    if ((request as any).patient_medical_record) setResolvedRecord((request as any).patient_medical_record);
    if ((request as any).patient_encounter_code) setResolvedEncounter((request as any).patient_encounter_code);
    return () => { alive = false; };
  }, [request.patient_birth_date, (request as any).patient_medical_record, (request as any).patient_encounter_code, request.patient_registry_id, request.patient_id]);

  // Roteamento: se a requisição é predominantemente de cultura microbiológica,
  // usa o layout hospitalar dedicado (estrutura tabular tipo formulário).
  if (isCultureRequest(items)) {
    const cultureData: CultureRequestData = {
      patient_name: request.patient_name,
      patient_sector: request.patient_sector,
      patient_bed: request.patient_bed,
      patient_birth_date: resolvedBirth,
      items,
      clinical_indication: request.clinical_indication,
      notes: request.notes,
      requested_by_name: request.requested_by_name,
      created_at: request.created_at,
    };
    return <PrintableCultureRequest request={cultureData} sectorLabel={sectorLabel} />;
  }

  const categoryLabel = CATEGORY_LABELS[request.category] || request.category;
  const priorityLabel =
    PRIORITY_LABELS[request.priority] || (request.priority || "").toUpperCase();
  const priorityStyle =
    PRIORITY_BADGE_STYLE[request.priority] || PRIORITY_BADGE_STYLE.rotina;

  const scheduledMatch = request.notes?.match(/\[PROGRAMADO: ([^\]]+)\]/);
  const scheduledInfo = scheduledMatch?.[1] || null;
  const cleanNotes =
    request.notes?.replace(/\[PROGRAMADO: [^\]]+\]\n?/, "").trim() || null;

  const sectorName = sectorLabel
    ? sectorLabel(request.patient_sector || null)
    : request.patient_sector || "";

  const createdAt = new Date(request.created_at);
  const createdStr = format(createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <div
      style={{
        background: "#fff",
        color: ink,
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "16px 18px",
        borderRadius: "6px",
        border: `1px solid ${lineSoft}`,
      }}
      className="text-foreground"
    >
      <NormaZeroPrintHeader
        documentLabel={`Guia · ${categoryLabel}`}
        documentCode={docCode}
        documentSubtitle={createdStr}
        width="100%"
      />

      {/* Doc-bar — setor · prioridade */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#eef2f7",
          border: `1px solid ${lineSoft}`,
          borderRadius: "3px",
          padding: "5px 10px",
          fontSize: "8pt",
          color: inkSoft,
          marginBottom: "8px",
        }}
      >
        <span>
          <strong style={{ color: ink }}>Setor emitente:</strong>{" "}
          {sectorName || "Assistência Hospitalar"}
        </span>
        <span
          style={{
            ...priorityStyle,
            padding: "2px 10px",
            borderRadius: "3px",
            fontWeight: 700,
            fontSize: "8pt",
            letterSpacing: "0.4px",
          }}
        >
          {priorityLabel}
        </span>
      </div>

      {/* Título principal */}
      <div style={{ textAlign: "center", margin: "6px 0 4px" }}>
        <div
          style={{
            fontSize: "13pt",
            fontWeight: 800,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: ink,
          }}
        >
          Guia de Requisição — {categoryLabel}
        </div>
        <div style={{ fontSize: "8pt", color: inkSoft, marginTop: "2px" }}>
          Solicitada em {createdStr}
        </div>
      </div>

      {/* Identificação */}
      <div style={sectionStyle}>Identificação</div>
      <table style={tableStyle}>
        <tbody>
          <tr>
            <th style={{ ...thStyle, width: "18%" }}>Paciente</th>
            <td style={{ ...tdStyle, fontWeight: 700 }} colSpan={3}>
              {request.patient_name}
            </td>
          </tr>
          <tr style={{ background: tableZebra }}>
            <th style={thStyle}>Setor</th>
            <td style={tdStyle}>{sectorName || "—"}</td>
            <th style={{ ...thStyle, width: "14%" }}>Leito</th>
            <td style={{ ...tdStyle, width: "18%" }}>
              {request.patient_bed || "—"}
            </td>
          </tr>
          <tr>
            <th style={thStyle}>Nº Prontuário</th>
            <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 600 }}>
              {resolvedRecord || "—"}
            </td>
            <th style={thStyle}>Nº Atendimento</th>
            <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 600 }}>
              {resolvedEncounter || "—"}
            </td>
          </tr>
          <tr>
            <th style={thStyle}>Data Nasc.</th>
            <td style={tdStyle}>{fmtBirthDate(resolvedBirth)}</td>
            <th style={thStyle}>Idade</th>
            <td style={tdStyle}>
              {ageInYears(resolvedBirth) !== null ? `${ageInYears(resolvedBirth)} anos` : "—"}
            </td>
          </tr>
          <tr>
            <th style={thStyle}>Solicitante</th>
            <td style={tdStyle}>{request.requested_by_name || "—"}</td>
            <th style={thStyle}>Solicitação</th>
            <td style={tdStyle}>{createdStr}</td>
          </tr>
          <tr style={{ background: tableZebra }}>
            <th style={thStyle}>Categoria</th>
            <td style={tdStyle}>{categoryLabel}</td>
            <th style={thStyle}>Prioridade</th>
            <td style={tdStyle}>
              <span
                style={{
                  ...priorityStyle,
                  display: "inline-block",
                  padding: "1px 8px",
                  borderRadius: "3px",
                  fontWeight: 700,
                  fontSize: "8pt",
                }}
              >
                {priorityLabel}
              </span>
            </td>
          </tr>
          {scheduledInfo && (
            <tr>
              <th style={thStyle}>Agendamento</th>
              <td style={tdStyle} colSpan={3}>
                {scheduledInfo}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Justificativa Clínica */}
      {request.clinical_indication && (
        <>
          <div style={sectionStyle}>Justificativa Clínica</div>
          <table style={tableStyle}>
            <tbody>
              <tr>
                <td style={{ ...tdStyle, minHeight: 40 }}>
                  {/<\/?(p|br|strong|em|u|ul|ol|li|b|i|span|div)[\s>/]/i.test(request.clinical_indication) ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitizeRichHtmlPrint(request.clinical_indication) }} />
                  ) : (
                    request.clinical_indication
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Itens Solicitados */}
      <div style={sectionStyle}>Itens Solicitados ({items.length})</div>
      {items.length === 0 ? (
        <div
          style={{
            border: `1px dashed ${lineSoft}`,
            borderRadius: "3px",
            padding: "10px",
            textAlign: "center",
            color: inkSoft,
            fontSize: "8.5pt",
          }}
        >
          Nenhum item registrado.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            border: `1px solid ${lineSoft}`,
            borderRadius: "3px",
            overflow: "hidden",
          }}
        >
          {items.map((it, i) => {
            const name =
              typeof it === "string" ? it : (it as any)?.name || String(it ?? "");
            const isLastCol = (i + 1) % 2 === 0;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 8px",
                  fontSize: "8.5pt",
                  borderBottom: `1px solid #e2e8f0`,
                  borderRight: isLastCol ? "none" : `1px solid #e2e8f0`,
                  color: ink,
                }}
              >
                <span
                  style={{
                    minWidth: 16,
                    fontSize: "8.5pt",
                    fontWeight: 600,
                    color: ink,
                    flexShrink: 0,
                    textAlign: "right",
                  }}
                >
                  {i + 1}.
                </span>
                <span>{name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Observações */}
      {cleanNotes && (
        <>
          <div style={sectionStyle}>Observações</div>
          <table style={tableStyle}>
            <tbody>
              <tr>
                <td style={tdStyle}>
                  {cleanNotes.split("\n").map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      <br />
                    </React.Fragment>
                  ))}
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Assinaturas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "30px",
          marginTop: "26px",
        }}
      >
        {[
          { label: "Médico Solicitante", caption: "CRM · Carimbo e assinatura" },
          { label: "Setor Executor", caption: "Recebimento e execução" },
        ].map((sig) => (
          <div key={sig.label} style={{ textAlign: "center" }}>
            <div
              style={{
                borderTop: `1px solid ${ink}`,
                paddingTop: "4px",
                fontSize: "8.5pt",
                fontWeight: 700,
                color: ink,
              }}
            >
              {sig.label}
            </div>
            <div style={{ fontSize: "7pt", color: inkSoft, marginTop: "2px" }}>
              {sig.caption}
            </div>
          </div>
        ))}
      </div>

      <NormaZeroPrintFooter width="100%" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Impressão real (Norma Zero via popup) — inalterada
// ─────────────────────────────────────────────────────────────────────────────

export async function printRequisitionGuide(
  request: any,
  sectorLabel?: (s: string | null) => string,
  opts?: {
    compactDuo?: {
      otherItems: any[];
      otherLabel?: string;
      gasoLabel?: string;
    };
  },
) {
  const items = Array.isArray(request.items) ? request.items : [];

  // Resolve data de nascimento e nº de prontuário (fallback registry/patients)
  const resolvedIds = await fetchPatientIdentifiers({
    patient_registry_id: request.patient_registry_id,
    patient_id: request.patient_id,
  });
  const birthDate: string | null = request.patient_birth_date || resolvedIds.birth_date;
  const medicalRecord: string | null =
    (request as any).patient_medical_record || resolvedIds.medical_record;
  const encounterCode: string | null =
    (request as any).patient_encounter_code || resolvedIds.encounter_code;
  const ageY = ageInYears(birthDate);

  // Roteamento para layout dedicado de cultura microbiológica (padrão hospitalar)
  if (isCultureRequest(items)) {
    return printCultureRequest(
      {
        patient_name: request.patient_name,
        patient_sector: request.patient_sector,
        patient_bed: request.patient_bed,
        patient_birth_date: birthDate,
        items,
        clinical_indication: request.clinical_indication,
        notes: request.notes,
        requested_by_name: request.requested_by_name,
        created_at: request.created_at,
      },
      sectorLabel,
    );
  }

  const categoryLabel = CATEGORY_LABELS[request.category] || request.category;
  const priorityLabel = PRIORITY_LABELS[request.priority] || (request.priority || "").toUpperCase();
  const priorityCss = PRIORITY_BADGE_CSS[request.priority] || PRIORITY_BADGE_CSS.rotina;
  const docPrefix = CATEGORY_PREFIX[request.category] || "REQ";

  const scheduledMatch = request.notes?.match(/\[PROGRAMADO: ([^\]]+)\]/);
  const scheduledInfo: string | null = scheduledMatch?.[1] || null;
  const cleanNotes: string | null =
    request.notes?.replace(/\[PROGRAMADO: [^\]]+\]\n?/, "").trim() || null;

  const sectorName = sectorLabel
    ? sectorLabel(request.patient_sector || null)
    : (request.patient_sector || "");

  const createdAt = new Date(request.created_at);
  const createdStr = format(createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const isParecer = request.category === "parecer";

  // Para parecer, a especialidade vai em destaque dentro da identificação
  const parecerSpecialtyLabel = isParecer
    ? (items.length > 0
        ? items
            .map((it: any) => (typeof it === "string" ? it : it?.name || String(it ?? "")))
            .filter(Boolean)
            .join(" • ")
        : "—")
    : "";

  const identificationRows = isParecer
    ? `
    <table class="nz parecer-id" style="margin-bottom:5pt;table-layout:fixed;width:100%">
      <colgroup>
        <col style="width:11%"/><col/><col style="width:13%"/><col style="width:17%"/><col style="width:13%"/><col style="width:18%"/>
      </colgroup>
      <tbody>
        <tr>
          <th>Paciente</th>
          <td class="pid-strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(request.patient_name)}</td>
          <th>Nº Pront.</th>
          <td class="pid-mono" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(medicalRecord || "—")}</td>
          <th>Nº Atend.</th>
          <td class="pid-mono" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(encounterCode || "—")}</td>
        </tr>
        <tr>
          <th>Setor</th><td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(sectorName || "—")}</td>
          <th>Leito</th><td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(request.patient_bed || "—")}</td>
          <th>Nasc. / Idade</th>
          <td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(fmtBirthDate(birthDate))}${ageY !== null ? ` <span style="color:#475569">(${ageY}a)</span>` : ""}</td>
        </tr>
        <tr>
          <th>Solicitante</th>
          <td colspan="3" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(request.requested_by_name || "—")}</td>
          <th>Solicitação</th>
          <td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(createdStr)}</td>
        </tr>
        <tr>
          <th>Especialidade</th>
          <td colspan="3" class="pid-especialidade">${escapeHtml(parecerSpecialtyLabel)}</td>
          <th>Prioridade</th>
          <td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="prio-badge" style="${priorityCss}">${escapeHtml(priorityLabel)}</span></td>
        </tr>
        ${
          scheduledInfo
            ? `<tr><th style="white-space:nowrap">Agendamento</th><td colspan="5" style="white-space:normal;word-break:break-word">${escapeHtml(scheduledInfo)}</td></tr>`
            : ""
        }
      </tbody>
    </table>
  `
    : `
    <table class="nz" style="margin-bottom:6pt">
      <tbody>
        <tr>
          <th style="width:18%">Paciente</th>
          <td colspan="3" style="font-weight:700;font-size:9.5pt">${escapeHtml(request.patient_name)}</td>
        </tr>
        <tr>
          <th>Setor</th><td>${escapeHtml(sectorName || "—")}</td>
          <th style="width:14%">Leito</th><td style="width:18%">${escapeHtml(request.patient_bed || "—")}</td>
        </tr>
        <tr>
          <th>Nº Prontuário</th>
          <td style="font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:600">${escapeHtml(medicalRecord || "—")}</td>
          <th>Nº Atendimento</th>
          <td style="font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:600">${escapeHtml(encounterCode || "—")}</td>
        </tr>
        <tr>
          <th>Data Nasc.</th><td>${escapeHtml(fmtBirthDate(birthDate))}</td>
          <th>Idade</th><td>${ageY !== null ? ageY + " anos" : "—"}</td>
        </tr>
        <tr>
          <th>Solicitante</th><td>${escapeHtml(request.requested_by_name || "—")}</td>
          <th>Solicitação</th><td>${escapeHtml(createdStr)}</td>
        </tr>
        <tr>
          <th>Categoria</th><td>${escapeHtml(categoryLabel)}</td>
          <th>Prioridade</th>
          <td><span class="prio-badge" style="${priorityCss}">${escapeHtml(priorityLabel)}</span></td>
        </tr>
        ${
          scheduledInfo
            ? `<tr><th>Agendamento</th><td colspan="3">${escapeHtml(scheduledInfo)}</td></tr>`
            : ""
        }
      </tbody>
    </table>
  `;

  // Para parecer aceitamos HTML rico. Limite fixo de 2200 caracteres p/ caber em 1 página A4.
  const PARECER_HARD = 2200;
  const rawIndication = request.clinical_indication || "";
  const isHtmlIndication = /<\/?(p|br|strong|em|u|ul|ol|li|b|i|span|div)[\s>/]/i.test(rawIndication);

  const tmpDiv = typeof document !== "undefined" ? document.createElement("div") : null;
  let indicationHtml = "";
  if (rawIndication) {
    if (isParecer && isHtmlIndication) {
      indicationHtml = sanitizeRichHtmlPrint(rawIndication);
    } else {
      indicationHtml = escapeHtml(rawIndication).replace(/\n/g, "<br/>");
    }
  }

  // Altura fixa da resposta manual (reduzida ~1 linha para garantir 1 página A4 com 2200 chars)
  const respHeightMm = 60;
  const justMaxMm = 78;

  const justificationBlock = rawIndication
    ? `<h2 class="nz-section">${isParecer ? "Motivo da Solicitação de Parecer" : "Justificativa Clínica"}</h2>
       <table class="nz"><tbody><tr><td class="${isParecer ? "parecer-just" : ""}">${indicationHtml}</td></tr></tbody></table>`
    : "";

  const itemsCells =
    items.length > 0
      ? items
          .map((item: any, idx: number) => {
            const name = typeof item === "string" ? item : item?.name || String(item ?? "");
            return `<div class="req-item"><span class="req-num">${idx + 1}.</span><span>${escapeHtml(name)}</span></div>`;
          })
          .join("")
      : `<div class="nz-empty">Nenhum item registrado.</div>`;

  // Em parecer, a especialidade já aparece em destaque na identificação.
  // Só renderizamos um bloco autônomo de especialidades se houver 2+ (lista múltipla).
  const itemsBlock = isParecer
    ? (items.length > 1
        ? `<h2 class="nz-section">Especialidades Solicitadas (${items.length})</h2>
           <div class="req-grid">${itemsCells}</div>`
        : "")
    : `<h2 class="nz-section">Itens Solicitados (${items.length})</h2>
       <div class="req-grid">${itemsCells}</div>`;


  const notesBlock = cleanNotes
    ? `<h2 class="nz-section">Observações</h2>
       <table class="nz"><tbody><tr><td>${escapeHtml(cleanNotes).replace(/\n/g, "<br/>")}</td></tr></tbody></table>`
    : "";

  // Bloco específico do parecer: área pautada para resposta do parecerista (altura fixa)
  const parecerResponseBlock = isParecer
    ? `<h2 class="nz-section">Resposta do Parecer</h2>
       <div class="parecer-response">
         <div class="parecer-response-lines" style="height:${respHeightMm}mm"></div>
         <table class="parecer-sign">
           <tbody>
             <tr>
               <td class="psl"><span>Parecerista:</span><div class="psf"></div></td>
               <td class="psl" style="width:22%"><span>CRM:</span><div class="psf"></div></td>
               <td class="psl" style="width:18%"><span>Data:</span><div class="psf"></div></td>
               <td class="psl" style="width:14%"><span>Hora:</span><div class="psf"></div></td>
             </tr>
             <tr>
               <td class="psl" colspan="4" style="height:24pt"><span>Assinatura e carimbo:</span></td>
             </tr>
           </tbody>
         </table>
       </div>`
    : "";

  const bodyHtml = `
    <h2 class="nz-section">Identificação</h2>
    ${identificationRows}
    ${justificationBlock}
    ${itemsBlock}
    ${notesBlock}
    ${parecerResponseBlock}
  `;

  const extraStyles = `
    .prio-badge { display:inline-block; padding:1.5pt 8pt; border-radius:3pt; font-weight:700; font-size:8pt; letter-spacing:0.4pt; }
    .req-grid { display:grid; grid-template-columns: 1fr 1fr; gap:0; border:0.5pt solid #cbd5e1; border-radius:3pt; overflow:hidden; }
    .req-item { display:flex; align-items:center; gap:5pt; padding:4pt 7pt; font-size:8.5pt; border-bottom:0.5pt solid #e2e8f0; border-right:0.5pt solid #e2e8f0; }
    .req-item:nth-child(2n) { border-right:none; }
    .req-num { min-width:14pt; font-size:8.5pt; font-weight:600; color:#0a1628; text-align:right; flex-shrink:0; }

    /* Parecer — caixa de justificativa (altura fixa) + área de resposta */
    .parecer-just { max-height: ${justMaxMm}mm; overflow: hidden; font-size: 9pt; line-height: 1.38; }
    .parecer-just p { margin: 0 0 4pt 0; }
    .parecer-just p:last-child { margin-bottom: 0; }
    .parecer-just ul, .parecer-just ol { margin: 2pt 0 4pt 14pt; padding: 0; }
    .parecer-just li { margin-bottom: 1.5pt; }
    .parecer-just strong, .parecer-just b { font-weight: 700; }
    .parecer-just em, .parecer-just i { font-style: italic; }
    .parecer-just u { text-decoration: underline; }
    .parecer-response { border: 1pt solid #0a1628; border-radius: 3pt; margin-top: 4pt; padding: 4pt 6pt 6pt; background: #fff; page-break-inside: avoid; }
    .parecer-response-lines {
      background-image: repeating-linear-gradient(
        to bottom,
        transparent 0,
        transparent 7.5mm,
        #94a3b8 7.5mm,
        #94a3b8 7.6mm
      );
      border-bottom: 0.5pt solid #cbd5e1;
      margin-bottom: 4pt;
    }
    .parecer-sign { width: 100%; border-collapse: collapse; font-size: 8pt; margin-top: 3pt; }
    .parecer-sign .psl { border: 0.5pt solid #94a3b8; padding: 3pt 5pt; vertical-align: top; }
    .parecer-sign .psl span { font-size: 7pt; color: #475569; text-transform: uppercase; letter-spacing: 0.3pt; font-weight: 600; }
    .parecer-sign .psf { height: 14pt; }
    /* Identificação compacta do parecer */
    .parecer-id { font-size: 7pt; }
    .parecer-id th { font-size: 6.2pt !important; padding: 2pt 4pt !important; letter-spacing: 0.02em; text-transform: uppercase; color: #475569; white-space: nowrap; }
    .parecer-id td { padding: 2pt 4pt !important; font-size: 7.4pt !important; line-height: 1.2 !important; }
    .parecer-id td.pid-strong { font-size: 8pt !important; font-weight: 700; }
    .parecer-id td.pid-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-weight: 600; font-size: 6.6pt !important; }
    .parecer-id td.pid-especialidade { background: #eff6ff; font-weight: 700; font-size: 8pt !important; color: #0a1628; word-break: break-word; white-space: normal; line-height: 1.15 !important; }

    ${isParecer ? `
      /* Cabeçalho compacto exclusivo do parecer */
      .nz-h-line1, .nz-h-line2, .nz-h-tag { display: none !important; }
      .nz-h-line3 { font-size: 10.5pt !important; margin-top: 0 !important; }
      .nz-header { padding: 4pt 0 3pt !important; margin-bottom: 5pt !important; border-bottom-width: 2pt !important; }
      .nz-header-inner { grid-template-columns: 44px 1fr 44px !important; gap: 8pt !important; }
      .nz-logo { height: 38px !important; width: 38px !important; }
      .nz-cruz-bar { height: 3pt !important; margin-top: 3pt !important; }
      h1.nz-title { font-size: 12pt !important; margin: 3pt 0 1pt !important; }
      .nz-subtitle { display: none !important; }
      .nz-doc-bar { padding: 3pt 7pt !important; font-size: 7.5pt !important; margin-bottom: 5pt !important; }
      .nz-signature-area { display: none !important; }
      /* Endereço institucional movido para o rodapé */
      .nz-footer { flex-wrap: wrap; row-gap: 2pt; padding-top: 3pt !important; margin-top: 6pt !important; }
      .nz-footer::after {
        content: "${(whitelabel.institution.address || "").replace(/"/g, "\\\"")}";
        flex-basis: 100%;
        text-align: center;
        color: #64748b;
        font-size: 6.5pt;
        font-style: italic;
        margin-top: 1pt;
      }
    ` : ""}
  `;

  const logoDataUrl = await prepareLogo();

  // ── Modo compacto: 2 vias lado a lado (paisagem), inspirado no layout de culturas ──
  if (opts?.compactDuo) {
    const { otherItems, otherLabel = "Exames Laboratoriais", gasoLabel = "Gasometria" } = opts.compactDuo;
    const inst = (whitelabel as any).print?.institutionalHeader || {};
    const colors = (whitelabel as any).theme?.institutionalColors || {};
    const docNoDuo = generateDocCode("REQ-LAB");
    const nowDuo = new Date();
    const dateStrDuo = nowDuo.toLocaleDateString("pt-BR");
    const timeStrDuo = nowDuo.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const logoBlockDuo = logoDataUrl
      ? `<img class="mini-logo" src="${logoDataUrl}" alt="logo" />`
      : `<div class="mini-logo" style="display:flex;align-items:center;justify-content:center;background:#0054A6;color:#fff;font-weight:700;font-size:9pt;border-radius:4px">HM</div>`;

    const cruzColors = [
      colors.red || "#E53935",
      colors.orange || "#FB8C00",
      colors.yellow || "#FDD835",
      colors.green || "#43A047",
      colors.blue || "#0054A6",
    ];
    const cruzBar = `<div class="mini-cruz-bar">${cruzColors.map((c) => `<div style="background:${c}"></div>`).join("")}</div>`;

    const miniHeader = `
      <div class="mini-header">
        <div class="mini-header-inner">
          ${logoBlockDuo}
          <div class="mini-h-text">
            <div class="mini-h-line1">${escapeHtml(inst.line1 || "")}</div>
            <div class="mini-h-line2">${escapeHtml(inst.line2 || "")}</div>
            <div class="mini-h-line3">${escapeHtml(inst.line3 || "")}</div>
          </div>
        </div>
        ${cruzBar}
        <div class="mini-doc-bar">
          <span><b>Doc:</b> ${docNoDuo}</span>
          <span><b>Setor:</b> ${escapeHtml(sectorName || "Assistência Hospitalar")}</span>
          <span><b>Emissão:</b> ${dateStrDuo} ${timeStrDuo}</span>
        </div>
      </div>
    `;

    const priorityCssLocal = PRIORITY_BADGE_CSS[request.priority] || PRIORITY_BADGE_CSS.rotina;
    const priorityLabelLocal = PRIORITY_LABELS[request.priority] || (request.priority || "").toUpperCase();

    const idBlock = `
      <table class="mini-id">
        <tbody>
          <tr>
            <th>Paciente</th>
            <td colspan="3" class="pid-strong">${escapeHtml(request.patient_name)}</td>
          </tr>
          <tr>
            <th>Setor</th><td>${escapeHtml(sectorName || "—")}</td>
            <th>Leito</th><td>${escapeHtml(request.patient_bed || "—")}</td>
          </tr>
          <tr>
            <th>Prontuário</th><td>${escapeHtml(medicalRecord || "—")}</td>
            <th>Prioridade</th><td><span class="prio-badge" style="${priorityCssLocal}">${escapeHtml(priorityLabelLocal)}</span></td>
          </tr>
          <tr>
            <th>Solicitante</th><td colspan="3">${escapeHtml(request.requested_by_name || "—")}</td>
          </tr>
          ${request.clinical_indication ? `<tr><th>Justificativa</th><td colspan="3" class="just-cell">${escapeHtml(request.clinical_indication)}</td></tr>` : ""}
        </tbody>
      </table>
    `;

    const renderItems = (its: any[], label: string) => {
      const cells = its.map((it, i) => {
        const name = typeof it === "string" ? it : (it?.name || String(it ?? ""));
        return `<div class="req-item-mini"><span class="req-num-mini">${i + 1}.</span><span>${escapeHtml(name)}</span></div>`;
      }).join("");
      return `
        <div class="items-section">
          <div class="items-label">${escapeHtml(label)} (${its.length})</div>
          <div class="items-grid-mini">${cells || '<div class="req-item-mini" style="grid-column:1/-1;color:#64748b">Nenhum item.</div>'}</div>
        </div>
      `;
    };

    const gasoItemsLocal = Array.isArray(request.items) ? request.items : [];

    const oneVia = (viaLabel: string, its: any[], sectionLabel: string) => `
      <div class="via">
        <div class="via-tag">${escapeHtml(viaLabel)}</div>
        ${miniHeader}
        <div class="mini-title">Requisição Laboratorial</div>
        ${idBlock}
        ${renderItems(its, sectionLabel)}
        <div class="mini-sig">
          <div class="mini-sig-line">Médico Solicitante — CRM · Assinatura</div>
          ${request.requested_by_name ? `<div class="mini-sig-name">${escapeHtml(request.requested_by_name)}</div>` : ""}
        </div>
      </div>
    `;

    const duoBody = `
      <div class="duo">
        ${oneVia("1ª via — Coleta (Gasometria)", gasoItemsLocal, gasoLabel)}
        <div class="cut-line"></div>
        ${oneVia("2ª via — Laboratório", otherItems, otherLabel)}
      </div>
    `;

    const duoStyles = `
      .duo { display:grid; grid-template-columns: 1fr 6pt 1fr; gap:0; align-items:start; }
      .duo .cut-line { border-left: 1pt dashed #64748b; margin: 0 3pt; align-self:stretch; min-height: 180mm; }
      .duo .via { padding: 0 4pt; }
      .duo .via-tag { font-size:7pt; font-weight:700; color:#0054A6; text-transform:uppercase; letter-spacing:0.5pt; margin-bottom:2pt; text-align:right; }

      .mini-header { border-bottom: 2pt solid #0054A6; padding-bottom: 3pt; margin-bottom: 4pt; }
      .mini-header-inner { display:grid; grid-template-columns: 34px 1fr; align-items:center; gap:6pt; }
      .mini-logo { height: 32px; width: 32px; object-fit: contain; }
      .mini-h-text { text-align:center; }
      .mini-h-line1, .mini-h-line2 { font-size:5.5pt; font-weight:600; color:#475569; text-transform:uppercase; line-height:1.15; }
      .mini-h-line3 { font-size:7.5pt; font-weight:700; color:#0a1628; margin-top:1pt; line-height:1.15; }
      .mini-cruz-bar { display:flex; height:2.5pt; margin-top:3pt; border-radius:1.5pt; overflow:hidden; }
      .mini-cruz-bar > div { flex:1; }
      .mini-doc-bar { display:flex; justify-content:space-between; background:#f1f5f9; border:0.5pt solid #cbd5e1; padding:2pt 5pt; font-size:6pt; margin-top:3pt; border-radius:2pt; }
      .mini-doc-bar b { color:#0a1628; }
      .mini-title { font-size:9pt; margin:3pt 0 3pt; color:#0a1628; text-align:center; text-transform:uppercase; font-weight:800; letter-spacing:0.3pt; }

      table.mini-id { width:100%; border-collapse:collapse; font-size:7pt; border:0.5pt solid #1e293b; margin-bottom:4pt; }
      table.mini-id th, table.mini-id td { border:0.5pt solid #1e293b; padding:2pt 4pt; color:#0a1628; vertical-align:middle; }
      table.mini-id th { width:18%; font-weight:500; white-space:nowrap; background:#f8fafc; }
      table.mini-id td.pid-strong { font-weight:700; font-size:8pt; }
      table.mini-id td.just-cell { font-size:6.5pt; line-height:1.3; }

      .items-section { margin-bottom:4pt; }
      .items-label { font-size:6.5pt; font-weight:700; text-transform:uppercase; letter-spacing:0.3pt; color:#0054A6; margin-bottom:2pt; }
      .items-grid-mini { display:grid; grid-template-columns: 1fr 1fr; gap:0; border:0.5pt solid #cbd5e1; border-radius:2pt; overflow:hidden; }
      .req-item-mini { display:flex; align-items:center; gap:4pt; padding:2.5pt 5pt; font-size:7pt; border-bottom:0.5pt solid #e2e8f0; border-right:0.5pt solid #e2e8f0; color:#0a1628; }
      .req-item-mini:nth-child(2n) { border-right:none; }
      .req-num-mini { min-width:12pt; font-weight:600; text-align:right; flex-shrink:0; }

      .prio-badge { display:inline-block; padding:1pt 6pt; border-radius:2pt; font-weight:700; font-size:6.5pt; }

      .mini-sig { border-top: 0.5pt solid #0a1628; margin-top:6pt; padding-top:3pt; text-align:center; }
      .mini-sig-line { font-size:7pt; font-weight:600; color:#0a1628; }
      .mini-sig-name { font-size:7.5pt; font-weight:700; margin-top:1pt; }

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

    const duoHtml = buildNormaZeroDocument({
      title: "Requisição Laboratorial — Compacta 2 vias",
      subtitle: `Emitida em ${createdStr} · impressão compacta`,
      sectorLabel: sectorName || "Assistência Hospitalar",
      docCodePrefix: "REQ-LAB",
      bodyHtml: duoBody,
      signatures: [],
      logoDataUrl,
      extraStyles: duoStyles,
      orientation: "landscape",
    });

    const finalDuoHtml = duoHtml.replace("<body>", '<body class="duo-mode">');
    const wDuo = openPrintWindow(finalDuoHtml, "Preparando impressão compacta…");
    if (!wDuo) alert("Permita pop-ups para imprimir.");
    return;
  }
  // ── fim do bloco compactDuo ──

  const html = buildNormaZeroDocument({
    title: `Guia de Requisição — ${categoryLabel}`,
    subtitle: `Solicitada em ${createdStr}`,
    sectorLabel: sectorName || "Assistência Hospitalar",
    docCodePrefix: docPrefix,
    bodyHtml,
    signatures: isParecer
      ? [{ label: "Médico Solicitante", caption: "CRM · Carimbo e assinatura" }]
      : [
          { label: "Médico Solicitante", caption: "CRM · Carimbo e assinatura" },
          { label: "Setor Executor", caption: "Recebimento e execução" },
        ],
    logoDataUrl,
    extraStyles,
  });

  const w = openPrintWindow(html, "Preparando guia de requisição…");
  if (!w) {
    alert("Permita pop-ups para imprimir a guia.");
  }
}
