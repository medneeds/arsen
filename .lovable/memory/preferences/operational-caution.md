---
name: operational-caution
description: Princípios de cautela máxima para alterações no sistema em produção (operação clínica grande, dados sensíveis, zero downtime tolerado)
type: preference
---

**Contexto:** Sistema clínico em produção com múltiplas unidades hospitalares ativas, prontuários reais, prescrições reais. Cada bug pode comprometer atendimento.

**Regras invioláveis:**

1. **Diagnóstico antes de código** — auditar o fluxo (client + edge + DB) e listar problemas concretos com linha/arquivo antes de propor alterações. Nunca "consertar no escuro".

2. **Confirmação antes de mudança estrutural** — mudanças que afetam layout, sizing, contratos de dados, schemas, RLS ou fluxos de movimentação só após explicar entendimento e receber "ok"/"confirmo"/"siga".

3. **Mudança mínima e isolada** — alterar só o que foi pedido. UI ↔ frontend; lógica ↔ backend. Não tocar arquivos vizinhos "de bônus".

4. **Proteção de dados em primeiro lugar:**
   - Nunca relaxar RLS para "destravar" um bug.
   - Auditoria imutável (`*_history` tables) em qualquer edição de identidade, prontuário, data de admissão, leito.
   - NI/anti-NI guards preservados em headers de PDF e prints.
   - Realtime sync de identidade (`patients`/`patient_registry`/`patient_encounters`/`medical_records`) nunca bypassed.

5. **Preservar histórico clínico em movimentações:**
   - Transferência interna usa `repoint_patient_history` — nunca alta+nova admissão.
   - Tarjas (alta/óbito/transferência int/ext) sinalizam ANTES de desalocar.
   - Locked sectors com cleanup 24h preservam prontuário.

6. **Validar antes de declarar pronto:**
   - Para edits de UI: checar console/network/replay; visual quando possível.
   - Para edits de DB: linter Supabase obrigatório.
   - Para PDFs: testar com paciente real do mock + verificar leito ATUAL.

7. **Mensagens de erro reais até o usuário** — nunca esconder 429/402/422 atrás de "erro genérico". Desempacotar `response.error.context.body` quando vier de edge function.

8. **Pendências priorizadas viram tasks no `.lovable/plan.md`** — não perder demandas adiadas pelo usuário.

9. **Comunicação:** explicar o que entendi + o que vou tocar (arquivos) + o que NÃO vou tocar, antes de mudanças significativas. Resposta final concisa, sem narração de tool calls.

10. **Memória contínua:** toda decisão arquitetural ou padrão repetido vira memory file + entrada no índice.
