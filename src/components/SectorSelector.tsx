import { useNavigate } from "react-router-dom";
import { ChevronDown, BedDouble, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDepartment, type Department } from "@/contexts/DepartmentContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

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
  const [open, setOpen] = useState(false);

  const handleSelect = (department: Department, link?: string) => {
    setCurrentDepartment(department);
    navigate(link || "/mapa");
    setOpen(false);
  };

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
            {currentSectorLabel || "Selecionar setor"}
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
        <ScrollArea className="max-h-[60vh]">
          <div className="p-1.5">
            {SECTOR_HIERARCHY.map((group) => (
              <div key={group.group} className="mb-1.5 last:mb-0">
                <div className="px-2 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                  {group.group}
                </div>
                <div className="grid grid-cols-1 gap-0.5">
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
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
