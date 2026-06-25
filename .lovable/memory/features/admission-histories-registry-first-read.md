---
name: admission histories/admission evolutions registry-first + trigger stamp
description: Admissão lê/grava por patient_registry_id atual; rascunho por registry; triggers carimbam registry/encounter e evitam vazamento por reuso de leito
type: feature
---

**Bug** (caso Joaci Garcia, L05 UCI 1, 25/06): cockpit mostrou admissão concluída com HDA de outro paciente após reuso da linha-leito; status ficou `admitido` apesar de não existir D0 ativo do registry do Joaci.

**Causa raiz**: admissões ficaram fora das fases B.1/B.3. Leituras/impressão/self-heal ainda consultavam por `patient_id` (a linha-leito é reusada). Gravação de `AdmissionDialog` podia salvar `clinical_evolutions` sem `patient_registry_id`/`encounter_id` e rascunho local era por `patients.id`, reaproveitando texto de ocupante anterior no mesmo leito.

**Fix (leitura/impressão)** — mesmo padrão registry-first das outras fases:
- `AdmissionConsultDialog`: lê `clinical_evolutions` e `admission_histories` exclusivamente por `patient_registry_id` atual + `archived_at IS NULL`; sem fallback por `patient_id` quando registry existe.
- `PacienteHubPage.handlePrintAdmission`: imprime D0 somente por `patient_registry_id` atual + `archived_at IS NULL`.
- `PacienteHubPage` self-heal de status só promove para `admitido` se existir `admission_histories` ativa do registry atual.
- `AdmissionHistoryDialog` e `usePatientCid`: sempre `archived_at IS NULL`; priorizam registry e só usam fallback por `patient_id` para legado sem registry.

**Fix (gravação)**:
- `AdmissionDialog` resolve `registryId` via `usePatientIdentifiers`, bloqueia submit se não houver prontuário, grava `patient_registry_id` + `encounter_id` em `admission_histories` e `clinical_evolutions`.
- Rascunho local mudou para chave `admission_draft:v2:<patient_registry_id>` (nunca `patients.id`), evitando texto de antigo ocupante do leito.
- Adendos em `AdmissionConsultDialog` também carimbam `patient_registry_id` e herdam `encounter_id` do D0.

**Fix (banco — raiz)**:
- Triggers `trg_stamp_admission_history_identity` e `trg_stamp_admission_evolution_identity` carimbam automaticamente `patient_registry_id` e `encounter_id` ativo antes de inserir/atualizar admissões.
- Se uma admissão ativa vier com registry divergente do ocupante atual do leito, a trigger substitui pelo registry correto; registros arquivados não são reativados.
- Funções internas `stamp_admission_identity` e `stamp_admission_evolution_identity` têm `search_path` fixo e execução direta revogada de `anon/authenticated`.

**Fix (limpeza/estado Joaci)**:
- Migration anterior arquivou linhas com `patient_registry_id NOT NULL AND <> patient_registry_id da linha-leito atual`, marcando `archive_reason='cleanup_orphan_legacy_registry_mismatch'`.
- Joaci (`registry 65eec492`) confirmado com 0 `admission_histories` ativas e 0 `clinical_evolutions` admissionais ativas; linha retornou para `pre_admitido` para médica refazer D0 limpo.

**Não toca**: dados arquivados de pacientes anteriores, movimento/transferência/alta, layout.

**Regra permanente**: qualquer tela de admissão hospitalar deve ler/gravar por `patient_registry_id` atual; `patient_id` só pode ser fallback legado sem registry e nunca pode trazer registro ativo de outro registry.
