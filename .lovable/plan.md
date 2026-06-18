
# Plano de implantação — Guia ATB + Inversão da fonte de verdade

> **Não é ordem de execução.** Plano de referência. Cada fase precisa de "ok" explícito do PO antes de começar, conforme princípios imutáveis do projeto.

## Resposta direta à pergunta

**Não dá para implantar tudo sem risco.** A divisão real é:

- **Fases 1-4 (frontend puro):** implantáveis com risco controlado mesmo sem staging — validação por build + prova visual de PDF + casos de borda.
- **Fase 5 (reconstituição):** **BLOQUEADA** até a planilha de reconstituição estar assinada pela farmácia. Sem isso, ativar é risco clínico real (erro de preparo).
- **Fases 6-7 (inversão + aprazamento):** **BLOQUEADAS** até existir staging + aval explícito do PO para migration. Mexem em banco e em fluxo clínico em produção; não há mitigação suficiente sem staging.

## O que pode ser feito agora, em ordem

### Bloco A — Frontend seguro (Fases 1-4)

Pré-condição comum a todas: re-baixar arquivo fresco, confirmar âncoras (linhas mudam), commit único por fase, `npm run build` + `tsc --noEmit` verdes, prova visual em PDF.

**Fase 1 — Valor × Unidade em `AntimicrobialEntry`**
- Adicionar `doseValue: string` e `doseUnit: string` na interface.
- Manter `dose` como derivado (`${doseValue} ${doseUnit}`) — camada de compatibilidade para PDF, persistência e validação que hoje leem `dose`.
- UI L670-672: trocar `<Input>` único por `<Input numérico>` + `<Select>` de unidade (g, mg, mcg, UI, mL, ampola, frasco-ampola, comprimido, mEq, mmol).
- Decisão pendente #1 a fechar antes: seletor fechado ou texto livre fallback?
- Validação: criar entry "1.200.000 UI" e "30 mL", conferir derivado e PDF.

**Fase 2 — Módulo compartilhado de intervalos**
- Criar `src/lib/prescriptionIntervals.ts` exportando lista canônica incluindo 48/48h, 72/72h.
- Guia L682: `<Input>` posology → `<Select>` da lista.
- PrescricaoPage L493: importar a mesma lista (decisão #4 — recomendação: sim).
- Validação: 48/48h aparece em guia e PDF; prescrição usa mesma lista.

**Fase 3 — Unidade/setor editável no guia**
- Adicionar `unit: string` em `AntimicrobialEntry`.
- `<Select>` de setores pré-preenchido com `patient.unit`, editável.
- Decisão pendente #2 antes: lista restrita ou todos os setores?

**Fase 4 — Bugs KCl, fenitoína, fentanil**
- Arquivo crítico (PrescricaoPage ~11k linhas) → escopo cirurgicamente restrito.
- `combineDoseQty` L316-329: garantir que edição do médico prevaleça (KCl 3 amp vs 30 mL; fenitoína volume real). Fase 1 facilita a raiz.
- Fentanil: fechar caminho residual `mcg/kg/min` no PDF (L836/880/945).
- Validação: PDF antes/depois em casos de borda simulados.

### Bloco B — Bloqueado por auditoria farmacêutica

**Fase 5 — Reconstituição no guia**
- **Pré-condição dura:** planilha de reconstituição assinada pela farmácia + reconciliação de `ivMedicationFlags.ts`.
- Sem assinatura, não toco.
- Implementação (quando liberar): guia consome `getReconstitutionDefault(name)`; inerte até `RECONSTITUTION_AUTOFILL_ENABLED=true`.
- Decisão #3 antes: só leitura ou editável?

### Bloco C — Bloqueado por staging + banco

**Fase 6 — Inversão da fonte de verdade**
- **Pré-condições duras:** Fases 1-3 prontas + staging existindo + aval explícito do PO para migration + decisões #5 e #6 fechadas.
- Modelo simplificado já decidido: prescrição guarda `guia_id`; vínculo dispara em 2 eventos (criar guia → gera prescrição; suspender guia → suspende prescrição); editar prescrição diverge livre.
- Banco: campo `guia_id` em prescrição + persistência de data de início no guia. Migration via Lovable, executada pelo PO.
- Sem staging, **não implanto**. Risco clínico em produção viva.

**Fase 7 — Aprazamento por horário**
- Projeto à parte, posterior à Fase 6. Modelo de dados novo, banco provável. Mesmas pré-condições da Fase 6, ampliadas.

## Decisões que preciso do PO antes de começar qualquer fase

| # | Pergunta | Bloqueia |
|---|---|---|
| 1 | Unidade de medida: seletor fechado ou com fallback livre? | Fase 1 |
| 2 | Seletor de setor: só os do paciente ou todos? | Fase 3 |
| 4 | Lista 48/72h também na prescrição? (recomendo sim) | Fase 2 |
| 3 | Reconstituição no guia: leitura ou editável? | Fase 5 |
| 5 | Prescrição diária re-gerada todo dia, ou guia gera uma vez? | Fase 6 |
| 6 | Suspensão automática ou com confirmação? (recomendo confirmar) | Fase 6 |
| 7 | Cadastros penicilina/fluconazol: PO fornece ou eu preparo SQL? | Paralelo |

## Contrato de execução (princípios imutáveis aplicados)

Antes de **cada** fase, eu repito por escrito:
- O que entendi do escopo.
- Lista exata de arquivos que vou tocar.
- Lista exata do que **não** vou tocar.
- Aguardo "ok" antes de mexer em código.

E nas fases 5-6-7: aviso explicitamente se a pré-condição (assinatura/staging/aval banco) ainda não está atendida e **não executo**.

## Ordem recomendada quando o PO autorizar

1. Fechar decisões #1, #2, #4 → liberar Fases 1, 2, 3.
2. Implantar Fases 1 → 2 → 3 → 4, uma de cada vez, commit isolado, prova visual entre elas.
3. Aguardar assinatura da farmácia → Fase 5 com flag em off → ligar flag só após validação visual.
4. Provisionar staging + aval do PO para banco + fechar decisões #5 e #6 → Fase 6.
5. Fase 7 como projeto novo.

## O que eu não farei neste plano

- Não tocar em camadas além da fase atual (Layout/Dados/Movimentação/Auditoria continuam isoladas).
- Não rodar migration sem o PO.
- Não ligar flag de reconstituição sem assinatura.
- Não prometer "sem risco" para Fases 5-7.
