import { useEffect, useState } from "react";
import socorraoIcon from "@/assets/socorrao-cross-logo.png";

interface PageLoaderProps {
  /** Mensagem contextual (ex: "Preparando UTI 2…"). Opcional — quando ausente, splash fica ainda mais limpo. */
  message?: string;
  /** Submensagem opcional (ex: nome do setor, paciente). */
  subMessage?: string;
}

/**
 * Splash de carregamento institucional — versão suave/esmaecida.
 * - Fundo branco-azulado quase imperceptível (não preto/escuro)
 * - Apenas o ícone (cruz) do Socorrão, com pulso muito sutil
 * - Sem barra de progresso ruidosa — só um respiro discreto sob o ícone
 * - Fade-in próprio para nunca dar sensação de "pop" brusco
 */
export function PageLoader({ message, subMessage }: PageLoaderProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-slate-50/95 via-white/90 to-blue-50/80 backdrop-blur-sm transition-opacity duration-500 ease-out"
      style={{ opacity: visible ? 1 : 0 }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Ícone com halo respirando */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full bg-primary/15 blur-2xl"
          style={{ animation: "loader-breath 2.4s ease-in-out infinite" }}
        />
        <img
          src={socorraoIcon}
          alt=""
          aria-hidden="true"
          className="relative h-16 w-16 object-contain opacity-90"
          style={{ animation: "loader-breath 2.4s ease-in-out infinite" }}
          draggable={false}
        />
      </div>

      {/* Texto opcional, bem discreto */}
      {(message || subMessage) && (
        <div className="mt-6 text-center px-6">
          {message && (
            <div className="text-foreground/55 text-[11px] font-medium tracking-[0.18em] uppercase">
              {message}
            </div>
          )}
          {subMessage && (
            <div className="mt-1 text-foreground/35 text-[10px] tracking-wide uppercase">
              {subMessage}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes loader-breath {
          0%, 100% { opacity: 0.55; transform: scale(0.97); }
          50%      { opacity: 1;    transform: scale(1.03); }
        }
      `}</style>
    </div>
  );
}
