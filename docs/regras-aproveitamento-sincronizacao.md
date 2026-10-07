# Regras de aproveitamento — sincronizacao Producao -> Teste

Objetivo: quando os pacientes da producao forem sincronizados para o ambiente de
teste (schema novo, pt-BR), o **aproveitamento inteligente da admissao** deve
preencher 100% dos campos ao abrir uma nova admissao de via. Este documento e o
contrato que a ETL deve respeitar (o que gravar e onde) para que o codigo leia tudo.

O codigo que consome estas regras:
- `src/lib/admissionSoapNormalizer.ts` — desmembra o `soap` da admissao campo a campo.
- `src/lib/seedAdmission.ts` — escolhe a fonte (admissao D0 > colunas de internacoes
  > ultima evolucao) e monta o pre-preenchimento.
- `src/components/admission/AdmissionForm.tsx` — aplica no formulario (so campo vazio).

---

## 1. Data de admissao hospitalar (REGRA)

- Fonte canonica: **`internacoes.data_entrada`** = data/hora da admissao HOSPITALAR,
  que corresponde a entrada no **primeiro setor** do atendimento.
- **Regra de fallback (Artur):** quando a fonte da data de admissao hospitalar NAO
  estiver detalhada na producao, sincronizar `data_entrada` com a **data de admissao
  no primeiro setor reconhecido no numero de atendimento ATIVO** do paciente.
- `data_entrada` NAO reinicia em transferencia interna (a internacao reusa a mesma
  linha). A DIH (Dias de Internacao Hospitalar) conta do `data_entrada` de ponta a
  ponta; o tempo de setor (TPS) e outra coisa (reinicia por transferencia).
- `internacoes.data_admissao_uti` = entrada na UTI (quando houver), separada da
  admissao hospitalar.

> Exemplo real (OSIMAR, atend 128): data_entrada 08/07, data_admissao_uti 27/09.
> A admissao da UTI cai em D81 — correto, 81 dias apos a entrada no hospital.

---

## 2. Contrato por campo da admissao (o que a ETL deve gravar)

Fonte primaria = evolucao de ADMISSAO (D0): a 1a evolucao da internacao.

| Campo do formulario | Onde gravar (fonte primaria) | Formato |
|---|---|---|
| HDA (historia admissional) | `evolucoes(D0).soap.subjective` | comeca com `HDA:\n<texto>` e depois `\n\nAMP: ...\nMUC: ...\nAlergias: ...` |
| Exames complementares (lab) | dentro da HDA, linha `Lab admissional: ...` OU `internacoes.exames_relevantes` | texto |
| Antecedentes (AMP) | `soap.subjective` linha `AMP: a, b` OU `soap.antecedentes` (array) | string separada por virgula, ou array |
| MUC (medicacoes de uso continuo) | `soap.subjective` linha `MUC: ...` | texto |
| Alergias | `soap.subjective` linha `Alergias: ...` | texto |
| CID primario | `soap.__cid_primary` | `CODIGO - descricao` |
| CID secundario | `soap.__cid_secondary` | string ou array de `CODIGO - descricao` |
| Hipoteses diagnosticas | `soap.__diagnostic_hypotheses` (texto, 1 por linha) OU `soap.diagnosticHypotheses` (array) | **nao** gravar como JSON-array dentro de string (o codigo desempacota, mas evite) |
| Plano terapeutico | `soap.plan` (linhas) OU `soap.planItems` (array) | `Previsao de alta: ...` separada no fim |
| Exame fisico | **coluna** `evolucoes.exame_fisico` (objeto) | `{general, cardiovascular, respiratory, abdomen, neurological, extremities, skin, other}` |
| Peso / Altura | `soap.objective` | `Antropometria: peso X kg, altura Y m` |

Estado ATUAL (lido da ULTIMA evolucao, nao da admissao):

| Campo | Fonte |
|---|---|
| Sinais vitais | `soap.__vital_signs` = `{pa:"120/80", fc, fr, temp, spo2, glasgow_ovm:{ocular,verbal,motora}}` |
| Dispositivos | `soap.devices` (array estruturado `{label, detail}`) |
| Culturas / Antibioticos | `soap.culturesHtml`, `soap.antibioticos` |

---

## 3. Marcador da evolucao de admissao

- Recomendado: gravar **`soap.__evolution_type = "admission"`** na evolucao de admissao.
- Se a ETL NAO conseguir gravar esse marcador, o codigo ja trata a **evolucao mais
  antiga da internacao** como admissao, DESDE QUE o `subjective` contenha uma `HDA`.
  (robustez ja no `seedAdmission.ts`).

---

## 4. O que o codigo ja tolera (nao precisa a ETL normalizar)

- `soap` em **HTML** (ex.: `<p><b>HDA:</b> ...</p>`) ou texto puro.
- Lab digitado dentro da HDA — e separado automaticamente para Exames complementares.
- Hipotese/antecedente gravados como **JSON-array dentro de uma string**
  (`["a","b"]`) — sao desempacotados.
- `AMP/MUC/Alergias` com `—` (sem valor) — viram vazio, nao lixo.
- HDA vazia — nao arrasta AMP/MUC para a historia.
- Datas invalidas/nulas — nao derrubam a timeline (blindado).

---

## 5. Checklist para a ETL

1. [ ] `internacoes.data_entrada` preenchido pela regra da secao 1 (1o setor do
       atendimento ativo quando a fonte nao estiver detalhada).
2. [ ] Evolucao de admissao (D0) com `soap.__evolution_type = "admission"`.
3. [ ] `soap.subjective` no formato `HDA:\n...\n\nAMP: ...\nMUC: ...\nAlergias: ...`.
4. [ ] `soap.__cid_primary` / `__diagnostic_hypotheses` preenchidos (evitar JSON em string).
5. [ ] `evolucoes.exame_fisico` (coluna) com os 8 topicos.
6. [ ] `soap.objective` com `Antropometria: peso X kg, altura Y m`.
7. [ ] NAO gravar antecedente na coluna `internacoes.historia_clinica` (ela e a HDA).

---

## 6. Pendencias (preciso para fechar)

- **Amostra de 1 paciente da producao** (o `soap` bruto da admissao + colunas de
  `internacoes`) para validar/estender o parsing a formatos especificos da producao.
- **Fonte da "data de admissao no 1o setor"** no modelo atual (logs de transferencia?
  evolucao mais antiga? data_admissao_uti?) para eu escrever o SQL de backfill da
  regra da secao 1 com seguranca.
