import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  ClipboardList,
  Search,
  Shield,
  Zap,
  Syringe,
  AlertTriangle,
  Wind,
  Check,
  ChevronLeft,
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
  /** Adiciona em bloco itens estruturados + recomendações livres do perfil. */
  onAddBulk: (structured: MedicationEntry[], extras: string[], profile?: CareProfile) => void;
  /** Mantido por compatibilidade — aplica o perfil inteiro. */
  onApplyProfile?: (profile: CareProfile) => void;
  appliedProfileIds: Set<string>;
  patientName?: string;
}

/**
 * Diálogo dedicado a CUIDADOS de suporte assistencial.
 * Fluxo:
 *  1) Aba "Cuidados rápidos" — adicionar itens individuais.
 *  2) Aba "Perfis de Cuidados" — escolher um perfil clínico (Geral, Neurocrítico, Pós-Op, Sepse, VM, Paliativos)
 *     e marcar via checkbox os cuidados desejados, adicionando todos em bloco.
 */
export function CareCatalogDialog({
  open,
  onOpenChange,
  onAddItem,
  onAddBulk,
  appliedProfileIds,
  patientName,
}: CareCatalogDialogProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"rapido" | "perfis">("perfis");
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [selectedStructured, setSelectedStructured] = useState<Set<string>>(new Set());
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CARE_OPTIONS;
    return CARE_OPTIONS.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  const activeProfile = useMemo(
    () => CARE_PROFILES.find((p) => p.id === activeProfileId) ?? null,
    [activeProfileId],
  );

  // Quando entra em um perfil: pré-marca todos os itens.
  useEffect(() => {
    if (!activeProfile) return;
    setSelectedStructured(new Set(activeProfile.items));
    setSelectedExtras(new Set(activeProfile.extraItems));
  }, [activeProfile]);

  // Reseta estado ao fechar.
  useEffect(() => {
    if (!open) {
      setActiveProfileId(null);
      setSelectedStructured(new Set());
      setSelectedExtras(new Set());
      setSearch("");
    }
  }, [open]);

  const toggleStructured = (id: string) => {
    setSelectedStructured((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleExtra = (txt: string) => {
    setSelectedExtras((prev) => {
      const next = new Set(prev);
      if (next.has(txt)) next.delete(txt);
      else next.add(txt);
      return next;
    });
  };

  const totalSelected = selectedStructured.size + selectedExtras.size;

  const handleAddSelected = () => {
    if (!activeProfile) return;
    const structured = activeProfile.items
      .filter((id) => selectedStructured.has(id))
      .map((id) => CARE_OPTIONS.find((c) => c.id === id))
      .filter(Boolean) as MedicationEntry[];
    const extras = activeProfile.extraItems.filter((t) => selectedExtras.has(t));
    onAddBulk(structured, extras, activeProfile);
    onOpenChange(false);
  };

  const allChecked = activeProfile
    ? activeProfile.items.every((i) => selectedStructured.has(i)) &&
      activeProfile.extraItems.every((e) => selectedExtras.has(e))
    : false;
  const toggleAll = () => {
    if (!activeProfile) return;
    if (allChecked) {
      setSelectedStructured(new Set());
      setSelectedExtras(new Set());
    } else {
      setSelectedStructured(new Set(activeProfile.items));
      setSelectedExtras(new Set(activeProfile.extraItems));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[88vh] flex flex-col">
        <DialogHeader className="space-y-2 pb-3 border-b">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-bold tracking-wide uppercase">
                Assistente de Cuidados
              </DialogTitle>
              {patientName && (
                <p className="text-sm font-semibold text-foreground mt-0.5 tracking-wide uppercase">
                  {patientName}
                </p>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs tracking-wider text-muted-foreground">
            Selecione um perfil clínico e marque os cuidados desejados para prescrever em bloco. Apenas suporte assistencial — sem medicação, antibiótico ou exames.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs (escondidas quando dentro de um perfil) */}
        {!activeProfile && (
          <div className="flex gap-1 border-b">
            <button
              type="button"
              onClick={() => setTab("perfis")}
              className={cn(
                "px-3 py-2 text-xs font-semibold tracking-wide border-b-2 transition-colors uppercase",
                tab === "perfis"
                  ? "border-amber-500 text-amber-600 dark:text-amber-400"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Perfis de Cuidados
              <Badge variant="secondary" className="ml-2 h-4 text-[9px] px-1.5">
                {CARE_PROFILES.length}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setTab("rapido")}
              className={cn(
                "px-3 py-2 text-xs font-semibold tracking-wide border-b-2 transition-colors uppercase",
                tab === "rapido"
                  ? "border-amber-500 text-amber-600 dark:text-amber-400"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Cuidados rápidos
              <Badge variant="secondary" className="ml-2 h-4 text-[9px] px-1.5">
                {CARE_OPTIONS.length}
              </Badge>
            </button>
          </div>
        )}

        {/* === PERFIL ATIVO: checklist === */}
        {activeProfile ? (
          <>
            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setActiveProfileId(null)}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Trocar perfil
              </Button>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] h-5 border-amber-300 text-amber-700">
                  {activeProfile.label}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={toggleAll}
                >
                  {allChecked ? "Desmarcar todos" : "Marcar todos"}
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[460px] -mx-1">
              <div className="px-1 py-2 space-y-4">
                {/* Estruturados */}
                {activeProfile.items.length > 0 && (
                  <section>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Cuidados padronizados
                    </p>
                    <div className="space-y-1">
                      {activeProfile.items.map((id) => {
                        const care = CARE_OPTIONS.find((c) => c.id === id);
                        if (!care) return null;
                        const checked = selectedStructured.has(id);
                        return (
                          <label
                            key={id}
                            className={cn(
                              "flex items-start gap-2.5 px-2.5 py-2 rounded-md border cursor-pointer transition-all text-left",
                              checked
                                ? "border-amber-300 bg-amber-50/40 dark:bg-amber-950/15"
                                : "border-border/40 hover:bg-muted/30",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleStructured(id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-medium uppercase tracking-wide">
                                {care.name}
                              </p>
                              {care.defaultPosology && care.defaultPosology !== "-" && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {care.defaultPosology}
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Recomendações livres */}
                {activeProfile.extraItems.length > 0 && (
                  <section>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Recomendações específicas
                    </p>
                    <div className="space-y-1">
                      {activeProfile.extraItems.map((txt) => {
                        const checked = selectedExtras.has(txt);
                        return (
                          <label
                            key={txt}
                            className={cn(
                              "flex items-start gap-2.5 px-2.5 py-2 rounded-md border cursor-pointer transition-all text-left",
                              checked
                                ? "border-amber-300 bg-amber-50/40 dark:bg-amber-950/15"
                                : "border-border/40 hover:bg-muted/30",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleExtra(txt)}
                              className="mt-0.5"
                            />
                            <p className="flex-1 text-[12px] leading-snug">{txt}</p>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            </ScrollArea>
          </>
        ) : tab === "perfis" ? (
          <ScrollArea className="flex-1 max-h-[460px]">
            <div className="space-y-2 pr-2 py-2">
              {CARE_PROFILES.map((profile) => {
                const Icon = PROFILE_ICONS[profile.icon] ?? ClipboardList;
                const applied = appliedProfileIds.has(profile.id);
                const totalItems = profile.items.length + profile.extraItems.length;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setActiveProfileId(profile.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border bg-card/50 transition-all hover:border-amber-300/60 hover:shadow-sm",
                      applied
                        ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10"
                        : "border-border/40",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold tracking-wide uppercase">
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
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
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
            <ScrollArea className="flex-1 max-h-[420px]">
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
                      onClick={() => onAddItem(care)}
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
        )}

        <DialogFooter className="pt-3 border-t flex-row sm:justify-between items-center gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="uppercase text-xs"
          >
            Fechar
          </Button>
          {activeProfile && (
            <Button
              onClick={handleAddSelected}
              disabled={totalSelected === 0}
              className="uppercase text-xs bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Adicionar {totalSelected} {totalSelected === 1 ? "cuidado" : "cuidados"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
