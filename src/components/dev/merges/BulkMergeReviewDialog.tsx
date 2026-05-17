import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BulkPair {
  group_hash: string;
  rule: string;
  winnerId: string;
  loserId: string;
  winnerLabel: string;
  loserLabel: string;
  predominantMrId: string | null;
}

interface Props {
  open: boolean;
  pairs: BulkPair[];
  onClose: () => void;
  onCompleted: () => void;
}

type ResultItem = { pair: BulkPair; ok: boolean; message?: string };

export function BulkMergeReviewDialog({ open, pairs, onClose, onCompleted }: Props) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ResultItem[]>([]);

  const canRun = reason.trim().length >= 20 && confirmed && !running;

  const execute = async () => {
    setRunning(true);
    setResults([]);
    const batchId = crypto.randomUUID();
    const tally: ResultItem[] = [];
    for (const p of pairs) {
      try {
        const { error } = await (supabase as any).rpc("merge_patient_registries", {
          p_winner_id: p.winnerId,
          p_loser_id: p.loserId,
          p_predominant_medical_record_id: p.predominantMrId,
          p_field_choices: {},
          p_reason: `[lote ${batchId.slice(0, 8)}] ${reason.trim()}`,
        });
        if (error) throw error;
        tally.push({ pair: p, ok: true });
      } catch (e: any) {
        tally.push({ pair: p, ok: false, message: e?.message || "Erro desconhecido" });
      }
      setResults([...tally]);
    }
    setRunning(false);
    const okCount = tally.filter((t) => t.ok).length;
    if (okCount === tally.length) {
      toast.success(`Lote concluído: ${okCount}/${tally.length} mesclagens`);
      setTimeout(() => { onCompleted(); }, 1200);
    } else {
      toast.warning(`Lote parcial: ${okCount}/${tally.length} concluídas. Verifique falhas.`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !running && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="uppercase">Revisar lote de mesclagem · {pairs.length} pares</DialogTitle>
        </DialogHeader>

        <Alert variant="destructive" className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 text-foreground">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Esta ação <b>arquiva permanentemente</b> o cadastro perdedor de cada par. O snapshot completo é preservado em
            <code className="mx-1">patient_merge_audit</code> e consultável aqui mesmo na aba Histórico.
          </AlertDescription>
        </Alert>

        <ScrollArea className="max-h-72 border border-border rounded-md">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card border-b border-border">
              <tr className="text-muted-foreground">
                <th className="text-left p-2">Regra</th>
                <th className="text-left p-2">Vencedor (mantém)</th>
                <th className="text-left p-2">Perdedor (arquiva)</th>
                <th className="text-left p-2 w-20">Status</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p, i) => {
                const res = results.find((r) => r.pair.group_hash === p.group_hash);
                return (
                  <tr key={p.group_hash} className="border-b border-border/40">
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{p.rule}</Badge></td>
                    <td className="p-2 font-mono truncate max-w-[220px]">{p.winnerLabel}</td>
                    <td className="p-2 font-mono truncate max-w-[220px]">{p.loserLabel}</td>
                    <td className="p-2">
                      {running && !res && i === results.length && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {res?.ok && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                      {res && !res.ok && (
                        <span className="flex items-center gap-1 text-destructive" title={res.message}>
                          <XCircle className="h-3.5 w-3.5" /> falha
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Motivo do lote (mínimo 20 caracteres)
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={running}
            placeholder="Ex.: Limpeza de duplicatas geradas por importação em massa do setor X em 14/05/2026, conferidas no painel."
            rows={3}
          />
          <div className="text-[11px] text-muted-foreground">{reason.trim().length} caracteres</div>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox id="bulk-confirm" checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} disabled={running} />
          <label htmlFor="bulk-confirm" className="text-sm">
            Entendo que esta ação é <b>irreversível</b>, será <b>auditada</b> e que cada par usa a sugestão automática
            de vencedor (não há resolução manual de campos divergentes no modo lote).
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={running}>Cancelar</Button>
          <Button onClick={execute} disabled={!canRun}>
            {running ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Executando…</> : `Executar lote (${pairs.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
