-- Balanco hidrico 24h (07:00 -> 07:00) — capitulo multiprofissional, etapa 4a.
--
-- Seguranca (RLS ligada, ao contrario das tabelas clinicas legadas):
--   leitura  : profissionais do hospital da internacao (ou super admin);
--   escrita  : tecnico e enfermeiro do hospital;
--   nada se apaga: lancamento errado e ANULADO (com motivo), nunca excluido;
--   fechamento: tecnico/enfermeiro fecha; so ENFERMEIRO valida; validado e final.
-- Autoria (registrado_por / fechado_por / validado_por) vem do usuario logado,
-- preenchida pelo banco — o cliente nao consegue assinar por outro profissional.
--
-- Reversivel com (perde os lancamentos e fechamentos gravados):
--   drop table if exists public.balanco_hidrico_fechamentos;
--   drop table if exists public.balanco_hidrico_lancamentos;
--   drop function if exists public.bh_lancamento_guarda();
--   drop function if exists public.bh_fechamento_guarda();
--   drop function if exists public.hospital_da_internacao(uuid);
--   drop function if exists public.profissional_do_usuario(uuid);

-- ── Helpers ────────────────────────────────────────────────────────────────
create or replace function public.hospital_da_internacao(_internacao_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select a.hospital_id
  from internacoes i
  join leitos l   on l.id = i.leito_id
  join setores s  on s.id = l.setor_id
  join alas a     on a.id = s.ala_id
  where i.id = _internacao_id
$$;

create or replace function public.profissional_do_usuario(_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from profissionais where user_id = _user_id and ativo = true
  order by criado_em limit 1
$$;

-- ── Lancamentos ────────────────────────────────────────────────────────────
create table if not exists public.balanco_hidrico_lancamentos (
  id uuid primary key default gen_random_uuid(),
  internacao_id uuid not null references public.internacoes(id),
  data_hora timestamptz not null,
  sentido text not null check (sentido in ('ganho', 'perda')),
  categoria text not null,
  origem text not null default 'manual' check (origem in ('manual', 'administracao', 'dieta', 'dispositivo')),
  origem_id uuid,
  volume_ml numeric(7,1) not null check (volume_ml > 0),
  descricao text,
  dispositivo_id uuid,
  registrado_por uuid not null default public.profissional_do_usuario(auth.uid()) references public.profissionais(id),
  anulado_em timestamptz,
  anulado_por uuid references public.profissionais(id),
  motivo_anulacao text,
  criado_em timestamptz not null default now(),
  constraint bh_lanc_anulacao_com_motivo check (anulado_em is null or (anulado_por is not null and coalesce(btrim(motivo_anulacao), '') <> ''))
);
create index if not exists bh_lanc_internacao_data_idx on public.balanco_hidrico_lancamentos (internacao_id, data_hora);

-- Update so para ANULAR (uma vez); nada mais muda.
create or replace function public.bh_lancamento_guarda()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.anulado_em is not null then
    raise exception 'Lançamento já anulado não pode ser alterado';
  end if;
  if new.internacao_id is distinct from old.internacao_id
     or new.data_hora is distinct from old.data_hora
     or new.sentido is distinct from old.sentido
     or new.categoria is distinct from old.categoria
     or new.origem is distinct from old.origem
     or new.origem_id is distinct from old.origem_id
     or new.volume_ml is distinct from old.volume_ml
     or new.descricao is distinct from old.descricao
     or new.dispositivo_id is distinct from old.dispositivo_id
     or new.registrado_por is distinct from old.registrado_por
     or new.criado_em is distinct from old.criado_em then
    raise exception 'Lançamento não é editável: anule e registre de novo';
  end if;
  if new.anulado_em is not null then
    new.anulado_por := public.profissional_do_usuario(auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists bh_lancamento_guarda on public.balanco_hidrico_lancamentos;
create trigger bh_lancamento_guarda before update on public.balanco_hidrico_lancamentos
  for each row execute function public.bh_lancamento_guarda();

-- ── Fechamentos ────────────────────────────────────────────────────────────
create table if not exists public.balanco_hidrico_fechamentos (
  id uuid primary key default gen_random_uuid(),
  internacao_id uuid not null references public.internacoes(id),
  periodo_inicio timestamptz not null,
  periodo_fim timestamptz not null,
  total_ganhos_ml numeric(8,1) not null,
  total_perdas_ml numeric(8,1) not null,
  perdas_insensiveis_ml numeric(7,1),
  incluir_insensiveis boolean not null default false,
  balanco_ml numeric(8,1) not null,
  diurese_ml_kg_h numeric(5,2),
  peso_usado_kg numeric(5,1),
  snapshot jsonb not null,
  fechado_por uuid not null default public.profissional_do_usuario(auth.uid()) references public.profissionais(id),
  fechado_em timestamptz not null default now(),
  validado_por uuid references public.profissionais(id),
  validado_em timestamptz,
  doc_code text,
  criado_em timestamptz not null default now(),
  unique (internacao_id, periodo_inicio)
);

-- Refechar so enquanto nao validado; validar so enfermeiro; validado e final.
create or replace function public.bh_fechamento_guarda()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.validado_em is not null then
    raise exception 'Balanço validado não pode ser alterado';
  end if;
  if new.validado_em is not null then
    if not public.tem_papel(auth.uid(), 'enfermeiro') and not public.eh_super_admin(auth.uid()) then
      raise exception 'Somente o enfermeiro valida o balanço hídrico';
    end if;
    new.validado_por := public.profissional_do_usuario(auth.uid());
  else
    -- refechamento: quem fechou agora
    new.fechado_por := public.profissional_do_usuario(auth.uid());
    new.fechado_em := now();
  end if;
  return new;
end $$;
drop trigger if exists bh_fechamento_guarda on public.balanco_hidrico_fechamentos;
create trigger bh_fechamento_guarda before update on public.balanco_hidrico_fechamentos
  for each row execute function public.bh_fechamento_guarda();

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.balanco_hidrico_lancamentos enable row level security;
alter table public.balanco_hidrico_fechamentos enable row level security;

drop policy if exists bh_lanc_select on public.balanco_hidrico_lancamentos;
create policy bh_lanc_select on public.balanco_hidrico_lancamentos for select to authenticated
  using (public.eh_super_admin(auth.uid())
         or public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid())));

drop policy if exists bh_lanc_insert on public.balanco_hidrico_lancamentos;
create policy bh_lanc_insert on public.balanco_hidrico_lancamentos for insert to authenticated
  with check (
    public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid()))
    and (public.tem_papel(auth.uid(), 'tecnico') or public.tem_papel(auth.uid(), 'enfermeiro'))
    and registrado_por = public.profissional_do_usuario(auth.uid())
    and anulado_em is null
  );

drop policy if exists bh_lanc_update on public.balanco_hidrico_lancamentos;
create policy bh_lanc_update on public.balanco_hidrico_lancamentos for update to authenticated
  using (
    public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid()))
    and (public.tem_papel(auth.uid(), 'tecnico') or public.tem_papel(auth.uid(), 'enfermeiro'))
  );

drop policy if exists bh_fech_select on public.balanco_hidrico_fechamentos;
create policy bh_fech_select on public.balanco_hidrico_fechamentos for select to authenticated
  using (public.eh_super_admin(auth.uid())
         or public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid())));

drop policy if exists bh_fech_insert on public.balanco_hidrico_fechamentos;
create policy bh_fech_insert on public.balanco_hidrico_fechamentos for insert to authenticated
  with check (
    public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid()))
    and (public.tem_papel(auth.uid(), 'tecnico') or public.tem_papel(auth.uid(), 'enfermeiro'))
    and fechado_por = public.profissional_do_usuario(auth.uid())
    and validado_em is null
  );

drop policy if exists bh_fech_update on public.balanco_hidrico_fechamentos;
create policy bh_fech_update on public.balanco_hidrico_fechamentos for update to authenticated
  using (
    public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid()))
    and (public.tem_papel(auth.uid(), 'tecnico') or public.tem_papel(auth.uid(), 'enfermeiro'))
  );

grant select, insert, update on public.balanco_hidrico_lancamentos to authenticated;
grant select, insert, update on public.balanco_hidrico_fechamentos to authenticated;

-- Tempo real: a tela do BH e o painel do enfermeiro atualizam sem recarregar.
do $$ begin
  begin alter publication supabase_realtime add table public.balanco_hidrico_lancamentos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.balanco_hidrico_fechamentos; exception when duplicate_object then null; end;
end $$;
