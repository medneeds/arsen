# Recursos degradados na migração para o schema novo

Campos/recursos do sistema antigo que **não têm coluna/tabela no banco novo** e foram
ocultados/desativados durante a migração (decisão do usuário: "migrar o que existe + degradar o
resto", sem inventar dados). Lista viva — cada worker adiciona o que degradou.

## Modelo Patient (internação) — campos sem destino
- Bloco UTI completo: uti_allergies, uti_devices, uti_daily_conducts, uti_discharge_prediction,
  uti_cultures_antibiotics, uti_current_status, uti_admission_date, uti_admission_reason,
  uti_origin_sector, uti_specialties
- clinical_status (cor de destaque regular/atenção/crítico) — default "regular"
- internment_status (parcial: usar internacoes.status), admission_status, medical_responsibility,
  admission_history, display_order, highlights, is_vacant

## Tabelas sem equivalente
- dev_pendencies → painel de pendências de dev fica vazio/oculto

<!-- Workers: acrescentem abaixo, agrupando por arquivo/módulo -->

## src/lib + hooks (lifecycle/write)

### src/lib/resolvePatientHeader.ts (patients/patient_registry/patient_encounters/medical_records → internacoes+pacientes)
- `atendimento` (encounter_code) — sem coluna no schema novo → sempre `null`.
- `registryId` / `unidentifiedCode` — patient_registry morto → sempre `null`.
- `isUnidentified` — antes vinha de `patient_registry.is_unidentified`; agora só heurística
  de nome (`detectUnidentified`), sem confirmação por registro.
- `address` — antes composto de logradouro/bairro/cidade/UF do registry; agora só
  `pacientes.endereco` (campo único).
- Toda a resolução por registry (guarda anti-NI por nome do registry, busca por
  medical_record, busca por nome na unidade, hint via registryIdHint) foi removida —
  identidade vem direto de `internacoes → pacientes`. Params `hospitalUnitId` e
  `registryIdHint` mantidos na assinatura por compatibilidade, mas sem uso.
- `resolveCurrentBedSector` agora resolve leito/setor via `internacoes → leitos(numero)
  + setores(nome)`.

### src/lib/bedLifecycle.ts (patients/patient_movements/patient_encounters → internacoes/leitos/logs_auditoria)
- `signalClinicalDecision`/`revokeClinicalDecision`: estado escrito em `internacoes.status`
  (substitui `patients.admission_status`); desfechos finais gravam `internacoes.data_alta`
  (substitui o fechamento do `patient_encounters`).
- Trilha de auditoria migrada de `patient_movements` → `logs_auditoria` (a nova
  `transferencias` só modela transferência leito→leito e não cabe em alta/óbito).
  Campos ricos (bed/sector/destination/snapshot/metadata) preservados em `dados_novos`.
- `executeOperationalRelocation`: caminho feliz = RPC `execute_operational_relocation_atomic`.
  O fallback sequencial (cópia de ~40 colunas clínicas entre slots `patients`, RPC
  `archive_patient_bed_data`, `repointPatientHistory`) foi DEGRADADO — sem a RPC,
  retorna erro explicativo. `KIND_TO_MOVEMENT_TYPE` mantido apenas como rótulo de auditoria.

### src/lib/internalTransfer.ts (internal_transfer_requests/patient_movements → transferencias / RPC)
- `executeInternalTransfer`: pré-etapa que resolvia `patient_registry_id` por nome
  (patient_registry morto) removida; segue usando a RPC `execute_internal_transfer_atomic`.
- `signalInternalTransfer`/`completeInternalTransfer`/`cancelInternalTransferRequest`:
  a fila virtual de 2 etapas usava `internal_transfer_requests` (morta) e a mega-tabela
  `patients`. `transferencias` exige `leito_destino_id NOT NULL`, incompatível com uma
  sinalização sem leito destino definido. Fluxos passam a depender só das RPCs atômicas
  (signal/complete/cancel `*_internal_transfer_atomic`, via `(supabase.rpc as any)`);
  sem a RPC, retornam erro explicativo (fallback sequencial DEGRADADO).
- `invalidateResolvedRegistry` (conceito de registry) removido dos fluxos.

### src/hooks/useEvolutions.ts (clinical_evolutions → evolucoes)
- `evolucoes` só tem: internacao_id, profissional_id, data_hora, soap(Json),
  exame_fisico(Json), status, motivo_suspensao. Colunas dedicadas do modelo antigo
  (patient_name/bed/sector, vital_signs, cid_primary/secondary, validated_at/by/by_name,
  suspended_at, created_by/created_by_name, evolution_type, diagnostic_hypotheses,
  archived_at/archive_reason, patient_registry_id) NÃO existem → preservadas dentro do
  JSON `soap` (chaves prefixadas `__`) ou retornadas como default.
- `vital_signs`: sem coluna em `evolucoes` (existe tabela `sinais_vitais` separada, não
  cablada aqui) → guardado dentro de `soap.__vital_signs`.
- `archived_at`: sem coluna → sempre `null` (toda a lógica de filtro por arquivado removida).
- Load: removida toda a lógica de registry/encounter/barreira-de-setor/leitos-históricos
  (patient_registry, patient_encounters, admission_histories mortos) — filtra só por
  `internacao_id`. Sem filtro por hospital/estado (colunas inexistentes em `evolucoes`).
- Evolução virtual de "admissão" agora sintetizada de `internacoes` (queixa_principal,
  historia_clinica, hipotese_diagnostica, conduta_inicial) em vez de `admission_histories`.
- Sync do card: escreve em `internacoes` (hipotese_diagnostica/historia_clinica/
  conduta_inicial/pendencias) em vez de `patients`.
- `profissional_id` resolvido via lookup em `profissionais.user_id` (≠ auth.uid).

### src/hooks/useBedAllocationRequests.ts (bed_allocation_requests → solicitacoes_leito)
- `solicitacoes_leito` só tem: internacao_id, setor_solicitado_id, status, motivo_rejeicao,
  data_hora, solicitado_por, avaliado_por (+ criado/atualizado_em). Campos antigos sem
  coluna → degradados: `requested_bed`, `requesting_doctor_name`, `requesting_office_number`,
  `reviewed_at` (mapeado para `atualizado_em`), `state_id`, `hospital_unit_id`, `department`.
- `requested_sector` passa a carregar o `setor_solicitado_id` (id do setor).
- `patient` (join) reconstruído de `internacoes(+leitos,+setores,+pacientes)`; `age` e
  `admission_history` sem fonte → `null`.
- `approveRequest`: cálculo de próximo leito (`getNextBedNumber` lendo `patients`) e a
  movimentação física do paciente removidos; apenas grava status aprovado e atualiza
  `internacoes.setor_classificacao_id`. Atribuição de leito é de outro fluxo.
- `createRequest`/`setDiscussing`/`rejectRequest`: updates de `patients.allocation_status`
  removidos (coluna inexistente). Realtime sem filtro por hospital (coluna inexistente).
- `*_por` resolvidos via lookup em `profissionais.user_id`.

### src/hooks/useDischargePredictions.ts (patients.uti_discharge_prediction → DEGRADADO)
- Fonte era `patients.uti_discharge_prediction` (bloco uti_* inteiro degradado, sem
  equivalente). Query removida; `queryFn` retorna `[]` (painel de previsões de alta vazio).
  `parsePrediction` mantida para reuso futuro.

## src/hooks (identity/live)
- **usePatientLive.ts** — `patientId` agora é `internacoes.id`; view-model montado via join
  internacoes → pacientes/leitos/setores; realtime movido de `patients` para `internacoes`
  (filter id=eq.<id>) com refetch por evento (payload não traz joins). Degradados: `admissionHistory=""`,
  `clinicalStatus="regular"`, `admissionStatus`/`medicalResponsibility=undefined`, bloco `uti_*` = []/undefined
  (sem colunas novas). Removido o cache de birth_date via `patient_registry` (idade vem de pacientes.data_nascimento).
- **usePatientIdentifiers.ts** — registro permanente resolvido em `pacientes` (via internacoes.paciente_id);
  `prontuario = pacientes.prontuario`. Degradados: `atendimento`/encounter_code → null (patient_encounters não existe);
  `registry.neighborhood/city/state` → null (pacientes.endereco é campo único); `isUnidentified` derivado por
  heurística de nome, `unidentifiedCode` → null (sem colunas). Fallback por nome perdeu filtro de unidade/NI
  (pacientes não tem hospital_unit_id/is_unidentified). Realtime: canais patients/medical_records/patient_encounters
  removidos; agora internacoes(id) + pacientes(id vinculado).
- **useResolvedRegistryId.ts** — resolve `paciente_id` a partir de `internacoes.id`; nome via join pacientes.
  Degradado: `hospitalUnitId` → null (sem coluna em internacoes/pacientes); campo mantido na interface.
- **useActiveEncounterId.ts** — patient_encounters não existe; o "encounter ativo" passou a ser a própria
  internação → `encounterId = internacoes.id` (confirmada a existência da linha). Realtime em internacoes(id).
- **usePatientRegistrySearch.ts** — busca em `pacientes` (nome_completo/cpf/cns/prontuario). Degradados:
  busca sem acento (full_name_normalized não existe → acento-sensível em nome_completo); filtro merged_into removido;
  `is_unidentified`/`unidentified_code`/`hospital_unit_id` → null. Leito/setor atual via internacoes → leitos → setores.
- **usePatientCid.ts** — CID (cid_primary/cid_secondary de admission_histories) SEM coluna de destino em
  internacoes → persistência degradada para estado apenas em memória (nada gravado no banco). Assinatura preservada.
- **usePatientDiagnosticContext.ts** — utiDischargePrediction, hospitalDischargePrediction, isPalliative,
  isolationPrecautions SEM colunas equivalentes no schema novo → persistência degradada para estado apenas em
  memória (nada gravado, realtime removido). Assinatura preservada.

## cluster ccih/round/admin

### src/pages/RoundPage.tsx (patients→internacoes; round_sessions→sessoes_visita; round_responses→respostas_visita; round_section_goals→metas_secao_visita)
- Lista de pacientes: `patients`→`internacoes(+pacientes/leitos/setores)`. Sem colunas
  hospital_unit_id/state_id/department/is_vacant → filtros de hospital/estado/UTI e leito-vago
  REMOVIDOS; "internação ativa" aproximada por `data_alta IS NULL`. Ordenação por setor/leito
  removida. `age` estático + idade via `patient_registry.birth_date` (morto) → idade calculada de
  `pacientes.data_nascimento`. `sector` = `setores.tipo` (código p/ getSectorLabel).
- `sessoes_visita`: colunas denormalizadas patient_name/patient_age/patient_sector/patient_bed,
  `encounter_id`, `state_id`, `department` NÃO existem → removidas. `internacao_id` = a própria
  internação (o "encounter" agora é a internação); paciente avulso (manual_) fica sem internacao_id.
  Mapeamento: round_date→data_visita, hospital_unit_id→hospital_id, observations→observacoes,
  created_by→criado_por, updated_at→atualizado_em.
- `respostas_visita`/`metas_secao_visita`: session_id→sessao_id, section_code→codigo_secao,
  observation→observacao, goal→meta. `profissional_id`/`criado_por` resolvidos via
  `profissionais.user_id` (≠ auth.uid). `resolveActiveEncounterId` removido (dependência do helper legado).

### src/pages/CcihDashboardPage.tsx (patients→internacoes; culture_results→resultados_cultura; exam_requests→solicitacoes_exame; prescriptions→prescricoes)
- Pacientes: mesmo padrão do RoundPage (join internacoes; filtros hospital/estado/is_vacant removidos;
  ativo = data_alta IS NULL; sector = setores.tipo). Bloco `uti_cultures_antibiotics`/`uti_devices`
  (mega-tabela patients) SEM coluna → sempre `null` (seções "Culturas/ATB do prontuário" e
  "Dispositivos invasivos" ficam ocultas).
- `resultados_cultura` não tem colunas denormalizadas de paciente (patient_name/sector/bed) nem
  uploaded_by/uploaded_by_name, encounter_id, hospital_unit_id, state_id → reconstruídas via join
  `internacoes→pacientes/leitos/setores` (leitura) e `enviado_por→profissionais.nome`. Insert grava
  em `internacao_id` (=selectedPatient.id), `enviado_por` (profissional via user_id), `notificado_em`.
  Colunas: culture_type→tipo_cultura, collection_date→data_coleta, result_text→resultado_texto,
  result_files→arquivos_resultado, microorganism→microorganismo, antibiogram→antibiograma,
  sensitivity_profile→perfil_sensibilidade, read_by_doctor→lido_pelo_medico, created_at→criado_em.
  Realtime sem filtro por hospital.
- Detalhe: `exam_requests`→`solicitacoes_exame` (items→itens, priority→prioridade,
  results→resultado_texto, category→categoria, requested_by_name→join solicitado_por→profissionais.nome),
  filtro por internacao_id; `prescriptions`→`prescricoes` (items→itens, version→versao, filtro por
  internacao_id — sem coluna patient_name; patient_name reusa o do card). Filtros hospital/estado removidos.

### src/pages/MergeRegistriesPage.tsx (patient_registry→pacientes; fusão → pacientes + logs_auditoria)
- Autorização: `user_roles`/`profiles.access_profile` → `profissionais.papel`
  (recepção/gestão ≈ super_admin/admin/coordenador/nir/porta).
- Busca/registro: `patient_registry`→`pacientes`. Sem coluna (degradado): neighborhood/city/state
  (pacientes.endereco é campo único), `is_unidentified`, `merged_into_registry_id` (filtro merged
  removido). Contagens: patients/patient_encounters→internacoes (por paciente_id);
  clinical_evolutions→evolucoes, prescriptions→prescricoes, exam_requests→solicitacoes_exame
  (por internacao_id). "Atendimentos" = nº de internações; leito ativo = internação sem data_alta.
- `medical_records` morta: prontuário é campo único em `pacientes.prontuario` → a etapa
  "prontuário predominante" passa a sintetizar 1 linha por lado a partir de pacientes.prontuario
  (não há múltiplos prontuários formais); requisito de predominantMrId no botão removido.
- **Fusão** (RPC `merge_patient_registries` NÃO existe no backend novo): reimplementada client-side →
  (1) aplica campos escolhidos em `pacientes` (winner); (2) repoint `internacoes.paciente_id`
  loser→winner; (3) grava `logs_auditoria` tipo_evento='fusao_pacientes'
  (paciente_id=winner, paciente_relacionado_id=loser, dados_antigos/novos, campos_alterados, motivo,
  ator_user_id). DEGRADADO: arquivamento do perdedor (sem merged_into_registry_id — o cadastro
  permanece), reatribuição do prontuário predominante (pacientes.prontuario é único), liberação de
  CPF/CNS e histórico formal de edição por campo.

### src/components/NotificationCenter.tsx (notes_reminders→notas_lembretes)
- Colunas: content→conteudo, type→tipo (string livre), completed→concluido,
  scheduled_popup_time→horario_lembrete, is_active→ativo, created_at→criado_em.
- SEM equivalente (degradado): `read` (controle de leitura) → tratado sempre como lida
  (badges/ações "marcar como lida" ficam ocultos; markAsRead/markAllAsRead viram no-op);
  `department` → notas_lembretes tem `setor_id` (UUID), não nome de departamento → filtro por
  department REMOVIDO (traz todas as notas ativas; realtime sem filtro).

### src/pages/AdminCoordinatorsPage.tsx (hospital_units→hospitais; profiles/user_roles/user_hospital_assignments→profissionais(+profissionais_hospitais))
- `states`/state_id: não há tabela de estados nem coluna state_id em hospitais → conceito de UF
  REMOVIDO (seletor de estado, coluna "Estado", filtro por estado). Unidades: `hospital_units`→
  `hospitais` (name←nome).
- Coordenadores: `user_hospital_assignments`→`profissionais_hospitais` (user_id→profissional_id,
  hospital_unit_id→hospital_id, created_at→criado_em); apenas vínculos com `profissionais.papel='coordenador'`.
  "Usuários disponíveis" = `profissionais` papel in (admin,coordenador) ativos (substitui
  user_roles role='admin' + profiles status='approved'). Profile.crm ← profissionais.numero_conselho.
- "Setores de Acesso" (user_departments, nomes fixos de departamento) NÃO persistido — o vínculo novo é
  profissionais_setores (setor_id UUID) e os nomes não mapeiam para setores → seleção degradada (só UI).

### src/pages/AdminDashboardPage.tsx (patient_registry→pacientes; patient_encounters→internacoes/pre_admissoes; medical_records/hospital_units/pre_admissions)
- Busca/registro/seleção: `patient_registry`→`pacientes`. Sem coluna (degradado): neighborhood/city
  (endereco único), is_unidentified/unidentified_code/unidentified_features (bloco NI), created_by,
  hospital_unit_id, state_id. `prontuario` é NOT NULL e a geração oficial
  (`generate_medical_record_number` + `hospital_units.unit_code`, ambos inexistentes) foi REMOVIDA →
  prontuário = nº informado ou fallback local (`PR-<ts>` / código NI). `generate_ni_code` pode não
  existir → try/catch com fallback local `NI-AAAA-NNNNNN`.
- "Atendimentos recentes": `patient_encounters`→`internacoes` (join pacientes/setores). Sem
  encounter_code/registry_id/triage_status/hospital_unit_id → degradados (encounter_code = id curto;
  destino = setores.tipo; registry_id = paciente_id). Filtro por hospital removido.
- **Criar atendimento / Cadastro Express**: `patient_encounters` e `medical_records` não existem e
  `internacoes` exige um leito (a recepção ainda não atribuiu) → a criação de encounter foi
  DEGRADADA para apenas uma pré-admissão (`pre_admissions`→`pre_admissoes`) aguardando leito.
  Removidos: guard anti-duplicação por encounter aberto, geração de encounter_code
  (`generate_encounter_code_v2`). pre_admissoes só recebe nome_paciente/cpf/cns/data_nascimento/
  setor_destino_id/status; colunas denormalizadas antigas (social_name, mother_name, sex, phone,
  medical_record, patient_registry_id, destination_sector-título, hospital_unit_id, state_id,
  department, created_by, notes, patient_age) sem equivalente → removidas. `setor_destino_id`
  resolvido por `setores.tipo` (= sectorKey; null se não encontrado).

## componentes (patient card / bed dialogs)

### src/components/PatientCard.tsx (patients → internacoes)
- As 4 escritas diretas do card (ApplyTemplateDialog, QuickTemplatesDialog, ExamCurvesDialog,
  ExaminusAIDialog) atualizavam `patients` → agora `internacoes`: `pendencies → pendencias`,
  `relevant_exams → exames_relevantes`. `patient.id` é `internacoes.id`.
- Removido `updated_at` do payload (coluna inexistente; `atualizado_em` é via trigger).
- Removido o re-fetch `patients.select('*')` + remapeamento manual (tabela morta); o resultado é
  mesclado localmente no view-model (`onUpdate({ ...patient, campo })`), preservando os demais
  campos que já vieram do join upstream (usePatients/usePatientLive).
- Campos degradados só de leitura no card (vindos como default do view-model, nunca escritos aqui):
  `clinicalStatus` (cor de destaque → "regular"), bloco `uti_*`, `admissionHistory`,
  `admissionStatus`, `medicalResponsibility`, highlights. `get-cid-code` (edge function de IA)
  mantido — não é tabela morta.

### src/components/AdmitPatientDialog.tsx (patients/patient_registry/patient_encounters/medical_records → pacientes+internacoes+leitos)
- Admissão reescrita: resolve `setor` (setores.nome === código do setor) → garante `leitos`
  (localiza por (setor_id, numero) ou cria; bloqueia se status='ocupado') → reaproveita/cria
  `pacientes` (por CPF) → cria `internacoes` (paciente_id, leito_id, setor_classificacao_id,
  data_entrada, status='pre_admitido', queixa/alergias/pendências) → marca leito 'ocupado'.
- Pré-admissão: `pre_admissions → pre_admissoes`. A tabela nova só tem identificação/triagem
  básica; TODO o bloco clínico rico (vital_signs, glasgow*, allergies, chief_complaint, airway_*,
  oxygen_therapy, pain_scale, triage_notes, sex, mother_name, phone, medical_record, social_name,
  notes) NÃO tem coluna → lido de `dados_extraidos_ia` (Json) quando presente, senão null e a
  seção da UI não renderiza (`mapPreAdmissao`).
- Ocupação de leitos: antes contava linhas `patients` por setor → agora `leitos.status='ocupado'`
  do setor. Filtros por `hospital_unit_id`/`state_id`/`department` removidos (sem colunas no
  schema novo); o gate por currentHospital/currentState no submit e no fetch foi removido.
- `pacientes.prontuario` é NOT NULL e a pré-admissão não carrega prontuário/medical_record →
  usa `medical_record`(de dados_extraidos_ia)/`cpf`/`cns`, com fallback `PA-<id8>`. Nenhum dado
  clínico inventado.
- DEGRADADO/removido do fluxo de admissão (sem coluna/tabela): bloco `uti_*`, `clinical_status`,
  `admission_status`/`admitted_at`/`is_vacant`, previsão de alta, `medical_responsibility`,
  highlights, `saps_*`, `department`, `age`(gravado)/`name` na linha de leito; RPC
  `archive_patient_bed_data` (não existe); vínculo de `medical_records` (morto); sincronização
  PIS → `patient_registry` (PisRegistrySyncDialog + computePisDiff removidos — tabela morta).
- UTI/SAPS: `pre_admissoes` não tem `destination_sector`/`destination_bed`/`notes` → só grava
  `status='aguardando_leito_uti'`; leito/setor seguem via URL para o SAPS 3 (que conclui a
  admissão). Não-UTI grava `setor_destino_id` + `internacao_id`; `destination_*` degradados.
- `registrado_por` resolvido via `profissionais.user_id` (≠ auth.uid).

### src/components/PatientMovementDialog.tsx (patient_movements/discharge_documents/patient_encounters/profiles/internal_transfer_requests → logs_auditoria/altas/internacoes/profissionais)
- Médico assinante: `profiles(full_name, crm)` → `profissionais(nome, numero_conselho)` por `user_id`.
- Movimentação (alta/óbito/transferência/evasão): `patient_movements` (morta) → `logs_auditoria`
  (`tipo_evento='movimentacao_<subtipo>'`, `nome_tabela='internacoes'`, `internacao_id`, `acao='UPDATE'`).
  `transferencias` não cabe (modela só leito→leito com leito_destino_id NOT NULL). Campos ricos
  (bed/sector/destination/snapshot/department/responsible_doctor) preservados em `dados_novos`.
- Documento de alta/óbito: `discharge_documents` → `altas` (internacao_id, tipo, conteudo Json,
  numero_documento=null, assinado_por=profissional_id, crm_assinatura, data_hora). Colunas ricas
  sem destino (patient_name/bed/sector, movement_id, encounter_id, signed_by/_name, hospital/state,
  department, created_by) preservadas dentro de `conteudo` (finalDoc).
- Status do paciente: `patients.admission_status` → `internacoes.status`. Desfechos finais
  (alta/óbito/transf. externa/evasão/alta a pedido) gravam também `internacoes.data_alta`.
- `patient_encounters` (morta): "encounter ativo" = a própria internação (`patient.id`); a busca de
  encounter_id/encounter_code foi removida. `closeActiveEncounter` (lib já migrada) mantido.
- Fila virtual de transferência interna (`internal_transfer_requests`, morta): sem destino leito
  definido, `transferencias` não comporta → a sinalização vira um evento em `logs_auditoria`
  (`tipo_evento='sinalizacao_transferencia_interna'`), com classificação/requires_saps no
  `dados_novos`. A alocação física é feita depois no Mapa de Leitos (mesma degradação de
  internalTransfer.ts). `classifyTransfer`/`requiresSaps` (lógica pura) mantidos.

### src/components/BedReallocationDialog.tsx (patients → internacoes.leito_id + leitos.status)
- A mega-tabela `patients` (leito+paciente numa linha) foi substituída: "irmão" = internação ativa
  (`internacoes` com `data_alta IS NULL`) num leito do setor; "leito vago" = linha `leitos` sem
  internação ativa. Setor resolvido via `setores.nome === código` (Patient.sector).
- Carregamento: setores → leitos (do setor) → internacoes ativas nesses leitos + `pacientes`
  (nome). Antes filtrava `patients.sector`; `is_vacant` de linha vaga não existe mais (vaga =
  ausência de internação ativa no leito).
- Realocar: `UPDATE internacoes.leito_id` (destino) + `leitos.status` (origem→'vago',
  destino→'ocupado'). Permutar: troca `leito_id` entre as duas internações (ambos ficam
  'ocupado'). O "swap por bed_number com leito temporário `__SWAP_`" foi removido.
- Sem RPC de realocação/permuta no schema novo (verificado em types.ts) → updates diretos com
  rollback best-effort (permuta); operação não é atômica de fato (não há RPC/transação).

## src/hooks (patients/bed core)

### src/hooks/usePatients.ts (patients/patient_registry → internacoes(+pacientes,+leitos,+setores))
- Fonte reescrita: o mapa de leitos agora consulta `leitos` do hospital (via
  `setores → alas → hospitais`, filtro `.eq('setor.ala.hospital_id', ...)`), cada leito
  com sua internação ATIVA (`data_alta IS NULL`, selecionada em JS). Leito sem internação
  ativa vira entrada `isVacant=true`. View-model `Patient` mantido 100% (mesmos nomes/tipos).
- `Patient.id`: ocupado → `internacoes.id`; vago → `leitos.id` (não há internação).
- `sector`: mapeado de `setores.tipo` (código SectorType) — NÃO de `setores.nome` como sugeria
  o de-para, pois `nome` é rótulo de exibição e quebraria `SectorType`/agrupamento. Cai para
  `nome` só se este por acaso já for um SectorType válido.
- `registryId` ← `pacientes.id` (patient_registry morto).
- Filtro por `sector` (código) via `setores.tipo`/`nome`. Filtro por `department`: SEM coluna
  no schema novo → best-effort por `setores.nome` (pode não casar rótulos antigos).
- DEGRADADOS (sem coluna → default): `highlighted*`=[], `admissionHistory`="",
  `medicalResponsibility`=undefined, `displayOrder`=0, `createdBy`=undefined
  (internacoes.registrado_por é profissionais.id, não user_id), `internmentNotes`=null,
  `isDoorPatient`=false, `allocationStatus`=null, bloco `uti_*`=[], `psmStatus`=null,
  `clinicalStatus`="regular" (null quando vago), `admissionStatus`=undefined.
- `updatePatient`: roteia por tabela — clínicos → `internacoes`
  (hipotese_diagnostica/historia_clinica/exames_relevantes/pendencias/agenda/status),
  `name` → `pacientes.nome_completo`, `bedNumber` → `leitos.numero` (busca paciente_id/leito_id
  na internação quando necessário). NÃO grava (só estado local): age, highlighted*,
  medicalResponsibility, displayOrder, uti_*, psmStatus, clinicalStatus, isVacant,
  admissionHistory, sector, allocationStatus, isDoorPatient. `admission_date` segue imutável.
- `createPatient`: agora cria só o **leito** (resolve `setor_id` por `tipo`/`nome` no hospital;
  `tipo`='comum' default; `criado_por` via lookup profissionais.user_id). A admissão clínica
  (paciente+internação) NÃO é criada aqui — `pacientes.prontuario` é obrigatório e não há
  gerador de prontuário neste hook. Campos clínicos recebidos são apenas ecoados na UI.
- `deletePatient`: RPC `archive_patient_bed_data` e checagens `patient_encounters`/
  `patient_movements` (mortas) REMOVIDAS. Ocupado → encerra internação (`data_alta`+status)
  e devolve leito à `higienizacao`; leito EXTRA → deleta a linha do leito. Histórico fica
  preservado na própria internação encerrada e tabelas filhas.
- `releaseBedPreAdmission`: auditoria movida de `patient_movements` → `logs_auditoria`
  (tipo_evento='liberacao_leito'). Ramificação por `patients.admission_status` (coluna
  inexistente) e RPC de arquivamento removidas; encerra internação + libera leito + audita.
  `profissional_id`/ator via lookup profissionais.user_id.
- `reorderPatients`: sem coluna `display_order` → apenas reordenação local otimista (nada
  persistido). Assinatura preservada.
- Realtime: canal `patients` → `internacoes` + `leitos`, com refetch por evento (payload
  não traz joins). Removidos o mapper incremental antigo e o cache de birth_date via registry.

### src/hooks/useBedCensusActions.ts (bed_census → leitos)
- `updateBed`: grava só `status` e `motivo_bloqueio` (← block_reason) em `leitos`.
  DEGRADADOS (sem coluna em leitos): patient_name, patient_id, reserved_for, reserved_until,
  updated_by, updated_by_name. `BedStatus`/`BedActionPayload` mantidos na assinatura.
- Trigger `bed_census_track_status()` (timestamps de ciclo) não existe → não replicado.
- `occupyBed`/`reserveBed`/`giveAdministrativeDischarge`: só mudam status (dados de paciente/
  reserva não persistem).
- `transferBed`: migrado para mover a internação ativa (`internacoes.leito_id`) do leito de
  origem p/ destino + ajuste de status dos dois leitos.
- `swapBeds`: DEGRADADO → erro explicativo. Troca atômica de internações (leito_id NOT NULL,
  possível índice único de internação ativa/leito) exigiria RPC dedicada inexistente.

### src/hooks/usePatientVersions.ts (patient_versions → logs_auditoria tipo_evento='versao_paciente')
- `patient_versions` (morta) → `logs_auditoria`. Snapshot da lista (`snapshot_data`), descrição
  e departamento guardados em `dados_novos` (Json). `created_at`←criado_em, `created_by`←
  ator_user_id, `description`←dados_novos.description||motivo. `profissional_id` via lookup
  profissionais.user_id.
- Filtro por `department`: sem coluna em logs_auditoria → best-effort por
  `dados_novos.department` (em memória). `state_id`/`hospital_unit_id` → `logs_auditoria.hospital_id`.
- Interface `PatientVersion` e assinaturas (fetch/save/deleteVersion) preservadas.

## módulo ficha/prontuário

### src/pages/FichaAtendimentoPage.tsx (pre_admissions/patients/admission_histories/conduct_history/prescriptions/exam_requests/patient_encounters → internacoes+pacientes+leitos+setores+evolucoes+sinais_vitais+prescricoes+solicitacoes_exame+altas+pre_admissoes)
- `patientId` agora é `internacoes.id`. A ficha inteira é remontada a partir de
  internacoes(+pacientes,+leitos,+setores) + evolucoes(soap) + sinais_vitais + prescricoes
  + solicitacoes_exame + altas + pre_admissoes. Filtros hospital_unit_id/state_id removidos
  (internação é identificada globalmente pelo id); guarda passou a exigir só `patientId`.
- Admissão (antes admission_histories, morta) é sintetizada de `internacoes`
  (queixa_principal/historia_clinica/hipotese_diagnostica/conduta_inicial).
- `conduct_history` (morta): trilha de conduta agrupada por proximidade temporal REMOVIDA
  (não há tabela equivalente por atendimento) — substituída pelas evoluções reais.
- DEGRADADOS no `PatientData` (sem coluna em pacientes):
  - `neighborhood`, `city` → pacientes.endereco é campo único (só logradouro).
  - `race` → sem coluna raça/cor.
  - `fichaNumber` → `patient_encounters.encounter_code` morto → sempre "" (imprime "—").
- pre_admissoes: modelo antigo rico (chief_complaint, vital_signs, allergies, glasgow,
  destination_sector) → só há `classificacao_risco` + `dados_extraidos_ia` (Json). O card de
  classificação de risco extrai o que houver do JSON da IA; campos ausentes são omitidos.
- `professionalName/CRM` dos eventos: resolvidos por join `profissionais(nome, numero_conselho)`
  via as FKs profissional_id/registrado_por/criado_por/solicitado_por (≠ auth.uid).
- `user`/useAuth removidos (não utilizados após a migração).

### src/components/MedicalRecordEditDialog.tsx (medical_records/medical_record_edit_history/patient_registry/patient_registry_edit_history/patients/profiles → pacientes + logs_auditoria)
- `medical_records` morto: o prontuário é a coluna única `pacientes.prontuario`. A aba
  Prontuário edita só `numero_prontuario` (→ pacientes.prontuario). DEGRADADOS: `Nº Legado/PIN`
  (numero_prontuario_legado), `generation_mode`, flag `is_legacy` — campos removidos da UI.
- `patient_registry` morto: a "ficha cadastral" é a própria linha de `pacientes` (sempre existe,
  resolvida por internacoes.paciente_id). Não há mais criação/relink/dedupe de registry nem
  sync separado de nome (nome_completo é coluna direta). Mapa RegistryRow→pacientes:
  full_name→nome_completo, social_name→nome_social, cpf, cns, birth_date→data_nascimento,
  sex→sexo, mother_name→nome_mae, phone→telefone, address→endereco, blood_type→tipo_sanguineo,
  allergies→alergias, comorbidities→comorbidades.
  - DEGRADADOS (sem coluna em pacientes, NÃO persistidos; ficam só na auditoria da intenção):
    `neighborhood`, `city`, `state`, `medical_record` (ref. PIS/legado).
  - `is_unidentified` sempre null → badge "Paciente Não Identificado" nunca aparece.
- Trilha de edição: medical_record_edit_history/patient_registry_edit_history → `logs_auditoria`
  (tipo_evento='edicao_prontuario', nome_tabela='pacientes', registro_id=paciente_id). Campos:
  field_changed→campo_alterado, old_value→valor_antigo, new_value→valor_novo, reason→motivo,
  changed_by_email→email_ator, changed_at→criado_em. A aba Histórico lê esses logs e separa
  prontuário (campo_alterado='numero_prontuario') da ficha cadastral (demais).
- `isDeveloper`: profiles.access_profiles (morto) → `profissionais.papel === 'dev'` via user_id.
- Hard delete: RPC `admin_hard_delete_patient` mantida via `(supabase.rpc as any)`, agora com
  `p_patient_id = pacientes.id` (resolvido via internacao); `p_registry_id` descontinuado.
- `extract-patient-data` (PIS) permanece (edge function existente); mapeamento PIS→campos
  inalterado, com destino final nas colunas de `pacientes`.

### src/pages/HistoricoPacientePage.tsx (clinical_evolutions/prescriptions/exam_requests/admission_histories/discharge_documents → evolucoes/prescricoes/solicitacoes_exame/internacoes/altas)
- Só a reimpressão de documento (`printDocumentFromHistory`) tocava tabelas mortas; o hook
  `usePatientTimeline` (fora do escopo) é migrado à parte.
- evolution: clinical_evolutions → `evolucoes`. A linha nova não tem o shape de EvolutionRecord
  (campos dedicados viraram JSON soap/exame_fisico) → mapeada localmente (mesma convenção `__`
  de useEvolutions.mapEvolution) antes de reaproveitar `printEvolution`.
- prescription: prescriptions → `prescricoes` (itens→items, versao→version, criado_em→created_at,
  observacoes→notes). `patient_data` não existe → degradado (não usado no impresso).
- exam_request: exam_requests → `solicitacoes_exame` (itens→items, categoria→category). Os
  despachantes de impressão (printProcedimento/Terapeutico/RequisitionGuide) ainda consomem o
  shape antigo, então a linha é adaptada para {..., items, category} em vez de editar os helpers.
- admission_history: admission_histories (morta) → conteúdo lido de `internacoes` (ancorado por
  patientId=internacoes.id). DEGRADADO: cid_primary/cid_secondary/macro_diagnosis não têm coluna
  em internacoes → bloco de CID/diagnóstico removido do impresso de admissão.
- discharge_document: discharge_documents → `altas` (document_type→tipo, content→conteudo).

## módulo prescrição
Arquivos: src/pages/PrescricaoPage.tsx, src/components/AihFormDialog.tsx,
src/components/AntimicrobialGuideDialog.tsx.

De-para de tabelas aplicado:
- prescriptions → prescricoes (ancorada em internacao_id; patientId da URL = internacoes.id).
  Colunas: items→itens, version→versao, parent_id→prescricao_pai_id,
  digital_signature→assinatura_digital, created_at→criado_em, updated_at→atualizado_em,
  created_by→criado_por (resolvido via profissionais.user_id).
- patient_encounters → internacoes (é o próprio "encontro").
- pre_admissions → pre_admissoes; admission_histories/patients(clínico) → internacoes;
  patients/patient_registry(cadastro) → pacientes; profiles → profissionais;
  culture_results → resultados_cultura; dispensations → dispensacoes;
  prescription_draft_deletion_audit → logs_auditoria(tipo_evento='exclusao_rascunho_prescricao').

DEGRADAÇÕES (campo antigo → sem coluna nova):
- prescricoes NÃO tem: patient_name, patient_registry_id, patient_data, department,
  hospital_unit_id, state_id, archived_at, encounter_id. Removidos dos payloads/queries; o
  filtro (hospital_unit_id+state_id+patient_registry_id+encounter_id) colapsou em internacao_id.
  patient_name exibido na lista é derivado do cabeçalho ao vivo; patient_data (snapshot do
  cabeçalho) deixou de ser restaurado em loadPrescription — o header vem das fontes ao vivo.
- Auto-load: removidos o guard anti-stale por patient_registry_id (lido de `patients`), a
  janela legada por admission_date de patient_encounters e os filtros de archived_at/encounter_id.
  Nova query única: última prescricoes por internacao_id (criado_em DESC).
- ensureEncounterCode: DEGRADADO para no-op — internacoes não tem código de atendimento
  auto-gerado. O nº de atendimento no cabeçalho passa a vir só de usePatientIdentifiers.
- Sincronização de PESO (patients.uti_weight_kg): DEGRADADA por completo — não há coluna
  equivalente (pacientes não guarda peso; sinais_vitais é por evento). Peso vira só estado local.
- Alergias: patients.uti_allergies → pacientes.alergias (resolve paciente_id via internacoes;
  realtime passou a assinar a tabela `pacientes` filtrada por paciente_id).
- pre_admissoes não tem chief_complaint/vital_signs (bloco de queixa/sinais na pré-admissão
  removido; só classificacao_risco é mapeado). No AihFormDialog o fallback de pré-admissão só
  recupera cns e data_nascimento (sex/mother_name/phone/address/city/medical_record degradados).
- dispensacoes não tem patient_name/encounter_code/dispensed_by_name/hospital_unit_id/state_id
  (removidos); `codigo` é NOT NULL sem default → gerado no cliente (`DISP-<base36>`), podendo ser
  sobrescrito por trigger de banco se existir. dispensed_by_name na UI vira null.
- AntimicrobialGuideDialog: patients.admission_history (fallback) removido — sem coluna em
  internacoes; blocos uti_cultures_antibiotics/uti_current_status na importação de evolução
  degradados (sem colunas no schema novo).
- criado_por/dispensado_por resolvidos via helper resolveProfissionalId (profissionais.user_id).
- RPCs custom desconhecidas não foram necessárias neste módulo.

## dashboards + HospitalContext

### src/contexts/HospitalContext.tsx (hospital_units → hospitais; states/estados sem equivalente)
- Interface exportada mantida IDÊNTICA (State, HospitalUnit, currentState, currentHospital,
  states, hospitals, isLoading, setCurrentHospital, fetchStatesAndHospitals) — ~100 consumidores dependem dela.
- `hospitals` vem de `hospitais` (ativo=true): name←nome, address←endereco.
- `HospitalUnit.state_id` → placeholder "default" (não há estado no schema novo).
- `states` degradado para [] (não existe tabela de estados/UF).
- `currentState` recebe um placeholder não-nulo `{ id:"default", name:"Brasil", abbreviation:"BR" }`
  para não quebrar consumidores que fazem `currentState.id` sem guarda.
- `setCurrentHospital` não deriva mais estado a partir do hospital (sem state_id nas colunas).

### src/pages/ClinicalDashboardPage.tsx (patients/bed_allocation_requests/patient_movements → internacoes/solicitacoes_leito)
- Ocupação/leitos: REAL a partir de internacoes ativas (data_alta IS NULL) + leitos + setores,
  filtrando por hospital (leitos→setores→alas.hospital_id) e por setor (setores.tipo == código).
- `pendingBedRequests`: solicitacoes_leito status pendente, escopo por hospital via setor_solicitado→ala.
- Removido `currentState` (guarda passou a exigir só currentHospital).
- DEGRADADO: "Atividade recente" (recentMovements=[]) — patient_movements sem equivalente fiel.
- DEGRADADO: alertas de previsão de alta / dispositivo pendente / cultura pendente / paciente
  gravíssimo / aguardando transferência — dependiam de campos degradados do paciente
  (uti_discharge_prediction, uti_devices, uti_cultures_antibiotics, clinical_status, allocation_status).
  Restam apenas alertas de solicitação de leito.

### src/pages/DashboardPage.tsx (internment_requests/patients/patient_movements/prescriptions/bed_allocation_requests → novas)
- REAL: activePatients/ocupação (internacoes ativas + capacidade fixa por setor),
  newAdmissions24h e internmentRequests (internacoes por data_entrada no período),
  sectorDistribution (ocupados vs vagos), novas admissões em "Atividades Recentes",
  alertas de solicitação de leito (solicitacoes_leito).
- realtime: patient_movements/internment_requests/patients → internacoes/solicitacoes_leito.
- Removido `currentState` do destructure (não usado).
- DEGRADADO a 0/[]: discharges, deaths, transfers, pendingPrescriptions, plannedDischarges,
  todo o bloco `comparison`, movementsOverTime, movementsByType, bedOccupancy (série temporal),
  requestsByDestination, alertas "crítico" (clinical_status) e "prescrição pendente +2h",
  atividades de movimentação e de prescrição. Motivo: patient_movements sem equivalente;
  prescricoes sem status/setor/patient_name mapeável; internment_status do paciente degradado.

### src/pages/GestorPanelPage.tsx (patients/patient_movements/patient_encounters/exam_requests/regulation_requests/... → novas)
- REAL: bedStats (total/occupied/vacant/bySector) de leitos + internacoes ativas por setor.tipo;
  TMP (internacoes: data_alta − data_entrada no período) e TMP por setor; giro de leito
  (internações encerradas / capacidade); medicationCount (catalogo_medicamentos, global);
  pendingRequests + lista (solicitacoes_leito pendentes, hospital+setor); prescriptionStats.total
  (prescricoes por hospital via internacao); pendências de exame por categoria e por setor
  (solicitacoes_exame); pacientes regulados (regulacoes, nome via internacao→paciente);
  admissões na tendência (internacoes.data_entrada).
- DEGRADADO: doorPatients=0 (is_door_patient); criticalAlerts=[] (clinical_status/relevant_exams);
  dischargePreviews=[] (uti/hospital_discharge_prediction); recentMovements=[] (patient_movements);
  tendência de altas/óbitos/transferências=0; desfechos (outcomes) todos 0; mortalidade=[];
  produção médica=[] (evolucoes sem created_by_name/department); prescriptionsList=[] e
  validated/pending/rejected=0 (prescricoes sem patient_name; validacoes_prescricao sem hospital);
  regulados age/sex=null; TODOS os kpiDeltas viram placeholder "—" (dependiam de patient_movements).
- Filtros de setor passam a usar setores.tipo (códigos red/yellow/...); export CSV de movimentações
  sai vazio (recentMovements=[]).

## módulo requisições/exames

### src/pages/RequisicaoUnificadaPage.tsx (exam_requests/patients/profiles/patient_registry/admission_histories/clinical_evolutions/cid10_codes → solicitacoes_exame/internacoes/pacientes/profissionais/evolucoes)
- `exam_requests` → `solicitacoes_exame`. A tabela nova só tem `internacao_id` + campos
  clínicos: colunas renomeadas `category→categoria`, `items→itens`, `priority→prioridade`,
  `clinical_indication→indicacao_clinica`, `notes→observacoes`, `results→resultado_texto`,
  `result_data→resultado_dados`, `completed_at→concluido_em`, `completed_by→concluido_por`.
- Toda solicitação passa a pendurar em `internacao_id` (o `patientId` das telas). Sem UUID de
  internação real, `fetchRequests` retorna `[]` e o submit é bloqueado com aviso (não há mais
  colunas de paciente/unidade avulsos).
- `normalizeSolicitacao` reconstrói o shape legado que RequestCard e os builders de impressão
  consomem (props `any`): `patient_name/bed/sector` vêm do CONTEXTO do formulário; `patient_id`
  recebe o `internacao_id` (para o scoping client-side). Degradados (sem coluna): `completed_by`
  (nome), `requested_by_name`, `document_payload` (snapshot → reimpressão indisponível),
  `patient_registry_id`.
- `fetchAllProcedures` (aba "todos os procedimentos da unidade") DEGRADADA para `[]` —
  solicitacoes_exame não tem coluna de hospital/unidade.
- `handleSubmitRequest`/`registrarProcedimento`: substituído o helper `registrarSolicitacao`
  (que ainda mira exam_requests, arquivo fora de escopo) por insert direto em
  `solicitacoes_exame`. `requested_by/requested_by_name` → `solicitado_por` (FK profissional
  via profissionais.user_id). No APAC embarcado, `document_payload(kind:"apac")` sem coluna →
  laudo APAC não reimprimível pelo histórico.
- `handleSaveResult`/`handleCancelRequest`: update em solicitacoes_exame (colunas novas +
  concluido_por resolvido via profissionais.user_id).
- Seletor de pacientes da unidade (picker) DEGRADADO para `[]` — sem coluna de unidade em
  internacoes/pacientes; o paciente deve chegar via `?patientId=`.
- Hidratação do APAC embarcado: `patients/patient_registry` → `internacoes(+pacientes)`;
  `admission_histories` → `internacoes` (queixa/história/hipótese/conduta). CID
  (`primary_cid10/secondary_cid10`) sem coluna em internacoes → cidPrimary/cidSecondary
  DEGRADADOS (em branco). `municipio/UF` sem coluna (pacientes.endereco é campo único) → mantêm
  defaults. `profiles` → `profissionais` (full_name→nome, crm→numero_conselho); `cpf` sem coluna
  em profissionais → não hidratado.
- `importEvolution`: `clinical_evolutions` → `evolucoes` (soap_data→soap); removidos filtro de
  status (enum novo desconhecido), `archived_at` e o vínculo via patient_registry_id; diagnóstico
  vem de internacoes.hipotese_diagnostica; `diagnostic_hypotheses` e a busca em `cid10_codes`
  (→ codigos_referencia) DEGRADADOS.
- `fetchImagingApacPatientData`: `patient_registry` → `pacientes`; como a linha da solicitação
  não carrega mais paciente_id, o fallback de reimpressão fica sem fonte na prática.

### src/pages/RequisicaoImagensPage.tsx (profiles/patients/patient_registry/admission_histories/clinical_evolutions/cid10_codes/patient_encounters/exam_requests → profissionais/internacoes/pacientes/evolucoes/solicitacoes_exame)
- `profiles` → `profissionais` (nome/numero_conselho). CPF do médico só de user_metadata;
  `handleSaveDoctorCPF` DEGRADADO para no-op (profissionais não tem coluna cpf).
- Hidratação do paciente: `patients + patient_registry` → `internacoes(+pacientes)`; prontuário =
  pacientes.prontuario. Endereço estruturado (bairro/município/UF) DEGRADADO (pacientes.endereco é
  campo único; município/UF mantêm defaults São Luís/MA). CID e `cid10_codes` DEGRADADOS —
  cidPrimary/cidSecondary em branco; diagnóstico de internacoes.hipotese_diagnostica.
- Observações: `clinical_evolutions` → `evolucoes` (soap); sem filtro de status/archived_at;
  `diagnostic_hypotheses` sem coluna → omitido.
- Persistência da APAC: `exam_requests` → `solicitacoes_exame` (o `?patientId=` é internacao_id).
  Removidos: lookup em patients (registry/unit), `patient_encounters` (encounter_id — a internação
  já é o encounter). Metadados de CID/diagnóstico/médico vão em `observacoes`; `solicitado_por`
  via profissionais.user_id. Sem snapshot de paciente/unidade/requested_by_name.

### src/components/SatRequestDialog.tsx (profiles/patients/patient_registry/exam_requests → profissionais/internacoes/pacientes/solicitacoes_exame)
- `profiles` → `profissionais` (nome/numero_conselho). Prontuário/nascimento via
  `internacoes(+pacientes)` (patients/patient_registry mortos).
- Gravação: removidos `comSnapshotDeDocumento` (document_payload, fluxo exam_requests) e
  `resolveActiveEncounterId` (patient_encounters). Insert direto em `solicitacoes_exame` com
  `internacao_id` (asUuidOrNull(patientId)); sem internação → bloqueia com aviso. Degradados:
  nome/leito/setor, unidade/estado, encounter_id, requested_by_name, document_payload (snapshot
  do impresso — reemissão pelo histórico indisponível). Nome/CRM do médico vão em `observacoes`;
  `solicitado_por` via profissionais.user_id.

### src/pages/Saps3Page.tsx (saps3_assessments/pre_admissions/patients/bed_allocation_requests → avaliacoes_saps3/pre_admissoes)
- `saps3_assessments` → `avaliacoes_saps3` (colunas em português; pendura em `internacao_id`).
  Mapeamento: idade, comorbidades, dias_hospital_antes_uti, origem_admissao, admissao_planejada,
  motivo_admissao(+_detalhe), status_cirurgico, tipo_cirurgia, infeccao_na_admissao,
  escore_glasgow, fc_mais_alta, pas_mais_baixa, bilirrubina_mais_alta, temperatura_mais_baixa,
  creatinina_mais_alta, leucocitos, ph_mais_baixo, plaquetas_mais_baixas, relacao_pao2_fio2,
  ventilacao_mecanica, escore_box1/2/3, escore_total, mortalidade_prevista, criado_por.
- DEGRADADOS por falta de coluna em avaliacoes_saps3: `patient_name`, `hospital_unit_id/state_id`
  (filtro por unidade removido — RLS escopa por hospital do profissional), `status`/`pending_since`
  (o workflow "SAPS pendente" NÃO persiste — em loadRecords o status é sempre "completed"),
  e as seções `clinical_history`/`lifestyle_habits`/`vasoactive_drugs`/`escala_consciencia`
  (não gravam nem hidratam; a avaliação de consciência volta ao estado inicial ao completar ficha).
- `patient_id` → `internacao_id`. Auto-resume da ficha pendente DESATIVADO (sem coluna status para
  identificar pendência); a retomada explícita segue via `?completeSapsId=`.
- `handleSave` (fluxo de admissão física) fortemente degradado: a criação/atualização da "linha de
  paciente no leito" (patients — tabela morta), `bed_allocation_requests` (→ solicitacoes_leito) e
  o gate `patients.saps_pending/saps_completed_at` foram REMOVIDOS. A ficha SAPS agora exige uma
  internação existente (internacao_id via selectedRequest.patient_id/URL); sem ela, o save é
  abortado com aviso (a alocação em leito é responsabilidade de outro fluxo). `pre_admissions` →
  `pre_admissoes`: apenas `status='admitido'` (destination_bed/destination_sector sem coluna).
- `loadPendingRequests`: `pre_admissions` → `pre_admissoes` (nome_paciente/data_nascimento/
  setor_destino_id/data_hora). Sem colunas: sex, notes, medical_record, patient_registry_id,
  destination_sector como label (vira id) → degradados.
- `loadOccupiedBeds` DEGRADADO para `[]` — leitos usa setor_id (uuid) e não há bridge do código
  interno de setor (red/yellow/…) para setor_id aqui.
- `*_por` (criado_por) resolvidos via helper resolveProfissionalId (profissionais.user_id).

## src/hooks/useReportData.ts

Hook central de relatórios/dashboards. Reescrito das tabelas mortas
(patient_encounters, pre_admissions, bed_census, admission_histories,
bed_allocation_requests, exam_requests, clinical_evolutions, saps3_assessments, patients)
para o schema novo. Tipo exportado `ReportResult` e o retorno do hook (loading/result/
runReport/setResult) preservados 100%. Todas as ~40 telas de relatório mantêm as mesmas
colunas/linhas (só valores degradam onde não há coluna nova).

### Escopo por hospital/estado (global)
- As tabelas clínicas novas (internacoes, pacientes, leitos, setores, evolucoes,
  solicitacoes_exame, solicitacoes_leito, pre_admissoes, transferencias, avaliacoes_saps3)
  NÃO têm colunas `hospital_unit_id`/`state_id`. O filtro `.eq('hospital_unit_id', hId)
  .eq('state_id', sId)` foi REMOVIDO de TODAS as queries (consistente com useEvolutions/
  useBedAllocationRequests/AdmitPatientDialog etc.). Escopo efetivo passa a depender da RLS.
  `hId`/`sId` continuam calculados no hook (gate `currentHospital/currentState`) mas não são
  mais usados nas queries.

### De-para de tabelas aplicado
- patient_encounters → internacoes (created_at → data_entrada; nome via join pacientes;
  setor via leitos→setores; outcome_date → data_alta)
- pre_admissions → pre_admissoes (risk_classification → classificacao_risco; patient_name →
  nome_paciente; destination_sector → setor_destino_id/join setores)
- bed_census → leitos (join setores para nome do setor)
- admission_histories → internacoes (diagnostic_hypothesis → hipotese_diagnostica)
- bed_allocation_requests → solicitacoes_leito (rejection_reason → motivo_rejeicao;
  requested_sector → setor_solicitado_id/join; requesting_doctor_name → join profissionais)
- exam_requests → solicitacoes_exame (category → categoria; items → itens; created_at → criado_em)
- clinical_evolutions → evolucoes (created_by_name → join profissionais.nome; created_at → data_hora)
- saps3_assessments → avaliacoes_saps3 (patient_id → internacao_id; created_at → criado_em;
  total_score → escore_total)

### Relatórios totalmente indisponíveis (retornam aviso "Info" — coluna/métrica sem destino)
- `avg_triage_time`, `gestao_triage_sla` — pre_admissoes não tem `risk_classified_at`
  (data de classificação de risco) → tempo/SLA de triagem não calculável.
- `door_to_doctor`, `first_attendance_duration`, `avg_first_attendance`,
  `avg_return_attendance` — sem `first_medical_attendance_at`/`called_at` em internacoes.
- `outcomes`, `outcomes_detailed`, `deaths`, `evasions`, `gestao_discharge_death_rate`,
  `gestao_uti_mortality` — internacoes não tem campo de desfecho (`outcome`/`outcome_date`)
  de atendimento (alta/óbito/evasão/transferência).
- `los_without_admission`, `los_without_admission_detailed` — não existe atendimento "sem
  internação" (patient_encounters morto); toda internacao É admissão.
- `origin_city`, `macro_regions`, `macro_regions_detailed`, `health_macro_regions`,
  `health_regions` — pre_admissoes não tem `city` (município de origem).
- `conversion_by_city`, `conversion_by_sector` — taxa de conversão depende de outcome.
- `traffic_accidents`, `firearm_injuries`, `falls`, `burns`, `flu_syndrome` — pre_admissoes
  não tem `chief_complaint`/`flu_symptoms`/`flu_symptoms_detail`.
- `entry_type` — internacoes não tem `entry_type` (espontâneo/SAMU/bombeiro/...).
- `gestao_cleaning_time` — leitos não tem `cleaning_started_at`/`cleaning_finished_at`.

### Relatórios remapeados com degradação parcial (colunas mantidas, alguns valores degradados)
- `encounters_list` / `encounters_compiled` — `Código` (encounter_code), `Triagem`
  (triage_status), `Chamado` (called_at), `Desfecho` (outcome) → sempre '-'.
- `risk_colors_detailed` — `Queixa` (chief_complaint) e `Data Classificação`
  (risk_classified_at) → '-'.
- `encounters_by_sex` / `encounters_by_age_sex` — origem trocada de pre_admissions para
  internacoes→pacientes; sexo/idade agora vêm de `pacientes.sexo`/`pacientes.data_nascimento`
  (dado real, mais fidedigno que a triagem).
- `total_stay` — `Desfecho` passa a exibir `internacoes.status` (não há outcome); `Código` '-'.
- `los_with_admission(_detailed)` — `Código` '-'; `Desfecho`=status.
- `diagnosis_count` / `gestao_top_diagnoses` — sem CID: a coluna `CID` passa a exibir a
  `hipotese_diagnostica` (texto livre) agrupada.
- `diagnosis_avc` / `diagnosis_iam` — regex aplicado só em `hipotese_diagnostica`; colunas
  `CID Primário`/`CID Secundário` → '-'.
- `admissions` — `Status Clínico` (clinical_status) → '-' (bloco degradado do modelo Patient).
- `entry_reason` — trocado para `internacoes.queixa_principal` (dado real) em vez de
  pre_admissions.chief_complaint.
- `readmissions` / `gestao_readmission_30d` — `Códigos`/`Atendimento Anterior`/`Novo
  Atendimento`/`Desfecho Anterior` (encounter_code/outcome) → '-'; reincidência calculada por
  `paciente_id` e por `data_alta`→`data_entrada`.
- `lean_indicators` — `Tempo médio classificação (min)` degradado para 0 (sem
  risk_classified_at); LOS calculado via data_entrada→data_alta.
- `gestao_stay_by_sector` — LOS via data_alta; setor via join.
- `gestao_production_per_doctor` — só `Evoluções` por médico (join evolucoes→profissionais);
  `Atendimentos`/`Altas`/`Óbitos` → 0 (dependiam de patient_encounters/outcome).
- `gestao_nir_queue` / `gestao_nir_rejections` — `Leito` (requested_bed) e `Rejeitada em`
  (reviewed_at) → '-'; setor/médico via join.
- `gestao_transfers` — trocado para a tabela `transferencias`, setor de origem via
  leito_origem (FK transferencias_leito_origem_id_fkey) → setores.
- `gestao_saps3_adherence` — filtro UTI aplicado em JS por nome do setor (ILIKE %uti% não
  funciona em coluna aninhada); avaliacoes_saps3 não tem coluna `status` → todas as avaliações
  contam (o filtro `status='completed'` foi removido).

## Wave3 medicação/prescrição

De-para de tabelas aplicado neste bloco:
- medication_catalog → catalogo_medicamentos (generic_name→nome_generico,
  therapeutic_class→classe_terapeutica, pharmacological_group→grupo_farmacologico,
  atc_code→codigo_atc, controlled→controlado, requires_dilution→exige_diluicao,
  high_alert→alta_vigilancia, notes→observacoes).
- medication_presentations → apresentacoes_medicamento (medication_id→medicamento_id,
  form→forma, concentration→concentracao, unit→unidade, route→via,
  standard_dilution→diluicao_padrao, max_daily_dose→dose_maxima_diaria,
  infusion_time→tempo_infusao).
- medication_aliases → sinonimos_medicamento (alias_name→nome_sinonimo, alias_type→tipo,
  medication_id→medicamento_id).
- medication_favorites → medicamentos_favoritos (user_id→profissional_id via
  profissionais.user_id, medication_id→medicamento_id, use_count→contagem_uso,
  last_used_at→ultimo_uso_em).
- prescriptions → prescricoes (items→itens, version→versao, created_at→criado_em,
  updated_at→atualizado_em, created_by→criado_por, parent_id→prescricao_pai_id,
  digital_signature→assinatura_digital; ancoradas em internacao_id).
- prescription_validations → validacoes_prescricao (prescription_id→prescricao_id,
  validated_by→validado_por, notes→observacoes, validation_items→itens_validacao,
  dose/allergy/interaction/dilution_check_passed→checagem_dose/alergia/interacao/diluicao_ok).
- therapeutic_templates → modelos(tipo='protocolo_terapeutico') (name→nome,
  protocol_type→tipo_protocolo, description→descricao, items→itens,
  hospital_unit_id→hospital_id, created_by→criado_por, is_global→escopo).
- medical_codes → codigos_referencia (code→codigo, name→nome, system_description→descricao,
  category EXAMES/PROCEDIMENTOS/MATERIAIS/MEDICAÇÕES → tipo exame/procedimento/material/medicacao).
- cid10_codes → codigos_referencia(tipo='cid10') (code→codigo, description→descricao,
  category→capitulo/categoria).
- receituarios → receituarios (mesmo nome, colunas em pt-BR).
- user_roles → profissionais.papel.

### src/hooks/useCanEditCatalog.ts (user_roles → profissionais.papel)
- Sem múltiplas roles por usuário; lê o `papel` único de `profissionais` (via user_id).
  Papéis com edição: farmacia, admin, coordenador, super_admin, dev.

### src/pages/MedicationCatalogPage.tsx (medication_catalog/presentations/aliases → novas)
- DEGRADADO: `iv_bolus` e `pharmacy_suggestion_enabled` não têm coluna em
  apresentacoes_medicamento → os toggles "Bolus EV" e "Sugestão automática" ficam só na UI
  (estado local otimista), NÃO são persistidos. O save grava apenas
  diluicao_padrao/dose_maxima_diaria/tempo_infusao.
- Edge function `seed-rename-catalog` (botão Importar RENAME/FTN) mantida — não é tabela.

### src/hooks/useUnifiedMedicationCatalog.ts (medication_catalog/presentations → novas)
- DEGRADADO (sem coluna no schema novo → null): catálogo `nome_comercial`, `lista`,
  `notification_type`; apresentação `pharmaceutical_form`, `default_route`, `default_dose`.
- Efeitos: o tipo de notificação (Receita Amarela/Azul/Controle Especial) passa a ser inferido
  só por grupo_farmacologico + controlado (deriveNotificationType); dose padrão do catálogo em
  branco; nome comercial cai para o genérico.

### src/hooks/useMedicationProtocols.ts (medication_catalog/presentations → novas)
- DEGRADADO: `iv_bolus`/`pharmacy_suggestion_enabled` sem coluna → sempre false. O mapa
  `pharmacySuggestions` fica SEMPRE vazio (popup de "sugestão automática da farmácia" ao
  adicionar medicamento não dispara). `getDbProtocols` (protocolos por evidência) segue
  funcionando a partir de diluicao_padrao/dose_maxima_diaria/tempo_infusao.

### src/hooks/useMedicationFavorites.ts (medication_favorites → medicamentos_favoritos)
- Vínculo por profissional_id (≠ auth.uid) resolvido em profissionais. DEGRADADO:
  medication_name/category não têm coluna. `trackUse` mantém a RPC `track_medication_use`
  via (supabase.rpc as any) — best-effort; a persistência depende de a RPC existir no backend
  novo (favoritos não bloqueiam o fluxo de prescrição).

### src/hooks/useTherapeuticTemplates.ts (therapeutic_templates → modelos)
- Filtro fixo tipo='protocolo_terapeutico'. is_global ↔ escopo ('global' vs 'local').
- DEGRADADO: `state_id` não tem coluna em modelos → sempre null. `created_by` chega como auth
  user id e é resolvido para profissionais.id (criado_por). Interface exportada preservada.

### src/pages/ValidacaoFarmaceuticaPage.tsx (prescriptions/prescription_validations → novas)
- Filtro por hospital_unit_id/state_id REMOVIDO (colunas inexistentes) → escopo via RLS; a tela
  carrega ao montar e ao trocar de hospital.
- DEGRADADO: prescricoes não tem patient_name/patient_data → nome do paciente reconstruído via
  join internacoes→pacientes; patient_data = null. validacoes_prescricao não tem
  validator_name/hospital_unit_id/state_id → validator_name reconstruído via join
  validado_por→profissionais.nome; validado_por é profissionais.id (≠ auth.uid).

### src/components/PrescriptionDiffDialog.tsx (prescriptions → prescricoes)
- Só troca de tabela e items→itens nas duas leituras de versão. Sem degradação.

### src/hooks/useReceituario.ts (receituarios; patients/patient_encounters removidos do fluxo)
- patientId = internacoes.id. Vínculo estável por paciente_id (resolvido via
  useResolvedRegistryId) quando disponível, senão por internacao_id.
- DEGRADADO: patient_name/patient_bed/patient_sector NÃO são persistidos (o cabeçalho do
  impresso vem do chamador; na leitura, patient_name usa o argumento patientName como fallback).
  Busca por nome (ilike patient_name) removida; encounter_id descontinuado (a internação é o
  atendimento) — removida a dependência de resolveActiveEncounterId (lib de tabelas mortas).
  criado_por resolvido via profissionais.user_id. Interface ReceituarioData preservada.

### src/hooks/useTodaysPrescriptions.ts (prescriptions → prescricoes)
- DEGRADADO: prescriptions não tem patient_name/patient_registry_id/hospital_unit_id → nome e
  identidade vêm do join internacoes→pacientes (validatedRegistryIds agora = paciente_id).
  Filtro por hospital REMOVIDO (escopo via RLS); realtime assina toda a tabela `prescricoes`.
  A lógica de dia clínico e as 3 camadas de detecção de validação foram preservadas
  (items→itens, created_at→criado_em, updated_at→atualizado_em).

### src/pages/MedicalCodesPage.tsx (medical_codes → codigos_referencia)
- `category` (EXAMES/…) mapeada para `tipo` (exame/procedimento/material/medicacao) na
  leitura/escrita. MedicalCode.category preserva o rótulo da URL. Edição ampliada para
  admin/super_admin/dev (role via profissionais.papel; antes só 'admin' via user_roles).

### src/components/CidSearchInput.tsx (cid10_codes → codigos_referencia tipo='cid10')
- code→codigo, description→descricao. A "categoria" de agrupamento usa `capitulo` quando
  presente, senão `categoria`. Paginação por range preservada.

### src/components/NutritionWizard.tsx e src/components/HydrationWizard.tsx
- SEM acesso a Supabase (só emitem MedicationEntry a partir de catálogos estáticos locais) →
  nada a migrar. Incluídos no lote por associação ao módulo de prescrição.

## Wave3 auth/roles/config

Regra central deste lote: `profiles` + `user_roles` (mortas) → `profissionais` (papel é
coluna do enum `papel_profissional`; NÃO há mais tabela de papéis). Vínculo por
`user_id` (≠ `profissionais.id`). Colunas de `profissionais`: ativo, cargo, conselho, email,
hospital_id, nome, numero_conselho, papel, user_id. NÃO existem: full_name (→nome),
crm (→numero_conselho), specialty, professional_type, username, cpf, phone, matricula,
status (→ativo), access_profile, access_profiles, must_change_password.

### Sistema multi-perfil (access_profile/access_profiles) — DEGRADADO globalmente
- Não há coluna equivalente em `profissionais`. Todo o conceito de "perfil de acesso"
  (medico/gestor/multi/ccih/nir/…) e o ProfileChooser dependiam dessas colunas.
- Onde a rota/menus dependiam do perfil, cai-se no `papel` (appRole) ou no que já está
  em sessionStorage/localStorage (populado por login/troca de perfil).

### src/hooks/useIsDev.ts / useIsSuperAdmin.ts / useIsAdmin.ts / useIsCoordenador.ts
- `user_roles` → `profissionais.papel` por `user_id` (maybeSingle, 1 linha por usuário).
- useIsDev: papel ∈ {dev, admin}. useIsSuperAdmin: papel='super_admin'.
  useIsAdmin: papel='admin'. useIsCoordenador: papel='coordenador'.
- useIsCoordenador: o sub-tipo `kind` (medico/enfermagem/multi) vinha de
  `access_profile` (coord_medico/…) → SEM coluna → `kind` DEGRADADO para `null`
  (a UI cai no rótulo genérico "Coord. Multi"). `useIsClinicalReadOnly` preservado.

### src/hooks/useCurrentDoctor.ts (profiles → profissionais)
- fullName←nome, crm←numero_conselho. DEGRADADOS (sem coluna): `specialty` e
  `professionalType` lidos do `user_metadata` (professionalType cai para `papel` se
  ausente). Shape `CurrentDoctor` preservado.

### src/pages/AuthPage.tsx (profiles+user_roles → profissionais)
- Pós-login: 1 query `profissionais(nome, papel, ativo)` por user_id (substitui as 2
  queries profiles+user_roles). appRole←papel. `must_change_password` lido do
  `user_metadata` do auth (sem coluna). access_profile(s) sem coluna → `effectiveProfiles`
  sempre `[]`: o ProfileChooser multi-perfil ficou INALCANÇÁVEL; rota resolvida só por
  `resolveLandingRoute(null, papel)`. Idem no `onComplete` do FirstAccessSetup.

### src/components/auth/FirstAccessSetup.tsx (profiles → user_metadata)
- `profiles.update({username, must_change_password:false})` (tabela morta) → gravado em
  `auth.updateUser({ data: {...} })` (username e a flag vivem no user_metadata; não há
  coluna nem índice único de username a tratar).
- `is_username_available`: RPC NÃO consta em types.ts → chamada via `(supabase.rpc as any)`.
  Se não deployada, `error` volta e disponibilidade fica `null` (conclusão bloqueada até a
  RPC existir) — degradação aceita, pois username agora vive no metadata (sem coluna única
  consultável no banco).

### src/components/IndividualSignUpForm.tsx (profiles+user_roles → profissionais)
- Signup público já estava desativado (cadastros vão por /gestao-usuarios), mas migrado:
  upsert em `profiles` + insert em `user_roles` → 1 insert em `profissionais`
  (user_id, nome, email, papel='medico', numero_conselho←crm, cargo, ativo=false←status
  'pending'). DEGRADADOS (sem coluna): username, phone, specialty, matricula,
  professional_type, rqe → permanecem apenas no user_metadata gravado no signUp.

### src/pages/MeuPerfilPage.tsx (profiles → profissionais + user_metadata)
- Leitura/escrita: nome/numero_conselho(crm)/cargo em `profissionais` por user_id;
  "Perfil de acesso" (read-only) exibe `papel`. DEGRADADOS (sem coluna) username, cpf,
  phone, specialty, matricula → lidos/gravados no `user_metadata` do auth. `ProfileRow`
  e a UI preservados.

### src/components/PasswordConfirmDialog.tsx (profiles → profissionais)
- Identidade exibida: `profiles(full_name,email)` → `profissionais(nome,email)` por user_id.
  Edge function `verify-user-password` mantida (não listada como morta; não é tabela).

### src/hooks/usePendingPasswordResets.ts
- `password_reset_requests` → `solicitacoes_redefinicao_senha` (count status='pending').
  Filtro por 'pending' é best-effort (default de status na tabela nova não confirmado).
  isAdmin (role/papel + emails hardcoded) preservado.

### src/components/ProfileIpGate.tsx (profiles → sessionStorage)
- Sem coluna access_profile → removida a query ao banco; o perfil ativo passa a vir só de
  sessionStorage/localStorage (populado por login/troca de perfil). Sem perfil → não aplica
  o gate de IP (deixa passar). `IpRestricted` (config_ip_permitido/config_ip_modulo)
  inalterado — recebe o mesmo moduleKey.

### src/pages/AdminUnitsPage.tsx (hospital_units → hospitais; states removido)
- name←nome, address←endereco, created_at←criado_em. `states`/`state_id` sem tabela/coluna
  → conceito de UF REMOVIDO: seletor de estado no diálogo, coluna "Estado", filtro por
  estado, aviso "cadastre um estado antes" e o gate `disabled={states.length===0}` do botão.

### src/pages/AdminStatesPage.tsx (states → DEGRADADO/oculto)
- `states` (catálogo de UF) sem equivalente. `setores` existe mas modela setores
  assistenciais (nome/tipo/ala_id) — semântica diferente e exige ala_id (FK real). Decisão:
  DEGRADAR a página inteira para um aviso de "recurso indisponível" (nenhum acesso à tabela
  morta). Default export + MainLayout preservados.

### src/components/MaintenanceModeBanner.tsx (system_maintenance_mode → modo_manutencao)
- is_active→ativo, reason→motivo, started_at→iniciado_em. Realtime na tabela
  `modo_manutencao` (filter id=eq.1). Singleton id=1 preservado.

### src/components/AppSidebar.tsx (profiles → sessionStorage)
- Removido o efeito que lia `profiles.access_profile(s)` (sem coluna) — `availableProfiles`
  vem só do sessionStorage (efeito existente). Import de `supabase` removido (sem mais uso).
  `role`/papel, useIsDev, useIsCoordenador, usePendingPasswordResets migrados à parte.

## Wave3 NIR/beds/movements

### src/lib/bedOccupancy.ts (patients/bed_census → leitos)
- `occupyBedInSector`: ocupar deixou de ser UPDATE de uma linha `patients` com ~30 colunas
  clínicas → passa a marcar `leitos.status='ocupado'` (status novo: livre/ocupado/higienizacao/
  bloqueado/reservado — 'vago' é INVÁLIDO; vaga = 'livre'). Setor resolvido por `tipo`/`nome` via
  setores→alas.hospital_id. DEGRADADOS (sem coluna em `leitos`): `patientData`, `department`,
  `stateId`, `display_order`, `is_vacant`. Assinatura/retorno (bedNumber/patientId=leito.id/isExtra)
  preservados. A admissão clínica é de outro fluxo. Só o teste `bed-occupancy.test.ts` consumia esta lib.

### src/hooks/useNirMetrics.ts (bed_census → leitos; regulation_requests → regulacoes)
- Censo: `leitos` do hospital (setores→alas.hospital_id) + internação ATIVA (data_alta IS NULL)
  para o nome do paciente. Shape reconstruído: bed_number←numero, sector←setores.tipo,
  block_reason←motivo_bloqueio, updated_at←atualizado_em, name/patient_name←paciente.
  DEGRADADO: `block_started_at` (sem coluna → null; longBlocked/longBlocked7d/blockedAvgHours 0/vazio).
  Status 'vago'→'livre' (vacant/vacantByType). EXTRA arquivado avaliado por ausência de nome.
- Solicitações: `regulacoes` (tipo_solicitacao, status, prioridade, cid_primario, unidade_destino,
  data_hora). patient_name/origin_sector via join internacao→paciente/leito→setor; destination_sector←
  unidade_destino; request_type←tipo_solicitacao; created_at←data_hora. DEGRADADOS (sem coluna):
  approved_at/completed_at (→ null; avgResponseMin=0, série `historical` com completed sempre 0),
  reason, clinical_summary, patient_age. Filtro por hospital REMOVIDO (sem hospital_unit_id → RLS).

### src/pages/NirDashboardPage.tsx (status leito 'vago'→'livre')
- BED_STATUS_LABELS: chave `vago`→`livre` (rótulo "Vago" mantido). VALID_DEST e os realces do modo
  realocação testam 'livre'. transferBed/swapBeds de useBedCensusActions (já migrado; swapBeds degradado
  lá). Statuses antigos (interditado/manutencao/alta_medica_dada) seguem no mapa mas não ocorrem (0).

### src/components/UtiReallocationDialog.tsx (patients + patient_movements → internacoes/leitos/transferencias)
- Realocar = UPDATE `internacoes.leito_id` (patient.id=internacao) para o leito destino
  (targetBedPatient.id=leitos.id) + ajuste `leitos.status` (origem→livre, destino→ocupado). A cópia de
  ~30 colunas clínicas entre linhas `patients` e o `repointPatientHistory` foram REMOVIDOS (histórico
  segue a internação pelo mesmo id). Registro: `transferencias` (internacao_id, leito_origem_id,
  leito_destino_id, motivo, status='concluida', solicitado_por via profissionais.user_id) — substitui
  patient_movements. DEGRADADOS: bloco uti_*, clinical_status, psm_status, admission_status/admitted_at,
  highlights, patient_snapshot/department/hospital. classifyTransfer/requiresSaps/classificationLabel
  (lógica pura) mantidos só na UI de confirmação.

### src/components/RequestNewAllocationDialog.tsx (patients porta + bed_allocation_requests → pre_admissoes)
- Criava "paciente porta" em `patients` (setor 'outside', is_door_patient, allocation_status) +
  solicitação de leito. `patients` morto e `solicitacoes_leito` exige internacao_id NOT NULL (paciente
  não admitido) → DEGRADADO para PRÉ-ADMISSÃO (`pre_admissoes`: nome_paciente, setor_destino_id por
  setores.tipo=red/yellow/blue, status='aguardando_leito'). Bloco clínico + médico solicitante em
  `dados_extraidos_ia`. DEGRADADOS: bed_number/door/allocation_status/medical_responsibility/created_by.
  createRequest/createPatient não usados.

### src/components/RequestUtiAllocationDialog.tsx (patients porta + bed_allocation_requests → pre_admissoes)
- Mesmo padrão: DEGRADADO para `pre_admissoes` (setor_destino_id por utiSectorMap UTI 1→blue/UTI 2→
  yellow, status='aguardando_leito_uti'); dados clínicos + sexo/prontuário/origem/médico em
  `dados_extraidos_ia`. createPatient (que hoje cria só um LEITO) e createRequest não são mais chamados.

### src/components/OperationalRelocationDialog.tsx (patients → leitos)
- Só a busca de leitos vagos tocava tabela morta: `patients` (name null) → `leitos` status='livre'
  (escopo setores→alas.hospital_id; sector←setores.tipo). `executeOperationalRelocation` (bedLifecycle,
  já migrado) inalterado — caminho feliz por RPC atômica; fallback degradado lá.

### src/components/BedReleasePreAdmissionDialog.tsx (patient_movements → logs_auditoria)
- Leitura do destino sinalizado: `patient_movements` → `logs_auditoria`
  (tipo_evento='sinalizacao_transferencia_interna|externa', destino em dados_novos.destination),
  ancorado por internacao_id (=patient.id). Restante do diálogo (fluxo/senha/onConfirm) inalterado.

### src/components/RiskClassificationDialog.tsx (pre_admissions → pre_admissoes)
- `classificacao_risco` + `status='classificado'` em colunas reais. TODO o bloco de triagem
  (chief_complaint, vital_signs, glasgow*, airway_*, perfusão/pulso, allergies, pain_scale,
  oxygen_therapy, flu_symptoms, triage_notes) + risk_classified_at/by SEM coluna → preservados em
  `dados_extraidos_ia` (Json). Nenhum dado inventado (entrada do triador).

### src/components/MedicalResponsibilityDialog.tsx (profiles → profissionais)
- Busca de médico: `profiles`(full_name/crm/access_profile/professional_type/status='approved') →
  `profissionais`(nome/numero_conselho, papel='medico', ativo=true). Shape local {id, full_name, crm}
  preservado (nome→full_name, numero_conselho→crm). onSave permanece in-memory (sem escrita).

### src/components/SuspendDischargeDialog.tsx (RPC via cast)
- RPC `suspend_discharge_document` não tipada → (supabase.rpc as any). Nenhuma tabela morta;
  invalidações de cache (discharge-docs/patient-movements/patients) são só chaves de query.

### src/components/PreAdmissionSection.tsx (pre_admissions → pre_admissoes; patient_registry → pacientes)
- Fila/canceladas: `pre_admissoes`. Filtros hospital_unit_id/state_id REMOVIDOS (RLS). Filtro por setor
  (era destination_sector TEXTO) → best-effort client-side por rótulo em
  dados_extraidos_ia.target_sector_label/target_uti (registros sem rótulo passam, p/ resgate).
  Mapa: patient_name←nome_paciente, birth_date←data_nascimento, risk_classification←classificacao_risco,
  created_at←data_hora. DEGRADADOS (de dados_extraidos_ia ou null): sex, medical_record,
  patient_registry_id, destination_sector(rótulo), notes. reopen: status='aguardando_leito'
  (destination_bed removido). delete: status='cancelado'. Realtime pre_admissions→pre_admissoes (sem
  filtro de hospital). Busca de prontuários: `patient_registry`→`pacientes` (nome_completo/cpf/prontuario/
  cns; acento-sensível — sem full_name_normalized; sem merged_into/hospital_unit_id); RegistryPatientLite
  mapeado de pacientes.

### src/hooks/usePatientMovements.ts (patient_movements → logs_auditoria)
- Lista por internacao_id (=patientId), tipo_evento em 'movimentacao_*'/'sinalizacao_transferencia_*',
  campos de dados_novos (movement_type/destination/patient_sector/patient_bed/release_status/
  released_at/notes) + criado_em. DEGRADADO: fallback por patient_name+hospital_unit_id (colunas
  inexistentes) removido — só o caminho por patientId resolve. Realtime em logs_auditoria (match por
  internacao_id + tipo). useActiveEncounterId/useResolvedRegistryId mantidos por assinatura.

### src/pages/MovementsPage.tsx (patient_movements → logs_auditoria)
- Lista: `logs_auditoria` (eventos 'movimentacao_*'/'sinalizacao_transferencia_*'), shape
  PatientMovement de dados_novos. Filtro por `department` REMOVIDO (sem coluna → RLS); realtime idem.
  DEGRADADO: `patient_snapshot` sem fonte → null (botões "Ver Dados"/"Realocar" ocultos).
  `handleReallocatePatient` (recriava linha em `patients` do snapshot) DEGRADADO para aviso —
  realocação é pelo Mapa de Leitos.

### src/pages/MovimentacoesPage.tsx (patient_movements → logs_auditoria)
- Insert → `logs_auditoria`: tipo_evento='sinalizacao_transferencia_interna|externa' (transferências)
  ou 'movimentacao_<subtipo>', nome_tabela='internacoes', acao='UPDATE', internacao_id=patientId quando
  UUID (senão null), ator_user_id=user, hospital_id=currentHospital. Campos ricos (movement_type/
  patient_name/bed/sector/destination/notes/responsible_doctor/department) em dados_novos. state_id
  degradado. Histórico via usePatientMovements (migrado).

### src/lib/repointPatientHistory.ts (RPC + patients/clinical_evolutions → no-op)
- DEGRADADO para no-op de sucesso: a RPC `repoint_patient_history` e a verificação em
  `clinical_evolutions`/`patients` operavam sobre a mega-tabela morta. No schema novo o histórico
  pendura em `internacoes.id` (imutável na troca de leito) → nada a repontar. Assinatura/retorno
  preservados; único chamador real (UtiReallocationDialog) deixou de invocá-la.

### src/lib/lockedSectorCleanup.ts (RPC via cast)
- RPC `cleanup_locked_sector_pending_allocations` não tipada → (supabase.rpc as any). A limpeza grava
  em `log_limpeza_setor_bloqueado` (mapeada) no SQL da RPC; nenhuma tabela morta no cliente. Guarda por
  LOCKED_DEPARTMENTS e throttle de 1h inalterados.

## Wave3 reception/NI
Regras de mapeamento comuns: patient_registry→pacientes (full_name→nome_completo,
social_name→nome_social, mother_name→nome_mae, birth_date→data_nascimento, sex→sexo,
phone→telefone, address→endereco, medical_record→prontuario); patient_encounters→internacoes
(registry_id→paciente_id, created_at→criado_em, created_by→registrado_por); pre_admissions→
pre_admissoes; reception_desk_sessions→sessoes_recepcao; audit_logs/patient_merge_audit/
patient_registry_edit_history/patient_movements(auditoria)→logs_auditoria; round_sessions→
sessoes_visita, round_responses→respostas_visita, round_section_goals→metas_secao_visita.
`pacientes` NÃO tem: is_unidentified, unidentified_features, unidentified_code,
merged_into_registry_id, hospital_unit_id, bairro/cidade/UF (só `endereco` único).
`internacoes` NÃO tem: encounter_code, patient_name, destination_sector, triage_status,
reception_point, admission_status, hospital_unit_id.

### src/components/reception/PromoteNiDialog.tsx
- Estado "NI" não existe como flag: `is_unidentified`/`unidentified_features`/
  `unidentified_code` removidos. A "promoção" passa a ser IMPLÍCITA — ao gravar o nome real,
  detectUnidentified() para de detectar NI. Contexto (notas/quem/quando) só em logs_auditoria.
- Duplicidade por CPF: filtro `.is("merged_into_registry_id", null)` removido (merge apaga o
  perdedor). full_name→nome_completo, medical_record→prontuario.
- Passo de propagar patient_name para encounters REMOVIDO (internacoes não tem nome do paciente;
  o nome vive só em pacientes).
- patient_merge_audit→logs_auditoria(tipo_evento='promocao_ni').

### src/components/reception/CompletePatientDataDialog.tsx
- `unidentified_features` (documents_pending/partial_identification/completed_by/at/notes) não
  tem coluna → NÃO persistido. A "pendência de documentação" passa a ser implícita (ausência de
  CPF/CNS/DN). Badge NI derivado de detectUnidentified(nome_completo).
- Observação da complementação: sem tabela própria → best-effort em logs_auditoria
  (tipo_evento='edicao_prontuario').

### src/components/reception/DuplicatePatientWarning.tsx
- Shape DuplicateMatch mantido estável (consumido por AdminDashboardPage). Filtros
  `.is("merged_into_registry_id", null)` e `.eq("is_unidentified", false)` removidos; o "só
  identificados" passa a ser client-side via detectUnidentified().

### src/components/reception/ReceptionGlobalSearch.tsx
- Escopo por hospital removido (pacientes sem hospital_unit_id).
- Grupo "Atendimentos" (busca por encounter_code) degradado para SEMPRE VAZIO — internacoes não
  tem encounter_code. EncounterHit e onPickEncounter mantidos estáveis. is_unidentified derivado.

### src/components/reception/PatientRowActions.tsx
- PatientRow (prop) mantido em inglês (contrato de MedicalRecordsList). "Reabrir atendimento (4h)":
  patient_encounters→internacoes (paciente_id, criado_em); sem hospital_unit_id (filtro removido)
  e sem encounter_code → onReopenEncounter recebe string vazia no 1º argumento (o caller o ignora).

### src/components/reception/ReceptionDailyDashboard.tsx
- "Entradas do Dia": patient_encounters→internacoes com joins (pacientes/setores). SEM escopo por
  hospital (internacoes não tem hospital_id). encounter_code degradado para o `prontuario`;
  triage_status/reception_point→null; destination_sector←setor de classificação (nome); NI derivado
  do nome; documents_pending/partial_identification→false.
- "Aguardando Admissão": pre_admissions→pre_admissoes; destination_sector←join setor_destino_id→
  setores.nome; `notes` não existe→null; sem filtro por hospital.
- "Cadastros no mês": pacientes count; sem filtros hospital/merged_into.
- "Minhas Ações"/"Equipe": audit_logs→logs_auditoria (nome_tabela agora 'pacientes'/'internacoes'/
  'pre_admissoes'; comparações client-side atualizadas). desk sessions→sessoes_recepcao
  (profissional_id ≠ auth.uid → correlação com created_by/registrado_por pode não bater 1:1).
- Realtime: table patient_encounters→internacoes; detecção "Sala Vermelha" (som+toast) degradada
  (payload de internacoes não traz destination_sector/patient_name/encounter_code) — apenas refetch.
- Reimprimir pulseira: patient_registry→pacientes.

### src/components/PisRegistrySyncDialog.tsx
- Exports (PisSourceRow/RegistryRow/PisDiffField/computePisDiff) mantidos em inglês (view-model
  estável; ainda usado por EditPatientDialog). O dialog fetcha `pacientes` e remapeia; escrita em
  `pacientes` via REG_TO_PACIENTE. bairro/cidade/UF (neighborhood/city/state) SAÍRAM do FIELD_MAP
  (pacientes.endereco é único) → não sincronizam. Histórico patient_registry_edit_history→
  logs_auditoria (1 linha/campo, tipo_evento='edicao_prontuario'); patientId não vai para
  internacao_id (evita violar a FK).

### src/components/PatientSearchActionsDialog.tsx
- RegistryPatientLite (prop) mantido em inglês (contrato dos callers).
- checkActiveEncounter: patient_encounters + patients → internacoes (paciente_id, data_alta null)
  com joins leitos/setores. "Ativo" = internação sem data_alta. encounterCode/admissionStatus→null;
  bedRowId→null; isObito≈status==='obito'; isTransitInternal→false (heurísticas degradadas).
- handleForceConfirmed: update de patients.admission_status REMOVIDO (sem tabela/coluna);
  patient_movements→logs_auditoria(tipo_evento='abertura_forcada_atendimento').
- handleConfirmCreateEncounter: internacoes exige leito_id NOT NULL e não tem encounter_code;
  medical_records e o RPC generate_encounter_code_v2 não existem. Ambos os caminhos passam a inserir
  APENAS uma pre_admissoes (status='aguardando_leito') com colunas mapeáveis (nome_paciente/cpf/cns/
  data_nascimento). setor_destino_id→null (selectedSector é código de UI, não UUID de setores).
  Nº de atendimento (12 dígitos) degradado (sem gerador). closeActiveEncounter mantido (lib compartilhada).

### src/components/GlobalSearchDialog.tsx
- RPCs search_patients_global/search_movements_global mantidos via (supabase.rpc as any) (não estão
  no schema tipado). Fallback (quando RPC falha): patients→internacoes(+pacientes/leitos/setores),
  "alocado" = internação aberta (data_alta null); sem hospital_unit_id/state_id/department (filtros e
  coluna degradados); filtro textual client-side (o `.or` não cruza relações embutidas). Grupo de
  movimentações (patient_movements→transferencias) degradado para VAZIO no fallback (transferencias
  não tem as colunas denormalizadas patient_name/movement_type/destination/patient_bed).

### src/components/PatientRoundPrintDialog.tsx
- round_sessions→sessoes_visita (patient_id→internacao_id [patientId = id da internação],
  round_date→data_visita, observations→observacoes, updated_at→atualizado_em); round_responses→
  respostas_visita (session_id→sessao_id, section_code→codigo_secao, observation→observacao);
  round_section_goals→metas_secao_visita (goal→meta). SessionRow mantido estável.

## Wave3 evolução/internação

De-para aplicado neste bloco: clinical_evolutions→evolucoes; admission_histories/
patient_encounters/internment_requests→internacoes; patients/patient_registry→
internacoes+pacientes(+leitos/setores bridge); conduct_history→logs_auditoria
(tipo_evento='edicao_conduta'); patient_admission_date_history→logs_auditoria
(tipo_evento='alteracao_data_internacao'); pre_admissions→pre_admissoes;
profiles→profissionais (nome via user_id). `patientId` das telas = `internacoes.id`.
Convenção de evolucoes: campos dedicados do modelo antigo preservados dentro do JSON
`soap` com chaves `__` (igual a useEvolutions.mapEvolution).

### src/hooks/useAdmissionDiagnosis.ts (clinical_evolutions → internacoes)
- O diagnóstico de admissão agora É `internacoes.hipotese_diagnostica` (lido por id).
  Removidos useActiveEncounterId/useResolvedRegistryId e o filtro por evolution_type/
  archived_at. `hospitalUnitId` mantido na assinatura, sem uso (sem coluna).

### src/hooks/useConductHistory.ts (conduct_history → logs_auditoria tipo_evento='edicao_conduta')
- Colunas: patient_id→internacao_id/registro_id, field_name→campo_alterado,
  old_value→valor_antigo, new_value→valor_novo, changed_by→ator_user_id,
  changed_by_email→email_ator, created_at→criado_em; hospital_id de currentHospital.
- DEGRADADO: archived_at (sem coluna → trilha nunca arquivada) e o isolamento por
  encounter (o encounter É a internação → internacao_id). state_id removido do insert.
  ConductHistoryEntry e getFieldLabel preservados.

### src/hooks/useLatestEvolution.ts (clinical_evolutions → evolucoes)
- Ancorada só por internacao_id. Removidos filtros registry/encounter/hospital/archived_at
  (todos sem coluna) e o fallback por patient_name. createdByName/validatedAt vêm de
  soap.__created_by_name / soap.__validated_at. Realtime movido para table:"evolucoes"
  (filter internacao_id=eq.<id>). patientName/hospitalUnitId mantidos na assinatura sem uso.

### src/hooks/useActivePrescription.ts (prescriptions → prescricoes)
- Ancorada só por internacao_id; version→versao, items→itens, digital_signature→
  assinatura_digital, updated_at→atualizado_em. Removidos filtros registry/encounter/
  archived_at e o fallback por patient_name (prescricoes não tem nome). Sem patientId → null.
  Realtime em table:"prescricoes" (filter internacao_id). Assinatura preservada.

### src/components/evolution/EvolutionTimeline.tsx + EvolutionForm.tsx (patients → internacoes)
- Nos handlers de impressão: nome de fallback via internacoes → pacientes
  (nome_social||nome_completo) em vez de patients.name; leito/setor ATUAIS via
  resolveCurrentBedSector (internacoes→leitos/setores) em vez de patients.bed_number/sector.
  Sem outra mudança de shape.

### src/pages/EvolucaoPage.tsx (patients → DEGRADADO)
- patients.uti_weight_kg (peso no cabeçalho impresso) sem coluna equivalente
  (pacientes não guarda peso; sinais_vitais é por evento) → peso sempre "" e
  weightLoaded=true. A sincronização patients.uti_devices após criar evolução foi
  REMOVIDA (bloco uti_* sem coluna); dispositivos ficam em soap.devices da própria evolução.
  Import de supabase removido (não havia mais uso).

### src/components/AdmissionHistoryDialog.tsx (admission_histories → internacoes)
- chief_complaint→queixa_principal, clinical_history→historia_clinica,
  diagnostic_hypothesis→hipotese_diagnostica, initial_conduct→conduta_inicial (UPDATE por id).
- DEGRADADO: seção CID-10 (cid_primary/cid_secondary) + macro_diagnosis removida da UI
  (sem coluna em internacoes) e com ela o gate de "CID obrigatório"; patient_registry_id/
  hospital_unit_id/state_id/updated_by sem destino. existingId vira sempre a internação.

### src/components/AdmissionDialog.tsx (patient_encounters/admission_histories/clinical_evolutions/patients → internacoes+evolucoes)
- handleSubmit reescrito: UPDATE internacoes (queixa_principal/historia_clinica/
  hipotese_diagnostica/conduta_inicial, status='admitido') + INSERT evolucoes de admissão
  (soap com S/O/A/P + chaves __ de patient_name/bed/sector, vital_signs, cid_*, validated_*,
  created_by*, evolution_type='admission'; exame_fisico em coluna própria). profissional_id
  resolvido via profissionais.user_id (sem ele, grava só a internação — a timeline sintetiza).
- REMOVIDO/DEGRADADO: busca de patient_encounters (o encounter É a internação); upsert de
  admission_histories; cid_primary/cid_secondary/macro_diagnosis/department/hospital_unit_id/
  state_id/encounter_id/patient_registry_id (sem coluna → só no impresso e no JSON soap); TODO o
  bloco patients.update (admission_status/admitted_at/uti_*/saps_*/uti_discharge_prediction/
  admission_history/diagnoses) e a busca de patients.created_at para o cronômetro SAPS.
- Impressão (buildPrintPayload/resolveCurrentBedSector/usePatientIdentifiers) inalterada.

### src/components/AdmissionConsultDialog.tsx (clinical_evolutions/admission_histories/patients → evolucoes/internacoes)
- D0 e adendos vêm de evolucoes (filtra soap.__evolution_type==='admission'; adendo por
  soap.parent_id). Campos dedicados remapeados do JSON soap; exame_fisico da coluna própria.
- História (HDA/conduta) de internacoes (historia_clinica/conduta_inicial); CID sem coluna →
  null (usa soap.__cid_* no impresso). SAPS pendente DEGRADADO p/ false (patients.saps_* morto).
- Adendo → INSERT evolucoes (soap {addendum, parent_id, __...}); profissional_id via user_id.
  Suspender → evolucoes.status='suspended' + motivo_suspensao; suspended_at/by em soap.__.

### src/components/AdmissionDateEditor.tsx (patient_admission_date_history/patients/profiles → logs_auditoria/internacoes/profissionais)
- Histórico → logs_auditoria (tipo_evento='alteracao_data_internacao', campo_alterado='data_entrada';
  changed_by_name preservado em dados_novos; changed_by→ator_user_id, reason→motivo). Nome do autor
  via profissionais.nome (user_id) em vez de profiles.full_name.
- Data → internacoes.data_entrada (única coluna de entrada). DEGRADADO: admitted_at e
  uti_admission_date (sem coluna → não sincronizados).

### src/pages/PacienteHubPage.tsx (patients/clinical_evolutions/prescriptions/admission_histories/saps3_assessments → internacoes/evolucoes/prescricoes)
- evolvedToday: evolucoes por internacao_id (data_hora>=início do dia). prescribedToday:
  prescricoes por internacao_id (itens inspecionados p/ validated/validatedAt).
- fetchStatus: patients→internacoes.status (admission_status). department sem coluna → null.
  Self-heal pré_admitido→admitido agora olha internacoes.hipotese_diagnostica+historia_clinica
  (antes admission_histories). SAPS pendente DEGRADADO p/ false (saps_* e saps3_assessments.status
  sem equivalente).
- handleGoSaps: avaliacoes_saps3 não tem status/patient_name → sempre segue caminho B
  (fromAllocation). handlePrintAdmission: evolução de admissão de evolucoes (soap.__...) +
  internacoes (historia_clinica/conduta_inicial); CID do soap.__cid_*.

### src/components/PatientSwitcher.tsx (patients → internacoes+pacientes/leitos/setores)
- Lista do setor = internações ATIVAS (data_alta IS NULL) cujo leito pertence a setor com
  tipo==código (SectorType) no hospital atual (via setores→alas.hospital_id). name/age/
  registry via pacientes; bed via leitos.numero; sector via setores.tipo; age via formatAge.
  Filtros hospital_unit_id/state_id/is_vacant e ordenação no banco removidos (ordena em JS).

### src/components/EditPatientDialog.tsx (patients/pre_admissions/patient_registry → DEGRADADO)
- Detecção "PIS divergente" (patients.patient_registry_id + pre_admissions + patient_registry +
  computePisDiff) DEGRADADA para no-op: pre_admissoes não tem os campos comparados e o cadastro é
  a própria linha de pacientes. pisDiffCount sempre 0 → banner/PisRegistrySyncDialog nunca abrem.
  Demais campos (clinicalStatus/medicalResponsibility/datas) seguem via onSave→usePatients.

### src/components/InternmentStatusDialog.tsx (patients → internacoes)
- internment_status/internment_notes NÃO têm coluna → DEGRADADOS (não persistidos; status segue
  em estado local, alimentando o botão AIH e o texto auto-adicionado). A pendência gerada É
  gravada em internacoes.pendencias (texto por linha, não JSON). handleClear vira limpeza local
  (nada a remover no banco).

### src/pages/InternmentHistoryPage.tsx (internment_requests → internacoes)
- Colunas denormalizadas (patient_name/age/sex/record, destination, content, department) não
  existem → reconstruídas via join pacientes/leitos/setores; content sintetizado de
  queixa/hipótese/conduta (dado real); age via calculateAgeYears. Filtro por department REMOVIDO.
- handleDelete DEGRADADO para no-op seguro: cada linha é uma internação real e não pode ser
  excluída por esta tela (era um DELETE em internment_requests).

### src/components/MedicalRecordsList.tsx (patient_registry → pacientes)
- Colunas: full_name→nome_completo, social_name→nome_social, birth_date→data_nascimento,
  sex→sexo, mother_name→nome_mae, medical_record→prontuario, created_at→criado_em,
  updated_at→atualizado_em. DEGRADADO (sem coluna): city (endereco é campo único), is_unidentified/
  unidentified_code (bloco NI) e merged_into_registry_id → filtros de tipo(NI)/cidade/merged sem
  efeito; is_unidentified sempre false (botão "Identificar" some). RPC promote_unidentified_patient
  via (supabase.rpc as any).

### src/components/PatientRegistrationDialog.tsx (patient_registry/pre_admissions/hospital_units → pacientes/pre_admissoes)
- Cadastro → pacientes (full_name→nome_completo, ..., address→endereco). DEGRADADO (sem coluna):
  neighborhood/city/state (endereco único → só logradouro), notes, hospital_unit_id/state_id/
  created_by, is_unidentified/unidentified_code/unidentified_features. prontuario NOT NULL: geração
  oficial (hospital_units.unit_code + generate_medical_record_number) REMOVIDA → usa nº informado
  ou fallback local (PR-<base36> / código NI). generate_ni_code via (supabase.rpc as any) com
  fallback local NI-AAAA-NNNNNN.
- Pré-admissão → pre_admissoes (só nome_paciente/cpf/cns/data_nascimento/status). setor_destino_id
  não resolvível a partir do rótulo (lista SECTORS) → null; classificacao_risco → null. Todos os
  demais campos (social/mãe/sexo/telefone/endereço/bairro/cidade/UF/prontuário/notes/department/
  paciente_id/NI features) preservados em dados_extraidos_ia. check_patient_duplicate mantido.

### src/components/PatientCockpit.tsx
- Sem acesso a tabelas mortas (consome só o view-model Patient e hooks já migrados). Nenhuma
  alteração necessária; assinaturas de useLatestEvolution/useActivePrescription preservadas.

## Wave3 dhd/dev/misc

### src/pages/DhdDashboardPage.tsx + DhdHistoryPage.tsx (dhd_patients → pacientes_dhd)
- pacientes_dhd é bem mais enxuta que a antiga: NÃO tem patient_name, patient_age,
  medication_schedule, state_id, hospital_unit_id nem department.
- DEGRADADO: patient_name/patient_age reconstruídos via join internacao_id→internacoes→
  pacientes (nome_social||nome_completo; idade calculada de data_nascimento). Sem internação
  vinculada, ficam vazios. medication_schedule → null (sem coluna).
- Filtros por state_id/department REMOVIDOS; escopo agora hospital_id + RLS. Guard reduzido a
  user+currentHospital. Ordenação end_date→data_fim, created_at→criado_em. Mapa de colunas:
  diagnostico, data_inicio, data_fim, dias_medicacao, relatorio_dhd, status, criado_em.
  Shape de view-model DhdPatient preservado (cards/dialogs fora do escopo continuam compilando).

### src/pages/DhdRegistrationPage.tsx (insert dhd_patients → pacientes_dhd)
- DEGRADADO (removidos do payload, sem coluna): patient_name, patient_age, medication_schedule,
  state_id, hospital_unit_id, department. hospital_unit_id→hospital_id; created_by→criado_por.
- data_fim (end_date) virou NOT NULL no schema novo → validação passou a exigir início E fim
  (antes fim era opcional). O formulário mantém os inputs de nome/idade/programação, mas seus
  valores não são persistidos.

### src/components/dhd/EditDhdPatientDialog.tsx (update dhd_patients → pacientes_dhd)
- Só grava diagnostico/data_inicio/data_fim/relatorio_dhd. patient_name/patient_age/
  medication_schedule removidos do payload (sem coluna). Inputs mantidos no diálogo.

### src/components/dev/PendenciesTab.tsx (dev_pendencies → SEM equivalente)
- Tabela não existe no schema novo. Painel degradado: lista sempre vazia, KPIs zerados,
  criação/edição/remoção desativadas (create informa indisponibilidade via toast; mutações
  viraram no-op). Import do supabase removido. Nenhuma referência à tabela morta.

### src/components/dev/BackupRestoreTab.tsx (backup_jobs/restore_jobs/backup_audit/system_maintenance_mode)
- backup_jobs→jobs_backup, restore_jobs→jobs_restauracao, backup_audit→auditoria_backup,
  system_maintenance_mode→modo_manutencao (is_active→ativo). Colunas pt-br mapeadas para as
  interfaces internas (BackupJob/RestoreJob/BackupAudit) preservadas: criado_em→created_at,
  criado_por_email→created_by_email, progresso→progress, caminho_armazenamento→storage_path,
  tamanho_bytes→file_size_bytes, contagem_linhas→table_counts, contagem_usuarios_auth→
  auth_user_count, duracao_ms→duration_ms, motivo→reason, erro→error, finalizado_em→finished_at,
  manifesto→manifest; somente_teste→dry_run, relatorio→report, job_backup_id→backup_job_id;
  acao→action, ator_email→actor_email, resultado→result, job_restauracao_id→restore_job_id.
- SPECIAL_TABLES (só badge "config") atualizado para nomes novos; user_roles sem equivalente
  removido do set. Edge functions backup-create/restore/download/import MANTIDAS (não constavam
  na lista de removidas). RPC get_public_tables_timestamp_cols mantida (já via rpc as any).
  Rótulos de texto "audit_logs"/param include_audit_logs mantidos (contrato da edge function).

### src/components/dev/MergesTab.tsx (patient_merge_audit → logs_auditoria tipo_evento='fusao_pacientes')
- source_registry_id←paciente_id/registro_id; target_registry_id←paciente_relacionado_id;
  source_snapshot←dados_antigos; payload←dados_novos; action←acao||tipo_evento;
  performed_by←ator_user_id||profissional_id; performed_by_email←email_ator; created_at←criado_em.
- DEGRADADO: target_snapshot sem coluna dedicada → null (não é renderizado). Nome do perdedor
  tenta full_name→nome_completo→nome_social no snapshot arquivado. DiagnosticPanel (fora do escopo)
  não alterado.

### src/pages/Index.tsx (patients → internacoes+leitos)
- Única referência à tabela morta era handleAddExtraBed lendo bed_number de `patients` por setor.
  Substituído por derivação em memória dos bedNumber já carregados por usePatients(activeSector).
  Import do supabase removido (sem outros usos). Restante do arquivo usa o hook usePatients.

### src/hooks/useUserPresence.ts (presence realtime; profiles/user_departments/user_hospital_assignments)
- Presence já era 100% realtime do Supabase → mantido. Só o enriquecimento de perfil migrou:
  profiles→profissionais (buscado por user_id, pois profissionais.id ≠ auth.uid);
  user_hospital_assignments→profissionais.hospital_id→hospitais(nome).
- DEGRADADO: department → null (sem user_departments/coluna de "department" equivalente).
  Shape OnlineUser e API exportada (onlineUsers/isTracking/onlineCount; useOnlineUsersMonitor)
  preservados. useOnlineUsersMonitor não tocado (sem tabelas mortas).

## Wave3 rounds/monitoring/notes

### src/hooks/useLatestRoundSession.ts (round_sessions→sessoes_visita; round_responses→respostas_visita; round_section_goals→metas_secao_visita)
- patientId já é internacoes.id (o "encounter") → filtro direto por `internacao_id`.
  Colunas: round_date→data_visita, observations→observacoes, created_at→criado_em,
  updated_at→atualizado_em, session_id→sessao_id.
- DEGRADADO: sessoes_visita não tem `archived_at` nem `encounter_id` → os filtros de
  arquivamento (`.is("archived_at", null)`) e de encounter (via useActiveEncounterId, com
  `.or(encounter_id...)`) foram REMOVIDOS. Removida a dependência do hook useActiveEncounterId.
  Interface LatestRoundSession e API ({round, loading, refresh}) preservadas.

### src/hooks/useLatestVitalSigns.ts (vital_signs→sinais_vitais)
- patientId = internacoes.id → filtro por `internacao_id`. Colunas: recorded_at→data_hora,
  systolic_bp→pressao_sistolica, diastolic_bp→pressao_diastolica, heart_rate→freq_cardiaca,
  respiratory_rate→freq_respiratoria, temperature→temperatura. recorded_by_name via join
  profissionais.nome (registrado_por, ≠ auth.uid).
- DEGRADADO (sem coluna em sinais_vitais → null): news2_score, news2_risk, lactate, potassium;
  e archived_at/encounter_id (filtros removidos, incl. useActiveEncounterId). Como consequência,
  os toasts de valores críticos no realtime (dependiam de news2_risk/lactate/potassium) foram
  REMOVIDOS — o realtime só faz refetch. Interface LatestVitalSigns preservada.

### src/lib/resolveActiveEncounter.ts (patients/patient_registry/patient_encounters → internacoes)
- resolveActiveEncounterId: o "encounter ativo" É a própria internação → confirma que
  internacoes(id=patientId) existe e retorna esse id (mesma regra de useActiveEncounterId).
  Removida toda a resolução por registry ⊕ patient_id (tabelas mortas).
- closeActiveEncounter: fechar = encerrar a internação. Sem `status='closed'` nem colunas
  `discharge_date`/`updated_at` → grava `internacoes.data_alta` (critério de "ativa" em todo o
  app = data_alta IS NULL); guarda `.is("data_alta", null)` evita re-fechar. Assinaturas preservadas.

### src/hooks/useMedicalRecordMode.ts (hospital_units → hospitais)
- DEGRADADO: hospitais não tem `medical_record_mode` nem `unit_code` (sem geração automática de
  prontuário no schema novo). Hook agora retorna constante `{ mode:"legacy", loading:false,
  unitCode:null }` sem tocar o banco (parâmetro mantido por compat). Consumidores só leem `mode`
  → passam a exigir número de prontuário manual.

### src/hooks/useFieldTemplates.ts (field_text_templates → modelos tipo='texto_campo')
- Colunas: name→nome, body→conteudo, scope→escopo_campo, is_shared→escopo ('global' vs 'pessoal'),
  hospital_unit_id→hospital_id, use_count→contagem_uso, last_used_at→ultimo_uso_em,
  created_at→criado_em, updated_at→atualizado_em, created_by→criado_por/profissional_id
  (profissionais.id via user_id).
- DEGRADADO: `user_id` (era auth.uid) não tem coluna → exposto como `criado_por` (=profissionais.id).
  Visibilidade "meus + compartilhados" fica a cargo da RLS. Interface FieldTemplate e API
  ({templates,isLoading,create,remove,touch}) preservadas.

### src/components/resources/NotesTabOptimized.tsx (notes_reminders → notas_lembretes)
- Colunas: content→conteudo, type→tipo, is_active→ativo, completed→concluido,
  scheduled_popup_time→horario_lembrete, created_at→criado_em.
- DEGRADADO: notas_lembretes não tem `department` (só setor_id UUID, que não mapeia do
  currentDepartment nome/código) → filtro por departamento REMOVIDO (checklist agora global,
  mesmo padrão do NotificationCenter). Sem colunas state_id/hospital_unit_id → removidas dos
  inserts; as guardas de "unidade hospitalar não selecionada" (currentState/currentHospital)
  tornaram-se desnecessárias e foram removidas (imports useDepartment/useHospital removidos).

### src/pages/MonitoramentoClinicoPage.tsx (patients→internacoes; vital_signs→sinais_vitais)
- Lista de pacientes: patients→internacoes(+pacientes,+leitos,+setores). Sem hospital_unit_id/
  state_id em internacoes → escopo por hospital via leito→setor→ala.hospital_id (padrão
  usePatients); ativo = data_alta IS NULL; sector = setores.tipo; name = nome_social||nome_completo.
- Sinais vitais: vital_signs→sinais_vitais, filtro por `internacao_id` (=selectedPatientId, que já
  é o encounter) — removidos o helper resolveActiveEncounterId e o `.or(encounter_id|patient_id)`.
  recorded_at→data_hora. Leitura traduzida por `mapVital`. Realtime em sinais_vitais(internacao_id).
- NEWS2 RECALCULADO na leitura (mapVital) a partir dos sinais reais (fc/fr/pas/spo2/temp/nível),
  pois news2_score/news2_risk NÃO têm coluna. Fica sem o +2 de O2 suplementar (não persistido).
- DEGRADADO (sem coluna em sinais_vitais → NÃO gravados, e null na leitura): pvc, supplemental_oxygen,
  TODA a gasometria (ph/pco2/po2/hco3/lactate/base_excess/fio2/sao2) e TODO o laboratório
  (hemoglobin/hematocrit/platelets/leukocytes/creatinine/urea/sodium/potassium/pcr/procalcitonin/inr),
  recorded_by/recorded_by_name (name vem de join profissionais.nome), hospital_unit_id, state_id.
  As abas Gasometria/Laboratório e a curva de NEWS2 armazenado ficam sem série (charts vazios).
  Os inputs de gaso/lab permanecem na UI mas NÃO são persistidos. registrado_por via profissionais.user_id.

### src/pages/ResourcesPage.tsx (patients/patient_registry/internment_requests → internacoes/pacientes/logs_auditoria)
- loadPatients: patients→internacoes(+pacientes,+leitos,+setores). Filtro por `department` REMOVIDO
  (sem coluna) → escopo por hospital via leito→setor→ala.hospital_id; ativo = data_alta IS NULL.
  name=nome_social||nome_completo, bed_number=leito.numero, sector=setores.tipo,
  age=formatAge(pacientes.data_nascimento) (patient_registry morto; removido o batch de birth_date),
  admission_history=historia_clinica (anamnese), diagnoses=hipotese_diagnostica.
- handleSave: internment_requests NÃO existe e internacoes (alvo do de-para) exige leito_id NOT NULL
  e não tem colunas para os campos livres da solicitação → gravado em logs_auditoria
  (tipo_evento='solicitacao_internacao', nome_tabela='internacoes', registro_id/internacao_id=
  internação selecionada, ator_user_id/email_ator, hospital_id), com patient_name/patient_age/
  destination/content/department em `dados_novos` (padrão do projeto para escritas sem tabela-destino).
  DEGRADADO: patient_sex/patient_record (sempre null), state_id (sem estado no schema novo).
  Removido `currentState` do destructure. A tela de /internment-history (fora do escopo) precisará
  ler esses logs para exibir o histórico.

## Wave3 data/privacy/audit/docs

### src/components/DataPrivacyPanel.tsx (user_consents/data_requests/data_retention_policies → novas)
- user_consents→consentimentos_usuario (consent_type→tipo_consentimento,
  consent_version→versao_consentimento, accepted_at→aceito_em, user_id→usuario_id).
- data_requests→solicitacoes_dados_lgpd (request_type→tipo_solicitacao,
  requested_at→solicitado_em, processed_at→processado_em, notes→observacoes, user_id→usuario_id).
- data_retention_policies→politicas_retencao_dados (table_name→nome_tabela,
  retention_years→anos_retencao, description→descricao, legal_basis→base_legal).
- DEGRADADO: a edge function `export-user-data` não consta na lista de functions do backend
  novo → o fluxo de geração+download imediato do JSON foi removido. "Solicitar Exportação"
  agora apenas registra a solicitação (status 'pending') para processamento pela equipe de
  conformidade, igual ao fluxo de exclusão. Estado `downloadingExport` (morto) removido.

### src/pages/AuditLogsPage.tsx (audit_logs → logs_auditoria)
- hospital_unit_id→hospital_id, created_at→criado_em; demais colunas mapeadas para o view-model
  interno AuditLog (user_id→ator_user_id, user_email→email_ator, user_role→papel_ator,
  action→acao, table_name→nome_tabela, record_id→registro_id, old_data→dados_antigos,
  new_data→dados_novos, changed_fields→campos_alterados).
- DEGRADADO: `state_id` e `department` não existem em logs_auditoria → sempre null (filtro por
  departamento na queryKey mantido, mas sem efeito). `acao` pode ser null → índices em
  ACTION_LABELS guardados com fallback 'SELECT'.
- TABLE_LABELS repontado para nomes de tabela do schema novo (só apresentação/filtro; nome cru
  é o fallback). O filtro por tabela só casa com valores que o backend gravar em nome_tabela.

### src/lib/auditReconstitution.ts (audit_logs → logs_auditoria)
- Insert repontado: tipo_evento='feedback_reconstituicao' (novo campo obrigatório),
  acao='INSERT', nome_tabela='reconstitution_suggestion_feedback' (rótulo do canal preservado),
  user_id→ator_user_id, user_email→email_ator, new_data→dados_novos, changed_fields→campos_alterados.
  Sem hospital_id (não há contexto de hospital no ponto de chamada).

### src/hooks/usePatientTimeline.ts (RPC get_patient_timeline / view patient_timeline → client-side)
- DEGRADADO: a RPC `get_patient_timeline` e a view `patient_timeline` não existem no schema
  novo. A timeline passa a ser montada no cliente a partir das tabelas-fonte (todas por
  internacao_id): internacoes(encounter), evolucoes(evolution), prescricoes(prescription),
  solicitacoes_exame(exam_request), resultados_cultura(culture_result), transferencias(movement),
  altas(discharge_document). Filtros (eventTypes/fromDate/toDate/search/limit) aplicados em memória.
- `patientId`=internacoes.id; `patientRegistryId`=pacientes.id → resolve internações via
  internacoes.paciente_id. Tipos de evento sem tabela-fonte no schema novo (pre_admission,
  admission_history, conduct_change, bed_status, dispensation, dhd, vital_signs, round) NÃO são
  mais emitidos. Colunas de identidade/escopo (patient_name, author_id/email, hospital_unit_id,
  state_id, department) → null. Realtime repontado para as 7 tabelas novas (sem filtro).
  TimelineEvent e EVENT_TYPE_LABELS/COLORS preservados (shape exportado estável).

### src/hooks/usePatientDocuments.ts (exam_requests/culture_results/clinical_evolutions/receituarios/documentos_medicos → novas)
- exam_requests→solicitacoes_exame (category→categoria, items→itens, created_at→criado_em);
  culture_results→resultados_cultura (culture_type→tipo_cultura); clinical_evolutions→evolucoes;
  receituarios (type→tipo, items→itens, signed_by_name→assinado_por_nome); documentos_medicos→altas.
- Todas filtradas por internacao_id (=validId). receituarios seguem o paciente por paciente_id
  (via useResolvedRegistryId) quando resolvido. altas filtrada por tipo IN (atestado,relatorio,termo).
- DEGRADADO: filtros por hospital_unit_id/state_id/archived_at/encounter_id removidos (sem coluna;
  escopo via RLS + internacao_id). Busca por patient_name removida (sem coluna) — sem internação
  válida, retorna []. authorName/patientSector/patientBed sem coluna nas fontes → null (exceto
  receituarios.authorName=assinado_por_nome e altas via conteudo Json). Os literais de `source`
  ("exam_requests"/"culture_results"/"clinical_evolutions"/"documentos_medicos") foram MANTIDOS
  no shape exportado, embora os dados venham das tabelas novas.

### src/hooks/usePatientDischargeDocs.ts (discharge_documents → altas)
- document_type→tipo, signed_at→data_hora, content→conteudo, signed_by_crm→crm_assinatura.
  Filtro por internacao_id + tipo IN (alta_hospitalar,alta_pedido,obito).
- DEGRADADO: patient_name (recuperado de conteudo quando existir, senão o argumento patientName);
  signed_by_name → null (altas.assinado_por é FK profissionais.id, não nome); filtros
  suspended_at/archived_at/encounter_id removidos (sem coluna). Busca só por patientId (internação).

### src/hooks/useDocumentoMedico.ts (documentos_medicos → altas)
- Sem tabela documentos_medicos no schema novo → mapeado para `altas` (type→tipo,
  signed_by_crm→crm_assinatura, created_by→assinado_por via profissionais.user_id). Campos sem
  coluna dedicada (body, days, cid, patient_name/bed/sector, signed_by_name) preservados dentro
  de `conteudo` (Json). Leitura filtra tipo IN (atestado,relatorio,termo).
- DEGRADADO: vínculo estável por paciente (patient_registry_id/paciente_id) removido — altas só
  referencia internacao_id (cross-internação impossível aqui). Salvar exige internação ativa
  (altas.internacao_id NOT NULL): sem patientId não emite (antes aceitava só patient_name).
  encounter_id/hospital_unit_id/created_by descontinuados; removida a dependência de
  resolveActiveEncounterId e useHospital/useResolvedRegistryId. DocumentoMedicoData preservado.

### src/components/MedicalDocumentDialog.tsx (sem acesso a Supabase)
- Não referencia tabelas — usa hooks migrados (useReceituario/useDocumentoMedico) e libs de
  impressão. Nenhuma query a migrar. Corrigido import faltante de `printDocumentoMedico`
  (usado no histórico mas não importado) para o arquivo type-checar.

### src/pages/AltaDesfechoPage.tsx (patient_movements → logs_auditoria)
- Só o TransferTab escreve no banco. patient_movements não existe; a nova `transferencias` só
  modela leito→leito (leito_origem/destino NOT NULL) e não cabe uma sinalização com destino em
  texto livre (interna/externa). DEGRADADO: a trilha passa a logs_auditoria
  (tipo_evento='transferencia_interna'|'transferencia_externa', acao='INSERT',
  nome_tabela='transferencias', internacao_id=patient.id, hospital_id) com os campos ricos
  (patient_*, movement_type, destination, notes, responsible_doctor, department, state_id) em
  dados_novos. As demais abas (Sumário/Referência/Óbito/ME/CIHDOTT) só faziam toast — inalteradas.

### src/lib/printEvolution.ts (patients → internacoes+pacientes)
- Enriquecimento do cabeçalho migrado: `patients` → internacoes(id) join pacientes
  (medical_history→comorbidades, uti_allergies→alergias, birth_date→data_nascimento).
  `(evo as any).patient_id` é internacoes.id (per useEvolutions migrado).
- DEGRADADO: coluna `age` não existe em pacientes → idade calculada só a partir de
  data_nascimento (sem fallback para age numérico).

### src/hooks/usePatientNirRequest.ts (bed_allocation_requests → solicitacoes_leito)
- patient_id→internacao_id, requested_sector→setor_solicitado_id, rejection_reason→motivo_rejeicao,
  created_at→criado_em, reviewed_at→atualizado_em. Realtime repontado (filtro internacao_id).
- DEGRADADO: requested_bed e requesting_doctor_name sem coluna → sempre null. `requestedSector`
  agora carrega o ID do setor (setor_solicitado_id), não o nome. PatientNirRequest preservado.

## Wave3 exames/culturas

Grupo de fichas de exame/cultura/requisição. De-para: exam_requests→solicitacoes_exame
(internacao_id, categoria, itens Json, prioridade, status, indicacao_clinica, observacoes,
solicitado_por, concluido_por, concluido_em, resultado_texto, resultado_dados Json);
culture_results→resultados_cultura (internacao_id, tipo_cultura, microorganismo, antibiograma,
perfil_sensibilidade, resultado_texto, arquivos_resultado Json, data_coleta, enviado_por,
lido_pelo_medico, lido_em, notificado_em); discharge_documents→altas (internacao_id, tipo,
conteudo Json, numero_documento, assinado_por, crm_assinatura, data_hora). Toda solicitação/
documento pendura em `internacao_id` (o patientId das telas). `*_por`/`solicitado_por`/
`enviado_por`/`assinado_por` são FK de profissionais.id (≠ auth.uid) → resolvidos via lookup
`profissionais.user_id`. RequisicaoUnificadaPage.tsx já estava migrada (Wave3 anterior) — só
verificada (sem tabela morta ativa; ver seção "módulo requisições/exames").

### src/lib/solicitacaoPayload.ts + src/lib/registrarSolicitacao.ts (exam_requests → solicitacoes_exame)
- Helpers compartilhados (usados por AihFormDialog e outros). Assinaturas exportadas
  (registrarSolicitacao, comSnapshotDeDocumento, buildSolicitacaoRow, SolicitacaoInput,
  DocumentPayload) mantidas ESTÁVEIS; só o destino do insert mudou.
- buildSolicitacaoRow: agora emite colunas de solicitacoes_exame — category→categoria,
  items→itens, clinical_indication→indicacao_clinica, priority→prioridade, notes→observacoes,
  patient_id→internacao_id (via asUuidOrNull; NOT NULL — sem UUID real o insert falha por
  constraint, comportamento esperado). DEGRADADOS (sem coluna → removidos do payload):
  patient_registry_id, patient_name, patient_bed, patient_sector, hospital_unit_id, state_id,
  requested_by_name, document_payload (snapshot de reimpressão indisponível).
- registrarSolicitacao: resolve `solicitado_por` (FK profissional) a partir de input.requestedBy
  (auth.uid) e mescla na linha — não cabe na função pura buildSolicitacaoRow. Fallback
  document_payload mantido como guarda defensiva (não dispara mais, pois a chave não é emitida).
- NOTA: src/tests/registrar-solicitacao.test.ts (fora do escopo) ainda afirma o shape ANTIGO
  (patient_id/patient_name/...) — precisa ser atualizado para as colunas novas.

### src/pages/SetorLaboratorioPage.tsx + src/pages/SetorImagemPage.tsx (exam_requests → solicitacoes_exame)
- Fetch por `categoria` ('laboratorio'/'imagem'), ordenado por criado_em, limit 500. Sem coluna
  hospital_unit_id/state_id → filtro por unidade REMOVIDO (RLS escopa). Paciente reconstruído via
  join internacoes→pacientes(nome)/leitos(numero)/setores(tipo) e solicitante via
  profissionais!solicitado_por_fkey(nome). `normalizeSolicitacao` remonta o shape legado ExamRequest.
- patient_sector = setores.tipo (código, p/ getSectorDisplayLabel). patient_id = internacao_id.
- handleUpdateStatus: results→resultado_texto, result_data→resultado_dados, completed_at→
  concluido_em, completed_by→concluido_por (FK profissional via user_id; e-mail avulso não tem
  mais coluna). Realtime repontado p/ solicitacoes_exame sem filtro de unidade.
- DEGRADADO: `completed_by` (nome do concluinte) → concluido_por não tem relationship declarada
  em types.ts → não é resolvido por join → sempre null (a linha "Concluído por" some).

### src/pages/EmergenciaSectorPage.tsx (patients/patient_registry → internacoes+leitos+setores+pacientes)
- Mega-tabela `patients` morta. Lista montada de leitos do setor (setores.tipo == activeSector)
  + internação ATIVA (data_alta IS NULL) de cada leito + pacientes. Escopo por hospital via
  setores→alas.hospital_id. Idade ao vivo de pacientes.data_nascimento (registry morto).
- DEGRADADO (sem coluna no schema novo): filtro `department` (URGÊNCIA…) removido (setor.tipo já
  escopa); `display_order` → ordenação por número do leito; `admission_history`/`clinical_status`
  → omitidos. EmergencyPatient.id: ocupado → internacoes.id; vago → leitos.id.

### src/components/PrintableRequisitionGuide.tsx (patients/patient_registry/patient_encounters → internacoes+pacientes)
- `fetchPatientIdentifiers`: patient_id agora é internacao_id → busca internacoes(id)→
  pacientes(data_nascimento, prontuario). DEGRADADO: encounter_code (nº de atendimento) →
  patient_encounters morto → sempre null (imprime "—"); param patient_registry_id mantido, sem uso.
  Builders de impressão (buildRequisitionGuideHtml/printRequisitionGuide) e a pré-visualização
  React inalterados no restante.

### src/components/CultureRequestDialog.tsx (exam_requests → solicitacoes_exame, categoria 'cultura')
- Mantém o comportamento original (a ficha gravava em exam_requests category='cultura'). Insert
  direto em solicitacoes_exame; removidos resolveActiveEncounterId, comSnapshotDeDocumento e o
  gate hospital/estado. internacao_id = asUuidOrNull(patientId) (NOT NULL — sem internação real,
  bloqueia com aviso). solicitado_por via profissionais.user_id. Prefill do médico: profiles→
  profissionais (nome). DEGRADADOS (sem coluna): patient_name/bed/sector, hospital_unit_id/
  state_id, encounter_id, requested_by_name (nome do médico vai em observacoes), document_payload
  (reimpressão do impresso de cultura pelo histórico indisponível).

### src/components/HemocomponentRequestDialog.tsx (exam_requests → solicitacoes_exame, categoria 'hemocomponente')
- Insert/update direto em solicitacoes_exame (removidos comSnapshotDeDocumento e gate hospital/
  estado). internacao_id NOT NULL → bloqueia sem internação. solicitado_por via profissionais.
  user_id. Prefill médico: profiles→profissionais (nome/numero_conselho). Hidratação do cabeçalho:
  patients/patient_registry mortos → resolvePatientHeader (já migrado) + internacoes
  (hipotese_diagnostica) + pacientes (tipo_sanguineo). DEGRADADOS: patient_race (raça — sem
  coluna), patient_weight (uti_weight_kg — sem coluna equivalente) → não hidratados; nome/CRM/
  setores vão em observacoes; document_payload sem coluna (impresso diferenciado não reimprimível
  pelo histórico); patient_name/bed/sector, hospital_unit_id/state_id, requested_by_name sem coluna.

### src/components/OPMEDialog.tsx + src/components/CVCChecklistDialog.tsx (discharge_documents → altas)
- Insert em `altas` (tipo 'opme'/'cvc_checklist'). content→conteudo (Json); campos ricos sem
  coluna (patient_name/bed/sector, signed_by_name, department) PRESERVADOS dentro de `conteudo`.
  signed_by→assinado_por (FK profissional via user_id), signed_by_crm→crm_assinatura, signed_at→
  data_hora. internacao_id = asUuidOrNull(patientId) (NOT NULL → bloqueia sem internação).
  Removidos resolveActiveEncounterId e o gate de estado; prefill médico profiles→profissionais.
  DEGRADADOS (sem coluna em altas): encounter_id, hospital_unit_id, state_id, department,
  signed_by_name, numero_documento (null). A impressão (HTML popup / Norma Zero) é inalterada.

### src/hooks/usePatientPendingItems.ts + src/hooks/usePatientSpecialRequests.ts (exam_requests+culture_results → solicitacoes_exame+resultados_cultura)
- Filtro único por `internacao_id` (o patientId é a internação). Colunas: category→categoria,
  items→itens, culture_type→tipo_cultura, microorganism→microorganismo, created_at→criado_em;
  em usePatientSpecialRequests requested_by_name→join solicitado_por(nome) e uploaded_by_name→
  join enviado_por(nome). DEGRADADOS (sem coluna): matching por patient_name + hospital_unit_id,
  filtro por encounter ativo (useActiveEncounterId removido — a internação JÁ é o encounter),
  `archived_at` (blindagem por leito reusado). Parâmetros patientName/hospitalUnitId mantidos na
  assinatura, sem uso. Realtime repontado p/ as tabelas novas (filtro internacao_id).

### src/components/CultureNotifications.tsx (culture_results → resultados_cultura)
- Fetch de culturas não lidas (status='completed', lido_pelo_medico=false). Colunas denormalizadas
  de paciente (patient_name/sector/bed) e uploaded_by_name não existem → reconstruídas via join
  internacoes→pacientes/leitos/setores e enviado_por→profissionais. Sem hospital_unit_id/state_id
  → filtro por unidade REMOVIDO (RLS escopa). Filtro por setor do médico (activeSector) feito
  client-side sobre setores.tipo. markAsRead: read_by_doctor→lido_pelo_medico, read_at→lido_em.
  Realtime (INSERT) repontado p/ resultados_cultura sem filtro de unidade.
