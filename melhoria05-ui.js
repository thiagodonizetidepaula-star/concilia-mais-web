/* ConCiliar+PLUS Melhoria 05 — laboratorio isolado, sem produzir efeitos contabeis.
   Os registros privados dependem de migração segura, ainda NÃO instalada em produção. */
(()=>{'use strict';
const C=window.Concilia05Core,B=window.ConciliaBIMetrics;
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const fmt=x=>x===null||x===undefined?'Sem dados':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(x);
const dateBR=x=>x?String(x).slice(0,10).split('-').reverse().join('/'):'—';
const secs=s=>s===null||s===undefined?'Sem medição':(Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'min');
const pct=s=>s===null||s===undefined?'Sem dados':fmt(s)+'%';
const kindNames={quality:'Ocorrência de qualidade',goal:'Meta',competency:'Competência',diary:'Diário profissional',achievement:'Realização',development:'Plano de desenvolvimento'};
const tabs=[['overview','Visão gerencial'],['productivity','Produtividade'],['companies','Empresas'],['quality','Qualidade'],['efficiency','Eficiência'],['automation','Automação'],['goals','Metas'],['professional','Evolução profissional'],['reports','Relatórios']];
let ctx=null,owner='',store=C.blank(),revision=null,ready=false,loading=false,error='',mode='overview',year=new Date().getFullYear(),companyId='',saving=false,requested=false,filterStatus='all';
const today=()=>new Date().toISOString().slice(0,10);
const own=()=>window.ConciliaCloud?.accountId?.()===owner&&!!owner;
const companyList=()=>B.authorized(ctx?.companies,owner);
const companies=()=>companyList().filter(c=>!companyId||c.id===companyId);
const companyAllowed=id=>!id||companyList().some(c=>c.id===id);
const months=()=>B.months(year);
const mon=()=>months().at(new Date().getFullYear()===year?new Date().getMonth():11);
const tracked=()=>window.ConciliaTrackingCore;
const bi=()=>{const A=window.Concilia05Analytics,filter=window.Concilia05Advanced?.filter?.();return A&&filter?A.operational(companies(),owner,B,filter,tracked()).summary:B.summarize(companies(),owner,mon(),{tracking:tracked()}).summary;};
const title=s=>'<h3>'+esc(s)+'</h3>';
const kpi=(name,value,detail='')=>'<article class="m05-kpi"><small>'+esc(name)+'</small><strong>'+esc(value)+'</strong><span>'+esc(detail)+'</span></article>';
const empty=msg=>'<div class="m05-empty">'+esc(msg)+'</div>';
const section=(heading,content)=>'<article class="m05-card">'+title(heading)+content+'</article>';
const button=(label,attr='')=>'<button type="button" '+attr+'>'+esc(label)+'</button>';
const ownRecords=(key)=>{
 const rs=(C.normalize(store)[key]||[]).filter(r=>r.ownerId===owner&&companyAllowed(r.companyId));
 const A=window.Concilia05Analytics,f=window.Concilia05Advanced?.filter?.();
 if(!A||!f||key==='calendar')return rs;
 return rs.filter(r=>{
  if(f.companyId&&r.companyId!==f.companyId)return false;
  if(f.search&&r.companyId&&!companyList().some(c=>c.id===r.companyId&&[c.name,c.tradeName,c.fantasyName,c.dominio,c.cnpj].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(String(f.search).toLocaleLowerCase('pt-BR')))))return false;
  if(f.period&&r.period!==f.period)return false;
  if(f.status&&f.status!=='all'&&r.status!==f.status)return false;
  if(f.activityType&&f.activityType!=='all'&&r.activityType!==f.activityType)return false;
  // A meta é avaliada em sua competência própria; para exibição de período usar
  // suas datas de vigência, em vez de a data da seleção atual.
  if(key==='goals'){
   const b=A.bounds(f),start=r.start||r.period&&r.period+'-01'||r.createdAt?.slice(0,10)||'';
   const end=r.deadline||r.period&&r.period+'-31'||start;
   return start<=b.to&&end>=b.from;
  }
  return A.included(r,f);
 });
};
const formFields={
 quality:[['title','Descrição da ocorrência','text'],['category','Categoria','category'],['severity','Gravidade','severity'],['description','Detalhes e evidências','textarea'],['cause','Causa confirmada, se conhecida','text'],['correctiveAction','Ação corretiva','text']],
 goal:[['title','Nome da meta','text'],['metric','Indicador relacionado','metric'],['baseline','Valor inicial','number'],['target','Objetivo','number'],['manualActual','Resultado manual (quando necessário)','number'],['direction','Sentido da meta','direction'],['frequency','Periodicidade','frequency'],['start','Início do período','date'],['deadline','Prazo final','date'],['description','Observações','textarea']],
 competency:[['title','Competência avaliada','text'],['category','Grupo profissional','competencyGroup'],['level','Nível (autoavaliação)','level'],['evidence','Evidência verificada','textarea']],
 diary:[['title','Aprendizado ou atividade','text'],['date','Data','date'],['description','Registro profissional','textarea']],
 achievement:[['title','Realização','text'],['date','Data','date'],['description','Evidência','textarea']],
 development:[['title','Objetivo de desenvolvimento','text'],['action','Plano de ação','textarea'],['expected','Resultado esperado','text'],['progress','Progresso declarado (0-100%)','number'],['deadline','Prazo','date']]
};
function options(name){
 const d={competencyGroup:C.COMPETENCY_GROUPS,category:C.CATEGORIES,severity:['Baixa','Média','Alta'],direction:['increase','decrease'],frequency:['day','week','month','quarter','semester','year','custom'],level:C.LEVELS,
 metric:['concluded','movements','classified','documentReceived','charges','automated','excel','pending','learnedRules']};
 return d[name]||[];
}
function field(def,old){
 const [name,label,type]=def,required=['title','metric','target'].includes(name)?' required':'';
 const value=old?.[name]??'';
 if(type==='textarea')return '<label>'+esc(label)+'<textarea name="'+esc(name)+'" rows="3">'+esc(value)+'</textarea></label>';
 if(options(type).length)return '<label>'+esc(label)+'<select name="'+esc(name)+'">'+options(type).map(x=>'<option value="'+esc(x)+'" '+(String(value)===String(x)?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>';
 return '<label>'+esc(label)+'<input name="'+esc(name)+'" type="'+type+'" value="'+esc(value)+'" '+required+(type==='number'?' min="0" step="any"':'')+'></label>';
}
function form(kind,old){
 const opts=companyList().map(c=>'<option value="'+esc(c.id)+'" '+(old?.companyId===c.id?'selected':'')+'>'+esc((c.dominio||'')+' '+c.name)+'</option>').join('');
 const status=old?'<label>Situação<select name="status">'+['Ativa','Pausada','Concluída','Arquivada','Aberta','Em análise','Em desenvolvimento','Não avaliado','Resolvida','Aprovada','Autoavaliação'].map(x=>'<option value="'+esc(x)+'" '+(old.status===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>':'';
 return '<form id="m05NewForm" class="m05-entry" data-kind="'+kind+'" '+(old?'data-edit-id="'+esc(old.id)+'"':'')+'><div class="m05-form-head"><strong>'+(old?'Editar':'Novo registro')+' — '+esc(kindNames[kind])+'</strong><button type="button" data-m05-close>Fechar</button></div>'+
 '<div class="m05-fields">'+(old?'':'<label>Empresa (opcional)<select name="companyId"><option value="">Registro profissional geral</option>'+opts+'</select></label>')+
 (old?'':'<label>Competência (opcional)<input name="period" type="month" value="'+esc(mon())+'"></label>')+
 formFields[kind].map(def=>field(def,old)).join('')+status+'</div><button type="submit" class="m05-primary">'+(old?'Salvar alteração auditada':'Salvar com histórico')+'</button></form>';
}
function records(kind){
 const key={quality:'quality',goal:'goals',competency:'competencies',diary:'diary',achievement:'achievements',development:'development'}[kind];
 const list=ownRecords(key).slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).filter(r=>filterStatus==='all'||r.status===filterStatus);
 if(!list.length)return empty('Nenhum registro autorizado nesta seleção.');
 return '<div class="m05-rows">'+list.slice(0,100).map(r=>'<article class="m05-item"><div><b>'+esc(r.title)+'</b><small>'+esc(r.status||'—')+' · '+dateBR(r.updatedAt)+' · '+esc(r.source||'manual')+'</small><p>'+esc(r.description||r.evidence||r.action||'')+'</p></div><div class="m05-actions">'+
 (kind==='quality'&&r.status!=='Resolvida'?button('Marcar resolvida','data-m05-resolve="'+esc(r.id)+'"'):'')+
 (kind==='goal'&&r.status!=='Concluída'?button('Concluir meta','data-m05-complete="'+esc(r.id)+'"'):'')+
 button('Editar','data-m05-edit="'+esc(kind)+'|'+esc(r.id)+'"')+button('Detalhes','data-m05-detail="'+esc(kind)+'|'+esc(r.id)+'"')+'</div></article>').join('')+'</div>';
}
function sessionHistory(){
 try{return (window.ConciliaManualProductivity?.history?.()||[]).filter(r=>r.userId===owner&&companyAllowed(r.companyId));}catch{return [];}
}
function prod(){
 const a=bi(),h=sessionHistory(),finished=h.filter(r=>r.finishedAt&&String(r.finishedAt).startsWith(year+'-'));
 const secsManual=finished.reduce((sum,r)=>sum+(Number(r.seconds)||0),0);
 return '<div class="m05-kpis">'+kpi('Empresas autorizadas',fmt(a.total),'Da carteira acessível')+kpi('Conciliações concluídas',fmt(a.concluded),'Competência '+mon())+
 kpi('Trabalhos manuais finalizados',fmt(finished.length),'Histórico do cronômetro manual')+
 kpi('Tempo medido manual',secsManual?secs(secsManual):'Sem medição','Sem somar ao Controle 04')+
 kpi('Pendências operacionais',fmt(a.pending),'Não indica culpa do funcionário')+
 kpi('Média por conciliação',secs(a.averageSeconds),'Controle 04; somente durações válidas')+'</div>'+
 section('Histórico individual de conciliações',h.length?'<div class="m05-rows">'+h.slice(0,30).map(r=>'<div class="m05-item"><b>'+esc(r.companyName||'Empresa')+'</b><span>'+dateBR(r.finishedAt)+' · '+secs(Number(r.seconds)||0)+' · '+esc(r.period||'')+'</span></div>').join('')+'</div>':empty('Sem sessões concluídas e registradas para esta conta.'))+
 section('Interpretação','<p>O cronômetro continua com início manual na aba Produtividade. Métricas do Controle 04 e da Produtividade Manual são exibidas separadamente para evitar contagem em duplicidade. Dados não medidos não são convertidos em zero.</p>');
}
function companyStats(){
 const xs=companies();const agg=bi();
 const rows=xs.map(c=>{const r=B.record(c,mon(),tracked()),complex=C.complexity({movements:r.movements,accounts:Array.isArray(c.accounts)?c.accounts.length:null,pending:r.pending,manual:r.manual,rework:r.rework});
 return {r,complex};}).sort((a,b)=>b.r.movements-a.r.movements);
 return '<div class="m05-kpis">'+kpi('Empresas selecionadas',fmt(agg.total))+kpi('Movimentações',fmt(agg.movements))+kpi('Recebimento documental',pct(agg.documentRate))+kpi('Pendências',fmt(agg.pending))+'</div>'+
 section('Comparação operacional por empresa',rows.length?'<div class="m05-tablewrap"><table><thead><tr><th>Empresa</th><th>Domínio</th><th>Movimentos</th><th>Confirmados</th><th>Pendências</th><th>Tempo</th><th>Complexidade</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.r.name)+'</td><td>'+esc(x.r.dominio)+'</td><td>'+fmt(x.r.movements)+'</td><td>'+fmt(x.r.classified)+'</td><td>'+fmt(x.r.pending)+'</td><td>'+secs(x.r.seconds)+'</td><td>'+esc(x.complex.level||'Não avaliável')+'</td></tr>').join('')+'</tbody></table></div>':empty('Nenhuma empresa autorizada na seleção.'))+
 section('Critério de complexidade','<p>Complexidade usa volume, número de contas, pendências, classificação manual e retrabalho. A avaliação só aparece se TODOS os fatores objetivos estiverem registrados. Maior complexidade não significa menor qualidade.</p>');
}
function quality(){
 const rs=ownRecords('quality'),s=C.summarizeQuality(rs);
 return '<div class="m05-kpis">'+kpi('Ocorrências registradas',fmt(s.total))+kpi('Abertas',fmt(s.open))+kpi('Resolvidas',fmt(s.resolved))+kpi('Resolução',pct(s.resolutionRate))+kpi('Tempo médio de resolução',s.averageResolutionHours===null?'Sem dados':fmt(s.averageResolutionHours)+'h')+'</div>'+
 section('Ocorrências e ações corretivas',button('Registrar ocorrência','data-m05-form="quality"')+records('quality'))+
 section('Causas registradas',s.byCategory.length?s.byCategory.map(x=>'<p>'+esc(x.category)+': <b>'+fmt(x.count)+'</b></p>').join(''):empty('Sem causas documentadas.'))+
 section('Critérios','<p>As ocorrências são registros profissionais manuais com origem, responsável e histórico. Aprovação, revisão e retrabalho não devem ser inferidos a partir de conclusão ou exportação no Domínio.</p>');
}
function efficiency(){
 const a=bi();const t=Number(a.seconds)||0;const has=a.seconds!==null&&t>0;
 const throughput=has?Math.round(a.movements/(t/3600)*10)/10:null;
 const remaining=a.remaining;
 return '<div class="m05-kpis">'+kpi('Tempo efetivo registrado',secs(a.seconds))+kpi('Movimentações por hora',throughput===null?'Sem medição':fmt(throughput),'Comparação operacional indicativa')+
 kpi('Conciliações restantes',fmt(remaining))+kpi('Conclusões no prazo',pct(a.onTimeRate),'Prazos efetivamente registrados')+
 kpi('Retrabalhos registrados',fmt(a.rework))+'</div>'+section('Eficiência e gargalos','<p>Taxa de lançamentos por hora só aparece quando o tempo correspondente está registrado. Não medir tempo de espera como tempo efetivo e não comparar diretamente funcionários ou empresas de complexidades distintas.</p>');
}
function automation(){
 const a=bi();
 return '<div class="m05-kpis">'+kpi('Classificações confirmadas',fmt(a.classified))+kpi('Automáticas identificáveis',fmt(a.automated))+
 kpi('Assistidas pelo Excel',fmt(a.excel))+kpi('Taxa automática',pct(a.automaticRate))+kpi('Taxa via Excel',pct(a.excelRate))+
 kpi('Regras aprendidas ativas',fmt(a.learnedRules))+'</div>'+
 section('Origens distintas de classificação','<p>O Excel alimentado pelo usuário não é contado como descoberta automática do sistema. Classificações sugeridas sem confirmação também não entram no numerador. Histórico de usos por regra é indisponível quando não houver evento auditável.</p>');
}
function goals(){
 const a=bi(),gs=ownRecords('goals');
 return section('Metas individuais e planejamento',button('Cadastrar meta','data-m05-form="goal"')+(gs.length?'<div class="m05-rows">'+gs.map(g=>{const x=window.Concilia05Analytics?.goalProgress(g,companyList(),owner,B,tracked())||C.resultGoals(g,a);return '<article class="m05-item"><div><b>'+esc(g.title)+'</b><small>'+esc(g.metric)+' · '+esc(g.direction)+' · prazo '+dateBR(g.deadline)+'</small><strong>'+pct(x.progress)+'</strong><small>Origem: '+esc(x.source)+' · '+esc(g.status)+'</small></div>'+button('Editar','data-m05-edit="goal|'+esc(g.id)+'"')+button('Concluir','data-m05-complete="'+esc(g.id)+'"')+'</article>';}).join('')+'</div>':empty('Cadastre sua primeira meta, com base em indicadores medidos ou atualização manual identificada.')))+
 section('Planejamento','<p>Restantes no período: <b>'+fmt(a.remaining)+'</b>. Prazos e capacidade diária exigem calendário de disponibilidade informado; o sistema não inventa previsões nem avalia competência pelo cumprimento isolado de metas.</p>');
}
function professional(){
 return section('Minha matriz de competências',button('Registrar autoavaliação','data-m05-form="competency"')+records('competency'))+
 section('Diário profissional',button('Nova anotação','data-m05-form="diary"')+records('diary'))+
 section('Realizações e evidências',button('Registrar realização','data-m05-form="achievement"')+records('achievement'))+
 section('Plano de Desenvolvimento Individual',button('Novo objetivo','data-m05-form="development"')+records('development'))+
 section('Privacidade','<p>Autoavaliação é declaração do profissional, não certificação automática. A exportação externa anonimiza empresas e dados operacionais; confira as políticas do escritório antes de compartilhar.</p>');
}
function overview(){
 const a=bi(),q=C.summarizeQuality(ownRecords('quality')),ins=C.insights(a,ownRecords('goals'),q);
 return '<div class="m05-kpis">'+kpi('Empresas na carteira',fmt(a.total))+kpi('Concluídas',fmt(a.concluded))+kpi('Restantes',fmt(a.remaining))+
 kpi('Tempo médio efetivo',secs(a.averageSeconds))+kpi('Ocorrências abertas',fmt(q.open))+kpi('Classificação automática',pct(a.automaticRate))+'</div>'+
 section('Análises gerenciais explicáveis',ins.length?ins.map(x=>'<div class="m05-alert"><b>'+esc(x.title)+'</b><small>Base: '+esc(x.evidence)+' · '+fmt(x.value)+'</small><p>'+esc(x.action)+'</p></div>').join(''):empty('Sem alertas fundamentados para a seleção.'))+
 section('Navegação','<p>Use as perspectivas para acompanhar empresa, funcionário, qualidade, eficiência, automação, metas, desenvolvimento e relatórios; todos os registros privados exigem autenticação e autorização.</p>');
}
function reportPayload(){
 const a=bi(),q=C.summarizeQuality(ownRecords('quality'));
 const base={app:'ConCiliar+PLUS',generatedAt:new Date().toISOString(),year,period:mon(),filteredCompany:companyId||null,
 indicators:a,quality:q,goals:ownRecords('goals').map(g=>({title:g.title,result:C.resultGoals(g,a)})),
 notes:'Somente registros autorizados; lacunas não representam zero; este relatório não substitui auditoria contábil.'};
 return base;
}
function reports(){
 return section('Relatórios gerenciais',button('Exportar Excel (XLSX)','data-m05-export="excel"')+
 button('Gerar PDF via impressão','data-m05-export="pdf"')+
 button('Exportar portfólio anônimo','data-m05-export="portfolio"')+
 '<p>Relatórios aplicam os filtros do período e da empresa atual. O PDF é gerado pela função de impressão do navegador, sem transferência de documentos confidenciais a terceiros.</p>')+
 section('Prévia dos dados','<pre class="m05-json">'+esc(JSON.stringify({period:mon(),indicators:bi(),quality:C.summarizeQuality(ownRecords('quality'))},null,2).slice(0,2500))+'</pre>');
}
const views={overview,productivity:prod,companies:companyStats,quality,efficiency,automation,goals,professional,reports};
function header(){
 return '<header class="m05-head"><div><span>MELHORIA 05 · LABORATÓRIO NÃO PUBLICADO</span><h2>Inteligência operacional e desenvolvimento</h2><p>Planejamento, qualidade, produtividade e dados do usuário autenticado.</p></div><small>'+esc(error||(!ready?'Carregando dados privados...':saving?'Salvando...':'Registros privados sincronizados'))+'</small></header>';
}
function filters(){
 return '<div class="m05-filters"><label>Ano<select data-m05-filter="year">'+[year-1,year,year+1].map(y=>'<option value="'+y+'" '+(year===y?'selected':'')+'>'+y+'</option>').join('')+'</select></label><label>Empresa<select data-m05-filter="company"><option value="">Todas autorizadas</option>'+companyList().map(c=>'<option value="'+esc(c.id)+'" '+(companyId===c.id?'selected':'')+'>'+esc(c.name||c.dominio||'Empresa')+'</option>').join('')+'</select></label>'+button('Atualizar dados','data-m05-refresh')+'</div>';
}
function render(next){
 if(next)ctx=next;
 const root=$('#melhoria05Panel');if(!root||!C||!B)return;
 const id=window.ConciliaCloud?.accountId?.()||'';
 if(!id){owner='';ready=false;store=C.blank();root.replaceChildren();return;}
 const sameAccount=owner===id;
 const existingForm=sameAccount?root.querySelector('#m05NewForm'):null;
 // Salvar referências dos formulários avançados antes de reconstruir os KPIs.
 // Mantém os campos e foco, impedindo perda de edição ao receber nova renderização.
 const activeForms=sameAccount?Array.from(root.querySelectorAll('[data-m05x-form]')).map(form=>[form.dataset.m05xForm,form]):[];
 if(existingForm)existingForm.remove();
 for(const [,form] of activeForms)form.remove();
 if(owner!==id){owner=id;store=C.blank();revision=null;ready=false;loading=false;requested=false;error='';}
 if(!requested){requested=true;void load(id);}
 const selected=views[mode]||overview;
 root.innerHTML='<div class="m05-shell">'+header()+'<div class="m05-nav" role="tablist" aria-label="Etapas da Melhoria 05">'+tabs.map(([id,label])=>'<button type="button" role="tab" data-m05-tab="'+id+'" aria-selected="'+(mode===id)+'">'+esc(label)+'</button>').join('')+'</div>'+filters()+
 (ready?'<div class="m05-body" role="tabpanel">'+selected()+'</div>':empty(error||'Sincronizando os registros pessoais...'))+
 '<div id="m05FormHost"></div><footer>Melhoria 05 em ambiente de homologação. Sem alterações em saldos, classificações, empresa ou dados de outros usuários.</footer></div>';
 // Eventos de outros módulos podem pedir renderização enquanto o usuário digita.
 // Reanexar o MESMO formulário conserva os campos, sem salvar rascunhos não confirmados.
 if(existingForm&&ready)root.querySelector('#m05FormHost')?.appendChild(existingForm);
 if(ready&&window.Concilia05Advanced?.panel){
  const host=root.querySelector('.m05-body');
  if(host){
   host.insertAdjacentHTML('beforeend',window.Concilia05Advanced.panel());
   for(const [kind,original] of activeForms){
    const fresh=Array.from(host.querySelectorAll('[data-m05x-form]')).find(e=>e.dataset.m05xForm===kind);
    if(fresh)fresh.replaceWith(original);
   }
  }
 }
}
async function load(id){
 if(loading||!id)return;loading=true;
 try{
  const cloud=window.ConciliaCloud;
  const {data,error:fail}=await cloud.connect().from('user_melhoria05_states').select('payload,revision').eq('user_id',id).maybeSingle();
  if(fail)throw fail;if(owner!==id)return;
  store=C.normalize(data?.payload||C.blank());revision=data?.revision??null;ready=true;error='';
 }catch(e){if(owner===id){ready=false;error='Não foi possível ler os registros privados: '+String(e.message||e).slice(0,170);}}
 finally{loading=false;if(owner===id)render();}
}
async function persist(kind,record){
 if(!own()||!ready||saving)throw Error('Sincronização indisponível ou já em andamento');
 if(record.companyId&&!companyAllowed(record.companyId))throw Error('Empresa fora da sua carteira');
 const cloud=window.ConciliaCloud,snapshot=C.saveRecord(store,kind,record,owner),id=owner;
 saving=true;render();
 try{
  const table=cloud.connect().from('user_melhoria05_states');
  let res;
  if(revision===null)res=await table.insert({user_id:id,payload:snapshot,revision:1}).select('revision').single();
  else res=await table.update({payload:snapshot,revision:revision+1,updated_at:new Date().toISOString()}).eq('user_id',id).eq('revision',revision).select('revision').maybeSingle();
  if(res.error)throw res.error;if(!res.data||owner!==id)throw Error('Conflito de versão ou troca de sessão; nenhum dado sobrescrito');
  revision=res.data.revision;store=snapshot;error='';
  document.querySelector('#m05FormHost')?.replaceChildren();
 }catch(e){error='Não salvo: '+String(e.message||e).slice(0,170)+' — atualize a página antes de tentar novamente';ready=false;requested=true;throw e;}
 finally{saving=false;render();}
}
function fillForm(kind,id){const host=$('#m05FormHost');if(!host||!kindNames[kind]||!ready)return;
 const key={quality:'quality',goal:'goals',competency:'competencies',diary:'diary',achievement:'achievements',development:'development'}[kind];
 const old=id?ownRecords(key).find(r=>r.id===id):null;
 if(id&&!old)throw Error('Registro não encontrado ou sem autorização');
 host.innerHTML=form(kind,old);host.scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function exportAs(type){
 const payload=reportPayload(),identity=owner;
 if(!identity||!ready)throw Error('Entre na conta para exportar');
 const safe=type==='portfolio'?C.anonymized(store,payload.indicators,owner):payload;
 if(type==='pdf'){
  const frame=document.createElement('iframe');frame.style.display='none';frame.title='Relatório para impressão';document.body.appendChild(frame);
  const doc=frame.contentDocument;doc.open();doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Relatório ConCiliar+PLUS</title><style>body{font:12px Arial;padding:25px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><h1>ConCiliar+PLUS · Relatório gerencial</h1><p>Emitido em '+esc(new Date().toLocaleString('pt-BR'))+'</p><pre>'+esc(JSON.stringify(safe,null,2))+'</pre></body></html>');doc.close();frame.contentWindow?.focus();frame.contentWindow?.print();setTimeout(()=>frame.remove(),3000);return;
 }
 if(type==='excel'){
  if(!window.XLSX)throw Error('Biblioteca XLSX não disponível no navegador');
  const rows=Object.entries(payload.indicators).map(([indicator,value])=>({Indicador:indicator,Valor:value??'Sem dados',Competencia:payload.period}));
  const workbook=window.XLSX.utils.book_new();window.XLSX.utils.book_append_sheet(workbook,window.XLSX.utils.json_to_sheet(rows),'Indicadores');
  window.XLSX.writeFile(workbook,'ConCiliar_05_Indicadores_'+payload.period+'.xlsx');return;
 }
 if(type==='portfolio'){
  const blob=new Blob([JSON.stringify(safe,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='ConCiliar_portfolio_anonimo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
}
function init(){
 const root=$('#melhoria05Panel');if(!root||root.dataset.bound)return;root.dataset.bound='1';
 root.addEventListener('click',async e=>{
  const tab=e.target.closest('[data-m05-tab]');if(tab){mode=tab.dataset.m05Tab;render();return;}
  if(e.target.closest('[data-m05-close]')){$('#m05FormHost').replaceChildren();return;}
  if(e.target.closest('[data-m05-refresh]')){ready=false;requested=false;render();return;}
  const f=e.target.closest('[data-m05-form]');if(f){fillForm(f.dataset.m05Form);return;}
  const edit=e.target.closest('[data-m05-edit]');if(edit){const [kind,id]=edit.dataset.m05Edit.split('|');try{fillForm(kind,id)}catch(err){alert(err.message)}return;}
  const d=e.target.closest('[data-m05-detail]');if(d){const [kind,id]=d.dataset.m05Detail.split('|'),key={quality:'quality',goal:'goals',competency:'competencies',diary:'diary',achievement:'achievements',development:'development'}[kind],record=ownRecords(key).find(x=>x.id===id);
   if(record)alert('Registro auditável (somente leitura):\n'+JSON.stringify(record,null,2));return;}
  const r=e.target.closest('[data-m05-resolve]');if(r){const prev=ownRecords('quality').find(x=>x.id===r.dataset.m05Resolve);if(prev)try{const next=C.edit(prev,{status:'Resolvida',resolvedAt:new Date().toISOString()},owner);await persist('quality',next);}catch(err){alert(err.message);}return;}
  const g=e.target.closest('[data-m05-complete]');if(g){const prev=ownRecords('goals').find(x=>x.id===g.dataset.m05Complete);if(prev)try{await persist('goal',C.edit(prev,{status:'Concluída'},owner));}catch(err){alert(err.message);}return;}
  const ex=e.target.closest('[data-m05-export]');if(ex)try{await exportAs(ex.dataset.m05Export)}catch(err){alert(err.message);}
 });
 root.addEventListener('change',e=>{const field=e.target.dataset.m05Filter;if(!field)return;if(field==='year')year=Number(e.target.value);if(field==='company')companyId=e.target.value;render();});
 root.addEventListener('submit',async e=>{if(e.target.id!=='m05NewForm')return;e.preventDefault();
  const kind=e.target.dataset.kind,d=Object.fromEntries(new FormData(e.target).entries());
  for(const k of ['baseline','target','manualActual','progress'])if(d[k]!==undefined&&d[k]!=='')d[k]=Number(d[k]);
  try{
   const editId=e.target.dataset.editId;
   let record;if(editId){
     const key={quality:'quality',goal:'goals',competency:'competencies',diary:'diary',achievement:'achievements',development:'development'}[kind];
     const prev=ownRecords(key).find(x=>x.id===editId);if(!prev)throw Error('Registro não autorizado');
     record=C.edit(prev,d,owner);
   }else record=C.create(kind,d,owner);
   await persist(kind,record);
  }catch(err){alert(err.message||String(err));}
 });
}
window.Concilia05={render,init,privateState:()=>own()?C.normalize(store):C.blank(),owner:()=>owner,context:()=>ctx,mode:()=>mode,saveRecord:persist};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
