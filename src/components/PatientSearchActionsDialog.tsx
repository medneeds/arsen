import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { History, FilePlus, BedDouble, ChevronRight, User, Lock, AlertTriangle, MapPin, Loader2, Skull } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  MovementConfirmDialog,
  type MovementSummaryItem,
  type MovementConsequence,
} from "./MovementConfirmDialog";
import {
  DESTINATION_SECTORS,
  findSectorByMapTitle,
  type DestinationSectorOption,
} from "@/lib/destinationSectors";

export interface RegistryPatientLite {
  id: string;
  full_name: string;
  social_name?: string | null;
  mother_name?: string | null;
  birth_date?: string | null;
  sex?: string | null;
  cpf?: string | null;
  cns?: string | null;
  medical_record?: string | null;
  phone?: string | null;
}

interface PatientSearchActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: RegistryPatientLite | null;
  /** Título do setor visualizado no mapa de leitos (sectorFilterLabel). */
  defaultSectorMapTitle?: string;
  hospitalUnitId: string;
  stateId: string;
  department: string;
  onSuccess?: () => void;
}

type Step = "actions" | "checking" | "blocked" | "preadmit_question" | "confirm";

/** Dados de um atendimento ativo encontrado no banco */
interface ActiveEncounterInfo {
  encounterId: string;
  encounterCode: string | null;
  status: string;
  bedNumber: string | null;
  sectorLabel: string | null;
  admissionStatus: string | null;
  isObito: boolean;
  isTransitInternal: boolean;
}

const calcAge = (b?: string | null) => {
  if (!b) return null;
  return Math.floor((Date.now() - new Date(b + "T12:00:00").getTime()) / (365.25 * 24 * 3600 * 1000));
};

export function PatientSearchActionsDialog({
  open,
  onOpenChange,
  patient,
  defaultSectorMapTitle,
  hospitalUnitId,
  stateId,
  department,
  onSuccess,
}: PatientSearchActionsDialogProps) {
  const navigate = useNavigate();
  const { role } = useAuth();

  // Perfis que podem forçar abertura mesmo com atendimento ativo
  const canForce = role === "admin" || (role as string) === "gestor" || (role as string) === "desenvolvedor";

  const [step, setStep] = useState<Step>("actions");
  const [signalPreAdmission, setSignalPreAdmission] = useState(true);
  const [selectedSectorValue, setSelectedSectorValue] = useState<string>(
    () => findSectorByMapTitle(defaultSectorMapTitle)?.value ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado do bloqueio
  const [activeEncounterInfo, setActiveEncounterInfo] = useState<ActiveEncounterInfo | null>(null);
  const [forceJustification, setForceJustification] = useState("");
  const [isForcing, setIsForcing] = useState(false);

  // Reset interno quando reabre
  const reset = () => {
    setStep("actions");
    setSignalPreAdmission(true);
    setSelectedSectorValue(findSectorByMapTitle(defaultSectorMapTitle)?.value ?? "");
    setActiveEncounterInfo(null);
    setForceJustification("");
    setIsForcing(false);
  };

  /**
   * Verifica se o paciente já tem atendimento ativo antes de prosseguir.
   * Consulta duas fontes:
   * 1. patient_encounters — encounter com status active/pending
   * 2. patients — leito físico ocupado pelo registry_id
   */
  const checkActiveEncounter = useCallback(async () => {
    if (!patient) return;
    setStep("checking");
    try {
      // 1. Buscar encounter ativo
      const { data: encData } = await supabase
        .from("patient_encounters")
        .select("id, encounter_code, status")
        .eq("registry_id", patient.id)
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!encData) {
        // Sem encounter ativo → fluxo normal
        setStep("preadmit_question");
        return;
      }

      // 2. Buscar leito físico vinculado
      const { data: bedData } = await (supabase as any)
        .from("patients")
        .select("bed_number, sector, admission_status")
        .eq("patient_registry_id", patient.id)
        .eq("is_vacant", false)
        .maybeSingle();

      const sectorNames: Record<string, string> = {
        red: "UTI 1", yellow: "UTI 2", blue: "UCI 1", outside: "UCI 2",
        ucc: "UCC", neuro_01: "Neuro 01", neuro_02: "Neuro 02",
        clinica_cirurgica: "Clínica Cirúrgica", enfermaria_transicao: "Enf. Transição",
        enfermaria_vascular: "Enf. Vascular", sala_vermelha: "Sala Vermelha",
        sala_laranja: "Sala Laranja", observacao_clinica: "Obs. Clínica",
        internacao_ue: "Internação UE", riv: "RIV", cc_bloco: "Centro Cirúrgico",
      };

      const admStatus = (bedData as any)?.admission_status ?? null;
      const isObito = admStatus === "obito";
      const isTransitInternal = admStatus === "transferencia_interna_pendente";

      setActiveEncounterInfo({
        encounterId: (encData as any).id,
        encounterCode: (encData as any).encounter_code ?? null,
        status: (encData as any).status,
        bedNumber: (bedData as any)?.bed_number ?? null,
        sectorLabel: bedData ? (sectorNames[(bedData as any).sector] ?? (bedData as any).sector) : null,
        admissionStatus: admStatus,
        isObito,
        isTransitInternal,
      });
      setStep("blocked");
    } catch (err) {
      console.error("[checkActiveEncounter]", err);
      // Em caso de erro na verificação, permitir prosseguir (fail-open)
      setStep("preadmit_question");
    }
  }, [patient]);

  const handleClose = (next: boolean) => {
    if (isSubmitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const groupedSectors = useMemo(() => {
    const groups = new Map<string, DestinationSectorOption[]>();
    DESTINATION_SECTORS.forEach(s => {
      if (!groups.has(s.group)) groups.set(s.group, []);
      groups.get(s.group)!.push(s);
    });
    return Array.from(groups.entries());
  }, []);

  const selectedSector = DESTINATION_SECTORS.find(s => s.value === selectedSectorValue);

  if (!patient) return null;

  const age = calcAge(patient.birth_date);

  const goToHistory = () => {
    handleClose(false);
    const params = new URLSearchParams({
      patientRegistryId: patient.id,
      patientName: patient.full_name,
    });
    navigate(`/historico-paciente?${params.toString()}`);
  };

  const handleConfirmCreateEncounter = async () => {
    if (signalPreAdmission && !selectedSector) {
      toast({ title: "Selecione um setor de destino", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // ─────────────────────────────────────────────────────────────────
      // FLUXO CORRIGIDO: Pré-admissão é o ato administrativo que aloca
      // o paciente e GERA o número de atendimento. O encounter é
      // consequência da pré-admissão, não o contrário.
      //
      // Dois caminhos:
      //   A) Com sinalização de setor: cria pré-admissão → cria encounter
      //      vinculado → encounter_code aparece na pré-admissão
      //   B) Sem sinalização de setor: cria encounter direto (triagem
      //      sem alocação imediata — semanticamente correto)
      // ─────────────────────────────────────────────────────────────────

      // 1) Localiza prontuário oficial vinculado ao registry
      let medicalRecordId: string | null = null;
      try {
        const { data: mr } = await supabase
          .from("medical_records")
          .select("id")
          .eq("patient_registry_id", patient.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        medicalRecordId = (mr as any)?.id ?? null;
      } catch (e) {
        console.warn("Falha ao buscar medical_record:", e);
      }

      // 2) Pré-gera o encounter_code (12 dígitos sequenciais)
      let preGeneratedCode: string | null = null;
      if (medicalRecordId) {
        try {
          const { data: code } = await (supabase.rpc as any)(
            "generate_encounter_code_v2",
            { p_medical_record_id: medicalRecordId, p_data_hora_admissao: new Date().toISOString() },
          );
          preGeneratedCode = (code as string) || null;
        } catch (e) {
          console.warn("Falha ao pré-gerar código:", e);
        }
      }

      let encounterCode: string;
      let preAdmissionId: string | null = null;

      if (signalPreAdmission && selectedSector) {
        // ── CAMINHO A: Pré-admissão com setor ─────────────────────────
        // 3A) Cria a pré-admissão PRIMEIRO — ato administrativo de alocação
        const { data: pa, error: paErr } = await supabase
          .from("pre_admissions")
          .insert({
            patient_name: patient.full_name,
            social_name: patient.social_name || null,
            mother_name: patient.mother_name || null,
            birth_date: patient.birth_date || null,
            sex: patient.sex || null,
            cpf: patient.cpf || null,
            cns: patient.cns || null,
            medical_record: patient.medical_record || null,
            phone: patient.phone || null,
            patient_registry_id: patient.id,
            destination_sector: selectedSector.mapTitle,
            status: "aguardando_leito",
            hospital_unit_id: hospitalUnitId,
            state_id: stateId,
            department,
            created_by: user?.id,
            notes: `Pré-admissão administrativa via busca no Mapa de Leitos`,
          } as any)
          .select("id")
          .single();

        if (paErr) throw paErr;
        preAdmissionId = (pa as any).id ?? null;

        // 4A) Cria o encounter vinculado à pré-admissão
        const { data: enc, error: encErr } = await supabase
          .from("patient_encounters")
          .insert({
            patient_name: patient.full_name,
            registry_id: patient.id,
            medical_record_id: medicalRecordId,
            encounter_code: preGeneratedCode || undefined,
            hospital_unit_id: hospitalUnitId,
            state_id: stateId,
            department,
            destination_sector: selectedSector.label || null,
            status: "active",
            triage_status: "encaminhado",
            created_by: user?.id,
            // Vincula ao pre_admission_id para rastreabilidade
            pre_admission_id: preAdmissionId,
          } as any)
          .select()
          .single();

        if (encErr) throw encErr;
        encounterCode = (enc as any).encounter_code as string;

        // 5A) Atualiza a pré-admissão com o encounter_code gerado
        if (encounterCode && preAdmissionId) {
          await supabase
            .from("pre_admissions")
            .update({ notes: `Pré-admissão administrativa via busca no Mapa de Leitos • Atendimento ${encounterCode}` })
            .eq("id", preAdmissionId);
        }

      } else {
        // ── CAMINHO B: Apenas abre atendimento, sem alocar setor ───────
        // Triagem ou atendimento administrativo sem alocação imediata.
        // Neste caso o encounter é criado diretamente — sem pré-admissão.
        const { data: enc, error: encErr } = await supabase
          .from("patient_encounters")
          .insert({
            patient_name: patient.full_name,
            registry_id: patient.id,
            medical_record_id: medicalRecordId,
            encounter_code: preGeneratedCode || undefined,
            hospital_unit_id: hospitalUnitId,
            state_id: stateId,
            department,
            status: "active",
            triage_status: "encaminhado",
            created_by: user?.id,
          } as any)
          .select()
          .single();

        if (encErr) throw encErr;
        encounterCode = (enc as any).encounter_code as string;
      }

      toast({
        title: signalPreAdmission && selectedSector ? "Pré-admissão registrada" : "Atendimento aberto",
        description: signalPreAdmission && selectedSector
          ? `Atend. ${encounterCode} • aguardando leito em ${selectedSector.mapTitle}`
          : `Código ${encounterCode} • sem alocação de setor`,
      });

      handleClose(false);
      onSuccess?.();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao abrir atendimento", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ====== Card final de confirmação (MovementConfirmDialog) ======
  const summary: MovementSummaryItem[] = [
    { label: "Paciente", value: patient.full_name },
    ...(patient.medical_record ? [{ label: "Prontuário", value: patient.medical_record }] : []),
    ...(patient.cpf ? [{ label: "CPF", value: patient.cpf }] : []),
    {
      label: "Ação",
      value: signalPreAdmission && selectedSector
        ? "Pré-admissão administrativa (aloca + gera atendimento)"
        : "Abrir atendimento sem alocação de setor",
    },
    {
      label: signalPreAdmission && selectedSector ? "Setor de destino" : "Alocação",
      value: signalPreAdmission && selectedSector
        ? selectedSector.mapTitle
        : "Nenhuma (sem pré-admissão)",
    },
    { label: "Nº de atendimento", value: "Gerado automaticamente (12 dígitos)" },
  ];

  const consequences: MovementConsequence[] = signalPreAdmission && selectedSector ? [
    { icon: BedDouble, text: (<>Será criada uma <b>pré-admissão</b> no setor <b>{selectedSector.mapTitle}</b> — ato administrativo de alocação.</>) },
    { icon: FilePlus, text: <>O <b>número de atendimento</b> (12 dígitos) é gerado como parte da pré-admissão e vinculado ao prontuário.</> },
    { icon: ChevronRight, text: <>O paciente aparecerá em <b>"Aguardando Pré-admissão (Alocação) em Leito"</b> no setor escolhido.</> },
  ] : [
    { icon: FilePlus, text: <>Será criado um <b>atendimento</b> vinculado ao prontuário, sem alocação de leito.</> },
    { icon: ChevronRight, text: <>Um <b>código sequencial global de 12 dígitos</b> será emitido. O paciente não será sinalizado em nenhum setor.</> },
  ];

  return (
    <>
      {/* Etapas 1 e 2 — diálogo padrão */}
      <Dialog open={open && step !== "confirm"} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base uppercase truncate">{patient.full_name}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
                  {age !== null && <span>{age}a</span>}
                  {patient.sex && <span>• {patient.sex}</span>}
                  {patient.medical_record && <span>• Pront: {patient.medical_record}</span>}
                  {patient.cpf && <span>• CPF: {patient.cpf}</span>}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {step === "actions" && (
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground">
                Escolha uma ação para este paciente:
              </p>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  className="h-auto py-3 justify-start gap-3"
                  onClick={goToHistory}
                >
                  <History className="h-4 w-4 text-primary" />
                  <div className="text-left">
                    <div className="text-sm font-semibold">Consultar histórico</div>
                    <div className="text-[11px] text-muted-foreground">
                      Abre a linha do tempo longitudinal do paciente.
                    </div>
                  </div>
                </Button>

                <Button
                  className="h-auto py-3 justify-start gap-3"
                  onClick={checkActiveEncounter}
                >
                  <FilePlus className="h-4 w-4" />
                  <div className="text-left">
                    <div className="text-sm font-semibold">Abrir novo atendimento</div>
                    <div className="text-[11px] opacity-90">
                      Gera um código único de atendimento (12 dígitos) vinculado a este prontuário.
                    </div>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {step === "checking" && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verificando atendimentos ativos...</p>
            </div>
          )}

          {step === "blocked" && activeEncounterInfo && (
            <div className="space-y-3 py-1">
              {/* Banner principal */}
              {activeEncounterInfo.isObito ? (
                <div className="flex items-start gap-3 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-3">
                  <Skull className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-destructive">Óbito registrado</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Este paciente possui um registro de óbito ativo. Não é possível abrir novo atendimento.
                      Em caso de erro de sinalização, um gestor ou administrador pode forçar a abertura com justificativa.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-lg border-2 border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 p-3">
                  <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                      Atendimento ativo encontrado
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                      Este paciente já possui um atendimento em aberto. Para admiti-lo em um novo setor,
                      é necessário encerrar o atendimento atual (alta, transferência externa ou óbito)
                      antes de abrir um novo.
                    </p>
                  </div>
                </div>
              )}

              {/* Dados do atendimento ativo */}
              <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Atendimento em aberto</p>
                {activeEncounterInfo.encounterCode && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Nº Atendimento</span>
                    <Badge variant="secondary" className="text-xs font-mono font-bold">
                      #{activeEncounterInfo.encounterCode}
                    </Badge>
                  </div>
                )}
                {activeEncounterInfo.sectorLabel && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-foreground font-medium">
                      {activeEncounterInfo.sectorLabel}
                      {activeEncounterInfo.bedNumber && ` — Leito ${activeEncounterInfo.bedNumber}`}
                    </span>
                  </div>
                )}
                {activeEncounterInfo.isTransitInternal && (
                  <Badge variant="outline" className="text-[10px] border-sky-400 text-sky-600">
                    Em transferência interna — aguardando alocação no setor destino
                  </Badge>
                )}
                {!activeEncounterInfo.sectorLabel && !activeEncounterInfo.isObito && (
                  <p className="text-xs text-muted-foreground">Atendimento ativo sem leito físico alocado (aguardando pré-admissão)</p>
                )}
              </div>

              {/* Ação principal: ver localização */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  handleClose(false);
                  navigate("/painel-clinico");
                }}
              >
                <MapPin className="h-4 w-4" />
                Ver localização no Painel Clínico
              </Button>

              {/* Forçar abertura — apenas gestor/admin/dev */}
              {canForce && (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => setIsForcing(f => !f)}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {isForcing ? "Cancelar" : "Forçar novo atendimento (gestor/admin)"}
                  </button>
                  {isForcing && (
                    <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-[11px] text-destructive font-medium">
                        ⚠ Esta ação abre um novo atendimento mesmo com um atendimento ativo.
                        A justificativa será registrada em auditoria.
                      </p>
                      <Textarea
                        placeholder="Justificativa obrigatória (mínimo 20 caracteres)..."
                        value={forceJustification}
                        onChange={e => setForceJustification(e.target.value)}
                        className="text-xs min-h-[72px]"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        disabled={forceJustification.trim().length < 20}
                        onClick={async () => {
                          // Registrar auditoria antes de prosseguir
                          try {
                            const { data: { user: authUser } } = await supabase.auth.getUser();
                            await supabase.from("patient_movements").insert({
                              patient_name: patient!.full_name,
                              movement_type: "ABERTURA FORÇADA DE ATENDIMENTO — GESTOR/ADMIN",
                              destination: "Novo atendimento forçado sobre atendimento ativo",
                              notes: `Atendimento ativo: #${activeEncounterInfo!.encounterCode ?? "—"} | Justificativa: ${forceJustification.trim()}`,
                              created_by: authUser?.id ?? null,
                              hospital_unit_id: hospitalUnitId,
                              state_id: stateId,
                              department,
                            } as any);
                          } catch (e) {
                            console.warn("Falha ao registrar auditoria de força:", e);
                          }
                          setStep("preadmit_question");
                          setIsForcing(false);
                        }}
                      >
                        Confirmar abertura forçada
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === "preadmit_question" && (
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                Antes de confirmar, deseja <b>sinalizar pré-admissão</b> deste paciente para algum setor
                (entra em "Aguardando Pré-admissão (Alocação) em Leito")?
              </p>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={signalPreAdmission ? "default" : "outline"}
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => setSignalPreAdmission(true)}
                >
                  Sim, sinalizar
                </Button>
                <Button
                  variant={!signalPreAdmission ? "default" : "outline"}
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => setSignalPreAdmission(false)}
                >
                  Não, só abrir atendimento
                </Button>
              </div>

              {signalPreAdmission && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Setor de destino</Label>
                  <Select value={selectedSectorValue} onValueChange={setSelectedSectorValue}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupedSectors.map(([group, items]) => (
                        <SelectGroup key={group}>
                          <SelectLabel className="text-[10px] uppercase">{group}</SelectLabel>
                          {items.map(s => (
                            <SelectItem key={s.value} value={s.value} className="text-xs">
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  {defaultSectorMapTitle && (
                    <p className="text-[10px] text-muted-foreground">
                      Padrão: setor visualizado no mapa <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{defaultSectorMapTitle}</Badge>
                    </p>
                  )}
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep("actions")}>
                  Voltar
                </Button>
                <Button
                  size="sm"
                  onClick={() => setStep("confirm")}
                  disabled={signalPreAdmission && !selectedSectorValue}
                >
                  Revisar e confirmar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Etapa 3 — card de confirmação reutilizando o padrão da casa */}
      <MovementConfirmDialog
        open={open && step === "confirm"}
        onOpenChange={(o) => {
          if (!o && !isSubmitting) setStep("preadmit_question");
        }}
        onConfirm={handleConfirmCreateEncounter}
        isSubmitting={isSubmitting}
        title="Abrir novo atendimento"
        description="Confirme a abertura do atendimento e, se aplicável, a sinalização de pré-admissão no setor."
        summary={summary}
        consequences={consequences}
        confirmLabel={signalPreAdmission && selectedSector ? "Confirmar pré-admissão" : "Confirmar abertura de atendimento"}
        cancelLabel="Voltar"
        finalNote={
          signalPreAdmission && selectedSector
            ? <>A pré-admissão aloca o paciente no setor e gera o <b>número de atendimento imutável</b>. A admissão médica é feita pelo médico ao avaliar o paciente no leito.</>
            : <>O código de atendimento é <b>imutável</b> após a emissão e ficará vinculado ao prontuário do paciente.</>
        }
      />
    </>
  );
}
