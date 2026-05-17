-- ============================================================
-- scan_duplicate_registries v2: lições aprendidas das mesclagens manuais
-- + normalização CPF/CNS (R1/R2): trim + só dígitos antes do group by
-- + normalização mother_name (R3): trim + colapsar whitespace
-- + R7 NOVA: medical_record só-dígitos igual (pegaria 182118-1 ≡ 1821181)
-- + R8 NOVA: nome_normalized + mother_normalized (sem DOB), flag requires_human_review
-- + filtra registros já mesclados (merged_into_registry_id IS NULL) -- já existia
-- ============================================================

CREATE OR REPLACE FUNCTION public.scan_duplicate_registries(
  p_sector_code text DEFAULT NULL,
  p_rules text[] DEFAULT ARRAY['R1','R2','R3','R4','R5','R7'],
  p_include_similarity boolean DEFAULT false,
  p_similarity_threshold double precision DEFAULT 0.85,
  p_limit_groups integer DEFAULT 300
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_is_dev boolean := false;
  v_is_gestor boolean := false;
  v_result jsonb;
begin
  v_is_admin := public.has_role(v_uid, 'admin'::app_role);
  begin v_is_dev := public.has_role(v_uid, 'dev'::app_role); exception when others then v_is_dev := false; end;
  begin v_is_gestor := public.has_role(v_uid, 'gestor'::app_role); exception when others then v_is_gestor := false; end;
  if not (v_is_admin or v_is_dev or v_is_gestor) then
    raise exception 'unauthorized: requires admin, dev or gestor';
  end if;

  with active_bed as (
    select distinct on (p.patient_registry_id)
      p.patient_registry_id, p.bed_number, p.sector as sector_code
    from public.patients p
    where p.patient_registry_id is not null and p.bed_number is not null
    order by p.patient_registry_id, p.created_at desc nulls last
  ),
  base as (
    select
      r.id, r.full_name, r.full_name_normalized, r.social_name,
      r.birth_date, r.sex, r.mother_name, r.cpf, r.cns, r.medical_record,
      r.is_unidentified, r.merged_into_registry_id, r.phone, r.address,
      r.created_at, r.updated_at,
      ab.bed_number, ab.sector_code,
      -- normalizações (chaves p/ matching robusto)
      nullif(regexp_replace(coalesce(r.cpf,''), '\D', '', 'g'), '') as cpf_norm,
      nullif(regexp_replace(coalesce(r.cns,''), '\D', '', 'g'), '') as cns_norm,
      nullif(regexp_replace(coalesce(r.medical_record,''), '\D', '', 'g'), '') as mr_norm,
      nullif(upper(btrim(regexp_replace(coalesce(r.mother_name,''), '\s+', ' ', 'g'))), '') as mother_norm,
      coalesce(r.full_name_normalized, upper(btrim(regexp_replace(coalesce(r.full_name,''), '\s+', ' ', 'g')))) as name_norm
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
    select mr.patient_registry_id, mr.numero_prontuario_legado
    from public.medical_records mr
    where mr.numero_prontuario_legado is not null and mr.numero_prontuario_legado <> ''
  ),
  g_r1 as (
    select 'R1'::text as rule, b.cpf_norm as key, array_agg(b.id order by b.created_at) as ids
    from base b where 'R1' = any(p_rules) and b.cpf_norm is not null and length(b.cpf_norm) >= 11
    group by b.cpf_norm having count(*) > 1
  ),
  g_r2 as (
    select 'R2'::text as rule, b.cns_norm as key, array_agg(b.id order by b.created_at) as ids
    from base b where 'R2' = any(p_rules) and b.cns_norm is not null and length(b.cns_norm) >= 11
    group by b.cns_norm having count(*) > 1
  ),
  g_r3 as (
    select 'R3'::text as rule,
           b.name_norm || '|' || b.birth_date::text || '|' || b.mother_norm as key,
           array_agg(b.id order by b.created_at) as ids
    from base b
    where 'R3' = any(p_rules) and b.name_norm is not null and b.birth_date is not null and b.mother_norm is not null
    group by 1, 2 having count(*) > 1
  ),
  g_r4 as (
    select 'R4'::text as rule, b.name_norm || '|' || b.birth_date::text as key,
           array_agg(b.id order by b.created_at) as ids
    from base b where 'R4' = any(p_rules) and b.name_norm is not null and b.birth_date is not null
    group by 1, 2 having count(*) > 1
  ),
  g_r5 as (
    select 'R5'::text as rule, lm.numero_prontuario_legado as key, array_agg(distinct b.id) as ids
    from legacy_mr lm join base b on b.id = lm.patient_registry_id
    where 'R5' = any(p_rules)
    group by lm.numero_prontuario_legado having count(distinct b.id) > 1
  ),
  -- R6: similaridade fonética
  g_r6 as (
    select 'R6'::text as rule,
           least(b1.id::text, b2.id::text) || '|' || greatest(b1.id::text, b2.id::text) as key,
           array[b1.id, b2.id] as ids
    from base b1 join base b2 on b2.id > b1.id and b2.birth_date = b1.birth_date and b2.birth_date is not null
      and similarity(b1.name_norm, b2.name_norm) >= p_similarity_threshold
    where p_include_similarity = true and 'R6' = any(p_rules)
  ),
  -- R7: medical_record só-dígitos igual (captura 182118-1 ≡ 1821181)
  g_r7 as (
    select 'R7'::text as rule, b.mr_norm as key, array_agg(b.id order by b.created_at) as ids
    from base b where 'R7' = any(p_rules) and b.mr_norm is not null and length(b.mr_norm) >= 5
    group by b.mr_norm having count(*) > 1
  ),
  -- R8: nome + mãe (sem DOB) → homônimo/familiar, REVISÃO HUMANA obrigatória
  g_r8 as (
    select 'R8'::text as rule, b.name_norm || '|' || b.mother_norm as key,
           array_agg(b.id order by b.created_at) as ids
    from base b where 'R8' = any(p_rules) and b.name_norm is not null and b.mother_norm is not null
    group by 1, 2 having count(*) > 1
  ),
  all_groups as (
    select * from g_r1 union all select * from g_r2 union all select * from g_r3
    union all select * from g_r4 union all select * from g_r5 union all select * from g_r6
    union all select * from g_r7 union all select * from g_r8
  ),
  dedup_groups as (
    select rule, key, ids,
           md5(array_to_string((select array_agg(x order by x) from unnest(ids) x), ',')) as ids_hash
    from all_groups
  ),
  pick_groups as (
    select distinct on (ids_hash, rule) * from dedup_groups order by ids_hash, rule limit p_limit_groups
  ),
  exploded as (
    select g.rule, g.key, g.ids_hash, g.ids, x.id as member_id, x.ord
    from pick_groups g, lateral unnest(g.ids) with ordinality as x(id, ord)
  ),
  member_data as (
    select e.rule, e.key, e.ids_hash, e.ids, e.member_id, e.ord,
      jsonb_build_object(
        'id', b.id, 'full_name', b.full_name, 'social_name', b.social_name,
        'cpf', b.cpf, 'cns', b.cns, 'birth_date', b.birth_date, 'sex', b.sex,
        'mother_name', b.mother_name, 'medical_record', b.medical_record,
        'bed_number', b.bed_number, 'sector_code', b.sector_code,
        'created_at', b.created_at, 'updated_at', b.updated_at,
        'counts', jsonb_build_object(
          'patients',        (select count(*) from public.patients p where p.patient_registry_id = b.id),
          'evolutions',      (select count(*) from public.clinical_evolutions ce where ce.patient_registry_id = b.id),
          'exams',           (select count(*) from public.exam_requests er where er.patient_registry_id = b.id),
          'encounters',      (select count(*) from public.patient_encounters pe where pe.registry_id = b.id),
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
    from exploded e join base b on b.id = e.member_id
  ),
  grouped as (
    select rule, ids_hash, key, jsonb_agg(member_json order by member_id) as members
    from member_data group by rule, ids_hash, key
  )
  select jsonb_build_object(
    'groups', coalesce(jsonb_agg(jsonb_build_object(
      'rule', rule, 'key', key, 'group_hash', ids_hash, 'members', members,
      'member_count', jsonb_array_length(members),
      'both_with_bed', (select count(*) from jsonb_array_elements(members) m where (m->>'bed_number') is not null) >= 2,
      'sectors', (select jsonb_agg(distinct m->>'sector_code') from jsonb_array_elements(members) m where (m->>'sector_code') is not null),
      -- nova flag: R8 sempre exige revisão humana; R6 também
      'requires_human_review', rule in ('R8','R6')
    ) order by rule, ids_hash), '[]'::jsonb),
    'generated_at', now()
  ) into v_result
  from grouped;

  return coalesce(v_result, jsonb_build_object('groups', '[]'::jsonb, 'generated_at', now()));
end;
$function$;