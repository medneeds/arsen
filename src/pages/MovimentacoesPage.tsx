import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, ArrowRight, ArrowLeftRight, FileText, History, Loader2, BedDouble, Clock } from "lucide-react";
import { ClinicalHeader } from "@/components/ClinicalHeader";
import { PatientInfoHeader } from "@/components/PatientInfoHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useHospital } from "@/contexts/HospitalContext";
import { supabase } from "@/integrations/supabase/client";
import {
  MOVEMENT_CATEGORIES,
  MOVEMENT_SUBTYPES,
  INTERNAL_TRANSFER_DESTINATIONS,
  EXTERNAL_TRANSFER_DESTINATIONS,
  INTERNMENT_DESTINATIONS,
  getSubtypeDef,
  getSubtypesByCategory,
  type MovementCategory,
  type MovementSubtype,
  type SubtypeDef,
} from "@/data/movementFlow";

const TONE_CLASSES = {
  primary:    { icon: "text-primary",    bg: "bg-primary/10",    border: "border-primary/30",    hoverBorder: "hover:border-primary/60",    badge: "bg-primary/15 text-primary" },
  accent:     { icon: "text-accent",     bg: "bg-accent/10",     border: "border-accent/30",     hoverBorder: "hover:border-accent/60",     badge: "bg-accent/15 text-accent" },
  destructive:{ icon: "text-destructive",bg: "bg-destructive/10",border: "border-destructive/30",hoverBorder: "hover:border-destructive/60",badge: "bg-destructive/15 text-destructive" },
} as const;

interface MovementRow {
  id: string;
  movement_type: string;
  destination: string | null;
  notes: string | null;
  responsible_doctor: string | null;
  created_at: string;
  release_status?: string | null;
  released_at?: string | null;
  released_by_name?: string | null;
}

const MovimentacoesPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentHospital, currentState } = useHospital();

  const patientId = searchParams.get("patientId") || "";
  const patientName = searchParams.get("patientName") || "";
  const patientBed = searchParams.get("patientBed") || "";
  const patientSectorRaw = searchParams.get("patientSector") || "";
  const sectorMap: Record<string, string> = { red: "UTI 1", yellow: "UTI 2", blue: "UCI 1", outside: "UCI 2" };
  const patientSector = sectorMap[patientSectorRaw] || patientSectorRaw;

  const hasPatient = !!patientName;

  // Wizard state
  const [step, setStep] = useState<"category" | "subtype" | "form">("category");
  const [category, setCategory] = useState<MovementCategory | null>(null);
  const [subtype, setSubtype] = useState<MovementSubtype | null>(null);
  const [destination, setDestination] = useState("");
  const [customDestination, setCustomDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [responsibleDoctor, setResponsibleDoctor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // History
  const [history, setHistory] = useState<MovementRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const subtypeDef: SubtypeDef | null = useMemo(
    () => MOVEMENT_SUBTYPES.find((s) => s.id === subtype) ?? null,
    [subtype],
  );

  const destinationOptions = useMemo(() => {
    if (!subtypeDef?.needsDestination) return [];
    if (subtypeDef.id === "TRANSFERENCIA_INTERNA") return INTERNAL_TRANSFER_DESTINATIONS;
    if (subtypeDef.id === "TRANSFERENCIA_EXTERNA") return EXTERNAL_TRANSFER_DESTINATIONS;
    if (subtypeDef.id === "INTERNACAO") return INTERNMENT_DESTINATIONS;
    return [];
  }, [subtypeDef]);

  const loadHistory = async () => {
    if (!patientName) return;
    setLoadingHistory(true);
    try {
      const query = supabase
        .from("patient_movements")
        .select("id, movement_type, destination, notes, responsible_doctor, created_at, release_status, released_at, released_by_name")
        .order("created_at", { ascending: false })
        .limit(20);
      // Prefer patient_id if available, fallback to name
      const { data, error } = patientId
        ? await query.eq("patient_id", patientId)
        : await query.eq("patient_name", patientName);
      if (error) throw error;
      setHistory((data as MovementRow[]) || []);
    } catch (e) {
      console.error("Erro carregando histórico:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => { loadHistory(); /* eslint-disable-next-line */ }, [patientId, patientName]);

  const resetWizard = () => {
    setStep("category");
    setCategory(null);
    setSubtype(null);
    setDestination("");
    setCustomDestination("");
    setNotes("");
    setResponsibleDoctor("");
  };

  const handleSubmit = async () => {
    if (!subtypeDef) return;
    if (subtypeDef.needsDestination && !destination && !customDestination) {
      toast({ title: "Campo obrigatório", description: "Selecione ou especifique o destino.", variant: "destructive" });
      return;
    }
    if (!currentHospital || !currentState) {
      toast({ title: "Contexto ausente", description: "Selecione hospital/estado.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const finalDestination = destination === "OUTRO" ? customDestination : destination;
      const { error } = await supabase.from("patient_movements").insert({
        patient_id: patientId || null,
        patient_name: patientName,
        patient_bed: patientBed,
        patient_sector: patientSector,
        movement_type: subtypeDef.id,
        destination: finalDestination || null,
        notes: notes || null,
        responsible_doctor: responsibleDoctor || null,
        created_by: user?.id,
        department: "URGÊNCIA E EMERGÊNCIA ADULTO",
        state_id: currentState.id,
        hospital_unit_id: currentHospital.id,
      });
      if (error) throw error;

      toast({
        title: `${subtypeDef.label} registrado(a)`,
        description: subtypeDef.linksToDischargeSummary
          ? "Você pode complementar com o Sumário de Alta."
          : "Movimentação registrada no histórico.",
      });

      if (subtypeDef.linksToDischargeSummary) {
        const goSummary = window.confirm("Deseja complementar agora com o Sumário de Alta detalhado?");
        if (goSummary) {
          navigate(`/alta-desfecho?patient=${encodeURIComponent(patientName)}&bed=${encodeURIComponent(patientBed)}`);
          return;
        }
      }
      resetWizard();
      loadHistory();
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Não foi possível registrar a movimentação.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasPatient) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ArrowLeftRight className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Movimentações do Paciente</h1>
            <p className="text-sm text-muted-foreground">Selecione um paciente pelo mapa ou painel clínico</p>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
          <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-lg font-medium text-muted-foreground">Nenhum paciente selecionado</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ClinicalHeader moduleLabel="Movimentações" />

      <div className="p-4 space-y-4 max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Movimentações do Paciente</h1>
              <p className="text-xs text-muted-foreground">Sinalize transferências e saídas — a liberação efetiva do leito é feita pelo setor administrativo</p>
            </div>
          </div>
          {step !== "category" && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={resetWizard}>
              <ArrowLeft className="h-3.5 w-3.5" /> Reiniciar
            </Button>
          )}
        </div>

        {/* Patient Identification */}
        <PatientInfoHeader
          name={patientName}
          bed={patientBed}
          unit={patientSector}
          age=""
          sex=""
          weight=""
          allergies=""
          record=""
          admissionDate=""
        />

        {/* Wizard Card */}
        <div className="rounded-xl border-2 border-primary/20 bg-card p-4 space-y-4">
          {/* Stepper */}
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className={cn("font-semibold", step === "category" && "text-primary")}>1. Tipo</span>
            <ArrowRight className="h-3 w-3" />
            <span className={cn("font-semibold", step === "subtype" && "text-primary")}>2. Subtipo</span>
            <ArrowRight className="h-3 w-3" />
            <span className={cn("font-semibold", step === "form" && "text-primary")}>3. Confirmar</span>
          </div>

          {/* Step 1: Category */}
          {step === "category" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {MOVEMENT_CATEGORIES.map((cat) => {
                const t = TONE_CLASSES[cat.tone];
                const Icon = cat.icon;
                const count = getSubtypesByCategory(cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setCategory(cat.id); setStep("subtype"); }}
                    className={cn(
                      "group flex flex-col items-start gap-2 p-4 rounded-xl border bg-card text-left transition-all",
                      t.border, t.hoverBorder, "hover:shadow-md hover:-translate-y-0.5"
                    )}
                  >
                    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", t.bg)}>
                      <Icon className={cn("h-5 w-5", t.icon)} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm uppercase tracking-wide">{cat.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{count} opções</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Subtype */}
          {step === "subtype" && category && (() => {
            const cat = MOVEMENT_CATEGORIES.find((c) => c.id === category)!;
            const t = TONE_CLASSES[cat.tone];
            return (
              <div className="space-y-2">
                <button
                  onClick={() => setStep("category")}
                  className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3 w-3" /> Voltar
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {getSubtypesByCategory(category).map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.id}
                        onClick={() => { setSubtype(s.id); setStep("form"); }}
                        className={cn(
                          "group flex items-center gap-3 p-3 rounded-lg border bg-card text-left transition-all",
                          t.border, t.hoverBorder, "hover:shadow-sm"
                        )}
                      >
                        <div className={cn("h-9 w-9 rounded-md flex items-center justify-center", t.bg)}>
                          <Icon className={cn("h-4 w-4", t.icon)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{s.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                        </div>
                        {s.linksToDischargeSummary && (
                          <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">+ Sumário</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Step 3: Form */}
          {step === "form" && subtypeDef && (() => {
            const cat = MOVEMENT_CATEGORIES.find((c) => c.id === subtypeDef.category)!;
            const t = TONE_CLASSES[cat.tone];
            const Icon = subtypeDef.icon;
            return (
              <div className="space-y-3">
                <div className={cn("flex items-center gap-3 p-3 rounded-lg border", t.bg, t.border)}>
                  <Icon className={cn("h-5 w-5", t.icon)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{cat.label}</p>
                    <p className="font-semibold text-sm">{subtypeDef.label}</p>
                  </div>
                  <button
                    onClick={() => setStep("subtype")}
                    className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    Alterar
                  </button>
                </div>

                {subtypeDef.needsDestination && (
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider">Destino *</Label>
                    <Select value={destination} onValueChange={setDestination}>
                      <SelectTrigger><SelectValue placeholder="Selecione o destino" /></SelectTrigger>
                      <SelectContent>
                        {destinationOptions.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                        <SelectItem value="OUTRO">OUTRO (especificar)</SelectItem>
                      </SelectContent>
                    </Select>
                    {destination === "OUTRO" && (
                      <Input
                        placeholder="Especifique o destino"
                        value={customDestination}
                        onChange={(e) => setCustomDestination(e.target.value.toUpperCase())}
                        className="mt-2 uppercase"
                      />
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider">Médico Responsável</Label>
                    <Input
                      placeholder="Nome do médico (opcional)"
                      value={responsibleDoctor}
                      onChange={(e) => setResponsibleDoctor(e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider">Observações</Label>
                    <Input
                      placeholder="Resumo (opcional)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                  </div>
                </div>

                {subtypeDef.linksToDischargeSummary && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/60">
                    <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Após confirmar, você poderá complementar este registro com o{" "}
                      <span className="font-medium text-foreground">Sumário de Alta</span> detalhado.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={resetWizard} disabled={submitting}>Cancelar</Button>
                  <Button size="sm" onClick={handleSubmit} disabled={submitting} className="gap-1.5">
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {submitting ? "Registrando..." : "Confirmar Movimentação"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* History */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Histórico recente</h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">({history.length})</span>
          </div>
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">Nenhuma movimentação registrada para este paciente.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((m) => {
                const def = getSubtypeDef(m.movement_type);
                const cat = def ? MOVEMENT_CATEGORIES.find((c) => c.id === def.category)! : null;
                const tone = cat ? TONE_CLASSES[cat.tone] : TONE_CLASSES.primary;
                const Icon = def?.icon ?? ArrowLeftRight;
                return (
                  <li key={m.id} className="py-2.5 flex items-start gap-3">
                    <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0", tone.bg)}>
                      <Icon className={cn("h-4 w-4", tone.icon)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{def?.label ?? m.movement_type}</p>
                        {cat && (
                          <Badge variant="outline" className={cn("text-[9px] uppercase tracking-wider", tone.badge, "border-transparent")}>
                            {cat.label}
                          </Badge>
                        )}
                        {m.destination && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">→ {m.destination}</span>
                        )}
                      </div>
                      {m.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.notes}</p>}
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {format(new Date(m.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {m.responsible_doctor ? ` • ${m.responsible_doctor}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default MovimentacoesPage;
