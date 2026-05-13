import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileText, Info, Loader2, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MovementConfirmTone = "primary" | "destructive" | "warning";

export interface MovementSummaryItem {
  icon?: LucideIcon;
  label: string;
  value: string;
  fullWidth?: boolean;
}

export interface MovementBlocker {
  label: string;
  reason: string;
}

export interface MovementWarning {
  label: string;
  detail?: string;
}

export interface MovementConsequence {
  icon?: LucideIcon;
  text: ReactNode;
}

export interface MovementConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
  title: string;
  description?: string;
  tone?: MovementConfirmTone;
  /** Resumo dos dados da ação */
  summary: MovementSummaryItem[];
  /** Pendências obrigatórias — bloqueiam confirmar */
  blockers?: MovementBlocker[];
  /** Avisos opcionais — não bloqueiam */
  warnings?: MovementWarning[];
  /** O que vai acontecer no sistema (didático) */
  consequences: MovementConsequence[];
  /** Texto final de aviso reforçado (ex.: "ação reversível somente via auditoria") */
  finalNote?: ReactNode;
  /** Texto do botão principal — default: "Confirmar" */
  confirmLabel?: string;
  /** Texto do botão secundário — default: "Voltar e revisar" */
  cancelLabel?: string;
}

const TONE = {
  primary: { ring: "bg-primary/10", icon: "text-primary", btn: "default" as const },
  destructive: { ring: "bg-destructive/10", icon: "text-destructive", btn: "destructive" as const },
  warning: { ring: "bg-warning/10", icon: "text-warning", btn: "default" as const },
};

/**
 * Pop-up genérico de confirmação para QUALQUER movimentação no sistema
 * (transferência, realocação, permuta, pedido de alocação, alta, óbito).
 *
 * Padrão: resumo dos dados + bloqueios (vermelho) + avisos (amarelo) +
 * passos didáticos do que acontece + botões "Voltar e revisar" / "Confirmar".
 */
export function MovementConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
  title,
  description = "Revise atentamente os dados e o que acontecerá no sistema antes de confirmar.",
  tone = "primary",
  summary,
  blockers = [],
  warnings = [],
  consequences,
  finalNote,
  confirmLabel = "Confirmar",
  cancelLabel = "Voltar e revisar",
}: MovementConfirmDialogProps) {
  const t = TONE[tone];
  const isBlocked = blockers.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[640px] max-h-[92vh]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", t.ring)}>
              <ShieldCheck className={cn("h-5 w-5", t.icon)} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base uppercase">{title}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Resumo dos dados */}
          {summary.length > 0 && (
            <section className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
                <FileText className="h-3 w-3" /> Resumo da ação
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {summary.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={i} className={cn("flex items-start gap-1.5", s.fullWidth && "col-span-2")}>
                      {Icon && <Icon className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.label}</dt>
                        <dd className="text-xs font-medium break-words" title={s.value}>{s.value || "—"}</dd>
                      </div>
                    </div>
                  );
                })}
              </dl>
            </section>
          )}

          {/* Bloqueios (vermelho) */}
          {isBlocked && (
            <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> Pendências obrigatórias bloqueando a ação
              </div>
              <ul className="space-y-1 text-xs text-destructive">
                {blockers.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-1 h-1 w-1 rounded-full bg-destructive shrink-0" />
                    <span><strong className="font-semibold">{b.label}</strong> — {b.reason}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] uppercase tracking-wider text-destructive/80 pt-1">
                Volte ao formulário, preencha os itens acima e tente novamente.
              </p>
            </section>
          )}

          {/* Avisos (amarelo) — só aparecem se não houver bloqueio */}
          {!isBlocked && warnings.length > 0 && (
            <section className="rounded-lg border border-warning/40 bg-warning/5 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-warning">
                <Info className="h-3.5 w-3.5" /> Avisos importantes
              </div>
              <ul className="text-[11px] text-foreground/80 space-y-0.5 pl-1">
                {warnings.map((w, i) => (
                  <li key={i} className="leading-relaxed">
                    • <strong className="font-semibold">{w.label}</strong>
                    {w.detail ? <span className="text-muted-foreground"> — {w.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Consequências (didáticas) */}
          {consequences.length > 0 && (
            <section className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-primary">
                <Info className="h-3.5 w-3.5" /> O que acontece quando você confirmar
              </div>
              <ol className="space-y-1.5 text-xs text-foreground/85 leading-relaxed">
                {consequences.map((c, i) => {
                  const Icon = c.icon;
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        {Icon && <Icon className="h-3 w-3 inline-block mr-1 text-primary/70 -mt-0.5" />}
                        {c.text}
                      </div>
                    </li>
                  );
                })}
              </ol>
              {finalNote && (
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground pt-1 border-t border-primary/20">
                  {finalNote}
                </p>
              )}
            </section>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isSubmitting || isBlocked}
            variant={t.btn}
            className="gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Processando..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
