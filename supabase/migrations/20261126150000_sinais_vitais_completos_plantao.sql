-- Etapa 4c (capitulo multiprofissional): sinais vitais completos (A5) e leitos
-- do tecnico no plantao.
--
-- 1) sinais_vitais ganha O2 suplementar, FiO2, PVC, glicemia capilar e escala
--    de dor. Sem o2_suplementar o NEWS2 pode subestimar em 2 pontos: a tela
--    passa a mostrar "NEWS2 parcial" quando o dado falta. Colunas novas sao
--    opcionais: nenhuma escrita atual quebra. RLS da tabela legada NAO muda.
-- 2) plantao_leitos: leitos que o tecnico assume no inicio do turno (07-19 /
--    19-07). Alimenta o "Meu plantao" e a coluna "tecnico" do painel do
--    enfermeiro. RLS ligada: cada um registra/encerra os proprios leitos.
--
-- Reversivel com:
--   alter table public.sinais_vitais drop column if exists o2_suplementar,
--     drop column if exists fio2, drop column if exists pvc,
--     drop column if exists glicemia_capilar, drop column if exists dor_escala;
--   drop table if exists public.plantao_leitos;
--   drop function if exists public.plantao_leitos_guarda();

alter table public.sinais_vitais
  add column if not exists o2_suplementar boolean,
  add column if not exists fio2 numeric(4,2) check (fio2 is null or (fio2 >= 0.21 and fio2 <= 1)),
  add column if not exists pvc numeric(5,1),
  add column if not exists glicemia_capilar integer check (glicemia_capilar is null or (glicemia_capilar between 10 and 1000)),
  add column if not exists dor_escala integer check (dor_escala is null or (dor_escala between 0 and 10));

create table if not exists public.plantao_leitos (
  id uuid primary key default gen_random_uuid(),
  internacao_id uuid not null references public.internacoes(id),
  profissional_id uuid not null default public.profissional_do_usuario(auth.uid()) references public.profissionais(id),
  profissional_nome text,
  turno_inicio timestamptz not null,
  criado_em timestamptz not null default now(),
  encerrado_em timestamptz
);
create index if not exists plantao_leitos_turno_idx on public.plantao_leitos (turno_inicio, internacao_id);
create unique index if not exists plantao_leitos_unico_ativo on public.plantao_leitos (profissional_id, internacao_id, turno_inicio) where encerrado_em is null;

create or replace function public.plantao_leitos_guarda()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.profissional_nome := public.nome_profissional(new.profissional_id);
    return new;
  end if;
  if old.encerrado_em is not null then raise exception 'Leito já liberado'; end if;
  if new.internacao_id is distinct from old.internacao_id or new.profissional_id is distinct from old.profissional_id
     or new.turno_inicio is distinct from old.turno_inicio or new.criado_em is distinct from old.criado_em
     or new.profissional_nome is distinct from old.profissional_nome then
    raise exception 'Só é possível liberar o leito';
  end if;
  return new;
end $$;
drop trigger if exists plantao_leitos_guarda on public.plantao_leitos;
create trigger plantao_leitos_guarda before insert or update on public.plantao_leitos
  for each row execute function public.plantao_leitos_guarda();

alter table public.plantao_leitos enable row level security;

drop policy if exists pl_select on public.plantao_leitos;
create policy pl_select on public.plantao_leitos for select to authenticated
  using (public.eh_super_admin(auth.uid())
         or public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid())));

drop policy if exists pl_insert on public.plantao_leitos;
create policy pl_insert on public.plantao_leitos for insert to authenticated
  with check (
    public.hospital_da_internacao(internacao_id) in (select public.hospitais_do_usuario(auth.uid()))
    and (public.tem_papel(auth.uid(), 'tecnico') or public.tem_papel(auth.uid(), 'enfermeiro'))
    and profissional_id = public.profissional_do_usuario(auth.uid())
    and encerrado_em is null
  );

drop policy if exists pl_update on public.plantao_leitos;
create policy pl_update on public.plantao_leitos for update to authenticated
  using (profissional_id = public.profissional_do_usuario(auth.uid()));

grant select, insert, update on public.plantao_leitos to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.plantao_leitos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.sinais_vitais; exception when duplicate_object then null; end;
end $$;
