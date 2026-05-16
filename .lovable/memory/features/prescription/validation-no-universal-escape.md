---
name: validation-no-universal-escape
description: Escape universal por "observações/instrução livre" removido nas categorias estruturadas; checklist vermelho no topo da expansão sinaliza missings
type: feature
---

`getItemMissingFields` em `PrescricaoPage.tsx` deixou de aceitar `anyInstruction(item)` como atalho universal nas categorias: **inalação, hidratação, nutrição, hemoterapia, IV intermitente, IV contínua**.

Médico não consegue mais "virar verde" digitando só em observações nesses cenários — precisa preencher os campos estruturados (volume, posologia, tempo/vazão, interface, etc.).

**Mantido escape** (instrução livre ainda zera missings): cuidados, não-padronizado, tópicos, retais, núcleo padrão (dose/posologia/via de medicação não-IV/não-sólido-oral). Sólido oral por VO/SL/enteral continua exigindo posologia sem escape (regra anterior).

**UI:** `SortablePrescriptionItemRow` mostra banner vermelho ("Pendente para validação — preencha: …") no topo do bloco expandido + ring vermelho ao redor do container quando `missingFields.length > 0` e item não está bloqueado. Bolinha vermelha pulsante (ValidationDot) mantida.
