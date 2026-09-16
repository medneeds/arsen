-- ============================================================================
-- BUG do refactor: a função de trigger set_updated_at() ainda seta NEW.updated_at,
-- mas as 37 tabelas novas usam a coluna `atualizado_em` (0 usam updated_at).
-- Resultado: TODA UPDATE nas tabelas do schema novo falha com
--   42703: record "new" has no field "updated_at"
-- (34 triggers usam essa função). Isso trava editar hospital, branding, status de
-- leito, ativar/desativar profissional, e praticamente todo update do app.
--
-- Aplicar UMA vez na VPS como superusuário (o postgres do container é dono/superuser):
--   docker exec -i <DB_NEWSB> psql -U postgres -d postgres < supabase/fix_set_updated_at.sql
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;
