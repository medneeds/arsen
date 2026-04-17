import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import type { NirMetrics } from "@/hooks/useNirMetrics";
import { TrendingUp, Flame, ArrowRightLeft, PieChart as PieIcon, Lock } from "lucide-react";

interface Props {
  metrics: NirMetrics;
  historical: { date: string; created: number; completed: number; avgMinutes: number }[];
  heatmap: Record<string, number>;
  flow: { origin: string; destination: string; count: number }[];
}

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const heatmapColor = (value: number, max: number) => {
  if (!max || value === 0) return "bg-muted/40";
  const ratio = value / max;
  if (ratio > 0.75) return "bg-red-500/80";
  if (ratio > 0.5) return "bg-orange-500/70";
  if (ratio > 0.25) return "bg-amber-500/60";
  return "bg-emerald-500/40";
};

const PIE_COLORS = ["hsl(var(--chart-1, 142 71% 45%))", "hsl(var(--chart-2, 217 91% 60%))", "hsl(var(--chart-3, 0 84% 60%))", "hsl(var(--chart-4, 38 92% 50%))", "hsl(var(--chart-5, 271 81% 56%))"];

export function NirAnalyticsPanel({ metrics, historical, heatmap, flow }: Props) {
  const heatmapMax = Math.max(0, ...Object.values(heatmap));

  const outcomeData = [
    { name: "Concluídas", value: metrics.completed, fill: "hsl(142 71% 45%)" },
    { name: "Aprovadas", value: metrics.approved, fill: "hsl(217 91% 60%)" },
    { name: "Pendentes", value: metrics.pending + metrics.inAnalysis, fill: "hsl(38 92% 50%)" },
    { name: "Negadas", value: metrics.denied, fill: "hsl(0 84% 60%)" },
    { name: "Canceladas", value: metrics.cancelled, fill: "hsl(0 0% 60%)" },
  ].filter((d) => d.value > 0);

  return (
    <Tabs defaultValue="trend" className="space-y-3">
      <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto">
        <TabsTrigger value="trend" className="text-xs gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Tendência</TabsTrigger>
        <TabsTrigger value="heatmap" className="text-xs gap-1.5"><Flame className="h-3.5 w-3.5" />Mapa de calor</TabsTrigger>
        <TabsTrigger value="stuck" className="text-xs gap-1.5"><Lock className="h-3.5 w-3.5" />Represados</TabsTrigger>
        <TabsTrigger value="flow" className="text-xs gap-1.5"><ArrowRightLeft className="h-3.5 w-3.5" />Fluxo</TabsTrigger>
        <TabsTrigger value="outcomes" className="text-xs gap-1.5"><PieIcon className="h-3.5 w-3.5" />Desfechos</TabsTrigger>
      </TabsList>

      {/* Tendência ─ tempo médio de regulação */}
      <TabsContent value="trend" className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Solicitações × Concluídas (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={historical} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="created" name="Solicitadas" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="completed" name="Concluídas" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tempo médio de regulação (min)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={historical} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                />
                <Bar dataKey="avgMinutes" name="Tempo médio (min)" fill="hsl(271 81% 56%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Mapa de calor */}
      <TabsContent value="heatmap">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Mapa de calor — solicitações por dia × hora</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-0.5 text-[9px]">
                  <div />
                  {HOURS.map((h) => (
                    <div key={h} className="text-center text-muted-foreground font-medium">{h}h</div>
                  ))}
                  {WEEKDAYS.map((wd, wIdx) => (
                    <>
                      <div key={`label-${wd}`} className="text-right pr-1 text-muted-foreground font-medium self-center">{wd}</div>
                      {HOURS.map((h) => {
                        const v = heatmap[`${wIdx}-${h}`] || 0;
                        return (
                          <div
                            key={`${wd}-${h}`}
                            className={cn("aspect-square rounded-sm flex items-center justify-center text-[8px] font-bold text-white", heatmapColor(v, heatmapMax))}
                            title={`${wd} ${h}h — ${v} solicitação(ões)`}
                          >
                            {v > 0 ? v : ""}
                          </div>
                        );
                      })}
                    </>
                  ))}
                </div>
              </div>
            </ScrollArea>
            <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
              <span>Menos</span>
              <span className="h-2 w-3 rounded-sm bg-muted/40" />
              <span className="h-2 w-3 rounded-sm bg-emerald-500/40" />
              <span className="h-2 w-3 rounded-sm bg-amber-500/60" />
              <span className="h-2 w-3 rounded-sm bg-orange-500/70" />
              <span className="h-2 w-3 rounded-sm bg-red-500/80" />
              <span>Mais</span>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Pacientes represados + leitos bloqueados há +7 dias */}
      <TabsContent value="stuck" className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Pacientes aguardando vaga há +24h
              <Badge variant="destructive" className="text-[10px]">{metrics.stuck24h.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {metrics.stuck24h.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhum paciente represado — SLA preservado.</p>
            ) : (
              <ScrollArea className="max-h-[260px]">
                <ul className="divide-y">
                  {metrics.stuck24h.map((r: any) => {
                    const hours = Math.round((Date.now() - new Date(r.created_at).getTime()) / 3_600_000);
                    const isUti = (r.destination_sector || "").toLowerCase().includes("uti");
                    return (
                      <li key={r.id} className="px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="patient-id text-xs font-semibold truncate">{r.patient_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {r.origin_sector || "—"} → {r.destination_sector || "—"} · {r.priority || "s/ prioridade"}
                          </p>
                        </div>
                        <Badge
                          variant={hours > 48 ? "destructive" : "outline"}
                          className={cn("text-[10px] shrink-0", isUti && hours > 48 && "animate-pulse")}
                        >
                          {hours}h
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Leitos bloqueados há +7 dias
              <Badge variant="outline" className="text-[10px]">{metrics.longBlocked7d.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {metrics.longBlocked7d.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhum leito bloqueado por mais de 7 dias.</p>
            ) : (
              <ScrollArea className="max-h-[220px]">
                <ul className="divide-y">
                  {metrics.longBlocked7d.map((b: any) => (
                    <li key={b.id} className="px-3 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="patient-id text-xs font-semibold truncate">Leito {b.bed_number} — {b.sector}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{b.block_reason || "Sem motivo registrado"}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 border-red-500/40 text-red-600">
                        {Math.round(b.blockedHours / 24)}d
                      </Badge>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Fluxo origem → destino */}
      <TabsContent value="flow">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top 15 fluxos origem → destino</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {flow.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Sem dados de fluxo no período.</p>
            ) : (
              <ul className="divide-y">
                {flow.map((f, i) => {
                  const max = flow[0].count;
                  const pct = (f.count / max) * 100;
                  return (
                    <li key={i} className="px-3 py-2">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="truncate font-medium capitalize">{f.origin} → {f.destination}</span>
                        <span className="text-muted-foreground">{f.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Desfechos */}
      <TabsContent value="outcomes">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribuição de desfechos das solicitações</CardTitle>
          </CardHeader>
          <CardContent>
            {outcomeData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Sem solicitações no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={outcomeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    labelLine={false}
                    style={{ fontSize: 11 }}
                  >
                    {outcomeData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill || PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
