-- provisionar_estrutura_hospital
--
-- Provisiona, numa unica transacao (tudo-ou-nada), a identidade visual e a
-- estrutura fisica (alas -> setores -> leitos) de um hospital JA criado.
-- Usada pela tela /implantacao (fase 2), chamada pelo super_admin apos
-- criar o hospital+admin via criar_hospital_com_admin.
--
-- POR QUE SECURITY DEFINER: as policies de escrita (*_gerenciar) de
-- alas/setores/leitos/identidade_visual_hospital exigem
-- eh_admin_do_hospital(uid(), hospital_id) -- o super_admin NAO satisfaz.
-- Rodando como SECURITY DEFINER (mesmo padrao de criar_hospital_com_admin),
-- a funcao executa com o privilegio do owner e contorna essa RLS, mas com
-- guard proprio eh_super_admin(auth.uid()) -- so super_admin provisiona.
--
-- IDEMPOTENCIA: identidade e upsert (1:1 por hospital_id). Alas/setores/leitos
-- sao SEMPRE inseridos (nao deduplica) -- chamar de novo DUPLICA a estrutura.
-- A orquestracao no front so chama uma vez por instituicao; em repeticao de
-- falha parcial, repetir equipe (edge) e seguro, repetir estrutura NAO.
--
-- MAPEAMENTO: o front manda ids temporarios ("tmp") que ligam
-- setor->ala e leito->setor; a funcao resolve cada tmp para o uuid real.

create or replace function public.provisionar_estrutura_hospital(
  p_hospital_id uuid,
  p_identidade jsonb,
  p_estrutura jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_criado_por uuid;
  v_ala_map jsonb := '{}'::jsonb;
  v_setor_map jsonb := '{}'::jsonb;
  v_ala jsonb;
  v_setor jsonb;
  v_leito jsonb;
  v_new_id uuid;
  v_ala_id uuid;
  v_setor_id uuid;
  v_exists_identidade uuid;
  v_n_alas int := 0;
  v_n_setores int := 0;
  v_n_leitos int := 0;
  v_identidade_ok boolean := false;
begin
  -- Guard: somente super_admin (mesmo mecanismo de criar_hospital_com_admin).
  if not public.eh_super_admin(auth.uid()) then
    raise exception 'Apenas o super_admin pode provisionar a estrutura de um hospital.';
  end if;

  if not exists (select 1 from public.hospitais where id = p_hospital_id) then
    raise exception 'Hospital % nao encontrado.', p_hospital_id;
  end if;

  v_criado_por := (select id from public.profissionais where user_id = auth.uid());

  -- Identidade visual (upsert por hospital_id; logo nao entra nesta fase).
  if p_identidade is not null and coalesce(p_identidade->>'sigla', '') <> '' then
    select id into v_exists_identidade
      from public.identidade_visual_hospital where hospital_id = p_hospital_id;
    if v_exists_identidade is not null then
      update public.identidade_visual_hospital set
        sigla          = p_identidade->>'sigla',
        slogan         = nullif(p_identidade->>'slogan', ''),
        cor_primaria   = nullif(p_identidade->>'cor_primaria', ''),
        cor_secundaria = nullif(p_identidade->>'cor_secundaria', ''),
        cor_destaque   = nullif(p_identidade->>'cor_destaque', '')
      where id = v_exists_identidade;
    else
      insert into public.identidade_visual_hospital
        (hospital_id, sigla, slogan, cor_primaria, cor_secundaria, cor_destaque)
      values (
        p_hospital_id,
        p_identidade->>'sigla',
        nullif(p_identidade->>'slogan', ''),
        nullif(p_identidade->>'cor_primaria', ''),
        nullif(p_identidade->>'cor_secundaria', ''),
        nullif(p_identidade->>'cor_destaque', '')
      );
    end if;
    v_identidade_ok := true;
  end if;

  -- Alas.
  for v_ala in select value from jsonb_array_elements(coalesce(p_estrutura->'alas', '[]'::jsonb)) as t(value)
  loop
    if coalesce(v_ala->>'nome', '') = '' then
      raise exception 'Ha ala sem nome.';
    end if;
    insert into public.alas (hospital_id, nome, descricao, criado_por)
    values (p_hospital_id, v_ala->>'nome', nullif(v_ala->>'descricao', ''), v_criado_por)
    returning id into v_new_id;
    v_ala_map := v_ala_map || jsonb_build_object(v_ala->>'tmp', v_new_id::text);
    v_n_alas := v_n_alas + 1;
  end loop;

  -- Setores (ala_id resolvido do mapa de alas).
  for v_setor in select value from jsonb_array_elements(coalesce(p_estrutura->'setores', '[]'::jsonb)) as t(value)
  loop
    v_ala_id := nullif(v_ala_map->>(v_setor->>'ala_tmp'), '')::uuid;
    if v_ala_id is null then
      raise exception 'Setor "%" referencia uma ala inexistente.', coalesce(v_setor->>'nome', '?');
    end if;
    if coalesce(v_setor->>'tipo', '') not in ('triagem', 'clinico', 'cirurgico') then
      raise exception 'Setor "%" com tipo invalido: %.', coalesce(v_setor->>'nome', '?'), v_setor->>'tipo';
    end if;
    insert into public.setores (ala_id, nome, tipo, aplica_saps, criado_por)
    values (
      v_ala_id,
      v_setor->>'nome',
      v_setor->>'tipo',
      coalesce((v_setor->>'aplica_saps')::boolean, false),
      v_criado_por
    )
    returning id into v_new_id;
    v_setor_map := v_setor_map || jsonb_build_object(v_setor->>'tmp', v_new_id::text);
    v_n_setores := v_n_setores + 1;
  end loop;

  -- Leitos (setor_id resolvido do mapa de setores).
  for v_leito in select value from jsonb_array_elements(coalesce(p_estrutura->'leitos', '[]'::jsonb)) as t(value)
  loop
    v_setor_id := nullif(v_setor_map->>(v_leito->>'setor_tmp'), '')::uuid;
    if v_setor_id is null then
      raise exception 'Leito "%" referencia um setor inexistente.', coalesce(v_leito->>'numero', '?');
    end if;
    if coalesce(v_leito->>'numero', '') = '' then
      raise exception 'Ha leito sem numero.';
    end if;
    if coalesce(nullif(v_leito->>'tipo', ''), 'leito') not in ('leito', 'maca') then
      raise exception 'Leito "%" com tipo invalido: %.', v_leito->>'numero', v_leito->>'tipo';
    end if;
    insert into public.leitos (setor_id, numero, tipo, status, criado_por)
    values (
      v_setor_id,
      v_leito->>'numero',
      coalesce(nullif(v_leito->>'tipo', ''), 'leito'),
      'livre',
      v_criado_por
    );
    v_n_leitos := v_n_leitos + 1;
  end loop;

  return jsonb_build_object(
    'identidade', v_identidade_ok,
    'alas', v_n_alas,
    'setores', v_n_setores,
    'leitos', v_n_leitos
  );
end;
$function$;

-- A funcao e chamada direto do front com o JWT do usuario (role authenticated);
-- o guard interno restringe a super_admin.
grant execute on function public.provisionar_estrutura_hospital(uuid, jsonb, jsonb) to authenticated;
