---
name: Medical Record Numbering Transition Mode
description: Modo legacy/auto por unidade hospitalar para geração do número de prontuário, com convivência de números antigos e auditoria
type: feature
---

# Modo de Transição Legacy → Auto

## Flag por unidade
- `hospital_units.medical_record_mode` ∈ {`legacy`, `auto`} — default `legacy`.
- Liga/desliga geração automática SEM refatorar código.

## Tabela `medical_records` (relaxada)
- `numero_prontuario` aceita formato seguro `AA-UUU-SSSSSS-DV` OU número livre legado (1–64 chars).
- `numero_prontuario_legado` (text, opcional) — preserva vínculo histórico.
- `generation_mode` ∈ {`auto`, `manual_legacy`}.
- `is_legacy` (boolean).
- `hospital_unit_id` (FK).
- Campos da numeração segura (`numero_base`, `dv`, `ano_referencia`, `codigo_unidade`, `sequencia`) agora NULLABLE para conviver com legados.

## Trigger `medical_records_apply_mode` (BEFORE INSERT)
1. Se `numero_prontuario` foi informado:
   - Se NÃO bate o formato seguro → marca `is_legacy=true`, `generation_mode='manual_legacy'`, copia para `numero_prontuario_legado`.
   - Se bate → mantém como `auto`.
2. Se vazio + unidade `legacy` → **bloqueia** com erro (exige número manual do sistema antigo).
3. Se vazio + unidade `auto` → gera `AA-UUU-SSSSSS-DV` automaticamente via `medical_record_sequences` + `calc_dv_mod11`.

## Auditoria
- Trigger `trg_medical_records_audit` (AFTER INSERT/UPDATE/DELETE) usa `audit_trigger_function()` → registra em `audit_logs` toda inserção (manual vs gerado), capturando `hospital_unit_id`, autor, payload.

## Virada de chave (futuro)
- Apenas `UPDATE hospital_units SET medical_record_mode='auto' WHERE id=...` por unidade.
- Sem retrabalho: registros legados continuam válidos; novos números seguem padrão seguro.
