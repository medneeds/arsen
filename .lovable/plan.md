
## Objetivo

Quando, no momento de importar/cadastrar um paciente (incluindo importação da ficha PIS/PIN administrativa), o **nome ou outros campos** apresentarem indícios de paciente não identificado (NI), o sistema deve:

1. **Reconhecer automaticamente** que se trata de um NI.
2. **Sugerir** ativar o fluxo NI completo (gerar código `NI-AAAA-NNNNNN`, marcar `is_unidentified=true`, preservar PIS quando houver).
3. **Perguntar ao usuário** antes de prosseguir, de forma fluida, sem travar quem realmente quer cadastrar pelo nome.

## Gatilhos de detecção (heurística + IA)

### Camada 1 — Heurística instantânea (regex/normalize, zero latência)
Aplicada no `onBlur`/`onChange` do campo nome no `PatientRegistrationDialog` (e também em `AdmitPatientDialog` quando vier de `pre_admissions`):

Marcadores que disparam suspeita NI:
- `NÃO IDENTIFICADO`, `NAO IDENTIFICADO`, `N/I`, `N.I.`, `NI ` (com espaço), `SEM IDENTIFICAÇÃO`, `SEM ID`, `DESCONHECIDO(A)`, `IGNORADO(A)`
- `TIO`, `TIA` quando isolados ou em padrão típico (ex.: `TIO 1`, `TIA DA EMERGENCIA`)
- `JOÃO DOE`, `JANE DOE`, `JOHN DOE`, `FULANO`, `BELTRANO`, `SICRANO`
- `MASC. NI`, `FEM. NI`, `MASCULINO NI`, prefixo `PIS-`, `PIN-`, `NI-AAAA-...`
- Nome com ≤2 caracteres ou só números/hífens
- Nome com sinal de placeholder: `???`, `XXXX`, `------`, `A IDENTIFICAR`

Normalização NFD (já é padrão do projeto) para não falhar com acentos.

### Camada 2 — IA (Lovable AI) para casos ambíguos
Quando heurística não dispara mas há sinais (nome muito curto, só sobrenome, padrão atípico), chamar edge function `detect-unidentified-patient` com `google/gemini-3-flash-preview` retornando JSON estruturado:

```json
{ "isUnidentified": true|false, "confidence": 0.0-1.0, "reason": "...", "suggestedSex": "M"|"F"|null }
```

Só chama IA se: heurística não bateu E (nome ≤ 8 chars OU contém token suspeito não listado OU campo "modo de chegada" indica trauma/inconsciente). Debounce 500ms.

## Diálogo de confirmação (`UnidentifiedSuggestionDialog`)

Ao detectar (heurística ou IA com confidence ≥ 0.7), abrir popup ANTES de seguir o fluxo padrão:

```
[ícone alerta âmbar] Paciente possivelmente NÃO IDENTIFICADO

Detectamos indícios de que este pode ser um paciente não identificado:
  • Motivo: "{reason}"

Recomendamos ativar o fluxo NI:
  ✓ Gerar código institucional NI-2026-NNNNNN automaticamente
  ✓ Preservar dados úteis informados (sexo aparente, idade estimada, contato)
  ✓ Permitir promoção a identificado posteriormente sem perda de histórico

[Sim, ativar fluxo NI]   [Não, é um nome real]   [Cancelar]
```

- **Sim, ativar NI** → marca `is_unidentified=true`, gera código NI via RPC, preenche `unidentified_features` com o que já tinha (sexo aparente, faixa etária, modo de chegada), e continua o cadastro normalmente.
- **Não, é nome real** → segue cadastro normal e marca um flag de sessão `userOverroteNiSuggestion=true` para não perguntar de novo no mesmo formulário.
- **Cancelar** → fecha tudo, volta ao formulário sem alteração.

## Integração com importação de ficha PIS/PIN

No fluxo de importação (`PatientRegistrationDialog` quando recebe dados PIS, e em `AdmitPatientDialog` ao trazer `pre_admission`):

- Se o registro PIS/PIN já tem marcador NI no nome OU campo `is_unidentified` previamente setado, **pular o popup** e ativar o fluxo NI direto, exibindo apenas um toast informativo: "Ficha PIS reconhecida como NI — código NI-2026-XXXXXX gerado".
- Manter regra já memorizada: em modo `auto`, o número PIS vai para `unidentified_features.pis_medical_record` (auditoria) e o oficial é o número novo gerado; em modo `legacy`, PIS continua sendo o oficial.

## Mudanças por arquivo

### Novos
- `src/lib/unidentifiedDetector.ts` — função pura `detectUnidentified(name, extras?)` retornando `{ isUnidentified, confidence, reason, source: 'heuristic'|'ai' }`. Lista de tokens + regex centralizados aqui.
- `src/components/UnidentifiedSuggestionDialog.tsx` — diálogo reutilizável (props: `open`, `detection`, `onConfirm`, `onReject`, `onCancel`).
- `supabase/functions/detect-unidentified-patient/index.ts` — edge function só para casos ambíguos. Usa Lovable AI Gateway, modelo `google/gemini-3-flash-preview`, structured output, sem auth (verify_jwt=false não é necessário; mantém default).

### Editados
- `src/components/PatientRegistrationDialog.tsx`:
  - Hook `useEffect` no campo `name` (debounced 400ms) chama `detectUnidentified`.
  - Se detecta E usuário não rejeitou ainda nesta sessão E `is_unidentified` ainda não está true → abre `UnidentifiedSuggestionDialog`.
  - Confirmação ativa NI flow (gera código, marca flag).
  - Em fluxo de importação PIS, se já vier marcado NI, ativa direto sem popup.
- `src/components/AdmitPatientDialog.tsx`:
  - Mesma lógica ao receber `fullData.patient_name` da `pre_admission`. Se detectado, sugere NI antes de prosseguir.

## Detalhes técnicos

- Heurística é **case-insensitive**, normalizada NFD, e bate em **palavras inteiras** (`\b`) para evitar falso-positivo (`NIVALDO` não dispara `NI`).
- IA roda só quando heurística não bate E há sinal fraco. Custo controlado.
- Toda detecção é registrada em `console.debug` para auditoria de qualidade.
- Telemetria mínima: contar quantas vezes a sugestão foi aceita/recusada via tabela de auditoria existente (não cria tabela nova nesta etapa).
- A IA NUNCA decide sozinha — sempre passa pelo diálogo de confirmação. O usuário tem palavra final.

## Riscos & mitigação

- **Falso-positivo** (nome real curto disparando NI) → diálogo permite "Não, é nome real" e marca `userOverroteNiSuggestion` para o resto do formulário.
- **Falso-negativo** → usuário ainda pode marcar manualmente o checkbox "Paciente não identificado" existente (não removemos).
- **Latência IA** → só roda em background; nunca bloqueia digitação. Diálogo só aparece após debounce.

## Fora de escopo desta etapa

- Reescrita do flow de "promoção NI → identificado" (já existe).
- Mudanças no schema do banco.
- Treinamento/fine-tuning de modelo.
