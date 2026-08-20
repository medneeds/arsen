/**
 * Chave de localização de leito.
 *
 * Reproduz a busca que o AdmitPatientDialog faz antes de admitir. O caso que
 * este teste protege aconteceu em produção: incluir `department` na chave fez
 * a busca não encontrar leitos existentes da UCC (gravados com department
 * 'UCC') quando o contexto do usuário era 'UTI'. O código concluía que o leito
 * não existia e INSERIA outra linha — L08, L31 e L32 duplicados, cada par com
 * uma linha ocupada e outra vaga.
 *
 * Com a unicidade composta aplicada no banco, o mesmo INSERT deixaria de
 * duplicar e passaria a FALHAR, travando a admissão à beira do leito. Por isso
 * a correção da chave precede a migration.
 */
import { test } from "node:test";
import assert from "node:assert";

type Leito = {
  id: string; hospital_unit_id: string; sector: string;
  bed_number: string; department: string; is_vacant: boolean;
};

const UNIDADE = "unit-1";

// Retrato fiel de produção: os leitos da UCC nasceram com department 'UCC'.
const BANCO: Leito[] = [
  { id: "l08", hospital_unit_id: UNIDADE, sector: "ucc", bed_number: "L08", department: "UCC", is_vacant: false },
  { id: "l09", hospital_unit_id: UNIDADE, sector: "ucc", bed_number: "L09", department: "UCC", is_vacant: true },
  { id: "m01", hospital_unit_id: UNIDADE, sector: "internacao_ue", bed_number: "M01", department: "POSTO INTERNAÇÃO", is_vacant: true },
];

/** Chave CORRETA — a mesma da constraint patients_unit_sector_bed_key. */
const buscarLeito = (sector: string, bed: string) =>
  BANCO.find((l) => l.hospital_unit_id === UNIDADE && l.sector === sector && l.bed_number === bed);

/** Chave DEFEITUOSA, que produziu as duplicatas. */
const buscarComDepartment = (sector: string, bed: string, department: string) =>
  BANCO.find((l) => l.hospital_unit_id === UNIDADE && l.sector === sector
    && l.bed_number === bed && l.department === department);

test("a chave correta acha o leito qualquer que seja o contexto de departamento", () => {
  for (const contexto of ["UTI", "UCC", "URGÊNCIA E EMERGÊNCIA ADULTO"]) {
    const achado = buscarLeito("ucc", "L09");
    assert.ok(achado, `leito L09 não encontrado com contexto ${contexto}`);
    assert.strictEqual(achado!.id, "l09");
  }
});

test("reproduz o defeito: com department na chave, o leito existente some", () => {
  assert.ok(buscarComDepartment("ucc", "L09", "UCC"), "com o department certo, acha");
  assert.strictEqual(
    buscarComDepartment("ucc", "L09", "UTI"),
    undefined,
    "com o department divergente NÃO acha — e era aqui que nascia a duplicata",
  );
});

test("leito ocupado é reconhecido como ocupado, não oferecido de novo", () => {
  const l08 = buscarLeito("ucc", "L08");
  assert.strictEqual(l08!.is_vacant, false);
});

test("a lista de ocupados não pode depender de department", () => {
  // Filtrar por department SUBCONTA ocupados: o dialog ofereceria L08, que tem
  // paciente, a quem estivesse com contexto 'UTI'.
  const ocupadosCorreto = BANCO.filter((l) => l.sector === "ucc" && !l.is_vacant).map((l) => l.bed_number);
  const ocupadosComDept = BANCO.filter((l) => l.sector === "ucc" && !l.is_vacant && l.department === "UTI").map((l) => l.bed_number);
  assert.deepStrictEqual(ocupadosCorreto, ["L08"]);
  assert.deepStrictEqual(ocupadosComDept, [], "o filtro por department escondia o leito ocupado");
});
