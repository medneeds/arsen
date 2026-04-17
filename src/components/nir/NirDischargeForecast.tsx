import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarClock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDischargePredictions, type DischargePrediction } from "@/hooks/useDischargePredictions";

interface Props {
  hospitalUnitId: string | undefined;
}

const BUCKET_META: Record<DischargePrediction["bucket"], { label: string; tone: string; order: number }> = {
  today: { label: "Hoje", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", order: 0 },
  tomorrow: { label: "Amanhã", tone: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30", order: 1 },
  "48_72h": { label: "48–72h", tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30", order: 2 },
  week: { label: "Esta semana", tone: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30", order: 3 },
  later: { label: "Mais tarde", tone: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30", order: 4 },
  unparsed: { label: "Sem data", tone: "bg-muted text-muted-foreground border-border", order: 5 },
};

export function NirDischargeForecast({ hospitalUnitId }: Props) {
  const { data: predictions = [], isLoading } = useDischargePredictions(hospitalUnitId);

  const grouped = useMemo(() => {
    const map = new Map<DischargePrediction["bucket"], DischargePrediction[]>();
    predictions.forEach((p) => {
      const arr = map.get(p.bucket) || [];
      arr.push(p);
      map.set(p.bucket, arr);
    });
    return Array.from(map.entries())
      .map(([bucket, items]) => ({ bucket, items: items.sort((a, b) => (a.daysAway ?? 99) - (b.daysAway ?? 99)) }))
      .sort((a, b) => BUCKET_META[a.bucket].order - BUCKET_META[b.bucket].order);
  }, [predictions]);

  const counts = useMemo(() => {
    const c = { today: 0, tomorrow: 0, "48_72h": 0, week: 0, later: 0, unparsed: 0 } as Record<DischargePrediction["bucket"], number>;
    predictions.forEach((p) => { c[p.bucket]++; });
    return c;
  }, [predictions]);

  const total = predictions.length;
  const next72 = counts.today + counts.tomorrow + counts["48_72h"];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Previsão de altas
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] gap-1">
              <TrendingUp className="h-3 w-3" /> {next72} em 72h
            </Badge>
            <Badge variant="secondary" className="text-[10px]">{total} previstas</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Carregando previsões…</p>
        ) : total === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CalendarClock className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Nenhuma previsão de alta registrada</p>
            <p className="text-xs mt-1">Médicos podem registrar a previsão no painel clínico do paciente.</p>
          </div>
        ) : (
          <>
            {/* Bucket summary */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-3">
              {(Object.keys(BUCKET_META) as DischargePrediction["bucket"][]).map((k) => (
                <div key={k} className={cn("rounded-md border px-2 py-1.5 text-center", BUCKET_META[k].tone)}>
                  <p className="text-[9px] uppercase tracking-wider font-medium opacity-80">{BUCKET_META[k].label}</p>
                  <p className="text-base font-bold leading-tight mt-0.5">{counts[k]}</p>
                </div>
              ))}
            </div>

            <ScrollArea className="max-h-72">
              <div className="space-y-3 pr-3">
                {grouped.map(({ bucket, items }) => (
                  <div key={bucket}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className={cn("text-[10px]", BUCKET_META[bucket].tone)}>{BUCKET_META[bucket].label}</Badge>
                      <span className="text-[10px] text-muted-foreground">{items.length} paciente(s)</span>
                    </div>
                    <ul className="divide-y border rounded-md">
                      {items.map((p) => (
                        <li key={p.id} className="px-2.5 py-1.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="patient-id text-xs font-semibold truncate">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate capitalize">
                              {p.sector || "—"} · Leito {p.bed_number || "—"}
                            </p>
                          </div>
                          <span className="text-[10px] text-foreground/80 truncate max-w-[40%] text-right" title={p.uti_discharge_prediction || ""}>
                            {p.uti_discharge_prediction}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
