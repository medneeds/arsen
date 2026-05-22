import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { PatientRegistrationDialog } from "./PatientRegistrationDialog";
import { RiskClassificationDialog } from "./RiskClassificationDialog";
import { AdmitPatientDialog } from "./AdmitPatientDialog";
import { 
  UserPlus, Shield, Trash2, Edit, ChevronDown, ChevronUp, 
  Clock, AlertTriangle, User, Calendar, BedDouble, Search, X, RotateCcw, History
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PatientSearchActionsDialog, type RegistryPatientLite } from "./PatientSearchActionsDialog";

interface PreAdmission {
  id: string;
  patient_name: string;
  birth_date: string | null;
  sex: string | null;
  medical_record: string | null;
  cpf: string | null;
  patient_registry_id: string | null;
  destination_sector: string | null;
  status: string;
  risk_classification: string | null;
  created_at: string;
  notes: string | null;
}

const RISK_COLORS: Record<string, string> = {
  vermelho: "bg-red-600 text-white",
  laranja: "bg-orange-500 text-white",
  amarelo: "bg-yellow-500 text-black",
  verde: "bg-green-600 text-white",
  azul: "bg-blue-600 text-white",
  branca: "bg-white text-slate-900 border border-slate-400",
};

const RISK_LABELS: Record<string, string> = {
  vermelho: "EMERGÊNCIA",
  laranja: "MUITO URGENTE",
  amarelo: "URGENTE",
  verde: "POUCO URGENTE",
  azul: "NÃO URGENTE",
  branca: "FICHA BRANCA",
};

interface PreAdmissionSectionProps {
  /**
   * Quando definido, filtra a lista para mostrar apenas pacientes
   * cujo destination_sector corresponde ao label do setor visualizado.
   * Quando undefined (ex.: visão UE), mostra todos.
   */
  sectorFilterLabel?: string;
}

export interface PreAdmissionSectionHandle {
  refresh: () => Promise<void>;
}

export const PreAdmissionSection = forwardRef<PreAdmissionSectionHandle, PreAdmissionSectionProps>(function PreAdmissionSection(
  { sectorFilterLabel }: PreAdmissionSectionProps,
  ref
) {
  const [preAdmissions, setPreAdmissions] = useState<PreAdmission[]>([]);
  const [cancelledList, setCancelledList] = useState<PreAdmission[]>([]);
  const [showCancelled, setShowCancelled] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<PreAdmission | null>(null);
  const [isReopening, setIsReopening] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [showRegistration, setShowRegistration] = useState(false);
  const [classifyTarget, setClassifyTarget] = useState<PreAdmission | null>(null);
  const [admitTarget, setAdmitTarget] = useState<PreAdmission | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PreAdmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [registryResults, setRegistryResults] = useState<RegistryPatientLite[]>([]);
  const [isSearchingRegistry, setIsSearchingRegistry] = useState(false);
  const [actionPatient, setActionPatient] = useState<RegistryPatientLite | null>(null);
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();


  const fetchPreAdmissions = async () => {
    if (!currentHospital?.id || !currentState?.id) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from("pre_admissions")
        .select("*")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .in("status", ["pre_admissao", "classificado", "aguardando_leito", "aguardando_leito_uti"])
        .order("created_at", { ascending: false });

      // Filtra por setor de destino (quando estamos visualizando um setor clínico específico)
      if (sectorFilterLabel) {
        query = query.eq("destination_sector", sectorFilterLabel);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPreAdmissions((data as PreAdmission[]) || []);
    } catch (err) {
      console.error("Fetch pre-admissions error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCancelled = async () => {
    if (!currentHospital?.id || !currentState?.id) return;
    try {
      let query = supabase
        .from("pre_admissions")
        .select("*")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .eq("status", "cancelado")
        .order("updated_at", { ascending: false })
        .limit(30);
      if (sectorFilterLabel) {
        // Mostra os cancelados deste setor OU aqueles sem destino (para resgate)
        query = query.or(`destination_sector.eq.${sectorFilterLabel},destination_sector.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      setCancelledList((data as PreAdmission[]) || []);
    } catch (err) {
      console.error("Fetch cancelled error:", err);
    }
  };

  const handleReopen = async () => {
    if (!reopenTarget) return;
    setIsReopening(true);
    try {
      const { error } = await supabase
        .from("pre_admissions")
        .update({
          status: "aguardando_leito",
          destination_bed: null,
          // mantém destination_sector original; usuário pode trocar no AdmitPatientDialog
        })
        .eq("id", reopenTarget.id);
      if (error) throw error;
      toast({
        title: "Pré-admissão reaberta",
        description: `${reopenTarget.patient_name} voltou para a fila de alocação.`,
      });
      setReopenTarget(null);
      fetchPreAdmissions();
      fetchCancelled();
    } catch (err: any) {
      toast({ title: "Erro ao reabrir", description: err.message, variant: "destructive" });
    } finally {
      setIsReopening(false);
    }
  };

  useEffect(() => {
    fetchPreAdmissions();
  }, [currentHospital?.id, currentState?.id, sectorFilterLabel]);

  useEffect(() => {
    if (showCancelled) fetchCancelled();
  }, [showCancelled, currentHospital?.id, currentState?.id, sectorFilterLabel]);

  // Expor refresh imperativo (ex.: para o botão "Atualizar mapa")
  useImperativeHandle(ref, () => ({ refresh: fetchPreAdmissions }), [currentHospital?.id, currentState?.id, sectorFilterLabel]);

  // Realtime: novo cadastro/alteração em pre_admissions já reflete na lista, sem refresh manual
  useEffect(() => {
    if (!currentHospital?.id || !currentState?.id) return;
    const channel = supabase
      .channel(`pre_admissions_${currentHospital.id}_${sectorFilterLabel || "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pre_admissions", filter: `hospital_unit_id=eq.${currentHospital.id}` },
        () => {
          fetchPreAdmissions();
          if (showCancelled) fetchCancelled();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentHospital?.id, currentState?.id, sectorFilterLabel, showCancelled]);


  // Busca no patient_registry com debounce — alimenta a seção "Pacientes do hospital"
  useEffect(() => {
    const q = searchTerm.trim();
    if (q.length < 2 || !currentHospital?.id) {
      setRegistryResults([]);
      setIsSearchingRegistry(false);
      return;
    }
    setIsSearchingRegistry(true);
    const handle = setTimeout(async () => {
      try {
        const qDigits = q.replace(/\D/g, "");
        const qNorm = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const ors: string[] = [`full_name_normalized.ilike.%${qNorm}%`];
        if (qDigits) {
          ors.push(`cpf.ilike.%${qDigits}%`);
          ors.push(`medical_record.ilike.%${qDigits}%`);
          ors.push(`cns.ilike.%${qDigits}%`);
        }
        const { data, error } = await supabase
          .from("patient_registry")
          .select("id, full_name, social_name, mother_name, birth_date, sex, cpf, cns, medical_record, phone")
          .eq("hospital_unit_id", currentHospital.id)
          .is("merged_into_registry_id", null)
          .or(ors.join(","))
          .order("full_name", { ascending: true })
          .limit(10);
        if (error) throw error;
        setRegistryResults((data as RegistryPatientLite[]) || []);
      } catch (err) {
        console.error("Registry search error:", err);
        setRegistryResults([]);
      } finally {
        setIsSearchingRegistry(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [searchTerm, currentHospital?.id]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from("pre_admissions")
        .update({ status: "cancelado" })
        .eq("id", deleteTarget.id);
      if (error) throw error;
      toast({ title: "Pré-admissão cancelada" });
      fetchPreAdmissions();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const calcAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    return Math.floor((Date.now() - new Date(birthDate + 'T12:00:00').getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const normalize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const onlyDigits = (v: string) => v.replace(/\D/g, "");
  const filteredPreAdmissions = (() => {
    const q = searchTerm.trim();
    if (!q) return preAdmissions;
    const qNorm = normalize(q);
    const qDigits = onlyDigits(q);
    return preAdmissions.filter(p => {
      if (normalize(p.patient_name || "").includes(qNorm)) return true;
      if (qDigits) {
        if (p.cpf && onlyDigits(p.cpf).includes(qDigits)) return true;
        if (p.medical_record && onlyDigits(p.medical_record).includes(qDigits)) return true;
      }
      if (p.medical_record && normalize(p.medical_record).includes(qNorm)) return true;
      return false;
    });
  })();

  const pendingCount = filteredPreAdmissions.filter(p => p.status === "pre_admissao").length;
  const classifiedCount = filteredPreAdmissions.filter(p => p.status === "classificado").length;
  // Classificação de risco (Manchester) é atribuição da enfermagem da Urgência e Emergência.
  // Em setores de internação (qualquer setor com filtro definido), o cadastro vai direto para alocação no leito.
  const requiresRiskClassification = !sectorFilterLabel;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Aguardando Pré-admissão (Alocação) em Leito
              <Badge variant="secondary" className="text-xs">
                {searchTerm ? `${filteredPreAdmissions.length}/${preAdmissions.length}` : preAdmissions.length}
              </Badge>
              {requiresRiskClassification && pendingCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {pendingCount} sem classificação
                </Badge>
              )}
            </h2>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, CPF ou prontuário"
                className="h-7 text-xs pl-7 pr-7 w-96 bg-background border-primary/30 focus-visible:ring-primary/40 shadow-sm"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              size="sm"
              variant={showCancelled ? "secondary" : "outline"}
              onClick={() => setShowCancelled(v => !v)}
              className="gap-1 text-xs h-7"
              title="Ver pré-admissões canceladas para reabrir"
            >
              <History className="h-3.5 w-3.5" />
              Canceladas
              {cancelledList.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{cancelledList.length}</Badge>
              )}
            </Button>
            <Button size="sm" onClick={() => setShowRegistration(true)} className="gap-1 text-xs h-7">
              <UserPlus className="h-3.5 w-3.5" />
              Cadastrar Paciente
            </Button>

          </div>
        </div>

        <CollapsibleContent>
          {filteredPreAdmissions.length === 0 && (!searchTerm || registryResults.length === 0) ? (
            <Card className="border-dashed">
              <CardContent className="p-4 text-center text-sm text-muted-foreground">
                {searchTerm
                  ? (isSearchingRegistry
                      ? `Buscando "${searchTerm}"...`
                      : `Nenhum paciente encontrado para "${searchTerm}".`)
                  : "Nenhum paciente aguardando pré-admissão."}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {filteredPreAdmissions.map(pa => {
                const age = calcAge(pa.birth_date);
                return (
                  <Card key={pa.id} className={cn(
                    "transition-all hover:shadow-md",
                    pa.risk_classification && "border-l-4 border-shimmer",
                    pa.risk_classification === "vermelho" && "border-l-red-600",
                    pa.risk_classification === "laranja" && "border-l-orange-500",
                    pa.risk_classification === "amarelo" && "border-l-yellow-500",
                    pa.risk_classification === "verde" && "border-l-green-600",
                    pa.risk_classification === "azul" && "border-l-blue-600",
                    pa.risk_classification === "branca" && "border-l-slate-400",
                  )}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate">{pa.patient_name}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                            {age !== null && <span>{age}a</span>}
                            {pa.sex && <span>• {pa.sex}</span>}
                            {pa.medical_record && <span>• Pront: {pa.medical_record}</span>}
                          </div>
                        </div>
                        {pa.risk_classification && (
                          <Badge className={cn("text-[9px] shrink-0 px-1.5 py-0.5", RISK_COLORS[pa.risk_classification])}>
                            {RISK_LABELS[pa.risk_classification]}
                          </Badge>
                        )}
                      </div>

                      {pa.destination_sector && (
                        <p className="text-[10px] text-muted-foreground">
                          Pedido: {pa.destination_sector}
                        </p>
                      )}

                      <div className="flex gap-1 pt-1 border-t">
                        {requiresRiskClassification && !pa.risk_classification && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-6 text-[10px] gap-1 text-orange-600 border-orange-300 hover:bg-orange-50"
                            onClick={() => setClassifyTarget(pa)}
                          >
                            <Shield className="h-3 w-3" />
                            Classificar Risco
                          </Button>
                        )}
                        {(!requiresRiskClassification || pa.risk_classification) && (
                          <Button
                            size="sm"
                            className="flex-1 h-6 text-[10px] gap-1"
                            onClick={() => setAdmitTarget(pa)}
                          >
                            <BedDouble className="h-3 w-3" />
                            Pré-admitir em Leito
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive"
                          onClick={() => setDeleteTarget(pa)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Resultados do registro de prontuários — só aparece quando há busca ativa */}
          {searchTerm.trim().length >= 2 && (() => {
            const fila = new Set(filteredPreAdmissions.map(p => p.patient_registry_id).filter(Boolean) as string[]);
            const extras = registryResults.filter(r => !fila.has(r.id));
            return (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <User className="h-3 w-3" />
                  Pacientes do hospital
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                    {isSearchingRegistry ? "..." : extras.length}
                  </Badge>
                </div>
                {extras.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="p-3 text-center text-xs text-muted-foreground">
                      {isSearchingRegistry
                        ? "Buscando no cadastro de pacientes..."
                        : "Nenhum prontuário adicional encontrado."}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {extras.map(r => {
                      const age = calcAge(r.birth_date ?? null);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setActionPatient(r)}
                          className="text-left"
                        >
                          <Card className="transition-all hover:shadow-md hover:border-primary/50 border-l-4 border-l-primary/30">
                            <CardContent className="p-3 space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-xs truncate">{r.full_name}</p>
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                                    {age !== null && <span>{age}a</span>}
                                    {r.sex && <span>• {r.sex}</span>}
                                    {r.medical_record && <span>• Pront: {r.medical_record}</span>}
                                  </div>
                                  {r.cpf && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">CPF: {r.cpf}</p>
                                  )}
                                </div>
                                <Badge variant="secondary" className="text-[9px] shrink-0 px-1.5 py-0.5">
                                  Prontuário
                                </Badge>
                              </div>
                              <p className="text-[10px] text-primary font-medium pt-1 border-t">
                                Clique para abrir ações →
                              </p>
                            </CardContent>
                          </Card>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Pré-admissões canceladas — bloco recolhível para resgate */}
          {showCancelled && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                <History className="h-3 w-3" />
                Pré-admissões canceladas
                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                  {cancelledList.length}
                </Badge>
                <span className="text-[10px] normal-case font-normal text-muted-foreground/80">
                  (últimos 30 registros — reabra para devolver à fila)
                </span>
              </div>
              {cancelledList.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-3 text-center text-xs text-muted-foreground">
                    Nenhuma pré-admissão cancelada no escopo atual.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {cancelledList.map(pa => {
                    const age = calcAge(pa.birth_date);
                    return (
                      <Card key={pa.id} className="border-l-4 border-l-muted-foreground/30 opacity-90">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-xs truncate">{pa.patient_name}</p>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                                {age !== null && <span>{age}a</span>}
                                {pa.sex && <span>• {pa.sex}</span>}
                                {pa.medical_record && <span>• Pront: {pa.medical_record}</span>}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[9px] shrink-0 px-1.5 py-0.5">
                              CANCELADA
                            </Badge>
                          </div>
                          {pa.destination_sector && (
                            <p className="text-[10px] text-muted-foreground">
                              Destino original: {pa.destination_sector}
                            </p>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-6 text-[10px] gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => setReopenTarget(pa)}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reabrir pré-admissão
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>


      {currentHospital?.id && currentState?.id && (
        <PatientSearchActionsDialog
          open={!!actionPatient}
          onOpenChange={(o) => !o && setActionPatient(null)}
          patient={actionPatient}
          defaultSectorMapTitle={sectorFilterLabel}
          hospitalUnitId={currentHospital.id}
          stateId={currentState.id}
          department={currentDepartment ?? "geral"}
          onSuccess={fetchPreAdmissions}
        />
      )}

      <PatientRegistrationDialog
        open={showRegistration}
        onOpenChange={setShowRegistration}
        onSuccess={fetchPreAdmissions}
        defaultDestinationSector={sectorFilterLabel}
      />

      <RiskClassificationDialog
        open={!!classifyTarget}
        onOpenChange={(open) => !open && setClassifyTarget(null)}
        preAdmission={classifyTarget}
        onSuccess={fetchPreAdmissions}
      />

      <AdmitPatientDialog
        open={!!admitTarget}
        onOpenChange={(open) => !open && setAdmitTarget(null)}
        preAdmission={admitTarget}
        onSuccess={fetchPreAdmissions}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancelar a pré-admissão de <span className="text-destructive">{deleteTarget?.patient_name}</span>?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p className="text-foreground">
                  Esta ação <strong>retira o paciente de todas as filas de alocação</strong> (NIR, UTI, UCI, enfermaria).
                </p>
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[12px] space-y-1">
                  <p className="font-semibold text-amber-700 dark:text-amber-400">O que acontece:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                    <li>O card some do painel "Aguardando Pré-admissão".</li>
                    <li>Nenhum leito será marcado como ocupado por este paciente.</li>
                    <li>O prontuário e o cadastro do paciente <strong>permanecem intactos</strong>.</li>
                    <li>Para readmitir, você poderá <strong>reabrir</strong> esta pré-admissão na aba <em>Canceladas</em> (sem precisar recadastrar).</li>
                  </ul>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Use o cancelamento apenas se a chegada não se confirmou, houve duplicidade, ou o paciente foi para outro fluxo.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter na fila</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Sim, cancelar pré-admissão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reabrir pré-admissão cancelada */}
      <AlertDialog open={!!reopenTarget} onOpenChange={(open) => !open && !isReopening && setReopenTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-emerald-600" />
              Reabrir pré-admissão de <span className="text-emerald-700 dark:text-emerald-400">{reopenTarget?.patient_name}</span>?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p className="text-foreground">
                  O paciente voltará para a fila <strong>"Aguardando Pré-admissão (Alocação) em Leito"</strong> com status <code className="text-[11px] px-1 py-0.5 rounded bg-muted">aguardando_leito</code>.
                </p>
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-[12px] space-y-1">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">O que acontece:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                    <li>O cadastro e o prontuário <strong>são preservados</strong> (mesmo registry e mesmo número de prontuário).</li>
                    <li>Destino original: <strong>{reopenTarget?.destination_sector || "—"}</strong>. Você poderá trocar o setor ao admitir.</li>
                    <li>O leito de destino é limpo — escolha no diálogo de admissão (incluindo Maca Extra, se aplicável).</li>
                    <li>Esta ação fica registrada na auditoria.</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReopening}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleReopen(); }}
              disabled={isReopening}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isReopening ? "Reabrindo..." : "Sim, reabrir e enviar para a fila"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
});
