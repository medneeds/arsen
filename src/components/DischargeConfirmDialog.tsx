import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileText, Printer, Eye, ShieldCheck, Info, Loader2, Clock, User, Stethoscope, Bed, FileSignature, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DischargeDocType, DischargeDocPayload } from "@/lib/dischargeDocuments";

export interface DischargeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  docType: DischargeDocType;
  payload: DischargeDocPayload | null;
  patient: { name: string; bedNumber?: string; sector?: string } | null;
  responsibleDoctor: string;
  movementLabel: string;
  destination?: string;
  notes?: string;
  blockingMissing: { label: string; reason: string }[]; // required missing → bloqueia
  softMissing: { label: string }[]; // opcional vazio → aviso amigável
}

const DOC_LABEL: Record<DischargeDocType, string> = {
  alta_hospitalar: "Sumário de Alta Hospitalar",
  alta_pedido: "Alta a Pedido",
  obito: "Relatório de Óbito",
};

export function DischargeConfirmDialog({
  open, onOpenChange, onConfirm, isSubmitting, docType, payload, patient,
  responsibleDoctor, movementLabel, destination, notes, blockingMissing, softMissing,
}: DischargeConfirmDialogProps) {
  const isDeath = docType === "obito";
  const isBlocked = blockingMissing.length > 0;

  const dateStr = (() => {
    const v = isDeath ? payload?.death_date_time : payload?.discharge_date;
    if (!v) return "—";
    try { return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
    catch { return v; }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[92vh]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center",
              isDeath ? "bg-destructive/10" : "bg-primary/10"
            )}>
              <ShieldCheck className={cn("h-5 w-5", isDeath ? "text-destructive" : "text-primary")} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base">
                Confirmar registro de {movementLabel}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Revise atentamente os dados e o que acontecerá no sistema antes de confirmar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Resumo dos dados */}
          <section className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
              <FileText className="h-3 w-3" /> Resumo do registro
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <SummaryRow icon={User} label="Paciente" value={patient?.name || "—"} />
              <SummaryRow icon={Bed} label="Leito / Setor" value={`${patient?.bedNumber || "—"} • ${patient?.sector || "—"}`} />
              <SummaryRow icon={FileSignature} label="Documento" value={DOC_LABEL[docType]} />
              <SummaryRow icon={Clock} label={isDeath ? "Óbito em" : "Alta em"} value={dateStr} />
              <SummaryRow icon={Stethoscope} label="Médico responsável" value={responsibleDoctor || payload?.signed_by_name || "—"} />
              <SummaryRow icon={FileText} label="CRM" value={payload?.signed_by_crm || "—"} />
              {destination && <SummaryRow icon={Mail} label="Destino" value={destination} />}
              {notes && <SummaryRow icon={Info} label="Observações" value={notes} className="col-span-2" />}
            </dl>
          </section>

          {/* Bloqueio por campos obrigatórios */}
          {isBlocked && (
            <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> Pendências obrigatórias bloqueando o registro
              </div>
              <ul className="space-y-1 text-xs text-destructive">
                {blockingMissing.map((m, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-1 h-1 w-1 rounded-full bg-destructive shrink-0" />
                    <span><strong className="font-semibold">{m.label}</strong> — {m.reason}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] uppercase tracking-wider text-destructive/80 pt-1">
                Volte ao formulário, preencha os itens acima e tente novamente.
              </p>
            </section>
          )}

          {/* Avisos suaves (opcionais não preenchidos) */}
          {!isBlocked && softMissing.length > 0 && (
            <section className="rounded-lg border border-warning/40 bg-warning/5 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-warning">
                <Info className="h-3.5 w-3.5" /> Campos opcionais não preenchidos
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Os itens abaixo <strong>não impedem</strong> o registro, mas são úteis para auditoria e comunicação:
              </p>
              <ul className="text-[11px] text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-0.5 pl-1">
                {softMissing.map((m, i) => (
                  <li key={i}>• {m.label}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Explicação didática do que acontece */}
          <section className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-primary">
              <Info className="h-3.5 w-3.5" /> O que acontece quando você confirmar
            </div>
            <ol className="space-y-1.5 text-xs text-foreground/85 leading-relaxed">
              <Step n={1} icon={FileSignature}>
                O <strong>{DOC_LABEL[docType]}</strong> será <strong>assinado eletronicamente</strong> com seu nome, CRM e data/hora atuais, e gravado de forma <strong>imutável</strong> no prontuário do paciente.
              </Step>
              <Step n={2} icon={FileText}>
                A movimentação <strong>"{movementLabel}"</strong> será registrada na <strong>linha do tempo do paciente</strong> e na auditoria do hospital, com seu usuário como responsável.
              </Step>
              <Step n={3} icon={Printer}>
                Uma <strong>pré-visualização do PDF</strong> (padrão Norma Zero, A4) será aberta automaticamente para impressão ou salvamento.
              </Step>
              <Step n={4} icon={Eye}>
                <strong>O paciente continua visível no sistema.</strong> Esta ação <strong>não remove</strong> o registro do mapa nem do prontuário — ele permanece consultável no histórico, em relatórios e na busca, marcado como <em>{isDeath ? "Óbito registrado" : "Alta registrada"}</em>.
              </Step>
              <Step n={5} icon={ShieldCheck}>
                A liberação efetiva do leito e a baixa censitária ocorrem em <strong>etapa separada</strong>, executada pela equipe de regulação/recepção. Nada é apagado neste momento.
              </Step>
            </ol>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground pt-1 border-t border-primary/20">
              Esta ação é <strong className="text-foreground">reversível apenas via auditoria administrativa</strong>. Confirme apenas se todos os dados estiverem corretos.
            </p>
          </section>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Voltar e revisar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isSubmitting || isBlocked}
            variant={isDeath ? "destructive" : "default"}
            className="gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Registrando..." : `Confirmar ${movementLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({
  icon: Icon, label, value, className,
}: { icon: any; label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex items-start gap-1.5", className)}>
      <Icon className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</dt>
        <dd className="text-xs font-medium truncate" title={value}>{value}</dd>
      </div>
    </div>
  );
}

function Step({ n, icon: Icon, children }: { n: number; icon: any; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold shrink-0 mt-0.5">
        {n}
      </span>
      <div className="flex-1">
        <Icon className="h-3 w-3 inline-block mr-1 text-primary/70 -mt-0.5" />
        {children}
      </div>
    </li>
  );
}
