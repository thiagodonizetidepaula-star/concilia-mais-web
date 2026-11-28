/* Melhoria 02: importador com prévia local e mesclagem não destrutiva.
   O código de interface NÃO autoriza gravação da planilha nesta etapa. */
(function(root){'use strict';
const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const STANDARD=['Recebido','Pendente','Parcialmente recebido','Cobrado','Não se aplica','Sem registro'];
const t=v=>v==null?'':String(v).trim();
const norm=v=>t(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase();
const digits=v=>t(v).replace(/\D/g,'');
const cnpjValid=v=>{const s=digits(v);if(s.length!==14||/^(\d)\1+$/.test(s))return false;for(const n of [12,13]){let w=n-7,z=0;for(let i=0;i<n;i++){z+=Number(s[i])*w;w=w===2?9:w-1;}if(Number(s[n])!==(z%11<2?0:11-z%11))return false;}return true;};
function dateISO(v){
 if(v===null||v===undefined||v==='')return null;
 if(typeof v==='number'&&v>15000&&v<100000)return new Date(Math.round((v-25569)*86400000)).toISOString().slice(0,10);
 if(v instanceof Date&&!Number.isNaN(v.valueOf()))return v.toISOString().slice(0,10);
 if(/^\d{4}-\d\d-\d\d/.test(t(v)))return t(v).slice(0,10);
 const m=t(v).match(/^(\d\d?)\/(\d\d?)\/(\d{4})$/);
 return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):null;
}
function emails(v){
 const raw=t(v),valid=[],review=[],seen=new Set();
 for(const x of raw.split(/\s*(?:\/|;|,|\n)\s*/).filter(Boolean)){
  const email=x.toLowerCase();
  if(/^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email)){if(!seen.has(email)){valid.push(email);seen.add(email);}}
  else review.push(x);
 }
 return {raw,valid,review};
}
function status(raw){
 if(raw===undefined||raw===null||t(raw)==='')return {value:'Sem registro',raw:null,empty:true,special:false};
 const found=STANDARD.find(x=>norm(x)===norm(raw));
 return {value:found||t(raw),raw:t(raw),empty:false,special:!found};
}
const headerIndex=(headers,field)=>{const i=headers.findIndex(x=>norm(x)===norm(field));if(i<0)throw Error('Coluna obrigatória ausente: '+field);return i;};
function parseSheet(rows,kind){
 if(!Array.isArray(rows)||rows.length<2)throw Error('Aba '+kind+' vazia.');
 const h=rows[0].map(t),fields=kind==='docs'?['Cod. Do Sistema','Data de Inicio','Data de Distrato','E-mails','Cliente','CNPJ','Regime Tributário','Plano Contratado','Responsavel']:['Cod. Do Sistema','Data de Inicio','Data de Distrato','Cliente','CNPJ','Regime Tributário','Plano Contratado','Responsáveis'];
 const ci=Object.fromEntries(fields.map(x=>[x,headerIndex(h,x)])),months=MONTHS.map(m=>headerIndex(h,m)),obs=h.findIndex(x=>norm(x)==='observacao');
 const owner=kind==='docs'?'Responsavel':'Responsáveis',out=[];
 for(let n=1;n<rows.length;n++){
  const r=rows[n]||[],name=t(r[ci.Cliente]),cnpj=digits(r[ci.CNPJ]);
  if(!name&&!cnpj)continue;
  if(norm(r[ci[owner]])!=='beatriz')continue;
  const row={sourceRow:n+1,cnpj,name,owner:'Beatriz',code:r[ci['Cod. Do Sistema']]??null,startedAt:dateISO(r[ci['Data de Inicio']]),endedAt:dateISO(r[ci['Data de Distrato']]),rawEnd:r[ci['Data de Distrato']]??null,regime:t(r[ci['Regime Tributário']]),plan:t(r[ci['Plano Contratado']]),notes:obs>=0?t(r[obs]):'',months:months.map(i=>status(r[i]))};
  if(kind==='docs')row.email=emails(r[ci['E-mails']]);
  out.push(row);
 }
 return out;
}
function parseWorkbookRows(docs,closing,year){
 if(!/^(19|20)\d\d$/.test(String(year)))throw Error('Confirme um ano de referência válido antes da prévia.');
 const d=parseSheet(docs,'docs'),c=parseSheet(closing,'closing'),closeByCnpj=new Map(c.map(x=>[x.cnpj,x])),issues=[],seen=new Set(),selected=[];
 for(const row of d){
  if(!cnpjValid(row.cnpj)){issues.push('Linha '+row.sourceRow+': CNPJ inválido ou ausente.');continue;}
  if(seen.has(row.cnpj)){issues.push('Linha '+row.sourceRow+': CNPJ duplicado; registro bloqueado.');continue;}
  seen.add(row.cnpj);
  const matched=closeByCnpj.get(row.cnpj);
  if(!matched)issues.push('Linha '+row.sourceRow+': ausência no Fechamento Contábil.');
  if(matched&&norm(matched.name)!==norm(row.name))issues.push('Linha '+row.sourceRow+': divergência de razão social entre abas.');
  if(row.email.review.length)issues.push('Linha '+row.sourceRow+': '+row.email.review.length+' e-mail(s) inválido(s) para revisão.');
  row.closing=matched?.months||null;
  selected.push(row);
 }
 const counts={all:selected.length,active:selected.filter(x=>!x.endedAt&&!x.rawEnd).length,inactive:selected.filter(x=>x.endedAt||x.rawEnd).length,emails:selected.reduce((a,x)=>a+x.email.valid.length,0),invalidEmails:selected.reduce((a,x)=>a+x.email.review.length,0),monthlyCells:selected.length*12,filledCells:selected.reduce((a,x)=>a+x.months.filter(m=>!m.empty).length,0),closingCells:selected.reduce((a,x)=>a+(x.closing?.length||0),0)};
 return {year:Number(year),selected,issues,counts,sourceRows:{documents:d.length,closing:c.length},dashboard:'Aba DASHBOARD presente, sem cadastros a mesclar.'};
}
function merge(workspace,preview,sourceId='test',actor='test'){
 if(!preview||!Array.isArray(preview.selected))throw Error('Prévia ausente.');
 const result=JSON.parse(JSON.stringify(workspace));
 result.companies ||= [];
 const counts={created:0,reused:0,newEmails:0,docRecords:0,closingRecords:0,conflicts:[]};
 for(const row of preview.selected){
  if(!cnpjValid(row.cnpj)){counts.conflicts.push('CNPJ não válido na linha '+row.sourceRow);continue;}
  let c=result.companies.find(x=>digits(x.cnpj)===row.cnpj);
  if(c&&Array.isArray(c.walletAssignedUserIds)&&actor&&!c.walletAssignedUserIds.includes(actor)){
   counts.conflicts.push('Linha '+row.sourceRow+': empresa atribuída a outro usuário; alteração bloqueada.');continue;
  }
  if(!c){c={id:'excel-'+row.cnpj,name:row.name,cnpj:row.cnpj,dominio:row.code??'',plan:[],plansHistory:[],accounts:[],rules:[],partners:[],relatedCompanies:[],taxRules:[],taxSplits:[],imports:[],movements:[],ledger:[],transfers:[],walletAssignedUserIds:actor?[actor]:[]};result.companies.push(c);counts.created++;}
  else counts.reused++;
  for(const [field,value] of Object.entries({dominio:row.code,name:row.name,regimeTributario:row.regime,contractedPlan:row.plan,startDate:row.startedAt,distractDate:row.endedAt,clientNotes:row.notes,documentOwner:row.owner})){
   if((c[field]===null||c[field]===undefined||c[field]==='')&&value!==null&&value!==undefined&&value!=='')c[field]=value;
  }
  if(row.endedAt||row.rawEnd)c.clientInactive=true;
  else if(c.clientInactive===undefined)c.clientInactive=false;
  c.emails ||= [];c.emailSourceRaw ||= row.email.raw;c.emailReview ||= row.email.review;
  for(const email of row.email.valid)if(!c.emails.some(e=>norm(typeof e==='string'?e:e.value)===norm(email))){c.emails.push({value:email,confirmed:true,source:'xlsx'});counts.newEmails++;}
  c.documentHistory ||= {};c.closingHistory ||= {};
  for(let m=1;m<=12;m++){
   const period=preview.year+'-'+String(m).padStart(2,'0'),doc=row.months[m-1],closing=row.closing?.[m-1];
   if(!Object.prototype.hasOwnProperty.call(c.documentHistory,period)){c.documentHistory[period]={status:doc.value,rawStatus:doc.raw,empty:doc.empty,special:doc.special,notes:'',source:'xlsx',sourceId,updatedAt:null,updatedBy:null,receivedAt:null,chargedAt:null};counts.docRecords++;}
   if(closing&&!Object.prototype.hasOwnProperty.call(c.closingHistory,period)){c.closingHistory[period]={status:closing.value,rawStatus:closing.raw,empty:closing.empty,source:'xlsx',sourceId};counts.closingRecords++;}
  }

 }
 return {workspace:result,counts};
}
root.ConciliaDocumentImport={MONTHS,STANDARD,digits,cnpjValid,dateISO,emails,status,parseSheet,parseWorkbookRows,merge};
})(typeof window!=='undefined'?window:globalThis);
