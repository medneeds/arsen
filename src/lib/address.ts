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

/** Reverso best-effort de buildEnderecoLine, para pre-preencher os campos ao
 *  editar um endereco que esta gravado como texto unico em pacientes.endereco.
 *  Formato esperado: "logradouro - bairro - Cidade/UF - CEP 00000-000".
 *  Partes nao reconhecidas viram logradouro/bairro na ordem. Enderecos legados
 *  sem o separador " - " caem inteiros no logradouro (o editor ajusta). */
export function parseEnderecoLine(line: string | null | undefined): AddressValue {
  const s = (line ?? "").trim();
  if (!s) return { ...EMPTY_ADDRESS };
  const parts = s.split(" - ").map((p) => p.trim()).filter(Boolean);
  const out: AddressValue = { ...EMPTY_ADDRESS };
  const rest: string[] = [];
  for (const p of parts) {
    const cepM = p.match(/^CEP\s+(.+)$/i);
    if (cepM) { out.cep = cepM[1].trim(); continue; }
    const cityUfM = p.match(/^(.+)\/([A-Za-z]{2})$/);
    if (cityUfM && !out.city) { out.city = cityUfM[1].trim(); out.state = cityUfM[2].toUpperCase(); continue; }
    rest.push(p);
  }
  out.address = rest[0] ?? "";
  out.neighborhood = rest[1] ?? "";
  return out;
}
