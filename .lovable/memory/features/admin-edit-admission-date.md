---
name: admin-edit-admission-date
description: Edição Avançada — data de admissão somente leitura em formato BR; edição com auto-máscara DD/MM/AAAA + HH:MM, validação estrita e histórico imutável
type: feature
---

`AdmissionDateEditor` exibe o valor sempre em BR (DD/MM/AAAA HH:MM, sem ajuste de fuso). A edição abre 2 popups:

1. **Confirmação** (Sim/Não/Sair) — alerta que a alteração é registrada.
2. **Edição** com **auto-máscara**:
   - Data: aceita só dígitos, insere `/` automaticamente nas posições 2 e 4 → `DD/MM/AAAA`
   - Hora: aceita só dígitos, insere `:` na posição 2 → `HH:MM` (24h)
   - `inputMode="numeric"` + `pattern` para validação nativa
   - Banner amarelo no topo lembrando que **DD/MM/AAAA** é o padrão brasileiro (ex.: 14/05/2026 = 14 de MAIO)
   - Labels explícitas "Dia · Mês · Ano" e "Hora · Minuto (24h)"
   - Validação rejeita data inválida, hora inválida e datas futuras
3. **Histórico** lê de `patient_admission_date_history` (tabela imutável), mostra autor, motivo e antes/depois.

Persistência: `patient_admission_date_history` é gravado **antes** do `UPDATE patients.admission_date`. `usePatients.updatePatient` ignora `admission_date` — o campo só pode ser alterado por este componente (caminho único auditado).
