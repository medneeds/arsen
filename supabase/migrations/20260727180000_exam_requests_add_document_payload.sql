-- ════════════════════════════════════════════════════════════════════════
-- exam_requests: adiciona document_payload (snapshot do documento solicitado)
-- ════════════════════════════════════════════════════════════════════════
-- 27/07/2026. Fase 1 do plano de padronizar o ATO DE SOLICITAR (ficha geral,
-- APAC e AIH).
--
-- PROBLEMA QUE ESTA COLUNA RESOLVE
-- Os fluxos de APAC e AIH ja gravam em exam_requests, mas o que gravam e um
-- RASTRO, nao um documento. A linha guarda nome/leito/setor do paciente e
-- `items: [{ name }]`. Ficam de fora, entre outros:
--   - CID primario, secundario e associado
--   - diagnostico e observacoes
--   - CPF, CNS, nascimento, sexo, nome da mae, endereco do paciente
--   - CPF e CRM do medico solicitante
--
-- Consequencia pratica: hoje o documento so existe no instante em que e
-- impresso, direto do formulario preenchido. Depois disso nao ha como
-- reimprimi-lo — e um APAC sem CID nao e aceito pelo SUS.
--
-- Com o botao passando de "Imprimir" para "Solicitar", o registro deixa de ser
-- subproduto e vira o objetivo. Ele precisa carregar o suficiente para o
-- documento ser reemitido a partir do historico.
--
-- FORMATO (com versao, de proposito)
--   {
--     "kind":    "apac" | "aih" | "generica",
--     "version": 1,
--     "data":    { ...estado do formulario no momento da solicitacao... }
--   }
--
-- O `version` nao e enfeite: o formulario da AIH tem 33 campos e vai mudar.
-- Sem ele, acrescentar um campo daqui a dois meses quebraria a reimpressao de
-- tudo que ja foi gravado antes.
--
-- SNAPSHOT, NAO REFERENCIA: o conteudo e congelado no momento da solicitacao.
-- Se o endereco do paciente mudar amanha, o documento reimpresso NAO pode
-- mudar junto — ele registra um ato ocorrido numa data.
--
-- NULL = registro anterior a este fluxo. Esses caem na guia generica, que e o
-- comportamento atual e nao regride nada. NAO HA BACKFILL: nao existe de onde
-- reconstruir o que nunca foi gravado, e preencher por inferencia seria
-- inventar conteudo de documento assistencial.
--
-- RISCO: proximo de zero. Coluna anulavel, nenhuma linha alterada, nenhum
-- trigger, nenhuma policy tocada, nenhum default. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.exam_requests
  ADD COLUMN IF NOT EXISTS document_payload jsonb;

COMMENT ON COLUMN public.exam_requests.document_payload IS
  'Snapshot do documento solicitado, suficiente para reimprimi-lo a partir do '
  'historico. Formato { kind, version, data } — kind em (apac|aih|generica). '
  'NULL = solicitacao anterior a este fluxo, reimpressa pela guia generica.';

-- Indice parcial: as consultas do historico que se importam com este campo
-- perguntam "tem documento reemitivel?". O parcial mantem o indice pequeno,
-- ja que a grande maioria das linhas antigas permanece NULL para sempre.
CREATE INDEX IF NOT EXISTS idx_exam_requests_document_payload_kind
  ON public.exam_requests ((document_payload ->> 'kind'))
  WHERE document_payload IS NOT NULL;

-- ── Verificacao (rodar apos aplicar) ───────────────────────────────────────
-- git != banco: commitar esta migration NAO a aplica. Confirme no banco:
--
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name   = 'exam_requests'
--     AND column_name  = 'document_payload';
--
--   -- Deve retornar 0: a migration nao escreve em linha nenhuma.
--   SELECT count(*) FROM public.exam_requests WHERE document_payload IS NOT NULL;
--
--   -- O status operacional nao pode ter mudado.
--   SELECT status, count(*) FROM public.exam_requests GROUP BY status ORDER BY 2 DESC;
