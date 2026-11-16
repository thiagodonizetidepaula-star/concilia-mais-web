/* Leitor isolado Bradesco Net Empresa / PDF Type 3.
   OCR local no navegador. Nunca confirma códigos contábeis ou força valor sem conferência do saldo.
   Não modifica leitores dos outros bancos. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.ConciliaBradesco=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clean=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const moneyPattern=/^-?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}$/;
const datePattern=/^(\d{2})\/(\d{2})\/(20\d{2})$/;
function needsOcr(pdf){
 const text=String(pdf?.text||'');
 if(text.length<30)return true;
 const n=[...text].filter(c=>c.charCodeAt(0)<32&&!/\r|\n|\t/.test(c)).length;
 const readable=(text.match(/[a-zA-ZÀ-ÿ]{4,}/g)||[]).length;
 return n>10||n>text.length*.012||readable<Math.max(5,text.length/200);
}
function parseMoney(raw){
 const text=String(raw||'').trim().replace(/^[\sR$]+/g,'').replace(/\s/g,'').replace(/[−–—]/g,'-').replace(/^[«“]+/,'-');
 if(!moneyPattern.test(text))return null;
 const sign=text[0]==='-'?-1:1;
 const v=text.replace(/^-/, '').replace(/\./g,'').replace(',','.');
 const cents=Math.round(Number(v)*100)*sign;
 return Number.isSafeInteger(cents)&&cents!==0?cents:null;
}
function dateIso(s){const match=String(s||'').trim().match(datePattern);if(!match)return '';
 const [,d,m,y]=match,iso=y+'-'+m+'-'+d;
 const dt=new Date(iso+'T12:00:00Z');
 return !Number.isNaN(dt.valueOf())&&dt.toISOString().slice(0,10)===iso?iso:'';
}
function readTsv(tsv){
 const text=String(tsv||'').trim();
 const lines=text.split(/\r?\n/);
 if(lines.length<2||!lines[0].includes('left')||!lines[0].includes('text'))return [];
 const headers=lines.shift().split('\t');
 const ix=Object.fromEntries(headers.map((key,i)=>[key,i]));
 const rows=[];
 for(const line of lines){
  const parts=line.split('\t');
  if(parts[ix.level]!=='5')continue;
  const value=parts.slice(ix.text).join('\t').trim();
  const left=Number(parts[ix.left]),top=Number(parts[ix.top]),w=Number(parts[ix.width]),h=Number(parts[ix.height]),conf=Number(parts[ix.conf]);
  if(!value||![left,top,w,h].every(Number.isFinite))continue;
  rows.push({word:value,x:left,y:top,w,h,conf,
   key:[parts[ix.block_num],parts[ix.par_num],parts[ix.line_num]].join(':')});
 }
 return rows;
}
function parsePageTsv(tsv,page,canvasWidth,Core,origin,accountId,period,carry){
 const words=readTsv(tsv),groups=new Map();
 for(const w of words){if(!groups.has(w.key))groups.set(w.key,[]);groups.get(w.key).push(w);}
 const lines=[...groups.values()].map(items=>({
  items:items.sort((a,b)=>a.x-b.x),
  y:Math.min(...items.map(w=>w.y)),
  content:items.map(w=>w.word).join(' ').replace(/\s+/g,' ').trim()
 })).sort((a,b)=>a.y-b.y);
 const movements=[],reviews=[],state={date:carry?.date||'',balance:carry?.balance??null,prevLine:'',candidate:null};
 let began=false,lookedLikeStatement=false,scanned=0;
 const priceTokens=items=>items.filter(w=>/[\d,]/.test(w.word)).map(w=>w.word);
 const wordsAt=(items,min,max)=>items.filter(w=>w.x/canvasWidth>=min&&w.x/canvasWidth<max);
 const candidates=t=>{
  const variants=[t.join('').replace(/R\$/g,''),t.join(' ').replace(/R\$/g,'')];
  for(const value of variants){
   const m=value.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}/g)||[];
   if(m.length===1){const money=parseMoney(m[0]);if(money!==null)return {cents:money,raw:m[0]};}
  }
  return null;
 };
 const finalize=()=>{
  const rec=state.candidate;if(!rec)return;
  state.candidate=null;
  if(!rec.date){reviews.push({origin,line:'p'+page+'@'+rec.y,content:rec.content,reason:'OCR Bradesco: data não identificada; lançamento não importado'});return;}
  if(rec.balance==null||rec.amount==null){
   reviews.push({origin,line:'p'+page+'@'+rec.y,content:rec.content,reason:'OCR Bradesco: valor ou saldo não confiável; lançamento não importado'});return;
  }
  if(state.balance===null){
   reviews.push({origin,line:'p'+page+'@'+rec.y,content:rec.content,reason:'OCR Bradesco: saldo anterior ausente para validar operação; lançamento não importado'});
   state.balance=rec.balance;return;
  }
  const delta=rec.balance-state.balance;
  if(delta!==rec.amount||delta===0){
   reviews.push({origin,line:'p'+page+'@'+rec.y,content:rec.content,reason:'OCR Bradesco: divergência entre valor da coluna e diferença de saldo; requer conferência manual'});
   // Não avançar saldo: registros posteriores não devem aparentar conciliação íntegra.
   state.balance=null;return;
  }
  if(!rec.history||rec.history.length<3){
   reviews.push({origin,line:'p'+page+'@'+rec.y,content:rec.content,reason:'OCR Bradesco: histórico não reconhecido; requer conferência manual'});
   state.balance=rec.balance;return;
  }
  movements.push({id:Core.id(),date:rec.date,cents:delta,history:rec.history,party:'',accountId,origin,line:'p'+page+'@'+rec.y,status:'PENDENTE',counterpart:'',method:'PDF_BRADESCO_OCR',page});
  state.balance=rec.balance;
 };
 for(const ln of lines){
  const str=ln.content,items=ln.items,normalized=clean(str);
  if(/(?:EXTRATO (?:MENSAL|DE)|LANCAMENTO|CREDITO)/.test(normalized))lookedLikeStatement=true;
  if(/(?:DATA.*LANCAMENTO|DATA.*CREDITO|CREDITO.*DEBITO.*SALDO)/.test(normalized)){began=true;continue;}
  if(!began&&/SALDO ANTERIOR/.test(normalized))began=true;
  if(!began)continue;
  if(/(?:TOTAL\s+GERAL|SALDO\s+FINAL|SALDOS\s+DIARIOS|EXTRATO\s+DE:|EXTRATO\s+MENSAL)/.test(normalized)&&!/\bSALDO ANTERIOR\b/.test(normalized))continue;
  const d=items.filter(w=>w.x/canvasWidth<.135).map(w=>w.word).find(w=>dateIso(w));
  if(d)state.date=dateIso(d);
  const history=wordsAt(items,.13,.43).map(x=>x.word).join(' ').trim();
  const credit=candidates(priceTokens(wordsAt(items,.53,.69)));
  const debit=candidates(priceTokens(wordsAt(items,.69,.81)));
  const balance=candidates(priceTokens(wordsAt(items,.82,.99)));
  const hasAmount=Boolean(credit||debit);
  if(/SALDO ANTERIOR/.test(normalized)&&balance){
   finalize();state.balance=balance.cents;continue;
  }
  if(hasAmount){
   finalize();scanned++;
   const both=Boolean(credit&&debit);
   state.candidate={date:state.date,y:Math.round(ln.y),balance:balance?.cents??null,
    amount:both?null:credit?Math.abs(credit.cents):debit?-Math.abs(debit.cents):null,
    history:history.replace(/^\s*(?:SALDO|TOTAL)\s*$/i,'').trim(),
    content:str};
   if(both)state.candidate.content+=' [crédito e débito simultâneos: ambíguo]';
  }else if(balance&&state.candidate){
   if(state.candidate.balance==null)state.candidate.balance=balance.cents;
  }else if(state.candidate&&history&&!/\b(?:PAGINA|LAN[CÇ]AMENTO|DCTO|SALDO|CREDITO|DEBITO)\b/i.test(normalized)){
   // Complementos da linha, como REM: fornecedor ou DES: beneficiário.
   if(state.candidate.history.length<180)state.candidate.history+=' '+history;
  }
 }
 finalize();
 return {movements,reviews,carry:{date:state.date,balance:state.balance},scanned,looksLikeStatement:lookedLikeStatement};
}
let tesseractLoading;
async function getOcr(){
 if(typeof document==='undefined')throw Error('OCR disponível apenas no navegador.');
 if(root.Tesseract?.createWorker)return root.Tesseract;
 if(!tesseractLoading)tesseractLoading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  script.async=true;script.onload=()=>root.Tesseract?.createWorker?resolve(root.Tesseract):reject(Error('Biblioteca OCR indisponível.'));
  script.onerror=()=>reject(Error('Não foi possível carregar o leitor OCR. Verifique a conexão à internet.'));
  document.head.appendChild(script);
 }).catch(e=>{tesseractLoading=null;throw e});
 return tesseractLoading;
}
async function parseFile(file,origin,accountId,period,Core,notify){
 const ocr=await getOcr();
 const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
 const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
 if(doc.numPages>80){await doc.destroy();throw Error('PDF Bradesco com mais de 80 páginas: divida em lotes para OCR.');}
 const result={movements:[],reviews:[],format:'PDF_BRADESCO_OCR_VALIDADO',balanceCheck:{status:'INDETERMINADO',reason:'OCR conservador: conferir saldo e revisões antes da contabilização'},ocrCnpj:''};
 let worker;
 try{
  worker=await ocr.createWorker('por',1,{logger:m=>{if(m.status==='recognizing text')notify?.('Bradesco: reconhecimento visual em andamento ('+Math.round((m.progress||0)*100)+'%)...');}});
  let carry={date:'',balance:null};
  for(let page=1;page<=doc.numPages;page++){
   notify?.('Bradesco: lendo visualmente página '+page+' de '+doc.numPages+'...');
   const pg=await doc.getPage(page),viewport=pg.getViewport({scale:2.0});
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)throw Error('Canvas indisponível para leitura OCR.');
   await pg.render({canvasContext:ctx,viewport}).promise;
   const {data}=await worker.recognize(canvas,{}, {text:true,tsv:true});
   const tsv=data?.tsv||'';
   if(!tsv)throw Error('O leitor OCR não retornou as posições das palavras. Atualize e tente novamente.');
   if(page===1){const header=(data.text||'').slice(0,3000);const found=header.match(/CNPJ:\s*0?(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i);if(found)result.ocrCnpj=found[1].replace(/\D/g,'');}
   const parsed=parsePageTsv(tsv,page,canvas.width,Core,origin,accountId,period,carry);
   result.movements.push(...parsed.movements);result.reviews.push(...parsed.reviews);
   carry=parsed.carry;
   if(parsed.scanned===0)result.reviews.push({origin,line:'p'+page,content:'Sem valores validados nesta página',reason:'OCR Bradesco: página sem movimentações reconhecidas'});
   canvas.width=0;canvas.height=0;
  }
  if(result.reviews.length)result.reviews.unshift({origin,line:'OCR',content:result.reviews.length+' linha(s) precisam de revisão; nenhum valor duvidoso foi importado',reason:'Leitura visual conservadora do PDF Bradesco'});
  if(!result.movements.length)throw Error('Bradesco identificado, mas o OCR não encontrou operações seguras. Solicite OFX/CSV ao cliente ou revise o PDF; não foram criados lançamentos.');
  result.balanceCheck={status:'INDETERMINADO',reason:'OCR validou '+result.movements.length+' lançamento(s) por variação do saldo; confira '+result.reviews.length+' revisão(ões) antes da contabilização'};
  return result;
 }finally{try{await worker?.terminate()}catch{}await doc.destroy();}
}
return {needsOcr,parseMoney,parsePageTsv,parseFile};
});