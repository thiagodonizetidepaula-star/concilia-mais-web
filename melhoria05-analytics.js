/* Melhoria 05 — analytics v2: funções puras, filtros por execução e competência,
   métricas auditáveis sem séries inventadas ou informações de outra conta. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.Concilia05Analytics=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const arr=x=>Array.isArray(x)?x:[];
const finite=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:null;
const pct=(n,d)=>d>0?Math.round(n/d*1000)/10:null;
const day=x=>/^20\d\d-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(x||'')&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const month=x=>/^20\d\d-(0[1-9]|1[0-2])$/.test(x||'');
const date=x=>String(x||'').slice(0,10);
const iso=(x)=>new Date(x+'T00:00:00Z');
const add=(x,n)=>new Date(iso(x).getTime()+n*86400000).toISOString().slice(0,10);
const startOfWeek=x=>add(x,-((iso(x).getUTCDay()+6)%7));
function bounds(filter={}){
 const f=filter||{},type=f.range||'month',anchor=day(f.day)?f.day:day(f.start)?f.start:new Date().toISOString().slice(0,10);
 let from,to;
 if(type==='day'){from=anchor;to=anchor;}
 else if(type==='week'){from=startOfWeek(anchor);to=add(from,6);}
 else if(type==='month'){const m=month(f.month)?f.month:anchor.slice(0,7);from=m+'-01';to=add((Number(m.slice(0,4))+(m.endsWith('-12')?1:0))+'-'+(m.endsWith('-12')?'01':String(Number(m.slice(5))+1).padStart(2,'0'))+'-01',-1);}
 else if(type==='quarter'||type==='semester'){const y=Number(f.year)||Number(anchor.slice(0,4)),q=type==='quarter'?3:6,idx=Math.floor((Number(anchor.slice(5,7))-1)/q),m=idx*q+1;from=y+'-'+String(m).padStart(2,'0')+'-01';const endMonth=m+q;to=add((y+(endMonth>12?1:0))+'-'+String(endMonth>12?endMonth-12:endMonth).padStart(2,'0')+'-01',-1);}
 else if(type==='year'){const y=Number(f.year)||Number(anchor.slice(0,4));from=y+'-01-01';to=y+'-12-31';}
 else if(type==='custom'){if(!day(f.start)||!day(f.end)||f.start>f.end)throw Error('Período personalizado inválido');from=f.start;to=f.end;}
 else throw Error('Filtro temporal desconhecido');
 return {from,to,range:type};
}
function included(record,filter={},options={}){
 const r=record||{},f=filter||{};
 if(f.companyId&&r.companyId!==f.companyId)return false;
 if(f.ownerId&&r.ownerId!==f.ownerId&&r.userId!==f.ownerId)return false;
 if(f.status&&f.status!=='all'&&r.status!==f.status)return false;
 if(f.activityType&&f.activityType!=='all'&&r.activityType!==f.activityType)return false;
 if(f.period&&r.period!==f.period)return false;
 if(options.onlyCompetence)return true;
 const b=bounds(f),d=date(r.executionAt||r.finishedAt||r.date||r.createdAt||'');
 return day(d)&&d>=b.from&&d<=b.to;
}
function filterRows(records,filter,options){return arr(records).filter(x=>included(x,filter,options));}
function sumMinutes(r){const work=finite(r.effectiveSeconds),pause=finite(r.pauseSeconds),waiting=finite(r.waitSeconds),rework=finite(r.reworkSeconds);
 return {work,pause,waiting,rework,elapsed:finite(r.elapsedSeconds)};
}
function sessions(records,filter={}){
 const filtered=filterRows(records,filter).filter(r=>r.finishedAt||r.status==='Concluída');
 const seen=new Set();let effective=0,paused=0,waiting=0,measured=0,movements=0;
 const byType={};
 for(const r of filtered){
  const id=r.id||[r.ownerId,r.companyId,r.startedAt,r.finishedAt,r.activityType].join('::');
  if(seen.has(id))continue;seen.add(id);
  const t=sumMinutes(r);
  if(t.work!==null){effective+=t.work;measured++;}
  paused+=t.pause??0;waiting+=t.waiting??0;movements+=finite(r.movements)??0;
  const type=r.activityType||'Não categorizada',row=byType[type]||{seconds:0,count:0};
  row.count++;row.seconds+=t.work??0;byType[type]=row;
 }
 return {activities:seen.size,measured,effectiveSeconds:measured?effective:null,
  pauseSeconds:paused,waitSeconds:waiting,movements,
  movementsPerHour:effective>0&&measured?Math.round(movements/(effective/3600)*10)/10:null,
  byType:Object.entries(byType).map(([name,value])=>({name,...value}))};
}
const transitions={
 'Executada':['Aguardando revisão'],
 'Aguardando revisão':['Em revisão'],
 'Em revisão':['Aprovada','Devolvida'],
 'Devolvida':['Correção realizada'],
 'Correção realizada':['Nova revisão'],
 'Nova revisão':['Aprovada','Devolvida'],
 'Aprovada':[]
};
function reviewTransition(record,target,actorId,now=new Date(),reason=''){
 if(!actorId||record?.ownerId!==actorId)throw Error('Revisão não autorizada');
 const from=record.reviewStatus||'Executada';
 if(!arr(transitions[from]).includes(target))throw Error('Transição de revisão inválida: '+from+' → '+target);
 const at=now.toISOString(),event={id:typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():at+'-'+actorId,
  at,from,to:target,actorId,reason:String(reason).slice(0,1200)};
 return {...record,reviewStatus:target,updatedAt:at,
  firstReviewOutcome:from==='Em revisão'&&!record.firstReviewOutcome?target:record.firstReviewOutcome||null,
  reviewEvents:[...arr(record.reviewEvents),event],
  audit:[...arr(record.audit),{at,actorId,action:'review',from,to:target,reason:event.reason}]};
}
function quality(records,filter={}){
 const all=filterRows(records,filter),reviewed=all.filter(r=>r.firstReviewOutcome);
 const approved=reviewed.filter(r=>r.firstReviewOutcome==='Aprovada');
 const withRework=all.filter(r=>arr(r.reviewEvents).some(e=>e.to==='Devolvida'));
 const resolved=all.filter(r=>r.reviewStatus==='Aprovada');
 return {total:all.length,reviewed:reviewed.length,approvedFirst:approved.length,firstReviewRate:pct(approved.length,reviewed.length),
  rework:withRework.length,reworkRate:pct(withRework.length,reviewed.length),
  approved:resolved.length,awaiting:all.filter(r=>r.reviewStatus==='Aguardando revisão').length,
  returned:all.filter(r=>r.reviewStatus==='Devolvida').length,
  byCause:Object.entries(all.reduce((a,r)=>{const c=r.cause||'Causa não identificada';a[c]=(a[c]||0)+1;return a;},{})).map(([name,value])=>({name,value}))};
}
function metricAtGoal(goal,companies,userId,B,tracking){
 if(!B||!userId)return {value:null,source:'indisponível'};
 let rows=B.authorized(companies,userId);
 if(goal.companyId){rows=rows.filter(c=>c.id===goal.companyId);if(!rows.length)return {value:null,source:'empresa não autorizada'};}
 const supported=new Set(['concluded','movements','classified','documentReceived','charges','automated','excel','pending','learnedRules']);
 if(!supported.has(goal.metric))return {value:null,source:'métrica não disponível'};
 const frequency=goal.frequency||'month',period=month(goal.period)?goal.period:day(goal.start)?goal.start.slice(0,7):day(goal.deadline)?goal.deadline.slice(0,7):null;
 if(!period)return {value:null,source:'sem período definido'};
 if(goal.start&&goal.deadline&&goal.start>goal.deadline)return {value:null,source:'período inválido'};
 if(frequency==='month'){
  const r=B.summarize(rows,userId,period,{tracking}).summary;
  return {value:finite(r[goal.metric]),source:'indicador '+period,period};
 }
 const from=day(goal.start)?goal.start:period+'-01',to=day(goal.deadline)?goal.deadline:from;
 const eligibleDays=frequency==='year'?{range:'year',year:Number(from.slice(0,4)),day:from}:
 frequency==='quarter'||frequency==='semester'?{range:frequency,year:Number(from.slice(0,4)),day:from}:
 frequency==='week'?{range:'week',day:from}:frequency==='day'?{range:'day',day:from}:
 {range:'custom',start:from,end:to};
 // Não converter obrigações mensais em métricas diárias quando não há data do evento.
 if(['documentReceived','charges','pending','learnedRules'].includes(goal.metric)&&['day','week','custom'].includes(frequency))
  return {value:null,source:'sem granularidade diária auditável',period};
 const r=operational(rows,userId,B,eligibleDays,tracking).summary;
 return {value:finite(r[goal.metric]),source:'indicador '+frequency+' '+from+'…'+to,period};
}
function goalProgress(goal,companies,userId,B,tracking){
 const actual=metricAtGoal(goal,companies,userId,B,tracking);
 const manually=finite(goal.manualActual);
 const value=actual.value!==null?actual.value:manually;
 if(value===null)return {actual:null,progress:null,source:'Sem medição',period:actual.period||goal.period||null};
 const initial=finite(goal.baseline),target=finite(goal.target);
 if(initial===null||target===null||initial===target)return {actual:value,progress:null,source:'meta inconsistente'};
 const progress=Math.max(0,Math.min(100,Math.round((value-initial)/(target-initial)*1000)/10));
 return {actual:value,progress,source:actual.value!==null?actual.source:'manual auditável',period:actual.period||goal.period||null};
}
function businessDays(start,end,off=[]){
 if(!day(start)||!day(end)||start>end)throw Error('Calendário inválido');
 if((iso(end)-iso(start))/86400000>3660)throw Error('Calendário excede 10 anos');
 const offSet=new Set(arr(off));let result=0;for(let d=start;d<=end;d=add(d,1)){
  const w=iso(d).getUTCDay();if(w!==0&&w!==6&&!offSet.has(d))result++;
 }return result;
}
function planning(remaining,calendar,averageSeconds=null){
 const now=date(calendar?.from)||new Date().toISOString().slice(0,10),deadline=date(calendar?.deadline);
 const days=day(deadline)?businessDays(now,deadline,calendar?.daysOff):null;
 const availability=finite(calendar?.dailyHours);
 const average=finite(averageSeconds);
 return {days,remaining,
  perDay:days&&finite(remaining)!==null?Math.ceil(remaining/days*10)/10:null,
  estimatedHours:average!==null&&finite(remaining)!==null?Math.round(remaining*average/3600*10)/10:null,
  capacity:days&&availability!==null&&average>0?Math.floor(days*availability*3600/average):null,
  risk:days===0&&remaining>0?'Prazo sem dias úteis':null};
}
function learning(events,filter={}){
 const list=filterRows(events,filter);
 const used=list.filter(r=>r.event==='used'),confirmed=used.filter(r=>r.confirmed===true),corrected=list.filter(r=>r.event==='corrected');
 return {recorded:list.length,uses:used.length,confirmed:confirmed.length,confirmationRate:pct(confirmed.length,used.length),corrections:corrected.length,
  byCompany:Object.entries(list.reduce((out,r)=>{out[r.companyId||'sem empresa']=(out[r.companyId||'sem empresa']||0)+1;return out;},{})).map(([companyId,count])=>({companyId,count}))};
}
function savings(manual,auto){
 const m=arr(manual),a=arr(auto),valid=r=>finite(r.seconds)!==null&&finite(r.movements)>0&&r.complexityClass;
 const mb=m.filter(valid),ab=a.filter(valid),pairs=[];
 for(const complexity of new Set([...mb,...ab].map(r=>r.complexityClass))){
  const x=mb.filter(r=>r.complexityClass===complexity),y=ab.filter(r=>r.complexityClass===complexity);
  if(!x.length||!y.length)continue;
  const average=z=>z.reduce((s,r)=>s+r.seconds/r.movements,0)/z.length;
  const manualSec=average(x),autoSec=average(y);
  pairs.push({complexity,manualSecondsPerMovement:manualSec,autoSecondsPerMovement:autoSec,
   savedPerMovement:manualSec-autoSec,manualSamples:x.length,automaticSamples:y.length});
 }
 return {pairs,measured:pairs.length>0,disclaimer:'Comparação observacional por complexidade; não é causalidade comprovada.'};
}
function learningFromCompanies(companies,userId,B,filter={}){
 if(!B)return {suggested:0,confirmed:0,corrected:0,byCompany:[]};
 const cs=B.authorized(companies,userId).filter(c=>!filter.companyId||c.id===filter.companyId);
 let suggested=0,confirmed=0,corrected=0;const rows=[];
 const b=bounds(filter);
 for(const c of cs){
  let uses=0;
  for(const m of arr(c.movements)){
   const u=m.learningUsage;if(!u||u.origin!=='REGRA_APRENDIDA')continue;
   const d=date(u.suggestedAt||'');
   if(!day(d)||d<b.from||d>b.to)continue;
   if(filter.period&&date(m.date).slice(0,7)!==filter.period)continue;
   suggested++;uses++;
   if(m.status==='CONFIRMADO'&&String(m.counterpart||'')===String(u.suggestedCode||''))confirmed++;
   if(m.status==='CONFIRMADO'&&String(m.counterpart||'')!==String(u.suggestedCode||''))corrected++;
  }
  if(uses)rows.push({companyId:c.id,name:c.name||'',uses});
 }
 return {suggested,confirmed,corrected,confirmationRate:pct(confirmed,suggested),byCompany:rows,
  note:'Somente sugestões registradas a partir desta versão; confirmação exige código final idêntico.'};
}
function groupByMonths(records,year,dateField='executionAt'){
 return Array.from({length:12},(_,i)=>{const month=String(year)+'-'+String(i+1).padStart(2,'0');
  const rows=arr(records).filter(r=>date(r[dateField]||r.finishedAt||r.createdAt).slice(0,7)===month);
  return {period:month,count:rows.length};});
}
function operational(companies,userId,B,filter={},tracking){
 if(!B)return {summary:null,rows:[],note:'Núcleo BI indisponível'};
 const f=filter||{},accepted=B.authorized(companies,userId).filter(c=>!f.companyId||c.id===f.companyId);
 const {from,to}=bounds(f);
 const months=[];let p=from.slice(0,7);while(p<=to.slice(0,7)){
  months.push(p);const [y,m]=p.split('-').map(Number);p=(y+(m===12?1:0))+'-'+String(m===12?1:m+1).padStart(2,'0');
 }
 const records=[];
 for(const c of accepted)for(const period of months){
  // Competências futuras não geram atrasos ou obrigações vencidas por extrapolação.
  if(period>new Date().toISOString().slice(0,7))continue;
  if(f.period&&period!==f.period)continue;
  const r=B.record(c,period,tracking);
  const t=c.reconciliationTracking?.[period]||{};
  const done=date(t.end||t.finishedAt||'');
  // Para indicadores de conclusão diária/semanal, usar a data real de término.
  if(['day','week','custom'].includes(f.range)&&(!day(done)||done<from||done>to))continue;
  if(f.status&&f.status!=='all'&&r.status!==f.status)continue;
  records.push(r);
 }
 const a=B.aggregate(records);a.totalCompanies=accepted.length;
 const note=['day','week','custom'].includes(f.range)?'Conciliações: data real de término. Movimentos mensais não são distribuídos artificialmente por dia.':'Métricas conforme competência.';
 if(['day','week','custom'].includes(f.range)){
  // Contagens de movimentos vêm da data explícita, nunca das somas mensais.
  let movementCount=0,confirmed=0,automatic=0,excel=0;
  for(const c of accepted)for(const m of arr(c.movements)){
   const d=date(m.date);if(!day(d)||d<from||d>to)continue;
   if(f.period&&d.slice(0,7)!==f.period)continue;
   movementCount++;if(m.status==='CONFIRMADO'){
    confirmed++;
    const origin=String(m.confidence||'');
    if(origin.includes('Excel colado'))excel++;
    else if(/aprendizado|automat|automát|regra aprendida/i.test(origin))automatic++;
   }
  }
  Object.assign(a,{movements:movementCount,classified:confirmed,automated:automatic,excel,
    manual:Math.max(0,confirmed-automatic-excel),automaticRate:pct(automatic,confirmed),excelRate:pct(excel,confirmed)});
 }
 return {summary:a,rows:records,note,from,to};
}
return {learningFromCompanies,operational,bounds,included,filterRows,sessions,reviewTransition,quality,metricAtGoal,goalProgress,businessDays,planning,learning,savings,groupByMonths};
});
