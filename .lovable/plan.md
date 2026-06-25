## Entendimento

`patients.id` é a **linha do leito** (volátil, reutilizada entre ocupantes). Toda informação clínica precisa ser ancorada na **identidade permanente** do paciente (`patient_registry_id`) + **atendimento ativo** (`encounter_id`). Já existem proteções parciais (Fases A/B.1/B.3, `archive_patient_bed_data` v3, triggers `stamp_admission_*_identity`, `useActiveEncounterId`, `useResolvedRegistryId`, `resolvePatientHeader`), mas o caso Joaci provou que estão incompletas e não padronizadas.

**Diagnóstico atual (read-only confirmado no banco):**
- 206 `clinical_evolutions` + 159 `exam_requests` vivos com `patient_registry_id` divergente do ocupante atual da linha-leito → órfãos de fato.
- `archive_patient_bed_data` cobre 13 tabelas, mas trigger só dispara em `is_vacant TRUE` (transferência interna não passa por aí — protegida por Guard 3 que evita arquivar quando registry ainda tem encounter ativo, ok).
- Stamp de identidade (`patient_registry_id` + `encounter_id`) só existe em `admission_histories` e `clinical_evolutions`. Faltam: `exam_requests`, `culture_results`, `conduct_history`, `discharge_documents`, `medical_records`, `vital_signs`, `round_sessions`, `prescriptions`, `prescription_validations`, `dispensations`.
- `saps3_assessments` e `sepsis_protocols` não têm coluna `encounter_id`/`patient_registry_id` — fora desta entrega (escopo separado de Fase A).
- Hooks de leitura: alguns ainda lêem por `patient_id` puro (sem fallback registry/encounter).

## Princípios (não negociáveis)

1. **Não toca**: layout/UI, fluxos de movimentação (sinalização/transferência/alta), schemas `auth/storage/realtime/...`, RLS existentes, comportamento de inserts dos formulários.
2. **Não apaga dado clínico** — apenas arquiva (`archived_at`).
3. **Degradação graciosa**: quando `patient_registry_id` ainda não resolveu, queries caem para `patient_id` + `archived_at IS NULL` (não somem silenciosamente).
4. **4 camadas independentes**: Banco (raiz) → Hooks de leitura → Limpeza dos órfãos atuais → Auditoria.

## Plano de execução (4 frentes, na ordem)

### Frente 1 — Banco: stamp universal + archive completo

**Migration A — Stamp genérico de identidade clínica**
Função `stamp_clinical_identity()` (BEFORE INSERT/UPDATE), trigger aplicada nas tabelas que ainda não têm:
- `exam_requests`, `culture_results`, `conduct_history`, `discharge_documents`, `medical_records`, `vital_signs`, `round_sessions`, `prescription_validations`, `dispensations`

Comportamento:
- Resolve `patient_registry_id` a partir de `patients.id` (se NULL).
- Resolve `encounter_id` ativo (registry → patient fallback), igual `autofill_encounter_id`.
- **Registry Guard**: se INSERT/UPDATE não arquivado, e o `patient_registry_id` divergir do registry atual do `patient_id`, corrige para o do ocupante atual (mesma lógica de `stamp_admission_identity`).

`prescriptions` mantém comportamento atual (gravação via `patient_data->>'id'` já tem autofill encounter e carimbo de registry explícito no código).

**Migration B — Extensão de `archive_patient_bed_data`**
Adiciona blocos para: `prescription_validations`, `dispensations`. (Demais já cobertas.)

**Migration C — Re-arm do gatilho de troca silenciosa**
Pequeno reforço: além de `is_vacant=true`, disparar `archive_patient_bed_data` quando `OLD.patient_registry_id IS NOT NULL AND NEW.patient_registry_id IS DISTINCT FROM OLD.patient_registry_id` E o `OLD.patient_registry_id` **não** tiver mais encounter ativo (= alta de fato, leito sendo recolocado para novo dono sem passar por vacate). Mantém todos os 3 guards atuais.

### Frente 2 — Limpeza cirúrgica dos órfãos atuais

Migration D — para cada uma das 7 tabelas (`admission_histories`, `clinical_evolutions`, `exam_requests`, `culture_results`, `conduct_history`, `medical_records`, `discharge_documents`):

```sql
UPDATE <tabela> t
SET archived_at = now(),
    archive_reason = 'cleanup_registry_mismatch_v1',
    archived_from_patient_id = t.patient_id
FROM patients p
WHERE p.id = t.patient_id
  AND t.archived_at IS NULL
  AND t.patient_registry_id IS NOT NULL
  AND p.patient_registry_id IS NOT NULL
  AND p.patient_registry_id <> t.patient_registry_id;
```

Log único em `audit_logs` com a contagem total por tabela.

**Não arquiva** registros legados sem `patient_registry_id` carimbado — esses continuam acessíveis ao paciente atual via fallback.

### Frente 3 — Frontend: leitura registry-first padronizada

Endurecer hooks de leitura que ainda não aplicam o padrão Fase B.1 (filtro composto registry + encounter + archived):

- `src/hooks/useLatestVitalSigns.ts`
- `src/hooks/useLatestRoundSession.ts`
- `src/hooks/usePatientPendingItems.ts` (exam_requests/culture_results)
- `src/hooks/usePatientDocuments.ts`
- `src/hooks/usePatientDischargeDocs.ts`
- `src/hooks/useConductHistory.ts` (já filtra encounter; adicionar registry-first como `useEvolutions`)
- `src/components/AdmissionConsultDialog.tsx` (já corrigido; verificar paridade)
- `src/components/AdmissionHistoryDialog.tsx` (idem)

Padrão único (já adotado em `useEvolutions`):
```ts
if (registryId)
  q.or(`patient_registry_id.eq.${registryId},and(patient_registry_id.is.null,patient_id.eq.${bed})`);
else
  q.eq("patient_id", bed);
q.is("archived_at", null);
q.or(`encounter_id.eq.${enc},encounter_id.is.null`); // quando coluna existe
```

Zero mudança em inserts, zero mudança em UI, queryKeys recebem `registryId` e `encounterId` para invalidar corretamente.

### Frente 4 — Auditoria e memória

- Memória nova: `mem://features/bed-vs-registry-blindage-v2` documentando as 4 camadas + checklist para qualquer nova tabela clínica futura.
- Entrada em `audit_logs` para cada migration aplicada (já incluído nas funções).

## Verificação pós-deploy

1. Re-rodar a query de "leaks" — deve retornar 0 linhas em todas as tabelas.
2. Smoke manual: criar paciente novo num leito anteriormente ocupado → cockpit limpo, sem evolução/exame/conduta do anterior.
3. Smoke negativo: pacientes ativos continuam vendo seus próprios dados.
4. Verificar `tsgo` — tipos preservados.

## Fora desta entrega

- Adicionar `encounter_id`/`patient_registry_id` em `saps3_assessments`, `sepsis_protocols`, `vital_signs` (vital_signs já tem encounter — ok), `notes_reminders`, `shift_handovers` (são tabelas com volume / schema diferente, exigem fase própria).
- Mudanças em fluxos de alta/transferência/sinalização.
- Mudanças em RLS/grants.
- Refator de inserts.
