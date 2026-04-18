---
name: clinical-modules-cockpit-rail
description: Todos os módulos clínicos do paciente (Evolução, Prescrição, Requisições, Documentos, Movimentações) usam PatientCockpit como sidebar direita realtime
type: feature
---
- Hook `useCockpitPatient()` lê searchParams (`patientId`, `patientName`/`patient`, `patientBed`/`bed`, `patientSector`), combina com `usePatientLive` (realtime) e `usePatientCid` (CIDs persistidos) e devolve um `Patient` pronto para `<PatientCockpit />`.
- Layout padrão: `<div className="flex"> <main className="flex-1 min-w-0 …">…</main> <PatientCockpit patient={cockpitPatient} /> </div>`. Páginas: EvolucaoPage, PrescricaoPage, RequisicaoUnificadaPage, DocumentosPacientePage, MovimentacoesPage.
- MovimentacoesPage usa `usePatientMovements` (realtime) tanto para a lista principal quanto para alimentar a aba "Trajeto" do Cockpit, garantindo sincronização instantânea entre as duas visualizações da mesma fonte (`patient_movements`).
- `print:hidden` no Cockpit; em impressão o layout volta para fluxo único.
