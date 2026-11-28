/* Melhoria 05 — módulos avançados, plug-in da Visão Geral existente; sem abas novas.
  Toda escrita utiliza Concilia05.saveRecord (CAS + auth + RLS). */
(()=>{'use strict';
const A=window.Concilia05Analytics,C=window.Concilia05Core,B=window.ConciliaBIMetrics;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const n=x=>x===null||x===undefined?'Sem dados':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(x);
const pct=x=>x===null||x===undefined?'Sem dados':n(x)+'%';
const options=(values,current)=>values.map(([v,label])=>'<option value="'+esc(v)+'" '+(current===v?'selected':'')+'>'+esc(label)+'</option>').join('');
const date=x=>String(x||'').slice(0,10);
const today=()=>new Date().toISOString().slice(0,10);
let view={range:'month',day:today(),month:today().slice(0,7),year:Number(today().slice(0,4)),start:today().slice(0,7)+'-01',end:today(),period:'',companyId:'',status:'all',activityType:'all'},root=null;
const card=(title,body)=>'<article class="m05-card"><h3>'+esc(title)+'</h3>'+body+'</article>';
const button=(label,attr='')=>'<button '+(attr.includes('type=')?'':'type="button" ')+attr+'>'+esc(label)+'</button>';
const input=(name,label,type='text',extra='')=>'<label>'+esc(label)+'<input type="'+type+'" name="'+name+'" '+extra+'></label>';
const inputValue=(name,label,type,value)=>input(name,label,type,'value="'+esc(value??'')+'"');
const owner=()=>window.Concilia05?.owner?.()||'';
const store=()=>window.Concilia05?.privateState?.()||C.blank();
const companies=()=>B.authorized(window.Concilia05?.context?.()?.companies,owner());
const context=()=>window.Concilia05?.context?.()||{};
const records=k=>(Array.isArray(store()[k])?store()[k]:[]).filter(r=>r.ownerId===owner()&&(!r.companyId||companies().some(c=>c.id===r.companyId)));
const filter=()=>({...view,ownerId:owner(),companyId:view.companyId});
const selected=k=>A.filterRows(records(k),filter());
const save=async(kind,obj)=>{await window.Concilia05.saveRecord(kind,obj);window.Concilia05.render();};
const create=(kind,data)=>C.create(kind,data,owner());
const head=()=>'<div class="m05-ext-head"><strong>Filtros operacionais avançados</strong><span>Datas de execução e competências permanecem separadas</span></div>';
function filters(){
 const f=view,cs=companies(),v=[['day','Dia'],['week','Semana'],['month','Mês'],['quarter','Trimestre'],['semester','Semestre'],['year','Ano'],['custom','Período personalizado']];
 return card('Filtros integrados da Melhoria 05',head()+'<div class="m05-ext-filters">'+
 '<label>Intervalo<select data-m05x="range">'+options(v,f.range)+'</select></label>'+
 '<label>Dia de referência<input data-m05x="day" type="date" value="'+esc(f.day)+'"></label>'+
 '<label>Mês de referência<input data-m05x="month" type="month" value="'+esc(f.month)+'"></label>'+
 '<label>Ano<input data-m05x="year" type="number" min="2020" max="2099" value="'+f.year+'"></label>'+
 '<label>Data inicial<input data-m05x="start" type="date" value="'+esc(f.start)+'"></label>'+
 '<label>Data final<input data-m05x="end" type="date" value="'+esc(f.end)+'"></label>'+
 '<label>Competência contábil<input data-m05x="period" type="month" value="'+esc(f.period)+'"></label>'+
 '<label>Empresa<select data-m05x="companyId">'+options([['','Todas autorizadas'],...cs.map(c=>[c.id,c.name])],f.companyId)+'</select></label>'+
 '<label>Funcionário<input value="Somente minha conta autenticada" disabled aria-label="Funcionário atual"></label>'+
 '<label>Tipo de atividade<select data-m05x="activityType">'+options([['all','Todas'],['Conciliação','Conciliação'],['Conferência','Conferência'],['Classificação','Classificação'],['Revisão','Revisão'],['Cobrança documental','Cobrança documental'],['Administrativo','Administrativo'],['Correção','Correção']],f.activityType)+'</select></label>'+
 '<label>Situação<select data-m05x="status">'+options([['all','Todas'],['Concluída','Concluída'],['Aberta','Aberta'],['Resolvida','Resolvida'],['Aprovada','Aprovada'],['Em andamento','Em andamento']],f.status)+'</select></label>'+
 button('Limpar filtros','data-m05x-reset')+'</div>');
}
function bars(rows,label,unit=''){
 if(!rows.length||!rows.some(r=>r.value>0))return '<p class="m05-ext-note">Sem dados registrados para gráfico '+esc(label)+'.</p>';
 const max=Math.max(1,...rows.map(r=>r.value||0));
 return '<div class="m05-ext-bars" role="img" aria-label="'+esc(label)+'">'+rows.map(r=>'<div class="m05-ext-bar"><span>'+esc(r.label)+'</span><div><i style="width:'+Math.max(0,Math.min(100,(r.value||0)/max*100))+'%"></i></div><strong>'+n(r.value)+esc(unit)+'</strong></div>').join('')+'</div>';
}
function activity(){
 const rs=selected('activities'),total=A.sessions(rs,filter()),fields='<input name="activityType" required list="m05-types" placeholder="Tipo de atividade"><datalist id="m05-types"><option>Conciliação</option><option>Conferência</option><option>Revisão</option><option>Classificação</option><option>Correção</option><option>Administrativo</option><option>Cobrança documental</option></datalist>';
 const form='<form class="m05-ext-form" data-m05x-form="activity"><div class="m05-ext-grid">'+
 input('title','Descrição da atividade')+input('executionAt','Data da execução','date','value="'+today()+'"')+
 '<label>Atividade'+fields+'</label>'+
 '<label>Empresa<select name="companyId">'+options([['','Atividade geral'],...companies().map(c=>[c.id,c.name])],'')+'</select></label>'+
 '<label>Competência<input name="period" type="month" value="'+esc(view.period||view.month)+'"></label>'+
 input('effectiveSeconds','Tempo efetivo em segundos','number','min="0" step="1"')+
 input('pauseSeconds','Pausas (segundos)','number','min="0" step="1"')+
 input('waitSeconds','Espera (segundos)','number','min="0" step="1"')+
 input('reworkSeconds','Retrabalho (segundos)','number','min="0" step="1"')+
 input('movements','Movimentações documentadas','number','min="0" step="1"')+
 input('originId','Identificador de origem para evitar duplicidade')+'</div>'+button('Registrar atividade auditada','type="submit" class="m05-primary"')+'</form>';
 const monthly=A.groupByMonths(rs,view.year,'executionAt').map(x=>({label:x.period.slice(5),value:x.count}));
 return card('05.1 · Atividades, tempo e produtividade',
 '<div class="m05-ext-stat"><b>'+n(total.activities)+'</b><small>atividades concluídas únicas</small><b>'+n(total.effectiveSeconds===null?null:Math.round(total.effectiveSeconds/60))+'</b><small>minutos efetivos medidos</small><b>'+n(total.movementsPerHour)+'</b><small>movimentos por hora medida</small></div>'+
 bars(monthly,'Atividades por mês')+
 '<p class="m05-ext-note">Registros manuais de medição são distintos das sessões dos cronômetros existentes. Não some duas fontes sem vínculo verificável. Ajustes são auditados e não alteram extratos.</p>'+
 form+
 (rs.length?'<div class="m05-ext-scroll"><table><thead><tr><th>Atividade</th><th>Data executada</th><th>Competência</th><th>Tempo efetivo</th><th>Espera</th><th>Origem</th></tr></thead><tbody>'+
 rs.slice(-60).reverse().map(r=>'<tr><td>'+esc(r.title)+'</td><td>'+esc(r.executionAt)+'</td><td>'+esc(r.period)+'</td><td>'+n(r.effectiveSeconds)+'s</td><td>'+n(r.waitSeconds)+'s</td><td>'+esc(r.source)+'</td></tr>').join('')+'</tbody></table></div>':''));
}
function quality(){
 const rs=selected('quality'),stats=A.quality(rs,filter());
 const rows=rs.filter(r=>r.reviewStatus||r.companyId);
 return card('05.3 · Revisões, correções e aprovação',
 '<div class="m05-ext-stat"><b>'+pct(stats.firstReviewRate)+'</b><small>aprovação na 1ª revisão (somente revisados)</small><b>'+pct(stats.reworkRate)+'</b><small>retrabalho (somente revisados)</small><b>'+n(stats.approved)+'</b><small>aprovações registradas</small></div>'+
 bars(stats.byCause.slice(0,10).map(x=>({label:x.name,value:x.value})),'Causas identificadas')+
 '<p class="m05-ext-note">Um lançamento confirmado não é uma conciliação revisada. A revisão tem registro explícito do autor, transição e data.</p>'+
 (rows.length?'<div class="m05-ext-scroll"><table><thead><tr><th>Ocorrência</th><th>Etapa da revisão</th><th>Primeira revisão</th><th>Ação</th></tr></thead><tbody>'+
 rows.slice(-60).reverse().map(r=>{const state=r.reviewStatus||'Executada',targets={
 Executada:['Aguardando revisão'],'Aguardando revisão':['Em revisão'],'Em revisão':['Aprovada','Devolvida'],
 Devolvida:['Correção realizada'],'Correção realizada':['Nova revisão'],'Nova revisão':['Aprovada','Devolvida'],Aprovada:[]}[state]||[];
 return '<tr><td>'+esc(r.title)+'</td><td>'+esc(state)+'</td><td>'+esc(r.firstReviewOutcome||'Não avaliada')+'</td><td>'+targets.map(to=>button(to,'data-m05x-review="'+esc(r.id)+'" data-review-to="'+esc(to)+'"')).join('')+'</td></tr>';
 }).join('')+'</tbody></table></div>':'<p>Sem revisões registradas nesta seleção.</p>'));
}
function company(){
 const all=companies().filter(c=>!view.companyId||c.id===view.companyId);
 const times=all.map(c=>{
  const r=B.record(c,view.period||view.month,window.ConciliaTrackingCore);
  const complexity=C.complexity({movements:r.movements,accounts:Array.isArray(c.bankAccounts)?c.bankAccounts.length:null,pending:r.pending,manual:r.manual,rework:r.rework});
  return {company:c,r,complexity};
 });
 const data=times.map(x=>({label:x.company.name,value:x.r.movements})).sort((a,b)=>b.value-a.value).slice(0,12);
 return card('05.2 · Histórico das empresas e complexidade documentada',bars(data,'Movimentações por empresa')+
 '<div class="m05-ext-scroll"><table><thead><tr><th>Empresa</th><th>Domínio</th><th>Movimentos</th><th>Classificadas</th><th>Automação</th><th>Complexidade</th></tr></thead><tbody>'+
 times.map(x=>'<tr><td>'+esc(x.company.name)+'</td><td>'+esc(x.company.dominio)+'</td><td>'+n(x.r.movements)+'</td><td>'+n(x.r.classified)+'</td><td>'+pct(x.r.classified?x.r.automatic/x.r.classified*100:null)+'</td><td>'+esc(x.complexity.level||'Não avaliável')+'</td></tr>').join('')+'</tbody></table></div>'+
 '<p class="m05-ext-note">Critérios objetivos por volume, contas, pendências, classificação manual e retrabalho. Se algum dado não existe, exibir Não avaliável.</p>');
}
function planning(){
 const gs=selected('goals');const summaries=gs.map(g=>({g,result:A.goalProgress(g,companies(),owner(),B,window.ConciliaTrackingCore)}));
 const cal=records('calendar').slice(-1)[0]||{};
 const remaining=A.operational(companies(),owner(),B,view,window.ConciliaTrackingCore).summary?.remaining;
 let calc;try{calc=A.planning(remaining,{from:today(),deadline:cal.deadline,dailyHours:cal.dailyHours,daysOff:cal.daysOff},null);}catch{calc={days:null,perDay:null,risk:'Confira o calendário'};}
 const form='<form data-m05x-form="calendar" class="m05-ext-form"><div class="m05-ext-grid">'+
 input('deadline','Prazo planejado','date')+input('dailyHours','Horas disponíveis por dia','number','step="0.25" min="0" max="24"')+
 input('daysOff','Folgas e indisponibilidades (AAAA-MM-DD separadas por vírgula)')+'</div>'+button('Registrar calendário','type="submit" class="m05-primary"')+'</form>';
 return card('05.6 · Metas, disponibilidade e planejamento',
 '<div class="m05-ext-stat"><b>'+n(calc.days)+'</b><small>dias úteis disponíveis</small><b>'+n(calc.perDay)+'</b><small>conciliações restantes por dia útil</small></div>'+
 (calc.risk?'<p class="m05-ext-warning">'+esc(calc.risk)+'</p>':'')+
 '<p class="m05-ext-note">O progresso de cada meta utiliza sua própria empresa e competência, nunca o filtro atual indiscriminadamente. O calendário não é uma promessa de capacidade; folgas explícitas são excluídas.</p>'+form+
 '<div class="m05-ext-scroll"><table><thead><tr><th>Meta</th><th>Competência da meta</th><th>Empresa</th><th>Valor</th><th>Progresso</th><th>Origem</th></tr></thead><tbody>'+
 summaries.map(({g,result})=>'<tr><td>'+esc(g.title)+'</td><td>'+esc(result.period||g.period||'Sem período')+'</td><td>'+esc(g.companyId||'Carteira autorizada')+'</td><td>'+n(result.actual)+'</td><td>'+pct(result.progress)+'</td><td>'+esc(result.source)+'</td></tr>').join('')+'</tbody></table></div>');
}
function learning(){
 const rs=selected('ruleEvents'),a=A.learning(rs,filter());
 const actual=A.learningFromCompanies(companies(),owner(),B,filter());
 return card('05.5 · Eventos auditáveis da memória de aprendizagem',
 '<div class="m05-ext-stat"><b>'+n(actual.suggested)+'</b><small>sugestões reais da memória</small><b>'+pct(actual.confirmationRate)+'</b><small>confirmações da memória</small><b>'+n(actual.corrected)+'</b><small>correções identificadas</small></div>'+
 '<p class="m05-ext-note">As sugestões, confirmações e correções do sistema são auditadas no movimento bancário a partir da implantação desta versão. Eventos manuais ('+n(a.uses)+' usos declarados) são separados das medições reais.</p>'+
 '<form class="m05-ext-form" data-m05x-form="ruleEvent"><div class="m05-ext-grid">'+
 '<label>Empresa<select name="companyId" required>'+options([['','Selecione uma empresa'],...companies().map(c=>[c.id,c.name])],'')+'</select></label>'+
 input('period','Competência','month','value="'+esc(view.period||view.month)+'"')+
 input('ruleId','Identificador da regra')+
 '<label>Evento<select name="event">'+options([['used','Regra utilizada'],['corrected','Regra corrigida'],['deactivated','Regra desativada']],'used')+'</select></label>'+
 '<label>Confirmação<select name="confirmed">'+options([['false','Não confirmada'],['true','Confirmada']],'false')+'</select></label>'+
 input('executionAt','Data da execução','date','value="'+today()+'"')+'</div>'+button('Registrar evento auditável','type="submit" class="m05-primary"')+'</form>'+
 bars(a.byCompany.slice(0,10).map(r=>({label:companies().find(c=>c.id===r.companyId)?.name||'Empresa autorizada',value:r.count})),'Eventos de aprendizagem'));
}
function reportSummary(){
 return card('05.8 · Relatórios temáticos para a seleção',
 '<p>Relatórios profissionais com filtros, períodos, fórmulas, comparativos e limitações. O PDF não envia dados a serviço externo; o Excel usa a biblioteca já disponível.</p>'+
 button('Excel temático (XLSX)','data-m05x-export="xlsx"')+button('PDF profissional','data-m05x-export="pdf"')+
 button('Portfólio externo anonimizado','data-m05x-export="anon"'));
}
function panel(){
 const ui=window.Concilia05;if(!ui?.owner?.())return '';
 const tab=ui.mode?.()||'overview';
 const s=filters();
 if(tab==='productivity'||tab==='efficiency')return s+activity();
 if(tab==='companies')return s+company();
 if(tab==='quality')return s+quality();
 if(tab==='automation')return s+learning();
 if(tab==='goals')return s+planning();
 if(tab==='reports'||tab==='professional')return s+reportSummary();
 return s+card('Inteligência gerencial · análises fundamentadas',
 '<p>As perspectivas detalhadas mantêm separadas as datas de execução das competências contábeis e indicam ausência de dados medidos. Os registros de origem podem ser consultados nas tabelas das respectivas perspectivas.</p>'+
 reportSummary());
}
async function formSubmit(form){
 const kind=form.dataset.m05xForm;
 const data=Object.fromEntries(new FormData(form).entries());
 data.period=data.period||view.period||view.month;
 if(kind==='calendar'){
  data.dailyHours=data.dailyHours===''?null:Number(data.dailyHours);
  data.daysOff=(data.daysOff||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!data.deadline||!A.businessDays(today(),data.deadline,data.daysOff))throw Error('Informe prazo com dia útil disponível');
 }else if(kind==='activity'){
  for(const k of ['effectiveSeconds','pauseSeconds','waitSeconds','reworkSeconds','movements'])data[k]=data[k]===''?null:Number(data[k]);
  data.title=data.title||data.activityType;
 }else if(kind==='ruleEvent')data.confirmed=data.confirmed==='true';
 const record=create(kind,data);
 await save(kind,record);
}
async function review(id,target){
 const prev=records('quality').find(r=>r.id===id);if(!prev)throw Error('Ocorrência fora da sua carteira');
 const why=target==='Devolvida'?'Devolução para correção com causa a investigar':'Mudança de etapa solicitada por usuário autorizado';
 const next=A.reviewTransition(prev,target,owner(),new Date(),why);await save('quality',next);
}
function init(){
 if(root)return;root=document.querySelector('#melhoria05Panel');if(!root)return;
 root.addEventListener('change',e=>{
  const k=e.target.dataset.m05x;if(!k)return;
  view[k]=k==='year'?Number(e.target.value):e.target.value;
  window.Concilia05?.render();
 });
 root.addEventListener('click',async e=>{
  if(e.target.closest('[data-m05x-reset]')){view={range:'month',day:today(),month:today().slice(0,7),year:Number(today().slice(0,4)),start:today().slice(0,7)+'-01',end:today(),period:'',companyId:'',status:'all',activityType:'all'};window.Concilia05?.render();return;}
  const r=e.target.closest('[data-m05x-review]');if(r)try{await review(r.dataset.m05xReview,r.dataset.reviewTo)}catch(err){alert(err.message)}return;
  const ex=e.target.closest('[data-m05x-export]');if(ex)try{await window.Concilia05Reports.export(ex.dataset.m05xExport,{filter:filter(),state:store(),companies:companies(),owner:owner(),analytics:A,B,tracking:window.ConciliaTrackingCore})}catch(err){alert(err.message)};
 });
 root.addEventListener('submit',async e=>{if(!e.target.matches('[data-m05x-form]'))return;e.preventDefault();const form=e.target;
  try{await formSubmit(form)}catch(err){alert(err.message||String(err));}
 });
}
window.Concilia05Advanced={panel,filter:()=>({...view}),init};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
