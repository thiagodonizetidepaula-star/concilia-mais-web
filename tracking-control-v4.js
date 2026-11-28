/* Melhoria 04 — expansão da aba EXISTENTE Controle de Conciliações.
 * Sem alteração dos dados contábeis; não recria Central de Pendências. */
(()=>{'use strict';
const T=window.ConciliaTrackingCore,$=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[x]));
const uid=()=>window.ConciliaCloud?.accountId?.()||'';
const ready=()=>!!(uid()&&window.ConciliaCloud?.authenticated?.()&&cloudSyncEnabled);
const fmt=s=>s?s.slice(0,10).split('-').reverse().join('/'):'—';
const sec=s=>{const n=Math.floor(Math.max(0,Number(s)||0));return [Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(x=>String(x).padStart(2,'0')).join(':');};
const option=(v,label,current)=>'<option value="'+esc(v)+'"'+(String(v)===String(current)?' selected':'')+'>'+esc(label)+'</option>';
const fields=[
 ['status','Situação operacional','status'],['start','Data de início','date'],['end','Data de conclusão','date'],['deadline','Prazo de entrega','date'],
 ['effectiveSeconds','Tempo efetivo (segundos)','integer'],['waitingSeconds','Tempo de espera (segundos)','integer'],['exportDate','Data da exportação','date'],['dominioImportDate','Data de importação efetiva no Domínio','date'],['reviewSentAt','Enviado para revisão','date'],['reviewedAt','Data da revisão','date'],['approvalDate','Data da aprovação','date'],['correctionCompletedAt','Correção concluída em','date'],['reworkCount','Quantidade de retrabalhos','integer'],['processed','Lançamentos importados','integer'],['classified','Lançamentos classificados','integer'],
 ['pendingFound','Pendências identificadas','integer'],['pendingResolved','Pendências resolvidas','integer'],['pendingRemaining','Pendências restantes','integer'],
 ['exportStatus','Situação da exportação','export'],['dominioStatus','Importação no Domínio','dominio'],
 ['reviewStatus','Situação da revisão','review'],['delayReason','Motivo do atraso','delay'],
 ['delayCategory','Responsabilidade pelo atraso','category'],['notes','Observações gerenciais','text'],['reviewNotes','Observações da revisão','text']
];
let selected='',year=new Date().getFullYear(),month=new Date().getMonth()+1,search='',status='',docs='',review='',delay='',deadlineFilter='',editing=false,busy=false,interval=null;
const p=()=>T.monthKey(year,month),validCompanies=()=>window.ConciliaWallet?.visible?.().filter(c=>T.owner(c,uid()))||[];
function rows(){const q=search.trim().toLowerCase(),qs=search.replace(/\D/g,'');return validCompanies().filter(T.currentCompany).map(c=>({c,rec:T.effective(c,p()).data}))
.filter(({c,rec})=>!(q&&!String(c.name||'').toLowerCase().includes(q)&&!String(c.dominio||'').includes(q)&&!(qs.length>2&&String(c.cnpj||'').replace(/\D/g,'').includes(qs))))
.filter(({rec})=>!status||rec.status===status).filter(({rec})=>!docs||rec.docs===docs).filter(({rec})=>!review||rec.reviewStatus===review).filter(({rec})=>!delay||rec.delayReason===delay).filter(({rec})=>!deadlineFilter||(deadlineFilter==='overdue'?!!rec.deadline&&rec.deadline<T.todayBrazil()&&!['Concluída','Aprovada'].includes(rec.status):deadlineFilter==='on-time'?!!rec.deadline&&!!rec.end&&rec.end<=rec.deadline:deadlineFilter==='unset'?!rec.deadline:true));
}
function renderSummary(){
 const s=T.summarize(validCompanies(),p(),uid()),items=[
 ['Carteira ativa',s.active],['Aplicáveis',s.applicable],['Concluídas',s.done],['Em andamento',s.inProgress],
 ['Não iniciadas',s.notStarted],['Aguardando documentos',s.awaitingDocs],['Aguardando esclarecimentos',s.awaitingClarification],
 ['Pendências internas',s.internalPending],['Exportadas',s.exported],['Domínio confirmado',s.dominioConfirmed],
 ['Aguardando revisão',s.awaitingReview],['Aprovadas',s.approved],['Restantes',s.remaining],
 ['Dentro do prazo',s.withinDeadline],['Em atraso',s.overdue]];
 return '<div class="track4-summary">'+items.map(([k,v])=>'<button type="button" data-track4-counter="'+esc(k)+'" title="Filtrar situação quando disponível"><strong>'+v+'</strong><small>'+esc(k)+'</small></button>').join('')+'</div>'+
 '<div class="track4-progress"><span>Progresso da carteira: <b>'+s.percent+'%</b> ('+s.done+' de '+s.applicable+' aplicáveis)</span><div role="progressbar" aria-valuenow="'+s.percent+'" aria-valuemin="0" aria-valuemax="100"><span style="width:'+s.percent+'%"></span></div></div>';
}
function renderEvolution(){
 const months=T.evolution(validCompanies(),year,uid());
 return '<details class="track4-evolution"><summary>Evolução mensal da carteira em '+year+' — competências de janeiro a dezembro</summary>'+
 '<div class="track4-table"><table><thead><tr><th>Competência</th><th>Concluídas</th><th>Restantes</th><th>Conclusão</th><th>Lançamentos</th><th>Pendências resolvidas</th><th>Trabalho efetivo</th><th>Concluídas no mês da competência</th></tr></thead><tbody>'+
 months.map(v=>'<tr><td>'+esc(v.period)+'</td><td>'+v.completed+'</td><td>'+v.remaining+'</td><td>'+v.percent+'%</td><td>'+v.processed+'</td><td>'+v.resolved+'</td><td>'+sec(v.workedSeconds)+'</td><td>'+v.calendarFinishes+'</td></tr>').join('')+
 '</tbody></table></div><p>Valores automáticos são derivados dos registros ainda disponíveis ou dos ajustes gerenciais identificados; zero não comprova ausência de lançamentos em arquivos retidos fora da sessão. A data do trabalho efetivo é registrada separadamente da competência.</p></details>';
}
function renderList(){const list=rows(),period=p();return '<div class="track4-filters">'+
 '<label>Empresa / CNPJ / Domínio<input type="search" data-track4-filter="search" value="'+esc(search)+'"></label>'+
 '<label>Ano<input type="number" min="2000" max="2099" data-track4-filter="year" value="'+year+'"></label>'+
 '<label>Mês<select data-track4-filter="month">'+Array.from({length:12},(_,i)=>option(i+1,String(i+1).padStart(2,'0'),month)).join('')+'</select></label>'+
 '<label>Situação<select data-track4-filter="status">'+option('','Todas',status)+T.STATES.map(x=>option(x,x,status)).join('')+'</select></label>'+
 '<label>Documentos<select data-track4-filter="docs">'+option('','Todos',docs)+['Recebido','Pendente','Cobrado','Parcialmente recebido','Não se aplica','Sem registro'].map(x=>option(x,x,docs)).join('')+'</select></label>'+
 '<label>Revisão<select data-track4-filter="review">'+option('','Todas',review)+['Não aprovada','Aguardando revisão','Revisada','Aprovada'].map(x=>option(x,x,review)).join('')+'</select></label>'+ '<label>Motivo do atraso<select data-track4-filter="delay">'+option('','Todos',delay)+T.delayReasons.map(x=>option(x,x,delay)).join('')+'</select></label>'+ '<label>Prazo<select data-track4-filter="deadline">'+option('','Todos',deadlineFilter)+option('overdue','Atrasados',deadlineFilter)+option('on-time','No prazo',deadlineFilter)+option('unset','Sem prazo',deadlineFilter)+'</select></label></div>'+
 '<div class="track4-table"><table><thead><tr><th>Empresa</th><th>CNPJ</th><th>Domínio</th><th>Documentos</th><th>Conciliação</th><th>Classificados</th><th>Pendências</th><th>Revisão</th><th>Ação</th></tr></thead><tbody>'+
 list.map(({c,rec})=>'<tr><td><strong>'+esc(c.name)+'</strong></td><td>'+esc(c.cnpj||'—')+'</td><td>'+esc(c.dominio||'—')+'</td><td>'+esc(rec.docs)+'</td><td>'+esc(rec.status)+'</td><td>'+rec.classified+'/'+rec.processed+'</td><td>'+rec.pendingRemaining+'</td><td>'+esc(rec.reviewStatus)+'</td><td><button data-track4-open="'+esc(c.id)+'">Acompanhar</button></td></tr>').join('')+'</tbody></table></div>'+
 '<p class="track4-caption">Exibindo '+list.length+' empresas ativas. Os totais automáticos só são conhecidos quando há dados operacionais disponíveis no aplicativo; não representam zero comprovado de arquivos retidos fora desta sessão.</p>';
}
function fieldEditor(field,label,type,val){
 const choices=type==='status'?T.STATES:type==='export'?['Sem confirmação','Exportada','Revisar exportação']:type==='dominio'?['Não confirmada','Aguardando importação','Confirmada manualmente']:type==='review'?['Não aprovada','Aguardando revisão','Em revisão','Correção necessária','Revisada','Aprovada']:type==='delay'?['',...T.delayReasons]:type==='category'?['','Cliente','Interno','Terceiro','Não determinado']:null;
 if(choices)return '<label>'+esc(label)+'<select data-track4-value="'+field+'">'+choices.map(x=>option(x,x||'Não informado',val??'')).join('')+'</select></label>';
 if(type==='text')return '<label>'+esc(label)+'<textarea rows="2" data-track4-value="'+field+'">'+esc(val||'')+'</textarea></label>';
 return '<label>'+esc(label)+'<input data-track4-value="'+field+'" type="'+(type==='date'?'date':'number')+'" '+(type==='integer'?'min="0" step="1"':'')+' value="'+esc(val??'')+'"></label>';
}
function timerUi(c,period){
 const t=T.timer(c,period),running=!!t.runningSince&&!T.stale(t),end=!!t.finishedAt,seconds=t.manualSeconds??T.elapsed(t);
 return '<div class="track4-timer"><h4>Cronômetro da competência</h4><strong data-track4-clock>'+sec(seconds)+'</strong><small>'+(T.stale(t)?'Sessão interrompida; pause e retome para continuar':running?'Em execução':'Pausado/finalizado')+' · '+(t.manualSeconds!=null?'Tempo ajustado manualmente':'Tempo automático')+'</small>'+
 '<div class="track4-actions">'+[['start','Iniciar'],['pause','Pausar'],['resume','Continuar'],['finish','Finalizar'],['reset','Zerar'],['restart','Reiniciar'],['edit-time','Editar tempo'],['restore-auto','Restaurar tempo automático']].map(([a,b])=>'<button type="button" data-track4-timer="'+a+'" '+(a==='pause'&&!running||a==='start'&&!!t.startedAt||a==='resume'&&(!t.startedAt||running||end)||a==='finish'&&(!t.startedAt||end)||a==='restore-auto'&&t.manualSeconds==null?'disabled':'')+'>'+b+'</button>').join('')+'</div><p>Ao pausar ou finalizar, só é somado o período efetivamente trabalhado. Zerar/reiniciar mantém o histórico anterior. Apenas uma medição ativa por funcionário neste controle; alterações entre dispositivos exigem revisão da nuvem.</p></div>';
}
function timeline(c,month){
 const r=c.reconciliationTracking?.[month]||{},events=[];
 const add=(at,label,actor,source)=>{if(at&&!Number.isNaN(Date.parse(at)))events.push({at,label,actor:actor||null,source});};
 if(r.start)add(r.start,'Conciliação iniciada (data informada)',null,'Controle existente');
 if(r.end)add(r.end,'Conciliação concluída (data informada)',null,'Controle existente');
 if(r.updatedAt)add(r.updatedAt,'Registro de acompanhamento atualizado',null,'Controle existente');
 for(const h of r.managementHistory||[])add(h.at,h.type==='restore-auto'?'Campo restaurado: '+h.field:'Campo gerencial ajustado: '+h.field,h.actorId,'Melhoria 04');
 for(const h of r.workTimer?.history||[])add(h.at,'Cronômetro: '+h.action,h.actorId,'Melhoria 04');
 for(const h of c.reconciliationReview?.[month]?.decisions||[])add(h.at,'Análise de pendência: '+h.decision,h.operator,'Central de Pendências');
 for(const h of c.reconciliationReview?.[month]?.approvals||[])add(h.at,'Checklist de fechamento aprovado',h.operator,'Revisão');
 for(const h of c.crmHistory||[])if((h.periods||[]).includes(month))add(h.createdAt||h.occurredAt,'CRM: '+h.type,h.actorId,'CRM Contábil');
 for(const h of state.audit||[])if(h.companyId===c.id&&h.period===month)add(h.at,'Sistema: '+h.action,h.actorId,'Auditoria');
 const d=c.documentHistory?.[month];if(d?.updatedAt)add(d.updatedAt,'Situação documental atualizada: '+d.status,d.updatedBy,'Documentos');
 return events.sort((a,b)=>b.at.localeCompare(a.at));
}
function detail(){
 const c=validCompanies().find(x=>x.id===selected);if(!c){selected='';return '';}
 const period=p(),r=T.effective(c,period),hist=timeline(c,period);
 return '<section class="track4-detail"><div class="track4-heading"><div><h3>'+esc(c.name)+'</h3><p>'+esc(c.cnpj||'')+' · Código Domínio '+esc(c.dominio||'—')+' · Competência '+period+'</p></div><button type="button" data-track4-back>Voltar à carteira</button></div>'+
 '<p><strong>Documentos:</strong> '+esc(r.data.docs)+' · <strong>Status da conciliação:</strong> '+esc(r.data.status)+' · <strong>Origem:</strong> '+esc(r.origin.status.kind)+'</p>'+
 '<div class="track4-fields">'+fields.map(([k,label,type])=>'<div><b>'+esc(label)+'</b><div>'+esc(r.data[k]??'—')+'</div><small>'+esc(r.origin[k].kind==='manual'?'Ajustado manualmente (automático: '+String(r.auto[k]??'—')+')':'Registro automático')+'</small></div>').join('')+'</div>'+
 '<div class="track4-actions"><button type="button" data-track4-edit>Editar acompanhamento</button><button type="button" data-track4-original>Ver origem dos dados</button><button type="button" data-track4-navigate="pendencias">Central de Pendências</button><button type="button" data-track4-navigate="crm">CRM Contábil</button></div>'+
 (editing?'<form id="track4EditForm"><h4>Preenchimento manual / correção de informação automática</h4><div class="track4-edit-fields">'+fields.map(([k,label,type])=>'<div>'+fieldEditor(k,label,type,r.data[k])+(r.origin[k].kind==='manual'?'<button type="button" data-track4-restore-field="'+esc(k)+'" title="Restaurar valor automático de '+esc(label)+'">Restaurar automático</button>':'')+'</div>').join('')+'</div><label>Motivo da alteração (recomendado)<textarea name="reason" rows="2" maxlength="400"></textarea></label><div class="track4-actions"><button type="submit">Salvar alterações</button><button type="button" data-track4-cancel>Cancelar</button></div><p>Esses valores são somente gerenciais. Nenhum ajuste resolve pendências reais, reclassifica lançamentos ou altera os arquivos exportados.</p></form>':'')+
 timerUi(c,period)+
 '<details class="track4-history"><summary>Histórico cronológico: atividades, pendências, ajustes, revisão e tempo ('+hist.length+')</summary>'+(hist.length?hist.map(h=>'<p>'+esc(h.at)+' · '+esc(h.actor||'Autor não identificado')+' · '+esc(h.label)+' <small>['+esc(h.source)+']</small></p>').join(''):'Nenhuma atividade registrada para a competência.')+'</details></section>';
}
function render(){
 const root=$('#trackingV4Panel');if(!root)return;
 if(!uid()||!window.ConciliaCloud?.authenticated?.()){root.textContent='Entre na conta para consultar as conciliações da sua carteira.';return;}
 if(selected&&!validCompanies().some(c=>c.id===selected))selected='';
 root.innerHTML='<div class="track4-heading"><div><span>GESTÃO DAS CONCILIAÇÕES</span><h2>Acompanhamento mensal da carteira</h2><p>Indicadores automáticos e ajustes manuais separados das classificações contábeis.</p></div></div>'+renderSummary()+(selected?detail():renderList()+renderEvolution());
}
function rollback(c,period,old){if(old)c.reconciliationTracking[period]=old;else delete c.reconciliationTracking[period];}
async function persist(c,period,old,type){
 if(busy)throw Error('Outra operação está em andamento.');
 if(!ready())throw Error('Entre na sua conta e sincronize o Supabase antes de registrar alterações.');
 busy=true;const before=window.ConciliaCloud.revision();
 try{
  // Salva pelo mecanismo existente, protegido por revisão (CAS).
  await window.ConciliaSaveManagementV4(type,c.id+' · '+period);
  if(!cloudSyncEnabled||window.ConciliaCloud.revision()===before)throw Error('Gravação em nuvem não confirmada.');
 }catch(e){rollback(c,period,old);render();throw e;}finally{busy=false;}
}
async function confirmFresh(){
 if(!ready())throw Error('Sincronização do Supabase indisponível.');
 const revision=window.ConciliaCloud.revision();
 const remote=await window.ConciliaCloud.fetchWorkspace();
 if(window.ConciliaCloud.revision()!==revision)throw Error('Outra sessão alterou o workspace. Recarregue a página para evitar sobrescrever dados.');
 if(!remote)throw Error('Workspace não encontrado no Supabase.');
}
function activeTimer(){
 for(const c of validCompanies())for(const [month,record] of Object.entries(c.reconciliationTracking||{})){
  if(record.workTimer?.runningSince&&record.workTimer.actorId===uid())return {company:c,period:month,timer:record.workTimer};
 }
 return null;
}
async function doTimerFor(c,period,action,seconds=null){
 if(!c)throw Error('Empresa não encontrada.');
 await confirmFresh();
 const old=JSON.parse(JSON.stringify(c.reconciliationTracking?.[period]||null));
 if(['start','resume','restart'].includes(action)){
  const other=activeTimer();
  if(other&&(other.company.id!==c.id||other.period!==period))throw Error('Cronômetro ativo em '+other.company.name+' · '+other.period+'. Pause antes de iniciar outro.');
 }
 const timer=T.timerTransition(c,period,action,uid(),new Date(),seconds);
 c.reconciliationTracking ||= {};c.reconciliationTracking[period] ||= {};c.reconciliationTracking[period].workTimer=timer;
 try{
  await persist(c,period,old,'CRONOMETRO_CONCILIACAO_'+action.toUpperCase());
  if(action!=='heartbeat')render();
 }catch(e){if(action!=='heartbeat')alert(e.message);else console.warn('Heartbeat: ',e.message);throw e;}
}
async function doTimer(action){
 const c=validCompanies().find(x=>x.id===selected);
 if(['reset','restart','edit-time'].includes(action)&&!confirm('Confirmar '+action+'? O tempo e seu histórico anterior serão preservados.'))return;
 const requested=action==='edit-time'?prompt('Tempo válido total em segundos (ex.: 3000 para 50 minutos):'):null;
 if(action==='edit-time'&&requested===null)return;
 const seconds=action==='edit-time'?Number(requested):null;
 if(action==='edit-time'&&!Number.isSafeInteger(seconds))throw Error('Informe tempo inteiro em segundos.');
 return doTimerFor(c,p(),action,seconds);
}
async function saveEdit(form){
 const c=validCompanies().find(x=>x.id===selected),period=p();if(!c)throw Error('Empresa não encontrada.');
 await confirmFresh();const old=JSON.parse(JSON.stringify(c.reconciliationTracking?.[period]||null));
 try{
  const reason=String(new FormData(form).get('reason')||'').trim();
  let modified=0;
  for(const [field] of fields){
   const el=form.querySelector('[data-track4-value="'+field+'"]');if(!el)continue;
   const before=T.effective(c,period).data[field]??'',value=el.value;
   if(String(before)!==String(value)){T.edit(c,period,field,value,uid(),reason);modified++;}
  }
  if(!modified)return;
  await persist(c,period,old,'CONTROLE_CONCILIACAO_GERENCIAL');
  editing=false;render();
 }catch(e){rollback(c,period,old);render();throw e;}
}
function init(){
 const el=$('#trackingV4Panel');if(!el)return;
 el.addEventListener('click',e=>{
  const open=e.target.closest('[data-track4-open]');if(open){selected=open.dataset.track4Open;editing=false;render();return;}
  if(e.target.closest('[data-track4-back]')){selected='';editing=false;render();return;}
  if(e.target.closest('[data-track4-edit]')){editing=true;render();return;}
  if(e.target.closest('[data-track4-cancel]')){editing=false;render();return;}
  if(e.target.closest('[data-track4-original]')){alert('O campo automático é apresentado ao lado do ajuste manual; os registros de origem continuam intactos.');return;}
  const restore=e.target.closest('[data-track4-restore-field]');
  if(restore){const field=restore.dataset.track4RestoreField;
   if(!T.FIELDS.includes(field)||!confirm('Restaurar o valor automático deste campo? O ajuste anterior será mantido no histórico.'))return;
   const c=validCompanies().find(x=>x.id===selected),period=p();
   (async()=>{await confirmFresh();const old=JSON.parse(JSON.stringify(c.reconciliationTracking?.[period]||null));const op=T.restore(c,period,field,uid(),'Restaurar dado automático');if(op.changed)await persist(c,period,old,'CONTROLE_CONCILIACAO_RESTAURAR');render();})().catch(err=>alert(err.message));return;
  }
  const tm=e.target.closest('[data-track4-timer]');if(tm){doTimer(tm.dataset.track4Timer).catch(err=>alert(err.message));return;}
  const go=e.target.closest('[data-track4-navigate]');if(go){showPage(go.dataset.track4Navigate);return;}
  const count=e.target.closest('[data-track4-counter]');if(count){const m={'Concluídas':'Concluída','Em andamento':'Em andamento','Não iniciadas':'Não iniciada','Aguardando documentos':'Aguardando documentos','Pendências internas':'Com pendências'};if(m[count.dataset.track4Counter]){status=m[count.dataset.track4Counter];selected='';render();}return;}
 });
 el.addEventListener('change',e=>{const field=e.target.dataset.track4Filter;if(!field)return;
  if(field==='month')month=Number(e.target.value);
  if(field==='year')year=Number(e.target.value);
  if(field==='status')status=e.target.value;
  if(field==='docs')docs=e.target.value;
  if(field==='review')review=e.target.value;
  if(field==='delay')delay=e.target.value;
  if(field==='deadline')deadlineFilter=e.target.value;
  selected='';render();
 });
 el.addEventListener('input',e=>{if(e.target.dataset.track4Filter==='search'){search=e.target.value;const caret=e.target.selectionStart;render();const input=el.querySelector('[data-track4-filter="search"]');input?.focus();input?.setSelectionRange(caret,caret);}});
 el.addEventListener('submit',e=>{if(e.target.id!=='track4EditForm')return;e.preventDefault();saveEdit(e.target).catch(err=>alert(err.message));});
 interval=setInterval(()=>{const c=validCompanies().find(x=>x.id===selected);if(!c)return;const t=T.timer(c,p());if(!t.runningSince)return;const el=$('[data-track4-clock]');if(el)el.textContent=sec(t.manualSeconds??T.elapsed(t));},1000);
 // Heartbeat protege contra contagem de horas após fechar ou perder a conexão.
 // É salvo somente enquanto a página está ativa; a revisão de nuvem bloqueia
 // escrita concorrente entre abas/dispositivos.
 setInterval(()=>{if(document.hidden||busy||!ready())return;const a=activeTimer();if(a&&!T.stale(a.timer))doTimerFor(a.company,a.period,'heartbeat').catch(err=>console.warn('Cronômetro: heartbeat não confirmado',err.message));},30000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden||busy)return;const a=activeTimer();if(a)doTimerFor(a.company,a.period,'pause').catch(err=>console.warn('Cronômetro: pausa ao ocultar não confirmada',err.message));});
}
window.ConciliaTrackingV4={render,summary:()=>T.summarize(validCompanies(),p(),uid()),currentPeriod:p};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();