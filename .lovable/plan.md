## Objetivo

Eliminar definitivamente o erro `function min(uuid) does not exist` no row-fallback de `backup-restore`, contornando o caminho merge-duplicates do PostgREST que dispara o bug quando uma linha tem múltiplas colunas uuid nulas simultaneamente (caso real: `prescriptions` com `parent_id`, `encounter_id`, `patient_registry_id`, `archived_from_patient_id`, `repointed_from_patient_id` todos null).

## Mudança única em `supabase/functions/backup-restore/index.ts`

Bloco do row-fallback (linhas ~765-790, dentro de `for (const row of slice)` no branch `if (/min\(uuid\)/i.test(msg))`).

Substituir a chamada `admin.from(table).upsert([rowNormalized], { onConflict })` por um padrão check-then-branch usando a PK já conhecida (`pk: string[]`):

```ts
for (const row of slice) {
  const rowNormalized = normalizeShape([row], shapeKeys)[0];

  // Contorna bug do PostgREST merge-duplicates com múltiplos uuid nulos:
  // resolve INSERT vs UPDATE explicitamente via select pela PK.
  const pkMatch = Object.fromEntries(
    pk.map((c) => [c, (rowNormalized as any)[c]])
  );
  let e1: any = null;
  try {
    const { data: existingRow, error: selErr } = await admin
      .from(table)
      .select(pk.join(","))
      .match(pkMatch)
      .maybeSingle();
    if (selErr) {
      e1 = selErr;
    } else if (existingRow) {
      const updatePayload: Record<string, unknown> = { ...rowNormalized };
      for (const c of pk) delete updatePayload[c];
      ({ error: e1 } = await admin.from(table).update(updatePayload).match(pkMatch));
    } else {
      ({ error: e1 } = await admin.from(table).insert(rowNormalized));
    }
  } catch (ex) {
    e1 = ex instanceof Error ? ex : new Error(String(ex));
  }

  if (e1) {
    errors++;
    if (errorSamples.length < 3) {
      // mantém dump existente — se min(uuid) ainda aparecer aqui, é outra causa
      if (/min\(uuid\)/i.test(e1.message ?? "")) {
        // (bloco de dump preservado tal como está hoje)
      } else {
        errorSamples.push(`row-fallback ${table}: ${e1.message}`);
      }
    }
  } else {
    processed++;
  }
}
```

Toda a lógica de diagnóstico (dump de payload em `errorSamples`) fica intacta — só passa a ser efetivamente "dead code" sob condições normais, o que é desejável (continua servindo como sentinela se algum dia o bug reaparecer por outra rota).

## Não muda

- Caminho principal em lote (`admin.from(table).upsert(slice, { onConflict })`) — segue como está; só o fallback troca de estratégia.
- `normalizeShape`, `nullable_by_table`, FK orphan handling, two-pass `parent_id`, catálogo, `user_roles`, auth, UI.
- Nenhuma migração de banco.

## Resposta à pergunta sobre generalizar pro caminho principal

Recomendação: **manter só no fallback por agora.** Justificativa para incluir junto da resposta ao usuário:

- O caminho principal em lote (`upsert(slice)`) processa centenas de linhas por chamada; trocar por select+insert/update viraria N+1 round-trips por lote — perda de performance significativa em restores grandes.
- O bug `min(uuid)` no caminho principal já é mitigado de forma barata pela normalização global de shape (`normalizedRows = normalizeShape(allRows)`), que dá ao PostgREST um conjunto-união de chaves uniforme e elimina a maioria das ocorrências.
- O fallback é, por contrato, o "último recurso" (raríssimo, ~3 linhas em milhares): aí o custo do N+1 é irrelevante e a robustez compensa.
- Se no futuro o `min(uuid)` voltar a aparecer **em lote** para outra tabela com muitas colunas uuid nulas, a saída preferida é melhorar a normalização (ex: detectar colunas uuid 100% nulas no lote e dropá-las antes do upsert, deixando o default do banco assumir null) — não trocar o caminho principal por select+insert/update.

## Verificação após aplicar

1. Próximo restore: `prescriptions` deixa de produzir `errors=3 (min(uuid))`; as 3 linhas problemáticas entram via insert/update e o relatório fecha em 0 erros para esse part.
2. `errorSamples` para `prescriptions` fica vazio (ou só registra erros genuínos de FK/constraint, não mais PostgREST interno).
3. Comportamento das outras tabelas inalterado.
