import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, FileText, ArrowRightLeft, LogOut, Printer, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePatientMovements } from "@/hooks/usePatientMovements";
import { usePatientDischargeDocs, type DischargeDocRow } from "@/hooks/usePatientDischargeDocs";
import { printDischargeDocument, DISCHARGE_DOC_SHORT } from "@/lib/dischargeDocuments";
import { DischargeDocInlineView } from "@/components/movimentacao/DischargeDocInlineView";
import { SuspendDischargeDialog } from "@/components/SuspendDischargeDialog";
import type { Patient } from "@/types/patient";

/**
 * Registro do fluxo de sinalizacao — timeline consultavel das movimentacoes
 * (transferencia interna/externa, alta, obito, evasao) e os documentos de
 * desfecho ja validados (sumario de alta / relatorio de obito), persistidos
 * logo abaixo do wizard. So leitura: nao dispara escrita. Ancora tudo em
 * patient.id (=internacao_id), a mesma ancora das escritas do wizard.
 */

// Rotulos amigaveis dos subtipos de movimentacao. O movementType vem de
// dados_novos.movement_type (subtipo original) ou do tipo_evento sem o prefixo
// "movimentacao_"; cobrimos as duas grafias e caimos num prettify generico.
const MOVEMENT_LABELS: Record<string, string> = {
  transferencia_interna: "Transferencia interna",
  sinalizacao_transferencia_interna: "Sinalizacao de transferencia interna",
  transferencia_externa: "Transferencia externa",
  alta_hospitalar: "Alta hospitalar",
  alta_a_pedido: "Alta a pedido",
  alta_pedido: "Alta a pedido",
  obito: "Obito",
  evasao: "Evasao",
};

function movementLabel(raw: string): string {
  if (MOVEMENT_LABELS[raw]) return MOVEMENT_LABELS[raw];
  const cleaned = raw
    .replace(/^sinalizacao_/, "")
    .replace(/^conclusao_/, "")
    .replace(/^cancelamento_/, "");
  if (MOVEMENT_LABELS[cleaned]) return MOVEMENT_LABELS[cleaned];
  const pretty = cleaned.replace(/_/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

function fmt(ts: string | null): string {
  if (!ts) return "";
  try {
    return format(new Date(ts), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR });
  } catch {
    return "";
  }
}

interface Props {
  patient: Patient;
}

export function SignalingFlowRecord({ patient }: Props) {
  const patientId = patient.id;
  // hospitalUnitId nao e mais usado na query (DEGRADADO no schema novo) — null.
  const { movements, loading } = usePatientMovements(patientId, patient.name, null);
  const { data: docs = [] } = usePatientDischargeDocs(patientId, patient.name);
  const [suspendDoc, setSuspendDoc] = useState<DischargeDocRow | null>(null);

  const hasMovements = movements.length > 0;
  const hasDocs = docs.length > 0;

  const emptyAll = useMemo(
    () => !loading && !hasMovements && !hasDocs,
    [loading, hasMovements, hasDocs],
  );

  return (
    <section className="mt-4 rounded-lg border bg-card overflow-hidden">
      <header className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Registro do fluxo
        </h2>
      </header>

      <div className="space-y-4 p-4">
        {/* Documentos de desfecho ja validados — consultaveis */}
        {hasDocs && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Documentos de desfecho
            </p>
            <ul className="space-y-3">
              {docs.map((d) => (
                <li key={d.id} className="rounded-md border bg-muted/30 p-3 space-y-3">
                  {/* Cabecalho do documento: identificacao + acoes (so ver/imprimir
                      e SUSPENDER — sem edicao). */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {DISCHARGE_DOC_SHORT[d.document_type] ?? d.document_type}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          Validado{d.signed_at ? ` em ${fmt(d.signed_at)}` : ""}
                          {d.signed_by_crm ? ` · CRM ${d.signed_by_crm}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => printDischargeDocument(d.document_type, d.content)}>
                        <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-critical-on-soft border-critical-border hover:bg-critical-soft"
                        onClick={() => setSuspendDoc(d)}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" /> Suspender
                      </Button>
                    </div>
                  </div>
                  {/* Campos persistidos, VISIVEIS e READ-ONLY (sem edicao). */}
                  <DischargeDocInlineView type={d.document_type} payload={d.content} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Timeline de movimentacoes / sinalizacoes */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Movimentacoes e sinalizacoes
          </p>
          {loading && !hasMovements ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : hasMovements ? (
            <ol className="space-y-2.5">
              {movements.map((m) => {
                const isExit = /alta|obito|evasao|externa/.test(m.movementType);
                const Icon = isExit ? LogOut : ArrowRightLeft;
                return (
                  <li key={m.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-muted/40">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {movementLabel(m.movementType)}
                        {m.destination ? (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            → {m.destination}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmt(m.createdAt)}
                        {m.notes ? ` · ${m.notes}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhuma movimentacao registrada.
            </p>
          )}
        </div>

        {emptyAll && (
          <p className="text-xs text-muted-foreground">
            Nenhum registro de fluxo para este paciente ainda.
          </p>
        )}
      </div>

      {/* Suspensao (unica acao possivel sobre o documento — sem edicao). */}
      {suspendDoc && (
        <SuspendDischargeDialog
          open={!!suspendDoc}
          onOpenChange={(o) => { if (!o) setSuspendDoc(null); }}
          docId={suspendDoc.id}
          patientName={patient.name}
          patientId={patientId}
          docTypeLabel={DISCHARGE_DOC_SHORT[suspendDoc.document_type] ?? suspendDoc.document_type}
          documentType={suspendDoc.document_type === "obito" ? "obito" : "alta"}
        />
      )}
    </section>
  );
}
