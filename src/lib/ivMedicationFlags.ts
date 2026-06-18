/**
 * Derivação heurística de flags assistenciais para medicamentos EV.
 *
 * Sprint A — fonte é uma curadoria leve por nome (NFD-normalizado).
 * Quando o catálogo HMDM 2026 ganhar essas colunas no banco, basta substituir
 * a derivação por leitura direta do registro.
 *
 * RECONSTITUIÇÃO (modelo "Sugestão revisável"):
 *   Cada antibiótico EV traz valores pré-preenchidos baseados em evidência
 *   convergente (bula ANVISA + Sanford Guide 2024 + ASHP Injectable Drug
 *   Information). Todos os campos são EDITÁVEIS pelo usuário; o sistema apenas
 *   sugere. A fonte aparece junto do campo (badge âmbar "SUGESTÃO — REVISE").
 *   Ajustes finos serão feitos a partir do feedback diário da farmácia.
 */

export interface IvMedicationFlags {
  photoprotection: boolean;   // Fotossensível — proteger da luz (envoltório âmbar / equipo opaco)
  requiresFilter: boolean;    // Necessita filtro em linha (0,22 µm geralmente)
  requiresPump: boolean;      // Exige bomba de infusão (BIC obrigatória)
}

export interface ReconstitutionDefault {
  required: boolean;
  solvent?: string;          // Solvente de reconstituição (AD, SF 0,9%, próprio diluente, etc.)
  volumeMl?: string;         // Volume para reconstituir o pó/liofilizado
  finalDiluent?: string;     // Diluente para infusão (SF 0,9%, SG 5%, etc.)
  finalVolumeMl?: string;    // Volume final da bolsa de infusão
  infusionTimeMin?: string;  // Tempo de infusão sugerido (min)
  source?: string;           // Fonte da evidência (curta, p/ rodapé do campo)
  notes?: string;            // Avisos curtos (ex.: "NÃO usar SG", "fotossensível")
}

const PHOTO_PROTECTION_RX = /(nitroprussiato|anfotericina|dacarbazina|epinefrina\b|adrenalina|nimodipino|vitamina k|fitomenadiona|furosemida|metronidazol|nipride)/i;

const FILTER_RX = /(anfotericina lipos|abelcet|amphocil|paclitaxel|manitol|imunoglobulina|nutri[cç][aã]o parenteral|npt\b)/i;

const PUMP_RX = /(noradrenalina|noraepinefrina|adrenalina|epinefrina|dobutamina|dopamina|nitroprussiato|nitroglicerina|milrinona|vasopressina|midazolam|propofol|fentanil|remifentanil|cisatracur|atracur|rocuronio|insulina (regular|humana) ev|heparina (n[aã]o fracion|s[oó]dica)|amiodarona|lidoca[ií]na (ev|cont[íi]n)|esmolol|nitroprussiato|terlipressina|labetalol|nicardipino|alteplase|tenecteplase|estreptoquinase)/i;

// =============================================================================
// Núcleo expandido de reconstituição (foco: antibióticos / antifúngicos / antivirais EV)
// =============================================================================
// Convenções:
//  - Quando "solvent" = "—" e finalDiluent presente: medicamento já vem pronto,
//    apenas requer diluição final (ex.: linezolida, fluconazol, metronidazol).
//  - "AD" = água destilada para injeção; "SF 0,9%" = soro fisiológico;
//    "SG 5%" = soro glicosado; "RL" = ringer lactato.
//  - Fontes (abreviadas no campo source):
//      ANVISA — bula do registro brasileiro
//      Sanford — Sanford Guide to Antimicrobial Therapy 2024
//      ASHP   — ASHP Injectable Drug Information
//      IDSA   — Infectious Diseases Society of America guidelines
//      ISMP   — Institute for Safe Medication Practices (Brasil)
// =============================================================================
const RECONSTITUTION: Array<{ rx: RegExp } & ReconstitutionDefault> = [
  // ===== Glicopeptídeos / Lipopeptídeos / Oxazolidinonas =====
  {
    rx: /vancomicin/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9% ou SG 5%', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA + ASHP',
    notes: 'Concentração final ≤ 5 mg/mL. Síndrome do homem vermelho se infusão < 60 min.',
  },
  {
    rx: /teicoplanin/i, required: true,
    solvent: 'AD (próprio diluente)', volumeMl: '3',
    finalDiluent: 'SF 0,9% ou SG 5%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA',
    notes: 'Pode ser bolus EV lento (3–5 min) ou infusão em 30 min.',
  },
  {
    rx: /daptomicin/i, required: true,
    solvent: 'SF 0,9%', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '50',
    infusionTimeMin: '30',
    source: 'ANVISA + ASHP',
    notes: 'NÃO usar soluções glicosadas. Incompatível com SG.',
  },
  {
    rx: /linezolid/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'Já pronto (bolsa 300 mL = 600 mg)', finalVolumeMl: '300',
    infusionTimeMin: '60',
    source: 'ANVISA',
    notes: 'Solução já preparada — não reconstituir. Infundir em 30–120 min.',
  },

  // ===== Polimixinas =====
  {
    rx: /polimixina\s*b/i, required: true,
    solvent: 'AD', volumeMl: '2',
    finalDiluent: 'SG 5%', finalVolumeMl: '100',
    infusionTimeMin: '90',
    source: 'ANVISA + Sanford',
    notes: 'Infundir em 60–90 min. Nefrotoxicidade dose-dependente.',
  },
  {
    rx: /colistin|colistimetato/i, required: true,
    solvent: 'AD', volumeMl: '2',
    finalDiluent: 'SF 0,9% ou SG 5%', finalVolumeMl: '50',
    infusionTimeMin: '60',
    source: 'ANVISA + IDSA',
    notes: 'Doses em MUI ou mg-CBA (verificar protocolo institucional).',
  },

  // ===== Glicilciclinas =====
  {
    rx: /tigeciclin/i, required: true,
    solvent: 'SF 0,9% ou SG 5%', volumeMl: '5,3',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA',
    notes: 'Cor amarela após reconstituição; rejeitar se verde/preto.',
  },

  // ===== Penicilinas =====
  {
    rx: /penicilina\s*g\s*(cristalina|potass|s[oó]dica)/i, required: true,
    solvent: 'AD', volumeMl: '8',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA + Sanford',
    notes: 'Dose alta (≥10 MUI) → diluir em 250 mL e infundir em 60 min.',
  },
  {
    rx: /ampicilina(?!\s*\+\s*sulbactam)/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '50',
    infusionTimeMin: '30',
    source: 'ANVISA',
    notes: 'Estabilidade reduzida em SG. Preferir SF.',
  },
  {
    rx: /ampicilina\s*\+\s*sulbactam|unasyn|sultamicilin/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA + ASHP',
  },
  {
    rx: /oxacilin/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA',
    notes: 'Risco de flebite — preferir acesso de bom calibre ou central.',
  },
  {
    rx: /piperacilina[\s-]?tazobactam|tazocin/i, required: true,
    solvent: 'AD ou SF 0,9%', volumeMl: '20',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA + IDSA',
    notes: 'Infusão estendida (4 h) em sepse grave por gram-negativo — protocolo institucional.',
  },

  // ===== Cefalosporinas =====
  {
    rx: /cefazolin/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA + ASHP',
  },
  {
    rx: /cefuroxim/i, required: true,
    solvent: 'AD', volumeMl: '15',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA',
  },
  {
    rx: /ceftriaxon/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA + ASHP',
    notes: 'IM: usar lidocaína 1% s/ vasoconstrictor 3,5 mL p/ 1 g. NUNCA Ringer + ceftriaxona EV (cálcio).',
  },
  {
    rx: /cefotaxim/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA',
  },
  {
    rx: /ceftazidim(?!.*avibactam)/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA + Sanford',
  },
  {
    rx: /cefepim/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA + ASHP',
    notes: 'Infusão estendida (3 h) em UTI — protocolo institucional.',
  },
  {
    rx: /ceftarolin/i, required: true,
    solvent: 'AD', volumeMl: '20',
    finalDiluent: 'SF 0,9% ou SG 5%', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA',
  },
  {
    rx: /ceftolozano[\s-]?tazobactam|zerbaxa/i, required: true,
    solvent: 'AD ou SF 0,9%', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA',
  },
  {
    rx: /ceftazidim.*avibactam|avycaz/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9% ou SG 5%', finalVolumeMl: '100',
    infusionTimeMin: '120',
    source: 'ANVISA',
    notes: 'Infundir em 2 h.',
  },

  // ===== Carbapenêmicos =====
  {
    rx: /meropenem/i, required: true,
    solvent: 'AD', volumeMl: '20',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA + Sanford',
    notes: 'Infusão estendida (3 h) em UTI — protocolo institucional.',
  },
  {
    rx: /imipenem/i, required: true,
    solvent: 'SF 0,9%', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA + ASHP',
    notes: 'NUNCA reconstituir com AD. Sempre SF.',
  },
  {
    rx: /ertapenem/i, required: true,
    solvent: 'SF 0,9%', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '50',
    infusionTimeMin: '30',
    source: 'ANVISA',
    notes: 'IM: usar lidocaína 1% s/ vasoconstrictor 3,2 mL.',
  },

  // ===== Monobactâmicos =====
  {
    rx: /aztreonam/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA',
  },

  // ===== Aminoglicosídeos =====
  {
    rx: /amicacin/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA + Sanford',
    notes: 'Apresentação líquida — não reconstituir. Dose única diária preferível.',
  },
  {
    rx: /gentamicin/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA + ASHP',
    notes: 'Apresentação líquida — não reconstituir.',
  },
  {
    rx: /tobramicin/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA',
  },

  // ===== Lincosamidas / Macrolídeos =====
  {
    rx: /clindamicin/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA + ASHP',
    notes: 'Concentração final ≤ 18 mg/mL. Doses > 1,2 g em 250 mL.',
  },
  {
    rx: /azitromicin/i, required: true,
    solvent: 'AD', volumeMl: '4,8',
    finalDiluent: 'SF 0,9% ou SG 5%', finalVolumeMl: '250',
    infusionTimeMin: '60',
    source: 'ANVISA',
    notes: 'NUNCA bolus. Infundir em pelo menos 60 min.',
  },
  {
    rx: /claritromicin/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9% ou SG 5%', finalVolumeMl: '250',
    infusionTimeMin: '60',
    source: 'ANVISA',
  },

  // ===== Nitroimidazólicos =====
  {
    rx: /metronidazol/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'Já pronto (500 mg / 100 mL)', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA',
    notes: 'Frasco já preparado. Fotossensível.',
  },

  // ===== Sulfas / Diaminopirimidinas =====
  {
    rx: /sulfametoxazol[\s+]*trimetoprima|bactrim|smx[\s-]?tmp/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'SG 5% (1:25)', finalVolumeMl: '125',
    infusionTimeMin: '90',
    source: 'ANVISA + ASHP',
    notes: 'Diluir 1 ampola (5 mL) em 125 mL SG 5%. NÃO usar SF (precipita).',
  },

  // ===== Quinolonas =====
  {
    rx: /ciprofloxacin/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'Já pronto (400 mg / 200 mL)', finalVolumeMl: '200',
    infusionTimeMin: '60',
    source: 'ANVISA',
  },
  {
    rx: /levofloxacin/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'Já pronto (500/750 mg em bolsa)', finalVolumeMl: '150',
    infusionTimeMin: '60',
    source: 'ANVISA',
    notes: 'Infundir em 60 min (500 mg) ou 90 min (750 mg).',
  },
  {
    rx: /moxifloxacin/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'Já pronto (400 mg / 250 mL)', finalVolumeMl: '250',
    infusionTimeMin: '60',
    source: 'ANVISA',
  },

  // ===== Antifúngicos =====
  {
    rx: /fluconazol/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'Já pronto (200 mg / 100 mL)', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA',
    notes: 'Velocidade máxima 200 mg/h (≈10 mL/min).',
  },
  {
    rx: /voriconazol/i, required: true,
    solvent: 'AD', volumeMl: '19',
    finalDiluent: 'SF 0,9% ou SG 5%', finalVolumeMl: '100',
    infusionTimeMin: '120',
    source: 'ANVISA + ASHP',
    notes: 'Velocidade máxima 3 mg/kg/h. Diluir até ≤ 5 mg/mL.',
  },
  {
    rx: /anfotericina\s*b\s*(deoxico|desoxico|convenc)/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SG 5%', finalVolumeMl: '500',
    infusionTimeMin: '240',
    source: 'ANVISA + IDSA',
    notes: 'NUNCA SF (precipita). Concentração final ≤ 0,1 mg/mL. Infundir em 2–6 h.',
  },
  {
    rx: /anfotericina\s*b\s*lipossom|ambisom|abelcet|amphocil/i, required: true,
    solvent: 'AD', volumeMl: '12',
    finalDiluent: 'SG 5%', finalVolumeMl: '250',
    infusionTimeMin: '120',
    source: 'ANVISA',
    notes: 'Usar filtro de 5 µm. Concentração 0,2–2 mg/mL.',
  },
  {
    rx: /caspofungin/i, required: true,
    solvent: 'SF 0,9%', volumeMl: '10,5',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '250',
    infusionTimeMin: '60',
    source: 'ANVISA',
    notes: 'NÃO usar SG. Reconstituir sem agitar (apenas girar).',
  },
  {
    rx: /micafungin/i, required: true,
    solvent: 'SF 0,9%', volumeMl: '5',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA',
    notes: 'Proteger da luz após diluição.',
  },
  {
    rx: /anidulafungin/i, required: true,
    solvent: 'AD (próprio diluente)', volumeMl: '30',
    finalDiluent: 'SF 0,9% ou SG 5%', finalVolumeMl: '100',
    infusionTimeMin: '90',
    source: 'ANVISA',
    notes: 'Velocidade máxima 1,1 mg/min.',
  },

  // ===== Antivirais =====
  {
    rx: /aciclovir/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA + ASHP',
    notes: 'NUNCA bolus. Concentração ≤ 7 mg/mL. Hidratar bem (nefrotoxicidade).',
  },
  {
    rx: /ganciclovir/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA',
    notes: 'Concentração final ≤ 10 mg/mL. Quimioterápico — usar EPI.',
  },
  {
    rx: /oseltamivir\s*ev/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'Uso oral / SNG preferível', finalVolumeMl: '',
    source: 'ANVISA',
    notes: 'Apresentação EV restrita — preferir via enteral.',
  },

  // ===== Penicilinas adicionais =====
  {
    rx: /amoxicilin.*clavulanato|clavulin\s*ev/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA + ASHP',
    notes: 'Estabilidade reduzida em SG. Infundir em até 30 min após preparo.',
  },
  {
    rx: /benzilpenicilin|penicilina\s*g(?!.*benzatina)(?!.*procain)/i, required: true,
    solvent: 'AD', volumeMl: '8',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA',
    notes: 'Doses altas (≥10 MUI) diluir em 250 mL e infundir em 60 min.',
  },

  // ===== Cefalosporinas / β-lactâmicos novos =====
  {
    rx: /cefoxitin/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA + ASHP',
  },
  {
    rx: /cefiderocol|fetroja/i, required: true,
    solvent: 'SF 0,9% ou AD', volumeMl: '10',
    finalDiluent: 'SF 0,9% ou SG 5%', finalVolumeMl: '100',
    infusionTimeMin: '180',
    source: 'ANVISA + IDSA',
    notes: 'Infusão estendida obrigatória (3 h). Indicação por gram-negativos MDR.',
  },
  {
    rx: /meropenem[\s-]*vaborbactam|vabomere/i, required: true,
    solvent: 'SF 0,9%', volumeMl: '20',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '250',
    infusionTimeMin: '180',
    source: 'ANVISA',
    notes: 'Infusão estendida (3 h). NÃO usar SG.',
  },
  {
    rx: /imipenem.*relebactam|recarbrio/i, required: true,
    solvent: 'SF 0,9%', volumeMl: '100',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA',
    notes: 'Frasco-ampola requer reconstituição com 100 mL SF antes de transferir para bolsa.',
  },
  {
    rx: /sulbactam[\s-]*durlobactam|xacduro/i, required: true,
    solvent: 'AD', volumeMl: '20',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '180',
    source: 'IDSA',
    notes: 'Infusão estendida (3 h). Indicação: Acinetobacter MDR.',
  },

  // ===== Carbapenêmicos adicionais =====
  {
    rx: /doripenem/i, required: true,
    solvent: 'AD ou SF 0,9%', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA + ASHP',
  },

  // ===== Glicopeptídeos / lipoglicopeptídeos novos =====
  {
    rx: /telavancin/i, required: true,
    solvent: 'AD ou SG 5%', volumeMl: '15',
    finalDiluent: 'SG 5% ou SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA',
    notes: 'Síndrome do homem vermelho se infusão rápida.',
  },
  {
    rx: /dalbavancin/i, required: true,
    solvent: 'AD', volumeMl: '25',
    finalDiluent: 'SG 5%', finalVolumeMl: '250',
    infusionTimeMin: '30',
    source: 'ANVISA',
    notes: 'NÃO usar SF (precipita). Dose única ou semanal.',
  },
  {
    rx: /oritavancin/i, required: true,
    solvent: 'AD', volumeMl: '40',
    finalDiluent: 'SG 5%', finalVolumeMl: '1000',
    infusionTimeMin: '180',
    source: 'ANVISA',
    notes: 'NÃO usar SF. Infusão única em 3 h.',
  },

  // ===== Oxazolidinonas adicionais =====
  {
    rx: /tedizolid/i, required: true,
    solvent: 'AD', volumeMl: '4',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '250',
    infusionTimeMin: '60',
    source: 'ANVISA',
  },

  // ===== Tetraciclinas / glicilciclinas novas =====
  {
    rx: /eravaciclin/i, required: true,
    solvent: 'AD', volumeMl: '5',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA',
  },
  {
    rx: /doxiciclin.*ev|vibramicin\s*ev/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9% ou SG 5%', finalVolumeMl: '250',
    infusionTimeMin: '120',
    source: 'ANVISA + ASHP',
    notes: 'Fotossensível. Infundir em 1–4 h.',
  },

  // ===== Aminoglicosídeos adicionais =====
  {
    rx: /plazomicin/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '50',
    infusionTimeMin: '30',
    source: 'ANVISA',
  },
  {
    rx: /estreptomicin/i, required: true,
    solvent: 'AD', volumeMl: '4,5',
    finalDiluent: 'IM preferível / SF 0,9% se EV', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA',
    notes: 'Via IM é padrão. EV apenas em situações excepcionais.',
  },

  // ===== Antifúngicos adicionais =====
  {
    rx: /isavuconazol|cresemba/i, required: true,
    solvent: 'AD (próprio diluente)', volumeMl: '5',
    finalDiluent: 'SF 0,9% ou SG 5%', finalVolumeMl: '250',
    infusionTimeMin: '60',
    source: 'ANVISA',
    notes: 'Usar filtro 0,2–1,2 µm em linha. Não infundir junto com outras soluções.',
  },
  {
    rx: /posaconazol\s*ev/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'SF 0,9% ou SG 5% (CVC obrigatório)', finalVolumeMl: '150',
    infusionTimeMin: '90',
    source: 'ANVISA',
    notes: 'Infundir apenas por acesso venoso central. Em via periférica → bolus único possível em emergência.',
  },
  {
    rx: /itraconazol\s*ev/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'SF 0,9% (próprio diluente)', finalVolumeMl: '50',
    infusionTimeMin: '60',
    source: 'ANVISA',
    notes: 'Usar equipo dedicado e filtro 0,2 µm em linha.',
  },

  // ===== Antivirais adicionais =====
  {
    rx: /foscarnet/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'SF 0,9% ou SG 5% (1:1 em periférico)', finalVolumeMl: '250',
    infusionTimeMin: '120',
    source: 'ANVISA + ASHP',
    notes: 'Nefrotóxico — hidratação prévia obrigatória. CVC preferível.',
  },
  {
    rx: /cidofovir/i, required: false,
    solvent: '—', volumeMl: '—',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA',
    notes: 'Pré-medicar com probenecida + hidratação. Nefrotóxico.',
  },
  {
    rx: /remdesivir/i, required: true,
    solvent: 'AD', volumeMl: '19',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA + IDSA',
    notes: 'Infundir em 30–120 min. Estabilidade 24 h em geladeira após diluição.',
  },

  // ===== Tuberculostáticos EV =====
  {
    rx: /isoniazida\s*ev/i, required: true,
    solvent: 'AD', volumeMl: '2',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '60',
    source: 'ANVISA',
  },
  {
    rx: /rifampicina\s*ev/i, required: true,
    solvent: 'AD (próprio diluente)', volumeMl: '10',
    finalDiluent: 'SG 5%', finalVolumeMl: '500',
    infusionTimeMin: '180',
    source: 'ANVISA',
    notes: 'Coloração avermelhada de fluidos corporais é esperada. Fotossensível.',
  },

  // ===== Outros (não-ATB que costumam aparecer no guia/protetor de fluxo) =====
  {
    rx: /cloranfenicol/i, required: true,
    solvent: 'AD', volumeMl: '10',
    finalDiluent: 'SF 0,9%', finalVolumeMl: '100',
    infusionTimeMin: '30',
    source: 'ANVISA',
  },
];

function nfd(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function deriveIvMedicationFlags(name: string): IvMedicationFlags {
  const n = nfd(name);
  return {
    photoprotection: PHOTO_PROTECTION_RX.test(n),
    requiresFilter: FILTER_RX.test(n),
    requiresPump: PUMP_RX.test(n),
  };
}

export function getReconstitutionDefault(name: string): ReconstitutionDefault {
  const n = nfd(name);
  const hit = RECONSTITUTION.find(r => r.rx.test(n));
  if (!hit) return { required: false };
  // Retorna cópia sem o regex (não vaza para consumidores)
  const { rx: _rx, ...rest } = hit;
  return rest;
}

/**
 * Indica se há sugestão de reconstituição/diluição cadastrada — útil para a UI
 * decidir se renderiza o bloco "Sugestão revisável" (mesmo quando o medicamento
 * já vem pronto e só tem diluente final, ainda assim queremos mostrar tempo de
 * infusão sugerido).
 */
export function hasReconstitutionSuggestion(name: string): boolean {
  const n = nfd(name);
  return RECONSTITUTION.some(r => r.rx.test(n));
}
