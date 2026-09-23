// Estado de impersonação do super_admin ("logar como admin da unidade").
//
// Guardamos a sessão do super_admin (access + refresh) em sessionStorage antes
// de trocar para a sessão do admin, para poder VOLTAR depois. sessionStorage é
// por-aba e some ao fechar — o refresh_token fica só enquanto a impersonação
// dura, e o setSession no retorno reautentica (renovando via refresh se o
// access_token do super_admin já tiver expirado).

const KEY = "arsen_impersonation";

export interface ImpersonationState {
  /** Sessão do super_admin, para restaurar no "Voltar". */
  origin: { access_token: string; refresh_token: string };
  /** Quem está sendo impersonado (para exibir no banner). */
  target: { nome: string; email: string; hospitalNome: string };
}

export function getImpersonation(): ImpersonationState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ImpersonationState) : null;
  } catch {
    return null;
  }
}

export function setImpersonation(state: ImpersonationState) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function clearImpersonation() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
