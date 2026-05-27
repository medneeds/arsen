---
name: requisicao-patient-context-persist
description: RequisicaoUnificadaPage preserva paciente selecionado após submit; resetForm dividido em resetRequestFields (preserva paciente) e resetForm (limpa tudo, usado só pelo botão "Limpar")
type: feature
---
- Bug: `handleSubmitRequest` chamava `resetForm()` após sucesso, que zerava `formPatientId/Name/Bed/Sector`. Identificação sumia em Hemo/SAT/Cultura/APAC/Parecer/comum até refresh.
- Fix em `src/pages/RequisicaoUnificadaPage.tsx`:
  - `resetRequestFields()` — limpa só prioridade, data, indicação, notas, items, custom, justificativa, combo expandido. NÃO toca paciente.
  - `resetForm()` — limpa paciente + chama `resetRequestFields()`. Usado pelo botão "Limpar" explícito.
  - `handleSubmitRequest` (linha 466) agora chama `resetRequestFields()` — paciente persiste para encadear novas solicitações.
- Não toca: persistência, diálogos especiais (já recebem formPatientId/Name corretamente), fetchRequests, navegação.
