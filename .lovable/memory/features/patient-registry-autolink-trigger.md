---
name: Patient Registry Autolink Trigger
description: Trigger BEFORE INSERT/UPDATE em patients auto-vincula patient_registry_id por leito+unidade+nome (NFD/upper); re-resolve quando nome/leito mudam ou registry diverge do nome atual
type: feature
---

Trigger `autolink_patient_registry` (BEFORE INSERT/UPDATE em `patients`).

**Comportamento:**
1. Em UPDATE: descarta `patient_registry_id` se `OLD.name <> NEW.name` OU `OLD.bed_number <> NEW.bed_number` OU se o nome do registry vinculado diverge do nome atual do paciente (NFD/upper) → força re-resolução.
2. Resolução primária: `pre_admissions` por `hospital_unit_id + destination_bed + nome (NFD/upper)`.
3. Fallback: mesmo bed/unit + CPF, também filtrando por nome.

**Por quê o filtro de nome:** sem ele, um leito reusado pegava a pré-admissão histórica do ocupante anterior (bug observado: MARIA RODRIGUES DE SOUSA em L15 saiu com registry de JOSE DE RIBAMAR RODRIGUES). O cabeçalho do PDF então vazava CPF/DN/mãe/endereço do paciente errado.

**Defesa em profundidade no frontend:** `resolvePatientHeader` (`src/lib/resolvePatientHeader.ts`) também valida nome no bloco 1a (vínculo direto) e 1c (medical_record) — se divergir, descarta o vínculo. Memória relacionada: `Resolve Header Medical Record Name Guard`.

Toque no-op `UPDATE patients SET name = name WHERE bed_number IS NOT NULL` reaplica a regra a pacientes ativos quando a função é reescrita.
