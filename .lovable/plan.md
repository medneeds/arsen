## Estado atual (o que JÁ existe)

- Página `/historico-paciente` agrupa eventos **por dia** (mais recente → mais antigo), com filtros de texto, intervalo de datas e checkbox de tipos
- View `patient_timeline` + RPC `get_patient_timeline` no banco
- Hook `usePatientTimeline` recebe paciente via `patientRegistryId` ou `patientId`
- Diálogo global `GlobalSearchDialog` (Cmd+K) já busca pacientes
- Infraestrutura de PDF "Norma Zero" (timbrado A4, código de documento) pronta em `src/lib/printNormaZero.ts`
- Perfis `coord_medico`, `coord_enfermagem`, `coord_multi` já existem em `userProfiles.ts` + hook `useIsCoordenador`

## O que falta (9 gaps identificados)

| # | Gap | Camada |
|---|-----|--------|
| G1 | Export PDF do histórico usa `window.print()` cru, sem timbrado | Dados/Layout |
| G2 | Timeline não tem realtime | Dados |
| G3 | Faltam 4 tipos de evento na timeline: `vital_signs`, `round`, `parecer`, `discharge` | Dados (view SQL) |
| G4 | Sidebar não tem campo visível de busca de paciente | Layout |
| G5 | `GlobalSearchDialog` ao escolher paciente vai pro mapa — não dá opção "Abrir histórico" | Layout |
| G6 | Coordenadores caem no menu fallback (vazio) | Layout (Sidebar) |
| G7 | `isCoordinator` na sidebar é hardcoded por e-mail | Auditoria |
| G8 | Busca global não cobre `patient_registry` (pacientes com alta somem) | Dados |
| G9 | Permissão de visualizar o histórico não está formalizada por perfil | Auditoria |

## Plano — 4 fases independentes (cada uma com aprovação)

### Fase 1 — Completar a timeline (banco + hook) — G2, G3, G8

```text
Migration:
  ALTER VIEW patient_timeline para incluir:
   - vital_signs        (de public.vital_signs)
   - round              (de public.round_sessions)
   - parecer            (de public.pareceres)
   - discharge          (de public.discharge_documents — apenas suspended_at IS NULL)

Hook usePatientTimeline:
  + adicionar realtime via supabase.channel em 4 tabelas-fonte
    (invalidate queryKey ao receber INSERT/UPDATE)
  + adicionar 4 novos TimelineEventType ao enum
  + adicionar 4 ícones + labels + cores

Hook novo usePatientRegistrySearch:
  Busca em patient_registry por nome/CPF/CNS/prontuário (NFD normalizado)
  Inclui pacientes COM e SEM internação ativa
```

**Não toca:** lógica de agrupamento por dia, filtros, layout da página.

### Fase 2 — Busca na Sidebar — G4, G5

```text
src/components/AppSidebar.tsx
  + bloco "Buscar prontuário" entre Setor Ativo e menus
  + <Input> com debounce 250ms → chama usePatientRegistrySearch
  + dropdown de até 8 resultados (nome, prontuário, CPF, leito atual ou "alta")
  + clique → navega para /historico-paciente?patientRegistryId=...

src/components/GlobalSearchDialog.tsx
  + segundo botão "Abrir histórico" ao lado de "Ir para o leito"
  + (Cmd+K continua funcionando como hoje)
```

**Não toca:** estrutura geral da sidebar, GlobalSearchDialog atual, navegação para o mapa.

### Fase 3 — Export PDF Norma Zero — G1

```text
src/lib/printPatientTimeline.ts  (NOVO)
  - usa buildNormaZeroDocument (timbrado, A4 retrato, código DOC)
  - cabeçalho: paciente, prontuário, CPF, internação atual
  - corpo: cada dia = bloco com data por extenso + lista de eventos
    (hora HH:mm, badge tipo, autor, resumo, payload resumido)
  - rodapé Norma Zero (página x de y, gerado por, data/hora)
  - aceita os MESMOS filtros aplicados na tela (search, datas, tipos)

HistoricoPacientePage.tsx
  - botão "Imprimir/Exportar PDF" agora chama printPatientTimeline(filtros)
  - remove window.print() puro
```

**Não toca:** view do banco, hooks, agrupamento.

### Fase 4 — Acesso por coordenação — G6, G7, G9

```text
src/components/AppSidebar.tsx
  - substituir isCoordinator hardcoded por useIsCoordenador()
  - adicionar bloco de menu próprio para coord_medico/enfermagem/multi
    contendo: Mapa, Histórico do Paciente, Painel Clínico (read-only),
              Round Multiprofissional, Relatórios

src/pages/HistoricoPacientePage.tsx
  - guard de entrada: permite admin, medico, coord_medico,
    coord_enfermagem, coord_multi, e o médico assistente do leito atual
  - bloqueia demais perfis com mensagem didática

Migration:
  - função SQL can_view_patient_timeline(_user_id, _patient_registry_id)
    para uso futuro em RLS / RPC, sem mudar regras vigentes agora
```

**Não toca:** dados clínicos, fluxos de movimentação, prescrição, evolução.

## Garantias (Princípios Imutáveis)

- **Camadas separadas:** cada fase mexe APENAS na camada declarada
- **Zero perda de dado clínico:** todas as mudanças são aditivas (novas colunas/eventos/hooks)
- **Sem regressão:** página atual continua funcionando entre fases
- **Cada fase é mergeável sozinha** e tem rollback trivial

## Ordem de execução sugerida

1. **Fase 1 primeiro** (sem ela, as outras não têm o que mostrar)
2. **Fase 4** (libera os coordenadores a usarem)
3. **Fase 2** (ponto de entrada visível)
4. **Fase 3** (export consolidado — depende de Fase 1)

## Decisão que preciso de você

Confirma este plano e a ordem das fases? Posso começar pela **Fase 1** (migration da view + realtime no hook) assim que você responder `ok`.
