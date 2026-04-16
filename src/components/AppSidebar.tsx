import {
  FileSearch,
  Users,
  BookOpen,
  LogOut,
  ClipboardCheck,
  LayoutDashboard,
  History,
  User,
  FolderOpen,
  Sparkles,
  BarChart3,
  LockKeyhole,
  Shield,
  Bell,
  PanelLeftClose,
  PanelLeft,
  Stethoscope,
  Brain,
  Moon,
  Sun,
  HeartPulse,
  Activity,
  Utensils,
  Dumbbell,
  HandHeart,
  BrainCircuit,
  Ear,
  BedDouble,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { whitelabel } from "@/config/whitelabel";
import { BigHelpLogo } from "./BigHelpLogo";
import socorraoCrossLogo from "@/assets/socorrao-cross-logo.png";
import { useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartment, type Department } from "@/contexts/DepartmentContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePendingPasswordResets } from "@/hooks/usePendingPasswordResets";
import { useTheme } from "next-themes";

function ThemeToggleInline() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="h-7 w-7 text-muted-foreground hover:text-foreground"
      title={theme === "dark" ? "Modo claro" : "Modo escuro"}
    >
      <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}


export function AppSidebar({ 
  onOpenHandover
}: { 
  onOpenHandover?: () => void;
}) {
  const { open, setOpen, openMobile, setOpenMobile, state } = useSidebar();
  const navigate = useNavigate();
  const { signOut, user, role } = useAuth();
  const { currentDepartment, setCurrentDepartment } = useDepartment();
  const isMobile = useIsMobile();
  const isCollapsed = state === "collapsed";
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  
  // Hook for pending password reset requests
  const { pendingCount: pendingResets } = usePendingPasswordResets();
  
  // Check if user is COORDENADOR
  const isCoordinator = user?.email === "coordenador@sistema.local";
  
  // Check if user is Gestor Master (full access without password)
  const isGestorMaster = user?.email === "artur.batista@sistema.local";
  
  // Check if user is BIGDOOR (porta role)
  const isDoorUser = role === "porta";

  // Access profile from localStorage
  const accessProfile = typeof window !== 'undefined' ? localStorage.getItem("access_profile") || "medico" : "medico";

  // ── Menu structure with per-item profile visibility ──
  // Profiles: medico, gestor, multi, administrativo
  // "porta" and "visitante" roles get special handling below
  // Sector hierarchy definition
  const sectorHierarchy = [
    {
      group: "Enfermarias",
      sectors: [
        { name: "Neuro 01", department: "NEURO 01" as Department },
        { name: "Neuro 02", department: "NEURO 02" as Department },
        { name: "Clínica Cirúrgica", department: "CLÍNICA CIRÚRGICA" as Department },
        { name: "Enf. Transição", department: "ENFERMARIA DE TRANSIÇÃO" as Department },
        { name: "UCC", department: "UCC" as Department },
      ],
    },
    {
      group: "UTI",
      sectors: [
        { name: "UTI 1", department: "UTI 1" as Department },
        { name: "UTI 2", department: "UTI 2" as Department },
      ],
    },
    {
      group: "UCI",
      sectors: [
        { name: "UCI 1", department: "UCI 1" as Department },
        { name: "UCI 2", department: "UCI 2" as Department },
      ],
    },
    {
      group: "Urgência e Emergência",
      sectors: [
        { name: "UE Vertical", department: "UE VERTICAL" as Department, link: "/ue-vertical" },
        { name: "UE Horizontal", department: "UE HORIZONTAL" as Department, link: "/ue-horizontal" },
        { name: "Sala Vermelha", department: "SALA VERMELHA" as Department },
        { name: "Sala Laranja", department: "SALA LARANJA" as Department },
        { name: "Internação UE", department: "INTERNAÇÃO UE" as Department },
        { name: "Observação Clínica", department: "OBSERVAÇÃO CLÍNICA" as Department },
      ],
    },
    {
      group: "Enf. Vascular (Anexo)",
      sectors: [
        { name: "Enfermaria Vascular", department: "ENFERMARIA VASCULAR" as Department },
        { name: "RIV", department: "RIV" as Department },
      ],
    },
    {
      group: "Centro Cirúrgico",
      sectors: [
        { name: "Preparo", department: "CC PREPARO" as Department },
        { name: "Bloco Cirúrgico", department: "CC BLOCO CIRÚRGICO" as Department },
        { name: "RPA", department: "CC RPA" as Department },
      ],
    },
  ];

  const handleSectorClick = (department: Department, customLink?: string) => {
    setCurrentDepartment(department); // context auto-syncs localStorage
    navigate(customLink || "/mapa");
    if (isMobile) setOpenMobile(false);
  };

  const allMenuItems = [
    {
      title: "Início",
      icon: LayoutDashboard,
      link: "/",
      profiles: ["medico", "gestor"],
    },
    {
      title: "Painel do Gestor",
      icon: BarChart3,
      link: "/painel-gestor",
      profiles: ["gestor"],
    },
    {
      title: "Emergência",
      icon: Activity,
      link: "/emergencia",
      profiles: ["gestor"],
    },
    {
      title: "Monitoramento",
      icon: HeartPulse,
      link: "/monitoramento",
      profiles: ["gestor"],
    },
    {
      title: "Documentos",
      icon: FolderOpen,
      profiles: ["medico", "gestor"],
      items: [
        { name: "Round", link: "/round", profiles: ["medico", "gestor"] },
        { name: "Hemoderivados", link: "/hemoderivados", profiles: ["medico", "gestor"] },
        { name: "Relatório", link: "/relatorio", profiles: ["medico", "gestor"] },
        { name: "Regulação", link: "/regulacoes", profiles: ["medico", "gestor"] },
        { name: "Alta e Desfecho", link: "/alta-desfecho", profiles: ["medico", "gestor"] },
      ],
    },
    {
      title: "Protocolos",
      icon: Stethoscope,
      profiles: ["medico", "gestor"],
      items: [
        { name: "Protocolos UTI", link: "/protocolos-uti", profiles: ["medico", "gestor"] },
        { name: "SAPS 3", link: "/saps3", profiles: ["medico", "gestor"] },
      ],
    },
    {
      title: "Assistente Clínico",
      icon: Brain,
      profiles: ["medico", "gestor"],
      items: [
        { name: "Validação Farmacêutica", link: "/validacao-farmaceutica", profiles: ["gestor"] },
        { name: "Catálogo de Medicamentos", link: "/catalogo-medicamentos", profiles: ["gestor"] },
        { name: "Examinus AI", link: "/ia", profiles: ["medico", "gestor"] },
      ],
    },
  ];

  // ── Build filtered menu based on role + profile ──
  const buildFilteredMenu = () => {
    // Porta: minimal access
    if (isDoorUser) {
      return [
        { title: "Mapa", icon: LayoutDashboard, link: "/", profiles: ["medico"] },
        { title: "Assistente Clínico", icon: Brain, profiles: ["medico"], items: [
          { name: "Examinus AI", link: "/ia", profiles: ["medico"] },
        ]},
      ];
    }
    // Visitante: read-only map
    if (role === "visitante") {
      return [
        { title: "Mapa", icon: LayoutDashboard, link: "/", profiles: ["medico"] },
      ];
    }
    // Farmácia: pharmacy-specific environment
    if (role === "farmacia" || accessProfile === "farmacia") {
      return [
        { title: "Mapa", icon: LayoutDashboard, link: "/", profiles: ["farmacia"] },
        { title: "Validação Farmacêutica", icon: ClipboardCheck, link: "/validacao-farmaceutica", profiles: ["farmacia"] },
        { title: "Catálogo de Medicamentos", icon: BookOpen, link: "/catalogo-medicamentos", profiles: ["farmacia"] },
        { title: "Assistente Clínico", icon: Brain, profiles: ["farmacia"], items: [
          { name: "Examinus AI", link: "/ia", profiles: ["farmacia"] },
        ]},
      ];
    }
    // Imagem
    if (accessProfile === "imagem") {
      return [
        { title: "Painel de Imagem", icon: LayoutDashboard, link: "/setor-imagem", profiles: ["imagem"] },
      ];
    }
    // Laboratorio
    if (accessProfile === "laboratorio") {
      return [
        { title: "Painel Laboratorial", icon: LayoutDashboard, link: "/setor-laboratorio", profiles: ["laboratorio"] },
      ];
    }
    // CCIH
    if (accessProfile === "ccih") {
      return [
        { title: "Painel CCIH", icon: LayoutDashboard, link: "/ccih", profiles: ["ccih"] },
      ];
    }
    // NIR
    if (accessProfile === "nir") {
      return [
        { title: "Painel NIR", icon: LayoutDashboard, link: "/nir", profiles: ["nir"] },
      ];
    }
    // Administrativo
    if (accessProfile === "administrativo") {
      return [
        { title: "Recepção", icon: LayoutDashboard, link: "/recepcao", profiles: ["administrativo"] },
      ];
    }
    // Equipe Multi: dedicated sidebar with all specialties
    if (accessProfile === "multi") {
      return [
        { title: "Fila de Triagem", icon: Users, link: "/triagem-fila", profiles: ["multi"] },
        { title: "Equipe Multi", icon: HeartPulse, profiles: ["multi"], items: [
          { name: "Enfermagem", link: "/triagem-fila", profiles: ["multi"], badge: "Ativo" },
          { name: "Nutrição", link: "/triagem-fila", profiles: ["multi"], badge: "Em breve" },
          { name: "Fisioterapia", link: "/triagem-fila", profiles: ["multi"], badge: "Em breve" },
          { name: "Serviço Social", link: "/triagem-fila", profiles: ["multi"], badge: "Em breve" },
          { name: "Psicologia", link: "/triagem-fila", profiles: ["multi"], badge: "Em breve" },
          { name: "Fonoaudiologia", link: "/triagem-fila", profiles: ["multi"], badge: "Em breve" },
        ]},
        { title: "Leitos", icon: BedDouble, link: "/mapa", profiles: ["multi"], badge: "Em breve" },
      ];
    }
    // Filter sections by profile, then filter sub-items within each section
    return allMenuItems
      .filter(section => !section.profiles || section.profiles.includes(accessProfile))
      .map(section => {
        if (!section.items) return section;
        const filteredItems = section.items.filter(
          (item: any) => !item.profiles || item.profiles.includes(accessProfile)
        );
        if (filteredItems.length === 0) return null;
        return { ...section, items: filteredItems };
      })
      .filter(Boolean) as typeof allMenuItems;
  };

  const menuItems = buildFilteredMenu();

  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [unlockedSections, setUnlockedSections] = useState<string[]>([]);
  const [adminSectionOpen, setAdminSectionOpen] = useState<Record<string, boolean>>({});

  const handleAdminSectionClick = (sectionTitle: string) => {
    // Gestor Master has instant access without password
    if (isGestorMaster) {
      if (!unlockedSections.includes(sectionTitle)) {
        setUnlockedSections(prev => [...prev, sectionTitle]);
      }
      return;
    }
    setSelectedSection(sectionTitle);
    setShowPasswordDialog(true);
  };

  const handlePasswordSubmit = () => {
    if (password === whitelabel.admin.panelPassword) {
      // Unlock the section
      if (selectedSection && !unlockedSections.includes(selectedSection)) {
        setUnlockedSections(prev => [...prev, selectedSection]);
      }
      
      setShowPasswordDialog(false);
      setPassword("");
      setSelectedSection(null);
      
      // If there was a pending navigation (from clicking a subitem), navigate to it
      if (pendingNavigation) {
        navigate(pendingNavigation);
        setPendingNavigation(null);
      }
      
      if (isMobile) {
        setOpenMobile(false);
      }
      
      toast.success("Acesso ao Painel Admin liberado");
    } else {
      toast.error("Senha incorreta");
      setPassword("");
    }
  };

  const handleItemClick = (item: string | { name: string; link?: string | null; action?: string; subsections?: any[] }, parentSection?: any) => {
    // Check if parent section requires password (Gestor Master bypasses)
    if (parentSection?.requiresPassword && !isGestorMaster) {
      setPendingNavigation(typeof item === 'string' ? item : (item.link || null));
      setSelectedSection(parentSection.title);
      setShowPasswordDialog(true);
      return;
    }
    // Handle direct string links (like from section.link)
    if (typeof item === 'string') {
      navigate(item);
      if (isMobile) {
        setOpenMobile(false);
      }
      return;
    }
    
    // Handle object items
    if (typeof item === 'object') {
      // Skip if item has subsections (it's a collapsible parent)
      if (item.subsections) {
        return;
      }
      
      if (item.action === 'openHandover' && onOpenHandover) {
        onOpenHandover();
        if (isMobile) {
          setOpenMobile(false);
        }
      } else if (item.action === 'openSepsisProtocol') {
        navigate('/sepsis-protocol');
        if (isMobile) {
          setOpenMobile(false);
        }
      } else if (item.link) {
        navigate(item.link);
        if (isMobile) {
          setOpenMobile(false);
        }
      }
    }
  };

  const sidebarContent = (
    <>
      <SidebarHeader className="border-b border-border/50 px-3 py-3 bg-gradient-to-b from-card to-muted/20">
        <div className="flex items-center justify-between gap-2">
          <div className={cn(
            "flex items-center flex-1 min-w-0",
            isCollapsed ? "justify-center" : "justify-start gap-2.5"
          )}>
            <div className={cn(
              "relative flex items-center justify-center rounded-lg overflow-hidden flex-shrink-0",
              "bg-white dark:bg-white/95 dark:ring-1 dark:ring-white/20",
              "shadow-sm dark:shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]",
              isCollapsed ? "h-9 w-9 p-1" : "h-10 w-10 p-1"
            )}>
              <img
                src={socorraoCrossLogo}
                alt={whitelabel.institution.hospitalLogoAlt}
                className="h-full w-full object-contain"
                draggable={false}
              />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-foreground uppercase truncate">
                  {whitelabel.institution.hospitalAbbreviation}
                </span>
                <span className="text-[9px] font-medium tracking-wider text-muted-foreground uppercase truncate">
                  {whitelabel.institution.hospitalShortName}
                </span>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
              title="Retrair menu"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {menuItems.map((section, index) => (
          <div key={section.title}>
            {/* Direct link item (without subitems) */}
            {section.link && !section.items && (
              <SidebarGroup className="py-0 my-0">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleItemClick(section.link)}
                      className={cn(
                        "transition-all duration-200 hover:bg-primary/8 hover:scale-105",
                        "justify-start px-4 py-3 h-auto",
                        "border-b border-border/50"
                      )}
                    >
                      <section.icon className="h-5 w-5 text-primary transition-all duration-200" />
                      <span className="text-xs font-medium tracking-wide text-foreground">
                        {section.title}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            )}

            {/* Collapsible section (with subitems) */}
            {section.items && (
            <Collapsible
              defaultOpen={false}
              className="group/collapsible"
            >
              <SidebarGroup className="py-0 my-0">
                  <CollapsibleTrigger className="w-full">
                    <SidebarGroupLabel 
                      className={cn(
                        "transition-all duration-200 hover:bg-primary/8 cursor-pointer !opacity-100 !mt-0",
                        isCollapsed ? "justify-center px-2 py-3" : "justify-between px-4 py-3 hover:scale-105",
                        "h-auto border-b border-border/50"
                      )}
                    >
                    <div className={cn(
                      "flex items-center w-full",
                      isCollapsed ? "justify-center" : "gap-3"
                    )}>
                      <section.icon className={cn(
                        "text-primary transition-all duration-200",
                        isCollapsed ? "h-5 w-5" : "h-5 w-5"
                      )} />
                      {!isCollapsed && (
                        <>
                          <span className="text-xs font-medium tracking-wide text-foreground flex-1 text-left">
                            {section.title}
                          </span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                        </>
                      )}
                    </div>
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent className="transition-all duration-300 data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                  <SidebarGroupContent className="px-2">
                    <SidebarMenu>
                      {section.items.map((item, itemIndex) => {
                        const itemName = typeof item === 'string' ? item : item.name;
                        const itemKey = typeof item === 'string' ? item : item.name;
                        const hasSubsections = typeof item === 'object' && 'subsections' in item && item.subsections;
                        
                        // If item has subsections, render as nested collapsible
                        if (hasSubsections) {
                          return (
                            <Collapsible key={itemKey} className="group/nested">
                              <CollapsibleTrigger className="w-full">
                                <SidebarMenuItem>
                                  <SidebarMenuButton
                                    className="group/item hover:bg-primary/8 hover:border-l-2 hover:border-l-primary/50 transition-all duration-200 text-[11px] rounded-lg hover:shadow-sm cursor-pointer gap-3 mb-1 justify-between"
                                    tooltip={itemName}
                                  >
                                    <div className="flex items-center gap-3 flex-1">
                                      <div className="rounded-full bg-primary/20 transition-all duration-200 group-hover/item:scale-150 flex-shrink-0 h-2 w-2 ml-1" />
                                      <span className="flex-1 text-left font-medium ml-1 animate-fade-in">
                                        {itemName}
                                      </span>
                                    </div>
                                    <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]/nested:rotate-180 mr-2" />
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="transition-all duration-300 data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                                <SidebarMenu className="ml-4 border-l border-border/30 pl-2">
                                  {item.subsections && Array.isArray(item.subsections) && item.subsections.map((subitem: any) => (
                                    <SidebarMenuItem key={subitem.name}>
                                      <SidebarMenuButton
                                        className="group/subitem hover:bg-primary/5 transition-all duration-200 text-[10px] rounded-lg cursor-pointer gap-2 hover:translate-x-1 mb-1"
                                        tooltip={subitem.name}
                                        onClick={() => handleItemClick(subitem)}
                                      >
                                        <div className="rounded-full bg-primary/10 transition-all duration-200 group-hover/subitem:scale-150 flex-shrink-0 h-1.5 w-1.5" />
                                        <span className="flex-1 text-left font-normal animate-fade-in">
                                          {subitem.name}
                                        </span>
                                      </SidebarMenuButton>
                                    </SidebarMenuItem>
                                  ))}
                                </SidebarMenu>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        }
                        
                        // Regular item without subsections
                        const itemBadge = typeof item === 'object' && 'badge' in item ? (item as any).badge as React.ReactNode : undefined;
                        
                        return (
                          <SidebarMenuItem key={itemKey}>
                                     <SidebarMenuButton
                                        className="group/item hover:bg-primary/8 hover:border-l-2 hover:border-l-primary/50 transition-all duration-200 text-[11px] rounded-lg hover:shadow-sm cursor-pointer gap-3 hover:translate-x-1 mb-1"
                                        tooltip={itemName}
                                        onClick={() => handleItemClick(item, section)}
                                      >
                              <div className="rounded-full bg-primary/20 transition-all duration-200 group-hover/item:scale-150 flex-shrink-0 h-2 w-2 ml-1" />
                              <span className="flex-1 text-left font-medium ml-1 animate-fade-in">
                                {itemName}
                              </span>
                              {itemBadge !== undefined && (
                                <Badge 
                                  variant="destructive" 
                                  className="h-5 min-w-5 px-1.5 text-[10px] font-bold animate-pulse"
                                >
                                  {itemBadge}
                                </Badge>
                              )}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
            )}
            {index < menuItems.length - 1 && (
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-3 mx-4" />
            )}
          </div>
        ))}

        {/* ── Hierarchical Sectors Section ── */}
        {(accessProfile === "medico" || accessProfile === "gestor") && (
          <>
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-3 mx-4" />
            <Collapsible defaultOpen={true} className="group/sectors">
              <SidebarGroup className="py-0 my-0">
                <CollapsibleTrigger className="w-full">
                  <SidebarGroupLabel
                    className={cn(
                      "transition-all duration-200 hover:bg-primary/8 cursor-pointer !opacity-100 !mt-0",
                      isCollapsed ? "justify-center px-2 py-3" : "justify-between px-4 py-3 hover:scale-105",
                      "h-auto border-b border-border/50"
                    )}
                  >
                    <div className={cn("flex items-center w-full", isCollapsed ? "justify-center" : "gap-3")}>
                      <BedDouble className="h-5 w-5 text-primary transition-all duration-200" />
                      {!isCollapsed && (
                        <>
                          <span className="text-xs font-medium tracking-wide text-foreground flex-1 text-left">
                            Setores
                          </span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/sectors:rotate-180" />
                        </>
                      )}
                    </div>
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent className="transition-all duration-300 data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                  <SidebarGroupContent className="px-2">
                    <SidebarMenu>
                      {sectorHierarchy.map((entry) => {
                        // Grouped sector (e.g. UTI with UTI 1, UTI 2)
                        if ('group' in entry && entry.sectors) {
                          return (
                            <Collapsible key={entry.group} className="group/sectorgroup">
                              <CollapsibleTrigger className="w-full">
                                <SidebarMenuItem>
                                  <SidebarMenuButton
                                    className="group/item hover:bg-primary/8 hover:border-l-2 hover:border-l-primary/50 transition-all duration-200 text-[11px] rounded-lg hover:shadow-sm cursor-pointer gap-3 mb-1 justify-between"
                                    tooltip={entry.group}
                                  >
                                    <div className="flex items-center gap-3 flex-1">
                                      <div className="rounded-full bg-primary/20 transition-all duration-200 group-hover/item:scale-150 flex-shrink-0 h-2 w-2 ml-1" />
                                      <span className="flex-1 text-left font-medium ml-1 animate-fade-in">
                                        {entry.group}
                                      </span>
                                    </div>
                                    <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]/sectorgroup:rotate-180 mr-2" />
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="transition-all duration-300 data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                                <SidebarMenu className="ml-4 border-l border-border/30 pl-2">
                                  {entry.sectors.map((sector) => (
                                    <SidebarMenuItem key={sector.name}>
                                      <SidebarMenuButton
                                        className={cn(
                                          "group/subitem hover:bg-primary/5 transition-all duration-200 text-[10px] rounded-lg cursor-pointer gap-2 hover:translate-x-1 mb-1",
                                          currentDepartment === sector.department && "bg-primary/10 text-primary font-semibold"
                                        )}
                                        tooltip={sector.name}
                                        onClick={() => handleSectorClick(sector.department)}
                                      >
                                        <div className={cn(
                                          "rounded-full transition-all duration-200 group-hover/subitem:scale-150 flex-shrink-0 h-1.5 w-1.5",
                                          currentDepartment === sector.department ? "bg-primary" : "bg-primary/10"
                                        )} />
                                        <span className="flex-1 text-left animate-fade-in">
                                          {sector.name}
                                        </span>
                                      </SidebarMenuButton>
                                    </SidebarMenuItem>
                                  ))}
                                </SidebarMenu>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        }

                        // Direct sector (e.g. standalone items)
                        if (!('name' in entry) || !('department' in entry)) return null;
                        const directEntry = entry as unknown as { name: string; department: Department; link?: string };
                        return (
                          <SidebarMenuItem key={directEntry.name}>
                            <SidebarMenuButton
                              className={cn(
                                "group/item hover:bg-primary/8 hover:border-l-2 hover:border-l-primary/50 transition-all duration-200 text-[11px] rounded-lg hover:shadow-sm cursor-pointer gap-3 hover:translate-x-1 mb-1",
                                currentDepartment === directEntry.department && "bg-primary/10 text-primary font-semibold"
                              )}
                              tooltip={directEntry.name}
                              onClick={() => handleSectorClick(directEntry.department, directEntry.link)}
                            >
                              <div className={cn(
                                "rounded-full transition-all duration-200 group-hover/item:scale-150 flex-shrink-0 h-2 w-2 ml-1",
                                currentDepartment === directEntry.department ? "bg-primary" : "bg-primary/20"
                              )} />
                              <span className="flex-1 text-left font-medium ml-1 animate-fade-in">
                                {directEntry.name}
                              </span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-3 bg-muted/30 space-y-2">
        {/* Theme toggle */}
        <div className={cn(
          "flex items-center rounded-lg p-1.5 transition-all duration-200",
          isCollapsed ? "justify-center" : "justify-between bg-card/30 px-3"
        )}>
          {!isCollapsed && (
            <span className="text-[10px] text-muted-foreground font-medium">Tema</span>
          )}
          <ThemeToggleInline />
        </div>

        {/* User info + logout */}
        <div className={cn(
          "flex items-center gap-3 rounded-xl p-2 transition-all duration-200",
          isCollapsed ? "justify-center" : "bg-card/50"
        )}>
          {!isCollapsed && (
            <>
              <div className="bg-primary/10 rounded-full flex items-center justify-center h-9 w-9 flex-shrink-0">
                <User className="text-primary h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">
                  {user?.user_metadata?.username || user?.email?.split('@')[0]}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive transition-all duration-200 flex-shrink-0"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={openMobile} onOpenChange={setOpenMobile} modal={true}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b pb-3 pt-2">
            <DrawerTitle className="text-center text-sm font-semibold tracking-wide">Menu de Navegação</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 px-2">
            {sidebarContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <>
      <Sidebar 
        collapsible="icon" 
        className="border-r border-border/60 bg-card shadow-[2px_0_24px_-12px_hsl(var(--primary)/0.12)] transition-all duration-300 data-[state=collapsed]:w-[72px]"
      >
        {sidebarContent}
      </Sidebar>

      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Acesso Restrito - Painel Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Digite a senha de coordenador para acessar {selectedSection || "o Painel Admin"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Senha de coordenador"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handlePasswordSubmit();
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPassword("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePasswordSubmit}>Acessar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
