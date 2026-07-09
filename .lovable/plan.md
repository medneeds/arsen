# Aba "Pacientes" no Dev Console

Reutilizando os padrões já existentes (`ClearSignalingTab`, `SignalInternalTransferDialog`, `executeInternalTransfer`, `signalInternalTransfer`), acrescentar uma nova aba no `/dev-console` para **inspecionar** e **destravar** pacientes com transferência mal-sucedida — sem duplicar lógica clínica.

## Escopo (o que faz)

1. **Busca de paciente** por nome / prontuário / leito / setor (via edge `dev-console-ops`, nova action `list_patients_for_dev`, tolerante a NFD).
2. **Painel de inspeção** por paciente selecionado, mostrando de uma vez só:
   - Identidade + leito atual + `admission_status` + `is_vacant`.
   - Encounter ativo (`patient_encounters` sem `ended_at`) + `encounter_code`.
   - Transferência interna pendente em `internal_transfer_requests` (status=pending) — origem, destino e classificação.
   - Últimas 10 movimentações (`patient_movements`) e últimos documentos de alta/óbito.
3. **Ações de correção** (todas passam pela edge com `confirm:true` + audit_log `DEV_FIX_TRANSFER`):
   - **Cancelar transferência sinalizada travada** → marca `internal_transfer_requests` como `cancelled`, restaura snapshot no leito de origem se ainda estiver vazio, volta `admission_status` para `admitido`.
   - **Mover para outro leito** (força alocação): reutiliza `executeInternalTransfer` client-side quando o leito destino existe e está livre. Não cria SAPS extra se a origem for a mesma classificação.
   - **Reabrir encounter fechado por engano** (`ended_at=null`) — apenas se encerrado nas últimas 24h.
   - **Liberar leito órfão** (leito com dados clínicos mas paciente já com desfecho) — chama `archive_patient_bed_data` e depois limpa colunas do `patients`.
4. **Prévia obrigatória (dry-run)** antes de qualquer execução — mesmo padrão do `ClearSignalingTab` (AlertDialog com resumo).

## Segurança

- Acesso restrito por `useIsDev` (já existe).
- Toda action passa por `dev-console-ops` com `confirm:true`.
- Cada execução grava `audit_logs` com `action='DEV_FIX_TRANSFER'`, `record_id=patient_id`, `changed_fields` detalhando o passo.
- Nenhuma ação toca `medical_records`, `prescriptions`, `clinical_evolutions`, `exam_requests` — só camadas de movimentação/leito/transfer_request (respeitando "Princípios Imutáveis" — 4 camadas separadas).

## Arquivos

- **Novo**: `src/components/dev/PatientOpsTab.tsx` — UI (busca, painel de inspeção, botões de ação, prévia).
- **Edit**: `src/pages/DevConsolePage.tsx` — adiciona nova aba `patient-ops` (ícone `UserCog`) entre "Limpar Sinalizações" e "Histórico Residual".
- **Edit**: `supabase/functions/dev-console-ops/index.ts` — adiciona actions:
  - `list_patients_for_dev` (busca com filtro + join leve com `internal_transfer_requests` e `patient_encounters`).
  - `inspect_patient` (retorna todos os detalhes do painel).
  - `fix_transfer_cancel_pending` (dry-run + execução).
  - `fix_transfer_reopen_encounter` (dry-run + execução).
  - `fix_transfer_release_orphan_bed` (dry-run + execução).
  - Ação de "mover para outro leito" fica no client (usa `executeInternalTransfer` já auditado).

## Fora de escopo (não mexer)

- Fluxos clínicos (prescrição, evolução, exames, admissão).
- RPCs `repoint_patient_history`, `execute_internal_transfer_atomic` — usados como estão.
- Ações destrutivas em massa (só 1 paciente por vez).
- Renomear/mesclar registry — já existe aba própria (`MergesTab`).

## Aspecto técnico

- Reaproveita helper `callOps` do `DevConsolePage`.
- Padrão de audit_log idêntico ao já usado em `ClearSignalingTab` (`DEV_CLEAR_SIGNALING` → `DEV_FIX_TRANSFER`).
- Sem migrations novas — só edge function e front-end.

Confirma que posso implementar?