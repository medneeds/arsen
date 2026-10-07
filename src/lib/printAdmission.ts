import { buildNormaZeroDocument, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";
import { getSectorDisplayLabel } from "@/utils/bedNaming";

export interface AdmissionPrintInput {
  patient: { name: string; bed?: string; sector?: string; age?: string | number };
  identifiers?: {
    prontuario?: string | null;
    atendimento?: string | null;
    socialName?: string | null;
    cpf?: string | null;
    cns?: string | null;
    birthDate?: string | null; // ISO yyyy-mm-dd
    sex?: string | null;
    motherName?: string | null;
    address?: string | null;
    phone?: string | null;
  };
  hospitalName?: string;
  doctorName?: string;
  doctorCrm?: string;
  isUti: boolean;
  hda: string;
  amp?: string;
  muc?: string;
  allergies?: string;
  weight?: string;
  height?: string;
  imc?: { value: string; label: string } | null;
  vitals: { pa?: string; fc?: string; fr?: string; spo2?: string; tax?: string; dx?: string };
  exam: { general?: string; cv?: string; resp?: string; abd?: string; ext?: string; neuro?: string };
  plan: string;
  cidPrimary: string;
  cidSecondary?: string;
  dischargePredictionLabel: string;
  uti?: {
    admissionReason?: string;
    originSector?: string;
    devices?: string;
    culturesAtb?: string;
  };
  sapsPending?: boolean;
}

const row = (k: string, v?: string) =>
  v && v.trim()
    ? `<tr><th style="width:24%">${k}</th><td>${v.replace(/\n/g, "<br/>")}</td></tr>`
    : "";

export async function printAdmissionNormaZero(d: AdmissionPrintInput) {
  const logoDataUrl = await prepareLogo();

  const vitalsLine = [
    d.vitals.pa && `PA ${d.vitals.pa}`,
    d.vitals.fc && `FC ${d.vitals.fc}`,
    d.vitals.fr && `FR ${d.vitals.fr}`,
    d.vitals.spo2 && `SpO₂ ${d.vitals.spo2}`,
    d.vitals.tax && `Tax ${d.vitals.tax}`,
    d.vitals.dx && `Dx ${d.vitals.dx}`,
  ].filter(Boolean).join(" • ") || "—";

  const antrop = [
    d.weight && `Peso ${d.weight} kg`,
    d.height && `Altura ${d.height}`,
    d.imc && `IMC ${d.imc.value} (${d.imc.label})`,
  ].filter(Boolean).join(" • ") || "—";

  const id = d.identifiers || {};
  const birthFmt = id.birthDate
    ? (() => { try { return new Date(id.birthDate + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return id.birthDate; } })()
    : undefined;
  const displayName = id.socialName ? `${d.patient.name} (NOME SOCIAL: ${id.socialName})` : d.patient.name;

  // Cabecalho de identificacao COMPACTO (grade multi-coluna), espelhando o
  // patientHeader de printEvolution/prescricao — aproveita a largura em vez de
  // uma linha por campo (antes ocupava ~13 linhas; agora 5).
  const cellS = "border:0.5px solid #94a3b8;padding:3px 6px;font-size:7.5pt;line-height:1.3;vertical-align:top";
  const labelS = `${cellS};font-weight:700;font-size:6.5pt;background:#f1f5f9;color:#334155;text-transform:uppercase;letter-spacing:0.3px`;
  const idadeSexo = [d.patient.age ? `${d.patient.age}` : null, id.sex || null].filter(Boolean).join(" • ") || "—";

  const bodyHtml = `
    <h2 class="nz-section">Identificação</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:4pt;page-break-inside:avoid">
      <tbody>
        <tr>
          <td style="${labelS}">Paciente</td>
          <td style="${cellS};font-weight:800;font-size:9pt;letter-spacing:-0.01em" colspan="7">${displayName || "—"}</td>
        </tr>
        <tr>
          <td style="${labelS}">Prontuário</td><td style="${cellS};font-weight:700">${id.prontuario || "—"}</td>
          <td style="${labelS}">Atendimento</td><td style="${cellS};font-weight:700">${id.atendimento || "—"}</td>
          <td style="${labelS}">Leito</td><td style="${cellS};font-weight:700">${d.patient.bed || "—"}</td>
          <td style="${labelS}">Setor</td><td style="${cellS}">${getSectorDisplayLabel(d.patient.sector) || "—"}</td>
        </tr>
        <tr>
          <td style="${labelS}">Nascimento</td><td style="${cellS}">${birthFmt || "—"}</td>
          <td style="${labelS}">Idade / Sexo</td><td style="${cellS}">${idadeSexo}</td>
          <td style="${labelS}">CPF</td><td style="${cellS}">${id.cpf || "—"}</td>
          <td style="${labelS}">CNS</td><td style="${cellS}">${id.cns || "—"}</td>
        </tr>
        <tr>
          <td style="${labelS}">Mãe</td><td style="${cellS}" colspan="5">${id.motherName || "—"}</td>
          <td style="${labelS}">Telefone</td><td style="${cellS}">${id.phone || "—"}</td>
        </tr>
        <tr>
          <td style="${labelS}">Endereço</td><td style="${cellS}" colspan="5">${id.address || "—"}</td>
          <td style="${labelS}">Tipo</td><td style="${cellS}">${d.isUti ? "UTI/UCI (D0)" : "Enfermaria (D0)"}</td>
        </tr>
      </tbody>
    </table>

    <h2 class="nz-section">Anamnese</h2>
    <table class="nz">
      ${row("HDA", d.hda)}
      ${row("AMP", d.amp)}
      ${row("MUC", d.muc)}
      ${row("Alergias", d.allergies || "Sem relato")}
    </table>

    <h2 class="nz-section">Antropometria & Sinais Vitais</h2>
    <table class="nz">
      ${row("Antropometria", antrop)}
      ${row("SSVV admissionais", vitalsLine)}
    </table>

    <h2 class="nz-section">Exame Físico</h2>
    <table class="nz">
      ${row("Estado geral", d.exam.general)}
      ${row("Cardiovascular", d.exam.cv)}
      ${row("Respiratório", d.exam.resp)}
      ${row("Abdome", d.exam.abd)}
      ${row("Extremidades", d.exam.ext)}
      ${row("Neurológico", d.exam.neuro)}
    </table>

    <h2 class="nz-section">Diagnóstico (CID-10)</h2>
    <table class="nz">
      ${row("CID primário", d.cidPrimary)}
      ${row("CID secundário", d.cidSecondary)}
    </table>

    <h2 class="nz-section">Plano Terapêutico</h2>
    <table class="nz">
      ${row("Conduta", d.plan)}
      ${row("Previsão de alta", d.dischargePredictionLabel)}
    </table>

    ${d.isUti ? `
      <h2 class="nz-section">Dados Específicos UTI</h2>
      <table class="nz">
        ${row("Motivo internação UTI", d.uti?.admissionReason)}
        ${row("Origem", d.uti?.originSector)}
        ${row("Dispositivos invasivos", d.uti?.devices)}
        ${row("Culturas / ATB", d.uti?.culturesAtb)}
        ${row("Ficha SAPS 3", d.sapsPending ? "PENDENTE — prazo de 24 h declarado em ciência" : "Concluída")}
      </table>
    ` : ""}
  `;

  const html = buildNormaZeroDocument({
    title: "Admissão Hospitalar — D0",
    subtitle: d.isUti ? "UTI / UCI" : "Enfermaria",
    sectorLabel: getSectorDisplayLabel(d.patient.sector) || d.patient.sector || "—",
    hospitalName: d.hospitalName,
    docCodePrefix: "ADM",
    bodyHtml,
    logoDataUrl,
    signatures: [
      { label: d.doctorName || "Médico Assistente", caption: d.doctorCrm ? `CRM ${d.doctorCrm}` : "Carimbo e assinatura" },
    ],
  });

  openPrintWindow(html, "Preparando admissão…");
}
