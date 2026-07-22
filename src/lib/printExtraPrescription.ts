/**
 * Impressão isolada de Prescrição Extra (anexo) no padrão Norma Zero.
 * Layout em 3 colunas (Nº | Descrição rica | Aprazamento) — espelha o corpo
 * principal da prescrição, respeitando particularidades de cada categoria
 * (medicação IV, hidratação, MAV/Port.344, inalação, nutrição, cuidados,
 * insulinoterapia agrupada com sub-linhas para enfermagem).
 */
import { buildNormaZeroDocument, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";
import { buildSolutoTokenLabeled, buildPrepSegments } from "@/lib/solutoToken";
import { buildNutritionParts, buildHydrationLine } from "@/lib/nutritionHydration";
import { assembleInhalationInstruction } from "@/lib/inhalationInstruction";
import { describeInsulinPlan, type InsulinPlan } from "@/lib/insulinTherapy";


export interface ExtraPrintItem {
  id: string;
  name: string;
  presentation?: string;
  dose: string;
  route: string;
  posology: string;
  schedule?: string;
  instructions?: string;
  flags?: readonly string[];
  highAlert?: boolean;
  category?: string;
  // Regulatório
  securityCategory?: 'MAV' | 'PORT_344' | 'MAV_PORT_344';
  controlled?: boolean;
  controlledList?: 'A1' | 'A2' | 'A3' | 'B1' | 'B2' | 'C1' | null;
  doubleCheck?: boolean;
  // Quantidade & preparo
  quantity?: string;
  quantityUnit?: string;
  diluent?: string;
  diluentVolume?: string;
  accessType?: string;
  infusionTime?: string;
  infusionTimeUnit?: 'min' | 'h';
  infusionMode?: 'BIC' | 'gts';
  infusionRate?: string;
  volumeTotal?: string;
  reconstitutionSolvent?: string;
  reconstitutionVolume?: string;
  concentration?: string;
  // Inalação
  inhalationMode?: string;
  nebDose?: string;
  nebDoseUnit?: string;
  oxygenFlow?: string;
  stageDuration?: string;
  continuousDuration?: string;
  inhalationInterface?: string;
  puffs?: string;
  spacer?: boolean;
  gargle?: boolean;
  inhalationOrientation?: string;
  // Nutrição
  nutVolDay?: string;
  nutMode?: string;
  nutFraction?: string;
  nutNightPause?: string;
  nutBedHead?: string;
  nutAccess?: string;
  nutComposition?: string;
  nutMonitoring?: string;
  nutResidualCheck?: string;
  nutWaterVolPerAdmin?: string;
  nutWaterFreq?: string;
  nutZeroReason?: string;
  // Nutrição — campos novos (sync com tela compacta)
  dietType?: string;
  dietProfile?: string;
  dietInterval?: string;
  nutScheduleMode?: 'interval' | 'steps';
  nutSteps?: string;
  nutRateMode?: 'mlh' | 'gtt';
  nutProgression?: string;
  nutConsistency?: string;
  nutManual?: boolean;
  // Insulinoterapia
  insulinPlan?: InsulinPlan;
  // IV
  ivBolus?: boolean;
}

export interface ExtraPrintPatient {
  name: string;
  bed?: string;
  unit?: string;
  age?: string;
  record?: string;
  weight?: string;
  allergies?: string;
}

export interface ExtraPrintOptions {
  patient: ExtraPrintPatient;
  items: ExtraPrintItem[];
  parentPrescriptionId?: string | null;
  parentPrescriptionVersion?: number | null;
  hospitalName?: string;
  sectorLabel?: string;
  doctorName?: string;
  doctorCrm?: string;
  categoryLabel?: string;
}

const escape = (s: string | undefined | null) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

function regulatoryChip(it: ExtraPrintItem): string {
  const sec = it.securityCategory;
  if (sec === 'MAV_PORT_344') {
    const tail = it.controlledList ? ` · ${it.controlledList}` : '';
    return `<span style="display:inline-block;background:#7e22ce;color:#fff;font-size:6pt;font-weight:800;padding:0.5pt 4pt;border-radius:2pt;margin-right:4pt;letter-spacing:0.3pt">MAV + PORT.344${tail}</span>`;
  }
  if (sec === 'MAV' || (it.highAlert && sec !== 'PORT_344')) {
    return `<span style="display:inline-block;background:#991b1b;color:#fff;font-size:6pt;font-weight:800;padding:0.5pt 4pt;border-radius:2pt;margin-right:4pt;letter-spacing:0.3pt">MAV</span>`;
  }
  if (sec === 'PORT_344' || it.controlled) {
    const tail = it.controlledList ? ` · ${it.controlledList}` : '';
    return `<span style="display:inline-block;background:#1d4ed8;color:#fff;font-size:6pt;font-weight:800;padding:0.5pt 4pt;border-radius:2pt;margin-right:4pt;letter-spacing:0.3pt">PORT.344${tail}</span>`;
  }
  return '';
}

const SEP = `<span style="color:#94a3b8;margin:0 3pt">|</span>`;

function buildLine2(it: ExtraPrintItem): string {
  // Insulinoterapia — bloco especial preservado (não é IV padrão)
  if (it.insulinPlan) return '';

  const isInhalation = it.category === 'inhalation';
  const isNutrition = it.category === 'nutrition';
  const isHydration = it.category === 'hydration';

  if (isInhalation) {
    // Fonte única (assembleInhalationInstruction) — MESMA frase clínica da
    // tela e do impresso principal. A lógica própria anterior era empobrecida:
    // ignorava nebDose/nebDoseUnit, a diluição da nebulização
    // (diluent+diluentVolume), stageDuration, inhalationInterface, puffs,
    // continuousDuration e inhalationOrientation — um item configurado no
    // wizard saía completo no impresso principal e capenga no anexo extra.
    const phrase = assembleInhalationInstruction(it as any);
    const parts = [
      phrase ? escape(phrase) : null,
      it.posology && it.posology !== '-' ? escape(it.posology) : null,
    ].filter(Boolean);
    if (!parts.length) return '';
    return `<div style="font-size:8pt;color:#444;line-height:1.4;margin-top:2pt">${parts.join(` ${SEP} `)}</div>`;
  }

  if (isNutrition) {
    // Fonte única (buildNutritionParts) — mesmos campos e rótulos da tela
    // compacta e do impresso principal. A lógica própria anterior tinha só 9
    // campos (faltavam nutFraction, nutNightPause, nutComposition,
    // nutMonitoring, nutResidualCheck, nutWaterVolPerAdmin, nutWaterFreq,
    // nutConsistency e nutProgression) e rótulos divergentes.
    const parts = buildNutritionParts(it).map(escape);
    if (!parts.length) return '';
    return `<div style="font-size:8pt;color:#444;line-height:1.4;margin-top:2pt">${parts.join(` ${SEP} `)}</div>`;
  }

  if (isHydration) {
    // Fonte única (buildHydrationLine) — fases + vazão + total/24h (balanço
    // hídrico), mesma frase da tela compacta e do impresso principal.
    const line = buildHydrationLine(it);
    const parts = [
      line ? escape(line) : null,
      it.route && it.route !== '-' ? escape(it.route) : null,
    ].filter(Boolean);
    if (!parts.length) return '';
    return `<div style="font-size:8pt;color:#444;line-height:1.4;margin-top:2pt">${parts.join(` ${SEP} `)}</div>`;
  }

  // Medicação / Hidratação / ATB / High Alert — campos explícitos, SEM frases automáticas
  // NOVA ORDEM (raciocínio do médico): DOSE · Dil. · Vol. · Via · Acesso · Intervalo · Modo · Tempo · Vazão
  // Detalhamento de preparo/infusão (reconstituição, diluente, volume, modo,
  // tempo, vazão) vem de buildPrepSegments — MESMA função do impresso
  // principal (unificado 21/07/2026, ver src/lib/solutoToken.ts). A extra só
  // intercala dose/via/acesso/posologia entre head e tail, e escapa o HTML.
  const parts: string[] = [];
  const { head, tail } = buildPrepSegments({
    category: it.category,
    route: it.route,
    diluent: it.diluent,
    diluentVolume: it.diluentVolume,
    volumeTotal: it.volumeTotal,
    quantity: it.quantity,
    accessType: it.accessType,
    posology: it.posology,
    infusionMode: it.infusionMode,
    infusionTime: it.infusionTime,
    infusionTimeUnit: it.infusionTimeUnit,
    infusionRate: it.infusionRate,
    ivBolus: it.ivBolus,
    reconstitutionSolvent: it.reconstitutionSolvent,
    reconstitutionVolume: it.reconstitutionVolume,
  });

  // head começa com a reconstituição (quando houver) — ela vem ANTES da dose.
  const reconSeg = head.find((h) => h.startsWith('Reconstituir'));
  const headNoRecon = head.filter((h) => !h.startsWith('Reconstituir'));
  if (reconSeg) parts.push(escape(reconSeg));

  // Dose — combina quantity+quantityUnit+dose (buildSolutoTokenLabeled).
  const soluto = buildSolutoTokenLabeled({ quantity: it.quantity, quantityUnit: it.quantityUnit, dose: it.dose });
  if (soluto) parts.push(escape(soluto));

  // Diluente + Volume (restante do head, após a dose)
  headNoRecon.forEach((h) => parts.push(escape(h)));

  // Via
  if (it.route && it.route !== '-') parts.push(escape(it.route));
  // Acesso (só quando preenchido)
  if (it.accessType && it.accessType !== '-') parts.push(escape(it.accessType));
  // Intervalo / posologia
  if (it.posology && it.posology !== '-') parts.push(escape(it.posology));

  // Modo (BIC/Bolus) + Tempo + Vazão — restante do tail.
  tail.forEach((t) => parts.push(escape(t)));

  if (!parts.length) return '';
  return `<div style="font-size:8pt;color:#444;line-height:1.4;margin-top:2pt">${parts.join(` ${SEP} `)}</div>`;
}

export async function printExtraPrescription(opts: ExtraPrintOptions) {
  const {
    patient,
    items,
    parentPrescriptionId,
    parentPrescriptionVersion,
    hospitalName,
    sectorLabel = "Prescrição Médica — Anexo Extra",
    doctorName,
    doctorCrm,
    categoryLabel,
  } = opts;

  const logoDataUrl = await prepareLogo();

  const itemsHtml = items.length
    ? items
        .map((it, idx) => {
          const flagsChip = (it.flags || []).length
            ? `<span style="background:#334155;color:#fff;font-size:6pt;font-weight:700;padding:0.5pt 4pt;border-radius:2pt;margin-left:4pt;letter-spacing:0.3pt">${escape((it.flags || []).join(', ').toUpperCase())}</span>`
            : '';
          return `
        <tr style="page-break-inside:avoid">
          <td style="border:0.5pt solid #cbd5e1;width:22pt;text-align:center;vertical-align:top;font-weight:800;font-size:7.5pt;color:#0f172a;padding:3pt 0;background:${idx % 2 === 0 ? '#fff' : '#fafbfc'}">${idx + 1}</td>
          <td style="border:0.5pt solid #cbd5e1;padding:3pt 6pt;vertical-align:top;background:${idx % 2 === 0 ? '#fff' : '#fafbfc'}">
            <div style="font-size:9pt;font-weight:bold;color:#0f172a;line-height:1.4">
              ${regulatoryChip(it)}
              ${it.doubleCheck ? '<span style="display:inline-block;background:#0f172a;color:#fff;font-size:5.5pt;font-weight:800;padding:0.5pt 3pt;border-radius:2pt;margin-right:4pt;letter-spacing:0.3pt">2x CHECK</span>' : ''}
              ${escape(it.name)}
              ${it.presentation && it.presentation !== '-' ? `<span style="color:#334155;font-weight:500;font-size:8pt"> (${escape(it.presentation)})</span>` : ''}
              ${it.concentration ? `<span style="color:#334155;font-weight:500"> — ${escape(it.concentration)}</span>` : ''}
              <span style="background:#fff7ed;color:#9a3412;font-size:5.5pt;font-weight:800;padding:0.5pt 4pt;border-radius:2pt;margin-left:4pt;border:0.5pt solid #fdba74;letter-spacing:0.3pt">EXTRA</span>
              ${flagsChip}
            </div>
            ${buildLine2(it)}
            ${it.insulinPlan ? (() => {
              const insulinDesc = describeInsulinPlan(it.insulinPlan!);
              const lines = insulinDesc.lines.map(ln =>
                `<div style="font-weight:${ln.startsWith('  •') ? 500 : 600};padding-left:${ln.startsWith('  •') ? '6pt' : 0}">${escape(ln.replace(/^  •\s*/, '• '))}</div>`
              ).join('');
              return `<div style="font-size:7pt;color:#1e293b;line-height:1.3;margin-top:3pt;padding:3pt 6pt 3pt 8pt;border-left:2pt solid #991b1b;background:#fef2f2;border-radius:0 2pt 2pt 0"><div style="font-weight:800;font-size:7pt;color:#991b1b;text-transform:uppercase;letter-spacing:0.3pt;margin-bottom:1pt">${escape(insulinDesc.headline)}</div>${lines}</div>`;
            })() : ''}
            ${it.insulinPlan ? '' : (it.instructions ? `<div style="font-size:8pt;font-style:italic;color:#444;line-height:1.4;margin-top:2pt">Recomendações: ${escape(it.instructions)}</div>` : '')}
          </td>
          <td style="border:0.5pt solid #cbd5e1;width:170pt;vertical-align:top;background:#fff;padding:4pt 6pt">
            <div style="font-size:6.5pt;color:#94a3b8;font-weight:700;letter-spacing:0.3pt;text-transform:uppercase;margin-bottom:2pt">Aprazamento ${it.schedule ? `· ${escape(it.schedule)}` : ''}</div>
            <div style="min-height:32pt"></div>
          </td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="3" class="nz-empty">Nenhum item extra para imprimir</td></tr>`;

  const parentRef = parentPrescriptionId
    ? `Anexo à prescrição #${parentPrescriptionId.slice(0, 8).toUpperCase()}${parentPrescriptionVersion ? ` (v${parentPrescriptionVersion})` : ""}`
    : "Anexo avulso (sem prescrição diária vinculada)";

  const bodyHtml = `
    <table class="nz" style="margin-bottom:8pt;border:1pt solid #e2e8f0;border-radius:3pt;overflow:hidden">
      <tr>
        <th style="width:25%">Paciente</th>
        <td>${escape(patient.name) || "—"}</td>
        <th style="width:15%">Leito</th>
        <td>${escape(patient.bed) || "—"}</td>
      </tr>
      <tr>
        <th>Idade</th>
        <td>${escape(patient.age) || "—"}</td>
        <th>Peso</th>
        <td>${escape(patient.weight) || "—"}</td>
      </tr>
      <tr>
        <th>Prontuário</th>
        <td>${escape(patient.record) || "—"}</td>
        <th>Alergias</th>
        <td style="${patient.allergies ? "color:#b91c1c;font-weight:600" : ""}">${escape(patient.allergies) || "Nega"}</td>
      </tr>
      <tr>
        <th>Vínculo</th>
        <td colspan="3" style="font-weight:600;color:#0054A6">${escape(parentRef)}</td>
      </tr>
      ${categoryLabel ? `<tr><th>Tipo</th><td colspan="3"><span style="background:#fff7ed;color:#9a3412;font-size:8pt;font-weight:700;padding:1pt 6pt;border-radius:3pt;border:0.5pt solid #fdba74">${escape(categoryLabel)}</span></td></tr>` : ""}
    </table>

    <h2 class="nz-section">Itens Extras Prescritos (${items.length})</h2>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th style="background:#0c4a6e;color:#fff;padding:5pt 6pt;font-size:6.5pt;font-weight:700;text-align:center;letter-spacing:0.5pt;border:0.5pt solid #0c4a6e;width:22pt">Nº</th>
          <th style="background:#0c4a6e;color:#fff;padding:5pt 6pt;font-size:7pt;font-weight:700;text-align:left;letter-spacing:0.5pt;border:0.5pt solid #0c4a6e">Descrição / Preparo / Sinalizações</th>
          <th style="background:#0c4a6e;color:#fff;padding:5pt 6pt;font-size:6.5pt;font-weight:700;text-align:center;letter-spacing:0.5pt;border:0.5pt solid #0c4a6e;width:170pt">Aprazamento / Checagem</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div style="margin-top:10pt;padding:6pt 8pt;background:#fefce8;border:0.5pt solid #fde68a;border-radius:3pt;font-size:8pt;color:#713f12">
      <b>OBSERVAÇÃO:</b> Esta folha é um <b>ANEXO</b> à prescrição médica diária do paciente.
      Itens marcados como "Agora" não são renovados automaticamente; itens com aprazamento
      são incorporados à rotina na próxima renovação.
    </div>
  `;

  const html = buildNormaZeroDocument({
    title: "Prescrição Extra — Anexo",
    subtitle: categoryLabel || "Itens avulsos do plantão",
    sectorLabel,
    hospitalName,
    docCodePrefix: "PRESC-EXT",
    bodyHtml,
    patientFooterInfo: {
      name: patient.name || undefined,
      age: patient.age || undefined,
      bed: patient.bed || undefined,
      record: patient.record || undefined,
    },
    signatures: [
      {
        label: doctorName ? `Dr(a). ${doctorName}` : "Médico Responsável",
        caption: doctorCrm ? `CRM ${doctorCrm}` : "Carimbo e assinatura",
      },
      { label: "Enfermagem — Conferência", caption: "Visto e horário" },
    ],
    logoDataUrl,
    orientation: "portrait",
  });

  openPrintWindow(html, "Preparando prescrição extra…");
}
