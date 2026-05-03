---
name: bed-allocation-medical-autonomy
description: Médico pode aprovar a própria solicitação de leito direto pelo PatientCockpit, sem aguardar NIR
type: feature
---

Na Zona 3.9 do PatientCockpit (Solicitação NIR), quando o status é `pending`:

1. **Tracking de tempo** — Badge colorido mostra minutos aguardando, com tons:
   - 0-60min verde · 60-120min amarelo · 120-180min âmbar · >180min vermelho
   - Atualiza a cada 60s via `setInterval`.

2. **Autonomia médica** — Botão "Aprovar e alocar leito" chama `useBedAllocationRequests().approveRequest(id)`. Esse hook:
   - Marca request como `approved`
   - Calcula próximo leito disponível no setor de destino (`getNextBedNumber`)
   - Move o paciente (`patients.update`) com novo `sector`/`bed_number`/`display_order`, removendo `is_door_patient`
   - Realtime propaga para NIR e Gestor

NIR continua como observador — pode aprovar, rejeitar ou colocar em discussão. A primeira ação vence (médico ou NIR).

Futuro: a alta administrativa pela enfermagem com ciência do NIR seguirá padrão similar (autonomia operacional paralela).
