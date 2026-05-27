---
name: enteral-tablet-technique
description: NotCrushableEntry com campo `technique` opcional para medicamentos que NÃO podem ser triturados mas têm técnica alternativa viável via sonda (omeprazol/lansoprazol microgrânulos, nimodipino cápsula líquida); painel âmbar (não vermelho), libera "Aplicar técnica à instrução" e desbloqueia validação
type: feature
---
- `NotCrushableEntry.technique?: { label, vehicle, instructionTemplate }` em `src/data/notCrushableMedications.ts`.
- Marcados com técnica: **omeprazol** (abrir cápsula, dispersar microgrânulos em suco de laranja/maçã), **lansoprazol** (idem), **nimodipino cap** (aspirar conteúdo líquido com seringa).
- `CompoundedTabletFields`: `hardBlock = block && !block.technique` mantém painel vermelho bloqueante (XR/SR/entérico clássico, voriconazol, isotretinoína, metotrexato, etc.). `hasTechnique` mostra painel ÂMBAR com:
  - cabeçalho "NÃO TRITURAR — usar técnica específica"
  - bloco didático com técnica + motivo + alternativa IV
  - inputs (veículo/volume, lavagem pré/pós)
  - botão "Aplicar técnica à instrução" → grava `instructions` usando `instructionTemplate` com placeholders `{volume}`, `{preLav}`, `{posLav}`
- Após aplicar, `getItemMissingFields` em PrescricaoPage (linhas 4350-4368) aceita `anyInstruction(item)` e libera assinatura/validação.
- Itens SEM `technique` no NOT_CRUSHABLE continuam com bloqueio vermelho atual — comportamento inalterado.
