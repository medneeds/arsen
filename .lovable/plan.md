## Contexto

Bug confirmado no Leito 5 UCI 1 (Joaci Garcia): o cockpit mostrou admissão concluída com a HDA de outro paciente. A linha-leito `patients.id` foi reusada por vários ocupantes; em `admission_histories` ficaram 3 linhas vivas (`archived_at IS NULL`) com `patient_registry_id` diferentes, todas apontando para o mesmo `patient_id`. As queries do cockpit filtram só por `patient_id` e pegam a linha legada mais recente.

Mesma classe de bug das fases B.1/B.3 — só que `admission_histories` ficou de fora.

## Escopo — só correção dirigida

**Não toca**: fluxo de admissão (gravação), trigger `archive_bed_history` (já corrigido v2 em outra memória), schema, RLS, layout/UI, outros hooks/diálogos fora dos 3 listados, comportamento de outros pacientes.

**Toca apenas** 3 pontos de LEITURA + 1 migration de limpeza de órfãos.

## Frente 1 — Blindagem de leitura (3 arquivos)

Critério único aplicado, igual à Fase B.1:
```
WHERE patient_id = <atual>
  AND archived_at IS NULL
  AND ( patient_registry_id = <registry_atual>  -- prioritário
        OR patient_registry_id IS NULL )         -- fallback legado
```
Quando há registry ativo (>99% dos casos pós-Fase A), só a linha do ocupante atual aparece. Linhas legadas com registry de outro paciente ficam isoladas.

### 1.1 `src/components/AdmissionConsultDialog.tsx` (linhas 156-163)
Hoje: `.eq("patient_id", patient.id)` puro.
Fix: adiciona `.is("archived_at", null)` e, quando `patient.patient_registry_id` existir, `.or("patient_registry_id.eq.<id>,patient_registry_id.is.null")`. Sem registry, mantém só `archived_at IS NULL` (degradação graciosa).

### 1.2 `src/components/AdmissionHistoryDialog.tsx` (linhas 53-67)
Hoje: usa `resolvedRegistryId` OU `patient_id`, sem `archived_at`.
Fix: sempre `.is("archived_at", null)`; quando há registry, prioriza `patient_registry_id = registry`; sem registry, cai para `patient_id` + `archived_at IS NULL`. Sem mexer no `handleSave` (gravação continua igual — já carimba registry corretamente).

### 1.3 `src/hooks/usePatientCid.ts` (linhas 47-81)
Tentativa 1 hoje filtra por `patient_id` + `archived_at IS NULL` mas pega qualquer registry. Fix: quando o paciente tem registry conhecido (busca já feita na Tentativa 2 ou via prop), prioriza esse filtro; reordena para Tentativa 1 = `patient_registry_id` (precisão), Tentativa 2 = `patient_id` (legado sem carimbo). Mantém `archived_at IS NULL` em ambas. Zero mudança no `persist`.

Nenhum contrato/tipo/UI alterado. Hooks retornam o mesmo shape.

## Frente 2 — Migration de limpeza (1 migration SQL)

Arquivar admission_histories órfãos legados que escaparam do trigger v2 — exatamente os 2 (ou mais) casos como Joaci/L05.

Condição cirúrgica:
```sql
UPDATE public.admission_histories ah
SET archived_at = now(),
    archive_reason = 'cleanup_orphan_legacy_registry_mismatch',
    archived_from_patient_id = ah.patient_id
WHERE ah.archived_at IS NULL
  AND ah.patient_registry_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = ah.patient_id
      AND p.patient_registry_id IS NOT NULL
      AND p.patient_registry_id <> ah.patient_registry_id
  );
```

Só arquiva quando: (a) registro tem registry carimbado, (b) a linha-leito tem registry carimbado, (c) os dois registries são diferentes — prova explícita de troca de ocupante. **Não arquiva** registros sem registry (legado puro) — esses continuam visíveis para o paciente atual via fallback.

Adiciona linha em `audit_logs` com action `CLEANUP_ORPHAN_ADMISSION_HISTORIES` e count.

## Validação pós-correção

1. Banco: re-rodar a query do Joaci (`patient_id=ae421559…`, sem filtros) e ver os 2 órfãos com `archived_at` preenchido. A linha do Joaci (registry 65eec492) permanece viva.
2. UI: abrir cockpit do Joaci → "Ver admissão" deve mostrar HDA dele (ou vazio se ele ainda não tem admissão gravada), nunca mais a do paciente PAF.
3. Smoke negativo: pacientes em leitos que **nunca** foram reusados continuam vendo sua admissão (caminho registry funciona; fallback `patient_id IS NULL` cobre legados sem carimbo).
4. Conferir que `usePatientCid` no header continua exibindo CID correto para Joaci.

## Fora deste plano (proposta separada se você quiser)

- Estender o trigger `archive_bed_history` v2 para cobrir explicitamente `admission_histories` em `bed_occupant_swap` (hoje o gatilho está em `bed_deallocation_auto`, e reocupações via pré-admissão direta não passam por leito vago).
- Fase B.4: carimbar `encounter_id` em `admission_histories` (coluna já existe) e migrar para o filtro `encounter_id.eq/IS NULL` igual às outras 5 tabelas, em vez do registry.
