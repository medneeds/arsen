// AtmStatusDialog — Pop-up de acompanhamento da Guia ATM.
// 2 abas: STATUS (antibióticos em curso, com dia de terapia auto-calculado)
//        e NOVA (acréscimo vs troca → abre AntimicrobialGuideDialog do zero).
// Não edita guias autorizadas; apenas permite suspender e iniciar nova.
import React, { useMemo, useState } from "react";
import { differenceInCalendarDays, format, parseISO, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Shield, Activity, Plus, AlertTriangle, Clock, Ban, ChevronRight, CalendarDays, Timer } from "lucide-react";
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

  // Reset ao abrir — se não há ATB ativa, já abre direto na aba "Nova ATB"
  // (evita o usuário cair numa tela vazia e não saber como prosseguir)
  React.useEffect(() => {
    if (open) {
      setTab(activeItems.length > 0 ? 'status' : 'nova');
      setNovaMode('acrescimo');
      setTrocaIds(new Set());
    }
  }, [open, activeItems.length]);

  const novaModeEffective: 'acrescimo' | 'troca' | 'inicial' = useMemo(() => {
    if (!hasActive) return 'inicial';
    return novaMode;
  }, [hasActive, novaMode]);

  const handleProceed = () => {
    const suspendIds = novaModeEffective === 'troca' ? Array.from(trocaIds) : [];
    if (novaModeEffective === 'troca' && suspendIds.length === 0) {
      // sem seleção: ainda assim sinaliza troca para que a guia já abra com aviso
    }
    // IMPORTANTE: dispara onStartNew ANTES de fechar — assim o pai pode usar
    // pendingAntimicrobialMed (vindo da busca) para semear a guia antes do
    // cleanup do onOpenChange limpar esse estado.
    onStartNew(novaModeEffective, suspendIds);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b bg-violet-50/50 dark:bg-violet-950/15">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-violet-600" />
            Guia ATM — Antimicrobianos
          </DialogTitle>
          <DialogDescription className="text-xs">
            Acompanhe os antibióticos em curso ou inicie uma nova solicitação.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-5 mt-3 grid grid-cols-2 w-auto self-start">
            <TabsTrigger value="status" className="text-xs gap-1.5 data-[state=active]:text-violet-700 data-[state=active]:border-b-2 data-[state=active]:border-violet-500">
              <Activity className="h-3.5 w-3.5" /> Status ({activeItems.length})
            </TabsTrigger>
            <TabsTrigger value="nova" className="text-xs gap-1.5 data-[state=active]:text-violet-700 data-[state=active]:border-b-2 data-[state=active]:border-violet-500">
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
                    const totalValid = Number.isFinite(total) && total > 0;
                    const end = endDate(it.atbStartDate, it.atbPlannedDays);
                    const overdue = dot !== null && totalValid && dot > total;
                    const remaining = totalValid && dot !== null ? total - dot : null;
                    const pct = totalValid && dot !== null ? Math.min(100, Math.round((dot / total) * 100)) : null;

                    // Tempo desde início (horas para <24h, dias depois)
                    let sinceLabel: string | null = null;
                    if (it.atbStartDate) {
                      try {
                        const start = parseISO(it.atbStartDate);
                        const hoursSince = differenceInHours(new Date(), start);
                        if (hoursSince < 24 && hoursSince >= 0) sinceLabel = `Iniciado há ${hoursSince}h`;
                      } catch {}
                    }

                    return (
                      <div
                        key={it.id}
                        className={cn(
                          "rounded-lg border p-3 bg-card transition-colors",
                          overdue
                            ? "border-red-300 bg-red-50/40 dark:bg-red-950/10"
                            : "border-violet-200/70 dark:border-violet-800/40 hover:border-violet-300",
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
                              {sinceLabel && !overdue && (
                                <Badge variant="outline" className="text-[9px] gap-1 border-violet-300 text-violet-700 dark:text-violet-400">
                                  <Timer className="h-2.5 w-2.5" /> {sinceLabel}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {it.dose} · {it.route} · {it.posology}
                            </div>
                            {it.atbInfectionSite && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Sítio: <strong className="text-foreground/80">{it.atbInfectionSite}</strong>
                              </div>
                            )}

                            {/* Linha de progresso (Dia X / Y + barra) */}
                            {dot !== null && (
                              <div className="mt-2">
                                <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
                                  <span className="inline-flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-400">
                                    <Clock className="h-3 w-3" /> Dia {dot}{totalValid ? ` de ${total}` : ''}
                                  </span>
                                  {totalValid && remaining !== null && (
                                    <span className={cn(
                                      "font-semibold",
                                      remaining < 0 ? "text-red-600" : remaining <= 1 ? "text-amber-600" : "text-muted-foreground"
                                    )}>
                                      {remaining > 0 ? `Faltam ${remaining} dia${remaining === 1 ? '' : 's'}` : remaining === 0 ? 'Último dia' : `Excedeu há ${Math.abs(remaining)} dia${Math.abs(remaining) === 1 ? '' : 's'}`}
                                    </span>
                                  )}
                                </div>
                                {pct !== null && (
                                  <div className="h-1.5 w-full rounded-full bg-violet-100 dark:bg-violet-950/30 overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        overdue ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-violet-500"
                                      )}
                                      style={{ width: `${overdue ? 100 : pct}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Janela de tratamento */}
                            {(it.atbStartDate || end) && (
                              <div className="flex items-center gap-1.5 mt-1.5 text-[10.5px] text-muted-foreground">
                                <CalendarDays className="h-2.5 w-2.5" />
                                {it.atbStartDate && (
                                  <span>Início <strong className="text-foreground/70">{format(parseISO(it.atbStartDate), 'dd/MM/yyyy', { locale: ptBR })}</strong></span>
                                )}
                                {end && (
                                  <>
                                    <span className="text-muted-foreground/50">→</span>
                                    <span>Previsão fim <strong className="text-foreground/70">{end}</strong></span>
                                  </>
                                )}
                              </div>
                            )}
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
                    <Plus className="h-3.5 w-3.5 text-violet-600" />
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
                      novaMode === 'acrescimo' && "border-violet-400 bg-violet-50/50 dark:bg-violet-950/20"
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
              className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
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
