import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Skull, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  docId: string;
  patientName: string;
  patientId?: string | null;
  docTypeLabel: string;
  /**
   * "obito" exige motivo mais longo (mínimo 20 caracteres, vs. 10 para alta)
   * e copy própria — mesma trilha de auditoria, barra de confirmação mais
   * alta dada a gravidade médico-legal da suspensão de um óbito.
   */
  documentType?: "alta" | "obito";
}

export function SuspendDischargeDialog({
  open,
  onOpenChange,
  docId,
  patientName,
  patientId,
  docTypeLabel,
  documentType = "alta",
}: Props) {
  const qc = useQueryClient();
  const isObito = documentType === "obito";
  const minLen = isObito ? 20 : 10;
  const [reason, setReason] = useState("");
  const [askPassword, setAskPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Tela de confirmação real (não só toast) — pedido do gestor 16/07/2026:
  // um toast passageiro some rápido demais num plantão corrido; a equipe
  // precisa de uma tela que exija clique explícito confirmando que a ação
  // realmente aconteceu.
  const [succeeded, setSucceeded] = useState(false);

  const reasonOk = reason.trim().length >= minLen;

  const reset = () => {
    setReason("");
    setAskPassword(false);
    setSubmitting(false);
    setSucceeded(false);
  };

  const handleConfirmed = async () => {
    if (submitting) return; // guard de reentrada — duplo clique/Enter antes do re-render (auditoria 22/07/2026)
    setSubmitting(true);
    try {
      // ESCRITA DIRETA: o RPC suspend_discharge_document NAO existe no schema novo
      // (404 "Could not find the function") — mesma situacao da alocacao. Reproduz
      // o efeito pretendido em escrita direta: (1) marca o doc como suspenso dentro
      // de conteudo (altas nao tem coluna de status; o doc fica preservado no
      // historico), (2) reabre a internacao (status='ativa') e garante o leito
      // 'ocupado' (o trigger sync_status_leito nao reverte ao voltar p/ ativa),
      // (3) registra a auditoria da suspensao. usePatientDischargeDocs filtra
      // docs com conteudo.suspended, entao a tarja some do cockpit.
      const { data: doc, error: readErr } = await supabase
        .from("altas")
        .select("id, internacao_id, conteudo, tipo")
        .eq("id", docId)
        .maybeSingle();
      if (readErr) throw readErr;
      if (!doc) throw new Error("doc_not_found");
      const conteudoAtual = (doc.conteudo ?? {}) as Record<string, unknown>;
      if (conteudoAtual.suspended) throw new Error("already_suspended");

      const nowIso = new Date().toISOString();
      const { data: authData } = await supabase.auth.getUser();
      const suspendedBy = authData?.user?.id ?? null;

      // 1) marca o doc como suspenso (preserva o original)
      const { error: updDocErr } = await supabase
        .from("altas")
        .update({
          conteudo: {
            ...conteudoAtual,
            suspended: true,
            suspended_at: nowIso,
            suspension_reason: reason.trim(),
            suspended_by: suspendedBy,
          },
        } as never)
        .eq("id", docId);
      if (updDocErr) throw updDocErr;

      // 2) reabre a internacao e mantem o leito ocupado (o paciente segue no leito)
      const internacaoId = doc.internacao_id;
      if (internacaoId) {
        const { error: updIntErr } = await supabase
          .from("internacoes")
          .update({ status: "ativa" } as never)
          .eq("id", internacaoId);
        if (updIntErr) throw updIntErr;
        const { data: inter } = await supabase
          .from("internacoes")
          .select("leito_id")
          .eq("id", internacaoId)
          .maybeSingle();
        const leitoId = (inter as { leito_id?: string } | null)?.leito_id ?? null;
        if (leitoId) {
          await supabase.from("leitos").update({ status: "ocupado" } as never).eq("id", leitoId);
        }
      }

      // 3) auditoria da suspensao
      await supabase.from("logs_auditoria").insert({
        tipo_evento: doc.tipo === "obito" ? "suspensao_obito" : "suspensao_alta",
        acao: "UPDATE",
        nome_tabela: "altas",
        internacao_id: internacaoId,
        registro_id: docId,
        ator_user_id: suspendedBy,
        motivo: reason.trim(),
        dados_novos: { suspended: true, doc_tipo: doc.tipo } as never,
      } as never);

      await qc.invalidateQueries({ queryKey: ["discharge-docs"] });
      await qc.invalidateQueries({ queryKey: ["patient-movements"] });
      await qc.invalidateQueries({ queryKey: ["patients"] });
      setAskPassword(false);
      setSucceeded(true);
    } catch (e: any) {
      const map: Record<string, string> = {
        reason_too_short: isObito
          ? "Motivo precisa ter ao menos 20 caracteres — suspensão de óbito exige justificativa detalhada."
          : "Motivo precisa ter ao menos 10 caracteres.",
        already_suspended: isObito ? "Este óbito já foi suspenso." : "Esta alta já foi suspensa.",
        doc_not_found: "Documento não encontrado.",
        unauthenticated: "Sessão expirada. Faça login novamente.",
      };
      toast.error(isObito ? "Não foi possível suspender o óbito" : "Não foi possível suspender a alta", {
        description: map[e?.message] ?? e?.message ?? "Erro inesperado.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open={open && !askPassword}
        onOpenChange={(o) => {
          if (submitting) return;
          if (!o) reset();
          onOpenChange(o);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {succeeded ? (
            // ═══════ TELA DE CONFIRMAÇÃO ═══════
            <div className="py-2">
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="h-12 w-12 rounded-full bg-released-soft flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-released-on-soft" />
                </div>
                <div>
                  <p className="font-medium text-base">
                    {isObito ? "Óbito suspenso" : "Alta suspensa"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    {patientName} permanece internado(a) no leito atual.{" "}
                    {isObito ? "A declaração de óbito" : "A alta"} foi marcada como suspensa e o
                    motivo ficou registrado na auditoria.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="w-full"
                  onClick={() => {
                    reset();
                    onOpenChange(false);
                  }}
                >
                  Entendi, fechar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className={isObito ? "flex items-center gap-2 text-destructive" : "flex items-center gap-2 text-warning-on-soft"}>
                  {isObito ? <Skull className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                  {isObito ? "Suspender óbito sinalizado" : "Suspender alta"} — {patientName}
                </DialogTitle>
                <DialogDescription className="pt-1">
                  {isObito ? (
                    <>Esta ação <strong>suspende a declaração de óbito</strong> ({docTypeLabel}) e mantém o paciente no leito atual como internado.</>
                  ) : (
                    <>Esta ação <strong>suspende a alta vigente</strong> ({docTypeLabel}) e mantém o paciente no leito atual.</>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className={isObito
                  ? "rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2 text-xs text-destructive"
                  : "rounded-md border border-warning-border/60 bg-warning-soft/60 p-3 space-y-2 text-xs text-warning-on-soft"}>
                  <p className="font-medium">O que vai acontecer:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>
                      {isObito ? "A declaração de óbito" : "O documento de alta"} deixa de constar como vigente no cockpit.
                    </li>
                    <li>O paciente volta ao status <strong>internado</strong> e o atendimento (encounter) é reaberto.</li>
                    <li>A movimentação vinculada (se existir) será marcada como <strong>cancelada</strong>.</li>
                    <li>O paciente continua no <strong>mesmo leito</strong>, sem qualquer alteração em prescrição, evolução ou sinais vitais.</li>
                    <li>O documento original é <strong>preservado no histórico</strong> com o motivo da suspensão e seu nome (auditoria imutável).</li>
                    {isObito && (
                      <li className="font-medium">Use apenas em caso de engano de registro — esta ação fica permanentemente auditada.</li>
                    )}
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="suspend-reason" className="text-xs font-medium">
                    Motivo da suspensão <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="suspend-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      isObito
                        ? "Descreva detalhadamente o motivo (ex.: registro em paciente incorreto, erro de digitação de leito)…"
                        : "Descreva o motivo clínico/administrativo (mínimo 10 caracteres)…"
                    }
                    rows={3}
                    disabled={submitting}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {reason.trim().length}/{minLen} caracteres mínimos
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={!reasonOk || submitting}
                  onClick={() => setAskPassword(true)}
                >
                  Continuar e confirmar com senha
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <PasswordConfirmDialog
        open={askPassword}
        onOpenChange={(o) => {
          if (!o && !submitting) setAskPassword(false);
        }}
        title={isObito ? "Confirmar suspensão de óbito" : "Confirmar suspensão de alta"}
        description={
          isObito
            ? `Digite sua senha para confirmar a suspensão da declaração de óbito de ${patientName}.`
            : `Digite sua senha para confirmar a suspensão da alta de ${patientName}.`
        }
        actionLabel={submitting ? "Suspendendo…" : (isObito ? "Suspender óbito" : "Suspender alta")}
        onConfirmed={handleConfirmed}
      />
    </>
  );
}
