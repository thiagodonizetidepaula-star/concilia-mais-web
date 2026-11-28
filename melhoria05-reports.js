/* Relatórios ConCiliar+PLUS 05 — critérios documentados, sem JSON bruto e sem rede externa.
   PDF: janela de impressão nativa (Salvar como PDF); Excel: biblioteca XLSX já carregada. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.Concilia05Reports=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const num=x=>x===null||x===undefined?'Sem dados':typeof x==='number'?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(x):String(x);
const arr=x=>Array.isArray(x)?x:[];
const round=x=>Number.isFinite(x)?Math.round(x*100)/100:null;
function build({filter,state,companies,owner,analytics:A,B,tracking},anonymous=false){
 if(!owner||!A||!B)throw Error('Conta autenticada e módulos de BI necessários');
 const cs=B.authorized(companies,owner).filter(c=>!filter.companyId||c.id===filter.companyId),ids=new Set(cs.map(c=>c.id));
 const allowed=r=>r?.ownerId===owner&&(!r.companyId||ids.has(r.companyId));
 const scoped=k=>A.filterRows(arr(state[k]).filter(allowed),{...filter,ownerId:owner});
 const op=A.operational(cs,owner,B,filter,tracking),sum=op.summary;
 const activities=scoped('activities'),quality=scoped('quality'),goals=scoped('goals'),rules=scoped('ruleEvents'),competencies=scoped('competencies');
 const qs=A.quality(quality,filter),work=A.sessions(activities,filter),learning=A.learning(rules,filter);
 const status=(name,x,unit='')=>({Indicador:name,Valor:x===null||x===undefined?'Sem dados':x,Unidade:unit,Fonte:'Dados filtrados e confirmados'});
 const indicators=[
 status('Empresas autorizadas',sum.totalCompanies,'empresas'),
 status('Conciliações concluídas',sum.concluded,'competências'),
 status('Conciliações restantes',sum.remaining,'competências'),
 status('Movimentações',sum.movements,'movimentos'),
 status('Classificações confirmadas',sum.classified,'movimentos'),
 status('Classificações automáticas identificáveis',sum.automated,'movimentos'),
 status('Classificações assistidas via Excel',sum.excel,'movimentos'),
 status('Taxa de automação',sum.automaticRate,'%'),
 status('Documentos recebidos',sum.documentReceived,'registros'),
 status('Atividades concluídas registradas',work.activities,'atividades'),
 status('Tempo efetivo registrado',work.effectiveSeconds,'segundos'),
 status('Pausas registradas',work.pauseSeconds,'segundos'),
 status('Espera registrada',work.waitSeconds,'segundos'),
 status('Movimentos por hora medida',work.movementsPerHour,'mov/h'),
 status('Ocorrências de qualidade',qs.total,'ocorrências'),
 status('Aprovação na primeira revisão',qs.firstReviewRate,'%'),
 status('Taxa de retrabalho',qs.reworkRate,'%'),
 status('Utilizações auditadas de regras',learning.uses,'eventos'),
 status('Aproveitamento de usos confirmados',learning.confirmationRate,'%')
 ];
 const companyRows=anonymous?[]:cs.map(c=>{
  const r=A.operational([c],owner,B,filter,tracking).summary;
  const doc=filter.period?B.record(c,filter.period,tracking).documentStatus||'Sem dados':'Varia por competência';
  return {Empresa:c.name||'Empresa',CodigoDominio:c.dominio||'',CNPJ:c.cnpj||'',
   Movimentos:r.movements,Confirmadas:r.classified,Automaticas:r.automated,Excel:r.excel,
   TempoSegundos:r.seconds??'Sem medição',Documentos:doc};
 });
 const goalsRows=goals.map(g=>{const x=A.goalProgress(g,cs,owner,B,tracking);
  return {Meta:anonymous?'Meta profissional':g.title,Competencia:x.period||g.period||'Sem competência',Empresa:anonymous?'Protegida':g.companyId||'Carteira',Indicador:anonymous?'Indicador interno':g.metric,ValorAtual:x.actual??'Sem medição',Alvo:g.target,Progresso:x.progress??'Sem dados',Situacao:g.status,Origem:x.source};});
 const qualityRows=quality.map(r=>({Ocorrencia:anonymous?'Ocorrência pessoal':r.title,Competencia:r.period||'',
  Empresa:anonymous?'Protegida':r.companyId,Revisao:r.reviewStatus||'Sem revisão',PrimeiraRevisao:r.firstReviewOutcome||'Não avaliada',
  Causa:anonymous?'Confidencial':r.cause||'Não identificada',Acao:anonymous?'Confidencial':r.correctiveAction||'Não informada',Status:r.status,Data:r.createdAt?.slice(0,10)||''}));
 const activityRows=activities.map(r=>({Atividade:anonymous?'Atividade profissional':r.activityType||r.title,Execucao:r.executionAt||'',
  Competencia:r.period||'',Empresa:anonymous?'Protegida':r.companyId,TempoEfetivo:r.effectiveSeconds??'Não medido',
  Pausa:r.pauseSeconds??'Não medida',Espera:r.waitSeconds??'Não medida',Retrabalho:r.reworkSeconds??'Não medido',Movimentacoes:r.movements??'Não registradas'}));
 const learningRows=rules.map(r=>({Empresa:anonymous?'Protegida':r.companyId,Competencia:r.period,Data:r.executionAt,
  Regra:anonymous?'Regra registrada':r.ruleId,Evento:r.event,Confirmado:r.confirmed?'Sim':'Não'}));
 const professionalRows=competencies.map(r=>({Competencia:anonymous?'Competência autoavaliada':r.title,Nivel:r.level||'Não avaliado',
  Evidencia:anonymous?'Não divulgada':r.evidence||'Sem evidência registrada'}));
 const periodDescription=(op.from||'')+' a '+(op.to||'')+'; competência: '+(filter.period||'todas no intervalo');
 const criteria=[
  {Indicador:'Taxa de automação',Formula:'Classificações automáticas confirmadas / classificações confirmadas x 100',
   Limitação:'Excel colado, sugestões e origem desconhecida não contam como descobertas automáticas.'},
  {Indicador:'Tempo efetivo',Formula:'Somente duração de atividades manualmente registradas com identificador único',
   Limitação:'Não somar automaticamente cronômetro manual e Controle 04.'},
  {Indicador:'Taxa de aprovação na primeira revisão',Formula:'Aprovadas na primeira revisão / total com primeira revisão registrada x 100',
   Limitação:'Sem revisão não equivale a aprovação.'},
  {Indicador:'Taxa de retrabalho',Formula:'Ocorrências devolvidas ao menos uma vez / ocorrências com primeira revisão x 100',
   Limitação:'Não inferir erro do funcionário a partir de devolução.'},
  {Indicador:'Metas',Formula:'(Valor atual da própria empresa e competência - base) / (alvo - base) x 100, limitado entre 0 e 100',
   Limitação:'Dados de outro período não substituem a fonte específica de uma meta.'},
  {Indicador:'Operacional diário',Formula:'Somente eventos com data explícita no intervalo selecionado',
   Limitação:'Volumes mensais não são alocados retroativamente a dias sem registros.'}
 ];
 const trend=A.groupByMonths(activityRows.map(r=>({executionAt:r.Execucao})),filter.year||new Date().getFullYear());
 return {
  title:anonymous?'Relatório profissional anonimizado':'Relatório gerencial ConCiliar+PLUS',
  generatedAt:new Date().toISOString(),periodDescription,filter:anonymous?{range:filter.range,month:filter.month,year:filter.year,period:filter.period,status:filter.status}:{...filter,ownerId:'Usuário autenticado'},
  anonymous,criteria,notes:[op.note,'Indicadores de tempo só usam medições válidas. Dados ausentes são indisponíveis.','Valores operacionais não representam lucro, remuneração ou avaliação profissional conclusiva.'],
  sheets:[
   {name:'Indicadores',rows:indicators},
   {name:'Empresas',rows:companyRows},
   {name:'Produtividade',rows:activityRows},
   {name:'Qualidade',rows:qualityRows},
   {name:'Metas',rows:goalsRows},
   {name:'Automacao',rows:learningRows},
   {name:'Desenvolvimento',rows:professionalRows},
   {name:'Tendencia Mensal',rows:trend.map(x=>({Competencia:x.period,Atividades:x.count}))},
   {name:'Metodologia',rows:criteria},
   {name:'Limitações',rows:[...op.note?[{Observacao:op.note}]:[],{Observacao:'Nenhum dado inexistente foi estimado como real.'}]}
  ]
 };
}
function excel(book){
 if(typeof window==='undefined'||!window.XLSX)throw Error('Biblioteca XLSX indisponível');
 const x=window.XLSX,w=x.utils.book_new();
 for(const sheet of book.sheets){
  const rows=sheet.rows.length?sheet.rows:[{Mensagem:'Sem registros no filtro'}];
  const ws=x.utils.json_to_sheet(rows);
  const names=Object.keys(rows[0]||{});
  ws['!cols']=names.map(k=>({wch:Math.max(14,Math.min(55,k.length+8))}));
  if(rows.length>0){ws['!autofilter']={ref:ws['!ref']};}
  x.utils.book_append_sheet(w,ws,sheet.name.slice(0,31));
 }
 const meta=x.utils.aoa_to_sheet([['ConCiliar+PLUS / Relatório'],['Produto','Software de automação e conciliação contábil'],['Titularidade','BEATRIZ CRISSILA'],['Ambiente','Romeiro Soluções Empresariais'],['Gerado em',book.generatedAt],['Período',book.periodDescription],['Anonimizado',book.anonymous?'SIM':'NÃO']]);
 x.utils.book_append_sheet(w,meta,'Capa');
 x.writeFile(w,book.anonymous?'ConCiliar_Portfolio_Anonimizado.xlsx':'ConCiliar_Relatorio_Gerencial.xlsx');
 return {sheets:w.SheetNames.length};
}
function html(book){
 const rows=(list,limit=40)=>list.length?'<table><thead><tr>'+Object.keys(list[0]).map(k=>'<th>'+esc(k)+'</th>').join('')+'</tr></thead><tbody>'+
 list.slice(0,limit).map(r=>'<tr>'+Object.values(r).map(v=>'<td>'+esc(num(v))+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<p class="empty">Sem registros para esta seleção.</p>';
 const inds=book.sheets.find(x=>x.name==='Indicadores').rows;
 const boxes=inds.slice(0,8).map(x=>'<div class="kpi"><small>'+esc(x.Indicador)+'</small><strong>'+esc(num(x.Valor))+'</strong><span>'+esc(x.Unidade)+'</span></div>').join('');
 const trends=book.sheets.find(x=>x.name==='Tendencia Mensal').rows,max=Math.max(1,...trends.map(x=>x.Atividades));
 const chart='<div class="chart">'+trends.map(x=>'<div><small>'+esc(x.Competencia.slice(5))+'</small><i style="height:'+Math.round(x.Atividades/max*100)+'%"></i><b>'+x.Atividades+'</b></div>').join('')+'</div>';
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>'+esc(book.title)+'</title><style>'+
 '@page{size:A4;margin:13mm}*{box-sizing:border-box}body{font:10px Arial,Helvetica,sans-serif;color:#192b46;margin:0}'+
 'header{background:#080f20;color:#fff;padding:21px 24px;border-bottom:5px solid #20cee6}header span{color:#20cee6;letter-spacing:1px;font-size:9px;font-weight:bold}header h1{font-size:20px;margin:5px 0}header p{color:#b5c6dc;margin:3px 0}'+
 'main{padding:10px 0}.section{margin:20px 0;break-inside:avoid}.section h2{color:#0c2952;border-bottom:2px solid #20cee6;padding:0 0 7px;font-size:14px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.kpi{border:1px solid #d1ddeb;border-radius:7px;padding:9px;background:#f4f8fd}.kpi small{display:block;color:#647b97;font-size:8px}.kpi strong{display:block;color:#087ca2;font-size:17px;margin:6px 0}.kpi span{color:#6c7c8e;font-size:8px}'+
 'table{border-collapse:collapse;width:100%;font-size:8px}th{background:#172d4f;color:#fff;text-align:left}td,th{padding:7px 5px;border-bottom:1px solid #dce5f0;overflow-wrap:anywhere}tr:nth-child(even){background:#f5f9fd}.empty{color:#61748e}'+
 '.chart{height:130px;display:flex;gap:6px;align-items:end;border-bottom:1px solid #7088aa;padding:12px 3px}.chart div{height:100%;width:8%;display:flex;flex-direction:column;align-items:center;justify-content:end;gap:3px}.chart i{width:60%;min-height:1px;background:linear-gradient(0deg,#238dc0,#20cee6);border-radius:2px}.chart small,.chart b{font-size:7px;color:#29405e}.note{font-size:8px;line-height:1.6;color:#536988}footer{margin-top:26px;border-top:1px solid #c8d7e8;padding:12px;color:#607493;font-size:8px}'+
 '@media print{.section{page-break-inside:avoid}}'+
 '</style></head><body><header><span>CONCILIAR+PLUS · SOFTWARE DE AUTOMAÇÃO E CONCILIAÇÃO CONTÁBIL</span><h1>'+esc(book.title)+'</h1><p>Produto independente — titularidade BEATRIZ CRISSILA · Ambiente de uso: Romeiro Soluções Empresariais</p><p>Período: '+esc(book.periodDescription)+'</p><p>Emissão: '+esc(new Date(book.generatedAt).toLocaleString('pt-BR'))+'</p></header><main>'+
 '<section class="section"><h2>Indicadores principais</h2><div class="kpis">'+boxes+'</div></section>'+
 '<section class="section"><h2>Histórico de atividades registradas</h2>'+chart+'</section>'+
 book.sheets.filter(x=>!['Indicadores','Tendencia Mensal','Limitações'].includes(x.name)).map(x=>'<section class="section"><h2>'+esc(x.name)+'</h2>'+rows(x.rows)+'</section>').join('')+
 '<section class="section"><h2>Notas e limitações</h2>'+book.notes.map(x=>'<p class="note">'+esc(x)+'</p>').join('')+'</section></main>'+
 '<footer>ConCiliar+PLUS · Titularidade BEATRIZ CRISSILA · Ambiente: Romeiro Soluções Empresariais · Material '+(book.anonymous?'anonimizado para análise pessoal':'restrito à conta autorizada')+' · Não substitui verificação contábil do Domínio.</footer></body></html>';
}
function printPDF(book){
 if(typeof window==='undefined')throw Error('A impressão PDF só está disponível no navegador');
 const frame=document.createElement('iframe');frame.style.position='fixed';frame.style.left='-99999px';frame.style.width='1px';frame.style.height='1px';
 frame.setAttribute('title','Relatório de impressão ConCiliar+PLUS');document.body.appendChild(frame);
 const doc=frame.contentDocument;doc.open();doc.write(html(book));doc.close();
 const win=frame.contentWindow;win.focus();win.print();
 setTimeout(()=>frame.remove(),30000);return {method:'Imprimir / Salvar como PDF'};
}
async function exportReport(type,context){
 const book=build(context,type==='anon');
 if(type==='xlsx')return excel(book);
 if(type==='pdf'||type==='anon')return printPDF(book);
 throw Error('Formato não autorizado');
}
return {build,excel,html,printPDF,export:exportReport};
});
