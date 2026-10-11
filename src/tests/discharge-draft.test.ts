import { test } from "node:test";
import assert from "node:assert/strict";
import { saveDraft, loadDraft, clearDrafts, DISCHARGE_DRAFT_TTL_MS, draftKey, type StorageLike } from "../lib/dischargeDraft.ts";

function mem(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

test("salva e le so os campos do bloco", () => {
  const s = mem();
  saveDraft(s, "p1", "alta_hospitalar", "summary", {
    final_diagnoses: "I50.0", signed_by_name: "DR X", patient_name: "FULANA", return_date: "2026-10-20",
  } as never, 1000);
  const r = loadDraft(s, "p1", "alta_hospitalar", "summary", 2000);
  assert.deepEqual(r?.values, { final_diagnoses: "I50.0" });
  assert.equal(s.map.get(draftKey("p1", "alta_hospitalar", "summary"))?.includes("signed_by_name"), false);
});

test("rascunho de outro paciente nao vaza", () => {
  const s = mem();
  saveDraft(s, "p1", "alta_hospitalar", "family", { family_contact_name: "MARIA" }, 1000);
  assert.equal(loadDraft(s, "p2", "alta_hospitalar", "family", 2000), null);
});

test("rascunho vencido (24h) e descartado", () => {
  const s = mem();
  saveDraft(s, "p1", "alta_hospitalar", "followup", { restrictions: "REPOUSO" }, 0);
  assert.equal(loadDraft(s, "p1", "alta_hospitalar", "followup", DISCHARGE_DRAFT_TTL_MS + 1), null);
  assert.equal(s.map.size, 0);
});

test("json corrompido nao quebra", () => {
  const s = mem();
  s.setItem(draftKey("p1", "obito", "summary"), "{nao e json");
  assert.equal(loadDraft(s, "p1", "obito", "summary"), null);
});

test("chaves de assinatura injetadas no armazenamento sao ignoradas na leitura", () => {
  const s = mem();
  s.setItem(draftKey("p1", "alta_hospitalar", "summary"), JSON.stringify({
    savedAt: 1000, values: { signed_by_crm: "123", orientations: "REPOUSO" },
  }));
  assert.deepEqual(loadDraft(s, "p1", "alta_hospitalar", "summary", 2000)?.values, { orientations: "REPOUSO" });
});

test("bloco sem nada preenchido nao deixa rascunho util", () => {
  const s = mem();
  saveDraft(s, "p1", "alta_hospitalar", "family", {}, 1000);
  assert.equal(loadDraft(s, "p1", "alta_hospitalar", "family", 2000), null);
});

test("sem storage nao quebra", () => {
  assert.equal(saveDraft(null, "p1", "alta_hospitalar", "summary", {}), false);
  assert.equal(loadDraft(null, "p1", "alta_hospitalar", "summary"), null);
  clearDrafts(null, "p1");
});

test("clearDrafts limpa todos os blocos da internacao", () => {
  const s = mem();
  saveDraft(s, "p1", "alta_hospitalar", "summary", { orientations: "X" }, 1000);
  saveDraft(s, "p1", "obito", "family", { family_contact_name: "Y" }, 1000);
  saveDraft(s, "p2", "alta_hospitalar", "summary", { orientations: "Z" }, 1000);
  clearDrafts(s, "p1");
  assert.equal(s.map.size, 1);
});
