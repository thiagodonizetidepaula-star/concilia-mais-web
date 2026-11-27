/* ConCiliar+ | Insights premium: leitura somente, sem alterar saldos ou regras. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
let activeBank='',granularity='week',detail='all',lastScope='',delegateReady=false;
const colors=['#22c8b4','#4b91f1','#a28aff','#f4b65c','#fb8297','#54bfd5'];
function collect(company,period){
 if(!company)return {moves:[],banks:[],map:new Map()};
 let moves=[];try{moves=window.ConciliaCore?.periodMovements(company,period)||[];}catch{}
 if(!Array.isArray(moves))moves=[];
 const accounts=new Map((company.accounts||[]).map(a=>[String(a.id),a]));
 const bankOf=m=>{const a=accounts.get(String(m.accountId));return String(a?.bank||a?.label||'Conta sem banco').trim()};
 const labels=[...new Set(moves.map(bankOf))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 return {moves,banks:labels,bankOf};
}
const pct=(a,b)=>b?Math.round(100*a/b):0;
function dataFor(company,period){
 const {moves,banks,bankOf}=collect(company,period);
 const scoped=moves.filter(m=>!activeBank||bankOf(m)===activeBank);
 const confirmed=scoped.filter(m=>m.status==='CONFIRMADO').length;
 const duplicates=scoped.filter(m=>m.status==='PENDENTE_DUPLICIDADE').length;
 const pending=Math.max(0,scoped.length-confirmed);
 const bankRows=banks.map(name=>({name,count:moves.filter(m=>bankOf(m)===name).length,confirmed:moves.filter(m=>bankOf(m)===name&&m.status==='CONFIRMADO').length}));
 const countDays=new Map();
 for(const m of scoped){if(!validDate(m.date))continue;const day=Number(m.date.slice(8,10));const index=granularity==='week'?Math.floor((day-1)/7):day-1;countDays.set(index,(countDays.get(index)||0)+1);}
 const days=Number(period?.slice(5,7)),year=Number(period?.slice(0,4));
 const monthDays=year&&days?new Date(year,days,0).getDate():31;
 const numberOfBins=granularity==='week'?Math.ceil(monthDays/7):monthDays;
 const series=Array.from({length:numberOfBins},(_,i)=>({label:granularity==='week'?String(i*7+1)+'–'+String(Math.min(monthDays,(i+1)*7)):String(i+1),count:countDays.get(i)||0}));
 return {scoped,confirmed,duplicates,pending,bankRows,series,total:scoped.length,allTotal:moves.length};
}
function timeline(rows){
 const w=630,h=206,l=37,r=13,t=18,b=39,chartW=w-l-r,chartH=h-t-b,max=Math.max(1,...rows.map(x=>x.count));
 const points=rows.map((d,i)=>({x:l+(rows.length===1?chartW/2:i*chartW/(rows.length-1)),y:t+chartH-(d.count/max)*chartH,...d}));
 const poly=points.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ');
 const grid=Array.from({length:4},(_,i)=>{const yy=t+i*chartH/3;return '<line x1="'+l+'" x2="'+(w-r)+'" y1="'+yy+'" y2="'+yy+'" stroke="#dce9f4" stroke-dasharray="4 7"/><text x="'+(l-8)+'" y="'+(yy+4)+'" text-anchor="end" fill="#758ba1" font-size="11">'+Math.round(max*(1-i/3))+'</text>';}).join('');
 const area=points.length?'<polygon points="'+l+','+(h-b)+' '+poly+' '+(w-r)+','+(h-b)+'" fill="url(#insightsFill)" />':'';
 const path=points.length?'<polyline points="'+poly+'" fill="none" stroke="#257cdf" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>':'';
 const circles=points.map(p=>'<g><circle cx="'+p.x+'" cy="'+p.y+'" r="'+(rows.length>12?3:5)+'" fill="#fff" stroke="#257cdf" stroke-width="2.5"><title>'+esc(p.label)+': '+p.count+' lançamentos</title></circle></g>').join('');
 const labels=points.filter((_,i)=>rows.length<=8||i%Math.ceil(rows.length/9)===0||i===rows.length-1).map(p=>'<text x="'+p.x+'" y="'+(h-15)+'" font-size="11" fill="#71869c" text-anchor="middle">'+esc(p.label)+'</text>').join('');
 return '<svg class="insights-line" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Evolução do volume de lançamentos no período"><defs><linearGradient id="insightsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#76c6ff" stop-opacity=".35"/><stop offset="1" stop-color="#76c6ff" stop-opacity=".025"/></linearGradient></defs>'+grid+area+path+circles+labels+'</svg>';
}
function render({company,period,elapsedSeconds}={}){
 const root=$('#prodInsights');if(!root)return;
 const scope=String(company?.id||'')+'|'+String(period||'');
 if(scope!==lastScope){activeBank='';granularity='week';detail='all';lastScope=scope;}
 const data=dataFor(company,period);
 const portion=pct(data.confirmed,data.total),maxBank=Math.max(1,...data.bankRows.map(b=>b.count));
 const bankHtml=data.bankRows.map((b,i)=>'<button class="insights-bank '+(activeBank===b.name?'selected':'')+'" type="button" data-insight-bank="'+esc(b.name)+'" aria-pressed="'+(activeBank===b.name)+'" title="'+esc(b.name)+' — '+b.count+' lançamentos"><span class="insights-bank-name"><i style="background:'+colors[i%colors.length]+'"></i>'+esc(b.name)+'</span><span class="insights-bank-meter"><span style="width:'+pct(b.count,maxBank)+'%;background:'+colors[i%colors.length]+'"></span></span><strong>'+b.count+'</strong></button>').join('');
 const statusHtml=[{id:'confirmed',label:'Confirmados',count:data.confirmed,color:'#13b69f'},{id:'pending',label:'Pendentes',count:data.pending,color:'#efab52'},{id:'duplicates',label:'Possíveis duplicados',count:data.duplicates,color:'#e67789'}].map(s=>'<button type="button" class="insights-legend '+(detail===s.id?'selected':'')+'" data-insight-detail="'+s.id+'" aria-pressed="'+(detail===s.id)+'"><span class="insights-color" style="background:'+s.color+'"></span><span>'+s.label+'</span><strong>'+s.count+'</strong></button>').join('');
 const message=detail==='confirmed'?data.confirmed+' lançamentos confirmados na seleção.':detail==='duplicates'?data.duplicates+' lançamentos com suspeita de duplicidade na seleção.':detail==='pending'?data.pending+' lançamentos ainda não confirmados na seleção.':data.total+' lançamentos no recorte selecionado.';
 root.innerHTML='<section class="insights-shell" aria-label="Painel de gráficos interativos"><header class="insights-top"><div><div class="insights-kicker"><span class="insights-dot"></span> VISÃO ANALÍTICA</div><h3>Indicadores em tempo real <span>↗</span></h3><p>Visualizações geradas com os lançamentos da competência selecionada.</p></div><div class="insights-filters"><label for="insightsBankFilter">Banco<select id="insightsBankFilter"><option value="">Todos os bancos</option>'+data.bankRows.map(b=>'<option value="'+esc(b.name)+'" '+(activeBank===b.name?'selected':'')+'>'+esc(b.name)+'</option>').join('')+'</select></label><button type="button" class="insights-clear" data-insight-clear '+(!activeBank?'disabled':'')+'>Limpar filtros</button></div></header>'+
 '<div class="insights-mini"><div><small>LANÇAMENTOS NO RECORTE</small><strong>'+data.total.toLocaleString('pt-BR')+'</strong><span>de '+data.allTotal.toLocaleString('pt-BR')+' na competência</span></div><div><small>CLASSIFICAÇÃO CONFIRMADA</small><strong>'+portion+'%</strong><span>'+data.confirmed+' lançamentos</span></div><div><small>PENDÊNCIAS DE CLASSIFICAÇÃO</small><strong>'+data.pending+'</strong><span>inclui possíveis duplicidades</span></div></div>'+
 '<div class="insights-layout"><article class="insights-chart insights-trend"><div class="insights-chart-head"><div><h4>Movimentações no período</h4><p>Distribuição de lançamentos por dia ou semana</p></div><div class="insights-tabs" role="group" aria-label="Agrupar movimentações"><button data-insight-granularity="week" aria-pressed="'+(granularity==='week')+'" class="'+(granularity==='week'?'selected':'')+'">Semanas</button><button data-insight-granularity="day" aria-pressed="'+(granularity==='day')+'" class="'+(granularity==='day'?'selected':'')+'">Dias</button></div></div>'+timeline(data.series)+'</article>'+
 '<article class="insights-chart insights-status"><div class="insights-chart-head"><div><h4>Situação das classificações</h4><p>Progresso de confirmação</p></div></div><div class="insights-donut-wrap"><div class="insights-donut" role="img" aria-label="'+portion+' por cento dos lançamentos estão confirmados" style="--donut:'+portion+'%"><div><strong>'+portion+'%</strong><small>confirmados</small></div></div></div><div class="insights-legends">'+statusHtml+'</div><p class="insights-detail" role="status">'+esc(message)+'</p></article></div>'+
 '<article class="insights-chart insights-banks"><div class="insights-chart-head"><div><h4>Volume por banco</h4><p>Selecione um banco para filtrar os gráficos.</p></div><span class="insights-banks-pill">'+data.bankRows.length+' banco(s)</span></div><div class="insights-bank-list">'+(bankHtml||'<p class="insights-blank">Nenhum lançamento para esta competência.</p>')+'</div></article>'+
 '<p class="insights-note">Dados calculados no navegador com os extratos carregados. Classificação confirmada não significa conciliação final validada com o Razão. Nenhum lançamento ou código contábil é alterado pelos gráficos.</p></section>';
 if(!delegateReady){delegateReady=true;const panel=$('#productivityPanel');panel?.addEventListener('click',event=>{
 const b=event.target.closest('[data-insight-bank],[data-insight-clear],[data-insight-granularity],[data-insight-detail]');if(!b)return;
 if(b.hasAttribute('data-insight-bank'))activeBank=activeBank===b.dataset.insightBank?'':b.dataset.insightBank;
 if(b.hasAttribute('data-insight-clear'))activeBank='';
 if(b.hasAttribute('data-insight-granularity'))granularity=b.dataset.insightGranularity==='day'?'day':'week';
 if(b.hasAttribute('data-insight-detail'))detail=b.dataset.insightDetail;
 redraw();
 });panel?.addEventListener('change',event=>{if(event.target.id==='insightsBankFilter'){activeBank=event.target.value;redraw();}});
 }
}
function redraw(){if(typeof current!=='function'||typeof period==='undefined')return;render({company:current(),period});}
window.ConciliaInsights={render};
})();