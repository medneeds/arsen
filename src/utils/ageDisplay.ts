/**
 * Formata a idade para exibição com unidades de medida apropriadas.
 * Usa espaço inseparável (NBSP, \u00A0) entre o número e a unidade
 * para que "32 ANOS" se comporte visualmente como um único conjunto
 * (sem justificação ou quebra entre os termos).
 */
const NBSP = '\u00A0';

function joinWithNbsp(value: string): string {
  // Substitui espaços comuns entre dígitos e a unidade (ANO/ANOS/MES/MESES/DIA/DIAS/SEMANA/SEMANAS/DV) por NBSP
  return value.replace(
    /(\d+)\s+(ANOS?|MES(?:ES)?|DIAS?|SEMANAS?|DV)\b/gi,
    (_m, num, unit) => `${num}${NBSP}${unit}`,
  );
}

export function formatAgeDisplay(age: string | number | undefined): string {
  if (!age) return 'IDADE NÃO INFORMADA';

  // Se for número, converte para string e adiciona ANOS
  if (typeof age === 'number') {
    return age === 1 ? `1${NBSP}ANO` : `${age}${NBSP}ANOS`;
  }

  // Se for string, verifica se é apenas número ou já está formatada
  const ageStr = age.toString().trim();

  // Se a string já contém palavras como ANOS, MESES, DIAS, DV, SEMANAS - já está formatada
  if (/\b(ANO|ANOS|MES|MESES|DIA|DIAS|DV|SEMANA|SEMANAS)\b/i.test(ageStr)) {
    return joinWithNbsp(ageStr.toUpperCase());
  }

  // Se é apenas número(s), adiciona ANOS
  if (/^\d+$/.test(ageStr)) {
    const num = parseInt(ageStr);
    return num === 1 ? `1${NBSP}ANO` : `${num}${NBSP}ANOS`;
  }

  // Caso contrário, retorna como está em maiúsculas
  return joinWithNbsp(ageStr.toUpperCase());
}
