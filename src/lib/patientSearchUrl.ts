/** Campos do resultado de busca que entram na URL do painel do paciente. */
export interface PacienteParaUrl {
  id: string;
  name: string;
  bedNumber: string;
  sectorCode: string;
  age: string | null;
  medicalRecord: string | null;
}

/**
 * Monta a URL do painel do paciente a partir de um resultado de busca.
 * URLSearchParams cuida do escape: nomes com acento, "&", "#" ou "+" nao podem
 * quebrar nem truncar os parametros (o que abriria o paciente errado).
 */
export function montarUrlPaciente(p: PacienteParaUrl): string {
  const params = new URLSearchParams({
    patientId: p.id,
    patientName: p.name,
    patientBed: p.bedNumber,
    patientSector: p.sectorCode,
  });
  if (p.age) params.set("patientAge", p.age);
  if (p.medicalRecord) params.set("patientRecord", p.medicalRecord);
  return `/paciente?${params.toString()}`;
}
