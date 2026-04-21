import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Search,
  Shield,
  Zap,
  Syringe,
  AlertTriangle,
  Wind,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CARE_OPTIONS,
  CARE_PROFILES,
  type CareProfile,
  type MedicationEntry,
} from "@/data/medicationsDatabase";

const PROFILE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield,
  Zap,
  Syringe,
  AlertTriangle,
  Wind,
  ClipboardList,
};

interface CareCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem: (entry: MedicationEntry) => void;
  onApplyProfile: (profile: CareProfile) => void;
  appliedProfileIds: Set<string>;
  patientName?: string;
}

/**
 * Diálogo dedicado a CUIDADOS de suporte assistencial.
 * NÃO inclui medicação, antimicrobianos, exames ou prescrição farmacológica.
 * Mostra:
 *  - Catálogo enxuto (10 itens) — sinais vitais, decúbito, fisio, fono, curativos, etc.
 *  - Perfis especializados (Neurocrítico, Pós-Op médio/grande porte, Sepse, VM, Paliativos, Geral)
 */
export function CareCatalogDialog({
  open,
  onOpenChange,
  onAddItem,
  onApplyProfile,
  appliedProfileIds,
  patientName,
}: CareCatalogDialogProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"rapido" | "perfis">("rapido");

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CARE_OPTIONS;
    return CARE_OPTIONS.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col">
        <DialogHeader className="space-y-2 pb-3 border-b">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-bold tracking-wide">
                Cuidados de suporte
              </DialogTitle>
              {patientName && (
                <p className="text-sm font-semibold text-foreground mt-0.5 tracking-wide">
                  {patientName}
                </p>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs tracking-wider text-muted-foreground">
            Apenas suporte assistencial — sinais vitais, decúbito, fisio, fono, curativos, comunicação. Não inclui medicação, antibióticos ou exames.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          <button
            type="button"
            onClick={() => setTab("rapido")}
            className={cn(
              "px-3 py-2 text-xs font-semibold tracking-wide border-b-2 transition-colors",
              tab === "rapido"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Cuidados rápidos
            <Badge variant="secondary" className="ml-2 h-4 text-[9px] px-1.5">
              {CARE_OPTIONS.length}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setTab("perfis")}
            className={cn(
              "px-3 py-2 text-xs font-semibold tracking-wide border-b-2 transition-colors",
              tab === "perfis"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Perfis especializados
            <Badge variant="secondary" className="ml-2 h-4 text-[9px] px-1.5">
              {CARE_PROFILES.length}
            </Badge>
          </button>
        </div>

        {tab === "rapido" ? (
          <>
            <div className="relative pt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cuidado (ex: decúbito, fisioterapia, curativo)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <ScrollArea className="flex-1 max-h-[400px]">
              <div className="space-y-1 pr-2 py-1">
                {filteredOptions.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Nenhum cuidado encontrado
                  </div>
                ) : (
                  filteredOptions.map((care) => (
                    <button
                      key={care.id}
                      type="button"
                      onClick={() => {
                        onAddItem(care);
                      }}
                      className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/40 bg-card/50 hover:bg-amber-50 dark:hover:bg-amber-950/20 hover:border-amber-300/50 transition-all text-left"
                    >
                      <ClipboardList className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium uppercase tracking-wide truncate">
                          {care.name}
                        </p>
                        {care.defaultPosology && care.defaultPosology !== "-" && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {care.defaultPosology}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        + Adicionar
                      </span>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <ScrollArea className="flex-1 max-h-[440px]">
            <div className="space-y-2 pr-2 py-1">
              {CARE_PROFILES.map((profile) => {
                const Icon = PROFILE_ICONS[profile.icon] ?? ClipboardList;
                const applied = appliedProfileIds.has(profile.id);
                const totalItems = profile.items.length + profile.extraItems.length;
                return (
                  <div
                    key={profile.id}
                    className={cn(
                      "p-3 rounded-xl border bg-card/50 transition-all",
                      applied
                        ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10"
                        : "border-border/40 hover:border-amber-300/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold tracking-wide">
                              {profile.label}
                            </p>
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                              {totalItems} itens
                            </Badge>
                            {applied && (
                              <Badge
                                variant="outline"
                                className="text-[9px] h-4 px-1.5 border-amber-400 text-amber-600"
                              >
                                <Check className="h-2.5 w-2.5 mr-0.5" /> Aplicado
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {profile.description}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={applied ? "outline" : "default"}
                        className="h-7 text-[11px] shrink-0"
                        onClick={() => onApplyProfile(profile)}
                      >
                        {applied ? "Reaplicar" : "Aplicar"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="pt-3 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="uppercase text-xs"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
