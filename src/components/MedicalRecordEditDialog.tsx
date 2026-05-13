import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, History, Loader2, Save, AlertTriangle, ShieldCheck } from "lucide-react";
import { MovementConfirmDialog } from "./MovementConfirmDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  patientName: string;
  /** Recarrega dados externos depois que salvar */
  onSaved?: () => void;
}

interface MedicalRecordRow {
  id: string;
  numero_prontuario: string | null;
  numero_prontuario_legado: string | null;
  is_legacy: boolean | null;
  generation_mode: string | null;
}

interface HistoryRow {
  id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  changed_by_email: string | null;
  changed_at: string;
}

const FIELD_LABEL: Record<string, string> = {
  numero_prontuario: "Nº do Prontuário",
  numero_prontuario_legado: "Nº Legado / PIN",
};

export function MedicalRecordEditDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<MedicalRecordRow | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [numero, setNumero] = useState("");
  const [legado, setLegado] = useState("");
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open || !patientId) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patientId]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: rec } = await supabase
        .from("medical_records")
        .select("id, numero_prontuario, numero_prontuario_legado, is_legacy, generation_mode")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rec) {
        setRecord(rec as MedicalRecordRow);
        setNumero(rec.numero_prontuario || "");
        setLegado(rec.numero_prontuario_legado || "");

        const { data: hist } = await supabase
          .from("medical_record_edit_history")
          .select("id, field_changed, old_value, new_value, reason, changed_by_email, changed_at")
          .eq("medical_record_id", rec.id)
          .order("changed_at", { ascending: false })
          .limit(50);
        setHistory((hist as HistoryRow[]) || []);
      } else {
        setRecord(null);
        setHistory([]);
      }
      setReason("");
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao carregar prontuário", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const changes: { field: string; oldVal: string; newVal: string }[] = [];
  if (record) {
    if ((record.numero_prontuario || "") !== numero.trim()) {
      changes.push({ field: "numero_prontuario", oldVal: record.numero_prontuario || "", newVal: numero.trim() });
    }
    if ((record.numero_prontuario_legado || "") !== legado.trim()) {
      changes.push({ field: "numero_prontuario_legado", oldVal: record.numero_prontuario_legado || "", newVal: legado.trim() });
    }
  }
  const hasChanges = changes.length > 0;

  function tryConfirm() {
    if (!hasChanges) {
      toast({ title: "Nenhuma alteração", description: "Modifique algum campo antes de salvar." });
      return;
    }
    if (!reason.trim() || reason.trim().length < 5) {
      toast({
        title: "Motivo obrigatório",
        description: "Justifique a alteração (mínimo 5 caracteres) — esta ação será auditada.",
        variant: "destructive",
      });
      return;
    }
    setConfirmOpen(true);
  }

  async function handleSave() {
    if (!record) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      const userEmail = u?.user?.email;

      const updatePayload: Record<string, any> = {};
      if (changes.find((c) => c.field === "numero_prontuario")) {
        updatePayload.numero_prontuario = numero.trim() || null;
      }
      if (changes.find((c) => c.field === "numero_prontuario_legado")) {
        updatePayload.numero_prontuario_legado = legado.trim() || null;
      }

      const { error: upErr } = await supabase
        .from("medical_records")
        .update(updatePayload)
        .eq("id", record.id);
      if (upErr) throw upErr;

      // Insere histórico (uma linha por campo)
      const histRows = changes.map((c) => ({
        medical_record_id: record.id,
        patient_id: patientId,
        field_changed: c.field,
        old_value: c.oldVal || null,
        new_value: c.newVal || null,
        reason: reason.trim(),
        changed_by: userId,
        changed_by_email: userEmail,
      }));
      const { error: hErr } = await supabase
        .from("medical_record_edit_history")
        .insert(histRows);
      if (hErr) throw hErr;

      toast({
        title: "✅ Prontuário atualizado",
        description: `${changes.length} campo(s) alterado(s) com auditoria registrada.`,
      });
      setConfirmOpen(false);
      await loadData();
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              Editar Dados do Prontuário
            </DialogTitle>
            <DialogDescription className="text-xs">
              Paciente: <strong className="uppercase">{patientName || "—"}</strong>. Toda alteração é auditada e visível no histórico abaixo.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !record ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum prontuário vinculado a este paciente ainda.
            </div>
          ) : (
            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-4">
                <section className="space-y-3 p-3 rounded-lg border bg-card">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Nº do Prontuário</Label>
                      <Input
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        className="h-9 text-xs uppercase"
                        placeholder="AA-UUU-SSSSSS-DV ou número legado"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Nº Legado / PIN</Label>
                      <Input
                        value={legado}
                        onChange={(e) => setLegado(e.target.value)}
                        className="h-9 text-xs uppercase"
                        placeholder="Nº do sistema antigo / código PIN"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    Modo:{" "}
                    <Badge variant="outline" className="text-[10px]">
                      {record.generation_mode || (record.is_legacy ? "manual_legacy" : "auto")}
                    </Badge>
                    {record.is_legacy && <Badge variant="secondary" className="text-[10px]">Legado</Badge>}
                  </div>
                </section>

                <section className="space-y-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Motivo da alteração (obrigatório)
                  </Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="Ex: Importação retroativa do PIN; correção de digitação; vinculação com prontuário legado..."
                    className="text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    A justificativa fica registrada permanentemente na auditoria do prontuário.
                  </p>
                </section>

                <section className="space-y-2 p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                    Histórico de Alterações ({history.length})
                  </div>
                  {history.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">Sem alterações registradas.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {history.map((h) => (
                        <div key={h.id} className="text-[11px] p-2 rounded border bg-background">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px]">
                              {FIELD_LABEL[h.field_changed] || h.field_changed}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(h.changed_at).toLocaleString("pt-BR")}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <span className="text-muted-foreground">De: </span>
                              <code className="px-1 bg-muted rounded">{h.old_value || "—"}</code>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Para: </span>
                              <code className="px-1 bg-muted rounded">{h.new_value || "—"}</code>
                            </div>
                          </div>
                          <p className="text-[10px] mt-1 italic text-foreground/80">
                            "{h.reason}"
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            por {h.changed_by_email || "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </ScrollArea>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={tryConfirm} disabled={!hasChanges || saving} className="gap-1.5">
              <Save className="h-4 w-4" />
              Revisar e salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <MovementConfirmDialog
        open={confirmOpen}
        onOpenChange={(v) => !v && setConfirmOpen(false)}
        title="Alterar dados do prontuário"
        confirmLabel="Confirmar alteração"
        onConfirm={handleSave}
        isSubmitting={saving}
        tone="warning"
        summary={[
          { label: "Paciente", value: patientName || "—", fullWidth: true },
          { label: "Campos a alterar", value: changes.map((c) => FIELD_LABEL[c.field]).join(", ") },
          { label: "Motivo", value: reason.trim(), fullWidth: true },
        ]}
        warnings={changes.map((c) => ({
          label: FIELD_LABEL[c.field],
          detail: `"${c.oldVal || "vazio"}" → "${c.newVal || "vazio"}"`,
        }))}
        consequences={[
          { text: "O número do prontuário será atualizado imediatamente em todo o sistema (mapa de leitos, cockpit, prescrições, exames, evoluções)." },
          { text: "Uma entrada permanente será gravada no histórico de auditoria com seu nome, e-mail, data/hora e motivo informado." },
          { text: "A sincronização é em tempo real — outros usuários verão o novo número automaticamente." },
          { text: "A alteração não pode ser desfeita por edição direta — apenas por nova alteração também auditada." },
        ]}
        finalNote="Esta operação é registrada permanentemente para fins legais e regulatórios (CFM/COREN). Confirme apenas se a justificativa estiver correta."
      />
    </>
  );
}
