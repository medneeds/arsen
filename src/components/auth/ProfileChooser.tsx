/**
 * Tela mostrada entre o login bem-sucedido e o redirect, quando o usuário
 * acumula 2+ perfis de acesso (ex.: Gestor + NIR + Médico).
 *
 * - Persistência: APENAS sessão atual (sessionStorage).
 * - A escolha grava `localStorage["access_profile"]` (fonte de verdade
 *   do app: AppSidebar, useIsGestor, etc.) e devolve a rota de pouso.
 */
import { motion } from "framer-motion";
import { ACCESS_PROFILES, type AccessProfile } from "@/config/userProfiles";
import { resolveLandingRoute } from "@/config/profileDefaults";
import { ShieldCheck, ArrowRight } from "lucide-react";

interface Props {
  userName: string | null;
  profiles: AccessProfile[];
  appRole: string | null;
  onChosen: (profile: AccessProfile, route: string) => void;
}

export function ProfileChooser({ userName, profiles, appRole, onChosen }: Props) {
  const handleSelect = (p: AccessProfile) => {
    const route = resolveLandingRoute(p, appRole);
    localStorage.setItem("access_profile", p);
    sessionStorage.setItem("active_access_profile", p);
    sessionStorage.setItem("available_access_profiles", JSON.stringify(profiles));
    onChosen(p, route);
  };

  const cards = ACCESS_PROFILES.filter((p) => profiles.includes(p.value));

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-3xl"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground tracking-[0.2em] mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              SELEÇÃO DE PERFIL
            </div>
            <h1 className="preserve-case text-2xl md:text-3xl font-semibold mb-2">
              {userName ? `Olá, ${userName.split(" ")[0]}` : "Bem-vindo"}
            </h1>
            <p className="preserve-case text-sm text-muted-foreground">
              Você tem acesso a múltiplos ambientes. Escolha como deseja entrar nesta sessão.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cards.map((p, idx) => {
              const Icon = p.icon;
              const isPrimary = idx === 0 && profiles[0] === p.value;
              return (
                <motion.button
                  key={p.value}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + idx * 0.05 }}
                  onClick={() => handleSelect(p.value)}
                  className="group text-left relative bg-card border border-border/70 rounded-2xl p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
                >
                  {isPrimary && (
                    <span className="preserve-case absolute top-3 right-3 text-[9px] font-bold tracking-[0.15em] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      PRINCIPAL
                    </span>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/15 shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="preserve-case font-semibold text-sm text-foreground mb-1">
                        {p.label}
                      </p>
                      <p className="preserve-case text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {p.description}
                      </p>
                      <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Entrar como {p.shortLabel}
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70">
            <ShieldCheck className="h-3 w-3" />
            <span className="preserve-case">Esta escolha vale apenas para a sessão atual</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
