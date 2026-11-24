/* ConCiliar+ | conciliação tributária por comprovantes RFB (DARF/DAS). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ConciliaTax=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const t=x=>String(x??'').trim();
const norm=s=>t(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const money=s=>{const raw=t(s).replace(/R\$\s*/g,'').replace(/\s/g,'');if(raw==='-'||!raw)return 0;const n=Number(raw.replace(/\./g,'').replace(',','.'));return Number.isFinite(n)?Math.round(n*100):NaN;};
const iso=s=>{const m=t(s).match(/(\d{2})\/(\d{2})\/(\d{4})/);return m?m[3]+'-'+m[2]+'-'+m[1]:'';};
const cnpj=s=>t(s).replace(/\D/g,'');
function defaults(){
 return [
  {id:'rf-1079',key:'1079',description:'TJLP - Cont Previd Descontada Segurado (parcelamento INSS)',code:'680'},
  {id:'rf-1082',key:'1082',description:'Contrib Previd Descontada de Segurados (INSS)',code:'336'},
  {id:'rf-1099',key:'1099',description:'Contrib Prev Descontada de Segurado Contribuinte Individual (INSS)',code:'336'},
  {id:'rf-0016',key:'0016',description:'TJLP - IRRF - Parcelamentos',code:'478'},
  {id:'rf-0561-2025',key:'0561|2025-12',description:'IRRF - Rendimentos do trabalho assalariado (apuração 12/2025)',code:'178'},
  {id:'rf-0561-outros',key:'0561',description:'IRRF - Rendimentos do trabalho assalariado (outros períodos: verificar)',code:'478'},
  {id:'rf-das',key:'DAS',description:'Simples Nacional — valor total, não separar',code:'479'},
  {id:'rf-darf-generico',key:'DARF-REFERENCIA',description:'DARF — INSS a recolher (somente consulta, não classificação genérica)',code:'191',referenceOnly:true},
  {id:'rf-dare',key:'DARE-REFERENCIA',description:'DARE — Impostos diversos (somente consulta)',code:'3505',referenceOnly:true}
 ];
}
function parseReceipts(pdf,fileName='Comprovantes RFB.pdf'){
 const groups=new Map(),reviews=[];
 const pages=new Map();
 for(const row of pdf.lines||[]){const p=row.page||1;if(!pages.has(p))pages.set(p,[]);pages.get(p).push(t(row.content));}
 for(const [page,lines] of pages){
  const content=lines.join('\n');
  const kind=/registro de arrecada[cç][aã]o de\s+DAS/i.test(content)?'DAS':/registro de arrecada[cç][aã]o de\s+DARF/i.test(content)?'DARF':'';
  if(!kind){reviews.push('Página '+page+': não foi identificado comprovante DARF ou DAS.');continue;}
  const docNo=(content.match(/\b\d{16,20}\b/)||[])[0]||'';
  const documentCnpj=(content.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)||[])[0]||'';
  const apuracao=(content.match(/(?:Per[ií]odo Apura[cç][aã]o|Compet[eê]ncia)[\s\S]{0,280}?(\d{2}\/(?:\d{2}\/)?\d{4})/)||[])[1]||'';
  let paidDate='';
  const bankIndex=lines.findIndex(x=>/Data de Arrecada[cç][aã]o/i.test(x));
  if(bankIndex>=0)paidDate=iso(lines.slice(bankIndex+1,bankIndex+5).join(' '));
  if(!paidDate){
   const section=lines.findIndex(x=>/341\s*-\s*BANCO\s+ITAU|BANCO\s+ITAU/i.test(x));
   if(section>=0)paidDate=iso(lines[section]);
  }
  if(!docNo||!documentCnpj||!paidDate){reviews.push('Página '+page+': documento, CNPJ ou data de arrecadação ausente.');continue;}
  const start=lines.findIndex(x=>/C[oó]digo\s+Descri[cç][aã]o/i.test(x));
  const end=lines.findIndex((x,i)=>i>start&&/^Totais\b/i.test(x));
  const entries=[];
  if(start>=0)for(let i=start+1;i<(end>=0?end:lines.length);i++){
   const line=lines[i];
   const match=line.match(/^\s*(\d{4})\s+(.+?)\s+(-|[\d.]+,\d{2})\s+(-|[\d.]+,\d{2})\s+(-|[\d.]+,\d{2})\s+([\d.]+,\d{2})\s*$/);
   if(!match)continue;
   entries.push({revenueCode:match[1],description:match[2].trim(),principal:money(match[3]),fine:money(match[4]),interest:money(match[5]),cents:money(match[6]),page});
  }
  const totalLine=end>=0?lines[end]:'';
  const totalMatch=totalLine.match(/([\d.]+,\d{2})\s*$/);
  const declared=totalMatch?money(totalMatch[1]):null;
  if(!groups.has(docNo))groups.set(docNo,{id:docNo,type:kind,cnpj:cnpj(documentCnpj),paymentDate:paidDate,apuracao,file:fileName,lines:[],pages:[],declared:null});
  const receipt=groups.get(docNo);
  if(receipt.type!==kind||receipt.cnpj!==cnpj(documentCnpj)||receipt.paymentDate!==paidDate){reviews.push('Documento '+docNo+': páginas divergentes; revisar.');groups.delete(docNo);continue;}
  receipt.lines.push(...entries);
  receipt.pages.push(page);
  if(declared!==null){if(receipt.declared!==null&&receipt.declared!==declared)reviews.push('Documento '+docNo+': totais divergentes.');receipt.declared=declared;}
 }
 const receipts=[];
 for(const receipt of groups.values()){
  const total=receipt.lines.reduce((sum,l)=>sum+l.cents,0);
  receipt.totalCents=total;
  receipt.valid=receipt.lines.length>0&&receipt.declared!==null&&total===receipt.declared&&receipt.lines.every(l=>l.cents>0);
  if(!receipt.valid)reviews.push('Documento '+receipt.id+': soma dos componentes ('+(total/100).toFixed(2)+') não confere com o total do comprovante ('+((receipt.declared||0)/100).toFixed(2)+').');
  receipts.push(receipt);
 }
 return {receipts,reviews};
}
function keyForLine(line,receipt){return line.revenueCode==='0561'&&String(receipt.apuracao||'').trim()==='31/12/2025'?'0561|2025-12':line.revenueCode;}
function codeFor(company,line,receipt){
 const valid=new Set((company.plan||[]).filter(p=>p.analytic).map(p=>String(p.code)));
 const rules=company.taxRules||[];
 const key=receipt.type==='DAS'?'DAS':keyForLine(line,receipt);
 const rule=rules.find(r=>r.key===key&&!r.referenceOnly)||(key==='0561|2025-12'?null:rules.find(r=>r.key===line.revenueCode&&!r.referenceOnly));
 const code=String(rule?.code||'');
 return {code:valid.has(code)?code:'',registered:code,rule:rule?.description||''};
}
function suggestedLines(company,receipts){
 const all=[];
 for(const receipt of receipts){
  if(receipt.type==='DAS'){
   const code=codeFor(company,{},receipt);
   all.push({receiptId:receipt.id,description:'Simples Nacional — DAS (valor integral)',revenueCode:'DAS',code:code.code,registered:code.registered,cents:receipt.totalCents});
  }else for(const line of receipt.lines){
   const code=codeFor(company,line,receipt);
   all.push({receiptId:receipt.id,description:line.description,revenueCode:line.revenueCode,code:code.code,registered:code.registered,cents:line.cents});
  }
 }
 return all;
}
function matches(company,period,receipts){
 const liveMovements=new Set((company.movements||[]).map(m=>m.id));
 const existing=(company.taxSplits||[]).filter(x=>x.period===period&&x.status==='CONFIRMADA'&&liveMovements.has(x.movementId));
 const already=new Set(existing.flatMap(x=>x.receiptIds||[]));
 const accounts=new Map((company.accounts||[]).map(a=>[a.id,a]));
 const transferred=new Set((company.transfers||[]).filter(t=>t.status==='CONFIRMADA').flatMap(t=>[t.outId,t.inId]));
 const bankMovements=(company.movements||[]).filter(m=>m.date?.startsWith(period)&&m.cents<0&&m.status!=='PENDENTE_DUPLICIDADE'&&m.status!=='CONFIRMADO'&&!transferred.has(m.id));
 const valid=receipts.filter(r=>r.valid&&!already.has(r.id)&&r.cnpj===cnpj(company.cnpj)&&r.paymentDate.startsWith(period));
 const proposals=[],issues=[];
 if(!company.cnpj||cnpj(company.cnpj).length!==14)return {proposals,issues:['A empresa precisa ter CNPJ válido para cruzar comprovantes.']};
 for(const receipt of receipts)if(receipt.cnpj!==cnpj(company.cnpj))issues.push('Documento '+receipt.id+': CNPJ diferente da empresa selecionada.');
 const byDay=new Map();
 for(const r of valid){const key=r.paymentDate+'|'+r.type;if(!byDay.has(key))byDay.set(key,[]);byDay.get(key).push(r);}
 for(const m of bankMovements){
  if(existing.some(x=>x.movementId===m.id))continue;
  const bank=accounts.get(m.accountId);
  if(!bank||!company.plan.some(p=>p.analytic&&String(p.code)===String(bank.chartCode)))continue;
  const hist=norm([m.history,m.party].join(' '));
  const type=/\bDAS\b/.test(hist)?'DAS':/\bDARF\b/.test(hist)?'DARF':/TRIB|RECEITA FEDERAL|PAGAMENTO.*COD.*BARRAS/.test(hist)?'TRIB':'';
  if(!type)continue;
  const groups=[...(type==='TRIB'?['DARF','DAS']:[type])].flatMap(kind=>byDay.get(m.date+'|'+kind)||[]);
  if(!groups.length)continue;
  const exact=groups.filter(r=>r.totalCents===-m.cents);
  let alternatives=exact.map(r=>[r]);
  if(groups.length<=12){
   for(let size=2;size<=Math.min(6,groups.length);size++){
    const walk=(offset,chosen,sum)=>{
     if(chosen.length===size){if(sum===-m.cents)alternatives.push(chosen);return;}
     for(let i=offset;i<groups.length;i++)if(sum+groups[i].totalCents<=-m.cents)walk(i+1,[...chosen,groups[i]],sum+groups[i].totalCents);
    };
    walk(0,[],0);
   }
  }
  // Uma única composição exata; nunca aproveitar recibos que competem com outros pagamentos.
  if(alternatives.length>1){issues.push('Movimento '+m.date+' R$ '+(-m.cents/100).toFixed(2)+': múltiplas combinações de comprovantes; revisão manual.');continue;}
  if(alternatives.length===1)proposals.push({movementId:m.id,accountId:m.accountId,date:m.date,history:m.history,bankCode:String(bank.chartCode),cents:m.cents,receipts:alternatives[0],lines:suggestedLines(company,alternatives[0])});
 }
 const count=new Map();
 for(const p of proposals)for(const r of p.receipts)count.set(r.id,(count.get(r.id)||0)+1);
 const safe=proposals.filter(p=>p.receipts.every(r=>count.get(r.id)===1));
 for(const p of proposals)if(!safe.includes(p))issues.push('Comprovante '+p.receipts.map(r=>r.id).join(', ')+': corresponde a mais de uma saída; selecione manualmente após conferência.');
 return {proposals:safe,issues};
}
function confirm(company,p){
 const movement=(company.movements||[]).find(m=>m.id===p.movementId);
 if(!movement||movement.status==='PENDENTE_DUPLICIDADE'||movement.status==='CONFIRMADO'||movement.cents>=0||(company.transfers||[]).some(t=>t.status==='CONFIRMADA'&&(t.outId===movement.id||t.inId===movement.id)))throw Error('O pagamento já está classificado, em transferência ou tem duplicidade. Revise a classificação anterior antes de separar.');
 if((company.taxSplits||[]).some(x=>x.movementId===movement.id&&x.status==='CONFIRMADA'))throw Error('Este pagamento já foi separado.');
 const account=(company.accounts||[]).find(a=>a.id===movement.accountId),bank=String(account?.chartCode||'');
 if(!bank||bank!==p.bankCode||!company.plan.some(x=>x.analytic&&String(x.code)===bank))throw Error('Código bancário divergente do plano.');
 const ids=p.receipts.map(r=>r.id);
 if((company.taxSplits||[]).some(x=>(company.movements||[]).some(m=>m.id===x.movementId)&&(x.receiptIds||[]).some(id=>ids.includes(id))))throw Error('Um comprovante já foi utilizado.');
 const total=p.lines.reduce((n,l)=>n+l.cents,0);
 if(!p.lines.length||total!==-movement.cents||p.lines.some(l=>!l.code||l.code===bank||!company.plan.some(a=>a.analytic&&String(a.code)===String(l.code))))
  throw Error('Diferença de total ou código contábil não confirmado. Corrija a biblioteca de códigos.');
 company.taxSplits=company.taxSplits||[];
 const entry={id:'tax-'+movement.id,movementId:movement.id,period:movement.date.slice(0,7),bankCode:bank,receiptIds:ids,receiptTypes:p.receipts.map(r=>r.type),lines:p.lines.map(l=>({...l})),cents:movement.cents,status:'CONFIRMADA',confirmedAt:new Date().toISOString()};
 company.taxSplits.push(entry);
 return entry;
}
return {defaults,parseReceipts,codeFor,suggestedLines,matches,confirm};
});