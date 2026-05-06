---
name: Coordenador profiles (read-only clinical)
description: 3 perfis coord_medico/coord_enfermagem/coord_multi com role 'coordenador', acesso por unidade hospitalar inteira (sem setores), somente leitura clínica + validação de round/liberação de leito
type: feature
---

**Perfis** (`AccessProfile`): `coord_medico`, `coord_enfermagem`, `coord_multi`.
**Role enum** (`app_role`): `coordenador` (novo valor).

**Escopo**: por unidade hospitalar inteira via `user_hospital_assignments`. NUNCA recebem `user_departments` — bloqueado por trigger `validate_user_department_assignment` (que agora considera coordenadores como "globais" via `is_global_profile`). Trigger `sync_coordenador_clears_departments_trg` limpa setores se um usuário vira coordenador.

**Defaults** (`PROFILE_DEFAULTS`): role=`coordenador`, departments=[], landingRoute=`/mapa`.

**UI gating**: hook `useIsClinicalReadOnly()` / `useIsCoordenador()` em `src/hooks/useIsCoordenador.ts` lê `profiles.access_profile` + `access_profiles[]`. Usar para desabilitar botões de edição em prescrição, evolução, marcadores, status clínico, cockpit. Ações permitidas (UI + RLS futura): liberar leito (`bed_census`), validar round (`round_sessions`), aprovar fluxos (`pre_admissions`).

**Edge function** `admin-create-user`: `GLOBAL_PROFILES` inclui os 3 coord_*; ao selecioná-los, o form esconde `SectorPermissionsPicker` e envia `departments=[]`.

**Helpers SQL**: `is_coordenador(uuid)`, `is_global_profile()` atualizado para reconhecer os 3 perfis.

**Pendente**: políticas RLS específicas de bloqueio de escrita em tabelas clínicas para role=coordenador (atualmente o gating é só na UI via hook).
