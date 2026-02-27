/**
 * Configuração White-Label Centralizada - BigHelp Map
 */

import bighelpLogo from "@/assets/bighelp-map-logo.png";

export const whitelabel = {
  platform: {
    name: "BigHelp Map",
    version: "1.0",
    fullName: "BigHelp Map 1.0",
    slogan: "Mapeando cuidados, salvando vidas.",
    loadingText: "Iniciando",
  },

  institution: {
    networkName: "BigHelp Map",
    networkShortName: "BigHelp",
    hospitalName: "Hospital Mun. Djalma Marques — Socorrão I",
    networkLogoAlt: "BigHelp Map",
    hospitalLogoAlt: "Socorrão I",
  },

  logos: {
    networkFull: bighelpLogo,
    networkCompact: bighelpLogo,
    hospital: bighelpLogo,
  },

  theme: {
    gradientFrom: "#0a1628",
    gradientVia: "#0f2847",
    gradientTo: "#1a3a5c",
    bgGradient: "bg-gradient-to-br from-[#0a1628] via-[#0f2847] to-[#1a3a5c]",
  },

  credits: {
    developerName: "BigHelp Map",
    developerLabel: "Desenvolvido por",
    authorSignature: "BigHelp Map",
    footerText: "BigHelp Map",
  },

  compliance: {
    legalReferences: "Lei 13.709/2018 (LGPD) • CFM 1.821/2007",
    systemNameInTerms: "BigHelp Map",
    complianceBadgeTitle: "Em Conformidade",
  },

  loginFeatures: [
    "Gestão inteligente de leitos em tempo real",
    "Visão completa do paciente em um clique",
    "Mapeamento de cuidados intensivos",
    "Conformidade LGPD e CFM 1.821/2007",
  ],

  admin: {
    panelPassword: "BIGHELP2025",
  },

  print: {
    documentFooter: (date: string, time: string) =>
      `Documento gerado automaticamente • ${date} às ${time}`,
    confidentialityText: "Documento Confidencial",
    systemLabel: "BigHelp Map - Mapa de Cuidados Intensivos",
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
