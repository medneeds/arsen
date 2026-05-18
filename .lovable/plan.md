# Padronizar "Limpar Sinalizações" no Dev Console

## Objetivo
Hoje a limpeza é feita ad-hoc por SQL direto (como fizemos para o DARLEILSON). Vamos transformar isso em uma ação oficial, auditada, com confirmação, dentro do Dev Console — sem nunca tocar em prontuário, evolução, prescrição, requisição, admissão ou leito.

## Escopo cirúrgico (camada Movimentação apenas)
Para o(s) paciente(s) selecionado(s), a ação faz **somente** isto:

1. `DELETE` em `patient_movements` onde `release_status='pending_release'` E `movement_type IN (ALTA_HOSPITALAR, OBITO, TRANSFERENCIA_INTERNA, TRANSFERENCIA_EXTERNA, 'LIBERAÇÃO PÓS-ALTA/ÓBITO', 'LIBERAÇÃO PRÉ-ADMISSÃO')`.
2. `DELETE` em `discharge_documents` onde `document_type IN ('alta_hospitalar','obito')`.
3. `UPDATE patients SET admission_status='admitido'` **somente** se o status atual for um dos de saída (`alta_dada`, `obito`, `transferido`, `transferencia_interna_pendente`, `transferencia_externa_pendente`). Se for `pre_admitido` (caso DARLEILSON) ou qualquer outro, **não toca**.

## O que NÃO toca (blindagem explícita)
- `bed_census` / leito / setor
- `clinical_evolutions`, `prescriptions`, `exam_requests`, `culture_results`
- `patient_encounters`, `medical_records`, `patient_registry`
- Movimentações que não sejam de saída (ex.: ADMISSÃO, TRANSFERÊNCIA já efetivada com `release_status='released'`)
- RLS, código de outros fluxos, outros pacientes

## Onde mexer

### 1. `supabase/functions/dev-console-ops/index.ts`
Nova ação `clear_patient_signaling` (requer `confirm:true`, role dev/admin já validado).

Parâmetros:
- `patientId` (preferencial), **ou** `patientIds: string[]` (lote)
- `dryRun: boolean` (default `false`) — quando true, retorna prévia sem executar

Retorno:
```json
{
  "ok": true,
  "results": [{
    "patientId": "...",
    "name": "...",
    "bed": "L09",
    "sector": "outside",
    "movementsDeleted": 4,
    "documentsDeleted": 1,
    "statusReset": true,
    "previousStatus": "obito"
  }],
  "totals": { "movementsDeleted": 4, "documentsDeleted": 1, "patientsAffected": 1 }
}
```

Registra entrada em `audit_logs` (action='DEV_CLEAR_SIGNALING') com o JSON do resultado.

Outra ação companheira `list_patients_with_signaling` (read-only) retorna todos os pacientes com pelo menos uma sinalização ativa (pending movement OU discharge_document OU admission_status de saída), com `name`, `bed_number`, `sector`, `admission_status`, contadores e a última sinalização.

### 2. `src/pages/DevConsolePage.tsx`
Nova aba `signaling` (ícone `Eraser` ou `Trash2`) — componente `ClearSignalingTab` em `src/components/dev/ClearSignalingTab.tsx`:

- Botão "Atualizar" → chama `list_patients_with_signaling`
- Tabela: Nome · Leito · Setor · Status · Mov. pendentes · Documentos · Última sinalização · Ação
- Busca client-side por nome/leito (NFD)
- Seleção múltipla (checkbox) + botão "Limpar selecionados"
- Linha individual com botão "Limpar"
- Cada clique abre `AlertDialog` com **prévia em dryRun** (lista exata do que será apagado) + texto didático:
  > "Esta ação remove **somente** as sinalizações de saída (movimentações pendentes e documentos de alta/óbito) e restaura o status para `admitido` se aplicável. Leito, prontuário, evoluções, prescrições, requisições e admissão **não são afetados**. Registrada em audit_logs."
- Confirmar → executa com `dryRun:false`, mostra toast com `totais` e atualiza a lista.

## Layout
Mantém o padrão visual do Dev Console (header dark, tabs azuis). Sem mudanças estruturais na sidebar nem no app.

## Como ficaria o caso DARLEILSON
Apareceria na lista (status `pre_admitido` + 4 movs pendentes + 1 doc óbito). Clicar "Limpar" → prévia → confirmar → 4 movs e 1 doc removidos, status `pre_admitido` preservado, leito L09/UCI 2 intacto.

## Confirmação que peço antes de implementar
1. **OK** com o nome da aba "Limpar Sinalizações" e ícone `Eraser`?
2. **OK** com a regra de não restaurar `pre_admitido` para `admitido` (preservar o status original quando não for status de saída)?
3. **OK** com a auditoria em `audit_logs` action='DEV_CLEAR_SIGNALING'?

Se sim para os três, sigo direto na implementação dos 2 arquivos.
