/* Concilia+ • adaptador piloto para plano Domínio PDF + Itaú PJ PDF.
 * Processa documentos em memória local. Não envia PDFs ao Render. */
(function(P){
"use strict";
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
const originalBank=P.detectBank,originalIdentity=P.identity;
P.detectBank=(text,name="")=>/TAR\s+PLANO\s+ITAU\s+EMP|ITAU\s+UNIBANCO/i.test(norm(text))?"Itaú":originalBank(text,name);
P.identity=(text,name="")=>{
 const v=originalIdentity(text,name),s=String(text||"");
 const found=s.match(/C\.?\s*N\.?\s*P\.?\s*J\.?\s*:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})/i);
 const company=s.match(/EMPRESA\s*:\s*([^\n]+?)(?:\s+FOLHA\s*:\s*\d+|$)/im);
 if(found)v.cnpj=found[1].replace(/\D/g,"");
 if(company)v.name=company[1].trim();
 v.verified=!!v.cnpj;
 return v;
};
P.extractPdf=async file=>{
 const lib=await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
 lib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
 const task=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
 const doc=await task.promise,lines=[],itemsAll=[],pages=doc.numPages;
 try{
  for(let p=1;p<=pages;p++){
   const pg=await doc.getPage(p),c=await pg.getTextContent();
   const items=c.items.filter(t=>typeof t.str==="string"&&t.str.trim()).map(t=>({str:t.str,x:Number(t.transform?.[4]||0),y:Number(t.transform?.[5]||0),page:p})).sort((a,b)=>b.y-a.y||a.x-b.x);
   itemsAll.push(...items);
   const groups=[];
   for(const item of items){let row=groups.find(r=>Math.abs(r.y-item.y)<2.5);if(!row){row={y:item.y,items:[]};groups.push(row)}row.items.push(item);}
   groups.sort((a,b)=>b.y-a.y);
   for(let i=0;i<groups.length;i++)lines.push({page:p,line:"p"+p+":"+(i+1),content:groups[i].items.sort((a,b)=>a.x-b.x).map(x=>x.str).join(" ")});
  }
 }finally{await doc.destroy()}
 return{lines,text:lines.map(x=>x.content).join("\n"),items:itemsAll,pages};
};
P.parsePlanPdf=(pdf,origin="plano.pdf")=>{
 const accounts=[],reviews=[],seen=new Set();
 for(const r of pdf.lines||[]){
  const line=String(r.content||"").replace(/\s+/g," ").trim();
  const match=line.match(/^(\d{1,7})\s+([AS])\s+(\d+(?:\.\d+)*)\s+(.+?)\s+([1-9])$/i);
  if(!match)continue;
  const [,code,type,classification,description,degree]=match;
  if(seen.has(code)){reviews.push({origin,line:r.line,content:line,reason:"Código duplicado: não substituído"});continue}
  seen.add(code);
  accounts.push({code,analytic:type.toUpperCase()==="A",rawAnalytic:type,classification,description:description.trim(),degree:Number(degree)});
 }
 const meta=(pdf.lines||[]).filter(x=>x.page===1).slice(0,20).map(x=>x.content).join("\n");
 const identity=P.identity(meta,origin);
 if(!accounts.length)reviews.push({origin,line:"?",content:"PDF sem contas reconhecidas",reason:"Layout não suportado ou PDF digitalizado; requer revisão"});
 return{accounts,reviews,identity};
};
const dateBR=s=>{const m=String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)return"";const v=m[3]+"-"+m[2]+"-"+m[1],d=new Date(v+"T12:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v?v:""};
P.parseStatementPdf=(pdf,origin,accountId,period,Core,bank)=>{
 if(bank!=="Itaú"||!pdf.items?.length)return{...P.parseStatementText(pdf.lines,origin,accountId,period,Core),balanceCheck:{status:"INDETERMINADO",reason:"Layout bancário não validado"}};
 const movements=[],reviews=[],balances=[],rows=[],orphans=new Map();
 for(let page=1;page<=pdf.pages;page++){
  const items=pdf.items.filter(x=>x.page===page&&x.str),anchors=items.filter(i=>i.x<83&&/^\d{2}\/\d{2}\/\d{4}$/.test(i.str.trim())).map(i=>({page,y:i.y,rawDate:i.str.trim(),cells:{history:[],party:[],document:[],amount:[],balance:[]}})).sort((a,b)=>b.y-a.y);
  for(const i of items){
   if(i.x<83||!anchors.length)continue;
   const closest=anchors.reduce((a,b)=>Math.abs(i.y-a.y)<=Math.abs(i.y-b.y)?a:b);
   if(Math.abs(i.y-closest.y)>13.8){
    if(i.x>=85&&i.x<225&&i.y<anchors.at(-1).y&&Math.abs(i.y-anchors.at(-1).y)<39){const a=orphans.get(page)||[];a.push(i);orphans.set(page,a);}
    continue;
   }
   const col=i.x<225?"history":i.x<358?"party":i.x<458?"document":i.x<520?"amount":"balance";
   closest.cells[col].push(i);
  }
  for(const a of anchors){
   const get=k=>a.cells[k].sort((x,y)=>y.y-x.y||x.x-y.x).map(x=>x.str.trim()).filter(Boolean).join(" ").replace(/\s+/g," ").trim();
   rows.push({page,rawDate:a.rawDate,date:dateBR(a.rawDate),history:get("history"),party:get("party"),document:get("document"),amount:get("amount"),balance:get("balance"),line:"p"+page+"@"+Math.round(a.y)});
  }
 }
 for(let k=1;k<rows.length;k++){
  const prev=rows[k-1],cur=rows[k];
  if(cur.page===prev.page+1&&cur.rawDate===prev.rawDate&&/^-?\d{4,}/.test(cur.history)&&prev.amount){
   const unused=(orphans.get(prev.page)||[]).sort((a,b)=>b.y-a.y||a.x-b.x).map(x=>x.str.trim()).join(" ").replace(/\s+/g," ").trim();
   if(/COMPRA NO D[EÉ]BITO|BOLETO PAGO|PAGAMENTOS PIX/i.test(unused)){cur.history=unused+" "+cur.history;orphans.delete(prev.page);}
  }
  if(cur.page!==prev.page+1||cur.rawDate!==prev.rawDate||prev.amount||!cur.amount)continue;
  if(!/COMPRA NO D[EÉ]BITO|PAGAMENTO|PIX|BOLETO/i.test(prev.history))continue;
  if(!/^-?\d{4,}|^-/.test(cur.history))continue;
  cur.history=[prev.history,cur.history].filter(Boolean).join(" ");cur.party=[prev.party,cur.party].filter(Boolean).join(" ");prev.merged=true;
 }
 for(const [page,a] of orphans){
  const v=a.sort((x,y)=>y.y-x.y||x.x-y.x).map(x=>x.str).join(" ").replace(/\s+/g," ").trim();
  if(/COMPRA|PIX|PAGAMENTO|BOLETO/i.test(v))reviews.push({origin,line:"p"+page+"-quebra",content:v,reason:"Histórico sem data/valor associado"});
 }
 const exact=/^[+-]?(?:(?:\d{1,3}(?:\.\d{3})+)|\d+),\d{2}$/;
 for(const r of rows){
  if(/SALDO (?:TOTAL|ANTERIOR)|SUBTOTAL|TOTAL DO DIA/i.test(r.history)){
   const values=[...r.balance.matchAll(/-?\d+(?:\.\d{3})*,\d{2}/g)].map(x=>x[0]);
   if(values.length===1&&exact.test(values[0]))balances.push({date:r.date,cents:Core.money(values[0]),history:r.history,page:r.page});
   else reviews.push({origin,line:r.line,content:r.history+" | "+r.balance,reason:"Saldo não interpretado"});
   continue;
  }
  if(r.merged)continue;
  if(!r.date){reviews.push({origin,line:r.line,content:r.rawDate,reason:"Data inválida"});continue}
  if(!exact.test(r.amount)){
   if(r.history!=="14:46:03")reviews.push({origin,line:r.line,content:[r.history,r.party,r.document,r.amount].join(" | "),reason:"Valor de movimentação não interpretado"});
   continue;
  }
  try{
   const cents=Core.money(r.amount);
   if(!cents||!r.history)throw Error("Valor ou histórico vazio");
   movements.push({id:Core.id(),date:r.date,cents,history:r.history,party:r.party,document:r.document,accountId,origin,line:r.line,pdfPage:r.page,method:"PDF_ITAU_COLUNAS",status:"PENDENTE",counterpart:""});
  }catch(e){reviews.push({origin,line:r.line,content:r.history+" | "+r.amount,reason:e.message})}
 }
 const first=balances.filter(x=>/SALDO ANTERIOR/i.test(x.history)).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
 const last=balances.filter(x=>/SALDO TOTAL DISPON[IÍ]VEL DIA/i.test(x.history)).sort((a,b)=>b.date.localeCompare(a.date))[0];
 let balanceCheck={status:"INDETERMINADO",reason:"Não há saldos de abertura e fechamento para conferir"};
 if(first&&last){const valid=movements.filter(x=>x.date>first.date&&x.date<=last.date),net=valid.reduce((v,x)=>v+x.cents,0),difference=first.cents+net-last.cents;balanceCheck={status:Math.abs(difference)<=1?"OK":"DIVERGENTE",initial:first.cents,final:last.cents,net,difference,count:valid.length,startDate:first.date,endDate:last.date};}
 return{movements,reviews,balances,balanceCheck,format:"PDF_ITAU_COLUNAS"};
};
})(window.ConciliaPDF);
