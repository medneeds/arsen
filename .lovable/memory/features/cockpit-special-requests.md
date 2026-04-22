---
name: cockpit-special-requests
description: Cockpit do paciente exibe Requisições Especiais (Hemocomponentes, SAT, APAC, Cultura) com sincronização realtime entre /requisicoes, /documentos e Cockpit
type: feature
---
- Hook `usePatientSpecialRequests(patientId, patientName, hospitalUnitId)` consolida `exam_requests` (categorias `hemocomponente`, `sat`, `apac`) + `culture_results` em uma única lista realtime.
- Subscreve canal único `patient-special-{hospital}-{id}` filtrando INSERT/UPDATE/DELETE por categoria e por paciente; refetch automático ao receber evento.
- `summary` retorna contadores por tipo (`hemocomponente`, `sat`, `apac`, `cultura`) + `pending` + `total`.
- `PatientCockpit` exibe um card "Requisições especiais" entre a Solicitação NIR e os Tabs, com chips por tipo, badge de pendentes e preview dos 3 últimos itens. Card só aparece se `summary.total > 0`.
- Click no card navega para `/requisicoes?especial=apac&patientId=…` mantendo o contexto do paciente.
- `HemocomponentRequestDialog`, `CultureRequestDialog` e `SatRequestDialog` recebem `patientId`, `patientName`, `patientBed` e `patientSector` para preencher imediatamente o formulário (mock + UUID real). `patient_id` é persistido com `asUuidOrNull()` para evitar erros de FK em mocks; `patient_name`/`bed`/`sector` sempre vão para o payload de `exam_requests`/`culture_results`.
- Resultado: ao clicar em "Salvar no Cockpit" ou "Salvar e Imprimir" em qualquer um dos diálogos especiais (Hemo, Cultura, SAT, APAC), a solicitação aparece automaticamente no Cockpit do paciente aberto, em /requisicoes (Especiais) e em /documentos via realtime, mesmo para pacientes mock.
