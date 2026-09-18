/**
 * Pré-carregamento ocioso das rotas clínicas de maior tráfego.
 *
 * POR QUE SÓ DEPOIS DO LOGIN (16/09/2026)
 * Isto era disparado no `useEffect` do App, ou seja, já na TELA DE LOGIN —
 * antes de existir usuário autenticado. Quem só queria digitar usuário e senha
 * recebia, em segundo plano, 1,18 MB de rotas clínicas (a prescrição sozinha
 * tem 784 KB), somados aos 604 KB da entrada e aos vendors.
 *
 * O resultado era exatamente o sintoma relatado: tela de login lenta, login
 * demorado e transições travadas — a rede estava ocupada baixando telas que o
 * usuário ainda não tinha direito de ver.
 *
 * Agora o aquecimento começa quando há sessão. Chamado pelo ProtectedRoute,
 * que só monta com usuário autenticado.
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

  // AUDITORIA 18/09/2026 — o aquecimento saiu da tela de login (commit
  // b2c5f32f), mas passou a comecar no instante em que o usuario chega a
  // PRIMEIRA tela: o ProtectedRoute dispara assim que ha sessao. Essas 9 rotas
  // somam ~1,18 MB e competiam por banda exatamente com o chunk e as consultas
  // da tela que o usuario esta esperando ver.
  //
  // requestIdleCallback olha a ociosidade da CPU, nao a da REDE — a linha pode
  // estar saturada com a tela atual enquanto a thread principal esta livre.
  // Por isso a espera explicita antes de comecar: primeiro a tela do usuario
  // termina de carregar, depois aquecemos o resto.
  const ESPERA_ANTES_DE_AQUECER_MS = 5000;
  const INTERVALO_ENTRE_ROTAS_MS = 400;

  const schedule = (cb: () => void) => {
    const ric = (window as any).requestIdleCallback as
      | ((cb: IdleRequestCallback, opts?: { timeout: number }) => number)
      | undefined;
    if (ric) ric(() => cb(), { timeout: 10000 });
    else setTimeout(cb, 3000);
  };

  setTimeout(() => {
    schedule(() => {
      // Espacado para nao estourar a rede de uma vez em conexao ruim
      PREFETCHERS.forEach((load, i) => {
        setTimeout(() => {
          load().catch(() => {
            /* prefetch best-effort */
          });
        }, i * INTERVALO_ENTRE_ROTAS_MS);
      });
    });
  }, ESPERA_ANTES_DE_AQUECER_MS);
}
