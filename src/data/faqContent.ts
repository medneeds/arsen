/**
 * Conteúdo das Dúvidas Frequentes — pop-ups didáticos em slides.
 * Cada FAQ tem um título, ícone, descrição curta e uma sequência de slides
 * que o usuário navega via setas / dots / swipe.
 */
import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  ClipboardList,
  ArrowLeftRight,
  LogOut,
  Building2,
  FileSignature,
  Undo2,
  UserCog,
  Pencil,
  Palette,
  FileUp,
  Pill,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  History,
  Syringe,
  ShieldAlert,
  Beaker,
  Droplet,
  Printer,
  FileText,
  ClipboardCheck,
  Activity,
  Stethoscope,
  RefreshCw,
} from "lucide-react";

export type SlideTone = "neutral" | "info" | "warning" | "success" | "danger";

export type FaqCategory =
  | "Movimentação & Leitos"
  | "Cadastro & Identificação"
  | "Cards & Visualização"
  | "Prescrição"
  | "Evolução & Documentação";

export interface FaqSlide {
  /** Título curto do slide (ex.: "Passo 1 — Sinalize a alta") */
  title: string;
  /** Corpo didático, 2-4 frases. Aceita parágrafos separados por \n\n. */
  body: string;
  /** Demonstração visual sintética desenhada com Tailwind. Use `kind` em FaqVisual. */
  visual?: FaqVisual;
  /** Cor de destaque do slide */
  tone?: SlideTone;
}

export type FaqVisual =
  | { kind: "bedCard"; bedLabel: string; status?: "ok" | "transferPending" | "dischargePending"; highlightMenu?: boolean }
  | { kind: "menuActions"; items: { icon: "ArrowLeftRight" | "LogOut"; label: string; sub?: string; emphasis?: boolean }[] }
  | { kind: "cockpitTabs"; activeTab: string; tabs: string[]; highlight?: string }
  | { kind: "dialog"; title: string; bodyLines: string[]; primary: string; secondary?: string; tone?: SlideTone }
  | { kind: "panelVsMap" }
  | { kind: "statusLegend"; items: { color: string; label: string; meaning: string }[] }
  | { kind: "stepFlow"; steps: { label: string; sub?: string }[] };

export interface FaqEntry {
  id: string;
  title: string;
  short: string;
  icon: LucideIcon;
  tone: SlideTone;
  category: FaqCategory;
  slides: FaqSlide[];
}

export const FAQ_CATEGORY_ORDER: FaqCategory[] = [
  "Movimentação & Leitos",
  "Cadastro & Identificação",
  "Cards & Visualização",
  "Prescrição",
  "Evolução & Documentação",
];


export const FAQ_ENTRIES: FaqEntry[] = [
  // 1
  {
    id: "mapa-vs-painel",
    title: "Mapa de Leitos × Painel Clínico",
    short: "Entenda a diferença entre os dois módulos centrais da plataforma.",
    icon: LayoutGrid,
    tone: "info",
    category: "Movimentação & Leitos",
    slides: [
      {
        title: "Dois módulos, dois propósitos",
        body: "O Mapa de Leitos cuida da OCUPAÇÃO física (quem está em qual leito). O Painel Clínico cuida da CONDUTA clínica (evoluções, prescrições, exames, alta).",
        visual: { kind: "panelVsMap" },
        tone: "info",
      },
      {
        title: "Mapa de Leitos = movimentação física",
        body: "Use o Mapa para visualizar a situação dos leitos do setor, remanejar dentro do mesmo setor e desalocar um paciente após a sinalização clínica.\n\nO Mapa NÃO registra alta, óbito ou transferência — ele apenas libera o leito quando a saída já foi sinalizada.",
        visual: { kind: "bedCard", bedLabel: "L05", status: "ok" },
      },
      {
        title: "Painel Clínico = decisão clínica",
        body: "Use o Painel para abrir o cockpit do paciente, evoluir, prescrever, solicitar exames e SINALIZAR alta, óbito ou transferência.\n\nToda saída do paciente começa aqui, no Painel Clínico.",
        visual: { kind: "cockpitTabs", tabs: ["Resumo", "Evolução", "Prescrição", "Exames", "Alta"], activeTab: "Alta", highlight: "Alta" },
      },
      {
        title: "Regra de ouro",
        body: "PAINEL sinaliza. MAPA desaloca.\n\nSe o paciente não foi sinalizado no Painel Clínico, o Mapa não libera o leito — e isso é proposital, para evitar saídas sem registro clínico.",
        tone: "warning",
      },
    ],
  },

  // 2
  {
    id: "desalocar-paciente",
    title: "Como desalocar um paciente corretamente",
    short: "Passo a passo: do Painel Clínico (sinalização) até o Mapa (liberação).",
    icon: LogOut,
    tone: "success",
    category: "Movimentação & Leitos",
    slides: [
      {
        title: "Etapa 1 — Sinalize no Painel Clínico",
        body: "Abra o cockpit do paciente e use a aba ALTA. Escolha o tipo de saída: alta hospitalar, óbito ou transferência (interna/externa).\n\nPreencha o sumário e assine. Sem essa etapa, o leito permanece bloqueado.",
        visual: { kind: "cockpitTabs", tabs: ["Resumo", "Evolução", "Prescrição", "Exames", "Alta"], activeTab: "Alta", highlight: "Alta" },
      },
      {
        title: "Etapa 2 — Aparece a tarja no card",
        body: "Após sinalizar, o card do paciente no Mapa exibe uma tarja indicando a saída pendente (ex.: ALTA, ÓBITO, TRANSF. INT/EXT).\n\nIsso comunica visualmente para a equipe que aquele leito está prestes a vagar.",
        visual: { kind: "bedCard", bedLabel: "L05", status: "dischargePending" },
      },
      {
        title: "Etapa 3 — Desaloque no Mapa",
        body: "No Mapa, clique no ícone de movimentação (↔) do card e escolha DESALOCAR LEITO. O sistema reconhece a sinalização ativa e libera o leito de forma segura.",
        visual: {
          kind: "menuActions",
          items: [
            { icon: "ArrowLeftRight", label: "Remanejar leito", sub: "Mesmo setor" },
            { icon: "LogOut", label: "Desalocar leito", sub: "Concluir saída sinalizada", emphasis: true },
          ],
        },
      },
      {
        title: "E se não houver sinalização?",
        body: "Se você tentar desalocar um leito SEM sinalização ativa, o sistema bloqueia e orienta a ir ao Cockpit do paciente para sinalizar primeiro.\n\nNão existe atalho de exceção — isso protege o prontuário.",
        tone: "danger",
      },
    ],
  },

  // 3
  {
    id: "remanejar-mesmo-setor",
    title: "Como remanejar dentro do mesmo setor",
    short: "Realocar para leito vago ou permutar com outro paciente do setor.",
    icon: ArrowLeftRight,
    tone: "info",
    category: "Movimentação & Leitos",
    slides: [
      {
        title: "Quando usar",
        body: "Use REMANEJAR LEITO quando precisar mover o paciente para outro leito DA MESMA UNIDADE — seja para um leito vago ou para permutar posições com outro paciente do setor.",
        visual: { kind: "bedCard", bedLabel: "L05", highlightMenu: true },
      },
      {
        title: "Onde encontrar",
        body: "No Mapa de Leitos, clique no ícone de movimentação (↔) do card. A primeira opção é REMANEJAR LEITO (mesmo setor).",
        visual: {
          kind: "menuActions",
          items: [
            { icon: "ArrowLeftRight", label: "Remanejar leito", sub: "Mesmo setor", emphasis: true },
            { icon: "LogOut", label: "Desalocar leito" },
          ],
        },
      },
      {
        title: "Dois modos de uso",
        body: "1) Mover para leito vago — escolha o leito de destino e confirme.\n\n2) Permutar com outro paciente — selecione o paciente do outro leito; os dois trocam de posição em uma única operação auditada.",
        visual: { kind: "stepFlow", steps: [{ label: "Selecionar destino", sub: "Vago ou ocupado" }, { label: "Confirmar troca" }, { label: "Histórico preservado" }] },
        tone: "success",
      },
      {
        title: "Importante",
        body: "Remanejar dentro do mesmo setor NÃO gera nova admissão, NÃO altera nº de atendimento e NÃO interrompe evoluções/prescrições. Tudo continua atrelado ao mesmo prontuário.",
      },
    ],
  },

  // 4
  {
    id: "transferencia-interna",
    title: "Transferência interna entre setores",
    short: "Mover o paciente para outro setor sem dar alta hospitalar.",
    icon: Building2,
    tone: "warning",
    category: "Movimentação & Leitos",
    slides: [
      {
        title: "O que é",
        body: "Transferência interna é quando o paciente muda de SETOR (ex.: Clínica Cirúrgica → UTI 1), mantendo a mesma internação. Sem alta, sem reinício de prontuário.",
        visual: { kind: "stepFlow", steps: [{ label: "Setor A", sub: "Origem" }, { label: "Setor B", sub: "Destino" }, { label: "Mesmo prontuário" }] },
      },
      {
        title: "Onde sinalizar",
        body: "Sempre pelo Painel Clínico → aba ALTA → tipo TRANSFERÊNCIA INTERNA. Escolha o setor de destino e justifique.\n\nO card no Mapa passa a exibir a tarja TRANSF. INT.",
        visual: { kind: "bedCard", bedLabel: "L05", status: "transferPending" },
      },
      {
        title: "Preservação clínica",
        body: "Evoluções, prescrições, exames, sinais vitais — TUDO segue o paciente para o setor de destino. O nº de atendimento permanece o mesmo até a alta hospitalar.",
        tone: "success",
      },
      {
        title: "Atenção: UTI e UCI 2 são críticos",
        body: "Quando o destino é setor crítico (UTI 1, UTI 2, UCI 2), o sistema agenda o preenchimento do SAPS 3 automaticamente após a alocação no novo leito. Não esqueça de concluir.",
        tone: "warning",
      },
    ],
  },

  // 5
  {
    id: "sinalizar-alta-obito",
    title: "Como sinalizar alta ou óbito",
    short: "Gerar sumário, assinar e liberar leito.",
    icon: FileSignature,
    tone: "success",
    category: "Movimentação & Leitos",
    slides: [
      {
        title: "Onde começa",
        body: "No cockpit do paciente (Painel Clínico), abra a aba ALTA. Escolha o tipo: alta hospitalar, alta administrativa ou óbito.",
        visual: { kind: "cockpitTabs", tabs: ["Resumo", "Evolução", "Prescrição", "Exames", "Alta"], activeTab: "Alta", highlight: "Alta" },
      },
      {
        title: "Preencha o sumário",
        body: "O sumário de alta/óbito é obrigatório. Inclui diagnóstico final, condutas relevantes, orientações de retorno (alta) ou declaração de óbito.\n\nO sistema usa os dados clínicos do atendimento para pré-preencher os campos.",
      },
      {
        title: "Assine e gere o documento",
        body: "Após preencher, assine. O documento fica disponível em DOCUMENTOS do paciente e pode ser impresso. A movimentação de saída é registrada automaticamente como pendente.",
      },
      {
        title: "Libere o leito no Mapa",
        body: "Volte ao Mapa de Leitos, clique no ícone ↔ do card e selecione DESALOCAR LEITO. O sistema concluirá a saída e arquivará os dados clínicos vinculados ao leito.",
        visual: {
          kind: "menuActions",
          items: [
            { icon: "ArrowLeftRight", label: "Remanejar leito" },
            { icon: "LogOut", label: "Desalocar leito", sub: "Concluir alta/óbito", emphasis: true },
          ],
        },
        tone: "success",
      },
    ],
  },

  // 6
  {
    id: "suspender-alta",
    title: "Como suspender uma alta já sinalizada",
    short: "Reverter uma alta antes da desalocação do leito.",
    icon: Undo2,
    tone: "warning",
    category: "Movimentação & Leitos",
    slides: [
      {
        title: "Quando usar",
        body: "Se a alta foi sinalizada mas o paciente teve uma intercorrência ou a decisão foi revisada, é possível SUSPENDER a alta — desde que o leito ainda não tenha sido desalocado.",
      },
      {
        title: "Onde encontrar",
        body: "No cockpit do paciente, ao lado do botão VER ALTA, aparece SUSPENDER ALTA. Clique nele.",
        visual: { kind: "cockpitTabs", tabs: ["Resumo", "Evolução", "Alta"], activeTab: "Alta", highlight: "Alta" },
      },
      {
        title: "Motivo + senha",
        body: "Um pop-up didático pede o MOTIVO (mínimo 10 caracteres) e a SUA SENHA para confirmar a operação. Tudo fica auditado.",
        visual: {
          kind: "dialog",
          title: "Suspender alta",
          bodyLines: [
            "Motivo (mínimo 10 caracteres)",
            "Confirme com sua senha",
          ],
          primary: "Suspender alta",
          secondary: "Cancelar",
          tone: "warning",
        },
        tone: "warning",
      },
      {
        title: "Limites",
        body: "Óbito NÃO pode ser suspenso por esta via. Para correção de registros de óbito, contate a equipe administrativa via Edição Avançada / Dev Console.",
        tone: "danger",
      },
    ],
  },

  // 7
  {
    id: "ni-pin",
    title: "Paciente sem documentos (NI) e identificação posterior",
    short: "Cadastro de Não Identificado, uso de PIN e promoção quando os dados chegam.",
    icon: UserCog,
    tone: "info",
    category: "Cadastro & Identificação",
    slides: [
      {
        title: "O que é NI",
        body: "NI = Não Identificado. Use quando o paciente chega sem documentos. O sistema gera um identificador no formato NI-AAAA-NNNNNN que vale como nome temporário.",
      },
      {
        title: "NI puro × NI + PIN",
        body: "NI puro: identificador automático, sem qualquer informação adicional.\n\nNI + PIN: além do NI, você adiciona um número PIN físico (pulseira) + observações descritivas (ex.: sexo aparente, idade estimada, sinais).",
        visual: { kind: "stepFlow", steps: [{ label: "NI puro" }, { label: "NI + PIN", sub: "pulseira + observações" }, { label: "Identificação posterior" }] },
      },
      {
        title: "Identificação posterior",
        body: "Quando os documentos chegarem, abra o cockpit e use EDIÇÃO AVANÇADA para PROMOVER o NI a paciente identificado. Nome, CPF, CNS e demais dados substituem o NI, preservando todo o histórico clínico.",
        tone: "success",
      },
    ],
  },

  // 8
  {
    id: "editar-dados-paciente",
    title: "Como editar dados do paciente",
    short: "Nº de prontuário, data de admissão e demais correções auditadas.",
    icon: Pencil,
    tone: "warning",
    category: "Cadastro & Identificação",
    slides: [
      {
        title: "Onde editar",
        body: "Duas portas de entrada:\n\n• Mapa de Leitos → card → EDITAR PACIENTE.\n• Cockpit → cabeçalho do paciente → EDIÇÃO AVANÇADA.\n\nAmbas levam ao mesmo conjunto de campos.",
      },
      {
        title: "Motivo obrigatório",
        body: "Toda edição de campo sensível (nº de prontuário, data de admissão, identidade) exige MOTIVO. O sistema grava em histórico imutável quem alterou, quando e por quê.",
        visual: {
          kind: "dialog",
          title: "Confirmar edição",
          bodyLines: ["Campo: Nº de prontuário", "Motivo (obrigatório)"],
          primary: "Confirmar",
          secondary: "Cancelar",
        },
      },
      {
        title: "Data de admissão",
        body: "A data de admissão usa máscara BR (DD/MM/AAAA HH:MM). Edições ficam registradas em histórico próprio. Use com cautela — afeta cálculo de tempo de internação.",
        tone: "warning",
      },
    ],
  },

  // 9
  {
    id: "cores-icones-card",
    title: "Cores e ícones do card do paciente",
    short: "Significado de cada cor, tarja e badge no card do Mapa.",
    icon: Palette,
    tone: "info",
    category: "Cards & Visualização",
    slides: [
      {
        title: "Bolinha de gravidade",
        body: "Ao lado do número do leito, uma bolinha colorida indica a classificação de gravidade clínica. Clique para reclassificar.",
        visual: {
          kind: "statusLegend",
          items: [
            { color: "#22c55e", label: "Verde", meaning: "Estável" },
            { color: "#eab308", label: "Amarelo", meaning: "Cuidados intermediários" },
            { color: "#f97316", label: "Laranja", meaning: "Grave" },
            { color: "#ef4444", label: "Vermelho", meaning: "Crítico" },
          ],
        },
      },
      {
        title: "Status clínicos",
        body: "O card exibe um rótulo de status (ex.: ADMITIDO, AVALIAÇÃO, SAPS PENDENTE, ALTA SINALIZADA). Cada cor sinaliza uma etapa do fluxo.",
        visual: {
          kind: "statusLegend",
          items: [
            { color: "#3b82f6", label: "Azul", meaning: "Admitido / em andamento" },
            { color: "#a855f7", label: "Roxo", meaning: "SAPS 3 pendente" },
            { color: "#06b6d4", label: "Ciano", meaning: "Aguardando avaliação" },
            { color: "#10b981", label: "Verde", meaning: "Alta / saída sinalizada" },
          ],
        },
      },
      {
        title: "Tarjas de saída pendente",
        body: "Quando uma saída foi sinalizada no Painel Clínico, o card recebe uma tarja: ALTA, ÓBITO, TRANSF. INT (transferência interna) ou TRANSF. EXT (externa).\n\nA tarja só some quando o leito é desalocado no Mapa.",
        visual: { kind: "bedCard", bedLabel: "L05", status: "transferPending" },
      },
      {
        title: "Cadeado de setor",
        body: "Um ícone de cadeado cinza indica que o setor está em modo BLOQUEADO (ex.: UE, Anexo Vascular, Centro Cirúrgico, Neuro, Clínica Cirúrgica) — esses setores têm regras de cleanup automático de 24h preservando prontuário.",
        tone: "warning",
      },
    ],
  },
  // 10 — Cadastro via importação PIS
  {
    id: "cadastro-pis-import",
    title: "Cadastrar paciente importando do PIS",
    short: "Aprenda a popular o cadastro automaticamente a partir do PDF do PIS ou texto copiado.",
    icon: FileUp,
    tone: "success",
    category: "Cadastro & Identificação",
    slides: [
      {
        title: "Por que importar do PIS?",
        body: "O PIS já contém nome, CPF, CNS, data de nascimento, nome da mãe, endereço e telefone do paciente. Importar evita redigitação, reduz erro e acelera a recepção.\n\nDois caminhos são aceitos: anexar o PDF do PIS ou colar o texto copiado do sistema.",
        tone: "info",
      },
      {
        title: "Passo 1 — Abrir o cadastro",
        body: "Na Recepção, clique em \"Novo cadastro\" (ou no botão de cadastrar paciente do painel diário). No topo do diálogo de cadastro aparece o bloco \"Importar do PIS\" com dois botões: ANEXAR PDF e COLAR TEXTO.",
        visual: {
          kind: "dialog",
          title: "Novo cadastro de paciente",
          bodyLines: [
            "Importar do PIS:",
            "[ Anexar PDF do PIS ]   [ Colar texto do PIS ]",
            "",
            "Ou preencher manualmente abaixo ↓",
          ],
          primary: "Importar",
          secondary: "Cancelar",
          tone: "info",
        },
      },
      {
        title: "Passo 2A — Anexar o PDF",
        body: "Clique em ANEXAR PDF e selecione o arquivo baixado do PIS. A plataforma extrai automaticamente os campos (nome, CPF, CNS, DN, mãe, endereço, telefone) e mostra uma prévia.\n\nRevise antes de salvar — campos identificados aparecem destacados em verde.",
        visual: {
          kind: "stepFlow",
          steps: [
            { label: "Anexar PDF", sub: "PIS exportado" },
            { label: "Extração automática", sub: "OCR + parser" },
            { label: "Prévia editável", sub: "Verde = identificado" },
            { label: "Confirmar", sub: "Cadastro salvo" },
          ],
        },
      },
      {
        title: "Passo 2B — Colar texto",
        body: "Se você não tem o PDF, copie o bloco de identificação do PIS (Ctrl+A, Ctrl+C na tela do PIS) e clique em COLAR TEXTO. Cole no campo aberto e clique em \"Processar\".\n\nO parser reconhece os rótulos padrão (Nome:, CPF:, CNS:, DN:, Mãe:, etc.) e popula o formulário.",
        tone: "info",
      },
      {
        title: "Passo 3 — Revisar e confirmar",
        body: "Sempre confira CPF, CNS e data de nascimento — são os campos críticos para evitar duplicata de prontuário.\n\nSe a plataforma detectar CPF já cadastrado, ela oferece MERGE com o prontuário existente em vez de criar duplicado.",
        tone: "warning",
        visual: {
          kind: "dialog",
          title: "Possível duplicata detectada",
          bodyLines: [
            "CPF 123.456.789-00 já existe:",
            "→ MARIA DA SILVA — Prontuário 24-AAA-000123",
            "",
            "Deseja usar o prontuário existente ou criar novo?",
          ],
          primary: "Usar existente (merge)",
          secondary: "Criar novo",
          tone: "warning",
        },
      },
      {
        title: "Boas práticas",
        body: "1. Use o PDF sempre que possível — é mais confiável que copiar/colar.\n2. Se algum campo veio vazio (PIS antigo, OCR ruim), preencha manualmente antes de salvar.\n3. CPF e CNS são únicos no sistema — o cadastro bloqueia duplicatas.\n4. Nome social, alergias e peso podem ser preenchidos no cockpit depois da admissão.",
        tone: "success",
      },
    ],
  },
];
