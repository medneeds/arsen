/**
 * Idle-time prefetch of high-traffic clinical routes.
 * Runs once after first paint, in low priority, so navigations between
 * Painel ↔ Prescrição ↔ Evolução ↔ Cockpit feel instant after warmup.
 *
 * Each entry is a thunk that triggers Vite's dynamic import and warms
 * the chunk cache. Failures are swallowed (offline / network blip).
 */
const PREFETCHERS: Array<() => Promise<unknown>> = [
  () => import("@/pages/PainelClinicoPage"),
  () => import("@/pages/PrescricaoPage"),
  () => import("@/pages/EvolucaoPage"),
  () => import("@/pages/PacienteHubPage"),
  () => import("@/pages/RequisicaoUnificadaPage"),
  () => import("@/pages/MovimentacoesPage"),
  () => import("@/pages/AltaDesfechoPage"),
  () => import("@/pages/DocumentosPacientePage"),
  () => import("@/pages/ClinicalDashboardPage"),
];

let started = false;

export function startIdlePrefetch() {
  if (started) return;
  started = true;
  if (typeof window === "undefined") return;

  const schedule = (cb: () => void) => {
    const ric = (window as any).requestIdleCallback as
      | ((cb: IdleRequestCallback, opts?: { timeout: number }) => number)
      | undefined;
    if (ric) ric(() => cb(), { timeout: 4000 });
    else setTimeout(cb, 1500);
  };

  schedule(() => {
    // Stagger to avoid network bursts on slow connections
    PREFETCHERS.forEach((load, i) => {
      setTimeout(() => {
        load().catch(() => {
          /* prefetch best-effort */
        });
      }, i * 250);
    });
  });
}
