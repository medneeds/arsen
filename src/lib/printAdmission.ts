import { buildNormaZeroDocument, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";
import { stripDischargeDays } from "@/lib/dischargeLabel";
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
  exam: { general?: string; cv?: string; resp?: string; abd?: string; ext?: string; neuro?: string; skin?: string; other?: string };
  plan: string;
  cidPrimary: string;
  cidSecondary?: string;
  dischargePredictionLabel: string;
  hypotheses?: string[];
  complementares?: string;
  /** Especialidades envolvidas — campo livre, impresso antes do Plano. */
  especialidades?: string;
  scales?: {
    glasgowTotal?: number | null;
    glasgowEye?: number | null;
    glasgowVerbal?: number | null;
    glasgowMotor?: number | null;
    sedoanalgesia?: boolean;
    rass?: number | null;
  };
  /** Data de admissao no setor (ISO yyyy-mm-dd ou dd/mm/aaaa). */
  sectorAdmissionDate?: string | null;
  uti?: {
    admissionReason?: string;
    vasoativo?: string;
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

/** Secao com tabela que SOME quando nenhuma linha tem conteudo (oculta vazios). */
const section = (title: string, rowsHtml: string) =>
  rowsHtml.trim()
    ? `<h2 class="nz-section">${title}</h2><table class="nz"><tbody>${rowsHtml}</tbody></table>`
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
  ].filter(Boolean).join(" • ");

  const antrop = [
    d.weight && `Peso ${d.weight} kg`,
    d.height && `Altura ${d.height}`,
    d.imc && `IMC ${d.imc.value} (${d.imc.label})`,
  ].filter(Boolean).join(" • ");

  const id = d.identifiers || {};
  const fmtDateBr = (s?: string | null): string => {
    if (!s) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s).trim());
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    try { return new Date(s).toLocaleDateString("pt-BR"); } catch { return String(s); }
  };
  const birthFmt = fmtDateBr(id.birthDate);
  const sectorAdmFmt = fmtDateBr(d.sectorAdmissionDate);

  // Hipoteses diagnosticas (lista) e escala neurologica (Glasgow OU RASS).
  const hypothesesRows = (d.hypotheses || [])
    .map((h) => (h || "").trim()).filter(Boolean)
    .map((h, i) => `<tr><th style="width:24%">${i === 0 ? "Hipoteses" : ""}</th><td>${h.replace(/\n/g, "<br/>")}</td></tr>`)
    .join("");
  const sc = d.scales;
  const scalesStr = sc
    ? (sc.sedoanalgesia && sc.rass != null
        ? `RASS ${sc.rass > 0 ? `+${sc.rass}` : sc.rass}`
        : sc.glasgowTotal != null
          ? `Glasgow ${sc.glasgowTotal}/15 (O${sc.glasgowEye ?? "—"} V${sc.glasgowVerbal ?? "—"} M${sc.glasgowMotor ?? "—"})`
          : "")
    : "";

  // A identificacao do paciente vive no cabecalho padronizado (modelo assistencial
  // com cadastro completo — a admissao e o documento de cadastro clinico).
  const bodyHtml = `
    ${section("Diagnóstico (CID-10)", row("CID primário", d.cidPrimary) + row("CID secundário", d.cidSecondary))}
    ${section("Hipóteses diagnósticas", hypothesesRows)}
    ${section("História admissional (HDA)", row("HDA", d.hda))}
    ${section("Antecedentes (AMP)", row("Antecedentes", d.amp))}
    ${section("Medicações de uso contínuo (MUC)", row("Medicações", d.muc))}
    ${section("Alergias", row("Alergias", d.allergies || "Sem relato"))}
    ${section("Sinais vitais", row("SSVV admissionais", vitalsLine))}
    ${section("Antropometria", row("Antropometria", antrop))}
    ${section("Exame físico",
      row("Estado geral", d.exam.general) + row("Cardiovascular", d.exam.cv) + row("Respiratório", d.exam.resp) +
      row("Abdome", d.exam.abd) + row("Extremidades", d.exam.ext) + row("Neurológico", d.exam.neuro) + row("Pele / Feridas", d.exam.skin) + row("Outros", d.exam.other))}
    ${section("Escalas", row("Escala neurológica", scalesStr))}
    ${section("Exames complementares", row("Complementares", d.complementares))}
    ${section("Especialidades", row("Especialidades", d.especialidades))}
    ${section("Plano terapêutico", row("Conduta", d.plan))}
    ${section("Previsão de alta", row("Previsão de alta", stripDischargeDays(d.dischargePredictionLabel)))}
    ${d.isUti ? section("Justificativa de admissão (UTI/UCI)", row("Motivo", d.uti?.admissionReason) + row("Droga vasoativa", d.uti?.vasoativo)) : ""}
    ${d.isUti ? section("Dispositivos invasivos", row("Dispositivos", d.uti?.devices)) : ""}
    ${d.isUti ? section("Culturas / Antibióticos", row("Culturas / ATB", d.uti?.culturesAtb)) : ""}
    ${d.isUti ? section("Dados complementares", row("Origem", d.uti?.originSector) + row("Ficha SAPS 3", d.sapsPending ? "PENDENTE — prazo de 24 h declarado em ciência" : "Concluída")) : ""}
  `;

  const html = buildNormaZeroDocument({
    title: "Admissão Hospitalar",
    standardHeader: {
      model: "assistencial",
      includeRegistry: true,
      title: "Admissão hospitalar",
      complement: d.isUti ? "UTI / UCI" : "Enfermaria",
      emission: "",
      patient: {
        name: (d.patient.name || "").toUpperCase(),
        socialName: id.socialName,
        bed: d.patient.bed,
        sector: getSectorDisplayLabel(d.patient.sector) || undefined,
        record: id.prontuario,
        atendimento: id.atendimento,
        birthDate: birthFmt,
        age: d.patient.age != null ? String(d.patient.age) : undefined,
        sex: id.sex,
        weight: d.weight ? `${d.weight}kg` : undefined,
        sectorAdmission: sectorAdmFmt,
        allergies: d.allergies,
        motherName: id.motherName,
        cpf: id.cpf,
        cns: id.cns,
        phone: id.phone,
        address: id.address,
      },
    },
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
