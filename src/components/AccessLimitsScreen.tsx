import { motion } from "framer-motion";
import { Shield, MapPin, ArrowRight, Building2, UserCog, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { whitelabel } from "@/config/whitelabel";
import { BigHelpLogo } from "./BigHelpLogo";
import { AuthBackgroundFx } from "./auth/AuthBackgroundFx";
import socorraoCrossLogo from "@/assets/socorrao-cross-logo.png";
import arsenLogo from "@/assets/bighelp-map-logo.png";

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

const SERIF = "'Playfair Display', Georgia, serif";

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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <AuthBackgroundFx />

      {/* Top status chip */}
      <motion.div
        className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2.5 z-20"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
        <span className="text-[10px] font-semibold text-foreground/70 tracking-[0.3em]">
          VERIFICAÇÃO DE ACESSO
        </span>
      </motion.div>

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header — Dual logos hero */}
        <div className="flex flex-col items-center mb-6">
          <motion.div
            className="relative mb-4 flex items-center gap-4"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Arsen */}
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl blur-lg bg-primary/20 -m-1.5" />
              <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md border border-border/60 flex items-center justify-center p-1.5 shadow-md shadow-primary/10">
                <img src={arsenLogo} alt="Arsen" className="h-full w-full object-contain" />
              </div>
            </div>

            {/* Vertical ornament */}
            <div className="flex flex-col items-center gap-1">
              <span className="h-2 w-px bg-gradient-to-b from-transparent to-foreground/30" />
              <span className="h-1 w-1 rounded-full bg-primary/70" />
              <span className="h-2 w-px bg-gradient-to-t from-transparent to-foreground/30" />
            </div>

            {/* Socorrão */}
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl blur-lg bg-primary/20 -m-1.5" />
              <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md border border-border/60 flex items-center justify-center p-1.5 shadow-md shadow-primary/10">
                <img src={socorraoCrossLogo} alt={hospitalName} className="h-full w-full object-contain" />
              </div>
            </div>
          </motion.div>

          <motion.h1
            className="preserve-case text-2xl font-extralight tracking-[0.3em] text-foreground"
            style={{ fontFamily: SERIF }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
          >
            {whitelabel.platform.name.toUpperCase()}
          </motion.h1>

          {/* Ornamental divider */}
          <motion.div
            className="flex items-center gap-2 my-2"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <span className="h-px w-6 bg-gradient-to-r from-transparent to-foreground/30" />
            <span className="h-1 w-1 rounded-full bg-primary/60" />
            <span className="h-px w-6 bg-gradient-to-l from-transparent to-foreground/30" />
          </motion.div>

          <motion.p
            className="preserve-case text-[10px] font-semibold tracking-[0.22em] uppercase text-foreground/70 text-center"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
          >
            {hospitalName}
          </motion.p>
        </div>

        {/* Card */}
        <motion.div
          className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-7 space-y-6 shadow-2xl shadow-primary/10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          {/* User info */}
          <div className="flex items-center gap-3 pb-5 border-b border-border/80">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-md bg-primary/20" />
              <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/25 flex items-center justify-center">
                <UserCog className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="preserve-case text-foreground font-semibold text-base tracking-tight truncate"
              >
                {username}
              </p>
              <p className="text-primary text-[10px] font-semibold tracking-[0.22em] uppercase mt-0.5">
                {roleLabel}
              </p>
            </div>
          </div>

          {/* Tipo de Acesso */}
          <InfoRow icon={<Briefcase className="h-3 w-3" />} label="Tipo de Acesso">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <p className="text-primary text-sm font-semibold tracking-wide">
                {accessProfileLabel}
              </p>
            </div>
          </InfoRow>

          {/* Nível de Acesso */}
          <InfoRow icon={<Shield className="h-3 w-3" />} label="Nível de Acesso">
            {isAdmin ? (
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <p className="text-primary text-sm font-bold tracking-[0.05em]">
                    ACESSO TOTAL
                  </p>
                </div>
                <p className="preserve-case text-foreground/60 text-xs mt-1 font-light tracking-wide">
                  Todos os setores e funcionalidades
                </p>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-warning/15 to-warning/5 border border-warning/35 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                  <p className="text-warning text-sm font-bold tracking-[0.05em]">
                    ACESSO RESTRITO
                  </p>
                </div>
                <p className="preserve-case text-foreground/60 text-xs mt-1 font-light tracking-wide">
                  Limitado aos setores vinculados
                </p>
              </div>
            )}
          </InfoRow>

          {/* Setores */}
          {!isAdmin && (
            <InfoRow icon={<Building2 className="h-3 w-3" />} label="Setores Habilitados">
              {allowedDepartments.length > 0 ? (
                <div className="space-y-1.5">
                  {allowedDepartments.map((dept) => (
                    <div
                      key={dept}
                      className="flex items-center gap-2.5 bg-muted/50 border border-border/80 rounded-lg px-3 py-2 hover:bg-muted/70 transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-foreground text-xs font-semibold tracking-[0.05em] uppercase">
                        {DEPARTMENT_LABELS[dept] || dept}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted/50 border border-dashed border-border rounded-xl px-4 py-4 text-center">
                  <p className="preserve-case text-foreground/80 text-xs font-medium">
                    Nenhum setor vinculado
                  </p>
                  <p className="preserve-case text-foreground/55 text-[10px] mt-1 font-light tracking-wide">
                    Entre em contato com o coordenador
                  </p>
                </div>
              )}
            </InfoRow>
          )}

          {/* Botão */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="pt-1"
          >
            <Button
              onClick={onProceed}
              className="w-full h-12 rounded-xl text-xs font-bold tracking-[0.25em] uppercase group shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow"
            >
              ACESSAR PLATAFORMA
              <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          </motion.div>
        </motion.div>

        {/* BigHelp signature */}
        <motion.div
          className="flex items-center justify-center gap-2 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <BigHelpLogo size="xs" />
          <span className="preserve-case text-[10px] tracking-[0.2em] uppercase text-foreground/55 font-medium">
            Powered by BigHelp Map
          </span>
        </motion.div>

        {/* Footer compliance */}
        <motion.div
          className="flex items-center justify-center gap-3 mt-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
        >
          <span className="h-px w-5 bg-foreground/25" />
          <p className="text-[9px] text-foreground/50 tracking-[0.35em] font-semibold">
            SESSÃO PROTEGIDA · LGPD · CFM
          </p>
          <span className="h-px w-5 bg-foreground/25" />
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ─── Reusable info row ────────────────────────────────────────── */
function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-foreground/65">
        <span className="text-primary">{icon}</span>
        <span className="text-[9px] font-bold tracking-[0.25em] uppercase">
          {label}
        </span>
        <span className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
      </div>
      {children}
    </div>
  );
}
