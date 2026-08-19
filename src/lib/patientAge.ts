/**
 * Cálculo canônico de idade a partir da data de nascimento.
 *
 * PROBLEMA QUE ISSO RESOLVE: `patients.age` é um campo de texto estático,
 * preenchido uma única vez na admissão (a partir do `birth_date` daquele
 * momento) e nunca mais recalculado. Um paciente internado por meses, ou
 * que faz aniversário durante a internação, continua mostrando a idade
 * "congelada" do dia da admissão em toda tela e documento impresso que lê
 * `patient.age` diretamente.
 *
 * A correção real não é atualizar o campo de tempos em tempos (ainda ficaria
 * defasado entre atualizações) — é parar de confiar nesse valor estático e
 * SEMPRE calcular a idade a partir de `patient_registry.birth_date` (que não
 * muda) no momento da exibição. `patients.age` só deve ser usado como último
 * fallback, para os poucos pacientes sem vínculo de `patient_registry`.
 *
 * Havia também 3 fórmulas de cálculo diferentes e duplicadas pelo sistema
 * (uma aproximada por `365.25 dias`, que erra perto do aniversário; outras
 * calendar-aware). Este é o único ponto de cálculo daqui em diante.
 */

/** Calcula a idade em anos completos, calendar-aware (sem arredondamento por dias). */
export function calculateAgeYears(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const raw = String(birthDate).trim();
  // Aceita tanto "yyyy-mm-dd" quanto ISO completo com horário.
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let year: number, month: number, day: number;
  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]) - 1;
    day = Number(isoMatch[3]);
  } else {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    year = parsed.getFullYear();
    month = parsed.getMonth();
    day = parsed.getDate();
  }
  // Datas corrompidas (ex.: ano "19536" já visto em produção) — não retorna
  // uma idade absurda, retorna null para o caller decidir o fallback.
  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) return null;

  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) age--;
  if (age < 0 || age > 130) return null;
  return age;
}

/** Formata no padrão já usado em todo o sistema: "45a" (sem espaço). */
export function formatAge(birthDate: string | null | undefined): string | null {
  const years = calculateAgeYears(birthDate);
  return years === null ? null : `${years}a`;
}
