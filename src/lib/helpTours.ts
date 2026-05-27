/**
 * Conteúdo do tour de ajuda contextual ("?" canto inferior esquerdo).
 *
 * Camada PURAMENTE de apresentação — não toca dados, hooks, RLS ou auditoria.
 *
 * Cada rota tem N passos. Quando `targetSelector` existe e o elemento é
 * encontrado no DOM, o overlay desenha um spotlight ao redor dele e ancora o
 * tooltip. Quando não encontra (ou o passo é conceitual), o tooltip aparece
 * centralizado.
 *
 * Linguagem: didática, curta, sem alucinação. Reforça o contrato:
 *   PAINEL sinaliza  •  MAPA desaloca  •  Prontuário NUNCA é apagado.
 */

export type HelpStep = {
  id: string;
  title: string;
  body: string;
  /** CSS selector opcional. Se ausente ou não encontrado, tooltip centraliza. */
  targetSelector?: string;
};

export type HelpTour = {
  /** Título exibido no cabeçalho do overlay. */
  title: string;
  /** Subtítulo curto explicando o propósito da página. */
  subtitle: string;
  steps: HelpStep[];
};

/** Mapeia pathname → tour. Use prefix-match em `getHelpTourForPath`. */
const TOURS: Record<string, HelpTour> = {
  "/prescricao": {
    title: "Prescrição médica",
    subtitle: "Como prescrever com segurança em 6 passos",
    steps: [
      {
        id: "intro",
        title: "Bem-vindo à Prescrição",
        body:
          "Esta tela monta a prescrição do paciente em itens (medicamentos, hidratação, dieta, inalação, exames, cuidados). Tudo o que você adicionar fica em rascunho até você ASSINAR — então ninguém vê a prescrição até ela estar pronta.",
      },
      {
        id: "peso-alergias",
        title: "Peso e alergias são obrigatórios",
        body:
          "Antes de prescrever, preencha o peso atual e o status de alergias do paciente. A faixa âmbar no topo lembra você. Sem esses dois campos, a plataforma bloqueia assinar/imprimir — é proteção contra erro de dose e reação alérgica.",
      },
      {
        id: "catalogo",
        title: "Busca inteligente do catálogo",
        body:
          "Digite o nome do medicamento (sem se preocupar com acento) e selecione a apresentação correta. O catálogo HMDM 2026 já traz diluição padrão, dose máxima e tempo de infusão sugeridos — eles aparecem como sugestão, não como obrigação.",
      },
      {
        id: "mav-alerta",
        title: "MAV e Portaria 344",
        body:
          "Medicamentos de Alta Vigilância (MAV) e controlados (Port. 344) recebem destaque visual automático. Para esses itens é obrigatório escolher o tipo de notificação correta — o sistema só libera a impressão depois.",
      },
      {
        id: "validacao",
        title: "Validação antes de assinar",
        body:
          "Ao clicar em Assinar, a plataforma revisa cada item: campos obrigatórios, doses fora de faixa, ATB sem indicação, insulina sem esquema. Erros são vermelhos (bloqueiam), avisos âmbar passam mas ficam registrados.",
      },
      {
        id: "assinar-imprimir",
        title: "Assinar e imprimir",
        body:
          "A assinatura pede sua senha e cria a versão oficial — daqui em frente ela é visível na farmácia e no cockpit. Edições futuras geram nova versão (parent_id), o histórico nunca é perdido. A impressão sai pronta em A4 retrato.",
      },
    ],
  },

  "/evolucao": {
    title: "Evolução clínica (SOAP)",
    subtitle: "Registro do raciocínio clínico do dia",
    steps: [
      {
        id: "intro",
        title: "O que é a Evolução",
        body:
          "A evolução é o registro do raciocínio do dia: o que você viu (S/O), o que pensa (A), o que vai fazer (P). Ela é vinculada ao atendimento atual (encounter_id) e fica para sempre no prontuário longitudinal do paciente.",
      },
      {
        id: "soap",
        title: "Estrutura SOAP",
        body:
          "Subjetivo: queixa e história contada pelo paciente/família. Objetivo: exame físico e dados de vitais/exames. Avaliação: hipóteses e CID. Plano: conduta. Os campos aceitam negrito, itálico e listas (editor rico).",
      },
      {
        id: "cid",
        title: "CID-10 obrigatório",
        body:
          "Toda evolução exige pelo menos um CID-10 como diagnóstico. O primeiro CID inserido vira o diagnóstico principal e sincroniza automaticamente com o resumo do paciente.",
      },
      {
        id: "exames-intercorrencia",
        title: "Exames complementares e intercorrência",
        body:
          "Use o bloco de exames complementares para descrever achados de imagem/laboratório do dia. O bloco de intercorrência é para eventos não programados — fica destacado nos relatórios e no handover.",
      },
      {
        id: "anexos",
        title: "Anexos e assinatura",
        body:
          "Você pode anexar laudos, fotos de ferida e PDFs ao final. Ao salvar, a evolução é assinada com seu CRM e data/hora; edições posteriores criam uma nova versão e a anterior fica acessível no histórico.",
      },
    ],
  },

  "/requisicoes": {
    title: "Requisições (laboratório, imagem, parecer)",
    subtitle: "Como pedir exames e pareceres corretamente",
    steps: [
      {
        id: "intro",
        title: "Requisição unificada",
        body:
          "Aqui você pede exames de laboratório, exames de imagem e pareceres de outras especialidades — tudo na mesma tela. As abas em cima alternam entre as três categorias.",
      },
      {
        id: "contexto-paciente",
        title: "Contexto do paciente já vem preenchido",
        body:
          "Nome, leito, prontuário e dados administrativos (CNS, mãe, endereço para APAC) são puxados automaticamente do paciente ativo. Se algum campo estiver faltando, um aviso âmbar aparece — corrija no cockpit antes de imprimir.",
      },
      {
        id: "lab",
        title: "Laboratório",
        body:
          "Selecione exames por categoria ou use a busca. Você pode marcar como URGENTE (sinaliza no setor) e adicionar indicação clínica. Gasometria sempre gera guia separada na impressão — a plataforma pergunta antes.",
      },
      {
        id: "imagem-apac",
        title: "Imagem e APAC",
        body:
          "Para TC, RM e exames de alta complexidade pelo SUS, escolha o tipo correto — se for APAC, o formulário oficial é gerado já preenchido com os dados puxados da admissão e evolução do paciente.",
      },
      {
        id: "parecer",
        title: "Parecer de especialidade",
        body:
          "Escolha a especialidade, descreva o motivo do pedido e a pergunta clínica. O parecer chega no painel da especialidade alvo e a resposta volta para o cockpit do paciente, sem perder o vínculo.",
      },
    ],
  },
};

// Aliases — todas as rotas de requisição compartilham o mesmo tour.
TOURS["/requisicao/laboratorio"] = TOURS["/requisicoes"];
TOURS["/requisicao/imagens"] = TOURS["/requisicoes"];
TOURS["/requisicao/parecer"] = TOURS["/requisicoes"];

export function getHelpTourForPath(pathname: string): HelpTour | null {
  if (TOURS[pathname]) return TOURS[pathname];
  // Prefix-match para variantes futuras (/prescricao/xxx etc).
  const key = Object.keys(TOURS).find((k) => pathname.startsWith(k));
  return key ? TOURS[key] : null;
}
