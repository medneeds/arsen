import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { ClipboardCheck, Search, Save, Printer, ChevronDown, ChevronRight, User, Calendar, BedDouble, Stethoscope, Target, MessageSquare, CheckCircle2, RefreshCw } from "lucide-react";
import PrintableRound from "@/components/PrintableRound";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatAge } from "@/lib/patientAge";
import { useHospital } from "@/contexts/HospitalContext";
import { useAuth } from "@/contexts/AuthContext";
import { ROUND_SECTIONS, STATUS_OPTIONS, type RoundStatus } from "@/data/roundChecklistSchema";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

interface PatientOption {
  id: string;
  name: string;
  sector: string;
  bed_number: string;
  age: string | null;
  diagnoses: string | null;
}

interface ResponseState {
  [key: string]: {
    status: RoundStatus | null;
    observation: string;
  };
}

interface GoalState {
  [sectionCode: string]: string;
}

const SECTION_ICONS: Record<string, typeof Stethoscope> = {
  medico_ccih_farm: Stethoscope,
  fisio_to: User,
  enfermagem: User,
  nutricao: User,
  fono: User,
  odonto: User,
  servico_social: User,
  psico: User,
  medico_alta: CheckCircle2,
};

const SECTION_COLORS: Record<string, string> = {
  medico_ccih_farm: "from-muted/20 to-muted/5 border-border/30",
  fisio_to: "from-released-soft/20 to-released-soft/5 border-released/30",
  enfermagem: "from-muted/20 to-muted/5 border-border/30",
  nutricao: "from-warning-soft/20 to-warning-soft/5 border-warning/30",
  fono: "from-muted/20 to-muted/5 border-border/30",
  odonto: "from-muted/20 to-muted/5 border-border/30",
  servico_social: "from-muted/20 to-muted/5 border-border/30",
  psico: "from-critical-soft/20 to-critical-soft/5 border-critical/30",
  medico_alta: "from-released-soft/20 to-released-soft/5 border-released/30",
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  S: "bg-released/20 text-released-on-soft border-released/30",
  N: "bg-critical/20 text-critical-on-soft border-critical/30",
  CI: "bg-warning/20 text-warning-on-soft border-warning/30",
  NA: "bg-muted text-muted-foreground border-border",
  O: "bg-primary/20 text-foreground border-border/30",
  D: "bg-primary/20 text-foreground border-border/30",
};

import { getSectorDisplayLabel } from "@/utils/bedNaming";
import { SectionLoader } from "@/components/SectionLoader";
// MIGRAÇÃO: resolveActiveEncounterId removido — a internação (internacoes.id) já é o
// "encounter"; sessoes_visita.internacao_id recebe selectedPatient.id diretamente.
const getSectorLabel = (sector: string): string => getSectorDisplayLabel(sector) || sector;

export default function RoundPage() {
  const { currentHospital, currentState } = useHospital();
  const { user } = useAuth();

  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualPatient, setManualPatient] = useState({ name: "", sector: "", bed_number: "", age: "", diagnoses: "" });
  const [roundDate, setRoundDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [responses, setResponses] = useState<ResponseState>({});
  const [goals, setGoals] = useState<GoalState>({});
  const [observations, setObservations] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ROUND_SECTIONS.map((s) => [s.code, true]))
  );
  const [saving, setSaving] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [syncingPatientId, setSyncingPatientId] = useState<string | null>(null);

  // MIGRAÇÃO: patients→internacoes(+pacientes/leitos/setores). O schema novo não
  // tem colunas hospital_unit_id/state_id/department/is_vacant/age → os filtros de
  // hospital/estado/UTI e leito-vago foram removidos (degradado); a "internação
  // ativa" é aproximada por data_alta IS NULL. Idade vem de pacientes.data_nascimento.
  const INTERNACAO_OPTION_SELECT = `id, hipotese_diagnostica,
      paciente:pacientes(nome_completo, nome_social, data_nascimento),
      leito:leitos(numero),
      setor:setores(nome, tipo)`;

  const rowToOption = (r: any): PatientOption => {
    const pac = r.paciente || {};
    return {
      id: r.id,
      name: pac.nome_social || pac.nome_completo || "",
      // MIGRAÇÃO: `sector` usa setores.tipo (código de setor esperado por getSectorLabel).
      sector: r.setor?.tipo || "",
      bed_number: r.leito?.numero || "",
      age: formatAge(pac.data_nascimento) || null,
      diagnoses: r.hipotese_diagnostica || null,
    };
  };

  const fetchPatients = useCallback(async () => {
    if (!currentHospital || !currentState) return;
    const { data } = await supabase
      .from("internacoes")
      .select(INTERNACAO_OPTION_SELECT)
      .is("data_alta", null);
    if (data) {
      setPatients(data.map(rowToOption).filter((p) => p.name && p.name.trim()));
    }
  }, [currentHospital, currentState]);

  const handleSyncPatient = useCallback(async (e: React.MouseEvent, patientId: string) => {
    e.stopPropagation();
    if (!currentHospital) return;
    setSyncingPatientId(patientId);
    try {
      const { data: fresh, error } = await supabase
        .from("internacoes")
        .select(INTERNACAO_OPTION_SELECT)
        .eq("id", patientId)
        .maybeSingle();
      if (error) throw error;
      if (fresh) {
        const freshOption = rowToOption(fresh);
        setPatients((prev) => prev.map((p) => (p.id === freshOption.id ? freshOption : p)));
        if (selectedPatient?.id === freshOption.id) setSelectedPatient(freshOption);
      }
      toast.success("Dados do paciente sincronizados");
    } catch (err: any) {
      toast.error("Não foi possível sincronizar");
    } finally {
      setSyncingPatientId(null);
    }
  }, [currentHospital, selectedPatient?.id]);

  // Fetch UTI patients
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Load existing session when patient/date changes
  useEffect(() => {
    if (!selectedPatient || !currentHospital || selectedPatient.id.startsWith("manual_")) return;
    const loadSession = async () => {
      setLoadingSession(true);
      // MIGRAÇÃO: round_sessions→sessoes_visita (patient_id→internacao_id,
      // round_date→data_visita, hospital_unit_id→hospital_id, observations→observacoes).
      const { data: session } = await supabase
        .from("sessoes_visita")
        .select("*")
        .eq("internacao_id", selectedPatient.id)
        .eq("data_visita", roundDate)
        .eq("hospital_id", currentHospital.id)
        .maybeSingle();

      if (session) {
        setSessionId(session.id);
        setObservations(session.observacoes || "");

        // Load responses (round_responses→respostas_visita)
        const { data: respData } = await supabase
          .from("respostas_visita")
          .select("*")
          .eq("sessao_id", session.id);

        const newResponses: ResponseState = {};
        respData?.forEach((r: any) => {
          newResponses[`${r.codigo_secao}_${r.item_id}`] = {
            status: r.status,
            observation: r.observacao || "",
          };
        });
        setResponses(newResponses);

        // Load goals (round_section_goals→metas_secao_visita)
        const { data: goalData } = await supabase
          .from("metas_secao_visita")
          .select("*")
          .eq("sessao_id", session.id);

        const newGoals: GoalState = {};
        goalData?.forEach((g: any) => {
          newGoals[g.codigo_secao] = g.meta || "";
        });
        setGoals(newGoals);
      } else {
        setSessionId(null);
        setResponses({});
        setGoals({});
        setObservations("");
      }
      setLoadingSession(false);
    };
    loadSession();
  }, [selectedPatient, roundDate, currentHospital]);

  const setItemStatus = useCallback((sectionCode: string, itemId: number, status: RoundStatus) => {
    const key = `${sectionCode}_${itemId}`;
    setResponses((prev) => ({
      ...prev,
      [key]: { ...prev[key], status: prev[key]?.status === status ? null : status, observation: prev[key]?.observation || "" },
    }));
  }, []);

  const setItemObservation = useCallback((sectionCode: string, itemId: number, obs: string) => {
    const key = `${sectionCode}_${itemId}`;
    setResponses((prev) => ({
      ...prev,
      [key]: { ...prev[key], status: prev[key]?.status || null, observation: obs },
    }));
  }, []);

  const toggleSection = (code: string) => {
    setOpenSections((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const filteredPatients = useMemo(() => {
    if (!patientSearch) return patients;
    const q = patientSearch.toLowerCase();
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.bed_number.toLowerCase().includes(q) ||
        getSectorLabel(p.sector).toLowerCase().includes(q)
    );
  }, [patients, patientSearch]);

  const totalItems = ROUND_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
  const filledItems = Object.values(responses).filter((r) => r.status).length;
  const progress = totalItems > 0 ? Math.round((filledItems / totalItems) * 100) : 0;

  const handleSave = async () => {
    if (!selectedPatient || !currentHospital || !currentState || !user) {
      toast.error("Selecione um paciente para salvar o round.");
      return;
    }

    setSaving(true);
    try {
      // MIGRAÇÃO: profissionais.id ≠ auth.uid — resolve o profissional via user_id.
      const { data: profRow } = await supabase
        .from("profissionais").select("id").eq("user_id", user.id).maybeSingle();
      const profissionalId = (profRow as any)?.id ?? null;

      let currentSessionId = sessionId;

      if (!currentSessionId) {
        const isManual = selectedPatient.id.startsWith("manual_");
        // MIGRAÇÃO: round_sessions→sessoes_visita. Colunas denormalizadas do paciente
        // (patient_name/age/sector/bed), encounter_id, state_id e department NÃO existem
        // no schema novo → removidas (degradado). internacao_id = a própria internação
        // (o "encounter" agora é a internação); paciente avulso fica sem internacao_id.
        const { data: newSession, error } = await supabase
          .from("sessoes_visita")
          .insert({
            internacao_id: isManual ? null : selectedPatient.id,
            data_visita: roundDate,
            hospital_id: currentHospital.id,
            observacoes: observations,
            criado_por: profissionalId,
          } as any)
          .select("id")
          .single();

        if (error) throw error;
        currentSessionId = newSession.id;
        setSessionId(currentSessionId);
      } else {
        const { error: erroGrav1 } = await supabase
          .from("sessoes_visita")
          .update({ observacoes: observations, atualizado_em: new Date().toISOString() } as any)
          .eq("id", currentSessionId);
        if (erroGrav1) throw erroGrav1;
      }

      // Delete existing responses and re-insert (round_responses→respostas_visita)
      const { error: erroGrav2 } = await supabase.from("respostas_visita").delete().eq("sessao_id", currentSessionId);
      if (erroGrav2) throw erroGrav2;

      const responseRows = Object.entries(responses)
        .filter(([, v]) => v.status || v.observation)
        .map(([key, v]) => {
          const [sectionCode, itemIdStr] = [key.substring(0, key.lastIndexOf("_")), key.substring(key.lastIndexOf("_") + 1)];
          return {
            sessao_id: currentSessionId,
            codigo_secao: sectionCode,
            item_id: parseInt(itemIdStr),
            status: v.status,
            observacao: v.observation || null,
            profissional_id: profissionalId,
          };
        });

      if (responseRows.length > 0) {
        const { error: respError } = await supabase.from("respostas_visita").insert(responseRows as any);
        if (respError) throw respError;
      }

      // Upsert goals (round_section_goals→metas_secao_visita)
      const { error: erroGrav3 } = await supabase.from("metas_secao_visita").delete().eq("sessao_id", currentSessionId);
      if (erroGrav3) throw erroGrav3;
      const goalRows = Object.entries(goals)
        .filter(([, v]) => v.trim())
        .map(([sectionCode, goal]) => ({
          sessao_id: currentSessionId,
          codigo_secao: sectionCode,
          meta: goal,
        }));

      if (goalRows.length > 0) {
        const { error: goalError } = await supabase.from("metas_secao_visita").insert(goalRows as any);
        if (goalError) throw goalError;
      }

      toast.success("Round salvo com sucesso");
    } catch (err: any) {
      console.error(err);
      toast.error("Não foi possível salvar round");
    } finally {
      setSaving(false);
    }
  };

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrintPDF = () => {
    if (!selectedPatient || !printRef.current) return;
    printRef.current.style.display = "block";
    window.print();
    setTimeout(() => {
      if (printRef.current) printRef.current.style.display = "none";
    }, 500);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-primary/20 border border-primary/20">
            <ClipboardCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Round Diário Multiprofissional</h1>
            <p className="text-xs text-muted-foreground">Checklist estruturado por equipe • UTI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={roundDate}
            onChange={(e) => setRoundDate(e.target.value)}
            className="w-40 text-xs"
          />
          {selectedPatient && (
            <>
              <Button size="sm" variant="outline" onClick={handlePrintPDF} className="text-xs gap-2">
                <Printer className="h-3.5 w-3.5" />
                PDF
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs gap-2">
                <Save className="h-3.5 w-3.5" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <Badge key={s.code} variant="outline" className={`text-xs px-2 py-1 ${STATUS_BADGE_COLORS[s.code]}`}>
            {s.code} = {s.label}
          </Badge>
        ))}
      </div>

      {/* Patient selector */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Paciente
            </CardTitle>
            {!selectedPatient && !manualMode && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setManualMode(false)} className={`text-xs h-7 ${!manualMode ? "bg-primary/10 border-primary/30" : ""}`}>
                  Buscar paciente
                </Button>
                <Button size="sm" variant="outline" onClick={() => setManualMode(true)} className="text-xs h-7">
                  Preenchimento avulso
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {manualMode && !selectedPatient ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome do paciente *</Label>
                  <Input placeholder="Nome completo" value={manualPatient.name} onChange={(e) => setManualPatient((p) => ({ ...p, name: e.target.value }))} className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Idade</Label>
                  <Input placeholder="Ex: 65 anos" value={manualPatient.age} onChange={(e) => setManualPatient((p) => ({ ...p, age: e.target.value }))} className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Setor</Label>
                  <Select value={manualPatient.sector} onValueChange={(v) => setManualPatient((p) => ({ ...p, sector: v }))}>
                    <SelectTrigger className="text-sm mt-1"><SelectValue placeholder="Selecionar setor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTI 1">UTI 1</SelectItem>
                      <SelectItem value="UTI 2">UTI 2</SelectItem>
                      <SelectItem value="UCI 1">UCI 1</SelectItem>
                      <SelectItem value="UCI 2">UCI 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Leito</Label>
                  <Input placeholder="Ex: 01" value={manualPatient.bed_number} onChange={(e) => setManualPatient((p) => ({ ...p, bed_number: e.target.value }))} className="text-sm mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Diagnósticos</Label>
                <Textarea placeholder="Diagnósticos principais..." value={manualPatient.diagnoses} onChange={(e) => setManualPatient((p) => ({ ...p, diagnoses: e.target.value }))} className="text-xs mt-1 min-h-[40px]" rows={1} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => { setManualMode(false); setManualPatient({ name: "", sector: "", bed_number: "", age: "", diagnoses: "" }); }} className="text-xs">
                  Voltar
                </Button>
                <Button size="sm" disabled={!manualPatient.name.trim()} onClick={() => {
                  setSelectedPatient({
                    id: `manual_${Date.now()}`,
                    name: manualPatient.name,
                    sector: manualPatient.sector || "manual",
                    bed_number: manualPatient.bed_number || "-",
                    age: manualPatient.age || null,
                    diagnoses: manualPatient.diagnoses || null,
                  });
                }} className="text-xs">
                  Iniciar Round
                </Button>
              </div>
            </div>
          ) : !selectedPatient ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, leito ou setor..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {filteredPatients.map((p) => (
                  <div
                    key={p.id}
                    className="relative group"
                  >
                    <button
                      onClick={() => setSelectedPatient(p)}
                      className="w-full text-left p-3 pr-8 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-sm"
                    >
                      <div className="patient-id font-medium text-foreground group-hover:text-primary transition-colors truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {getSectorLabel(p.sector)} • Leito {p.bed_number} {p.age ? `• ${p.age}` : ""}
                      </div>
                    </button>
                    <button
                      onClick={(e) => handleSyncPatient(e, p.id)}
                      disabled={syncingPatientId === p.id}
                      title="Sincronizar dados deste paciente"
                      className="absolute top-2 right-2 p-2 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncingPatientId === p.id ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                ))}
                {filteredPatients.length === 0 && (
                  <div className="col-span-full text-center text-sm text-muted-foreground py-6">
                    Nenhum paciente UTI encontrado
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {selectedPatient.name}
                    {selectedPatient.id.startsWith("manual_") && (
                      <Badge variant="outline" className="ml-2 text-xs px-2 py-0 align-middle border-warning/30 text-warning-on-soft">Avulso</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" />{selectedPatient.id.startsWith("manual_") ? selectedPatient.sector : getSectorLabel(selectedPatient.sector)} – Leito {selectedPatient.bed_number}</span>
                    {selectedPatient.age && <span>• {selectedPatient.age}</span>}
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(roundDate), "dd/MM/yyyy")}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{progress}%</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { setSelectedPatient(null); setManualMode(false); setManualPatient({ name: "", sector: "", bed_number: "", age: "", diagnoses: "" }); setResponses({}); setGoals({}); setObservations(""); setSessionId(null); }} className="text-xs">
                  Trocar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checklist sections */}
      {selectedPatient && !loadingSession && (
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {ROUND_SECTIONS.map((section) => {
              const sectionFilled = section.items.filter((item) => responses[`${section.code}_${item.id}`]?.status).length;
              const isOpen = openSections[section.code];
              const SectionIcon = SECTION_ICONS[section.code] || Stethoscope;

              return (
                <Collapsible key={section.code} open={isOpen} onOpenChange={() => toggleSection(section.code)}>
                  <Card className={`border overflow-hidden transition-all ${isOpen ? "shadow-sm" : ""}`}>
                    <CollapsibleTrigger asChild>
                      <button className={`w-full flex items-center gap-3 px-4 py-3 text-left bg-gradient-to-r ${SECTION_COLORS[section.code]} hover:opacity-90 transition-all`}>
                        <SectionIcon className="h-4 w-4 text-foreground/70 flex-shrink-0" />
                        <span className="font-medium text-sm text-foreground flex-1">{section.title}</span>
                        <Badge variant="secondary" className="text-xs px-2 py-0 font-mono">
                          {sectionFilled}/{section.items.length}
                        </Badge>
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="divide-y divide-border">
                        {section.items.map((item) => {
                          const key = `${section.code}_${item.id}`;
                          const resp = responses[key];
                          return (
                            <div key={item.id} className="px-4 py-3 space-y-2">
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-mono text-muted-foreground mt-1 w-5 flex-shrink-0">{item.id}.</span>
                                <span className="text-sm text-foreground flex-1">{item.text}</span>
                              </div>
                              <div className="flex flex-wrap gap-2 ml-6">
                                {STATUS_OPTIONS.map((s) => (
                                  <button
                                    key={s.code}
                                    onClick={() => setItemStatus(section.code, item.id, s.code)}
                                    className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${
                                      resp?.status === s.code
                                        ? STATUS_BADGE_COLORS[s.code] + " ring-1 ring-offset-1 ring-offset-background ring-current scale-105"
                                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                                    }`}
                                  >
                                    {s.code}
                                  </button>
                                ))}
                              </div>
                              {/* Observation toggle */}
                              {(resp?.observation || resp?.status) && (
                                <div className="ml-6">
                                  <Textarea
                                    placeholder="Observação..."
                                    value={resp?.observation || ""}
                                    onChange={(e) => setItemObservation(section.code, item.id, e.target.value)}
                                    className="text-xs min-h-[36px] h-9 resize-none"
                                    rows={1}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Section goal */}
                      <div className="px-4 py-3 bg-muted/30 border-t border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-3.5 w-3.5 text-primary" />
                          <Label className="text-xs font-medium text-primary">Meta do dia</Label>
                        </div>
                        <Textarea
                          placeholder="Definir meta do dia para esta equipe..."
                          value={goals[section.code] || ""}
                          onChange={(e) => setGoals((prev) => ({ ...prev, [section.code]: e.target.value }))}
                          className="text-xs min-h-[40px] resize-none"
                          rows={1}
                        />
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}

            {/* General observations */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Observações Importantes
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <Textarea
                  placeholder="Registrar observações gerais do round..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="text-sm min-h-[60px]"
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* Footer actions */}
            <div className="flex justify-end gap-2 pb-4">
              <Button variant="outline" onClick={handlePrintPDF} className="text-xs gap-2">
                <Printer className="h-3.5 w-3.5" />
                Imprimir PDF
              </Button>
              <Button onClick={handleSave} disabled={saving} className="text-xs gap-2">
                <Save className="h-3.5 w-3.5" />
                {saving ? "Salvando..." : "Salvar Round"}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {selectedPatient && loadingSession && (
        <div className="mt-4">
          <SectionLoader message="Carregando round" subMessage="Buscando sessão do paciente" size="sm" />
        </div>
      )}

      {/* Printable layout */}
      {selectedPatient && (
        <PrintableRound
          ref={printRef}
          patientName={selectedPatient.name}
          patientSector={selectedPatient.id.startsWith("manual_") ? selectedPatient.sector : getSectorLabel(selectedPatient.sector)}
          patientBed={selectedPatient.bed_number}
          patientAge={selectedPatient.age}
          roundDate={roundDate}
          responses={responses}
          goals={goals}
          observations={observations}
        />
      )}
    </div>
  );
}
