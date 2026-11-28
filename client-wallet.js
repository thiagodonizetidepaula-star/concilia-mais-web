/* ConCiliar+ | Carteira de Clientes — Etapa 01
   Usa empresas já existentes no workspace autenticado; não duplica cadastros,
   não mexe no núcleo contábil nem concede acesso a outra conta. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const onlyDigits=s=>String(s||'').replace(/\D/g,'');
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const cnpjValid=input=>{
 const s=onlyDigits(input);
 if(s.length!==14||/^(\d)\1{13}$/.test(s))return false;
 for(const size of [12,13]){
  let weight=size-7,sum=0;
  for(let i=0;i<size;i++){sum+=Number(s[i])*weight;weight=weight===2?9:weight-1;}
  const digit=sum%11<2?0:11-sum%11;
  if(Number(s[size])!==digit)return false;
 }
 return true;
};
const fmtCnpj=v=>{const d=onlyDigits(v);return d.length===14?d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):String(v||'Não informado');};
const userId=()=>window.ConciliaCloud?.accountId?.()||'';
const available=()=>{
 const uid=userId();if(!uid||!window.ConciliaCloud?.authenticated?.())return [];
 return (state.companies||[]).filter(c=>!Array.isArray(c.walletAssignedUserIds)||c.walletAssignedUserIds.includes(uid));
};
let filter='',editing=null,viewing=null,busy=false;
function selectCompany(id,target){
 if(!available().some(c=>c.id===id))throw Error('Empresa fora da carteira autorizada.');
 companyId=id;renderSelection();$('#companySelect').value=id;
 showPage('empresas');
 if(target){const el=$(target);el?.scrollIntoView({behavior:'smooth',block:'start'});}
}
function card(c){
 const id=escapeHtml(c.id),name=escapeHtml(c.name||'Empresa sem identificação'),fantasy=escapeHtml(c.fantasyName||'');
 return '<article class="wallet-client-card"><div><span class="wallet-client-icon"><i data-lucide="building-2"></i></span><div class="wallet-client-title"><h3>'+name+'</h3>'+
 (fantasy?'<span>Fantasia: '+fantasy+'</span>':'')+
 '<small>CNPJ: '+escapeHtml(fmtCnpj(c.cnpj))+'</small></div></div>'+
 '<p><span>'+(Array.isArray(c.plan)?c.plan.length:0)+' contas no plano</span><span>'+(c.partners||[]).length+' sócio(s)</span><span>'+(c.relatedCompanies||[]).length+' empresa(s) relacionada(s)</span></p>'+
 '<div class="wallet-actions"><button type="button" class="secondary" data-wallet="detail" data-id="'+id+'">Detalhes</button>'+
 '<button type="button" class="secondary" data-wallet="edit" data-id="'+id+'">Editar</button>'+
 '<button type="button" class="secondary" data-wallet="plan" data-id="'+id+'">Plano de contas</button>'+
 '<button type="button" class="secondary" data-wallet="partners" data-id="'+id+'">Sócios</button>'+
 '<button type="button" class="secondary" data-wallet="related" data-id="'+id+'">Relacionadas</button></div></article>';
}
function details(c){
 if(!c)return '';
 return '<section class="wallet-detail"><div class="wallet-section-head"><h3>Detalhes de '+escapeHtml(c.name)+'</h3><button type="button" class="secondary" data-wallet="close">Fechar</button></div>'+
 '<dl><div><dt>Razão social</dt><dd>'+escapeHtml(c.name)+'</dd></div><div><dt>Nome fantasia</dt><dd>'+escapeHtml(c.fantasyName||'Não informado')+'</dd></div>'+
 '<div><dt>CNPJ</dt><dd>'+escapeHtml(fmtCnpj(c.cnpj))+'</dd></div><div><dt>Código no Domínio</dt><dd>'+escapeHtml(c.dominio||'Não informado')+'</dd></div>'+
 '<div><dt>Sócios cadastrados</dt><dd>'+((c.partners||[]).map(p=>escapeHtml(p.name)).join(', ')||'Nenhum')+'</dd></div>'+
 '<div><dt>Empresas relacionadas</dt><dd>'+((c.relatedCompanies||[]).map(p=>escapeHtml(p.name)).join(', ')||'Nenhuma')+'</dd></div>'+
 '<div><dt>Observações</dt><dd>'+escapeHtml(c.clientNotes||'Nenhuma')+'</dd></div></dl></section>';
}
function form(c){
 if(!c)return '';
 return '<section class="wallet-edit"><div class="wallet-section-head"><h3>Editar dados cadastrais</h3><button type="button" data-wallet="cancel" class="secondary">Cancelar</button></div>'+
 '<form id="walletEditor" class="form">'+
 '<label>Razão social<input name="name" maxlength="180" required value="'+escapeHtml(c.name||'')+'"></label>'+
 '<label>Nome fantasia<input name="fantasyName" maxlength="180" value="'+escapeHtml(c.fantasyName||'')+'"></label>'+
 '<label>CNPJ (sujeito a validação)<input name="cnpj" inputmode="numeric" maxlength="18" value="'+escapeHtml(fmtCnpj(c.cnpj||''))+'"></label>'+
 '<label>Observações<textarea name="clientNotes" maxlength="1500" rows="3">'+escapeHtml(c.clientNotes||'')+'</textarea></label>'+
 '<p class="micro">Alterar o CNPJ exige confirmação específica. O sistema não transfere lançamentos ou códigos entre empresas.</p>'+
 '<div class="wallet-actions"><button type="submit" class="primary" '+(busy?'disabled':'')+'>Salvar alterações</button><button type="button" data-wallet="cancel" class="secondary">Cancelar</button></div>'+
 '</form></section>';
}
function render(){
 const root=$('#walletPanel');if(!root)return;
 const uid=userId(),list=available(),term=String(filter||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const filtered=list.filter(c=>[c.name,c.fantasyName,c.cnpj].some(v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(term))||onlyDigits(c.cnpj).includes(onlyDigits(term)&&/\d/.test(term)?onlyDigits(term):'\uFFFF'));
 const currentEditing=editing?list.find(c=>c.id===editing):null;
 const currentDetails=viewing?list.find(c=>c.id===viewing):null;
 root.innerHTML='<div class="wallet-top"><div><span class="prod-kicker">GERENCIAMENTO INDIVIDUAL</span><h2>Seus clientes</h2>'+
 '<p>Empresas cadastradas pela importação do plano de contas do Domínio. Os dados e a aprendizagem permanecem no cadastro original.</p></div>'+
 '<div class="wallet-total"><strong>'+list.length+'</strong><small>clientes vinculados</small></div></div>'+
 (!uid?'<p class="prod-notice">Entre na sua conta para consultar a carteira.</p>':'')+
 '<div class="wallet-toolbar"><label>Localizar cliente<input type="search" id="walletSearch" placeholder="Pesquise por razão social ou CNPJ" value="'+escapeHtml(filter)+'" autocomplete="off"></label>'+
 '<span>Mostrando '+filtered.length+' de '+list.length+' empresas</span></div>'+
 (currentEditing?form(currentEditing):'')+(currentDetails&&!currentEditing?details(currentDetails):'')+
 '<div class="wallet-grid">'+(filtered.length?filtered.map(card).join(''):'<p class="wallet-empty">Nenhum cliente encontrado na sua carteira.</p>')+'</div>'+
 '<p class="wallet-footnote">Cada conta acessa apenas o workspace autorizado no Supabase. Vincular uma mesma empresa a diferentes funcionários exige configuração de permissões no servidor; não é feito automaticamente nesta etapa.</p>';
 window.lucide?.createIcons();
}
async function saveEdit(formEl){
 if(busy)return;
 const c=available().find(c=>c.id===editing);if(!c)throw Error('Empresa não disponível na carteira.');
 const data=new FormData(formEl),name=String(data.get('name')||'').trim().replace(/\s+/g,' '),fantasyName=String(data.get('fantasyName')||'').trim(),raw=String(data.get('cnpj')||'').trim(),
 cnpj=onlyDigits(raw),clientNotes=String(data.get('clientNotes')||'').trim();
 if(name.length<2)throw Error('Informe a razão social válida.');
 if(cnpj&&!cnpjValid(cnpj))throw Error('O CNPJ informado é inválido. Confira os dígitos.');
 if(!cnpj&&raw)throw Error('Informe o CNPJ completo ou deixe o campo vazio.');
 if(!cnpj&&onlyDigits(c.cnpj))throw Error('O CNPJ existente não pode ser apagado. Para correções, informe o novo CNPJ válido e confirme a alteração.');
 if(cnpj&&(state.companies||[]).some(x=>x.id!==c.id&&onlyDigits(x.cnpj)===cnpj))throw Error('Este CNPJ já pertence a outra empresa no cadastro.');
 if(cnpj!==onlyDigits(c.cnpj)){
  if(!confirm('ATENÇÃO: você está alterando o CNPJ de um cadastro com plano e histórico. Confirma que é a mesma pessoa jurídica e verificou a documentação oficial? Nenhum lançamento será transferido entre empresas.'))return;
 }
 const previous={name:c.name,fantasyName:c.fantasyName,cnpj:c.cnpj,clientNotes:c.clientNotes,nameManuallyEdited:c.nameManuallyEdited,identityVerified:c.identityVerified};
 busy=true;
 c.name=name;c.fantasyName=fantasyName;c.cnpj=cnpj;c.clientNotes=clientNotes;
 c.nameManuallyEdited=true;
 if(cnpj!==onlyDigits(previous.cnpj))c.identityVerified=false; // requer verificação explícita na próxima importação
 try{
  await store('CARTEIRA_CLIENTE_ATUALIZADO',c.id+' · dados cadastrais');
  editing=null;viewing=c.id;renderSelection();render();say(typeof cloudSyncEnabled!=='undefined'&&!cloudSyncEnabled?'Cadastro salvo localmente. A sincronização do Supabase está pendente; confira o aviso de conexão.':'Cadastro atualizado. Plano, histórico e regras preservados.');
 }catch(err){
  Object.assign(c,previous);render();throw err;
 }finally{busy=false;}
}
function init(){
 const root=$('#walletPanel');if(!root)return;
 root.addEventListener('input',event=>{if(event.target.id==='walletSearch'){filter=event.target.value;const pos=event.target.selectionStart;render();const next=$('#walletSearch');next?.focus();next?.setSelectionRange(pos,pos);}});
 root.addEventListener('click',event=>{
  const b=event.target.closest('button[data-wallet]');if(!b)return;
  event.preventDefault();const a=b.dataset.wallet,id=b.dataset.id;
  if(a==='edit'){editing=id;viewing=null;render();return;}
  if(a==='detail'){viewing=id;editing=null;render();return;}
  if(a==='close'||a==='cancel'){editing=null;viewing=null;render();return;}
  if(a==='plan'||a==='partners'||a==='related'){
   try{selectCompany(id,a==='partners'?'#partnerForm':a==='related'?'#relatedCompanyForm':'#planTable');}
   catch(err){say(err.message,true);}
  }
 });
 root.addEventListener('submit',event=>{if(event.target.id==='walletEditor'){event.preventDefault();saveEdit(event.target).catch(err=>say(err.message||String(err),true));}});
}
window.ConciliaWallet={render,cnpjValid,visible:available};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();