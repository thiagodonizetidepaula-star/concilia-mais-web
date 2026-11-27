/* ConCiliar+ | Administração de regras aprendidas por empresa.
   Não altera lançamentos confirmados nem documentos de origem. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const selected=()=>typeof current==='function'?current():null;
const rules=c=>Array.isArray(c?.learnedCodes)?c.learnedCodes:[];
function render(){
 const root=$('#rulesManagerPanel');if(!root)return;
 const c=selected();
 if(!c){root.innerHTML='<p>Selecione uma empresa para visualizar suas regras aprendidas.</p>';return;}
 const items=rules(c),active=items.filter(r=>!r.archived&&!r.disabled).length,archived=items.filter(r=>r.archived).length;
 const row=(r,i)=>{
  const codes=Object.entries(r.codes||{}).sort((a,b)=>b[1]-a[1]).map(([code,count])=>esc(code)+' ('+Number(count||0)+')').join(', ')||'Nenhum código confirmado';
  const status=r.archived?'Arquivada':r.disabled?'Desativada':'Ativa';
  return '<tr><td><strong>'+esc(r.label||r.key)+'</strong><small style="display:block">'+esc(r.bank||'Empresa')+' · '+esc(r.key||'')+'</small></td><td>'+codes+'</td><td>'+esc(r.overrideCode||'Automático')+'</td><td>'+status+'</td><td><div class="inline-actions">'+
   '<button type="button" data-rule-action="edit" data-rule-index="'+i+'" '+(r.archived?'disabled':'')+'>Editar</button>'+
   '<button type="button" data-rule-action="code" data-rule-index="'+i+'" '+(r.archived?'disabled':'')+'>Código</button>'+
   '<button type="button" data-rule-action="toggle" data-rule-index="'+i+'" '+(r.archived?'disabled':'')+'>'+(r.disabled?'Ativar':'Desativar')+'</button>'+
   '<button type="button" data-rule-action="archive" data-rule-index="'+i+'">'+(r.archived?'Restaurar':'Arquivar')+'</button></div></td></tr>';
 };
 root.innerHTML='<article class="panel"><h2>Biblioteca de regras aprendidas</h2>'+
 '<p>Empresa: <strong>'+esc(c.name||'Sem nome')+'</strong>. As alterações afetam sugestões futuras; lançamentos já confirmados não serão reclassificados.</p>'+
 '<p>'+items.length+' regra(s) · '+active+' ativa(s) · '+archived+' arquivada(s)</p>'+
 (items.length?'<div class="tablewrap"><table><thead><tr><th>Histórico / Regra</th><th>Evidências</th><th>Código preferencial</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+items.map(row).join('')+'</tbody></table></div>':'<p>Nenhuma regra aprendida até agora. Confirme classificações para criar exemplos.</p>')+
 '<p class="subtle">Editar altera o nome visível. Código define uma preferência manual validada no plano de contas. Arquivar não exclui dados: a regra pode ser restaurada. Nenhuma ação modifica o extrato original.</p></article>';
}
async function modify(button){
 const c=typeof getCompany==='function'?getCompany():selected();if(!c)return;
 const i=Number(button.dataset.ruleIndex),r=rules(c)[i],kind=button.dataset.ruleAction;
 if(!Number.isInteger(i)||!r||!['edit','code','toggle','archive'].includes(kind))return;
 const previous=structuredClone(r);
 if(kind==='edit'){
  if(r.archived)return;
  const label=prompt('Nome de identificação da regra:',r.label||r.key);
  if(label===null)return;
  if(!label.trim()||label.length>250)throw Error('Informe um nome de até 250 caracteres.');
  r.label=label.trim();
 }
 if(kind==='code'){
  if(r.archived)return;
  const code=prompt('Código contábil preferencial. Deixe vazio para voltar ao aprendizado automático:',r.overrideCode||'');
  if(code===null)return;
  const value=code.trim();
  if(value&&(!c.plan.some(p=>p.analytic&&String(p.code)===value)||c.accounts.some(a=>String(a.chartCode)===value)))
   throw Error('Selecione um código analítico de contrapartida válido, diferente de uma conta bancária.');
  if(value)r.overrideCode=value;else delete r.overrideCode;
 }
 if(kind==='toggle'){
  if(r.archived)return;
  r.disabled=!r.disabled;
 }
 if(kind==='archive'){
  if(!r.archived&&!confirm('Arquivar esta regra? Ela deixará de sugerir classificações, mas poderá ser restaurada.'))return;
  r.archived=!r.archived;
 }
 r.updatedAt=new Date().toISOString();
 try{await store('REGRA_APRENDIDA_'+kind.toUpperCase(),(r.key||'')+' · '+(r.overrideCode||'sem preferência'));}
 catch(e){Object.keys(r).forEach(key=>delete r[key]);Object.assign(r,previous);render();throw e;}
 render();
 if(typeof say==='function')say('Regra atualizada para esta empresa.');
}
function init(){
 const nav=$('#nav'),main=document.querySelector('main');if(!nav||!main)return;
 if(!$('#rulesNav')){const btn=document.createElement('button');btn.id='rulesNav';btn.type='button';btn.dataset.page='regras';btn.textContent='Regras aprendidas';nav.append(btn);btn.addEventListener('click',()=>{showPage('regras');render();});}
 if(!$('#p-regras')){const sec=document.createElement('section');sec.className='page';sec.id='p-regras';sec.innerHTML='<div id="rulesManagerPanel"></div>';main.append(sec);}
 $('#p-regras').addEventListener('click',e=>{const btn=e.target.closest('[data-rule-action]');if(btn&&typeof action==='function')action(()=>modify(btn));});
 render();window.lucide?.createIcons();
}
window.ConciliaRules={render};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();