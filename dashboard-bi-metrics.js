/* ConCiliar+ — indicadores BI derivados, somente leitura. Nenhuma escrita nem inferência. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ConciliaBIMetrics=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const periods=/^20\d\d-(0[1-9]|1[0-2])$/;
const array=x=>Array.isArray(x)?x:[];
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const active=c=>!c.clientInactive&&!c.distractDate;
const validNumber=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:null;
const ratio=(n,d)=>d>0?Math.round(1000*n/d)/10:null;
const isoDate=s=>/^20\d\d-(0[1-9]|1[0-2])-\d\d$/.test(String(s||''));
const eligibleDoc=s=>['Pendente','Cobrado','Recebido','Parcialmente recebido'].includes(s);
const isReceived=s=>s==='Recebido';
const codeOf=c=>String(c.dominio||'');
function authorized(companies,userId){
 if(!userId)return [];
 return array(companies).filter(c=>!Array.isArray(c.walletAssignedUserIds)||c.walletAssignedUserIds.includes(userId));
}
function months(year){return Array.from({length:12},(_,i)=>String(year)+'-'+String(i+1).padStart(2,'0'));}
function record(c,period,tracking){
 const d=obj(c.documentHistory?.[period]),t=obj(c.reconciliationTracking?.[period]);
 const tr=tracking?.effective?tracking.effective(c,period).data:{};
 const movements=array(c.movements).filter(m=>String(m.date||'').slice(0,7)===period);
 const crm=array(c.crmHistory).filter(e=>array(e.periods).includes(period)||e.period===period);
 const ledgered=movements.filter(m=>m.status==='CONFIRMADO');
 const excel=ledgered.filter(m=>String(m.confidence||'').includes('Excel colado'));
 const auto=ledgered.filter(m=>/aprendizado|automat|automát|regra aprendida/i.test(String(m.confidence||''))&&!String(m.confidence||'').includes('Excel colado'));
 const due=eligibleDoc(d.status),received=isReceived(d.status);
 const seconds=validNumber(tr.effectiveSeconds);
 const started=!!(tr.start||t.start),finished=!!(tr.end||t.end);
 const status=String(tr.status|| (finished?'Concluída':started?'Em andamento':'Não iniciada'));
 return {id:c.id,name:c.name||'',dominio:codeOf(c),cnpj:String(c.cnpj||''),period,active:active(c),status,
    applicable:status!=='Não se aplica',started,finished,documentStatus:d.status||null,
    due,received,chargeCount:crm.filter(x=>x.type==='charge').length,replyCount:crm.filter(x=>x.type==='reply').length,
    movements:movements.length,classified:ledgered.length,excel:excel.length,automatic:auto.length,
    manual:Math.max(0,ledgered.length-excel.length-auto.length),seconds,
    pending:validNumber(tr.pendingRemaining),rework:validNumber(tr.reworkCount),
    deadline:isoDate(tr.deadline)?tr.deadline:null,end:isoDate(tr.end)?tr.end:null,
    learnedRules:array(c.learnedCodes).filter(x=>!x.archived&&!x.disabled).length};
}
function aggregate(records){
 const list=array(records),applicable=list.filter(r=>r.active&&r.applicable);
 const done=applicable.filter(r=>r.finished),started=applicable.filter(r=>r.started&&!r.finished);
 const total=list.length,activeCount=list.filter(r=>r.active).length,docEligible=applicable.filter(r=>r.due);
 const timed=done.filter(r=>r.seconds!==null),worked=timed.reduce((n,r)=>n+r.seconds,0);
 const classified=list.reduce((a,r)=>a+r.classified,0),automated=list.reduce((a,r)=>a+r.automatic,0),excel=list.reduce((a,r)=>a+r.excel,0);
 const dueWithDeadline=applicable.filter(r=>!!r.deadline&&r.finished&&r.end);
 const onTime=dueWithDeadline.filter(r=>r.end<=r.deadline).length;
 return {
  total,active:activeCount,inactive:total-activeCount,applicable:applicable.length,
  concluded:done.length,inProgress:started.length,remaining:applicable.length-done.length,
  completion:ratio(done.length,applicable.length),
  documentEligible:docEligible.length,documentReceived:docEligible.filter(r=>r.received).length,documentRate:ratio(docEligible.filter(r=>r.received).length,docEligible.length),
  charged:applicable.filter(r=>r.chargeCount>0).length,charges:applicable.reduce((n,r)=>n+r.chargeCount,0),
  movements:list.reduce((n,r)=>n+r.movements,0),classified,automated,excel,manual:Math.max(0,classified-automated-excel),
  automaticRate:ratio(automated,classified),excelRate:ratio(excel,classified),
  pending:list.reduce((n,r)=>n+(r.pending??0),0),seconds:timed.length?worked:null,timed:timed.length,
  averageSeconds:timed.length?Math.round(worked/timed.length):null,
  onTime,onTimeTotal:dueWithDeadline.length,onTimeRate:ratio(onTime,dueWithDeadline.length),
  withRework:list.filter(r=>r.rework!==null).length,rework:list.reduce((n,r)=>n+(r.rework??0),0),
  learnedRules:list.reduce((n,r)=>n+r.learnedRules,0)
 };
}
function summarize(companies,userId,period,opts={}){
 if(!periods.test(String(period||'')))throw Error('Competência inválida');
 const list=authorized(companies,userId).filter(c=>!opts.companyId||c.id===opts.companyId);
 const rows=list.map(c=>record(c,period,opts.tracking));
 return {rows,summary:aggregate(rows)};
}
function timeline(companies,userId,year,opts={}){
 if(!/^20\d\d$/.test(String(year)))throw Error('Ano inválido');
 return months(year).map(period=>({period,...summarize(companies,userId,period,opts).summary}));
}
return {authorized,active,months,record,aggregate,summarize,timeline,ratio};
});
