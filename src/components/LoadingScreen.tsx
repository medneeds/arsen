import { useEffect, useState } from "react";
import { whitelabel } from "@/config/whitelabel";
import axiusWordmark from "@/assets/axius-wordmark.png";

interface LoadingScreenProps {
  onComplete?: () => void;
  duration?: number;
}

export function LoadingScreen({ onComplete, duration = 3200 }: LoadingScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"logo" | "slogan" | "ready">("logo");

  useEffect(() => {
    // Phase transitions
    const sloganTimer = setTimeout(() => setPhase("slogan"), 800);
    const readyTimer = setTimeout(() => setPhase("ready"), 2000);

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1.5;
      });
    }, duration / 80);

    const exitTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onComplete?.(), 500);
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
        background: "linear-gradient(145deg, #0a0f1a 0%, #0f172a 30%, #1e293b 70%, #0f172a 100%)",
      }}
    >
      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Ambient light effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[120px]"
          style={{
            background: "radial-gradient(ellipse, rgba(148, 163, 184, 0.08) 0%, transparent 70%)",
            animation: "ambientPulse 6s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-0 left-1/4 w-[600px] h-[300px] rounded-full blur-[100px]"
          style={{
            background: "radial-gradient(ellipse, rgba(100, 116, 139, 0.05) 0%, transparent 70%)",
            animation: "ambientPulse 8s ease-in-out infinite 2s",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl px-8">
        
        {/* Wordmark logo - hero element */}
        <div
          className="mb-12 transition-all duration-1000 ease-out"
          style={{
            opacity: phase !== "logo" ? 1 : 0,
            transform: phase !== "logo" ? "translateY(0) scale(1)" : "translateY(30px) scale(0.9)",
            transitionDelay: "200ms",
          }}
        >
          <img
            src={axiusWordmark}
            alt="Axius"
            className="h-16 sm:h-20 md:h-24 object-contain opacity-90"
          />
        </div>

        {/* Horizontal rule */}
        <div
          className="w-full max-w-xs mb-10 transition-all duration-1000 ease-out"
          style={{
            opacity: phase === "slogan" || phase === "ready" ? 1 : 0,
            transform: phase === "slogan" || phase === "ready" ? "scaleX(1)" : "scaleX(0)",
            transitionDelay: "400ms",
          }}
        >
          <div className="h-px bg-gradient-to-r from-transparent via-slate-500/40 to-transparent" />
        </div>

        {/* Slogan */}
        <div
          className="text-center mb-16 transition-all duration-1000 ease-out"
          style={{
            opacity: phase === "slogan" || phase === "ready" ? 1 : 0,
            transform: phase === "slogan" || phase === "ready" ? "translateY(0)" : "translateY(20px)",
            transitionDelay: "600ms",
          }}
        >
          <p className="text-lg sm:text-xl md:text-2xl font-light tracking-wide text-slate-400 leading-relaxed">
            Onde cada decisão
          </p>
          <p className="text-lg sm:text-xl md:text-2xl font-light tracking-wide text-slate-400 leading-relaxed">
            transforma o cuidado em <span className="text-white font-medium">resultado</span>.
          </p>
        </div>

        {/* Progress bar */}
        <div
          className="w-full max-w-[200px] transition-all duration-700 ease-out"
          style={{
            opacity: phase === "ready" ? 1 : 0,
            transform: phase === "ready" ? "translateY(0)" : "translateY(10px)",
            transitionDelay: "200ms",
          }}
        >
          <div className="w-full h-[2px] bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-150 ease-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, rgba(148,163,184,0.3) 0%, rgba(148,163,184,0.7) 50%, rgba(148,163,184,0.3) 100%)",
              }}
            />
          </div>
          <p className="text-[10px] text-slate-600 tracking-[0.3em] uppercase text-center mt-4 font-light">
            {whitelabel.platform.loadingText}
          </p>
        </div>

        {/* Footer badge */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[120px] transition-all duration-700"
          style={{
            opacity: phase === "ready" ? 0.4 : 0,
            transitionDelay: "800ms",
          }}
        >
          <p className="text-[9px] text-slate-600 tracking-[0.25em] uppercase font-light">
            {whitelabel.credits.authorSignature}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes ambientPulse {
          0%, 100% { opacity: 0.5; transform: translateX(-50%) scale(1); }
          50% { opacity: 1; transform: translateX(-50%) scale(1.1); }
        }
      `}</style>
    </div>
  );
}
