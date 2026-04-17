import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SYSTEM_ROLES,
  ACCESS_PROFILES,
  PROFILE_TO_ROLE_HINT,
  type AppRole,
  type AccessProfile,
} from "@/config/userProfiles";

interface RoleProfileSelectorProps {
  role: AppRole;
  accessProfile: AccessProfile;
  onRoleChange: (role: AppRole) => void;
  onAccessProfileChange: (profile: AccessProfile) => void;
}

export function RoleProfileSelector({
  role,
  accessProfile,
  onRoleChange,
  onAccessProfileChange,
}: RoleProfileSelectorProps) {
  const suggestedRole = PROFILE_TO_ROLE_HINT[accessProfile];
  const isMisaligned = suggestedRole && role !== suggestedRole;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Role */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Papel no Sistema (RLS)
          </label>
          <Select value={role} onValueChange={(v) => onRoleChange(v as AppRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYSTEM_ROLES.map((r) => {
                const Icon = r.icon;
                return (
                  <SelectItem key={r.value} value={r.value}>
                    <div className="flex items-start gap-2">
                      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{r.label}</span>
                        <span className="text-[10px] text-muted-foreground">{r.description}</span>
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            Define o nível técnico de acesso aos dados (políticas RLS).
          </p>
        </div>

        {/* Access Profile */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Perfil de Acesso (Sidebar)
          </label>
          <Select value={accessProfile} onValueChange={(v) => onAccessProfileChange(v as AccessProfile)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {ACCESS_PROFILES.map((p) => {
                const Icon = p.icon;
                return (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex items-start gap-2">
                      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{p.label}</span>
                        <span className="text-[10px] text-muted-foreground">{p.description}</span>
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            Define a interface exibida (sidebar, dashboards, rota inicial).
          </p>
        </div>
      </div>

      {/* Smart hint when role/profile mismatch */}
      {isMisaligned && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-warning/10 border border-warning/30 text-xs">
          <div className="flex items-center gap-2 text-warning">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground/90">
              Sugestão: o perfil <strong>{accessProfile}</strong> normalmente usa o papel{" "}
              <strong>{suggestedRole}</strong>.
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 text-[11px]"
            onClick={() => onRoleChange(suggestedRole)}
          >
            Aplicar sugestão
          </Button>
        </div>
      )}
    </div>
  );
}
