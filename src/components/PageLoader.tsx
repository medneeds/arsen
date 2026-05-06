import { motion } from "framer-motion";
import { whitelabel } from "@/config/whitelabel";

interface PageLoaderProps {
  /** Optional label, defaults to "Carregando módulo…" */
  label?: string;
  /** When true, fills the entire viewport instead of inline 60vh */
  fullscreen?: boolean;
}

/**
 * Branded suspense fallback used by lazy routes.
 * - Pulsing brand mark
 * - Indeterminate shimmer bar (semantic tokens)
 * - Respects prefers-reduced-motion via framer-motion
 */
export function PageLoader({ label = "Carregando módulo…", fullscreen = false }: PageLoaderProps) {
  return (
    <div
      className={
        (fullscreen ? "fixed inset-0 z-40 " : "min-h-[60vh] ") +
        "flex flex-col items-center justify-center bg-background"
      }
      role="status"
      aria-live="polite"
    >
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08),transparent_70%)]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex flex-col items-center gap-5"
      >
        {/* Brand mark with pulse halo */}
        <div className="relative h-12 w-12">
          <motion.div
            className="absolute inset-0 rounded-2xl bg-primary/10"
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 rounded-2xl border border-primary/30 bg-card flex items-center justify-center">
            <span
              className="preserve-case text-sm font-semibold tracking-[0.2em] text-primary"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              {whitelabel.platform.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Indeterminate shimmer bar */}
        <div className="relative h-[3px] w-44 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "300%" }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <p className="preserve-case text-[10px] tracking-[0.25em] uppercase text-muted-foreground font-semibold">
          {label}
        </p>
      </motion.div>
    </div>
  );
}
