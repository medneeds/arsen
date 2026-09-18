/**
 * O login deve ler `profiles` UMA vez, nao quatro.
 *
 * Origem (auditoria de 18/09/2026): AuthPage, AuthContext, ProtectedRoute e
 * ProfileIpGate faziam a mesma consulta, para o mesmo usuario, em quatro idas
 * e voltas independentes. A 246ms de RTT medidos, eram ~750ms perdidos no
 * caminho mais sensivel do sistema.
 *
 * Rodar com: npx tsx src/tests/perfil-uma-consulta-so.test.ts
 */
import {
  buscarPerfilDoUsuario,
  limparPerfilEmCache,
  JANELA_DE_REUSO_MS,
  type RespostaPerfil,
} from "../lib/perfilDoUsuario.ts";

let ok = 0;
let falhas = 0;
function check(nome: string, condicao: boolean) {
  if (condicao) { ok++; console.log(`  OK   ${nome}`); }
  else { falhas++; console.log(`  FALHA ${nome}`); }
}

function buscadorFalso(resposta: RespostaPerfil, atraso = 5) {
  const estado = { chamadas: 0 };
  const fn = (_userId: string) =>
    new Promise<RespostaPerfil>((r) => {
      estado.chamadas++;
      setTimeout(() => r(resposta), atraso);
    });
  return { fn, estado };
}

const PERFIL: RespostaPerfil = {
  data: { id: "u1", full_name: "MEDICO TESTE", access_profile: "medico", status: "approved" },
  error: null,
};

async function main() {
  console.log("  TESTE: perfil do usuario — uma consulta so\n");

  console.log("=== A rajada do login (4 consumidores quase simultaneos) ===");
  limparPerfilEmCache();
  let b = buscadorFalso(PERFIL);
  const quatro = await Promise.all([
    buscarPerfilDoUsuario("u1", b.fn),
    buscarPerfilDoUsuario("u1", b.fn),
    buscarPerfilDoUsuario("u1", b.fn),
    buscarPerfilDoUsuario("u1", b.fn),
  ]);
  check("4 chamadas viram 1 ida ao servidor", b.estado.chamadas === 1);
  check("os 4 recebem o mesmo perfil", quatro.every((r) => r.data?.id === "u1"));

  console.log("\n=== Reuso dentro da janela, ida nova depois dela ===");
  limparPerfilEmCache();
  b = buscadorFalso(PERFIL);
  let relogio = 1_000_000;
  const agora = () => relogio;
  await buscarPerfilDoUsuario("u1", b.fn, { agora });
  await buscarPerfilDoUsuario("u1", b.fn, { agora });
  check("segunda chamada logo depois reaproveita", b.estado.chamadas === 1);
  relogio += JANELA_DE_REUSO_MS + 1;
  await buscarPerfilDoUsuario("u1", b.fn, { agora });
  check("passada a janela, vai ao servidor de novo", b.estado.chamadas === 2);

  console.log("\n=== Seguranca: usuario diferente nunca reaproveita ===");
  limparPerfilEmCache();
  b = buscadorFalso(PERFIL);
  await buscarPerfilDoUsuario("u1", b.fn);
  await buscarPerfilDoUsuario("u2", b.fn);
  check("troca de usuario forca consulta nova", b.estado.chamadas === 2);

  console.log("\n=== Seguranca: logout descarta o perfil ===");
  limparPerfilEmCache();
  b = buscadorFalso(PERFIL);
  await buscarPerfilDoUsuario("u1", b.fn);
  limparPerfilEmCache();
  await buscarPerfilDoUsuario("u1", b.fn);
  check("apos limpar, consulta de novo", b.estado.chamadas === 2);

  console.log("\n=== Erro nao fica grudado no cache ===");
  limparPerfilEmCache();
  const comErro = buscadorFalso({ data: null, error: { message: "rede" } });
  await buscarPerfilDoUsuario("u1", comErro.fn);
  await buscarPerfilDoUsuario("u1", comErro.fn);
  check("falha transitoria e retentada, nao memorizada", comErro.estado.chamadas === 2);

  console.log("\n=== forcar ignora o cache (refreshUserStatus) ===");
  limparPerfilEmCache();
  b = buscadorFalso(PERFIL);
  await buscarPerfilDoUsuario("u1", b.fn);
  await buscarPerfilDoUsuario("u1", b.fn, { forcar: true });
  check("forcar vai ao servidor", b.estado.chamadas === 2);

  console.log("\n" + "-".repeat(50));
  console.log(`${ok}/${ok + falhas} verificacoes passaram`);
  if (falhas > 0) { console.log(`${falhas} FALHA(S)`); process.exit(1); }
}

main();
