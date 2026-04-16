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
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-all duration-500 bg-gradient-to-br from-[#040a18] via-[#0a1628] to-[#0f2847] ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Background grid - matches AccessLimitsScreen */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(45,212,191,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(45,212,191,0.06) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-md px-8">
        {/* Logo */}
        <div
          className="mb-8 transition-all duration-700 ease-out"
          style={{
            opacity: phase !== "logo" ? 1 : 0,
            transform: phase !== "logo" ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
            transitionDelay: "150ms",
          }}
        >
          <BigHelpLogo size="md" glow />
        </div>

        {/* Section label - matches AccessLimits header style */}
        <div
          className="text-center mb-6 transition-all duration-700 ease-out"
          style={{
            opacity: phase === "slogan" || phase === "ready" ? 1 : 0,
            transform: phase === "slogan" || phase === "ready" ? "translateY(0)" : "translateY(10px)",
            transitionDelay: "300ms",
          }}
        >
          <h2 className="text-white/90 text-sm font-light tracking-[0.2em] uppercase">
            Inicializando Sessão
          </h2>
          <div className="h-px w-20 mx-auto bg-gradient-to-r from-transparent via-[#2dd4bf]/40 to-transparent mt-3" />
        </div>

        {/* Slogan */}
        <div
          className="text-center mb-10 transition-all duration-700 ease-out"
          style={{
            opacity: phase === "slogan" || phase === "ready" ? 1 : 0,
            transform: phase === "slogan" || phase === "ready" ? "translateY(0)" : "translateY(15px)",
            transitionDelay: "500ms",
          }}
        >
          <p className="text-xs sm:text-sm font-light tracking-wide text-white/50 leading-relaxed">
            Mapeando cuidados, salvando{" "}
            <span className="text-[#2dd4bf]/80 font-medium">vidas</span>.
          </p>
        </div>

        {/* Progress */}
        <div
          className="w-full max-w-[200px] transition-all duration-500 ease-out"
          style={{
            opacity: phase === "ready" ? 1 : 0,
            transform: phase === "ready" ? "translateY(0)" : "translateY(8px)",
            transitionDelay: "150ms",
          }}
        >
          <div className="w-full h-[2px] bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100 ease-out"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(90deg, rgba(45,212,191,0.4) 0%, #2dd4bf 50%, rgba(45,212,191,0.4) 100%)",
              }}
            />
          </div>
          <p className="text-[9px] text-white/30 tracking-[0.3em] text-center mt-3 font-light uppercase">
            {whitelabel.platform.loadingText}
          </p>
        </div>

        {/* Footer - matches AccessLimits */}
        <p
          className="text-[9px] text-white/20 mt-10 tracking-[0.3em] transition-opacity duration-700"
          style={{
            opacity: phase === "ready" ? 1 : 0,
            transitionDelay: "400ms",
          }}
        >
          SESSÃO PROTEGIDA — LGPD/CFM
        </p>
      </div>
    </div>
  );
}
