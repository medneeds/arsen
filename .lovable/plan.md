# Otimização do campo de prescrição de inalatórios

## Problema
Hoje o campo expandido de itens da categoria **Inalatórios** reaproveita os mesmos campos das medicações endovenosas (volume total, diluente, velocidade de infusão em mL/h, BIC/gotejamento). Isso é clinicamente incorreto: na inalação não existe "velocidade de infusão" — o que importa é **dose da droga, diluente, fluxo de O2/Ar e o esquema de etapas**. Além disso, sprays (pMDI) e pó seco (DPI) têm campos completamente diferentes (puffs, espaçador, técnica).

## Escopo

### 1. Detecção da modalidade (4 modos)
Cada item de Inalatórios passa a ter um seletor segmentado **`inhalationMode`** no topo do painel expandido:

- **Nebulização** (jato/ultrassônica) — padrão
- **Nebulização contínua** (crise grave de asma)
- **Spray pressurizado (pMDI)** — puffs
- **Pó seco (DPI)** — inalações/cápsulas

Ao trocar a modalidade, os campos abaixo se adaptam automaticamente.

### 2. Campos por modalidade

**Nebulização (jato/ultrassônica):**
```
[Dose] [Unidade: mg | gts | mL]   [Diluente: SF 0,9% | Água destilada | SF 3%]   [Volume diluente: mL]
[Fluxo O2/Ar: L/min] (padrão 6-8)   [Interface: máscara | traqueostomia | peça T | circuito VM]
[Tempo por etapa: min] (padrão 10)   [Frequência: 6/6h, 8/8h, 12/12h, SOS]
```

**Nebulização contínua:**
```
[Dose por hora]   [Diluente + volume]   [Fluxo O2/Ar]
[Duração total: h]   [Interface]
```

**Spray pressurizado (pMDI):**
```
[Nº de puffs/jatos]   [Frequência]
[☐ Com espaçador]   [☐ Gargarejar após (corticoide)]
```

**Pó seco (DPI):**
```
[Nº de inalações/cápsulas]   [Frequência]
[Orientação livre]
```

### 3. Catálogo padrão com autofill
Novo arquivo `src/data/inhalationCatalog.ts` com drogas mais usadas e seus presets (dose / diluente / fluxo / espaçador):

| Droga | Modo padrão | Dose padrão | Diluente | Fluxo |
|---|---|---|---|---|
| Berotec (fenoterol) | Nebulização | 10 gts | SF 0,9% 3 mL | 6 L/min |
| Atrovent (ipratrópio) | Nebulização | 20 gts | SF 0,9% 3 mL | 6 L/min |
| Berotec + Atrovent | Nebulização | 10+20 gts | SF 0,9% 3 mL | 6 L/min |
| Salbutamol nebulização | Nebulização | 2,5 mg (10 gts) | SF 0,9% 3 mL | 6 L/min |
| Budesonida nebulização | Nebulização | 0,5 mg (1 amp) | SF 0,9% 3 mL | 6 L/min |
| Adrenalina nebulizada | Nebulização | 5 mg (5 mL) | puro | 6 L/min |
| NaCl 3% (hipertônico) | Nebulização | 4 mL | puro | 6 L/min |
| N-acetilcisteína | Nebulização | 300 mg | SF 0,9% 3 mL | 6 L/min |
| Salbutamol spray | pMDI | 2 puffs | — | espaçador ON |
| Beclometasona spray | pMDI | 2 puffs | — | espaçador ON, gargarejar ON |
| Formoterol DPI | DPI | 1 inalação | — | — |
| Tiotrópio DPI | DPI | 1 cápsula | — | — |

Ao escolher a droga via combobox de prescrição, o sistema:
- Define `inhalationMode` automaticamente
- Preenche dose, diluente, fluxo, espaçador
- Médico pode editar tudo livremente

### 4. Geração da instrução clínica (impressão e cockpit)
Substituir `assembleInstructionFromFields` para itens de inalação por uma função dedicada `assembleInhalationInstruction(item)` que monta linha humana:

- Nebulização: `"Berotec 10gts + Atrovent 20gts diluído em SF 0,9% 3mL — nebulizar com fluxo de O2 6 L/min por 10 min, 6/6h via máscara facial."`
- pMDI com espaçador: `"Beclometasona spray — 2 puffs com espaçador, 12/12h. Gargarejar após uso."`
- DPI: `"Tiotrópio DPI — 1 cápsula inalada 1x/dia (manhã)."`
- Contínua: `"Salbutamol nebulização contínua 7,5 mg/h + SF 0,9% — fluxo O2 8 L/min, máscara, por 4 horas."`

### 5. Validação clínica (sem regressão)
- O bloco de checagem de alergias (`clinicalAlertChecks`) já trata cada droga isoladamente — continua funcionando para inalatórios (salbutamol, fenoterol, ipratrópio, etc).
- Adicionar interações específicas se já existirem no detector (mantido — não é foco desta sprint).

## Implementação técnica
- **Tipo**: estender `PrescriptionItem` em `PrescricaoPage.tsx` com campos opcionais: `inhalationMode`, `nebDose`, `nebDoseUnit`, `oxygenFlow`, `stageDuration`, `stagesPerDay` (frequência reaproveita `posology`), `inhalationInterface`, `puffs`, `spacer`, `gargle`, `inhalationOrientation`.
- **Componente novo**: `InhalationExpandedFields` em arquivo separado para manter `PrescricaoPage.tsx` enxuto.
- **Roteamento de render**: no painel expandido (linha 1635+), quando `item.category === 'inhalation'`, renderizar `<InhalationExpandedFields>` **em vez** dos campos de infusão IV.
- **Catálogo**: `src/data/inhalationCatalog.ts` exportando lista + helper `getInhalationDefaults(name)`. Engatado no `addItem`/autofill quando categoria detectada = `inhalation`.
- **Helper de string**: `src/lib/inhalationInstruction.ts` com `assembleInhalationInstruction(item)`.
- **Persistência**: campos novos viajam dentro do JSONB existente (`prescriptions.payload`) — sem migration.
- **Impressão**: o builder de PDF usa a string gerada por `assembleInhalationInstruction` quando `category === 'inhalation'`.

## O que **não** muda
- Categorias não-inalatórias seguem com os mesmos campos atuais (zero regressão em IV/hidratação).
- Sem alteração de schema do banco.
- Layout geral da página de prescrição preservado.

## Confirmação solicitada
Confirma este escopo? Em particular:
1. Os 4 modos (Nebulização / Contínua / pMDI / DPI) cobrem o que você precisa?
2. A lista do catálogo inicial cobre o essencial — devo incluir mais alguma droga (lidocaína nebulizada, DNase, colistina inalada, tobramicina inalada, iloprost)?
3. O esquema de impressão proposto está adequado para o farmacêutico e o enfermeiro executarem?