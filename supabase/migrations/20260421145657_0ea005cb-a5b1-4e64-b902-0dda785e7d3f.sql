-- Modelos de texto por campo, com escopo de usuário (privados) ou globais.
-- Permite criar/importar diretamente em cada campo do formulário (Evolução, etc).

create table if not exists public.field_text_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,                 -- ex: 'evolution.subjective', 'evolution.assessment', 'evolution.plan', 'evolution.objective.exam.cardiovascular'
  name text not null,                  -- rótulo curto exibido no menu
  body text not null,                  -- conteúdo a inserir no campo
  is_shared boolean not null default false, -- se true, visível para todos do mesmo hospital
  hospital_unit_id uuid,
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_field_text_templates_user_scope
  on public.field_text_templates (user_id, scope);

create index if not exists idx_field_text_templates_shared_scope
  on public.field_text_templates (is_shared, hospital_unit_id, scope) where is_shared = true;

alter table public.field_text_templates enable row level security;

-- Cada usuário enxerga seus próprios + os compartilhados do mesmo hospital
create policy "Users see own and shared templates"
  on public.field_text_templates for select
  to authenticated
  using (
    auth.uid() = user_id
    or is_shared = true
  );

create policy "Users insert own templates"
  on public.field_text_templates for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own templates"
  on public.field_text_templates for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users delete own templates"
  on public.field_text_templates for delete
  to authenticated
  using (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.touch_field_text_templates()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_touch_field_text_templates on public.field_text_templates;
create trigger trg_touch_field_text_templates
  before update on public.field_text_templates
  for each row execute function public.touch_field_text_templates();
