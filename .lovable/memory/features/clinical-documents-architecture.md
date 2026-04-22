---
name: clinical-documents-architecture
description: Arquitetura unificada de documentos clínicos do paciente — hook usePatientDocuments + PatientDocumentsPanel (timeline + acordeões por tipo) + separação Norma Zero (lab/imagem/parecer) vs Especiais (Hemo/APAC/SAT/AIH/Cultura). Fase 0 entregue (UI + leitura), Fase 1 criará tabelas dedicadas.
type: feature
---

# Documentos Clínicos — Arquitetura

## Hook unificador
`src/hooks/usePatientDocuments.ts` agrega documentos de múltiplas fontes para um paciente:
- `exam_requests` (lab/imagem/parecer/apac — APAC detectado por categoria ou keywords TC/RM/eco/doppler)
- `culture_results`
- `clinical_evolutions`
- TODO Fase 1: `hemocomponent_requests`, `sat_requests`, `aih_requests` (tabelas dedicadas)

Retorna `{ docs, byType, counts, loading, refetch }` com tipo unificado `PatientDocument` e status normalizado (`pendente | em_analise | autorizado | concluido | cancelado`). Suporta `realtime: true` para subscribe automático.

Exporta também `DOCUMENT_TYPE_META` (label/cor/bg por tipo) e `STATUS_BADGE` (label/classes/dot) para UI consistente.

## Componente unificado
`src/components/PatientDocumentsPanel.tsx` renderiza:
1. **Timeline geral** (5 últimos por padrão, configurável via `timelineLimit`)
2. **Acordeões por tipo** (Hemo/APAC/SAT/AIH/Cultura/Lab/Imagem/Parecer/Evolução/Round) com badge de contagem, lista de itens e botão "+ Nova solicitação de X"

Props principais: `onNewByType(type)` para criação, `onOpenDoc(doc)` para abrir/navegar, `onPrintDoc(doc)` para reimprimir.

## Páginas que usam
- `/documentos` (`DocumentosPacientePage`) — usa `usePatientDocuments` + `PatientDocumentsPanel`. Topo tem 4 QuickCTAs (Hemo/Cultura/APAC/AIH). Hemo abre `HemocomponentRequestDialog`. Cultura/APAC roteiam para `/requisicoes` com query `?especial=`. AIH/SAT mostram toast "em breve".
- `/hemoderivados` (`HemoderivadosPage`) — CTA destacado "Nova Solicitação de Hemocomponentes" abre o dialog padrão Socorrão I.

## Separação conceitual (definida)
- **Requisições comuns (Norma Zero)** → `/requisicoes` com lab/imagem/gaso/parecer (já existente)
- **Documentos especiais** → Hemo/APAC/SAT/AIH/Cultura via `/documentos` ou sub-aba "Especiais" de `/requisicoes` (Fase 1 — criar sub-abas)

## Sincronização de status
exam_requests permanece para comuns; especiais terão tabelas dedicadas + view consolidada. Hook `usePatientDocuments` é o ponto único de leitura unificada.

## Fase 0 (entregue)
- Hook + componente unificado
- /documentos reformulada com timeline + acordeões + 4 QuickCTAs
- HemoderivadosPage com CTA destacado para o dialog Socorrão I

## Fase 1 (futura, sob demanda)
- Migração: criar `hemocomponent_requests`, `apac_requests`, `sat_requests`, `aih_requests` (RLS padrão authenticated)
- Sub-abas Comuns/Especiais em `/requisicoes`
- Dialogs APAC/SAT/AIH dedicados
- Realtime subscription nas 5 fontes (já preparado no hook via `realtime: true`)
