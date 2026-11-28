/* ConCiliar+ — Melhoria 03: núcleo puro CRM manual.
   NÃO envia e-mails/notificações externas. Reaproveita state.companies,
   documentHistory, walletAssignedUserIds e o fluxo durável já existente. */
(function(root){'use strict';
const TZ='America/Sao_Paulo';
const DEFAULTS=Object.freeze({reminder1:14,charge1:15,reminder2:24,charge2:25,shortMonth:'last-day'});
const TYPES=['charge','reply','note','receipt'];
const CRM_STATUSES=['A cobrar','Cobrança realizada','Aguardando retorno','Cliente respondeu','Documentação parcialmente recebida','Documentação recebida','Cobrança dispensada'];
const DUE=['Pendente','Parcialmente recebido','Cobrado'];
const NORMALIZED=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const clone=v=>JSON.parse(JSON.stringify(v));
const digits=s=>String(s||'').replace(/\D/g,'');
const key=(year,month)=>String(year)+'-'+String(month).padStart(2,'0');
function todayBrazil(d=new Date()){
 if(typeof d==='string'&&/^\d{4}-\d\d-\d\d$/.test(d))return d;
 const date=d instanceof Date?d:new Date(d);
 if(Number.isNaN(date.getTime()))throw Error('Data inválida');
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function monthDays(y,m){return new Date(Date.UTC(y,m,0)).getUTCDate();}
function schedule(settings=DEFAULTS){
 const s={...DEFAULTS,...(settings||{})};
 for(const k of ['reminder1','charge1','reminder2','charge2'])if(!Number.isInteger(Number(s[k]))||Number(s[k])<1||Number(s[k])>31)throw Error('Dia inválido para '+k+' (1 a 31).');
 if(!['last-day','skip'].includes(s.shortMonth))throw Error('Comportamento de meses curtos inválido.');
 if(!(Number(s.reminder1)<Number(s.charge1)&&Number(s.charge1)<Number(s.reminder2)&&Number(s.reminder2)<Number(s.charge2)))throw Error('Datas devem seguir lembrete 1 < cobrança 1 < lembrete 2 < cobrança 2.');
 return Object.fromEntries([...['reminder1','charge1','reminder2','charge2'].map(k=>[k,Number(s[k])]),['shortMonth',s.shortMonth]]);
}
function dayFor(y,m,d,policy){const max=monthDays(y,m);return d<=max?d:(policy==='last-day'?max:null);}
function eventsForMonth(y,m,s=DEFAULTS){const opts=schedule(s);
 return ['reminder1','charge1','reminder2','charge2'].flatMap(type=>{const day=dayFor(y,m,opts[type],opts.shortMonth);return day===null?[]:[{type,round:type.endsWith('1')?1:2,date:key(y,m)+'-'+String(day).padStart(2,'0'),year:y,month:m}]});}
function scheduleNext(today,settings){
 const ref=todayBrazil(today),[y,m]=ref.split('-').map(Number),out=[];
 for(let offset=0;offset<15;offset++){const yy=y+Math.floor((m-1+offset)/12),mm=(m-1+offset)%12+1;out.push(...eventsForMonth(yy,mm,settings));}
 return out.filter(x=>x.date>=ref).sort((a,b)=>a.date.localeCompare(b.date)||['reminder1','charge1','reminder2','charge2'].indexOf(a.type)-['reminder1','charge1','reminder2','charge2'].indexOf(b.type));
}
function authorizedCompanies(companies,userId){
 if(!userId)return [];
 return (companies||[]).filter(c=>!Array.isArray(c.walletAssignedUserIds)||c.walletAssignedUserIds.includes(userId));
}
function activeCompany(c){return !c.clientInactive&&!c.distractDate;}
function eligiblePeriods(c,today,settings){
 const ref=todayBrazil(today),currentMonth=ref.slice(0,7),[yy,mm]=currentMonth.split('-').map(Number);
 const firstCharge=eventsForMonth(yy,mm,settings).find(e=>e.type==='charge1');
 const currentAllowed=!firstCharge||ref>=firstCharge.date;
 const due=[],unknown=[];
 for(const [period,doc] of Object.entries(c.documentHistory||{})){
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)||period>currentMonth)continue;
  if(period===currentMonth&&!currentAllowed)continue;
  const val=doc?.status||'Sem registro';
  if(DUE.some(x=>NORMALIZED(x)===NORMALIZED(val)))due.push({period,status:val,notes:doc?.notes||''});
  else if(NORMALIZED(val)==='sem registro'||doc?.sourceEmpty===true&&(!doc.status||doc.status==='Sem registro'))unknown.push({period,status:'Sem registro'});
 }
 due.sort((a,b)=>a.period.localeCompare(b.period));unknown.sort((a,b)=>a.period.localeCompare(b.period));
 return {due,unknown};
}
function companyHistory(c){return Array.isArray(c.crmHistory)?c.crmHistory:[];}
function statusFor(c,period){
 const history=companyHistory(c).filter(e=>(e.periods?.includes(period)||e.period===period)&&!(e.type==='note'&&(!e.status||e.status==='A cobrar'))).sort((a,b)=>(a.occurredAt||'').localeCompare(b.occurredAt||'')||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
 const doc=c.documentHistory?.[period],docStatus=doc?.status||'Sem registro';
 if(NORMALIZED(docStatus)===NORMALIZED('Recebido'))return 'Documentação recebida';
 // O status de relacionamento da última cobrança/retorno prevalece sobre o
 // status documental Parcialmente recebido, sem sobrescrever o documento.
 const latest=history[history.length-1];
 if(latest?.status&&CRM_STATUSES.includes(latest.status))return latest.status;
 if(latest?.type==='reply')return 'Cliente respondeu';
 if(latest?.type==='charge')return 'Aguardando retorno';
 if(NORMALIZED(docStatus)===NORMALIZED('Parcialmente recebido'))return 'Documentação parcialmente recebida';
 return 'A cobrar';
}
function summary(companies,userId,now,settings){
 const today=todayBrazil(now),list=authorizedCompanies(companies,userId).filter(activeCompany);
 const eligible=[],unfilled=[];
 for(const c of list){const p=eligiblePeriods(c,today,settings);if(p.due.length)eligible.push({company:c,periods:p.due});if(p.unknown.length)unfilled.push({company:c,periods:p.unknown});}
 const [y,m,day]=today.split('-').map(Number),events=eventsForMonth(y,m,settings),charges=events.filter(e=>e.type.startsWith('charge')&&e.date<=today),round=charges.length?charges[charges.length-1].round:0;
 const charged=round?eligible.filter(({company})=>companyHistory(company).some(e=>e.type==='charge'&&e.round===round&&e.roundMonth===key(y,m))).length:0;
 const pendingReturn=eligible.filter(({company,periods})=>periods.some(x=>statusFor(company,x.period)==='Aguardando retorno')).length;
 const recurrent=eligible.filter(x=>x.periods.length>1).length;
 const upcoming=scheduleNext(today,settings);
 return {today,eligible,unfilled,companiesDue:eligible.length,companiesUnknown:unfilled.length,round,roundCharged:charged,roundPending:Math.max(0,eligible.length-charged),awaitingReturn:pendingReturn,recurrent,documentPending:eligible.length,
 nextReminder:upcoming.find(x=>x.type.startsWith('reminder'))||null,nextCharge:upcoming.find(x=>x.type.startsWith('charge'))||null,
 alerts:events.filter(e=>e.date<=today).map(e=>({...e,overdue:e.date<today,companies:eligible.length}))};
}
function eventInput(company,payload,{userId,today,allowDuplicate=false}={}){
 if(!company||!activeCompany(company))throw Error('Empresa inativa ou inexistente não pode receber cobrança.');
 if(!userId)throw Error('Autenticação obrigatória para registrar CRM.');
 if(Array.isArray(company.walletAssignedUserIds)&&!company.walletAssignedUserIds.includes(userId))throw Error('Empresa fora da carteira deste usuário.');
 const type=String(payload.type||'');
 if(!TYPES.includes(type))throw Error('Tipo de registro não permitido.');
 const validPeriods=Object.keys(company.documentHistory||{});
 const periods=[...new Set((payload.periods||[]).map(String))].sort();
 if(!periods.length||periods.some(p=>!validPeriods.includes(p)||p>todayBrazil(today).slice(0,7)))throw Error('Selecione competências existentes e não futuras.');
 const occurredAt=String(payload.occurredAt||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(occurredAt)||Number.isNaN(Date.parse(occurredAt+'T12:00:00Z'))||new Date(occurredAt+'T12:00:00Z').toISOString().slice(0,10)!==occurredAt||occurredAt>todayBrazil(today))throw Error('Informe a data efetiva válida do contato, sem data futura.');
 const medium=String(payload.medium||'').trim(),notes=String(payload.notes||'').trim();
 if(type==='charge'&&!['Outlook manual','Telefone','WhatsApp manual','Outro'].includes(medium))throw Error('Informe o meio de contato.');
 if(notes.length>1500)throw Error('Observação excede 1.500 caracteres.');
 const status=String(payload.status||({'charge':'Aguardando retorno','reply':'Cliente respondeu','note':'A cobrar','receipt':'Documentação recebida'}[type]));
 if(!CRM_STATUSES.includes(status))throw Error('Situação CRM não reconhecida.');
 const nextFollowUp=String(payload.nextFollowUp||'').trim();
 if(nextFollowUp&&(!/^\d{4}-\d{2}-\d{2}$/.test(nextFollowUp)||nextFollowUp<occurredAt))throw Error('Próximo acompanhamento deve ser igual ou posterior à data do contato.');
 const duplicate=companyHistory(company).some(e=>e.type===type&&e.occurredAt===occurredAt&&e.medium===medium&&e.actorId===userId&&JSON.stringify((e.periods||[]).slice().sort())===JSON.stringify(periods));
 if(duplicate&&!allowDuplicate)throw Error('POSSIVEL_DUPLICIDADE: contato já registrado nesta data para as mesmas competências e meio. Confirme se realmente foi um segundo contato.');
 const [ry,rm]=todayBrazil(today).slice(0,7).split('-').map(Number);
 const round=Number(payload.round||0);
 if(round&&![1,2].includes(round))throw Error('Rodada inválida.');
 return {id:(globalThis.crypto?.randomUUID?.()||'crm-'+Date.now()+'-'+Math.random().toString(36).slice(2)),
 type,periods,occurredAt,medium,notes,status,nextFollowUp:nextFollowUp||null,
 round:type==='charge'?round:null,roundMonth:type==='charge'?key(ry,rm):null,
 actorId:userId,createdAt:new Date().toISOString(),source:'manual'};
}
function addEvent(c,event){c.crmHistory ||= [];c.crmHistory.push(event);return event;}
function safeCopy(c){return clone(c);}
root.ConciliaCrmCore={TZ,DEFAULTS,TYPES,CRM_STATUSES,todayBrazil,monthDays,schedule,eventsForMonth,scheduleNext,authorizedCompanies,activeCompany,eligiblePeriods,statusFor,summary,eventInput,addEvent,safeCopy,key};
})(typeof window!=='undefined'?window:globalThis);