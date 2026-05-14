import { useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Search, Filter, Download, Clock, User as UserIcon,
  Stethoscope, Pill, FlaskConical, Activity, BedDouble, FileText,
  Microscope, Truck, ClipboardEdit, Hospital, Loader2, Printer
} from "lucide-react";
import {
  usePatientTimeline,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  type TimelineEventType,
  type TimelineEvent,
} from "@/hooks/usePatientTimeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const ICONS: Record<TimelineEventType, React.ElementType> = {
  pre_admission: Hospital,
  encounter: ClipboardEdit,
  admission_history: FileText,
  evolution: Stethoscope,
  prescription: Pill,
  exam_request: FlaskConical,
  culture_result: Microscope,
  movement: Truck,
  conduct_change: Activity,
  bed_status: BedDouble,
  dispensation: Pill,
  dhd: Pill,
};

export default function HistoricoPacientePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const patientId = searchParams.get("patientId");
  const patientRegistryId = searchParams.get("patientRegistryId");
  const patientName = searchParams.get("patientName") ?? "Paciente";
  const patientBed = searchParams.get("patientBed");
  const patientSector = searchParams.get("patientSector");

  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<TimelineEventType[]>([]);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const { data: events = [], isLoading } = usePatientTimeline({
    patientRegistryId,
    patientId,
    eventTypes: selectedTypes,
    fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
    toDate: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined,
    search,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    events.forEach((e) => {
      const day = format(new Date(e.event_at), "yyyy-MM-dd");
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [events]);

  const counts = useMemo(() => {
    const c: Partial<Record<TimelineEventType, number>> = {};
    events.forEach((e) => {
      c[e.event_type] = (c[e.event_type] ?? 0) + 1;
    });
    return c;
  }, [events]);

  const toggleType = (t: TimelineEventType) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Clock className="h-4 w-4 text-primary" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate patient-id">
              Histórico longitudinal • {patientName}
            </h1>
            <p className="text-xs text-muted-foreground">
              {patientBed && <span className="patient-id">Leito {patientBed}</span>}
              {patientSector && <span className="patient-id"> · {patientSector}</span>}
              <span className="ml-2">{events.length} eventos registrados</span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </div>

        {/* Filtros */}
        <div className="container mx-auto px-4 pb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar no histórico..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8 text-xs"
            />
          </div>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 w-[140px] text-xs"
            placeholder="De"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 w-[140px] text-xs"
            placeholder="Até"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Filter className="h-3.5 w-3.5 mr-1" />
                Tipos {selectedTypes.length > 0 && `(${selectedTypes.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2">
              <div className="space-y-1">
                {(Object.keys(EVENT_TYPE_LABELS) as TimelineEventType[]).map((t) => (
                  <label
                    key={t}
                    className="flex items-center gap-2 p-1.5 hover:bg-muted rounded cursor-pointer text-xs"
                  >
                    <Checkbox
                      checked={selectedTypes.includes(t)}
                      onCheckedChange={() => toggleType(t)}
                    />
                    <span className="flex-1">{EVENT_TYPE_LABELS[t]}</span>
                    {counts[t] ? (
                      <Badge variant="secondary" className="h-4 text-[10px] px-1">
                        {counts[t]}
                      </Badge>
                    ) : null}
                  </label>
                ))}
                {selectedTypes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-1 h-7 text-xs"
                    onClick={() => setSelectedTypes([])}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando histórico...
          </div>
        ) : events.length === 0 ? (
          <Card className="p-12 text-center">
            <Clock className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum evento encontrado para os filtros aplicados.
            </p>
          </Card>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {grouped.map(([day, items]) => (
              <div key={day}>
                <div className="sticky top-[105px] z-[1] bg-background/95 backdrop-blur py-1.5 mb-2 border-b print:static">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {format(new Date(day + "T00:00:00"), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    <Badge variant="secondary" className="ml-2 h-4 text-[10px]">
                      {items.length}
                    </Badge>
                  </h2>
                </div>
                <div className="space-y-2 pl-2 border-l-2 border-border ml-2">
                  {items.map((e) => {
                    const Icon = ICONS[e.event_type] ?? FileText;
                    return (
                      <div key={e.event_id} className="relative pl-6">
                        <div className={cn(
                          "absolute -left-[13px] top-2 h-5 w-5 rounded-full border-2 bg-background flex items-center justify-center",
                          EVENT_TYPE_COLORS[e.event_type]?.split(" ")[2] ?? "border-border"
                        )}>
                          <Icon className="h-2.5 w-2.5" />
                        </div>
                        <Card className="p-3 hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={cn("h-5 text-[10px]", EVENT_TYPE_COLORS[e.event_type])}>
                                  {EVENT_TYPE_LABELS[e.event_type]}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(e.event_at), "HH:mm")}
                                </span>
                                {e.author_email && (
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <UserIcon className="h-3 w-3" />
                                    {e.author_email}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium mt-1">{e.event_label}</p>
                              {e.summary && (
                                <p className="text-xs text-muted-foreground mt-0.5">{e.summary}</p>
                              )}
                            </div>
                          </div>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
