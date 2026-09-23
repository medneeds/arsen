export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      alas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          descricao: string | null
          hospital_id: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          hospital_id: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          hospital_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "alas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alas_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitais"
            referencedColumns: ["id"]
          },
        ]
      }
      altas: {
        Row: {
          assinado_por: string | null
          conteudo: Json | null
          criado_em: string
          crm_assinatura: string | null
          data_hora: string
          id: string
          internacao_id: string
          numero_documento: string | null
          tipo: string
        }
        Insert: {
          assinado_por?: string | null
          conteudo?: Json | null
          criado_em?: string
          crm_assinatura?: string | null
          data_hora?: string
          id?: string
          internacao_id: string
          numero_documento?: string | null
          tipo: string
        }
        Update: {
          assinado_por?: string | null
          conteudo?: Json | null
          criado_em?: string
          crm_assinatura?: string | null
          data_hora?: string
          id?: string
          internacao_id?: string
          numero_documento?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "altas_assinado_por_fkey"
            columns: ["assinado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altas_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      apresentacoes_medicamento: {
        Row: {
          concentracao: string
          criado_em: string
          diluicao_padrao: string | null
          dose_maxima_diaria: string | null
          forma: string
          id: string
          medicamento_id: string
          tempo_infusao: string | null
          unidade: string
          via: string
        }
        Insert: {
          concentracao: string
          criado_em?: string
          diluicao_padrao?: string | null
          dose_maxima_diaria?: string | null
          forma: string
          id?: string
          medicamento_id: string
          tempo_infusao?: string | null
          unidade?: string
          via?: string
        }
        Update: {
          concentracao?: string
          criado_em?: string
          diluicao_padrao?: string | null
          dose_maxima_diaria?: string | null
          forma?: string
          id?: string
          medicamento_id?: string
          tempo_infusao?: string | null
          unidade?: string
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "apresentacoes_medicamento_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "catalogo_medicamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_backup: {
        Row: {
          acao: string
          ator_email: string | null
          ator_id: string | null
          ator_nome: string | null
          criado_em: string
          duracao_ms: number | null
          erro: string | null
          id: string
          instancia_alvo: string | null
          instancia_origem: string | null
          ip: string | null
          job_backup_id: string | null
          job_restauracao_id: string | null
          payload: Json | null
          resultado: string | null
          user_agent: string | null
        }
        Insert: {
          acao: string
          ator_email?: string | null
          ator_id?: string | null
          ator_nome?: string | null
          criado_em?: string
          duracao_ms?: number | null
          erro?: string | null
          id?: string
          instancia_alvo?: string | null
          instancia_origem?: string | null
          ip?: string | null
          job_backup_id?: string | null
          job_restauracao_id?: string | null
          payload?: Json | null
          resultado?: string | null
          user_agent?: string | null
        }
        Update: {
          acao?: string
          ator_email?: string | null
          ator_id?: string | null
          ator_nome?: string | null
          criado_em?: string
          duracao_ms?: number | null
          erro?: string | null
          id?: string
          instancia_alvo?: string | null
          instancia_origem?: string | null
          ip?: string | null
          job_backup_id?: string | null
          job_restauracao_id?: string | null
          payload?: Json | null
          resultado?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_backup_job_backup_id_fkey"
            columns: ["job_backup_id"]
            isOneToOne: false
            referencedRelation: "jobs_backup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_backup_job_restauracao_id_fkey"
            columns: ["job_restauracao_id"]
            isOneToOne: false
            referencedRelation: "jobs_restauracao"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_saps3: {
        Row: {
          admissao_planejada: boolean | null
          atualizado_em: string
          bilirrubina_mais_alta: number | null
          comorbidades: Json | null
          creatinina_mais_alta: number | null
          criado_em: string
          criado_por: string | null
          dias_hospital_antes_uti: number | null
          escore_box1: number | null
          escore_box2: number | null
          escore_box3: number | null
          escore_glasgow: number | null
          escore_total: number | null
          fc_mais_alta: number | null
          id: string
          idade: number | null
          infeccao_na_admissao: string | null
          internacao_id: string
          leucocitos: number | null
          mortalidade_prevista: number | null
          motivo_admissao: string | null
          motivo_admissao_detalhe: string | null
          origem_admissao: string | null
          pas_mais_baixa: number | null
          ph_mais_baixo: number | null
          plaquetas_mais_baixas: number | null
          relacao_pao2_fio2: number | null
          status_cirurgico: string | null
          temperatura_mais_baixa: number | null
          tipo_cirurgia: string | null
          ventilacao_mecanica: boolean | null
        }
        Insert: {
          admissao_planejada?: boolean | null
          atualizado_em?: string
          bilirrubina_mais_alta?: number | null
          comorbidades?: Json | null
          creatinina_mais_alta?: number | null
          criado_em?: string
          criado_por?: string | null
          dias_hospital_antes_uti?: number | null
          escore_box1?: number | null
          escore_box2?: number | null
          escore_box3?: number | null
          escore_glasgow?: number | null
          escore_total?: number | null
          fc_mais_alta?: number | null
          id?: string
          idade?: number | null
          infeccao_na_admissao?: string | null
          internacao_id: string
          leucocitos?: number | null
          mortalidade_prevista?: number | null
          motivo_admissao?: string | null
          motivo_admissao_detalhe?: string | null
          origem_admissao?: string | null
          pas_mais_baixa?: number | null
          ph_mais_baixo?: number | null
          plaquetas_mais_baixas?: number | null
          relacao_pao2_fio2?: number | null
          status_cirurgico?: string | null
          temperatura_mais_baixa?: number | null
          tipo_cirurgia?: string | null
          ventilacao_mecanica?: boolean | null
        }
        Update: {
          admissao_planejada?: boolean | null
          atualizado_em?: string
          bilirrubina_mais_alta?: number | null
          comorbidades?: Json | null
          creatinina_mais_alta?: number | null
          criado_em?: string
          criado_por?: string | null
          dias_hospital_antes_uti?: number | null
          escore_box1?: number | null
          escore_box2?: number | null
          escore_box3?: number | null
          escore_glasgow?: number | null
          escore_total?: number | null
          fc_mais_alta?: number | null
          id?: string
          idade?: number | null
          infeccao_na_admissao?: string | null
          internacao_id?: string
          leucocitos?: number | null
          mortalidade_prevista?: number | null
          motivo_admissao?: string | null
          motivo_admissao_detalhe?: string | null
          origem_admissao?: string | null
          pas_mais_baixa?: number | null
          ph_mais_baixo?: number | null
          plaquetas_mais_baixas?: number | null
          relacao_pao2_fio2?: number | null
          status_cirurgico?: string | null
          temperatura_mais_baixa?: number | null
          tipo_cirurgia?: string | null
          ventilacao_mecanica?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_saps3_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_saps3_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_medicamentos: {
        Row: {
          alta_vigilancia: boolean
          atualizado_em: string
          classe_terapeutica: string
          codigo_atc: string | null
          controlado: boolean
          criado_em: string
          exige_diluicao: boolean
          grupo_farmacologico: string | null
          id: string
          nome_generico: string
          observacoes: string | null
        }
        Insert: {
          alta_vigilancia?: boolean
          atualizado_em?: string
          classe_terapeutica: string
          codigo_atc?: string | null
          controlado?: boolean
          criado_em?: string
          exige_diluicao?: boolean
          grupo_farmacologico?: string | null
          id?: string
          nome_generico: string
          observacoes?: string | null
        }
        Update: {
          alta_vigilancia?: boolean
          atualizado_em?: string
          classe_terapeutica?: string
          codigo_atc?: string | null
          controlado?: boolean
          criado_em?: string
          exige_diluicao?: boolean
          grupo_farmacologico?: string | null
          id?: string
          nome_generico?: string
          observacoes?: string | null
        }
        Relationships: []
      }
      cid10_codes: {
        Row: {
          atualizado_em: string
          capitulo: string | null
          categoria: string | null
          codigo: string
          criado_em: string
          descricao: string | null
          id: string
        }
        Insert: {
          atualizado_em?: string
          capitulo?: string | null
          categoria?: string | null
          codigo: string
          criado_em?: string
          descricao?: string | null
          id?: string
        }
        Update: {
          atualizado_em?: string
          capitulo?: string | null
          categoria?: string | null
          codigo?: string
          criado_em?: string
          descricao?: string | null
          id?: string
        }
        Relationships: []
      }
      codigos_referencia: {
        Row: {
          atualizado_em: string
          capitulo: string | null
          categoria: string | null
          codigo: string
          criado_em: string
          descricao: string
          id: string
          nome: string | null
          tipo: string
        }
        Insert: {
          atualizado_em?: string
          capitulo?: string | null
          categoria?: string | null
          codigo: string
          criado_em?: string
          descricao: string
          id?: string
          nome?: string | null
          tipo: string
        }
        Update: {
          atualizado_em?: string
          capitulo?: string | null
          categoria?: string | null
          codigo?: string
          criado_em?: string
          descricao?: string
          id?: string
          nome?: string | null
          tipo?: string
        }
        Relationships: []
      }
      config_ip_modulo: {
        Row: {
          atualizado_em: string
          descricao: string | null
          exige_ip: boolean
          ignora_para_admin: boolean
          modulo: string
        }
        Insert: {
          atualizado_em?: string
          descricao?: string | null
          exige_ip?: boolean
          ignora_para_admin?: boolean
          modulo: string
        }
        Update: {
          atualizado_em?: string
          descricao?: string | null
          exige_ip?: boolean
          ignora_para_admin?: boolean
          modulo?: string
        }
        Relationships: []
      }
      config_ip_permitido: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          habilitado: boolean
          hospital_id: string | null
          id: string
          ip_cidr: unknown
          modulo: string
          rotulo: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          habilitado?: boolean
          hospital_id?: string | null
          id?: string
          ip_cidr: unknown
          modulo: string
          rotulo?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          habilitado?: boolean
          hospital_id?: string | null
          id?: string
          ip_cidr?: unknown
          modulo?: string
          rotulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_ip_permitido_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitais"
            referencedColumns: ["id"]
          },
        ]
      }
      consentimentos_usuario: {
        Row: {
          aceito_em: string
          criado_em: string
          id: string
          ip: unknown
          motivo_revogacao: string | null
          revogado_em: string | null
          tipo_consentimento: string
          user_agent: string | null
          usuario_id: string
          versao_consentimento: string
        }
        Insert: {
          aceito_em?: string
          criado_em?: string
          id?: string
          ip?: unknown
          motivo_revogacao?: string | null
          revogado_em?: string | null
          tipo_consentimento: string
          user_agent?: string | null
          usuario_id: string
          versao_consentimento: string
        }
        Update: {
          aceito_em?: string
          criado_em?: string
          id?: string
          ip?: unknown
          motivo_revogacao?: string | null
          revogado_em?: string | null
          tipo_consentimento?: string
          user_agent?: string | null
          usuario_id?: string
          versao_consentimento?: string
        }
        Relationships: []
      }
      contadores: {
        Row: {
          ano_referencia: string
          atualizado_em: string
          codigo_unidade: string | null
          id: string
          tipo: string
          ultima_sequencia: number
        }
        Insert: {
          ano_referencia: string
          atualizado_em?: string
          codigo_unidade?: string | null
          id?: string
          tipo: string
          ultima_sequencia?: number
        }
        Update: {
          ano_referencia?: string
          atualizado_em?: string
          codigo_unidade?: string | null
          id?: string
          tipo?: string
          ultima_sequencia?: number
        }
        Relationships: []
      }
      dispensacoes: {
        Row: {
          codigo: string
          criado_em: string
          dispensado_em: string
          dispensado_por: string | null
          id: string
          itens_dispensados: Json
          observacoes: string | null
          prescricao_id: string
        }
        Insert: {
          codigo: string
          criado_em?: string
          dispensado_em?: string
          dispensado_por?: string | null
          id?: string
          itens_dispensados?: Json
          observacoes?: string | null
          prescricao_id: string
        }
        Update: {
          codigo?: string
          criado_em?: string
          dispensado_em?: string
          dispensado_por?: string | null
          id?: string
          itens_dispensados?: Json
          observacoes?: string | null
          prescricao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispensacoes_dispensado_por_fkey"
            columns: ["dispensado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispensacoes_prescricao_id_fkey"
            columns: ["prescricao_id"]
            isOneToOne: false
            referencedRelation: "prescricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      evolucoes: {
        Row: {
          atualizado_em: string
          criado_em: string
          data_hora: string
          exame_fisico: Json | null
          id: string
          internacao_id: string
          motivo_suspensao: string | null
          profissional_id: string
          soap: Json | null
          status: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data_hora?: string
          exame_fisico?: Json | null
          id?: string
          internacao_id: string
          motivo_suspensao?: string | null
          profissional_id: string
          soap?: Json | null
          status?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data_hora?: string
          exame_fisico?: Json | null
          id?: string
          internacao_id?: string
          motivo_suspensao?: string | null
          profissional_id?: string
          soap?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolucoes_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      guias_regulatorias: {
        Row: {
          atualizado_em: string
          ccih_avaliado_em: string | null
          ccih_avaliado_por: string | null
          contagem_impressao: number
          criado_em: string
          criado_por: string | null
          cultura_coletada: boolean | null
          dados_cultura: Json | null
          entradas: Json
          foco_infeccao: string | null
          hospital_id: string | null
          id: string
          impresso_em: string | null
          internacao_id: string | null
          medico_crm: string | null
          medico_especialidade: string | null
          medico_nome: string | null
          observacoes_ccih: string | null
          origem_infeccao: string | null
          prescricao_id: string | null
          status_ccih: string | null
          tipo: string
          tipo_solicitacao: string | null
        }
        Insert: {
          atualizado_em?: string
          ccih_avaliado_em?: string | null
          ccih_avaliado_por?: string | null
          contagem_impressao?: number
          criado_em?: string
          criado_por?: string | null
          cultura_coletada?: boolean | null
          dados_cultura?: Json | null
          entradas?: Json
          foco_infeccao?: string | null
          hospital_id?: string | null
          id?: string
          impresso_em?: string | null
          internacao_id?: string | null
          medico_crm?: string | null
          medico_especialidade?: string | null
          medico_nome?: string | null
          observacoes_ccih?: string | null
          origem_infeccao?: string | null
          prescricao_id?: string | null
          status_ccih?: string | null
          tipo: string
          tipo_solicitacao?: string | null
        }
        Update: {
          atualizado_em?: string
          ccih_avaliado_em?: string | null
          ccih_avaliado_por?: string | null
          contagem_impressao?: number
          criado_em?: string
          criado_por?: string | null
          cultura_coletada?: boolean | null
          dados_cultura?: Json | null
          entradas?: Json
          foco_infeccao?: string | null
          hospital_id?: string | null
          id?: string
          impresso_em?: string | null
          internacao_id?: string | null
          medico_crm?: string | null
          medico_especialidade?: string | null
          medico_nome?: string | null
          observacoes_ccih?: string | null
          origem_infeccao?: string | null
          prescricao_id?: string | null
          status_ccih?: string | null
          tipo?: string
          tipo_solicitacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guias_regulatorias_ccih_avaliado_por_fkey"
            columns: ["ccih_avaliado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guias_regulatorias_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guias_regulatorias_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guias_regulatorias_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guias_regulatorias_prescricao_id_fkey"
            columns: ["prescricao_id"]
            isOneToOne: false
            referencedRelation: "prescricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitais: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cnpj: string | null
          criado_em: string
          criado_por: string | null
          endereco: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          endereco?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          endereco?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospitais_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      identidade_visual_hospital: {
        Row: {
          atualizado_em: string
          cor_destaque: string | null
          cor_primaria: string | null
          cor_secundaria: string | null
          criado_em: string
          hospital_id: string
          id: string
          logo_url: string | null
          sigla: string
          slogan: string | null
        }
        Insert: {
          atualizado_em?: string
          cor_destaque?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          criado_em?: string
          hospital_id: string
          id?: string
          logo_url?: string | null
          sigla: string
          slogan?: string | null
        }
        Update: {
          atualizado_em?: string
          cor_destaque?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          criado_em?: string
          hospital_id?: string
          id?: string
          logo_url?: string | null
          sigla?: string
          slogan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identidade_visual_hospital_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: true
            referencedRelation: "hospitais"
            referencedColumns: ["id"]
          },
        ]
      }
      internacoes: {
        Row: {
          agenda: string | null
          atualizado_em: string
          conduta_inicial: string | null
          criado_em: string
          data_alta: string | null
          data_entrada: string
          exames_relevantes: string | null
          hipotese_diagnostica: string | null
          historia_clinica: string | null
          id: string
          leito_id: string
          paciente_id: string
          pendencias: string | null
          queixa_principal: string | null
          registrado_por: string | null
          setor_classificacao_id: string | null
          status: string
        }
        Insert: {
          agenda?: string | null
          atualizado_em?: string
          conduta_inicial?: string | null
          criado_em?: string
          data_alta?: string | null
          data_entrada?: string
          exames_relevantes?: string | null
          hipotese_diagnostica?: string | null
          historia_clinica?: string | null
          id?: string
          leito_id: string
          paciente_id: string
          pendencias?: string | null
          queixa_principal?: string | null
          registrado_por?: string | null
          setor_classificacao_id?: string | null
          status?: string
        }
        Update: {
          agenda?: string | null
          atualizado_em?: string
          conduta_inicial?: string | null
          criado_em?: string
          data_alta?: string | null
          data_entrada?: string
          exames_relevantes?: string | null
          hipotese_diagnostica?: string | null
          historia_clinica?: string | null
          id?: string
          leito_id?: string
          paciente_id?: string
          pendencias?: string | null
          queixa_principal?: string | null
          registrado_por?: string | null
          setor_classificacao_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "internacoes_leito_id_fkey"
            columns: ["leito_id"]
            isOneToOne: false
            referencedRelation: "leitos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internacoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internacoes_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internacoes_setor_classificacao_id_fkey"
            columns: ["setor_classificacao_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_backup: {
        Row: {
          atualizado_em: string
          caminho_armazenamento: string | null
          caminhos_objeto: string[]
          checksum_sha256: string | null
          contagem_linhas: Json | null
          contagem_usuarios_auth: number | null
          criado_em: string
          criado_por: string
          criado_por_email: string | null
          duracao_ms: number | null
          erro: string | null
          finalizado_em: string | null
          id: string
          iniciado_em: string | null
          instancia_origem: string | null
          manifesto: Json | null
          motivo: string | null
          progresso: Json
          status: string
          tabelas: string[]
          tamanho_bytes: number | null
          tipo: string
        }
        Insert: {
          atualizado_em?: string
          caminho_armazenamento?: string | null
          caminhos_objeto?: string[]
          checksum_sha256?: string | null
          contagem_linhas?: Json | null
          contagem_usuarios_auth?: number | null
          criado_em?: string
          criado_por: string
          criado_por_email?: string | null
          duracao_ms?: number | null
          erro?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          instancia_origem?: string | null
          manifesto?: Json | null
          motivo?: string | null
          progresso?: Json
          status?: string
          tabelas?: string[]
          tamanho_bytes?: number | null
          tipo?: string
        }
        Update: {
          atualizado_em?: string
          caminho_armazenamento?: string | null
          caminhos_objeto?: string[]
          checksum_sha256?: string | null
          contagem_linhas?: Json | null
          contagem_usuarios_auth?: number | null
          criado_em?: string
          criado_por?: string
          criado_por_email?: string | null
          duracao_ms?: number | null
          erro?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          instancia_origem?: string | null
          manifesto?: Json | null
          motivo?: string | null
          progresso?: Json
          status?: string
          tabelas?: string[]
          tamanho_bytes?: number | null
          tipo?: string
        }
        Relationships: []
      }
      jobs_restauracao: {
        Row: {
          atualizado_em: string
          caminho_arquivo_enviado: string | null
          conflitos: Json | null
          criado_em: string
          criado_por: string
          criado_por_email: string | null
          duracao_ms: number | null
          erro: string | null
          estrategia_conflito: string
          finalizado_em: string | null
          id: string
          iniciado_em: string | null
          instancia_alvo: string | null
          job_backup_id: string | null
          linhas_antes: Json
          linhas_depois: Json
          modo: string
          motivo: string | null
          progresso: Json
          relatorio: Json | null
          somente_teste: boolean
          status: string
          tabelas: string[]
        }
        Insert: {
          atualizado_em?: string
          caminho_arquivo_enviado?: string | null
          conflitos?: Json | null
          criado_em?: string
          criado_por: string
          criado_por_email?: string | null
          duracao_ms?: number | null
          erro?: string | null
          estrategia_conflito?: string
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          instancia_alvo?: string | null
          job_backup_id?: string | null
          linhas_antes?: Json
          linhas_depois?: Json
          modo?: string
          motivo?: string | null
          progresso?: Json
          relatorio?: Json | null
          somente_teste?: boolean
          status?: string
          tabelas?: string[]
        }
        Update: {
          atualizado_em?: string
          caminho_arquivo_enviado?: string | null
          conflitos?: Json | null
          criado_em?: string
          criado_por?: string
          criado_por_email?: string | null
          duracao_ms?: number | null
          erro?: string | null
          estrategia_conflito?: string
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          instancia_alvo?: string | null
          job_backup_id?: string | null
          linhas_antes?: Json
          linhas_depois?: Json
          modo?: string
          motivo?: string | null
          progresso?: Json
          relatorio?: Json | null
          somente_teste?: boolean
          status?: string
          tabelas?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "jobs_restauracao_job_backup_id_fkey"
            columns: ["job_backup_id"]
            isOneToOne: false
            referencedRelation: "jobs_backup"
            referencedColumns: ["id"]
          },
        ]
      }
      leitos: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          id: string
          motivo_bloqueio: string | null
          numero: string
          setor_id: string
          status: string
          tipo: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          motivo_bloqueio?: string | null
          numero: string
          setor_id: string
          status?: string
          tipo?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          motivo_bloqueio?: string | null
          numero?: string
          setor_id?: string
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "leitos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leitos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      log_acesso_ip: {
        Row: {
          criado_em: string
          email: string | null
          id: string
          ip: unknown
          modulo: string
          motivo: string | null
          permitido: boolean
          profissional_id: string | null
        }
        Insert: {
          criado_em?: string
          email?: string | null
          id?: string
          ip?: unknown
          modulo: string
          motivo?: string | null
          permitido: boolean
          profissional_id?: string | null
        }
        Update: {
          criado_em?: string
          email?: string | null
          id?: string
          ip?: unknown
          modulo?: string
          motivo?: string | null
          permitido?: boolean
          profissional_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_acesso_ip_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      log_limpeza_setor_bloqueado: {
        Row: {
          id: string
          leito_id: string | null
          limpo_em: string
          paciente_nome: string | null
          registro_origem_id: string
          setor: string | null
          tabela_origem: string
        }
        Insert: {
          id?: string
          leito_id?: string | null
          limpo_em?: string
          paciente_nome?: string | null
          registro_origem_id: string
          setor?: string | null
          tabela_origem: string
        }
        Update: {
          id?: string
          leito_id?: string | null
          limpo_em?: string
          paciente_nome?: string | null
          registro_origem_id?: string
          setor?: string | null
          tabela_origem?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_limpeza_setor_bloqueado_leito_id_fkey"
            columns: ["leito_id"]
            isOneToOne: false
            referencedRelation: "leitos"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_auditoria: {
        Row: {
          acao: Database["public"]["Enums"]["acao_auditoria"] | null
          ator_user_id: string | null
          campo_alterado: string | null
          campos_alterados: string[] | null
          criado_em: string
          dados_antigos: Json | null
          dados_novos: Json | null
          email_ator: string | null
          hospital_id: string | null
          id: string
          internacao_id: string | null
          ip: unknown
          motivo: string | null
          nome_tabela: string
          paciente_id: string | null
          paciente_relacionado_id: string | null
          papel_ator: string | null
          profissional_id: string | null
          registro_id: string | null
          session_id: string | null
          tipo_evento: string
          user_agent: string | null
          valor_antigo: string | null
          valor_novo: string | null
        }
        Insert: {
          acao?: Database["public"]["Enums"]["acao_auditoria"] | null
          ator_user_id?: string | null
          campo_alterado?: string | null
          campos_alterados?: string[] | null
          criado_em?: string
          dados_antigos?: Json | null
          dados_novos?: Json | null
          email_ator?: string | null
          hospital_id?: string | null
          id?: string
          internacao_id?: string | null
          ip?: unknown
          motivo?: string | null
          nome_tabela: string
          paciente_id?: string | null
          paciente_relacionado_id?: string | null
          papel_ator?: string | null
          profissional_id?: string | null
          registro_id?: string | null
          session_id?: string | null
          tipo_evento: string
          user_agent?: string | null
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Update: {
          acao?: Database["public"]["Enums"]["acao_auditoria"] | null
          ator_user_id?: string | null
          campo_alterado?: string | null
          campos_alterados?: string[] | null
          criado_em?: string
          dados_antigos?: Json | null
          dados_novos?: Json | null
          email_ator?: string | null
          hospital_id?: string | null
          id?: string
          internacao_id?: string | null
          ip?: unknown
          motivo?: string | null
          nome_tabela?: string
          paciente_id?: string | null
          paciente_relacionado_id?: string | null
          papel_ator?: string | null
          profissional_id?: string | null
          registro_id?: string | null
          session_id?: string | null
          tipo_evento?: string
          user_agent?: string | null
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_auditoria_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_auditoria_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_auditoria_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_auditoria_paciente_relacionado_id_fkey"
            columns: ["paciente_relacionado_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_auditoria_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      medicamentos_favoritos: {
        Row: {
          contagem_uso: number
          criado_em: string
          id: string
          medicamento_id: string
          profissional_id: string
          ultimo_uso_em: string
        }
        Insert: {
          contagem_uso?: number
          criado_em?: string
          id?: string
          medicamento_id: string
          profissional_id: string
          ultimo_uso_em?: string
        }
        Update: {
          contagem_uso?: number
          criado_em?: string
          id?: string
          medicamento_id?: string
          profissional_id?: string
          ultimo_uso_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicamentos_favoritos_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "catalogo_medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicamentos_favoritos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_secao_visita: {
        Row: {
          atualizado_em: string
          codigo_secao: string
          criado_em: string
          id: string
          meta: string | null
          sessao_id: string
        }
        Insert: {
          atualizado_em?: string
          codigo_secao: string
          criado_em?: string
          id?: string
          meta?: string | null
          sessao_id: string
        }
        Update: {
          atualizado_em?: string
          codigo_secao?: string
          criado_em?: string
          id?: string
          meta?: string | null
          sessao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_secao_visita_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes_visita"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos: {
        Row: {
          atualizado_em: string
          categoria_clinica: string | null
          contagem_uso: number
          conteudo: string | null
          criado_em: string
          criado_por: string | null
          descricao: string | null
          escopo: string
          escopo_campo: string | null
          hospital_id: string | null
          id: string
          itens: Json | null
          nome: string
          profissional_id: string | null
          tipo: string
          tipo_protocolo: string | null
          ultimo_uso_em: string | null
        }
        Insert: {
          atualizado_em?: string
          categoria_clinica?: string | null
          contagem_uso?: number
          conteudo?: string | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          escopo?: string
          escopo_campo?: string | null
          hospital_id?: string | null
          id?: string
          itens?: Json | null
          nome: string
          profissional_id?: string | null
          tipo: string
          tipo_protocolo?: string | null
          ultimo_uso_em?: string | null
        }
        Update: {
          atualizado_em?: string
          categoria_clinica?: string | null
          contagem_uso?: number
          conteudo?: string | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          escopo?: string
          escopo_campo?: string | null
          hospital_id?: string | null
          id?: string
          itens?: Json | null
          nome?: string
          profissional_id?: string | null
          tipo?: string
          tipo_protocolo?: string | null
          ultimo_uso_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modelos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelos_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      modo_manutencao: {
        Row: {
          ativo: boolean
          atualizado_em: string
          id: number
          iniciado_em: string | null
          iniciado_por: string | null
          motivo: string | null
          previsao_termino: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          id?: number
          iniciado_em?: string | null
          iniciado_por?: string | null
          motivo?: string | null
          previsao_termino?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          id?: number
          iniciado_em?: string | null
          iniciado_por?: string | null
          motivo?: string | null
          previsao_termino?: string | null
        }
        Relationships: []
      }
      notas_lembretes: {
        Row: {
          ativo: boolean | null
          atualizado_em: string
          concluido: boolean | null
          conteudo: string
          criado_em: string
          criado_por: string | null
          horario_lembrete: string | null
          id: string
          profissional_id: string | null
          setor_id: string | null
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string
          concluido?: boolean | null
          conteudo: string
          criado_em?: string
          criado_por?: string | null
          horario_lembrete?: string | null
          id?: string
          profissional_id?: string | null
          setor_id?: string | null
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string
          concluido?: boolean | null
          conteudo?: string
          criado_em?: string
          criado_por?: string | null
          horario_lembrete?: string | null
          id?: string
          profissional_id?: string | null
          setor_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_lembretes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_lembretes_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          alergias: string | null
          atualizado_em: string
          cns: string | null
          comorbidades: string | null
          cpf: string | null
          criado_em: string
          data_nascimento: string | null
          endereco: string | null
          id: string
          nome_completo: string
          nome_mae: string | null
          nome_social: string | null
          prontuario: string
          sexo: string | null
          telefone: string | null
          tipo_sanguineo: string | null
        }
        Insert: {
          alergias?: string | null
          atualizado_em?: string
          cns?: string | null
          comorbidades?: string | null
          cpf?: string | null
          criado_em?: string
          data_nascimento?: string | null
          endereco?: string | null
          id?: string
          nome_completo: string
          nome_mae?: string | null
          nome_social?: string | null
          prontuario: string
          sexo?: string | null
          telefone?: string | null
          tipo_sanguineo?: string | null
        }
        Update: {
          alergias?: string | null
          atualizado_em?: string
          cns?: string | null
          comorbidades?: string | null
          cpf?: string | null
          criado_em?: string
          data_nascimento?: string | null
          endereco?: string | null
          id?: string
          nome_completo?: string
          nome_mae?: string | null
          nome_social?: string | null
          prontuario?: string
          sexo?: string | null
          telefone?: string | null
          tipo_sanguineo?: string | null
        }
        Relationships: []
      }
      pacientes_dhd: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          data_fim: string
          data_inicio: string
          diagnostico: string | null
          dias_medicacao: Json | null
          hospital_id: string
          id: string
          internacao_id: string | null
          relatorio_dhd: string | null
          status: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_fim: string
          data_inicio: string
          diagnostico?: string | null
          dias_medicacao?: Json | null
          hospital_id: string
          id?: string
          internacao_id?: string | null
          relatorio_dhd?: string | null
          status?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_fim?: string
          data_inicio?: string
          diagnostico?: string | null
          dias_medicacao?: Json | null
          hospital_id?: string
          id?: string
          internacao_id?: string | null
          relatorio_dhd?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_dhd_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacientes_dhd_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      passagens_plantao: {
        Row: {
          criado_em: string
          criado_por: string | null
          dados_snapshot: Json
          id: string
          leitos_ocupados: number
          observacoes: string | null
          tipo_turno: string | null
          total_pacientes: number
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          dados_snapshot: Json
          id?: string
          leitos_ocupados?: number
          observacoes?: string | null
          tipo_turno?: string | null
          total_pacientes?: number
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          dados_snapshot?: Json
          id?: string
          leitos_ocupados?: number
          observacoes?: string | null
          tipo_turno?: string | null
          total_pacientes?: number
        }
        Relationships: []
      }
      politicas_retencao_dados: {
        Row: {
          anos_retencao: number
          atualizado_em: string
          base_legal: string | null
          criado_em: string
          descricao: string | null
          id: string
          nome_tabela: string
        }
        Insert: {
          anos_retencao?: number
          atualizado_em?: string
          base_legal?: string | null
          criado_em?: string
          descricao?: string | null
          id?: string
          nome_tabela: string
        }
        Update: {
          anos_retencao?: number
          atualizado_em?: string
          base_legal?: string | null
          criado_em?: string
          descricao?: string | null
          id?: string
          nome_tabela?: string
        }
        Relationships: []
      }
      pre_admissoes: {
        Row: {
          atualizado_em: string
          classificacao_risco: string | null
          cns: string | null
          cpf: string | null
          criado_em: string
          dados_extraidos_ia: Json | null
          data_hora: string
          data_nascimento: string | null
          id: string
          internacao_id: string | null
          nome_paciente: string
          setor_destino_id: string | null
          status: string
        }
        Insert: {
          atualizado_em?: string
          classificacao_risco?: string | null
          cns?: string | null
          cpf?: string | null
          criado_em?: string
          dados_extraidos_ia?: Json | null
          data_hora?: string
          data_nascimento?: string | null
          id?: string
          internacao_id?: string | null
          nome_paciente: string
          setor_destino_id?: string | null
          status?: string
        }
        Update: {
          atualizado_em?: string
          classificacao_risco?: string | null
          cns?: string | null
          cpf?: string | null
          criado_em?: string
          dados_extraidos_ia?: Json | null
          data_hora?: string
          data_nascimento?: string | null
          id?: string
          internacao_id?: string | null
          nome_paciente?: string
          setor_destino_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_admissoes_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_admissoes_setor_destino_id_fkey"
            columns: ["setor_destino_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      prescricoes: {
        Row: {
          assinatura_digital: Json | null
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          id: string
          internacao_id: string
          itens: Json
          observacoes: string | null
          prescricao_pai_id: string | null
          status: string
          versao: number
        }
        Insert: {
          assinatura_digital?: Json | null
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          internacao_id: string
          itens?: Json
          observacoes?: string | null
          prescricao_pai_id?: string | null
          status?: string
          versao?: number
        }
        Update: {
          assinatura_digital?: Json | null
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          internacao_id?: string
          itens?: Json
          observacoes?: string | null
          prescricao_pai_id?: string | null
          status?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "prescricoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricoes_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricoes_prescricao_pai_id_fkey"
            columns: ["prescricao_pai_id"]
            isOneToOne: false
            referencedRelation: "prescricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profissionais: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cargo: string | null
          conselho: string | null
          criado_em: string
          email: string | null
          hospital_id: string | null
          id: string
          nome: string
          numero_conselho: string | null
          papel: Database["public"]["Enums"]["papel_profissional"]
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cargo?: string | null
          conselho?: string | null
          criado_em?: string
          email?: string | null
          hospital_id?: string | null
          id?: string
          nome: string
          numero_conselho?: string | null
          papel: Database["public"]["Enums"]["papel_profissional"]
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cargo?: string | null
          conselho?: string | null
          criado_em?: string
          email?: string | null
          hospital_id?: string | null
          id?: string
          nome?: string
          numero_conselho?: string | null
          papel?: Database["public"]["Enums"]["papel_profissional"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profissionais_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitais"
            referencedColumns: ["id"]
          },
        ]
      }
      profissionais_hospitais: {
        Row: {
          criado_em: string
          hospital_id: string
          id: string
          profissional_id: string
        }
        Insert: {
          criado_em?: string
          hospital_id: string
          id?: string
          profissional_id: string
        }
        Update: {
          criado_em?: string
          hospital_id?: string
          id?: string
          profissional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profissionais_hospitais_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissionais_hospitais_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      profissionais_setores: {
        Row: {
          criado_em: string
          id: string
          profissional_id: string
          setor_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          profissional_id: string
          setor_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          profissional_id?: string
          setor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profissionais_setores_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissionais_setores_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      protocolos_sepse: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          data_abertura: string | null
          data_desfecho: string | null
          data_destino: string | null
          data_hemocultura: string | null
          data_lactato: string | null
          data_prescricao_antibiotico: string | null
          desfecho: string | null
          destino: string | null
          disfuncao_acidose: boolean | null
          disfuncao_bilirrubina: boolean | null
          disfuncao_consciencia: boolean | null
          disfuncao_hipotensao: boolean | null
          disfuncao_oliguria: boolean | null
          disfuncao_pao2: boolean | null
          disfuncao_plaquetas: boolean | null
          foco_abdominal: boolean | null
          foco_neurologico: boolean | null
          foco_outro: string | null
          foco_pele: boolean | null
          foco_pulmonar: boolean | null
          foco_urinario: boolean | null
          hora_abertura: string | null
          hora_desfecho: string | null
          hora_destino: string | null
          hora_hemocultura: string | null
          hora_lactato: string | null
          hora_prescricao_antibiotico: string | null
          id: string
          infeccao_excluida_em: string | null
          internacao_id: string
          observacoes: string | null
          peso_paciente: number | null
          possui_infeccao: boolean | null
          responsavel_abertura: string | null
          sirs_celulas_jovens: boolean | null
          sirs_freq_cardiaca: boolean | null
          sirs_freq_respiratoria: boolean | null
          sirs_leucocitose: boolean | null
          sirs_leucopenia: boolean | null
          sirs_temp_alta: boolean | null
          sirs_temp_baixa: boolean | null
          volume_administrado: number | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_abertura?: string | null
          data_desfecho?: string | null
          data_destino?: string | null
          data_hemocultura?: string | null
          data_lactato?: string | null
          data_prescricao_antibiotico?: string | null
          desfecho?: string | null
          destino?: string | null
          disfuncao_acidose?: boolean | null
          disfuncao_bilirrubina?: boolean | null
          disfuncao_consciencia?: boolean | null
          disfuncao_hipotensao?: boolean | null
          disfuncao_oliguria?: boolean | null
          disfuncao_pao2?: boolean | null
          disfuncao_plaquetas?: boolean | null
          foco_abdominal?: boolean | null
          foco_neurologico?: boolean | null
          foco_outro?: string | null
          foco_pele?: boolean | null
          foco_pulmonar?: boolean | null
          foco_urinario?: boolean | null
          hora_abertura?: string | null
          hora_desfecho?: string | null
          hora_destino?: string | null
          hora_hemocultura?: string | null
          hora_lactato?: string | null
          hora_prescricao_antibiotico?: string | null
          id?: string
          infeccao_excluida_em?: string | null
          internacao_id: string
          observacoes?: string | null
          peso_paciente?: number | null
          possui_infeccao?: boolean | null
          responsavel_abertura?: string | null
          sirs_celulas_jovens?: boolean | null
          sirs_freq_cardiaca?: boolean | null
          sirs_freq_respiratoria?: boolean | null
          sirs_leucocitose?: boolean | null
          sirs_leucopenia?: boolean | null
          sirs_temp_alta?: boolean | null
          sirs_temp_baixa?: boolean | null
          volume_administrado?: number | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_abertura?: string | null
          data_desfecho?: string | null
          data_destino?: string | null
          data_hemocultura?: string | null
          data_lactato?: string | null
          data_prescricao_antibiotico?: string | null
          desfecho?: string | null
          destino?: string | null
          disfuncao_acidose?: boolean | null
          disfuncao_bilirrubina?: boolean | null
          disfuncao_consciencia?: boolean | null
          disfuncao_hipotensao?: boolean | null
          disfuncao_oliguria?: boolean | null
          disfuncao_pao2?: boolean | null
          disfuncao_plaquetas?: boolean | null
          foco_abdominal?: boolean | null
          foco_neurologico?: boolean | null
          foco_outro?: string | null
          foco_pele?: boolean | null
          foco_pulmonar?: boolean | null
          foco_urinario?: boolean | null
          hora_abertura?: string | null
          hora_desfecho?: string | null
          hora_destino?: string | null
          hora_hemocultura?: string | null
          hora_lactato?: string | null
          hora_prescricao_antibiotico?: string | null
          id?: string
          infeccao_excluida_em?: string | null
          internacao_id?: string
          observacoes?: string | null
          peso_paciente?: number | null
          possui_infeccao?: boolean | null
          responsavel_abertura?: string | null
          sirs_celulas_jovens?: boolean | null
          sirs_freq_cardiaca?: boolean | null
          sirs_freq_respiratoria?: boolean | null
          sirs_leucocitose?: boolean | null
          sirs_leucopenia?: boolean | null
          sirs_temp_alta?: boolean | null
          sirs_temp_baixa?: boolean | null
          volume_administrado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "protocolos_sepse_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolos_sepse_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      receituarios: {
        Row: {
          assinado_por_crm: string | null
          assinado_por_nome: string | null
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          hospital_id: string | null
          id: string
          internacao_id: string | null
          itens: Json
          paciente_id: string | null
          texto_livre: string | null
          tipo: string
        }
        Insert: {
          assinado_por_crm?: string | null
          assinado_por_nome?: string | null
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          hospital_id?: string | null
          id?: string
          internacao_id?: string | null
          itens?: Json
          paciente_id?: string | null
          texto_livre?: string | null
          tipo: string
        }
        Update: {
          assinado_por_crm?: string | null
          assinado_por_nome?: string | null
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          hospital_id?: string | null
          id?: string
          internacao_id?: string | null
          itens?: Json
          paciente_id?: string | null
          texto_livre?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "receituarios_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receituarios_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receituarios_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receituarios_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      regulacoes: {
        Row: {
          atualizado_em: string
          cid_primario: string | null
          codigo_sisreg: string | null
          criado_em: string
          data_hora: string
          id: string
          internacao_id: string
          prioridade: string | null
          solicitado_por: string | null
          status: string
          tipo_solicitacao: string
          unidade_destino: string | null
        }
        Insert: {
          atualizado_em?: string
          cid_primario?: string | null
          codigo_sisreg?: string | null
          criado_em?: string
          data_hora?: string
          id?: string
          internacao_id: string
          prioridade?: string | null
          solicitado_por?: string | null
          status?: string
          tipo_solicitacao: string
          unidade_destino?: string | null
        }
        Update: {
          atualizado_em?: string
          cid_primario?: string | null
          codigo_sisreg?: string | null
          criado_em?: string
          data_hora?: string
          id?: string
          internacao_id?: string
          prioridade?: string | null
          solicitado_por?: string | null
          status?: string
          tipo_solicitacao?: string
          unidade_destino?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulacoes_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulacoes_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas_visita: {
        Row: {
          atualizado_em: string
          codigo_secao: string
          criado_em: string
          id: string
          item_id: number
          observacao: string | null
          profissional_id: string | null
          sessao_id: string
          status: string | null
        }
        Insert: {
          atualizado_em?: string
          codigo_secao: string
          criado_em?: string
          id?: string
          item_id: number
          observacao?: string | null
          profissional_id?: string | null
          sessao_id: string
          status?: string | null
        }
        Update: {
          atualizado_em?: string
          codigo_secao?: string
          criado_em?: string
          id?: string
          item_id?: number
          observacao?: string | null
          profissional_id?: string | null
          sessao_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "respostas_visita_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_visita_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes_visita"
            referencedColumns: ["id"]
          },
        ]
      }
      resultados_cultura: {
        Row: {
          antibiograma: string | null
          arquivos_resultado: Json | null
          atualizado_em: string
          criado_em: string
          data_coleta: string | null
          enviado_por: string | null
          id: string
          internacao_id: string
          lido_em: string | null
          lido_pelo_medico: boolean | null
          microorganismo: string | null
          notificado_em: string | null
          perfil_sensibilidade: string | null
          resultado_texto: string | null
          status: string
          tipo_cultura: string
        }
        Insert: {
          antibiograma?: string | null
          arquivos_resultado?: Json | null
          atualizado_em?: string
          criado_em?: string
          data_coleta?: string | null
          enviado_por?: string | null
          id?: string
          internacao_id: string
          lido_em?: string | null
          lido_pelo_medico?: boolean | null
          microorganismo?: string | null
          notificado_em?: string | null
          perfil_sensibilidade?: string | null
          resultado_texto?: string | null
          status?: string
          tipo_cultura?: string
        }
        Update: {
          antibiograma?: string | null
          arquivos_resultado?: Json | null
          atualizado_em?: string
          criado_em?: string
          data_coleta?: string | null
          enviado_por?: string | null
          id?: string
          internacao_id?: string
          lido_em?: string | null
          lido_pelo_medico?: boolean | null
          microorganismo?: string | null
          notificado_em?: string | null
          perfil_sensibilidade?: string | null
          resultado_texto?: string | null
          status?: string
          tipo_cultura?: string
        }
        Relationships: [
          {
            foreignKeyName: "resultados_cultura_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultados_cultura_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes_recepcao: {
        Row: {
          criado_em: string
          finalizado_em: string | null
          hospital_id: string
          id: string
          iniciado_em: string
          nome_usuario: string | null
          ponto_recepcao: string
          profissional_id: string | null
          ultimo_heartbeat_em: string
        }
        Insert: {
          criado_em?: string
          finalizado_em?: string | null
          hospital_id: string
          id?: string
          iniciado_em?: string
          nome_usuario?: string | null
          ponto_recepcao: string
          profissional_id?: string | null
          ultimo_heartbeat_em?: string
        }
        Update: {
          criado_em?: string
          finalizado_em?: string | null
          hospital_id?: string
          id?: string
          iniciado_em?: string
          nome_usuario?: string | null
          ponto_recepcao?: string
          profissional_id?: string | null
          ultimo_heartbeat_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_recepcao_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_recepcao_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes_visita: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          data_visita: string
          hospital_id: string
          id: string
          internacao_id: string | null
          motivo_internacao: string | null
          observacoes: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_visita?: string
          hospital_id: string
          id?: string
          internacao_id?: string | null
          motivo_internacao?: string | null
          observacoes?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_visita?: string
          hospital_id?: string
          id?: string
          internacao_id?: string | null
          motivo_internacao?: string | null
          observacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_visita_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_visita_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_visita_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          ala_id: string
          ativo: boolean
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          ala_id: string
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome: string
          tipo: string
        }
        Update: {
          ala_id?: string
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "setores_ala_id_fkey"
            columns: ["ala_id"]
            isOneToOne: false
            referencedRelation: "alas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setores_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      sinais_vitais: {
        Row: {
          criado_em: string
          data_hora: string
          freq_cardiaca: number | null
          freq_respiratoria: number | null
          id: string
          internacao_id: string
          nivel_consciencia: string | null
          observacoes: string | null
          pressao_diastolica: number | null
          pressao_sistolica: number | null
          registrado_por: string | null
          spo2: number | null
          temperatura: number | null
        }
        Insert: {
          criado_em?: string
          data_hora?: string
          freq_cardiaca?: number | null
          freq_respiratoria?: number | null
          id?: string
          internacao_id: string
          nivel_consciencia?: string | null
          observacoes?: string | null
          pressao_diastolica?: number | null
          pressao_sistolica?: number | null
          registrado_por?: string | null
          spo2?: number | null
          temperatura?: number | null
        }
        Update: {
          criado_em?: string
          data_hora?: string
          freq_cardiaca?: number | null
          freq_respiratoria?: number | null
          id?: string
          internacao_id?: string
          nivel_consciencia?: string | null
          observacoes?: string | null
          pressao_diastolica?: number | null
          pressao_sistolica?: number | null
          registrado_por?: string | null
          spo2?: number | null
          temperatura?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sinais_vitais_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinais_vitais_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      sinonimos_medicamento: {
        Row: {
          criado_em: string
          id: string
          medicamento_id: string
          nome_sinonimo: string
          tipo: string
        }
        Insert: {
          criado_em?: string
          id?: string
          medicamento_id: string
          nome_sinonimo: string
          tipo?: string
        }
        Update: {
          criado_em?: string
          id?: string
          medicamento_id?: string
          nome_sinonimo?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinonimos_medicamento_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "catalogo_medicamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_dados_lgpd: {
        Row: {
          criado_em: string
          expira_em: string | null
          id: string
          observacoes: string | null
          processado_em: string | null
          processado_por: string | null
          solicitado_em: string
          status: string
          tipo_solicitacao: string
          url_exportacao: string | null
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          expira_em?: string | null
          id?: string
          observacoes?: string | null
          processado_em?: string | null
          processado_por?: string | null
          solicitado_em?: string
          status?: string
          tipo_solicitacao: string
          url_exportacao?: string | null
          usuario_id: string
        }
        Update: {
          criado_em?: string
          expira_em?: string | null
          id?: string
          observacoes?: string | null
          processado_em?: string | null
          processado_por?: string | null
          solicitado_em?: string
          status?: string
          tipo_solicitacao?: string
          url_exportacao?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      solicitacoes_exame: {
        Row: {
          atualizado_em: string
          categoria: string
          concluido_em: string | null
          concluido_por: string | null
          criado_em: string
          id: string
          indicacao_clinica: string | null
          internacao_id: string
          itens: Json
          observacoes: string | null
          prioridade: string
          resultado_dados: Json | null
          resultado_texto: string | null
          solicitado_por: string | null
          status: string
        }
        Insert: {
          atualizado_em?: string
          categoria?: string
          concluido_em?: string | null
          concluido_por?: string | null
          criado_em?: string
          id?: string
          indicacao_clinica?: string | null
          internacao_id: string
          itens?: Json
          observacoes?: string | null
          prioridade?: string
          resultado_dados?: Json | null
          resultado_texto?: string | null
          solicitado_por?: string | null
          status?: string
        }
        Update: {
          atualizado_em?: string
          categoria?: string
          concluido_em?: string | null
          concluido_por?: string | null
          criado_em?: string
          id?: string
          indicacao_clinica?: string | null
          internacao_id?: string
          itens?: Json
          observacoes?: string | null
          prioridade?: string
          resultado_dados?: Json | null
          resultado_texto?: string | null
          solicitado_por?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_exame_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_exame_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_leito: {
        Row: {
          atualizado_em: string
          avaliado_por: string | null
          criado_em: string
          data_hora: string
          id: string
          internacao_id: string
          motivo_rejeicao: string | null
          setor_solicitado_id: string
          solicitado_por: string | null
          status: string
        }
        Insert: {
          atualizado_em?: string
          avaliado_por?: string | null
          criado_em?: string
          data_hora?: string
          id?: string
          internacao_id: string
          motivo_rejeicao?: string | null
          setor_solicitado_id: string
          solicitado_por?: string | null
          status?: string
        }
        Update: {
          atualizado_em?: string
          avaliado_por?: string | null
          criado_em?: string
          data_hora?: string
          id?: string
          internacao_id?: string
          motivo_rejeicao?: string | null
          setor_solicitado_id?: string
          solicitado_por?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_leito_avaliado_por_fkey"
            columns: ["avaliado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_leito_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_leito_setor_solicitado_id_fkey"
            columns: ["setor_solicitado_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_leito_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_pre_cadastro: {
        Row: {
          atualizado_em: string
          avaliado_em: string | null
          avaliado_por: string | null
          cpf: string
          criado_em: string
          crm: string | null
          email: string
          hospital_id: string | null
          id: string
          ip: unknown
          justificativa: string | null
          nome_completo: string
          observacoes_avaliador: string | null
          perfil_acesso: string
          status: string
          telefone: string
          user_agent: string | null
          usuario_criado_id: string | null
        }
        Insert: {
          atualizado_em?: string
          avaliado_em?: string | null
          avaliado_por?: string | null
          cpf: string
          criado_em?: string
          crm?: string | null
          email: string
          hospital_id?: string | null
          id?: string
          ip?: unknown
          justificativa?: string | null
          nome_completo: string
          observacoes_avaliador?: string | null
          perfil_acesso?: string
          status?: string
          telefone: string
          user_agent?: string | null
          usuario_criado_id?: string | null
        }
        Update: {
          atualizado_em?: string
          avaliado_em?: string | null
          avaliado_por?: string | null
          cpf?: string
          criado_em?: string
          crm?: string | null
          email?: string
          hospital_id?: string | null
          id?: string
          ip?: unknown
          justificativa?: string | null
          nome_completo?: string
          observacoes_avaliador?: string | null
          perfil_acesso?: string
          status?: string
          telefone?: string
          user_agent?: string | null
          usuario_criado_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_pre_cadastro_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitais"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_redefinicao_senha: {
        Row: {
          avaliado_em: string | null
          avaliado_por: string | null
          criado_em: string
          crm: string
          id: string
          nome_usuario: string
          nova_senha_definida_em: string | null
          observacoes_avaliador: string | null
          solicitado_em: string
          status: string
          usuario_id: string | null
        }
        Insert: {
          avaliado_em?: string | null
          avaliado_por?: string | null
          criado_em?: string
          crm: string
          id?: string
          nome_usuario: string
          nova_senha_definida_em?: string | null
          observacoes_avaliador?: string | null
          solicitado_em?: string
          status?: string
          usuario_id?: string | null
        }
        Update: {
          avaliado_em?: string | null
          avaliado_por?: string | null
          criado_em?: string
          crm?: string
          id?: string
          nome_usuario?: string
          nova_senha_definida_em?: string | null
          observacoes_avaliador?: string | null
          solicitado_em?: string
          status?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      transferencias: {
        Row: {
          atualizado_em: string
          criado_em: string
          data_hora: string
          id: string
          internacao_id: string
          leito_destino_id: string
          leito_origem_id: string
          motivo: string | null
          solicitado_por: string | null
          status: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data_hora?: string
          id?: string
          internacao_id: string
          leito_destino_id: string
          leito_origem_id: string
          motivo?: string | null
          solicitado_por?: string | null
          status?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data_hora?: string
          id?: string
          internacao_id?: string
          leito_destino_id?: string
          leito_origem_id?: string
          motivo?: string | null
          solicitado_por?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_leito_destino_id_fkey"
            columns: ["leito_destino_id"]
            isOneToOne: false
            referencedRelation: "leitos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_leito_origem_id_fkey"
            columns: ["leito_origem_id"]
            isOneToOne: false
            referencedRelation: "leitos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      validacoes_prescricao: {
        Row: {
          atualizado_em: string
          checagem_alergia_ok: boolean | null
          checagem_diluicao_ok: boolean | null
          checagem_dose_ok: boolean | null
          checagem_interacao_ok: boolean | null
          criado_em: string
          id: string
          itens_validacao: Json
          observacoes: string | null
          prescricao_id: string
          status: string
          validado_por: string | null
        }
        Insert: {
          atualizado_em?: string
          checagem_alergia_ok?: boolean | null
          checagem_diluicao_ok?: boolean | null
          checagem_dose_ok?: boolean | null
          checagem_interacao_ok?: boolean | null
          criado_em?: string
          id?: string
          itens_validacao?: Json
          observacoes?: string | null
          prescricao_id: string
          status?: string
          validado_por?: string | null
        }
        Update: {
          atualizado_em?: string
          checagem_alergia_ok?: boolean | null
          checagem_diluicao_ok?: boolean | null
          checagem_dose_ok?: boolean | null
          checagem_interacao_ok?: boolean | null
          criado_em?: string
          id?: string
          itens_validacao?: Json
          observacoes?: string | null
          prescricao_id?: string
          status?: string
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "validacoes_prescricao_prescricao_id_fkey"
            columns: ["prescricao_id"]
            isOneToOne: false
            referencedRelation: "prescricoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validacoes_prescricao_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      criar_hospital_com_admin: {
        Args: {
          p_admin_email: string
          p_admin_nome: string
          p_admin_user_id: string
          p_cnpj: string
          p_endereco: string
          p_nome_hospital: string
        }
        Returns: string
      }
      eh_admin_do_hospital: {
        Args: { _hospital_id: string; _user_id: string }
        Returns: boolean
      }
      eh_super_admin: { Args: { _user_id: string }; Returns: boolean }
      hospitais_do_usuario: { Args: { _user_id: string }; Returns: string[] }
      tem_papel: {
        Args: {
          _papel: Database["public"]["Enums"]["papel_profissional"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      acao_auditoria:
        | "INSERT"
        | "UPDATE"
        | "DELETE"
        | "SELECT"
        | "LOGIN"
        | "LOGOUT"
      papel_profissional:
        | "super_admin"
        | "admin"
        | "medico"
        | "enfermeiro"
        | "tecnico"
        | "regulador"
        | "farmacia"
        | "nir"
        | "porta"
        | "visitante"
        | "coordenador"
        | "dev"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      acao_auditoria: [
        "INSERT",
        "UPDATE",
        "DELETE",
        "SELECT",
        "LOGIN",
        "LOGOUT",
      ],
      papel_profissional: [
        "super_admin",
        "admin",
        "medico",
        "enfermeiro",
        "tecnico",
        "regulador",
        "farmacia",
        "nir",
        "porta",
        "visitante",
        "coordenador",
        "dev",
      ],
    },
  },
} as const
