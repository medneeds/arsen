/**
 * De-para do status de `evolucoes` entre o VIEW-MODEL (inglês, estável, usado por
 * ~todos os consumidores) e o BANCO (CHECK `evolucoes_status_check` em português:
 * rascunho | validada | suspensa).
 *
 * O código antigo gravava direto os valores em inglês (draft/validated/suspended)
 * → violava o CHECK e a admissão/validação/suspensão falhava
 * ("new row for relation evolucoes violates check constraint evolucoes_status_check").
 * Toda escrita passa por toEvolucaoStatusDb; toda leitura por fromEvolucaoStatusDb.
 */
export type EvolucaoStatusVm = "draft" | "validated" | "suspended";
export type EvolucaoStatusDb = "rascunho" | "validada" | "suspensa";

const VM_TO_DB: Record<EvolucaoStatusVm, EvolucaoStatusDb> = {
  draft: "rascunho",
  validated: "validada",
  suspended: "suspensa",
};
const DB_TO_VM: Record<EvolucaoStatusDb, EvolucaoStatusVm> = {
  rascunho: "draft",
  validada: "validated",
  suspensa: "suspended",
};

/** View-model (inglês) → banco (português). Default: rascunho. */
export function toEvolucaoStatusDb(vm: string | null | undefined): EvolucaoStatusDb {
  return VM_TO_DB[(vm ?? "") as EvolucaoStatusVm] ?? "rascunho";
}

/** Banco (português) → view-model (inglês). Aceita já-em-inglês por robustez. Default: draft. */
export function fromEvolucaoStatusDb(db: string | null | undefined): EvolucaoStatusVm {
  const v = (db ?? "") as string;
  if (v in DB_TO_VM) return DB_TO_VM[v as EvolucaoStatusDb];
  if (v === "draft" || v === "validated" || v === "suspended") return v; // passthrough defensivo
  return "draft";
}
