import { useEffect, useState } from "react";
import { whitelabel } from "@/config/whitelabel";
import { BigHelpLogo } from "./BigHelpLogo";

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
        background: "linear-gradient(145deg, hsl(210 20% 98%) 0%, hsl(210 30% 96%) 30%, hsl(215 40% 94%) 70%, hsl(210 20% 97%) 100%)",
      }}
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(hsl(215 20% 65% / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(215 20% 65% / 0.3) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[140px]"
          style={{
            background: "radial-gradient(ellipse, hsl(215 60% 85% / 0.4) 0%, transparent 70%)",
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
          <div className="relative inline-block">
            <BigHelpLogo size="lg" glow showText />
          </div>
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
          <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
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
          <p className="text-base sm:text-lg font-light tracking-wide text-slate-500 leading-relaxed">
            Mapeando cuidados, salvando <span className="text-slate-700 font-medium">vidas</span>.
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
          <div className="w-full h-[1.5px] bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100 ease-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, hsl(215 40% 75%) 0%, hsl(215 50% 55%) 50%, hsl(215 40% 75%) 100%)",
              }}
            />
          </div>
          <p className="text-[9px] text-slate-400 tracking-[0.3em] text-center mt-3 font-light">
            {whitelabel.platform.loadingText}
          </p>
        </div>
      </div>
    </div>
  );
}
