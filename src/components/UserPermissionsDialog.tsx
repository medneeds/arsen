import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Building2,
  Layers,
  UserCog,
  Loader2,
  Save,
  CheckCircle2,
} from "lucide-react";
import { DEPARTMENTS } from "@/contexts/DepartmentContext";

/** Roles disponíveis no sistema (enum app_role) */
const SYSTEM_ROLES: { value: string; label: string; description: string }[] = [
  { value: "admin", label: "Coordenador (Admin)", description: "Acesso total ao sistema" },
  { value: "medico", label: "Médico", description: "Atendimento clínico padrão" },
  { value: "porta", label: "Porta / Visitante Médico", description: "Avaliação inicial / triagem" },
  { value: "visitante", label: "Visitante", description: "Apenas visualização do mapa" },
  { value: "farmacia", label: "Farmácia Clínica", description: "Validação farmacêutica" },
  { value: "nir", label: "NIR", description: "Núcleo Interno de Regulação" },
];

/** Perfis de acesso (access_profile) — controlam UI/sidebar */
const ACCESS_PROFILES: { value: string; label: string; description: string }[] = [
  { value: "medico", label: "Médico Assistente", description: "Sidebar clínica completa" },
  { value: "gestor", label: "Gestor Hospitalar", description: "Painel executivo somente leitura" },
  { value: "farmacia", label: "Farmácia Clínica", description: "Ambiente farmacêutico" },
  { value: "ccih", label: "CCIH", description: "Controle de infecção hospitalar" },
  { value: "nir", label: "NIR", description: "Regulação interna" },
  { value: "imagem", label: "Setor de Imagem", description: "Painel de imagem diagnóstica" },
  { value: "laboratorio", label: "Laboratório", description: "Painel laboratorial" },
  { value: "administrativo", label: "Administrativo", description: "Cadastros e fluxos administrativos" },
  { value: "multi", label: "Equipe Multi", description: "Triagem e equipe multiprofissional" },
];

/** Agrupamento dos setores em blocos para facilitar a seleção em massa */
const SECTOR_GROUPS: { id: string; label: string; departments: string[] }[] = [
  { id: "uti", label: "UTI", departments: ["UTI 1", "UTI 2"] },
  { id: "uci", label: "UCI / UCC", departments: ["UCI 1", "UCI 2", "UCC"] },
  {
    id: "enfermarias",
    label: "Enfermarias",
    departments: ["NEURO 01", "NEURO 02", "CLÍNICA CIRÚRGICA", "ENFERMARIA DE TRANSIÇÃO", "ENFERMARIA VASCULAR", "RIV"],
  },
  {
    id: "emergencia",
    label: "Urgência e Emergência",
    departments: [
      "URGÊNCIA E EMERGÊNCIA ADULTO",
      "URGÊNCIA E EMERGÊNCIA PEDIÁTRICA",
      "UE VERTICAL",
      "UE HORIZONTAL",
      "SALA VERMELHA",
      "SALA LARANJA",
      "INTERNAÇÃO UE",
      "OBSERVAÇÃO CLÍNICA",
    ],
  },
  {
    id: "centro_cirurgico",
    label: "Centro Cirúrgico",
    departments: ["CC PREPARO", "CC BLOCO CIRÚRGICO", "CC RPA"],
  },
  { id: "regulacao", label: "Regulação / Infecção", departments: ["CCIH", "NIR"] },
];

interface HospitalUnit {
  id: string;
  name: string;
}

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail: string;
  currentRole: string | null;
  currentAccessProfile?: string | null;
  onSaved?: () => void;
}

export function UserPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  currentRole,
  currentAccessProfile,
  onSaved,
}: UserPermissionsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [role, setRole] = useState<string>(currentRole || "medico");
  const [accessProfile, setAccessProfile] = useState<string>(currentAccessProfile || "medico");
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [hospitalUnits, setHospitalUnits] = useState<HospitalUnit[]>([]);

  // ── Load current permissions when dialog opens ──
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [unitsRes, deptRes, assignRes, profileRes] = await Promise.all([
          supabase.from("hospital_units").select("id, name").order("name"),
          supabase.from("user_departments").select("department").eq("user_id", userId),
          supabase.from("user_hospital_assignments").select("hospital_unit_id").eq("user_id", userId),
          supabase.from("profiles").select("access_profile").eq("id", userId).maybeSingle(),
        ]);

        if (cancelled) return;

        if (unitsRes.data) setHospitalUnits(unitsRes.data);
        setSelectedDepartments(new Set(deptRes.data?.map((d) => d.department) || []));
        setSelectedUnits(new Set(assignRes.data?.map((a) => a.hospital_unit_id) || []));
        setRole(currentRole || "medico");
        setAccessProfile(profileRes.data?.access_profile || currentAccessProfile || "medico");
      } catch (err) {
        console.error("[UserPermissionsDialog] load error", err);
        toast.error("Erro ao carregar permissões");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, userId, currentRole, currentAccessProfile]);

  const toggleDepartment = (dept: string) => {
    setSelectedDepartments((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  const toggleGroup = (group: typeof SECTOR_GROUPS[number]) => {
    const allSelected = group.departments.every((d) => selectedDepartments.has(d));
    setSelectedDepartments((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        group.departments.forEach((d) => next.delete(d));
      } else {
        group.departments.forEach((d) => next.add(d));
      }
      return next;
    });
  };

  const toggleUnit = (unitId: string) => {
    setSelectedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const handleSelectAllSectors = () => {
    setSelectedDepartments(new Set(DEPARTMENTS));
  };

  const handleClearSectors = () => {
    setSelectedDepartments(new Set());
  };

  // ── Save: updates role, access_profile, departments, hospital assignments ──
  const handleSave = async () => {
    setSaving(true);
    try {
      // 1) Update role (upsert pattern)
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingRole) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: role as any })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: role as any });
        if (error) throw error;
      }

      // 2) Update access_profile in profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ access_profile: accessProfile })
        .eq("id", userId);
      if (profileError) throw profileError;

      // 3) Sync user_departments — wipe + reinsert
      await supabase.from("user_departments").delete().eq("user_id", userId);
      if (selectedDepartments.size > 0) {
        const rows = Array.from(selectedDepartments).map((department) => ({
          user_id: userId,
          department,
        }));
        const { error: deptError } = await supabase.from("user_departments").insert(rows);
        if (deptError) throw deptError;
      }

      // 4) Sync hospital assignments — wipe + reinsert
      await supabase.from("user_hospital_assignments").delete().eq("user_id", userId);
      if (selectedUnits.size > 0) {
        const rows = Array.from(selectedUnits).map((hospital_unit_id) => ({
          user_id: userId,
          hospital_unit_id,
        }));
        const { error: unitError } = await supabase.from("user_hospital_assignments").insert(rows);
        if (unitError) throw unitError;
      }

      toast.success("Permissões atualizadas com sucesso");
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("[UserPermissionsDialog] save error", err);
      toast.error(err?.message || "Erro ao salvar permissões");
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
          <DialogDescription>
            <span className="font-semibold text-foreground">{userName}</span>
            <span className="text-muted-foreground"> · {userEmail.replace("@sistema.local", "")}</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Carregando permissões…</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[65vh]">
            <div className="p-6 space-y-6">
              {/* ── Role + Access Profile ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" /> Papel no Sistema
                  </label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYSTEM_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{r.label}</span>
                            <span className="text-[10px] text-muted-foreground">{r.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Define o nível técnico de acesso (RLS).
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Perfil de Acesso (Sidebar)
                  </label>
                  <Select value={accessProfile} onValueChange={setAccessProfile}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESS_PROFILES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{p.label}</span>
                            <span className="text-[10px] text-muted-foreground">{p.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Define a UI exibida (sidebar, dashboards, restrições visuais).
                  </p>
                </div>
              </div>

              {/* ── Hospital Units ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Unidades Hospitalares
                  </label>
                  <Badge variant="outline" className="text-[10px]">
                    {selectedUnits.size} de {hospitalUnits.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 rounded-lg bg-muted/30 border border-border/40">
                  {hospitalUnits.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma unidade cadastrada.</p>
                  ) : (
                    hospitalUnits.map((unit) => {
                      const checked = selectedUnits.has(unit.id);
                      return (
                        <label
                          key={unit.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-background cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleUnit(unit.id)}
                          />
                          <span className="text-sm">{unit.name}</span>
                          {checked && <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto" />}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ── Sectors / Departments ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Setores Acessíveis
                  </label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {selectedDepartments.size} de {DEPARTMENTS.length}
                    </Badge>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={handleSelectAllSectors}>
                      Selecionar todos
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={handleClearSectors}>
                      Limpar
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {SECTOR_GROUPS.map((group) => {
                    const allChecked = group.departments.every((d) => selectedDepartments.has(d));
                    const someChecked = group.departments.some((d) => selectedDepartments.has(d));
                    return (
                      <div key={group.id} className="rounded-lg border border-border/40 bg-card overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={allChecked}
                              data-state={allChecked ? "checked" : someChecked ? "indeterminate" : "unchecked"}
                              onCheckedChange={() => toggleGroup(group)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                              {group.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {group.departments.filter((d) => selectedDepartments.has(d)).length}/{group.departments.length}
                          </span>
                        </button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-2">
                          {group.departments.map((dept) => {
                            const checked = selectedDepartments.has(dept);
                            return (
                              <label
                                key={dept}
                                className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/50 cursor-pointer text-xs transition-colors"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleDepartment(dept)}
                                />
                                <span className="truncate">{dept}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
