import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { whitelabel } from "@/config/whitelabel";
import {
  Activity,
  Brain,
  Shield,
  BarChart3,
  Clock,
  Users,
  ArrowRight,
  FileCheck,
  Sparkles,
} from "lucide-react";

const advantages = [
  {
    icon: Activity,
    title: "Gestão de leitos em tempo real",
    description:
      "Visibilidade total da ocupação hospitalar com atualizações instantâneas e alertas inteligentes.",
  },
  {
    icon: Brain,
    title: "Inteligência artificial integrada",
    description:
      "Suporte à decisão clínica com IA para otimizar diagnósticos e condutas terapêuticas.",
  },
  {
    icon: Shield,
    title: "Segurança e conformidade",
    description:
      "LGPD e CFM 1.821/2007 nativamente integrados. Dados criptografados e auditáveis.",
  },
  {
    icon: BarChart3,
    title: "Dashboards e relatórios",
    description:
      "Indicadores clínicos e operacionais em painéis visuais para decisões estratégicas.",
  },
  {
    icon: Clock,
    title: "Passagem de plantão digital",
    description:
      "Registro estruturado de handovers com snapshots automáticos e histórico completo.",
  },
  {
    icon: Users,
    title: "Colaboração multidisciplinar",
    description:
      "Equipes médicas conectadas em tempo real com responsabilidade compartilhada por paciente.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-700">
      {/* ─── HEADER ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 group"
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="preserve-case text-lg font-semibold tracking-tight text-slate-800">
              Arsen
            </span>
          </button>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm preserve-case text-slate-500">
            <a href="#plataforma" className="hover:text-slate-800 transition-colors">
              Plataforma
            </a>
            <a href="#conformidade" className="hover:text-slate-800 transition-colors">
              Conformidade
            </a>
          </nav>

          {/* CTA */}
          <button
            onClick={() => navigate("/auth")}
            className="preserve-case inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors"
          >
            Acessar
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ─── HERO ────────────────────────────────────────────────────── */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-6 py-20 md:py-32 overflow-hidden">
        {/* Soft ambient gradients */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-br from-sky-100/60 via-blue-50/40 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-teal-50/50 to-transparent rounded-full blur-3xl" />
        </div>

        {/* Subtle grid */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(215 20% 65% / 0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(215 20% 65% / 0.4) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative text-center max-w-3xl mx-auto">
          {/* Pill */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-sm mb-8"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="preserve-case text-[11px] font-medium text-slate-600 tracking-wide">
              Plataforma de gestão clínica hospitalar
            </span>
          </motion.div>

          {/* Brand name */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="preserve-case text-7xl md:text-8xl lg:text-9xl font-bold tracking-tight mb-6 bg-gradient-to-b from-slate-800 via-slate-700 to-slate-500 bg-clip-text text-transparent leading-none"
          >
            Arsen
          </motion.h1>

          {/* Slogan */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="preserve-case text-xl md:text-2xl text-slate-500 font-light tracking-tight mb-12"
          >
            Plataforma Clínica Inteligente
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-3 justify-center items-center"
          >
            <motion.button
              onClick={() => navigate("/auth")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="preserve-case group inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-all shadow-lg shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/15"
            >
              Acessar plataforma
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </motion.button>
            <a
              href="#plataforma"
              className="preserve-case inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors"
            >
              Conhecer recursos
            </a>
          </motion.div>
        </div>
      </section>

      {/* ─── ADVANTAGES ──────────────────────────────────────────────── */}
      <section id="plataforma" className="py-20 md:py-28 px-6 bg-gradient-to-b from-white to-slate-50/60">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <p className="preserve-case text-xs font-medium text-sky-600 mb-3 tracking-wide">
              Recursos
            </p>
            <h2 className="preserve-case text-3xl md:text-4xl font-bold text-slate-800 tracking-tight mb-4">
              Tecnologia que transforma a gestão hospitalar
            </h2>
            <p className="preserve-case text-base text-slate-500 leading-relaxed">
              Uma plataforma integrada para coordenar leitos, equipes e cuidados em
              um só lugar.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {advantages.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: idx * 0.06 }}
                className="group p-7 rounded-2xl bg-white border border-slate-100 hover:border-slate-200 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-500"
              >
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-sky-50 to-blue-100/60 border border-sky-100 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <item.icon className="h-5 w-5 text-sky-600" strokeWidth={2} />
                </div>
                <h3 className="preserve-case text-base font-semibold text-slate-800 mb-2">
                  {item.title}
                </h3>
                <p className="preserve-case text-sm text-slate-500 leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMPLIANCE ──────────────────────────────────────────────── */}
      <section id="conformidade" className="py-16 px-6 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 md:p-8 rounded-2xl bg-gradient-to-br from-emerald-50/60 via-white to-sky-50/40 border border-emerald-100/60"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shadow-sm">
                <FileCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="preserve-case text-sm font-semibold text-slate-800">
                  {whitelabel.compliance.complianceBadgeTitle}
                </p>
                <p className="preserve-case text-xs text-slate-500 mt-0.5">
                  {whitelabel.compliance.legalReferences}
                </p>
              </div>
            </div>

            <motion.button
              onClick={() => navigate("/auth")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="preserve-case group inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-all"
            >
              Acessar
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100 bg-slate-50/50 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="preserve-case text-sm font-semibold text-slate-700">
              Arsen
            </span>
          </div>

          <p className="preserve-case text-xs text-slate-400 text-center">
            © {currentYear} Arsen. Todos os direitos reservados.
          </p>

          <p className="preserve-case text-xs text-slate-400">
            Desenvolvido por <span className="font-medium text-slate-600">Medneeds</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
