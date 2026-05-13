---
name: medical-record-edit-history
description: Edição auditada de prontuário + ficha cadastral via MedicalRecordEditDialog (3 abas), com import PIS e botão "Editar" discreto na cockpit
type: feature
---
- `MedicalRecordEditDialog` agora tem 3 abas: **Prontuário** (numero_prontuario / legado), **Ficha cadastral** (todos os campos do `patient_registry` editáveis + botão "Importar do PIS" via edge `extract-patient-data`), **Histórico** (mescla `medical_record_edit_history` + `patient_registry_edit_history`).
- Cada aba tem motivo obrigatório próprio (≥5 chars) e passa por `MovementConfirmDialog` antes de salvar.
- Auditoria de ficha grava em **`patient_registry_edit_history`** (tabela imutável, RLS: read all auth, insert auth+self, sem update/delete) com `source` (manual/pis_import), `field_changed`, `old_value`, `new_value`, `reason`, `changed_by`, `changed_by_email`.
- Acesso ao dialog: `EditPatientDialog` (mapa de leitos) + botão pequeno "Editar" (ícone Pencil) dentro do painel "Ver dados do prontuário" do `PatientCockpit`.
- Campos UPPER automáticos: full_name, social_name, mother_name, address, neighborhood, city, state, allergies, comorbidities.
