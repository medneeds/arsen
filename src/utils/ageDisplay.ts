/**
 * Formata a idade para exibição com unidades de medida apropriadas
 */
export function formatAgeDisplay(age: string | number | undefined): string {
  if (!age) return 'IDADE NÃO INFORMADA';
  
  // Se for número, converte para string e adiciona ANOS
  if (typeof age === 'number') {
    return age === 1 ? '1 ANO' : `${age} ANOS`;
  }
  
  // Se for string, verifica se é apenas número ou já está formatada
  const ageStr = age.toString().trim();
  
  // Se a string já contém palavras como ANOS, MESES, DIAS, DV, SEMANAS - já está formatada
  if (/\b(ANO|ANOS|MES|MESES|DIA|DIAS|DV|SEMANA|SEMANAS)\b/i.test(ageStr)) {
    return ageStr.toUpperCase();
  }
  
  // Se é apenas número(s), adiciona ANOS
  if (/^\d+$/.test(ageStr)) {
    const num = parseInt(ageStr);
    return num === 1 ? '1 ANO' : `${num} ANOS`;
  }
  
  // Caso contrário, retorna como está em maiúsculas
  return ageStr.toUpperCase();
}
