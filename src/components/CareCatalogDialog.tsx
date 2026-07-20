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
  Plus,
  MousePointerClick,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CARE_OPTIONS,
  CARE_PROFILES,
  type CareProfile,
  type MedicationEntry,
} from "@/data/medicationsDatabase";

type CareEntry = MedicationEntry & { group?: string };

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
  /** Adiciona em bloco itens estruturados + recomendações livres (com perfil opcional). */
  onAddBulk: (structured: MedicationEntry[], extras: string[], profile?: CareProfile) => void;
  appliedProfileIds: Set<string>;
  patientName?: string;
}

/**
 * Assistente de Cuidados — fluxo dual:
 *  - Aba "Perfis de Cuidados": escolher perfil clínico → marcar checkboxes → adicionar em bloco.
 *  - Aba "Cuidados rápidos": catálogo amplo agrupado por subcategoria.
 *      Modo "1 clique" (padrão) — clica e adiciona direto, com feedback visual.
 *      Modo "Multi-seleção"   — marca vários e adiciona todos juntos.
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

  // Perfil ativo (modo checklist)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [selectedStructured, setSelectedStructured] = useState<Set<string>>(new Set());
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());

  // Cuidados rápidos
  const [multiMode, setMultiMode] = useState(false);
  const [quickSelected, setQuickSelected] = useState<Set<string>>(new Set());
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const searchQuery = norm(search.trim());
  const isSearching = searchQuery.length > 0;

  const filteredOptions = useMemo<CareEntry[]>(() => {
    const list = CARE_OPTIONS as CareEntry[];
    if (!searchQuery) return list;
    return list.filter((c) => norm(c.name).includes(searchQuery) || norm(c.group ?? "").includes(searchQuery));
  }, [searchQuery]);

  // Agrupamento por subcategoria preservando a ordem original.
  const groupedOptions = useMemo(() => {
    const groups: { name: string; items: CareEntry[] }[] = [];
    const idx = new Map<string, number>();
    for (const c of filteredOptions) {
      const g = c.group ?? "Outros";
      if (!idx.has(g)) {
        idx.set(g, groups.length);
        groups.push({ name: g, items: [] });
      }
      groups[idx.get(g)!].items.push(c);
    }
    return groups;
  }, [filteredOptions]);

  // Busca também alcança os perfis clínicos — antes só existia dentro da aba
  // "Cuidados rápidos"; ao digitar sem ter escolhido aba/perfil, mostra
  // perfis E itens individuais que combinam, num resultado só.
  const filteredProfiles = useMemo(() => {
    if (!searchQuery) return CARE_PROFILES;
    return CARE_PROFILES.filter((p) => norm(p.label).includes(searchQuery) || norm(p.description).includes(searchQuery));
  }, [searchQuery]);

  const activeProfile = useMemo(
    () => CARE_PROFILES.find((p) => p.id === activeProfileId) ?? null,
    [activeProfileId],
  );

  // Dentro de um perfil aberto, a MESMA busca filtra os itens daquele perfil
  // (em vez de navegar pra fora) — útil em perfis com muitos itens.
  const activeProfileItemsFiltered = useMemo(() => {
    if (!activeProfile) return [];
    if (!searchQuery) return activeProfile.items;
    return activeProfile.items.filter((id) => {
      const care = CARE_OPTIONS.find((c) => c.id === id);
      return care ? norm(care.name).includes(searchQuery) : true;
    });
  }, [activeProfile, searchQuery]);
  const activeProfileExtrasFiltered = useMemo(() => {
    if (!activeProfile) return [];
    if (!searchQuery) return activeProfile.extraItems;
    return activeProfile.extraItems.filter((txt) => norm(txt).includes(searchQuery));
  }, [activeProfile, searchQuery]);

  useEffect(() => {
    if (!activeProfile) return;
    setSelectedStructured(new Set(activeProfile.items));
    setSelectedExtras(new Set(activeProfile.extraItems));
  }, [activeProfile]);

  useEffect(() => {
    if (!open) {
      setActiveProfileId(null);
      setSelectedStructured(new Set());
      setSelectedExtras(new Set());
      setSearch("");
      setMultiMode(false);
      setQuickSelected(new Set());
      setJustAdded(new Set());
    }
  }, [open]);

  // ============== HANDLERS — perfil ==============
  const toggleStructured = (id: string) =>
    setSelectedStructured((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleExtra = (txt: string) =>
    setSelectedExtras((p) => {
      const n = new Set(p);
      n.has(txt) ? n.delete(txt) : n.add(txt);
      return n;
    });
  const totalProfileSelected = selectedStructured.size + selectedExtras.size;
  const handleAddProfileSelection = () => {
    if (!activeProfile) return;
    const structured = activeProfile.items
      .filter((id) => selectedStructured.has(id))
      .map((id) => CARE_OPTIONS.find((c) => c.id === id))
      .filter(Boolean) as MedicationEntry[];
    const extras = activeProfile.extraItems.filter((t) => selectedExtras.has(t));
    onAddBulk(structured, extras, activeProfile);
    onOpenChange(false);
  };
  const allProfileChecked = activeProfile
    ? activeProfile.items.every((i) => selectedStructured.has(i)) &&
      activeProfile.extraItems.every((e) => selectedExtras.has(e))
    : false;
  const toggleAllProfile = () => {
    if (!activeProfile) return;
    if (allProfileChecked) {
      setSelectedStructured(new Set());
      setSelectedExtras(new Set());
    } else {
      setSelectedStructured(new Set(activeProfile.items));
      setSelectedExtras(new Set(activeProfile.extraItems));
    }
  };

  // ============== HANDLERS — cuidados rápidos ==============
  const handleQuickClick = (care: CareEntry) => {
    if (multiMode) {
      setQuickSelected((p) => {
        const n = new Set(p);
        n.has(care.id) ? n.delete(care.id) : n.add(care.id);
        return n;
      });
    } else {
      onAddItem(care);
      setJustAdded((p) => new Set(p).add(care.id));
      window.setTimeout(() => {
        setJustAdded((p) => {
          const n = new Set(p);
          n.delete(care.id);
          return n;
        });
      }, 1200);
    }
  };
  const handleAddQuickSelection = () => {
    const items = (CARE_OPTIONS as CareEntry[]).filter((c) => quickSelected.has(c.id));
    if (items.length === 0) return;
    onAddBulk(items, []);
    setQuickSelected(new Set());
    onOpenChange(false);
  };

  // Toggle 1-clique / multi-seleção — reaproveitado tanto na aba "Cuidados
  // rápidos" quanto nos resultados de busca unificada, pra ficar disponível
  // em qualquer lugar onde itens individuais aparecem.
  const modeToggleNode = (
    <div className="px-5 py-2 border-b bg-muted/20 shrink-0 flex items-center justify-between gap-2">
      <div className="inline-flex items-center rounded-md border border-border/60 bg-background p-0.5">
        <button
          type="button"
          onClick={() => { setMultiMode(false); setQuickSelected(new Set()); }}
          className={cn(
            "px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-sm flex items-center gap-1.5 transition-colors",
            !multiMode ? "bg-amber-500 text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <MousePointerClick className="h-3 w-3" /> 1 clique
        </button>
        <button
          type="button"
          onClick={() => setMultiMode(true)}
          className={cn(
            "px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-sm flex items-center gap-1.5 transition-colors",
            multiMode ? "bg-amber-500 text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ListChecks className="h-3 w-3" /> Multi-seleção
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground tracking-wide">
        {multiMode ? "Marque vários e adicione todos juntos." : "Clique no item para adicionar imediatamente."}
      </p>
    </div>
  );

  // Grade de itens individuais (agrupada por subcategoria) — mesma lista
  // usada na aba "Cuidados rápidos" e nos resultados de busca unificada.
  const quickItemsGridNode = groupedOptions.length === 0 ? (
    <div className="text-center py-10 text-sm text-muted-foreground">Nenhum cuidado encontrado</div>
  ) : (
    <div className="space-y-4">
      {groupedOptions.map((g) => (
        <section key={g.name}>
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{g.name}</p>
            <span className="h-px flex-1 bg-border/60" />
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{g.items.length}</Badge>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {g.items.map((care) => {
              const selected = quickSelected.has(care.id);
              const flashed = justAdded.has(care.id);
              return (
                <button
                  key={care.id}
                  type="button"
                  onClick={() => handleQuickClick(care)}
                  className={cn(
                    "group flex items-center gap-2 px-2.5 py-2 rounded-md border text-left transition-all",
                    multiMode && selected
                      ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
                      : flashed
                        ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-border/40 bg-card/50 hover:border-amber-300/60 hover:bg-amber-50/40 dark:hover:bg-amber-950/15",
                  )}
                >
                  {multiMode ? (
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => handleQuickClick(care)}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    />
                  ) : flashed ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 text-amber-500 shrink-0 opacity-60 group-hover:opacity-100" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium uppercase tracking-wide leading-tight truncate">{care.name}</p>
                    {care.defaultPosology && care.defaultPosology !== "-" && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{care.defaultPosology}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1100px] w-[calc(100vw-0.5rem)] sm:w-[96vw] h-[100dvh] sm:h-[82vh] max-h-[100dvh] sm:max-h-[82vh] flex flex-col p-0 overflow-hidden rounded-none sm:rounded-lg">
        {/* HEADER */}
        <DialogHeader className="space-y-1.5 px-3 sm:px-5 pt-3 sm:pt-5 pb-2 sm:pb-3 border-b shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm sm:text-lg font-bold tracking-wide uppercase truncate">
                Assistente de Cuidados
              </DialogTitle>
              {patientName && (
                <p className="text-xs sm:text-sm font-semibold text-foreground mt-0.5 tracking-wide uppercase truncate">
                  {patientName}
                </p>
              )}
            </div>
          </div>
          <DialogDescription className="hidden sm:block text-xs tracking-wider text-muted-foreground">
            Busque direto, escolha um perfil clínico para prescrever em bloco, ou use os cuidados rápidos —
            clique para adicionar direto, ou ative a multi-seleção para enviar vários de uma vez.
          </DialogDescription>
        </DialogHeader>

        {/* BUSCA — sempre visível, funciona em qualquer modo (perfis, dentro
            de um perfil, ou cuidados rápidos). Sem escolher aba nenhuma:
            digitar aqui já busca perfis clínicos E itens individuais juntos. */}
        <div className="px-3 sm:px-5 py-2 border-b shrink-0 relative">
          <Search className="absolute left-6 sm:left-8 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={
              activeProfile
                ? `Buscar dentro de "${activeProfile.label}"...`
                : "Buscar cuidado ou perfil clínico (ex: decúbito, HGT, sepse, neurocrítico)..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* TABS — só quando não há busca ativa nem perfil aberto; buscar
            já mostra perfis + itens juntos, sem precisar escolher aba. */}
        {!activeProfile && !isSearching && (
          <div className="flex gap-1 border-b px-2 sm:px-5 shrink-0 overflow-x-auto">
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

        {/* CONTEÚDO */}
        <div className="flex-1 min-h-0 flex flex-col">
          {activeProfile ? (
            <>
              <div className="flex items-center justify-between gap-2 px-5 py-2 border-b bg-muted/30 shrink-0">
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
                  <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={toggleAllProfile}>
                    {allProfileChecked ? "Desmarcar todos" : "Marcar todos"}
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="px-5 py-3 space-y-4">
                  {activeProfileItemsFiltered.length === 0 && activeProfileExtrasFiltered.length === 0 && (
                    <div className="text-center py-10 text-sm text-muted-foreground">
                      Nenhum item deste perfil bate com "{search.trim()}"
                    </div>
                  )}
                  {activeProfileItemsFiltered.length > 0 && (
                    <section>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Cuidados padronizados
                      </p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                        {activeProfileItemsFiltered.map((id) => {
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
                                <p className="text-[12px] font-medium uppercase tracking-wide">{care.name}</p>
                                {care.defaultPosology && care.defaultPosology !== "-" && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{care.defaultPosology}</p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {activeProfileExtrasFiltered.length > 0 && (
                    <section>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Recomendações específicas
                      </p>
                      <div className="grid sm:grid-cols-2 gap-1.5">
                        {activeProfileExtrasFiltered.map((txt) => {
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
          ) : isSearching ? (
            // Busca unificada: perfis clínicos E itens individuais juntos,
            // sem precisar escolher aba nenhuma antes de digitar.
            <>
              {groupedOptions.length > 0 && modeToggleNode}
              <ScrollArea className="flex-1 min-h-0">
                {filteredProfiles.length > 0 && (
                  <div className="px-5 pt-3 pb-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
                      Perfis clínicos
                    </p>
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {filteredProfiles.map((profile) => {
                        const Icon = PROFILE_ICONS[profile.icon] ?? ClipboardList;
                        const applied = appliedProfileIds.has(profile.id);
                        return (
                          <button
                            key={profile.id}
                            type="button"
                            onClick={() => setActiveProfileId(profile.id)}
                            className={cn(
                              "w-full text-left p-2.5 rounded-lg border bg-card/50 transition-all hover:border-amber-300/60 hover:shadow-sm flex items-center gap-2.5",
                              applied ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10" : "border-border/40",
                            )}
                          >
                            <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
                              <Icon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold tracking-wide uppercase truncate">{profile.label}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{profile.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="px-5 pt-2 pb-3">
                  {(filteredProfiles.length > 0 && groupedOptions.length > 0) && (
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
                      Cuidados individuais
                    </p>
                  )}
                  {quickItemsGridNode}
                </div>
              </ScrollArea>
            </>
          ) : tab === "perfis" ? (
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-5 py-3 grid sm:grid-cols-2 gap-2">
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
                            <p className="text-sm font-semibold tracking-wide uppercase">{profile.label}</p>
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
                          <p className="text-xs text-muted-foreground mt-0.5">{profile.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <>
              {modeToggleNode}
              <ScrollArea className="flex-1 min-h-0">
                <div className="px-5 py-3">
                  {quickItemsGridNode}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        {/* FOOTER */}
        <DialogFooter className="px-5 py-3 border-t flex-row sm:justify-between items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="uppercase text-xs">
            Fechar
          </Button>
          {activeProfile ? (
            <Button
              onClick={handleAddProfileSelection}
              disabled={totalProfileSelected === 0}
              className="uppercase text-xs bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Adicionar {totalProfileSelected} {totalProfileSelected === 1 ? "cuidado" : "cuidados"}
            </Button>
          ) : (isSearching || tab === "rapido") && multiMode ? (
            <Button
              onClick={handleAddQuickSelection}
              disabled={quickSelected.size === 0}
              className="uppercase text-xs bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Adicionar {quickSelected.size} {quickSelected.size === 1 ? "cuidado" : "cuidados"}
            </Button>
          ) : (
            <span className="text-[10px] text-muted-foreground tracking-wide">
              {isSearching
                ? "Clique num item pra adicionar direto, ou num perfil pra abrir o checklist."
                : tab === "rapido"
                  ? "Modo 1 clique — cada item entra direto na prescrição."
                  : "Busque ou selecione um perfil clínico para começar."}
            </span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
