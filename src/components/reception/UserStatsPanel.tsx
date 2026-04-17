import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Trophy, Footprints, Ambulance, Timer, Zap, FileWarning,
  CircleDot, Activity, BarChart3, Clock,
} from "lucide-react";
import type { ReceptionPoint } from "@/hooks/useReceptionPost";
import { RECEPTION_POINT_SHORT } from "@/hooks/useReceptionPost";

export interface UserStats {
  userId: string;
  userName: string;
  point: ReceptionPoint | null;
  totalEncounters: number;
  expressCount: number;
  pendingDocsCount: number;
  destinationCounts: Record<string, number>;
  avgRegistrationSec: number | null;
  activeMinutes: number;
  isOnline: boolean;
}

interface Props {
  stats: UserStats[];
  /** ID do usuário logado para destacá-lo na lista */
  currentUserId?: string | null;
}

const formatActiveTime = (min: number) => {
  if (min < 1) return "—";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ""}`;
};

const formatAvgSec = (sec: number | null) => {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}min${s > 0 ? ` ${s}s` : ""}`;
};

const pointBadgeClasses = (p: ReceptionPoint | null) =>
  p === "vertical"
    ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
    : p === "horizontal"
    ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
    : "bg-muted text-muted-foreground border-border";

/**
 * Painel de ranking por recepcionista — exibido na aba "Por usuário".
 * Mostra: posição, presença, atendimentos, tempo médio, % express, distribuição por destino, tempo logado.
 */
export function UserStatsPanel({ stats, currentUserId }: Props) {
  const totals = useMemo(() => {
    const total = stats.reduce((acc, s) => acc + s.totalEncounters, 0);
    const totalExpress = stats.reduce((acc, s) => acc + s.expressCount, 0);
    const totalPending = stats.reduce((acc, s) => acc + s.pendingDocsCount, 0);
    const onlineCount = stats.filter((s) => s.isOnline).length;
    return { total, totalExpress, totalPending, onlineCount };
  }, [stats]);

  const maxEncounters = Math.max(1, ...stats.map((s) => s.totalEncounters));

  if (stats.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum recepcionista ativo no posto hoje</p>
          <p className="text-[11px] mt-1">Os atendimentos abertos aparecem aqui após o login no posto</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Resumo agregado */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Equipe ativa</p>
          <p className="text-lg font-bold flex items-center gap-1">
            <CircleDot className="h-3 w-3 text-emerald-500 animate-pulse" />
            {totals.onlineCount}
            <span className="text-[10px] text-muted-foreground font-normal">/ {stats.length}</span>
          </p>
        </div>
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Atendimentos</p>
          <p className="text-lg font-bold">{totals.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">% Express</p>
          <p className="text-lg font-bold">
            {totals.total > 0 ? `${Math.round((totals.totalExpress / totals.total) * 100)}%` : "—"}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Pendências</p>
          <p className="text-lg font-bold text-amber-600">{totals.totalPending}</p>
        </div>
      </div>

      {/* Ranking */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[460px]">
            <div className="divide-y">
              {stats.map((s, idx) => {
                const isMe = currentUserId === s.userId;
                const expressPct = s.totalEncounters > 0 ? Math.round((s.expressCount / s.totalEncounters) * 100) : 0;
                const loadPct = Math.round((s.totalEncounters / maxEncounters) * 100);
                const topDestinations = Object.entries(s.destinationCounts)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3);

                return (
                  <div
                    key={s.userId}
                    className={cn(
                      "p-3 transition-colors",
                      isMe && "bg-primary/5 border-l-2 border-l-primary",
                      !isMe && "hover:bg-accent/40",
                    )}
                  >
                    {/* Linha 1 — Identificação */}
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                          idx === 0 && "bg-amber-500/20 text-amber-700 dark:text-amber-300",
                          idx === 1 && "bg-slate-400/20 text-slate-600 dark:text-slate-300",
                          idx === 2 && "bg-orange-700/20 text-orange-700 dark:text-orange-400",
                          idx > 2 && "bg-muted text-muted-foreground",
                        )}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold truncate">{s.userName}</span>
                          {isMe && (
                            <Badge variant="outline" className="text-[9px] h-4 border-primary/40 text-primary">
                              você
                            </Badge>
                          )}
                          {s.isOnline && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                              <CircleDot className="h-2.5 w-2.5 animate-pulse" />
                              online
                            </span>
                          )}
                          {s.point && (
                            <Badge variant="outline" className={cn("text-[9px] h-4 gap-1 border", pointBadgeClasses(s.point))}>
                              {s.point === "vertical" ? <Footprints className="h-2.5 w-2.5" /> : <Ambulance className="h-2.5 w-2.5" />}
                              {RECEPTION_POINT_SHORT[s.point]}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold leading-none">{s.totalEncounters}</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">atend.</p>
                      </div>
                    </div>

                    {/* Linha 2 — Carga (barra horizontal) */}
                    <div className="mb-2">
                      <Progress value={loadPct} className="h-1.5" />
                    </div>

                    {/* Linha 3 — Métricas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <Timer className="h-3 w-3 text-sky-600" />
                        <div>
                          <p className="text-muted-foreground">Tempo médio</p>
                          <p className="font-semibold text-foreground">{formatAvgSec(s.avgRegistrationSec)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-rose-600" />
                        <div>
                          <p className="text-muted-foreground">Express</p>
                          <p className="font-semibold text-foreground">
                            {s.expressCount} <span className="text-muted-foreground font-normal">({expressPct}%)</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileWarning className="h-3 w-3 text-amber-600" />
                        <div>
                          <p className="text-muted-foreground">Pendentes</p>
                          <p className="font-semibold text-foreground">{s.pendingDocsCount}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-emerald-600" />
                        <div>
                          <p className="text-muted-foreground">Logado</p>
                          <p className="font-semibold text-foreground">{formatActiveTime(s.activeMinutes)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Linha 4 — Top destinos */}
                    {topDestinations.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <BarChart3 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Destinos:</span>
                        {topDestinations.map(([dest, count]) => (
                          <Badge key={dest} variant="secondary" className="text-[9px] h-4 capitalize">
                            {dest.replace(/_/g, " ")} · {count}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
