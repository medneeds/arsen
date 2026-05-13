---
name: prescription-validation-blocking-and-port344-print
description: Validation blocking with red status (3 colors yellow/green/red), missing required fields detection, and Portaria 344 print-only mode with auto CID + 24h quantity calculation
type: feature
---

# Validação bloqueante (3 estados) + Receituário 344 print-only

## Status do item — 3 cores
- 🟡 Amarelo = pendente de validação
- 🟢 Verde (emerald) = validado dentro da janela 05h
- 🔴 Vermelho (animate-pulse) = **bloqueado** — campos obrigatórios faltando, validação não permitida

`PrescricaoPage > PrescriptionItemCard > ValidationDot` recebe prop `missingFields: string[]`. Tooltip lista os campos faltando.

## Helper `getItemMissingFields(item)`
- Para categorias **standard** (não nutrition/care/nonstandard/hydration): exige `dose`, `route` (via), `posology`
- Para itens **controlled** do catálogo (`findControlledByName`): exige `notification_type` resolvido
- Retorna array de strings com nomes amigáveis (`'dose'`, `'via'`, `'posologia'`, `'tipo de notificação'`)

`itemMissingMap: Map<id, string[]>` recomputado quando `items` muda. `blockedValidationItems` é a lista derivada.

## Bloqueio em `requestValidateAll` / `requestValidateItem`
- Ambos checam `itemMissingMap` antes do fluxo de alertas/senha
- Toast de erro lista até 4 itens com seus campos faltando
- Validação individual e em bloco rejeita imediatamente sem abrir dialog

## PsychotropicFormDialog — modo `print_direct`
Quando `mode='print_direct'`, o dialog vira **somente-leitura**:
- Sem combobox, sem "Adicionar Medicação", sem trash, sem inputs editáveis
- Apenas `<ReadOnlyPreview />` agrupando entries por tipo de receita + botões "Imprimir Receituário" e "Fechar"
- Campos auto-preenchidos:
  - **CID-10** ← `cidPrimary` prop (vem de `usePatientCid` da admissão)
  - **Quantidade 24h** ← `calc24hQuantity(dose, posology)`:
    - Posologia SOS/se necessário → `qty='1'`, label `'um (mínimo, SOS)'`
    - `N/Nh` → `freq=24/N` × dose numérica × unidade extraída
    - `Nx/dia` → `freq=N`
  - **Duração** ← fixo `'24h'`
  - **Indicação clínica** ← omitida (CID já justifica)
- Modo `edit` (legado, abertura manual) preserva todo o formulário antigo

## Print layout — Norma Zero + Portaria 344
`PrintablePsychotropicForm` agora inclui:
- Header institucional Norma Zero (PREFEITURA → SECRETARIA → HOSPITAL + faixa cruz 5 cores)
- Doc-bar: `PORT344-YYYYMMDD-HHmm` · setor · emissão
- Faixa colorida do tipo de receita (Receita Amarela/Azul/Controle Especial)
- Tabelas por entry: Emitente · Paciente · Medicamento (sem linha de "Indicação Clínica" nem "Duração")
- Linha "Quantidade (24h)" + "Validade: 24 horas"
- Rodapé MAN.05-001 v05 + LGPD/CFM + docCode

## Fluxo de impressão
`executePrintSelection` em PrescricaoPage abre o dialog em `print_direct` após `afterprint` da prescrição principal. O médico clica "Imprimir Receituário" → `window.print()` dispara o portal `data-psychotropic-print`.
