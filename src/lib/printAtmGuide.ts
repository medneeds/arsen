// Shared printer for the CCIH Antimicrobial Guide (Norma Zero).
// Used both by AntimicrobialGuideDialog (full form) and by AtmStatusDialog
// (reprint of an already validated antibiotic in course).
import { format } from "date-fns";
import { buildNormaZeroDocument, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";

export interface AtmPrintEntry {
  medication: string;
  presentation?: string;
  dose?: string;
  route?: string;
  posology?: string;
  startDate?: string;          // yyyy-MM-dd
  plannedDuration?: string;    // dias
  justification?: string;
  infectionSite?: string;
  cultureCollected?: "sim" | "nao" | "pendente" | string;
  cultureResult?: string;
  previousAntibiotic?: string;
  ccihApproval?: "pendente" | "aprovado" | "restrito" | "negado" | "livre" | "restrito_24h" | "restrito_ccih" | "profilaxia" | string;
  ccihNotes?: string;
}

export interface AtmPrintPatient {
  name: string;
  bed: string;
  record: string;
  age: string;
  sex?: string;
  weight: string;
  allergies: string;
  unit: string;
}

const RESTRICTION_LABEL: Record<string, string> = {
  livre: "Livre",
  restrito_24h: "Restrito (liberar em 24h)",
  restrito_ccih: "Restrito CCIH (aguardar)",
  profilaxia: "Profilaxia (máx 24h)",
  pendente: "Pendente",
  aprovado: "Aprovado",
  restrito: "Restrito",
  negado: "Negado",
};

const esc = (s: string | undefined | null) =>
  (s ?? '—').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildAtmBodyHtml({
  patient, entries, doctorName, doctorCrm, today, reprint = false,
}: {
  patient: AtmPrintPatient;
  entries: AtmPrintEntry[];
  doctorName: string;
  doctorCrm: string;
  today: string;
  reprint?: boolean;
}) {
  return `
    ${reprint ? `<div style="text-align:right;font-size:7pt;color:#b91c1c;font-weight:700;margin-bottom:4px;">2ª VIA / REIMPRESSÃO</div>` : ''}
    <h2 class="nz-section">1. IDENTIFICAÇÃO DO PACIENTE</h2>
    <table class="nz">
      <tbody>
        <tr>
          <th style="width:14%">Paciente</th><td style="width:36%"><strong>${esc(patient.name)}</strong></td>
          <th style="width:10%">Leito</th><td style="width:14%"><strong>${esc(patient.bed)}</strong></td>
          <th style="width:12%">Prontuário</th><td><strong>${esc(patient.record)}</strong></td>
        </tr>
        <tr>
          <th>Idade</th><td>${esc(patient.age)}</td>
          <th>Peso</th><td>${patient.weight ? esc(patient.weight) + 'kg' : '—'}</td>
          <th>Alergias</th>
          <td><strong style="color:${patient.allergies && patient.allergies !== 'NDAM' ? '#dc2626' : 'inherit'}">${esc(patient.allergies || 'NDAM')}</strong></td>
        </tr>
        <tr>
          <th>Data emissão</th><td>${esc(today)}</td>
          <th>Médico</th><td colspan="3">${esc(doctorName)}${doctorCrm ? ` — CRM ${esc(doctorCrm)}` : ''}</td>
        </tr>
      </tbody>
    </table>

    <h2 class="nz-section">2. ANTIMICROBIANOS PRESCRITOS</h2>
    ${entries.map((e, idx) => `
      <div class="atm-block">
        <div class="atm-section">ATM ${idx + 1} · ${esc(e.medication)}</div>
        <table class="nz">
          <tbody>
            <tr>
              <th style="width:14%">Apresentação</th><td colspan="5">${esc(e.presentation)}</td>
            </tr>
            <tr>
              <th>Dose</th><td>${esc(e.dose)}</td>
              <th>Via</th><td>${esc(e.route)}</td>
              <th>Posologia</th><td>${esc(e.posology)}</td>
            </tr>
            <tr>
              <th>Início</th><td>${e.startDate ? format(new Date(e.startDate + 'T12:00:00'), 'dd/MM/yyyy') : '—'}</td>
              <th>Duração prev.</th><td>${e.plannedDuration ? esc(e.plannedDuration) + ' dias' : '—'}</td>
              <th>Classe</th><td>${esc(RESTRICTION_LABEL[e.ccihApproval || ''] || 'Pendente')}</td>
            </tr>
            <tr>
              <th>Sítio Infecção</th><td colspan="3">${esc(e.infectionSite)}</td>
              <th>ATB Prévio</th><td>${esc(e.previousAntibiotic)}</td>
            </tr>
            <tr>
              <th>Cultura</th>
              <td>${e.cultureCollected === 'sim' ? '✓ Sim' : e.cultureCollected === 'pendente' ? '⏳ Pendente' : '✗ Não'}</td>
              <th>Resultado</th><td colspan="3">${esc(e.cultureResult)}</td>
            </tr>
            <tr>
              <th>Justificativa</th>
              <td colspan="5" style="white-space:pre-wrap">${esc(e.justification)}</td>
            </tr>
            ${e.ccihNotes ? `<tr><th>Obs CCIH</th><td colspan="5" style="white-space:pre-wrap">${esc(e.ccihNotes)}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `).join('')}
  `;
}

export async function printAtmGuide({
  patient, entries, doctorName, doctorCrm, hospitalName, reprint = false,
}: {
  patient: AtmPrintPatient;
  entries: AtmPrintEntry[];
  doctorName: string;
  doctorCrm: string;
  hospitalName?: string;
  reprint?: boolean;
}) {
  const valid = entries.filter(e => (e.medication || '').trim());
  if (valid.length === 0) return;
  const today = format(new Date(), "dd/MM/yyyy");
  const logoData = await prepareLogo();
  const html = buildNormaZeroDocument({
    title: reprint ? "GUIA DE USO DE ANTIMICROBIANOS — 2ª VIA" : "GUIA DE USO DE ANTIMICROBIANOS",
    subtitle: hospitalName ? `${hospitalName} — Comissão de Controle de Infecção Hospitalar (CCIH)` : "Comissão de Controle de Infecção Hospitalar (CCIH)",
    sectorLabel: `CCIH · ${patient.unit || 'Unidade'}`,
    hospitalName: hospitalName || '',
    docCodePrefix: "ATM",
    bodyHtml: buildAtmBodyHtml({ patient, entries: valid, doctorName, doctorCrm, today, reprint }),
    signatures: [
      { label: "Médico Prescritor", caption: doctorName ? `${doctorName} — CRM ${doctorCrm || '____'}` : undefined },
      { label: "Farmacêutico Clínico", caption: "CRF: ____________" },
      { label: "CCIH — Aprovação", caption: "Data: ___/___/______" },
    ],
    logoDataUrl: logoData,
    orientation: "portrait",
    extraStyles: `
      .atm-block { margin-bottom: 8px; page-break-inside: avoid; }
      .atm-section { background:#ea580c; color:#fff; font-weight:800; font-size:7.5pt; padding:4px 6px; text-transform:uppercase; letter-spacing:0.5px; }
      .atm-warn { color:#dc2626; font-weight:700; }
    `,
  });
  openPrintWindow(html, reprint ? "Preparando 2ª via Guia ATM…" : "Preparando Guia ATM…");
}
