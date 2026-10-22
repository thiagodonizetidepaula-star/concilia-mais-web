/* Concilia+ PDF - leitura conservadora de PDFs digitais, sem OCR ou envio de extratos ao servidor. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;root.ConciliaPDF=value;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const banks=[['Nubank',/\b(NUBANK|NU PAGAMENTOS)\b/i],['Itaú',/\bITAU\b/i],['PagBank',/\b(PAGBANK|PAGSEGURO)\b/i],['Bradesco',/\bBRADESCO\b/i],['Santander',/\bSANTANDER\b/i],['Banco do Brasil',/\bBANCO DO BRASIL\b/i],['Caixa Econômica Federal',/\bCAIXA ECONOMICA\b/i]];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
function detectBank(text,name=''){if(/TAR\s+PLANO\s+ITAU\s+EMP|ITAU\s+UNIBANCO/i.test(norm(text)))return 'Itaú';const t=norm(text),top=t.split(/\n/).filter(x=>x.trim()).slice(0,8).filter(x=>!/\d{2}\/\d{2}/.test(x)).join(' ');let b=banks.filter(x=>x[1].test(top));if(b.length===1)return b[0][0];const named=banks.filter(x=>x[1].test(norm(name).replace(/[^A-Z0-9]+/g,' ')));if(named.length===1)return named[0][0];b=banks.filter(x=>x[1].test(t.slice(0,6500)));return b.length===1?b[0][0]:''}
function identity(text,name=''){const s=String(text||'').slice(0,12000);const m=s.match(/CNPJ\s*(?:DA\s+EMPRESA)?\s*[:\-]?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})/i);const f=name.match(/(\d{14})/);const cnpj=(m?.[1]||f?.[1]||'').replace(/\D/g,'');const company=s.match(/(?:RAZ[AÃ]O SOCIAL|EMPRESA|TITULAR)\s*[:\-]\s*([^\n;|]{4,100})/i);const domain=s.match(/(?:C[OÓ]DIGO\s*(?:DA\s*)?EMPRESA\s*(?:NO\s*)?DOM[IÍ]NIO|C[OÓ]D\.\s*EMPRESA)\s*[:\-]\s*([\w-]+)/i);return{cnpj,name:company?.[1]?.trim()||'',dominio:domain?.[1]||'',verified:!!cnpj}}
function dt(s,period){let m;if(m=String(s).match(/\b(\d{2})\/(\d{2})(?:\/(\d{4}))?\b/)){const y=m[3]||String(period||'').slice(0,4);if(!y)return '';const x=y+'-'+m[2]+'-'+m[1];const d=new Date(x+'T12:00:00Z');return !isNaN(d.valueOf())&&d.toISOString().slice(0,10)===x?x:''}return''}
const amountRe=/(?:R\$\s*)?[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?:\s*[DC])?/gi;
function parseStatementText(lines,origin,accountId,period,Core){const movements=[],reviews=[];let cur=null;const ignore=/^(?:P[AÁ]GINA|EXTRATO|CNPJ|EMPRESA|TITULAR|PER[IÍ]ODO|AG[EÊ]NCIA|CONTA|DATA\s+HIST|[_\s=-]+$)/i;
function flush(){if(!cur)return;const raw=cur.content,line=cur.line;cur=null;if(/\b(SALDO|SUBTOTAL|TOTAL DO DIA)\b/i.test(raw)){reviews.push({origin,line,content:raw,reason:'Saldo ou total: conferir, não importar como movimento'});return}const date=dt(raw,period);const list=[...raw.matchAll(amountRe)].map(m=>m[0]);if(!date||list.length!==1){reviews.push({origin,line,content:raw,reason:!date?'Data não interpretada':list.length?'Valores múltiplos (possível saldo)':'Valor não identificado'});return}
const v=list[0],neg=/^\s*-/.test(v)||/\bD\s*$/.test(v),pos=/^\s*\+/.test(v)||/\bC\s*$/.test(v);
const outgoing=/\b(PIX ENVIADO|TRANSFERENCIA ENVIADA|PAGAMENTO|PAGTO|TARIFA|SAQUE|COMPRA|DEBITO|SAIDA)\b/i.test(norm(raw));
const incoming=/\b(PIX RECEBIDO|TRANSFERENCIA RECEBIDA|RECEBIMENTO|RECEBIDO|DEPOSITO|CREDITO|ENTRADA)\b/i.test(norm(raw));
if((outgoing&&incoming)||(!neg&&!pos&&outgoing===incoming)){reviews.push({origin,line,content:raw,reason:'Direção de entrada/saída incerta'});return}
try{const cents=Core.money(v.replace(/\s*[DC]\s*$/i,'').replace(/[+-]/g,''))*(neg?-1:pos?1:outgoing?-1:1);const history=raw.replace(/\d{2}\/\d{2}(?:\/\d{4})?/,' ').replace(v,' ').trim();if(!cents||!history)throw Error('Histórico ou valor vazio');movements.push({id:Core.id(),date,cents,history,party:'',accountId,origin,line,status:'PENDENTE',counterpart:'',method:'PDF_DIGITAL'});}catch(e){reviews.push({origin,line,content:raw,reason:e.message})}}
for(let i=0;i<lines.length;i++){const item=typeof lines[i]==='string'?{line:i+1,content:lines[i]}:lines[i];const x={...item,content:String(item.content||'').replace(/\s+/g,' ').trim()};if(!x.content)continue;if(dt(x.content,period)){flush();cur=x}else if(cur&&!ignore.test(x.content)&&cur.content.length<1000)cur.content+=' '+x.content;else if(!ignore.test(x.content))reviews.push({origin,line:x.line,content:x.content,reason:'Linha não associada a movimentação'})}flush();
if(!movements.length&&!reviews.length)reviews.push({origin,line:'?',content:'PDF sem linhas extraídas',reason:'PDF pode ser imagem: OCR ainda não disponível'});return{movements,reviews}}
async function extractPdf(file){const lib=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';const task=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}),doc=await task.promise;const lines=[],itemsAll=[];try{for(let p=1;p<=doc.numPages;p++){const pg=await doc.getPage(p),content=await pg.getTextContent(),items=content.items.filter(t=>t.str?.trim()).map(t=>({s:t.str,str:t.str,x:t.transform?.[4]||0,y:t.transform?.[5]||0,page:p})).sort((a,b)=>b.y-a.y||a.x-b.x);itemsAll.push(...items);const groups=[];for(const item of items){let row=groups.find(r=>Math.abs(r.y-item.y)<2.5);if(!row){row={y:item.y,parts:[]};groups.push(row)}row.parts.push(item)}groups.sort((a,b)=>b.y-a.y);for(let i=0;i<groups.length;i++)lines.push({page:p,line:'p'+p+':'+(i+1),content:groups[i].parts.sort((a,b)=>a.x-b.x).map(t=>t.s).join(' ')})}}finally{await doc.destroy()}return{lines,text:lines.map(x=>x.content).join('\n'),items:itemsAll,pages:doc.numPages}}
function parsePlanPdf(pdf,origin='Plano de contas PDF'){
 const accounts=[],reviews=[],seen=new Set();
 for(const row of pdf.lines||[]){
   const str=String(row.content||'').replace(/\s+/g,' ').trim();
   const match=str.match(/^(\d{1,7})\s+(?:([AS])\s+)?(\d+(?:\.\d+)*)\s+(.+?)\s+([1-9])$/i);
   if(!match)continue;
   const [,code,kind='',classification,description,degree]=match;
   if(seen.has(code)){reviews.push({origin,line:row.line,content:str,reason:'Código repetido'});continue;}
   seen.add(code);accounts.push({code,description:description.trim(),analytic:kind.toUpperCase()!=='S',rawAnalytic:kind.toUpperCase()||'A',classification,degree:Number(degree)});
 }
 const header=(pdf.lines||[]).filter(r=>r.page===1).slice(0,18).map(r=>r.content).join('\n');
 const data=identity(header,origin);
 const docCnpj=header.match(/C\.?\s*N\.?\s*P\.?\s*J\.?\s*:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})/i);
 if(docCnpj)data.cnpj=docCnpj[1].replace(/\D/g,'');
 const company=header.match(/EMPRESA\s*:\s*(.{4,110}?)(?:\s+FOLHA\s*:\s*\d+|$|\n)/im);
 if(company)data.name=company[1].trim();
 data.verified=!!data.cnpj;
 if(!accounts.length)reviews.push({origin,line:'?',content:'Plano sem linhas legíveis',reason:'Nenhuma conta interpretada no PDF'});
 return {accounts,reviews,identity:data,format:'PDF',rawAccounts:accounts.length};
}
function parseItauStatementPdf(pdf,origin,accountId,Core){
 const movements=[],reviews=[],balances=[],rows=[],orphaned=new Map();
 for(let page=1;page<=pdf.pages;page++){
  const items=(pdf.items||[]).filter(x=>x.page===page&&x.str);
  const anchors=items.filter(x=>x.x<83&&/^\d{2}\/\d{2}\/\d{4}$/.test(x.str.trim())).map(x=>({page,y:x.y,rawDate:x.str.trim(),cells:{history:[],party:[],document:[],amount:[],balance:[]}})).sort((a,b)=>b.y-a.y);
  for(const i of items){if(i.x<83||!anchors.length)continue;
   const closest=anchors.reduce((a,b)=>Math.abs(i.y-a.y)<=Math.abs(i.y-b.y)?a:b);
   if(Math.abs(closest.y-i.y)>13.8){if(i.x>=85&&i.x<225&&i.y<anchors.at(-1).y&&Math.abs(i.y-anchors.at(-1).y)<39){const ar=orphaned.get(page)||[];ar.push(i);orphaned.set(page,ar);}continue;}
   const key=i.x<225?'history':i.x<358?'party':i.x<458?'document':i.x<520?'amount':'balance';
   closest.cells[key].push(i);
  }
  for(const a of anchors){
   const cell=key=>a.cells[key].sort((x,y)=>y.y-x.y||x.x-y*x.y/Math.max(x.y,1)).map(x=>x.str.trim()).filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
   rows.push({page,rawDate:a.rawDate,date:dt(a.rawDate),history:cell('history'),party:cell('party'),document:cell('document'),amount:cell('amount'),balance:cell('balance'),line:'p'+page+'@'+Math.round(a.y)});
  }
 }
 for(let i=1;i<rows.length;i++){
   const prev=rows[i-1],cur=rows[i];
   if(cur.page===prev.page+1&&cur.rawDate===prev.rawDate&&/^-?\d{4,}/.test(cur.history)&&prev.amount){
     const leftovers=(orphaned.get(prev.page)||[]).sort((a,b)=>b.y-a.y||a.x-b.x).map(x=>x.str.trim()).join(' ').replace(/\s+/g,' ').trim();
     if(/(?:COMPRA NO D[EÉ]BITO|BOLETO PAGO|PAGAMENTOS PIX)/i.test(leftovers)){cur.history=leftovers+' '+cur.history;orphaned.delete(prev.page);}
   }
   if(cur.page!==prev.page+1||cur.rawDate!==prev.rawDate||prev.amount||!cur.amount)continue;
   if(!/(?:COMPRA NO D[EÉ]BITO|PAGAMENTO|PIX|BOLETO)/i.test(prev.history))continue;
   if(!/^(?:-?\d{4,}|CONTINUA[CÇ][AÃ]O|[-–])\b|^-\d+/i.test(cur.history))continue;
   cur.history=[prev.history,cur.history].filter(Boolean).join(' ').replace(/\s+/g,' ');
   cur.party=[prev.party,cur.party].filter(Boolean).join(' ').trim();
   prev.mergedContinuation=true;
 }
 for(const [page,parts] of orphaned){const content=parts.sort((a,b)=>b.y-a.y||a.x-b.x).map(x=>x.str.trim()).join(' ').replace(/\s+/g,' ').trim();if(content&&/(COMPRA|PIX|PAGAMENTO|BOLETO)/i.test(content))reviews.push({origin,line:'p'+page+'-continuação',content,reason:'Histórico sem data/valor associado'});}
 const moneyExact=/^[+-]?(?:(?:\d{1,3}(?:\.\d{3})+)|\d+),\d{2}$/;
 for(const row of rows){
  const {date,history,party,document,amount,balance,page,line}=row;
  if(/SALDO (?:TOTAL|ANTERIOR)|SUBTOTAL|TOTAL DO DIA/i.test(history)){
   const toks=[...balance.matchAll(/-?\d+(?:\.\d{3})*,\d{2}/g)].map(x=>x[0]);
   if(toks.length===1&&moneyExact.test(toks[0])){try{balances.push({date,cents:Core.money(toks[0]),history,page});}catch(e){reviews.push({origin,line,content:balance,reason:'Saldo inválido'});}}
   else reviews.push({origin,line,content:history+' | '+balance,reason:'Saldo sem valor verificável'});
   continue;
  }
  if(row.mergedContinuation)continue;
  if(!date){reviews.push({origin,line,content:row.rawDate,reason:'Data inválida'});continue;}
  if(!amount||!moneyExact.test(amount)){if(/\d{2}\/\d{2}\/\d{4}/.test(row.rawDate))reviews.push({origin,line,content:[history,party,document,amount,balance].filter(Boolean).join(' | '),reason:'Valor bancário ausente ou ambíguo'});continue;}
  try{const cents=Core.money(amount);if(!cents||!history)throw Error('Valor zero ou histórico vazio');movements.push({id:Core.id(),date,cents,history,party,document,statementBalance:balance||'',accountId,origin,line,page,status:'PENDENTE',counterpart:'',method:'PDF_ITAU_COLUNAS',pdfPage:page});}
  catch(e){reviews.push({origin,line,content:[history,party,document,amount].join(' | '),reason:e.message});}
 }
 const previous=balances.filter(x=>/SALDO ANTERIOR/.test(x.history)).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
 const daily=balances.filter(x=>/SALDO TOTAL DISPON[IÍ]VEL DIA/.test(x.history)).sort((a,b)=>b.date.localeCompare(a.date))[0];
 let balanceCheck={status:'INDETERMINADO',reason:'Extrato sem saldos comparáveis',count:movements.length};
 if(previous&&daily){const relevant=movements.filter(m=>m.date>previous.date&&m.date<=daily.date);const sum=relevant.reduce((s,m)=>s+m.cents,0);const diff=previous.cents+sum-daily.cents;balanceCheck={status:Math.abs(diff)<=1?'OK':'DIVERGENTE',initial:previous.cents,final:daily.cents,net:sum,difference:diff,count:relevant.length,startDate:previous.date,endDate:daily.date};}
 return {movements,reviews,balances,balanceCheck,format:'PDF_ITAU_COLUNAS'};
}
function parseStatementPdf(pdf,origin,accountId,period,Core,bank){
 if(bank==='Itaú'&&pdf?.items?.length)return parseItauStatementPdf(pdf,origin,accountId,Core);
 return {...parseStatementText(pdf.lines,origin,accountId,period,Core),balanceCheck:{status:'INDETERMINADO',reason:'Layout ainda não validado'},format:'PDF_GENERICO'};
}
return{identity,detectBank,parseStatementText,parsePlanPdf,parseStatementPdf,parseItauStatementPdf,extractPdf}
});