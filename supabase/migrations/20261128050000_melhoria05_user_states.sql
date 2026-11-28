-- Melhoria 05: PROPOSTA ISOLADA. Não executar no Supabase de produção sem autorização do segundo ciclo.
-- Dados profissionais privados por usuário; separação de rascunhos operacionais e produtividade já existentes.
create table if not exists public.user_melhoria05_states(
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{}'::jsonb,
 revision bigint not null default 1 check(revision>=1),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint melhoria05_payload_object check(jsonb_typeof(payload)='object')
);
alter table public.user_melhoria05_states enable row level security;
revoke all on public.user_melhoria05_states from anon;
grant select,insert,update on public.user_melhoria05_states to authenticated;
drop policy if exists "melhoria05_select_own" on public.user_melhoria05_states;
drop policy if exists "melhoria05_insert_own" on public.user_melhoria05_states;
drop policy if exists "melhoria05_update_own" on public.user_melhoria05_states;
create policy "melhoria05_select_own" on public.user_melhoria05_states for select to authenticated using(user_id=(select auth.uid()));
create policy "melhoria05_insert_own" on public.user_melhoria05_states for insert to authenticated with check(user_id=(select auth.uid()));
create policy "melhoria05_update_own" on public.user_melhoria05_states for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
comment on table public.user_melhoria05_states is 'Dados privados de qualidade, metas, diario e desenvolvimento do usuário; sem alterações no workspace contabil. Migração somente para segundo ciclo aprovado.';
