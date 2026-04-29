/**
 * Dialog para trocar de perfil DURANTE a sessão (sem deslogar).
 * Acionado pelo botão "Trocar perfil" no rodapé da AppSidebar.
 *
 * Lê os perfis disponíveis de `sessionStorage["available_access_profiles"]`,
 * que é populado pelo ProfileChooser logo após o login.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ACCESS_PROFILES, type AccessProfile } from "@/config/userProfiles";
import { resolveLandingRoute } from "@/config/profileDefaults";
import { motion } from "framer-motion";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function readAvailableProfiles(): AccessProfile[] {
  try {
    const raw = sessionStorage.getItem("available_access_profiles");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean) as AccessProfile[];
  } catch {
    /* ignore */
  }
  return [];
}

export function ProfileSwitcherDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setActive(sessionStorage.getItem("active_access_profile"));
    }
  }, [open]);

  const profiles = useMemo(() => readAvailableProfiles(), [open]);
  const cards = useMemo(
    () => ACCESS_PROFILES.filter((p) => profiles.includes(p.value)),
    [profiles],
  );

  if (cards.length < 2) return null;

  const handleSelect = (p: AccessProfile) => {
    const route = resolveLandingRoute(p, role);
    localStorage.setItem("access_profile", p);
    sessionStorage.setItem("active_access_profile", p);
    toast.success(
      `Perfil trocado para ${ACCESS_PROFILES.find((x) => x.value === p)?.shortLabel ?? p}`,
    );
    onOpenChange(false);
    navigate(route);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="preserve-case flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Trocar perfil de acesso
          </DialogTitle>
          <p className="preserve-case text-xs text-muted-foreground mt-1">
            Selecione o ambiente que deseja usar agora. A troca não desloga você.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
          {cards.map((p, idx) => {
            const Icon = p.icon;
            const isActive = active === p.value;
            return (
              <motion.button
                key={p.value}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => handleSelect(p.value)}
                className={`group text-left relative bg-card border rounded-xl p-3 transition-all hover:border-primary/40 hover:shadow-md ${
                  isActive ? "border-primary/60 ring-2 ring-primary/15" : "border-border/70"
                }`}
              >
                {isActive && (
                  <span className="preserve-case absolute top-2 right-2 inline-flex items-center gap-1 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    <Check className="h-2.5 w-2.5" />
                    ATUAL
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <div className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/15 shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 pr-10">
                    <p className="preserve-case font-semibold text-sm text-foreground mb-0.5">
                      {p.label}
                    </p>
                    <p className="preserve-case text-[11px] text-muted-foreground leading-snug line-clamp-2">
                      {p.description}
                    </p>
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      {isActive ? "Recarregar painel" : `Entrar como ${p.shortLabel}`}
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
