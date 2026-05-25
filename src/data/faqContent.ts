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

  // ============================================================
  // PRESCRIÇÃO
  // ============================================================

  // 11 — Peso e alergias obrigatórios
  {
    id: "presc-peso-alergias",
    title: "Por que peso e alergias são obrigatórios na prescrição",
    short: "Sem esses dois campos, o sistema bloqueia assinar, validar e imprimir.",
    icon: AlertTriangle,
    tone: "warning",
    category: "Prescrição",
    slides: [
      {
        title: "O banner âmbar no topo",
        body: "Sempre que faltar PESO (kg) ou ALERGIAS no cabeçalho da prescrição, um banner âmbar aparece no topo da página avisando que esses campos são pré-requisitos do ato de prescrever.",
        tone: "warning",
      },
      {
        title: "Por que é obrigatório",
        body: "PESO calcula doses por kg (antibióticos, vasoativos, sedativos, anticoagulantes). ALERGIAS bloqueiam medicações incompatíveis e ativam alertas de segurança.\n\nPrescrever sem isso é risco clínico — por isso o sistema impede assinar/validar/imprimir.",
        tone: "danger",
      },
      {
        title: "Onde preencher",
        body: "Os campos ficam no cabeçalho da prescrição. Peso aceita 0–500 kg. Alergias usam o chip verde NDAM (nega) ou o vermelho com a lista de alérgenos.\n\nO sistema sincroniza com o cockpit em tempo real: o que você preenche aqui aparece lá e vice-versa.",
      },
      {
        title: "Desbloqueio automático",
        body: "Assim que ambos forem preenchidos, o banner some e os botões ASSINAR / VALIDAR / IMPRIMIR voltam ao estado ativo. Nenhum atalho de bypass — é regra fixa.",
        tone: "success",
      },
    ],
  },

  // 12 — Semáforo vermelho / amarelo / verde
  {
    id: "presc-semaforo-status",
    title: "Semáforo da prescrição: vermelho, amarelo, verde",
    short: "O que cada cor do ícone de status significa e o que destrava o próximo passo.",
    icon: CheckCircle2,
    tone: "info",
    category: "Prescrição",
    slides: [
      {
        title: "Vermelho piscando — pendência crítica",
        body: "O ícone fica vermelho piscando quando há item com campo obrigatório faltando (dose, via, posologia, diluição em IV, tempo de infusão, etc.).\n\nA prescrição NÃO pode ser assinada nesse estado. Clique no item para ver o que falta.",
        tone: "danger",
      },
      {
        title: "Amarelo — pronto para validar",
        body: "Amarelo significa que todos os campos obrigatórios estão preenchidos e a prescrição foi ASSINADA pelo médico, aguardando a VALIDAÇÃO FARMACÊUTICA.\n\nA farmácia revisa interações, doses e classifica Alto Alerta antes de liberar.",
        tone: "warning",
      },
      {
        title: "Verde — validada e pronta para impressão",
        body: "Verde indica prescrição validada pela farmácia. A partir daqui ela pode ser IMPRESSA e DISPENSADA. As doses já são consideradas confiáveis para administração.",
        tone: "success",
      },
      {
        title: "Como o semáforo se comporta",
        body: "O ícone fica visível no cabeçalho e nos cards de lista. A mudança é em tempo real — não precisa recarregar a página.\n\nSe um item for editado depois da validação, o status retorna para amarelo (precisa re-validar).",
      },
    ],
  },

  // 13 — Suspensão é definitiva
  {
    id: "presc-suspender-irreversivel",
    title: "Prescrição suspensa NÃO pode ser reativada",
    short: "Suspender é definitivo. Para retomar, gere uma nova prescrição.",
    icon: ShieldAlert,
    tone: "danger",
    category: "Prescrição",
    slides: [
      {
        title: "O que é suspender",
        body: "Suspender encerra uma prescrição ATIVA (já validada/em uso) antes do prazo natural. É usada quando a conduta muda no meio do plantão (ex.: novo esquema antibiótico, alta clínica, óbito).",
        tone: "warning",
      },
      {
        title: "Por que é irreversível",
        body: "A suspensão entra no histórico clínico e dispara baixa nos itens dispensados. Reativar quebraria a auditoria de medicação e o rastro farmacêutico.\n\nPor isso o sistema NÃO oferece botão de \"reativar\".",
        tone: "danger",
      },
      {
        title: "Como retomar uma conduta",
        body: "Se você precisa voltar à mesma conduta, gere uma NOVA prescrição. Você pode usar \"Copiar da anterior\" para herdar itens, ajustar o que mudou e assinar novamente.\n\nO histórico continua íntegro e o novo documento fica vinculado ao mesmo prontuário.",
        tone: "success",
      },
      {
        title: "Diferença de suspender × excluir",
        body: "SUSPENDER: prescrição já validada/em uso → encerra com auditoria, irreversível.\nEXCLUIR: prescrição ainda em RASCUNHO (nunca assinada/validada) → some sem histórico clínico.",
      },
    ],
  },

  // 14 — Excluir rascunho
  {
    id: "presc-excluir-rascunho",
    title: "Quando dá para excluir uma prescrição",
    short: "Só rascunhos (nunca assinados/validados) podem ser excluídos.",
    icon: Trash2,
    tone: "info",
    category: "Prescrição",
    slides: [
      {
        title: "Regra simples",
        body: "EXCLUIR só é permitido em prescrições em RASCUNHO — ou seja, que nunca foram ASSINADAS pelo médico nem VALIDADAS pela farmácia.\n\nDepois de assinar ou validar, o caminho é SUSPENDER (irreversível).",
      },
      {
        title: "Onde aparece o botão",
        body: "Na lista de prescrições do paciente, rascunhos exibem o ícone de lixeira ao lado do nome. Em prescrições assinadas/validadas, o ícone desaparece e dá lugar ao botão SUSPENDER.",
        visual: {
          kind: "menuActions",
          items: [
            { icon: "ArrowLeftRight", label: "Editar rascunho" },
            { icon: "LogOut", label: "Excluir rascunho", emphasis: true },
          ],
        },
      },
      {
        title: "Rascunhos órfãos",
        body: "Rascunhos antigos (>24h, sem assinatura, fora do dia clínico) são arquivados automaticamente por um job a cada 30 min. A UI também esconde defensivamente.\n\nIsso evita poluir a lista com tentativas inacabadas.",
        tone: "warning",
      },
    ],
  },

  // 15 — Consultar prescrições do dia × anteriores
  {
    id: "presc-historico-consultar",
    title: "Consultar prescrição do dia × dos dias anteriores",
    short: "Como navegar entre a prescrição vigente e o histórico validado.",
    icon: History,
    tone: "info",
    category: "Prescrição",
    slides: [
      {
        title: "Prescrição do dia",
        body: "A página de prescrição sempre abre na prescrição VIGENTE do dia clínico (07:00 → 06:59 do dia seguinte). É a que está em uso na beira do leito.",
      },
      {
        title: "Acessar histórico",
        body: "No topo da página, use o seletor de data (ou a lista \"Versões\") para ver prescrições de dias anteriores. Elas abrem em modo SOMENTE LEITURA — você pode visualizar e re-imprimir, mas não editar.",
        visual: {
          kind: "cockpitTabs",
          tabs: ["Hoje", "Ontem", "Anteontem", "Histórico"],
          activeTab: "Histórico",
          highlight: "Histórico",
        },
      },
      {
        title: "Copiar do dia anterior",
        body: "Ao iniciar a prescrição do dia, o botão \"Copiar da anterior\" herda os itens da última prescrição validada. Você ajusta apenas o que mudou e assina.\n\nÉ o atalho mais comum para evolução de internações estáveis.",
        tone: "success",
      },
      {
        title: "Onde mais ver o histórico",
        body: "Além do seletor da página, o cockpit (aba Resumo) mostra a última prescrição ativa, e \"Documentos do paciente\" lista todos os PDFs já gerados.",
      },
    ],
  },

  // 16 — MAV / Portaria 344
  {
    id: "presc-mav-port344",
    title: "MAV e Portaria 344: o que muda na prescrição",
    short: "Medicamentos de Alta Vigilância e psicotrópicos têm fluxo regulatório próprio.",
    icon: ShieldAlert,
    tone: "danger",
    category: "Prescrição",
    slides: [
      {
        title: "MAV — Alta Vigilância",
        body: "MAV são medicamentos com alto potencial de dano se administrados erroneamente (insulinas, opioides, anticoagulantes, eletrólitos concentrados, etc.). Aparecem com toast colorido + anel pulsante e disparam o guia de Alto Alerta.",
        tone: "warning",
      },
      {
        title: "Portaria 344 — psicotrópicos",
        body: "Portaria 344/98 regula psicotrópicos e entorpecentes (listas A, B, C). Exigem notificação especial (receita amarela/azul) ao imprimir.\n\nO sistema agrupa esses itens por tipo de notificação e bloqueia a impressão se o tipo não estiver definido.",
        tone: "danger",
      },
      {
        title: "Itens MAV + Portaria 344",
        body: "Alguns itens são MAV E Portaria 344 ao mesmo tempo (ex.: midazolam, fentanil). Você verá ambos os alertas e o fluxo regulatório dos dois — guia de Alto Alerta + notificação especial na impressão.",
      },
      {
        title: "Identificação no catálogo",
        body: "Ao buscar a medicação, categorias aparecem como tags: MAV, PORT_344 ou MAV_PORT_344. A seleção já enriquece o item com as flags corretas — você não precisa marcar nada manualmente.",
        tone: "info",
      },
    ],
  },

  // 17 — Insulinoterapia
  {
    id: "presc-insulina-wizard",
    title: "Insulinoterapia: o assistente de 3 passos",
    short: "Pop-up que monta esquema basal-bolus, sliding scale, NPH fixa ou EV contínua.",
    icon: Syringe,
    tone: "info",
    category: "Prescrição",
    slides: [
      {
        title: "Quando aparece",
        body: "Ao selecionar QUALQUER insulina no catálogo (regular, NPH, lispro, aspart, glargina, etc.), o sistema abre automaticamente o wizard em 3 etapas.\n\nO objetivo é evitar prescrição livre de insulina, que é fonte clássica de erro.",
        tone: "warning",
      },
      {
        title: "Os 4 esquemas",
        body: "1. BASAL-BOLUS — basal (glargina/NPH) + bolus prandial + correção.\n2. SLIDING SCALE — correção por faixa de glicemia.\n3. NPH FIXA — esquema clássico de NPH em 2-3 tomadas.\n4. EV CONTÍNUA — bomba de infusão (UTI/cetoacidose).",
        visual: {
          kind: "stepFlow",
          steps: [
            { label: "Basal-Bolus", sub: "Internação geral" },
            { label: "Sliding", sub: "Correção" },
            { label: "NPH Fixa" },
            { label: "EV Contínua", sub: "UTI" },
          ],
        },
      },
      {
        title: "Como sai na prescrição",
        body: "O wizard gera um ITEM MAV agrupado com sub-linhas claras para enfermagem (basal X UI, bolus Y UI antes das refeições, correção pela escala, etc.).\n\nFica auditado e fácil de checar no D1 e re-prescrever no dia seguinte.",
        tone: "success",
      },
      {
        title: "Bases das sugestões",
        body: "As sugestões seguem SBD (Sociedade Brasileira de Diabetes), ADA e AMIB. O sistema NÃO inventa doses — ele propõe faixas e você ajusta para o paciente.",
      },
    ],
  },

  // 18 — Bolus × EV em tempo
  {
    id: "presc-iv-bolus",
    title: "EV em bolus × EV em tempo: quando usar cada um",
    short: "O toggle no bloco de Infusão EV e quando o bolus faz sentido.",
    icon: Droplet,
    tone: "info",
    category: "Prescrição",
    slides: [
      {
        title: "O toggle Tempo ↔ Bolus",
        body: "No bloco \"Infusão EV\" de itens IV intermitentes (não-ATB, posologia ≠ contínuo), aparece um switch para alternar entre TEMPO DE INFUSÃO e BOLUS.",
      },
      {
        title: "Quando usar BOLUS",
        body: "Bolus = injeção rápida (geralmente <1 min). Indicado para situações de emergência: atropina, adrenalina, naloxona, glicose hipertônica em hipoglicemia.\n\nAtivar o modo bolus REMOVE a obrigatoriedade de tempo e vazão e imprime \"EV em bolus\" na receita.",
        tone: "warning",
      },
      {
        title: "Quando usar TEMPO",
        body: "Tempo é o padrão: a maioria das medicações EV precisa de diluição + tempo de infusão definido (15-60 min comuns) para evitar reações de infusão, flebite ou efeitos cardíacos.\n\nMantenha tempo sempre que houver dúvida.",
        tone: "info",
      },
      {
        title: "Alerta âmbar",
        body: "Se você ativa BOLUS em medicação fora do uso clássico (atropina/adrenalina), o sistema emite alerta âmbar pedindo confirmação — é uma rede de proteção, não bloqueio.",
        tone: "warning",
      },
    ],
  },

  // 19 — Diluição de comprimido enteral
  {
    id: "presc-enteral-compounded",
    title: "Comprimido por sonda: diluição obrigatória",
    short: "Forma sólida + via enteral abre o builder de diluição e lista NÃO TRITURAR.",
    icon: Beaker,
    tone: "warning",
    category: "Prescrição",
    slides: [
      {
        title: "Quando o builder aparece",
        body: "Sempre que você prescreve uma forma SÓLIDA (cp, cápsula) por VIA ENTERAL (SNG, SNE, gastrostomia, jejunostomia), o sistema abre automaticamente o bloco \"Diluição\".",
      },
      {
        title: "Por que é obrigatório",
        body: "Comprimidos não passam por sonda sem trituração e dispersão em líquido. Sem orientação clara, a enfermagem improvisa — e isso causa obstrução de sonda e dose imprecisa.",
        tone: "warning",
      },
      {
        title: "Lista NÃO TRITURAR (ISMP-Brasil)",
        body: "Se o medicamento estiver na lista ISMP-Brasil de \"não triturar\" (revestimentos entéricos, liberação prolongada, citotóxicos, etc.), o builder BLOQUEIA com alerta vermelho — esses comprimidos não podem ser administrados por sonda.",
        tone: "danger",
      },
      {
        title: "Saída na prescrição",
        body: "O builder gera instrução clara: \"Triturar 1 cp, dispersar em 10 mL de água, administrar pela sonda, lavar com 20 mL após\". Tudo padronizado para a enfermagem.",
        tone: "success",
      },
    ],
  },

  // 20 — Sólido oral exige posologia
  {
    id: "presc-oral-posologia",
    title: "Sólido oral: posologia é sempre obrigatória",
    short: "Comprimido/cápsula/SL/orodispersível por VO/SL/enteral exige campo de posologia preenchido.",
    icon: Pill,
    tone: "warning",
    category: "Prescrição",
    slides: [
      {
        title: "A regra",
        body: "Para formas sólidas (comprimido, cápsula, drágea, SL, orodispersível) administradas por VO / SL / enteral, o sistema EXIGE preenchimento do campo POSOLOGIA (intervalo + horários).\n\nInstrução livre não substitui — é regra de segurança.",
      },
      {
        title: "Por quê",
        body: "Sem posologia formal, a farmácia não calcula quantitativo correto e a enfermagem não tem horário de administração estruturado. O resultado: dose perdida ou duplicada.",
        tone: "danger",
      },
      {
        title: "Como preencher",
        body: "Escolha o INTERVALO (6/6h, 8/8h, 12/12h, 1x/dia, etc.). Os horários aparecem automaticamente conforme o padrão do setor — você ajusta se necessário.\n\nO item só fica VERDE (pronto) quando a posologia está completa.",
        tone: "success",
      },
    ],
  },

  // 21 — Inalatórios
  {
    id: "presc-inalatorios",
    title: "Inalatórios: builder específico (sem velocidade IV)",
    short: "Nebulização, contínua, pMDI e DPI têm campos próprios.",
    icon: Activity,
    tone: "info",
    category: "Prescrição",
    slides: [
      {
        title: "Por que um bloco separado",
        body: "Inalatórios (Berotec, Atrovent, Salbutamol, Budesonida, etc.) não seguem a lógica de IV. O sistema substitui o campo de velocidade de infusão por campos próprios de via inalatória.",
      },
      {
        title: "Os 4 modos",
        body: "1. NEBULIZAÇÃO intermitente — dose + nº de gotas + diluente + intervalo.\n2. NEBULIZAÇÃO CONTÍNUA — dose contínua + tempo.\n3. pMDI — spray dosimetrado, nº de jatos + espaçador.\n4. DPI — pó seco, dose única do dispositivo.",
        visual: {
          kind: "stepFlow",
          steps: [
            { label: "Nebulização" },
            { label: "Contínua" },
            { label: "pMDI", sub: "spray + espaçador" },
            { label: "DPI", sub: "pó seco" },
          ],
        },
      },
      {
        title: "Autofill por catálogo",
        body: "Ao escolher o medicamento, o sistema sugere dose, nº de gotas, diluente e modo padrão (ex.: Berotec → 10 gtt + 3 mL SF, NBZ). Você só ajusta o que muda no caso.",
        tone: "success",
      },
    ],
  },

  // 22 — Checklist de impressão
  {
    id: "presc-imprimir-checklist",
    title: "Checklist antes de imprimir a prescrição",
    short: "Peso, alergias, validação, datas, MAV/Port. 344 e leito vivo.",
    icon: Printer,
    tone: "info",
    category: "Prescrição",
    slides: [
      {
        title: "1. Peso e alergias preenchidos",
        body: "Sem isso, o botão IMPRIMIR fica bloqueado e o banner âmbar aparece no topo.",
        tone: "warning",
      },
      {
        title: "2. Status verde (validada)",
        body: "A impressão definitiva só sai após validação farmacêutica (ícone verde). Antes disso, qualquer impressão é PROVISÓRIA e tem marca d'água.",
      },
      {
        title: "3. MAV / Portaria 344",
        body: "Itens MAV imprimem com guia de Alto Alerta anexado. Itens Portaria 344 saem em folhas separadas por tipo de notificação (receita amarela/azul). O sistema agrupa automaticamente.",
        tone: "warning",
      },
      {
        title: "4. Cabeçalho com leito atual",
        body: "A impressão usa o LEITO ATUAL do paciente em tempo real (não o leito da hora em que a prescrição foi aberta). Isso evita imprimir com leito errado depois de remanejamento.",
        tone: "success",
      },
      {
        title: "5. Anexos de ATB (Guia ATM)",
        body: "Antibióticos exigem Guia ATM no D1. Após anexar a Guia, um pop-up didático lembra que devem ser impressas 2 VIAS — uma para a farmácia, outra para o prontuário.",
      },
    ],
  },

  // ============================================================
  // EVOLUÇÃO & DOCUMENTAÇÃO
  // ============================================================

  // 23 — SOAP
  {
    id: "evo-soap-estrutura",
    title: "Estrutura SOAP da evolução clínica",
    short: "Subjetivo, Objetivo, Avaliação e Plano: como o sistema organiza.",
    icon: FileText,
    tone: "info",
    category: "Evolução & Documentação",
    slides: [
      {
        title: "O que é SOAP",
        body: "SOAP é o padrão internacional de evolução:\n• S — Subjetivo (queixas e relato do paciente).\n• O — Objetivo (exame físico, sinais vitais, exames).\n• A — Avaliação (impressão clínica, hipóteses).\n• P — Plano (condutas, exames, prescrições).",
      },
      {
        title: "Onde aparece",
        body: "Na aba EVOLUÇÃO do cockpit, cada campo SOAP é editor de texto rico (negrito, itálico, sublinhado, parágrafos). Você pode usar templates clínicos por campo.",
        visual: {
          kind: "cockpitTabs",
          tabs: ["Resumo", "Evolução", "Prescrição", "Exames", "Alta"],
          activeTab: "Evolução",
          highlight: "Evolução",
        },
      },
      {
        title: "Templates de campo",
        body: "Cada profissional/setor pode salvar TEMPLATES por campo SOAP (ex.: \"Choque séptico — A\"). O template insere o texto base e você ajusta o caso.",
        tone: "success",
      },
      {
        title: "Sincronia em tempo real",
        body: "O cabeçalho do paciente (leito, idade, CID, alergias) atualiza em tempo real enquanto você evolui — se o paciente for remanejado, o leito muda sozinho na página de evolução.",
      },
    ],
  },

  // 24 — Evolução × Intercorrência × Plano
  {
    id: "evo-tipos-documentos",
    title: "Evolução × Intercorrência × Plano",
    short: "Quando usar cada tipo de registro clínico.",
    icon: ClipboardCheck,
    tone: "info",
    category: "Evolução & Documentação",
    slides: [
      {
        title: "Evolução",
        body: "Registro diário (ou por plantão) com a estrutura SOAP completa. É o documento principal do dia clínico. Cada paciente deve ter ao menos UMA por plantão.",
      },
      {
        title: "Intercorrência",
        body: "Evento agudo fora da evolução de rotina (queda, dessaturação, hipotensão, parada). Registra hora, descrição, conduta e resposta. Não substitui a evolução do dia.",
        tone: "warning",
      },
      {
        title: "Plano (próximas 24h)",
        body: "Campo voltado para deixar claro o que se espera para as próximas 24h: metas de PAM, plano de extubação, antibioticoterapia, previsão de alta, exames a aguardar.\n\nServe como handoff para o plantão seguinte.",
        tone: "info",
      },
      {
        title: "Onde encontrar",
        body: "Todos ficam na aba EVOLUÇÃO do cockpit, em sub-abas distintas. O histórico mostra a sequência cronológica e quem assinou cada item.",
      },
    ],
  },

  // 25 — Formatação rica
  {
    id: "evo-formatacao-rica",
    title: "Editor de texto rico: B / I / U e parágrafos",
    short: "Como formatar a evolução para ficar legível ao reler.",
    icon: Pencil,
    tone: "info",
    category: "Evolução & Documentação",
    slides: [
      {
        title: "Atalhos",
        body: "• Ctrl+B — negrito (use para diagnósticos e condutas).\n• Ctrl+I — itálico (achados sutis, observações).\n• Ctrl+U — sublinhado (alertas).\n• Enter — quebra de parágrafo (não use \"shift+enter\" para parágrafos).",
      },
      {
        title: "Onde funciona",
        body: "O editor rico está disponível em EVOLUÇÃO, PLANO, EXAMES COMPLEMENTARES e INTERCORRÊNCIA. Em sumários de alta também.\n\nO texto sai formatado na impressão (PDF preserva negritos e parágrafos).",
        tone: "success",
      },
      {
        title: "Sanitização automática",
        body: "Colar conteúdo de Word/Excel funciona — o sistema limpa formatação indevida (cores estranhas, fontes, tabelas malformadas) e mantém só o que é seguro (negrito, itálico, sublinhado, parágrafos).",
      },
    ],
  },

  // 26 — CID-10 inline
  {
    id: "evo-cid-inline",
    title: "CID-10 inline: como inserir e como sincroniza",
    short: "Digite o CID no texto e o sistema sugere a descrição.",
    icon: Stethoscope,
    tone: "info",
    category: "Evolução & Documentação",
    slides: [
      {
        title: "Digitando no texto",
        body: "Em qualquer campo SOAP, ao digitar um código CID-10 válido (ex.: J18.9), o sistema oferece autocomplete com a descrição oficial. Aceite com Tab/Enter.",
      },
      {
        title: "Sincronia com o cabeçalho",
        body: "Se você adicionar/remover CID na evolução, o cabeçalho do paciente (e o card no Mapa) atualizam em tempo real. O CID primário fica em destaque.",
        tone: "success",
      },
      {
        title: "Múltiplos CID",
        body: "Você pode listar múltiplos CID (principal + secundários). O sistema marca o PRIMÁRIO — que é o usado em relatórios de produção e dashboards de gestão.",
      },
    ],
  },

  // 27 — Cabeçalho em tempo real
  {
    id: "evo-header-realtime",
    title: "Cabeçalho do paciente em tempo real",
    short: "Leito, idade, peso, alergias e CID sempre atualizados na evolução.",
    icon: RefreshCw,
    tone: "info",
    category: "Evolução & Documentação",
    slides: [
      {
        title: "Por que isso importa",
        body: "Se outro membro da equipe editar peso, alergias ou remanejar o paciente enquanto você está evoluindo, o cabeçalho da página atualiza sozinho. Você não risca de imprimir com leito antigo.",
      },
      {
        title: "Como funciona",
        body: "O hook \"usePatientLive\" escuta mudanças em tempo real nas tabelas patients, patient_registry, patient_encounters e medical_records.\n\nA cada update remoto, o cabeçalho re-renderiza com os dados frescos.",
        tone: "info",
      },
      {
        title: "Reflexo na impressão",
        body: "Ao gerar o PDF (evolução, prescrição, sumário), o sistema busca o LEITO ATUAL na hora — não o snapshot do momento em que a página foi aberta. Documentos saem sempre coerentes com a posição real do paciente.",
        tone: "success",
      },
    ],
  },
];

