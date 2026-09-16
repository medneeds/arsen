import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toSexoDb } from "@/lib/sexo";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCheck, AlertTriangle, ArrowRight, UserX } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Registry NI a ser promovido a identificado */
  niRegistryId: string | null;
  niCode?: string | null;
  niName?: string | null;
  onPromoted?: () => void;
}

/**
 * Promove um paciente NI (Não Identificado) → identificado:
 * - Atualiza o MESMO paciente com nome real, CPF/CNS/DN
 * - Mantém vínculo com internações existentes (não duplica)
 * - Registra a identificação em logs_auditoria (tipo_evento='promocao_ni')
 *
 * Diferente de "merge" (que une 2 pacientes diferentes), este fluxo apenas COMPLEMENTA o NI existente.
 *
 * MIGRAÇÃO: `patient_registry`→`pacientes`. Não há mais coluna `is_unidentified`/
 * `unidentified_features`/`unidentified_code`: o estado "NI" passa a ser DERIVADO do
 * nome (heurística detectUnidentified). Ao gravar o nome real, o paciente deixa de ser
 * detectado como NI — a "promoção" é implícita. `patient_merge_audit`→`logs_auditoria`.
 */
export function PromoteNiDialog({ open, onOpenChange, niRegistryId, niCode, niName, onPromoted }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [cns, setCns] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [motherName, setMotherName] = useState("");
  const [phone, setPhone] = useState("");
  const [sex, setSex] = useState<"M" | "F" | "I">("I");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !niRegistryId) return;
    setLoading(true);
    supabase
      .from("pacientes")
      .select("*")
      .eq("id", niRegistryId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSnapshot(data);
          // Pré-preenche com o que já tiver
          setFullName(data.nome_completo?.startsWith("NÃO IDENTIFICADO") ? "" : data.nome_completo || "");
          setCpf(data.cpf || "");
          setCns(data.cns || "");
          setBirthDate(data.data_nascimento || "");
          setMotherName(data.nome_mae || "");
          setPhone(data.telefone || "");
          setSex((data.sexo as any) || "I");
          setNotes("");
        }
        setLoading(false);
      });
  }, [open, niRegistryId]);

  const fullNameOk = fullName.trim().split(/\s+/).filter(Boolean).length >= 2;

  const handlePromote = async () => {
    if (!niRegistryId || !snapshot) return;
    if (!fullNameOk) {
      toast.error("Informe o nome completo (mínimo 2 palavras)");
      return;
    }
    setSaving(true);
    try {
      // 1) Verifica duplicidade por CPF se informado
      // MIGRAÇÃO: `pacientes` não tem `merged_into_registry_id` (o merge apaga o
      // perdedor). Filtro de "não mesclado" removido. medical_record→prontuario.
      if (cpf.trim()) {
        const { data: dup } = await supabase
          .from("pacientes")
          .select("id, nome_completo, prontuario")
          .eq("cpf", cpf.trim())
          .neq("id", niRegistryId)
          .maybeSingle();
        if (dup) {
          toast.error("CPF já cadastrado", {
            description: `Existe outro paciente: ${dup.nome_completo} (${dup.prontuario || "sem prontuário"}). Use o fluxo de merge no painel administrativo.`,
            duration: 6000,
          });
          setSaving(false);
          return;
        }
      }

      // 2) Atualiza o paciente com a identificação real.
      // MIGRAÇÃO: não há `is_unidentified`/`unidentified_features` — gravar o nome
      // real já faz o paciente deixar de ser detectado como NI (heurística no nome).
      // O contexto da promoção (notas/quem/quando) vai só para logs_auditoria.
      const { error: updErr } = await supabase
        .from("pacientes")
        .update({
          nome_completo: fullName.trim().toUpperCase(),
          cpf: cpf.trim() || null,
          cns: cns.trim() || null,
          data_nascimento: birthDate || null,
          nome_mae: motherName.trim().toUpperCase() || null,
          telefone: phone.trim() || null,
          sexo: toSexoDb(sex),
        })
        .eq("id", niRegistryId);
      if (updErr) throw updErr;

      // MIGRAÇÃO: `internacoes` não tem coluna de nome do paciente (o nome vive só
      // em `pacientes`, já atualizado acima) — passo de propagar patient_name removido.

      // 3) Audit em logs_auditoria (patient_merge_audit não existe mais).
      await supabase.from("logs_auditoria").insert({
        tipo_evento: "promocao_ni",
        nome_tabela: "pacientes",
        acao: "UPDATE",
        registro_id: niRegistryId,
        paciente_id: niRegistryId,
        dados_antigos: snapshot as any,
        dados_novos: {
          nome_completo: fullName.trim().toUpperCase(),
          cpf: cpf.trim() || null,
          cns: cns.trim() || null,
          data_nascimento: birthDate || null,
        } as any,
        motivo: notes.trim() || null,
        ator_user_id: user?.id ?? null,
        email_ator: user?.email ?? null,
      });

      toast.success("Paciente identificado com sucesso!", {
        description: `${fullName.trim().toUpperCase()} — vínculos com atendimentos preservados.`,
      });
      onPromoted?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao identificar paciente", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-emerald-600" />
            Identificar paciente NI
          </DialogTitle>
          <DialogDescription>
            Complemente os dados de identificação do paciente. Todos os atendimentos, prontuários e movimentações já criados serão preservados e atualizados com o nome real.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Cabeçalho do NI atual */}
            <div className="rounded-lg border border-slate-500/30 bg-slate-500/5 p-3 flex items-center gap-3">
              <UserX className="h-4 w-4 text-slate-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">{niName}</p>
                {niCode && <p className="text-[10px] text-muted-foreground font-mono">{niCode}</p>}
              </div>
              <ArrowRight className="h-4 w-4 text-emerald-600" />
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                identificado
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pn-name" className="text-xs">
                Nome completo <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="pn-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value.toUpperCase())}
                className="font-medium"
                autoFocus
              />
              {fullName.trim() && !fullNameOk && (
                <Badge variant="outline" className="text-[9px] h-4 border-amber-500/40 text-amber-700">
                  Informe nome e sobrenome
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pn-cpf" className="text-xs">CPF</Label>
                <Input id="pn-cpf" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pn-cns" className="text-xs">CNS</Label>
                <Input id="pn-cns" placeholder="000 0000 0000 0000" value={cns} onChange={(e) => setCns(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pn-dn" className="text-xs">Data de nascimento</Label>
                <Input
                  id="pn-dn"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sexo</Label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="I">Não informado</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pn-mom" className="text-xs">Nome da mãe</Label>
                <Input id="pn-mom" value={motherName} onChange={(e) => setMotherName(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pn-phone" className="text-xs">Telefone</Label>
                <Input id="pn-phone" placeholder="(99) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pn-notes" className="text-xs">Observações da identificação</Label>
              <Textarea
                id="pn-notes"
                placeholder="Ex.: Família chegou às 16h com RG, CPF e cartão SUS"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                Esta ação é registrada no histórico de auditoria. Caso o paciente já possua outro prontuário com este CPF, use o fluxo de merge no painel administrativo.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handlePromote}
            disabled={saving || loading || !fullNameOk}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserCheck className="h-4 w-4 mr-2" />}
            Confirmar identificação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
