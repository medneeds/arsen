/**
 * De-para do status de `solicitacoes_exame` entre o VIEW-MODEL (inglês, usado
 * pelas telas de requisição e pelos setores de imagem/laboratório) e o BANCO
 * (CHECK `solicitacoes_exame_status_check`: pendente | em_andamento | concluido | cancelado).
 *
 * O código antigo gravava valores em inglês ("pending"/"completed"/"cancelled")
 * e até "solicitado" → violava o CHECK e QUALQUER solicitação/atualização falhava
 * ("new row for relation solicitacoes_exame violates check constraint ...").
 *
 * DEGRADAÇÃO: o fluxo dos setores tinha um estado "acknowledged" (ciência) que
 * NÃO existe no schema novo. Ele é mapeado para `em_andamento` na escrita; na
 * leitura `em_andamento` volta como "in_progress". Ou seja, "Ciência" e "Em
 * Execução" passam a compartilhar o mesmo estado no banco (sem coluna própria,
 * não há como distinguir sem inventar dado).
 */
export type SolicitacaoStatusDb = "pendente" | "em_andamento" | "concluido" | "cancelado";

const VM_TO_DB: Record<string, SolicitacaoStatusDb> = {
  pending: "pendente",
  solicitado: "pendente",
  acknowledged: "em_andamento", // degradado: ciência não tem estado próprio
  in_progress: "em_andamento",
  completed: "concluido",
  cancelled: "cancelado",
  // aceita já-em-português (idempotente)
  pendente: "pendente",
  em_andamento: "em_andamento",
  concluido: "concluido",
  cancelado: "cancelado",
};

const DB_TO_VM: Record<SolicitacaoStatusDb, string> = {
  pendente: "pending",
  em_andamento: "in_progress",
  concluido: "completed",
  cancelado: "cancelled",
};

/** View-model (inglês) → banco (português). Default: pendente. */
export function toSolicitacaoStatusDb(vm: string | null | undefined): SolicitacaoStatusDb {
  return VM_TO_DB[(vm ?? "").toString()] ?? "pendente";
}

/** Banco (português) → view-model (inglês). Aceita já-em-inglês por robustez. Default: pending. */
export function fromSolicitacaoStatusDb(db: string | null | undefined): string {
  const v = (db ?? "").toString();
  if (v in DB_TO_VM) return DB_TO_VM[v as SolicitacaoStatusDb];
  return v || "pending";
}
