import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { whitelabel } from "@/config/whitelabel";
import axiusWordmark from "@/assets/axius-wordmark.png";
import axiusLogoFull from "@/assets/axius-logo-full.png";
import {
  Activity,
  Brain,
  Shield,
  BarChart3,
  Clock,
  Users,
  ArrowRight,
  FileCheck,
} from "lucide-react";

const advantages = [
  {
    icon: Activity,
    title: "Gestão de Leitos em Tempo Real",
    description: "Visibilidade total da ocupação hospitalar com atualizações instantâneas e alertas inteligentes.",
  },
  {
    icon: Brain,
    title: "Inteligência Artificial Integrada",
    description: "Suporte à decisão clínica com IA para otimizar diagnósticos e condutas terapêuticas.",
  },
  {
    icon: Shield,
    title: "Segurança e Conformidade",
    description: "LGPD e CFM 1.821/2007 nativamente integrados. Dados criptografados e auditáveis.",
  },
  {
    icon: BarChart3,
    title: "Dashboards e Relatórios",
    description: "Indicadores clínicos e operacionais em painéis visuais para tomada de decisão estratégica.",
  },
  {
    icon: Clock,
    title: "Passagem de Plantão Digital",
    description: "Registro estruturado de handovers com snapshots automáticos e histórico completo.",
  },
  {
    icon: Users,
    title: "Colaboração Multidisciplinar",
    description: "Equipes médicas conectadas em tempo real com responsabilidade compartilhada por paciente.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 overflow-x-hidden">
      {/* ─── HERO ─────────────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center px-6"
        style={{
          background:
            "linear-gradient(160deg, #0a0f1a 0%, #0f172a 35%, #1e293b 65%, #334155 100%)",
        }}
      >
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />

        {/* Ambient glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-white/[0.02] rounded-full blur-3xl" />

        <div className="relative z-10 text-center max-w-2xl mx-auto">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="mb-8"
          >
            <img
              src={axiusLogoFull}
              alt={whitelabel.institution.networkLogoAlt}
              className="h-32 md:h-44 object-contain mx-auto rounded-2xl"
            />
          </motion.div>

          {/* Divider */}
          <motion.div
            className="flex items-center justify-center gap-4 mb-6"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-slate-500/40" />
            <div className="h-1.5 w-1.5 rounded-full bg-slate-400/50" />
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-slate-500/40" />
          </motion.div>

          {/* Slogan */}
          <motion.p
            className="text-slate-400 text-base md:text-lg font-light tracking-wide leading-relaxed mb-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            {whitelabel.platform.slogan}
          </motion.p>

          {/* CTA Button */}
          <motion.button
            onClick={() => navigate("/auth")}
            className="group relative inline-flex items-center gap-3 px-10 py-4 bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] hover:border-white/[0.25] rounded-full text-white font-medium text-sm tracking-[0.2em] transition-all duration-500 backdrop-blur-sm"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            <span>Acessar</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </motion.button>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 2 }}
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-[9px] text-slate-500 tracking-[0.3em]">
              Conheça
            </span>
            <div className="w-px h-6 bg-gradient-to-b from-slate-500/40 to-transparent animate-pulse" />
          </div>
        </motion.div>
      </section>

      {/* ─── ADVANTAGES ───────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 px-6 bg-[#fafafa]">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-[10px] tracking-[0.3em] text-gray-400 mb-3 font-medium">
              Plataforma
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              Tecnologia que transforma
              <br />
              <span className="text-gray-400 font-light">a gestão hospitalar</span>
            </h2>
            <div className="h-px w-12 bg-gray-300 mx-auto mt-4" />
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {advantages.map((item, idx) => (
              <motion.div
                key={idx}
                className="group p-6 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-500"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
              >
                <div className="h-10 w-10 rounded-xl bg-gray-900 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2 tracking-wide">
                  {item.title}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed font-light">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMPLIANCE STRIP ─────────────────────────────────────────── */}
      <section className="py-12 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <FileCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white/90 uppercase tracking-wide">
                {whitelabel.compliance.complianceBadgeTitle}
              </p>
              <p className="text-[10px] text-slate-400">
                {whitelabel.compliance.legalReferences}
              </p>
            </div>
          </div>

          <motion.button
            onClick={() => navigate("/auth")}
            className="group inline-flex items-center gap-2 px-8 py-3 bg-white text-gray-900 rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:bg-gray-100 transition-colors duration-300"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span>Acessar Plataforma</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </motion.button>
        </div>
      </section>

      {/* ─── FOOTER ───────────────────────────────────────────────────── */}
      <footer className="py-8 px-6 bg-[#0a0f1a] text-center">
        <img
          src={axiusWordmark}
          alt="Axius"
          className="h-6 object-contain mx-auto opacity-40 mb-3"
        />
        <p className="text-[9px] text-slate-600 uppercase tracking-[0.2em]">
          {whitelabel.credits.developerLabel} •{" "}
          {whitelabel.credits.developerName}
        </p>
      </footer>
    </div>
  );
}
