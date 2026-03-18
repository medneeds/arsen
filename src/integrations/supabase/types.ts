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
          clinical_history: string | null
          created_at: string
          created_by: string | null
          department: string
          diagnostic_hypothesis: string | null
          hospital_unit_id: string
          id: string
          initial_conduct: string | null
          patient_id: string
          state_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          chief_complaint?: string | null
          clinical_history?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          diagnostic_hypothesis?: string | null
          hospital_unit_id: string
          id?: string
          initial_conduct?: string | null
          patient_id: string
          state_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          chief_complaint?: string | null
          clinical_history?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          diagnostic_hypothesis?: string | null
          hospital_unit_id?: string
          id?: string
          initial_conduct?: string | null
          patient_id?: string
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
            foreignKeyName: "conduct_history_state_id_fkey"
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
            foreignKeyName: "dhd_patients_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_units: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          state_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          state_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          state_id?: string
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
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
          pharmacological_group?: string | null
          requires_dilution?: boolean
          therapeutic_class?: string
          updated_at?: string
        }
        Relationships: []
      }
      medication_presentations: {
        Row: {
          concentration: string
          created_at: string
          form: string
          id: string
          infusion_time: string | null
          max_daily_dose: string | null
          medication_id: string
          route: string
          standard_dilution: string | null
          unit: string
        }
        Insert: {
          concentration: string
          created_at?: string
          form: string
          id?: string
          infusion_time?: string | null
          max_daily_dose?: string | null
          medication_id: string
          route?: string
          standard_dilution?: string | null
          unit?: string
        }
        Update: {
          concentration?: string
          created_at?: string
          form?: string
          id?: string
          infusion_time?: string | null
          max_daily_dose?: string | null
          medication_id?: string
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
          patient_sector: string | null
          patient_snapshot: Json | null
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
          patient_sector?: string | null
          patient_snapshot?: Json | null
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
          patient_sector?: string | null
          patient_snapshot?: Json | null
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
            foreignKeyName: "patient_movements_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
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
          hospital_unit_id: string
          id: string
          internment_notes: string | null
          internment_status: string | null
          is_door_patient: boolean | null
          is_vacant: boolean | null
          medical_history: string | null
          medical_responsibility: Json | null
          name: string
          pendencies: string | null
          psm_status: string | null
          relevant_exams: string | null
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
        }
        Insert: {
          admission_date?: string | null
          admission_history?: string | null
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
          hospital_unit_id: string
          id?: string
          internment_notes?: string | null
          internment_status?: string | null
          is_door_patient?: boolean | null
          is_vacant?: boolean | null
          medical_history?: string | null
          medical_responsibility?: Json | null
          name?: string
          pendencies?: string | null
          psm_status?: string | null
          relevant_exams?: string | null
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
        }
        Update: {
          admission_date?: string | null
          admission_history?: string | null
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
          hospital_unit_id?: string
          id?: string
          internment_notes?: string | null
          internment_status?: string | null
          is_door_patient?: boolean | null
          is_vacant?: boolean | null
          medical_history?: string | null
          medical_responsibility?: Json | null
          name?: string
          pendencies?: string | null
          psm_status?: string | null
          relevant_exams?: string | null
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
          birth_date: string | null
          city: string | null
          cns: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          department: string
          destination_bed: string | null
          destination_sector: string | null
          hospital_unit_id: string
          id: string
          medical_record: string | null
          mother_name: string | null
          neighborhood: string | null
          notes: string | null
          patient_name: string
          phone: string | null
          risk_classification: string | null
          risk_classified_at: string | null
          risk_classified_by: string | null
          sex: string | null
          social_name: string | null
          state_id: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          ai_extracted_data?: Json | null
          birth_date?: string | null
          city?: string | null
          cns?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          destination_bed?: string | null
          destination_sector?: string | null
          hospital_unit_id: string
          id?: string
          medical_record?: string | null
          mother_name?: string | null
          neighborhood?: string | null
          notes?: string | null
          patient_name: string
          phone?: string | null
          risk_classification?: string | null
          risk_classified_at?: string | null
          risk_classified_by?: string | null
          sex?: string | null
          social_name?: string | null
          state_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          ai_extracted_data?: Json | null
          birth_date?: string | null
          city?: string | null
          cns?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          destination_bed?: string | null
          destination_sector?: string | null
          hospital_unit_id?: string
          id?: string
          medical_record?: string | null
          mother_name?: string | null
          neighborhood?: string | null
          notes?: string | null
          patient_name?: string
          phone?: string | null
          risk_classification?: string | null
          risk_classified_at?: string | null
          risk_classified_by?: string | null
          sex?: string | null
          social_name?: string | null
          state_id?: string
          status?: string
          updated_at?: string
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
            foreignKeyName: "pre_admissions_state_id_fkey"
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
          hospital_unit_id: string
          id: string
          items: Json
          notes: string | null
          parent_id: string | null
          patient_data: Json
          patient_name: string
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
          hospital_unit_id: string
          id?: string
          items?: Json
          notes?: string | null
          parent_id?: string | null
          patient_data?: Json
          patient_name: string
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
          hospital_unit_id?: string
          id?: string
          items?: Json
          notes?: string | null
          parent_id?: string | null
          patient_data?: Json
          patient_name?: string
          state_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
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
          approved_at: string | null
          approved_by: string | null
          created_at: string
          crm: string | null
          data_deletion_requested_at: string | null
          data_export_requested_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          specialty: string | null
          status: string
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          crm?: string | null
          data_deletion_requested_at?: string | null
          data_export_requested_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          specialty?: string | null
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          crm?: string | null
          data_deletion_requested_at?: string | null
          data_export_requested_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          specialty?: string | null
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_user_password: {
        Args: { p_email: string; p_new_password: string }
        Returns: Json
      }
      get_auth_user_id_by_email: { Args: { p_email: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      setup_medicoporta_user: { Args: never; Returns: undefined }
      setup_medicouti_user: { Args: never; Returns: undefined }
      setup_visitante_user: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "medico" | "porta" | "visitante"
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
      app_role: ["admin", "medico", "porta", "visitante"],
      audit_action: ["INSERT", "UPDATE", "DELETE", "SELECT", "LOGIN", "LOGOUT"],
    },
  },
} as const
