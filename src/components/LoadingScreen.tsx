import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { whitelabel } from "@/config/whitelabel";
import { useHospital } from "@/contexts/HospitalContext";
import { BigHelpLogo } from "./BigHelpLogo";
import { AuthBackgroundFx } from "./auth/AuthBackgroundFx";
import socorraoCrossLogo from "@/assets/socorrao-cross-logo.png";

interface LoadingScreenProps {
  onComplete?: () => void;
  duration?: number;
}

export function LoadingScreen({ onComplete, duration = 2800 }: LoadingScreenProps) {
  const { currentHospital } = useHospital();
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"logo" | "hospital" | "ready">("logo");

  const hospitalName =
    currentHospital?.name || whitelabel.institution.hospitalShortName;
  const hospitalLogo = socorraoCrossLogo;

  useEffect(() => {
    const hospitalTimer = setTimeout(() => setPhase("hospital"), 700);
    const readyTimer = setTimeout(() => setPhase("ready"), 1500);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 100 / (duration / 40);
      });
    }, 40);

    const exitTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onComplete?.(), 400);
    }, duration);

    return () => {
      clearTimeout(hospitalTimer);
      clearTimeout(readyTimer);
      clearTimeout(exitTimer);
      clearInterval(progressInterval);
    };
  }, [duration, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
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
          INICIALIZANDO SESSÃO
        </span>
      </motion.div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-md px-8">
        {/* Hero — Hospital logo with orbital ring */}
        <motion.div
          className="relative mb-10"
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Orbital ring */}
          <motion.div
            className="absolute inset-0 -m-6 rounded-full border border-primary/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
          >
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
          </motion.div>

          {/* Soft glow */}
          <div className="absolute inset-0 rounded-full blur-3xl bg-primary/25 -m-4" />

          {/* Logo */}
          <img
            src={hospitalLogo}
            alt={hospitalName}
            className="relative h-24 w-24 object-contain drop-shadow-[0_4px_16px_hsl(var(--primary)/0.3)]"
          />
        </motion.div>

        {/* Platform wordmark — editorial style */}
        <motion.div
          className="text-center mb-1"
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: phase !== "logo" ? 1 : 0,
            y: phase !== "logo" ? 0 : 8,
          }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h1
            className="preserve-case text-4xl font-extralight tracking-[0.35em] text-foreground"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {whitelabel.platform.name.toUpperCase()}
          </h1>
        </motion.div>

        {/* Ornamental divider */}
        <motion.div
          className="flex items-center gap-2 my-3"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{
            opacity: phase !== "logo" ? 1 : 0,
            scaleX: phase !== "logo" ? 1 : 0,
          }}
          transition={{ duration: 0.6, delay: 0.55 }}
        >
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-foreground/30" />
          <span className="h-1 w-1 rounded-full bg-primary/60" />
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-foreground/30" />
        </motion.div>

        {/* Hospital name */}
        <motion.p
          className="preserve-case text-[11px] font-semibold tracking-[0.22em] uppercase text-foreground/75 text-center"
          initial={{ opacity: 0, y: 6 }}
          animate={{
            opacity: phase !== "logo" ? 1 : 0,
            y: phase !== "logo" ? 0 : 6,
          }}
          transition={{ duration: 0.6, delay: 0.65 }}
        >
          {hospitalName}
        </motion.p>

        {/* BigHelp signature — small, bottom of hero */}
        <motion.div
          className="flex items-center gap-2 mt-6 mb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "ready" ? 1 : 0 }}
          transition={{ duration: 0.5 }}
        >
          <BigHelpLogo size="xs" />
          <span className="preserve-case text-[10px] tracking-[0.2em] uppercase text-foreground/55 font-medium">
            Powered by BigHelp Map
          </span>
        </motion.div>

        {/* Slogan */}
        <motion.p
          className="preserve-case text-xs font-light italic text-foreground/65 text-center mb-8 max-w-xs"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: phase === "ready" ? 1 : 0,
            y: phase === "ready" ? 0 : 8,
          }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          “Mapeando cuidados, salvando{" "}
          <span className="text-primary not-italic font-medium">vidas</span>.”
        </motion.p>

        {/* Progress */}
        <motion.div
          className="w-full max-w-[260px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "ready" ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="w-full h-[2px] bg-muted/80 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100 ease-out bg-gradient-to-r from-primary/40 via-primary to-primary/40 shadow-[0_0_10px_hsl(var(--primary)/0.6)]"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="preserve-case text-[9px] text-foreground/55 tracking-[0.3em] font-semibold uppercase">
              {whitelabel.platform.loadingText}
            </p>
            <p className="text-[9px] text-foreground/55 tabular-nums tracking-widest">
              {String(Math.min(Math.round(progress), 100)).padStart(3, "0")}%
            </p>
          </div>
        </motion.div>
      </div>

      {/* Footer compliance */}
      <motion.div
        className="absolute bottom-8 flex items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "ready" ? 1 : 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <span className="h-px w-6 bg-foreground/25" />
        <p className="text-[9px] text-foreground/50 tracking-[0.35em] font-semibold">
          SESSÃO PROTEGIDA · LGPD · CFM
        </p>
        <span className="h-px w-6 bg-foreground/25" />
      </motion.div>
    </div>
  );
}
