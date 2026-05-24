
# Plano — Nomenclatura unificada, bloqueios didáticos e correção do leito 4

## Princípio central
**Painel Clínico = SINALIZA. Mapa de Leitos = DESALOCA.**  
Toda movimentação clínica (alta, óbito, transferência interna/externa) é **sinalizada** no Painel Clínico. O Mapa de Leitos apenas **executa a desalocação física** do leito a partir da sinalização. Se não houver sinalização, o Mapa abre pop-up didático ensinando o caminho.

---

## CAMADA 1 — Mapa de Leitos: menu enxuto e didático

**Arquivos:** `src/components/PatientCard.tsx`, `src/components/UtiPatientCard.tsx`

Hoje o menu tem **3 opções confusas** ("Transferir agora", "Sinalizar pré-admissão p/ outro setor", "Liberar leito"). Vou consolidar em **2 opções claras**:

| Nova opção | O que faz |
|---|---|
| **Desalocar leito** | Libera o leito mantendo prontuário. Só prossegue se houver sinalização. Sem sinalização → pop-up didático. |
| **Desalocar e pré-sinalizar p/ outro setor** | Libera + cria pré-admissão no destino, mesmo atendimento (fluxo atual de `signalTransferOpen`). |

A opção "Transferir agora (direto)" some do menu — ela é, na prática, uma sinalização de transferência interna, e o caminho correto é Painel Clínico → tarja → desalocar. Mantemos `UtiReallocationDialog` apenas para o **NIR** (autonomia operacional).

Texto rodapé do menu mantém: *"Sinalizações de alta, óbito e transferências são feitas pelo Painel Clínico (Cockpit)."*

---

## CAMADA 2 — Bloqueio didático ao desalocar sem sinalização

**Arquivo:** `src/components/BedReleasePreAdmissionDialog.tsx` (já existe o pop-up didático para `isExceptional`)

- Reaproveitar o pop-up atual (Stage 1 "Pare — paciente não sinalizado") como **único caminho** quando o usuário clica em "Desalocar leito" sem tarja.
- A "Desalocar e pré-sinalizar" também precisa **bloquear** se o paciente tem desfecho pendente (alta/óbito sinalizados) — não faz sentido pré-sinalizar transferência sobre alta.
- Estados que **liberam desalocação direta** (sem pop-up):
  - `transferencia_interna_pendente`, `transferencia_externa_pendente`, `alta_dada`, `obito`, `pre_admitido`, `suspenso`.
- Estado `admitido` puro → sempre pop-up didático com botão "Ir ao Painel Clínico".

---

## CAMADA 3 — Painel Clínico: nomenclatura "Sinalizar"

**Arquivo:** `src/components/PatientMovementDialog.tsx`

Renomear o título do diálogo e o botão de confirmação conforme o subtipo escolhido:

| Subtipo | Título do diálogo | Botão final |
|---|---|---|
| ALTA_MEDICA / ALTA_* | "Sinalizar alta hospitalar" | "Confirmar sinalização de alta" |
| OBITO | "Sinalizar óbito" | "Confirmar sinalização de óbito" |
| TRANSFERENCIA_INTERNA | "Sinalizar transferência interna" | "Confirmar sinalização de transferência" |
| TRANSFERENCIA_EXTERNA | "Sinalizar transferência externa" | "Confirmar sinalização de transferência" |
| (demais) | mantém atual | "Confirmar sinalização" |

Subtítulo explicativo no header: *"Esta ação sinaliza o desfecho no prontuário. A desalocação física do leito é feita no Mapa de Leitos."*

---

## CAMADA 4 — Cockpit: estado "sinalizado" visível e editável

**Arquivo:** `src/components/PatientCockpit.tsx` (banner de status já existe parcialmente)

Adicionar **banner persistente no topo do cockpit** quando há sinalização ativa:

- **Alta sinalizada:** chip verde "ALTA SINALIZADA em DD/MM HH:MM por Dr(a). X" + 2 botões → *Imprimir sumário de alta* | *Editar/cancelar sinalização*.
- **Óbito sinalizado:** chip cinza-escuro "ÓBITO SINALIZADO …" + *Imprimir declaração* | *Editar*.
- **Transferência interna/externa pendente:** chip azul "TRANSF. INT/EXT SINALIZADA → Destino: <setor>" + *Editar destino* | *Cancelar sinalização*.

Botão "Editar" reabre `PatientMovementDialog` no subtipo correspondente para revisão; "Cancelar sinalização" usa pop-up de confirmação com motivo (já existe `suspend_discharge_document` para alta — reaproveitar para os demais via update `admission_status='admitido'` + audit).

---

## CAMADA 5 — Bug do leito 4 (TRANSF. INT sinalizada não desaloca)

Reproduzir e revisar o caminho:
1. Card mostra tarja TRANSF. INT (correto — `transferencia_interna_pendente`).
2. Usuário clica "Desalocar leito" no menu.
3. Hoje `BedReleasePreAdmissionDialog` entra no branch `isExceptional` (porque `admissionStatus !== 'admitido'` mas também não está em whitelist de desfecho).

**Causa provável:** o branch `isPostDischarge` cobre apenas `alta_dada | obito`, não cobre `transferencia_interna_pendente | transferencia_externa_pendente`. Resultado: cai no branch `isExceptional` e bloqueia.

**Correção:** estender o branch "pós-sinalização" para incluir os dois status de transferência pendente. Nesses casos o diálogo segue direto para Stage 2 (form + senha) com motivo pré-preenchido "Desalocação pós-sinalização de transferência interna/externa".

---

## Resumo de arquivos tocados

| Arquivo | O quê |
|---|---|
| `PatientCard.tsx` | Menu enxuto: 2 opções |
| `UtiPatientCard.tsx` | Menu enxuto: 2 opções |
| `BedReleasePreAdmissionDialog.tsx` | Reconhecer `transferencia_*_pendente` como pós-sinalização (fix bug leito 4) |
| `PatientMovementDialog.tsx` | Título + botão "Sinalizar/Confirmar sinalização" por subtipo |
| `PatientCockpit.tsx` | Banner persistente de sinalização ativa com ações (imprimir/editar/cancelar) |

## NÃO será tocado
- Schema do banco, RPCs (`archive_patient_bed_data`, `repoint_patient_history`, `suspend_discharge_document`), triggers
- `usePatients.releaseBedPreAdmission`, `bedLifecycle.ts`, `internalTransfer.ts`
- Fluxo do NIR e `UtiReallocationDialog`
- Lógica de impressão de sumário de alta/óbito (apenas o botão de atalho)
- Edge functions, RLS, auth

---

**Aguardo "ok" para aplicar.**
