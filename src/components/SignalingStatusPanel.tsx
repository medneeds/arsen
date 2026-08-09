import { useState } from "react";
import { ArrowLeftRight, Ban, FileSignature, Pencil, Skull, LogOut, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ADMISSION_STATUS } from "@/lib/admissionStatus";
import { usePatientDischargeDocs } from "@/hooks/usePatientDischargeDocs";
import { printDischargeDocument, DISCHARGE_DOC_SHORT, type DischargeDocType, type DischargeDocPayload } from "@/lib/dischargeDocuments";
import { SuspendDischargeDialog } from "@/components/SuspendDischargeDialog";
import { CancelTransferSignalDialog } from "@/components/CancelTransferSignalDialog";

/**
 * Estado de sinalização do paciente, normalizado.
 *
 * FONTE ÚNICA para o cockpit e para o diálogo de movimentação. Antes o cockpit
 * era o único lugar que sabia explicar o que uma sinalização ativa significa;
 * o diálogo abria sempre no seletor "Transferências / Saídas", como se o
 * paciente não tivesse nada sinalizado. Duas telas contando histórias
 * diferentes sobre o mesmo paciente.
 *
 * Há DUAS naturezas de sinalização, e a diferença importa para o usuário:
 *  - TRANSFERÊNCIA: só muda `patients.admission_status`. Não gera documento
 *    clínico, e o leito continua ocupado até alguém desalocar no Mapa de Leitos.
 *  - SAÍDA (alta/óbito): gera documento clínico em discharge_documents. O
 *    atendimento é encerrado e a liberação do leito passa pelo administrativo.
 */
export type SignalingKind = "transfer" | "death" | "discharge" | null;

export interface SignalingStatus {
  kind: SignalingKind;
  /** Rótulo curto do estado, para título de painel. */
  label: string;
  /** Transferência interna? (só quando kind === "transfer") */
  isInternal?: boolean;
  /** Documento clínico associado (só quando kind é death/discharge). */
  doc?: { id: string; document_type: DischargeDocType; content: DischargeDocPayload };
}

/** Resolve o estado de sinalização a partir do status e dos documentos. */
export function useSignalingStatus(
  patientId: string,
  patientName: string,
  admissionStatus?: string | null,
): SignalingStatus {
  const { data: docs } = usePatientDischargeDocs(patientId, patientName);

  const isTransfer =
    admissionStatus === ADMISSION_STATUS.INTERNAL_TRANSFER_PENDING ||
    admissionStatus === ADMISSION_STATUS.EXTERNAL_TRANSFER_PENDING;

  if (isTransfer) {
    const isInternal = admissionStatus === ADMISSION_STATUS.INTERNAL_TRANSFER_PENDING;
    return {
      kind: "transfer",
      isInternal,
      label: isInternal ? "Transferência interna sinalizada" : "Transferência externa sinalizada",
    };
  }

  // Óbito antes de alta: se ambos existirem, o óbito é o desfecho que vale.
  const obito = docs?.find((d) => d.document_type === ADMISSION_STATUS.DEATH);
  if (obito) return { kind: "death", label: "Óbito sinalizado", doc: obito };

  const alta = docs?.find(
    (d) => d.document_type === "alta_hospitalar" || d.document_type === "alta_pedido",
  );
  if (alta) return { kind: "discharge", label: "Alta sinalizada", doc: alta };

  return { kind: null, label: "Sem sinalização ativa" };
}

const TONE = {
  transfer: {
    box: "border-sky-500/40 bg-sky-50 dark:bg-sky-950/30",
    title: "text-sky-800 dark:text-sky-200",
    body: "text-sky-900/80 dark:text-sky-100/80",
    Icon: ArrowLeftRight,
  },
  death: {
    box: "border-destructive/40 bg-destructive/5",
    title: "text-destructive",
    body: "text-destructive/80",
    Icon: Skull,
  },
  discharge: {
    box: "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30",
    title: "text-emerald-800 dark:text-emerald-200",
    body: "text-emerald-900/80 dark:text-emerald-100/80",
    Icon: LogOut,
  },
} as const;

interface PanelProps {
  status: SignalingStatus;
  patientId: string;
  patientName: string;
  /** Abre o fluxo de sinalização (para trocar destino de uma transferência). */
  onChangeDestination?: () => void;
  /** `compact` = trilho do cockpit; `full` = dentro do diálogo, com mais texto. */
  density?: "compact" | "full";
  className?: string;
}

/**
 * Painel que EXPLICA a sinalização ativa e oferece as ações sobre ela.
 *
 * O texto responde, na ordem, as três perguntas que o usuário faz ao abrir a
 * tela: em que estado o paciente está, o que esse estado provoca, e o que
 * acontece com o leito. Só depois vêm os botões — inclusive o de suspender,
 * que é a razão mais comum de reabrir esta tela.
 */
export function SignalingStatusPanel({
  status,
  patientId,
  patientName,
  onChangeDestination,
  density = "full",
  className,
}: PanelProps) {
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [cancelTransferOpen, setCancelTransferOpen] = useState(false);

  if (!status.kind) return null;
  const tone = TONE[status.kind];
  const full = density === "full";

  return (
    <div className={cn("w-full rounded-lg border p-3 space-y-2.5", tone.box, className)}>
      <div className={cn("flex items-center gap-1.5 font-semibold uppercase tracking-wide", tone.title, full ? "text-xs" : "text-[11px]")}>
        <tone.Icon className="h-3.5 w-3.5 shrink-0" />
        {status.label}
      </div>

      {/* O que este estado significa, e o que acontece com o leito. */}
      <div className={cn("space-y-1.5 leading-snug", tone.body, full ? "text-[12px]" : "text-[11px]")}>
        {status.kind === "transfer" && (
          <>
            <p>
              A sinalização está <strong>ativa</strong> e visível para o setor. O atendimento
              continua aberto e o paciente <strong>segue ocupando o leito</strong>.
            </p>
            <p className="flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-px shrink-0 opacity-70" />
              <span>
                A <strong>desalocação física</strong> do leito é feita no{" "}
                <strong>Mapa de Leitos</strong>, no botão "Desalocar leito" — sinalizar aqui
                não libera o leito sozinho.
              </span>
            </p>
          </>
        )}

        {status.kind === "death" && (
          <>
            <p>
              O óbito foi sinalizado e o <strong>relatório já foi gerado</strong>. O
              atendimento está encerrado.
            </p>
            {full && (
              <p className="flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-px shrink-0 opacity-70" />
                <span>
                  A liberação do leito é feita pelo <strong>setor administrativo</strong>.
                  Suspender reabre o atendimento e desfaz o desfecho.
                </span>
              </p>
            )}
          </>
        )}

        {status.kind === "discharge" && (
          <>
            <p>
              A alta foi sinalizada e o <strong>documento já foi gerado</strong>. O
              atendimento está encerrado.
            </p>
            {full && (
              <p className="flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-px shrink-0 opacity-70" />
                <span>
                  A liberação do leito é feita pelo <strong>setor administrativo</strong>.
                  Suspender reabre o atendimento e desfaz o desfecho.
                </span>
              </p>
            )}
          </>
        )}
      </div>

      {/* Ações. Suspender fica sempre à direita, em âmbar, em todos os estados —
          é a mesma ação conceitual, e posição fixa evita clique por engano. */}
      <div className="grid grid-cols-2 gap-1.5">
        {status.kind === "transfer" ? (
          <Button
            size="sm" variant="outline"
            className="h-8 text-[11px] gap-1.5 border-sky-500/50 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10"
            onClick={onChangeDestination}
            disabled={!onChangeDestination}
          >
            <Pencil className="h-3 w-3" /> Alterar destino
          </Button>
        ) : (
          <Button
            size="sm" variant="outline"
            className={cn(
              "h-8 text-[11px] gap-1.5",
              status.kind === "death"
                ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                : "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10",
            )}
            onClick={() => status.doc && printDischargeDocument(status.doc.document_type, status.doc.content)}
          >
            {status.kind === "death"
              ? <><Skull className="h-3 w-3" /> Ver relatório</>
              : <><FileSignature className="h-3 w-3" /> Ver alta ({status.doc ? DISCHARGE_DOC_SHORT[status.doc.document_type] : "doc"})</>}
          </Button>
        )}

        <Button
          size="sm" variant="outline"
          className="h-8 text-[11px] gap-1.5 border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
          onClick={() => (status.kind === "transfer" ? setCancelTransferOpen(true) : setSuspendOpen(true))}
        >
          <Ban className="h-3 w-3" />
          {status.kind === "transfer" ? "Suspender sinalização" : status.kind === "death" ? "Suspender óbito" : "Suspender alta"}
        </Button>
      </div>

      {status.kind === "transfer" && (
        <CancelTransferSignalDialog
          open={cancelTransferOpen}
          onOpenChange={setCancelTransferOpen}
          patientId={patientId}
          patientName={patientName}
          transferKind={status.isInternal ? "interna" : "externa"}
        />
      )}
      {status.doc && (
        <SuspendDischargeDialog
          open={suspendOpen}
          onOpenChange={setSuspendOpen}
          docId={status.doc.id}
          patientId={patientId}
          patientName={patientName}
          docTypeLabel={status.kind === "death" ? "Relatório de óbito" : DISCHARGE_DOC_SHORT[status.doc.document_type] ?? "Alta"}
          documentType={status.kind === "death" ? "obito" : "alta"}
        />
      )}
    </div>
  );
}
