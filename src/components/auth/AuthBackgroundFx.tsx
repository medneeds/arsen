import { motion } from "framer-motion";

/**
 * Animated background for the Auth page.
 * Conceito: plataforma clínica inteligente — linhas de ECG, pulsos,
 * orbes flutuantes e partículas que evocam monitoramento em tempo real.
 *
 * Tudo em tons do design system (primary/azul-escuro + cinzas), discreto.
 */
export function AuthBackgroundFx() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* ── Static gradient washes ───────────────────────────── */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1100px] h-[700px] bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.10),transparent_70%)]" />
      <div className="absolute -bottom-40 -right-32 w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.07),transparent_70%)]" />
      <div className="absolute top-1/4 -left-40 w-[500px] h-[500px] bg-[radial-gradient(ellipse_at_center,hsl(215_20%_60%/0.06),transparent_70%)]" />

      {/* ── Drifting orbs ────────────────────────────────────── */}
      <motion.div
        className="absolute top-[12%] left-[8%] w-72 h-72 rounded-full bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.18),transparent_65%)] blur-2xl"
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
          scale: [1, 1.08, 0.95, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[10%] right-[12%] w-96 h-96 rounded-full bg-[radial-gradient(circle_at_center,hsl(var(--accent)/0.10),transparent_65%)] blur-3xl"
        animate={{
          x: [0, -50, 30, 0],
          y: [0, 25, -15, 0],
          scale: [1, 1.05, 0.92, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[55%] left-[60%] w-64 h-64 rounded-full bg-[radial-gradient(circle_at_center,hsl(215_50%_40%/0.10),transparent_65%)] blur-2xl"
        animate={{
          x: [0, 30, -40, 0],
          y: [0, -40, 10, 0],
        }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── Subtle moving grid ───────────────────────────────── */}
      <motion.div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
        animate={{ backgroundPosition: ["0px 0px", "64px 64px"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      />

      {/* ── ECG / Heartbeat lines ────────────────────────────── */}
      <EcgLine top="22%" duration={9} delay={0} opacity={0.22} />
      <EcgLine top="68%" duration={11} delay={2} opacity={0.16} reverse />
      <EcgLine top="86%" duration={13} delay={4} opacity={0.12} />

      {/* ── Floating particles (data points) ─────────────────── */}
      <Particles />

      {/* ── Vignette to focus center ─────────────────────────── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,hsl(var(--background))_100%)]" />
    </div>
  );
}

/* ── ECG line crossing the viewport ───────────────────────────── */
function EcgLine({
  top,
  duration,
  delay,
  opacity,
  reverse,
}: {
  top: string;
  duration: number;
  delay: number;
  opacity: number;
  reverse?: boolean;
}) {
  return (
    <div
      className="absolute left-0 right-0 h-px"
      style={{ top, opacity }}
    >
      {/* Static faint baseline */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {/* Moving heartbeat pulse */}
      <motion.svg
        className="absolute top-1/2 -translate-y-1/2"
        width="220"
        height="60"
        viewBox="0 0 220 60"
        fill="none"
        initial={{ x: reverse ? "100vw" : "-220px" }}
        animate={{ x: reverse ? "-220px" : "100vw" }}
        transition={{
          duration,
          delay,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <path
          d="M0 30 L60 30 L72 30 L80 10 L92 50 L104 18 L116 42 L128 30 L140 30 L220 30"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Pulse glow */}
        <circle cx="92" cy="50" r="3" fill="hsl(var(--accent))">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
        </circle>
      </motion.svg>
    </div>
  );
}

/* ── Floating data particles ──────────────────────────────────── */
function Particles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    left: `${(i * 53) % 100}%`,
    delay: (i * 0.7) % 8,
    duration: 12 + (i % 6) * 2,
    size: 2 + (i % 3),
  }));

  return (
    <div className="absolute inset-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-primary/40"
          style={{
            left: p.left,
            bottom: "-10px",
            width: p.size,
            height: p.size,
            boxShadow: "0 0 8px hsl(var(--primary) / 0.6)",
          }}
          initial={{ y: 0, opacity: 0 }}
          animate={{
            y: "-110vh",
            opacity: [0, 0.7, 0.7, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
            times: [0, 0.1, 0.85, 1],
          }}
        />
      ))}
    </div>
  );
}
