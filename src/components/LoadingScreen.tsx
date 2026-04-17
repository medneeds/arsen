import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { whitelabel } from "@/config/whitelabel";
import { useHospital } from "@/contexts/HospitalContext";
import { BigHelpLogo } from "./BigHelpLogo";
import { AuthBackgroundFx } from "./auth/AuthBackgroundFx";

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
  const hospitalLogo = whitelabel.logos.hospital;

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
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[10px] font-semibold text-foreground/70 tracking-[0.25em] z-20">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        INICIALIZANDO SESSÃO
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-md px-8">
        {/* Platform + Hospital lockup */}
        <div className="flex items-center gap-5 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: -8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          >
            <BigHelpLogo size="sm" glow />
          </motion.div>

          {/* Vertical separator */}
          <motion.div
            className="h-14 w-px bg-gradient-to-b from-transparent via-border to-transparent"
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{
              opacity: phase !== "logo" ? 1 : 0,
              scaleY: phase !== "logo" ? 1 : 0,
            }}
            transition={{ duration: 0.5, delay: 0.3 }}
          />

          {/* Hospital logo */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.9, x: 8 }}
            animate={{
              opacity: phase !== "logo" ? 1 : 0,
              scale: phase !== "logo" ? 1 : 0.9,
              x: phase !== "logo" ? 0 : 8,
            }}
            transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
          >
            <div className="absolute inset-0 rounded-2xl blur-2xl bg-primary/15 -m-3" />
            <div className="relative h-16 w-16 rounded-2xl bg-white ring-2 ring-border shadow-lg shadow-primary/10 flex items-center justify-center overflow-hidden p-1.5">
              <img
                src={hospitalLogo}
                alt={hospitalName}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </motion.div>
        </div>

        {/* Platform + hospital name */}
        <motion.div
          className="text-center mb-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: phase !== "logo" ? 1 : 0,
            y: phase !== "logo" ? 0 : 8,
          }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <h1 className="preserve-case text-2xl font-light tracking-[0.18em] text-foreground">
            {whitelabel.platform.name}
          </h1>
          <div className="h-px w-12 bg-gradient-to-r from-transparent via-primary/50 to-transparent mx-auto my-2" />
          <p className="preserve-case text-[11px] font-medium tracking-[0.15em] uppercase text-foreground/70">
            {hospitalName}
          </p>
        </motion.div>

        {/* Slogan */}
        <motion.p
          className="preserve-case text-xs sm:text-sm font-light text-muted-foreground text-center mt-4 mb-10 max-w-xs"
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: phase === "ready" ? 1 : 0,
            y: phase === "ready" ? 0 : 8,
          }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Mapeando cuidados, salvando{" "}
          <span className="text-primary font-medium">vidas</span>.
        </motion.p>

        {/* Progress */}
        <motion.div
          className="w-full max-w-[240px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "ready" ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="w-full h-[3px] bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100 ease-out bg-gradient-to-r from-primary/50 via-primary to-primary/50 shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="preserve-case text-[9px] text-foreground/60 tracking-[0.25em] font-semibold uppercase">
              {whitelabel.platform.loadingText}
            </p>
            <p className="text-[9px] text-foreground/60 tabular-nums font-mono">
              {Math.min(Math.round(progress), 100)}%
            </p>
          </div>
        </motion.div>
      </div>

      {/* Footer compliance */}
      <motion.p
        className="absolute bottom-6 text-[9px] text-foreground/50 tracking-[0.3em] font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "ready" ? 1 : 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        SESSÃO PROTEGIDA — LGPD/CFM
      </motion.p>
    </div>
  );
}
