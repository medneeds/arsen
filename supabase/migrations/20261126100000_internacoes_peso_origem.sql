-- Peso de referencia com origem e data (capitulo multiprofissional, etapa 3).
-- internacoes.peso_kg ja existe e e a fonte unica do peso (prescricao, impressos,
-- nutricao, BH, Fugulin, AIH). Aqui entram a ORIGEM do valor e o momento do registro,
-- e a altura (para IMC/GET na nutricao).
--
-- Reversivel com:
--   alter table public.internacoes
--     drop column if exists peso_origem,
--     drop column if exists peso_aferido_em,
--     drop column if exists altura_cm;
-- (perde o que tiver sido gravado nessas colunas)

alter table public.internacoes
  add column if not exists peso_origem text
    check (peso_origem in ('aferido', 'estimado', 'referido')),
  add column if not exists peso_aferido_em timestamptz,
  add column if not exists altura_cm numeric(5,1);

comment on column public.internacoes.peso_origem is
  'Como o peso_kg foi obtido: aferido (balanca), estimado ou referido (informado). Nulo = nao informado.';
comment on column public.internacoes.peso_aferido_em is
  'Momento do registro do peso_kg vigente.';
comment on column public.internacoes.altura_cm is
  'Altura em centimetros (admissao/nutricao).';
