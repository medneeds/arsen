import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, RefreshCw, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Diálogo único de sincronização PIS → patient_registry.
 * Reaproveitado pelo AdmitPatientDialog (no momento de puxar paciente)
 * e pelo EditPatientDialog (banner persistente em Edição Avançada).
 *
 * Não altera schema, não toca em patients/medical_records.
 * Escreve apenas em:
 *  - patient_registry (campos aceitos)
 *  - patient_registry_edit_history (1 linha por campo, source='pis_sync')
 */

export type PisSourceRow = {
  patient_name?: string | null;
  social_name?: string | null;
  mother_name?: string | null;
  birth_date?: string | null;
  sex?: string | null;
  cpf?: string | null;
  cns?: string | null;
  phone?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  medical_record?: string | null;
};

export type RegistryRow = {
  id: string;
  full_name: string | null;
  social_name: string | null;
  mother_name: string | null;
  birth_date: string | null;
  sex: string | null;
  cpf: string | null;
  cns: string | null;
  phone: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  medical_record: string | null;
};

// PIS → patient_registry
const FIELD_MAP: { pisKey: keyof PisSourceRow; regKey: keyof RegistryRow; label: string; upper?: boolean }[] = [
  { pisKey: "patient_name", regKey: "full_name", label: "Nome completo", upper: true },
  { pisKey: "social_name", regKey: "social_name", label: "Nome social", upper: true },
  { pisKey: "cpf", regKey: "cpf", label: "CPF" },
  { pisKey: "cns", regKey: "cns", label: "Cartão SUS (CNS)" },
  { pisKey: "birth_date", regKey: "birth_date", label: "Data de nascimento" },
  { pisKey: "sex", regKey: "sex", label: "Sexo" },
  { pisKey: "mother_name", regKey: "mother_name", label: "Nome da mãe", upper: true },
  { pisKey: "phone", regKey: "phone", label: "Telefone" },
  { pisKey: "address", regKey: "address", label: "Endereço", upper: true },
  { pisKey: "neighborhood", regKey: "neighborhood", label: "Bairro", upper: true },
  { pisKey: "city", regKey: "city", label: "Cidade", upper: true },
  { pisKey: "state", regKey: "state", label: "UF", upper: true },
  { pisKey: "medical_record", regKey: "medical_record", label: "Nº Prontuário PIS" },
];

const norm = (v: any) => (v === null || v === undefined ? "" : String(v).trim());

export type PisDiffField = {
  pisKey: string;
  regKey: string;
  label: string;
  current: string;
  incoming: string;
  upper: boolean;
};

/** Calcula divergências entre registry × PIS. Vazio no PIS NUNCA sobrescreve. */
export function computePisDiff(registry: RegistryRow | null, pis: PisSourceRow | null | undefined): PisDiffField[] {
  if (!pis) return [];
  const out: PisDiffField[] = [];
  for (const m of FIELD_MAP) {
    const incoming = norm(pis[m.pisKey]);
    if (!incoming) continue; // PIS vazio → ignora
    const current = norm(registry ? (registry as any)[m.regKey] : "");
    // Comparação case-insensitive para campos de texto upper
    const eq = m.upper
      ? current.toLocaleUpperCase() === incoming.toLocaleUpperCase()
      : current === incoming;
    if (eq) continue;
    out.push({
      pisKey: m.pisKey as string,
      regKey: m.regKey as string,
      label: m.label,
      current,
      incoming: m.upper ? incoming.toLocaleUpperCase() : incoming,
      upper: !!m.upper,
    });
  }
  return out;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  registryId: string | null;
  patientId?: string | null;
  pisSource: PisSourceRow | null;
  /** Texto curto que vira parte do motivo registrado (ex.: "Puxada da pré-admissão"). */
  contextLabel: string;
  /** Disparado após salvar (ou pular sem salvar). Recebe true se houve gravação. */
  onResolved?: (saved: boolean) => void;
}

export function PisRegistrySyncDialog({
  open, onOpenChange, registryId, patientId, pisSource, contextLabel, onResolved,
}: Props) {
  const { user } = useAuth();
  const [registry, setRegistry] = useState<RegistryRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open || !registryId) {
      setRegistry(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("patient_registry")
        .select("id, full_name, social_name, mother_name, birth_date, sex, cpf, cns, phone, address, neighborhood, city, state, medical_record")
        .eq("id", registryId)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) setRegistry(data as RegistryRow);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, registryId]);

  const diff = useMemo(() => computePisDiff(registry, pisSource), [registry, pisSource]);

  // Default: todos os campos divergentes pré-marcados
  useEffect(() => {
    if (!open) return;
    const init: Record<string, boolean> = {};
    diff.forEach((d) => { init[d.regKey] = true; });
    setAccepted(init);
    setReason(`Sincronização PIS — ${contextLabel}`);
  }, [open, diff.length, contextLabel]);

  const acceptedCount = Object.values(accepted).filter(Boolean).length;

  const handleToggleAll = (val: boolean) => {
    const next: Record<string, boolean> = {};
    diff.forEach((d) => { next[d.regKey] = val; });
    setAccepted(next);
  };

  const handleSave = async () => {
    if (!registryId || !registry) return;
    const toApply = diff.filter((d) => accepted[d.regKey]);
    if (toApply.length === 0) {
      toast({ title: "Nenhum campo selecionado", description: "Marque ao menos 1 campo para sincronizar.", variant: "destructive" });
      return;
    }
    if (!reason.trim() || reason.trim().length < 5) {
      toast({ title: "Informe o motivo", description: "Descreva brevemente o motivo da sincronização (mín. 5 caracteres).", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const updatePayload: Record<string, any> = {};
      for (const d of toApply) updatePayload[d.regKey] = d.incoming;

      const { error: upErr } = await supabase
        .from("patient_registry")
        .update(updatePayload)
        .eq("id", registryId);
      if (upErr) throw upErr;

      // Auditoria: 1 linha por campo
      const histRows = toApply.map((d) => ({
        patient_registry_id: registryId,
        patient_id: patientId ?? null,
        field_changed: d.regKey,
        old_value: d.current || null,
        new_value: d.incoming || null,
        reason: reason.trim(),
        source: "pis_sync",
        changed_by: user?.id ?? null,
        changed_by_email: user?.email ?? null,
      }));
      const { error: histErr } = await supabase
        .from("patient_registry_edit_history" as any)
        .insert(histRows as any);
      if (histErr) console.warn("[pis-sync] histórico falhou:", histErr.message);

      toast({
        title: "✅ Prontuário sincronizado",
        description: `${toApply.length} campo(s) atualizado(s) a partir do PIS.`,
      });
      onResolved?.(true);
      onOpenChange(false);
    } catch (e: any) {
      console.error("[pis-sync] erro:", e);
      toast({ title: "Falha ao sincronizar", description: e.message || "Erro inesperado", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    onResolved?.(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); else onOpenChange(true); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            Sincronizar prontuário com PIS
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Detectamos <strong>{diff.length}</strong> campo(s) divergentes entre o cadastro central
            (prontuário) e os dados do PIS ({contextLabel.toLowerCase()}). Revise cada item e marque
            o que deve ser <strong>sobrescrito no prontuário</strong>. Nada é alterado sem sua
            confirmação. Campos vazios no PIS nunca apagam o prontuário.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando prontuário…
          </div>
        ) : diff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <ShieldCheck className="h-8 w-8 text-emerald-600" />
            <p className="text-sm font-semibold">Prontuário já está 100% sincronizado com o PIS.</p>
            <p className="text-xs text-muted-foreground">Nenhuma ação necessária.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between flex-shrink-0 px-1">
              <Badge variant="outline" className="text-[10px]">
                {acceptedCount}/{diff.length} selecionados
              </Badge>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => handleToggleAll(true)} className="h-7 text-[11px]">
                  Marcar todos
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleToggleAll(false)} className="h-7 text-[11px]">
                  Desmarcar
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 -mx-1 px-1">
              <div className="space-y-2 py-1">
                {diff.map((d) => (
                  <label
                    key={d.regKey}
                    htmlFor={`pis-${d.regKey}`}
                    className="flex items-start gap-3 p-2.5 rounded-md border bg-card hover:bg-muted/40 cursor-pointer"
                  >
                    <Checkbox
                      id={`pis-${d.regKey}`}
                      checked={!!accepted[d.regKey]}
                      onCheckedChange={(v) => setAccepted((prev) => ({ ...prev, [d.regKey]: !!v }))}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {d.label}
                      </p>
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center mt-1 text-xs">
                        <div className="min-w-0">
                          <p className="text-[9px] text-muted-foreground">Atual</p>
                          <p className="truncate font-medium text-rose-700 dark:text-rose-300 line-through decoration-rose-400/50">
                            {d.current || <span className="italic text-muted-foreground no-underline">(vazio)</span>}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[9px] text-muted-foreground">PIS</p>
                          <p className="truncate font-semibold text-emerald-700 dark:text-emerald-300">
                            {d.incoming}
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>

            <div className="space-y-1.5 flex-shrink-0 pt-2 border-t">
              <Label htmlFor="pis-reason" className="text-xs font-semibold">Motivo (auditado)</Label>
              <Textarea
                id="pis-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Ex.: Sincronização PIS — Puxada da pré-admissão"
              />
            </div>
          </>
        )}

        <DialogFooter className="flex-shrink-0 gap-2 pt-2">
          <Button variant="outline" onClick={handleSkip} className="h-9 text-xs" disabled={saving}>
            {diff.length === 0 ? "Fechar" : "Pular sem sincronizar"}
          </Button>
          {diff.length > 0 && (
            <Button onClick={handleSave} disabled={saving || acceptedCount === 0} className="h-9 text-xs gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Confirmar sincronização ({acceptedCount})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
