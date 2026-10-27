/* Leitores verificáveis de PDFs digitais: PagBank, Stone, Nubank e Razão Domínio.
   Não confirma contabilizações e não envia documentos para serviços externos. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ConciliaLayouts=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const amount=/[+-]?\s*(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}/g;
const dateIso=s=>{let m=String(s).match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);if(!m)return '';let y=m[3].length===2?'20'+m[3]:m[3];return y+'-'+m[2]+'-'+m[1]};
function bankOf(pdf,name=''){const start=(pdf.lines||[]).filter(x=>x.page===1).slice(0,28).map(x=>x.content).join(' '),all=pdf.text||'',n=norm(start),f=norm(name);
 if(n.includes('GERENCIADOR CAIXA')||n.includes('EXTRATO POR PERIODO')&&n.includes('CLIENTE')||f.includes('EXTRATO CAIXA'))return 'Caixa';
 if(n.includes('STONE INSTITUICAO DE PAGAMENTO')||n.includes('STONE INSTITUICAO'))return 'Stone';
 if(n.includes('PAGSEGURO INTERNET')||n.includes('EXTRATO DA CONTA')&&n.includes('PAGSEGURO'))return 'PagBank';
 if(n.includes('TOTAL DE ENTRADAS')&&n.includes('TOTAL DE SAIDAS')&&/SETEMBRO|AGOSTO|OUTUBRO|JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|NOVEMBRO|DEZEMBRO/.test(n))return 'Nubank';
 if(n.includes('LANCAMENTOS DO PERIODO')&&n.includes('RAZAO SOCIAL')&&n.includes('SALDO'))return 'Itaú';
 if(f.includes('PAGBANK'))return 'PagBank';if(f.includes('STONE'))return 'Stone';
 if(f.includes('NUBANK'))return 'Nubank';if(f.includes('ITAU'))return 'Itaú';
 return '';
}
function documentCnpj(pdf){const h=(pdf.lines||[]).filter(x=>x.page===1).slice(0,35).map(x=>x.content).join(' ');return (h.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)||[])[0]?.replace(/\D/g,'')||''}
function make(Core,origin,accountId,date,cents,history,page,party=''){return{id:Core.id(),date,cents,history:history.trim(),party,accountId,origin,line:'p'+page,status:'PENDENTE',counterpart:'',method:'PDF_LAYOUT_VALIDAVEL',page}}
function money(s,Core){return Core.money(String(s).replace(/R\$\s*/g,'').replace(/\s/g,''))}
function linesOf(pdf){return (pdf.lines||[]).map(x=>({page:x.page||1,line:x.line||'',s:String(x.content||'').replace(/\s+/g,' ').trim()})).filter(x=>x.s)}
function parsePagBank(pdf,origin,accountId,Core){let movements=[],reviews=[],balances=[];
 for(const row of linesOf(pdf)){let match=row.s.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+)$/);if(!match)continue;
 const date=dateIso(match[1]),rest=match[2],found=[...rest.matchAll(/[+-]?\s*R\$\s*(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}/g)];
 if(/^SALDO DO DIA/i.test(rest)){if(found.length===1)balances.push({date,cents:money(found[0][0],Core),page:row.page});continue}
 if(found.length!==1){reviews.push({origin,line:row.line,content:row.s,reason:'Valor não localizado ou múltiplo no PagBank'});continue}
 const cents=money(found[0][0],Core),history=rest.slice(0,found[0].index).trim();
 if(!cents||!history){reviews.push({origin,line:row.line,content:row.s,reason:'Movimento sem histórico/valor'});continue}
 movements.push(make(Core,origin,accountId,date,cents,history,row.page));
 }
 const lastBalance=balances.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];const final=lastBalance?.cents;
 return{movements,reviews,balances,balanceCheck:{status:'INDETERMINADO',final,endDate:lastBalance?.date,reason:'Extrato com saldo diário, mas sem saldo inicial declarado; conferir'},format:'PDF_PAGBANK',parsedCount:movements.length};
}
function parseStone(pdf,origin,accountId,Core){const rows=linesOf(pdf),movements=[],reviews=[],balances=[];let current=null;
 const flush=()=>{if(!current)return;const r=current;current=null;const parts=[...r.text.matchAll(/[+-]?\s*R\$\s*(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}/g)];
 if(!parts.length){reviews.push({origin,line:r.line,content:r.text,reason:'Stone: valor não localizado'});return}
 const cents=money(parts[0][0],Core)*(r.type==='Saída'&&money(parts[0][0],Core)>0?-1:1);
 const tail=r.text.slice(parts[0].index+parts[0][0].length);
 const m2=tail.match(/R\$\s*(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}/);
 if(m2){balances.push({date:r.date,cents:money(m2[0],Core),page:r.page})}
 const history=(r.text.slice(0,parts[0].index)+' '+tail.replace(m2?.[0]||'','')).replace(/\s+/g,' ').trim();
 if(!cents||!history){reviews.push({origin,line:r.line,content:r.text,reason:'Stone: lançamento incompleto'});return}
 movements.push(make(Core,origin,accountId,r.date,cents,history,r.page));
 };
 for(const row of rows){const m=row.s.match(/^(\d{2}\/\d{2}\/\d{2,4})\s+(Entrada|Saída)\s+(.+)$/i);
 if(m){flush();current={date:dateIso(m[1]),type:/saida|saída/i.test(m[2])?'Saída':'Entrada',text:m[3],page:row.page,line:row.line};continue}
 if(current&&!/^(?:PÁGINA|EXTRATO|DATA\s+TIPO|OUVIDORIA|INFORMAÇÕES|CÓDIGO\s+DA|DÚVIDAS)/i.test(row.s)&&current.text.length<1200){current.text+=' '+row.s}
 }
 flush();
 const lastBalance=balances.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];const final=lastBalance?.cents;
 return{movements,reviews,balances,balanceCheck:{status:'INDETERMINADO',final,endDate:lastBalance?.date,reason:'Stone: validar primeiro e último saldo da competência'},format:'PDF_STONE',parsedCount:movements.length};
}
const months={JAN:1,FEV:2,MAR:3,ABR:4,MAI:5,JUN:6,JUL:7,AGO:8,SET:9,OUT:10,NOV:11,DEZ:12};
function parseNubank(pdf,origin,accountId,Core){const movements=[],reviews=[],rows=linesOf(pdf);let currentDate='',direction=0,pending=null;
 const flush=()=>{if(!pending)return;const p=pending;pending=null;const matches=[...p.text.matchAll(/(?:\+|-)?\s*(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}/g)];if(!matches.length){reviews.push({origin,line:p.line,content:p.text,reason:'Nubank: sem valor no histórico'});return}
 // Valor da transação é o último valor monetário na primeira linha; informações de agência não contam.
 const val=matches[0][0],v=Math.abs(money(val,Core)),cents=v*p.sign;
 if(!currentDate||!v){reviews.push({origin,line:p.line,content:p.text,reason:'Nubank: data/valor incerto'});return}
 movements.push(make(Core,origin,accountId,p.date,cents,p.text.replace(val,'').trim(),p.page));
 };
 for(const row of rows){const dat=row.s.match(/^(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(\d{4})\b/i);
 if(dat){flush();currentDate=dat[3]+'-'+String(months[dat[2].toUpperCase()]).padStart(2,'0')+'-'+dat[1];}
 const n=norm(row.s);
 if(/TOTAL DE ENTRADAS/.test(n)){flush();direction=1;continue}
 if(/TOTAL DE SAIDAS/.test(n)){flush();direction=-1;continue}
 if(/^SALDO DO DIA|SALDO FINAL DO PERIODO|RENDIMENTO LIQUIDO|SALDO INICIAL|MOVIMENTACOES|VALORES EM/.test(n)){flush();continue}
 const mt=n.match(/(TRANSFERENCIA RECEBIDA PELO PIX|TRANSFERENCIA ENVIADA PELO PIX|RESGATE DE EMPRESTIMO|PAGAMENTO DE FATURA|RECEBIMENTO|PAGAMENTO DE BOLETO|PAGAMENTO PIX|ESTORNO)/);
 if(mt&&currentDate){flush();const signs=/RECEBIDA|RECEBIMENTO|ESTORNO/.test(mt[1])?1:/ENVIADA|RESGATE|PAGAMENTO/.test(mt[1])?-1:direction;
   pending={date:currentDate,sign:signs||direction,page:row.page,line:row.line,text:row.s};
   if(!pending.sign){reviews.push({origin,line:row.line,content:row.s,reason:'Nubank: direção não conhecida'});pending=null;}
   continue;
 }
 if(pending&&row.s&&!/^(?:PÁGINA|EXTRATO|TARIFAS|SALDO FINAL|TEM ALGUMA DÚVIDA|NU PAGAMENTOS)/i.test(row.s)&&pending.text.length<450)pending.text+=' '+row.s;
 }
 flush();
 const txt=pdf.text||'';
 const ini=txt.match(/Saldo inicial\s*(?:R\$\s*)?([\d.,]+)/i),fim=txt.match(/Saldo final do período\s*(?:R\$\s*)?([\d.,]+)/i);
 let balanceCheck={status:'INDETERMINADO',reason:'Nubank: verificar saldo inicial e final manualmente'};
 if(ini&&fim){const initial=money(ini[1],Core),final=money(fim[1],Core),sum=movements.reduce((a,b)=>a+b.cents,0),diff=initial+sum-final;
 balanceCheck={status:Math.abs(diff)<=1?'OK':'DIVERGENTE',initial,final,net:sum,difference:diff,count:movements.length,reason:'Conferência de totais inicial/final Nubank'};}
 return{movements,reviews,balanceCheck,format:'PDF_NUBANK',parsedCount:movements.length};
}
function parseDominioLedgerPdf(pdf,origin,Core){const all=pdf.items||[],pages=pdf.pages||1,entries=[],reviews=[],summary=[];let bankCode='';
 for(let p=1;p<=pages;p++){
 const lines=linesOf(pdf).filter(x=>x.page===p).map(x=>x.s);
 const header=lines.join(' ');
 const bank=header.match(/\bCONTA\s*:\s*(\d{1,8})\s*-/i);
 if(bank)bankCode=bank[1];
 if(!bankCode)throw Error('Razão PDF sem código da conta bancária identificável. Confira o layout do Domínio.');
 const words=all.filter(x=>x.page===p&&x.str?.trim());
 const anchors=words.filter(x=>x.x<55&&/^\d{2}\/\d{2}\/\d{4}$/.test(x.str.trim())).sort((a,b)=>b.y-a.y);
 for(const anchor of anchors){
  const candidates=words.filter(x=>Math.abs(x.y-anchor.y)<3.5);
  const field=(lo,hi)=>candidates.filter(x=>x.x>=lo&&x.x<hi).sort((x,y)=>x.x-y.x).map(x=>x.str.trim()).filter(Boolean).join(' ').trim();
  const number=field(56,80),history=field(80,266),counterpart=field(268,325),debitText=field(328,380),creditText=field(381,441);
  if(!/^\d+$/.test(number)||!/^\d+$/.test(counterpart)){reviews.push({origin,line:'p'+p+'@'+Math.round(anchor.y),content:anchor.str+' '+number+' '+history+' '+counterpart,reason:'Razão: número ou contrapartida ausente'});continue}
  if(!!debitText===!!creditText){reviews.push({origin,line:'p'+p+'@'+Math.round(anchor.y),content:[number,history,debitText,creditText].join(' | '),reason:'Razão: débito/crédito ausente ou duplo'});continue}
  const amountText=debitText||creditText;
  try{
   const cents=Math.abs(money(amountText,Core)),date=dateIso(anchor.str);
   if(!cents||!date)throw Error('Razão: valor/data inválido');
   entries.push({id:Core.id(),date,debit:debitText?bankCode:counterpart,credit:creditText?bankCode:counterpart,cents,history:history||'(histórico no PDF)',origin,line:'p'+p+'@'+Math.round(anchor.y),accountCode:bankCode,documentNo:number});
  }catch(e){reviews.push({origin,line:'p'+p,content:amountText,reason:e.message})}
 }
 }
 if(!entries.length)reviews.push({origin,line:'?',content:'Documento sem lançamentos interpretáveis',reason:'Razão Domínio sem movimentos válidos'});
 const openingText=linesOf(pdf).find(r=>/SALDO ANTERIOR/i.test(r.s))?.s||'';
 const openMatch=openingText.match(/(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})\s*([DC])/i);
 let openingBalance=null;
 if(openMatch){openingBalance=money(openMatch[1]+','+openMatch[2],Core)*(openMatch[3].toUpperCase()==='C'?-1:1)}
 return{entries,reviews,format:'RAZAO_PDF_DOMINIO',accountCode:bankCode,openingBalance};
}
function parseStatement(pdf,origin,accountId,period,Core,bank,fallback){switch(bank){case'PagBank':return parsePagBank(pdf,origin,accountId,Core);case'Stone':return parseStone(pdf,origin,accountId,Core);case'Nubank':return parseNubank(pdf,origin,accountId,Core);default:return fallback();}}
return{bankOf,documentCnpj,parseStatement,parsePagBank,parseStone,parseNubank,parseDominioLedgerPdf};
});
