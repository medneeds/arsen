---
name: prescription-validation-fluid-rules
description: Regras adaptativas de getItemMissingFields que aceitam campos equivalentes para evitar falsos bloqueios em comprimidos enterais, IV intermitente, BIC e controlados de baixa restrição
type: feature
---

Refinamentos em `getItemMissingFields` para fluidez clínica:

- **IV intermitente**: volume aceita `diluentVolume` OU `volumeTotal` (ambos campos são equivalentes na UI).
- **IV contínua (BIC)**: volume total aceita `volumeTotal` OU `diluentVolume`. Posologia continua sendo removida do missing (vazão define).
- **Comprimido por sonda enteral**: `isEnteralRoute` agora usa word-boundaries (`\bsng\b|\bsne\b|enteral|gastrostomia|jejunostomia`) — não dispara mais para "Oral" ou "gotas". Volume de diluição aceita `enteralDilutionVolume` OU `diluentVolume` OU `volumeTotal` OU instrução textual.
- **Controlado Port. 344**: notification_type só é exigido para listas de **alta restrição** (A1/A2/A3/B1/B2). Listas C (anticonvulsivantes de uso comum, etc.) não bloqueiam validação — o badge regulatório continua sendo exibido mas o item não fica vermelho.

Filosofia: o validador deve refletir o que o médico já preencheu no formulário, sem exigir que o mesmo dado seja repetido em campos diferentes.
