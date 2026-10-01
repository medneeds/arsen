/**
 * qSOFA (quick SOFA) — triagem de risco a beira do leito, fora da UTI.
 * Tres criterios, 1 ponto cada; >= 2 indica maior risco de desfecho desfavoravel
 * e deve disparar avaliacao de disfuncao organica.
 *
 * Criterios:
 *  - PAS <= 100 mmHg
 *  - FR  >= 22 irpm
 *  - Alteracao do nivel de consciencia (Glasgow < 15)
 *
 * Entradas sao numericas (a tela de admissao captura PAS separada da diastolica,
 * FR e o Glasgow total). Valores ausentes/invalidos nao pontuam.
 */

export interface QSofaResult {
  /** Pontos 0-3. */
  score: number;
  /** >= 2 pontos. */
  alto: boolean;
  criterios: {
    pasBaixa: boolean;      // PAS <= 100
    frAlta: boolean;        // FR >= 22
    consciencia: boolean;   // Glasgow < 15
  };
  /** Numero de criterios avaliaveis (com valor informado), para escore parcial. */
  avaliados: number;
}

const num = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) ? null : v;

export function calcularQSofa(input: {
  pasSistolica?: number | null;
  freqRespiratoria?: number | null;
  glasgowTotal?: number | null;
}): QSofaResult {
  const pas = num(input.pasSistolica);
  const fr = num(input.freqRespiratoria);
  const gcs = num(input.glasgowTotal);

  const pasBaixa = pas != null && pas <= 100;
  const frAlta = fr != null && fr >= 22;
  const consciencia = gcs != null && gcs < 15;

  const score = (pasBaixa ? 1 : 0) + (frAlta ? 1 : 0) + (consciencia ? 1 : 0);
  const avaliados = (pas != null ? 1 : 0) + (fr != null ? 1 : 0) + (gcs != null ? 1 : 0);

  return { score, alto: score >= 2, criterios: { pasBaixa, frAlta, consciencia }, avaliados };
}
