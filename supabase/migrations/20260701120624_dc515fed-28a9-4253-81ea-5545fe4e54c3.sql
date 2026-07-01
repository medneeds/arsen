create or replace function public.get_public_tables_timestamp_cols()
returns table (
  name text,
  has_updated_at boolean,
  has_created_at boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    t.table_name::text as name,
    bool_or(c.column_name = 'updated_at') as has_updated_at,
    bool_or(c.column_name = 'created_at') as has_created_at
  from information_schema.tables t
  left join information_schema.columns c
    on c.table_schema = t.table_schema
   and c.table_name = t.table_name
  where t.table_schema = 'public'
    and t.table_type = 'BASE TABLE'
  group by t.table_name
  order by t.table_name;
$$;

revoke all on function public.get_public_tables_timestamp_cols() from public;
grant execute on function public.get_public_tables_timestamp_cols() to service_role;
