# Plano — Blindagem de leitura + Prescrição do dia + Rollover 05h

## 0. Princípio inegociável (antes de tudo)

**Nada é deletado. Nada é sobrescrito destrutivamente.** Toda "renovação" é uma nova linha em `prescriptions` com `parent_id` apontando para a anterior. Toda prescrição assinada permanece imutável no banco para sempre — só muda o que a UI **mostra como vigente hoje**.

Se em qualquer ponto deste plano um passo parecer apagar/substituir histórico, é bug do plano — pare e me avise.

---

## 1. Internação no código (explicação didática que você pediu)

Três entidades distintas no banco, e o sistema **nunca pode confundi-las**:

```text
patient_registry      → IDENTIDADE clínica permanente (CPF, CNS, nome, DOB, mãe)
   │                    Vive para sempre. Um humano = um registry.
   │
   ├── patient_encounters   → INTERNAÇÃO/ATENDIMENTO (episódio assistencial)
   │                          encounter_code 12 dígitos. Abre na admissão,
   │                          fecha na alta. Sobrevive a trocas de leito.
   │
   └── patients              → OCUPAÇÃO DE LEITO (linha do mapa de leitos)
                              `patients.id` muda quando o paciente troca de leito.
                              `patients.patient_registry_id` aponta pro registry.
```

- **Prescrição, evolução, exame, cultura, movimento** → todos guardam `patient_registry_id` (identidade) e opcionalmente `patient_id` (leito do momento).
- **Bug histórico**: a URL passa `?patientId=<patients.id>` (leito), e a página filtrava queries por `patient_registry_id = patients.id`. IDs diferentes → 0 linhas → "sumiu". Os dados nunca sumiram, só a query estava filtrando pelo ID errado.
- **Blindagem do banco já aplicada**: triggers `enforce_prescription_patient_affinity` e `enforce_encounter_patient_affinity` impedem GRAVAR prescrição/encounter cujo `patient_registry_id` esteja em unidade hospitalar diferente, e auditam tudo em `prescription_affinity_audit`.

Falta agora blindar a **leitura**.

---

## 2. Item 1 — Helper único `useResolvedRegistryId`

### O que faz
Um único hook que recebe `patients.id` (vindo da URL) e devolve o `patient_registry_id` correto, com cache, com guarda contra race condition (troca rápida de paciente) e com logging.

### Onde fica
- `src/hooks/useResolvedRegistryId.ts` (novo) — fonte única da verdade.

### Como funciona
1. Entrada: `bedRowId` (UUID de `patients.id`) vindo da URL/contexto.
2. SELECT `patients.patient_registry_id, patients.hospital_unit_id, patients.name` por `id = bedRowId`.
3. Saída: `{ registryId, hospitalUnitId, patientName, isResolving, error }`.
4. Cancela resposta antiga quando `bedRowId` muda (evita "vazamento" de paciente A para tela do paciente B).
5. Cache em memória (Map) com TTL curto (30 s) para evitar round-trip extra ao re-renderizar.
6. Realtime opcional em `patients` filtrado por `id=eq.<bedRowId>` para reagir a relocação ao vivo (já temos `usePatientLive` — vamos reaproveitar a subscrição, não duplicar).

### Onde substituir o uso direto de `urlPatientId` em filtros de queries clínicas
Vou varrer e trocar **só** filtros do tipo `.eq('patient_registry_id', urlPatientId)` por `.eq('patient_registry_id', registryId)` vindo do helper. Não toco filtros legítimos por `patient_id` (esses devem continuar como `patients.id`).

Páginas/hooks alvo (lista preliminar — confirmo no momento da execução com `rg`):
- `src/pages/PrescricaoPage.tsx` (já corrigido ad-hoc — passa a usar o hook)
- `src/pages/EvolucaoPage.tsx`
- `src/pages/PainelClinicoPage.tsx` (aba Resumo)
- `src/pages/RequisicaoLaboratorioPage.tsx`, `RequisicaoImagensPage.tsx`, `RequisicaoParecerPage.tsx`
- `src/hooks/useEvolutions.ts`, `useLatestEvolution.ts`, `useActivePrescription.ts`, `useConductHistory.ts`, `usePatientSpecialRequests.ts`, `usePatientNirRequest.ts`, `usePatientPendingItems.ts`, `usePatientDocuments.ts`, `usePatientDischargeDocs.ts`, `usePatientCid.ts`, `usePatientDiagnosticContext.ts`, `usePatientMovements.ts`
- `src/components/ficha/*` se houver consulta direta

### Garantia de não-quebra
- Nenhuma escrita é alterada — só leitura.
- Quando o helper ainda está resolvendo (`isResolving = true`), as listas mostram skeleton em vez de "vazio" (evita o pavor visual de "sumiu").
- Se o SELECT falhar, mostramos um banner âmbar "Não foi possível resolver o prontuário deste leito — tente recarregar" e **não escondemos** nada que já estivesse renderizado.

---

## 3. Item 2 — Prescrição do dia carrega sozinha

### Definição de "vigente hoje" (confirmada por você)
Uma prescrição é **vigente** quando:
- `status = 'signed'` (assinada pelo médico) — farmácia **não** é mais pré-requisito.
- `created_at` (ou `signed_at` se preenchido) dentro da janela do **dia clínico** (ver §4 sobre rollover 05h).
- `patient_registry_id` = registry resolvido pelo helper.
- `hospital_unit_id` = unidade atual.

Se houver mais de uma assinada no dia → carrega **a mais recente** e mostra badge "Versão N de hoje • assinada às HH:MM" + link "ver versões anteriores do dia" (read-only).

### Corpo da prescrição carregado
- Todos os itens **internos** (`items[]` do JSONB) entram no corpo.
- Itens marcados como **"extra de impressão"** (flag `printOnly: true` ou categoria `extras_impressao` — confirmo o nome exato lendo `prescription_presentation.ts`) **NÃO** entram no corpo editável. Ficam num bloco separado "Itens extras impressos hoje" para o médico ter ciência, mas não poluem a edição.

### Fluxo de UI
1. Abriu `PrescricaoPage` com paciente X.
2. Helper resolve `registryId`.
3. Query: `prescriptions WHERE patient_registry_id = registryId AND status = 'signed' AND created_at >= <início_dia_clinico> ORDER BY created_at DESC LIMIT 1`.
4. Se achou → carrega **read-only** com botão primário "Editar / Nova versão".
5. Se não achou → abre em branco (ou herda do rollover, ver §4).
6. Calendário continua existindo na lateral para ver dias anteriores, mas **não** é mais o único caminho para o dia de hoje.

### "Editar / Nova versão"
- Cria nova linha `prescriptions` com `status = 'draft'`, `parent_id = <id da vigente>`, copiando `items`, `patient_data`, peso, alergias, diagnósticos, observações.
- A vigente continua intacta no banco.
- Ao assinar a nova versão, ela vira a nova vigente do dia. A anterior fica acessível via badge "ver versões anteriores do dia".

---

## 4. Rollover automático às 05:00 (renovação diária)

### Conceito
O "dia clínico" começa às **05:00 local** e termina às 04:59:59 do dia seguinte. Isso bate com o turno médico (médico chega de manhã e quer ver a prescrição "do dia novo" como rascunho herdado, não um corpo vazio).

### Implementação — duas camadas (defesa em profundidade)

**Camada A — Backend (fonte da verdade, garante consistência mesmo se ninguém abrir a tela):**
- Função Postgres `rollover_daily_prescriptions(p_hospital_unit_id uuid)` que:
  1. Para cada paciente internado na unidade com `admission_status = 'admitido'`,
  2. Encontra a última prescrição `signed` cujo dia clínico já passou e que **ainda não tem filha do dia novo**,
  3. Cria uma cópia como `status = 'draft'`, `parent_id` apontando para a anterior, `created_at = now()`, copiando `items`, peso, alergias, diagnósticos.
  4. Idempotente: rodar 10x no mesmo dia produz no máximo 1 draft filha por paciente.
- Agendamento via `pg_cron` diariamente às 05:00 local (UTC-3) = 08:00 UTC.
- Auditoria: cada draft criada registra em `prescription_affinity_audit` com `reason = 'DAILY_ROLLOVER_05H'`.

**Camada B — Frontend (fallback didático):**
- Quando `PrescricaoPage` abre e não acha vigente do dia mas acha draft filha gerada pelo rollover → carrega a draft com banner azul "Renovação automática das 05h — revise e assine para validar o dia de hoje".
- Se não achou nem vigente nem draft do rollover (ex: cron falhou) → carrega a última `signed` do dia anterior como **template em memória** (não grava nada) e mostra banner âmbar "Rollover pendente — gerando rascunho a partir da última prescrição assinada".

### Por que isso é seguro
- A prescrição assinada do dia anterior **nunca** é alterada.
- A draft do dia novo é uma linha **nova** com `parent_id`.
- Se o médico não fizer nada, a draft permanece como draft (não vira vigente sozinha).
- Se a unidade quiser auditar "o que foi prescrito ontem", a `signed` original do dia anterior continua intacta no banco e no calendário.

---

## 5. Proteção contra perda de dados (sua maior preocupação)

| Risco | Mitigação |
|---|---|
| Query com ID errado "esconde" dados | Helper único + skeleton enquanto resolve + banner em erro (nunca "vazio silencioso") |
| Nova versão sobrescreve a anterior | `parent_id` + INSERT (nunca UPDATE destrutivo em `items`) |
| Rollover apaga prescrição antiga | Cron só faz INSERT de draft filha; nunca UPDATE/DELETE na pai |
| Rollover roda 2x e duplica | Guarda `WHERE NOT EXISTS (filha do dia novo)` torna idempotente |
| Cron falha | Frontend detecta e carrega template em memória (sem gravar) |
| Troca rápida de paciente vaza dados | Helper cancela resposta antiga via flag `cancelled` |
| Gravação cross-unidade | Trigger de afinidade já bloqueia (RAISE EXCEPTION) |
| Helper retorna registry errado | Adiciono assert: `if (resolvedRegistryId && resolvedHospitalUnitId !== currentHospitalUnitId) → erro visível, não carrega nada` |

---

## 6. Ordem de execução (faseada, cada fase é reversível)

1. **Fase 1 — Helper (sem mudar comportamento ainda):** criar `useResolvedRegistryId.ts`, usar **apenas** em `PrescricaoPage` (já fizemos ad-hoc, agora migra para o hook).
2. **Fase 2 — Persistência do dia:** lógica de "carregar vigente do dia" + botão "Editar / Nova versão" + tratamento de itens `printOnly`.
3. **Fase 3 — Migração ampla do helper:** trocar todos os filtros listados em §2 para usar o helper. Smoke test em paciente conhecido (JACKSON) antes de prosseguir.
4. **Fase 4 — Rollover backend:** migration cria `rollover_daily_prescriptions()` + `pg_cron` job. Roda **dry-run** primeiro (uma flag `p_dry_run boolean`) que só retorna quantas filhas seriam criadas, sem inserir.
5. **Fase 5 — Rollover frontend fallback:** banner azul/âmbar.

Cada fase você confirma "ok" antes de eu seguir para a próxima.

---

## 7. O que **NÃO** será tocado neste plano (princípios imutáveis)

- Camada de **Layout**: nenhuma mudança visual além dos banners citados e da badge "Versão N de hoje".
- Camada de **Movimentação**: nada em fluxos de alta, transferência, leito.
- Camada de **Auditoria**: só **adicionamos** entradas (`DAILY_ROLLOVER_05H`); não removemos nada.
- `src/integrations/supabase/client.ts`, `types.ts`, `.env`, `supabase/config.toml` (project-level).
- Catálogo de medicamentos, validação farmacêutica, MAV/Port.344, insulinoterapia — fora do escopo.

---

## 8. Perguntas finais antes de codar

1. **Fuso do rollover**: confirmar `America/Sao_Paulo` (UTC-3 sem horário de verão) para o cron das 05h?
2. **Itens "extras de impressão"**: você lembra se a flag é `printOnly` no JSONB do item, ou se é uma categoria/seção separada? (Posso descobrir lendo o código, mas se você souber de cabeça acelera.)
3. **Janela do dia clínico**: 05:00 → 04:59:59 do dia seguinte fecha bem com o turno? Ou prefere 06:00 / 07:00?
4. **Fase 1 isolada primeiro** (só helper em PrescricaoPage, valido com você no JACKSON), e só depois eu sigo para as demais fases — ok?

Se responder "ok seguir" sem ressalvas, eu assumo: fuso SP, descubro a flag dos extras lendo o código, janela 05–05, e executo em fases pedindo "ok" entre cada uma.
