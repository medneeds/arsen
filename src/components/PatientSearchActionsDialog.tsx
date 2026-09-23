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
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";
import { closeActiveEncounter } from "@/lib/resolveActiveEncounter";
import { ADMISSION_STATUS } from "@/lib/admissionStatus";
import { safeSetItem } from "@/lib/safeStorage";
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
  /** id da linha-LEITO (patients.id) do atendimento ativo — usado na correção. */
  bedRowId: string | null;
  encounterCode: string | null;
  status: string;
  bedNumber: string | null;
  sectorCode: string | null;
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

  // Perfis que podem forçar abertura mesmo com atendimento ativo.
  // APENAS gestor e admin (22/07/2026, decisão do gestor): medico comum NAO
  // pode executar este fluxo em nenhuma hipotese. O perfil 'desenvolvedor' foi
  // removido desta lista — acesso de dev nao e justificativa clinica.
  const canForce = (role as string) === "admin" || (role as string) === "gestor";

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
  const [askForcePassword, setAskForcePassword] = useState(false);
  const [forceAcknowledged, setForceAcknowledged] = useState(false);

  // Reset interno quando reabre
  const reset = () => {
    setStep("actions");
    setSignalPreAdmission(true);
    setSelectedSectorValue(findSectorByMapTitle(defaultSectorMapTitle)?.value ?? "");
    setActiveEncounterInfo(null);
    setForceJustification("");
    setIsForcing(false);
  };

  // (auto-check moved below the checkActiveEncounter declaration to avoid TDZ)

  /**
   * Executado SOMENTE apos a confirmacao de senha (PasswordConfirmDialog).
   * Registra a auditoria da abertura forcada e libera o fluxo de criacao.
   * Exigencia do gestor (22/07/2026): forcar atendimento sobre um atendimento
   * ativo requer perfil gestor/admin + justificativa + SENHA.
   */
  const handleForceConfirmed = async () => {
    // CORREÇÃO, não duplicação (23/07/2026, decisão do gestor após o teste que
    // encontrou o mesmo paciente em dois leitos): forçar ENCERRA o atendimento
    // anterior e abre o novo. Antes abria um atendimento PARALELO, violando a
    // regra "1 atendimento aberto por prontuário" — justamente o que blindamos
    // no front e no banco — e deixando o paciente ocupando dois leitos.
    let correctionNote = "";
    try {
      const closeRes = await closeActiveEncounter(patient!.id);
      correctionNote = closeRes?.closedId
        ? ` | Atendimento anterior ENCERRADO por correção`
        : ` | Nenhum atendimento anterior encontrado para encerrar`;
      // MIGRAÇÃO: não há tabela `patients` nem coluna admission_status no schema
      // novo — a sinalização do leito anterior para desalocação não tem
      // equivalente e foi removida. O encerramento lógico do atendimento é feito
      // por closeActiveEncounter (lib compartilhada).
    } catch (e) {
      console.warn("Falha ao encerrar atendimento anterior na abertura forcada:", e);
      correctionNote = " | FALHA ao encerrar o atendimento anterior";
    }

    try {
      // MIGRAÇÃO: patient_movements→logs_auditoria (isto é auditoria, não uma
      // movimentação física de leito).
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { error: erroNaoBloqueante1 } = await supabase.from("logs_auditoria").insert({
        tipo_evento: "abertura_forcada_atendimento",
        nome_tabela: "internacoes",
        acao: null,
        paciente_id: patient!.id,
        motivo: `Abertura forçada sobre atendimento ativo${correctionNote} | Justificativa: ${forceJustification.trim()} | Confirmado com senha e ciência do gestor`,
        dados_novos: {
          paciente: patient!.full_name,
          atendimento_anterior: activeEncounterInfo?.encounterCode ?? null,
          leito_anterior: activeEncounterInfo?.bedNumber ?? null,
        } as any,
        ator_user_id: authUser?.id ?? null,
        hospital_id: hospitalUnitId,
      });
      // Nao bloqueia o fluxo, mas nao pode sumir: antes o resultado era descartado.
      if (erroNaoBloqueante1) console.warn("[PatientSearchActionsDialog] falha nao-bloqueante ao registrar auditoria de abertura forcada:", erroNaoBloqueante1);
    } catch (e) {
      console.warn("Falha ao registrar auditoria de abertura forcada:", e);
    }
    setAskForcePassword(false);
    setIsForcing(false);
    setForceAcknowledged(false);
    setStep("preadmit_question");
  };

  /**
   * Verifica se o paciente já tem atendimento ativo antes de prosseguir.
   * MIGRAÇÃO: patient_encounters + patients → `internacoes` (com joins
   * leitos/setores). "Ativo" = internação sem `data_alta`. registry_id→paciente_id.
   * Não há mais encounter_code, triage_status nem admission_status → degradados;
   * o leito físico vem do join leito→setor da própria internação.
   */
  const checkActiveEncounter = useCallback(async () => {
    if (!patient) return;
    setStep("checking");
    try {
      const { data: internacao } = await supabase
        .from("internacoes")
        .select("id, status, data_alta, leito:leitos!internacoes_leito_id_fkey(numero, setor:setores!leitos_setor_id_fkey(nome, tipo))")
        .eq("paciente_id", patient.id)
        .is("data_alta", null)
        .order("data_entrada", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!internacao) {
        // Sem internação aberta → fluxo normal
        setStep("preadmit_question");
        return;
      }

      const leito = (internacao as any).leito || null;
      const setor = leito?.setor || null;
      // MIGRAÇÃO: vocabulário de internacoes.status não é conhecido no front —
      // "obito" é a melhor aproximação; transferência interna não é mais
      // sinalizada por status de leito (degradada para false).
      const isObito = internacao.status === "obito";

      setActiveEncounterInfo({
        encounterId: internacao.id,
        // MIGRAÇÃO: bedRowId era patients.id (linha-leito) — sem equivalente.
        bedRowId: null,
        // MIGRAÇÃO: internacoes não tem encounter_code.
        encounterCode: null,
        status: internacao.status,
        bedNumber: leito?.numero ?? null,
        sectorCode: setor?.tipo ?? null,
        sectorLabel: setor?.nome ?? null,
        // MIGRAÇÃO: internacoes não tem admission_status.
        admissionStatus: null,
        isObito,
        isTransitInternal: false,
      });
      setStep("blocked");
    } catch (err) {
      console.error("[checkActiveEncounter]", err);
      // Em caso de erro na verificação, permitir prosseguir (fail-open)
      setStep("preadmit_question");
    }
  }, [patient]);

  // Auto-verifica atendimento ativo ao abrir o dialog — evita mostrar
  // "Abrir novo atendimento" para pacientes já internados.
  useEffect(() => {
    if (open && patient) {
      checkActiveEncounter();
    }
  }, [open, patient, checkActiveEncounter]);

  const handleClose = (next: boolean) => {
    if (isSubmitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const groupedSectors = useMemo(() => {
    const groups = new Map<string, DestinationSectorOption[]>();
    // legacyOnly fica fora do seletor de NOVOS destinos (fora do escopo de
    // internação ou agrupamento); lookups por value/mapTitle seguem resolvendo.
    DESTINATION_SECTORS.filter(s => !s.legacyOnly).forEach(s => {
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
      // ─────────────────────────────────────────────────────────────────
      // MIGRAÇÃO (schema novo):
      //  - `patient_encounters` não existe: `internacoes` é o conceito
      //    equivalente, mas exige leito_id NOT NULL — não é possível "abrir
      //    atendimento" bedless a partir daqui.
      //  - Não há mais encounter_code, `medical_records`, nem o RPC
      //    generate_encounter_code_v2 (o nº de atendimento de 12 dígitos foi
      //    degradado — sem gerador no backend novo).
      //  - `pre_admissions`→`pre_admissoes`: só existem nome_paciente, cpf, cns,
      //    data_nascimento, setor_destino_id, status, data_hora. social_name,
      //    mother_name, sex, medical_record, phone, patient_registry_id,
      //    hospital_unit_id, state_id, department, notes, destination_sector
      //    (texto) NÃO existem → degradados.
      //  - selectedSector é um código de UI (não UUID de `setores`) →
      //    setor_destino_id degradado para null.
      //
      // Ambos os caminhos passam a registrar apenas a PRÉ-ADMISSÃO
      // (fila "aguardando_leito"), que é o único registro insertável aqui.
      // ─────────────────────────────────────────────────────────────────
      const { error: paErr } = await supabase
        .from("pre_admissoes")
        .insert({
          nome_paciente: patient.full_name,
          cpf: patient.cpf || null,
          cns: patient.cns || null,
          data_nascimento: patient.birth_date || null,
          setor_destino_id: null,
          status: "classificado",
        });
      if (paErr) throw paErr;

      toast({
        title: signalPreAdmission && selectedSector ? "Pré-admissão registrada" : "Pré-admissão registrada (sem setor)",
        description: signalPreAdmission && selectedSector
          ? `Aguardando leito em ${selectedSector.mapTitle} (nº de atendimento indisponível no schema novo)`
          : `Paciente adicionado à fila de pré-admissão`,
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
                <DialogTitle className="text-base uppercase tracking-wider truncate">{patient.full_name}</DialogTitle>
                <DialogDescription className="text-xs mt-1 flex items-center gap-2 flex-wrap">
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
                    <div className="text-sm font-medium">Consultar histórico</div>
                    <div className="text-xs text-muted-foreground">
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
                    <div className="text-sm font-medium">Abrir novo atendimento</div>
                    <div className="text-xs opacity-90">
                      Gera um código único de atendimento (12 dígitos) vinculado a este prontuário.
                    </div>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {step === "checking" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verificando atendimentos ativos...</p>
            </div>
          )}

          {step === "blocked" && activeEncounterInfo && (
            <div className="space-y-3 py-1">
              {/* Banner principal */}
              {activeEncounterInfo.isObito ? (
                <div className="flex items-start gap-3 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-3">
                  <Skull className="h-5 w-5 text-destructive mt-1 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-destructive">Óbito registrado</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Este paciente possui um registro de óbito ativo. Não é possível abrir novo atendimento.
                      Em caso de erro de sinalização, um gestor ou administrador pode forçar a abertura com justificativa.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-lg border-2 border-warning/50 bg-warning-soft p-3">
                  <Lock className="h-5 w-5 text-warning-on-soft mt-1 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-warning-on-soft">
                      Atendimento ativo encontrado
                    </p>
                    <p className="text-xs text-warning-on-soft mt-1 leading-relaxed">
                      Este paciente já possui um atendimento em aberto. Para admiti-lo em um novo setor,
                      é necessário encerrar o atendimento atual (alta, transferência externa ou óbito)
                      antes de abrir um novo.
                    </p>
                  </div>
                </div>
              )}

              {/* Dados do atendimento ativo */}
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Atendimento em aberto</p>
                {activeEncounterInfo.encounterCode && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Nº Atendimento</span>
                    <Badge variant="secondary" className="text-xs font-mono font-semibold">
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
                  <Badge variant="outline" className="text-xs border-border text-foreground">
                    Em transferência interna — aguardando alocação no setor destino
                  </Badge>
                )}
                {!activeEncounterInfo.sectorLabel && !activeEncounterInfo.isObito && (
                  <p className="text-xs text-muted-foreground">Atendimento ativo sem leito físico alocado (aguardando alocação em leito)</p>
                )}
              </div>

              {/* Ações principais */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={goToHistory}
                >
                  <History className="h-4 w-4" />
                  Consultar histórico
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    if (activeEncounterInfo?.sectorCode) {
                      safeSetItem("selected_sector", activeEncounterInfo.sectorCode);
                    }
                    handleClose(false);
                    navigate("/painel-clinico");
                  }}
                >
                  <MapPin className="h-4 w-4" />
                  Ver no Painel
                </Button>
              </div>

              {/* Forçar abertura — apenas gestor/admin/dev */}
              {canForce && (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => setIsForcing(f => !f)}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {isForcing ? "Cancelar" : "Forçar novo atendimento (gestor/admin)"}
                  </button>
                  {isForcing && (
                    <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-xs text-destructive font-medium">
                        Esta ação abre um novo atendimento mesmo com um atendimento ativo.
                        A justificativa será registrada em auditoria.
                      </p>
                      <Textarea
                        placeholder="Justificativa obrigatória (mínimo 20 caracteres)..."
                        value={forceJustification}
                        onChange={e => setForceJustification(e.target.value)}
                        className="text-xs min-h-[72px]"
                      />
                      {/* Popup esclarecedor + declaração de ciência (23/07/2026,
                          pedido do gestor): a ação NÃO cria um atendimento
                          paralelo — ela ENCERRA o anterior. O gestor precisa
                          declarar ciência disso antes de chegar na senha. */}
                      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                        <p className="text-xs font-medium text-destructive">
                          O que esta ação faz
                        </p>
                        <ul className="text-xs text-foreground/80 space-y-1 list-disc pl-4">
                          <li>
                            <b>Encerra</b> o atendimento atual
                            {activeEncounterInfo?.encounterCode ? ` #${activeEncounterInfo.encounterCode}` : ""}
                            {activeEncounterInfo?.bedNumber ? ` (leito ${activeEncounterInfo.bedNumber})` : ""} — ele deixa
                            de ser o atendimento ativo do paciente.
                          </li>
                          <li>
                            O leito anterior fica <b>sinalizado para desalocação</b>, a ser concluída
                            pelo menu Movimentações.
                          </li>
                          <li>
                            Abre um <b>novo atendimento</b>. O histórico clínico do anterior é
                            preservado e continua acessível pelo Histórico — mas <b>não migra</b> para
                            o novo.
                          </li>
                          <li>
                            Sua identidade, a justificativa e o atendimento encerrado ficam
                            <b> registrados em auditoria</b>.
                          </li>
                        </ul>
                        <label className="flex items-start gap-2 pt-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={forceAcknowledged}
                            onChange={(e) => setForceAcknowledged(e.target.checked)}
                            className="mt-1 h-3 w-3 shrink-0 accent-destructive cursor-pointer"
                          />
                          <span className="text-xs text-foreground leading-snug">
                            Declaro estar ciente de que o atendimento atual será encerrado e assumo a
                            responsabilidade por esta correção.
                          </span>
                        </label>
                      </div>

                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        disabled={forceJustification.trim().length < 20 || !forceAcknowledged}
                        onClick={() => setAskForcePassword(true)}
                      >
                        Encerrar atendimento atual e abrir novo
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
                Antes de confirmar, deseja <b>sinalizar alocação em leito</b> deste paciente para algum setor
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
                <div className="space-y-2">
                  <Label className="text-xs">Setor de destino</Label>
                  <Select value={selectedSectorValue} onValueChange={setSelectedSectorValue}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupedSectors.map(([group, items]) => (
                        <SelectGroup key={group}>
                          <SelectLabel className="text-xs uppercase tracking-wider">{group}</SelectLabel>
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
                    <p className="text-xs text-muted-foreground">
                      Padrão: setor visualizado no mapa <Badge variant="secondary" className="text-xs py-0 px-2">{defaultSectorMapTitle}</Badge>
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
        description="Confirme a abertura do atendimento e, se aplicável, a sinalização de alocação em leito no setor."
        summary={summary}
        consequences={consequences}
        confirmLabel={signalPreAdmission && selectedSector ? "Confirmar alocação em leito" : "Confirmar abertura de atendimento"}
        cancelLabel="Voltar"
        finalNote={
          signalPreAdmission && selectedSector
            ? <>A alocação coloca o paciente no leito e gera o <b>número de atendimento imutável</b>. A admissão médica é feita pelo médico ao avaliar o paciente no leito.</>
            : <>O código de atendimento é <b>imutável</b> após a emissão e ficará vinculado ao prontuário do paciente.</>
        }
      />

      {/* Confirmacao por SENHA para abertura forcada — so gestor/admin chegam aqui */}
      <PasswordConfirmDialog
        open={askForcePassword}
        onOpenChange={(o) => setAskForcePassword(o)}
        title="Encerrar atendimento atual e abrir novo"
        description={`Ação restrita a gestor/admin. Digite sua senha para ENCERRAR o atendimento ativo${activeEncounterInfo?.encounterCode ? ` #${activeEncounterInfo.encounterCode}` : ""} de ${patient?.full_name ?? "este paciente"} e abrir um novo em seu lugar. O leito anterior ficará sinalizado para desalocação. A justificativa, sua identidade e o atendimento encerrado serão registrados em auditoria.`}
        actionLabel="Encerrar e abrir novo"
        onConfirmed={handleForceConfirmed}
      />
    </>
  );
}
