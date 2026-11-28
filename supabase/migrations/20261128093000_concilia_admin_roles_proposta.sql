-- ConCiliar+PLUS: controle administrativo isolado (proposta para homologacao).
-- Nao concede privilegios automaticamente e nao muda as regras de workspace existentes.
create table if not exists public.concilia_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 active boolean not null default true,
 granted_at timestamptz not null default now(),
 granted_by uuid references auth.users(id)
);
alter table public.concilia_admins enable row level security;
revoke all on public.concilia_admins from anon, authenticated;
grant select on public.concilia_admins to authenticated;
drop policy if exists concilia_admins_read_self on public.concilia_admins;
create policy concilia_admins_read_self on public.concilia_admins for select to authenticated
 using (user_id=(select auth.uid()));
-- Cadastro de administradores somente via migration/operacao privilegiada validada.
-- Proibido INSERT, UPDATE ou DELETE por cliente autenticado.

create or replace function public.concilia_is_admin()
returns boolean
language sql stable security definer set search_path=''
as $$
 select exists (
   select 1 from public.concilia_admins
   where user_id=(select auth.uid()) and active=true
 )
$$;
revoke all on function public.concilia_is_admin() from public, anon;
grant execute on function public.concilia_is_admin() to authenticated;

create table if not exists public.concilia_staff (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(trim(display_name)) between 2 and 140),
 access_role text not null default 'funcionario'
   check(access_role in ('gestor','funcionario','consulta')),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
alter table public.concilia_staff enable row level security;
revoke all on public.concilia_staff from anon, authenticated;
grant select, insert, update on public.concilia_staff to authenticated;
drop policy if exists concilia_staff_read_authorized on public.concilia_staff;
create policy concilia_staff_read_authorized on public.concilia_staff
 for select to authenticated
 using (user_id=(select auth.uid()) or (select public.concilia_is_admin()));
drop policy if exists concilia_staff_admin_insert on public.concilia_staff;
create policy concilia_staff_admin_insert on public.concilia_staff
 for insert to authenticated with check ((select public.concilia_is_admin()));
drop policy if exists concilia_staff_admin_update on public.concilia_staff;
create policy concilia_staff_admin_update on public.concilia_staff
 for update to authenticated
 using ((select public.concilia_is_admin()))
 with check ((select public.concilia_is_admin()));
-- Sem DELETE: desativacao preserva auditoria.
-- Esta tabela nao altera permissao nas tabelas contabeis. Ligacao com empresa
-- necessita politica adicional testada com duas contas distintas.

create table if not exists public.concilia_admin_audit (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id),
 target_user_id uuid references auth.users(id),
 action text not null,
 before_state jsonb,
 after_state jsonb,
 happened_at timestamptz not null default now()
);
alter table public.concilia_admin_audit enable row level security;
revoke all on public.concilia_admin_audit from anon, authenticated;
grant select on public.concilia_admin_audit to authenticated;
drop policy if exists concilia_admin_audit_read_admin on public.concilia_admin_audit;
create policy concilia_admin_audit_read_admin on public.concilia_admin_audit
 for select to authenticated using ((select public.concilia_is_admin()));

create or replace function public.concilia_audit_staff()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.concilia_admin_audit(actor_id,target_user_id,action,before_state,after_state)
 values ((select auth.uid()), new.user_id, tg_op,
         case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end;
$$;
revoke all on function public.concilia_audit_staff() from public, anon, authenticated;
drop trigger if exists concilia_staff_audit on public.concilia_staff;
create trigger concilia_staff_audit after insert or update on public.concilia_staff
 for each row execute function public.concilia_audit_staff();
