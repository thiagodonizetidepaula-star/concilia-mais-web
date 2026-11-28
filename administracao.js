/* ConCiliar+PLUS — administração com autorização sempre conferida no Supabase. */
(()=>{
'use strict';
const $=s=>document.querySelector(s);
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let active=false,booted=false;
const cloud=()=>window.ConciliaCloud;
const client=()=>cloud()?.connect();
const page=()=>$('#p-administracao');
const nav=()=>$('#adminNav');
const alert=(message,bad=false)=>{const el=$('#adminMessage');if(el){el.textContent=message;el.classList.toggle('error',!!bad);}};
function reset(){
 active=false;
 if(nav())nav().hidden=true;
 if(page())page().querySelector('#adminStaffRows').replaceChildren();
}
async function verify(){
 const cl=client();
 const {data:{user},error:authError}=await cl.auth.getUser();
 if(authError||!user){reset();return;}
 const {data,error}=await cl.rpc('concilia_is_admin');
 if(error||data!==true){reset();return;}
 active=true;
 nav().hidden=false;
 if(page().classList.contains('visible'))await refresh();
}
async function refresh(){
 if(!active)return;
 const {data,error}=await client().from('concilia_staff').select('user_id,display_name,access_role,active,updated_at').order('display_name',{ascending:true});
 if(error){alert('Não foi possível consultar a equipe: '+error.message,true);return;}
 const tbody=$('#adminStaffRows');
 tbody.innerHTML=(data||[]).map(x=>'<tr><td>'+escapeHtml(x.display_name)+'</td><td><code>'+escapeHtml(x.user_id)+'</code></td><td><select data-admin-role="'+escapeHtml(x.user_id)+'">'+[['gestor','Gestor'],['funcionario','Funcionário'],['consulta','Consulta']].map(([v,l])=>'<option value="'+v+'" '+(v===x.access_role?'selected':'')+'>'+l+'</option>').join('')+'</select></td><td><input type="checkbox" data-admin-active="'+escapeHtml(x.user_id)+'" '+(x.active?'checked':'')+' aria-label="Acesso ativo de '+escapeHtml(x.display_name)+'"></td><td><button type="button" data-admin-save="'+escapeHtml(x.user_id)+'" class="secondary">Salvar</button></td></tr>').join('')||'<tr><td colspan="5">Nenhum funcionário cadastrado.</td></tr>';
 alert('Equipe consultada. Mudanças de permissão são registradas para auditoria.');
}
async function write(user_id,changes,insert=false){
 if(!active)throw Error('Acesso administrativo não autorizado.');
 const cl=client(),{data:check,error:checkError}=await cl.rpc('concilia_is_admin');
 if(checkError||check!==true)throw Error('Sua permissão administrativa não está ativa.');
 const {data:{user}}=await cl.auth.getUser();
 const payload={...changes,updated_by:user.id,updated_at:new Date().toISOString()};
 const query=insert?cl.from('concilia_staff').insert({user_id,...payload}):cl.from('concilia_staff').update(payload).eq('user_id',user_id);
 const {error}=await query;if(error)throw error;
 await refresh();
}
function init(){
 if(booted)return;booted=true;
 const main=$('main'),menu=$('#nav');if(!main||!menu)return;
 const button=document.createElement('button');button.id='adminNav';button.type='button';button.dataset.page='administracao';button.hidden=true;button.innerHTML='<i data-lucide="shield-check"></i> Administração';menu.append(button);
 const section=document.createElement('section');section.className='page';section.id='p-administracao';
 section.innerHTML='<article class="panel admin-panel"><div class="admin-head"><i data-lucide="shield-check"></i><div><h2>Administração do ConCiliar+PLUS</h2><p>Equipe, perfis e auditoria de acessos. Apenas administradores validados pelo servidor podem gerenciar esta área.</p></div></div><p class="micro">Para cadastrar alguém, a pessoa precisa primeiro criar sua própria conta. Convites por e-mail serão disponibilizados somente após implantação de uma função segura no servidor.</p><form id="adminStaffForm" class="form"><h3>Vincular funcionário com conta existente</h3><label>Identificador UUID da conta<input name="user_id" required pattern="[0-9a-fA-F-]{36}" placeholder="UUID do usuário autenticado"></label><label>Nome de exibição<input name="display_name" required minlength="2" maxlength="140"></label><label>Perfil<select name="access_role"><option value="funcionario">Funcionário</option><option value="gestor">Gestor</option><option value="consulta">Consulta</option></select></label><button type="submit" class="primary">Cadastrar vínculo</button></form><div class="tablewrap"><table><thead><tr><th>Funcionário</th><th>Conta</th><th>Perfil</th><th>Ativo</th><th>Ação</th></tr></thead><tbody id="adminStaffRows"></tbody></table></div><p id="adminMessage" role="status"></p><p class="micro">Os perfis ainda não concedem acesso à carteira de empresas de outros usuários. Permissões de dados continuam determinadas pelas políticas RLS existentes.</p></article>';
 main.append(section);
 button.addEventListener('click',async()=>{if(!active)return;document.querySelectorAll('.page').forEach(x=>x.classList.toggle('visible',x===section));document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x===button));$('#pageTitle').textContent='Administração';$('#eyebrow').textContent='CONTROLE DE ACESSOS';$('#subtitle').textContent='Equipe e permissões sob auditoria.';await refresh();});
 section.querySelector('#adminStaffForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;const user_id=f.elements.namedItem('user_id').value.trim();const display_name=f.elements.namedItem('display_name').value.trim();const access_role=f.elements.namedItem('access_role').value;try{await write(user_id,{display_name,access_role,active:true},true);f.reset();}catch(error){alert(error.message,true);}});
 section.addEventListener('click',async e=>{const b=e.target.closest('[data-admin-save]');if(!b)return;const id=b.dataset.adminSave;const role=Array.from(section.querySelectorAll('[data-admin-role]')).find(x=>x.dataset.adminRole===id);const enabled=Array.from(section.querySelectorAll('[data-admin-active]')).find(x=>x.dataset.adminActive===id);try{await write(id,{access_role:role.value,active:enabled.checked});}catch(error){alert(error.message,true);}});
 window.lucide?.createIcons();
 try{const c=client();c.auth.onAuthStateChange(()=>{Promise.resolve().then(()=>verify().catch(()=>reset()));});void verify().catch(()=>reset());}catch{reset();}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
