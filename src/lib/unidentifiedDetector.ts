/**
 * Detector heurístico de paciente NÃO IDENTIFICADO (NI).
 *
 * Camada 1: heurística instantânea (este arquivo).
 * Camada 2: edge function `detect-unidentified-patient` para casos ambíguos.
 *
 * SEMPRE devolve uma sugestão — a decisão final é do usuário via diálogo.
 */

export interface NiDetection {
  isUnidentified: boolean;
  confidence: number; // 0..1
  reason: string;
  source: "heuristic" | "ai";
  suggestedSex?: "M" | "F" | null;
}

const PLACEHOLDER_NAMES = [
  "FULANO",
  "BELTRANO",
  "SICRANO",
  "JOAO DOE",
  "JANE DOE",
  "JOHN DOE",
  "PACIENTE SEM NOME",
  "A IDENTIFICAR",
];

/**
 * Normaliza para uppercase ASCII (NFD), preservando espaços.
 */
function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Detecta se um nome (e contexto opcional) sugere paciente NI.
 * Usa apenas regex/normalize — síncrono, zero latência.
 */
export function detectUnidentified(
  rawName: string,
  extras?: {
    arrivalMode?: string; // ex: "ambulancia", "trauma", "inconsciente"
    isAlreadyMarkedNi?: boolean; // PIS/pre-admission veio com flag
  }
): NiDetection {
  const name = (rawName || "").trim();
  const n = norm(name);

  if (extras?.isAlreadyMarkedNi) {
    return {
      isUnidentified: true,
      confidence: 1,
      reason: "Registro recebido já marcado como Não Identificado.",
      source: "heuristic",
    };
  }

  if (!name) {
    return {
      isUnidentified: false,
      confidence: 0,
      reason: "Nome vazio.",
      source: "heuristic",
    };
  }

  // 1. Frases explícitas
  if (/\bN[\s.\-/]*A[\s.\-/]*O\s+IDENTIFICAD[OA]\b/.test(n)) {
    return {
      isUnidentified: true,
      confidence: 0.99,
      reason: 'Contém "NÃO IDENTIFICADO".',
      source: "heuristic",
    };
  }
  if (/\bSEM\s+(IDENTIFICAC[AÃ]O|ID|NOME)\b/.test(n)) {
    return {
      isUnidentified: true,
      confidence: 0.97,
      reason: 'Contém "SEM IDENTIFICAÇÃO/ID/NOME".',
      source: "heuristic",
    };
  }
  if (/\b(DESCONHECID[OA]|IGNORAD[OA]|NAO\s+INFORMAD[OA])\b/.test(n)) {
    return {
      isUnidentified: true,
      confidence: 0.95,
      reason: 'Contém marcador de paciente desconhecido/ignorado.',
      source: "heuristic",
    };
  }

  // 2. Códigos / abreviações
  if (n === "NI" || /^N[.\s/-]+I\b/.test(n) || /^(N\s*\/\s*I|S\s*\/\s*N|S\s*\/\s*I)\b/.test(n)) {
    return {
      isUnidentified: true,
      confidence: 0.95,
      reason: 'Sigla "N/I", "S/N" ou "NI" como nome.',
      source: "heuristic",
    };
  }

  // 3. Padrão TIO/TIA isolado ou seguido de número/local (ex.: "TIO 1", "TIA DA EMERGENCIA")
  if (/^(TIO|TIA)(\s+(\d+|DA?|DO|DE|EMERGENCIA|TRAUMA|UTI))?$/.test(n)) {
    const sex: "M" | "F" = n.startsWith("TIA") ? "F" : "M";
    return {
      isUnidentified: true,
      confidence: 0.9,
      reason: 'Apelido institucional "TIO/TIA" usado para paciente sem identificação.',
      source: "heuristic",
      suggestedSex: sex,
    };
  }

  // 4. Sexo + NI ("MASC NI", "FEM NI")
  if (/^(MASC|MASCULINO|FEM|FEMININO|HOMEM|MULHER)\.?\s+(NI|N\/I|SEM\s+ID)\b/.test(n)) {
    const sex: "M" | "F" = /^(MASC|HOMEM)/.test(n) ? "M" : "F";
    return {
      isUnidentified: true,
      confidence: 0.95,
      reason: "Sexo aparente + marcador NI.",
      source: "heuristic",
      suggestedSex: sex,
    };
  }

  // 5. Placeholders
  if (/^[X?\-_*.\s]+$/.test(n) && n.length >= 2) {
    return {
      isUnidentified: true,
      confidence: 0.95,
      reason: "Nome composto apenas por placeholders (XXX, ???, ---).",
      source: "heuristic",
    };
  }
  if (PLACEHOLDER_NAMES.includes(n)) {
    return {
      isUnidentified: true,
      confidence: 0.9,
      reason: `Nome placeholder reconhecido ("${n}").`,
      source: "heuristic",
    };
  }

  // 6. Prefixos administrativos
  if (/^(PIS|PIN|NI)[-\s]?\d{2,}/.test(n)) {
    return {
      isUnidentified: true,
      confidence: 0.85,
      reason: "Nome contém código administrativo (PIS-/PIN-/NI-).",
      source: "heuristic",
    };
  }

  // 7. Nome muito curto / só números
  if (/^\d+$/.test(n)) {
    return {
      isUnidentified: true,
      confidence: 0.85,
      reason: "Nome composto apenas por dígitos.",
      source: "heuristic",
    };
  }
  if (n.length <= 2) {
    return {
      isUnidentified: true,
      confidence: 0.7,
      reason: "Nome muito curto (≤2 caracteres).",
      source: "heuristic",
    };
  }

  // Sinal fraco — candidato à camada IA, mas heurística retorna negativo
  return {
    isUnidentified: false,
    confidence: 0,
    reason: "Sem indícios heurísticos de NI.",
    source: "heuristic",
  };
}

/**
 * Decide se vale chamar a camada IA quando heurística não bateu.
 * Critérios baratos para evitar custo desnecessário.
 */
export function shouldEscalateToAi(rawName: string, extras?: { arrivalMode?: string }): boolean {
  const n = norm(rawName);
  if (!n) return false;
  if (n.length <= 8) return true;
  if (!/\s/.test(n)) return true; // só uma palavra
  const arrival = norm(extras?.arrivalMode || "");
  if (/TRAUMA|INCONSCIENT|RESGATE|SAMU|BOMBEIRO/.test(arrival)) return true;
  return false;
}
