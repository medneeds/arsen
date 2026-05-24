import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Bed, ClipboardList, FileText, Info, Stethoscope, UserMinus, UserCheck, ArrowRight } from "lucide-react";
import { MovementConfirmDialog, type MovementBlocker, type MovementWarning } from "./MovementConfirmDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Patient } from "@/types/patient";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";
import { supabase } from "@/integrations/supabase/client";

const PRE_ADMISSION_REASONS = [
  { value: "paciente_saiu", label: "Paciente saiu antes da admissão (evasão / saída a pedido)" },
  { value: "alocacao_indevida", label: "Alocação indevida no leito (paciente errado)" },
  { value: "redirecionado_outro_setor", label: "Redirecionado para outro setor antes da admissão" },
  { value: "obito_pre_admissao", label: "Óbito antes da admissão hospitalar" },
  { value: "transferido_externo", label: "Transferido para outra unidade antes da admissão" },
  { value: "outro", label: "Outro motivo" },
];

const POST_DISCHARGE_REASONS = [
  { value: "alta_concluida", label: "Alta médica já registrada — liberar leito para limpeza/nova alocação" },
  { value: "obito_concluido", label: "Óbito já registrado — liberar leito para preparo/remoção" },
  { value: "transferencia_externa_concluida", label: "Transferência externa já efetivada — leito disponível" },
  { value: "transferencia_interna_concluida", label: "Transferência interna sinalizada — desalocar para mover o paciente" },
  { value: "outro", label: "Outro motivo" },
];

const EXCEPTIONAL_REASONS = [
  { value: "alta_sinalizada_nao_persistida", label: "Alta sinalizada no Painel mas não persistida (documento não assinado)" },
  { value: "paciente_ja_saiu", label: "Paciente já saiu fisicamente — leito retido indevidamente" },
  { value: "erro_admissao", label: "Admissão registrada por engano (paciente errado/duplicado)" },
  { value: "regularizacao_administrativa", label: "Regularização administrativa do censo" },
  { value: "outro", label: "Outro motivo (descreva)" },
];

export interface BedReleasePreAdmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient | null;
  onConfirm: (payload: { reason: string; reasonNote: string }) => Promise<void> | void;
}

export function BedReleasePreAdmissionDialog({ open, onOpenChange, patient, onConfirm }: BedReleasePreAdmissionDialogProps) {
  const navigate = useNavigate();
  const isPostDischarge =
    patient?.admissionStatus === "alta_dada"
    || patient?.admissionStatus === "obito"
    || patient?.admissionStatus === "transferencia_externa_pendente"
    || patient?.admissionStatus === "transferencia_interna_pendente";
  const isExceptional = patient?.admissionStatus === "admitido";
  const REASON_OPTIONS = isExceptional
    ? EXCEPTIONAL_REASONS
    : isPostDischarge ? POST_DISCHARGE_REASONS : PRE_ADMISSION_REASONS;
  const defaultReason = isExceptional
    ? "alta_sinalizada_nao_persistida"
    : isPostDischarge
      ? (patient?.admissionStatus === "obito"
          ? "obito_concluido"
          : patient?.admissionStatus === "transferencia_externa_pendente"
            ? "transferencia_externa_concluida"
            : patient?.admissionStatus === "transferencia_interna_pendente"
              ? "transferencia_interna_concluida"
              : "alta_concluida")
      : "paciente_saiu";

  const [step, setStep] = useState<"notice" | "form" | "password">("notice");
  const [reason, setReason] = useState<string>(defaultReason);
  const [reasonNote, setReasonNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [signaledDestination, setSignaledDestination] = useState<string | null>(null);
  const stepTransitionRef = useRef(false);

  useEffect(() => {
    if (open) {
      setStep("notice");
      setReason(defaultReason);
      setReasonNote("");
      setSubmitting(false);
      setSignaledDestination(null);
    }
  }, [open, defaultReason]);

  // Busca o destino da sinalização existente (transferência interna/externa)
  // para exibir no resumo e nos botões "Desalocar UTI 1 → UCI 2".
  useEffect(() => {
    const pid = (patient as any)?.id;
    const isTransferPending =
      patient?.admissionStatus === "transferencia_interna_pendente"
      || patient?.admissionStatus === "transferencia_externa_pendente";
    if (!open || !pid || !isTransferPending) return;
    let cancelled = false;
    (async () => {
      const movementType = patient?.admissionStatus === "transferencia_interna_pendente"
        ? "TRANSFERENCIA_INTERNA"
        : "TRANSFERENCIA_EXTERNA";
      const { data } = await supabase
        .from("patient_movements")
        .select("destination")
        .eq("patient_id", pid)
        .eq("movement_type", movementType)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data?.destination) setSignaledDestination(data.destination);
    })();
    return () => { cancelled = true; };
  }, [open, (patient as any)?.id, patient?.admissionStatus]);

  if (!patient) return null;

  const alreadyAdmitted = patient.admissionStatus === "admitido";

  // Bloqueio: motivo "outro" exige nota
  const blockers: MovementBlocker[] = [];
  if (reason === "outro" && reasonNote.trim().length < 5) {
    blockers.push({
      label: "Detalhe o motivo",
      reason: 'Ao selecionar "Outro motivo" é obrigatório descrever o que aconteceu (mínimo 5 caracteres).',
    });
  }
  // No fluxo excepcional (admitido sem alta) a justificativa é SEMPRE obrigatória
  if (isExceptional && reasonNote.trim().length < 10) {
    blockers.push({
      label: "Justificativa obrigatória",
      reason: "Liberação excepcional (paciente admitido sem alta registrada) exige descrição clínica/administrativa detalhada (mínimo 10 caracteres). Ficará registrado no histórico imutável.",
    });
  }

  const warnings: MovementWarning[] = [];
  if (reason === "obito_pre_admissao") {
    warnings.push({
      label: "Óbito antes da admissão",
      detail:
        "Mesmo sem admissão hospitalar formal, registre o óbito pelo fluxo da Alta/Desfecho para gerar a Declaração de Óbito.",
    });
  }
  if (isExceptional) {
    warnings.push({
      label: "Liberação excepcional sem alta médica registrada",
      detail:
        "Esta é uma ação de autonomia médica/administrativa para destravar o leito quando a sinalização de alta não foi persistida (ex.: documento de alta não chegou a ser assinado). O ideal é sempre completar o fluxo pelo Painel Clínico — use este caminho apenas em situação operacional crítica.",
    });
  }

  const reasonLabel = REASON_OPTIONS.find((r) => r.value === reason)?.label ?? reason;

  // Rótulo "Origem → Destino" para transferência sinalizada
  const originLabel = (patient as any)?.department || sectorLabelFromCode(patient?.sector) || "—";
  const isTransferPending =
    patient?.admissionStatus === "transferencia_interna_pendente"
    || patient?.admissionStatus === "transferencia_externa_pendente";
  const transferArrowLabel = isTransferPending && signaledDestination
    ? `Desalocar ${originLabel} → ${signaledDestination}`
    : null;

  // Etapa 2 → vai para etapa de SENHA (não confirma direto)
  const goToFormStep = () => {
    stepTransitionRef.current = true;
    setStep("form");
    requestAnimationFrame(() => {
      stepTransitionRef.current = false;
    });
  };

  const goToPasswordStep = () => {
    if (blockers.length > 0) return;
    setStep("password");
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm({ reason: reasonLabel, reasonNote: reasonNote.trim() });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Não há mais bloqueio "hard" — admin/médico podem prosseguir no caminho excepcional
  // com justificativa obrigatória, senha e auditoria diferenciada.
  const blockReleaseHard = false;

  return (
    <>
      {/* ETAPA 1: Notificação de consciência (intermediária) */}
      <AlertDialog
        open={open && step === "notice"}
        onOpenChange={(v) => {
          if (!v && !stepTransitionRef.current) onOpenChange(false);
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded-full bg-amber-100 dark:bg-amber-950/40 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <AlertDialogTitle className="text-base">
                {isExceptional
                  ? "Desalocação excepcional — paciente sem sinalização"
                  : patient?.admissionStatus === "transferencia_interna_pendente"
                    ? "Desalocar leito para transferência interna"
                    : patient?.admissionStatus === "transferencia_externa_pendente"
                      ? "Desalocar leito para transferência externa"
                      : isPostDischarge
                        ? "Desalocar leito após alta/óbito"
                        : "Atenção: desalocar leito sem sinalização"}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-xs leading-relaxed text-foreground">
                <p>
                  Você está prestes a <strong>desocupar o leito {patient.bedNumber || "—"}</strong> ocupado por{" "}
                  <strong>{patient.name || "este paciente"}</strong>.
                </p>
                {isExceptional ? (
                  <>
                    <div className="rounded-md border-2 border-amber-500/70 bg-amber-50 dark:bg-amber-950/40 p-3 text-amber-900 dark:text-amber-100">
                      <p className="font-bold text-sm flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4" />
                        Pare — este paciente ainda NÃO foi sinalizado
                      </p>
                      <p className="mt-1.5">
                        O paciente está marcado como <strong>admitido</strong> e não há alta, óbito ou transferência sinalizada no Painel Clínico. <strong>O caminho correto é sinalizar a saída antes de liberar o leito</strong> — isso garante prontuário completo, documento clínico assinado, número de atendimento preservado e tarja correta no mapa.
                      </p>
                    </div>

                    <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
                      <p className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <Stethoscope className="h-4 w-4 text-primary" />
                        Como sinalizar pelo Painel Clínico (passo a passo)
                      </p>
                      <ol className="list-decimal pl-5 space-y-1 text-foreground/90">
                        <li>Abra o <strong>Painel Clínico</strong> (no menu lateral) e localize o paciente no setor.</li>
                        <li>Clique no <strong>card do paciente</strong> para abrir o cockpit.</li>
                        <li>Na barra de ações superior, clique em <strong>"Movimentações e Desfechos"</strong>.</li>
                        <li>Escolha o subtipo: <strong>Alta Médica</strong>, <strong>Óbito</strong>, <strong>Transferência Interna</strong> ou <strong>Externa</strong>.</li>
                        <li>Preencha destino/médico/observações e <strong>confirme</strong>. O card no Mapa passa a exibir a <strong>tarja correspondente</strong>.</li>
                        <li>Volte ao Mapa e clique novamente em <strong>"Liberar leito"</strong> — agora aparecerá o fluxo normal de liberação.</li>
                      </ol>
                      <Button
                        type="button"
                        size="sm"
                        className="mt-3 w-full gap-1.5"
                        onClick={() => {
                          const id = (patient as any).id;
                          const url = id ? `/painel-clinico?patientId=${id}` : "/painel-clinico";
                          onOpenChange(false);
                          navigate(url);
                        }}
                      >
                        <Stethoscope className="h-4 w-4" />
                        Ir para o Painel Clínico agora
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>

                    <details className="rounded-md border border-muted-foreground/20 p-2.5">
                      <summary className="text-[11px] font-semibold text-muted-foreground cursor-pointer select-none">
                        Liberar mesmo assim (caminho excepcional — só em emergência operacional)
                      </summary>
                      <ul className="list-disc pl-4 mt-2 space-y-1 text-muted-foreground text-[11px]">
                        <li>O <strong>prontuário é preservado</strong> — nada é apagado.</li>
                        <li>Movimento registrado como <strong>LIBERAÇÃO ADMINISTRATIVA EXCEPCIONAL</strong>, com autor, horário e justificativa imutável.</li>
                        <li>Obrigatório <strong>descrever a justificativa</strong> (mín. 10 caracteres) e <strong>confirmar com sua senha</strong>.</li>
                        <li>Use somente quando a sinalização não pôde ser concluída (documento de alta não assinado, situação crítica) — depois complete o registro pelo Painel.</li>
                      </ul>
                    </details>
                  </>
                ) : isPostDischarge ? (
                  <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                    <li>O documento de <strong>{patient.admissionStatus === "obito" ? "óbito" : "alta"}</strong> já foi <strong>assinado e gravado</strong> no prontuário.</li>
                    <li>Esta ação <strong>libera fisicamente o leito</strong> no mapa para limpeza/nova alocação.</li>
                    <li>O <strong>prontuário do paciente é preservado</strong> e segue consultável no histórico.</li>
                    <li>Você precisará <strong>confirmar com sua senha</strong> antes da liberação efetiva.</li>
                  </ul>
                ) : (
                  <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                    <li>O <strong>prontuário do paciente é preservado</strong> (nada é apagado).</li>
                    <li>O <strong>leito volta a ficar vago</strong> e disponível para nova alocação.</li>
                    <li>A ação é <strong>auditada</strong> em Movimentações com motivo, autor e horário.</li>
                    <li>Use somente para pacientes que <strong>ainda não concluíram a admissão</strong> (evasão, alocação indevida, redirecionamento, etc.).</li>
                    <li>Você precisará <strong>confirmar com sua senha</strong> antes da liberação efetiva.</li>
                  </ul>
                )}
                {!isExceptional && (
                  <p className="pt-1 text-muted-foreground">
                    Na próxima etapa você deverá <strong>selecionar o motivo</strong> e revisar os detalhes antes de confirmar.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isExceptional ? "Fechar" : "Cancelar"}</AlertDialogCancel>
            {!blockReleaseHard && (
              <Button
                type="button"
                variant={isExceptional ? "outline" : "default"}
                onClick={goToFormStep}
              >
                {isExceptional ? "Prosseguir como excepcional" : "Entendi, continuar"}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ETAPA 2: Formulário detalhado com motivo + consequências */}
      <MovementConfirmDialog
        open={open && step === "form"}
      onOpenChange={(v) => (!submitting ? onOpenChange(v) : undefined)}
      onConfirm={goToPasswordStep}
      isSubmitting={submitting}
      title={
        isExceptional
          ? "Desalocação excepcional do leito"
          : patient?.admissionStatus === "transferencia_interna_pendente"
            ? "Desalocar leito — transferência interna sinalizada"
            : patient?.admissionStatus === "transferencia_externa_pendente"
              ? "Desalocar leito — transferência externa sinalizada"
              : isPostDischarge ? "Desalocar leito após alta/óbito" : "Desalocar leito (pré-admissão)"
      }
      description={
        isExceptional
          ? "Paciente admitido sem sinalização de alta/óbito/transferência. Justifique o motivo da desalocação administrativa — ficará no histórico imutável."
          : patient?.admissionStatus === "transferencia_interna_pendente"
            ? "A transferência interna já foi sinalizada no Painel Clínico. Esta etapa libera fisicamente o leito para concluir o movimento do paciente."
            : isPostDischarge
              ? "O documento clínico já foi registrado — esta etapa apenas libera o leito no mapa."
              : "O paciente ainda não concluiu a admissão hospitalar — você pode desocupar o leito sem apagar o prontuário."
      }
      tone="warning"
      confirmLabel="Avançar para senha"
      cancelLabel="Voltar"
      summary={[
        { icon: UserMinus, label: "Paciente", value: patient.name || "—" },
        { icon: Bed, label: "Leito atual", value: patient.bedNumber || "—" },
        { icon: Stethoscope, label: "Setor", value: (patient as any).department || sectorLabelFromCode(patient.sector) || "—" },
        {
          icon: ClipboardList,
          label: "Status atual",
          value:
            patient.admissionStatus === "admitido" ? "Admitido (sem sinalização)"
            : patient.admissionStatus === "alta_dada" ? "Alta sinalizada — aguardando desalocação"
            : patient.admissionStatus === "obito" ? "Óbito sinalizado — aguardando desalocação"
            : patient.admissionStatus === "transferencia_externa_pendente" ? "Transf. externa sinalizada — aguardando desalocação"
            : patient.admissionStatus === "transferencia_interna_pendente" ? "Transf. interna sinalizada — aguardando desalocação"
            : "Pré-admitido",
        },
        { icon: FileText, label: "Motivo selecionado", value: reasonLabel, fullWidth: true },
      ]}
      blockers={blockers}
      warnings={warnings}
      consequences={[
        { icon: Bed, text: <><strong>O leito volta para vago</strong> no mapa, disponível para nova alocação imediatamente.</> },
        { icon: UserCheck, text: <>O <strong>prontuário do paciente é preservado</strong> — nada do que foi cadastrado na recepção/triagem é apagado.</> },
        { icon: FileText, text: <>A ação é <strong>auditada em Movimentações</strong> com motivo, autor, snapshot do leito e <strong>autenticação por senha</strong>.</> },
        { icon: Info, text: isPostDischarge
            ? <>Esta liberação é o <strong>passo final</strong> do fluxo Alta/Óbito → liberação censitária.</>
            : <>Esta ação <strong>não substitui</strong> a alta médica. Pacientes já admitidos só podem deixar o leito pelo fluxo Alta Médica → Alta Administrativa.</> },
      ]}
      finalNote={
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold mb-2 block">Motivo da liberação</Label>
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-1.5">
              {REASON_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-start gap-2">
                  <RadioGroupItem value={opt.value} id={`release-reason-${opt.value}`} className="mt-0.5" />
                  <Label htmlFor={`release-reason-${opt.value}`} className="text-xs font-normal cursor-pointer leading-snug">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">
              Observação {reason === "outro" ? <span className="text-destructive">(obrigatória)</span> : <span className="text-muted-foreground font-normal">(opcional)</span>}
            </Label>
            <Textarea
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder="Descreva brevemente o que aconteceu — visível na auditoria."
              rows={2}
              className="text-xs"
            />
          </div>
        </div>
      }
      />

      {/* ETAPA 3: Confirmação por SENHA do médico */}
      <PasswordConfirmDialog
        open={open && step === "password"}
        onOpenChange={(o) => {
          if (!o && !submitting) {
            setStep("form");
          }
        }}
        title="Confirmar liberação do leito"
        description={`Digite sua senha para liberar o leito ${patient.bedNumber || ""} ocupado por ${patient.name || "este paciente"}. A ação será registrada com seu usuário.`}
        actionLabel="Liberar leito"
        onConfirmed={handleConfirm}
      />
    </>
  );
}
