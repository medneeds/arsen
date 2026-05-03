/**
 * Tela mostrada entre o login bem-sucedido e o redirect, quando o usuário
 * acumula 2+ perfis de acesso (ex.: Gestor + NIR + Médico).
 *
 * Layout (acordado com gestão):
 *  - Card "Principal" em destaque, full-width no topo (1º perfil da lista).
 *  - Demais perfis em grid 2 colunas abaixo.
 *  - Persistência: APENAS sessão atual (sessionStorage).
 *    A escolha grava `localStorage["access_profile"]` (fonte de verdade
 *    do app: AppSidebar, useIsGestor, etc.) e devolve a rota de pouso.
 */
import { motion } from "framer-motion";
import { ACCESS_PROFILES, type AccessProfile } from "@/config/userProfiles";
import { resolveLandingRoute } from "@/config/profileDefaults";
import { ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

interface Props {
  userName: string | null;
  profiles: AccessProfile[];
  appRole: string | null;
  /** Se true, esconde o microcopy "para esta sessão" (uso dentro do switcher pós-login). */
  compact?: boolean;
  onChosen: (profile: AccessProfile, route: string) => void;
}

export function ProfileChooser({ userName, profiles, appRole, compact, onChosen }: Props) {
  const handleSelect = (p: AccessProfile) => {
    const route = resolveLandingRoute(p, appRole);
    localStorage.setItem("access_profile", p);
    sessionStorage.setItem("active_access_profile", p);
    sessionStorage.setItem("available_access_profiles", JSON.stringify(profiles));
    onChosen(p, route);
  };

  // Ordena seguindo a ordem canônica de ACCESS_PROFILES, mas com o perfil
  // principal (primeiro do array do usuário) sempre na frente.
  const primaryValue = profiles[0];
  const ordered = ACCESS_PROFILES.filter((p) => profiles.includes(p.value));
  const primary = ordered.find((p) => p.value === primaryValue) ?? ordered[0];
  const rest = ordered.filter((p) => p.value !== primary?.value);

  if (!primary) return null;

  const PrimaryIcon = primary.icon;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="flex-1 flex items-start sm:items-center justify-center px-3 sm:px-4 py-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-3xl"
        >
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground tracking-[0.2em] mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              SELEÇÃO DE PERFIL
            </div>
            <h1 className="preserve-case text-xl sm:text-2xl md:text-3xl font-semibold mb-2">
              {userName ? `Olá, ${userName.split(" ")[0]}` : "Bem-vindo"}
            </h1>
            <p className="preserve-case text-xs sm:text-sm text-muted-foreground px-2">
              Escolha como deseja entrar nesta sessão.
            </p>
          </div>

          {/* ── Card Principal em destaque ───────────────────────── */}
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            onClick={() => handleSelect(primary.value)}
            className="group w-full text-left relative bg-gradient-to-br from-primary/5 via-card to-card border border-primary/30 rounded-2xl p-4 sm:p-5 md:p-6 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/10 active:scale-[0.99] transition-all mb-3"
          >
            <span className="preserve-case absolute top-2.5 right-2.5 sm:top-3 sm:right-3 inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-bold tracking-[0.15em] sm:tracking-[0.18em] text-primary bg-primary/15 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
              <Sparkles className="h-2.5 w-2.5" />
              PRINCIPAL
            </span>
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="inline-flex items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/10 border border-primary/25 shrink-0">
                <PrimaryIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0 pr-16 sm:pr-24">
                <p className="preserve-case font-semibold text-sm sm:text-base md:text-lg text-foreground mb-1">
                  {primary.label}
                </p>
                <p className="preserve-case text-xs md:text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {primary.description}
                </p>
                <div className="mt-2 sm:mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  Entrar como {primary.shortLabel}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </motion.button>

          {/* ── Demais perfis ────────────────────────────────────── */}
          {rest.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-6 mb-3">
                <div className="h-px flex-1 bg-border/60" />
                <span className="preserve-case text-[10px] font-medium text-muted-foreground tracking-[0.2em]">
                  OUTROS AMBIENTES DISPONÍVEIS
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rest.map((p, idx) => {
                  const Icon = p.icon;
                  return (
                    <motion.button
                      key={p.value}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + idx * 0.04 }}
                      onClick={() => handleSelect(p.value)}
                      className="group text-left relative bg-card border border-border/70 rounded-2xl p-3.5 sm:p-4 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.99] transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/15 shrink-0">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="preserve-case font-semibold text-sm text-foreground mb-1">
                            {p.label}
                          </p>
                          <p className="preserve-case text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {p.description}
                          </p>
                          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            Entrar como {p.shortLabel}
                            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </>
          )}

          {!compact && (
            <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70">
              <ShieldCheck className="h-3 w-3" />
              <span className="preserve-case">
                Esta escolha vale apenas para a sessão atual — você pode trocar pelo menu lateral
              </span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
