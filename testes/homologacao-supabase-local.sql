-- Apenas para instância local efêmera do GitHub Actions. NUNCA aplicar em produção.
create table public.user_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{"companies":[],"reviews":[],"audit":[]}'::jsonb,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.user_workspaces enable row level security;
grant select,insert,update on public.user_workspaces to authenticated;
create policy user_workspaces_select on public.user_workspaces for select to authenticated using (user_id=(select auth.uid()));
create policy user_workspaces_insert on public.user_workspaces for insert to authenticated with check (user_id=(select auth.uid()));
create policy user_workspaces_update on public.user_workspaces for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create or replace function public.save_user_workspace(p_payload jsonb,p_expected_revision bigint)
returns bigint language plpgsql set search_path = ''
as $$
declare v_revision bigint;
begin
 if (select auth.uid()) is null then raise exception 'Autenticação necessária'; end if;
 if jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_payload->'companies')<>'array'
 then raise exception 'Formato de backup inválido'; end if;
 update public.user_workspaces
 set payload=p_payload,revision=revision+1,updated_at=now()
 where user_id=(select auth.uid()) and revision=p_expected_revision returning revision into v_revision;
 if found then return v_revision; end if;
 if p_expected_revision=0 then
   insert into public.user_workspaces(user_id,payload,revision)
   values ((select auth.uid()),p_payload,1)
   on conflict(user_id) do nothing
   returning revision into v_revision;
   if found then return v_revision; end if;
 end if;
 raise exception 'Conflito: os dados na nuvem mudaram. Recarregue antes de salvar.';
end;$$;
grant execute on function public.save_user_workspace(jsonb,bigint) to authenticated;
create table public.user_operational_drafts(
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{}'::jsonb,
 revision bigint not null default 1,
 updated_at timestamptz not null default now());
create table public.user_productivity_states(
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{}'::jsonb,
 revision bigint not null default 1,
 updated_at timestamptz not null default now());
alter table public.user_operational_drafts enable row level security;
alter table public.user_productivity_states enable row level security;
grant select,insert,update on public.user_operational_drafts,public.user_productivity_states to authenticated;
create policy op_read on public.user_operational_drafts for select to authenticated using (user_id=(select auth.uid()));
create policy op_insert on public.user_operational_drafts for insert to authenticated with check (user_id=(select auth.uid()));
create policy op_update on public.user_operational_drafts for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy prod_read on public.user_productivity_states for select to authenticated using (user_id=(select auth.uid()));
create policy prod_insert on public.user_productivity_states for insert to authenticated with check (user_id=(select auth.uid()));
create policy prod_update on public.user_productivity_states for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
