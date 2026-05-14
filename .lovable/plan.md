## Objetivo

Garantir que TODA transferência interna (entre setores ou entre leitos) preserve o **mesmo `patients.id`** — assim evoluções (`clinical_evolutions.patient_id`), prescrições (`prescriptions.patient_data->>id`), exames, culturas e histórico permanecem ligados sem orfandade.

## Princípio único

> Transferência interna = `UPDATE patients SET sector, bed_number, department, hospital_unit_id... WHERE id = <id_existente>`.
> **Nunca** `INSERT` de uma nova linha + alta da antiga.

`INSERT` em `patients` fica reservado apenas para **primeira admissão** (paciente novo entrando no hospital pela recepção/triagem/UE).

## Fluxos a auditar e ajustar

### 1. PatientMovementDialog — TRANSFERENCIA_INTERNA
Hoje só grava em `patient_movements` e não move o paciente. Vou:
- Após gravar o movimento, executar `UPDATE patients SET sector=<novo>, department=<novo>, bed_number=<novo>, updated_at=now() WHERE id=<id>`.
- Adicionar seleção de **leito de destino** (Combobox de leitos vagos do setor escolhido) já dentro do diálogo, obrigatório.
- Bloquear submissão se o leito de destino estiver ocupado.

### 2. NIR / BedDetailDialog (aceitar paciente em leito vago do destino)
Verificar se hoje cria nova linha. Se sim → trocar por `UPDATE` da linha do paciente original (resolvido via `pre_admissions.patient_id` ou `patient_registry_id`).

### 3. Páginas de UE Vertical / Horizontal / TriageQueue (`patients.insert`)
Manter `INSERT` apenas no caminho "primeira admissão" (paciente sem `patients.id` ainda). Quando vier de transferência (já existe `patients.id`), trocar por `UPDATE`.

### 4. Realocação intra-setor (BedReallocationDialog)
Já está correta — só muda `bed_number`. Não mexer.

### 5. Trigger `auto_vacate_on_discharge`
Hoje limpa campos clínicos quando `name` é esvaziado. **Não tocar** — continua valendo para alta real. Como transferência agora não esvazia `name` no leito antigo, a trigger não dispara indevidamente.

→ Implicação: o leito de origem precisa ficar vago de outra forma. Solução: no `UPDATE` de transferência, mover o paciente para o leito de destino também significa o leito antigo automaticamente "perde" esse paciente (porque `bed_number` agora é outro). Como `patients.bed_number` é o vínculo, o leito antigo simplesmente não tem mais paciente apontando pra ele — fica visualmente vago no mapa sem precisar limpar nada.

## Ordem de execução

1. **Refatorar `PatientMovementDialog`** (subtype TRANSFERENCIA_INTERNA) — adiciona seletor de leito + executa UPDATE consolidado.
2. **Auditar `BedDetailDialog` (NIR)**, `RequestNewAllocationDialog`, `AdmitPatientDialog` — caso criem nova linha quando já existe `patient_id`, trocar por UPDATE.
3. **Auditar UE/Triagem** — garantir que só fazem INSERT em primeira admissão.
4. Smoke test: transferir paciente UTI → Enfermaria, validar que evoluções e prescrição rascunho aparecem na nova ficha.

## Sem alterações de schema

Nenhuma migração de banco é necessária. Tudo é mudança de lógica no frontend.

## O que NÃO está no escopo

- Não vou migrar evoluções/prescrições órfãs já existentes no banco (resultado de transferências antigas que duplicaram linhas) — risco alto e não foi pedido. Se quiser, posso entregar um relatório listando esses casos depois.
- Não vou mexer em alta hospitalar real (esvaziamento de leito, óbito, evasão).
- Layout dos diálogos só ganha o seletor de leito quando faltar; sem outras mudanças visuais.

## Confirmação necessária

Posso prosseguir com essa refatoração nesta ordem?