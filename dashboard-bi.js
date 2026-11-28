/* BI ConCiliar+ — visualização integrada em Visão Geral, sem páginas novas. */
(()=>{'use strict';
const M=window.ConciliaBIMetrics;
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=new Intl.NumberFormat('pt-BR'),pf=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1});
const fmt=v=>v===null||v===undefined?'—':nf.format(v);
const pct=v=>v===null||v===undefined?'Sem dados':pf.format(v)+'%';
const duration=s=>s===null||s===undefined?'Sem medição':(Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'min');
const stat=(title,value,foot,kind='blue',target='')=>'<article class="bi-kpi bi-'+kind+'" '+(target?'data-bi-go="'+esc(target)+'" role="button" tabindex="0"':'')+'><span>'+esc(title)+'</span><strong>'+esc(value)+'</strong><small>'+esc(foot||'')+'</small></article>';
const empty=message=>'<div class="bi-empty">'+esc(message)+'</div>';
let tab='carteira',year=new Date().getFullYear(),month=new Date().getMonth()+1,companyId='',query='',model=null,initialized=false;
const period=()=>year+'-'+String(month).padStart(2,'0');
const list=()=>M.authorized(model?.companies,model?.userId);
function spark(values,label){
 const p=values.filter(x=>Number.isFinite(x.value));
 if(!p.length)return empty('Ainda não existem medições suficientes para este gráfico.');
 const w=720,h=180,l=26,r=25,top=18,b=33,max=Math.max(1,...p.map(x=>x.value));
 const coords=values.map((x,i)=>({x:l+(w-l-r)*(values.length===1?.5:i/(values.length-1)),y:top+(h-b-top)*(1-(Number(x.value)||0)/max),...x}));
 const path=coords.map(c=>c.x.toFixed(1)+','+c.y.toFixed(1)).join(' ');
 return '<svg viewBox="0 0 '+w+' '+h+'" class="bi-line" role="img" aria-label="'+esc(label)+'"><line x1="'+l+'" y1="'+(h-b)+'" x2="'+(w-r)+'" y2="'+(h-b)+'" stroke="#355173"/><polyline points="'+path+'" fill="none" stroke="#20cee6" stroke-width="3" stroke-linejoin="round"/>'+
 coords.map(c=>'<circle cx="'+c.x+'" cy="'+c.y+'" r="4" fill="#20cee6"><title>'+esc(c.label)+': '+fmt(c.value)+'</title></circle>').join('')+
 coords.filter((_,i)=>i%Math.ceil(coords.length/6)===0||i===coords.length-1).map(c=>'<text x="'+c.x+'" y="'+(h-9)+'" fill="#a5b6cf" font-size="11" text-anchor="middle">'+esc(c.label)+'</text>').join('')+'</svg>';
}
function bars(points,unit=''){
 const max=Math.max(1,...points.map(x=>Number(x.value)||0));
 return '<div class="bi-bars">'+points.map(x=>'<div class="bi-bar-row"><small>'+esc(x.label)+'</small><div class="bi-bar-track"><i style="width:'+Math.max(0,Math.min(100,(Number(x.value)||0)/max*100)).toFixed(1)+'%"></i></div><b>'+fmt(x.value)+esc(unit)+'</b></div>').join('')+'</div>';
}
function ring(value,label){if(value===null)return empty('Sem registros suficientes para calcular o percentual.');
 const n=Math.max(0,Math.min(100,value));
 return '<div class="bi-ring" style="--bi-progress:'+n+'%"><span><strong>'+esc(pct(value))+'</strong><small>'+esc(label)+'</small></span></div>';
}
function card(title,body,caption=''){return '<article class="bi-graph"><h3>'+esc(title)+'</h3>'+body+(caption?'<p>'+esc(caption)+'</p>':'')+'</article>';}
function filters(){
 const companies=list().slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR'));
 const options=companies.map(c=>'<option value="'+esc(c.id)+'" '+(companyId===c.id?'selected':'')+'>'+esc((c.dominio?c.dominio+' · ':'')+c.name)+'</option>').join('');
 return '<div class="bi-filters"><label>Ano<select data-bi-filter="year">'+[year-2,year-1,year,year+1].filter(y=>y>=2020).map(y=>'<option value="'+y+'" '+(y===year?'selected':'')+'>'+y+'</option>').join('')+'</select></label>'+
 '<label>Competência<select data-bi-filter="month">'+Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'" '+(month===i+1?'selected':'')+'>'+String(i+1).padStart(2,'0')+'/'+year+'</option>').join('')+'</select></label>'+
 '<label>Empresa<select data-bi-filter="company"><option value="">Todas autorizadas</option>'+options+'</select></label>'+
 '<label>Localizar<input data-bi-filter="search" type="search" value="'+esc(query)+'" placeholder="Domínio, CNPJ ou nome"></label><button type="button" data-bi-reset>Limpar filtros</button></div>';
}
function visible(){const q=query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),digits=q.replace(/\D/g,'');
 return list().filter(c=>(!companyId||c.id===companyId)&&(!q||[c.name,c.fantasyName,c.cnpj,c.dominio].some(x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q))||(digits.length>0&&String(c.cnpj||'').replace(/\D/g,'').includes(digits))));}
const tracked=()=>window.ConciliaTrackingCore;
function data(){
 const companies=visible(),ctx={tracking:tracked()},records=companies.map(c=>M.record(c,period(),ctx.tracking));
 const agg=M.aggregate(records),series=M.months(year).map(p=>({period:p,...M.aggregate(companies.map(c=>M.record(c,p,ctx.tracking)))}));
 return {companies,records,agg,series};
}
function portfolio(d){
 const a=d.agg;
 return '<div class="bi-kpis">'+stat('Clientes da carteira',fmt(a.total),'Somente empresas autorizadas')+stat('Clientes ativos',fmt(a.active),'Situação cadastral atual')+
 stat('Inativos / distratados',fmt(a.inactive),'Fora da obrigação corrente','amber')+
 stat('Conciliações concluídas',fmt(a.concluded),fmt(a.applicable)+' aplicáveis')+
 stat('Documentos recebidos',fmt(a.documentReceived),fmt(a.documentEligible)+' obrigações com status')+
 stat('Entregas documentais',pct(a.documentRate),'Recebidos / exigíveis','cyan')+
 stat('Empresas cobradas',fmt(a.charged),'Contatos manuais registrados')+
 stat('Restantes',fmt(a.remaining),'Competência selecionada','amber')+'</div>'+
 '<div class="bi-graphs">'+
 card('Conciliações por competência',bars(d.series.map(x=>({label:x.period.slice(5),value:x.concluded}))),'Conclusões na competência, não data do clique')+
 card('Percentual de conclusão',ring(a.completion,'da carteira aplicável'),'Empresas concluídas ÷ empresas aplicáveis')+
 card('Recebimento documental mensal',spark(d.series.map(x=>({label:x.period.slice(5),value:x.documentReceived})),'Documentos recebidos mensalmente'),'Contagem por status documental da competência')+
 card('Tempo efetivo acumulado',spark(d.series.map(x=>({label:x.period.slice(5),value:x.seconds===null?null:Math.round(x.seconds/60)})),'Minutos trabalhados'),'Minutos confirmados nas conciliações concluídas, se registrados')+'</div>';
}
function company(d){
 const a=d.agg;
 const rank=d.records.slice().sort((x,y)=>y.movements-x.movements).slice(0,8);
 return '<div class="bi-kpis">'+stat('Empresas selecionadas',fmt(a.total),'Filtradas com permissão')+
 stat('Movimentações do mês',fmt(a.movements),'Dados operacionais disponíveis')+
 stat('Classificações confirmadas',fmt(a.classified),'Não equivale a conciliação')+
 stat('Pendências registradas',fmt(a.pending),'Indicador operacional','amber')+
 stat('Tempo efetivo',duration(a.seconds),'Trabalhos concluídos com medição')+
 stat('Média por conciliação',duration(a.averageSeconds),fmt(a.timed)+' sessões com tempo válido')+'</div>'+
 '<div class="bi-graphs">'+card('Movimentações por empresa',rank.length?bars(rank.map(r=>({label:(r.dominio||r.name).slice(0,20),value:r.movements}))):empty('Nenhuma empresa para comparar.'))+
 card('Movimentações por competência',spark(d.series.map(x=>({label:x.period.slice(5),value:x.movements})),'Movimentações mensais'),'Dados operacionais retidos no período')+
 card('Pendências por competência',spark(d.series.map(x=>({label:x.period.slice(5),value:x.pending})),'Pendências por competência'))+
 card('Tempo efetivo por mês',spark(d.series.map(x=>({label:x.period.slice(5),value:x.seconds===null?null:Math.round(x.seconds/60)})),'Tempo mensal'),'Minutos reais registrados; lacunas não são convertidas em zero')+'</div>';
}
function employee(d){
 const a=d.agg;
 return '<div class="bi-kpis">'+stat('Empresas sob acesso',fmt(a.total),'Conforme sua carteira')+
 stat('Concluídas',fmt(a.concluded),'Competência selecionada')+
 stat('Em andamento',fmt(a.inProgress),'Não inclui concluídas')+
 stat('Tempo registrado',duration(a.seconds),fmt(a.timed)+' conclusões com tempo')+
 stat('Tempo médio',duration(a.averageSeconds),'Somente registros com medição')+
 stat('Concluídas no prazo',a.onTimeTotal?fmt(a.onTime)+' / '+fmt(a.onTimeTotal):'Sem dados','Somente prazos registrados')+'</div>'+
 '<div class="bi-graphs">'+card('Evolução das conciliações',spark(d.series.map(x=>({label:x.period.slice(5),value:x.concluded})),'Conciliações por mês'))+
 card('Tempo efetivo mensal',spark(d.series.map(x=>({label:x.period.slice(5),value:x.seconds===null?null:Math.round(x.seconds/60)})),'Tempo efetivo por mês'))+
 card('Cumprimento de prazos',ring(a.onTimeRate,'no prazo'),'Não comparar produtividade exclusivamente por velocidade')+
 card('Conciliações por competência',bars(d.series.map(x=>({label:x.period.slice(5),value:x.concluded}))),'Esta visão usa atividades da carteira acessível, não compara funcionários sem autorização')+'</div>';
}
function technology(d){
 const a=d.agg;
 return '<div class="bi-kpis">'+stat('Classificações confirmadas',fmt(a.classified),'Base para taxas')+
 stat('Automação identificável',fmt(a.automated),'Origem registrada na classificação')+
 stat('Assistidas por Excel',fmt(a.excel),'Separadas da automação')+
 stat('Taxa de automação',pct(a.automaticRate),'Automáticas / confirmadas')+
 stat('Taxa assistida pelo Excel',pct(a.excelRate),'Excel / confirmadas')+
 stat('Regras aprendidas ativas',fmt(a.learnedRules),'Memória por empresa, não usos','cyan')+'</div>'+
 '<div class="bi-graphs">'+card('Origem das classificações',bars([{label:'Automática identificável',value:a.automated},{label:'Assistida por Excel',value:a.excel},{label:'Outras ou sem origem',value:a.manual}]),'Ausência de origem não é contabilizada como automação')+
 card('Evolução da automação',spark(d.series.map(x=>({label:x.period.slice(5),value:x.automaticRate})),'Taxa de automação'),'Percentual somente quando houver classificações no período')+
 card('Classificações assistidas pelo Excel',spark(d.series.map(x=>({label:x.period.slice(5),value:x.excel})),'Classificações via Excel'))+
 card('Participação automática',ring(a.automaticRate,'das classificações'),'Dados de origem disponíveis na competência')+'</div>';
}
const views={carteira:portfolio,empresa:company,funcionario:employee,tecnologia:technology};
function render(next){
 if(next)model=next;
 let root=$('#conciliaBI');if(!root||!model)return;
 if(!model.userId){root.textContent='Entre na conta para consultar seus indicadores.';return;}
 const d=data();
 root.innerHTML='<div class="bi-shell"><header class="bi-head"><div><span>CONCILIAR+ · INTELIGÊNCIA OPERACIONAL</span><h2>Dashboards integrados</h2><p>Indicadores derivados dos registros reais da sua carteira, sem alterar a conciliação.</p></div><small>Competência '+esc(period())+' · '+fmt(d.agg.total)+' empresas visíveis</small></header>'+
 '<div class="bi-tabs" role="tablist" aria-label="Perspectivas dos dashboards">'+[['carteira','Carteira de clientes'],['empresa','Operação das empresas'],['funcionario','Produtividade'],['tecnologia','Automação e aprendizagem']].map(([id,label])=>'<button type="button" role="tab" aria-selected="'+(tab===id)+'" data-bi-tab="'+id+'">'+label+'</button>').join('')+'</div>'+
 filters()+'<div class="bi-body" role="tabpanel">'+views[tab](d)+'</div><footer class="bi-foot">As estimativas não substituem medições. Dados não registrados aparecem como “Sem dados”. Indicadores sensíveis respeitam a carteira autorizada e o contexto da conta.</footer></div>';
}
function init(){const root=$('#conciliaBI');if(!root||initialized)return;initialized=true;
 root.addEventListener('click',e=>{const t=e.target.closest('[data-bi-tab]');if(t){tab=t.dataset.biTab;render();return;}if(e.target.closest('[data-bi-reset]')){year=new Date().getFullYear();month=new Date().getMonth()+1;companyId='';query='';render();}});
 root.addEventListener('change',e=>{const field=e.target.dataset.biFilter;if(field==='year')year=Number(e.target.value);if(field==='month')month=Number(e.target.value);if(field==='company')companyId=e.target.value;if(field)render();});
 root.addEventListener('input',e=>{if(e.target.dataset.biFilter!=='search')return;query=e.target.value;const pos=e.target.selectionStart;render();const input=root.querySelector('[data-bi-filter="search"]');input?.focus();input?.setSelectionRange(pos,pos);});
}
window.ConciliaBI={render,init};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
