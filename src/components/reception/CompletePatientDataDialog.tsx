import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileWarning, UserCheck, Save } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  registryId: string | null;
  /** Callback após salvar para refresh do painel */
  onSaved?: () => void;
}

interface RegistryRow {
  id: string;
  full_name: string;
  cpf: string | null;
  cns: string | null;
  birth_date: string | null;
  phone: string | null;
  mother_name: string | null;
  is_unidentified: boolean;
  unidentified_features: any;
}

/**
 * Drawer-like dialog para complementar pendências de identificação SEM abrir o cadastro completo.
 * Foca nos campos mais críticos (CPF, CNS, DN, Mãe, Telefone) e marca docs_pending=false ao salvar.
 */
export function CompletePatientDataDialog({ open, onOpenChange, registryId, onSaved }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<RegistryRow | null>(null);

  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [cns, setCns] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [motherName, setMotherName] = useState("");
  const [observations, setObservations] = useState("");

  // Carrega dados quando abre
  useEffect(() => {
    if (!open || !registryId) return;
    setLoading(true);
    supabase
      .from("patient_registry")
      .select("id, full_name, cpf, cns, birth_date, phone, mother_name, is_unidentified, unidentified_features")
      .eq("id", registryId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error("Erro ao carregar dados do paciente");
          setLoading(false);
          return;
        }
        const r = data as RegistryRow;
        setRow(r);
        setFullName(r.full_name || "");
        setCpf(r.cpf || "");
        setCns(r.cns || "");
        setBirthDate(r.birth_date || "");
        setPhone(r.phone || "");
        setMotherName(r.mother_name || "");
        setObservations("");
        setLoading(false);
      });
  }, [open, registryId]);

  const handleSave = async () => {
    if (!registryId || !row) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        full_name: fullName.trim().toUpperCase(),
        cpf: cpf.trim() || null,
        cns: cns.trim() || null,
        birth_date: birthDate || null,
        phone: phone.trim() || null,
        mother_name: motherName.trim().toUpperCase() || null,
      };

      // Se forneceu pelo menos 1 documento, marca docs_pending=false
      const providedAnyDoc = Boolean(cpf.trim() || cns.trim() || birthDate);
      const fullNameOk = fullName.trim().split(/\s+/).filter(Boolean).length >= 2;

      const newFeatures = {
        ...(row.unidentified_features || {}),
        documents_pending: providedAnyDoc ? false : Boolean(row.unidentified_features?.documents_pending),
        partial_identification: !fullNameOk,
        completed_at: providedAnyDoc ? new Date().toISOString() : row.unidentified_features?.completed_at || null,
        completed_by: providedAnyDoc ? user?.id : row.unidentified_features?.completed_by || null,
        completion_notes: observations.trim() || row.unidentified_features?.completion_notes || null,
      };
      updates.unidentified_features = newFeatures;

      const { error } = await supabase
        .from("patient_registry")
        .update(updates)
        .eq("id", registryId);
      if (error) throw error;

      toast.success("Dados complementados com sucesso", {
        description: providedAnyDoc ? "Pendência de documentação removida." : "Atualizado.",
      });
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-amber-600" />
            Complementar dados do paciente
          </DialogTitle>
          <DialogDescription>
            Preencha apenas o que conseguir. Ao informar pelo menos 1 documento (CPF, CNS ou Data de Nascimento), a pendência é removida.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : row ? (
          <div className="space-y-3">
            {row.is_unidentified && (
              <Badge variant="outline" className="text-[10px] border-slate-500/40">
                Paciente NI — para promover, use "Identificar paciente" (merge).
              </Badge>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cp-name" className="text-xs">Nome completo</Label>
              <Input
                id="cp-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value.toUpperCase())}
                className="font-medium"
              />
              <p className="text-[10px] text-muted-foreground">
                Mínimo de 2 palavras para considerar identificação completa.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-cpf" className="text-xs">CPF</Label>
                <Input id="cp-cpf" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-cns" className="text-xs">Cartão SUS (CNS)</Label>
                <Input id="cp-cns" placeholder="000 0000 0000 0000" value={cns} onChange={(e) => setCns(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-dn" className="text-xs">Data de nascimento</Label>
                <Input
                  id="cp-dn"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-phone" className="text-xs">Telefone</Label>
                <Input id="cp-phone" placeholder="(99) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-mom" className="text-xs">Nome da mãe</Label>
              <Input id="cp-mom" value={motherName} onChange={(e) => setMotherName(e.target.value.toUpperCase())} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-obs" className="text-xs">Observações desta complementação</Label>
              <Textarea
                id="cp-obs"
                placeholder="Ex.: Acompanhante chegou às 14h com RG e CPF do paciente"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || !row}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar complementação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
