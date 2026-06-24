## Diagnóstico confirmado

`supabase/functions/backup-restore/index.ts` linhas 961-985 (Pass B do `handleFinalize`):

```ts
const CHUNK = 500;
for (let i = 0; i < parentIds.length; i += CHUNK) {
  const chunk = parentIds.slice(i, i + CHUNK);
  const { data } = await admin.from(tbl).select("id").in("id", chunk);  // ← erro silenciado
  for (const r of (data ?? [])) existing.add(String((r as any).id));
}
for (const [childId, parentId] of entries) {
  if (!existing.has(String(parentId))) { parentIdDropped++; continue; }  // ← qualquer falha vira "dropped"
  ...
}
```

Dois problemas, exatamente como diagnosticado:
1. `CHUNK=500` UUIDs em `.in("id", chunk)` excede o limite de URL do PostgREST (~8KB). 500 × ~40 chars ≈ 20KB → request falha com 414/400.
2. `const { data } = ...` ignora `error`. Quando falha, `data=null`, o `existing` set fica vazio, e **todos** os 1.872 vínculos caem no ramo `dropped`. Bate 1:1 com `relinked=0, dropped=1872`.

## Correção (única, escopada ao bloco 972-983)

```ts
const existing = new Set<string>();
const lookupFailed = new Set<string>();   // chunks onde a verificação falhou
const CHUNK = 100;                         // mesmo padrão do handleStep
for (let i = 0; i < parentIds.length; i += CHUNK) {
  const chunk = parentIds.slice(i, i + CHUNK);
  const { data, error: selErr } = await admin.from(tbl).select("id").in("id", chunk);
  if (selErr) {
    console.error(`[backup-restore] Pass B lookup falhou em ${tbl} chunk ${i}-${i+chunk.length}:`, selErr.message);
    // Fail-safe: marca os parentIds deste chunk como "verificação inconclusiva"
    // — NÃO dropa; deixa o UPDATE tentar e o FK do banco decidir.
    for (const pid of chunk) lookupFailed.add(String(pid));
    continue;
  }
  for (const r of (data ?? [])) existing.add(String((r as any).id));
}

for (const [childId, parentId] of entries) {
  const pidStr = String(parentId);
  const verified = existing.has(pidStr);
  const inconclusive = !verified && lookupFailed.has(pidStr);
  // Só dropa quando temos CERTEZA de que o pai não existe (lookup ok + ausente)
  if (!verified && !inconclusive) { parentIdDropped++; continue; }
  const { error: uErr } = await admin.from(tbl).update({ parent_id: parentId }).eq("id", childId);
  if (uErr) parentIdDropped++; else parentIdRelinked++;
}
```

Mudanças:
- `CHUNK: 500 → 100`.
- Captura `selErr` e loga.
- Conjunto `lookupFailed` para chunks com erro: parentIds desses chunks tentam o UPDATE assim mesmo (FK do banco é a verdade final).
- "Dropped" só conta quando o lookup funcionou E o pai realmente não está presente — ou quando o UPDATE retornou erro.

## Não muda

- Nada fora desse bloco (947-985).
- Caminho principal de restore, `pending_parent_id_fixups`, ordem de tabelas, auditoria, UI — tudo intacto.
- Sem migração de banco.

## Validação após aplicar

1. Re-rodar o restore do mesmo backup.
2. Esperado no `report`: `parent_id_relinked` próximo de 1872; `parent_id_dropped` baixo (só órfãos genuínos, que vão aparecer também como erros de FK no UPDATE).
3. Conferir nos logs da edge function: se houver `[backup-restore] Pass B lookup falhou`, investigar separadamente — mas o restore não terá mais perdido vínculos por causa disso.

Confirma para eu aplicar?
