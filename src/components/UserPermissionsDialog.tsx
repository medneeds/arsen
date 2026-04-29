import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Badge } from "@/components/ui/badge";
import { UserCog, Loader2, Save } from "lucide-react";
import { RoleProfileSelector } from "@/components/permissions/RoleProfileSelector";
import { HospitalUnitPicker } from "@/components/permissions/HospitalUnitPicker";
import { SectorPermissionsPicker } from "@/components/permissions/SectorPermissionsPicker";
import {
  type AppRole,
  type AccessProfile,
  ACCESS_PROFILES,
} from "@/config/userProfiles";

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

  const [role, setRole] = useState<AppRole>((currentRole as AppRole) || "medico");
  const [accessProfile, setAccessProfile] = useState<AccessProfile>(
    (currentAccessProfile as AccessProfile) || "medico",
  );
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [hospitalUnits, setHospitalUnits] = useState<HospitalUnit[]>([]);

  const profileMeta = ACCESS_PROFILES.find((p) => p.value === accessProfile);

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
          supabase
            .from("user_hospital_assignments")
            .select("hospital_unit_id")
            .eq("user_id", userId),
          supabase.from("profiles").select("access_profile").eq("id", userId).maybeSingle(),
        ]);

        if (cancelled) return;

        if (unitsRes.data) setHospitalUnits(unitsRes.data);
        setSelectedDepartments(new Set(deptRes.data?.map((d) => d.department) || []));
        setSelectedUnits(new Set(assignRes.data?.map((a) => a.hospital_unit_id) || []));
        setRole((currentRole as AppRole) || "medico");
        setAccessProfile(
          ((profileRes.data as { access_profile?: string } | null)?.access_profile as AccessProfile) ||
            (currentAccessProfile as AccessProfile) ||
            "medico",
        );
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ role: role as any })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert({ user_id: userId, role: role as any });
        if (error) throw error;
      }

      // 2) Update access_profile in profiles
      const { error: profileError } = await supabase
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ access_profile: accessProfile } as any)
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
        const { error: unitError } = await supabase
          .from("user_hospital_assignments")
          .insert(rows);
        if (unitError) throw unitError;
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
            <span className="font-semibold text-foreground">{userName}</span>
            <span className="text-muted-foreground">
              · {userEmail.replace("@sistema.local", "")}
            </span>
            {profileMeta && (
              <Badge variant="secondary" className="text-[10px] ml-1">
                {profileMeta.shortLabel}
              </Badge>
            )}
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
              <RoleProfileSelector
                role={role}
                accessProfile={accessProfile}
                onRoleChange={setRole}
                onAccessProfileChange={setAccessProfile}
              />

              <HospitalUnitPicker
                units={hospitalUnits}
                selected={selectedUnits}
                onChange={setSelectedUnits}
              />

              {/* Sector picker only for profiles that route by sector */}
              {profileMeta && !profileMeta.skipSectorSelection ? (
                <SectorPermissionsPicker
                  selected={selectedDepartments}
                  onChange={setSelectedDepartments}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">
                    Este perfil não exige seleção de setor
                  </p>
                  <p>
                    O perfil <strong>{profileMeta?.label}</strong> possui painel próprio com filtros
                    internos. Você pode opcionalmente restringir setores abaixo se desejar limitar
                    a visibilidade.
                  </p>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-foreground/80 hover:text-foreground">
                      Restringir setores manualmente
                    </summary>
                    <div className="mt-3">
                      <SectorPermissionsPicker
                        selected={selectedDepartments}
                        onChange={setSelectedDepartments}
                      />
                    </div>
                  </details>
                </div>
              )}
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
