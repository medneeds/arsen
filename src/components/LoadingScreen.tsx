import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { whitelabel } from "@/config/whitelabel";
import { BigHelpLogo } from "./BigHelpLogo";
import { AuthBackgroundFx } from "./auth/AuthBackgroundFx";

interface LoadingScreenProps {
  onComplete?: () => void;
  duration?: number;
}

export function LoadingScreen({ onComplete, duration = 2500 }: LoadingScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"logo" | "slogan" | "ready">("logo");

  useEffect(() => {
    const sloganTimer = setTimeout(() => setPhase("slogan"), 600);
    const readyTimer = setTimeout(() => setPhase("ready"), 1400);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, duration / 60);

    const exitTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onComplete?.(), 400);
    }, duration);

    return () => {
      clearTimeout(sloganTimer);
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

      {/* Top status chip — matches AuthPage header */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[10px] font-medium text-muted-foreground tracking-[0.2em]">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        INICIALIZANDO SESSÃO
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-md px-8">
        {/* Logo */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{
            opacity: phase !== "logo" ? 1 : 0.6,
            scale: phase !== "logo" ? 1 : 0.95,
            y: 0,
          }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
        >
          <BigHelpLogo size="md" glow />
        </motion.div>

        {/* Platform name */}
        <motion.h1
          className="preserve-case text-3xl font-extralight tracking-[0.2em] text-foreground mb-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: phase === "slogan" || phase === "ready" ? 1 : 0,
            y: phase === "slogan" || phase === "ready" ? 0 : 8,
          }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {whitelabel.platform.name}
        </motion.h1>

        {/* Divider */}
        <motion.div
          className="h-px w-16 bg-gradient-to-r from-transparent via-primary/40 to-transparent mb-4"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{
            opacity: phase === "slogan" || phase === "ready" ? 1 : 0,
            scaleX: phase === "slogan" || phase === "ready" ? 1 : 0,
          }}
          transition={{ duration: 0.6, delay: 0.45 }}
        />

        {/* Slogan */}
        <motion.p
          className="preserve-case text-xs sm:text-sm font-light text-muted-foreground text-center mb-12 max-w-xs"
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: phase === "slogan" || phase === "ready" ? 1 : 0,
            y: phase === "slogan" || phase === "ready" ? 0 : 8,
          }}
          transition={{ duration: 0.6, delay: 0.55 }}
        >
          Mapeando cuidados, salvando{" "}
          <span className="text-primary font-medium">vidas</span>.
        </motion.p>

        {/* Progress */}
        <motion.div
          className="w-full max-w-[220px]"
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: phase === "ready" ? 1 : 0,
            y: phase === "ready" ? 0 : 8,
          }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-full h-[2px] bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100 ease-out bg-gradient-to-r from-primary/40 via-primary to-primary/40"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="preserve-case text-[9px] text-muted-foreground/70 tracking-[0.3em] text-center mt-3 font-light uppercase">
            {whitelabel.platform.loadingText}
          </p>
        </motion.div>
      </div>

      {/* Footer compliance */}
      <motion.p
        className="absolute bottom-6 text-[9px] text-muted-foreground/60 tracking-[0.3em]"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "ready" ? 1 : 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        SESSÃO PROTEGIDA — LGPD/CFM
      </motion.p>
    </div>
  );
}
