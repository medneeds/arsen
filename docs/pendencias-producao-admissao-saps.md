# Pendências de produção — fluxo Admissão / SAPS / Intensivo

> Lista de dependências para ajuste, levantada a partir de relatos em produção (hmdm.arsen.com.br).
> Diagnóstico por leitura do código real. Nada aplicado sem autorização caso a caso.

## A. Admissão não é direcionada pelo tipo de setor (intensivo x enfermaria)

- **Relato:** leito intensivo (ex.: UTI 2 leito 13) abre admissão como Enfermaria Clínico-Cirúrgica,
  não como Cuidados Intensivos. Intensivos = UTI 1, UTI 2, UCI 2.
- **Causa-raiz:** `src/lib/sectorComplexity.ts:145` `admissionModeForSector` exige **correspondência
  EXATA do código** contra `ADMISSION_UTI_SECTORS = ["red","yellow","outside","uti_01","uti_02","uci_02"]`
  ("sem trim/lowercase", comentário linha 142-144). Quando `patient.sector` chega como **nome/rótulo**
  ("UTI 2") em vez do código, não casa → cai em `"enfermaria"`. `pathwayFromSector`
  (`AdmissionForm.tsx:454`) herda o erro. Mesma classe do bug código-vs-nome já corrigido na fila.
- **Correção proposta:** normalizar o setor com `resolveSectorCode` (já trata código/rótulo/departamento)
  antes do match em `admissionModeForSector` (e checar `isSurgicalSector` / gate SAPS pela mesma via).
- **Risco:** baixo-médio (fluxo clínico de admissão). Exige simulação de casos de borda por setor.
- **UCI 1:** hoje **NÃO** é intensivo para admissão (nível 3 "intermediário"; fora de
  `ADMISSION_UTI_SECTORS` e de `SAPS_SECTORS`). Incluir UCI 1 no intensivo é **decisão clínica do Artur**,
  não alteração técnica — fica pendente de definição.

## B. Admissão validada não aparece na visualização não-editável (fica em enfermaria)

- **Relato:** ao validar, o PDF saiu correto com os campos ajustados, mas a admissão não ficou
  validada no formato de visualização não-editável e permaneceu em Enfermaria Clínico-Cirúrgica.
- **Hipótese (forte, a confirmar):** consequência direta de (A). A admissão foi gravada com
  `soap.__admission_mode = "enfermaria"` (via errada), então a visualização read-only
  (`AdmissaoReadOnlyView`) a mostra sob enfermaria; e, por não ter entrado no modo UTI, o estado
  "validado intensivo" (ligado ao SAPS) não se formou.
- **A confirmar:** gating da `AdmissaoReadOnlyView` e como `AdmissaoPage` decide read-only x editável.
  Provável que corrigir (A) resolva (B); confirmar na implementação.

## C. Ficha SAPS acusa "nome do paciente pendente" com paciente já reconhecido

- **Relato:** no preenchimento da ficha SAPS, diz que o nome do paciente está pendente mesmo com o
  paciente reconhecido; não consome a informação do prontuário; trava validação E o salvar como
  rascunho (aproveitamento).
- **Causa-raiz confirmada:** `src/pages/Saps3Page.tsx:643`, no caminho "Completar SAPS pendente de
  paciente JÁ ADMITIDO", `namePref = patientNameFromContext || ""` — o nome vem só do contexto da
  navegação, **nunca do banco**. `avaliacoes_saps3` não tem coluna de nome (migração) e esse caminho
  não faz o join com `pacientes`. Se o contexto não trouxe o nome → vazio → campo obrigatório falha →
  trava validação e rascunho.
- **Correção proposta:** quando `namePref` vier vazio, buscar o nome no banco pelo
  `internacao_id`/`patientId` via join `internacoes → pacientes` (`nome_social || nome_completo`) —
  o mesmo join já usado na linha 541/549. Fallback ao contexto.
- **Risco:** baixo, mas é **identificação de paciente** → exige simulação de casos de borda antes do push.

## D. Templates de admissão não aparecem após a atualização (depende do banco)

- **Relato:** o histórico do banco de dados dos templates de admissão não está aparecendo na nova
  atualização.
- **Status:** a investigar — provável baixa na migração (tabela/coluna de templates não migrada, ou
  query filtrando por chave que mudou). **Dependência de banco:** confirmar o estado real em produção
  (Artur roda consulta), já que "git ≠ banco" e não concluo o estado do banco pelo código.
- **Próximo passo:** localizar onde os templates de admissão são gravados/lidos no código e preparar a
  consulta de diagnóstico para o Artur.

---

### Ordem sugerida
1. **C** (bloqueador clínico ativo: trava SAPS) — correção isolada em `Saps3Page.tsx`.
2. **A** (roteamento por setor) — correção em `sectorComplexity.ts`; confirmar que resolve **B**.
3. **D** — investigar templates (depende de diagnóstico de banco com o Artur).
4. **UCI 1** no intensivo — aguarda definição clínica do Artur.
