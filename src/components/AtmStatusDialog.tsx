// AtmStatusDialog — Pop-up de acompanhamento da Guia ATM.
// 2 abas: STATUS (antibióticos em curso, com dia de terapia auto-calculado)
//        e NOVA (acréscimo vs troca → abre AntimicrobialGuideDialog do zero).
// Não edita guias autorizadas; apenas permite suspender e iniciar nova.
import React, { useMemo, useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Shield, Activity, Plus, AlertTriangle, Clock, Ban, ChevronRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface AtmStatusItem {
  id: string;
  name: string;
  dose: string;
  route: string;
  posology: string;
  status: 'active' | 'suspended' | string;
  atbStartDate?: string;
  atbPlannedDays?: string;
  atbInfectionSite?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeItems: AtmStatusItem[];
  onSuspendItem?: (itemId: string) => void;
  /**
   * Dispara o fluxo de nova ATB. Recebe o modo escolhido e os ids selecionados
   * para suspensão (apenas em modo 'troca').
   */
  onStartNew: (mode: 'acrescimo' | 'troca' | 'inicial', suspendIds: string[]) => void;
}

function dayOfTherapy(startDate?: string): number | null {
  if (!startDate) return null;
  try {
    const d = parseISO(startDate);
    if (Number.isNaN(d.getTime())) return null;
    return differenceInCalendarDays(new Date(), d) + 1;
  } catch { return null; }
}

function endDate(startDate?: string, plannedDays?: string): string | null {
  if (!startDate || !plannedDays) return null;
  const n = parseInt(plannedDays, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    const d = parseISO(startDate);
    d.setDate(d.getDate() + n - 1);
    return format(d, 'dd/MM/yyyy', { locale: ptBR });
  } catch { return null; }
}

export function AtmStatusDialog({
  open, onOpenChange, activeItems, onSuspendItem, onStartNew,
}: Props) {
  const [tab, setTab] = useState<'status' | 'nova'>('status');
  const [novaMode, setNovaMode] = useState<'acrescimo' | 'troca'>('acrescimo');
  const [trocaIds, setTrocaIds] = useState<Set<string>>(new Set());

  const hasActive = activeItems.length > 0;

  // Reset ao abrir
  React.useEffect(() => {
    if (open) {
      setTab('status');
      setNovaMode('acrescimo');
      setTrocaIds(new Set());
    }
  }, [open]);

  const novaModeEffective: 'acrescimo' | 'troca' | 'inicial' = useMemo(() => {
    if (!hasActive) return 'inicial';
    return novaMode;
  }, [hasActive, novaMode]);

  const handleProceed = () => {
    const suspendIds = novaModeEffective === 'troca' ? Array.from(trocaIds) : [];
    if (novaModeEffective === 'troca' && suspendIds.length === 0) {
      // sem seleção: ainda assim sinaliza troca para que a guia já abra com aviso
    }
    onOpenChange(false);
    onStartNew(novaModeEffective, suspendIds);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b bg-orange-50/40 dark:bg-orange-950/10">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-orange-600" />
            Guia ATM — Antimicrobianos
          </DialogTitle>
          <DialogDescription className="text-xs">
            Acompanhe os antibióticos em curso ou inicie uma nova solicitação.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-5 mt-3 grid grid-cols-2 w-auto self-start">
            <TabsTrigger value="status" className="text-xs gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Status ({activeItems.length})
            </TabsTrigger>
            <TabsTrigger value="nova" className="text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Nova ATB
            </TabsTrigger>
          </TabsList>

          {/* === STATUS === */}
          <TabsContent value="status" className="flex-1 min-h-0 m-0 px-5 py-3">
            {!hasActive ? (
              <div className="text-center text-sm text-muted-foreground py-12 border border-dashed rounded-lg">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhum antimicrobiano em curso.<br />
                Use a aba <strong>Nova ATB</strong> para iniciar uma solicitação.
              </div>
            ) : (
              <ScrollArea className="h-[420px] pr-2">
                <div className="space-y-2.5">
                  {activeItems.map((it) => {
                    const dot = dayOfTherapy(it.atbStartDate);
                    const total = parseInt(it.atbPlannedDays || '', 10);
                    const end = endDate(it.atbStartDate, it.atbPlannedDays);
                    const overdue = dot !== null && Number.isFinite(total) && total > 0 && dot > total;
                    return (
                      <div
                        key={it.id}
                        className={cn(
                          "rounded-lg border p-3 bg-card",
                          overdue ? "border-red-300 bg-red-50/40 dark:bg-red-950/10" : "border-orange-200 dark:border-orange-800/40",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold truncate">{it.name}</span>
                              <Badge variant="outline" className="text-[9px] gap-1 border-emerald-400 text-emerald-700 dark:text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" /> Em curso
                              </Badge>
                              {overdue && (
                                <Badge variant="outline" className="text-[9px] gap-1 border-red-400 text-red-700 dark:text-red-400">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Excedeu duração planejada
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {it.dose} · {it.route} · {it.posology}
                            </div>
                            {it.atbInfectionSite && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Sítio: <strong>{it.atbInfectionSite}</strong>
                              </div>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                              {dot !== null && (
                                <span className="inline-flex items-center gap-1 font-medium text-orange-700 dark:text-orange-400">
                                  <Clock className="h-3 w-3" /> Dia {dot}{Number.isFinite(total) && total > 0 ? ` de ${total}` : ''}
                                </span>
                              )}
                              {it.atbStartDate && (
                                <span className="text-muted-foreground">
                                  Início: {format(parseISO(it.atbStartDate), 'dd/MM/yyyy', { locale: ptBR })}
                                </span>
                              )}
                              {end && <span className="text-muted-foreground">Previsão fim: {end}</span>}
                            </div>
                          </div>
                          {onSuspendItem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onSuspendItem(it.id)}
                              className="h-7 text-[11px] gap-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <Ban className="h-3 w-3" /> Suspender
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 p-2 rounded-md bg-muted/40 text-[11px] text-muted-foreground">
                  <strong>Importante:</strong> guias já autorizadas não são editadas aqui — para acréscimo, troca ou nova solicitação use a aba <strong>Nova ATB</strong>.
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* === NOVA === */}
          <TabsContent value="nova" className="flex-1 min-h-0 m-0 px-5 py-3">
            <div className="space-y-4">
              {!hasActive ? (
                <div className="rounded-lg border border-dashed p-4 bg-muted/20 text-xs">
                  <div className="font-semibold flex items-center gap-1.5 mb-1">
                    <Plus className="h-3.5 w-3.5 text-orange-600" />
                    Início de antibioticoterapia
                  </div>
                  <div className="text-muted-foreground">
                    Não há antibiótico ativo. Será aberta a Guia ATM em branco para o primeiro
                    antimicrobiano deste paciente.
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-xs font-medium">Esta nova prescrição é:</div>
                  <RadioGroup value={novaMode} onValueChange={(v) => setNovaMode(v as any)} className="space-y-2">
                    <label className={cn(
                      "flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer hover:bg-muted/30",
                      novaMode === 'acrescimo' && "border-orange-400 bg-orange-50/50 dark:bg-orange-950/20"
                    )}>
                      <RadioGroupItem value="acrescimo" className="mt-0.5" />
                      <div className="text-xs">
                        <div className="font-semibold">Acréscimo</div>
                        <div className="text-muted-foreground">
                          Adicionar novo antibiótico mantendo os atuais (sinergismo, expansão de cobertura).
                        </div>
                      </div>
                    </label>
                    <label className={cn(
                      "flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer hover:bg-muted/30",
                      novaMode === 'troca' && "border-red-400 bg-red-50/50 dark:bg-red-950/20"
                    )}>
                      <RadioGroupItem value="troca" className="mt-0.5" />
                      <div className="text-xs flex-1">
                        <div className="font-semibold">Troca / Escalonamento</div>
                        <div className="text-muted-foreground">
                          Substituir antibiótico atual (falência terapêutica, antibiograma, descalonamento).
                        </div>
                        {novaMode === 'troca' && (
                          <div className="mt-2 space-y-1.5">
                            <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                              Selecione qual(is) suspender:
                            </div>
                            {activeItems.map(it => (
                              <label key={it.id} className="flex items-center gap-2 text-[11px] cursor-pointer">
                                <Checkbox
                                  checked={trocaIds.has(it.id)}
                                  onCheckedChange={(v) => {
                                    setTrocaIds(prev => {
                                      const next = new Set(prev);
                                      if (v) next.add(it.id); else next.delete(it.id);
                                      return next;
                                    });
                                  }}
                                />
                                <span>{it.name} · {it.dose}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                  </RadioGroup>
                </>
              )}

              <div className="rounded-md bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 p-2.5 text-[11px] text-blue-900 dark:text-blue-300">
                Ao continuar, abriremos a <strong>Guia ATM</strong> com formulário em branco para o
                novo antibiótico. Os itens em curso permanecem inalterados (a menos que você
                selecione a opção de Troca).
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-5 py-3 border-t bg-background flex-row sm:justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {tab === 'nova' && (
            <Button
              size="sm"
              onClick={handleProceed}
              className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
            >
              {novaModeEffective === 'inicial' ? 'Abrir Guia ATM' : novaModeEffective === 'troca' ? 'Continuar com Troca' : 'Continuar com Acréscimo'}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
          {tab === 'status' && hasActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTab('nova')}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Iniciar nova ATB
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
