# Pacote de regras — Data de internação hospitalar x Data de admissão no setor

> Fonte da verdade para as duas datas/horas que ancoram DIH, TPS, cabeçalhos de impressos,
> timeline de evoluções e controle de fluxo. Toda tela que mostrar qualquer uma dessas datas
> deve ler a mesma fonte descrita aqui.

## 1. As duas datas (são distintas — data **e** hora)

| Conceito | O que marca | Coluna | Ancora |
|---|---|---|---|
| **Data de internação hospitalar** | O instante em que o paciente **passa a aguardar alocação**. O ato de ficar na fila de espera por leito é o que **abre o atendimento** (o paciente já tem prontuário/atendimento a partir daí). | `internacoes.data_entrada` | **DIH** (dias de internação hospitalar) e o rótulo Dn da timeline de evoluções / impressos |
| **Data de admissão no setor** | O instante em que o usuário **aloca o paciente dentro do leito** (data e hora da alocação). | `internacoes.data_admissao_uti` | **TPS** (tempo de permanência no setor) e o chip/cabeçalho de setor |

Regra em uma frase:

- **Aguardou → internação hospitalar.**
- **Foi alocado no leito → admissão no setor.**

Quando o paciente aguarda e minutos depois é alocado, as **datas** coincidem mas as **horas**
são diferentes — e as duas precisam ser gravadas separadamente.

## 2. Regra desta rodada (pacientes já ativos)

O instante de "aguardando alocação" **não é recuperável** no histórico dos pacientes que já
estão internados (a pré-admissão não persiste o vínculo com a internação, e não há evento
anterior confiável). Portanto, **apenas para esta leva**:

> **Data de internação hospitalar = Data de admissão no primeiro setor.**

Ou seja, `data_entrada` recebe o valor de `data_admissao_uti` (a admissão no primeiro setor,
que o dev já sincronizou). As duas ficam iguais nesta rodada. A separação real passa a valer
**a partir das próximas admissões** (seção 3).

Correção sugerida (o dev aplica no banco — nunca rodar sem revisar):

```sql
-- 1) Garante que a admissao no setor esta preenchida (deveria ja estar, pos-sincronizacao).
--    So preenche onde faltou, usando o que hoje existe como entrada.
update internacoes
   set data_admissao_uti = data_entrada
 where status = 'ativa'
   and data_admissao_uti is null;

-- 2) Internacao hospitalar = admissao no primeiro setor, SO para esta rodada.
--    Alinha data_entrada a admissao no setor onde elas divergem nos ativos.
update internacoes
   set data_entrada = data_admissao_uti
 where status = 'ativa'
   and data_admissao_uti is not null
   and data_entrada is distinct from data_admissao_uti;
```

Risco: médio — mexe na âncora do DIH de todos os internados. É reversível se houver backup do
estado anterior; por isso rodar uma `select` antes/depois comparando as duas colunas.

## 3. Regra para as próximas admissões (comportamento permanente)

A captura das duas datas passa a ser automática:

1. **Paciente entra em "aguardando alocação"** (criação da pré-admissão): carimba o instante.
   Esse timestamp é a **data de internação hospitalar**.
2. **Paciente é alocado no leito**: carimba o instante da alocação como **data de admissão no
   setor** (`data_admissao_uti`), e grava a **data de internação hospitalar** (`data_entrada`)
   com o timestamp da etapa 1 — **não** com o horário da alocação.
3. **Admissão direta** (sem passar pela fila de espera): as duas datas coincidem (data e hora),
   porque o aguardar e o alocar aconteceram no mesmo ato.

Ponto no código a ajustar (fluxo de alocação): `src/lib/alocarPreAdmissao.ts`.

- Hoje grava `data_entrada = <momento da alocação>` e não grava `data_admissao_uti`.
- Passa a gravar:
  - `data_admissao_uti = <momento da alocação>` (admissão no setor), **para todos os setores**,
    não só UTI;
  - `data_entrada = <timestamp da pré-admissão / aguardando alocação>`; se esse instante não
    estiver disponível, cai para o momento da alocação (as duas coincidem — nunca fica vazio).

Isso não cria coluna nova: o modelo já tem as duas colunas e a intenção já está documentada no
próprio código (`AdmissionDateEditor.tsx`, `EditPatientDialog.tsx` — "data_entrada dirige o DIH;
data_admissao_uti dirige o TPS/chip do setor").

## 4. Transferência interna (não confundir com admissão hospitalar)

- A transferência interna **preserva o número de atendimento** e **não reabre** o atendimento.
- A **data de internação hospitalar** (`data_entrada`) **não muda** numa transferência — o DIH
  continua contando desde a entrada no hospital.
- A **data de admissão no primeiro setor** (`data_admissao_uti`) fica registrada.
- A entrada **no setor atual** (após realocação) é o evento `conclusao_transferencia_interna`
  no histórico (`sectorSince`), que ancora o **TPS** do setor atual. É isso, e não `data_entrada`,
  que zera a cada mudança de setor.

## 5. Onde cada data aparece (acoplamentos)

| Superfície | Lê | Observação |
|---|---|---|
| Selo DIH no mapa de leitos | `data_entrada` (fallback `sectorSince` / `data_admissao_uti`) | `getMapDihAnchorDate` |
| Timeline Dn das evoluções / impressos | `data_entrada` (admissão hospitalar) | `getEffectiveAdmissionDate` — nunca usar a âncora do mapa aqui |
| Cabeçalho dos impressos ("Admissão no setor") | `data_admissao_uti || data_entrada` | `headerPatient.ts`, `printEvolution.ts`, `PrescricaoPage` |
| TPS (tempo de permanência no setor) | `sectorSince` (eventos de transferência) ou `data_admissao_uti` | resolvido em `usePatients` |
| Edição avançada do paciente | `data_entrada` (DIH) e `data_admissao_uti` (setor) como campos separados | `EditPatientDialog` / `AdmissionDateEditor` |

Depois do ajuste da seção 3, todas essas superfícies passam a ler a **fonte correta** sem mudança
de comportamento: o DIH conta da internação hospitalar, o TPS conta da admissão no setor.
