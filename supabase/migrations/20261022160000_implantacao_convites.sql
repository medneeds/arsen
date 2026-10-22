-- implantacao_convites / solicitacoes_implantacao
--
-- Fluxo de auto-implantacao de hospital por link de uso unico:
--   1. super_admin gera um link -> cria linha status 'convidado' e devolve o token.
--   2. o hospital abre arsen.com.br/implantacao?k=<token>, valida o token (RPC anon)
--      e preenche hospital + contato + email + senha.
--   3. a edge implantacao-submeter (service_role, token-gated) cria a conta de auth
--      INERTE (email_confirm=false) com a senha escolhida, grava os dados aqui e
--      marca 'pendente' (consome o token: uso unico).
--   4. super_admin aprova via edge avaliar-implantacao -> criar_hospital_com_admin
--      (reaproveitando o admin_user_id ja criado) + confirma o email -> 'aprovado'.
--      Reprovar -> 'reprovado' + deleta a conta inerte.
--
-- SEGURANCA: a senha escolhida pelo usuario NUNCA e gravada nesta tabela; vai direto
-- para o GoTrue via createUser. Aqui so guardamos o admin_user_id resultante.
-- Nenhum acesso anon direto a tabela: todo acesso anon passa pelas RPCs SECURITY DEFINER
-- abaixo ou pela edge (service_role).
--
-- Reversibilidade: alta. Dropar as 2 funcoes e a tabela remove tudo; nao altera objetos
-- existentes (hospitais, profissionais, criar_hospital_com_admin ficam intactos).

create extension if not exists pgcrypto;

create table if not exists public.solicitacoes_implantacao (
  id                    uuid primary key default gen_random_uuid(),
  token                 text not null unique,
  status                text not null default 'convidado',  -- convidado | pendente | aprovado | reprovado
  hospital_nome         text,
  cnpj                  text,
  endereco              text,
  contato_nome          text,
  contato_email         text,
  contato_telefone      text,
  admin_user_id         uuid,
  hospital_id           uuid references public.hospitais(id),
  expira_em             timestamptz,
  criado_por            uuid,
  criado_em             timestamptz not null default now(),
  enviado_em            timestamptz,
  avaliado_por          uuid,
  avaliado_em           timestamptz,
  observacoes_avaliador text,
  ip                    inet,
  user_agent            text,
  constraint solicitacoes_implantacao_status_chk
    check (status in ('convidado','pendente','aprovado','reprovado'))
);

create index if not exists solicitacoes_implantacao_status_idx
  on public.solicitacoes_implantacao (status);

alter table public.solicitacoes_implantacao enable row level security;

-- Sem policy anon: so super_admin le/edita direto; o resto e via RPC/edge definer.
drop policy if exists "super_admin le implantacao" on public.solicitacoes_implantacao;
create policy "super_admin le implantacao"
  on public.solicitacoes_implantacao for select to authenticated
  using (public.eh_super_admin(auth.uid()));

drop policy if exists "super_admin edita implantacao" on public.solicitacoes_implantacao;
create policy "super_admin edita implantacao"
  on public.solicitacoes_implantacao for update to authenticated
  using (public.eh_super_admin(auth.uid()))
  with check (public.eh_super_admin(auth.uid()));

drop policy if exists "super_admin apaga implantacao" on public.solicitacoes_implantacao;
create policy "super_admin apaga implantacao"
  on public.solicitacoes_implantacao for delete to authenticated
  using (public.eh_super_admin(auth.uid()));

-- ── Gera o convite (uso unico). Somente super_admin. Retorna { id, token }. ──
create or replace function public.implantacao_convite_gerar(
  p_contato_nome text default null,
  p_contato_email text default null,
  p_expira_dias int default 7
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_id uuid;
begin
  if not public.eh_super_admin(auth.uid()) then
    raise exception 'Apenas o super_admin pode gerar link de implantacao.';
  end if;

  -- token url-safe (sem +, /, =)
  v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');

  insert into public.solicitacoes_implantacao
    (token, status, contato_nome, contato_email, expira_em, criado_por)
  values
    (v_token, 'convidado', nullif(trim(coalesce(p_contato_nome,'')),''),
     nullif(lower(trim(coalesce(p_contato_email,''))),''),
     now() + make_interval(days => greatest(1, coalesce(p_expira_dias, 7))),
     auth.uid())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'token', v_token);
end;
$$;

revoke all on function public.implantacao_convite_gerar(text, text, int) from public;
grant execute on function public.implantacao_convite_gerar(text, text, int) to authenticated;

-- ── Valida o token para a pagina publica. Anon. NAO vaza dados do cadastro. ──
-- Retorna { valido: bool, motivo: text }  motivo in: ok|inexistente|expirado|usado|reprovado
create or replace function public.implantacao_convite_validar(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.solicitacoes_implantacao%rowtype;
begin
  select * into r from public.solicitacoes_implantacao where token = p_token;
  if not found then
    return jsonb_build_object('valido', false, 'motivo', 'inexistente');
  end if;
  if r.status = 'reprovado' then
    return jsonb_build_object('valido', false, 'motivo', 'reprovado');
  end if;
  if r.status <> 'convidado' then
    return jsonb_build_object('valido', false, 'motivo', 'usado');
  end if;
  if r.expira_em is not null and now() > r.expira_em then
    return jsonb_build_object('valido', false, 'motivo', 'expirado');
  end if;
  return jsonb_build_object('valido', true, 'motivo', 'ok');
end;
$$;

revoke all on function public.implantacao_convite_validar(text) from public;
grant execute on function public.implantacao_convite_validar(text) to anon, authenticated;
