---
name: Admin Hard Delete Patient
description: Aba "Edição Avançada" (perfil desenvolvedor) com hard delete em cascata de paciente para erros administrativos
type: feature
---

Aba vermelha **Edição Avançada** dentro do `MedicalRecordEditDialog`, visível apenas se `profiles.access_profiles` contém `'desenvolvedor'`. Permite exclusão administrativa permanente do paciente (cadastro duplicado, dados de teste, erro administrativo).

- UI exige: motivo ≥10 caracteres + digitar nome exato do paciente + confirmação via `MovementConfirmDialog` (tone destructive).
- Backend: RPC `admin_hard_delete_patient(p_patient_id, p_registry_id, p_reason)` SECURITY DEFINER. Revalida `is_developer_profile(auth.uid())` no servidor — UI é só conveniência.
- Cascata em ~16 tabelas: clinical_evolutions, exam_requests, culture_results, admission_histories, conduct_history, patient_movements, patient_versions, medical_record_edit_history, patient_registry_edit_history, patient_admission_date_history, pre_admissions, dhd_patients, prescriptions (jsonb), medical_records, patient_encounters, patients, patient_registry, patient_merge_audit. Cada DELETE em bloco EXCEPTION isolado para tolerar tabelas/colunas ausentes.
- Operação irreversível, sem soft delete nem audit table dedicada (escolha do usuário).
- Helper `is_developer_profile(uuid)` checa array `access_profiles`. Hoje só Arthur Batista possui esse perfil.
