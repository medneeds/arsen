export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admission_histories: {
        Row: {
          chief_complaint: string | null
          cid_primary: string | null
          cid_secondary: string | null
          clinical_history: string | null
          created_at: string
          created_by: string | null
          department: string
          diagnostic_hypothesis: string | null
          hospital_unit_id: string
          id: string
          initial_conduct: string | null
          macro_diagnosis: string | null
          patient_id: string
          patient_registry_id: string | null
          state_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          chief_complaint?: string | null
          cid_primary?: string | null
          cid_secondary?: string | null
          clinical_history?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          diagnostic_hypothesis?: string | null
          hospital_unit_id: string
          id?: string
          initial_conduct?: string | null
          macro_diagnosis?: string | null
          patient_id: string
          patient_registry_id?: string | null
          state_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          chief_complaint?: string | null
          cid_primary?: string | null
          cid_secondary?: string | null
          clinical_history?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          diagnostic_hypothesis?: string | null
          hospital_unit_id?: string
          id?: string
          initial_conduct?: string | null
          macro_diagnosis?: string | null
          patient_id?: string
          patient_registry_id?: string | null
          state_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admission_histories_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_histories_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_histories_patient_registry_id_fkey"
            columns: ["patient_registry_id"]
            isOneToOne: false
            referencedRelation: "patient_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_histories_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_fields: string[] | null
          created_at: string
          department: string | null
          hospital_unit_id: string | null
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          session_id: string | null
          state_id: string | null
          table_name: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_fields?: string[] | null
          created_at?: string
          department?: string | null
          hospital_unit_id?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          session_id?: string | null
          state_id?: string | null
          table_name: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          changed_fields?: string[] | null
          created_at?: string
          department?: string | null
          hospital_unit_id?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          session_id?: string | null
          state_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      bed_allocation_requests: {
        Row: {
          created_at: string
          department: string
          hospital_unit_id: string
          id: string
          patient_id: string | null
          rejection_reason: string | null
          requested_bed: string | null
          requested_by: string | null
          requested_sector: string
          requesting_doctor_name: string | null
          requesting_office_number: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string
          hospital_unit_id: string
          id?: string
          patient_id?: string | null
          rejection_reason?: string | null
          requested_bed?: string | null
          requested_by?: string | null
          requested_sector: string
          requesting_doctor_name?: string | null
          requesting_office_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string
          hospital_unit_id?: string
          id?: string
          patient_id?: string | null
          rejection_reason?: string | null
          requested_bed?: string | null
          requested_by?: string | null
          requested_sector?: string
          requesting_doctor_name?: string | null
          requesting_office_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bed_allocation_requests_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_allocation_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_allocation_requests_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      bed_census: {
        Row: {
          administrative_discharge_at: string | null
          admission_at: string | null
          bed_number: string
          block_reason: string | null
          block_started_at: string | null
          cleaning_finished_at: string | null
          cleaning_started_at: string | null
          created_at: string
          deallocated_at: string | null
          destination_released_at: string | null
          hospital_unit_id: string
          id: string
          last_patient_id: string | null
          last_patient_name: string | null
          medical_discharge_at: string | null
          occupied_at: string | null
          patient_id: string | null
          patient_name: string | null
          ready_for_admission_at: string | null
          reserved_for: string | null
          reserved_until: string | null
          sector: string
          state_id: string
          status: string
          status_changed_at: string
          updated_at: string
          updated_by: string | null
          updated_by_name: string | null
        }
        Insert: {
          administrative_discharge_at?: string | null
          admission_at?: string | null
          bed_number: string
          block_reason?: string | null
          block_started_at?: string | null
          cleaning_finished_at?: string | null
          cleaning_started_at?: string | null
          created_at?: string
          deallocated_at?: string | null
          destination_released_at?: string | null
          hospital_unit_id: string
          id?: string
          last_patient_id?: string | null
          last_patient_name?: string | null
          medical_discharge_at?: string | null
          occupied_at?: string | null
          patient_id?: string | null
          patient_name?: string | null
          ready_for_admission_at?: string | null
          reserved_for?: string | null
          reserved_until?: string | null
          sector: string
          state_id: string
          status?: string
          status_changed_at?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Update: {
          administrative_discharge_at?: string | null
          admission_at?: string | null
          bed_number?: string
          block_reason?: string | null
          block_started_at?: string | null
          cleaning_finished_at?: string | null
          cleaning_started_at?: string | null
          created_at?: string
          deallocated_at?: string | null
          destination_released_at?: string | null
          hospital_unit_id?: string
          id?: string
          last_patient_id?: string | null
          last_patient_name?: string | null
          medical_discharge_at?: string | null
          occupied_at?: string | null
          patient_id?: string | null
          patient_name?: string | null
          ready_for_admission_at?: string | null
          reserved_for?: string | null
          reserved_until?: string | null
          sector?: string
          state_id?: string
          status?: string
          status_changed_at?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bed_census_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_census_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_census_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      bed_status_history: {
        Row: {
          bed_census_id: string | null
          bed_number: string
          changed_by: string | null
          changed_by_name: string | null
          created_at: string
          hospital_unit_id: string
          id: string
          new_status: string
          old_status: string | null
          reason: string | null
          sector: string
          state_id: string
        }
        Insert: {
          bed_census_id?: string | null
          bed_number: string
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          hospital_unit_id: string
          id?: string
          new_status: string
          old_status?: string | null
          reason?: string | null
          sector: string
          state_id: string
        }
        Update: {
          bed_census_id?: string | null
          bed_number?: string
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          hospital_unit_id?: string
          id?: string
          new_status?: string
          old_status?: string | null
          reason?: string | null
          sector?: string
          state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bed_status_history_bed_census_id_fkey"
            columns: ["bed_census_id"]
            isOneToOne: false
            referencedRelation: "bed_census"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_status_history_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_status_history_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      cid10_codes: {
        Row: {
          category: string
          chapter: string | null
          code: string
          created_at: string
          description: string
          id: string
        }
        Insert: {
          category: string
          chapter?: string | null
          code: string
          created_at?: string
          description: string
          id?: string
        }
        Update: {
          category?: string
          chapter?: string | null
          code?: string
          created_at?: string
          description?: string
          id?: string
        }
        Relationships: []
      }
      clinical_evolutions: {
        Row: {
          created_at: string
          created_by: string
          created_by_name: string | null
          department: string
          diagnostic_hypotheses: string | null
          evolution_type: string
          hospital_unit_id: string
          id: string
          patient_bed: string | null
          patient_id: string | null
          patient_name: string
          patient_registry_id: string | null
          patient_sector: string | null
          physical_exam: Json
          soap_data: Json
          state_id: string
          status: string
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validated_by_name: string | null
          vital_signs: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          created_by_name?: string | null
          department?: string
          diagnostic_hypotheses?: string | null
          evolution_type?: string
          hospital_unit_id: string
          id?: string
          patient_bed?: string | null
          patient_id?: string | null
          patient_name: string
          patient_registry_id?: string | null
          patient_sector?: string | null
          physical_exam?: Json
          soap_data?: Json
          state_id: string
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validated_by_name?: string | null
          vital_signs?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          department?: string
          diagnostic_hypotheses?: string | null
          evolution_type?: string
          hospital_unit_id?: string
          id?: string
          patient_bed?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_registry_id?: string | null
          patient_sector?: string | null
          physical_exam?: Json
          soap_data?: Json
          state_id?: string
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validated_by_name?: string | null
          vital_signs?: Json
        }
        Relationships: [
          {
            foreignKeyName: "clinical_evolutions_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_evolutions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_evolutions_patient_registry_id_fkey"
            columns: ["patient_registry_id"]
            isOneToOne: false
            referencedRelation: "patient_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_evolutions_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      conduct_history: {
        Row: {
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          department: string
          field_name: string
          hospital_unit_id: string
          id: string
          new_value: string | null
          old_value: string | null
          patient_id: string
          patient_registry_id: string | null
          state_id: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          department?: string
          field_name: string
          hospital_unit_id: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          patient_id: string
          patient_registry_id?: string | null
          state_id: string
        }
        Update: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          department?: string
          field_name?: string
          hospital_unit_id?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          patient_id?: string
          patient_registry_id?: string | null
          state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conduct_history_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conduct_history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conduct_history_patient_registry_id_fkey"
            columns: ["patient_registry_id"]
            isOneToOne: false
            referencedRelation: "patient_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conduct_history_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      culture_results: {
        Row: {
          antibiogram: string | null
          collection_date: string | null
          created_at: string
          culture_type: string
          department: string
          hospital_unit_id: string
          id: string
          microorganism: string | null
          notified_at: string | null
          patient_bed: string | null
          patient_id: string | null
          patient_name: string
          patient_registry_id: string | null
          patient_sector: string
          read_at: string | null
          read_by_doctor: boolean | null
          result_files: Json | null
          result_text: string | null
          sensitivity_profile: string | null
          state_id: string
          status: string
          updated_at: string
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          antibiogram?: string | null
          collection_date?: string | null
          created_at?: string
          culture_type?: string
          department?: string
          hospital_unit_id: string
          id?: string
          microorganism?: string | null
          notified_at?: string | null
          patient_bed?: string | null
          patient_id?: string | null
          patient_name: string
          patient_registry_id?: string | null
          patient_sector: string
          read_at?: string | null
          read_by_doctor?: boolean | null
          result_files?: Json | null
          result_text?: string | null
          sensitivity_profile?: string | null
          state_id: string
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          antibiogram?: string | null
          collection_date?: string | null
          created_at?: string
          culture_type?: string
          department?: string
          hospital_unit_id?: string
          id?: string
          microorganism?: string | null
          notified_at?: string | null
          patient_bed?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_registry_id?: string | null
          patient_sector?: string
          read_at?: string | null
          read_by_doctor?: boolean | null
          result_files?: Json | null
          result_text?: string | null
          sensitivity_profile?: string | null
          state_id?: string
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "culture_results_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "culture_results_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "culture_results_patient_registry_id_fkey"
            columns: ["patient_registry_id"]
            isOneToOne: false
            referencedRelation: "patient_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "culture_results_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      data_requests: {
        Row: {
          created_at: string
          export_expires_at: string | null
          export_url: string | null
          id: string
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          request_type: string
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          export_expires_at?: string | null
          export_url?: string | null
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          request_type: string
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          export_expires_at?: string | null
          export_url?: string | null
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          request_type?: string
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      data_retention_policies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          legal_basis: string | null
          retention_years: number
          table_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          legal_basis?: string | null
          retention_years?: number
          table_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          legal_basis?: string | null
          retention_years?: number
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      dev_pendencies: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          notes: string | null
          priority: string
          resolved_at: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      dhd_patients: {
        Row: {
          created_at: string
          created_by: string | null
          department: string
          dhd_report: string | null
          diagnosis: string | null
          end_date: string | null
          hospital_unit_id: string
          id: string
          medication_days: Json | null
          medication_schedule: string | null
          patient_age: string | null
          patient_name: string
          patient_registry_id: string | null
          start_date: string
          state_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string
          dhd_report?: string | null
          diagnosis?: string | null
          end_date?: string | null
          hospital_unit_id: string
          id?: string
          medication_days?: Json | null
          medication_schedule?: string | null
          patient_age?: string | null
          patient_name: string
          patient_registry_id?: string | null
          start_date: string
          state_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string
          dhd_report?: string | null
          diagnosis?: string | null
          end_date?: string | null
          hospital_unit_id?: string
          id?: string
          medication_days?: Json | null
          medication_schedule?: string | null
          patient_age?: string | null
          patient_name?: string
          patient_registry_id?: string | null
          start_date?: string
          state_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dhd_patients_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dhd_patients_patient_registry_id_fkey"
            columns: ["patient_registry_id"]
            isOneToOne: false
            referencedRelation: "patient_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dhd_patients_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      discharge_documents: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          department: string
          document_number: string | null
          document_type: string
          encounter_code: string | null
          hospital_unit_id: string
          id: string
          movement_id: string | null
          patient_bed: string | null
          patient_id: string | null
          patient_name: string
          patient_registry_id: string | null
          patient_sector: string | null
          signed_at: string
          signed_by: string | null
          signed_by_crm: string | null
          signed_by_name: string | null
          state_id: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          department?: string
          document_number?: string | null
          document_type: string
          encounter_code?: string | null
          hospital_unit_id: string
          id?: string
          movement_id?: string | null
          patient_bed?: string | null
          patient_id?: string | null
          patient_name: string
          patient_registry_id?: string | null
          patient_sector?: string | null
          signed_at?: string
          signed_by?: string | null
          signed_by_crm?: string | null
          signed_by_name?: string | null
          state_id: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          department?: string
          document_number?: string | null
          document_type?: string
          encounter_code?: string | null
          hospital_unit_id?: string
          id?: string
          movement_id?: string | null
          patient_bed?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_registry_id?: string | null
          patient_sector?: string | null
          signed_at?: string
          signed_by?: string | null
          signed_by_crm?: string | null
          signed_by_name?: string | null
          state_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      dispensations: {
        Row: {
          created_at: string
          department: string
          dispensation_code: string
          dispensed_at: string
          dispensed_by: string | null
          dispensed_by_name: string | null
          dispensed_items: Json
          encounter_code: string | null
          hospital_unit_id: string
          id: string
          notes: string | null
          patient_name: string
          prescription_id: string
          state_id: string
        }
        Insert: {
          created_at?: string
          department?: string
          dispensation_code: string
          dispensed_at?: string
          dispensed_by?: string | null
          dispensed_by_name?: string | null
          dispensed_items?: Json
          encounter_code?: string | null
          hospital_unit_id: string
          id?: string
          notes?: string | null
          patient_name: string
          prescription_id: string
          state_id: string
        }
        Update: {
          created_at?: string
          department?: string
          dispensation_code?: string
          dispensed_at?: string
          dispensed_by?: string | null
          dispensed_by_name?: string | null
          dispensed_items?: Json
          encounter_code?: string | null
          hospital_unit_id?: string
          id?: string
          notes?: string | null
          patient_name?: string
          prescription_id?: string
          state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispensations_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispensations_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispensations_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_requests: {
        Row: {
          category: string
          clinical_indication: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          department: string
          hospital_unit_id: string
          id: string
          items: Json
          notes: string | null
          patient_bed: string | null
          patient_id: string | null
          patient_name: string
          patient_registry_id: string | null
          patient_sector: string | null
          priority: string
          requested_by: string | null
          requested_by_name: string | null
          result_data: Json | null
          results: string | null
          state_id: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          clinical_indication?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          department?: string
          hospital_unit_id: string
          id?: string
          items?: Json
          notes?: string | null
          patient_bed?: string | null
          patient_id?: string | null
          patient_name: string
          patient_registry_id?: string | null
          patient_sector?: string | null
          priority?: string
          requested_by?: string | null
          requested_by_name?: string | null
          result_data?: Json | null
          results?: string | null
          state_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          clinical_indication?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          department?: string
          hospital_unit_id?: string
          id?: string
          items?: Json
          notes?: string | null
          patient_bed?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_registry_id?: string | null
          patient_sector?: string | null
          priority?: string
          requested_by?: string | null
          requested_by_name?: string | null
          result_data?: Json | null
          results?: string | null
          state_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_requests_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_requests_patient_registry_id_fkey"
            columns: ["patient_registry_id"]
            isOneToOne: false
            referencedRelation: "patient_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_requests_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      field_text_templates: {
        Row: {
          body: string
          created_at: string
          hospital_unit_id: string | null
          id: string
          is_shared: boolean
          last_used_at: string | null
          name: string
          scope: string
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          hospital_unit_id?: string | null
          id?: string
          is_shared?: boolean
          last_used_at?: string | null
          name: string
          scope: string
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          hospital_unit_id?: string | null
          id?: string
          is_shared?: boolean
          last_used_at?: string | null
          name?: string
          scope?: string
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      hospital_units: {
        Row: {
          address: string | null
          created_at: string
          id: string
          medical_record_mode: string
          name: string
          state_id: string
          unit_code: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          medical_record_mode?: string
          name: string
          state_id: string
          unit_code?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          medical_record_mode?: string
          name?: string
          state_id?: string
          unit_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hospital_units_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_branding: {
        Row: {
          abbreviation: string
          accent_color: string | null
          created_at: string
          hospital_unit_id: string
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          tagline: string | null
          updated_at: string
        }
        Insert: {
          abbreviation: string
          accent_color?: string | null
          created_at?: string
          hospital_unit_id: string
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          abbreviation?: string
          accent_color?: string | null
          created_at?: string
          hospital_unit_id?: string
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_branding_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: true
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
        ]
      }
      internment_requests: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          department: string
          destination: string
          hospital_unit_id: string
          id: string
          patient_age: number | null
          patient_name: string
          patient_record: string | null
          patient_sex: string | null
          state_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          department?: string
          destination: string
          hospital_unit_id: string
          id?: string
          patient_age?: number | null
          patient_name: string
          patient_record?: string | null
          patient_sex?: string | null
          state_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          department?: string
          destination?: string
          hospital_unit_id?: string
          id?: string
          patient_age?: number | null
          patient_name?: string
          patient_record?: string | null
          patient_sex?: string | null
          state_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internment_requests_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internment_requests_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_access_log: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          ip: unknown
          module_key: string
          reason: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          allowed: boolean
          created_at?: string
          id?: string
          ip?: unknown
          module_key: string
          reason?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          ip?: unknown
          module_key?: string
          reason?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      locked_sector_cleanup_log: {
        Row: {
          cleaned_at: string
          id: string
          patient_id: string | null
          patient_name: string | null
          sector: string | null
          source_id: string
          source_table: string
        }
        Insert: {
          cleaned_at?: string
          id?: string
          patient_id?: string | null
          patient_name?: string | null
          sector?: string | null
          source_id: string
          source_table: string
        }
        Update: {
          cleaned_at?: string
          id?: string
          patient_id?: string | null
          patient_name?: string | null
          sector?: string | null
          source_id?: string
          source_table?: string
        }
        Relationships: []
      }
      medical_codes: {
        Row: {
          category: string
          code: string
          created_at: string
          id: string
          name: string
          system_description: string
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          id?: string
          name: string
          system_description: string
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          system_description?: string
          updated_at?: string
        }
        Relationships: []
      }
      medical_record_edit_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_email: string | null
          field_changed: string
          id: string
          medical_record_id: string | null
          new_value: string | null
          old_value: string | null
          patient_id: string | null
          patient_registry_id: string | null
          reason: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          field_changed: string
          id?: string
          medical_record_id?: string | null
          new_value?: string | null
          old_value?: string | null
          patient_id?: string | null
          patient_registry_id?: string | null
          reason: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          field_changed?: string
          id?: string
          medical_record_id?: string | null
          new_value?: string | null
          old_value?: string | null
          patient_id?: string | null
          patient_registry_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_record_edit_history_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_record_sequences: {
        Row: {
          id: string
          last_sequence: number
          unit_code: string
          updated_at: string
          year_ref: string
        }
        Insert: {
          id?: string
          last_sequence?: number
          unit_code: string
          updated_at?: string
          year_ref: string
        }
        Update: {
          id?: string
          last_sequence?: number
          unit_code?: string
          updated_at?: string
          year_ref?: string
        }
        Relationships: []
      }
      medical_records: {
        Row: {
          ano_referencia: string | null
          codigo_unidade: string | null
          created_at: string
          created_by: string | null
          data_criacao: string
          dv: number | null
          generation_mode: string
          hospital_unit_id: string | null
          id: string
          is_legacy: boolean
          numero_base: string | null
          numero_prontuario: string
          numero_prontuario_legado: string | null
          patient_id: string | null
          patient_registry_id: string | null
          sequencia: number | null
        }
        Insert: {
          ano_referencia?: string | null
          codigo_unidade?: string | null
          created_at?: string
          created_by?: string | null
          data_criacao?: string
          dv?: number | null
          generation_mode?: string
          hospital_unit_id?: string | null
          id?: string
          is_legacy?: boolean
          numero_base?: string | null
          numero_prontuario: string
          numero_prontuario_legado?: string | null
          patient_id?: string | null
          patient_registry_id?: string | null
          sequencia?: number | null
        }
        Update: {
          ano_referencia?: string | null
          codigo_unidade?: string | null
          created_at?: string
          created_by?: string | null
          data_criacao?: string
          dv?: number | null
          generation_mode?: string
          hospital_unit_id?: string | null
          id?: string
          is_legacy?: boolean
          numero_base?: string | null
          numero_prontuario?: string
          numero_prontuario_legado?: string | null
          patient_id?: string | null
          patient_registry_id?: string | null
          sequencia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_patient_registry_id_fkey"
            columns: ["patient_registry_id"]
            isOneToOne: false
            referencedRelation: "patient_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_aliases: {
        Row: {
          alias_name: string
          alias_type: string
          created_at: string
          id: string
          medication_id: string
        }
        Insert: {
          alias_name: string
          alias_type?: string
          created_at?: string
          id?: string
          medication_id: string
        }
        Update: {
          alias_name?: string
          alias_type?: string
          created_at?: string
          id?: string
          medication_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_aliases_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medication_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_catalog: {
        Row: {
          atc_code: string | null
          controlled: boolean
          created_at: string
          generic_name: string
          high_alert: boolean
          id: string
          internal_code: string | null
          lista: string | null
          nome_comercial: string | null
          notes: string | null
          notification_type: string | null
          pharmacological_group: string | null
          requires_dilution: boolean
          therapeutic_class: string
          updated_at: string
        }
        Insert: {
          atc_code?: string | null
          controlled?: boolean
          created_at?: string
          generic_name: string
          high_alert?: boolean
          id?: string
          internal_code?: string | null
          lista?: string | null
          nome_comercial?: string | null
          notes?: string | null
          notification_type?: string | null
          pharmacological_group?: string | null
          requires_dilution?: boolean
          therapeutic_class: string
          updated_at?: string
        }
        Update: {
          atc_code?: string | null
          controlled?: boolean
          created_at?: string
          generic_name?: string
          high_alert?: boolean
          id?: string
          internal_code?: string | null
          lista?: string | null
          nome_comercial?: string | null
          notes?: string | null
          notification_type?: string | null
          pharmacological_group?: string | null
          requires_dilution?: boolean
          therapeutic_class?: string
          updated_at?: string
        }
        Relationships: []
      }
      medication_favorites: {
        Row: {
          category: string
          created_at: string
          id: string
          last_used_at: string
          medication_id: string
          medication_name: string
          use_count: number
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          last_used_at?: string
          medication_id: string
          medication_name: string
          use_count?: number
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          last_used_at?: string
          medication_id?: string
          medication_name?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      medication_presentations: {
        Row: {
          concentration: string
          created_at: string
          default_dose: string | null
          default_route: string | null
          form: string
          id: string
          infusion_time: string | null
          max_daily_dose: string | null
          medication_id: string
          pharmaceutical_form: string | null
          route: string
          standard_dilution: string | null
          unit: string
        }
        Insert: {
          concentration: string
          created_at?: string
          default_dose?: string | null
          default_route?: string | null
          form: string
          id?: string
          infusion_time?: string | null
          max_daily_dose?: string | null
          medication_id: string
          pharmaceutical_form?: string | null
          route?: string
          standard_dilution?: string | null
          unit?: string
        }
        Update: {
          concentration?: string
          created_at?: string
          default_dose?: string | null
          default_route?: string | null
          form?: string
          id?: string
          infusion_time?: string | null
          max_daily_dose?: string | null
          medication_id?: string
          pharmaceutical_form?: string | null
          route?: string
          standard_dilution?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_presentations_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medication_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      module_ip_allowlist: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          hospital_unit_id: string | null
          id: string
          ip_cidr: unknown
          label: string | null
          module_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          hospital_unit_id?: string | null
          id?: string
          ip_cidr: unknown
          label?: string | null
          module_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          hospital_unit_id?: string | null
          id?: string
          ip_cidr?: unknown
          label?: string | null
          module_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      module_ip_settings: {
        Row: {
          bypass_for_admin: boolean
          description: string | null
          enforce: boolean
          module_key: string
          updated_at: string
        }
        Insert: {
          bypass_for_admin?: boolean
          description?: string | null
          enforce?: boolean
          module_key: string
          updated_at?: string
        }
        Update: {
          bypass_for_admin?: boolean
          description?: string | null
          enforce?: boolean
          module_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      notes_reminders: {
        Row: {
          completed: boolean | null
          content: string
          created_at: string
          created_by: string | null
          department: string
          hospital_unit_id: string
          id: string
          is_active: boolean | null
          read: boolean | null
          scheduled_popup_time: string | null
          state_id: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed?: boolean | null
          content: string
          created_at?: string
          created_by?: string | null
          department?: string
          hospital_unit_id: string
          id?: string
          is_active?: boolean | null
          read?: boolean | null
          scheduled_popup_time?: string | null
          state_id: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed?: boolean | null
          content?: string
          created_at?: string
          created_by?: string | null
          department?: string
          hospital_unit_id?: string
          id?: string
          is_active?: boolean | null
          read?: boolean | null
          scheduled_popup_time?: string | null
          state_id?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_reminders_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_reminders_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_requests: {
        Row: {
          created_at: string
          crm: string
          id: string
          new_password_set_at: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          user_id: string | null
          username: string
        }
        Insert: {
          created_at?: string
          crm: string
          id?: string
          new_password_set_at?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          user_id?: string | null
          username: string
        }
        Update: {
          created_at?: string
          crm?: string
          id?: string
          new_password_set_at?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      patient_admission_date_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_name: string | null
          id: string
          new_value: string
          old_value: string | null
          patient_id: string
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          id?: string
          new_value: string
          old_value?: string | null
          patient_id: string
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          id?: string
          new_value?: string
          old_value?: string | null
          patient_id?: string
          reason?: string | null
        }
        Relationships: []
      }
      patient_encounters: {
        Row: {
          admission_date: string | null
          attending_doctor_name: string | null
          called_at: string | null
          called_by: string | null
          created_at: string
          created_by: string | null
          department: string
          destination_sector: string | null
          discharge_date: string | null
          encounter_code: string
          entry_type: string | null
          first_medical_attendance_at: string | null
          hospital_unit_id: string
          id: string
          last_medical_attendance_at: string | null
          medical_record_id: string | null
          outcome: string | null
          outcome_date: string | null
          patient_id: string | null
          patient_name: string
          reception_point: string | null
          registry_id: string | null
          specialty: string | null
          state_id: string
          status: string
          triage_status: string | null
          updated_at: string
        }
        Insert: {
          admission_date?: string | null
          attending_doctor_name?: string | null
          called_at?: string | null
          called_by?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          destination_sector?: string | null
          discharge_date?: string | null
          encounter_code: string
          entry_type?: string | null
          first_medical_attendance_at?: string | null
          hospital_unit_id: string
          id?: string
          last_medical_attendance_at?: string | null
          medical_record_id?: string | null
          outcome?: string | null
          outcome_date?: string | null
          patient_id?: string | null
          patient_name: string
          reception_point?: string | null
          registry_id?: string | null
          specialty?: string | null
          state_id: string
          status?: string
          triage_status?: string | null
          updated_at?: string
        }
        Update: {
          admission_date?: string | null
          attending_doctor_name?: string | null
          called_at?: string | null
          called_by?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          destination_sector?: string | null
          discharge_date?: string | null
          encounter_code?: string
          entry_type?: string | null
          first_medical_attendance_at?: string | null
          hospital_unit_id?: string
          id?: string
          last_medical_attendance_at?: string | null
          medical_record_id?: string | null
          outcome?: string | null
          outcome_date?: string | null
          patient_id?: string | null
          patient_name?: string
          reception_point?: string | null
          registry_id?: string | null
          specialty?: string | null
          state_id?: string
          status?: string
          triage_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_encounters_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_encounters_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_encounters_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_encounters_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "patient_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_encounters_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_merge_audit: {
        Row: {
          action: string
          created_at: string
          id: string
          payload: Json | null
          performed_by: string | null
          performed_by_email: string | null
          source_registry_id: string
          source_snapshot: Json | null
          target_registry_id: string | null
          target_snapshot: Json | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          payload?: Json | null
          performed_by?: string | null
          performed_by_email?: string | null
          source_registry_id: string
          source_snapshot?: Json | null
          target_registry_id?: string | null
          target_snapshot?: Json | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          payload?: Json | null
          performed_by?: string | null
          performed_by_email?: string | null
          source_registry_id?: string
          source_snapshot?: Json | null
          target_registry_id?: string | null
          target_snapshot?: Json | null
        }
        Relationships: []
      }
      patient_movements: {
        Row: {
          created_at: string
          created_by: string | null
          department: string
          destination: string | null
          hospital_unit_id: string
          id: string
          movement_type: string
          notes: string | null
          patient_bed: string | null
          patient_id: string | null
          patient_name: string
          patient_registry_id: string | null
          patient_sector: string | null
          patient_snapshot: Json | null
          release_status: string
          released_at: string | null
          released_by: string | null
          released_by_name: string | null
          responsible_doctor: string | null
          state_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string
          destination?: string | null
          hospital_unit_id: string
          id?: string
          movement_type: string
          notes?: string | null
          patient_bed?: string | null
          patient_id?: string | null
          patient_name: string
          patient_registry_id?: string | null
          patient_sector?: string | null
          patient_snapshot?: Json | null
          release_status?: string
          released_at?: string | null
          released_by?: string | null
          released_by_name?: string | null
          responsible_doctor?: string | null
          state_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string
          destination?: string | null
          hospital_unit_id?: string
          id?: string
          movement_type?: string
          notes?: string | null
          patient_bed?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_registry_id?: string | null
          patient_sector?: string | null
          patient_snapshot?: Json | null
          release_status?: string
          released_at?: string | null
          released_by?: string | null
          released_by_name?: string | null
          responsible_doctor?: string | null
          state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_movements_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_movements_patient_registry_id_fkey"
            columns: ["patient_registry_id"]
            isOneToOne: false
            referencedRelation: "patient_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_movements_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_registry: {
        Row: {
          address: string | null
          allergies: string | null
          birth_date: string | null
          blood_type: string | null
          city: string | null
          cns: string | null
          comorbidities: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          full_name: string
          full_name_normalized: string | null
          hospital_unit_id: string | null
          id: string
          is_unidentified: boolean
          medical_record: string | null
          merged_at: string | null
          merged_by: string | null
          merged_into_registry_id: string | null
          mother_name: string | null
          neighborhood: string | null
          notes: string | null
          phone: string | null
          sex: string | null
          social_name: string | null
          state: string | null
          state_id: string | null
          unidentified_code: string | null
          unidentified_features: Json | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          birth_date?: string | null
          blood_type?: string | null
          city?: string | null
          cns?: string | null
          comorbidities?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          full_name: string
          full_name_normalized?: string | null
          hospital_unit_id?: string | null
          id?: string
          is_unidentified?: boolean
          medical_record?: string | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into_registry_id?: string | null
          mother_name?: string | null
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          sex?: string | null
          social_name?: string | null
          state?: string | null
          state_id?: string | null
          unidentified_code?: string | null
          unidentified_features?: Json | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          allergies?: string | null
          birth_date?: string | null
          blood_type?: string | null
          city?: string | null
          cns?: string | null
          comorbidities?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          full_name?: string
          full_name_normalized?: string | null
          hospital_unit_id?: string | null
          id?: string
          is_unidentified?: boolean
          medical_record?: string | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into_registry_id?: string | null
          mother_name?: string | null
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          sex?: string | null
          social_name?: string | null
          state?: string | null
          state_id?: string | null
          unidentified_code?: string | null
          unidentified_features?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_registry_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_registry_merged_into_registry_id_fkey"
            columns: ["merged_into_registry_id"]
            isOneToOne: false
            referencedRelation: "patient_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_registry_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_registry_edit_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_email: string | null
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          patient_id: string | null
          patient_registry_id: string
          reason: string
          source: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          patient_id?: string | null
          patient_registry_id: string
          reason: string
          source?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          patient_id?: string | null
          patient_registry_id?: string
          reason?: string
          source?: string
        }
        Relationships: []
      }
      patient_versions: {
        Row: {
          created_at: string
          created_by: string | null
          department: string
          description: string
          hospital_unit_id: string
          id: string
          snapshot_data: Json
          state_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string
          description: string
          hospital_unit_id: string
          id?: string
          snapshot_data: Json
          state_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string
          description?: string
          hospital_unit_id?: string
          id?: string
          snapshot_data?: Json
          state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_versions_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_versions_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          admission_date: string | null
          admission_history: string | null
          admission_status: string | null
          admitted_at: string | null
          age: string | null
          allocation_status: string | null
          bed_number: string
          clinical_status: string | null
          created_at: string
          created_by: string | null
          department: string
          diagnoses: string | null
          display_order: number | null
          highlighted_conducts: number[] | null
          highlighted_diagnoses: number[] | null
          highlighted_medical_history: number[] | null
          highlighted_pendencies: number[] | null
          hospital_discharge_prediction: string | null
          hospital_unit_id: string
          id: string
          internment_notes: string | null
          internment_status: string | null
          is_door_patient: boolean | null
          is_palliative: boolean | null
          is_vacant: boolean | null
          isolation_precautions: string | null
          medical_history: string | null
          medical_record: string | null
          medical_responsibility: Json | null
          name: string
          patient_registry_id: string | null
          pendencies: string | null
          psm_status: string | null
          relevant_exams: string | null
          saps_acknowledged_at: string | null
          saps_acknowledged_by: string | null
          saps_completed_at: string | null
          saps_pending: boolean
          saps_pending_since: string | null
          schedule: string | null
          sector: string
          state_id: string
          updated_at: string
          uti_admission_date: string | null
          uti_admission_reason: string | null
          uti_allergies: string | null
          uti_cultures_antibiotics: string | null
          uti_current_status: string | null
          uti_daily_conducts: string | null
          uti_devices: string | null
          uti_discharge_prediction: string | null
          uti_origin_sector: string | null
          uti_specialties: string | null
          uti_weight_kg: number | null
        }
        Insert: {
          admission_date?: string | null
          admission_history?: string | null
          admission_status?: string | null
          admitted_at?: string | null
          age?: string | null
          allocation_status?: string | null
          bed_number: string
          clinical_status?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          diagnoses?: string | null
          display_order?: number | null
          highlighted_conducts?: number[] | null
          highlighted_diagnoses?: number[] | null
          highlighted_medical_history?: number[] | null
          highlighted_pendencies?: number[] | null
          hospital_discharge_prediction?: string | null
          hospital_unit_id: string
          id?: string
          internment_notes?: string | null
          internment_status?: string | null
          is_door_patient?: boolean | null
          is_palliative?: boolean | null
          is_vacant?: boolean | null
          isolation_precautions?: string | null
          medical_history?: string | null
          medical_record?: string | null
          medical_responsibility?: Json | null
          name?: string
          patient_registry_id?: string | null
          pendencies?: string | null
          psm_status?: string | null
          relevant_exams?: string | null
          saps_acknowledged_at?: string | null
          saps_acknowledged_by?: string | null
          saps_completed_at?: string | null
          saps_pending?: boolean
          saps_pending_since?: string | null
          schedule?: string | null
          sector: string
          state_id: string
          updated_at?: string
          uti_admission_date?: string | null
          uti_admission_reason?: string | null
          uti_allergies?: string | null
          uti_cultures_antibiotics?: string | null
          uti_current_status?: string | null
          uti_daily_conducts?: string | null
          uti_devices?: string | null
          uti_discharge_prediction?: string | null
          uti_origin_sector?: string | null
          uti_specialties?: string | null
          uti_weight_kg?: number | null
        }
        Update: {
          admission_date?: string | null
          admission_history?: string | null
          admission_status?: string | null
          admitted_at?: string | null
          age?: string | null
          allocation_status?: string | null
          bed_number?: string
          clinical_status?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          diagnoses?: string | null
          display_order?: number | null
          highlighted_conducts?: number[] | null
          highlighted_diagnoses?: number[] | null
          highlighted_medical_history?: number[] | null
          highlighted_pendencies?: number[] | null
          hospital_discharge_prediction?: string | null
          hospital_unit_id?: string
          id?: string
          internment_notes?: string | null
          internment_status?: string | null
          is_door_patient?: boolean | null
          is_palliative?: boolean | null
          is_vacant?: boolean | null
          isolation_precautions?: string | null
          medical_history?: string | null
          medical_record?: string | null
          medical_responsibility?: Json | null
          name?: string
          patient_registry_id?: string | null
          pendencies?: string | null
          psm_status?: string | null
          relevant_exams?: string | null
          saps_acknowledged_at?: string | null
          saps_acknowledged_by?: string | null
          saps_completed_at?: string | null
          saps_pending?: boolean
          saps_pending_since?: string | null
          schedule?: string | null
          sector?: string
          state_id?: string
          updated_at?: string
          uti_admission_date?: string | null
          uti_admission_reason?: string | null
          uti_allergies?: string | null
          uti_cultures_antibiotics?: string | null
          uti_current_status?: string | null
          uti_daily_conducts?: string | null
          uti_devices?: string | null
          uti_discharge_prediction?: string | null
          uti_origin_sector?: string | null
          uti_specialties?: string | null
          uti_weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_patient_registry_id_fkey"
            columns: ["patient_registry_id"]
            isOneToOne: false
            referencedRelation: "patient_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_admissions: {
        Row: {
          address: string | null
          ai_extracted_data: Json | null
          airway_intubated: boolean | null
          airway_notes: string | null
          airway_obstruction: boolean | null
          airway_patent: boolean | null
          allergies: string | null
          birth_date: string | null
          chief_complaint: string | null
          city: string | null
          cns: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          department: string
          destination_bed: string | null
          destination_sector: string | null
          flu_symptoms: boolean | null
          flu_symptoms_detail: string | null
          glasgow_detail: Json | null
          glasgow_score: number | null
          hospital_unit_id: string
          id: string
          medical_record: string | null
          menstrual_status: string | null
          mother_name: string | null
          neighborhood: string | null
          notes: string | null
          oxygen_therapy: boolean | null
          oxygen_therapy_detail: string | null
          pain_scale: number | null
          patient_name: string
          patient_registry_id: string | null
          peripheral_perfusion: string | null
          phone: string | null
          pulse_quality: string | null
          risk_classification: string | null
          risk_classified_at: string | null
          risk_classified_by: string | null
          sex: string | null
          social_name: string | null
          state: string | null
          state_id: string
          status: string
          triage_notes: string | null
          updated_at: string
          vital_signs: Json | null
        }
        Insert: {
          address?: string | null
          ai_extracted_data?: Json | null
          airway_intubated?: boolean | null
          airway_notes?: string | null
          airway_obstruction?: boolean | null
          airway_patent?: boolean | null
          allergies?: string | null
          birth_date?: string | null
          chief_complaint?: string | null
          city?: string | null
          cns?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          destination_bed?: string | null
          destination_sector?: string | null
          flu_symptoms?: boolean | null
          flu_symptoms_detail?: string | null
          glasgow_detail?: Json | null
          glasgow_score?: number | null
          hospital_unit_id: string
          id?: string
          medical_record?: string | null
          menstrual_status?: string | null
          mother_name?: string | null
          neighborhood?: string | null
          notes?: string | null
          oxygen_therapy?: boolean | null
          oxygen_therapy_detail?: string | null
          pain_scale?: number | null
          patient_name: string
          patient_registry_id?: string | null
          peripheral_perfusion?: string | null
          phone?: string | null
          pulse_quality?: string | null
          risk_classification?: string | null
          risk_classified_at?: string | null
          risk_classified_by?: string | null
          sex?: string | null
          social_name?: string | null
          state?: string | null
          state_id: string
          status?: string
          triage_notes?: string | null
          updated_at?: string
          vital_signs?: Json | null
        }
        Update: {
          address?: string | null
          ai_extracted_data?: Json | null
          airway_intubated?: boolean | null
          airway_notes?: string | null
          airway_obstruction?: boolean | null
          airway_patent?: boolean | null
          allergies?: string | null
          birth_date?: string | null
          chief_complaint?: string | null
          city?: string | null
          cns?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          destination_bed?: string | null
          destination_sector?: string | null
          flu_symptoms?: boolean | null
          flu_symptoms_detail?: string | null
          glasgow_detail?: Json | null
          glasgow_score?: number | null
          hospital_unit_id?: string
          id?: string
          medical_record?: string | null
          menstrual_status?: string | null
          mother_name?: string | null
          neighborhood?: string | null
          notes?: string | null
          oxygen_therapy?: boolean | null
          oxygen_therapy_detail?: string | null
          pain_scale?: number | null
          patient_name?: string
          patient_registry_id?: string | null
          peripheral_perfusion?: string | null
          phone?: string | null
          pulse_quality?: string | null
          risk_classification?: string | null
          risk_classified_at?: string | null
          risk_classified_by?: string | null
          sex?: string | null
          social_name?: string | null
          state?: string | null
          state_id?: string
          status?: string
          triage_notes?: string | null
          updated_at?: string
          vital_signs?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pre_admissions_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_admissions_patient_registry_id_fkey"
            columns: ["patient_registry_id"]
            isOneToOne: false
            referencedRelation: "patient_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_admissions_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_registration_requests: {
        Row: {
          access_profile: string
          cpf: string
          created_at: string
          created_user_id: string | null
          crm: string | null
          email: string
          full_name: string
          hospital_unit_id: string | null
          id: string
          ip_address: unknown
          justification: string | null
          phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          access_profile?: string
          cpf: string
          created_at?: string
          created_user_id?: string | null
          crm?: string | null
          email: string
          full_name: string
          hospital_unit_id?: string | null
          id?: string
          ip_address?: unknown
          justification?: string | null
          phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          access_profile?: string
          cpf?: string
          created_at?: string
          created_user_id?: string | null
          crm?: string | null
          email?: string
          full_name?: string
          hospital_unit_id?: string | null
          id?: string
          ip_address?: unknown
          justification?: string | null
          phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pre_registration_requests_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_draft_deletion_audit: {
        Row: {
          created_at: string
          deleted_by: string
          deleted_by_name: string | null
          id: string
          patient_id: string | null
          patient_name: string | null
          prescription_id: string
          prescription_snapshot: Json
          reason: string
          version: number | null
        }
        Insert: {
          created_at?: string
          deleted_by: string
          deleted_by_name?: string | null
          id?: string
          patient_id?: string | null
          patient_name?: string | null
          prescription_id: string
          prescription_snapshot: Json
          reason: string
          version?: number | null
        }
        Update: {
          created_at?: string
          deleted_by?: string
          deleted_by_name?: string | null
          id?: string
          patient_id?: string | null
          patient_name?: string | null
          prescription_id?: string
          prescription_snapshot?: Json
          reason?: string
          version?: number | null
        }
        Relationships: []
      }
      prescription_quick_templates: {
        Row: {
          clinical_category: string
          created_at: string
          created_by: string | null
          description: string | null
          hospital_unit_id: string | null
          id: string
          items: Json
          last_used_at: string | null
          name: string
          scope: string
          state_id: string | null
          updated_at: string
          use_count: number
        }
        Insert: {
          clinical_category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          hospital_unit_id?: string | null
          id?: string
          items?: Json
          last_used_at?: string | null
          name: string
          scope?: string
          state_id?: string | null
          updated_at?: string
          use_count?: number
        }
        Update: {
          clinical_category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          hospital_unit_id?: string | null
          id?: string
          items?: Json
          last_used_at?: string | null
          name?: string
          scope?: string
          state_id?: string | null
          updated_at?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "prescription_quick_templates_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_quick_templates_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_validations: {
        Row: {
          allergy_check_passed: boolean | null
          created_at: string
          department: string
          dilution_check_passed: boolean | null
          dose_check_passed: boolean | null
          hospital_unit_id: string
          id: string
          interaction_check_passed: boolean | null
          notes: string | null
          prescription_id: string
          state_id: string
          status: string
          updated_at: string
          validated_by: string | null
          validation_items: Json
          validator_name: string | null
        }
        Insert: {
          allergy_check_passed?: boolean | null
          created_at?: string
          department?: string
          dilution_check_passed?: boolean | null
          dose_check_passed?: boolean | null
          hospital_unit_id: string
          id?: string
          interaction_check_passed?: boolean | null
          notes?: string | null
          prescription_id: string
          state_id: string
          status?: string
          updated_at?: string
          validated_by?: string | null
          validation_items?: Json
          validator_name?: string | null
        }
        Update: {
          allergy_check_passed?: boolean | null
          created_at?: string
          department?: string
          dilution_check_passed?: boolean | null
          dose_check_passed?: boolean | null
          hospital_unit_id?: string
          id?: string
          interaction_check_passed?: boolean | null
          notes?: string | null
          prescription_id?: string
          state_id?: string
          status?: string
          updated_at?: string
          validated_by?: string | null
          validation_items?: Json
          validator_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_validations_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_validations_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_validations_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string
          created_by: string | null
          department: string
          digital_signature: Json | null
          encounter_id: string | null
          hospital_unit_id: string
          id: string
          items: Json
          notes: string | null
          parent_id: string | null
          patient_data: Json
          patient_name: string
          patient_registry_id: string | null
          state_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string
          digital_signature?: Json | null
          encounter_id?: string | null
          hospital_unit_id: string
          id?: string
          items?: Json
          notes?: string | null
          parent_id?: string | null
          patient_data?: Json
          patient_name: string
          patient_registry_id?: string | null
          state_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string
          digital_signature?: Json | null
          encounter_id?: string | null
          hospital_unit_id?: string
          id?: string
          items?: Json
          notes?: string | null
          parent_id?: string | null
          patient_data?: Json
          patient_name?: string
          patient_registry_id?: string | null
          state_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_registry_id_fkey"
            columns: ["patient_registry_id"]
            isOneToOne: false
            referencedRelation: "patient_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_profile: string | null
          access_profiles: string[]
          approved_at: string | null
          approved_by: string | null
          cargo: string | null
          cpf: string | null
          created_at: string
          crm: string | null
          data_deletion_requested_at: string | null
          data_export_requested_at: string | null
          email: string | null
          full_name: string | null
          id: string
          matricula: string | null
          must_change_password: boolean
          phone: string | null
          professional_type: string | null
          specialty: string | null
          status: string
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          access_profile?: string | null
          access_profiles?: string[]
          approved_at?: string | null
          approved_by?: string | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          crm?: string | null
          data_deletion_requested_at?: string | null
          data_export_requested_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          matricula?: string | null
          must_change_password?: boolean
          phone?: string | null
          professional_type?: string | null
          specialty?: string | null
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          access_profile?: string | null
          access_profiles?: string[]
          approved_at?: string | null
          approved_by?: string | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          crm?: string | null
          data_deletion_requested_at?: string | null
          data_export_requested_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          matricula?: string | null
          must_change_password?: boolean
          phone?: string | null
          professional_type?: string | null
          specialty?: string | null
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      reception_desk_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          hospital_unit_id: string
          id: string
          last_heartbeat_at: string
          reception_point: string
          started_at: string
          state_id: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          hospital_unit_id: string
          id?: string
          last_heartbeat_at?: string
          reception_point: string
          started_at?: string
          state_id: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          hospital_unit_id?: string
          id?: string
          last_heartbeat_at?: string
          reception_point?: string
          started_at?: string
          state_id?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      regulation_requests: {
        Row: {
          approved_at: string | null
          canceled_at: string | null
          cancellation_reason: string | null
          cid_primary: string | null
          cid_secondary: string | null
          clinical_summary: string | null
          completed_at: string | null
          created_at: string
          department: string
          destination_bed: string | null
          destination_sector: string | null
          destination_unit: string | null
          hospital_unit_id: string
          id: string
          notes: string | null
          origin_bed: string | null
          origin_sector: string | null
          patient_age: string | null
          patient_id: string | null
          patient_name: string
          patient_record: string | null
          patient_sex: string | null
          priority: string
          reason: string | null
          regulator_id: string | null
          regulator_name: string | null
          request_type: string
          requested_by: string | null
          requested_by_name: string | null
          sisreg_code: string | null
          sisreg_status: string | null
          state_id: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          canceled_at?: string | null
          cancellation_reason?: string | null
          cid_primary?: string | null
          cid_secondary?: string | null
          clinical_summary?: string | null
          completed_at?: string | null
          created_at?: string
          department?: string
          destination_bed?: string | null
          destination_sector?: string | null
          destination_unit?: string | null
          hospital_unit_id: string
          id?: string
          notes?: string | null
          origin_bed?: string | null
          origin_sector?: string | null
          patient_age?: string | null
          patient_id?: string | null
          patient_name: string
          patient_record?: string | null
          patient_sex?: string | null
          priority?: string
          reason?: string | null
          regulator_id?: string | null
          regulator_name?: string | null
          request_type: string
          requested_by?: string | null
          requested_by_name?: string | null
          sisreg_code?: string | null
          sisreg_status?: string | null
          state_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          canceled_at?: string | null
          cancellation_reason?: string | null
          cid_primary?: string | null
          cid_secondary?: string | null
          clinical_summary?: string | null
          completed_at?: string | null
          created_at?: string
          department?: string
          destination_bed?: string | null
          destination_sector?: string | null
          destination_unit?: string | null
          hospital_unit_id?: string
          id?: string
          notes?: string | null
          origin_bed?: string | null
          origin_sector?: string | null
          patient_age?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_record?: string | null
          patient_sex?: string | null
          priority?: string
          reason?: string | null
          regulator_id?: string | null
          regulator_name?: string | null
          request_type?: string
          requested_by?: string | null
          requested_by_name?: string | null
          sisreg_code?: string | null
          sisreg_status?: string | null
          state_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulation_requests_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulation_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulation_requests_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_guides: {
        Row: {
          ccih_notes: string | null
          ccih_reviewed_at: string | null
          ccih_reviewed_by: string | null
          ccih_status: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          culture_collected: boolean | null
          culture_data: Json | null
          department: string
          doctor_crm: string | null
          doctor_name: string | null
          doctor_specialty: string | null
          entries: Json
          guide_type: string
          hospital_unit_id: string
          id: string
          infection_focus: string | null
          infection_origin: string | null
          patient_age: string | null
          patient_allergies: string | null
          patient_bed: string | null
          patient_id: string | null
          patient_name: string
          patient_record: string | null
          patient_registry_id: string | null
          patient_sex: string | null
          patient_weight: string | null
          prescription_id: string | null
          print_count: number
          printed_at: string | null
          request_type: string | null
          state_id: string
          updated_at: string
        }
        Insert: {
          ccih_notes?: string | null
          ccih_reviewed_at?: string | null
          ccih_reviewed_by?: string | null
          ccih_status?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          culture_collected?: boolean | null
          culture_data?: Json | null
          department?: string
          doctor_crm?: string | null
          doctor_name?: string | null
          doctor_specialty?: string | null
          entries?: Json
          guide_type: string
          hospital_unit_id: string
          id?: string
          infection_focus?: string | null
          infection_origin?: string | null
          patient_age?: string | null
          patient_allergies?: string | null
          patient_bed?: string | null
          patient_id?: string | null
          patient_name: string
          patient_record?: string | null
          patient_registry_id?: string | null
          patient_sex?: string | null
          patient_weight?: string | null
          prescription_id?: string | null
          print_count?: number
          printed_at?: string | null
          request_type?: string | null
          state_id: string
          updated_at?: string
        }
        Update: {
          ccih_notes?: string | null
          ccih_reviewed_at?: string | null
          ccih_reviewed_by?: string | null
          ccih_status?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          culture_collected?: boolean | null
          culture_data?: Json | null
          department?: string
          doctor_crm?: string | null
          doctor_name?: string | null
          doctor_specialty?: string | null
          entries?: Json
          guide_type?: string
          hospital_unit_id?: string
          id?: string
          infection_focus?: string | null
          infection_origin?: string | null
          patient_age?: string | null
          patient_allergies?: string | null
          patient_bed?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_record?: string | null
          patient_registry_id?: string | null
          patient_sex?: string | null
          patient_weight?: string | null
          prescription_id?: string | null
          print_count?: number
          printed_at?: string | null
          request_type?: string | null
          state_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_guides_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_guides_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_guides_patient_registry_id_fkey"
            columns: ["patient_registry_id"]
            isOneToOne: false
            referencedRelation: "patient_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_guides_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_guides_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      round_responses: {
        Row: {
          created_at: string
          id: string
          item_id: number
          observation: string | null
          professional_id: string | null
          professional_name: string | null
          section_code: string
          session_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: number
          observation?: string | null
          professional_id?: string | null
          professional_name?: string | null
          section_code: string
          session_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: number
          observation?: string | null
          professional_id?: string | null
          professional_name?: string | null
          section_code?: string
          session_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "round_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      round_section_goals: {
        Row: {
          created_at: string
          goal: string | null
          id: string
          section_code: string
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          goal?: string | null
          id?: string
          section_code: string
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          goal?: string | null
          id?: string
          section_code?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_section_goals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "round_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      round_sessions: {
        Row: {
          admission_reason: string | null
          created_at: string
          created_by: string | null
          department: string
          hospital_unit_id: string
          id: string
          observations: string | null
          patient_age: string | null
          patient_bed: string | null
          patient_birth_date: string | null
          patient_id: string | null
          patient_name: string
          patient_sector: string | null
          patient_social_name: string | null
          round_date: string
          state_id: string
          updated_at: string
        }
        Insert: {
          admission_reason?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          hospital_unit_id: string
          id?: string
          observations?: string | null
          patient_age?: string | null
          patient_bed?: string | null
          patient_birth_date?: string | null
          patient_id?: string | null
          patient_name: string
          patient_sector?: string | null
          patient_social_name?: string | null
          round_date?: string
          state_id: string
          updated_at?: string
        }
        Update: {
          admission_reason?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          hospital_unit_id?: string
          id?: string
          observations?: string | null
          patient_age?: string | null
          patient_bed?: string | null
          patient_birth_date?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_sector?: string | null
          patient_social_name?: string | null
          round_date?: string
          state_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_sessions_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_sessions_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      saps3_assessments: {
        Row: {
          admission_reason: string | null
          admission_reason_detail: string | null
          age: number | null
          bilirubin_highest: number | null
          box1_score: number | null
          box2_score: number | null
          box3_score: number | null
          clinical_history: Json
          comorbidities: Json | null
          created_at: string
          created_by: string | null
          creatinine_highest: number | null
          department: string
          escala_consciencia: Json | null
          gcs_score: number | null
          heart_rate_highest: number | null
          hospital_los_before_icu: number | null
          hospital_unit_id: string
          icu_admission_source: string | null
          id: string
          infection_at_admission: string | null
          is_mechanically_ventilated: boolean | null
          leukocytes: number | null
          lifestyle_habits: Json
          oxygenation_pao2_fio2: number | null
          patient_id: string | null
          patient_name: string
          pending_since: string | null
          ph_lowest: number | null
          planned_admission: boolean | null
          platelets_lowest: number | null
          predicted_mortality: number | null
          state_id: string
          status: string
          surgery_type: string | null
          surgical_status: string | null
          systolic_bp_lowest: number | null
          temperature_lowest: number | null
          total_score: number | null
          updated_at: string
          vasoactive_drugs: Json
        }
        Insert: {
          admission_reason?: string | null
          admission_reason_detail?: string | null
          age?: number | null
          bilirubin_highest?: number | null
          box1_score?: number | null
          box2_score?: number | null
          box3_score?: number | null
          clinical_history?: Json
          comorbidities?: Json | null
          created_at?: string
          created_by?: string | null
          creatinine_highest?: number | null
          department?: string
          escala_consciencia?: Json | null
          gcs_score?: number | null
          heart_rate_highest?: number | null
          hospital_los_before_icu?: number | null
          hospital_unit_id: string
          icu_admission_source?: string | null
          id?: string
          infection_at_admission?: string | null
          is_mechanically_ventilated?: boolean | null
          leukocytes?: number | null
          lifestyle_habits?: Json
          oxygenation_pao2_fio2?: number | null
          patient_id?: string | null
          patient_name: string
          pending_since?: string | null
          ph_lowest?: number | null
          planned_admission?: boolean | null
          platelets_lowest?: number | null
          predicted_mortality?: number | null
          state_id: string
          status?: string
          surgery_type?: string | null
          surgical_status?: string | null
          systolic_bp_lowest?: number | null
          temperature_lowest?: number | null
          total_score?: number | null
          updated_at?: string
          vasoactive_drugs?: Json
        }
        Update: {
          admission_reason?: string | null
          admission_reason_detail?: string | null
          age?: number | null
          bilirubin_highest?: number | null
          box1_score?: number | null
          box2_score?: number | null
          box3_score?: number | null
          clinical_history?: Json
          comorbidities?: Json | null
          created_at?: string
          created_by?: string | null
          creatinine_highest?: number | null
          department?: string
          escala_consciencia?: Json | null
          gcs_score?: number | null
          heart_rate_highest?: number | null
          hospital_los_before_icu?: number | null
          hospital_unit_id?: string
          icu_admission_source?: string | null
          id?: string
          infection_at_admission?: string | null
          is_mechanically_ventilated?: boolean | null
          leukocytes?: number | null
          lifestyle_habits?: Json
          oxygenation_pao2_fio2?: number | null
          patient_id?: string | null
          patient_name?: string
          pending_since?: string | null
          ph_lowest?: number | null
          planned_admission?: boolean | null
          platelets_lowest?: number | null
          predicted_mortality?: number | null
          state_id?: string
          status?: string
          surgery_type?: string | null
          surgical_status?: string | null
          systolic_bp_lowest?: number | null
          temperature_lowest?: number | null
          total_score?: number | null
          updated_at?: string
          vasoactive_drugs?: Json
        }
        Relationships: [
          {
            foreignKeyName: "saps3_assessments_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saps3_assessments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saps3_assessments_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      sepsis_protocols: {
        Row: {
          antibiotic_prescription_date: string | null
          antibiotic_prescription_time: string | null
          attendance_number: string | null
          birth_date: string | null
          blood_culture_date: string | null
          blood_culture_time: string | null
          created_at: string
          created_by: string | null
          destination: string | null
          destination_date: string | null
          destination_time: string | null
          dysfunction_acidosis: boolean | null
          dysfunction_bilirubin: boolean | null
          dysfunction_consciousness: boolean | null
          dysfunction_excluded_date: string | null
          dysfunction_hypotension: boolean | null
          dysfunction_oliguria: boolean | null
          dysfunction_pao2: boolean | null
          dysfunction_platelets: boolean | null
          focus_abdominal: boolean | null
          focus_neurological: boolean | null
          focus_other: string | null
          focus_pulmonary: boolean | null
          focus_skin: boolean | null
          focus_urinary: boolean | null
          has_infection: boolean | null
          has_organic_dysfunction: boolean | null
          hospital: string | null
          hospital_unit_id: string
          id: string
          infection_excluded_date: string | null
          lactate_date: string | null
          lactate_time: string | null
          notes: string | null
          opening_date: string | null
          opening_time: string | null
          outcome: string | null
          outcome_date: string | null
          outcome_time: string | null
          patient_id: string | null
          patient_name: string
          patient_weight: number | null
          responsible_name: string | null
          sirs_heart_rate: boolean | null
          sirs_leukocytosis: boolean | null
          sirs_leukopenia: boolean | null
          sirs_respiratory_rate: boolean | null
          sirs_temp_high: boolean | null
          sirs_temp_low: boolean | null
          sirs_young_cells: boolean | null
          state_id: string
          updated_at: string
          volume_administered: number | null
        }
        Insert: {
          antibiotic_prescription_date?: string | null
          antibiotic_prescription_time?: string | null
          attendance_number?: string | null
          birth_date?: string | null
          blood_culture_date?: string | null
          blood_culture_time?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          destination_date?: string | null
          destination_time?: string | null
          dysfunction_acidosis?: boolean | null
          dysfunction_bilirubin?: boolean | null
          dysfunction_consciousness?: boolean | null
          dysfunction_excluded_date?: string | null
          dysfunction_hypotension?: boolean | null
          dysfunction_oliguria?: boolean | null
          dysfunction_pao2?: boolean | null
          dysfunction_platelets?: boolean | null
          focus_abdominal?: boolean | null
          focus_neurological?: boolean | null
          focus_other?: string | null
          focus_pulmonary?: boolean | null
          focus_skin?: boolean | null
          focus_urinary?: boolean | null
          has_infection?: boolean | null
          has_organic_dysfunction?: boolean | null
          hospital?: string | null
          hospital_unit_id: string
          id?: string
          infection_excluded_date?: string | null
          lactate_date?: string | null
          lactate_time?: string | null
          notes?: string | null
          opening_date?: string | null
          opening_time?: string | null
          outcome?: string | null
          outcome_date?: string | null
          outcome_time?: string | null
          patient_id?: string | null
          patient_name: string
          patient_weight?: number | null
          responsible_name?: string | null
          sirs_heart_rate?: boolean | null
          sirs_leukocytosis?: boolean | null
          sirs_leukopenia?: boolean | null
          sirs_respiratory_rate?: boolean | null
          sirs_temp_high?: boolean | null
          sirs_temp_low?: boolean | null
          sirs_young_cells?: boolean | null
          state_id: string
          updated_at?: string
          volume_administered?: number | null
        }
        Update: {
          antibiotic_prescription_date?: string | null
          antibiotic_prescription_time?: string | null
          attendance_number?: string | null
          birth_date?: string | null
          blood_culture_date?: string | null
          blood_culture_time?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          destination_date?: string | null
          destination_time?: string | null
          dysfunction_acidosis?: boolean | null
          dysfunction_bilirubin?: boolean | null
          dysfunction_consciousness?: boolean | null
          dysfunction_excluded_date?: string | null
          dysfunction_hypotension?: boolean | null
          dysfunction_oliguria?: boolean | null
          dysfunction_pao2?: boolean | null
          dysfunction_platelets?: boolean | null
          focus_abdominal?: boolean | null
          focus_neurological?: boolean | null
          focus_other?: string | null
          focus_pulmonary?: boolean | null
          focus_skin?: boolean | null
          focus_urinary?: boolean | null
          has_infection?: boolean | null
          has_organic_dysfunction?: boolean | null
          hospital?: string | null
          hospital_unit_id?: string
          id?: string
          infection_excluded_date?: string | null
          lactate_date?: string | null
          lactate_time?: string | null
          notes?: string | null
          opening_date?: string | null
          opening_time?: string | null
          outcome?: string | null
          outcome_date?: string | null
          outcome_time?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_weight?: number | null
          responsible_name?: string | null
          sirs_heart_rate?: boolean | null
          sirs_leukocytosis?: boolean | null
          sirs_leukopenia?: boolean | null
          sirs_respiratory_rate?: boolean | null
          sirs_temp_high?: boolean | null
          sirs_temp_low?: boolean | null
          sirs_young_cells?: boolean | null
          state_id?: string
          updated_at?: string
          volume_administered?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sepsis_protocols_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sepsis_protocols_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sepsis_protocols_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_handovers: {
        Row: {
          created_at: string
          created_by: string | null
          department: string
          handover_datetime: string
          handover_from: string | null
          handover_to: string | null
          hospital_unit_id: string
          id: string
          notes: string | null
          occupied_beds: number
          shift_type: string | null
          snapshot_data: Json
          state_id: string
          total_patients: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string
          handover_datetime?: string
          handover_from?: string | null
          handover_to?: string | null
          hospital_unit_id: string
          id?: string
          notes?: string | null
          occupied_beds?: number
          shift_type?: string | null
          snapshot_data: Json
          state_id: string
          total_patients?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string
          handover_datetime?: string
          handover_from?: string | null
          handover_to?: string | null
          hospital_unit_id?: string
          id?: string
          notes?: string | null
          occupied_beds?: number
          shift_type?: string | null
          snapshot_data?: Json
          state_id?: string
          total_patients?: number
        }
        Relationships: [
          {
            foreignKeyName: "shift_handovers_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_handovers_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      states: {
        Row: {
          abbreviation: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          abbreviation: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          abbreviation?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      therapeutic_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          hospital_unit_id: string | null
          id: string
          is_global: boolean
          items: Json
          name: string
          protocol_type: string
          state_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          hospital_unit_id?: string | null
          id?: string
          is_global?: boolean
          items?: Json
          name: string
          protocol_type: string
          state_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          hospital_unit_id?: string | null
          id?: string
          is_global?: boolean
          items?: Json
          name?: string
          protocol_type?: string
          state_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapeutic_templates_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapeutic_templates_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      unidentified_sequences: {
        Row: {
          last_sequence: number
          updated_at: string
          year_ref: string
        }
        Insert: {
          last_sequence?: number
          updated_at?: string
          year_ref: string
        }
        Update: {
          last_sequence?: number
          updated_at?: string
          year_ref?: string
        }
        Relationships: []
      }
      user_admin_audit: {
        Row: {
          access_profile: string | null
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_name: string | null
          app_role: string | null
          created_at: string
          departments: string[] | null
          hospital_unit_id: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          target_email: string | null
          target_name: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          access_profile?: string | null
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          app_role?: string | null
          created_at?: string
          departments?: string[] | null
          hospital_unit_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          target_email?: string | null
          target_name?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          access_profile?: string | null
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          app_role?: string | null
          created_at?: string
          departments?: string[] | null
          hospital_unit_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          target_email?: string | null
          target_name?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          accepted_at: string
          consent_type: string
          consent_version: string
          created_at: string
          id: string
          ip_address: unknown
          revoked_at: string | null
          revoked_reason: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          consent_type: string
          consent_version: string
          created_at?: string
          id?: string
          ip_address?: unknown
          revoked_at?: string | null
          revoked_reason?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          consent_type?: string
          consent_version?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          revoked_at?: string | null
          revoked_reason?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_departments: {
        Row: {
          created_at: string
          department: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_hospital_assignments: {
        Row: {
          created_at: string
          hospital_unit_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hospital_unit_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hospital_unit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_hospital_assignments_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vital_signs: {
        Row: {
          base_excess: number | null
          consciousness_level: string | null
          created_at: string
          creatinine: number | null
          department: string
          diastolic_bp: number | null
          fio2: number | null
          hco3: number | null
          heart_rate: number | null
          hematocrit: number | null
          hemoglobin: number | null
          hospital_unit_id: string
          id: string
          inr: number | null
          lactate: number | null
          leukocytes: number | null
          news2_risk: string | null
          news2_score: number | null
          notes: string | null
          patient_id: string
          pco2: number | null
          pcr: number | null
          ph: number | null
          platelets: number | null
          po2: number | null
          potassium: number | null
          procalcitonin: number | null
          pvc: number | null
          recorded_at: string
          recorded_by: string | null
          recorded_by_name: string | null
          respiratory_rate: number | null
          sao2: number | null
          sodium: number | null
          spo2: number | null
          state_id: string
          supplemental_oxygen: boolean | null
          systolic_bp: number | null
          temperature: number | null
          urea: number | null
        }
        Insert: {
          base_excess?: number | null
          consciousness_level?: string | null
          created_at?: string
          creatinine?: number | null
          department?: string
          diastolic_bp?: number | null
          fio2?: number | null
          hco3?: number | null
          heart_rate?: number | null
          hematocrit?: number | null
          hemoglobin?: number | null
          hospital_unit_id: string
          id?: string
          inr?: number | null
          lactate?: number | null
          leukocytes?: number | null
          news2_risk?: string | null
          news2_score?: number | null
          notes?: string | null
          patient_id: string
          pco2?: number | null
          pcr?: number | null
          ph?: number | null
          platelets?: number | null
          po2?: number | null
          potassium?: number | null
          procalcitonin?: number | null
          pvc?: number | null
          recorded_at?: string
          recorded_by?: string | null
          recorded_by_name?: string | null
          respiratory_rate?: number | null
          sao2?: number | null
          sodium?: number | null
          spo2?: number | null
          state_id: string
          supplemental_oxygen?: boolean | null
          systolic_bp?: number | null
          temperature?: number | null
          urea?: number | null
        }
        Update: {
          base_excess?: number | null
          consciousness_level?: string | null
          created_at?: string
          creatinine?: number | null
          department?: string
          diastolic_bp?: number | null
          fio2?: number | null
          hco3?: number | null
          heart_rate?: number | null
          hematocrit?: number | null
          hemoglobin?: number | null
          hospital_unit_id?: string
          id?: string
          inr?: number | null
          lactate?: number | null
          leukocytes?: number | null
          news2_risk?: string | null
          news2_score?: number | null
          notes?: string | null
          patient_id?: string
          pco2?: number | null
          pcr?: number | null
          ph?: number | null
          platelets?: number | null
          po2?: number | null
          potassium?: number | null
          procalcitonin?: number | null
          pvc?: number | null
          recorded_at?: string
          recorded_by?: string | null
          recorded_by_name?: string | null
          respiratory_rate?: number | null
          sao2?: number | null
          sodium?: number | null
          spo2?: number | null
          state_id?: string
          supplemental_oxygen?: boolean | null
          systolic_bp?: number | null
          temperature?: number | null
          urea?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vital_signs_hospital_unit_id_fkey"
            columns: ["hospital_unit_id"]
            isOneToOne: false
            referencedRelation: "hospital_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vital_signs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vital_signs_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      patient_timeline: {
        Row: {
          author_id: string | null
          department: string | null
          event_at: string | null
          event_id: string | null
          event_label: string | null
          event_type: string | null
          hospital_unit_id: string | null
          patient_id: string | null
          patient_name: string | null
          patient_registry_id: string | null
          payload: Json | null
          state_id: string | null
          summary: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_hard_delete_patient: {
        Args: {
          p_patient_id: string
          p_reason?: string
          p_registry_id?: string
        }
        Returns: Json
      }
      admin_update_user_password: {
        Args: { p_email: string; p_new_password: string }
        Returns: Json
      }
      archive_bed_history: { Args: { p_patient_id: string }; Returns: string }
      bump_quick_template_use: {
        Args: { _template_id: string }
        Returns: undefined
      }
      calc_dv_mod11: { Args: { p_base: string }; Returns: number }
      can_assign_department: {
        Args: { _caller: string; _target: string }
        Returns: boolean
      }
      check_patient_duplicate: {
        Args: { p_cns?: string; p_cpf?: string }
        Returns: {
          birth_date: string
          cns: string
          cpf: string
          full_name: string
          id: string
          match_field: string
          medical_record: string
        }[]
      }
      cleanup_locked_sector_pending_allocations: { Args: never; Returns: Json }
      create_patient_snapshot: {
        Args: { p_description: string; p_patient_id: string }
        Returns: string
      }
      generate_encounter_code_v2: {
        Args: { p_data_hora_admissao?: string; p_medical_record_id: string }
        Returns: string
      }
      generate_medical_record_number: {
        Args: {
          p_codigo_unidade: string
          p_data_criacao?: string
          p_patient_id?: string
          p_patient_registry_id?: string
        }
        Returns: string
      }
      generate_ni_code: { Args: never; Returns: string }
      get_auth_user_id_by_email: { Args: { p_email: string }; Returns: string }
      get_patient_timeline: {
        Args: {
          p_event_types?: string[]
          p_from_date?: string
          p_limit?: number
          p_patient_id?: string
          p_patient_registry_id?: string
          p_search?: string
          p_to_date?: string
        }
        Returns: {
          author_email: string
          author_id: string
          department: string
          event_at: string
          event_id: string
          event_label: string
          event_type: string
          hospital_unit_id: string
          patient_id: string
          patient_name: string
          patient_registry_id: string
          payload: Json
          state_id: string
          summary: string
        }[]
      }
      get_user_app_role: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_coordenador: { Args: { _user_id: string }; Returns: boolean }
      is_dev_user: { Args: { _user_id: string }; Returns: boolean }
      is_developer_profile: { Args: { _user_id: string }; Returns: boolean }
      is_gestor: { Args: { _user_id: string }; Returns: boolean }
      is_global_profile: {
        Args: { _access_profile: string; _app_role: string }
        Returns: boolean
      }
      is_ip_allowed_for_module: {
        Args: { _ip: unknown; _module: string }
        Returns: boolean
      }
      is_username_available: {
        Args: { p_exclude_user?: string; p_username: string }
        Returns: boolean
      }
      merge_unidentified_patient: {
        Args: { p_ni_id: string; p_target_id: string }
        Returns: string
      }
      normalize_text_immutable: { Args: { input: string }; Returns: string }
      promote_unidentified_patient: {
        Args: {
          p_address?: string
          p_birth_date?: string
          p_cns?: string
          p_cpf?: string
          p_full_name: string
          p_mother_name?: string
          p_ni_id: string
          p_phone?: string
          p_sex?: string
        }
        Returns: string
      }
      repoint_patient_history: {
        Args: {
          p_reason?: string
          p_source_patient_id: string
          p_target_patient_id: string
        }
        Returns: Json
      }
      search_movements_global: {
        Args: {
          p_hospital_unit_id: string
          p_limit?: number
          p_search_term: string
          p_state_id: string
        }
        Returns: {
          created_at: string
          destination: string
          id: string
          movement_type: string
          patient_bed: string
          patient_name: string
          patient_sector: string
        }[]
      }
      search_patients_global: {
        Args: {
          p_hospital_unit_id: string
          p_limit?: number
          p_search_term: string
          p_state_id: string
        }
        Returns: {
          bed_number: string
          department: string
          diagnoses: string
          id: string
          name: string
          sector: string
        }[]
      }
      setup_farmacia_user: { Args: never; Returns: undefined }
      setup_medicoporta_user: { Args: never; Returns: undefined }
      setup_medicouti_user: { Args: never; Returns: undefined }
      setup_visitante_user: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      track_medication_use: {
        Args: {
          p_category: string
          p_medication_id: string
          p_medication_name: string
        }
        Returns: undefined
      }
      unaccent_immutable: { Args: { input: string }; Returns: string }
      user_in_hospital: {
        Args: { _hospital_unit_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_global: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "medico"
        | "porta"
        | "visitante"
        | "farmacia"
        | "nir"
        | "dev"
        | "coordenador"
      audit_action:
        | "INSERT"
        | "UPDATE"
        | "DELETE"
        | "SELECT"
        | "LOGIN"
        | "LOGOUT"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "medico",
        "porta",
        "visitante",
        "farmacia",
        "nir",
        "dev",
        "coordenador",
      ],
      audit_action: ["INSERT", "UPDATE", "DELETE", "SELECT", "LOGIN", "LOGOUT"],
    },
  },
} as const
