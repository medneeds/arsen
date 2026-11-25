/**
 * Chaves liga/desliga de funcionalidades em desenvolvimento.
 *
 * MULTIPROFISSIONAL (capitulo Nutricao, Fisioterapia, Enfermagem e Regulacao
 * externa): so na staging. Ligada por VITE_FEATURE_MULTIPROFISSIONAL="true"
 * nas variaveis do Dokploy da aplicacao de teste. Desligada (padrao), nenhuma
 * aba, rota ou item de menu novo aparece — o cabecalho da Prescricao/Evolucao
 * fica identico ao atual. Protege um eventual merge staging -> producao.
 */
const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

export const FEATURE_MULTIPROFISSIONAL: boolean = env.VITE_FEATURE_MULTIPROFISSIONAL === "true";
