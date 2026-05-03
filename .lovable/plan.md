## Objetivo

Eliminar a barra flutuante inferior da Prescrição (Nova / Extra / Interações / Guia ATM / Psicotrópicos / TEV / Imprimir / Validar / Compacto·Expandido) e reposicioná-la no topo da página, acoplada ao cabeçalho "Prescrição médica diária", logo abaixo da linha de Peso · Alergias · Calendário · Dose/kg · Templates. O resultado deve ser limpo, denso e sem poluição visual.

## Onde está hoje

Arquivo: `src/pages/PrescricaoPage.tsx`

- Cabeçalho atual (linhas ~3784–3937): título "Prescrição médica diária" + linha única lotada com Peso, Alergias, Calendário, Dose/kg, Templates, Atalhos, Atualizar.
- Toolbar inferior (linhas ~4009–4130): renderizada via `createPortal` em `position: fixed; bottom: 0`. Contém Nova, Extra, Interações, Guia ATM, Psicotrópicos, TEV, Imprimir, Validar prescrição, badge de "Sessão validada", e Compacto/Expandido. Hoje colide com o conteúdo e com pop-ups (Cuidados, Guia ATM, etc.).

## Nova arquitetura do cabeçalho (2 linhas)

Reorganizar o bloco do topo em um card único, com 2 fileiras bem separadas. O `createPortal` da toolbar inferior é removido.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  💊  Prescrição médica diária   [Salva] #ATD  03/05/2026                    │  ← Linha 0 (título + meta)
│                                                                             │
│  Peso [72]  ⚠ Alergias [NDAM]   │  📅 Calendário(3)   🧮 Dose/kg   ⚡Templates(5)  │ ⌨ ?  ⟳ │  ← Linha 1 (contexto clínico)
│  ─────────────────────────────────────────────────────────────────────────  │
│  + Nova   💉 Extra   ⚡ Interações   🛡 Guia ATM   📄 Psicotrópicos   💧 TEV  │  🖨 Imprimir   ✅ Validar prescrição  · 12min  │  ⇕ Compacto │  ← Linha 2 (ações da prescrição)
└─────────────────────────────────────────────────────────────────────────────┘
```

Diretrizes visuais:

- Linha 1 = "contexto do paciente / da prescrição" (dados de entrada e navegação por data/templates).
- Linha 2 = "ações sobre a prescrição" (compor, validar, imprimir, modo de visualização).
- Separador horizontal sutil (`border-t border-border/40`) entre as duas linhas para diferenciar os papéis.
- Agrupamentos internos com `<span className="h-5 w-px bg-border/60" />` já usado no projeto:
  - Linha 2: `[Nova · Extra]` | `[Interações · Guia ATM · Psicotrópicos · TEV]` | `[Imprimir · Validar (+badge sessão)]` | `[Compacto/Expandido]`.
- Em telas estreitas (viewport < ~900px) a Linha 2 quebra por grupo (`flex-wrap`), mantendo cada cluster junto. Sem scroll horizontal.
- Botão primário continua sendo "Validar prescrição" (verde) quando há pendências; demais ficam `variant="ghost"` h-7 text-[10px], idênticos ao estilo atual da toolbar inferior, para manter densidade.
- Atalhos (`?`) e Atualizar passam para o canto direito da Linha 1 (já estão lá).

## Mudanças no código

`src/pages/PrescricaoPage.tsx`:

1. Linhas ~3784–3937 (cabeçalho atual): converter em um card `rounded-xl border border-border bg-card/60 px-3 py-2.5 space-y-2` contendo:
   - Sub-bloco "title row" (título + badges + meta) inalterado.
   - Sub-bloco "context row" (Peso, Alergias, alerta, Calendário, Dose/kg, Templates, Atalhos, Atualizar) — manter exatamente os mesmos componentes.
   - Sub-bloco novo "actions row" — mover para cá o conteúdo do Portal.
2. Linhas ~4009–4130 (Portal `data-prescription-toolbar`): remover por completo, incluindo o `createPortal` e a dependência visual com `sidebarCollapsed`/`sidebarIsMobile` que só servia para o posicionamento fixo. As variáveis e `useSidebar` permanecem somente se ainda forem usadas em outros pontos (verificar com `rg`); se não, remover o import para evitar dead code.
3. Manter intactos: handlers (`handleNewPrescription`, `setExtraPrescriptionOpen`, `setInteractionDialogOpen`, `setAntimicrobialGuideOpen`, `setPsychotropicFormOpen`, `setTevProtocolOpen`, `handlePrint`, `requestValidateAll`, `setCompactView`) e regras de habilitação (`canPrescribe`, `allItemsValidated`, `prescriptionLocked`, `isValidationSessionActive`, `sessionMinutesLeft`).
4. Ajuste de padding inferior do conteúdo: hoje a página reserva espaço para a toolbar fixa (`pb-*` ou spacer logo antes dos Dialogs, comentário na linha 4008). Remover o spacer/padding extra para o conteúdo encostar no rodapé natural — ganhamos altura útil no workbench.
5. Diálogos afetados (Cuidados, Guia ATM, Extra, etc.) deixam de precisar lidar com a sobreposição da toolbar inferior; as larguras/alturas atuais permanecem.

## Acessibilidade e responsividade

- Tab order: título → Peso → Alergias → Calendário → Dose/kg → Templates → Atalhos → Atualizar → Nova → Extra → Interações → Guia ATM → Psicotrópicos → TEV → Imprimir → Validar → Compacto.
- Tooltips existentes preservados (Atalhos, badge "Sessão validada", botão Compacto/Expandido).
- Em viewports ≤ 833px (atual do usuário): a Linha 2 quebra em 2 fileiras de chips, mantendo agrupamentos.

## Critérios de aceite

- A barra inferior desaparece da tela (sem `position: fixed` da prescrição).
- Todos os botões e estados (validado, sessão ativa, compacto, etc.) continuam funcionando com o mesmo comportamento.
- Pop-ups (Cuidados, Guia ATM, Extra, TEV, Psicotrópicos) não sofrem mais sobreposição com a barra de ações.
- Cabeçalho ocupa ~2 linhas de chips abaixo do título; sem scroll horizontal em 833px.
- Workbench da prescrição ganha o espaço vertical antes ocupado pela barra fixa.
