import { useEffect, useState } from "react";
import { whitelabel } from "@/config/whitelabel";

interface PageLoaderProps {
  /** Mensagem contextual (ex: "PREPARANDO UTI 2…", "CARREGANDO PRESCRIÇÃO…") */
  message?: string;
  /** Submensagem opcional (ex: nome do setor, paciente) */
  subMessage?: string;
}

/**
 * Splash de carregamento institucional padronizado.
 * - Logo HMDM com pulso suave
 * - Barra de progresso indeterminada
 * - Backdrop com gradiente azul institucional
 * - Fade-in da própria splash (evita flash quando muito rápido)
 */
export function PageLoader({ message = "Carregando", subMessage }: PageLoaderProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-[#0a1628] via-[#0f2847] to-[#1a3a5c] transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Logo pulsante */}
      <div className="relative mb-8">
        <div className="absolute inset-0 rounded-full bg-primary/30 blur-2xl animate-pulse" />
        <img
          src="/src/assets/socorrao-logo.jpg"
          alt={whitelabel.institution.hospitalAbbreviation}
          className="relative h-20 w-20 rounded-full ring-2 ring-white/20 shadow-2xl animate-pulse"
          style={{ animationDuration: "1.8s" }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>

      {/* Texto */}
      <div className="text-center mb-6 px-6">
        <div className="text-white/95 text-sm font-semibold tracking-wider uppercase">
          {message}
        </div>
        {subMessage && (
          <div className="text-white/60 text-xs mt-1.5 tracking-wide uppercase">
            {subMessage}
          </div>
        )}
      </div>

      {/* Barra de progresso indeterminada */}
      <div className="relative h-1 w-56 overflow-hidden rounded-full bg-white/10">
        <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-primary/60 via-primary to-primary/60 animate-[loader-slide_1.4s_ease-in-out_infinite]" />
      </div>

      {/* Footer institucional */}
      <div className="absolute bottom-6 text-[10px] text-white/40 tracking-widest uppercase">
        {whitelabel.platform.fullName} · {whitelabel.institution.hospitalAbbreviation}
      </div>

      <style>{`
        @keyframes loader-slide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(150%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
