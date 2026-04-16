import { motion } from "framer-motion";
import { Shield, MapPin, ArrowRight, Building2, UserCog, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { BigHelpLogo } from "./BigHelpLogo";
import { AuthBackgroundFx } from "./auth/AuthBackgroundFx";

const ROLE_LABELS: Record<string, string> = {
  admin: "ADMINISTRADOR",
  medico: "MÉDICO",
  porta: "MÉDICO PORTA",
  visitante: "VISITANTE",
  farmacia: "FARMÁCIA CLÍNICA",
  nir: "NIR",
  multi: "EQUIPE MULTI",
};

const DEPARTMENT_LABELS: Record<string, string> = {
  UTI: "UTI / UCI",
  "URGÊNCIA E EMERGÊNCIA ADULTO": "URGÊNCIA E EMERGÊNCIA",
  ENFERMARIA: "ENFERMARIA",
  "CENTRO CIRÚRGICO": "CENTRO CIRÚRGICO",
};

const ACCESS_PROFILE_LABELS: Record<string, string> = {
  medico: "MÉDICO ASSISTENTE",
  gestor: "GESTOR HOSPITALAR",
  farmacia: "FARMÁCIA CLÍNICA",
  ccih: "CCIH — CONTROLE DE INFECÇÃO",
  imagem: "SETOR DE IMAGEM",
  laboratorio: "SETOR LABORATORIAL",
  nir: "NIR — REGULAÇÃO INTERNA",
  multi: "EQUIPE MULTIPROFISSIONAL",
  administrativo: "ADMINISTRATIVO / RECEPÇÃO",
};

interface AccessLimitsScreenProps {
  onProceed: () => void;
}

export function AccessLimitsScreen({ onProceed }: AccessLimitsScreenProps) {
  const { role, allowedDepartments, user } = useAuth();
  const username =
    user?.user_metadata?.username ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Usuário";

  const isAdmin = role === "admin";
  const roleLabel = ROLE_LABELS[role || "medico"] || "MÉDICO";
  const accessProfile =
    typeof window !== "undefined"
      ? localStorage.getItem("access_profile") || "medico"
      : "medico";
  const accessProfileLabel =
    ACCESS_PROFILE_LABELS[accessProfile] || ACCESS_PROFILE_LABELS["medico"];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <AuthBackgroundFx />

      {/* Top status chip — matches AuthPage header */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[10px] font-medium text-muted-foreground tracking-[0.2em] z-20">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        LIMITES DE ACESSO
      </div>

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <BigHelpLogo size="sm" glow />
          </motion.div>
          <motion.div
            className="text-center mt-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <h2 className="preserve-case text-foreground text-base font-light tracking-[0.15em] uppercase">
              Verificação de Acesso
            </h2>
            <div className="h-px w-16 mx-auto bg-gradient-to-r from-transparent via-primary/40 to-transparent mt-2" />
          </motion.div>
        </div>

        {/* Card */}
        <motion.div
          className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl p-6 space-y-5 shadow-xl shadow-primary/5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          {/* User info */}
          <div className="flex items-center gap-3 pb-4 border-b border-border/60">
            <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <UserCog className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="preserve-case text-foreground font-semibold text-sm tracking-wide uppercase">
                {username}
              </p>
              <p className="text-primary/80 text-xs tracking-[0.1em]">{roleLabel}</p>
            </div>
          </div>

          {/* Tipo de Acesso */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5 text-primary/70" />
              <span className="text-[10px] font-semibold tracking-[0.15em] uppercase">
                Tipo de Acesso
              </span>
            </div>
            <div className="bg-primary/5 border border-primary/15 rounded-lg px-4 py-2.5">
              <p className="text-primary text-sm font-semibold tracking-wide">
                {accessProfileLabel}
              </p>
            </div>
          </div>

          {/* Nível de Acesso */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-3.5 w-3.5 text-primary/70" />
              <span className="text-[10px] font-semibold tracking-[0.15em] uppercase">
                Nível de Acesso
              </span>
            </div>

            {isAdmin ? (
              <div className="bg-accent/10 border border-accent/20 rounded-lg px-4 py-2.5">
                <p className="text-accent-foreground text-sm font-semibold tracking-wide">
                  ACESSO TOTAL
                </p>
                <p className="preserve-case text-muted-foreground text-xs mt-0.5">
                  Todos os setores e funcionalidades
                </p>
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-4 py-2.5">
                <p className="text-amber-700 dark:text-amber-400 text-sm font-semibold tracking-wide">
                  ACESSO RESTRITO
                </p>
                <p className="preserve-case text-muted-foreground text-xs mt-0.5">
                  Limitado aos setores vinculados
                </p>
              </div>
            )}
          </div>

          {/* Setores */}
          {!isAdmin && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-[10px] font-semibold tracking-[0.15em] uppercase">
                  Setores Habilitados
                </span>
              </div>

              {allowedDepartments.length > 0 ? (
                <div className="space-y-1.5">
                  {allowedDepartments.map((dept) => (
                    <div
                      key={dept}
                      className="flex items-center gap-2 bg-muted/40 border border-border/60 rounded-lg px-3 py-2"
                    >
                      <MapPin className="h-3.5 w-3.5 text-primary/60" />
                      <span className="text-foreground/85 text-xs font-medium tracking-wide uppercase">
                        {DEPARTMENT_LABELS[dept] || dept}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted/40 border border-border/60 rounded-lg px-4 py-3 text-center">
                  <p className="preserve-case text-muted-foreground text-xs">
                    Nenhum setor vinculado
                  </p>
                  <p className="preserve-case text-muted-foreground/70 text-[10px] mt-0.5">
                    Entre em contato com o coordenador
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Botão */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <Button
              onClick={onProceed}
              className="w-full h-11 rounded-xl text-xs font-semibold tracking-[0.15em] uppercase group"
            >
              CONTINUAR
              <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </motion.div>
        </motion.div>

        {/* Footer compliance */}
        <motion.p
          className="text-center text-[9px] text-muted-foreground/60 mt-6 tracking-[0.3em]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          SESSÃO PROTEGIDA — LGPD/CFM
        </motion.p>
      </motion.div>
    </div>
  );
}
