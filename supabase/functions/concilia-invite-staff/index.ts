// ConCiliar+PLUS — convite de funcionario; deploy somente apos homologacao.
// Chave service role nunca enviada ao navegador. Acesso limitado ao admin cadastrado.
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
const ORIGIN='https://concilia-mais-web.onrender.com';
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const answer=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{headers:cors});
 if(request.method!=='POST')return answer({error:'Método não permitido.'},405);
 if(request.headers.get('origin')&&request.headers.get('origin')!==ORIGIN)return answer({error:'Origem não permitida.'},403);
 const bearer=request.headers.get('Authorization')||'';
 if(!bearer.startsWith('Bearer '))return answer({error:'Autenticação obrigatória.'},401);
 const url=Deno.env.get('SUPABASE_URL');
 const publishable=Deno.env.get('SUPABASE_ANON_KEY');
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!publishable||!service)return answer({error:'Serviço não configurado.'},503);
 try{
  const authClient=createClient(url,publishable,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await authClient.auth.getUser(bearer.slice(7));
  if(authError||!user)return answer({error:'Sessão inválida.'},401);
  const adminClient=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:admin,error:adminError}=await adminClient.from('concilia_admins').select('active').eq('user_id',user.id).maybeSingle();
  if(adminError||!admin?.active)return answer({error:'Acesso administrativo necessário.'},403);
  const raw=await request.text();
  if(raw.length>10000)return answer({error:'Requisição muito grande.'},413);
  const payload=JSON.parse(raw);
  const email=String(payload?.email||'').trim().toLowerCase(),name=String(payload?.display_name||'').trim();
  const role=String(payload?.access_role||'funcionario');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return answer({error:'E-mail inválido.'},400);
  if(name.length<2||name.length>140)return answer({error:'Nome deve ter entre 2 e 140 caracteres.'},400);
  if(!['gestor','funcionario','consulta'].includes(role))return answer({error:'Perfil inválido.'},400);
  const {data:invitation,error:inviteError}=await adminClient.auth.admin.inviteUserByEmail(email,{redirectTo:ORIGIN+'/'});
  if(inviteError||!invitation?.user)return answer({error:'Não foi possível enviar o convite. Verifique se a conta já existe.'},409);
  const target=invitation.user.id;
  const {error:linkError}=await adminClient.from('concilia_staff').insert({user_id:target,display_name:name,access_role:role,active:true,updated_by:user.id});
  if(linkError){
   await adminClient.from('concilia_admin_audit').insert({actor_id:user.id,target_user_id:target,action:'invite_staff_link_failed',after_state:{role}});
   return answer({error:'Convite enviado, mas vínculo da equipe precisa de revisão pelo administrador.'},500);
  }
  const {error:auditError}=await adminClient.from('concilia_admin_audit').insert({actor_id:user.id,target_user_id:target,action:'invited_by_admin',after_state:{role}});
  if(auditError)return answer({error:'Convite enviado, porém o registro de auditoria precisa de revisão.'},500);
  return answer({success:true,message:'Convite enviado e perfil de funcionário cadastrado.'});
 }catch(error){return answer({error:error instanceof SyntaxError?'Dados do convite inválidos.':'Não foi possível concluir a operação.'},400);}
});
