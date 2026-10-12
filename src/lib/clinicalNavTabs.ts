import { Home, LayoutDashboard, ClipboardCheck } from "lucide-react";

/**
 * Fonte unica de icone e nome dos atalhos Inicio / Mapa de leitos / Painel clinico.
 * O cabecalho e o padrao; a sidebar esquerda (AppSidebar) le daqui para espelha-lo.
 * `short` e o rotulo curto usado onde falta largura (sidebar expandida).
 */
export const CLINICAL_NAV_TABS = [
  { label: "Início", short: "Início", path: "/", icon: Home },
  { label: "Mapa de leitos", short: "Mapa", path: "/mapa", icon: LayoutDashboard },
  { label: "Painel clínico", short: "Painel", path: "/painel-clinico", icon: ClipboardCheck },
] as const;
