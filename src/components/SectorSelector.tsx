import { useNavigate } from "react-router-dom";
import { ChevronDown, BedDouble, Check, ChevronRight, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDepartment, type Department } from "@/contexts/DepartmentContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useMemo } from "react";

interface SectorGroup {
  group: string;
  sectors: { name: string; department: Department; link?: string }[];
}

const SECTOR_HIERARCHY: SectorGroup[] = [
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
    group: "Anexo Vascular",
    sectors: [
      { name: "Enf. Vascular", department: "ENFERMARIA VASCULAR" as Department },
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

interface SectorSelectorProps {
  /** Visual variant: light for body, dark for header */
  variant?: "light" | "dark";
}

export function SectorSelector({ variant = "light" }: SectorSelectorProps) {
  const navigate = useNavigate();
  const { currentDepartment, currentSectorLabel, setCurrentDepartment } = useDepartment();
  const { role } = useAuth();
  const [open, setOpen] = useState(false);

  // Perfil Gestor enxerga visão consolidada — opção "Todos os setores" disponível
  const accessProfile =
    typeof window !== "undefined" ? localStorage.getItem("access_profile") : null;
  const isGestor = role === "admin" || accessProfile === "gestor";

  // Determine which group contains the active sector — open it by default
  const activeGroupName = useMemo(() => {
    const found = SECTOR_HIERARCHY.find((g) =>
      g.sectors.some((s) => s.department === currentDepartment)
    );
    return found?.group ?? SECTOR_HIERARCHY[0].group;
  }, [currentDepartment]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    [activeGroupName]: true,
  }));

  const toggleGroup = (group: string) => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const handleSelect = (department: Department, link?: string) => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("gestor_sector_filter");
    }
    setCurrentDepartment(department);
    navigate(link || "/mapa");
    setOpen(false);
  };

  const handleSelectAll = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gestor_sector_filter", "ALL");
    }
    navigate("/painel-gestor");
    setOpen(false);
  };

  const allActive =
    typeof window !== "undefined" &&
    localStorage.getItem("gestor_sector_filter") === "ALL";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold uppercase tracking-wide transition-all duration-200 border",
            variant === "dark"
              ? "bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/30"
              : "bg-background text-foreground border-border hover:bg-muted hover:border-primary/40 shadow-sm"
          )}
        >
          <BedDouble className={cn("h-3.5 w-3.5", variant === "dark" ? "text-white/80" : "text-primary")} />
          <span className="truncate max-w-[140px]">
            {allActive ? "Todos os setores" : currentSectorLabel || "Selecionar setor"}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180", variant === "dark" ? "text-white/60" : "text-muted-foreground")} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-72 p-0 border-border/60 shadow-lg"
      >
        <div className="px-3 py-2.5 border-b border-border/60 bg-muted/40">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Trocar de setor
          </p>
        </div>
        {isGestor && (
          <div className="p-1.5 border-b border-border/60">
            <button
              type="button"
              onClick={handleSelectAll}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-[11px] font-semibold transition-all",
                allActive
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <LayoutGrid className={cn("h-3.5 w-3.5 flex-shrink-0", allActive ? "text-primary" : "text-muted-foreground")} />
                <span className="uppercase tracking-wide">Todos os setores</span>
              </div>
              {allActive && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
            </button>
            <p className="text-[9px] text-muted-foreground/70 mt-1 px-1">
              Visão consolidada — Painel do Gestor
            </p>
          </div>
        )}
        <ScrollArea className="max-h-[60vh]">
          <div className="p-1.5">
            {SECTOR_HIERARCHY.map((group) => {
              const isGroupOpen = openGroups[group.group] ?? false;
              const groupHasActive = group.sectors.some((s) => s.department === currentDepartment);
              const activeCount = groupHasActive ? 1 : 0;

              return (
                <Collapsible
                  key={group.group}
                  open={isGroupOpen}
                  onOpenChange={() => toggleGroup(group.group)}
                  className="mb-0.5 last:mb-0"
                >
                  <CollapsibleTrigger
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md transition-colors",
                      groupHasActive ? "bg-primary/5" : "hover:bg-muted/60"
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 text-muted-foreground transition-transform flex-shrink-0",
                          isGroupOpen && "rotate-90"
                        )}
                      />
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-[0.14em] truncate",
                          groupHasActive ? "text-primary" : "text-muted-foreground/80"
                        )}
                      >
                        {group.group}
                      </span>
                    </div>
                    <span className="text-[9px] font-semibold text-muted-foreground/60 tabular-nums">
                      {activeCount > 0 ? `${activeCount}/${group.sectors.length}` : group.sectors.length}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    <div className="grid grid-cols-1 gap-0.5 pl-4 pr-1 pt-0.5 pb-1">
                      {group.sectors.map((sector) => {
                        const isActive = currentDepartment === sector.department;
                        return (
                          <button
                            key={sector.name}
                            type="button"
                            onClick={() => handleSelect(sector.department, sector.link)}
                            className={cn(
                              "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150 text-left",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-foreground hover:bg-muted"
                            )}
                          >
                            <span className="truncate">{sector.name}</span>
                            {isActive && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
