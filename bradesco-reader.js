/* Concilia+ - Leitor específico de extratos Bradesco Net Empresa.
   Conservador: não cria lançamentos sem data, histórico, coluna de valor e saldo verificáveis.
   Mantém leitores dos outros bancos completamente independentes.
   O modo de fontes Type3 recupera APENAS o modelo de PDFCreator validado com
   o documento TAZ enviado; layouts/encodings diferentes não são adivinhados. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 root.ConciliaBradesco=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const GLYPHS=[
 "Extrao Mensl/PídTAZ ELRODPSICM|NJ:05.2764/1-9omedusáriaclvtpçã8h:Ag269|C05341-7gêní($)3,DLçmc.éi(R$)bSONTIQUBVXGHF*",
 "DatLnçmeoc.Crédi (R$)bSl13/0726PIX RECBDOM:TALUGSH98.,NQ5-4VF*Z",
 "DatLnçmeoc.Crédi (R$)bSlPIX RECBDOM:TALUGSH2/071348.5,FNQ9-6VZ*T23714,-9 5sdaocimtêbeàhãujlrçõÚs",
 "DatLnçmeoc.Crédi (R$)bSl07/826AONTEI1.3,59TRANSF CPGEDIUOML4XB:HV*-ZQ1387,-52046svFá/PuHóVÁsdaocimtêbeàhãujlrçõ"
 ];
 const MONEY=/^[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}$/;
 const DATE=/^\d{2}\/\d{2}\/\d{4}$/;
 const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 const decode=(value,page)=>[...String(value??'')].map(ch=>{
   const n=ch.codePointAt(0);
   return n<GLYPHS[page].length?GLYPHS[page][n]:ch;
 }).join('');
 const asMoney=x=>{const s=String(x).replace(/\./g,'').replace(',','.');const n=Number(s);return Number.isFinite(n)?Math.round(n*100):NaN};
 const iso=x=>{if(!DATE.test(x))return '';const [d,m,y]=x.split('/'),v=y+'-'+m+'-'+d;const dt=new Date(v+'T12:00:00Z');return !Number.isNaN(dt.getTime())&&dt.toISOString().slice(0,10)===v?v:''};
 const review=(origin,page,line,content,reason)=>({origin,line:'p'+page+':'+Math.round(line),content:String(content).slice(0,270),reason});
 function prepare(pdf,origin){
   const raw=pdf?.items||[];
   if(!raw.length)throw Error('Bradesco: PDF sem itens de texto. Se for imagem digitalizada, solicite OFX/CSV ou um PDF com texto selecionável.');
   const first=raw.filter(x=>x.page===1).slice(0,75).map(x=>x.str??x.s).join(' ');
   const plain=norm(first);
   const isPlain=plain.includes('EXTRATO MENSAL')||plain.includes('LANCAMENTO');
   if(!isPlain&&pdf.pages!==4)throw Error('Bradesco: PDF com fonte sem mapa de caracteres conhecido. Exporte OFX/CSV; não é seguro tentar converter valores automaticamente.');
   const legacyHeader=raw.filter(x=>x.page===1).slice(0,55).map(x=>decode(x.str??x.s,0)).join(' ');
   const legacy=(!isPlain&&norm(legacyHeader).includes('EXTRATO')&&norm(legacyHeader).includes('MENSAL')&&norm(legacyHeader).includes('TAZ')&&norm(legacyHeader).includes('ELETRODEPOSICAO'));
   if(!isPlain&&!legacy)throw Error('Bradesco: texto codificado em fonte Type3 desconhecida. Nenhum lançamento foi importado por segurança. Solicite OFX ou CSV.');
   const items=raw.map(x=>{
     const page=Number(x.page||1),source=String(x.str??x.s??'');
     if(legacy&&(page<1||page>GLYPHS.length))throw Error('Bradesco: página com fonte não cadastrada; não é seguro continuar.');
     return {page,x:Number(x.x),y:-Number(x.y),s:legacy?decode(source,page-1):source};
   }).filter(x=>Number.isFinite(x.x)&&Number.isFinite(x.y));
   if(!items.some(x=>DATE.test(x.s.trim()))&&legacy)throw Error('Bradesco: a decodificação do documento não recuperou datas válidas.');
   return {items,legacy};
 }
 function parse(pdf,origin,accountId,Core){
   const {items,legacy}=prepare(pdf,origin);
   const movements=[],reviews=[],balances=[];
   let currentDate='',previousBalance=null,firstBalance=null,lastBalance=null,checked=0,openingCount=0;
   const periods=new Set();
   const pages=[...new Set(items.map(x=>x.page))].sort((a,b)=>a-b);
   let recognizedHeader=false,malformed=0;
   for(const page of pages){
     const it=items.filter(x=>x.page===page).sort((a,b)=>a.y-b.y||a.x-b.x);
     const header=it.filter(x=>x.y<125).map(x=>x.s).join(' ');
     if(/LANCAMENTO|LANÇAMENTO/i.test(norm(header))&&/SALDO/i.test(norm(header)))recognizedHeader=true;
     const amounts=it.filter(i=>i.x>=322&&i.x<492&&MONEY.test(i.s.trim())).map(i=>({...i,s:i.s.trim()}));
     const groups=[];
     for(const item of amounts){
       let g=groups.find(g=>Math.abs(g.y-item.y)<2.75);
       if(!g){g={y:item.y,items:[]};groups.push(g);}
       g.items.push(item);
     }
     groups.sort((a,b)=>a.y-b.y);
     const dates=it.filter(i=>i.x<87&&DATE.test(i.s.trim())).sort((a,b)=>a.y-b.y);
     const initialCandidates=it.filter(i=>i.x>=495&&MONEY.test(i.s.trim())&&it.some(d=>d.x>=85&&d.x<245&&Math.abs(d.y-i.y)<8&&norm(d.s).includes('SALDO ANTERIOR')));
     const openings=initialCandidates.map(i=>({y:i.y,balance:asMoney(i.s.trim())})).sort((a,b)=>a.y-b.y);
     let nextOpen=0,dayIndex=0;
     for(let n=0;n<groups.length;n++){
       const g=groups[n],next=groups[n+1];
       if(page===1&&g.y<150)continue; // "Total Disponível" do cabeçalho não é lançamento
       // Resumos "Total" nas últimas linhas são somas, nunca movimentações individuais.
       if(it.some(x=>x.x<85&&Math.abs(x.y-g.y)<5&&/^TOTAL\b/i.test(norm(x.s.trim()))))continue;
       while(nextOpen<openings.length&&openings[nextOpen].y<g.y){previousBalance=openings[nextOpen].balance;openingCount++;if(firstBalance===null)firstBalance=previousBalance;nextOpen++;}
       while(dayIndex<dates.length&&dates[dayIndex].y<=g.y+2){currentDate=iso(dates[dayIndex].s.trim());dayIndex++;}
       const credit=g.items.filter(x=>x.x<410),debit=g.items.filter(x=>x.x>=410);
       if(credit.length+debit.length!==1){
         if(credit.length||debit.length)reviews.push(review(origin,page,g.y,g.items.map(x=>x.s).join(' '),'Bradesco: total/linha com valores múltiplos ignorada'));
         continue;
       }
       const val=(credit[0]||debit[0]).s,amount=asMoney(val),cents=credit.length?Math.abs(amount):-Math.abs(amount);
       const balanceItems=it.filter(i=>i.x>=495&&Math.abs(i.y-g.y)<3.4&&MONEY.test(i.s.trim()));
       const nextY=next?next.y-6.2:g.y+24;
       const descriptions=it.filter(i=>i.x>=85&&i.x<245&&i.y>=g.y-6.2&&i.y<nextY&&i.s.trim())
         .sort((a,b)=>a.y-b.y||a.x-b.x).map(i=>i.s.trim());
       const history=descriptions.join(' ').replace(/\s+/g,' ').trim();
       const document=it.filter(i=>i.x>=245&&i.x<322&&Math.abs(i.y-g.y)<4).map(i=>i.s.trim()).join(' ').trim();
       if(!currentDate||!cents||!Number.isFinite(cents)||balanceItems.length!==1||!history||/^(?:TOTAL|SALDO\s+(?:ANTERIOR|DO\s+DIA))/i.test(norm(history))){
         malformed++;
         reviews.push(review(origin,page,g.y,[currentDate,history,document,val,...balanceItems.map(i=>i.s)].join(' • '),'Bradesco: linha sem data, histórico, valor único ou saldo; não importada'));
         continue;
       }
       const running=asMoney(balanceItems[0].s.trim());
       if(!Number.isFinite(running)){malformed++;reviews.push(review(origin,page,g.y,val,'Saldo inválido; não importar'));continue;}
       if(previousBalance!==null){
         const diff=previousBalance+cents-running;
         if(Math.abs(diff)>1){
           reviews.push(review(origin,page,g.y,[currentDate,history,val,balanceItems[0].s].join(' • '),'Bradesco: sequência de saldos divergente em R$ '+(Math.abs(diff)/100).toFixed(2)+'; conferir movimentos'));
           malformed++;
         }else checked++;
       }
       previousBalance=running;lastBalance=running;
       const movement={id:Core.id(),date:currentDate,cents,history:history+(document?' • Doc. '+document:''),documentNo:document,party:'',accountId,origin,line:'p'+page+'@'+Math.round(g.y),status:'PENDENTE',counterpart:'',method:legacy?'PDF_BRADESCO_TYPE3_VALIDADO':'PDF_BRADESCO_COLUNAS',statementBalance:running};
       movements.push(movement);periods.add(currentDate.slice(0,7));balances.push({date:currentDate,cents:running,page});
     }
   }
   if(!recognizedHeader)throw Error('Bradesco: cabeçalhos de Data/Lançamento/Crédito/Débito/Saldo não reconhecidos. Nenhum lançamento importado.');
   if(!movements.length)throw Error('Bradesco: nenhuma movimentação confiável identificada; solicite o extrato OFX ou CSV.');
   if(malformed>0)throw Error('Bradesco: '+malformed+' linha(s) com leitura ou saldos inconsistentes. Importação interrompida para evitar lançar valores incorretos. Solicite OFX/CSV.');
   if(legacy)reviews.push(review(origin,1,0,'Fonte Type3 com caracteres sem mapa Unicode; leitura recuperada a partir do modelo fornecido.','Bradesco: confira os lançamentos e o período antes de contabilizar.'));
   if(periods.size>1)reviews.push(review(origin,1,0,[...periods].join(', '),'Bradesco: PDF contém mais de uma competência. Selecione o mês correto antes de conciliar.'));
   const balanceCheck=firstBalance===null||checked===0||openingCount>1||periods.size>1?{status:'INDETERMINADO',reason:'Bradesco: saldos por lançamento conferidos, mas existem competências ou seções de extrato diferentes. Confirme os saldos por período.',initial:firstBalance,final:lastBalance,count:movements.length}:{status:'OK',initial:firstBalance,final:lastBalance,net:movements.reduce((v,m)=>v+m.cents,0),count:movements.length,reason:'Bradesco: continuidade dos saldos conferida por linha'};
   return {movements,reviews,balances,balanceCheck,format:legacy?'PDF_BRADESCO_TYPE3':'PDF_BRADESCO_COLUNAS',parsedCount:movements.length};
 }
 return {parse,decode};
});
