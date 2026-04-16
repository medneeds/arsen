import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, MapPin, ArrowRight, Building2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { BigHelpLogo } from "./BigHelpLogo";

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

interface AccessLimitsScreenProps {
  onProceed: () => void;
}

export function AccessLimitsScreen({ onProceed }: AccessLimitsScreenProps) {
  const { role, allowedDepartments, user } = useAuth();
  const username = user?.user_metadata?.username || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";

  const isAdmin = role === "admin";
  const roleLabel = ROLE_LABELS[role || "medico"] || "MÉDICO";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#040a18] via-[#0a1628] to-[#0f2847] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(45,212,191,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Ambient glow */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(45,212,191,0.06) 0%, transparent 70%)" }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <BigHelpLogo size="md" glow />
          </motion.div>
          <motion.div
            className="mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-white/90 text-sm font-light tracking-[0.2em] uppercase">
              Limites de Acesso
            </h2>
            <div className="h-px w-20 mx-auto bg-gradient-to-r from-transparent via-[#2dd4bf]/40 to-transparent mt-3" />
          </motion.div>
        </div>

        {/* Card */}
        <motion.div
          className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 space-y-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          {/* User info */}
          <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
            <div className="h-10 w-10 rounded-full bg-[#2dd4bf]/10 border border-[#2dd4bf]/20 flex items-center justify-center">
              <UserCog className="h-5 w-5 text-[#2dd4bf]" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm tracking-wide uppercase">{username}</p>
              <p className="text-[#2dd4bf]/70 text-xs tracking-[0.1em]">{roleLabel}</p>
            </div>
          </div>

          {/* Access level */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white/60">
              <Shield className="h-4 w-4 text-[#2dd4bf]/60" />
              <span className="text-xs font-medium tracking-[0.1em] uppercase">Nível de Acesso</span>
            </div>

            {isAdmin ? (
              <div className="bg-[#2dd4bf]/[0.08] border border-[#2dd4bf]/20 rounded-lg px-4 py-3">
                <p className="text-[#2dd4bf] text-sm font-semibold tracking-wide">ACESSO TOTAL</p>
                <p className="text-white/40 text-xs mt-1">Todos os setores e funcionalidades</p>
              </div>
            ) : (
              <div className="bg-amber-500/[0.08] border border-amber-500/20 rounded-lg px-4 py-3">
                <p className="text-amber-400 text-sm font-semibold tracking-wide">ACESSO RESTRITO</p>
                <p className="text-white/40 text-xs mt-1">Limitado aos setores vinculados</p>
              </div>
            )}
          </div>

          {/* Departments */}
          {!isAdmin && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white/60">
                <Building2 className="h-4 w-4 text-[#2dd4bf]/60" />
                <span className="text-xs font-medium tracking-[0.1em] uppercase">Setores Habilitados</span>
              </div>

              {allowedDepartments.length > 0 ? (
                <div className="space-y-2">
                  {allowedDepartments.map((dept) => (
                    <div
                      key={dept}
                      className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-2.5"
                    >
                      <MapPin className="h-3.5 w-3.5 text-[#2dd4bf]/50" />
                      <span className="text-white/80 text-xs font-medium tracking-wide uppercase">
                        {DEPARTMENT_LABELS[dept] || dept}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 text-center">
                  <p className="text-white/40 text-xs">Nenhum setor vinculado</p>
                  <p className="text-white/25 text-[10px] mt-1">Entre em contato com o coordenador</p>
                </div>
              )}
            </div>
          )}

          {/* Proceed button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <Button
              onClick={onProceed}
              className="w-full h-11 bg-[#2dd4bf]/15 hover:bg-[#2dd4bf]/25 text-[#2dd4bf] border border-[#2dd4bf]/30 hover:border-[#2dd4bf]/50 rounded-xl text-xs font-semibold tracking-[0.15em] uppercase transition-all duration-300"
            >
              CONTINUAR
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.p
          className="text-center text-[9px] text-white/20 mt-6 tracking-[0.3em]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          SESSÃO PROTEGIDA — LGPD/CFM
        </motion.p>
      </motion.div>
    </div>
  );
}
