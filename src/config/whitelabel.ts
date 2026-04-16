/**
 * Configuração White-Label Centralizada
 * Baseada na Norma Zero (MAN.05-001) do HMDM – Socorrão I
 */

import bighelpLogo from "@/assets/bighelp-map-logo.png";
import socorraoLogo from "@/assets/socorrao-logo.jpg";

export const whitelabel = {
  platform: {
    name: "Arsen",
    version: "1.0",
    fullName: "Arsen 1.0",
    slogan: "Mapeando cuidados, salvando vidas.",
    loadingText: "Iniciando",
  },

  institution: {
    /** Hierarquia institucional conforme Norma Zero */
    prefeitura: "Prefeitura de São Luís",
    secretaria: "Secretaria Municipal de Saúde",
    hospitalFullName: "Hospital Municipal Djalma Marques – Socorrão I",
    hospitalShortName: "Socorrão I",
    hospitalAbbreviation: "HMDM",
    hospitalCode: "HMDM",

    /** Dados de contato institucionais */
    address: "Rua do Passeio S/N, Centro, CEP: 65015-370, São Luís/MA",
    email: "gabinete.dg.hmdm@saoluis.ma.gov.br",
    city: "São Luís",
    state: "MA",

    /** Direção (conforme Norma Zero 2026) */
    directorGeneral: "Ilmara Arruda Pinho",
    qualityCoordinator: "Lyssa Riana Chaves Reis",

    /** Compatibilidade legado */
    networkName: "Arsen",
    networkShortName: "Arsen",
    hospitalName: "Hospital Mun. Djalma Marques — Socorrão I",
    networkLogoAlt: "Arsen",
    hospitalLogoAlt: "Socorrão I",
  },

  logos: {
    networkFull: bighelpLogo,
    networkCompact: bighelpLogo,
    hospital: socorraoLogo,
    /** Logo institucional para cabeçalhos de documentos (padrão Norma Zero) */
    institutionalHeader: socorraoLogo,
  },

  theme: {
    gradientFrom: "#0a1628",
    gradientVia: "#0f2847",
    gradientTo: "#1a3a5c",
    bgGradient: "bg-gradient-to-br from-[#0a1628] via-[#0f2847] to-[#1a3a5c]",
    /** Cores institucionais do Socorrão I (cruz colorida) */
    institutionalColors: {
      red: "#E31E24",
      orange: "#F47920",
      yellow: "#FFC20E",
      green: "#00A651",
      blue: "#0054A6",
    },
  },

  credits: {
    developerName: "Arsen",
    developerLabel: "Desenvolvido por",
    authorSignature: "Arsen",
    footerText: "Arsen",
  },

  compliance: {
    legalReferences: "Lei 13.709/2018 (LGPD) • CFM 1.821/2007",
    systemNameInTerms: "Arsen",
    complianceBadgeTitle: "Em Conformidade",
    /** Norma Zero - gestão documental */
    normaZeroCode: "MAN.05-001",
    normaZeroVersion: "05",
    normaZeroDate: "06/01/2026",
  },

  loginFeatures: [
    "Gestão inteligente de leitos em tempo real",
    "Visão completa do paciente em um clique",
    "Mapeamento de cuidados intensivos",
    "Conformidade LGPD e CFM 1.821/2007",
  ],

  admin: {
    panelPassword: "ARSEN2025",
  },

  print: {
    /** Cabeçalho institucional padrão Norma Zero */
    institutionalHeader: {
      line1: "PREFEITURA DE SÃO LUÍS",
      line2: "SECRETARIA MUNICIPAL DE SAÚDE",
      line3: "HOSPITAL MUNICIPAL DJALMA MARQUES – SOCORRÃO I",
    },
    documentFooter: (date: string, time: string) =>
      `Documento gerado automaticamente • ${date} às ${time}`,
    confidentialityText: "Documento Confidencial",
    systemLabel: "Arsen - Mapa de Cuidados Intensivos",
    institutionalFooter: "Rua do Passeio S/N, Centro, CEP: 65015-370, São Luís/MA\ngabinete.dg.hmdm@saoluis.ma.gov.br",
  },

  /** Tipos de documentos institucionais conforme Norma Zero */
  documentTypes: [
    "Política", "Norma", "Manual", "Regimento Interno", "Rotina",
    "POP", "Programa", "Plano", "Protocolo", "Memorando",
    "Memorando Circular", "Ofício", "Fluxograma", "Ata de Reunião",
    "Lista de Frequência", "Lista Mestra",
  ],

  /** Codificação de setores para documentos (conforme Norma Zero item 4.5) */
  documentSectorCodes: {
    direcaoGeral: "01",
    direcaoClinica: "02",
    direcaoTecnica: "03",
    direcaoAdministrativa: "04",
    qualidade: "05",
  },
} as const;

export function getMainPageTitle(hospitalName?: string): string {
  return `Mapa de Pacientes - ${hospitalName || whitelabel.institution.hospitalName}`;
}

export function getPrintTitle(sectionName: string, hospitalName?: string): string {
  return `${sectionName} - ${hospitalName || whitelabel.institution.hospitalName}`;
}

export function getConfidentialityFooter(hospitalName?: string): string {
  return `${hospitalName || whitelabel.institution.hospitalName} • ${whitelabel.print.confidentialityText}`;
}

/** Retorna o cabeçalho institucional completo para documentos impressos */
export function getInstitutionalHeaderLines(): string[] {
  return [
    whitelabel.print.institutionalHeader.line1,
    whitelabel.print.institutionalHeader.line2,
    whitelabel.print.institutionalHeader.line3,
  ];
}
