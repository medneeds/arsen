/**
 * Configuração White-Label Centralizada - AXIUS
 * 
 * Este arquivo centraliza TODAS as constantes de branding e identidade visual
 * do sistema. Para criar um white-label, basta alterar os valores aqui.
 */

// ─── LOGOS ────────────────────────────────────────────────────────────────────
// TODO: Substituir pelos logos reais da instituição Axius
// Por enquanto, usamos placeholders (os mesmos assets existentes serão substituídos)
import networkFullLogo from "@/assets/axius-logo-full.png";
import networkCompactLogo from "@/assets/axius-logo-compact.png";
import hospitalLogo from "@/assets/axius-hospital-icon.png";

// ─── CONFIGURAÇÃO PRINCIPAL ──────────────────────────────────────────────────

export const whitelabel = {
  // ── Identidade da Plataforma ──
  platform: {
    name: "Axius",
    version: "1.0",
    fullName: "Axius 1.0",
    slogan: "Onde cada decisão transforma o cuidado em resultado.",
    loadingText: "Iniciando",
  },

  // ── Identidade da Rede/Instituição ──
  institution: {
    networkName: "Axius Health",
    networkShortName: "Axius",
    hospitalName: "Hospital Central",
    networkLogoAlt: "Axius Health",
    hospitalLogoAlt: "Hospital Central",
  },

  // ── Logos ──
  logos: {
    networkFull: networkFullLogo,
    networkCompact: networkCompactLogo,
    hospital: hospitalLogo,
  },

  // ── Cores do Tema (gradiente principal) ──
  theme: {
    gradientFrom: "#0f172a",
    gradientVia: "#1e293b",
    gradientTo: "#334155",
    bgGradient: "bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155]",
  },

  // ── Créditos / Rodapé ──
  credits: {
    developerName: "Axius Health",
    developerLabel: "Desenvolvido por",
    authorSignature: "Axius Health Tech",
    footerText: "Axius Health Tech",
  },

  // ── Conformidade / Legal ──
  compliance: {
    legalReferences: "Lei 13.709/2018 (LGPD) • CFM 1.821/2007",
    systemNameInTerms: "Axius",
    complianceBadgeTitle: "Em Conformidade",
  },

  // ── Funcionalidades da Tela de Login ──
  loginFeatures: [
    "Gestão inteligente de leitos em tempo real",
    "Visão completa do paciente em um clique",
    "IA integrada para suporte à decisão clínica",
    "Conformidade LGPD e CFM 1.821/2007",
  ],

  // ── Senha do Painel Admin ──
  admin: {
    panelPassword: "AXIUS2025",
  },

  // ── Documentos Impressos ──
  print: {
    documentFooter: (date: string, time: string) =>
      `Documento gerado automaticamente • ${date} às ${time}`,
    confidentialityText: "Documento Confidencial",
    systemLabel: "Axius - Sistema de Gestão Hospitalar",
  },
} as const;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

export function getMainPageTitle(hospitalName?: string): string {
  return `Mapa de Pacientes - ${hospitalName || whitelabel.institution.hospitalName}`;
}

export function getPrintTitle(sectionName: string, hospitalName?: string): string {
  return `${sectionName} - ${hospitalName || whitelabel.institution.hospitalName}`;
}

export function getConfidentialityFooter(hospitalName?: string): string {
  return `${hospitalName || whitelabel.institution.hospitalName} • ${whitelabel.print.confidentialityText}`;
}
