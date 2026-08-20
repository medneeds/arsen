# Cadeado de setores dessincronizado — diagnóstico e correção

**Data:** 19/08/2026
**Origem:** achado durante a estruturação do Posto de Internação
**Severidade:** alta — cancelamento automático de sinalização de paciente sem decisão humana

---

## 1. O problema em uma frase

O mecanismo de "setor sem implantação ativa" tem duas metades que **não conversam**: a lista visual, no frontend, está vazia; a lista que **cancela registros**, hardcoded no SQL, está cheia — e inclui setores que estamos ativando.

| Metade | Onde vive | Estado |
|---|---|---|
| Esconde o setor na UI | `LOCKED_DEPARTMENTS` (`src/config/lockedSectors.ts`) | **vazio** desde 05/08/2026 |
| Cancela sinalizações | array `v_locked_codes` dentro de `cleanup_locked_sector_pending_allocations()` | **14 setores** |

O gatilho é o frontend: `maybeRunLockedSectorCleanup()` roda em `DashboardPage` e `MovementsPage`, uma vez por hora por sessão de navegador, **sem verificar se há algum setor travado**.

### Lista hardcoded hoje no banco

```
neuro_01, neuro_02, clinica_cirurgica,
ue_vertical, ue_horizontal, sala_vermelha, sala_laranja,
internacao_ue, observacao_clinica,
enfermaria_vascular, riv,
cc_preparo, cc_bloco, cc_rpa
```

Mais os rótulos equivalentes em maiúsculas (`'INTERNAÇÃO UE'`, `'SALA VERMELHA'`, …), porque `destination_sector` guarda texto livre.

### O que a função faz

Para `pre_admissions` e `bed_allocation_requests`, com mais de 24h e status ainda ativo, destinados a qualquer setor da lista:

- muda o status para cancelado
- anexa a nota *"Cancelado automaticamente — setor sem implantação ativa, sinalização não admitida em 24h. Prontuário preservado."*
- registra em `locked_sector_cleanup_log`

**Status considerados ativos** (ou seja, canceláveis): tudo que **não** está em
`('admitido','cancelado','rejeitado','expirado')`.
Isso inclui `aguardando_leito`, `aguardando_leito_uti`, `pre_admissao` e `classificado`.

### Caso concreto conhecido

Existe **1 pré-admissão** com `destination_sector = 'Internação UE'` em status `aguardando_leito`. Ela satisfaz todas as condições de cancelamento assim que completar 24h.

---

## 2. Ordem de execução recomendada

| Etapa | Natureza | Reversível | Bloqueia? |
|---|---|---|---|
| **A** — desligar o gatilho no frontend | código | sim, 1 linha | não |
| **B** — diagnóstico | SQL, só leitura | n/a | não |
| **C** — corrigir a lista da função | SQL, escrita | sim | **sim** — precisa de decisão |
| **D** — restaurar cancelamentos indevidos | SQL, escrita | não | depende de B |

Fazer **A** primeiro. Ele estanca o problema sem depender de nenhuma decisão pendente e sem tocar em banco.

---

## 3. Etapa B — diagnóstico (somente leitura)

Rodar um bloco por vez, conferindo o resultado antes do próximo.

### B.1 — Ground truth: o que a função REALMENTE é hoje

Não confiar no git. A migration pode não refletir o banco.

```sql
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'cleanup_locked_sector_pending_allocations';
```

Confirmar que o array `v_locked_codes` é o mesmo listado na seção 1. Se for diferente, **parar e reportar** — o resto deste documento assume a lista acima.

### B.2 — Quanto já foi cancelado

```sql
SELECT
  source_table,
  sector,
  count(*)                AS total,
  min(cleaned_at)         AS primeiro,
  max(cleaned_at)         AS ultimo
FROM public.locked_sector_cleanup_log
GROUP BY source_table, sector
ORDER BY total DESC;
```

Se vier vazio, a limpeza nunca cancelou nada e o risco é apenas prospectivo.

### B.3 — O que será cancelado na PRÓXIMA execução

Esta é a consulta mais importante: reproduz exatamente o `WHERE` da função, **sem escrever nada**.

```sql
SELECT
  destination_sector,
  status,
  count(*) AS em_risco,
  min(created_at) AS mais_antiga
FROM public.pre_admissions
WHERE created_at < now() - interval '24 hours'
  AND COALESCE(status,'') NOT IN ('admitido','cancelado','rejeitado','expirado')
  AND (
    destination_sector = ANY (ARRAY[
      'neuro_01','neuro_02','clinica_cirurgica',
      'ue_vertical','ue_horizontal','sala_vermelha','sala_laranja',
      'internacao_ue','observacao_clinica',
      'enfermaria_vascular','riv',
      'cc_preparo','cc_bloco','cc_rpa'
    ])
    OR destination_sector = ANY (ARRAY[
      'NEURO 01','NEURO 02','CLÍNICA CIRÚRGICA',
      'UE VERTICAL','UE HORIZONTAL','SALA VERMELHA','SALA LARANJA',
      'INTERNAÇÃO UE','OBSERVAÇÃO CLÍNICA',
      'ENFERMARIA VASCULAR','RIV',
      'CC PREPARO','CC BLOCO CIRÚRGICO','CC RPA'
    ])
  )
GROUP BY destination_sector, status
ORDER BY em_risco DESC;
```

E o mesmo para pedidos de leito:

```sql
SELECT requested_sector, status, count(*) AS em_risco
FROM public.bed_allocation_requests
WHERE created_at < now() - interval '24 hours'
  AND COALESCE(status,'') NOT IN ('approved','cancelled','rejected','admitted','expired')
  AND requested_sector = ANY (ARRAY[
    'neuro_01','neuro_02','clinica_cirurgica',
    'ue_vertical','ue_horizontal','sala_vermelha','sala_laranja',
    'internacao_ue','observacao_clinica',
    'enfermaria_vascular','riv',
    'cc_preparo','cc_bloco','cc_rpa'
  ])
GROUP BY requested_sector, status
ORDER BY em_risco DESC;
```

---

## 4. Etapa C — corrigir a lista

### Níveis de cobertura — decidido em 19/08/2026

O gestor definiu três níveis. A distinção entre os dois primeiros é essencial:
setor "rastreado" **não** é setor desativado.

| Nível | Significado | Setores |
|---|---|---|
| **clinical** | operação clínica completa (prescrição, evolução, requisição) | `red` `yellow` `blue` `outside` `ucc` `enfermaria_transicao` `sala_vermelha` `sala_laranja` `internacao_ue` |
| **tracking** | paciente internado e rastreado (censo, NIR, encontro), sem operação clínica por ora | `clinica_cirurgica` `enfermaria_vascular` `neuro_01` `neuro_02` `cc_preparo` `cc_bloco` `cc_rpa` |
| **out** | fora do escopo de internação | `ue_vertical` `observacao_clinica` `riv` |

**Somente o nível `out` entra na lista de cancelamento automático.** Incluir um
setor `tracking` faria pacientes internados terem suas sinalizações descartadas.

Pendente: `ue_horizontal` é guarda-chuva da urgência, não um lugar de leito.
Fica fora da lista até resolvermos se existem leitos `EH` gravados no banco.

Fonte única no código: `src/config/sectorCoverage.ts`.

**Atenção ao RIV:** ele tem 10 leitos configurados (`RV01`–`RV10`) e passa agora
a ser elegível ao cancelamento automático. Conferir em B.3 se há sinalização
pendente para RIV **antes** de executar C.1.

### C.1 — Correção (preencher a lista antes de executar)

Substituir apenas os dois arrays. O corpo da função permanece idêntico.

```sql
CREATE OR REPLACE FUNCTION public.cleanup_locked_sector_pending_allocations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Apenas setores FORA do escopo de internação (nível "out").
  -- Setor listado aqui tem suas sinalizações canceladas automaticamente em 24h.
  -- Espelha OUT_OF_SCOPE_SECTOR_CODES em src/config/sectorCoverage.ts.
  v_locked_codes TEXT[] := ARRAY[
    'ue_vertical',
    'observacao_clinica',
    'riv'
  ];
  v_locked_labels TEXT[] := ARRAY[
    'UE VERTICAL',
    'OBSERVAÇÃO CLÍNICA',
    'RIV'
  ];
  v_pre INT := 0;
  v_bar INT := 0;
BEGIN
  -- 1) pre_admissions
  WITH cancelled AS (
    UPDATE public.pre_admissions
       SET status = 'cancelado',
           updated_at = now(),
           notes = COALESCE(notes,'') ||
             CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE E'\n' END ||
             '[Cancelado automaticamente em ' || to_char(now(),'DD/MM/YYYY HH24:MI') ||
             ' — setor sem implantação ativa, sinalização não admitida em 24h. Prontuário preservado.]'
     WHERE created_at < now() - interval '24 hours'
       AND COALESCE(status,'') NOT IN ('admitido','cancelado','rejeitado','expirado')
       AND (
         destination_sector = ANY(v_locked_codes)
         OR destination_sector = ANY(v_locked_labels)
       )
    RETURNING id, NULL::uuid AS patient_id, patient_name, destination_sector
  )
  INSERT INTO public.locked_sector_cleanup_log (source_table, source_id, patient_id, patient_name, sector)
  SELECT 'pre_admissions', id, patient_id, patient_name, destination_sector FROM cancelled;
  GET DIAGNOSTICS v_pre = ROW_COUNT;

  -- 2) bed_allocation_requests
  WITH cancelled AS (
    UPDATE public.bed_allocation_requests
       SET status = 'cancelled',
           rejection_reason = COALESCE(rejection_reason,'') ||
             CASE WHEN COALESCE(rejection_reason,'') = '' THEN '' ELSE ' | ' END ||
             'Cancelado automaticamente — setor sem implantação ativa, não admitido em 24h.',
           reviewed_at = now(),
           updated_at = now()
     WHERE created_at < now() - interval '24 hours'
       AND COALESCE(status,'') NOT IN ('approved','cancelled','rejected','admitted','expired')
       AND (
         requested_sector = ANY(v_locked_codes)
         OR requested_sector = ANY(v_locked_labels)
       )
    RETURNING id, patient_id, requested_sector
  )
  INSERT INTO public.locked_sector_cleanup_log (source_table, source_id, patient_id, sector)
  SELECT 'bed_allocation_requests', id, patient_id, requested_sector FROM cancelled;
  GET DIAGNOSTICS v_bar = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'cleaned_at', now(),
    'pre_admissions_cancelled', v_pre,
    'bed_allocation_requests_cancelled', v_bar
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_locked_sector_pending_allocations() TO authenticated;
```

**Reversibilidade:** total. É `CREATE OR REPLACE` — para voltar, basta reexecutar com a lista antiga (guardada na seção 1). Nenhum dado é alterado por este bloco em si.

**Atenção:** o `GRANT` é apenas para `authenticated`. Confirmado que **não há** grant para `anon` ou `PUBLIC`. Não recriar com grant mais amplo.

### C.2 — Verificação após C.1

```sql
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.proname='cleanup_locked_sector_pending_allocations';
```

Conferir que os arrays refletem a decisão. Depois, reexecutar **B.3** — deve devolver apenas os setores realmente fora de implantação.

---

## 5. Etapa D — restaurar cancelamentos indevidos

**Só executar se B.2 mostrar registros de setores que estamos ativando.** Depende de B.

Identificar candidatos:

```sql
SELECT l.id, l.source_table, l.source_id, l.sector, l.cleaned_at, p.status
FROM public.locked_sector_cleanup_log l
LEFT JOIN public.pre_admissions p ON p.id = l.source_id
WHERE l.source_table = 'pre_admissions'
  AND l.sector IN ('internacao_ue','sala_vermelha','sala_laranja',
                   'INTERNAÇÃO UE','SALA VERMELHA','SALA LARANJA')
ORDER BY l.cleaned_at DESC;
```

**Não escrevi o UPDATE de restauração de propósito.** Reverter um cancelamento é ato clínico: devolve um paciente para a fila de espera de leito. Precisa de decisão caso a caso, com o status de destino definido por quem conhece a situação — não por um `UPDATE` em massa. Traga o resultado desta consulta e montamos o comando específico.

---

## 6. Dívida estrutural (não é para agora)

A causa raiz é a **duplicação da lista** em dois lugares que não se falam. Enquanto existir array hardcoded no SQL e Set no frontend, eles voltarão a divergir.

**Fase 1 concluída:** `src/config/sectorCoverage.ts` declara cada setor uma vez,
com nível e grupo, e traz `assertSectorCoverageIntegrity()` mais 8 testes que
acusam código órfão, código faltante e sobreposição de nível. Nenhum consumidor
ainda — o arquivo é aditivo.

**Fase 2:** migrar os consumidores um a um (`SECTOR_SCOPE` do NIR,
`HOSPITAL_SECTOR_GROUPS`, `DESTINATION_SECTORS`, `LOCKED_DEPARTMENTS`) para
derivarem daqui.

**Fase 3:** remover as listas antigas e fechar `SectorType` como união de
literais — hoje ele termina em `| string` e por isso não valida nada. Fechado,
o compilador teria pego o `cc_bloco_cirurgico`.

**Fase 4 (banco):** a função SQL passar a ler de uma tabela de configuração em
vez do array hardcoded. Só assim as duas listas deixam de poder divergir.

---

## Auditoria de 19/08/2026 — achados adicionais

Espelho local do schema (PostgreSQL 16, 282 das 325 migrations aplicadas; as 43
restantes falham só em `publication`/`realtime`, irrelevantes aqui). Todos os
achados abaixo foram REPRODUZIDOS, não deduzidos.

### 1. A função de limpeza tem três defeitos, não um

| # | Defeito | Consequência |
|---|---------|--------------|
| 1 | Lista de 14 setores inclui setores ativos | Cancela sinalização de paciente real. Reproduzido: `CASO NEURO` (30h) cancelado. |
| 2 | Grava `status='cancelled'`, fora do vocabulário da constraint (`pending/approved/discussing/rejected`) | Viola constraint → **a transação inteira reverte**, inclusive os cancelamentos de pré-admissão do mesmo ciclo. O front engole a exceção (`console.debug`): falha invisível. |
| 3 | Comparação sensível a maiúsculas | `'Internação UE'` (como o front grava) não casa com `'internacao_ue'` nem `'INTERNAÇÃO UE'`. **A pré-admissão real de 30h+ sobreviveu por acaso, não por proteção.** |

Corrigidos em `20260819230000_fix_cleanup_locked_sectors_escopo_internacao.sql`.
Verificação após a correção: cancela apenas `RIV` (30h) e o pedido de
`observacao_clinica` (30h); preserva `Internação UE`, `neuro_01` e a
sinalização de `ue_vertical` com 2h.

### 2. `patients` tinha UNIQUE(bed_number) GLOBAL

Herança de novembro/2025, quando só existiam os quatro setores de UTI. É
incompatível com a estrutura aprovada: `L01` existe simultaneamente em UTI 1,
UCI 1, Neuro 01, Clínica Cirúrgica e Enf. Vascular. Substituída pela unicidade
composta `(hospital_unit_id, sector, bed_number)` — a mesma que `bed_census` já
usava. Nenhum código dependia da global (nenhum `onConflict`/upsert sobre
`bed_number`).

### 3. Os fluxos da urgência inseriam leito em vez de ocupar

Triagem e UE Horizontal criavam uma linha nova por paciente, com numeração
própria (`M-01`, `M-02`…) no setor `ue_horizontal`. Com a faixa oficial
semeada (`M01`–`M14` no Posto de Internação), manter o INSERT produziria os
14 leitos oficiais eternamente vazios, todo paciente nascendo como `EXTRA`, e
colisão com a unicidade composta.

Corrigido com `src/lib/bedOccupancy.ts`: ocupa o menor leito vago da faixa por
UPDATE — o padrão que `AdmitPatientDialog` já seguia — e abre `EXTRA` apenas
quando a faixa está lotada (superlotação nunca recusa paciente). Macas legadas
`M-xx` permanecem listadas até a alta natural.
