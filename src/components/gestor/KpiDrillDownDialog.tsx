import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface DrillDownRow {
  id: string;
  primary: string;
  secondary?: string;
  tertiary?: string;
  badge?: { label: string; variant?: "default" | "secondary" | "destructive" | "outline" };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  rows: DrillDownRow[];
  emptyLabel?: string;
}

/**
 * Modal padrão para drill-down de KPI no Painel do Gestor.
 * Mostra a lista subjacente que compõe o número do card.
 */
export function KpiDrillDownDialog({
  open, onOpenChange, title, description, icon: Icon, iconColor, iconBg, rows, emptyLabel = "Sem dados para exibir.",
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            {Icon && (
              <span className={cn("h-8 w-8 rounded-lg flex items-center justify-center", iconBg)}>
                <Icon className={cn("h-4 w-4", iconColor)} />
              </span>
            )}
            <span>{title}</span>
            <Badge variant="secondary" className="ml-auto text-[11px]">
              {rows.length} {rows.length === 1 ? "item" : "itens"}
            </Badge>
          </DialogTitle>
          {description && (
            <DialogDescription className="text-xs preserve-case">{description}</DialogDescription>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12 preserve-case">{emptyLabel}</p>
          ) : (
            <ul className="space-y-1.5 py-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-card px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{row.primary}</p>
                    {row.secondary && (
                      <p className="text-xs text-muted-foreground mt-0.5 preserve-case">{row.secondary}</p>
                    )}
                    {row.tertiary && (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5 preserve-case line-clamp-2">{row.tertiary}</p>
                    )}
                  </div>
                  {row.badge && (
                    <Badge variant={row.badge.variant || "outline"} className="text-[10px] shrink-0">
                      {row.badge.label}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
