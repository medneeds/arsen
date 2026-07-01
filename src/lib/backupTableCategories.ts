// Categorização das tabelas públicas para o wizard de Backup/Restore.
// Ordem do array = ordem de exibição dos grupos.

export type TableCategory = {
  key: string;
  label: string;
  tables: string[];
};

export const TABLE_CATEGORIES: TableCategory[] = [
  {
    key: "pacientes_leitos",
    label: "Pacientes & Leitos",
    tables: [
      "patients",
      "patient_registry",
      "patient_encounters",
      "patient_movements",
      "patient_versions",
      "patient_admission_date_history",
      "patient_registry_edit_history",
      "patient_merge_audit",
      "pre_admissions",
      "bed_census",
      "bed_allocation_requests",
      "bed_status_history",
      "internal_transfer_requests",
      "internment_requests",
    ],
  },
  {
    key: "clinico",
    label: "Clínico & Prontuário",
    tables: [
      "admission_histories",
      "clinical_evolutions",
      "conduct_history",
      "medical_records",
      "medical_record_edit_history",
      "medical_record_sequences",
      "discharge_documents",
      "round_sessions",
      "round_responses",
      "round_section_goals",
      "shift_handovers",
      "vital_signs",
      "saps3_assessments",
      "sepsis_protocols",
      "culture_results",
      "notes_reminders",
    ],
  },
  {
    key: "prescricao_farmacia",
    label: "Prescrição & Farmácia",
    tables: [
      "prescriptions",
      "prescriptions_archive",
      "prescription_validations",
      "prescription_quick_templates",
      "prescription_affinity_audit",
      "prescription_draft_deletion_audit",
      "dispensations",
      "medication_catalog",
      "medication_presentations",
      "medication_aliases",
      "medication_favorites",
      "therapeutic_templates",
      "receituarios",
    ],
  },
  {
    key: "exames",
    label: "Exames & Códigos Clínicos",
    tables: ["exam_requests", "cid10_codes", "medical_codes"],
  },
  {
    key: "regulacao",
    label: "Regulação & NIR",
    tables: ["regulation_requests", "regulatory_guides"],
  },
  {
    key: "usuarios",
    label: "Usuários & Acesso",
    tables: [
      "profiles",
      "user_roles",
      "user_departments",
      "user_hospital_assignments",
      "password_reset_requests",
      "pre_registration_requests",
      "user_consents",
      "reception_desk_sessions",
    ],
  },
  {
    key: "config",
    label: "Estrutura & Configuração",
    tables: [
      "hospital_units",
      "states",
      "institution_branding",
      "field_text_templates",
      "data_retention_policies",
      "system_maintenance_mode",
      "module_ip_allowlist",
      "module_ip_settings",
      "unidentified_sequences",
    ],
  },
  {
    key: "backup_auditoria",
    label: "Backup, Auditoria & Segurança",
    tables: [
      "backup_jobs",
      "backup_audit",
      "restore_jobs",
      "db_backups",
      "db_restore_audit",
      "audit_logs",
      "user_admin_audit",
      "ip_access_log",
      "locked_sector_cleanup_log",
      "data_requests",
    ],
  },
  {
    key: "outros",
    label: "Outros módulos",
    tables: ["dev_pendencies", "dhd_patients"],
  },
];

const TABLE_TO_CATEGORY = (() => {
  const m = new Map<string, string>();
  for (const cat of TABLE_CATEGORIES) for (const t of cat.tables) m.set(t, cat.key);
  return m;
})();

/**
 * Agrupa uma lista de nomes de tabela nas categorias definidas.
 * Tabelas não mapeadas caem em "Não categorizadas".
 */
export function groupTablesByCategory(names: string[]): TableCategory[] {
  const buckets = new Map<string, string[]>();
  const uncategorized: string[] = [];
  for (const n of names) {
    const key = TABLE_TO_CATEGORY.get(n);
    if (!key) { uncategorized.push(n); continue; }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(n);
  }
  const groups = TABLE_CATEGORIES
    .map((cat) => ({ ...cat, tables: (buckets.get(cat.key) ?? []).sort() }))
    .filter((cat) => cat.tables.length > 0);
  if (uncategorized.length > 0) {
    groups.push({
      key: "uncategorized",
      label: "Não categorizadas",
      tables: uncategorized.sort(),
    });
  }
  return groups;
}
