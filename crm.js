/* ConCiliar+ | CRM Contábil — relacionamento e cobrança EXCLUSIVAMENTE manuais.
   Preserva plano, regras aprendidas, Razão, impostos, conciliações e histórico Excel. */
(()=>{'use strict';
const C=window.ConciliaCrmCore,$=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const cloudUser=()=>window.ConciliaCloud?.accountId?.()||null;
const getCompany=id=>C.authorizedCompanies(state.companies,cloudUser()).find(c=>c.id===id);
const config=()=>{try{return C.schedule(state.crmSettings?.dates||C.DEFAULTS)}catch(e){console.warn('Configuração CRM inválida:',e);return C.DEFAULTS;}};
const now=()=>new Date();
const summary=()=>C.summary(state.companies,cloudUser(),now(),config());
const fmtCnpj=v=>{const s=String(v||'').replace(/\D/g,'');return s.length===14?s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):String(v||'');};
const fmtDate=s=>s?s.split('-').reverse().join('/'):'Não informado';
const option=(v,name,selected)=>'<option value="'+esc(v)+'"'+(String(v)===String(selected)?' selected':'')+'>'+esc(name)+'</option>';
const formatPeriod=s=>s?s.split('-').reverse().join('/'):'';
let tab='charge',search='',filterYear='all',filterPeriod='all',filterStatus='',selected=null,selectedPeriods=[],configEditing=false,configDraft=null,historyOpen=false,busy=false;
function allRows(){
 const data=summary();
 let items=data.eligible;
 if(search.trim()){const text=search.trim().toLowerCase(),dg=text.replace(/\D/g,'');items=items.filter(({company:c})=>[c.name,c.cnpj,c.dominio,...(c.emails||[]).map(e=>typeof e==='string'?e:e.value)].some(x=>String(x||'').toLowerCase().includes(text))||(dg.length>2&&String(c.cnpj||'').replace(/\D/g,'').includes(dg)));}
 if(filterYear!=='all')items=items.filter(x=>x.periods.some(p=>p.period.startsWith(filterYear)));
 if(filterPeriod!=='all')items=items.filter(x=>x.periods.some(p=>p.period===filterPeriod));
 if(filterStatus)items=items.filter(x=>x.periods.some(p=>C.statusFor(x.company,p.period)===filterStatus));
 return items;
}
function eventHistory(c){
 return (c.crmHistory||[]).slice().sort((a,b)=>String(b.occurredAt||String(b.createdAt||'').slice(0,10)).localeCompare(String(a.occurredAt||String(a.createdAt||'').slice(0,10)))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}
function latestCharge(c){return eventHistory(c).find(x=>x.type==='charge')?.occurredAt||null;}
function row(c,periods){const id=esc(c.id),emails=(c.emails||[]).map(e=>typeof e==='string'?e:e.value).filter(Boolean),charges=(c.crmHistory||[]).filter(e=>e.type==='charge'),p=periods.map(x=>x.period).join(', '),status=periods.map(x=>C.statusFor(c,x.period)),unique=[...new Set(status)];
 return '<tr><td><strong>'+esc(c.dominio||'—')+'</strong></td><td><strong>'+esc(c.name||'')+'</strong><small>'+esc(fmtCnpj(c.cnpj))+'</small></td><td class="crm-mail">'+esc(emails.join('; ')||'Não informado')+'</td><td>'+esc(p)+'</td><td>'+periods.map(x=>'<span class="crm-pill">'+esc(x.status)+'</span>').join(' ')+'</td><td>'+esc(fmtDate(latestCharge(c)))+'</td><td>'+charges.length+'</td><td>'+unique.map(x=>'<span class="crm-pill">'+esc(x)+'</span>').join(' ')+'</td><td><button type="button" data-crm-select="'+id+'">Abrir CRM</button></td></tr>';
}
function configHtml(){
 const x=config(),next=C.scheduleNext(C.todayBrazil(now()),x);
 const d=configDraft||x;
 return '<section class="crm-settings"><div class="crm-row"><div><h3>Configurações de Cobranças</h3><p>Recorrência mensal e anual · horário de Brasília · nenhuma alteração automática em feriados/fins de semana.</p></div><div class="crm-actions">'+(configEditing?'<button type="button" data-crm-config="save">Salvar</button><button type="button" data-crm-config="cancel" class="secondary">Cancelar</button>':'<button type="button" data-crm-config="edit">Editar</button>')+'<button type="button" data-crm-config="restore" class="secondary">Restaurar datas padrão</button></div></div>'+
 '<div class="crm-dates">'+[['reminder1','1º lembrete'],['charge1','1ª cobrança'],['reminder2','2º lembrete'],['charge2','2ª cobrança']].map(([k,label])=>'<label>'+label+'<input '+(configEditing?'':'disabled')+' name="'+k+'" data-crm-setting="'+k+'" type="number" min="1" max="31" value="'+(configEditing?d[k]:x[k])+'"></label>').join('')+
 '<label>Meses curtos (29–31)<select name="shortMonth" data-crm-setting="shortMonth" '+(configEditing?'':'disabled')+'>'+option('last-day','Último dia do mês',configEditing?d.shortMonth:x.shortMonth)+option('skip','Não agendar neste mês',configEditing?d.shortMonth:x.shortMonth)+'</select></label></div>'+
 '<small>Próximos eventos: '+next.slice(0,4).map(e=>esc(e.type)+' em '+fmtDate(e.date)).join(' · ')+'</small></section>';
}
function listHtml(){
 const dat=summary(),rows=allRows(),next=dat.nextReminder,charge=dat.nextCharge;
 const stats=[['Empresas a cobrar',dat.companiesDue],['Cobradas na rodada',dat.roundCharged],['Ainda não cobradas',dat.roundPending],['Aguardando retorno',dat.awaitingReturn],['Com pendências',dat.documentPending],['Atrasos recorrentes',dat.recurrent]];
 const years=[...new Set(C.authorizedCompanies(state.companies,cloudUser()).flatMap(c=>Object.keys(c.documentHistory||{}).map(x=>x.slice(0,4))))].sort().reverse();
 const periods=[...new Set(C.authorizedCompanies(state.companies,cloudUser()).flatMap(c=>Object.keys(c.documentHistory||{})))].sort().reverse();
 return '<header class="crm-heading"><div><span>RELACIONAMENTO CONTÁBIL</span><h2>CRM Contábil</h2><p>Cobranças realizadas manualmente no Outlook corporativo. Nenhum e-mail é enviado pelo aplicativo.</p></div><div><small>Brasília: '+fmtDate(dat.today)+'</small></div></header>'+
 '<div class="crm-metrics">'+stats.map(([n,v])=>'<div><strong>'+v+'</strong><small>'+n+'</small></div>').join('')+'</div>'+
 '<div class="crm-next"><div><strong>Próximo lembrete</strong><p>'+esc(next?fmtDate(next.date)+' — '+(next.round===1?'1ª':'2ª')+' rodada':'Sem evento')+'</p></div><div><strong>Próxima cobrança</strong><p>'+esc(charge?fmtDate(charge.date)+' — '+(charge.round===1?'1ª':'2ª')+' rodada':'Sem evento')+'</p></div></div>'+
 '<div class="crm-alerts" aria-live="polite">'+(dat.alerts.length?dat.alerts.map(e=>'<div><b>'+(e.overdue?'Acompanhar evento vencido: ':'Evento programado: ')+esc(e.type)+'</b> · '+fmtDate(e.date)+' · '+e.companies+' empresa(s) com pendências</div>').join(''):'Nenhum evento de cobrança ocorreu ainda neste mês.')+'</div>'+
 configHtml()+
 '<section class="crm-filter"><label>Pesquisar empresa, e-mail ou CNPJ<input type="search" id="crmSearch" value="'+esc(search)+'" placeholder="Pesquisar carteira..."></label>'+
 '<label>Ano<select data-crm-filter="year">'+option('all','Todos',filterYear)+years.map(y=>option(y,y,filterYear)).join('')+'</select></label>'+
 '<label>Competência<select data-crm-filter="period">'+option('all','Todas',filterPeriod)+periods.map(p=>option(p,p,filterPeriod)).join('')+'</select></label>'+
 '<label>Situação CRM<select data-crm-filter="status">'+option('','Todas',filterStatus)+C.CRM_STATUSES.map(x=>option(x,x,filterStatus)).join('')+'</select></label></section>'+
 '<p class="crm-caption">'+rows.length+' empresas na lista automática; '+dat.companiesUnknown+' empresas com competências sem preenchimento, separadas para conferência. Competências futuras, recebidas, inativas e não aplicáveis não entram em cobrança.</p>'+
 '<div class="crm-scroll"><table><thead><tr><th>Cód. Domínio</th><th>Razão social / CNPJ</th><th>E-mails</th><th>Competências</th><th>Status documental</th><th>Última cobrança</th><th>Qtd. cobradas</th><th>Situação CRM</th><th>Ação</th></tr></thead><tbody>'+rows.map(x=>row(x.company,x.periods)).join('')+'</tbody></table></div>'+
 '<details class="crm-unknown"><summary>Registros sem preenchimento: '+dat.companiesUnknown+' empresas (conferência, não cobrança automática)</summary><div>'+dat.unfilled.map(x=>'<p>'+esc(x.company.name)+' · '+x.periods.map(y=>y.period).join(', ')+'</p>').join('')+'</div></details>';
}
function selectedHtml(){
 const c=getCompany(selected);if(!c)return '';
 const dat=C.eligiblePeriods(c,C.todayBrazil(now()),config()),hist=eventHistory(c),uid=cloudUser();
 const listed=dat.due;
 const dates=listed.map(x=>x.period);
 if(!selectedPeriods.length)selectedPeriods=dates;
 const emails=(c.emails||[]).map(e=>typeof e==='string'?e:e.value).join('; ');
 return '<section class="crm-detail"><div class="crm-row"><div><h3>'+esc(c.name)+'</h3><p>CNPJ '+esc(fmtCnpj(c.cnpj))+' · Domínio '+esc(c.dominio||'—')+'</p></div><div class="crm-actions"><button data-crm-action="back" class="secondary">Voltar</button><button data-crm-action="company" class="secondary">Cadastro</button><button data-crm-action="copy" class="secondary">Copiar e-mails</button></div></div>'+
 '<p><b>E-mails:</b> '+esc(emails||'Nenhum cadastrado')+'</p><p><b>Última cobrança efetivamente registrada:</b> '+fmtDate(latestCharge(c))+' · <b>Total de cobranças:</b> '+hist.filter(x=>x.type==='charge').length+'</p>'+
 '<div class="crm-actions"><button data-crm-tab="charge" class="'+(tab==='charge'?'':'secondary')+'">Registrar cobrança</button><button data-crm-tab="reply" class="'+(tab==='reply'?'':'secondary')+'">Registrar retorno</button><button data-crm-tab="note" class="'+(tab==='note'?'':'secondary')+'">Adicionar observações</button><button data-crm-tab="history" class="'+(tab==='history'?'':'secondary')+'">Consultar histórico</button></div>'+
 (tab==='history'?'<div class="crm-history">'+(hist.length?hist.map(e=>'<article><strong>'+esc(e.type==='charge'?'Cobrança manual':e.type==='reply'?'Retorno do cliente':e.type==='receipt'?'Registro de recebimento':'Observação')+' · '+fmtDate(e.occurredAt)+'</strong><p>Competências: '+esc((e.periods||[]).join(', '))+'</p><p>Situação: '+esc(e.status||'')+' · Meio: '+esc(e.medium||'—')+'</p><p>Responsável: '+esc(e.actorId||'Não informado')+' · '+esc(e.notes||'Sem observações')+'</p></article>').join(''):'Nenhum contato manual registrado. Status importados do Excel não são cobranças confirmadas.')+'</div>':
 '<form id="crmRecordForm" class="crm-record"><p>Selecione uma ou mais competências. Registrar cobrança não altera recebimento documental.</p>'+
 '<div class="crm-periods">'+listed.map(x=>'<label><input type="checkbox" name="periods" value="'+esc(x.period)+'" '+(selectedPeriods.includes(x.period)?'checked':'')+'><span>'+x.period+' · '+esc(x.status)+'</span></label>').join('')+'</div>'+
 '<label>Data efetiva do contato<input type="date" name="occurredAt" required max="'+C.todayBrazil(now())+'"></label>'+
 '<label>Meio de contato<select name="medium">'+option('Outlook manual','Outlook corporativo (manual)','Outlook manual')+option('Telefone','Telefone','Outlook manual')+option('WhatsApp manual','WhatsApp (manual)','Outlook manual')+option('Outro','Outro','Outlook manual')+'</select></label>'+
 '<label>Situação da cobrança<select name="status">'+C.CRM_STATUSES.map(x=>option(x,x,tab==='charge'?'Aguardando retorno':tab==='reply'?'Cliente respondeu':'A cobrar')).join('')+'</select></label>'+
 '<label>Próximo acompanhamento (opcional)<input type="date" name="nextFollowUp"></label>'+
 '<label>Observações<textarea name="notes" maxlength="1500" rows="3" placeholder="Descrição real do contato"></textarea></label>'+
 '<p>Funcionário autenticado: '+esc(window.ConciliaCloud.identity?.()||uid||'Não autenticado')+'</p>'+
 '<button type="submit">Salvar registro manual</button></form>')+'</section>';
}
function overview(){
 const root=$('#crmOverviewAlerts');if(!root)return;
 const dat=summary(),tod=dat.today,events=dat.alerts;
 root.innerHTML='<strong>CRM Contábil · Cobranças manuais</strong> · '+dat.companiesDue+' empresa(s) com documentos exigíveis. '+dat.companiesUnknown+' com campos sem registro.'+
 (events.length?' <span>'+events.map(e=>(e.overdue?'Atrasado: ':'Hoje/previsto: ')+e.type+' '+fmtDate(e.date)).join(' | ')+'</span>':'')+
 '<button type="button" id="crmOverviewOpen" class="secondary">Abrir CRM Contábil</button>';
}
function render(){
 const root=$('#crmPanel');if(!root)return;
 if(!cloudUser()||!window.ConciliaCloud?.authenticated?.()){selected=null;selectedPeriods=[];root.innerHTML='<p>Faça login na sua conta para consultar o CRM.</p>';return;}
 // Após troca de usuário ou logout, nunca manter a seleção da conta anterior.
 if(selected&&!getCompany(selected)){selected=null;selectedPeriods=[];tab='charge';}
 root.innerHTML=selected?selectedHtml():listHtml();
 overview();
}
async function persist(kind,detail,undo){
 if(busy)throw Error('Outra gravação está em andamento.');
 if(!window.ConciliaCloud?.authenticated?.()||!cloudSyncEnabled)throw Error('CRM exige sessão autenticada e sincronização Supabase disponível.');
 busy=true;
 const previous=window.ConciliaCloud?.revision?.();
 try{
  await store(kind,detail);
  if(!cloudSyncEnabled||window.ConciliaCloud?.revision?.()===previous)throw Error('Sincronização não foi confirmada. Verifique sua conexão antes de continuar.');
 }catch(err){undo();render();throw err;}
 finally{busy=false;}
}
async function saveSettings(values,restore=false){
 const before=state.crmSettings===undefined?null:C.safeCopy(state.crmSettings);
 try{
  const newValues=C.schedule(values);
  state.crmSettings={...(state.crmSettings||{}),dates:newValues,changedAt:new Date().toISOString(),changedBy:cloudUser()};
  await persist(restore?'CRM_DATAS_RESTAURADAS':'CRM_DATAS_CONFIGURADAS',JSON.stringify(newValues),()=>{if(before===null)delete state.crmSettings;else state.crmSettings=before;});
  configEditing=false;configDraft=null;render();
 }catch(e){alert(e.message);}
}
function setFormConfig(e){
 const el=e.target.closest('[data-crm-setting]');if(!el)return;
 if(!configDraft)configDraft={...config()};
 configDraft[el.dataset.crmSetting]=el.dataset.crmSetting==='shortMonth'?el.value:Number(el.value);
}
async function onRecord(form){
 const c=getCompany(selected);if(!c)return;
 const data=new FormData(form);
 const periods=data.getAll('periods').map(String);
 const status=String(data.get('status')||'');
 const type=tab==='charge'?'charge':tab==='reply'?'reply':'note';
 const fields={type,periods,status,occurredAt:data.get('occurredAt'),medium:data.get('medium'),notes:data.get('notes'),nextFollowUp:data.get('nextFollowUp'),round:summary().round};
 const before=C.safeCopy(c.crmHistory||[]);
 let result;
 try{result=C.eventInput(c,fields,{userId:cloudUser(),today:now()});}
 catch(e){
  if(e.message.startsWith('POSSIVEL_DUPLICIDADE')&&confirm('Registro semelhante já existe. Confirma que este é um NOVO contato legítimo?'))result=C.eventInput(c,fields,{userId:cloudUser(),today:now(),allowDuplicate:true});
  else{alert(e.message);return;}
 }
 C.addEvent(c,result);
 try{await persist('CRM_CONTATO_MANUAL',c.id+' · '+type+' · '+result.occurredAt,()=>{c.crmHistory=before;});tab='history';render();}
 catch(e){alert(e.message);}
}
function init(){
 const el=$('#crmPanel');if(!el)return;
 el.addEventListener('input',e=>{if(e.target.matches('[data-crm-setting]'))setFormConfig(e);if(e.target.id==='crmSearch'){search=e.target.value;const cursor=e.target.selectionStart;render();$('#crmSearch')?.focus();$('#crmSearch')?.setSelectionRange(cursor,cursor);}});
 el.addEventListener('change',e=>{if(e.target.matches('[data-crm-setting]'))setFormConfig(e);const k=e.target.dataset.crmFilter;if(k){const value=e.target.value;if(k==='year')filterYear=value;if(k==='period')filterPeriod=value;if(k==='status')filterStatus=value;render();}});
 el.addEventListener('click',e=>{
  const sel=e.target.closest('[data-crm-select]');if(sel){selected=sel.dataset.crmSelect;selectedPeriods=[];tab='charge';render();return;}
  const sw=e.target.closest('[data-crm-tab]');if(sw){tab=sw.dataset.crmTab;render();return;}
  const act=e.target.closest('[data-crm-action]');if(act){
   if(act.dataset.crmAction==='back'){selected=null;selectedPeriods=[];render();return;}
   const c=getCompany(selected);if(!c)return;
   if(act.dataset.crmAction==='copy'){const emails=(c.emails||[]).map(x=>typeof x==='string'?x:x.value).filter(Boolean).join('; ');if(!emails){alert('Nenhum e-mail cadastrado.');return;}navigator.clipboard?.writeText(emails).then(()=>alert('E-mails copiados.')).catch(()=>alert('Não foi possível copiar.'));return;}
   if(act.dataset.crmAction==='company'){window.ConciliaWallet.open(c.id);return;}
  }
  const configButton=e.target.closest('[data-crm-config]');if(configButton){
   const action=configButton.dataset.crmConfig;
   if(action==='edit'){configEditing=true;configDraft={...config()};render();}
   if(action==='cancel'){configEditing=false;configDraft=null;render();}
   if(action==='save'){try{saveSettings(configDraft||config());}catch(err){alert(err.message);}}
   if(action==='restore'){if(confirm('Restaurar 14/15/24/25? O histórico de cobranças continuará intacto.'))saveSettings(C.DEFAULTS,true);}
  }
 });
 el.addEventListener('submit',e=>{if(e.target.id!=='crmRecordForm')return;e.preventDefault();onRecord(e.target);});
 $('#crmOverviewAlerts')?.addEventListener('click',e=>{if(e.target.id==='crmOverviewOpen')showPage('crm');});
}
window.ConciliaCRM={render,overview,summary,config};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();