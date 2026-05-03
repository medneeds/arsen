---
name: SLA Badge System
description: Componente SlaBadge reutilizável para indicar tempo decorrido com cores (verde/amarelo/laranja/vermelho) usado em filas de triagem e fluxos críticos. Limiar default 60/120/180min.
type: feature
---
- Componente: `src/components/sla/SlaBadge.tsx`
- Props: `startAt`, `endAt` (opcional, indica conclusão), `thresholds` [yellow,orange,red] em minutos, `label`, `compact`.
- Auto-atualiza a cada 30s enquanto não houver `endAt`.
- Uso atual:
  - Recepção (ReceptionDailyDashboard): chegada → chamada de triagem com limiares 15/30/60min.
- Próximas integrações previstas:
  - Triagem → 1º atendimento médico (60/120/180min)
  - Pedido de leito (NIR) → alocação efetiva
  - Painel TV (contador agregado)
- Ler regras finais de SLA do bloco D-7 antes de parametrizar por classificação Manchester.
