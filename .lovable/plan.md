
## Análise de Viabilidade dos Relatórios

### ✅ Viáveis COM dados atuais (implementação imediata)
| Relatório | Fonte de dados |
|---|---|
| Cores da classificação de risco | `pre_admissions.risk_classification` |
| Fichas por sexo | `pre_admissions.sex` |
| Fichas por prioridade | `pre_admissions.risk_classification` |
| Fichas - Total no período | `pre_admissions.created_at` |
| Fichas por macrorregiões do MA | `pre_admissions.city` |
| Procedência | `pre_admissions.city`, `patient_registry.city` |
| Síndrome Gripal | `pre_admissions.flu_symptoms` |
| Acidentes de trânsito / PAF / Queda / Queimaduras | Busca em `pre_admissions.chief_complaint` |
| Exames PS | `exam_requests` (categoria, itens, paciente) |
| Atendimentos PS | `patient_encounters` (status, datas) |
| Média de chegada de pacientes | `patient_encounters.created_at` por hora |
| Tempo médio classif. de risco | `pre_admissions.created_at` → `risk_classified_at` |
| Internações | `patients.internment_status` |

### ⚠️ Precisam de novos campos no banco (migração necessária)
| Relatório | Campo faltante |
|---|---|
| Desfechos das fichas | `outcome` (alta, óbito, evasão, internação, transferência) |
| Óbitos PS | `outcome = 'obito'` |
| Evasões | `outcome = 'evasao'` |
| LOS (Length of Stay) | `discharge_date` (já existe mas não populado) + `outcome` |
| Tempo porta-médico | `first_medical_attendance_at` |
| Primeiro atendimento médico | `first_medical_attendance_at` |
| Tipo/Motivo de entrada | `entry_type` (espontâneo, SAMU, bombeiro, etc.) |
| Taxa de conversão | `outcome` + setor destino |
| AVC / IAM | CID no encounter (usar `admission_histories.cid_primary`) |
| Diagnósticos nas fichas | CID no encounter |
| Reincidência | `patient_registry.id` linkado nos encounters |
| Tomografias | filtro em `exam_requests.category` |
| LEAN Indicadores PA | Composição de vários tempos |
| Fichas por idade e sexo | `pre_admissions.birth_date` + `sex` ✅ |

### 🔧 Plano de execução
1. **Migração**: Adicionar campos `outcome`, `outcome_date`, `entry_type`, `first_medical_attendance_at`, `last_medical_attendance_at` na tabela `patient_encounters`
2. **RelatorioPage**: Construir interface com categorias de relatórios, filtros de data e exportação CSV
3. **Implementar primeiro**: Os 15+ relatórios viáveis com dados atuais
4. **Fase 2**: Relatórios que dependem dos novos campos (após migração e integração no fluxo)

Deseja aprovar este plano?
