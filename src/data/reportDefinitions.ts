export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  queryType: string;
  available: boolean;
}

export type ReportCategory =
  | 'atendimento'
  | 'classificacao'
  | 'tempo'
  | 'diagnostico'
  | 'desfecho'
  | 'procedencia'
  | 'exames'
  | 'incidentes'
  | 'indicadores'
  | 'gestao';

export const REPORT_CATEGORIES: Record<ReportCategory, { label: string; color: string }> = {
  atendimento: { label: 'Atendimentos', color: 'bg-blue-500' },
  classificacao: { label: 'Classificação de Risco', color: 'bg-orange-500' },
  tempo: { label: 'Tempos e LOS', color: 'bg-purple-500' },
  diagnostico: { label: 'Diagnósticos', color: 'bg-green-500' },
  desfecho: { label: 'Desfechos', color: 'bg-red-500' },
  procedencia: { label: 'Procedência', color: 'bg-teal-500' },
  exames: { label: 'Exames', color: 'bg-cyan-500' },
  incidentes: { label: 'Incidentes e Agravos', color: 'bg-amber-500' },
  indicadores: { label: 'Indicadores', color: 'bg-indigo-500' },
  gestao: { label: 'Gestão Executiva', color: 'bg-fuchsia-600' },
};

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  // Atendimentos
  { id: 'atendimentos_ps', name: 'Atendimentos Pronto Socorro', description: 'Listagem de atendimentos no PS no período', category: 'atendimento', queryType: 'encounters_list', available: true },
  { id: 'atendimentos_ps_compilado', name: 'Atendimentos PS (Compilado)', description: 'Entrada, Triagem, Primeiro atendimento, Último atendimento, Encerramento, Desfecho', category: 'atendimento', queryType: 'encounters_compiled', available: true },
  { id: 'fichas_total_periodo', name: 'Fichas - Total no período', description: 'Contando de 00:00:00 até 23:59:59 de cada dia', category: 'atendimento', queryType: 'encounters_daily_count', available: true },
  { id: 'fichas_sn_sd', name: 'Fichas no período - SD e SN', description: 'Fichas no período selecionado, levando em consideração o SN do dia anterior', category: 'atendimento', queryType: 'encounters_shift', available: true },
  { id: 'fichas_por_sexo', name: 'Fichas por sexo', description: 'Distribuição de fichas por sexo do paciente', category: 'atendimento', queryType: 'encounters_by_sex', available: true },
  { id: 'fichas_por_idade_sexo', name: 'Fichas do PS no período (por idade e sexo)', description: 'Fichas no período selecionado, segmentadas por faixa etária e sexo', category: 'atendimento', queryType: 'encounters_by_age_sex', available: true },
  { id: 'fichas_por_prioridade', name: 'Fichas por prioridade', description: 'Distribuição de fichas por nível de prioridade Manchester', category: 'atendimento', queryType: 'encounters_by_priority', available: true },
  { id: 'media_chegada', name: 'Média de chegada de pacientes no PS', description: 'Distribuição horária média de chegada de pacientes', category: 'atendimento', queryType: 'arrival_average', available: true },
  { id: 'motivo_entrada', name: 'Motivo de entrada', description: 'Distribuição por motivo de entrada ao PS', category: 'atendimento', queryType: 'entry_reason', available: true },
  { id: 'tipo_entrada', name: 'Tipo de entrada', description: 'Distribuição por tipo de entrada (espontâneo, SAMU, bombeiro, etc.)', category: 'atendimento', queryType: 'entry_type', available: true },
  { id: 'reincidencia', name: 'Reincidência de atendimentos no PS', description: 'Quantidade de atendimentos de um mesmo paciente no PS', category: 'atendimento', queryType: 'readmissions', available: true },

  // Classificação de Risco
  { id: 'cores_classificacao', name: 'Cores da classificação de risco nas fichas', description: 'Distribuição por cor de classificação Manchester', category: 'classificacao', queryType: 'risk_colors', available: true },
  { id: 'cores_classificacao_detalhado', name: 'Cores da classificação de risco (Detalhado)', description: 'Somente fichas encerradas com desfecho definido', category: 'classificacao', queryType: 'risk_colors_detailed', available: true },

  // Tempos
  { id: 'tempo_classificacao', name: 'Tempo médio de atendimento da classificação de risco', description: 'Tempo médio entre registro e classificação', category: 'tempo', queryType: 'avg_triage_time', available: true },
  { id: 'tempo_porta_medico', name: 'Tempo porta-médico', description: 'Tempo da classificação até início do atendimento médico', category: 'tempo', queryType: 'door_to_doctor', available: true },
  { id: 'tempo_primeiro_atendimento', name: 'Tempo do primeiro atendimento', description: 'Duração em minutos do primeiro atendimento após a classificação de risco', category: 'tempo', queryType: 'first_attendance_duration', available: true },
  { id: 'tempo_medio_ps_primeiro', name: 'Tempo médio atendimento médico PS (Primeiro)', description: 'Primeiro atendimento da especialidade', category: 'tempo', queryType: 'avg_first_attendance', available: true },
  { id: 'tempo_medio_ps_retornos', name: 'Tempo médio atendimento médico PS (Retornos)', description: 'Tempo médio de retornos médicos', category: 'tempo', queryType: 'avg_return_attendance', available: true },
  { id: 'tempo_permanencia_ps', name: 'Tempo total de permanência no PS', description: 'Período entre a criação da ficha até o desfecho no PS', category: 'tempo', queryType: 'total_stay', available: true },
  { id: 'los_com_internacao', name: 'LOS com internação', description: 'Length of Stay em minutos com internação', category: 'tempo', queryType: 'los_with_admission', available: true },
  { id: 'los_com_internacao_det', name: 'LOS com internação (Detalhado)', description: 'Detalhamento individual do LOS com internação', category: 'tempo', queryType: 'los_with_admission_detailed', available: true },
  { id: 'los_sem_internacao', name: 'LOS sem internação', description: 'Length of Stay em minutos sem internação', category: 'tempo', queryType: 'los_without_admission', available: true },
  { id: 'los_sem_internacao_det', name: 'LOS sem internação (Detalhado)', description: 'Detalhamento individual em minutos', category: 'tempo', queryType: 'los_without_admission_detailed', available: true },

  // Diagnósticos
  { id: 'diagnosticos_fichas', name: 'Diagnósticos nas fichas', description: 'Conta os CIDs informados nas fichas por cada especialidade', category: 'diagnostico', queryType: 'diagnosis_count', available: true },
  { id: 'avc', name: 'AVC', description: 'Atendimentos com diagnóstico de AVC', category: 'diagnostico', queryType: 'diagnosis_avc', available: true },
  { id: 'iam', name: 'IAM', description: 'Atendimentos com diagnóstico de IAM', category: 'diagnostico', queryType: 'diagnosis_iam', available: true },

  // Desfechos
  { id: 'desfechos', name: 'Desfechos das fichas', description: 'Considera o momento do fechamento da ficha no período informado', category: 'desfecho', queryType: 'outcomes', available: true },
  { id: 'desfechos_detalhado', name: 'Desfechos das fichas (Detalhado)', description: 'Considera o momento do fechamento da ficha no período informado', category: 'desfecho', queryType: 'outcomes_detailed', available: true },
  { id: 'obitos_ps', name: 'Óbitos Pronto Socorro', description: 'Entrada, Triagem, Primeiro atendimento, Último atendimento, Diagnósticos, Encerramento, Desfecho', category: 'desfecho', queryType: 'deaths', available: true },
  { id: 'evasoes', name: 'Evasões', description: 'Fichas com desfecho de evasão', category: 'desfecho', queryType: 'evasions', available: true },
  { id: 'internacoes', name: 'Internações', description: 'Pacientes internados a partir do PS', category: 'desfecho', queryType: 'admissions', available: true },

  // Procedência
  { id: 'procedencia', name: 'Procedência', description: 'Procedência pela cidade da ficha e endereço do paciente', category: 'procedencia', queryType: 'origin_city', available: true },
  { id: 'fichas_macrorregioes', name: 'Fichas por macrorregiões do Maranhão', description: 'Macronorte, sul, leste, centro', category: 'procedencia', queryType: 'macro_regions', available: true },
  { id: 'fichas_macrorregioes_det', name: 'Fichas por macrorregiões, regionais e municípios', description: 'Macronorte, sul, leste, centro. Regionais. Municípios.', category: 'procedencia', queryType: 'macro_regions_detailed', available: true },
  { id: 'procedencia_macro_saude', name: 'Procedência por Macroregionais de Saúde', description: 'Procedência pela cidade da ficha', category: 'procedencia', queryType: 'health_macro_regions', available: true },
  { id: 'procedencia_regionais', name: 'Procedência por Regionais de Saúde', description: 'Procedência pela cidade da ficha', category: 'procedencia', queryType: 'health_regions', available: true },
  { id: 'taxa_conversao_municipio', name: 'Taxa de conversão por município', description: 'Taxa de conversão de atendimento por município', category: 'procedencia', queryType: 'conversion_by_city', available: true },

  // Exames
  { id: 'exames_ps', name: 'Exames PS', description: 'Detalhamento dos pedidos de exames realizados no PS, por especialidade e por tipo de exame', category: 'exames', queryType: 'exams_summary', available: true },
  { id: 'exames_ps_detalhado', name: 'Exames PS (Detalhado)', description: 'Detalhamento com dados do paciente e exames solicitados', category: 'exames', queryType: 'exams_detailed', available: true },
  { id: 'tomografias', name: 'Tomografias', description: 'Pedidos de tomografia no período', category: 'exames', queryType: 'ct_scans', available: true },

  // Incidentes
  { id: 'acidentes_transito', name: 'Acidentes de trânsito', description: 'Busca por palavras chave relacionadas a acidentes de trânsito na queixa principal', category: 'incidentes', queryType: 'traffic_accidents', available: true },
  { id: 'acidentes_paf', name: 'Acidentes PAF', description: 'Projétil de arma de fogo', category: 'incidentes', queryType: 'firearm_injuries', available: true },
  { id: 'queda_propria_altura', name: 'Queda da própria altura', description: 'Pacientes com queixa de queda da própria altura', category: 'incidentes', queryType: 'falls', available: true },
  { id: 'queimaduras', name: 'Queimaduras', description: 'Pacientes com queixa de queimaduras', category: 'incidentes', queryType: 'burns', available: true },
  { id: 'sindrome_gripal', name: 'Síndrome Gripal', description: 'Pacientes com sintomas gripais', category: 'incidentes', queryType: 'flu_syndrome', available: true },

  // Indicadores
  { id: 'lean_indicadores', name: 'LEAN Indicadores PA', description: 'Indicadores LEAN do Pronto Atendimento', category: 'indicadores', queryType: 'lean_indicators', available: true },
  { id: 'taxa_conversao_setor', name: 'Taxa de conversão por setor', description: 'Taxa de conversão de atendimentos por setor de destino', category: 'indicadores', queryType: 'conversion_by_sector', available: true },

  // Gestão Executiva (Sprint 3)
  { id: 'gestao_ocupacao_setor', name: 'Ocupação por setor', description: 'Taxa de ocupação atual de leitos por setor (vago/ocupado/bloqueado/reservado)', category: 'gestao', queryType: 'gestao_occupancy_by_sector', available: true },
  { id: 'gestao_tempo_permanencia', name: 'Tempo de permanência', description: 'LOS médio por setor de destino e desfecho no período', category: 'gestao', queryType: 'gestao_stay_by_sector', available: true },
  { id: 'gestao_alta_obito', name: 'Taxa de alta / óbito', description: 'Distribuição de desfechos com taxas (alta, óbito, transferência, evasão)', category: 'gestao', queryType: 'gestao_discharge_death_rate', available: true },
  { id: 'gestao_producao_medico', name: 'Produção por médico', description: 'Atendimentos, evoluções e desfechos por médico no período', category: 'gestao', queryType: 'gestao_production_per_doctor', available: true },
  { id: 'gestao_fila_nir', name: 'Fila de pedidos NIR', description: 'Solicitações de leito por status, idade da fila e SLA', category: 'gestao', queryType: 'gestao_nir_queue', available: true },
  { id: 'gestao_sla_triagem', name: 'SLA de triagem', description: 'Tempo entre chegada e classificação de risco, com aderência ao SLA', category: 'gestao', queryType: 'gestao_triage_sla', available: true },

  // Gestão Executiva (Sprint 4)
  { id: 'gestao_readmissao_30d', name: 'Readmissão em 30 dias', description: 'Pacientes que retornaram ao PS dentro de 30 dias após desfecho', category: 'gestao', queryType: 'gestao_readmission_30d', available: true },
  { id: 'gestao_mortalidade_uti', name: 'Mortalidade UTI', description: 'Óbitos em pacientes com setor de destino UTI', category: 'gestao', queryType: 'gestao_uti_mortality', available: true },
  { id: 'gestao_transferencias', name: 'Transferências externas', description: 'Atendimentos com desfecho de transferência por setor de origem', category: 'gestao', queryType: 'gestao_transfers', available: true },
  { id: 'gestao_top_diagnosticos', name: 'Top diagnósticos (CID)', description: 'Ranking dos 20 CIDs mais frequentes no período', category: 'gestao', queryType: 'gestao_top_diagnoses', available: true },
  { id: 'gestao_cancelamentos_nir', name: 'Cancelamentos / Rejeições NIR', description: 'Solicitações de leito rejeitadas com motivo', category: 'gestao', queryType: 'gestao_nir_rejections', available: true },
  { id: 'gestao_tempo_limpeza', name: 'Tempo de limpeza de leito', description: 'Intervalo entre início e fim da limpeza por setor', category: 'gestao', queryType: 'gestao_cleaning_time', available: true },

  // Gestão Executiva (Sprint 5)
  { id: 'gestao_aderencia_saps3', name: 'Aderência ao SAPS 3', description: 'Pacientes UTI com SAPS 3 preenchido em até 24h da admissão', category: 'gestao', queryType: 'gestao_saps3_adherence', available: true },
];

// Macrorregiões do Maranhão
export const MARANHAO_MACRO_REGIONS: Record<string, string[]> = {
  'Macro Norte': ['São Luís', 'Raposa', 'Paço do Lumiar', 'São José de Ribamar', 'Alcântara', 'Rosário', 'Bacabeira', 'Santa Rita', 'Axixá', 'Icatu', 'Morros', 'Cachoeira Grande', 'Presidente Juscelino'],
  'Macro Sul': ['Imperatriz', 'Açailândia', 'João Lisboa', 'Davinópolis', 'Governador Edison Lobão', 'Senador La Rocque'],
  'Macro Leste': ['Caxias', 'Timon', 'Codó', 'Coroatá', 'Aldeias Altas', 'São João do Sóter'],
  'Macro Centro': ['Bacabal', 'Pedreiras', 'Santa Inês', 'Pindaré-Mirim', 'Viana', 'Zé Doca', 'Bom Jardim'],
  'Macro Oeste': ['Balsas', 'Carolina', 'Riachão', 'Tasso Fragoso', 'Feira Nova do Maranhão'],
};
