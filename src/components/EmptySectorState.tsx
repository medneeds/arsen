import { BedDouble, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptySectorStateProps {
  sectorName: string;
  sectorIcon: string;
  onAddBed?: () => void;
}

export function EmptySectorState({ sectorName, sectorIcon, onAddBed }: EmptySectorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 bg-card/50 rounded-lg border border-dashed border-border/60 animate-fade-in">
      <div className="relative mb-4">
        <div className="h-16 w-16 rounded-2xl bg-muted/80 flex items-center justify-center">
          <BedDouble className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <span className="absolute -top-1 -right-1 text-xl">{sectorIcon}</span>
      </div>
      <p className="text-sm font-medium text-muted-foreground mb-1">
        Setor vazio
      </p>
      <p className="text-xs text-muted-foreground/70 text-center max-w-[220px] mb-4">
        Nenhum paciente alocado em {sectorName}. Adicione um leito para começar.
      </p>
      {onAddBed && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAddBed}
          className="gap-1.5 text-xs hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar Leito
        </Button>
      )}
    </div>
  );
}
