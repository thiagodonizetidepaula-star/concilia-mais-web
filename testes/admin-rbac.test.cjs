'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261128093000_concilia_admin_roles_proposta.sql'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'../administracao.js'),'utf8');
const invite=fs.readFileSync(path.join(__dirname,'../supabase/functions/concilia-invite-staff/index.ts'),'utf8');
test('admins: acesso sem auto-promocao via navegador',()=>{
 assert.match(sql,/revoke all on public\.concilia_admins from anon, authenticated/i);
 assert.match(sql,/grant select on public\.concilia_admins to authenticated/i);
 assert.doesNotMatch(sql,/grant\s+(insert|update|delete)[^;]*concilia_admins\s+to\s+authenticated/i);
 assert.match(sql,/user_id\s*=\s*\(select auth\.uid\(\)\)/);
});
test('equipe: sem exclusao; alteracoes exigem administrador e auditadas',()=>{
 assert.match(sql,/alter table public\.concilia_staff enable row level security/);
 assert.match(sql,/with check \(\(select public\.concilia_is_admin\(\)\)\)/);
 assert.match(sql,/create trigger concilia_staff_audit/);
 assert.doesNotMatch(sql,/grant.*delete.*concilia_staff/i);
});
test('servidor de convites: autenticacao e chave privada somente no servidor',()=>{
 assert.match(invite,/auth\.getUser\(bearer\.slice\(7\)\)/);
 assert.match(invite,/\.from\('concilia_admins'\)/);
 assert.match(invite,/auth\.admin\.inviteUserByEmail/);
 assert.match(invite,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.doesNotMatch(js,/SUPABASE_SERVICE_ROLE_KEY|service_role/);
 assert.match(js,/rpc\('concilia_is_admin'\)/);
});
