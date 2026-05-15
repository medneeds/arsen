import React, { useState, useMemo } from "react";
import { format, differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronDown, ChevronUp, Copy, Trash2, ShieldCheck, ShieldOff,
  Clock, FileText, AlertTriangle, Loader2, Calendar, Search, Filter, X, Star, Zap, Printer,
} from "lucide-react";
import { printEvolution } from "@/lib/printEvolution";
import { resolvePatientHeader } from "@/lib/resolvePatientHeader";
import { useHospital } from "@/contexts/HospitalContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor, richHtmlToPlainText } from "@/components/ui/rich-text-editor";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EvolutionRecord } from "@/hooks/useEvolutions";
import { EvolutionForm } from "./EvolutionForm";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";

interface DayGroup {
  dayLabel: string;
  dayNumber: number;
  date: string;
  evolutions: EvolutionRecord[];
}

interface EvolutionTimelineProps {
  evolutions: EvolutionRecord[];
  admissionDate?: string;
  patientRecord?: string;
  cidPrimary?: string;
  cidSecondary?: string;
  /** ID do paciente — usado para resolver identidade canônica antes de imprimir */
  patientId?: string | null;
  onUpdate: (id: string, updates: any) => Promise<boolean>;
  onValidate: (id: string) => Promise<boolean>;
  onSuspend: (id: string, reason: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onDuplicate: (evolution: EvolutionRecord) => void;
}

const STATUS_CONFIG = {
  draft: { label: "Rascunho", color: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Clock },
  validated: { label: "Validada", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: ShieldCheck },
  suspended: { label: "Suspensa", color: "bg-red-500/10 text-red-600 border-red-500/30", icon: ShieldOff },
};

export const EvolutionTimeline: React.FC<EvolutionTimelineProps> = ({
  evolutions, admissionDate, patientRecord, cidPrimary, cidSecondary, patientId, onUpdate, onValidate, onSuspend, onDelete, onDuplicate,
}) => {
  const { user } = useAuth();
  const { currentHospital } = useHospital();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, { soap: any; vitals: any; exam: any }>>({});
  const [suspendDialogId, setSuspendDialogId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  const [validateDialogId, setValidateDialogId] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "validated" | "suspended">("all");
  const [filterAuthor, setFilterAuthor] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Unique authors list
  const authors = useMemo(() => {
    const map = new Map<string, string>();
    evolutions.forEach(e => {
      if (e.created_by && e.created_by_name) map.set(e.created_by, e.created_by_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [evolutions]);

  // Apply filters
  const filteredEvolutions = useMemo(() => {
    return evolutions.filter(evo => {
      if (filterStatus !== "all" && evo.status !== filterStatus) return false;
      if (filterAuthor !== "all" && evo.created_by !== filterAuthor) return false;
      if (searchTerm.trim()) {
        const haystack = [
          evo.soap_data.subjective, evo.soap_data.objective,
          evo.soap_data.assessment, evo.soap_data.plan,
          evo.created_by_name,
        ].join(" ").toLowerCase();
        if (!haystack.includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    });
  }, [evolutions, filterStatus, filterAuthor, searchTerm]);

  const activeFilterCount = (filterStatus !== "all" ? 1 : 0) + (filterAuthor !== "all" ? 1 : 0) + (searchTerm.trim() ? 1 : 0);

  const clearFilters = () => {
    setFilterStatus("all");
    setFilterAuthor("all");
    setSearchTerm("");
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const getLocalOrOriginal = (evo: EvolutionRecord) => {
    const local = localEdits[evo.id];
    return {
      soap: local?.soap || evo.soap_data,
      vitals: local?.vitals || evo.vital_signs,
      exam: local?.exam || evo.physical_exam,
    };
  };

  const updateLocal = (id: string, field: "soap" | "vitals" | "exam", key: string, value: string) => {
    setLocalEdits(prev => {
      const evo = evolutions.find(e => e.id === id);
      if (!evo) return prev;
      const current = prev[id] || { soap: { ...evo.soap_data }, vitals: { ...evo.vital_signs }, exam: { ...evo.physical_exam } };
      return { ...prev, [id]: { ...current, [field]: { ...current[field], [key]: value } } };
    });
  };

  const handleSave = async (id: string) => {
    const local = localEdits[id];
    if (!local) return;
    setSavingId(id);
    await onUpdate(id, {
      soap_data: local.soap,
      vital_signs: local.vitals,
      physical_exam: local.exam,
    });
    setLocalEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSavingId(null);
  };

  const handleValidate = async () => {
    if (!validateDialogId) return;
    // Save any pending edits first
    const local = localEdits[validateDialogId];
    if (local) {
      await onUpdate(validateDialogId, {
        soap_data: local.soap,
        vital_signs: local.vitals,
        physical_exam: local.exam,
      });
      setLocalEdits(prev => { const n = { ...prev }; delete n[validateDialogId]; return n; });
    }
    await onValidate(validateDialogId);
    setValidateDialogId(null);
  };

  const handleSuspend = async () => {
    if (!suspendDialogId) return;
    await onSuspend(suspendDialogId, suspendReason);
    setSuspendDialogId(null);
    setSuspendReason("");
  };

  const handleDelete = async () => {
    if (!deleteDialogId) return;
    await onDelete(deleteDialogId);
    setDeleteDialogId(null);
  };

  type ComplementaryKind = 'intercurrence' | 'vespertina' | 'noturna';
  const COMPLEMENTARY_BADGE: Record<ComplementaryKind, { label: string; badgeClass: string; borderClass: string; bgClass: string; iconColor: string }> = {
    intercurrence: { label: 'Intercorrência', badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/40', borderClass: 'border-amber-500/30', bgClass: 'bg-amber-500/5', iconColor: 'text-amber-600' },
    vespertina:    { label: 'Vespertina',     badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/40', borderClass: 'border-orange-500/30', bgClass: 'bg-orange-500/5', iconColor: 'text-orange-600' },
    noturna:       { label: 'Noturna',        badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/40', borderClass: 'border-indigo-500/30', bgClass: 'bg-indigo-500/5', iconColor: 'text-indigo-600' },
  };
  const getComplementaryKind = (evo: EvolutionRecord): ComplementaryKind | null => {
    const t = (evo.soap_data as any)?.type;
    if (t === 'intercurrence' || t === 'vespertina' || t === 'noturna') return t;
    return null;
  };
  const isIntercurrence = (evo: EvolutionRecord) => getComplementaryKind(evo) !== null;

  const buildSummary = (evo: EvolutionRecord) => {
    const s = evo.soap_data;
    const subj = richHtmlToPlainText(s.subjective);
    const ass = richHtmlToPlainText(s.assessment);
    const plan = richHtmlToPlainText(s.plan);
    const kind = getComplementaryKind(evo);
    if (kind) {
      const label = COMPLEMENTARY_BADGE[kind].label;
      return subj ? `${label}: ${subj.slice(0, 120)}` : `${label} sem descrição`;
    }
    const evolucao = [subj, ass].filter(Boolean).join(" — ");
    const parts: string[] = [];
    if (evolucao) parts.push(`Evolução: ${evolucao.slice(0, 100)}`);
    if (plan) parts.push(`Plano: ${plan.slice(0, 60)}`);
    return parts.length > 0 ? parts.join(" | ") : "Evolução sem conteúdo";
  };

  const toggleDayCollapse = (dayNumber: number) => {
    setCollapsedDays(prev => {
      const n = new Set(prev);
      n.has(dayNumber) ? n.delete(dayNumber) : n.add(dayNumber);
      return n;
    });
  };

  // Group evolutions by internment day
  const dayGroups = useMemo((): DayGroup[] => {
    const admDate = admissionDate ? startOfDay(parseISO(admissionDate)) : null;
    const groups = new Map<number, DayGroup>();

    filteredEvolutions.forEach(evo => {
      const evoDate = startOfDay(new Date(evo.created_at));
      const dayNumber = admDate ? differenceInCalendarDays(evoDate, admDate) : 0;
      const dayNum = Math.max(0, dayNumber);

      if (!groups.has(dayNum)) {
        groups.set(dayNum, {
          dayLabel: `D${dayNum}`,
          dayNumber: dayNum,
          date: format(evoDate, "dd/MM/yyyy", { locale: ptBR }),
          evolutions: [],
        });
      }
      groups.get(dayNum)!.evolutions.push(evo);
    });

    return Array.from(groups.values()).sort((a, b) => b.dayNumber - a.dayNumber);
  }, [filteredEvolutions, admissionDate]);

  // ID of the most recent validated evolution → marked as "Atual"
  const currentEvolutionId = useMemo(() => {
    const validated = evolutions
      .filter(e => e.status === "validated")
      .sort((a, b) => new Date(b.validated_at || b.created_at).getTime() - new Date(a.validated_at || a.created_at).getTime());
    return validated[0]?.id || null;
  }, [evolutions]);

  // Auto-collapse all days except the most recent one (only on first render with data)
  const [didAutoCollapse, setDidAutoCollapse] = useState(false);
  React.useEffect(() => {
    if (!didAutoCollapse && dayGroups.length > 1) {
      const olderDays = dayGroups.slice(1).map(g => g.dayNumber);
      setCollapsedDays(new Set(olderDays));
      setDidAutoCollapse(true);
    }
  }, [dayGroups, didAutoCollapse]);

  if (evolutions.length === 0) return null;

  return (
    <>
      <div className="space-y-3">
        {/* Toolbar: title + filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Timeline ({filteredEvolutions.length}{filteredEvolutions.length !== evolutions.length && ` de ${evolutions.length}`})
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="relative">
              <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="h-7 pl-7 pr-2 text-xs w-36"
              />
            </div>
            <Button
              variant={showFilters || activeFilterCount > 0 ? "default" : "outline"}
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setShowFilters(v => !v)}
            >
              <Filter className="h-3 w-3" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[9px]">{activeFilterCount}</Badge>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={clearFilters}>
                <X className="h-3 w-3" /> Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Filter row */}
        {showFilters && (
          <div className="flex items-center gap-2 flex-wrap p-2 rounded-lg border border-border bg-muted/20">
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
              <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos status</SelectItem>
                <SelectItem value="draft" className="text-xs">Rascunhos</SelectItem>
                <SelectItem value="validated" className="text-xs">Validadas</SelectItem>
                <SelectItem value="suspended" className="text-xs">Suspensas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAuthor} onValueChange={setFilterAuthor}>
              <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="Autor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos autores</SelectItem>
                {authors.map(a => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {filteredEvolutions.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-xs text-muted-foreground">Nenhuma evolução encontrada com os filtros atuais.</p>
          </div>
        )}

        {dayGroups.map(group => {
          const isDayCollapsed = collapsedDays.has(group.dayNumber);
          return (
            <div key={group.dayNumber} className="space-y-1.5">
              {/* Day header */}
              <button
                type="button"
                onClick={() => toggleDayCollapse(group.dayNumber)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
                  "bg-primary/5 hover:bg-primary/10 border border-primary/15"
                )}
              >
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-primary">{group.dayLabel}</span>
                <span className="text-[10px] text-muted-foreground">— {group.date}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {group.evolutions.length} {group.evolutions.length === 1 ? "evolução" : "evoluções"}
                </span>
                {isDayCollapsed ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>

              {/* Evolutions in this day */}
              {!isDayCollapsed && group.evolutions.map(evo => {
          const isExpanded = expandedIds.has(evo.id);
          const config = STATUS_CONFIG[evo.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
          const StatusIcon = config.icon;
          const isAdmission = (evo as any).evolution_type === "admission";
          const isVirtualAdmission = isAdmission && evo.id.startsWith("admission:");
          const isAuthor = user?.id === evo.created_by;
          const isEditable = isAuthor && evo.status === "draft" && !isAdmission;
          const data = getLocalOrOriginal(evo);
          const hasUnsaved = !!localEdits[evo.id];
          const isCurrent = evo.id === currentEvolutionId;

          return (
            <div key={evo.id} className={cn(
              "rounded-xl border bg-card transition-all",
              evo.status === "suspended" && "opacity-60",
              isCurrent && !isExpanded && "border-primary/50 shadow-sm shadow-primary/10",
              isExpanded ? "border-primary/30" : !isCurrent && "border-border"
            )}>
              {/* Collapsed header */}
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpand(evo.id)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div className="w-px h-3 bg-border" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">
                        {format(new Date(evo.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      {isCurrent && (
                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary text-primary-foreground gap-0.5">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          Atual
                        </Badge>
                      )}
                      {evo.status === "validated" && evo.validated_at && (
                        <span className="text-[10px] text-muted-foreground">
                          Validada em {format(new Date(evo.validated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        por <strong className="text-foreground">{evo.created_by_name || "Médico"}</strong>
                      </span>
                      {isAdmission && (
                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-600 text-white gap-0.5 uppercase tracking-wider">
                          {group.dayLabel} — Admissão Hospitalar
                        </Badge>
                      )}
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", config.color)}>
                        <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                        {config.label}
                      </Badge>
                      {(() => {
                        const k = getComplementaryKind(evo);
                        if (!k) return null;
                        const m = COMPLEMENTARY_BADGE[k];
                        return (
                          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 gap-0.5", m.badgeClass)}>
                            <Zap className="h-2.5 w-2.5" />
                            {m.label}
                          </Badge>
                        );
                      })()}
                      {hasUnsaved && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
                          Não salvo
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {buildSummary(evo)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6"
                    onClick={e => { e.stopPropagation(); onDuplicate(evo); }}
                    title="Duplicar como base para nova evolução"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  {evo.status === "validated" && (
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6"
                      onClick={async e => {
                        e.stopPropagation();
                        // Resolve identidade canônica (registry + guarda anti-NI)
                        // antes de imprimir, em vez de confiar no snapshot gravado
                        // em evo.patient_name (que pode ser de outro paciente
                        // após realocações ou reuso de leito de NI).
                        try {
                          const resolved = await resolvePatientHeader(
                            patientId || null,
                            evo.patient_name || null,
                            currentHospital?.id || null,
                          );
                          // Leito/setor ATUAIS do paciente (após realocações),
                          // não o snapshot gravado em evo.patient_bed.
                          let currentBed = evo.patient_bed || undefined;
                          let currentSector = evo.patient_sector || undefined;
                          if (patientId) {
                            const { supabase } = await import("@/integrations/supabase/client");
                            const { data: pRow } = await supabase
                              .from("patients")
                              .select("bed_number, sector")
                              .eq("id", patientId)
                              .maybeSingle();
                            if (pRow?.bed_number) currentBed = pRow.bed_number;
                            if (pRow?.sector) currentSector = pRow.sector;
                          }
                          await printEvolution(evo, {
                            patientName: resolved.name || evo.patient_name,
                            patientBed: currentBed,
                            patientSector: currentSector,
                            patientRecord: resolved.prontuario || patientRecord || undefined,
                            patientAtendimento: resolved.atendimento || undefined,
                            patientSocialName: resolved.socialName || undefined,
                            patientCpf: resolved.cpf || undefined,
                            patientCns: resolved.cns || undefined,
                            cidPrimary,
                            cidSecondary,
                          });
                        } catch (err) {
                          console.error("Falha ao resolver identidade para impressão:", err);
                          toast.error("Não foi possível resolver os dados do paciente para impressão");
                        }
                      }}
                      title="Imprimir (timbrado Norma Zero)"
                    >
                      <Printer className="h-3 w-3" />
                    </Button>
                  )}
                  {isEditable && (
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                      onClick={e => { e.stopPropagation(); setDeleteDialogId(evo.id); }}
                      title="Excluir rascunho"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                  {evo.status === "validated" && isAuthor && !isAdmission && (
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                      onClick={e => { e.stopPropagation(); setSuspendDialogId(evo.id); }}
                      title="Suspender evolução"
                    >
                      <ShieldOff className="h-3 w-3" />
                    </Button>
                  )}
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-border/50">
                  {evo.status === "suspended" && evo.suspension_reason && (
                    <div className="flex items-center gap-2 bg-red-500/5 rounded-lg p-2 mt-2 mb-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-xs text-red-600">Motivo da suspensão: {evo.suspension_reason}</span>
                    </div>
                  )}
                  <div className="mt-2">
                    {isIntercurrence(evo) ? (() => {
                      const k = getComplementaryKind(evo)!;
                      const m = COMPLEMENTARY_BADGE[k];
                      return (
                      <div className={cn("space-y-2 rounded-lg border p-3", m.borderClass, m.bgClass)}>
                        <div className="flex items-center gap-2">
                          <Zap className={cn("h-3.5 w-3.5", m.iconColor)} />
                          <span className="text-xs font-semibold text-foreground">Descritivo — {m.label}</span>
                        </div>
                        <RichTextEditor
                          value={data.soap.subjective || ""}
                          onChange={(html) => updateLocal(evo.id, "soap", "subjective", html)}
                          placeholder={`Descreva a evolução (${m.label.toLowerCase()})...`}
                          minHeight={120}
                          disabled={!isEditable}
                        />
                        {isEditable && (
                          <div className="flex items-center justify-end gap-2">
                            {hasUnsaved && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5"
                                onClick={() => handleSave(evo.id)}
                                disabled={savingId === evo.id}
                              >
                                {savingId === evo.id ? (
                                  <><Loader2 className="h-3 w-3 animate-spin" /> Salvando...</>
                                ) : "Salvar rascunho"}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => setValidateDialogId(evo.id)}
                              disabled={savingId === evo.id}
                            >
                              <ShieldCheck className="h-3 w-3" /> Validar e Assinar
                            </Button>
                          </div>
                        )}
                      </div>
                      ); })() : (
                      <EvolutionForm
                        soap={data.soap}
                        vitals={data.vitals}
                        physicalExam={data.exam}
                        onSOAPChange={(k, v) => updateLocal(evo.id, "soap", k, v)}
                        onVitalsChange={(k, v) => updateLocal(evo.id, "vitals", k, v)}
                        onPhysicalExamChange={(k, v) => updateLocal(evo.id, "exam", k, v)}
                        onSave={() => handleSave(evo.id)}
                        onValidate={isEditable ? () => setValidateDialogId(evo.id) : undefined}
                        saving={savingId === evo.id}
                        readOnly={!isEditable}
                        isValidated={evo.status === "validated"}
                        autoSave={isEditable}
                        hasUnsaved={hasUnsaved}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
            </div>
          );
        })}
      </div>

      {/* Validate dialog — exige senha do médico */}
      <PasswordConfirmDialog
        open={!!validateDialogId}
        onOpenChange={(o) => { if (!o) setValidateDialogId(null); }}
        title="Validar e Assinar Evolução"
        description="Confirme com sua senha. Após a validação, esta evolução não poderá ser excluída."
        actionLabel="Validar e Assinar"
        onConfirmed={handleValidate}
      />

      {/* Suspend dialog */}
      <AlertDialog open={!!suspendDialogId} onOpenChange={() => { setSuspendDialogId(null); setSuspendReason(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspender Evolução</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da suspensão. A evolução ficará marcada como suspensa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={suspendReason}
            onChange={e => setSuspendReason(e.target.value)}
            placeholder="Motivo da suspensão..."
            className="min-h-[80px] text-sm"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspend}
              disabled={!suspendReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              Suspender
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteDialogId} onOpenChange={() => setDeleteDialogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Rascunho</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este rascunho? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
