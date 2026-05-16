---
name: weight-allergies-required
description: Peso e alergias do paciente são obrigatórios para liberar prescrição; ambos persistem em patients (uti_weight_kg / uti_allergies) com sync bidirecional + realtime + debounce 500ms na PrescricaoPage; banner âmbar didático no topo quando faltar qualquer um
type: feature
---

**Persistência:**
- `patients.uti_allergies` (text, formato canônico separado por `\n`)
- `patients.uti_weight_kg` (numeric(6,2), aceita 0–500; ignora valor inválido)

**Sync na PrescricaoPage (padrão idêntico para ambos):**
1. Hidratação inicial via `select` por `patientId` (URL searchParam).
2. Realtime: canal `postgres_changes` UPDATE em `patients` com filtro `id=eq.{patientId}` aplica remoto → local, ignorando se for o último valor que nós gravamos (evita loop).
3. Write debounced 500ms (local → DB) ao alterar input.
4. Refs `lastSynced*Ref` + `*HydratedRef` para gating.

**UI:**
- Banner âmbar com `AlertTriangle` no topo da página (antes do header unificado) quando `!patient.weight.trim() || !patient.allergies.trim()` — texto "PESO e ALERGIAS são obrigatórios para liberar o ato de prescrição".
- `canPrescribe = weight && allergies` continua bloqueando assinar/validar/imprimir com toast.
- Input de peso já tem borda âmbar quando vazio; chip de alergias mostra ícone verde (NDAM) ou vermelho.

**O que NÃO mudou:**
- Layout/sizing do header, sidebar, cockpit
- Fluxo de validação/assinatura/impressão
- Regras de validação por categoria (fluid rules, oral solid posology, escape universal removido)
- RLS, schema de prescriptions, locked sectors, repoint history
