-- Aprazamento HMDM e checagem — capitulo multiprofissional, etapa 4b.
--
-- aprazamentos   : horario de cada dose de um item da prescricao ativa, na
--                  vigencia 12h -> 12h. So o ENFERMEIRO apraza e cancela
--                  (reaprazamento/suspensao). Nada se apaga: cancela com motivo.
-- administracoes : checagem da dose (realizado / nao realizado). Tecnico ou
--                  enfermeiro. "Nao realizado" exige motivo. MAV exige dupla
--                  checagem por OUTRO profissional, no login dele.
--                  Dose realizada com volume gera, no banco, o ganho no balanco
--                  hidrico (origem = 'administracao'); anular a checagem anula
--                  o ganho. A tela nao lanca o volume duas vezes.
-- Autoria e nomes vem do usuario logado, preenchidos pelo banco (o colega nao
-- le a tabela profissionais, entao o nome fica gravado na linha).
--
-- Reversivel com (perde aprazamentos e checagens gravados):
--   drop table if exists public.administracoes;
--   drop table if exists public.aprazamentos;
--   drop function if exists public.apz_guarda();
--   drop function if exists public.adm_guarda();
--   drop function if exists public.adm_gera_bh();
--   drop function if exists public.nome_profissional(uuid);

create or replace function public.nome_profissional(_profissional_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select nome from profissionais where id = _profissional_id
$$;

-- ── Aprazamentos ───────────────────────────────────────────────────────────
create table if not exists public.aprazamentos (
  id uuid primary key default gen_random_uuid(),
  internacao_id uuid not null references public.internacoes(id),
  prescricao_id uuid not null references public.prescricoes(id),
  item_id text not null,
  item_nome text not null,
  item_resumo text,
  janela_inicio timestamptz not null,
  horario timestamptz not null,
  modo text not null check (modo in ('padrao', 'alternativo', 'livre', 'agora', 'prescricao')),
  motivo text,
  mav boolean not null default false,
  volume_ml numeric(7,1) check (volume_ml is null or volume_ml > 0),
  bh_categoria text,
  aprazado_por uuid not null default public.profissional_do_usuario(auth.uid()) references public.profissionais(id),
  aprazado_por_nome text,
  aprazado_em timestamptz not null default now(),
  cancelado_em timestamptz,
  cancelado_por uuid references public.profissionais(id),
  cancelado_por_nome text,
  motivo_cancelamento text,
  constraint apz_horario_na_janela check (horario >= janela_inicio and horario < janela_inicio + interval '24 hours'),
  constraint apz_cancelamento_com_motivo check (cancelado_em is null or (cancelado_por is not null and coalesce(btrim(motivo_cancelamento), '') <> ''))
);
create index if not exists apz_internacao_janela_idx on public.aprazamentos (internacao_id, janela_inicio);
create unique index if not exists apz_unico_ativo on public.aprazamentos (internacao_id, item_id, horario) where cancelado_em is null;

create or replace function public.apz_guarda()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.aprazado_por_nome := public.nome_profissional(new.aprazado_por);
    if not exists (select 1 from prescricoes p where p.id = new.prescricao_id and p.internacao_id = new.internacao_id) then
      raise exception 'Prescrição não pertence a esta internação';
    end if;
    return new;
  end if;
  if old.cancelado_em is not null then
    raise exception 'Horário cancelado não pode ser alterado';
  end if;
  if new.internacao_id is distinct from old.internacao_id or new.prescricao_id is distinct from old.prescricao_id
     or new.item_id is distinct from old.item_id or new.item_nome is distinct from old.item_nome
     or new.item_resumo is distinct from old.item_resumo
     or new.janela_inicio is distinct from old.janela_inicio or new.horario is distinct from old.horario
     or new.modo is distinct from old.modo or new.motivo is distinct from old.motivo or new.mav is distinct from old.mav
     or new.volume_ml is distinct from old.volume_ml or new.bh_categoria is distinct from old.bh_categoria
     or new.aprazado_por is distinct from old.aprazado_por or new.aprazado_em is distinct from old.aprazado_em then
    raise exception 'Aprazamento não é editável: cancele o horário e aprace de novo';
  end if;
  if new.cancelado_em is not null then
    new.cancelado_por := public.profissional_do_usuario(auth.uid());
    new.cancelado_por_nome := public.nome_profissional(new.cancelado_por);
  end if;
  return new;
end $$;
drop trigger if exists apz_guarda on public.aprazamentos;
create trigger apz_guarda before insert or update on public.aprazamentos
  for each row execute function public.apz_guarda();

-- ── Administracoes (checagem) ──────────────────────────────────────────────
create table if not exists public.administracoes (
  id uuid primary key default gen_random_uuid(),
  internacao_id uuid not null references public.internacoes(id),
  aprazamento_id uuid references public.aprazamentos(id),
  prescricao_id uuid not null references public.prescricoes(id),
  item_id text not null,
  item_nome text not null,
  status text not null check (status in ('realizado', 'nao_realizado')),
  realizado_em timestamptz not null,
  motivo text,
  volume_ml numeric(7,1) check (volume_ml is null or volume_ml > 0),
  bh_categoria text,
  mav boolean not null default false,
  registrado_por uuid not null default public.profissional_do_usuario(auth.uid()) references public.profissionais(id),
  registrado_por_nome text,
  dupla_checagem_por uuid references public.profissionais(id),
  dupla_checagem_por_nome text,
  dupla_checagem_em timestamptz,
  anulado_em timestamptz,
  anulado_por uuid references public.profissionais(id),
  motivo_anulacao text,
  criado_em timestamptz not null default now(),
  constraint adm_nao_realizado_com_motivo check (status = 'realizado' or coalesce(btrim(motivo), '') <> ''),
  -- dose fora do aprazamento (S/N, dose avulsa) exige justificativa
  constraint adm_avulsa_com_motivo check (aprazamento_id is not null or coalesce(btrim(motivo), '') <> ''),
  constraint adm_anulacao_com_motivo check (anulado_em is null or (anulado_por is not null and coalesce(btrim(motivo_anulacao), '') <> ''))
);
create index if not exists adm_internacao_data_idx on public.administracoes (internacao_id, realizado_em);
create unique index if not exists adm_unica_por_horario on public.administracoes (aprazamento_id) where anulado_em is null and aprazamento_id is not null;

create or replace function public.adm_guarda()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if tg_op = 'INSERT' then
    if new.realizado_em > now() + interval '10 minutes' then
      raise exception 'Checagem não pode ter horário no futuro';
    end if;
    if new.aprazamento_id is not null then
      select * into a from aprazamentos where id = new.aprazamento_id;
      if a.id is null or a.internacao_id <> new.internacao_id then
        raise exception 'Horário aprazado não pertence a esta internação';
      end if;
      if a.cancelado_em is not null then
        raise exception 'Horário cancelado não pode ser checado';
      end if;
      new.mav := new.mav or a.mav;
    end if;
    new.registrado_por_nome := public.nome_profissional(new.registrado_por);
    new.dupla_checagem_por := null; new.dupla_checagem_por_nome := null; new.dupla_checagem_em := null;
    return new;
  end if;
  -- UPDATE: so dupla checagem (uma vez, outro profissional) ou anulacao.
  if old.anulado_em is not null then
    raise exception 'Checagem anulada não pode ser alterada';
  end if;
  if new.internacao_id is distinct from old.internacao_id or new.aprazamento_id is distinct from old.aprazamento_id
     or new.prescricao_id is distinct from old.prescricao_id or new.item_id is distinct from old.item_id
     or new.item_nome is distinct from old.item_nome or new.status is distinct from old.status
     or new.realizado_em is distinct from old.realizado_em or new.motivo is distinct from old.motivo
     or new.volume_ml is distinct from old.volume_ml or new.bh_categoria is distinct from old.bh_categoria
     or new.mav is distinct from old.mav or new.registrado_por is distinct from old.registrado_por
     or new.criado_em is distinct from old.criado_em then
    raise exception 'Checagem não é editável: anule e registre de novo';
  end if;
  if new.dupla_checagem_em is not null and old.dupla_checagem_em is null then
    if not old.mav then raise exception 'Dupla checagem só se aplica a medicamento de alta vigilância'; end if;
    if old.status <> 'realizado' then raise exception 'Dupla checagem só em dose realizada'; end if;
    new.dupla_checagem_por := public.profissional_do_usuario(auth.uid());
    if new.dupla_checagem_por is null or new.dupla_checagem_por = old.registrado_por then
      raise exception 'A dupla checagem deve ser feita por outro profissional';
    end if;
    new.dupla_checagem_por_nome := public.nome_profissional(new.dupla_checagem_por);
    new.dupla_checagem_em := now();
  elsif new.dupla_checagem_em is distinct from old.dupla_checagem_em
        or new.dupla_checagem_por is distinct from old.dupla_checagem_por then
    raise exception 'Dupla checagem já registrada';
  else
    new.dupla_checagem_por := old.dupla_checagem_por;
    new.dupla_checagem_por_nome := old.dupla_checagem_por_nome;
  end if;
  if new.anulado_em is not null then
    new.anulado_por := public.profissional_do_usuario(auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists adm_guarda on public.administracoes;
create trigger adm_guarda before insert or update on public.administracoes
  for each row execute function public.adm_guarda();

-- Ganho automatico no BH (fonte: a checagem). Anular a checagem anula o ganho.
create or replace function public.adm_gera_bh()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'realizado' and new.volume_ml is not null and new.volume_ml > 0 and new.bh_categoria is not null then
      insert into balanco_hidrico_lancamentos (internacao_id, data_hora, sentido, categoria, origem, origem_id, volume_ml, descricao, registrado_por)
      values (new.internacao_id, new.realizado_em, 'ganho', new.bh_categoria, 'administracao', new.id, new.volume_ml, new.item_nome, new.registrado_por);
    end if;
  elsif new.anulado_em is not null and old.anulado_em is null then
    update balanco_hidrico_lancamentos
       set anulado_em = now(), motivo_anulacao = 'Checagem anulada: ' || new.motivo_anulacao
     where origem = 'administracao' and origem_id = new.id and anulado_em is null;
  end if;
  return null;
end $$;
drop trigger if exists adm_gera_bh on public.administracoes;
create trigger adm_gera_bh after insert or update on public.administracoes
  for each row execute function public.adm_gera_bh();

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.aprazamentos enable row level security;
alter table public.administracoes enable row level security;

drop policy if exists apz_select on public.aprazamentos;
create policy apz_select on public.aprazamentos for select to authenticated
  using (public.eh_super_admin(auth.uid())
         or public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid())));

drop policy if exists apz_insert on public.aprazamentos;
create policy apz_insert on public.aprazamentos for insert to authenticated
  with check (
    public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid()))
    and public.tem_papel(auth.uid(), 'enfermeiro')
    and aprazado_por = public.profissional_do_usuario(auth.uid())
    and cancelado_em is null
  );

drop policy if exists apz_update on public.aprazamentos;
create policy apz_update on public.aprazamentos for update to authenticated
  using (
    public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid()))
    and public.tem_papel(auth.uid(), 'enfermeiro')
  );

drop policy if exists adm_select on public.administracoes;
create policy adm_select on public.administracoes for select to authenticated
  using (public.eh_super_admin(auth.uid())
         or public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid())));

drop policy if exists adm_insert on public.administracoes;
create policy adm_insert on public.administracoes for insert to authenticated
  with check (
    public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid()))
    and (public.tem_papel(auth.uid(), 'tecnico') or public.tem_papel(auth.uid(), 'enfermeiro'))
    and registrado_por = public.profissional_do_usuario(auth.uid())
    and anulado_em is null
  );

drop policy if exists adm_update on public.administracoes;
create policy adm_update on public.administracoes for update to authenticated
  using (
    public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid()))
    and (public.tem_papel(auth.uid(), 'tecnico') or public.tem_papel(auth.uid(), 'enfermeiro'))
  );

grant select, insert, update on public.aprazamentos to authenticated;
grant select, insert, update on public.administracoes to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.aprazamentos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.administracoes; exception when duplicate_object then null; end;
end $$;
