-- Contexto diagnostico da internacao: precaucao/isolamento, paliativo e
-- previsao de alta hospitalar. Antes esses dados viviam so em memoria
-- (usePatientDiagnosticContext) e se perdiam ao recarregar; nao chegavam
-- ao mapa de leitos.
--
-- Parametrizacao das previsoes de alta (sao coisas diferentes):
--   previsao_alta             -> previsao de alta da UTI/UCI (coluna existente)
--   previsao_alta_hospitalar  -> previsao de alta hospitalar (nova)
--
-- Reversivel com:
--   alter table public.internacoes
--     drop column if exists precaucao_isolamento,
--     drop column if exists paliativo,
--     drop column if exists previsao_alta_hospitalar;
-- (perde o que tiver sido gravado nessas colunas)

alter table public.internacoes
  add column if not exists precaucao_isolamento text,
  add column if not exists paliativo boolean not null default false,
  add column if not exists previsao_alta_hospitalar text;

comment on column public.internacoes.previsao_alta is
  'Previsao de alta da UTI/UCI (data ISO yyyy-MM-dd). Alta hospitalar fica em previsao_alta_hospitalar.';
comment on column public.internacoes.previsao_alta_hospitalar is
  'Previsao de alta hospitalar (data ISO yyyy-MM-dd).';
comment on column public.internacoes.precaucao_isolamento is
  'Precaucao/isolamento vigente (texto livre, ex.: contato, goticulas, aerossois).';
comment on column public.internacoes.paliativo is
  'Paciente em cuidados paliativos.';
