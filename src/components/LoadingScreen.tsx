import { useEffect, useState } from "react";
import { whitelabel } from "@/config/whitelabel";
import bighelpLogo from "@/assets/bighelp-map-logo.png";

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
      setProgress(prev => {
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
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-all duration-500 ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{
        background: "linear-gradient(145deg, #060e1a 0%, #0a1628 30%, #0f2847 70%, #0a1628 100%)",
      }}
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[140px]"
          style={{
            background: "radial-gradient(ellipse, rgba(45, 212, 191, 0.06) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-lg px-8">
        {/* Logo */}
        <div
          className="mb-10 transition-all duration-800 ease-out"
          style={{
            opacity: phase !== "logo" ? 1 : 0,
            transform: phase !== "logo" ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
            transitionDelay: "150ms",
          }}
        >
          <img
            src={bighelpLogo}
            alt="BigHelp Map"
            className="h-14 sm:h-16 md:h-20 object-contain"
          />
        </div>

        {/* Divider */}
        <div
          className="w-full max-w-[200px] mb-8 transition-all duration-800 ease-out"
          style={{
            opacity: phase === "slogan" || phase === "ready" ? 1 : 0,
            transform: phase === "slogan" || phase === "ready" ? "scaleX(1)" : "scaleX(0)",
            transitionDelay: "300ms",
          }}
        >
          <div className="h-px bg-gradient-to-r from-transparent via-[#2dd4bf]/30 to-transparent" />
        </div>

        {/* Slogan */}
        <div
          className="text-center mb-14 transition-all duration-800 ease-out"
          style={{
            opacity: phase === "slogan" || phase === "ready" ? 1 : 0,
            transform: phase === "slogan" || phase === "ready" ? "translateY(0)" : "translateY(15px)",
            transitionDelay: "500ms",
          }}
        >
          <p className="text-base sm:text-lg font-light tracking-wide text-slate-400/80 leading-relaxed">
            Mapeando cuidados,
          </p>
          <p className="text-base sm:text-lg font-light tracking-wide text-slate-400/80 leading-relaxed">
            salvando <span className="text-[#2dd4bf] font-medium">vidas</span>.
          </p>
        </div>

        {/* Progress */}
        <div
          className="w-full max-w-[160px] transition-all duration-600 ease-out"
          style={{
            opacity: phase === "ready" ? 1 : 0,
            transform: phase === "ready" ? "translateY(0)" : "translateY(8px)",
            transitionDelay: "150ms",
          }}
        >
          <div className="w-full h-[1.5px] bg-slate-800/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100 ease-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, rgba(45,212,191,0.3) 0%, rgba(45,212,191,0.7) 50%, rgba(45,212,191,0.3) 100%)",
              }}
            />
          </div>
          <p className="text-[9px] text-slate-600 tracking-[0.3em] uppercase text-center mt-3 font-light">
            {whitelabel.platform.loadingText}
          </p>
        </div>
      </div>
    </div>
  );
}
