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
- **Requisições comuns (Norma Zero)** → `/requisicoes` escopo "Comuns" (lab/imagem/parecer)
- **Documentos especiais** → `/requisicoes` escopo "Especiais": APAC, Cultura, Hemocomponentes, **SAT**
- **AIH** NÃO é requisição: o laudo é gerado dentro do **fluxo de internação** (`InternmentStatusDialog` → `AihFormDialog`). Em `/requisicoes` e `/documentos` aparece apenas como referência informativa apontando para o fluxo correto.

## SAT (Soro Antitetânico) — habilitado
Dialog dedicado `src/components/SatRequestDialog.tsx` com:
- Avaliação por tipo de ferimento (limpo / outras / alto risco)
- Situação vacinal (completa <5a, completa ≥5a, incompleta/desconhecida)
- Histórico de hipersensibilidade a soro heterólogo
- Recomendação automática conforme tabela do PNI/MS (VAT dT + SAT 5.000 UI IM ou IGHAT 250 UI IM se alergia)
- Persiste como `exam_request` com `category="sat"` (Fase 0); migrará para `sat_requests` na Fase 1
- Botão de impressão A4 com cabeçalho do hospital + assinatura

## Sincronização de status
exam_requests permanece como tabela única na Fase 0, com `category` distinguindo lab/imagem/parecer/apac/sat. Cultura e Hemo já têm tabelas próprias. Hook `usePatientDocuments` é o ponto único de leitura unificada.

## Fase 0 (entregue)
- Hook + componente unificado
- /documentos reformulada com timeline + acordeões + 5 QuickCTAs (Hemo, Cultura, APAC, SAT, AIH-info)
- /requisicoes com escopos Comuns/Especiais e atalhos diretos para Cultura/Hemo/SAT (AIH separado, aponta para fluxo de internação)
- HemoderivadosPage com CTA destacado
- SAT funcional persistindo via exam_requests

## Fase 1 (futura, sob demanda)
- Migração: criar `hemocomponent_requests`, `apac_requests`, `sat_requests` (RLS padrão authenticated). AIH continua no fluxo de internação.
- Dialog APAC dedicado (hoje usa ApacEmbeddedForm dentro de /requisicoes)
- Realtime subscription nas 5 fontes (já preparado no hook via `realtime: true`)
