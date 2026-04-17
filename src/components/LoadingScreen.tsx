import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { whitelabel } from "@/config/whitelabel";
import { useHospital } from "@/contexts/HospitalContext";
import { BigHelpLogo } from "./BigHelpLogo";
import socorraoCrossLogo from "@/assets/socorrao-cross-logo.png";

const SERIF = "'Playfair Display', Georgia, serif";

interface LoadingScreenProps {
  onComplete?: () => void;
  duration?: number;
}

export function LoadingScreen({ onComplete, duration = 1400 }: LoadingScreenProps) {
  const { currentHospital } = useHospital();
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  const hospitalName =
    currentHospital?.name || whitelabel.institution.hospitalShortName;

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 100 / (duration / 30);
      });
    }, 30);

    const exitTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onComplete?.(), 250);
    }, duration);

    return () => {
      clearTimeout(exitTimer);
      clearInterval(progressInterval);
    };
  }, [duration, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Subtle gradient wash — single static layer */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08),transparent_70%)]" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-md px-8">
        {/* Dual logos */}
        <motion.div
          className="relative mb-8 flex items-center gap-4"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="relative h-14 w-14 rounded-xl bg-card/60 border border-border/50 flex items-center justify-center backdrop-blur-sm">
            <BigHelpLogo size="sm" />
          </div>

          <span className="h-1 w-1 rounded-full bg-primary/60" />

          <div className="relative h-14 w-14 rounded-xl bg-card/60 border border-border/50 flex items-center justify-center p-2 backdrop-blur-sm">
            <img
              src={socorraoCrossLogo}
              alt={hospitalName}
              className="h-full w-full object-contain"
            />
          </div>
        </motion.div>

        {/* Wordmark */}
        <motion.h1
          className="preserve-case text-3xl font-extralight tracking-[0.3em] text-foreground mb-3"
          style={{ fontFamily: SERIF }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {whitelabel.platform.name.toUpperCase()}
        </motion.h1>

        {/* Hospital */}
        <motion.p
          className="preserve-case text-[10px] font-semibold tracking-[0.22em] uppercase text-foreground/60 text-center mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          {hospitalName}
        </motion.p>

        {/* Progress */}
        <motion.div
          className="w-full max-w-[220px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="w-full h-[2px] bg-muted/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100 ease-out bg-primary"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <p className="preserve-case text-[9px] text-foreground/50 tracking-[0.25em] font-semibold uppercase">
              {whitelabel.platform.loadingText}
            </p>
            <p className="text-[9px] text-foreground/50 tabular-nums tracking-widest">
              {String(Math.min(Math.round(progress), 100)).padStart(3, "0")}%
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
