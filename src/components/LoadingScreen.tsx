import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { whitelabel } from "@/config/whitelabel";
import { useHospital } from "@/contexts/HospitalContext";
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
      {/* Radial glow sutil */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.06),transparent_70%)]" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-xs px-8">

        {/* Logo única — Socorrão I */}
        <motion.div
          className="mb-7"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div className="h-20 w-20 rounded-2xl bg-card/70 border border-border/40 flex items-center justify-center backdrop-blur-sm p-3 shadow-sm">
            <img
              src={socorraoCrossLogo}
              alt="ARSen — Socorrão I"
              className="h-full w-full object-contain"
            />
          </div>
        </motion.div>

        {/* Nome da plataforma */}
        <motion.h1
          className="preserve-case text-3xl font-extralight tracking-[0.35em] text-foreground mb-1.5"
          style={{ fontFamily: SERIF }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12 }}
        >
          {whitelabel.platform.name.toUpperCase()}
        </motion.h1>

        {/* Hospital — discreto */}
        <motion.p
          className="preserve-case text-[9px] font-medium tracking-[0.2em] uppercase text-foreground/45 text-center mb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {hospitalName}
        </motion.p>

        {/* Barra de progresso */}
        <motion.div
          className="w-full max-w-[180px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.28 }}
        >
          <div className="w-full h-[1.5px] bg-muted/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100 ease-out bg-primary/70"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </motion.div>

      </div>
    </div>
  );
}
