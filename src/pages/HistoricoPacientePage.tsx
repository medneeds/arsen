import { useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Search, Filter, Clock, User as UserIcon,
  Stethoscope, Pill, FlaskConical, Activity, BedDouble, FileText,
  Microscope, Truck, ClipboardEdit, Hospital, Loader2, Printer,
  HeartPulse, Users, FileCheck
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
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { SectionLoader } from "@/components/SectionLoader";
import { supabase } from "@/integrations/supabase/client";
import { printDischargeDocument, type DischargeDocType, type DischargeDocPayload } from "@/lib/dischargeDocuments";
import { printEvolution } from "@/lib/printEvolution";
import type { EvolutionRecord } from "@/hooks/useEvolutions";
import { printRequisitionGuideWithGasometriaPrompt } from "@/lib/printRequisitionWithGasometriaPrompt";
import { printProcedimentoRequest, printTerapeuticoRequest } from "@/pages/RequisicaoUnificadaPage";

const PRINTABLE_TYPES = new Set<TimelineEventType>([
  "evolution",
  "prescription",
  "exam_request",
  "admission_history",
  "discharge_document",
  "culture_result",
]);

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
  vital_signs: HeartPulse,
  round: Users,
  discharge_document: FileCheck,
};

const ALLOWED_PROFILES = new Set([
  "admin",
  "medico",
  "gestor",
  "coord_medico",
  "coord_enfermagem",
  "coord_multi",
]);

export default function HistoricoPacientePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ── Access guard (G9): só perfis clínicos/coordenação podem ver histórico longitudinal ──
  const accessProfile = typeof window !== "undefined"
    ? (sessionStorage.getItem("active_access_profile") || localStorage.getItem("access_profile") || "")
    : "";
  const profilesRaw = typeof window !== "undefined"
    ? sessionStorage.getItem("available_access_profiles")
    : null;
  let availableProfiles: string[] = [];
  try { availableProfiles = profilesRaw ? JSON.parse(profilesRaw) : []; } catch { /* ignore */ }
  const hasAccess = ALLOWED_PROFILES.has(accessProfile)
    || availableProfiles.some((p) => ALLOWED_PROFILES.has(p));
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md p-6 text-center space-y-3">
          <Hospital className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">ACESSO RESTRITO</h1>
          <p className="text-sm text-muted-foreground">
            O histórico longitudinal do prontuário é restrito a médicos, gestores e coordenações
            (médica, enfermagem, multiprofissional).
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </Card>
      </div>
    );
  }


  const patientId = searchParams.get("patientId");
  const patientRegistryId = searchParams.get("patientRegistryId");
  const patientName = searchParams.get("patientName") ?? "Paciente";
  const patientBed = searchParams.get("patientBed");
  const patientSector = searchParams.get("patientSector");

  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<TimelineEventType[]>([]);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [printingId, setPrintingId] = useState<string | null>(null);

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

  // Imprime um subconjunto de eventos (card individual ou grupo de dia)
  const printEvents = (eventsToprint: TimelineEvent[], title: string) => {
    const rows = eventsToprint.map((e) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b;white-space:nowrap">
          ${format(new Date(e.event_at), "dd/MM/yyyy HH:mm")}
        </td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">
          <span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;background:#f1f5f9;color:#334155">
            ${EVENT_TYPE_LABELS[e.event_type] ?? e.event_type}
          </span>
        </td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:500">
          ${e.event_label ?? ""}
        </td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b">
          ${e.summary ?? ""}
        </td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b">
          ${e.author_email ?? ""}
        </td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8"/>
      <title>Histórico — ${patientName}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 16px; color: #1e293b; }
        .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
        .header h1 { margin: 0 0 2px; font-size: 15px; font-weight: 700; text-transform: uppercase; }
        .header p { margin: 0; font-size: 11px; color: #64748b; }
        .section-title { font-size: 12px; font-weight: 600; text-transform: uppercase;
          letter-spacing: .06em; color: #475569; margin: 0 0 8px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8fafc; padding: 6px 8px; text-align: left; font-size: 10px;
          font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
          color: #64748b; border-bottom: 2px solid #e2e8f0; }
        @page { size: A4 portrait; margin: 14mm; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>
      <div class="header">
        <h1>${patientName}</h1>
        <p>${[patientBed ? "Leito " + patientBed : "", patientSector ?? ""].filter(Boolean).join(" · ")} · Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
      </div>
      <p class="section-title">${title} · ${eventsToprint.length} registro${eventsToprint.length !== 1 ? "s" : ""}</p>
      <table>
        <thead><tr>
          <th>Data/Hora</th><th>Tipo</th><th>Evento</th><th>Resumo</th><th>Responsável</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  const printDocumentFromHistory = async (e: TimelineEvent) => {
    if (!PRINTABLE_TYPES.has(e.event_type)) return;
    setPrintingId(e.event_id);

    const openPrint = (html: string) => {
      const w = window.open("", "_blank", "width=960,height=720");
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { try { w.print(); } finally { /* noop */ } }, 500);
    };

    const docHeader = (tipo: string) => `
      <!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8"/>
      <title>${tipo} — ${patientName}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; margin:0; padding:18px 20px; color:#1e293b; font-size:12px; }
        .hdr { border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:flex-end; }
        .hdr-left h1 { margin:0 0 2px; font-size:15px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; }
        .hdr-left p  { margin:0; font-size:10px; color:#64748b; }
        .hdr-right   { text-align:right; font-size:10px; color:#64748b; }
        .doc-title   { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#0f172a; margin:0 0 12px; border-left:3px solid #0ea5e9; padding-left:8px; }
        .section     { margin-bottom:12px; }
        .section-lbl { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#94a3b8; margin-bottom:3px; }
        .section-val { font-size:12px; color:#1e293b; white-space:pre-wrap; line-height:1.5; }
        .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
        .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:12px; }
        table { width:100%; border-collapse:collapse; margin-bottom:12px; }
        th { background:#f8fafc; padding:5px 8px; text-align:left; font-size:9px; font-weight:700; text-transform:uppercase; color:#64748b; border-bottom:2px solid #e2e8f0; }
        td { padding:5px 8px; font-size:11px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
        .badge { display:inline-block; padding:1px 7px; border-radius:4px; font-size:9px; font-weight:700; background:#f1f5f9; color:#334155; }
        @page { size:A4 portrait; margin:14mm; }
        @media print { body { padding:0; } }
      </style></head><body>
      <div class="hdr">
        <div class="hdr-left">
          <h1>${patientName}</h1>
          <p>${[patientBed ? "Leito " + patientBed : "", patientSector ? patientSector : ""].filter(Boolean).join(" · ")}</p>
        </div>
        <div class="hdr-right">
          ${tipo}<br/>
          Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>
      </div>`;

    try {
      if (e.event_type === "evolution") {
        const { data } = await supabase
          .from("clinical_evolutions")
          .select("*")
          .eq("id", e.event_id)
          .maybeSingle();
        if (!data) { alert("Evolução não encontrada."); setPrintingId(null); return; }
        // Reaproveita o mesmo builder usado no EvolutionForm/Timeline — evita
        // remontar o HTML na mão (a versão anterior tinha, inclusive, nomes
        // de campo de sinais vitais que não batiam com o schema real, então
        // a linha de sinais vitais nunca aparecia).
        await printEvolution(data as unknown as EvolutionRecord, {
          patientName: patientName ?? undefined,
          patientBed: patientBed ?? undefined,
          patientSector: patientSector ?? undefined,
        });
        setPrintingId(null);
        return;
      }

      if (e.event_type === "prescription") {
        const { data } = await supabase
          .from("prescriptions")
          .select("items,patient_data,status,version,created_at,notes")
          .eq("id", e.event_id)
          .maybeSingle();
        if (!data) { alert("Prescrição não encontrada."); setPrintingId(null); return; }
        const items = Array.isArray(data.items) ? data.items as any[] : [];
        const rows  = items.map((it: any, i: number) => `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${it.medication || it.name || it.description || ""}</strong>${it.presentation ? ` <span style="color:#64748b">(${it.presentation})</span>` : ""}</td>
            <td>${it.dose || ""}</td>
            <td>${it.route || ""}</td>
            <td>${it.frequency || it.frequencia || ""}</td>
          </tr>`).join("");
        const html = docHeader("PRESCRIÇÃO MÉDICA") + `
          <p class="doc-title">Prescrição Médica · ${format(new Date(data.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
          <div class="grid2" style="margin-bottom:14px">
            <div><div class="section-lbl">Status</div><div class="section-val"><span class="badge">${data.status ?? ""}</span></div></div>
            <div><div class="section-lbl">Versão</div><div class="section-val">${data.version ?? ""}</div></div>
          </div>
          <table>
            <thead><tr><th>#</th><th>Medicamento</th><th>Dose</th><th>Via</th><th>Frequência</th></tr></thead>
            <tbody>${rows || "<tr><td colspan='5' style='text-align:center;color:#94a3b8'>Sem itens registrados</td></tr>"}</tbody>
          </table>
          ${data.notes ? `<div class="section"><div class="section-lbl">Observações</div><div class="section-val">${data.notes}</div></div>` : ""}
        </body></html>`;
        openPrint(html); setPrintingId(null); return;
      }

      if (e.event_type === "exam_request") {
        const { data } = await supabase
          .from("exam_requests")
          .select("*")
          .eq("id", e.event_id)
          .maybeSingle();
        if (!data) { alert("Requisição não encontrada."); setPrintingId(null); return; }
        // Reaproveita os mesmos despachantes de impressão da Requisição
        // Unificada — mesmo tratamento de gasometria (Lab), do laudo
        // formal quando existe document_payload real (Procedimento), e do
        // impresso interno de Hemocomponente/SAT (Terapêutico) — em vez de
        // uma guia genérica remontada na mão, que não sabe nada disso.
        if (data.category === "procedimento") {
          await printProcedimentoRequest(data, getSectorDisplayLabel);
        } else if (data.category === "terapeutico") {
          await printTerapeuticoRequest(data, getSectorDisplayLabel);
        } else {
          await printRequisitionGuideWithGasometriaPrompt(data, getSectorDisplayLabel);
        }
        setPrintingId(null);
        return;
      }

      if (e.event_type === "admission_history") {
        const { data } = await supabase
          .from("admission_histories")
          .select("chief_complaint,clinical_history,diagnostic_hypothesis,initial_conduct,cid_primary,cid_secondary,macro_diagnosis,created_at")
          .eq("id", e.event_id)
          .maybeSingle();
        if (!data) { alert("Admissão não encontrada."); setPrintingId(null); return; }
        const html = docHeader("FICHA DE ADMISSÃO") + `
          <p class="doc-title">Admissão · ${format(new Date(data.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
          <div class="grid2">
            <div><div class="section-lbl">CID Principal</div><div class="section-val">${data.cid_primary ?? "—"}</div></div>
            <div><div class="section-lbl">CID Secundário</div><div class="section-val">${data.cid_secondary ?? "—"}</div></div>
          </div>
          ${data.macro_diagnosis       ? `<div class="section"><div class="section-lbl">Diagnóstico</div><div class="section-val">${data.macro_diagnosis}</div></div>` : ""}
          ${data.chief_complaint       ? `<div class="section"><div class="section-lbl">Queixa Principal</div><div class="section-val">${data.chief_complaint}</div></div>` : ""}
          ${data.clinical_history      ? `<div class="section"><div class="section-lbl">História Clínica</div><div class="section-val">${data.clinical_history}</div></div>` : ""}
          ${data.diagnostic_hypothesis ? `<div class="section"><div class="section-lbl">Hipótese Diagnóstica</div><div class="section-val">${data.diagnostic_hypothesis}</div></div>` : ""}
          ${data.initial_conduct       ? `<div class="section"><div class="section-lbl">Conduta Inicial</div><div class="section-val">${data.initial_conduct}</div></div>` : ""}
        </body></html>`;
        openPrint(html); setPrintingId(null); return;
      }

      if (e.event_type === "discharge_document") {
        const { data } = await supabase
          .from("discharge_documents")
          .select("document_type,content")
          .eq("id", e.event_id)
          .maybeSingle();
        if (!data) { alert("Sumário de alta não encontrado."); setPrintingId(null); return; }
        // Reaproveita o mesmo builder usado na emissão original (Norma Zero) —
        // em vez de remontar o HTML na mão como os demais tipos acima, garante
        // que a reimpressão saia idêntica ao documento que foi de fato emitido.
        await printDischargeDocument(
          data.document_type as DischargeDocType,
          data.content as DischargeDocPayload,
        );
        setPrintingId(null);
        return;
      }

      const html = docHeader(EVENT_TYPE_LABELS[e.event_type] ?? "EVENTO") + `
        <p class="doc-title">${e.event_label}</p>
        <div class="section"><div class="section-lbl">Data/Hora</div><div class="section-val">${format(new Date(e.event_at), "dd/MM/yyyy 'às' HH:mm")}</div></div>
        ${e.summary ? `<div class="section"><div class="section-lbl">Resumo</div><div class="section-val">${e.summary}</div></div>` : ""}
      </body></html>`;
      openPrint(html);
    } catch (err) {
      console.error("[HistoricoPrint]", err);
      alert("Erro ao carregar o documento para impressão.");
    }
    setPrintingId(null);
  };

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
              {patientSector && <span className="patient-id"> · {getSectorDisplayLabel(patientSector)}</span>}
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
          <SectionLoader
            message="Carregando histórico"
            subMessage="Buscando todos os registros longitudinais do paciente"
          />
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
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {format(new Date(day + "T00:00:00"), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      <Badge variant="secondary" className="ml-2 h-4 text-[10px]">
                        {items.length}
                      </Badge>
                    </h2>
                    <button
                      onClick={() => printEvents(
                        items,
                        format(new Date(day + "T00:00:00"), "EEEE, dd/MM/yyyy", { locale: ptBR })
                      )}
                      className="print:hidden flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
                      title="Imprimir registros deste dia"
                    >
                      <Printer className="h-3 w-3" />
                      Imprimir dia
                    </button>
                  </div>
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
                        <Card className="p-3 hover:shadow-sm transition-shadow group">
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
                            {PRINTABLE_TYPES.has(e.event_type) && (
                              <button
                                onClick={() => printDocumentFromHistory(e)}
                                disabled={printingId === e.event_id}
                                className="print:hidden opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50"
                                title="Imprimir documento"
                              >
                                {printingId === e.event_id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Printer className="h-3.5 w-3.5" />}
                              </button>
                            )}
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
