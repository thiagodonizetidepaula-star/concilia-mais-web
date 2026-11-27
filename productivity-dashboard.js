/* ConCiliar+ | módulo adicional e isolado de produtividade. Não modifica a conciliação. */
(()=>{'use strict';
const KEY='concilia-prod-v1';
const $=s=>document.querySelector(s);
let records={};try{records=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{records={};}
let tick=null;
const n=v=>Number(v)||0;
const fmt=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'min '+String(s%60).padStart(2,'0')+'s';};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const getContext=()=>{try{return {company:typeof current==='function'?current():null,companyId:typeof companyId!=='undefined'?companyId:'',period:typeof period!=='undefined'?period:''};}catch{return {company:null,companyId:'',period:''};}};
const key=()=>{const c=getContext();return c.companyId&&c.period?c.companyId+'::'+c.period:null;};
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(records));}catch(e){console.warn('Produtividade: armazenamento indisponível',e);}};
const entry=k=>records[k]||(records[k]={seconds:0,runningSince:null,finishedAt:null,baseline:3,startedAt:null});
const elapsed=r=>n(r.seconds)+(r.runningSince?(Date.now()-r.runningSince)/1000:0);
const stop=r=>{if(r.runningSince){r.seconds=elapsed(r);r.runningSince=null;persist();}};
function snapshot(){
 const c=getContext(),comp=c.company;
 if(!comp)return {movements:0,files:0,ledger:0,confirmed:0,pending:0,divergent:0};
 let moves=[];try{moves=window.ConciliaCore?.periodMovements(comp,c.period)||[];}catch{moves=comp.movements||[];}
 const ids=new Set(moves.map(m=>m.id));
 const confirmed=moves.filter(m=>m.status==='CONFIRMADO').length;
 const imports=(comp.imports||[]).filter(f=>!f.period||f.period===c.period);
 let divergent=0;
 try{const rec=window.ConciliaCore?.reconcile(comp,c.period);divergent=(rec?.checked||[]).filter(x=>x.recon&&x.recon!=='CONCILIADO').length+(rec?.missingLedger||[]).length;}catch{}
 return {movements:moves.length,files:imports.length,ledger:(comp.ledger||[]).filter(x=>!x.period||x.period===c.period).length,confirmed,pending:moves.length-confirmed,divergent};
}
function saveCurrentBeforeChange(){for(const r of Object.values(records))if(r.runningSince)stop(r);}
function draw(){
 const root=$('#productivityPanel');if(!root)return;
 const c=getContext(),k=key();
 const empty=!k;
 const r=k?entry(k):null,s=snapshot(),time=r?elapsed(r):0;
 const baseline=r?n(r.baseline):3;
 const manual=s.movements*baseline*60;
 const saved=Math.max(0,manual-time);
 const percent=s.movements?Math.round(100*s.confirmed/s.movements):0;
 const totals=Object.values(records).reduce((a,x)=>{a.sessions++;a.seconds+=elapsed(x);a.completed+=x.finishedAt?1:0;return a;},{sessions:0,seconds:0,completed:0});
 root.innerHTML=`<div class="prod-heading"><div><span class="prod-kicker">INTELIGÊNCIA OPERACIONAL</span><h2>Dashboard de Produtividade</h2><p>Medição por empresa e competência, sem interferir na conciliação bancária.</p></div><div class="prod-status">${r?.finishedAt?'Conciliação concluída':r?.runningSince?'Cronômetro em andamento':'Aguardando medição'}</div></div>
 ${empty?'<div class="prod-notice">Selecione uma empresa para começar a acompanhar sua produtividade.</div>':`<p class="prod-context"><strong>${esc(c.company?.name)}</strong> · Competência ${esc(c.period)}</p>`}
 <div class="prod-grid">
 <article class="prod-card"><span>Tempo gasto nesta conciliação</span><strong data-prod-timer>${fmt(time)}</strong><small>Cronômetro da atividade</small></article>
 <article class="prod-card"><span>Tempo manual estimado</span><strong>${fmt(manual)}</strong><small>${baseline} min por lançamento (referência editável)</small></article>
 <article class="prod-card"><span>Tempo potencial economizado</span><strong data-prod-saved>${fmt(saved)}</strong><small>Estimativa: tempo manual menos tempo registrado</small></article>
 <article class="prod-card"><span>Produtividade</span><strong>${percent}%</strong><small>${s.confirmed} de ${s.movements} lançamentos classificados</small></article>
 <article class="prod-card"><span>Lançamentos processados</span><strong>${s.movements}</strong><small>${s.files} arquivo(s) importado(s) na sessão</small></article>
 <article class="prod-card"><span>Pendências e divergências</span><strong>${s.pending} <em>/ ${s.divergent}</em></strong><small>Sem classificação confirmada / alertas do Razão</small></article>
 </div>
 <div id="prodInsights"></div>
 <div class="prod-columns"><article class="prod-section"><h3>Tempo de execução</h3><p>Inicie quando começar a trabalhar na conciliação. Pause nas interrupções e conclua ao terminar a conferência. O cronômetro pausa se a aba ficar oculta.</p><div class="prod-actions"><button data-prod="start" class="primary" ${empty||r?.runningSince?'disabled':''}>▶ Iniciar / Retomar</button><button data-prod="pause" class="secondary" ${!r?.runningSince?'disabled':''}>Ⅱ Pausar</button><button data-prod="finish" class="secondary" ${empty||!r?.startedAt?'disabled':''}>✓ Marcar como concluída</button></div><div class="prod-actions"><button data-prod="recalculate" class="secondary" ${empty?'disabled':''}>↻ Recalcular indicadores</button><button data-prod="reset" class="secondary" ${empty?'disabled':''}>↺ Zerar cronômetro</button><button data-prod="new-cycle" class="secondary" ${empty?'disabled':''}>＋ Novo ciclo</button><button data-prod="restore-cycle" class="secondary" ${empty||!((readLocal(CYCLES_KEY,{})[k]||[]).length)?'disabled':''}>↶ Restaurar último ciclo</button></div><label class="prod-label">Tempo manual de referência (minutos por lançamento)<input id="prodBaseline" type="number" min="0.1" max="120" step="0.5" value="${baseline}" ${empty?'disabled':''}></label><p class="prod-disclaimer">A economia de tempo é uma projeção baseada na referência configurada. O tempo real depende de iniciar e pausar o cronômetro corretamente. Conclusão não significa conciliação contábil validada automaticamente.</p></article>
 <article class="prod-section"><h3>Resumo de acompanhamento</h3><div class="prod-progress"><span>Classificações confirmadas</span><strong>${percent}%</strong></div><div class="prod-track"><div style="width:${percent}%"></div></div><dl><div><dt>Conciliações monitoradas neste navegador</dt><dd>${totals.sessions}</dd></div><div><dt>Marcadas como concluídas</dt><dd>${totals.completed}</dd></div><div><dt>Tempo total registrado</dt><dd>${fmt(totals.seconds)}</dd></div><div><dt>Razão: registros carregados</dt><dd>${s.ledger}</dd></div><div><dt>Tempo por lançamento</dt><dd>${s.movements?fmt(time/s.movements):'—'}</dd></div></dl><button data-prod="csv" class="secondary">⬇ Exportar histórico de produtividade (CSV)</button></article></div>
 <p class="prod-footnote">Os indicadores usam os lançamentos carregados na sessão atual. O histórico de tempo fica armazenado neste navegador, não sincronizado com a nuvem. Os arquivos temporários continuam com as regras atuais do ConCiliar+.</p>`;
 window.ConciliaInsights?.render({company:c.company,period:c.period,baseline,elapsedSeconds:time});
}
// Histórico de ciclos armazenado separadamente, sem alterar dados de conciliação.
const CYCLES_KEY='concilia-prod-cycles-v1';
const AUDIT_KEY='concilia-prod-actions-v1';
const readLocal=(name,fallback)=>{try{const v=JSON.parse(localStorage.getItem(name)||'null');return v&&typeof v==='object'?v:fallback;}catch{return fallback;}};
const appendAudit=(action,k)=>{try{const v=readLocal(AUDIT_KEY,[]);const list=Array.isArray(v)?v:[];list.push({action,context:k,at:new Date().toISOString(),user:window.ConciliaCloud?.identity?.()||'usuário local'});localStorage.setItem(AUDIT_KEY,JSON.stringify(list.slice(-500)));}catch(e){console.warn('Auditoria local de produtividade indisponível',e);}};
function archiveCycle(k,r){
 const h=readLocal(CYCLES_KEY,{});
 const list=Array.isArray(h[k])?h[k]:[];
 list.push({record:JSON.parse(JSON.stringify(r)),archivedAt:new Date().toISOString()});
 h[k]=list.slice(-30);
 localStorage.setItem(CYCLES_KEY,JSON.stringify(h));
}
function restoreCycle(k){
 const h=readLocal(CYCLES_KEY,{});
 const list=Array.isArray(h[k])?h[k]:[];
 if(!list.length){alert('Não há um ciclo anterior salvo para esta empresa e competência.');return;}
 if(!confirm('Restaurar o último ciclo de produtividade? O ciclo atual será arquivado. Os lançamentos contábeis não serão alterados.'))return;
 const previous=list.pop();
 if(records[k])list.push({record:JSON.parse(JSON.stringify(records[k])),archivedAt:new Date().toISOString()});
 h[k]=list.slice(-30);
 try{localStorage.setItem(CYCLES_KEY,JSON.stringify(h));}
 catch(e){alert('Não foi possível salvar a versão anterior. Nenhum ciclo foi restaurado. Verifique o armazenamento do navegador.');return;}
 records[k]={...previous.record,runningSince:null};
 persist();appendAudit('RESTAURAR_CICLO',k);
}
function change(action){
 const k=key();if(!k&&action!=='csv')return;
 const r=k?entry(k):null;
 if(action==='start'){if(!r.runningSince){r.runningSince=Date.now();r.startedAt||=new Date().toISOString();r.finishedAt=null;persist();}}
 if(action==='pause'){stop(r);}
 if(action==='finish'){stop(r);r.finishedAt=new Date().toISOString();persist();}
 if(action==='recalculate'){appendAudit('RECALCULAR_INDICADORES',k);draw();return;}
 if(action==='reset'||action==='new-cycle'){
  const detail=action==='reset'?'zerar a medição de tempo':'iniciar um novo ciclo de produtividade';
  if(!confirm('Deseja '+detail+' nesta empresa e competência? A medição atual será arquivada; extratos, lançamentos e Razão não serão apagados.'))return;
  // Arquivamento deve ser concluído ANTES de zerar; falha não pode apagar medições.
  const previous={...r,seconds:elapsed(r),runningSince:null};
  try{archiveCycle(k,previous);}
  catch(e){alert('Não foi possível arquivar o ciclo anterior. A medição foi preservada. Verifique o espaço disponível no navegador.');return;}
  records[k]={seconds:0,runningSince:null,finishedAt:null,baseline:n(r.baseline)||3,startedAt:null};
  persist();appendAudit(action==='reset'?'ZERAR_CRONOMETRO':'NOVO_CICLO',k);
 }
 if(action==='restore-cycle')restoreCycle(k);
 if(action==='csv'){
 const rows=[['Empresa ID','Competência','Ciclo','Início','Conclusão','Tempo gasto (segundos)','Referência (min/lançamento)','Arquivado em']];
 for(const [id,v] of Object.entries(records)){const pos=id.lastIndexOf('::');rows.push([id.slice(0,pos),id.slice(pos+2),'ATUAL',v.startedAt||'',v.finishedAt||'',Math.round(elapsed(v)),v.baseline||3,'']);}
 const archived=readLocal(CYCLES_KEY,{});
 for(const [id,cycles] of Object.entries(archived)){if(!Array.isArray(cycles))continue;const pos=id.lastIndexOf('::');for(const cycle of cycles){const v=cycle.record||{};rows.push([id.slice(0,pos),id.slice(pos+2),'ARQUIVADO',v.startedAt||'',v.finishedAt||'',Math.round(n(v.seconds)),v.baseline||3,cycle.archivedAt||'']);}}
 const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='concilia_produtividade.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 draw();
}
function init(){
 const nav=$('#nav'),main=document.querySelector('main');if(!nav||!main)return;
 if(!$('#prodNav')){const btn=document.createElement('button');btn.id='prodNav';btn.type='button';btn.dataset.page='produtividade';btn.innerHTML='<i data-lucide="chart-no-axes-combined"></i> Dashboard de Produtividade';nav.append(btn);}
 if(!$('#p-produtividade')){const section=document.createElement('section');section.className='page';section.id='p-produtividade';section.innerHTML='<div id="productivityPanel"></div>';main.append(section);}
 const btn=$('#prodNav');
 btn.addEventListener('click',()=>{document.querySelectorAll('.page').forEach(x=>x.classList.toggle('visible',x.id==='p-produtividade'));document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x===btn));$('#pageTitle').textContent='Dashboard de Produtividade';$('#eyebrow').textContent='INDICADORES DE EFICIÊNCIA';$('#subtitle').textContent='Tempo, volume e pendências por conciliação.';draw();});
 document.querySelector('#productivityPanel').addEventListener('click',e=>{const a=e.target.closest('[data-prod]');if(a)change(a.dataset.prod);});
 $('#productivityPanel').addEventListener('change',e=>{if(e.target.id==='prodBaseline'&&key()){const v=Number(e.target.value);if(Number.isFinite(v)&&v>=.1&&v<=120){entry(key()).baseline=v;persist();}draw();}});
 document.addEventListener('click',e=>{if(e.target.closest('#nav button:not(#prodNav)')){saveCurrentBeforeChange();}},true);
 for(const selector of ['#companySelect','#period','#cloudLogout','#restartWorkspace']){const el=$(selector);if(el)el.addEventListener('change',saveCurrentBeforeChange,true);}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){saveCurrentBeforeChange();}else if($('#p-produtividade')?.classList.contains('visible'))draw();});
 window.addEventListener('pagehide',saveCurrentBeforeChange);
 tick=setInterval(()=>{if(!$('#p-produtividade')?.classList.contains('visible')||document.hidden)return;
 const k=key(),r=k?records[k]:null;if(!r?.runningSince)return;
 const t=elapsed(r),seconds=Math.max(0,Math.round(t)),manual=snapshot().movements*n(r.baseline||3)*60;
 const clock=$('[data-prod-timer]'),saved=$('[data-prod-saved]');
 if(clock)clock.textContent=fmt(seconds);
 if(saved)saved.textContent=fmt(Math.max(0,manual-t));
 },1000);
 window.lucide?.createIcons();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
