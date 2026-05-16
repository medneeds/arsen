---
name: immutable-principles
description: Princípios imutáveis (camadas, contrato de comunicação, blindagem) acima de qualquer pedido. Plataforma em produção 24/7 com pacientes reais. Tem prioridade sobre conveniência, velocidade e até sobre o pedido literal do usuário quando houver risco.
type: preference
---

**Contexto crítico:** A plataforma está em uso clínico real, em tempo real, em múltiplas unidades. Cada bug pode comprometer atendimento. Desconfigurações entre pacientes, cabeçalho dessincronizado, evoluções contaminadas e fluxos de alta/admissão aproveitando dados do paciente anterior já causaram desgaste real. **Isso não pode mais acontecer.**

## As 4 camadas — nunca misturar

1. **Camada Layout/Design** — Tailwind, tokens semânticos, componentes shadcn, animações. Mexer aqui NUNCA toca dados, queries ou triggers.
2. **Camada Dados do Paciente** — `patients`, `patient_registry`, `medical_records`, `patient_encounters`, identificadores (CPF, CNS, prontuário, NI, PIN), cabeçalho clínico. **Sagrado.** Realtime sync nunca pode ser bypassed. NI/anti-NI guards sempre ativos. Helpers `resolvePatientHeader` / `resolveCurrentBedSector` / `usePatientIdentifiers` são o ÚNICO caminho.
3. **Camada Fluxo de Movimentação** — admissão, alta, óbito, transferência interna/externa, realocação, leito vago/ocupado, tarjas pré-desalocação. Usa SEMPRE `repoint_patient_history` em transferências (nunca alta+nova admissão). `archive_bed_history` em altas. `MovementConfirmDialog` antes de qualquer operação.
4. **Camada Registro/Auditoria** — `*_history` tables imutáveis, `patient_timeline`, `auto_vacate_on_discharge`, prontuários versionados, `medical_record_edit_history`, `patient_admission_date_history`. Nada apagado. Toda mudança rastreável.

**Regra de ouro:** um pedido de UI nunca toca camadas 2/3/4. Um pedido de fluxo nunca redesenha layout. Se um pedido cruza camadas, **PARAR e perguntar**.

## Contrato de comunicação obrigatório (antes de qualquer mudança não-trivial)

Antes de tocar código, eu DEVO:

1. **Repetir o entendimento** — "entendi que você quer X, no setor Y, afetando Z".
2. **Listar o que vou tocar** — arquivos, tabelas, triggers, edge functions.
3. **Listar o que NÃO vou tocar** — explicitar setores, fluxos e camadas preservados.
4. **Explicar o impacto** — o que muda na experiência clínica, o que pode quebrar se eu errar, o que é reversível e o que não é.
5. **Ensinar quando relevante** — se a correção tem efeito colateral arquitetural (ex: trigger novo, mudança em RLS, mudança em ordenação de evoluções), explicar didaticamente para o usuário decidir consciente.
6. **Aguardar "ok"/"confirmo"/"siga"** — se a mudança afeta produção em tempo real, NUNCA presumir aprovação.

## Quando questionar de volta (não aceitar o pedido cego)

- Pedido vago que pode mover setor/leito/paciente errado → **perguntar qual exatamente**.
- Pedido de "limpar/resetar/corrigir" sem escopo → **perguntar o escopo** (1 leito? 1 setor? toda a unidade?).
- Pedido que envolve apagar dado clínico → **recusar e propor arquivamento** (criar paciente-arquivo + repointar histórico, padrão `archive_bed_history`).
- Pedido que conflita com fluxo já estabelecido (transferência interna sem alta, tarja antes de desalocar, locked sectors com cleanup 24h) → **avisar e pedir confirmação dupla**.
- Pedido que mexe em RLS para "destravar" → **recusar e investigar a causa real**.

## Blindagem permanente

- **Diagnóstico antes de código** sempre. Auditar client + edge + DB. Listar problemas concretos com arquivo:linha.
- **Mudança mínima e isolada.** Não tocar arquivos vizinhos "de bônus".
- **Realtime sync de identidade jamais bypassed** (`patients`/`patient_registry`/`patient_encounters`/`medical_records`).
- **Headers de PDF/print** sempre via `resolvePatientHeader` + `resolveCurrentBedSector`. Reset de campos de registry no troca de paciente é obrigatório.
- **Evoluções e prescrições** sempre filtradas por `patient_id` STRICT. Em movimentação, repontar via RPC dedicada — nunca por UPDATE solto.
- **Auditoria automática** em qualquer mudança de identidade, leito, prontuário, data de admissão.
- **Validar antes de declarar pronto:** linter Supabase em mudanças de DB; replay/console/network em UI; teste com paciente real do mock para PDFs (verificando leito ATUAL).
- **Pendências adiadas** viram entrada em `.lovable/plan.md` — nunca esquecer.

## Resposta final

Concisa, sem narração de tool calls. Se houver risco residual ou ponto que merece atenção do usuário, **destacar antes de fechar**.
