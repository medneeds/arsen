---
name: encounter-autolink-trigger
description: Trigger BEFORE INSERT/UPDATE em patient_encounters que auto-vincula patient_id pelo nome+unidade quando o match é único (defensivo, sem quebrar fluxo)
type: feature
---

# Auto-link de patient_encounters órfãos

## Problema resolvido
Atendimentos (`patient_encounters`) eram criados com `patient_id = NULL` em
alguns fluxos (admissão via recepção, NI promovido, transferência). Resultado:
evoluções salvas com aquele `encounter_id` não passavam no filtro
`useActiveEncounterId` (Fase B.1/B.3) → desapareciam da tela de Evolução do
cockpit, apesar de ficarem visíveis no histórico.

## Solução
Trigger `trg_autolink_encounter_patient_id` (`BEFORE INSERT OR UPDATE OF
patient_name, hospital_unit_id`) chama `public.autolink_encounter_patient_id()`:

1. Só age se `NEW.patient_id IS NULL` e há `patient_name + hospital_unit_id`.
2. Conta pacientes em leito ativo (`is_vacant=false`) na mesma unidade com
   `upper(name) = upper(NEW.patient_name)`.
3. **Match único** → vincula `NEW.patient_id`.
4. **Ambíguo ou inexistente** → deixa NULL (não quebra insert; pode ser
   religado manualmente depois).

## Garantias
- `SECURITY DEFINER` + `SET search_path = public`.
- Não toca em encounters já vinculados (early return).
- Não cria/altera RLS, RPC ou hooks.
- Análogo ao `Patient Registry Autolink Trigger` em `patients`.

## Correção pontual aplicada antes do trigger
10 atendimentos órfãos religados manualmente em 20/05/2026 (GEYCIARA,
WASHINGTON, GINELMA, NEILSON, ANTONIO REGINALDO, ROGERIO, GERSON, NILO, LELIS,
JOSE CARLOS). 1 caso restante (JOAO LUCAS SANTIAGO) sem leito ativo —
aguarda religação manual quando reaparecer.
