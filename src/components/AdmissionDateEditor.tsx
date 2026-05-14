import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, History, CalendarClock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdmissionDateEditorProps {
  patientId?: string;
  /** ISO string OR raw "DD/MM/AAAA HH:MM" string already stored */
  value: string;
  onChange: (newValue: string) => void;
}

interface HistoryRow {
  id: string;
  old_value: string | null;
  new_value: string;
  changed_by_name: string | null;
  changed_at: string;
  reason: string | null;
}

// Format BR (no timezone conversion — display the literal stored value)
function formatBR(value: string): string {
  if (!value) return "—";
  // Already BR formatted?
  if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) return value.toUpperCase();
  // Try parsing ISO
  const d = new Date(value);
  if (isNaN(d.getTime())) return value.toUpperCase();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function brToISO(date: string, time: string): string {
  const [dd, mm, yyyy] = date.split("/");
  if (!dd || !mm || !yyyy) return "";
  const [hh = "00", mi = "00"] = (time || "").split(":");
  // Store as ISO local (no timezone shift)
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${mi.padStart(2, "0")}:00`;
}

function splitBR(value: string): { date: string; time: string } {
  const formatted = formatBR(value);
  const [date = "", time = ""] = formatted.split(" ");
  return { date, time };
}

export function AdmissionDateEditor({ patientId, value, onChange }: AdmissionDateEditorProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const display = formatBR(value);

  const handleStartEdit = () => setConfirmOpen(true);

  const handleConfirmEdit = () => {
    const { date, time } = splitBR(value);
    setEditDate(date);
    setEditTime(time);
    setReason("");
    setConfirmOpen(false);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      toast.error("Data inválida. Use o formato DD/MM/AAAA");
      return;
    }
    if (editTime && !editTime.match(/^\d{2}:\d{2}$/)) {
      toast.error("Hora inválida. Use o formato HH:MM");
      return;
    }

    // Validação: parse DD/MM/AAAA + HH:MM e bloqueia data/hora futura
    const [dd, mm, yyyy] = editDate.split("/").map((n) => parseInt(n, 10));
    const [hh = 0, mi = 0] = (editTime || "00:00").split(":").map((n) => parseInt(n, 10));
    const candidate = new Date(yyyy, (mm || 1) - 1, dd || 1, hh, mi, 0, 0);
    if (
      isNaN(candidate.getTime()) ||
      candidate.getDate() !== dd ||
      candidate.getMonth() !== (mm || 1) - 1 ||
      candidate.getFullYear() !== yyyy
    ) {
      toast.error("Data inválida. Verifique dia, mês e ano.");
      return;
    }
    if (candidate.getTime() > Date.now()) {
      toast.error("Não é permitido informar data/hora de admissão futura.");
      return;
    }

    const newValueDisplay = `${editDate}${editTime ? " " + editTime : ""}`;
    const newValueISO = brToISO(editDate, editTime);

    // Persist history
    if (patientId) {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        let displayName: string | null = user?.email ?? null;
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .maybeSingle();
          if (profile?.full_name) displayName = profile.full_name;
        }
        const oldParts = splitBR(value);
        const oldISO = value ? brToISO(oldParts.date, oldParts.time) || null : null;

        await supabase.from("patient_admission_date_history").insert({
          patient_id: patientId,
          old_value: oldISO,
          new_value: newValueISO,
          changed_by: user?.id ?? null,
          changed_by_name: displayName,
          reason: reason || null,
        });

        // Caminho ÚNICO de mutação de admission_date (auditado).
        // Sincroniza os 3 campos para manter a data efetiva consistente
        // em mapa de leitos, cockpit, evolução e prescrição:
        //   admission_date     — campo livre (cadastro)
        //   admitted_at        — D0 oficial (timestamp da admissão validada)
        //   uti_admission_date — admissão no setor (espelhada ao D0)
        const { error: updateErr } = await supabase
          .from("patients")
          .update({
            admission_date: newValueISO,
            admitted_at: newValueISO,
            uti_admission_date: newValueISO,
          })
          .eq("id", patientId);
        if (updateErr) {
          console.error("[AdmissionDateEditor] patient update failed", updateErr);
          toast.error("Erro ao salvar data de admissão");
          return;
        }
      } catch (err) {
        console.error("[AdmissionDateEditor] history insert failed", err);
        toast.error("Erro ao registrar histórico");
        return;
      }
    }

    onChange(newValueDisplay);
    setEditOpen(false);
    toast.success("Data de admissão atualizada");
  };

  const loadHistory = async () => {
    if (!patientId) return;
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("patient_admission_date_history")
      .select("*")
      .eq("patient_id", patientId)
      .order("changed_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar histórico");
    } else {
      setHistory((data as HistoryRow[]) || []);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (historyOpen) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyOpen]);

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
          Data de admissão no setor
        </Label>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-9 px-3 rounded-md border bg-muted/40 flex items-center text-xs font-medium uppercase">
            {display}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-2"
            onClick={handleStartEdit}
            title="Editar data"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-2"
            onClick={() => setHistoryOpen(true)}
            disabled={!patientId}
            title="Histórico de edições"
          >
            <History className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground italic">
          Sincronizada automaticamente no momento da alocação. Edição manual requer confirmação.
        </p>
      </div>

      {/* Confirmation popup */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Editar data de admissão?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Esta alteração ficará registrada no histórico. Tem certeza que deseja prosseguir?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Sair
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Não
            </Button>
            <Button size="sm" onClick={handleConfirmEdit}>
              Sim, editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit popup */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Editar data de admissão
            </DialogTitle>
            <DialogDescription className="text-xs">
              Padrão brasileiro DD/MM/AAAA. Hora HH:MM (24h). Sem ajuste de fuso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
              <strong>Padrão Brasileiro:</strong> Dia / Mês / Ano. Ex.: <strong>14/05/2026</strong> = 14 de MAIO de 2026.
              Os campos só aceitam números — as barras são inseridas automaticamente.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Data (DD/MM/AAAA)</Label>
                <Input
                  value={editDate}
                  onChange={(e) => {
                    // Mantém apenas dígitos e insere barras nas posições 2 e 4
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                    let masked = digits;
                    if (digits.length > 4) masked = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                    else if (digits.length > 2) masked = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                    setEditDate(masked);
                  }}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  inputMode="numeric"
                  pattern="\d{2}/\d{2}/\d{4}"
                  className="h-9 text-xs uppercase tabular-nums tracking-wider"
                />
                <p className="text-[10px] text-muted-foreground">Dia · Mês · Ano</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Hora (HH:MM 24h)</Label>
                <Input
                  value={editTime}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                    let masked = digits;
                    if (digits.length > 2) masked = `${digits.slice(0, 2)}:${digits.slice(2)}`;
                    setEditTime(masked);
                  }}
                  placeholder="HH:MM"
                  maxLength={5}
                  inputMode="numeric"
                  pattern="\d{2}:\d{2}"
                  className="h-9 text-xs uppercase tabular-nums tracking-wider"
                />
                <p className="text-[10px] text-muted-foreground">Hora · Minuto (24h)</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Motivo (opcional)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: ajuste retroativo conforme prontuário físico"
                className="h-9 text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>
              Sair
            </Button>
            <Button size="sm" onClick={handleSaveEdit}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History popup */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Histórico de edições
            </DialogTitle>
            <DialogDescription className="text-xs">
              Todas as alterações manuais da data de admissão neste prontuário.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {loadingHistory && (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
            )}
            {!loadingHistory && history.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4 italic">
                Nenhuma edição manual registrada.
              </p>
            )}
            {!loadingHistory &&
              history.map((h) => (
                <div key={h.id} className="text-xs border rounded-md p-2 bg-muted/30 space-y-1">
                  <div className="flex justify-between items-center font-semibold">
                    <span className="uppercase">{h.changed_by_name || "—"}</span>
                    <span className="text-muted-foreground">{formatBR(h.changed_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-muted-foreground line-through">
                      {h.old_value ? formatBR(h.old_value) : "—"}
                    </span>
                    <span>→</span>
                    <span className="font-medium">{formatBR(h.new_value)}</span>
                  </div>
                  {h.reason && (
                    <p className="text-[10px] italic text-muted-foreground">Motivo: {h.reason}</p>
                  )}
                </div>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
