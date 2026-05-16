# Plano — Reorganização da Transferência Interna e Separação Ato Médico × Ato Administrativo

## Princípio guia

```text
PAINEL CLÍNICO  ─────────► sinaliza decisão clínica (ato médico)
  (cockpit)              ► marca tarja no Mapa
                         ► NÃO libera leito

MAPA DE LEITOS  ─────────► executa a liberação física (ato administrativo)
  (recepção/enf/médico)  ► repointPatientHistory + zera leito
                         ► finaliza o ciclo
```

Toda transferência/alta/óbito vira fluxo de **2 etapas**: sinalização (Painel) → liberação (Mapa). Médico tem autonomia em ambos os lados. NIR sai 100% do fluxo crítico (vira opcional futuro).

---

## Camada 1 — Layout (Painel Clínico)

**`PatientCockpit` → "Abrir alta, movimentações e desfechos"**

- Renomear botão "Alta hospitalar" → **"Alta médica"**.
- Submenu "Transferências" mantém Interna / Externa.
- **Transferência interna**: seletor de destino (unidade → setor → leito livre) usando o mesmo componente do `UtiReallocationDialog`. Ao confirmar:
  - Grava tarja "TRANSF. INT → SETOR X / LEITO Y" no leito origem.
  - **Não desaloca**. Apenas sinaliza.
- **Alta médica / Óbito / Evasão**: gravam tarja correspondente, **sem** mexer em `bed_number`/`sector`.
- **Botão "Desfazer sinalização"** aparece enquanto a tarja está ativa e o leito ainda não foi liberado (reversibilidade).
- Botão opcional "Solicitar regulação NIR" — não bloqueia nada, só registra `metadata.nir_requested=true`.

## Camada 1 — Layout (Mapa de Leitos)

**Card do leito com tarja ativa** ganha ação primária **"Liberar leito"** (recepção/enfermagem/admin/médico):

- Abre `BedReleasePreAdmissionDialog` já com motivo pré-preenchido pela tarja.
- Confirmação → executa `executeBedRelease(patientId, reason)` (camada 3).
- Após liberar: leito vira livre de verdade, paciente vai pro prontuário sem resíduo.

**"Edição avançada" do Mapa**:
- **Remover** aba/seção de movimentações e desfechos.
- Manter apenas: nome, nº prontuário, data de admissão, sexo, DOB, mãe, endereço, CID, observações cadastrais.
- Banner discreto: "Para movimentar/dar alta/registrar óbito, use o Painel Clínico do paciente."

**Remanejamento operacional** (transferência sem decisão clínica, ex.: reforma do quarto):
- Ação separada no Mapa: **"Remanejar leito (operacional)"** — visível para recepção/enfermagem/admin/médico.
- Diálogo dedicado (`OperationalRelocationDialog`): seletor de leito destino + motivo operacional obrigatório (reforma, manutenção, isolamento, conforto).
- Executa `repointPatientHistory` + move dados clínicos. **Sem** tarja médica. Registra em `patient_movements` com tipo `remanejamento_operacional`.

---

## Camada 2 — Dados

**Sem migrations destrutivas.** Apenas:

- Reutilizar `patients.admission_status` com valores já existentes (`alta_dada`, `obito`, `transferencia_interna_pendente`, `transferencia_externa_pendente`) + adicionar valor `evasao` se necessário (campo é `text`).
- `patient_movements.metadata` ganha chaves: `flow_version='v2_unified'`, `signaled_by` (user/role), `nir_requested` (bool), `target_sector`/`target_bed` (quando transferência interna).
- (Opcional, **fora desta sprint**) índice parcial `(hospital_unit_id, sector, bed_number) WHERE admission_status='admitido'` — trava física contra resíduo. Deixar pra sprint seguinte para reduzir risco.

## Camada 3 — Movimentação (helpers únicos)

Criar **`src/lib/bedLifecycle.ts`** com 3 funções, fonte única da verdade:

```ts
// Sinaliza no Painel (não toca leito)
signalClinicalDecision(patientId, kind, payload)
  // kind: 'alta_medica' | 'transf_interna' | 'transf_externa' | 'obito' | 'evasao'
  // → INSERT patient_movements + UPDATE patients.admission_status

// Desfaz sinalização enquanto leito não liberado
revokeClinicalDecision(patientId, reason)
  // → INSERT patient_movements (tipo 'revogacao') + UPDATE admission_status='admitido'

// Libera leito fisicamente (Mapa)
executeBedRelease(patientId, reason, byRole)
  // → se houver target (transf interna): repointPatientHistory
  // → zera bed_number/sector
  // → INSERT patient_movements (tipo 'liberacao_leito')
  // → preserva histórico via prontuário

// Remanejamento operacional (Mapa, sem decisão clínica)
executeOperationalRelocation(sourcePatientId, targetBed, reason)
  // → repointPatientHistory obrigatório
  // → copia dados clínicos para slot destino
  // → zera leito origem
  // → INSERT patient_movements (tipo 'remanejamento_operacional')
```

**Consumidores** (todos passam a usar os helpers):
- `PatientMovementDialog` (Painel) → `signalClinicalDecision`.
- Botão "Desfazer" no Painel → `revokeClinicalDecision`.
- `BedReleasePreAdmissionDialog` (Mapa) → `executeBedRelease`.
- `OperationalRelocationDialog` (Mapa, novo) → `executeOperationalRelocation`.
- `UtiReallocationDialog` e `BedReallocationDialog` continuam funcionando, mas internamente passam a chamar o helper (sem mudar UX).

## Camada 4 — Auditoria

- `patient_movements` registra **toda** transição com `metadata.flow_version='v2_unified'`.
- Distinção clara: `signaled_by` (médico no Painel) vs `released_by` (quem apertou no Mapa).
- Tarjas no Mapa leem direto de `admission_status` + último `patient_movements` ativo (sem flag duplicada).
- Aba "Histórico de movimentações" do paciente já existente exibe a cadeia completa: sinalização → liberação.

---

## O que NÃO será tocado nesta sprint

- Transferências externas (mantém fluxo atual).
- `repointPatientHistory` (reutilizado como está).
- Schema do banco (sem migration).
- RLS / autenticação / perfis.
- Layout das demais páginas (Prescrição, Evolução, etc.).
- Farmácia, dispensação, impressão.
- Painel do NIR (continua existindo, só perde papel obrigatório).
- Trava física `1-paciente-por-leito` (sprint seguinte).

## Ordem de execução

1. Criar `src/lib/bedLifecycle.ts` com os 4 helpers.
2. Refatorar `PatientMovementDialog` para usar `signalClinicalDecision` + renomear "Alta hospitalar" → "Alta médica" + adicionar botão "Desfazer sinalização".
3. Refatorar `BedReleasePreAdmissionDialog` para usar `executeBedRelease`.
4. Criar `OperationalRelocationDialog` + entry-point no Mapa.
5. Remover aba de movimentações/desfechos da "Edição avançada" do Mapa, adicionar banner.
6. Garantir que `UtiReallocationDialog` e `BedReallocationDialog` chamem os helpers.
7. Validar manualmente: L11 (Idenilton) + um caso de transferência UTI + um remanejamento operacional + reversão de alta médica.
