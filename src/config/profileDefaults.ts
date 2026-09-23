/**
 * Permissionamento padrão aplicado automaticamente quando um perfil de
 * acesso é selecionado no cadastro de usuários.
 *
 * Filosofia (acordada com gestão):
 *  - Perfis GLOBAIS (gestor / role admin) ignoram setores → painel próprio.
 *  - Perfis SETORIAIS (medico, multi) recebem um
 *    conjunto sugerido de setores que cobre o escopo típico daquela função.
 *  - Perfis TRANSVERSAIS de painel próprio (farmácia, NIR, CCIH, imagem,
 *    laboratório, administrativo) também não exigem setores — a UI deles é
 *    consolidada por painéis dedicados.
 *
 * O usuário (admin/gestor) ainda pode editar livremente após a aplicação.
 */
import type { AccessProfile, AppRole } from "./userProfiles";
import type { Department } from "@/contexts/DepartmentContext";

export interface ProfileDefaults {
  /** Role técnica aplicada no enum app_role (RLS). */
  role: AppRole;
  /** Setores pré-selecionados. Vazio = sem setor (perfil global ou painel próprio). */
  departments: Department[];
  /** Rota de pouso pós-login. Espelha ACCESS_PROFILES.defaultRoute. */
  landingRoute: string;
  /** Mensagem curta exibida ao auto-aplicar (UX). */
  hint: string;
}

/**
 * Conjuntos reutilizáveis de setores assistenciais (para reduzir duplicação).
 */
const ASSISTENCIAIS_COMPLETO: Department[] = [
  "UTI 1",
  "UTI 2",
  "UCI 1",
  "UCI 2",
  "UCC",
  "NEURO 01",
  "NEURO 02",
  "CLÍNICA CIRÚRGICA",
  "ENFERMARIA DE TRANSIÇÃO",
  "ENFERMARIA VASCULAR",
  "URGÊNCIA E EMERGÊNCIA ADULTO",
  "SALA VERMELHA",
  "SALA LARANJA",
  "POSTO INTERNAÇÃO",
  // Alias historico de POSTO INTERNAÇÃO — mantido para nao invalidar acessos
  // ja concedidos com o rotulo antigo.
  "INTERNAÇÃO UE",
  "URGÊNCIA E EMERGÊNCIA PEDIÁTRICA",
  "CC PREPARO",
  "CC BLOCO CIRÚRGICO",
  "CC RPA",
];

/**
 * Urgencia e Emergencia (Horizontal) — o guarda-chuva da INTERNACAO na
 * urgencia: Sala Vermelha, Sala Laranja e Posto de Internacao.
 *
 * UE VERTICAL e OBSERVAÇÃO CLÍNICA saíram: são atendimento, não internação, e
 * a plataforma não cobre esse fluxo. 'INTERNAÇÃO UE' permanece como alias
 * histórico de 'POSTO INTERNAÇÃO' para não invalidar acessos já concedidos.
 */
const EMERGENCIA_ADULTO: Department[] = [
  "URGÊNCIA E EMERGÊNCIA ADULTO",
  "SALA VERMELHA",
  "SALA LARANJA",
  "POSTO INTERNAÇÃO",
  "INTERNAÇÃO UE",
];

export const PROFILE_DEFAULTS: Record<AccessProfile, ProfileDefaults> = {
  medico: {
    role: "medico",
    departments: ASSISTENCIAIS_COMPLETO,
    // Apos o login o medico escolhe o setor do plantao. Antes, caia direto no
    // painel com o setor herdado do navegador (ou UTI 1 de padrao), sem ter
    // escolhido nada.
    landingRoute: "/setores",
    hint: "Médico assistente • acesso a UTIs, UCIs, enfermarias, urgência e centro cirúrgico",
  },
  gestor: {
    role: "admin",
    departments: [],
    landingRoute: "/painel-gestor",
    hint: "Gestor • acesso global (todos os setores) com painel executivo",
  },
  farmacia: {
    role: "farmacia",
    departments: [],
    landingRoute: "/validacao-farmaceutica",
    hint: "Farmácia clínica • painel dedicado de validação e dispensação",
  },
  ccih: {
    role: "medico",
    departments: ["CCIH"],
    landingRoute: "/ccih",
    hint: "CCIH • painel próprio de controle de infecção",
  },
  nir: {
    role: "nir",
    departments: ["NIR"],
    landingRoute: "/nir",
    hint: "NIR • mapa de leitos e fluxos de regulação",
  },
  imagem: {
    role: "medico",
    departments: [],
    landingRoute: "/setor-imagem",
    hint: "Setor de Imagem • RX, TC, RM e USG",
  },
  laboratorio: {
    role: "medico",
    departments: [],
    landingRoute: "/setor-laboratorio",
    hint: "Setor Laboratorial • análises clínicas",
  },
  administrativo: {
    role: "medico",
    departments: [],
    landingRoute: "/recepcao",
    hint: "Administrativo • cadastro de pacientes, registro de entrada e fluxos administrativos",
  },
  multi: {
    role: "medico",
    departments: ASSISTENCIAIS_COMPLETO,
    // Mesma entrada do medico: a equipe multi tambem atua por setor e caia no
    // mapa com o setor herdado do navegador.
    landingRoute: "/setores",
    hint: "Equipe multiprofissional • acesso assistencial amplo",
  },
  coord_medico: {
    role: "coordenador",
    departments: [],
    landingRoute: "/mapa",
    hint: "Coordenador médico • leitura clínica completa por unidade hospitalar; pode validar rounds e liberar leitos",
  },
  coord_enfermagem: {
    role: "coordenador",
    departments: [],
    landingRoute: "/mapa",
    hint: "Coordenador de enfermagem • leitura clínica completa por unidade; pode validar rounds e liberar leitos",
  },
  coord_multi: {
    role: "coordenador",
    departments: [],
    landingRoute: "/mapa",
    hint: "Coordenação multiprofissional • leitura clínica completa por unidade; pode validar rounds e liberar leitos",
  },
  qualidade: {
    role: "admin",
    departments: [],
    landingRoute: "/relatorios",
    hint: "Qualidade / Segurança do Paciente • indicadores assistenciais e auditorias",
  },
  desenvolvedor: {
    role: "admin",
    departments: [],
    landingRoute: "/dev-console",
    hint: "Desenvolvedor • console técnico e radar de pendências",
  },
};

/**
 * Mapa papel (profissionais.papel) → perfil de acesso.
 *
 * ESPELHA o PAPEL_TO_PROFILE do AppSidebar: quando o usuário não tem
 * `access_profile` gravado no user_metadata, o papel do sistema determina qual
 * MÓDULO (menu + rota de pouso) ele enxerga. Sem isto, um usuário NIR cujo
 * papel é `regulador`/`nir` (sem access_profile) caía na rota genérica "/" em
 * vez do painel do NIR. Mantenha os dois mapas em sincronia.
 */
export const PAPEL_TO_PROFILE: Record<string, AccessProfile> = {
  medico: "medico",
  enfermeiro: "multi",
  tecnico: "multi",
  regulador: "nir",
  nir: "nir",
  farmacia: "farmacia",
  coordenador: "coord_multi",
  dev: "desenvolvedor",
};

/** Resolve a rota inicial a partir do perfil (com fallback por role). */
export function resolveLandingRoute(
  accessProfile: string | null | undefined,
  appRole: string | null | undefined,
): string {
  if (accessProfile && accessProfile in PROFILE_DEFAULTS) {
    return PROFILE_DEFAULTS[accessProfile as AccessProfile].landingRoute;
  }
  // Fallback 1: mapeia o papel para o perfil de acesso equivalente (mesma
  // lógica do menu lateral) → cada papel abre no painel do seu módulo.
  // Ex.: papel `nir`/`regulador` → perfil `nir` → landingRoute "/nir".
  const mapped = appRole ? PAPEL_TO_PROFILE[appRole] : undefined;
  if (mapped && mapped in PROFILE_DEFAULTS) {
    return PROFILE_DEFAULTS[mapped].landingRoute;
  }
  // Fallback 2: role do sistema (papéis que não têm perfil de módulo próprio).
  switch (appRole) {
    case "admin":
      return "/painel-gestor";
    case "farmacia":
      return "/validacao-farmaceutica";
    case "nir":
      return "/nir";
    case "porta":
      // A triagem foi removida (plataforma de internacao). O perfil de porta
      // passa a abrir na recepcao, que e a porta de entrada do fluxo.
      return "/recepcao";
    case "visitante":
      return "/mapa";
    default:
      return "/";
  }
}
