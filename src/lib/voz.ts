import { toast } from "sonner";

/**
 * VOZ DO ARSEN — mensagens ao usuário.
 *
 * O sistema fala com quem usa, não sobre si mesmo.
 *
 * "Erro ao atualizar paciente" descreve o que aconteceu DENTRO do programa.
 * Não diz se o dado foi perdido, se vale tentar de novo, nem o que fazer
 * agora — que são as três coisas que o médico precisa saber com o paciente
 * esperando.
 *
 * TOM: sóbrio e direto. Sem primeira pessoa.
 * Num sistema cujo produto vira registro legal, o software não se apresenta
 * como sujeito que tenta e falha ("não conseguimos salvar"). Ele informa o
 * estado do dado: "as alterações não foram salvas".
 *
 * REGRA DE UM ERRO, nesta ordem:
 *   1. o que aconteceu com o DADO  — foi salvo? perdeu-se? está pendente?
 *   2. o que fazer agora           — uma ação concreta, não "tente mais tarde"
 *   3. o detalhe técnico           — se houver, recolhido em `description`,
 *                                    NUNCA na primeira linha
 *
 * O QUE EVITAR
 *   - abrir com "Erro" ou "Falha": nomeia a falha e não orienta;
 *   - concatenar err.message no corpo: texto do Postgres, às vezes em inglês,
 *     na tela de quem está prescrevendo;
 *   - exclamação em ato clínico rotineiro — salvar uma evolução não é festa;
 *   - plural entre parênteses, "3 item(ns)": o sistema sabe a quantidade.
 *
 * Medição que originou este arquivo (16/09/2026): 986 mensagens ao usuário,
 * das quais 443 de erro. 145 abriam com "Erro" ou "Falha", 38 despejavam o
 * erro técnico bruto e 251 usavam plural entre parênteses.
 */

/** Plural correto a partir da contagem — substitui "item(ns)". */
export function plural(n: number, singular: string, pluralForm?: string): string {
  return n === 1 ? singular : (pluralForm ?? `${singular}s`);
}

/** "1 item" / "3 itens" */
export function contar(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${plural(n, singular, pluralForm)}`;
}

interface OpcoesErro {
  /** O que fazer agora. Uma ação concreta. */
  acao?: string;
  /** Detalhe técnico — vai recolhido, e só serve a quem for investigar. */
  detalhe?: unknown;
}

/**
 * Erro de operação: algo não foi concluído.
 *
 * `oQueFalhou` descreve o efeito sobre o dado, em frase completa e já no
 * negativo. Exemplos: "As alterações não foram salvas",
 * "A prescrição anterior não pôde ser carregada".
 */
export function erro(oQueFalhou: string, opcoes: OpcoesErro = {}) {
  const { acao = "Tente novamente.", detalhe } = opcoes;
  // O detalhe técnico vai para o console, onde quem investiga encontra, e
  // não para a tela de quem está atendendo.
  if (detalhe) console.error("[Arsen]", oQueFalhou, detalhe);
  const texto = oQueFalhou.trim().replace(/[.!]+$/, "");
  toast.error(`${texto}. ${acao}`.trim());
}

/**
 * Confirmação de que algo ficou registrado.
 * Sem exclamação: registrar uma evolução é rotina, não conquista.
 */
export function feito(oQueAconteceu: string) {
  toast.success(oQueAconteceu.trim().replace(/[.!]+$/, ""));
}

/** Algo exige atenção mas não impediu a ação. */
export function atencao(oQue: string) {
  toast.warning(oQue.trim().replace(/[!]+$/, ""));
}

/**
 * Falta um dado antes de prosseguir. Diz o que informar, não que houve erro.
 * Exemplo: exigir("Informe o peso do paciente antes de prescrever").
 */
export function exigir(oQueFalta: string) {
  toast.error(oQueFalta.trim().replace(/[.!]+$/, ""));
}
