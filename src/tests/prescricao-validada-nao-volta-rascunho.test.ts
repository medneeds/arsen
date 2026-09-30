/**
 * TESTE: Prescricao validada nunca volta a rascunho (exceto virada 05h) + regras
 * de item (suspender vs excluir).
 *
 * Regra clinica (definida pelo Artur):
 *  1. Uma prescricao VALIDADA jamais retorna para rascunho — SO retorna na virada
 *     do plantao as 05h do dia seguinte.
 *  2. No periodo validado, a prescricao persiste como padrao no corpo; os itens
 *     so podem ser SUSPENSOS, nao excluidos.
 *  3. Itens em RASCUNHO podem ser excluidos ou validados, mas NAO suspensos.
 *
 * Causa raiz do bug original (PrescricaoPage.tsx):
 *  - persistItems recomputava o status a cada save (draft/validated/signed) e a
 *    guarda so protegia 'signed'. Um autosave/edicao em que nem todo item ativo
 *    estava validado (ex.: item novo) rebaixava a linha validada para 'draft'
 *    silenciosamente — e o card do Hub/Painel lia 'draft'.
 *  - A virada das 05h ja e tratada no CARREGAMENTO (loadValidatedPrescription):
 *    ao cruzar a janela, renova os itens (validated=false) numa NOVA linha
 *    (currentPrescriptionId=null -> INSERT), preservando a linha validada anterior
 *    para auditoria. Ou seja, o rebaixamento legitimo acontece por criacao de
 *    nova linha, nunca por update da linha validada.
 *
 * Este teste replica os predicados exatos aplicados no fix e roda a matriz de
 * casos de borda. Dados ficticios | Zero impacto em producao.
 */

// ── Replica do predicado de status em persistItems (branch de update) ──────────
// Espelha PrescricaoPage.tsx: apos a guarda de 'signed', se a linha existente e
// 'validated', sem nova assinatura, e o status recomputado seria 'draft', o
// status e preservado como 'validated'. O update AINDA acontece (persiste itens,
// ex.: suspensao) — so o rebaixamento do status e barrado.
type Status = "draft" | "validated" | "signed";

function resolvePersistedStatus(args: {
  existingStatus: Status;      // status da linha no banco
  computedStatus: Status;      // status recomputado a partir dos itens
  hasSignature: boolean;       // ha nova assinatura digital (sig)
  isUpdateOfSameRow: boolean;  // currentPrescriptionId aponta para a linha (update, nao insert)
}): { action: "skip" | "update" | "insert"; status: Status } {
  const { existingStatus, computedStatus, hasSignature, isUpdateOfSameRow } = args;

  // INSERT (nova linha — inclui a renovacao pos-05h, que zera validacao): grava o
  // status recomputado tal e qual.
  if (!isUpdateOfSameRow) return { action: "insert", status: computedStatus };

  // Assinado sem nova assinatura -> nao rebaixa (skip do update).
  if (existingStatus === "signed" && !hasSignature) return { action: "skip", status: "signed" };

  // Validada sem nova assinatura: nunca rebaixa para rascunho dentro do dia.
  let status = computedStatus;
  if (existingStatus === "validated" && !hasSignature && computedStatus === "draft") {
    status = "validated";
  }
  return { action: "update", status };
}

// ── Replica das regras de elegibilidade de item ───────────────────────────────
// Espelha PrescricaoPage.tsx: suspender exige item validado; excluir exige item
// NAO validado (rascunho). "validado hoje" = validated && dentro da janela do dia.
function canSuspendItem(item: { validated: boolean }): boolean {
  return item.validated === true;
}
function canDeleteItem(item: { validated: boolean }): boolean {
  return item.validated !== true;
}

// ── Runner minimo ─────────────────────────────────────────────────────────────
let total = 0;
let falhas = 0;
function check(label: string, cond: boolean, detail?: string) {
  total++;
  if (cond) {
    console.log(`  OK  ${label}`);
  } else {
    falhas++;
    console.error(`FALHA  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("=== Status: validada nunca volta a rascunho dentro do dia ===");
{
  // 1) Autosave numa validada com item novo nao-validado (computa 'draft'): mantem validated.
  const r1 = resolvePersistedStatus({ existingStatus: "validated", computedStatus: "draft", hasSignature: false, isUpdateOfSameRow: true });
  check("autosave nao rebaixa validada -> permanece validated", r1.status === "validated" && r1.action === "update", JSON.stringify(r1));

  // 2) Validada continua validada quando todos os itens seguem validados.
  const r2 = resolvePersistedStatus({ existingStatus: "validated", computedStatus: "validated", hasSignature: false, isUpdateOfSameRow: true });
  check("validada com tudo validado -> validated", r2.status === "validated", JSON.stringify(r2));

  // 3) Suspender todos os itens ativos (computa 'draft' por nao haver ativo): mantem validated.
  const r3 = resolvePersistedStatus({ existingStatus: "validated", computedStatus: "draft", hasSignature: false, isUpdateOfSameRow: true });
  check("suspender tudo nao rebaixa a validada", r3.status === "validated", JSON.stringify(r3));

  // 4) Assinatura nova promove/mantem 'signed' (nao e barrado pela regra da validada).
  const r4 = resolvePersistedStatus({ existingStatus: "validated", computedStatus: "signed", hasSignature: true, isUpdateOfSameRow: true });
  check("assinatura -> signed", r4.status === "signed", JSON.stringify(r4));

  // 5) Assinada sem nova assinatura -> skip (nao rebaixa).
  const r5 = resolvePersistedStatus({ existingStatus: "signed", computedStatus: "draft", hasSignature: false, isUpdateOfSameRow: true });
  check("assinada nao rebaixa (skip)", r5.action === "skip" && r5.status === "signed", JSON.stringify(r5));

  // 6) Virada 05h: renovacao cria NOVA linha (insert) como rascunho — legitimo.
  const r6 = resolvePersistedStatus({ existingStatus: "draft", computedStatus: "draft", hasSignature: false, isUpdateOfSameRow: false });
  check("renovacao pos-05h grava nova linha em rascunho", r6.action === "insert" && r6.status === "draft", JSON.stringify(r6));

  // 7) Rascunho editado segue rascunho (fluxo normal antes de validar).
  const r7 = resolvePersistedStatus({ existingStatus: "draft", computedStatus: "draft", hasSignature: false, isUpdateOfSameRow: true });
  check("rascunho segue rascunho", r7.status === "draft" && r7.action === "update", JSON.stringify(r7));

  // 8) Rascunho -> validado (primeira validacao) grava validated.
  const r8 = resolvePersistedStatus({ existingStatus: "draft", computedStatus: "validated", hasSignature: false, isUpdateOfSameRow: true });
  check("primeira validacao grava validated", r8.status === "validated", JSON.stringify(r8));
}

console.log("\n=== Regras de item: suspender vs excluir ===");
{
  const validado = { validated: true };
  const rascunho = { validated: false };

  check("item validado PODE ser suspenso", canSuspendItem(validado) === true);
  check("item validado NAO pode ser excluido", canDeleteItem(validado) === false);
  check("item rascunho NAO pode ser suspenso", canSuspendItem(rascunho) === false);
  check("item rascunho PODE ser excluido", canDeleteItem(rascunho) === true);

  // Lote: so os validados sao suspensos; rascunhos ficam.
  const selecao = [{ id: "a", validated: true }, { id: "b", validated: false }, { id: "c", validated: true }];
  const suspensos = selecao.filter(canSuspendItem).map(i => i.id);
  check("suspensao em lote atinge so validados", JSON.stringify(suspensos) === JSON.stringify(["a", "c"]), JSON.stringify(suspensos));

  // Lote: exclusao atinge so rascunhos; validados ficam.
  const excluidos = selecao.filter(canDeleteItem).map(i => i.id);
  check("exclusao em lote atinge so rascunhos", JSON.stringify(excluidos) === JSON.stringify(["b"]), JSON.stringify(excluidos));
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificacoes passaram`);
if (falhas > 0) {
  console.error(`${falhas} FALHA(S)`);
  process.exit(1);
}
console.log("Todos os casos passaram.\n");
