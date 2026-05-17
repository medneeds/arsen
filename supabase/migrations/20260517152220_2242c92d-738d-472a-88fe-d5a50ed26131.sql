-- ============================================================================
-- RPC: scan_duplicate_registries
-- Varredura de duplicatas de patient_registry por critérios determinísticos.
-- Retorna grupos de duplicatas com regra aplicada (R1..R6), setor atual,
-- contagens clínicas e snapshot didático de cada membro.
-- Restrito a admin/dev/gestor.
-- ============================================================================

create extension if not exists pg_trgm;

create or replace function public.scan_duplicate_registries(
  p_sector_code text default null,
  p_rules text[] default array['R1','R2','R3','R4','R5'],
  p_include_similarity boolean default false,
  p_similarity_threshold double precision default 0.85,
  p_limit_groups int default 200
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_is_dev boolean := false;
  v_is_gestor boolean := false;
  v_result jsonb;
begin
  -- Authorization
  v_is_admin := public.has_role(v_uid, 'admin'::app_role);
  v_is_dev   := public.has_role(v_uid, 'dev'::app_role);
  begin
    v_is_gestor := public.has_role(v_uid, 'gestor'::app_role);
  exception when others then
    v_is_gestor := false;
  end;

  if not (v_is_admin or v_is_dev or v_is_gestor) then
    raise exception 'unauthorized: requires admin, dev or gestor';
  end if;

  with active_bed as (
    -- leito ativo por registry: pega 1 paciente com bed_number não-nulo
    select distinct on (p.patient_registry_id)
      p.patient_registry_id,
      p.bed_number,
      p.sector as sector_code
    from public.patients p
    where p.patient_registry_id is not null
      and p.bed_number is not null
    order by p.patient_registry_id, p.created_at desc nulls last
  ),
  base as (
    select
      r.id,
      r.full_name,
      r.full_name_normalized,
      r.social_name,
      r.birth_date,
      r.sex,
      r.mother_name,
      r.cpf,
      r.cns,
      r.medical_record,
      r.is_unidentified,
      r.merged_into_registry_id,
      r.created_at,
      r.updated_at,
      ab.bed_number,
      ab.sector_code
    from public.patient_registry r
    left join active_bed ab on ab.patient_registry_id = r.id
    where r.merged_into_registry_id is null
      and r.is_unidentified is not true
      and (p_sector_code is null
           or p_sector_code = '__all__'
           or (p_sector_code = '__no_bed__' and ab.bed_number is null)
           or (p_sector_code = '__with_bed__' and ab.bed_number is not null)
           or ab.sector_code = p_sector_code)
  ),
  legacy_mr as (
    select
      mr.patient_registry_id,
      mr.numero_prontuario_legado
    from public.medical_records mr
    where mr.numero_prontuario_legado is not null
      and mr.numero_prontuario_legado <> ''
  ),
  -- R1: CPF igual
  g_r1 as (
    select 'R1'::text as rule, b.cpf as key, array_agg(b.id order by b.created_at) as ids
    from base b
    where 'R1' = any(p_rules) and b.cpf is not null and length(regexp_replace(b.cpf,'\D','','g')) >= 11
    group by b.cpf
    having count(*) > 1
  ),
  -- R2: CNS igual
  g_r2 as (
    select 'R2'::text as rule, b.cns as key, array_agg(b.id order by b.created_at) as ids
    from base b
    where 'R2' = any(p_rules) and b.cns is not null and length(regexp_replace(b.cns,'\D','','g')) >= 11
    group by b.cns
    having count(*) > 1
  ),
  -- R3: nome normalizado + DOB + mãe
  g_r3 as (
    select 'R3'::text as rule,
           coalesce(b.full_name_normalized, upper(b.full_name)) || '|' || b.birth_date::text || '|' || upper(coalesce(b.mother_name,'')) as key,
           array_agg(b.id order by b.created_at) as ids
    from base b
    where 'R3' = any(p_rules)
      and b.full_name is not null
      and b.birth_date is not null
      and b.mother_name is not null and b.mother_name <> ''
    group by 1, 2
    having count(*) > 1
  ),
  -- R4: nome + DOB (sem mãe)
  g_r4 as (
    select 'R4'::text as rule,
           coalesce(b.full_name_normalized, upper(b.full_name)) || '|' || b.birth_date::text as key,
           array_agg(b.id order by b.created_at) as ids
    from base b
    where 'R4' = any(p_rules)
      and b.full_name is not null
      and b.birth_date is not null
    group by 1, 2
    having count(*) > 1
  ),
  -- R5: numero_prontuario_legado igual entre registries distintos
  g_r5 as (
    select 'R5'::text as rule, lm.numero_prontuario_legado as key, array_agg(distinct b.id) as ids
    from legacy_mr lm
    join base b on b.id = lm.patient_registry_id
    where 'R5' = any(p_rules)
    group by lm.numero_prontuario_legado
    having count(distinct b.id) > 1
  ),
  -- R6: similaridade de nome + DOB igual (opt-in)
  g_r6 as (
    select 'R6'::text as rule,
           least(b1.id::text, b2.id::text) || '|' || greatest(b1.id::text, b2.id::text) as key,
           array[b1.id, b2.id] as ids
    from base b1
    join base b2 on b2.id > b1.id
                 and b2.birth_date = b1.birth_date
                 and b2.birth_date is not null
                 and similarity(coalesce(b1.full_name_normalized, upper(b1.full_name)),
                                coalesce(b2.full_name_normalized, upper(b2.full_name))) >= p_similarity_threshold
    where p_include_similarity = true and 'R6' = any(p_rules)
  ),
  all_groups as (
    select * from g_r1
    union all select * from g_r2
    union all select * from g_r3
    union all select * from g_r4
    union all select * from g_r5
    union all select * from g_r6
  ),
  -- evita duplicar grupos com mesma combinação de ids
  dedup_groups as (
    select rule, key, ids,
           md5(array_to_string((select array_agg(x order by x) from unnest(ids) x), ',')) as ids_hash
    from all_groups
  ),
  -- 1 linha por (rule, ids_hash) — mantém a melhor regra se conflitar
  pick_groups as (
    select distinct on (ids_hash, rule) *
    from dedup_groups
    order by ids_hash, rule
    limit p_limit_groups
  ),
  exploded as (
    select g.rule, g.key, g.ids_hash, g.ids,
           x.id as member_id, x.ord
    from pick_groups g,
         lateral unnest(g.ids) with ordinality as x(id, ord)
  ),
  -- contagens clínicas por registry
  member_data as (
    select
      e.rule, e.key, e.ids_hash, e.ids,
      e.member_id,
      jsonb_build_object(
        'id', b.id,
        'full_name', b.full_name,
        'social_name', b.social_name,
        'cpf', b.cpf,
        'cns', b.cns,
        'birth_date', b.birth_date,
        'sex', b.sex,
        'mother_name', b.mother_name,
        'medical_record', b.medical_record,
        'bed_number', b.bed_number,
        'sector_code', b.sector_code,
        'created_at', b.created_at,
        'updated_at', b.updated_at,
        'counts', jsonb_build_object(
          'patients',     (select count(*) from public.patients p where p.patient_registry_id = b.id),
          'evolutions',   (select count(*) from public.clinical_evolutions ce where ce.patient_registry_id = b.id),
          'exams',        (select count(*) from public.exam_requests er where er.patient_registry_id = b.id),
          'encounters',   (select count(*) from public.patient_encounters pe where pe.registry_id = b.id),
          'medical_records', (select count(*) from public.medical_records mr where mr.patient_registry_id = b.id)
        ),
        'non_null_fields',
          (case when b.full_name is not null then 1 else 0 end) +
          (case when b.cpf is not null then 1 else 0 end) +
          (case when b.cns is not null then 1 else 0 end) +
          (case when b.birth_date is not null then 1 else 0 end) +
          (case when b.mother_name is not null then 1 else 0 end) +
          (case when b.phone is not null then 1 else 0 end) +
          (case when b.address is not null then 1 else 0 end)
      ) as member_json
    from exploded e
    join public.patient_registry b on b.id = e.member_id
  ),
  grouped as (
    select rule, ids_hash, key,
           min(case when ord = 1 then 0 else 999 end) as _ord_min,
           jsonb_agg(member_json order by member_id) as members
    from (
      select md.*, e.ord
      from member_data md
      join exploded e using (rule, ids_hash, member_id)
    ) z
    group by rule, ids_hash, key
  )
  select jsonb_build_object(
    'groups', coalesce(jsonb_agg(jsonb_build_object(
      'rule', rule,
      'key', key,
      'group_hash', ids_hash,
      'members', members,
      'member_count', jsonb_array_length(members),
      'both_with_bed', (
        select count(*) from jsonb_array_elements(members) m where m->>'bed_number' is not null
      ) >= 2,
      'sectors', (
        select jsonb_agg(distinct m->>'sector_code') from jsonb_array_elements(members) m where m->>'sector_code' is not null
      )
    ) order by rule, ids_hash), '[]'::jsonb),
    'generated_at', now()
  ) into v_result
  from grouped;

  return coalesce(v_result, jsonb_build_object('groups', '[]'::jsonb, 'generated_at', now()));
end;
$$;

grant execute on function public.scan_duplicate_registries(text, text[], boolean, double precision, int) to authenticated;