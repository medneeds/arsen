/**
 * Tipos e helpers de endereco (compartilhados pelo componente AddressFields e
 * pelos forms que o consomem). Mantidos fora do .tsx do componente para o
 * fast-refresh do Vite (um arquivo de componente so deve exportar componentes).
 *
 * Nota de dados: a tabela `pacientes` so tem a coluna `endereco`. As partes
 * (cep/logradouro/bairro/cidade/UF) vivem em memoria no form e sao concatenadas
 * em `endereco` por buildEnderecoLine na gravacao.
 */
export interface AddressValue {
  cep: string;
  address: string; // logradouro + numero
  neighborhood: string; // bairro
  city: string;
  state: string; // UF (sigla)
}

export const EMPTY_ADDRESS: AddressValue = {
  cep: "",
  address: "",
  neighborhood: "",
  city: "",
  state: "",
};

/** Concatena as partes num unico texto para gravar em pacientes.endereco. */
export function buildEnderecoLine(v: AddressValue): string {
  const cidadeUf = [v.city.trim(), v.state.trim()].filter(Boolean).join("/");
  const partes = [
    v.address.trim(),
    v.neighborhood.trim(),
    cidadeUf,
    v.cep.trim() ? `CEP ${v.cep.trim()}` : "",
  ].filter(Boolean);
  return partes.join(" - ");
}
