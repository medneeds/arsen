## Contrato (4 camadas — Princípios Imutáveis)

- **Layout**: nova página `/mesclar-prontuarios` + entrada em `/recepcao` (aba "Prontuários") e `/gestao-usuarios` (área admin). Nenhuma outra tela é alterada.
- **Dados**: apenas RPC `merge_patient_registries` nova + reuso das tabelas existentes (`patient_registry`, `patient_registry_edit_history`, `patient_merge_audit`). Nada é deletado.
- **Movimentação**: zero impacto em leito/admissão/transferência. Mesclagem é só de identidade/histórico, não move paciente.
- **Auditoria**: `patient_merge_audit` (já existe) + `patient_registry_edit_history` com `source='merge'` para cada campo enriquecido. Snapshot completo do registry secundário arquivado em `patient_merge_audit.source_snapshot` (consultável pelo dev para sempre).

---

## Fluxo de UI (4 etapas no mesmo diálogo)

```
[1 Buscar]  →  [2 Comparar lado-a-lado]  →  [3 Decidir campos vencedores]  →  [4 Confirmar]
```

### Etapa 1 — Buscar duplicatas
- Campo de busca por CPF, CNS, nome+DOB ou nº prontuário.
- Lista até 5 registros candidatos (reusa `check_patient_duplicate` + busca livre adicional).
- Usuário marca 2 registros para comparar.

### Etapa 2 — Comparar lado-a-lado
Tabela 3 colunas: **Campo** | **Registro A** | **Registro B**. Linhas:
- Identidade: nome, nome social, DOB, sexo, mãe, CPF, CNS, telefone, endereço, raça/cor, RG.
- Prontuário: `numero_prontuario` (do `medical_records`) + `medical_record` legacy + `numero_prontuario_legado`.
- Vínculo clínico: nº de evoluções, prescrições, exames, encounters, admissões — só leitura, ajuda na decisão.
- Status: criado em, última edição, vínculo a `patient_id` ativo (alocado em leito?).

### Etapa 3 — Decisões (cada uma com motivo)
- **Vencedor (registry principal)** — radio A/B. Sugestão automática: o que está vinculado a `patients` com `bed_number` (alocado).
- **Prontuário predominante** — radio separado entre `numero_prontuario` de A e B. Não força o do vencedor (pergunta explícita do usuário).
- **Por campo divergente** — para cada linha em que A ≠ B, radio "manter A | manter B | manter vazio". Default: valor do vencedor (se não-nulo) ou do perdedor (se vencedor estiver vazio).
- **Motivo geral** (mínimo 10 chars) — obrigatório.

### Etapa 4 — Confirmar (MovementConfirmDialog)
Resumo didático:
- Quem fica como ativo (com leito/setor se houver).
- Quais campos serão enriquecidos no vencedor.
- Qual `numero_prontuario` será predominante.
- Quantos vínculos (evoluções/prescrições/exames/encounters) serão repointados.
- Aviso: "O registro secundário será **arquivado** (não apagado) e ficará acessível para o desenvolvedor via Console."

---

## Regras de negócio

1. **Arquivamento, nunca delete.** O registry perdedor recebe:
   - `merged_into_registry_id = <vencedor>`, `merged_at = now()`, `merged_by = auth.uid()`.
   - CPF/CNS são **liberados** (postos em `null`) e preservados em `notes` JSON: `{archived_cpf, archived_cns, archived_medical_record}` para futura consulta.
   - Snapshot completo do `to_jsonb(perdedor)` salvo em `patient_merge_audit.source_snapshot`.

2. **Prontuário secundário arquivado.** O `medical_records` do perdedor:
   - **Se for o predominante escolhido** → fica vinculado ao vencedor (`patient_registry_id = vencedor`).
   - **Se NÃO for** → permanece com `patient_registry_id = vencedor` também (todos os medical_records do perdedor migram), mas só o predominante é exposto como "principal" via flag `is_primary = true` (nova coluna booleana). Demais ficam visíveis no DevConsole e no histórico do paciente como "prontuários históricos".

3. **Repoint de vínculos** (similar à `merge_unidentified_patient` existente, mas generalizada):
   - `patient_encounters.registry_id` → vencedor.
   - `patients.patient_registry_id` → vencedor.
   - `clinical_evolutions`, `exam_requests`, `culture_results`, `admission_histories`, `conduct_history`, `patient_movements`, `medical_records`, `dhd_patients`, `discharge_documents`, `pre_admissions`, `medical_record_edit_history`, `patient_registry_edit_history`, `patient_admission_date_history`, `patient_versions` → todos repointam o `patient_registry_id`.

4. **Auditoria por campo enriquecido**: cada campo modificado no vencedor gera 1 linha em `patient_registry_edit_history` com `source='merge'`, `old_value`, `new_value`, `reason = "Mesclagem com registro <perdedor> — <motivo do usuário>"`.

5. **Bloqueios de segurança**:
   - Não permite mesclar se ambos os registros têm `patients` ativos em leitos diferentes (precisa liberar 1 antes).
   - Não permite mesclar se um dos dois já está mesclado (`merged_into_registry_id IS NOT NULL`).
   - Não permite mesclar 2 registros do mesmo `patient_id`.
   - Só admin/gestor/recepção podem executar (`has_role` + `access_profile`).

---

## Arquivos tocados

**Backend (1 migration)**
- `merge_patient_registries(p_winner_id, p_loser_id, p_predominant_medical_record, p_field_choices jsonb, p_reason text)` — RPC nova, security definer.
- `ALTER TABLE medical_records ADD COLUMN is_primary boolean DEFAULT true` (default true para não quebrar nada existente; só a mesclagem rebaixa para false).

**Frontend (3 arquivos novos + 2 inserções)**
- `src/pages/MergeRegistriesPage.tsx` *(novo)* — página `/mesclar-prontuarios`.
- `src/components/merge/MergeWizard.tsx` *(novo)* — diálogo 4 etapas.
- `src/components/merge/CompareRegistriesTable.tsx` *(novo)* — tabela lado-a-lado.
- `src/pages/ReceptionPage.tsx` — botão "Mesclar prontuários" na aba Prontuários (apenas link/rota).
- `src/pages/UserManagementPage.tsx` — link discreto na barra superior (admin/gestor).
- `src/App.tsx` — rota nova `/mesclar-prontuarios` (guard admin/gestor/recepção).

**DevConsole (1 inserção)**
- `src/pages/DevConsolePage.tsx` — nova aba "Mesclagens" listando `patient_merge_audit` + `source_snapshot` expandível (consulta de prontuário secundário arquivado).

---

## Arquivos que NÃO serão tocados

- `EditPatientDialog`, `MedicalRecordEditDialog`, `PatientIdentityHeader`, `usePatientIdentifiers`, `resolvePatientHeader`.
- `printAdmission`, `printEvolution`, `PrescricaoPage`, `Saps3Page`, `HemocomponentRequestDialog`.
- Nenhum fluxo de leito (`UtiReallocationDialog`, `AdmitPatientDialog`, `BedReleasePreAdmissionDialog`).
- `merge_unidentified_patient` (continua existindo para o caso NI → identificado; não substituir).
- Catálogo de medicamentos, prescrição, evolução, exames, requisições, validação farmacêutica.

---

## Pontos a confirmar antes de executar

1. **Coluna `is_primary` em `medical_records`** — ok criar ou prefere outro mecanismo (ex.: campo `archived_at` no medical_record perdedor)?
2. **Quem pode acessar `/mesclar-prontuarios`** — admin + gestor + recepção? Ou só admin + gestor?
3. **Aba "Mesclagens" no DevConsole** — ok exibir snapshot completo (inclui CPF/CNS arquivados) para o perfil desenvolvedor?

Aguardo "ok" + respostas dos 3 pontos para implementar em uma única migration + os 6 arquivos de frontend.