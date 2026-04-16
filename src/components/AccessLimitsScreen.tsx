import { motion } from "framer-motion";
import { Shield, MapPin, ArrowRight, Building2, UserCog, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { whitelabel } from "@/config/whitelabel";
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
  const { currentHospital } = useHospital();
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

  const hospitalName =
    currentHospital?.name || whitelabel.institution.hospitalShortName;
  const hospitalLogo = whitelabel.logos.hospital;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <AuthBackgroundFx />

      {/* Top status chip */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[10px] font-semibold text-foreground/70 tracking-[0.25em] z-20">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        VERIFICAÇÃO DE ACESSO
      </div>

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header — Platform + Hospital lockup */}
        <div className="flex flex-col items-center mb-6">
          <motion.div
            className="flex items-center gap-4 mb-3"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <BigHelpLogo size="sm" glow />
            <div className="h-10 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl bg-primary/15 -m-2" />
              <img
                src={hospitalLogo}
                alt={hospitalName}
                className="relative h-11 w-11 rounded-full object-cover ring-2 ring-border shadow-md"
              />
            </div>
          </motion.div>
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <p className="preserve-case text-[11px] font-semibold tracking-[0.18em] uppercase text-foreground/80">
              {whitelabel.platform.name} · {hospitalName}
            </p>
            <div className="h-px w-16 mx-auto bg-gradient-to-r from-transparent via-primary/50 to-transparent mt-2" />
          </motion.div>
        </div>

        {/* Card */}
        <motion.div
          className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-6 space-y-5 shadow-2xl shadow-primary/10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          {/* User info */}
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="h-11 w-11 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center">
              <UserCog className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="preserve-case text-foreground font-semibold text-sm tracking-wide uppercase">
                {username}
              </p>
              <p className="text-primary text-xs font-semibold tracking-[0.12em]">
                {roleLabel}
              </p>
            </div>
          </div>

          {/* Tipo de Acesso */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-foreground/70">
              <Briefcase className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase">
                Tipo de Acesso
              </span>
            </div>
            <div className="bg-primary/8 border border-primary/20 rounded-lg px-4 py-2.5">
              <p className="text-primary text-sm font-semibold tracking-wide">
                {accessProfileLabel}
              </p>
            </div>
          </div>

          {/* Nível de Acesso */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-foreground/70">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase">
                Nível de Acesso
              </span>
            </div>

            {isAdmin ? (
              <div className="bg-accent/15 border border-accent/30 rounded-lg px-4 py-2.5">
                <p className="text-accent-foreground text-sm font-bold tracking-wide">
                  ACESSO TOTAL
                </p>
                <p className="preserve-case text-foreground/65 text-xs mt-0.5">
                  Todos os setores e funcionalidades
                </p>
              </div>
            ) : (
              <div className="bg-warning/15 border border-warning/35 rounded-lg px-4 py-2.5">
                <p className="text-warning text-sm font-bold tracking-wide">
                  ACESSO RESTRITO
                </p>
                <p className="preserve-case text-foreground/65 text-xs mt-0.5">
                  Limitado aos setores vinculados
                </p>
              </div>
            )}
          </div>

          {/* Setores */}
          {!isAdmin && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-foreground/70">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-bold tracking-[0.18em] uppercase">
                  Setores Habilitados
                </span>
              </div>

              {allowedDepartments.length > 0 ? (
                <div className="space-y-1.5">
                  {allowedDepartments.map((dept) => (
                    <div
                      key={dept}
                      className="flex items-center gap-2 bg-muted/60 border border-border rounded-lg px-3 py-2"
                    >
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      <span className="text-foreground text-xs font-semibold tracking-wide uppercase">
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
