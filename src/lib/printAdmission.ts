import { buildNormaZeroDocument, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";

export interface AdmissionPrintInput {
  patient: { name: string; bed?: string; sector?: string; age?: string | number };
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
    specialties?: string;
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

  const bodyHtml = `
    <h2 class="nz-section">Identificação</h2>
    <table class="nz">
      ${row("Paciente", d.patient.name)}
      ${row("Leito", d.patient.bed)}
      ${row("Setor", d.patient.sector)}
      ${row("Idade", d.patient.age ? String(d.patient.age) : undefined)}
      ${row("Tipo", d.isUti ? "Admissão UTI/UCI (D0)" : "Admissão Enfermaria (D0)")}
    </table>

    <h2 class="nz-section">Anamnese</h2>
    <table class="nz">
      ${row("HDA", d.hda)}
      ${row("AMP", d.amp)}
      ${row("MUC", d.muc)}
      ${row("Alergias", d.allergies || "Nega")}
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
        ${row("Especialidades em conjunto", d.uti?.specialties)}
        ${row("Ficha SAPS 3", d.sapsPending ? "PENDENTE — prazo de 24 h declarado em ciência" : "Concluída")}
      </table>
    ` : ""}
  `;

  const html = buildNormaZeroDocument({
    title: "Admissão Hospitalar — D0",
    subtitle: d.isUti ? "UTI / UCI" : "Enfermaria",
    sectorLabel: d.patient.sector || "—",
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
