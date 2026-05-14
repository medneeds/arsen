## Entendimento

Hoje o ciclo do paciente no mapa é:
1. **Pré-admissão** (`admissionStatus = 'pre_admitido'`) — paciente alocado no leito, anamnese pendente.
2. **Admissão concluída** (`admissionStatus = 'admitido'`) — paciente "D0" oficial.
3. **Alta** (médica → administrativa) — desocupa o leito.

Você quer 3 ajustes:

### 1. "Retirar paciente do mapa" antes da admissão estar concluída
- Disponível **somente quando `admissionStatus = 'pre_admitido'`** (ainda não virou admissão oficial).
- Ação: **libera o leito** (volta para vago) **sem apagar** o `patient_registry` / prontuário já cadastrado. Os dados do paciente continuam buscáveis em /historico-paciente e na recepção.
- Hoje a função `deletePatient` no `usePatients` já zera o leito mantendo `patient_registry` intacto, mas seta `patient_registry_id = null` e `medical_record = null` na linha do leito — vou trocar para uma ação nova `releaseBedPreAdmission` que:
  - registra `patient_movements` com `movement_type = 'liberacao_pre_admissao'` (auditoria, vincula ao prontuário)
  - zera só os campos clínicos do leito
  - **preserva** `patient_registry_id` no histórico do movimento (não no leito)
  - mantém o registro em `patient_registry` (prontuário continua vivo)
- Fica disponível para perfis: **médico, admin, gestor, NIR**. Bloqueado para visitante/porta/farmácia.

### 2. Onde a ação aparece
- Botão "Liberar leito (pré-admissão)" no `PatientCard` (modo expandido, área de ações), com `MovementConfirmDialog` no padrão dos outros movimentos: resumo + bloqueios (se já estiver `admitido` mostra bloqueador "use o fluxo de alta") + consequências didáticas.
- Atalho equivalente no `BedDetailDialog` do NIR (já tem o framework de ações).

### 3. Revisão do fluxo de alta
Hoje:
- **Alta médica**: gerada via `DischargeConfirmDialog` + `DischargeDocumentForm` — gera sumário, marca `bed_census.status = 'alta_medica_dada'`, registra em `patient_movements`, mas **não desocupa o leito**.
- **Alta administrativa**: NIR/gestão libera o leito (vai para `higienizacao` → `vago`).

Vou:
- Garantir que a alta médica **valide os campos obrigatórios já existentes** (CID, destino, sumário) antes de permitir confirmar — usando `blockingMissing` do `DischargeConfirmDialog` (já existe, vou auditar se está cobrindo tudo).
- Reforçar que após alta médica o leito fica **`alta_medica_dada` + ainda ocupado** (paciente fisicamente lá), e só a alta administrativa zera o leito.
- Adicionar consequência didática nos dois diálogos explicando exatamente o próximo passo ("o leito ficará marcado como Alta Médica Dada e aparecerá para a Alta Administrativa do NIR liberar fisicamente").
- Auditoria dupla: alta médica grava `patient_movements` com tipo `alta_medica`; alta administrativa grava `alta_administrativa`. Ambos vinculam ao mesmo `encounter_code`.

## Arquivos afetados
- `src/hooks/usePatients.ts` — nova função `releaseBedPreAdmission` (sem apagar registry); ajuste do `deletePatient` para uso restrito (admin).
- `src/components/PatientCard.tsx` — novo botão "Liberar leito (pré-admissão)" com gating por `admissionStatus` e role.
- `src/components/BedReleasePreAdmissionDialog.tsx` (novo) — usa `MovementConfirmDialog`.
- `src/components/DischargeConfirmDialog.tsx` — auditoria/reforço dos `blockingMissing` e mensagem clara sobre alta médica × administrativa.
- `src/components/nir/BedDetailDialog.tsx` — adicionar a mesma ação inline.
- `src/pages/Index.tsx` — wire-up do novo handler.
- `mem://features/bed-allocation-medical-autonomy.md` — atualizar memória (já existe esse arquivo).

## Permissões
| Perfil | Liberar pré-adm | Alta médica | Alta administrativa |
|---|---|---|---|
| médico/admin/gestor | ✅ | ✅ | ❌ (só vê) |
| NIR | ✅ | ❌ | ✅ |
| visitante/porta/farmácia | ❌ | ❌ | ❌ |

## Confirmação
Confirma esse desenho? Em especial:
- (a) **liberar pré-admissão preserva o `patient_registry` mas desocupa o leito** (não há "soft delete" da admissão — quando o paciente voltar, será nova admissão vinculada ao mesmo prontuário);
- (b) **médico pode fazer alta médica + liberar pré-admissão**, mas **alta administrativa fica com NIR** (mantendo a separação que você já modelou);
- (c) **a ação fica bloqueada se o paciente já estiver `admitido`** — nesse caso o caminho oficial é alta médica → administrativa.

Se algum desses pontos for diferente, me diga antes que eu execute.
