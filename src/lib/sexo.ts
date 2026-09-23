// Normalização de sexo entre a convenção da UI (M/F/I/O) e o vocabulário do
// banco novo. A CHECK `pacientes_sexo_check` só aceita:
//   'masculino' | 'feminino' | 'outro' | 'nao_informado'
// (NULL também passa — a coluna é anulável). A UI histórica usa "M"/"F"/"I".
export type SexoDb = "masculino" | "feminino" | "outro" | "nao_informado";

/** UI (M/F/I/O, ou já em pt) → valor aceito pela CHECK do banco. '' → null. */
export function toSexoDb(v: string | null | undefined): SexoDb | null {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "") return null;
  if (["m", "masc", "masculino", "male", "homem"].includes(s)) return "masculino";
  if (["f", "fem", "feminino", "female", "mulher"].includes(s)) return "feminino";
  if (["o", "outro", "other"].includes(s)) return "outro";
  // i, ignorado, n/i, ni, desconhecido, nao_informado, "não informado"…
  if (["i", "ni", "n/i", "ignorado", "desconhecido", "nao_informado", "não informado", "nao informado", "não_informado"].includes(s))
    return "nao_informado";
  // Qualquer valor desconhecido não pode quebrar o INSERT → cai em nao_informado.
  return "nao_informado";
}

/** Banco (masculino/…) → código curto da UI (M/F/O/I). Aceita também M/F já curtos. */
export function fromSexoDb(v: string | null | undefined): "M" | "F" | "O" | "I" | "" {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "masculino") return "M";
  if (s === "feminino") return "F";
  if (s === "outro") return "O";
  if (s === "nao_informado") return "I";
  if (s === "m" || s === "f" || s === "o" || s === "i") return s.toUpperCase() as "M" | "F" | "O" | "I";
  return "";
}
