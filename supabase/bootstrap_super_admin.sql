-- ============================================================================
-- Bootstrap do super_admin — RPCs que faltam na instância newsb.
-- Aplicar UMA vez no Postgres da VPS. Idempotente (create or replace).
-- Depois: recarregar o PostgREST (NOTIFY no fim) para o /rest/v1/rpc enxergar.
-- ============================================================================

-- 1) Existe algum super_admin? Callable por anon (o app chama antes do login).
create or replace function public.existe_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.profissionais where papel = 'super_admin');
$$;

grant execute on function public.existe_super_admin() to anon, authenticated;

-- 2) Cria o PRIMEIRO super_admin. Só funciona uma vez: se já existir, aborta.
--    Chamada por um usuário autenticado (logo após o signUp no /setup).
create or replace function public.criar_primeiro_super_admin(
  p_user_id uuid,
  p_nome    text,
  p_email   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.profissionais where papel = 'super_admin') then
    raise exception 'Já existe um super_admin cadastrado'
      using errcode = 'unique_violation';
  end if;

  insert into public.profissionais (user_id, nome, email, papel, ativo, hospital_id)
  values (p_user_id, p_nome, p_email, 'super_admin', true, null)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.criar_primeiro_super_admin(uuid, text, text) to authenticated;

-- 3) Recarrega o schema cache do PostgREST (sem isso o REST continua dando 404).
notify pgrst, 'reload schema';
