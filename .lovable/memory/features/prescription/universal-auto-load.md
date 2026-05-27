---
name: Prescription Universal Auto-Load
description: Ao abrir paciente, prescrição auto-carrega rascunho do dia OU última validada do encounter como rascunho renovado (B1); novo encounter = zero; sem autosave
type: feature
---

PrescricaoPage auto-load em 2 etapas (mesmo paciente, mesmo encounter ativo):

1. **Rascunho do dia clínico atual** (05h SP→04h59 SP) existe? → carrega como está, `currentPrescriptionId` setado, continua editando.
2. **Senão**, busca **última validada/assinada** do mesmo encounter (qualquer data passada) → carrega como **rascunho renovado**:
   - cada item: novo `id`, `validated=false`, `validatedAt=undefined`, `status='active'`, sem suspensão
   - `digitalSignature=null`, `currentPrescriptionId=null` (próximo "Salvar" cria registro novo)
   - validada original **intocada** no histórico/calendário
   - toast: "Última prescrição validada (DD/MM às HH:mm) carregada como rascunho — revise e valide"

**Bloqueio anti-vazamento**: só auto-carrega quando `patientRegistryId` E `activeEncounterId` resolvidos (via `useResolvedRegistryId` + `useActiveEncounterId`). Sem encounter ativo OU novo atendimento pós-alta sem histórico → tela em branco.

**Sem autosave**: rascunho só persiste se médico clicar "Salvar Rascunho". Sair sem salvar perde o rascunho atual (mas próxima entrada cai na Etapa 2 → carrega última validada renovada).

Implementado em `src/pages/PrescricaoPage.tsx` (~linha 5957, useEffect `autoLoadAttemptedRef`).
