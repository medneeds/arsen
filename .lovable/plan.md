## Mudanças em `supabase/functions/backup-restore/index.ts`

### ITEM 1 — Adicionar colunas FK específicas ao `FK_PARENTS`

Confirmado no schema (pg_constraint): `internal_transfer_requests.source_patient_id` e `completed_target_patient_id` são FKs para `public.patients`, com `source_patient_id` NOT NULL + ON DELETE CASCADE e `completed_target_patient_id` NULLABLE + ON DELETE SET NULL. O código já decide anular vs dropar dinamicamente via `nullable_by_table` — basta registrar as colunas no mapa.

Linhas 55-61, expandir o mapa:

```ts
const FK_PARENTS: Record<string, string> = {
  patient_id: "patients",
  source_patient_id: "patients",            // internal_transfer_requests
  completed_target_patient_id: "patients",  // internal_transfer_requests
  registry_id: "patient_registry",
  patient_registry_id: "patient_registry",
  encounter_id: "patient_encounters",
  medical_record_id: "medical_records",
};
```

Resultado esperado: `source_patient_id` órfão → drop seletivo da linha (NOT NULL); `completed_target_patient_id` órfão → ANULA o campo, preserva a linha. O lote inteiro deixa de quebrar.

### ITEM 2 — Instrumentação de diagnóstico no row-fallback de `min(uuid)`

Apenas captura de payload, sem mudança de comportamento. Linhas 763-772, dentro do loop `for (const row of slice)` do branch `min(uuid)`:

```ts
for (const row of slice) {
  const rowNormalized = normalizeShape([row], shapeKeys)[0];
  const { error: e1 } = await admin.from(table).upsert([rowNormalized], { onConflict });
  if (e1) {
    errors++;
    if (errorSamples.length < 3) {
      // Diagnóstico só para o caso específico min(uuid) no row-fallback
      if (/min\(uuid\)/i.test(e1.message ?? "")) {
        let dump = "";
        try {
          const full = JSON.stringify(rowNormalized);
          dump = full.length <= 4000
            ? ` payload=${full}`
            : ` types=${Object.entries(rowNormalized)
                .map(([k, v]) => `${k}:${v === null ? "null" : Array.isArray(v) ? `array[${v.length}]` : typeof v}`)
                .join(",")}`;
        } catch {
          dump = ` types=${Object.entries(rowNormalized)
            .map(([k, v]) => `${k}:${typeof v}`).join(",")}`;
        }
        errorSamples.push(`row-fallback ${table}: ${e1.message}${dump}`);
      } else {
        errorSamples.push(`row-fallback ${table}: ${e1.message}`);
      }
    }
  } else {
    processed++;
  }
}
```

Limite ≤4000 chars no JSON completo para não estourar o campo de log; acima disso cai no resumo `chave:tipo`. Apenas dispara o dump quando o erro da linha individual também é `min(uuid)` — outros erros mantêm formato atual.

### Não muda

- Lógica de catálogo, `user_roles`, two-pass `parent_id`, dedupe, `nullable_by_table`, UI de relatório, migrações.
- Nenhuma tentativa de corrigir a causa do `min(uuid)` agora — só instrumentação.

### Verificação após aplicar

1. Próximo restore: `internal_transfer_requests` não trava mais o lote; relatório mostra anulações em `completed_target_patient_id` e/ou drops em `source_patient_id` conforme órfãs reais.
2. Se `prescriptions/part-0000` falhar de novo, `errorSamples` traz o shape exato da linha problemática para análise definitiva no próximo turno.
