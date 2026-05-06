// ── Discharge / Death document utilities (Norma Zero PDF) ──
// Reaproveitado tanto na geração da movimentação quanto pelo histórico do paciente.

export type DischargeDocType = "alta_hospitalar" | "alta_pedido" | "obito";

export const DISCHARGE_DOC_LABELS: Record<DischargeDocType, string> = {
  alta_hospitalar: "Sumário de Alta Hospitalar",
  alta_pedido: "Termo de Alta a Pedido",
  obito: "Relatório de Óbito",
};

export const DISCHARGE_DOC_SHORT: Record<DischargeDocType, string> = {
  alta_hospitalar: "Sumário de Alta",
  alta_pedido: "Alta a Pedido",
  obito: "Relatório de Óbito",
};

export interface DischargeDocPayload {
  // Identification
  patient_name: string;
  patient_bed?: string;
  patient_sector?: string;
  patient_birth_date?: string;
  patient_record?: string;
  encounter_code?: string;
  hospital_name?: string;
  hospital_address?: string;
  // Stay
  admission_date?: string;
  discharge_date?: string;
  // Clinical
  admission_diagnosis?: string;
  final_diagnoses?: string;
  evolution_summary?: string;
  procedures?: string;
  complications?: string;
  // Discharge specifics
  discharge_type?: string;
  discharge_summary?: string;
  orientations?: string;
  return_date?: string;
  return_specialty?: string;
  restrictions?: string;
  prescription?: string;
  referral?: string;
  // Death specifics
  death_date_time?: string;
  death_place?: string;
  death_summary?: string; // relatório livre do óbito (substitui causa mortis estruturada)
  immediate_cause?: string;
  intermediate_causes?: string;
  basic_cause?: string;
  contributing_causes?: string;
  death_type?: string; // natural/violenta
  necropsy?: string;
  do_number?: string; // Declaração de Óbito
  notified_family?: string;
  // Comunicação à família (alta e óbito)
  family_contact_name?: string;
  family_contact_relation?: string; // grau de parentesco
  family_contact_phone?: string;
  family_contact_email?: string;
  family_communication_mode?: string; // presencial / telefone / videochamada
  family_communication_at?: string; // datetime-local
  family_communication_by?: string; // profissional que comunicou
  family_satisfaction?: string; // 1..5
  family_communication_notes?: string;
  // Sign
  signed_by_name?: string;
  signed_by_crm?: string;
  signed_at?: string;
}

const escapeHtml = (s?: string | null) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const block = (label: string, value?: string) => {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return `<div class="block"><div class="lb">${escapeHtml(label)}</div><div class="vl">${escapeHtml(v).replace(/\n/g, "<br/>")}</div></div>`;
};

export function buildDischargeDocHTML(type: DischargeDocType, p: DischargeDocPayload): string {
  const title = DISCHARGE_DOC_LABELS[type];
  const isDeath = type === "obito";

  const headerHospital = `
    <div class="hosp">
      <div class="hosp-name">${escapeHtml(p.hospital_name || "")}</div>
      <div class="hosp-addr">${escapeHtml(p.hospital_address || "")}</div>
    </div>`;

  const idGrid = `
    <div class="grid">
      <div><span class="k">Paciente:</span> <b>${escapeHtml(p.patient_name)}</b></div>
      <div><span class="k">Prontuário:</span> ${escapeHtml(p.patient_record || "—")}</div>
      <div><span class="k">Atendimento:</span> ${escapeHtml(p.encounter_code || "—")}</div>
      <div><span class="k">Leito/Setor:</span> ${escapeHtml(`${p.patient_bed || "—"} • ${p.patient_sector || "—"}`)}</div>
      <div><span class="k">Nascimento:</span> ${escapeHtml(p.patient_birth_date || "—")}</div>
      <div><span class="k">Admissão:</span> ${escapeHtml(fmtDate(p.admission_date))}</div>
      <div><span class="k">${isDeath ? "Data/Hora do Óbito" : "Alta"}:</span> ${escapeHtml(fmtDate(isDeath ? p.death_date_time : p.discharge_date))}</div>
      ${isDeath ? `<div><span class="k">Local do óbito:</span> ${escapeHtml(p.death_place || "—")}</div>` : `<div><span class="k">Tipo de alta:</span> ${escapeHtml(p.discharge_type || "—")}</div>`}
    </div>`;

  const clinicalCommon = `
    ${block("Diagnóstico de admissão", p.admission_diagnosis)}
    ${block(isDeath ? "Diagnósticos finais" : "Diagnósticos finais (CID e descrição)", p.final_diagnoses)}
    ${block("Resumo da evolução / quadro clínico", p.evolution_summary)}
    ${block("Procedimentos realizados", p.procedures)}
    ${block("Intercorrências / complicações", p.complications)}
  `;

  const dischargeBlocks = `
    ${block("Sumário de alta", p.discharge_summary)}
    ${block("Plano e orientações de alta", p.orientations)}
    ${block("Prescrição de alta", p.prescription)}
    ${block("Restrições", p.restrictions)}
    ${block("Retorno / contrarreferência", [p.return_date, p.return_specialty, p.referral].filter(Boolean).join(" • "))}
  `;

  const deathBlocks = `
    ${block("Causa imediata da morte (Parte I-a)", p.immediate_cause)}
    ${block("Causas intermediárias (Parte I-b/c)", p.intermediate_causes)}
    ${block("Causa básica (Parte I-d)", p.basic_cause)}
    ${block("Causas contribuintes (Parte II)", p.contributing_causes)}
    ${block("Tipo de morte", p.death_type)}
    ${block("Necropsia", p.necropsy)}
    ${block("Declaração de Óbito (nº)", p.do_number)}
  `;

  const satLabel = (s?: string) => {
    const m: Record<string, string> = {
      "1": "1 — Muito insatisfeito",
      "2": "2 — Insatisfeito",
      "3": "3 — Neutro",
      "4": "4 — Satisfeito",
      "5": "5 — Muito satisfeito",
    };
    return s ? m[s] || s : "";
  };

  const familyBlocks = `
    ${block("Familiar comunicado", [p.family_contact_name, p.family_contact_relation].filter(Boolean).join(" — "))}
    ${block("Contato do familiar", [p.family_contact_phone, p.family_contact_email].filter(Boolean).join(" • "))}
    ${block("Modo da comunicação", p.family_communication_mode)}
    ${block("Comunicado por / em", [p.family_communication_by, fmtDate(p.family_communication_at)].filter(Boolean).join(" • "))}
    ${block("Grau de satisfação na comunicação médica", satLabel(p.family_satisfaction))}
    ${block("Observações da comunicação", p.family_communication_notes)}
  `;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
  <title>${escapeHtml(title)} - ${escapeHtml(p.patient_name)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; font-size: 9pt; line-height: 1.35; }
    .doc { padding: 0; }
    .hosp { text-align: center; border-bottom: 1.5px solid #111; padding-bottom: 4mm; margin-bottom: 4mm; }
    .hosp-name { font-weight: 700; font-size: 11pt; text-transform: uppercase; letter-spacing: 0.5px; }
    .hosp-addr { font-size: 7.5pt; color: #444; margin-top: 1mm; }
    h1.title { font-size: 12pt; text-align: center; margin: 2mm 0 4mm; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #111; padding: 2mm; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 6mm; margin-bottom: 4mm; padding: 2mm 3mm; border: 0.5px solid #999; background: #fafafa; }
    .grid > div { font-size: 8.5pt; }
    .k { color: #555; text-transform: uppercase; font-size: 7pt; letter-spacing: 0.4px; }
    .block { margin-bottom: 3mm; page-break-inside: avoid; }
    .lb { font-weight: 700; text-transform: uppercase; font-size: 8pt; letter-spacing: 0.4px; border-bottom: 0.5px solid #111; padding-bottom: 0.8mm; margin-bottom: 1.2mm; }
    .vl { font-size: 8.5pt; white-space: pre-wrap; }
    .sign { margin-top: 14mm; text-align: center; }
    .sign .line { width: 70mm; border-top: 0.6px solid #111; margin: 0 auto 1.5mm; }
    .sign .name { font-weight: 700; font-size: 9pt; text-transform: uppercase; }
    .sign .crm { font-size: 8pt; color: #444; }
    .meta { margin-top: 6mm; text-align: center; font-size: 7pt; color: #666; border-top: 0.5px dashed #999; padding-top: 2mm; }
    .footer-doc { position: fixed; bottom: 6mm; left: 12mm; right: 12mm; font-size: 6.5pt; color: #888; display: flex; justify-content: space-between; }
  </style></head>
  <body><div class="doc">
    ${headerHospital}
    <h1 class="title">${escapeHtml(title)}</h1>
    ${idGrid}
    ${clinicalCommon}
    ${isDeath ? deathBlocks : dischargeBlocks}
    ${familyBlocks}
    <div class="sign">
      <div class="line"></div>
      <div class="name">${escapeHtml(p.signed_by_name || "—")}</div>
      <div class="crm">CRM: ${escapeHtml(p.signed_by_crm || "—")}</div>
      <div class="crm">${escapeHtml(fmtDate(p.signed_at))}</div>
    </div>
    <div class="meta">Documento gerado eletronicamente conforme Norma Zero • ${escapeHtml(fmtDate(new Date().toISOString()))}</div>
    <div class="footer-doc"><span>${escapeHtml(title)}</span><span>${escapeHtml(p.patient_name)}</span></div>
  </div></body></html>`;
}

export function printDischargeDocument(type: DischargeDocType, payload: DischargeDocPayload) {
  const html = buildDischargeDocHTML(type, payload);
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    try { w.focus(); w.print(); } catch {}
  }, 250);
}
