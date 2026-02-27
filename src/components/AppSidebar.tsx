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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { whitelabel } from "@/config/whitelabel";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePendingPasswordResets } from "@/hooks/usePendingPasswordResets";


export function AppSidebar({ 
  onOpenHandover
}: { 
  onOpenHandover?: () => void;
}) {
  const { open, setOpen, openMobile, setOpenMobile, state } = useSidebar();
  const navigate = useNavigate();
  const { signOut, user, role } = useAuth();
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

  const allMenuItems = [
    {
      title: "MAPA UTI 2",
      icon: LayoutDashboard,
      link: "/",
    },
    {
      title: "PACIENTES",
      icon: Users,
      items: [
        { name: "MOVIMENTAÇÕES", link: "/movements" },
        { name: "HISTÓRICO", link: "/internment-history" },
      ],
    },
    {
      title: "VERSÕES",
      icon: History,
      link: "/versions",
    },
  ];

  // Filtra itens de menu baseado no papel do usuário
  const menuItems = isDoorUser 
    ? allMenuItems.filter(item => item.title === "MAPA" || item.title === "EXAMINUS AI")
    : allMenuItems;

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
      <SidebarHeader className="border-b border-border/30 px-3 py-3 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center flex-1">
            {!isCollapsed ? (
              <img 
                src={whitelabel.logos.networkCompact} 
                alt={whitelabel.institution.networkLogoAlt} 
                className="w-full h-auto max-h-14 object-contain animate-fade-in"
              />
            ) : (
              <img 
                src={whitelabel.logos.networkCompact} 
                alt={whitelabel.institution.networkShortName} 
                className="w-8 h-8 object-contain"
              />
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
              className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
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
                        "transition-all duration-200 hover:bg-accent/80 hover:scale-105",
                        "justify-start px-4 py-3 h-auto",
                        "border-b border-border/50"
                      )}
                    >
                      <section.icon className="h-5 w-5 text-primary transition-all duration-200" />
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground">
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
              defaultOpen={true}
              className="group/collapsible"
            >
              <SidebarGroup className="py-0 my-0">
                  <CollapsibleTrigger className="w-full">
                    <SidebarGroupLabel 
                      className={cn(
                        "transition-all duration-200 hover:bg-accent/80 cursor-pointer !opacity-100 !mt-0",
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
                          <span className="text-xs font-medium uppercase tracking-wide text-foreground flex-1 text-left">
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
                                    className="group/item hover:bg-accent/80 hover:border-l-2 hover:border-l-primary/50 transition-all duration-200 uppercase text-[11px] rounded-lg hover:shadow-sm cursor-pointer gap-3 mb-1 justify-between"
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
                                        className="group/subitem hover:bg-accent/60 transition-all duration-200 uppercase text-[10px] rounded-lg cursor-pointer gap-2 hover:translate-x-1 mb-1"
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
                                        className="group/item hover:bg-accent/80 hover:border-l-2 hover:border-l-primary/50 transition-all duration-200 uppercase text-[11px] rounded-lg hover:shadow-sm cursor-pointer gap-3 hover:translate-x-1 mb-1"
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
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-3 bg-muted/30">
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
            <DrawerTitle className="text-center text-sm font-semibold uppercase tracking-wide">Menu de Navegação</DrawerTitle>
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
        className="border-r border-border bg-card transition-all duration-300 data-[state=collapsed]:w-[72px]"
      >
        {sidebarContent}
        {isCollapsed && (
          <div className="flex justify-center py-2 border-t border-border/30">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(true)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Expandir menu"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
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
