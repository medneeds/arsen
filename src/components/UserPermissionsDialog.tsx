import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { logUserAdminAction } from "@/lib/userAdminAudit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCog, Loader2, Save } from "lucide-react";

// MIGRAÇÃO: profiles/user_roles/access_profile removidos. O papel do
// profissional é uma coluna única (enum papel_profissional) em `profissionais`.
type Papel = Database["public"]["Enums"]["papel_profissional"];

// Opções selecionáveis de papel (super_admin/dev ficam de fora — atribuídos manualmente no banco).
const PAPEL_OPTIONS: { value: Papel; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "medico", label: "Médico" },
  { value: "enfermeiro", label: "Enfermeiro" },
  { value: "tecnico", label: "Técnico" },
  { value: "regulador", label: "Regulador" },
  { value: "farmacia", label: "Farmácia" },
  { value: "nir", label: "NIR" },
  { value: "porta", label: "Médico Porta" },
  { value: "visitante", label: "Visitante" },
  { value: "coordenador", label: "Coordenador" },
];

interface Setor {
  id: string;
  nome: string;
  ala_id: string;
  ativo: boolean;
}

export function UserPermissionsDialog({
  open,
  onOpenChange,
  profissionalId,
  userId,
  userName,
  userEmail,
  currentRole,
  hospitalId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profissionalId: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  currentRole: string | null;
  hospitalId: string;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [papel, setPapel] = useState<Papel>((currentRole as Papel) || "medico");
  const [setores, setSetores] = useState<Setor[]>([]);
  const [selectedSetores, setSelectedSetores] = useState<Set<string>>(new Set());

  // Snapshot inicial para diff de persistência + auditoria
  const initialSnapshotRef = useRef<{ papel: string; setores: string[] } | null>(null);

  // ── Carrega setores do hospital + vínculos atuais do profissional ──
  useEffect(() => {
    if (!open || !profissionalId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        // MIGRAÇÃO: setores não têm hospital_id direto; ligam-se via ala_id → alas.hospital_id.
        const { data: alas, error: alasError } = await supabase
          .from("alas")
          .select("id")
          .eq("hospital_id", hospitalId);
        if (alasError) throw alasError;
        const alaIds = (alas ?? []).map((a) => a.id);

        const [setoresRes, vinculosRes] = await Promise.all([
          alaIds.length > 0
            ? supabase
                .from("setores")
                .select("id, nome, ala_id, ativo")
                .in("ala_id", alaIds)
                .eq("ativo", true)
                .order("nome")
            : Promise.resolve({ data: [] as Setor[], error: null }),
          // MIGRAÇÃO: user_departments → profissionais_setores (chaveado por profissional_id, o PK da linha).
          supabase
            .from("profissionais_setores")
            .select("setor_id")
            .eq("profissional_id", profissionalId),
        ]);

        if (cancelled) return;
        if (setoresRes.error) throw setoresRes.error;
        if (vinculosRes.error) throw vinculosRes.error;

        setSetores((setoresRes.data as Setor[]) ?? []);
        const loadedSetores = (vinculosRes.data ?? []).map((v) => v.setor_id);
        setSelectedSetores(new Set(loadedSetores));

        const loadedPapel = (currentRole as Papel) || "medico";
        setPapel(loadedPapel);
        initialSnapshotRef.current = {
          papel: loadedPapel,
          setores: [...loadedSetores].sort(),
        };
      } catch (err) {
        console.error("[UserPermissionsDialog] load error", err);
        toast.error("Não foi possível carregar permissões");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, profissionalId, hospitalId, currentRole]);

  const toggleSetor = (setorId: string, checked: boolean) => {
    setSelectedSetores((prev) => {
      const next = new Set(prev);
      if (checked) next.add(setorId);
      else next.delete(setorId);
      return next;
    });
  };

  // ── Salva: papel em profissionais + diff de profissionais_setores ──
  const handleSave = async () => {
    setSaving(true);
    try {
      // 1) Atualiza o papel do profissional (coluna única, chaveada pelo PK da linha).
      const { error: papelError } = await supabase
        .from("profissionais")
        .update({ papel })
        .eq("id", profissionalId);
      if (papelError) throw papelError;

      // 2) Sincroniza profissionais_setores por diff (insere novos, remove retirados).
      const before = initialSnapshotRef.current?.setores ?? [];
      const beforeSet = new Set(before);
      const afterSet = selectedSetores;

      const toInsert = [...afterSet].filter((id) => !beforeSet.has(id));
      const toDelete = [...beforeSet].filter((id) => !afterSet.has(id));

      if (toInsert.length > 0) {
        const rows = toInsert.map((setor_id) => ({
          profissional_id: profissionalId,
          setor_id,
        }));
        const { error } = await supabase.from("profissionais_setores").insert(rows);
        if (error) throw error;
      }

      if (toDelete.length > 0) {
        const { error } = await supabase
          .from("profissionais_setores")
          .delete()
          .eq("profissional_id", profissionalId)
          .in("setor_id", toDelete);
        if (error) throw error;
      }

      // 3) Auditoria (best-effort).
      const beforeSnap = initialSnapshotRef.current;
      const afterSetores = [...afterSet].sort();
      if (beforeSnap) {
        const changed =
          beforeSnap.papel !== papel ||
          JSON.stringify(beforeSnap.setores) !== JSON.stringify(afterSetores);
        if (changed) {
          await logUserAdminAction({
            action: "user.permissions.updated",
            targetUserId: userId,
            targetEmail: userEmail,
            targetName: userName,
            hospitalUnitId: hospitalId,
            appRole: papel,
            departments: afterSetores,
            oldData: beforeSnap,
            newData: { papel, setores: afterSetores },
          });
        }
      }

      toast.success("Permissões atualizadas com sucesso");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error("[UserPermissionsDialog] save error", err);
      const msg = err instanceof Error ? err.message : "Erro ao salvar permissões";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 bg-muted/30">
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            Permissões e Acessos
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">{userName}</span>
            <span className="text-muted-foreground">
              · {userEmail.replace("@sistema.local", "")}
            </span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Carregando permissões…</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[65vh]">
            <div className="p-6 space-y-6">
              {/* Papel do profissional */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Papel</Label>
                <Select value={papel} onValueChange={(v) => setPapel(v as Papel)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o papel" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Define o nível de acesso do profissional no sistema.
                </p>
              </div>

              {/* Setores do hospital */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Setores</Label>
                  <p className="text-xs text-muted-foreground">
                    Selecione os setores aos quais este profissional terá acesso.
                  </p>
                </div>

                {setores.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
                    Nenhum setor ativo encontrado para este hospital.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {setores.map((setor) => {
                      const checked = selectedSetores.has(setor.id);
                      return (
                        <label
                          key={setor.id}
                          className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => toggleSetor(setor.id, c === true)}
                          />
                          <span>{setor.nome}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* MIGRAÇÃO: gestão de múltiplas unidades hospitalares (antigo
                  user_hospital_assignments/HospitalUnitPicker) foi omitida — este
                  diálogo agora opera no escopo de um único hospitalId. O vínculo
                  profissional↔hospital vive em profissionais_hospitais e é gerido
                  no fluxo de criação/atribuição do profissional. */}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/20">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar permissões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
