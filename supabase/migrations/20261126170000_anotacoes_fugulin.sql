-- Etapa 4d (capitulo multiprofissional): anotacoes de enfermagem e
-- classificacao do cuidado (Fugulin).
--
-- anotacoes_enfermagem (tipos):
--   anotacao_tecnico    — tecnico ou enfermeiro
--   intercorrencia      — tecnico ou enfermeiro; fica ABERTA ate o enfermeiro
--                         registrar ciencia/conduta (painel do setor acende)
--   evolucao_enfermeiro — so enfermeiro (exame por sistemas, Braden, Morse, SAE)
--   sae                 — so enfermeiro
--   Nada se apaga: anotacao errada e ANULADA com motivo. Conteudo nao muda
--   depois de registrado. Autoria e nome preenchidos pelo banco.
-- classificacoes_cuidado: Fugulin, uma por internacao por dia; so enfermeiro;
--   pode ser refeita no mesmo dia (update), autoria atualizada pelo banco.
--
-- Reversivel com:
--   drop table if exists public.anotacoes_enfermagem;
--   drop table if exists public.classificacoes_cuidado;
--   drop function if exists public.anot_guarda();
--   drop function if exists public.fugulin_guarda();

create table if not exists public.anotacoes_enfermagem (
  id uuid primary key default gen_random_uuid(),
  internacao_id uuid not null references public.internacoes(id),
  data_hora timestamptz not null,
  tipo text not null check (tipo in ('anotacao_tecnico', 'evolucao_enfermeiro', 'intercorrencia', 'sae')),
  conteudo jsonb not null,
  texto_gerado text not null check (btrim(texto_gerado) <> ''),
  status text not null default 'registrado' check (status in ('rascunho', 'registrado', 'validado')),
  registrado_por uuid not null default public.profissional_do_usuario(auth.uid()) references public.profissionais(id),
  registrado_por_nome text,
  validado_por uuid references public.profissionais(id),
  validado_em timestamptz,
  -- intercorrencia: ciencia/conduta do enfermeiro
  ciencia_por uuid references public.profissionais(id),
  ciencia_por_nome text,
  ciencia_em timestamptz,
  ciencia_conduta text,
  doc_code text,
  anulado_em timestamptz,
  anulado_por uuid references public.profissionais(id),
  motivo_anulacao text,
  criado_em timestamptz not null default now(),
  constraint anot_anulacao_com_motivo check (anulado_em is null or (anulado_por is not null and coalesce(btrim(motivo_anulacao), '') <> '')),
  constraint anot_ciencia_so_intercorrencia check (ciencia_em is null or tipo = 'intercorrencia')
);
create index if not exists anot_internacao_data_idx on public.anotacoes_enfermagem (internacao_id, data_hora);

create or replace function public.anot_guarda()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.tipo in ('evolucao_enfermeiro', 'sae') and not public.tem_papel(auth.uid(), 'enfermeiro') then
      raise exception 'Evolução e SAE são do enfermeiro';
    end if;
    if new.data_hora > now() + interval '10 minutes' then
      raise exception 'Anotação não pode ter horário no futuro';
    end if;
    new.registrado_por_nome := public.nome_profissional(new.registrado_por);
    new.validado_por := null; new.validado_em := null;
    new.ciencia_por := null; new.ciencia_por_nome := null; new.ciencia_em := null; new.ciencia_conduta := null;
    return new;
  end if;
  if old.anulado_em is not null then raise exception 'Anotação anulada não pode ser alterada'; end if;
  if new.internacao_id is distinct from old.internacao_id or new.data_hora is distinct from old.data_hora
     or new.tipo is distinct from old.tipo or new.conteudo is distinct from old.conteudo
     or new.texto_gerado is distinct from old.texto_gerado or new.registrado_por is distinct from old.registrado_por
     or new.registrado_por_nome is distinct from old.registrado_por_nome or new.criado_em is distinct from old.criado_em
     or new.doc_code is distinct from old.doc_code then
    raise exception 'Anotação não é editável: anule e registre de novo';
  end if;
  -- ciencia da intercorrencia: so enfermeiro, uma vez
  if new.ciencia_em is not null and old.ciencia_em is null then
    if not public.tem_papel(auth.uid(), 'enfermeiro') then raise exception 'Só o enfermeiro registra ciência da intercorrência'; end if;
    if coalesce(btrim(new.ciencia_conduta), '') = '' then raise exception 'Informe a conduta'; end if;
    new.ciencia_por := public.profissional_do_usuario(auth.uid());
    new.ciencia_por_nome := public.nome_profissional(new.ciencia_por);
    new.ciencia_em := now();
  elsif new.ciencia_em is distinct from old.ciencia_em or new.ciencia_conduta is distinct from old.ciencia_conduta
        or new.ciencia_por is distinct from old.ciencia_por then
    raise exception 'Ciência já registrada';
  end if;
  -- validacao: so enfermeiro, uma vez
  if new.validado_em is not null and old.validado_em is null then
    if not public.tem_papel(auth.uid(), 'enfermeiro') then raise exception 'Só o enfermeiro valida'; end if;
    new.validado_por := public.profissional_do_usuario(auth.uid());
    new.validado_em := now();
    new.status := 'validado';
  elsif new.validado_em is distinct from old.validado_em or new.validado_por is distinct from old.validado_por
        or new.status is distinct from old.status then
    raise exception 'Validação já registrada';
  end if;
  if new.anulado_em is not null then
    new.anulado_por := public.profissional_do_usuario(auth.uid());
    if old.registrado_por <> new.anulado_por and not public.tem_papel(auth.uid(), 'enfermeiro') then
      raise exception 'Só o autor ou o enfermeiro anula a anotação';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists anot_guarda on public.anotacoes_enfermagem;
create trigger anot_guarda before insert or update on public.anotacoes_enfermagem
  for each row execute function public.anot_guarda();

create table if not exists public.classificacoes_cuidado (
  id uuid primary key default gen_random_uuid(),
  internacao_id uuid not null references public.internacoes(id),
  data date not null,
  escore integer not null check (escore between 12 and 48),
  categoria text not null check (categoria in ('cuidados_minimos', 'cuidados_intermediarios', 'alta_dependencia', 'cuidados_semi_intensivos', 'cuidados_intensivos')),
  respostas jsonb not null,
  registrado_por uuid not null default public.profissional_do_usuario(auth.uid()) references public.profissionais(id),
  registrado_por_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (internacao_id, data)
);

create or replace function public.fugulin_guarda()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.internacao_id is distinct from old.internacao_id or new.data is distinct from old.data then
      raise exception 'Classificação: paciente e data não mudam';
    end if;
    new.registrado_por := public.profissional_do_usuario(auth.uid());
    new.criado_em := old.criado_em;
    new.atualizado_em := now();
  end if;
  new.registrado_por_nome := public.nome_profissional(new.registrado_por);
  return new;
end $$;
drop trigger if exists fugulin_guarda on public.classificacoes_cuidado;
create trigger fugulin_guarda before insert or update on public.classificacoes_cuidado
  for each row execute function public.fugulin_guarda();

alter table public.anotacoes_enfermagem enable row level security;
alter table public.classificacoes_cuidado enable row level security;

drop policy if exists anot_select on public.anotacoes_enfermagem;
create policy anot_select on public.anotacoes_enfermagem for select to authenticated
  using (public.eh_super_admin(auth.uid())
         or public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid())));
drop policy if exists anot_insert on public.anotacoes_enfermagem;
create policy anot_insert on public.anotacoes_enfermagem for insert to authenticated
  with check (
    public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid()))
    and (public.tem_papel(auth.uid(), 'tecnico') or public.tem_papel(auth.uid(), 'enfermeiro'))
    and registrado_por = public.profissional_do_usuario(auth.uid())
    and anulado_em is null
  );
drop policy if exists anot_update on public.anotacoes_enfermagem;
create policy anot_update on public.anotacoes_enfermagem for update to authenticated
  using (
    public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid()))
    and (public.tem_papel(auth.uid(), 'tecnico') or public.tem_papel(auth.uid(), 'enfermeiro'))
  );

drop policy if exists fug_select on public.classificacoes_cuidado;
create policy fug_select on public.classificacoes_cuidado for select to authenticated
  using (public.eh_super_admin(auth.uid())
         or public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid())));
drop policy if exists fug_insert on public.classificacoes_cuidado;
create policy fug_insert on public.classificacoes_cuidado for insert to authenticated
  with check (
    public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid()))
    and public.tem_papel(auth.uid(), 'enfermeiro')
    and registrado_por = public.profissional_do_usuario(auth.uid())
  );
drop policy if exists fug_update on public.classificacoes_cuidado;
create policy fug_update on public.classificacoes_cuidado for update to authenticated
  using (
    public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid()))
    and public.tem_papel(auth.uid(), 'enfermeiro')
  );

grant select, insert, update on public.anotacoes_enfermagem to authenticated;
grant select, insert, update on public.classificacoes_cuidado to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.anotacoes_enfermagem; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.classificacoes_cuidado; exception when duplicate_object then null; end;
end $$;
