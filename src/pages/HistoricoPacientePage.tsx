import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useHospital } from "@/contexts/HospitalContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Search, Filter, Clock, User as UserIcon,
  Stethoscope, Pill, FlaskConical, Activity, BedDouble, FileText,
  Microscope, Truck, ClipboardEdit, Hospital, Loader2, Printer,
  HeartPulse, Users, FileCheck, ChevronDown, CalendarDays, ClipboardList, Ban
} from "lucide-react";
import {
  usePatientTimeline,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  type TimelineEventType,
  type TimelineEvent,
} from "@/hooks/usePatientTimeline";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { PatientIdentityBar } from "@/components/PatientIdentityBar";
import { SapsView, type SapsRow } from "@/components/saps3/SapsView";
import { printSapsDocument } from "@/lib/printSaps";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { SectionLoader } from "@/components/SectionLoader";
import { supabase } from "@/integrations/supabase/client";
import { printDischargeDocument, fromAltaTipoDb, type DischargeDocType, type DischargeDocPayload } from "@/lib/dischargeDocuments";
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
  "documento_medico",
  "receituario",
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
  documento_medico: FileText,
  receituario: FileText,
};

// Setores que exigem SAPS 3 (UTI 1 / UTI 2 / UCI 2) — mesmo criterio da
// Admissao/alocacao. O codigo do setor vem de setores.nome.
const SAPS_SECTORS = new Set(["red", "yellow", "outside"]);
// Mesmo conjunto de colunas lido pela AdmissaoPage (+ internacao_id para o mapa).
const SAPS_SELECT =
  "id, internacao_id, status, pending_since, validado_em, escore_box1, escore_box2, escore_box3, escore_total, " +
  "mortalidade_prevista, idade, dias_hospital_antes_uti, origem_admissao, comorbidades, admissao_planejada, " +
  "motivo_admissao, motivo_admissao_detalhe, status_cirurgico, tipo_cirurgia, infeccao_na_admissao, " +
  "escore_glasgow, fc_mais_alta, pas_mais_baixa, temperatura_mais_baixa, bilirrubina_mais_alta, " +
  "creatinina_mais_alta, leucocitos, plaquetas_mais_baixas, ph_mais_baixo, relacao_pao2_fio2, ventilacao_mecanica, criado_em";

// Blocos por categoria dentro de cada atendimento. A ordem aqui e a ordem de render.
type BlockKey = "admissao" | "evolucoes" | "prescricoes" | "exames" | "movimentacoes" | "desfecho";
const BLOCKS: { key: BlockKey; label: string; icon: React.ElementType }[] = [
  { key: "admissao", label: "Admissao (D0)", icon: FileText },
  { key: "evolucoes", label: "Evolucoes", icon: Stethoscope },
  { key: "prescricoes", label: "Prescricoes", icon: Pill },
  { key: "exames", label: "Requisicoes / Exames", icon: FlaskConical },
  { key: "movimentacoes", label: "Movimentacoes", icon: Truck },
  { key: "desfecho", label: "Desfecho / Documentos", icon: FileCheck },
];
// Cada tipo de evento cai em exatamente um bloco. Cobre todos os TimelineEventType
// (mesmo os que a timeline atual nao gera) para o filtro por tipo nunca sumir com evento.
const BLOCK_OF: Record<TimelineEventType, BlockKey> = {
  pre_admission: "admissao",
  encounter: "admissao",
  admission_history: "admissao",
  evolution: "evolucoes",
  vital_signs: "evolucoes",
  round: "evolucoes",
  prescription: "prescricoes",
  dispensation: "prescricoes",
  dhd: "prescricoes",
  exam_request: "exames",
  culture_result: "exames",
  movement: "movimentacoes",
  conduct_change: "movimentacoes",
  bed_status: "movimentacoes",
  discharge_document: "desfecho",
  documento_medico: "desfecho",
  receituario: "desfecho",
};

interface EncounterRow {
  id: string;
  data_entrada: string;
  data_alta: string | null;
  status: string;
  leito_id: string | null;
  setor_classificacao_id: string | null;
  setor?: { nome: string | null } | null;
}

// Desfecho do atendimento a partir de data_alta + status.
function encounterOutcome(enc: EncounterRow): { label: string; active: boolean } {
  const active = !enc.data_alta || enc.status === "ativa";
  if (active) return { label: "Ativo", active: true };
  switch (enc.status) {
    case "obito": return { label: "Obito", active: false };
    case "transferida": return { label: "Transf. externa", active: false };
    case "alta": return { label: "Alta", active: false };
    default: return { label: "Encerrado", active: false };
  }
}

// ── Movimentacoes de logs_auditoria (nao modeladas em transferencias) ──
// Prefixos de tipo_evento que representam movimentacao/sinalizacao/suspensao,
// mesmos de usePatientMovements. Ancoram em internacao_id.
const MOVIMENTACAO_PREFIXES = ["movimentacao_", "sinalizacao_transferencia_", "suspensao_"];

// Rotulo amigavel dos tipos conhecidos (mesma ideia do SignalingFlowRecord).
const MOVIMENTACAO_LABELS: Record<string, string> = {
  transferencia_interna: "Transferencia interna",
  transferencia_externa: "Transferencia externa",
  alta_hospitalar: "Alta hospitalar",
  obito: "Obito",
  evasao: "Evasao",
  suspensao_alta: "Suspensao de alta",
  suspensao_obito: "Suspensao de obito",
};

// Remove o prefixo da fonte e prettifica; checa o mapa antes e depois da limpeza.
function movimentacaoLabel(tipoEvento: string): string {
  if (MOVIMENTACAO_LABELS[tipoEvento]) return MOVIMENTACAO_LABELS[tipoEvento];
  const cleaned = tipoEvento
    .replace(/^movimentacao_/, "")
    .replace(/^sinalizacao_transferencia_/, "transferencia_")
    .replace(/^sinalizacao_/, "");
  if (MOVIMENTACAO_LABELS[cleaned]) return MOVIMENTACAO_LABELS[cleaned];
  const pretty = cleaned.replace(/_/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

interface MovimentacaoLog {
  id: string;
  internacao_id: string;
  tipo_evento: string;
  label: string;
  data: string;
  destino: string | null;
  motivo: string | null;
}

// Linha crua de logs_auditoria (so os campos lidos aqui), para tipar sem `any`.
interface LogAuditoriaRow {
  id: string;
  internacao_id: string | null;
  tipo_evento: string | null;
  criado_em: string;
  motivo: string | null;
  dados_novos: { destination?: string | null; target_sector_label?: string | null; notes?: string | null } | null;
}

// Turno/tipo da evolucao a partir de soap.__evolution_type.
function evolutionShiftLabel(soap: { __evolution_type?: string | null } | null | undefined): string {
  switch (soap?.__evolution_type) {
    case "admission": return "Admissao";
    case "vespertina": return "Vespertina";
    case "noturna": return "Noturna";
    case "intercurrence": return "Intercorrencia";
    default: return "Rotina";
  }
}

const ALLOWED_PROFILES = new Set([
  "admin",
  "medico",
  "gestor",
  "coord_medico",
  "coord_enfermagem",
  "coord_multi",
]);

export default function HistoricoPacientePage() {
  // Necessario para os reimpressos: o nome do hospital entra no cabecalho do
  // receituario e do documento medico.
  const { currentHospital } = useHospital();
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
  // Guarda de acesso (G9): calculada aqui, mas o render de "ACESSO RESTRITO" so
  // acontece apos TODOS os hooks (abaixo), para nao violar as regras de hooks com
  // um return adiantado. As queries ficam desabilitadas quando sem acesso, entao
  // nenhum dado e buscado para quem nao pode ver.
  const hasAccess = ALLOWED_PROFILES.has(accessProfile)
    || availableProfiles.some((p) => ALLOWED_PROFILES.has(p));

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
  const [printingSaps, setPrintingSaps] = useState<string | null>(null);

  // ── Resolucao da PESSOA (registry) ──
  // A timeline multi-atendimento precisa de patientRegistryId (= pacientes.id).
  // Prioriza o da URL; se ausente, resolve a partir do patientId (internacoes.id
  // -> paciente_id). Enquanto resolve, registryResolving segura o loader.
  const [resolvedRegistryId, setResolvedRegistryId] = useState<string | null>(patientRegistryId);
  const [registryResolving, setRegistryResolving] = useState<boolean>(!patientRegistryId && !!patientId);
  useEffect(() => {
    if (!hasAccess) { setResolvedRegistryId(null); setRegistryResolving(false); return; }
    if (patientRegistryId) { setResolvedRegistryId(patientRegistryId); setRegistryResolving(false); return; }
    if (!patientId) { setResolvedRegistryId(null); setRegistryResolving(false); return; }
    let cancel = false;
    setRegistryResolving(true);
    (async () => {
      const { data } = await supabase
        .from("internacoes")
        .select("paciente_id")
        .eq("id", patientId)
        .maybeSingle();
      if (!cancel) {
        setResolvedRegistryId((data as { paciente_id: string | null } | null)?.paciente_id ?? null);
        setRegistryResolving(false);
      }
    })();
    return () => { cancel = true; };
  }, [patientRegistryId, patientId, hasAccess]);

  // Timeline da PESSOA: passa APENAS o registry (patientId null) para trazer os
  // eventos de TODAS as internacoes. Os filtros continuam sendo aplicados pela
  // propria hook, portanto `events` ja chega filtrado antes do agrupamento.
  const { data: events = [], isLoading } = usePatientTimeline({
    patientRegistryId: resolvedRegistryId,
    patientId: null,
    eventTypes: selectedTypes,
    fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
    toDate: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined,
    search,
  });

  // Lista de ATENDIMENTOS (internacoes) da pessoa + rotulo do setor.
  const { data: encounters = [] } = useQuery({
    queryKey: ["historico-internacoes", resolvedRegistryId],
    enabled: !!resolvedRegistryId,
    queryFn: async (): Promise<EncounterRow[]> => {
      const { data } = await supabase
        .from("internacoes")
        .select("id, data_entrada, data_alta, status, leito_id, setor_classificacao_id, setor:setores!internacoes_setor_classificacao_id_fkey(nome)")
        .eq("paciente_id", resolvedRegistryId as string)
        .order("data_entrada", { ascending: false });
      return (data ?? []) as unknown as EncounterRow[];
    },
  });

  const encounterIds = useMemo(() => encounters.map((e) => e.id), [encounters]);

  // Fichas SAPS 3 por internacao (mapa internacao_id -> SapsRow). Prefere a validada.
  const { data: sapsRows = [] } = useQuery({
    queryKey: ["historico-saps", encounterIds],
    enabled: encounterIds.length > 0,
    queryFn: async (): Promise<(SapsRow & { internacao_id: string })[]> => {
      const { data } = await supabase
        .from("avaliacoes_saps3")
        .select(SAPS_SELECT)
        .in("internacao_id", encounterIds);
      return (data ?? []) as unknown as (SapsRow & { internacao_id: string })[];
    },
  });

  const sapsByEncounter = useMemo(() => {
    const m = new Map<string, SapsRow>();
    sapsRows.forEach((r) => {
      const prev = m.get(r.internacao_id);
      // Prefere validada; na duvida mantem a mais recente (criado_em).
      if (!prev) { m.set(r.internacao_id, r); return; }
      const prevValidada = prev.status === "validada";
      const curValidada = r.status === "validada";
      if (curValidada && !prevValidada) m.set(r.internacao_id, r);
    });
    return m;
  }, [sapsRows]);

  // Movimentacoes/sinalizacoes reais de logs_auditoria (ancoradas em internacao_id).
  // A timeline so traz "movement" de transferencias (leito->leito); as demais
  // (transferencia externa, alta, obito, evasao, suspensoes) vivem aqui.
  const { data: movLogs = [] } = useQuery({
    queryKey: ["historico-movimentacoes", encounterIds],
    enabled: encounterIds.length > 0,
    queryFn: async (): Promise<MovimentacaoLog[]> => {
      const { data } = await supabase
        .from("logs_auditoria")
        .select("*")
        .in("internacao_id", encounterIds);
      const rows = (data ?? []) as unknown as LogAuditoriaRow[];
      return rows
        .filter((r) => !!r.tipo_evento && MOVIMENTACAO_PREFIXES.some((p) => r.tipo_evento!.startsWith(p)))
        .map((r) => {
          const dn = r.dados_novos ?? {};
          const tipo = r.tipo_evento as string;
          return {
            id: r.id,
            internacao_id: (r.internacao_id ?? "") as string,
            tipo_evento: tipo,
            label: movimentacaoLabel(tipo),
            data: r.criado_em,
            destino: dn.destination ?? dn.target_sector_label ?? null,
            motivo: r.motivo ?? dn.notes ?? null,
          };
        });
    },
  });

  const movByEncounter = useMemo(() => {
    const m = new Map<string, MovimentacaoLog[]>();
    movLogs.forEach((mv) => {
      if (!m.has(mv.internacao_id)) m.set(mv.internacao_id, []);
      m.get(mv.internacao_id)!.push(mv);
    });
    return m;
  }, [movLogs]);

  // Eventos agrupados por atendimento (patient_id = internacao_id).
  const eventsByEncounter = useMemo(() => {
    const m = new Map<string, TimelineEvent[]>();
    events.forEach((e) => {
      const k = e.patient_id ?? "";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    });
    return m;
  }, [events]);

  // Ordem de exibicao (ativo primeiro, depois recentes->antigos) + N sequencial
  // (1 = mais antigo).
  const orderedEncounters = useMemo(() => {
    const byOldest = [...encounters].sort(
      (a, b) => new Date(a.data_entrada).getTime() - new Date(b.data_entrada).getTime(),
    );
    const nMap = new Map<string, number>();
    byOldest.forEach((e, i) => nMap.set(e.id, i + 1));
    const display = [...encounters].sort((a, b) => {
      const aActive = encounterOutcome(a).active;
      const bActive = encounterOutcome(b).active;
      if (aActive !== bActive) return aActive ? -1 : 1;
      return new Date(b.data_entrada).getTime() - new Date(a.data_entrada).getTime();
    });
    return display.map((e) => ({ enc: e, n: nMap.get(e.id) ?? 0 }));
  }, [encounters]);

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
    // BUGFIX: event_id vem como `${event_type}-${row.id}` (prefixo do tipo), mas
    // os lookups abaixo buscam por `id` = PK da linha de origem. Sem remover o
    // prefixo, `.eq("id", event_id)` nunca casava e a reimpressao por item sempre
    // falhava ("nao encontrada"). rawId = id real da linha.
    const rawId = e.event_id.startsWith(`${e.event_type}-`)
      ? e.event_id.slice(e.event_type.length + 1)
      : e.event_id;

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
        // MIGRAÇÃO: clinical_evolutions → evolucoes. A linha nova não tem o mesmo
        // shape do EvolutionRecord (campos dedicados viraram JSON `soap`/`exame_fisico`),
        // então mapeamos aqui antes de reaproveitar o builder printEvolution — mesma
        // convenção `__` de useEvolutions.mapEvolution.
        const { data } = await supabase
          .from("evolucoes")
          .select("*")
          .eq("id", rawId)
          .maybeSingle();
        if (!data) { alert("Evolução não encontrada."); setPrintingId(null); return; }
        const d = data as any;
        const soap = (d.soap as any) || {};
        const evoRecord: EvolutionRecord = {
          id: d.id,
          patient_id: d.internacao_id ?? null,
          patient_registry_id: null,
          archived_at: null,
          archive_reason: null,
          patient_name: soap.__patient_name ?? (patientName ?? ""),
          patient_bed: soap.__patient_bed ?? (patientBed ?? null),
          patient_sector: soap.__patient_sector ?? (patientSector ?? null),
          soap_data: { subjective: "", objective: "", assessment: "", plan: "", ...soap },
          vital_signs: { pa: "", fc: "", fr: "", temp: "", spo2: "", glasgow: "", diurese: "", dor: "", ...(soap.__vital_signs ?? {}) },
          physical_exam: { general: "", cardiovascular: "", respiratory: "", abdomen: "", neurological: "", extremities: "", skin: "", other: "", ...((d.exame_fisico as any) ?? {}) },
          status: (d.status as EvolutionRecord["status"]) ?? "draft",
          evolution_type: soap.__evolution_type ?? undefined,
          diagnostic_hypotheses: soap.__diagnostic_hypotheses ?? null,
          cid_primary: soap.__cid_primary ?? null,
          cid_secondary: soap.__cid_secondary ?? null,
          validated_at: soap.__validated_at ?? null,
          validated_by: soap.__validated_by ?? null,
          validated_by_name: soap.__validated_by_name ?? null,
          suspended_at: soap.__suspended_at ?? null,
          suspension_reason: d.motivo_suspensao ?? null,
          created_by: soap.__created_by ?? d.profissional_id ?? "",
          created_by_name: soap.__created_by_name ?? null,
          created_at: d.criado_em ?? d.data_hora,
          updated_at: d.atualizado_em ?? d.criado_em ?? d.data_hora,
        };
        await printEvolution(evoRecord, {
          patientName: patientName ?? undefined,
          patientBed: patientBed ?? undefined,
          patientSector: patientSector ?? undefined,
        });
        setPrintingId(null);
        return;
      }

      if (e.event_type === "prescription") {
        // MIGRAÇÃO: prescriptions → prescricoes. Colunas: itens→items, versao→version,
        // criado_em→created_at, observacoes→notes. `patient_data` não existe no schema
        // novo (identidade vem de internacoes→pacientes) → degradado (não usado no impresso).
        const { data: rx } = await supabase
          .from("prescricoes")
          .select("itens,status,versao,criado_em,observacoes")
          .eq("id", rawId)
          .maybeSingle();
        if (!rx) { alert("Prescrição não encontrada."); setPrintingId(null); return; }
        const data = {
          items: (rx as any).itens,
          status: (rx as any).status,
          version: (rx as any).versao,
          created_at: (rx as any).criado_em,
          notes: (rx as any).observacoes,
        };
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
        // MIGRAÇÃO: exam_requests → solicitacoes_exame (itens→items, categoria→category).
        // Os despachantes de impressão (printProcedimento/Terapeutico/Requisition) ainda
        // consomem o shape antigo (request.items/request.category), então adaptamos a
        // linha para esse shape em vez de editar esses helpers.
        const { data: sol } = await supabase
          .from("solicitacoes_exame")
          .select("*")
          .eq("id", rawId)
          .maybeSingle();
        if (!sol) { alert("Requisição não encontrada."); setPrintingId(null); return; }
        const data = { ...(sol as any), items: (sol as any).itens, category: (sol as any).categoria };
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
        // MIGRAÇÃO: admission_histories (morta) → conteúdo de admissão vive em internacoes.
        // Ancoramos pela internação (patientId = internacoes.id); se ausente, tenta o
        // event_id. Colunas: chief_complaint→queixa_principal, clinical_history→
        // historia_clinica, diagnostic_hypothesis→hipotese_diagnostica, initial_conduct→
        // conduta_inicial. DEGRADADO: cid_primary/cid_secondary/macro_diagnosis não têm
        // coluna em internacoes → bloco de CID/diagnóstico removido do impresso.
        const admInternacaoId = rawId;
        const { data } = await supabase
          .from("internacoes")
          .select("queixa_principal,historia_clinica,hipotese_diagnostica,conduta_inicial,data_entrada,criado_em")
          .eq("id", admInternacaoId)
          .maybeSingle();
        if (!data) { alert("Admissão não encontrada."); setPrintingId(null); return; }
        const i = data as any;
        const admDate = i.data_entrada || i.criado_em || e.event_at;
        const html = docHeader("FICHA DE ADMISSÃO") + `
          <p class="doc-title">Admissão · ${format(new Date(admDate), "dd/MM/yyyy 'às' HH:mm")}</p>
          ${i.queixa_principal    ? `<div class="section"><div class="section-lbl">Queixa Principal</div><div class="section-val">${i.queixa_principal}</div></div>` : ""}
          ${i.historia_clinica    ? `<div class="section"><div class="section-lbl">História Clínica</div><div class="section-val">${i.historia_clinica}</div></div>` : ""}
          ${i.hipotese_diagnostica ? `<div class="section"><div class="section-lbl">Hipótese Diagnóstica</div><div class="section-val">${i.hipotese_diagnostica}</div></div>` : ""}
          ${i.conduta_inicial     ? `<div class="section"><div class="section-lbl">Conduta Inicial</div><div class="section-val">${i.conduta_inicial}</div></div>` : ""}
        </body></html>`;
        openPrint(html); setPrintingId(null); return;
      }

      if (e.event_type === "discharge_document") {
        // MIGRAÇÃO: discharge_documents → altas (document_type→tipo, content→conteudo).
        const { data } = await supabase
          .from("altas")
          .select("tipo,conteudo")
          .eq("id", rawId)
          .maybeSingle();
        if (!data) { alert("Sumário de alta não encontrado."); setPrintingId(null); return; }
        await printDischargeDocument(
          fromAltaTipoDb((data as any).tipo),
          (data as any).conteudo as DischargeDocPayload,
        );
        setPrintingId(null);
        return;
      }

      if (e.event_type === "documento_medico") {
        // MIGRAÇÃO: documentos_medicos → altas (tipo/conteudo). Reusa o mesmo
        // mapeamento do useDocumentoMedico para reconstruir o shape esperado.
        const { data } = await supabase
          .from("altas")
          .select("*")
          .eq("id", rawId)
          .maybeSingle();
        if (!data) { alert("Documento não encontrado."); setPrintingId(null); return; }
        const { printDocumentoMedico } = await import("@/lib/documentoMedico");
        const { mapRow } = await import("@/hooks/useDocumentoMedico");
        // O `hospitalName` era `x ? undefined : undefined` — os dois ramos
        // davam undefined, entao o nome do hospital NUNCA era passado. E o
        // `onPrint` nao existe na assinatura. Passa o hospital de verdade.
        await printDocumentoMedico(mapRow(data as any), {
          hospitalName: currentHospital?.name,
        });
        setPrintingId(null);
        return;
      }

      if (e.event_type === "receituario") {
        const { data } = await supabase
          .from("receituarios")
          .select("*")
          .eq("id", rawId)
          .maybeSingle();
        if (!data) { alert("Receituário não encontrado."); setPrintingId(null); return; }
        const { printReceituario } = await import("@/lib/receituario");
        // AUDITORIA 18/09/2026 — aqui ia `{ onPrint: () => {} }`, um OBJETO, no
        // parametro que e o NOME DO HOSPITAL (string). Objeto e truthy, entao
        // passava direto pelo `hospitalName || "<padrao>"` de receituario.ts e
        // era interpolado no documento: o receituario reimpresso pelo historico
        // saia com "[object Object]" onde deveria estar o nome do hospital.
        // Os outros cinco chamadores ja passavam a string certa; so este nao.
        // O `onPrint` sequer existe na assinatura da funcao.
        await printReceituario(data as any, currentHospital?.name);
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

  // Impressao da ficha SAPS 3 (reusa o mesmo helper da Admissao).
  const handlePrintSaps = (enc: EncounterRow, saps: SapsRow) => {
    setPrintingSaps(enc.id);
    try {
      printSapsDocument(saps, {
        patientName,
        patientBed,
        patientSector: getSectorDisplayLabel(enc.setor?.nome ?? patientSector ?? ""),
        hospitalName: currentHospital?.name ?? null,
      });
    } finally {
      setPrintingSaps(null);
    }
  };

  // ── Render de um evento (reaproveita ICONS/LABELS/COLORS + botao de impressao) ──
  const renderEventItem = (e: TimelineEvent) => {
    const Icon = ICONS[e.event_type] ?? FileText;
    // Evolucao: medico que executou (soap.__created_by_name, fallback author_email)
    // e turno/tipo (soap.__evolution_type) exibido como Badge ao lado do tipo/hora.
    const isEvolution = e.event_type === "evolution";
    const evoSoap = isEvolution ? (e.payload?.soap ?? null) : null;
    const evoMedico = isEvolution ? (evoSoap?.__created_by_name || e.author_email || null) : null;
    return (
      <div key={e.event_id} className="flex items-start gap-2 rounded-md border border-border/60 bg-background px-3 py-2 hover:bg-muted/40 transition-colors group">
        <div className={cn(
          "mt-0.5 h-6 w-6 shrink-0 rounded-full border flex items-center justify-center",
          EVENT_TYPE_COLORS[e.event_type] ?? "border-border",
        )}>
          <Icon className="h-3 w-3" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn("h-5 text-xs", EVENT_TYPE_COLORS[e.event_type])}>
              {EVENT_TYPE_LABELS[e.event_type]}
            </Badge>
            {isEvolution && (
              <Badge variant="secondary" className="h-5 text-xs">
                {evolutionShiftLabel(evoSoap)}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(e.event_at), "dd/MM/yyyy HH:mm")}
            </span>
            {isEvolution ? (
              evoMedico && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <UserIcon className="h-3 w-3" />
                  por {evoMedico}
                </span>
              )
            ) : (
              e.author_email && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <UserIcon className="h-3 w-3" />
                  {e.author_email}
                </span>
              )
            )}
          </div>
          {e.event_label && <p className="text-sm font-medium mt-1 break-words">{e.event_label}</p>}
          {e.summary && <p className="text-xs text-muted-foreground mt-0.5 break-words">{e.summary}</p>}
        </div>
        {PRINTABLE_TYPES.has(e.event_type) && (
          <button
            onClick={() => printDocumentFromHistory(e)}
            disabled={printingId === e.event_id}
            className="print:hidden opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Imprimir documento"
          >
            {printingId === e.event_id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Printer className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    );
  };

  // ── Render de um item de movimentacao de logs_auditoria ──
  const renderMovItem = (m: MovimentacaoLog) => {
    const Icon = m.tipo_evento.startsWith("suspensao_") ? Ban : Truck;
    return (
      <div key={m.id} className="flex items-start gap-2 rounded-md border border-border/60 bg-background px-3 py-2">
        <div className={cn(
          "mt-0.5 h-6 w-6 shrink-0 rounded-full border flex items-center justify-center",
          EVENT_TYPE_COLORS.movement,
        )}>
          <Icon className="h-3 w-3" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium break-words">{m.label}</span>
            {m.destino && (
              <span className="text-xs text-muted-foreground">{"→"} {m.destino}</span>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(m.data), "dd/MM/yyyy 'as' HH:mm")}
            </span>
          </div>
          {m.motivo && <p className="text-xs text-muted-foreground mt-0.5 break-words">{m.motivo}</p>}
        </div>
      </div>
    );
  };

  // ── Render de um bloco recolhivel dentro de um atendimento ──
  const renderBlock = (
    block: { key: BlockKey; label: string; icon: React.ElementType },
    blockEvents: TimelineEvent[],
    extra: React.ReactNode | null,
    defaultOpen: boolean,
    extraCount = 0,
  ) => {
    const count = blockEvents.length + extraCount;
    if (count === 0 && !extra) return null;
    const BlockIcon = block.icon;
    return (
      <Collapsible key={block.key} defaultOpen={defaultOpen} className="rounded-lg border border-border/60 bg-muted/20">
        <div className="flex items-center gap-1">
          <CollapsibleTrigger className="flex flex-1 items-center gap-2 px-3 py-2 text-left [&[data-state=open]>svg.chev]:rotate-180">
            <ChevronDown className="chev h-4 w-4 text-muted-foreground transition-transform shrink-0" />
            <BlockIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">{block.label}</span>
            <Badge variant="secondary" className="h-5 text-xs">{count}</Badge>
          </CollapsibleTrigger>
          {blockEvents.length > 0 && (
            <button
              onClick={() => printEvents(blockEvents, block.label)}
              className="print:hidden mr-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
              title={`Imprimir ${block.label}`}
            >
              <Printer className="h-3 w-3" />
            </button>
          )}
        </div>
        <CollapsibleContent>
          <div className="space-y-1.5 px-3 pb-3 pt-1">
            {extra}
            {blockEvents.map(renderEventItem)}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // ── Render de um atendimento inteiro (cabecalho + blocos) ──
  const renderEncounter = (enc: EncounterRow, n: number) => {
    const outcome = encounterOutcome(enc);
    const encEvents = eventsByEncounter.get(enc.id) ?? [];
    const encMovItems = movByEncounter.get(enc.id) ?? [];
    // Atendimento sem eventos nem movimentacoes apos filtro e ocultado — exceto o
    // ativo (cabecalho). Movimentacoes de logs_auditoria contam para a visibilidade.
    if (encEvents.length === 0 && encMovItems.length === 0 && !outcome.active) return null;

    const sectorCode = enc.setor?.nome ?? "";
    const sectorLabel = getSectorDisplayLabel(sectorCode);
    const saps = sapsByEncounter.get(enc.id) ?? null;
    const dih = Math.max(0, Math.floor((Date.now() - new Date(enc.data_entrada).getTime()) / 86400000));

    // Distribui os eventos em blocos.
    const byBlock = new Map<BlockKey, TimelineEvent[]>();
    encEvents.forEach((e) => {
      const b = BLOCK_OF[e.event_type] ?? "evolucoes";
      if (!byBlock.has(b)) byBlock.set(b, []);
      byBlock.get(b)!.push(e);
    });

    const sapsExtra = saps ? (
      <div className="rounded-md border border-border/60 bg-background p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ficha SAPS 3</span>
          <button
            onClick={() => handlePrintSaps(enc, saps)}
            disabled={printingSaps === enc.id}
            className="print:hidden ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted disabled:opacity-50"
            title="Ver/Imprimir ficha SAPS 3"
          >
            {printingSaps === enc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
            Ver/Imprimir ficha SAPS
          </button>
        </div>
        <SapsView row={saps} />
      </div>
    ) : null;

    // Movimentacoes de logs_auditoria renderizadas dentro do bloco "Movimentacoes",
    // alem dos eventos de timeline que ja caem nesse bloco.
    const movExtra = encMovItems.length > 0 ? (
      <>{encMovItems.map(renderMovItem)}</>
    ) : null;

    return (
      <Card key={enc.id} className={cn("overflow-hidden", outcome.active && "border-primary/50 ring-1 ring-primary/20")}>
        {outcome.active && (
          <div className="bg-primary/10 text-primary px-4 py-1.5 text-xs font-semibold uppercase tracking-wide flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" /> Atendimento ativo
          </div>
        )}
        <div className="px-4 py-3 border-b border-border/60">
          <div className="flex items-center gap-2 flex-wrap">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Atendimento {n}</h2>
            <Badge variant={outcome.active ? "default" : "secondary"} className="h-5 text-xs">
              {outcome.active ? "Ativo" : `→ ${outcome.label}`}
            </Badge>
            {sectorLabel && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <BedDouble className="h-3 w-3" /> {sectorLabel}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              Admissao {format(new Date(enc.data_entrada), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
            </span>
            {!outcome.active && enc.data_alta && (
              <span>{"→"} {outcome.label} em {format(new Date(enc.data_alta), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}</span>
            )}
            {outcome.active && (
              <Badge variant="outline" className="h-4 text-[10px]">DIH {dih}</Badge>
            )}
          </p>
        </div>
        <div className="p-3 space-y-2">
          {BLOCKS.map((block) => {
            const be = byBlock.get(block.key) ?? [];
            const extra = block.key === "admissao"
              ? sapsExtra
              : block.key === "movimentacoes" ? movExtra : null;
            const extraCount = block.key === "movimentacoes" ? encMovItems.length : 0;
            return renderBlock(block, be, extra, outcome.active && block.key === "admissao", extraCount);
          })}
          {encEvents.length === 0 && outcome.active && !sapsExtra && (
            <p className="text-xs text-muted-foreground px-1 py-2">
              Nenhum evento para os filtros aplicados neste atendimento.
            </p>
          )}
        </div>
      </Card>
    );
  };

  const visibleEncounters = orderedEncounters.filter(
    ({ enc }) =>
      (eventsByEncounter.get(enc.id)?.length ?? 0) > 0
      || (movByEncounter.get(enc.id)?.length ?? 0) > 0
      || encounterOutcome(enc).active,
  );

  // Guarda de acesso (G9) — render apos todos os hooks.
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md p-6 text-center space-y-3">
          <Hospital className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-medium">ACESSO RESTRITO</h1>
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
            <h1 className="text-base font-medium truncate">
              Histórico longitudinal
            </h1>
            <p className="text-xs text-muted-foreground">
              {events.length} eventos registrados
            </p>
          </div>
          <ThemeToggle />
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
              className="pl-6 h-8 text-xs"
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
                    className="flex items-center gap-2 p-2 hover:bg-muted rounded-md cursor-pointer text-xs"
                  >
                    <Checkbox
                      checked={selectedTypes.includes(t)}
                      onCheckedChange={() => toggleType(t)}
                    />
                    <span className="flex-1">{EVENT_TYPE_LABELS[t]}</span>
                    {counts[t] ? (
                      <Badge variant="secondary" className="h-4 text-xs px-1">
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
        {/* Sub-cabecalho padrao de identidade (abaixo do header sticky, que mantem
            Voltar/Imprimir/filtros + titulo). Adiciona idade/nascimento/prontuario. */}
        <PatientIdentityBar
          patientId={patientId}
          className="print:hidden rounded-lg border border-border bg-card/60 px-3 py-3 mb-4"
          rightSlot={
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground leading-tight">
              HISTÓRICO DO PACIENTE
            </p>
          }
        />
        {(registryResolving || isLoading) ? (
          <SectionLoader
            message="Carregando histórico"
            subMessage="Buscando todos os registros longitudinais do paciente"
          />
        ) : visibleEncounters.length === 0 ? (
          <Card className="p-8 text-center">
            <Clock className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum atendimento ou evento encontrado para os filtros aplicados.
            </p>
          </Card>
        ) : (
          <div className="space-y-5">
            {visibleEncounters.map(({ enc, n }) => renderEncounter(enc, n))}
          </div>
        )}
      </div>
    </div>
  );
}
