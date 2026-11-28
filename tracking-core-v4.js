/* ConCiliar+ Melhoria 04 — núcleo não destrutivo do Controle de Conciliações.
 * Campos automáticos são SOMENTE leituras dos módulos existentes; ajustes gerenciais
 * ficam em reconciliationTracking[competencia].managementOverrides e jamais alteram
 * movimentos, pendências, contas, código Domínio ou aprovações contábeis. */
(function(root){'use strict';
 const STATES=['Não iniciada','Aguardando documentos','Disponível para conciliação','Em andamento','Pausada','Aguardando esclarecimentos','Com pendências','Classificação concluída','Conferência concluída','Exportada para o Domínio','Importação confirmada no Domínio','Aguardando revisão','Revisada','Aprovada','Concluída','Não se aplica'];
 const FIELDS=['status','start','end','deadline','effectiveSeconds','processed','classified','pendingFound','pendingResolved','pendingRemaining','exportStatus','dominioStatus','reviewStatus','delayReason','delayCategory','notes','reviewNotes'];
 const DOC_NO=['Não se aplica','Recebido'],DOC_WAIT=['Pendente','Cobrado','Parcialmente recebido'];
 const delayReasons=['Documentação não recebida','Documentação parcialmente recebida','Aguardando resposta do cliente','Aguardando esclarecimentos internos','Aguardando revisão','Problemas técnicos','Volume elevado de lançamentos','Complexidade da conciliação','Outras situações'];
 const iso=v=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v||''));
 const digits=s=>String(s||'').replace(/\D/g,'');
 const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
 const safeArray=v=>Array.isArray(v)?v:[];
 const periodMoves=(c,p)=>safeArray(c.movements).filter(m=>String(m.date||'').slice(0,7)===p);
 const nonEmpty=v=>v!==undefined&&v!==null&&v!=='';
 const owner=(c,uid)=>!!uid&&(!Array.isArray(c.walletAssignedUserIds)||c.walletAssignedUserIds.includes(uid));
 const currentCompany=c=>!c.clientInactive&&!c.distractDate;
 const monthKey=(y,m)=>String(y)+'-'+String(m).padStart(2,'0');
 const age=(a,b)=>a&&b?Math.max(0,Math.floor((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000)):null;
 const nowISO=()=>new Date().toISOString();
 function auto(c,period){
  if(!iso(period))throw Error('Competência inválida');
  const tracking=obj(c.reconciliationTracking?.[period]),doc=obj(c.documentHistory?.[period]),reviews=obj(c.reconciliationReview?.[period]);
  const moves=periodMoves(c,period);
  const imported=safeArray(c.imports).filter(f=>f.period===period||safeArray(f.periods).includes(period));
  const confirmed=moves.filter(m=>m.status==='CONFIRMADO').length;
  const classified=moves.filter(m=>m.debitCode&&m.creditCode||m.status==='CONFIRMADO').length;
  const unresolved=moves.filter(m=>['PENDENTE','PENDENTE_DUPLICIDADE','DIVERGENTE'].includes(m.status)).length;
  const decisions=safeArray(reviews.decisions),approvals=safeArray(reviews.approvals);
  const resolved=decisions.filter(d=>d.decision==='Resolvida'||d.decision==='Corrigida'||d.decision==='Conferida').length;
  const reviewed=approvals.length>0;
  const docs=doc.status||'Sem registro';
  const notApplicable=docs==='Não se aplica';
  let status=notApplicable?'Não se aplica':tracking.end?'Concluída':tracking.start?'Em andamento':DOC_WAIT.includes(docs)?'Aguardando documentos':docs==='Recebido'?'Disponível para conciliação':'Não iniciada';
  if(!tracking.end&&unresolved>0&&tracking.start)status='Com pendências';
  const exp=nonEmpty(tracking.exportedAt)||safeArray(c.exportHistory).some(e=>e.period===period);
  const dominio=!!tracking.dominioConfirmed;
  const result={status,start:tracking.start||null,end:tracking.end||null,deadline:tracking.deadline||null,effectiveSeconds:null,
   processed:moves.length,classified,pendingFound:unresolved+resolved,pendingResolved:resolved,pendingRemaining:unresolved,
   exportStatus:exp?'Exportada':'Sem confirmação',dominioStatus:dominio?'Confirmada manualmente':'Não confirmada',
   reviewStatus:reviewed?'Aprovada':'Não aprovada',delayReason:null,delayCategory:null,
   notes:tracking.notes||'',reviewNotes:tracking.reviewNotes||'',docs,confirmed,files:imported.length,approved:reviewed,
   statusEvidence:tracking.end?'tracking.end':tracking.start?'tracking.start':'documentHistory',
   importConfirmed:dominio,reviewPending:!!tracking.end&&!reviewed};
  return result;
 }
 function overrides(c,p){return obj(c.reconciliationTracking?.[p]?.managementOverrides);}
 function effective(c,p){const a=auto(c,p),os=overrides(c,p),data={...a},origin={};
  for(const field of FIELDS){const ov=os[field];if(ov&&Object.prototype.hasOwnProperty.call(ov,'value')){data[field]=ov.value;origin[field]={kind:'manual',automatic:a[field],at:ov.at,actorId:ov.actorId,reason:ov.reason||''};}
  else origin[field]={kind:'automatic',automatic:a[field]??null};}
  return {data,origin,auto:a};
 }
 function allowedStatus(s){return STATES.includes(s);}
 function validate(field,value,ctx={}){
  if(!FIELDS.includes(field))throw Error('Campo operacional desconhecido.');
  if(field==='status'&&!allowedStatus(value))throw Error('Situação operacional inválida.');
  if(['start','end','deadline'].includes(field)){
   if(value!==null&&value!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))throw Error('Data em formato inválido.');
   if(value){const d=new Date(value+'T12:00:00Z');if(Number.isNaN(d.valueOf())||d.toISOString().slice(0,10)!==value)throw Error('Data inexistente.');}
  }
  if(['effectiveSeconds','processed','classified','pendingFound','pendingResolved','pendingRemaining'].includes(field)){
   if(!Number.isSafeInteger(Number(value))||Number(value)<0||Number(value)>1e7)throw Error('Quantidade/tempo deve ser inteiro não negativo.');
   value=Number(value);
  }
  if(field==='delayReason'&&value&&!delayReasons.includes(value))throw Error('Motivo de atraso inválido.');
  if(field==='delayCategory'&&value&&!['Cliente','Interno','Terceiro','Não determinado'].includes(value))throw Error('Categoria de atraso inválida.');
  if(field==='exportStatus'&&!['Sem confirmação','Exportada','Revisar exportação'].includes(value))throw Error('Situação da exportação inválida.');
  if(field==='dominioStatus'&&!['Não confirmada','Confirmada manualmente','Aguardando importação'].includes(value))throw Error('Situação Domínio inválida.');
  if(field==='reviewStatus'&&!['Não aprovada','Aguardando revisão','Em revisão','Correção necessária','Revisada','Aprovada'].includes(value))throw Error('Situação da revisão inválida.');
  if(['notes','reviewNotes'].includes(field)&&String(value??'').length>2000)throw Error('Observações excedem 2.000 caracteres.');
  if(ctx.start&&ctx.end&&ctx.end<ctx.start)throw Error('Conclusão anterior ao início.');
  if(ctx.classified!==null&&ctx.processed!==null&&Number(ctx.classified)>Number(ctx.processed))throw Error('Classificados excedem processados.');
  if(ctx.pendingResolved!==null&&ctx.pendingFound!==null&&Number(ctx.pendingResolved)>Number(ctx.pendingFound))throw Error('Pendências resolvidas excedem identificadas.');
  return value===''?null:value;
 }
 function edit(c,p,field,value,actorId,reason=''){
  if(!owner(c,actorId))throw Error('Empresa fora da carteira autenticada.');
  if(!iso(p))throw Error('Competência inválida.');
  c.reconciliationTracking ||= {};const r=c.reconciliationTracking[p] ||= {};
  const previous=JSON.parse(JSON.stringify(r.managementOverrides||{}));
  const a=effective(c,p).data,ctx={...a,[field]:value};
  const cleaned=validate(field,value,ctx),original=auto(c,p)[field];
  r.managementOverrides ||= {};r.managementHistory ||= [];
  const stamp=nowISO();
  r.managementOverrides[field]={value:cleaned,automaticAtChange:original,at:stamp,actorId,reason:String(reason||'').slice(0,400)};
  r.managementHistory.push({type:'manual-edit',field,oldValue:a[field]??null,automatic:original??null,newValue:cleaned,at:stamp,actorId,reason:String(reason||'').slice(0,400)});
  return {undo:()=>{r.managementOverrides=previous;r.managementHistory.pop();},changed:true};
 }
 function restore(c,p,field,actorId,reason=''){
  if(!owner(c,actorId))throw Error('Empresa fora da carteira autenticada.');
  const r=c.reconciliationTracking?.[p],before=r?.managementOverrides?.[field];if(!before)return {changed:false,undo:()=>{}};
  delete r.managementOverrides[field];
  r.managementHistory ||= [];r.managementHistory.push({type:'restore-auto',field,oldValue:before.value,newValue:auto(c,p)[field]??null,at:nowISO(),actorId,reason:String(reason||'').slice(0,400)});
  return {changed:true,undo:()=>{r.managementOverrides[field]=before;r.managementHistory.pop();}};
 }
 function eligible(c,p){return currentCompany(c)&&c.documentHistory?.[p]?.status!=='Não se aplica';}
 function summarize(companies,p,uid){
  if(!iso(p))throw Error('Competência inválida');
  const list=safeArray(companies).filter(c=>owner(c,uid)&&currentCompany(c)),applicable=list.filter(c=>eligible(c,p));
  const groups={},rows=[];for(const c of applicable){const record=effective(c,p).data,done=['Concluída','Aprovada'].includes(record.status);groups[record.status]=(groups[record.status]||0)+1;rows.push({c,status:record.status,done,doc:record.docs,record});}
  const done=rows.filter(r=>r.done).length,remaining=rows.length-done;
  return {active:list.length,applicable:rows.length,done,remaining,percent:rows.length?Math.round(100*done/rows.length):0,
   inProgress:rows.filter(r=>['Em andamento','Pausada'].includes(r.status)).length,
   notStarted:rows.filter(r=>r.status==='Não iniciada').length,
   awaitingDocs:rows.filter(r=>r.status==='Aguardando documentos').length,
   awaitingClarification:rows.filter(r=>r.status==='Aguardando esclarecimentos').length,
   internalPending:rows.filter(r=>r.status==='Com pendências').length,
   exported:rows.filter(r=>r.record.exportStatus==='Exportada').length,
   dominioConfirmed:rows.filter(r=>r.record.dominioStatus==='Confirmada manualmente').length,
   awaitingReview:rows.filter(r=>r.record.reviewStatus==='Aguardando revisão').length,
   approved:rows.filter(r=>r.record.reviewStatus==='Aprovada').length,
   overdue:rows.filter(r=>r.record.deadline&&r.record.deadline<new Date().toISOString().slice(0,10)&&!r.done).length,
   withinDeadline:rows.filter(r=>r.done&&r.record.end&&r.record.deadline&&r.record.end<=r.record.deadline).length,
   groups,rows};
 }
 function timer(c,p){return obj(c.reconciliationTracking?.[p]?.workTimer);}
 function elapsed(t,now=Date.now()){return Math.max(0,Number(t.seconds)||0)+(t.runningSince?Math.max(0,now-Date.parse(t.runningSince))/1000:0);}
 function timerTransition(c,p,action,actorId,now=new Date(),manualSeconds=null){
  if(!owner(c,actorId))throw Error('Acesso negado.');
  if(!iso(p))throw Error('Competência inválida');
  if(!['start','pause','resume','finish','reset','restart','edit-time','restore-auto'].includes(action))throw Error('Ação de cronômetro inválida.');
  const t={...timer(c,p)},before=JSON.parse(JSON.stringify(t)),at=now.toISOString(),instant=now.getTime();
  if(t.actorId&&t.actorId!==actorId)throw Error('Cronômetro vinculado a outro funcionário.');
  if(action==='start'||action==='resume'||action==='restart'){
   if(t.runningSince)throw Error('Cronômetro já está em execução.');
   if(action==='resume'&&!t.startedAt)throw Error('Inicie antes de continuar.');
   if(t.finishedAt&&action!=='restart')throw Error('Cronômetro finalizado. Reinicie com confirmação.');
   if(action==='restart'){t.seconds=0;t.finishedAt=null;t.startedAt=at;}
   if(!t.startedAt)t.startedAt=at;
   t.runningSince=at;
  }
  if(action==='pause'||action==='finish'){
   if(!t.startedAt||t.finishedAt)throw Error('Cronômetro não iniciado ou finalizado.');
   if(t.runningSince){t.seconds=elapsed(t,instant);t.runningSince=null;}
   if(action==='finish')t.finishedAt=at;
  }
  if(action==='reset'){t.seconds=0;t.runningSince=null;t.finishedAt=null;t.startedAt=null;}
  if(action==='edit-time'){if(!Number.isSafeInteger(manualSeconds)||manualSeconds<0||manualSeconds>36000000)throw Error('Tempo manual inválido.');t.manualSeconds=manualSeconds;}
  if(action==='restore-auto')delete t.manualSeconds;
  t.actorId=actorId;t.updatedAt=at;
  t.history=[...safeArray(t.history),{action,at,actorId,before:{seconds:before.seconds||0,manualSeconds:before.manualSeconds??null,runningSince:before.runningSince||null,finishedAt:before.finishedAt||null}}];
  return t;
 }
 root.ConciliaTrackingCore={STATES,FIELDS,delayReasons,iso,owner,currentCompany,auto,effective,edit,restore,summarize,timer,elapsed,timerTransition,monthKey,age};
})(typeof window!=='undefined'?window:globalThis);