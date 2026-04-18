// Biblioteca de doses peso-dependentes (mg/kg/dia ou mcg/kg/min) para medicamentos críticos.
// Valores de referência clínica — sempre validar com farmácia/protocolos institucionais.

export interface WeightBasedDose {
  name: string; // chave normalizada (lowercase, sem acento)
  display: string; // nome de exibição
  category: "antimicrobial" | "vasoactive" | "sedation" | "analgesia" | "anticoagulant" | "other";
  unit: "mg" | "mcg" | "UI" | "g";
  // Modo de cálculo
  mode: "mg_per_kg_dose" | "mg_per_kg_day" | "mcg_per_kg_min" | "UI_per_kg_dose" | "UI_per_kg_h";
  // Faixas de dose
  doseMin: number;
  doseMax: number;
  doseUsual?: number;
  // Frequência (para mg/kg/dia → divisões diárias)
  defaultFrequency?: number; // doses/dia
  frequencyOptions?: number[]; // ex.: [2, 3, 4]
  // Diluição padrão sugerida
  defaultRoute?: string;
  defaultDiluent?: string;
  defaultDiluentVolume?: string; // mL
  defaultInfusionTime?: string;
  // Limites de segurança
  maxDailyDose?: number; // em mg ou mcg
  maxSingleDose?: number;
  // Notas clínicas
  clinicalNote?: string;
  // Ajuste por função renal
  renalAdjust?: boolean;
}

export const WEIGHT_BASED_DOSES: WeightBasedDose[] = [
  // ===== Antimicrobianos =====
  {
    name: "vancomicina",
    display: "Vancomicina",
    category: "antimicrobial",
    unit: "mg",
    mode: "mg_per_kg_dose",
    doseMin: 15,
    doseMax: 20,
    doseUsual: 15,
    defaultFrequency: 2,
    frequencyOptions: [2, 3, 4],
    defaultRoute: "EV",
    defaultDiluent: "SF 0,9%",
    defaultDiluentVolume: "250",
    defaultInfusionTime: "60min",
    maxSingleDose: 2000,
    maxDailyDose: 4000,
    clinicalNote: "Dose-alvo 15–20 mg/kg/dose (peso real). Monitorar vale 15–20 µg/mL.",
    renalAdjust: true,
  },
  {
    name: "meropenem",
    display: "Meropenem",
    category: "antimicrobial",
    unit: "mg",
    mode: "mg_per_kg_dose",
    doseMin: 20,
    doseMax: 40,
    doseUsual: 20,
    defaultFrequency: 3,
    frequencyOptions: [3, 4],
    defaultRoute: "EV",
    defaultDiluent: "SF 0,9%",
    defaultDiluentVolume: "100",
    defaultInfusionTime: "30min (até 3h em sepse grave)",
    maxSingleDose: 2000,
    maxDailyDose: 6000,
    clinicalNote: "Sepse grave/SNC: 40 mg/kg/dose 8/8h. Considerar infusão estendida.",
    renalAdjust: true,
  },
  {
    name: "piperacilina/tazobactam",
    display: "Piperacilina/Tazobactam",
    category: "antimicrobial",
    unit: "mg",
    mode: "mg_per_kg_dose",
    doseMin: 80,
    doseMax: 100,
    doseUsual: 90,
    defaultFrequency: 4,
    frequencyOptions: [3, 4],
    defaultRoute: "EV",
    defaultDiluent: "SF 0,9%",
    defaultDiluentVolume: "100",
    defaultInfusionTime: "30min (ou estendida 4h)",
    maxSingleDose: 4500,
    maxDailyDose: 18000,
    clinicalNote: "Componente piperacilina. 4,5g é a apresentação habitual.",
    renalAdjust: true,
  },
  {
    name: "cefepime",
    display: "Cefepime",
    category: "antimicrobial",
    unit: "mg",
    mode: "mg_per_kg_dose",
    doseMin: 30,
    doseMax: 50,
    doseUsual: 30,
    defaultFrequency: 3,
    frequencyOptions: [2, 3],
    defaultRoute: "EV",
    defaultDiluent: "SF 0,9%",
    defaultDiluentVolume: "100",
    defaultInfusionTime: "30min",
    maxSingleDose: 2000,
    maxDailyDose: 6000,
    clinicalNote: "Neutropenia febril: 50 mg/kg/dose 8/8h.",
    renalAdjust: true,
  },
  {
    name: "ceftriaxona",
    display: "Ceftriaxona",
    category: "antimicrobial",
    unit: "mg",
    mode: "mg_per_kg_day",
    doseMin: 50,
    doseMax: 100,
    doseUsual: 50,
    defaultFrequency: 1,
    frequencyOptions: [1, 2],
    defaultRoute: "EV",
    defaultDiluent: "SF 0,9%",
    defaultDiluentVolume: "100",
    defaultInfusionTime: "30min",
    maxDailyDose: 4000,
    clinicalNote: "Meningite: 100 mg/kg/dia ÷ 12/12h.",
  },
  {
    name: "amicacina",
    display: "Amicacina",
    category: "antimicrobial",
    unit: "mg",
    mode: "mg_per_kg_day",
    doseMin: 15,
    doseMax: 20,
    doseUsual: 15,
    defaultFrequency: 1,
    frequencyOptions: [1],
    defaultRoute: "EV",
    defaultDiluent: "SF 0,9%",
    defaultDiluentVolume: "100",
    defaultInfusionTime: "30–60min",
    maxDailyDose: 1500,
    clinicalNote: "Dose única diária. Monitorar vale <5 µg/mL.",
    renalAdjust: true,
  },

  // ===== Vasoativos =====
  {
    name: "noradrenalina",
    display: "Noradrenalina (Norepinefrina)",
    category: "vasoactive",
    unit: "mcg",
    mode: "mcg_per_kg_min",
    doseMin: 0.05,
    doseMax: 1.0,
    doseUsual: 0.1,
    defaultRoute: "EV-BIC",
    defaultDiluent: "SG 5%",
    defaultDiluentVolume: "250",
    clinicalNote: "Diluição habitual: 16 mg em 250 mL SG 5% (64 µg/mL). Acesso central.",
  },
  {
    name: "adrenalina",
    display: "Adrenalina (Epinefrina)",
    category: "vasoactive",
    unit: "mcg",
    mode: "mcg_per_kg_min",
    doseMin: 0.05,
    doseMax: 2.0,
    doseUsual: 0.1,
    defaultRoute: "EV-BIC",
    defaultDiluent: "SG 5%",
    defaultDiluentVolume: "250",
    clinicalNote: "Diluição: 4 mg em 250 mL SG 5% (16 µg/mL).",
  },
  {
    name: "dobutamina",
    display: "Dobutamina",
    category: "vasoactive",
    unit: "mcg",
    mode: "mcg_per_kg_min",
    doseMin: 2.5,
    doseMax: 20,
    doseUsual: 5,
    defaultRoute: "EV-BIC",
    defaultDiluent: "SG 5%",
    defaultDiluentVolume: "250",
    clinicalNote: "Diluição: 250 mg em 250 mL (1 mg/mL).",
  },
  {
    name: "dopamina",
    display: "Dopamina",
    category: "vasoactive",
    unit: "mcg",
    mode: "mcg_per_kg_min",
    doseMin: 2,
    doseMax: 20,
    doseUsual: 5,
    defaultRoute: "EV-BIC",
    defaultDiluent: "SG 5%",
    defaultDiluentVolume: "250",
    clinicalNote: "Diluição: 200 mg em 250 mL (800 µg/mL).",
  },
  {
    name: "nitroprussiato",
    display: "Nitroprussiato de Sódio",
    category: "vasoactive",
    unit: "mcg",
    mode: "mcg_per_kg_min",
    doseMin: 0.3,
    doseMax: 10,
    doseUsual: 0.5,
    defaultRoute: "EV-BIC",
    defaultDiluent: "SG 5%",
    defaultDiluentVolume: "250",
    clinicalNote: "Proteger da luz. Risco de cianeto em uso prolongado.",
  },

  // ===== Sedação / Analgesia =====
  {
    name: "fentanil",
    display: "Fentanil",
    category: "analgesia",
    unit: "mcg",
    mode: "mcg_per_kg_min", // mcg/kg/h convertido na UI
    doseMin: 0.5, // mcg/kg/h
    doseMax: 10,
    doseUsual: 2,
    defaultRoute: "EV-BIC",
    defaultDiluent: "SF 0,9%",
    defaultDiluentVolume: "100",
    clinicalNote: "Doses em mcg/kg/h. Diluição: 1000 mcg em 100 mL (10 mcg/mL).",
  },
  {
    name: "midazolam",
    display: "Midazolam",
    category: "sedation",
    unit: "mg",
    mode: "mcg_per_kg_min", // mg/kg/h
    doseMin: 0.02,
    doseMax: 0.2,
    doseUsual: 0.05,
    defaultRoute: "EV-BIC",
    defaultDiluent: "SF 0,9%",
    defaultDiluentVolume: "100",
    clinicalNote: "Doses em mg/kg/h. Risco de acúmulo em uso prolongado.",
  },
  {
    name: "propofol",
    display: "Propofol",
    category: "sedation",
    unit: "mg",
    mode: "mcg_per_kg_min", // mg/kg/h
    doseMin: 0.5,
    doseMax: 4,
    doseUsual: 2,
    defaultRoute: "EV-BIC",
    defaultDiluent: "Puro",
    defaultDiluentVolume: "—",
    clinicalNote: "Doses em mg/kg/h. Monitorar TG, lactato (PRIS).",
  },

  // ===== Anticoagulantes =====
  {
    name: "enoxaparina",
    display: "Enoxaparina",
    category: "anticoagulant",
    unit: "mg",
    mode: "mg_per_kg_dose",
    doseMin: 0.5,
    doseMax: 1.0,
    doseUsual: 1.0,
    defaultFrequency: 2,
    frequencyOptions: [1, 2],
    defaultRoute: "SC",
    clinicalNote: "Tratamento: 1 mg/kg 12/12h. Profilaxia: 40 mg 1x/dia.",
    renalAdjust: true,
  },
  {
    name: "heparina",
    display: "Heparina não fracionada",
    category: "anticoagulant",
    unit: "UI",
    mode: "UI_per_kg_h",
    doseMin: 12,
    doseMax: 25,
    doseUsual: 18,
    defaultRoute: "EV-BIC",
    defaultDiluent: "SF 0,9%",
    defaultDiluentVolume: "250",
    clinicalNote: "Bólus 80 UI/kg + manutenção 18 UI/kg/h. Ajustar pelo TTPa.",
  },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export function findWeightBasedDose(medicationName: string): WeightBasedDose | null {
  if (!medicationName) return null;
  const n = norm(medicationName);
  return (
    WEIGHT_BASED_DOSES.find((d) => n.includes(d.name)) ||
    WEIGHT_BASED_DOSES.find((d) => norm(d.display).split(/[\s/]+/).some((p) => p.length > 4 && n.includes(p))) ||
    null
  );
}

// Superfície corporal (Mosteller): SC (m²) = √(altura(cm) × peso(kg) / 3600)
export function calculateBSA(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm) return 0;
  return Math.sqrt((heightCm * weightKg) / 3600);
}

export interface DoseCalculationResult {
  dosePerAdmin: number; // dose por administração (mg/mcg/UI)
  dosePerDay?: number;
  ratePerHour?: number; // mL/h (para BIC)
  totalMlPerDay?: number;
  formattedDose: string; // ex.: "1500 mg"
  formattedSchedule: string; // ex.: "12/12h"
  formattedRate?: string; // ex.: "5 mL/h"
  warnings: string[];
}

export function calculateWeightBasedDose(
  ref: WeightBasedDose,
  weightKg: number,
  doseValue: number, // valor da dose (mg/kg/dose, mg/kg/dia, mcg/kg/min)
  options?: { frequency?: number; concentration?: number /* mg/mL ou mcg/mL */ },
): DoseCalculationResult {
  const warnings: string[] = [];
  const result: DoseCalculationResult = {
    dosePerAdmin: 0,
    formattedDose: "",
    formattedSchedule: "",
    warnings,
  };

  if (!weightKg || weightKg <= 0) {
    warnings.push("Peso inválido");
    return result;
  }

  if (doseValue < ref.doseMin || doseValue > ref.doseMax) {
    warnings.push(
      `Dose fora da faixa habitual (${ref.doseMin}–${ref.doseMax} ${doseUnitLabel(ref)})`,
    );
  }

  if (ref.mode === "mg_per_kg_dose") {
    const dose = doseValue * weightKg;
    const freq = options?.frequency ?? ref.defaultFrequency ?? 1;
    const daily = dose * freq;
    if (ref.maxSingleDose && dose > ref.maxSingleDose) {
      warnings.push(`Dose isolada (${dose.toFixed(0)} ${ref.unit}) excede o máximo de ${ref.maxSingleDose} ${ref.unit}`);
    }
    if (ref.maxDailyDose && daily > ref.maxDailyDose) {
      warnings.push(`Dose diária (${daily.toFixed(0)} ${ref.unit}) excede o máximo de ${ref.maxDailyDose} ${ref.unit}`);
    }
    result.dosePerAdmin = dose;
    result.dosePerDay = daily;
    result.formattedDose = `${roundSmart(dose)} ${ref.unit}`;
    result.formattedSchedule = freqToSchedule(freq);
  } else if (ref.mode === "mg_per_kg_day") {
    const daily = doseValue * weightKg;
    const freq = options?.frequency ?? ref.defaultFrequency ?? 1;
    const dose = daily / freq;
    if (ref.maxDailyDose && daily > ref.maxDailyDose) {
      warnings.push(`Dose diária (${daily.toFixed(0)} ${ref.unit}) excede o máximo de ${ref.maxDailyDose} ${ref.unit}`);
    }
    result.dosePerAdmin = dose;
    result.dosePerDay = daily;
    result.formattedDose = `${roundSmart(dose)} ${ref.unit}`;
    result.formattedSchedule = freqToSchedule(freq);
  } else if (ref.mode === "mcg_per_kg_min") {
    // Pode ser mcg/kg/min (vasoativos) ou mg/kg/h (sedação) — usamos a unit do ref para distinguir
    const isPerHour = ref.category === "sedation" || ref.category === "analgesia";
    let mlPerHour = 0;
    if (options?.concentration && options.concentration > 0) {
      if (isPerHour) {
        // dose já está em /kg/h
        const totalPerHour = doseValue * weightKg; // mg ou mcg /h
        mlPerHour = totalPerHour / options.concentration;
      } else {
        const totalPerHour = doseValue * weightKg * 60; // mcg/h
        mlPerHour = totalPerHour / options.concentration;
      }
    }
    result.dosePerAdmin = doseValue * weightKg;
    result.ratePerHour = mlPerHour;
    result.formattedDose = `${doseValue} ${ref.unit}/kg/${isPerHour ? "h" : "min"} (${roundSmart(result.dosePerAdmin)} ${ref.unit}/${isPerHour ? "h" : "min"})`;
    result.formattedSchedule = "BIC contínua";
    if (mlPerHour > 0) {
      result.formattedRate = `${mlPerHour.toFixed(1)} mL/h`;
      result.totalMlPerDay = mlPerHour * 24;
    }
  } else if (ref.mode === "UI_per_kg_h") {
    const perHour = doseValue * weightKg;
    let mlPerHour = 0;
    if (options?.concentration && options.concentration > 0) {
      mlPerHour = perHour / options.concentration;
    }
    result.dosePerAdmin = perHour;
    result.ratePerHour = mlPerHour;
    result.formattedDose = `${doseValue} UI/kg/h (${roundSmart(perHour)} UI/h)`;
    result.formattedSchedule = "BIC contínua";
    if (mlPerHour > 0) result.formattedRate = `${mlPerHour.toFixed(1)} mL/h`;
  } else if (ref.mode === "UI_per_kg_dose") {
    const dose = doseValue * weightKg;
    result.dosePerAdmin = dose;
    result.formattedDose = `${roundSmart(dose)} UI`;
    result.formattedSchedule = freqToSchedule(options?.frequency ?? ref.defaultFrequency ?? 1);
  }

  return result;
}

function roundSmart(v: number): string {
  if (v >= 100) return Math.round(v).toString();
  if (v >= 10) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

function doseUnitLabel(ref: WeightBasedDose): string {
  switch (ref.mode) {
    case "mg_per_kg_dose":
      return `${ref.unit}/kg/dose`;
    case "mg_per_kg_day":
      return `${ref.unit}/kg/dia`;
    case "mcg_per_kg_min":
      return ref.category === "sedation" || ref.category === "analgesia"
        ? `${ref.unit}/kg/h`
        : `${ref.unit}/kg/min`;
    case "UI_per_kg_h":
      return "UI/kg/h";
    case "UI_per_kg_dose":
      return "UI/kg/dose";
  }
}

export function getDoseUnitLabel(ref: WeightBasedDose): string {
  return doseUnitLabel(ref);
}

function freqToSchedule(freq: number): string {
  if (freq === 1) return "1x/dia (24/24h)";
  if (freq === 2) return "12/12h";
  if (freq === 3) return "8/8h";
  if (freq === 4) return "6/6h";
  if (freq === 6) return "4/4h";
  return `${freq}x/dia`;
}
