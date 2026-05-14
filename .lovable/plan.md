## Diagnóstico

Hoje há duas frases automáticas no bloco ATB e ambas têm problemas distintos:

### 1. Faixa laranja (D{n}/total · sítio)
Gerada por `buildAtbDayLine(item)` a partir de `atbStartDate`, `atbPlannedDays`, `atbInfectionSite`.
Esses três campos **só existem no `AntimicrobialGuideDialog`** (linhas 4201-4203). Não há UI inline na linha do item para editá-los depois — então qualquer "atualização nos campos detalhados" não tem como propagar.

### 2. Frase de preparo (cinza, italic)
Gerada por `buildPrepDescription(item)` a partir de dose/diluente/volume/tempo/via/posologia. Essa **já é reativa** (recalculada a cada render, e `updateItem` cria nova referência do item).

O que parece "fora de sincronia" é o **input "Observações adicionais"** (linha 2247-2252) que está vinculado a `item.instructions`. Quando o ATB é incluído via catálogo (Ceftriaxona, Meropenem, Vancomicina…), `instructions` já vem **pré-preenchido com uma frase sintetizada** (ex.: `"Reconstituir em 10ml AD, diluir em 100ml SF 0,9%, infundir em 30 min"`). Aí o usuário edita Diluente/Volume/Tempo nos campos estruturados → a frase de preparo (cinza) atualiza, mas o input de baixo continua mostrando o texto antigo do catálogo. Visualmente parecem duas frases divergentes.

## Plano

### A) Header inline editável (estrutural — afeta layout)

Substitui a faixa laranja redundante por um header tipo Inalação no topo do container indigo:

```text
┌─ [💊] Antimicrobiano ────────────────── [D3/7 — 14/05] ─ [Aplicar Guia ATM] ─┐
│  Início: [14/05/2026] · Duração: [7] dias · Sítio: [pneumonia comunitária]   │
├──────────────────────────────────────────────────────────────────────────────┤
│  Qtd · Forma · Diluente · Vol · Via · Int · ...   (linhas atuais inalteradas)│
└──────────────────────────────────────────────────────────────────────────────┘
```

- 3 inputs inline editáveis: Início (date), Duração (numeric + "dias"), Sítio (text livre curto).
- Badge `D{n}/{total} — DD/MM` à direita (mantém destaque âmbar/laranja em pill, não em faixa).
- Botão "Aplicar Guia ATM" abre o `AntimicrobialGuideDialog` existente.
- **Remover** a faixa laranja antiga (linhas 2238-2245) — vira o badge no header.
- Grid principal (Qtd/Forma/Diluente/Vol/Via/Int/dose/posologia/tempo) **inalterado**.

### B) Frase de preparo única (não estrutural)

- Em `handleAntimicrobialConfirm` (linha 4178), ao criar item via `createItem(matchedMed)`, **forçar `instructions: ''`** para items ATB. A frase pronta do catálogo deixa de poluir o input "Observações adicionais".
- A frase oficial fica só na linha cinza italic (`buildPrepDescription`), derivada dos campos estruturados — fonte única da verdade.
- O input "Observações adicionais" passa a servir só ao que o nome diz: anotações manuais (ex.: "monitorar vancocinemia vale", "ajustar pelo Cl Cr").

## Arquivos

- `src/pages/PrescricaoPage.tsx` — adicionar header inline ATB no início do container (~linha 1949), remover faixa laranja antiga (2238-2245), limpar `instructions` em `handleAntimicrobialConfirm` (4185).

## O que NÃO muda

- Nenhuma lógica de cálculo de dia, posologia ou diluição.
- Comportamento e dados do `AntimicrobialGuideDialog`.
- Catálogo `UNIFIED_CATALOG.antimicrobial`.
- Layout dos demais blocos (hidratação, inalação, alto alerta, etc.).

Confirma para eu implementar?