/**
 * Catálogo de protocolos de posologia para autopreenchimento inteligente.
 *
 * Cada entrada mapeia um medicamento (por chave normalizada do nome) a uma
 * lista de protocolos sugeridos (dose, via, frequência, instruções e nível
 * de evidência). O médico vê os protocolos como chips clicáveis logo após
 * adicionar o item à prescrição e pode aplicá-los com 1 clique.
 *
 * As referências são consensuais (UpToDate, MS, SBI/AMIB, bulários ANVISA)
 * — não substituem julgamento clínico, sempre devem ser revisadas.
 */
export interface PosologyProtocol {
  label: string;             // Nome curto: "Profilaxia TEV", "Sepse", "Manutenção"
  indication?: string;       // Indicação clínica curta
  dose: string;
  route: string;
  posology: string;          // ex.: "12/12h", "1x/dia", "Contínuo"
  schedule?: string;
  instructions?: string;
  diluent?: string;
  diluentVolume?: string;
  infusionTime?: string;
  evidence?: "A" | "B" | "C" | "Bula"; // grau de recomendação
}

/**
 * Normaliza chave de busca: remove acentos, pontuação e caixa.
 */
function k(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Banco de protocolos. A chave é o nome normalizado (ou prefixo) do
 * medicamento. O lookup faz match exato e por inclusão.
 */
const PROTOCOL_DB: Record<string, PosologyProtocol[]> = {
  // ===== ANALGESIA / SINTOMÁTICOS =====
  "dipirona": [
    { label: "Dor/febre — IV padrão", indication: "Analgesia/antitérmico de horário", dose: "1 g", route: "Intravenosa", posology: "6/6h", schedule: "06h-12h-18h-24h", diluent: "SF 0,9%", diluentVolume: "10 mL", infusionTime: "5", instructions: "Diluir 1 amp (2 mL) em 8-18 mL SF. Infusão lenta. Máx 4 g/dia.", evidence: "Bula" },
    { label: "Antitérmico SN", indication: "Se Tax > 37,8°C", dose: "1 g", route: "Intravenosa", posology: "SOS", diluent: "SF 0,9%", diluentVolume: "10 mL", infusionTime: "5", instructions: "Se Tax > 37,8°C. Máx 4 g/dia.", evidence: "Bula" },
    { label: "Dor — VO comp", indication: "Dor leve/moderada VO", dose: "1 g (2 comp 500 mg)", route: "Oral", posology: "6/6h", schedule: "06h-12h-18h-24h", evidence: "Bula" },
    { label: "Dor — VO gotas", indication: "Adulto VO líquida", dose: "40 gotas", route: "Oral", posology: "6/6h", instructions: "1 gota = 25 mg. Máx 4 g/dia.", evidence: "Bula" },
  ],
  "paracetamol": [
    { label: "Dor/febre — VO", dose: "750 mg", route: "Oral", posology: "6/6h", evidence: "Bula" },
    { label: "Dor/febre — IV", dose: "1 g", route: "Intravenosa", posology: "6/6h", infusionTime: "15", evidence: "Bula" },
  ],
  "tramadol": [
    { label: "Dor moderada/intensa", dose: "100 mg", route: "Intravenosa", posology: "8/8h", diluent: "SF 0,9%", diluentVolume: "100 mL", infusionTime: "20", evidence: "B" },
  ],
  "morfina": [
    { label: "Dor intensa — bolus", dose: "2 mg", route: "Intravenosa", posology: "SOS", instructions: "Diluir 1 amp (10 mg) em 9 mL AD = 1 mg/mL. Repetir até alívio.", evidence: "A" },
    { label: "Edema agudo de pulmão", dose: "3 mg", route: "Intravenosa", posology: "SOS", evidence: "B" },
  ],
  "codeina": [
    { label: "Tosse/dor leve", dose: "30 mg", route: "Oral", posology: "6/6h", evidence: "Bula" },
  ],
  "fentanil": [
    { label: "Sedoanalgesia UTI", dose: "1-3 mcg/kg/h", route: "Intravenosa", posology: "Contínuo", instructions: "BIC. Diluir 10 amp (500 mcg) em 90 mL SF = 50 mcg/mL.", evidence: "A" },
  ],

  // ===== ANTI-EMÉTICOS / GASTRO =====
  "ondansetrona": [
    { label: "Náusea/vômito", dose: "4 mg", route: "Intravenosa", posology: "8/8h", evidence: "A" },
    { label: "QT/RT", dose: "8 mg", route: "Intravenosa", posology: "12/12h", evidence: "A" },
  ],
  "metoclopramida": [
    { label: "Náusea/gastroparesia", dose: "10 mg", route: "Intravenosa", posology: "8/8h", evidence: "B" },
  ],
  "bromoprida": [
    { label: "Náusea", dose: "10 mg", route: "Intravenosa", posology: "8/8h", evidence: "Bula" },
  ],
  "omeprazol": [
    { label: "Profilaxia úlcera de estresse", dose: "40 mg", route: "Intravenosa", posology: "1x/dia", evidence: "A" },
    { label: "HDA — bolus", dose: "80 mg", route: "Intravenosa", posology: "Dose única", instructions: "Seguido de BIC 8 mg/h por 72h", evidence: "A" },
  ],
  "pantoprazol": [
    { label: "Profilaxia úlcera de estresse", dose: "40 mg", route: "Intravenosa", posology: "1x/dia", evidence: "A" },
  ],
  "ranitidina": [
    { label: "Profilaxia úlcera", dose: "50 mg", route: "Intravenosa", posology: "8/8h", evidence: "B" },
  ],

  // ===== PROFILAXIA TEV =====
  "enoxaparina": [
    { label: "Profilaxia TEV", indication: "Paciente clínico/cirúrgico imobilizado", dose: "40 mg", route: "Subcutânea", posology: "1x/dia", evidence: "A" },
    { label: "Profilaxia — IRC (ClCr<30)", dose: "20 mg", route: "Subcutânea", posology: "1x/dia", evidence: "A" },
    { label: "Tratamento TEV/SCA", dose: "1 mg/kg", route: "Subcutânea", posology: "12/12h", evidence: "A" },
  ],
  "heparina": [
    { label: "Profilaxia TEV", dose: "5000 UI", route: "Subcutânea", posology: "8/8h", evidence: "A" },
    { label: "Anticoagulação plena", dose: "18 UI/kg/h", route: "Intravenosa", posology: "Contínuo", instructions: "BIC. Bolus 80 UI/kg. Ajustar por TTPa 6/6h (alvo 1,5-2,5x).", evidence: "A" },
  ],

  // ===== ANTIBIÓTICOS COMUNS =====
  "ceftriaxona": [
    { label: "PAC/ITU", dose: "1 g", route: "Intravenosa", posology: "12/12h", diluent: "SF 0,9%", diluentVolume: "100 mL", infusionTime: "30", evidence: "A" },
    { label: "Meningite/sepse grave", dose: "2 g", route: "Intravenosa", posology: "12/12h", diluent: "SF 0,9%", diluentVolume: "100 mL", infusionTime: "30", evidence: "A" },
  ],
  "piperacilina": [
    { label: "Sepse — empírico", dose: "4,5 g", route: "Intravenosa", posology: "6/6h", diluent: "SF 0,9%", diluentVolume: "100 mL", infusionTime: "30", evidence: "A" },
    { label: "Infusão estendida", dose: "4,5 g", route: "Intravenosa", posology: "8/8h", diluent: "SF 0,9%", diluentVolume: "100 mL", infusionTime: "240", instructions: "Infusão estendida 4h", evidence: "B" },
  ],
  "meropenem": [
    { label: "Sepse grave/Pseudomonas", dose: "1 g", route: "Intravenosa", posology: "8/8h", diluent: "SF 0,9%", diluentVolume: "100 mL", infusionTime: "30", evidence: "A" },
    { label: "Meningite/SNC", dose: "2 g", route: "Intravenosa", posology: "8/8h", diluent: "SF 0,9%", diluentVolume: "100 mL", infusionTime: "30", evidence: "A" },
  ],
  "vancomicina": [
    { label: "Empírico — adulto", dose: "1 g", route: "Intravenosa", posology: "12/12h", diluent: "SF 0,9%", diluentVolume: "250 mL", infusionTime: "60", instructions: "Vancocinemia no 3º dia (alvo 15-20).", evidence: "A" },
    { label: "Sepse grave/peso", dose: "15-20 mg/kg", route: "Intravenosa", posology: "12/12h", diluent: "SF 0,9%", diluentVolume: "250 mL", infusionTime: "60", evidence: "A" },
  ],
  "ciprofloxacino": [
    { label: "ITU complicada", dose: "400 mg", route: "Intravenosa", posology: "12/12h", diluent: "SF 0,9%", diluentVolume: "100 mL", infusionTime: "60", evidence: "A" },
    { label: "ITU não-complicada — VO", dose: "500 mg", route: "Oral", posology: "12/12h", evidence: "A" },
  ],
  "amoxicilina": [
    { label: "PAC ambulatorial", dose: "500 mg", route: "Oral", posology: "8/8h", evidence: "A" },
    { label: "PAC + clavulanato", dose: "875 mg", route: "Oral", posology: "12/12h", evidence: "A" },
  ],
  "azitromicina": [
    { label: "PAC", dose: "500 mg", route: "Intravenosa", posology: "1x/dia", diluent: "SF 0,9%", diluentVolume: "250 mL", infusionTime: "60", evidence: "A" },
    { label: "PAC — VO", dose: "500 mg", route: "Oral", posology: "1x/dia", evidence: "A" },
  ],
  "metronidazol": [
    { label: "Anaeróbios", dose: "500 mg", route: "Intravenosa", posology: "8/8h", infusionTime: "30", evidence: "A" },
  ],
  "clindamicina": [
    { label: "Pele/partes moles", dose: "600 mg", route: "Intravenosa", posology: "8/8h", diluent: "SF 0,9%", diluentVolume: "100 mL", infusionTime: "30", evidence: "A" },
  ],

  // ===== CARDIO / HEMODINÂMICA =====
  "noradrenalina": [
    { label: "Choque — BIC", dose: "0,1-1 mcg/kg/min", route: "Intravenosa", posology: "Contínuo", instructions: "BIC. Diluir 4 amp (16 mg) em 234 mL SG5% = 64 mcg/mL. Acesso central preferencial.", evidence: "A" },
  ],
  "dobutamina": [
    { label: "ICC/baixo débito", dose: "5-20 mcg/kg/min", route: "Intravenosa", posology: "Contínuo", instructions: "BIC. Diluir 1 amp (250 mg) em 230 mL SG5% = 1 mg/mL.", evidence: "A" },
  ],
  "metoprolol": [
    { label: "FC alta — IV", dose: "5 mg", route: "Intravenosa", posology: "SOS", instructions: "Repetir até 3 doses se FC >100 e PAS >100.", evidence: "A" },
  ],
  "captopril": [
    { label: "HAS — VO", dose: "25 mg", route: "Oral", posology: "8/8h", evidence: "A" },
  ],
  "losartana": [
    { label: "HAS", dose: "50 mg", route: "Oral", posology: "1x/dia", evidence: "A" },
  ],
  "anlodipino": [
    { label: "HAS", dose: "5 mg", route: "Oral", posology: "1x/dia", evidence: "A" },
  ],
  "furosemida": [
    { label: "Congestão — bolus", dose: "40 mg", route: "Intravenosa", posology: "12/12h", evidence: "A" },
    { label: "Refratária — BIC", dose: "5-20 mg/h", route: "Intravenosa", posology: "Contínuo", instructions: "BIC. Diluir 250 mg em 230 mL SG5% = 1 mg/mL.", evidence: "B" },
  ],
  "espironolactona": [
    { label: "ICC", dose: "25 mg", route: "Oral", posology: "1x/dia", evidence: "A" },
  ],

  // ===== SEDAÇÃO / NEURO =====
  "midazolam": [
    { label: "Sedação UTI — BIC", dose: "0,02-0,1 mg/kg/h", route: "Intravenosa", posology: "Contínuo", instructions: "BIC. Diluir 100 mg em 100 mL SF = 1 mg/mL.", evidence: "A" },
    { label: "Crise convulsiva", dose: "5 mg", route: "Intravenosa", posology: "SOS", instructions: "Repetir até 3x.", evidence: "A" },
  ],
  "propofol": [
    { label: "Sedação UTI", dose: "1-4 mg/kg/h", route: "Intravenosa", posology: "Contínuo", instructions: "BIC. Acesso exclusivo. Monitorar TG e CK.", evidence: "A" },
  ],
  "haloperidol": [
    { label: "Delirium hiperativo", dose: "2,5 mg", route: "Intravenosa", posology: "SOS", instructions: "Máx 20 mg/24h. Monitorar QTc.", evidence: "B" },
  ],
  "fenitoina": [
    { label: "Manutenção", dose: "100 mg", route: "Intravenosa", posology: "8/8h", diluent: "SF 0,9%", diluentVolume: "100 mL", infusionTime: "30", evidence: "A" },
  ],

  // ===== ENDÓCRINO / METABÓLICO =====
  "insulina regular": [
    { label: "Esquema corretivo SC", dose: "Conforme escala", route: "Subcutânea", posology: "ACM", instructions: "Glicemia capilar 6/6h. Escala: 150-200=2UI, 201-250=4UI, 251-300=6UI, >300=8UI + avisar.", evidence: "A" },
    { label: "CAD — BIC", dose: "0,1 UI/kg/h", route: "Intravenosa", posology: "Contínuo", instructions: "BIC. 100 UI em 100 mL SF = 1 UI/mL.", evidence: "A" },
  ],
  "insulina nph": [
    { label: "Basal", dose: "0,2-0,3 UI/kg/dia", route: "Subcutânea", posology: "12/12h", instructions: "2/3 manhã, 1/3 noite.", evidence: "A" },
  ],
  "hidrocortisona": [
    { label: "Choque séptico", dose: "50 mg", route: "Intravenosa", posology: "6/6h", evidence: "B" },
    { label: "Crise asmática", dose: "200 mg", route: "Intravenosa", posology: "6/6h", evidence: "A" },
  ],
  "dexametasona": [
    { label: "COVID/anti-inflamatório", dose: "6 mg", route: "Intravenosa", posology: "1x/dia", evidence: "A" },
  ],

  // ===== RESPIRATÓRIO =====
  "salbutamol": [
    { label: "Broncodilatação", dose: "10 gotas", route: "Inalatória", posology: "6/6h", instructions: "Diluir em 3 mL SF 0,9%. SN se sibilos.", evidence: "A" },
  ],
  "ipratropio": [
    { label: "DPOC/asma", dose: "20 gotas", route: "Inalatória", posology: "6/6h", instructions: "Associar a salbutamol.", evidence: "A" },
  ],
};

/**
 * Busca protocolos disponíveis para um medicamento pelo nome.
 * Retorna [] se não houver match.
 */
export function getProtocolsFor(medicationName: string): PosologyProtocol[] {
  if (!medicationName) return [];
  const key = k(medicationName);
  // exact match
  if (PROTOCOL_DB[key]) return PROTOCOL_DB[key];
  // includes match — pega a entrada mais específica (chave mais longa contida no nome)
  const candidates = Object.keys(PROTOCOL_DB)
    .filter((dbKey) => key.includes(dbKey) || dbKey.includes(key))
    .sort((a, b) => b.length - a.length);
  if (candidates.length > 0) return PROTOCOL_DB[candidates[0]];
  return [];
}

/**
 * Indica se um medicamento tem protocolos disponíveis.
 */
export function hasProtocols(medicationName: string): boolean {
  return getProtocolsFor(medicationName).length > 0;
}
