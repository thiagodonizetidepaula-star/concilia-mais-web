/* ConCiliar+PLUS | Produtividade manual v2 — separada dos dados de conciliação.
   Uma sessão começa somente com INICIAR. Indicadores não inferem valores de extratos. */
(()=>{'use strict';
const STORAGE='concilia-prod-manual-v2';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const number=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
const integer=value=>Math.min(1000000,Math.floor(number(value)));
const fmt=seconds=>{const s=Math.max(0,Math.round(number(seconds)));return Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'min '+String(s%60).padStart(2,'0')+'s';};
const fmtDelta=s=>(s<0?'−':'')+fmt(Math.abs(s));
const dateTime=value=>value?new Date(value).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const dateOnly=value=>value?new Date(value).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}):'—';
const sample=()=>({sessions:{},completed:[],drafts:[]});
let state=sample();
try{
 const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');
 if(saved&&typeof saved==='object'&&!Array.isArray(saved))
  state={sessions:saved.sessions&&typeof saved.sessions==='object'?saved.sessions:{},completed:Array.isArray(saved.completed)?saved.completed:[],drafts:Array.isArray(saved.drafts)?saved.drafts:[]};
}catch(e){console.warn('Histórico manual indisponível',e);}
let filter='30',selectedHistory='all';
const context=()=>{
 try{return {company:typeof current==='function'?current():null,companyId:typeof companyId!=='undefined'?String(companyId):'',period:typeof period!=='undefined'?String(period):'',userId:window.ConciliaCloud?.accountId?.()||''};}
 catch{return {company:null,companyId:'',period:'',userId:''};}
};
const scopeOf=c=>c.userId&&c.companyId&&c.period?[c.userId,c.companyId,c.period].join('::'):null;
const blank=c=>({id:null,userId:c.userId,companyId:c.companyId,companyName:c.company?.name||'',period:c.period,startedAt:null,finishedAt:null,seconds:0,runningSince:null,processed:0,pending:0,divergent:0,baseline:3});
const time=r=>r?number(r.seconds)+(r.runningSince?Math.max(0,(Date.now()-r.runningSince)/1000):0):0;
const metrics=r=>{
 if(!r?.startedAt)return {spent:0,manual:0,saved:0,productivity:0,processed:0,pending:0,divergent:0};
 const spent=time(r),manual=integer(r.processed)*number(r.baseline||3)*60;
 const saved=r.finishedAt?manual-spent:0;
 const productivity=r.finishedAt&&manual>0?Math.round(saved/manual*100):0;
 return {spent,manual,saved,productivity,processed:integer(r.processed),pending:integer(r.pending),divergent:integer(r.divergent)};
};
let cloudRevision=null,cloudReady=false,cloudStatus='Aguardando conexão com a nuvem',cloudQueue=Promise.resolve(),localVersion=0;
const ownState=(all,userId)=>({
 sessions:Object.fromEntries(Object.entries(all.sessions||{}).filter(([k,r])=>r?.userId===userId&&k.startsWith(userId+'::'))),
 completed:(all.completed||[]).filter(r=>r.userId===userId),
 drafts:(all.drafts||[]).filter(r=>r.userId===userId)
});
const mergeStates=(remote,local,userId)=>{
 const base=sample(),a=ownState(remote||base,userId),b=ownState(local||base,userId);
 const sessions={...a.sessions};
 for(const [k,r] of Object.entries(b.sessions)){
  const prev=sessions[k];
  if(!prev||String(r.updatedAt||'')>String(prev.updatedAt||''))sessions[k]=r;
 }
 const completed=new Map();
 for(const item of [...a.completed,...b.completed]){
  const id=String(item.id||item.companyId+'::'+item.startedAt+'::'+item.finishedAt);
  if(!completed.has(id))completed.set(id,item);
 }
 const drafts=new Map();
 for(const item of [...a.drafts,...b.drafts]){
  const id=[item.id,item.archivedAt,item.scope].join('::');
  if(!drafts.has(id))drafts.set(id,item);
 }
 return {sessions,completed:[...completed.values()],drafts:[...drafts.values()]};
};
const updateCloudBadge=()=>{
 const el=$('[data-prod-cloud]');
 if(el){el.textContent=cloudStatus;el.dataset.state=cloudStatus.startsWith('Salvo')?'saved':cloudStatus.startsWith('Aguardando')?'waiting':'pending';}
};
const write=next=>{
 try{
  const stamp=new Date().toISOString();
  const sessions={...next.sessions};
  for(const [k,r] of Object.entries(sessions))if(r!==state.sessions[k])sessions[k]={...r,updatedAt:stamp};
  next={...next,sessions};
  localStorage.setItem(STORAGE,JSON.stringify(next));
  state=next;localVersion++;
  cloudStatus='Aguardando sincronização com Supabase';
  updateCloudBadge();
  if(cloudReady)queueCloudSave();
  return true;
 }catch(e){console.error('Falha ao salvar produtividade manual',e);alert('Não foi possível salvar a medição. Os dados anteriores foram mantidos.');return false;}
};
async function syncCloud(){
 const cloud=window.ConciliaCloud,userId=cloud?.accountId?.();
 if(!userId||!cloud?.fetchPrivate)return false;
 cloudReady=false;cloudStatus='Sincronizando histórico com Supabase';updateCloudBadge();
 try{
  const result=await cloud.fetchPrivate('productivity');
  if(cloud.accountId()!==userId)return false;
  cloudRevision=result?.revision??null;
  const merged=mergeStates(result?.payload||sample(),state,userId);
  state={sessions:{...state.sessions,...merged.sessions},completed:[...state.completed.filter(r=>r.userId!==userId),...merged.completed],drafts:[...state.drafts.filter(r=>r.userId!==userId),...merged.drafts]};
  localStorage.setItem(STORAGE,JSON.stringify(state));
  cloudReady=true;
  // Inicialização faz também migração segura do histórico deste navegador para a conta na nuvem.
  await flushCloudSave();
  render();return true;
 }catch(e){
  cloudStatus='Falha na nuvem — dados locais preservados. Clique em Sincronizar';
  console.error('Sincronização inicial falhou',e);updateCloudBadge();render();
  return false;
 }
}
async function flushCloudSave(){
 const cloud=window.ConciliaCloud,userId=cloud?.accountId?.();
 if(!userId||!cloudReady)return false;
 for(let retry=0;retry<3;retry++){
  try{
   const version=localVersion,payload=ownState(state,userId);
   const revision=await cloud.savePrivate('productivity',payload,cloudRevision);
   if(cloud.accountId()!==userId)return false;
   cloudRevision=revision;
   cloudStatus='Salvo no Supabase';updateCloudBadge();
   if(version!==localVersion){queueCloudSave();}
   return true;
  }catch(err){
   if(/Conflito de sincronização/.test(err.message||'')&&retry<2){
    const remote=await cloud.fetchPrivate('productivity');
    cloudRevision=remote?.revision??null;
    const merged=mergeStates(remote?.payload||sample(),state,userId);
    state={sessions:{...state.sessions,...merged.sessions},completed:[...state.completed.filter(r=>r.userId!==userId),...merged.completed],drafts:[...state.drafts.filter(r=>r.userId!==userId),...merged.drafts]};
    localStorage.setItem(STORAGE,JSON.stringify(state));
    continue;
   }
   cloudStatus='Falha ao salvar na nuvem — clique em Sincronizar';
   updateCloudBadge();console.error('Produtividade pendente de sincronização',err);
   return false;
  }
 }
 return false;
}
function queueCloudSave(){
 cloudQueue=cloudQueue.catch(()=>false).then(()=>flushCloudSave());
 return cloudQueue;
}
const feedback=message=>{if(typeof say==='function')say(message);else console.info(message);};
const currentRecord=()=>{const c=context(),k=scopeOf(c);return k?state.sessions[k]||null:null;};
const canEdit=r=>!!(r?.startedAt&&!r.finishedAt);
const archiveDraft=(r,k)=>r?.startedAt||r?.processed||r?.pending||r?.divergent?{...r,seconds:time(r),runningSince:null,archivedAt:new Date().toISOString(),scope:k}:null;
const completedForUser=c=>state.completed.filter(r=>r.userId===c.userId);
const recorded=c=>completedForUser(c).sort((a,b)=>String(b.finishedAt||'').localeCompare(String(a.finishedAt||'')));
function saveRecord(r,action){
 const c=context(),k=scopeOf(c);if(!k)return false;
 const next={...state,sessions:{...state.sessions,[k]:r}};
 if(write(next)){feedback(action);render();return true;}return false;
}
async function perform(action){
 const c=context(),k=scopeOf(c),r=k?state.sessions[k]||blank(c):null;
 if(action==='csv'){exportCSV();return;}
 if(action==='sync'){await syncCloud();return;}
 if(!k){alert('Selecione uma empresa, a competência e entre na sua conta antes de iniciar a medição.');return;}
 if(action==='start'){
  if(window.ConciliaTrackingV4?.hasRunning?.()){alert('Há um cronômetro ativo no Controle de Conciliações. Pause ou finalize esse cronômetro para evitar contagem simultânea.');return;}
  if(r.finishedAt){alert('Esta medição já foi concluída. Clique em "Zerar tudo / Novo ciclo" antes de iniciar outra.');return;}
  if(r.runningSince)return;
  const now=Date.now();
  const next={...r,id:r.id||'med-'+now+'-'+Math.random().toString(36).slice(2,8),companyName:c.company?.name||r.companyName,startedAt:r.startedAt||new Date(now).toISOString(),runningSince:now};
  // Um único cronômetro em andamento por operador, ainda que mude de empresa.
  const sessions={...state.sessions,[k]:next};
  for(const [otherKey,other] of Object.entries(sessions)){
   if(otherKey!==k&&other?.userId===c.userId&&other.runningSince)
    sessions[otherKey]={...other,seconds:time(other),runningSince:null};
  }
  if(write({...state,sessions})){feedback(r.startedAt?'Cronômetro retomado.':'Nova medição iniciada. Registre seus lançamentos manualmente.');render();}
  return;
 }
 if(action==='pause'){
  if(r.runningSince)saveRecord({...r,seconds:time(r),runningSince:null},'Cronômetro pausado.');
  return;
 }
 if(action==='finish'){
  if(!r.startedAt||r.finishedAt){alert('Inicie uma medição antes de concluir.');return;}
  if(!confirm('Concluir esta conciliação e salvar data, duração e indicadores no histórico de evolução?'))return;
  const completed={...r,seconds:time(r),runningSince:null,finishedAt:new Date().toISOString(),companyName:c.company?.name||r.companyName};
  const exists=state.completed.some(x=>x.id===completed.id);
  const next={...state,sessions:{...state.sessions,[k]:completed},completed:exists?state.completed:state.completed.concat(completed)};
  if(write(next)){feedback('Conciliação concluída e registrada no histórico.');render();}return;
 }
 if(action==='reset'||action==='new-cycle'){
  if(!confirm('Zerar TODOS os indicadores desta medição? O histórico de conciliações concluídas será preservado. Extratos, Razão e classificações contábeis não serão alterados.'))return;
  const draft=archiveDraft(r,k);
  const next={...state,sessions:{...state.sessions,[k]:blank(c)},drafts:draft?state.drafts.concat(draft).slice(-150):state.drafts};
  if(write(next)){feedback('Indicadores zerados. Clique em Iniciar para começar a próxima medição.');render();}return;
 }
 if(action==='restore'){
  const drafts=[...state.drafts],index=drafts.map((x,i)=>({x,i})).reverse().find(item=>item.x.scope===k)?.i;
  if(index===undefined){alert('Não há medição anterior arquivada para esta empresa e competência.');return;}
  if(!confirm('Restaurar a última medição arquivada? A medição atual será arquivada, e o cronômetro ficará pausado.'))return;
  const older=drafts.splice(index,1)[0],previous=archiveDraft(r,k);
  if(previous)drafts.push(previous);
  const restored={...older,runningSince:null,finishedAt:older.finishedAt||null};
  delete restored.archivedAt;delete restored.scope;
  const next={...state,drafts:drafts.slice(-150),sessions:{...state.sessions,[k]:restored}};
  if(write(next)){feedback('Medição anterior restaurada.');render();}return;
 }
 if(action==='refresh'){render();feedback('Indicadores da medição atualizados.');}
}
function updateField(field,raw){
 if(!['processed','pending','divergent','baseline'].includes(field))return;
 const c=context(),k=scopeOf(c),r=currentRecord();
 if(!k||!canEdit(r)){alert('Clique em Iniciar para registrar seus indicadores manualmente.');render();return;}
 const v=field==='baseline'?Number(raw):integer(raw);
 if(!Number.isFinite(v)||(field==='baseline'?(v<.1||v>120):(v<0||v>1000000))){alert('Informe um número válido. Referência: 0,1 a 120 minutos; quantidades: 0 a 1.000.000.');render();return;}
 saveRecord({...r,[field]:v},'Indicadores manuais atualizados.');
}
function csvSafe(value){if(typeof value==='number')return String(value);const text=String(value??'');return /^[=+\-@\t\r]/.test(text)?'\''+text:text;}
function exportCSV(){
 const list=recorded(context()),rows=[['Empresa','Competência','Início','Conclusão','Duração (segundos)','Processados','Pendências','Divergências','Referência manual (min/lançamento)','Economia estimada (segundos)','Produtividade (%)']];
 for(const r of list){const m=metrics(r);rows.push([r.companyName||r.companyId,r.period,r.startedAt||'',r.finishedAt||'',Math.round(m.spent),m.processed,m.pending,m.divergent,r.baseline||3,Math.round(m.saved),m.productivity]);}
 const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+csvSafe(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
 a.href=url;a.download='concilia_evolucao_manual.csv';document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function historyData(){
 const c=context(),all=recorded(c);
 const now=Date.now(),maxAge=filter==='7'?7*86400000:filter==='30'?30*86400000:Infinity;
 return all.filter(r=>(selectedHistory==='all'||r.companyId===c.companyId)&&now-new Date(r.finishedAt).getTime()<=maxAge);
}
function line(rows){
 const w=650,h=218,l=40,t=22,r=16,b=38,max=Math.max(1,...rows.map(x=>x.value)),cw=w-l-r,ch=h-t-b;
 const points=rows.map((x,i)=>({x:l+(rows.length===1?cw/2:i*cw/(rows.length-1)),y:t+ch-x.value/max*ch,...x}));
 const shape=points.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
 const grid=[0,1,2,3].map(i=>{const yy=t+i*ch/3;return '<line x1="'+l+'" x2="'+(w-r)+'" y1="'+yy+'" y2="'+yy+'" stroke="#dfebf6" stroke-dasharray="5 7"/><text x="'+(l-8)+'" y="'+(yy+4)+'" text-anchor="end" font-size="11" fill="#7b90a5">'+Math.round(max*(1-i/3))+'</text>';}).join('');
 const dots=points.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="5" fill="#fff" stroke="#267be0" stroke-width="3"><title>'+esc(p.title)+': '+Math.round(p.value)+' minutos</title></circle>').join('');
 const labels=points.filter((p,i)=>rows.length<10||i%Math.ceil(rows.length/9)===0||i===rows.length-1).map(p=>'<text x="'+p.x+'" y="'+(h-12)+'" text-anchor="middle" font-size="11" fill="#788ea4">'+esc(p.label)+'</text>').join('');
 return '<svg class="prod-evolution-line" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Evolução da duração das últimas conciliações medidas"><defs><linearGradient id="prodEvolutionGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7ec8ff" stop-opacity=".36"/><stop offset="1" stop-color="#7ec8ff" stop-opacity=".01"/></linearGradient></defs>'+grid+(points.length?'<polygon points="'+l+','+(h-b)+' '+shape+' '+(w-r)+','+(h-b)+'" fill="url(#prodEvolutionGradient)"/>':'')+(points.length?'<polyline points="'+shape+'" fill="none" stroke="#267be0" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>':'')+dots+labels+'</svg>';
}
function evolution(){
 const rows=historyData(),ordered=[...rows].reverse(),durations=rows.map(r=>metrics(r).spent),average=durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:0;
 const total=rows.length,last=rows[0],sum=durations.reduce((a,b)=>a+b,0);
 const points=ordered.slice(-18).map(r=>({label:dateOnly(r.finishedAt).slice(0,5),title:(r.companyName||'Empresa')+' · '+dateTime(r.finishedAt),value:metrics(r).spent/60}));
 const days={};for(const r of rows){const day=dateOnly(r.finishedAt);days[day]=(days[day]||0)+1;}
 const daily=Object.entries(days).slice(0,12),maxDay=Math.max(1,...daily.map(x=>x[1]));
 return '<section class="insights-shell prod-evolution" aria-label="Histórico de evolução das conciliações">'+
 '<header class="insights-top"><div><div class="insights-kicker"><span class="insights-dot"></span> EVOLUÇÃO PROFISSIONAL</div><h3>Suas conciliações medidas <span>↗</span></h3><p>Somente trabalhos iniciados e concluídos por você no cronômetro manual.</p></div>'+
 '<div class="insights-filters"><label>Período<select data-manual-filter><option value="7" '+(filter==='7'?'selected':'')+'>7 dias</option><option value="30" '+(filter==='30'?'selected':'')+'>30 dias</option><option value="all" '+(filter==='all'?'selected':'')+'>Todo o histórico</option></select></label>'+
 '<label>Empresa<select data-manual-company><option value="all">Todas as empresas</option><option value="current" '+(selectedHistory==='current'?'selected':'')+'>Empresa selecionada</option></select></label></div></header>'+
 '<div class="insights-mini"><div><small>CONCILIAÇÕES CONCLUÍDAS</small><strong>'+total+'</strong><span>No período filtrado</span></div><div><small>ÚLTIMA CONCLUSÃO</small><strong class="prod-small-number">'+(last?dateOnly(last.finishedAt):'—')+'</strong><span>'+(last?esc(last.companyName):'Sem medições concluídas')+'</span></div><div><small>DURAÇÃO MÉDIA</small><strong>'+fmt(average)+'</strong><span>Total medido: '+fmt(sum)+'</span></div></div>'+
 '<div class="insights-layout"><article class="insights-chart insights-trend"><div class="insights-chart-head"><div><h4>Tempo por conciliação</h4><p>Minutos gastos em cada trabalho concluído</p></div></div>'+(points.length?line(points):'<div class="prod-empty-chart">Conclua a primeira medição para visualizar sua evolução.</div>')+'</article>'+
 '<article class="insights-chart insights-status"><div class="insights-chart-head"><div><h4>Conciliações por dia</h4><p>Volume diário concluído</p></div></div><div class="prod-day-list">'+(daily.length?daily.map(([day,count])=>'<div class="prod-day"><span>'+esc(day)+'</span><div><i style="width:'+Math.round(100*count/maxDay)+'%"></i></div><strong>'+count+'</strong></div>').join(''):'<p class="prod-muted">Nenhuma conciliação concluída no período.</p>')+'</div></article></div>'+
 '<article class="insights-chart prod-history"><div class="insights-chart-head"><div><h4>Histórico de conciliações</h4><p>Datas, duração e resultados de cada medição.</p></div><button type="button" class="secondary" data-prod="csv">Exportar histórico CSV</button></div>'+
 '<div class="prod-history-scroll"><table><thead><tr><th>Empresa / Competência</th><th>Início</th><th>Conclusão</th><th>Duração</th><th>Processados</th><th>Pendências</th><th>Divergências</th><th>Produtividade</th></tr></thead><tbody>'+
 (rows.length?rows.map(r=>{const m=metrics(r);return '<tr><td><strong>'+esc(r.companyName||r.companyId)+'</strong><small>'+esc(r.period||'')+'</small></td><td>'+dateTime(r.startedAt)+'</td><td>'+dateTime(r.finishedAt)+'</td><td><strong>'+fmt(m.spent)+'</strong></td><td>'+m.processed+'</td><td>'+m.pending+'</td><td>'+m.divergent+'</td><td>'+m.productivity+'%</td></tr>';}).join(''):'<tr><td colspan="8" class="prod-muted">Nenhuma medição concluída neste filtro.</td></tr>')+
 '</tbody></table></div></article><p class="insights-note">Histórico de medições associado ao usuário conectado. As informações manuais são identificadas e não alteram extratos ou lançamentos.</p></section>';
}
function draw(){
 const root=$('#productivityPanel');if(!root)return;
 const c=context(),k=scopeOf(c),r=k?state.sessions[k]||blank(c):null,m=metrics(r),enabled=!!k,started=!!r?.startedAt,finished=!!r?.finishedAt,active=canEdit(r);
 const stateText=finished?'Medição concluída':r?.runningSince?'Cronômetro em andamento':started?'Medição pausada':'Pronto para começar';
 const syncError=/^(Falha|Erro)/.test(cloudStatus),unsaved=!cloudReady&&localVersion>0;
 const syncWarning=syncError||unsaved?'<div class="prod-sync-warning" role="alert">'+(syncError?'Não foi possível proteger todas as alterações na nuvem.':'Há alterações salvas neste dispositivo aguardando proteção na nuvem.')+' Seus registros locais foram preservados. <button type="button" class="secondary" data-prod="sync">Tentar salvar novamente</button></div>':'';
 const input=(label,name,value)=>'<label class="prod-manual-field">'+label+'<input type="number" min="0" max="1000000" step="1" data-prod-field="'+name+'" value="'+value+'" '+(!active?'disabled':'')+'></label>';
 root.innerHTML='<div class="prod-heading"><div><span class="prod-kicker">CONTROLE PESSOAL DE EVOLUÇÃO</span><h2>Dashboard de Produtividade</h2><p>Inicie, registre seus resultados e acompanhe sua evolução. O salvamento ocorre automaticamente.</p></div><div class="prod-status">'+stateText+'</div></div>'+syncWarning+
 (!enabled?'<p class="prod-notice">Selecione uma empresa, competência e entre na sua conta para iniciar sua medição.</p>':'<p class="prod-context"><strong>'+esc(c.company?.name||'Empresa')+'</strong> · Competência '+esc(c.period)+'</p>')+
 evolution()+
 '<div class="prod-metrics-head"><span>MEDIÇÃO MANUAL ATUAL</span><h3>Indicadores do ciclo iniciado por você</h3></div>'+
 '<div class="prod-grid">'+
 '<article class="prod-card"><span>Tempo gasto na conciliação</span><strong data-prod-timer>'+fmt(m.spent)+'</strong><small>'+(!started?'Aguardando Iniciar':finished?'Medição concluída':'Tempo do cronômetro manual')+'</small></article>'+
 '<article class="prod-card"><span>Tempo manual estimado</span><strong data-prod-manual>'+fmt(m.manual)+'</strong><small>'+m.processed+' lançamentos × '+(r?.baseline||3)+' minutos</small></article>'+
 '<article class="prod-card"><span>Tempo potencial economizado</span><strong data-prod-saved>'+fmtDelta(m.saved)+'</strong><small>Calculado ao concluir; negativo = acima da referência</small></article>'+
 '<article class="prod-card"><span>Produtividade</span><strong data-prod-productivity>'+m.productivity+'%</strong><small>Economia percentual sobre o tempo de referência ao concluir</small></article>'+
 '<article class="prod-card"><span>Lançamentos processados</span><strong>'+m.processed+'</strong><small>Quantidade informada manualmente</small></article>'+
 '<article class="prod-card"><span>Pendências e divergências</span><strong>'+m.pending+' <em>/ '+m.divergent+'</em></strong><small>Quantidades informadas manualmente</small></article></div>'+
 '<div class="prod-columns"><article class="prod-section"><h3>Cronômetro e controle do ciclo</h3>'+
 '<p>Os valores começam zerados. Clique em Iniciar, preencha o que realizou e conclua para salvar sua evolução. Zerar tudo não apaga trabalhos já concluídos.</p>'+
 '<div class="prod-actions"><button type="button" data-prod="start" class="primary" '+(!enabled||finished||r?.runningSince?'disabled':'')+'>'+(started?'▶ Retomar':'▶ Iniciar conciliação')+'</button><button type="button" data-prod="pause" class="secondary" '+(!r?.runningSince?'disabled':'')+'>Ⅱ Pausar</button><button type="button" data-prod="finish" class="secondary" '+(!started||finished?'disabled':'')+'>✓ Concluir e salvar</button></div>'+
 '<div class="prod-actions"><button type="button" data-prod="reset" class="secondary" '+(!enabled?'disabled':'')+'>↺ Zerar tudo / Novo ciclo</button><button type="button" data-prod="restore" class="secondary" '+(!enabled||!state.drafts.some(x=>x.scope===k)?'disabled':'')+'>↶ Restaurar medição</button><button type="button" data-prod="refresh" class="secondary">↻ Atualizar painel</button></div>'+
 '<div class="prod-manual-fields">'+input('Lançamentos processados','processed',m.processed)+input('Pendências encontradas','pending',m.pending)+input('Divergências encontradas','divergent',m.divergent)+'</div>'+
 '<label class="prod-label">Referência manual (minutos por lançamento)<input data-prod-field="baseline" type="number" min="0.1" max="120" step="0.5" value="'+(r?.baseline||3)+'" '+(!active?'disabled':'')+'></label>'+
 '<p class="prod-disclaimer">O sistema não importa automaticamente os totais dos extratos para estes indicadores. Tempo manual = lançamentos informados × referência. Produtividade = economia de tempo ÷ referência, apurada após a conclusão.</p></article>'+
 '<article class="prod-section"><h3>Resumo da medição</h3><dl><div><dt>Início</dt><dd>'+dateTime(r?.startedAt)+'</dd></div><div><dt>Conclusão</dt><dd>'+dateTime(r?.finishedAt)+'</dd></div><div><dt>Duração</dt><dd data-prod-duration>'+fmt(m.spent)+'</dd></div><div><dt>Lançamentos registrados</dt><dd>'+m.processed+'</dd></div><div><dt>Referência manual</dt><dd>'+fmt(m.manual)+'</dd></div><div><dt>Economia ao concluir</dt><dd>'+fmtDelta(m.saved)+'</dd></div></dl>'+
 '<p class="prod-disclaimer">O histórico permanece disponível após clicar em Zerar tudo. Para iniciar outra conciliação, selecione a empresa e a competência e crie um novo ciclo.</p></article></div>'+
 '<p class="prod-footnote">Este painel acompanha a produtividade sem alterar a conciliação contábil. Registros são salvos automaticamente na conta quando existe conexão; dados locais são mantidos em caso de falha.</p>';
}
function render(){draw();}
function stopRunning(){
 const keys=Object.keys(state.sessions),next={...state,sessions:{...state.sessions}};let changed=false;
 for(const k of keys){const r=state.sessions[k];if(r?.runningSince){next.sessions[k]={...r,seconds:time(r),runningSince:null};changed=true;}}
 if(changed)write(next);
}
function init(){
 const nav=$('#nav'),main=document.querySelector('main');if(!nav||!main)return;
 if(!$('#prodNav')){const button=document.createElement('button');button.type='button';button.id='prodNav';button.dataset.page='produtividade';button.innerHTML='<i data-lucide="chart-no-axes-combined"></i> Dashboard de Produtividade';nav.append(button);}
 if(!$('#p-produtividade')){const page=document.createElement('section');page.className='page';page.id='p-produtividade';page.innerHTML='<div id="productivityPanel"></div><div id="conciliaBI" aria-label="Dashboards integrados do ConCiliar+PLUS"></div>';main.append(page);}
 const button=$('#prodNav');
 button.addEventListener('click',()=>{if(!cloudReady&&window.ConciliaCloud?.authenticated?.())syncCloud();document.querySelectorAll('.page').forEach(x=>x.classList.toggle('visible',x.id==='p-produtividade'));document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x===button));$('#pageTitle').textContent='Dashboard de Produtividade';$('#eyebrow').textContent='EVOLUÇÃO MANUAL';$('#subtitle').textContent='Sessões, tempo e histórico de conciliações.';render();});
 $('#productivityPanel').addEventListener('click',e=>{const button=e.target.closest('button[data-prod]');if(button&&!button.disabled){e.preventDefault();perform(button.dataset.prod);}});
 $('#productivityPanel').addEventListener('change',e=>{
  const el=e.target;
  if(el.matches('[data-prod-field]'))updateField(el.dataset.prodField,el.value);
  if(el.matches('[data-manual-filter]')){filter=el.value;render();}
  if(el.matches('[data-manual-company]')){selectedHistory=el.value;render();}
 });
 // A medição continua durante navegação entre telas e trabalho em outras abas.
 // Ao trocar de empresa, o ciclo anterior continua identificado pela empresa original.
 // Um fechamento/recarregamento da página pausa para não contar tempo perdido por dias.
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('#p-produtividade')?.classList.contains('visible'))render();});
 window.addEventListener('pagehide',stopRunning);
 setInterval(()=>{if(document.hidden||!$('#p-produtividade')?.classList.contains('visible'))return;const r=currentRecord();if(!r?.runningSince)return;const text=fmt(time(r));for(const el of document.querySelectorAll('[data-prod-timer],[data-prod-duration]'))el.textContent=text;},1000);
 window.lucide?.createIcons();
}
window.ConciliaManualProductivity={render,metrics,history:()=>recorded(context()),syncCloud,hasRunning:()=>Object.values(state.sessions).some(r=>r?.userId===context().userId&&!!r.runningSince)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();