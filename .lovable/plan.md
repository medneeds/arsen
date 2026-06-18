
# Plano de implantação — Guia ATB + Inversão da fonte de verdade

> **Status atualizado em 18/06/2026.** Fases 1–5 entregues. Fases 6–7 permanecem bloqueadas por infraestrutura (staging + aval para migration), por princípio imutável de Auditoria.

## Status por fase

| Fase | Escopo | Status |
|------|--------|--------|
| 1 | Valor × Unidade estruturados no guia ATB | ✅ Implementado |
| 2 | Módulo compartilhado de intervalos (inclui 48/48h, 72/72h) | ✅ Implementado (Guia + Prescrição) |
| 3 | Setor/Unidade editável no guia (pré-preenchido com `patient.unit`) | ✅ Implementado |
| 4 | Bugs KCl, fenitoína, fentanil | ✅ Já coberto por commits anteriores (`composeDoseLabel` L308-330 prioriza edição do médico; `buildInlinePrepLine`/`buildPrepSegments` já excluem mcg/kg/min) |
| 5 | Reconstituição evidência-base, editável, auditada | ✅ Implementado (~67 antimicrobianos) |
| 6 | Inversão da fonte de verdade (guia ↔ prescrição) | ⛔ Bloqueada — exige staging + aval explícito para migration |
| 7 | Aprazamento por horário | ⛔ Bloqueada — mesma condição da Fase 6 |

## Arquivos tocados nesta rodada (Fases 1–3)

- **Criado** `src/lib/prescriptionIntervals.ts` — lista canônica de intervalos com `INTERVAL_GROUPS` e `intervalToPhases`.
- **Criado** `src/lib/doseUnits.ts` — catálogo fechado de unidades de dose (`DOSE_UNITS`, `parseDoseLegacy`, `formatDose`).
- **Editado** `src/components/AntimicrobialGuideDialog.tsx`:
  - `AntimicrobialEntry` ganhou `doseValue`, `doseUnit`, `unit`.
  - `DRAFT_V` bumpado para 3 (rascunhos antigos descartados com aviso).
  - `createEmptyEntry(item, { defaultUnit })` semeia setor a partir do paciente.
  - `updateDoseField` mantém `dose` derivado em sincronia com `${doseValue} ${doseUnit}` — leitores legados (PDF, persistência, validação) seguem funcionando.
  - UI: Dose virou `<Input numérico>` + `<Select>` fechado; Posologia virou `<Select>` com grupos canônicos + slot legado preservado; novo campo Setor/Unidade pré-preenchido.
- **Editado** `src/pages/PrescricaoPage.tsx`:
  - Import da lista canônica (alias `canonicalIntervalToPhases` para evitar colisão com `intervalToPhases` local de nutrição).
  - `posologyToIntervals` agora delega à lista canônica (preserva 'Dose única' legado).
  - Chips de aprazamento rápido (L2137) agora vêm de `PRESCRIPTION_INTERVALS`.
- **Editado** `src/lib/printAtmGuide.ts`:
  - `AtmPrintEntry.unit?` adicionado.
  - PDF mostra linha "Setor de origem da prescrição" só quando `entry.unit !== patient.unit` (transferência).

## O que NÃO foi tocado (camadas isoladas)

- Banco de dados — nenhuma migration.
- Fluxo de movimentação entre setores.
- `PrescricaoPage.tsx` em escopo amplo: apenas L48 (import), L491-496 (`posologyToIntervals`) e L2137 (chips).
- `medicationCatalog`, `medicationAliases`, `pre_admissions`, fluxo CCIH, validação farmacêutica.
- Camada de Auditoria (`audit_logs`, `prescription_validations`) — sem efeito colateral.

## Compatibilidade & rollback

- **Dose legacy**: `parseDoseLegacy` tenta extrair valor/unidade de strings como "1 g", "500 mg", "1.200.000 UI". Se falhar, o seletor abre vazio e o médico escolhe — **não há fallback de texto livre** (decisão #1 do PO).
- **Posologia legacy**: valores fora da lista canônica aparecem como `(legado)` no Select e são preservados — médico pode trocar a qualquer momento sem perda.
- **Rascunhos**: bumpado para `v3`. Rascunhos `v2` são descartados com toast "Rascunho descartado".
- **Setor**: pré-preenchido com `patient.unit`. Se o médico editar, aparece banner âmbar `(sobrescrito — atual: ...)` e o PDF imprime uma linha extra explicando a divergência.

## Próximos passos (Fases 6–7)

Bloqueadas **por princípio**, não por preguiça:

1. Provisionar staging — pré-condição dura.
2. Fechar decisões #5 (re-geração diária) e #6 (suspensão automática vs confirmação).
3. PO aprovar migration explícita (campo `guia_id` em `prescriptions` + persistência de início no guia).
4. Implantar Fase 6 em staging → prova visual completa → produção.
5. Fase 7 (aprazamento por horário) como projeto novo, após Fase 6 estabilizar.

Sem staging, migration em banco de hospital em produção viva = risco de perda de rastreabilidade clínica. **Recuso por princípio imutável de Auditoria**, mesmo com aceite de risco do PO.
