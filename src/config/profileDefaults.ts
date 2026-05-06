/**
 * Permissionamento padrão aplicado automaticamente quando um perfil de
 * acesso é selecionado no cadastro de usuários.
 *
 * Filosofia (acordada com gestão):
 *  - Perfis GLOBAIS (gestor / role admin) ignoram setores → painel próprio.
 *  - Perfis SETORIAIS (medico, multi, classificacao_risco) recebem um
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
  "RIV",
  "URGÊNCIA E EMERGÊNCIA ADULTO",
  "UE VERTICAL",
  "UE HORIZONTAL",
  "SALA VERMELHA",
  "SALA LARANJA",
  "INTERNAÇÃO UE",
  "OBSERVAÇÃO CLÍNICA",
  "URGÊNCIA E EMERGÊNCIA PEDIÁTRICA",
  "CC PREPARO",
  "CC BLOCO CIRÚRGICO",
  "CC RPA",
];

const EMERGENCIA_ADULTO: Department[] = [
  "URGÊNCIA E EMERGÊNCIA ADULTO",
  "UE VERTICAL",
  "UE HORIZONTAL",
  "SALA VERMELHA",
  "SALA LARANJA",
  "INTERNAÇÃO UE",
  "OBSERVAÇÃO CLÍNICA",
];

export const PROFILE_DEFAULTS: Record<AccessProfile, ProfileDefaults> = {
  medico: {
    role: "medico",
    departments: ASSISTENCIAIS_COMPLETO,
    landingRoute: "/",
    hint: "Médico assistente • acesso a UTIs, enfermarias, emergência e CC",
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
    hint: "Administrativo / Recepção • cadastros e fluxos administrativos",
  },
  multi: {
    role: "medico",
    departments: ASSISTENCIAIS_COMPLETO,
    landingRoute: "/mapa",
    hint: "Equipe multiprofissional • acesso assistencial amplo",
  },
  classificacao_risco: {
    role: "porta",
    departments: EMERGENCIA_ADULTO,
    landingRoute: "/triagem-fila",
    hint: "Classificação de risco • fila Manchester e PA adulto",
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
  desenvolvedor: {
    role: "admin",
    departments: [],
    landingRoute: "/dev-console",
    hint: "Desenvolvedor • console técnico e radar de pendências",
  },
};

/** Resolve a rota inicial a partir do perfil (com fallback por role). */
export function resolveLandingRoute(
  accessProfile: string | null | undefined,
  appRole: string | null | undefined,
): string {
  if (accessProfile && accessProfile in PROFILE_DEFAULTS) {
    return PROFILE_DEFAULTS[accessProfile as AccessProfile].landingRoute;
  }
  // Fallback por role do sistema
  switch (appRole) {
    case "admin":
      return "/painel-gestor";
    case "farmacia":
      return "/validacao-farmaceutica";
    case "nir":
      return "/nir";
    case "porta":
      return "/triagem-fila";
    case "visitante":
      return "/mapa";
    default:
      return "/";
  }
}
