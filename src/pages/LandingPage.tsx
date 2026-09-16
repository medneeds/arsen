import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { whitelabel } from "@/config/whitelabel";
import { ArsenMark } from "@/components/brand/ArsenMark";
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

const SERIF = "'Playfair Display', Georgia, serif";

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
    <div className="min-h-screen flex flex-col bg-white text-foreground">
      {/* ─── HEADER ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3 group"
          >
            <ArsenMark size={24} variant="compact" className="text-primary" />
            <span
              className="preserve-case text-lg font-normal tracking-[0.25em] text-foreground"
              style={{ fontFamily: SERIF }}
            >
              ARSEN
            </span>
          </button>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm preserve-case text-muted-foreground">
            <a href="#plataforma" className="hover:text-foreground transition-colors">
              Plataforma
            </a>
            <a href="#conformidade" className="hover:text-foreground transition-colors">
              Conformidade
            </a>
          </nav>

          {/* CTA */}
          <button
            onClick={() => navigate("/auth")}
            className="preserve-case inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary hover:bg-primary text-white text-xs font-medium transition-colors"
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
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-muted/60 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-released-soft/50 rounded-full blur-3xl" />
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-border/80 shadow-sm mb-8"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-released animate-pulse" />
            <span className="preserve-case text-xs font-medium text-foreground tracking-[0.25em] uppercase">
              Plataforma de gestão clínica hospitalar
            </span>
          </motion.div>

          {/* Logo mark */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-center mb-8"
          >
            <ArsenMark size={64} className="text-primary" />
          </motion.div>

          {/* Brand name — serif elegante */}
          <motion.h1
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="preserve-case text-5xl md:text-6xl lg:text-7xl font-normal tracking-[0.3em] text-foreground mb-4 leading-none"
            style={{ fontFamily: SERIF }}
          >
            ARSEN
          </motion.h1>

          {/* Ornamental divider */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex items-center justify-center gap-2 mb-6"
          >
            <span className="h-px w-10 bg-transparent" />
            <span className="h-1 w-1 rounded-full bg-primary/70" />
            <span className="h-px w-10 bg-transparent" />
          </motion.div>

          {/* Slogan */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="preserve-case text-sm md:text-base text-muted-foreground font-normal tracking-[0.2em] uppercase mb-8"
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
              className="preserve-case group inline-flex items-center gap-2 px-8 py-4 rounded-full bg-primary hover:bg-primary text-white text-sm font-medium transition-all shadow-md shadow-md hover:shadow-md hover:shadow-md"
            >
              Acessar plataforma
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </motion.button>
            <a
              href="#plataforma"
              className="preserve-case inline-flex items-center gap-2 px-8 py-4 rounded-full text-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              Conhecer recursos
            </a>
          </motion.div>
        </div>
      </section>

      {/* ─── ADVANTAGES ──────────────────────────────────────────────── */}
      <section id="plataforma" className="py-20 md:py-28 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto mb-8"
          >
            <p className="preserve-case text-xs font-medium text-foreground mb-3 tracking-wide">
              Recursos
            </p>
            <h2 className="preserve-case text-3xl md:text-4xl font-semibold text-foreground tracking-tight mb-4">
              Tecnologia que transforma a gestão hospitalar
            </h2>
            <p className="preserve-case text-base text-muted-foreground leading-relaxed">
              Uma plataforma integrada para coordenar leitos, equipes e cuidados em
              um só lugar.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {advantages.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: idx * 0.06 }}
                className="group p-6 rounded-lg bg-white border border-border hover:border-border hover:shadow-md hover:shadow-md transition-all duration-500"
              >
                <div className="h-11 w-11 rounded-lg bg-muted border border-border flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <item.icon className="h-5 w-5 text-foreground" strokeWidth={2} />
                </div>
                <h3 className="preserve-case text-base font-medium text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="preserve-case text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMPLIANCE ──────────────────────────────────────────────── */}
      <section id="conformidade" className="py-8 px-6 bg-white border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 md:p-8 rounded-lg bg-released-soft/60 border border-released-border/60"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-white border border-released-border flex items-center justify-center shadow-sm">
                <FileCheck className="h-5 w-5 text-released-on-soft" />
              </div>
              <div>
                <p className="preserve-case text-sm font-medium text-foreground">
                  {whitelabel.compliance.complianceBadgeTitle}
                </p>
                <p className="preserve-case text-xs text-muted-foreground mt-1">
                  {whitelabel.compliance.legalReferences}
                </p>
              </div>
            </div>

            <motion.button
              onClick={() => navigate("/auth")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="preserve-case group inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary hover:bg-primary text-white text-sm font-medium transition-all"
            >
              Acessar
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-muted/50 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ArsenMark size={24} variant="compact" className="text-primary" />
            <span
              className="preserve-case text-sm font-normal tracking-[0.25em] text-foreground"
              style={{ fontFamily: SERIF }}
            >
              ARSEN
            </span>
          </div>

          <p className="preserve-case text-xs text-muted-foreground text-center">
            © {currentYear} Arsen. Todos os direitos reservados.
          </p>

          <p className="preserve-case text-xs text-muted-foreground">
            Desenvolvido por <span className="font-medium text-foreground">Medneeds</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
