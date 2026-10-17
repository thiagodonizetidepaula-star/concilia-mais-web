(function (root, factory) { const value = factory(); if (typeof module === 'object' && module.exports) module.exports = value; root.ConciliaCore = value; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const norm = x => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  const id = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()+'-'+Math.random());
  const money = x => {
    if(typeof x === 'number') { if (!Number.isFinite(x)) throw Error('Valor inválido'); return Math.round(x*100); }
    let s = String(x ?? '').trim().replace(/\s/g,'').replace(/R\$/g,'').replace(/[−–]/g,'-');
    if(!s || s==='-') throw Error('Valor vazio');
    const neg = /^\(.*\)$/.test(s); s=s.replace(/[()]/g,'');
    if(s.includes(',') && s.includes('.')) { s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,''); }
    else if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
    else if(/^[-+]?\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
    if(!/^[-+]?\d+(\.\d{1,2})?$/.test(s)) throw Error('Valor monetário inválido: '+x);
    const cents=Math.round(Number(s)*100)*(neg?-1:1);
    if(!Number.isSafeInteger(cents)) throw Error('Valor fora do limite');
    return cents;
  };
  const date = x => {
    if(x instanceof Date && !Number.isNaN(x.valueOf())) return [x.getFullYear(),String(x.getMonth()+1).padStart(2,'0'),String(x.getDate()).padStart(2,'0')].join('-');
    let s=String(x??'').trim(); let a;
    if((a=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/))) s=`${a[3]}-${a[2]}-${a[1]}`;
    else if((a=s.match(/^(\d{4})(\d{2})(\d{2})/))) s=`${a[1]}-${a[2]}-${a[3]}`;
    else if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Error('Data inválida: '+x);
    const d=new Date(s+'T12:00:00Z'); if(Number.isNaN(d.valueOf())||d.toISOString().slice(0,10)!==s) throw Error('Data inválida: '+x);
    return s;
  };
  function parseCsv(t) {
    t=String(t??'').replace(/^\uFEFF/,''); const first=t.split(/\r?\n/,1)[0]||'';
    const count=d=>{let n=0,q=false;for(let i=0;i<first.length;i++){if(first[i]==='"'){if(q&&first[i+1]==='"')i++;else q=!q;}else if(first[i]===d&&!q)n++;}return n;};
    const delimiter=[';',',','\t'].sort((a,b)=>count(b)-count(a))[0];
    let rows=[], row=[], val='', quoted=false;
    for(let i=0;i<t.length;i++) {const c=t[i];if(c==='"'){if(quoted&&t[i+1]==='"'){val+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(val);val='';}else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&t[i+1]==='\n')i++;row.push(val);if(row.some(x=>x.trim()))rows.push(row);row=[];val='';}else val+=c;}
    if(quoted) throw Error('CSV com aspas não fechadas');row.push(val);if(row.some(x=>x.trim()))rows.push(row);
    return rows;
  }
  const mapped = rows => {
    if(rows.length<2) throw Error('Arquivo sem cabeçalho e dados');const headers=rows[0].map(norm);
    return rows.slice(1).map((values,i)=>{const data={};headers.forEach((h,j)=>{ if(!h)return;const v=values[j]??'';if(!(h in data)||(!String(data[h]).trim()&&String(v).trim()))data[h]=v;});return {rowNumber:i+2,values,data};});
  };
  function get(obj,aliases){for(const key of aliases){const n=norm(key);if(Object.prototype.hasOwnProperty.call(obj,n))return String(obj[n]??'').trim();}return '';}
  function parsePlan(rows){let accounts=[], reviews=[];for(const r of mapped(rows))try{
      const code=get(r.data,['Código','Codigo','Cod conta','Conta','Classificação','Classificacao','Codigoconta'])||r.values[0];
      const desc=get(r.data,['Descrição','Descricao','Nome','Nome da conta','Conta descrição'])||r.values[1];
      if(!String(code??'').trim()||!String(desc??'').trim())throw Error('Código ou descrição vazio');
      let analytic=get(r.data,['Analítica','Analitica','Tipo','Natureza']);
      const isAnalytic=/^(sim|s|true|1|analitica|a)$/i.test(analytic.trim());
      accounts.push({code:String(code).trim(),description:String(desc).trim(),analytic:isAnalytic,rawAnalytic:analytic});
    }catch(e){reviews.push({line:r.rowNumber,content:r.values.join(' | '),reason:e.message});}
    const dedup=new Map(); for(const a of accounts){if(dedup.has(a.code))reviews.push({line:'?',content:a.code,reason:'Código duplicado no arquivo; última ocorrência não substituída'});else dedup.set(a.code,a);}
    return {accounts:[...dedup.values()],reviews};
  }
  function parseStatementCsv(rows,accountId,origin){let movements=[],reviews=[];for(const r of mapped(rows)){
      try {const d=get(r.data,['Data','Data lancamento','Data do lançamento','Data movimento','Dt movimento','Data transação']);
        const history=get(r.data,['Historico','Histórico','Descrição','Descricao','Lançamentos','Lancamentos','Memo','Nome']);
        let v=get(r.data,['Valor','Valor R$','R$','Amount','Movimentação','Movimentacao']);
        const entry=get(r.data,['Entrada','Credito','Crédito']);const out=get(r.data,['Saida','Saída','Debito','Débito']);
        if(!v && (entry||out))v=entry||out;
        let cents=money(v);if(!entry&&out&&cents>0)cents=-cents;
        if(/^(saldo|saldo total|saldo anterior|total do dia|subtotal)/i.test(history))throw Error('Linha de saldo/total; revisão, não lançamento');
        if(!history)throw Error('Histórico vazio');if(cents===0)throw Error('Valor zero requer revisão');
        movements.push({id:id(),date:date(d),cents,history,party:get(r.data,['Contraparte','Razao social','Razão social','Favorecido','Beneficiario','Beneficiário','Nome destinatario']),accountId,origin,line:r.rowNumber,status:'PENDENTE',counterpart:''});
      }catch(e){reviews.push({origin,line:r.rowNumber,content:r.values.join(' | '),reason:e.message});}
    }return {movements,reviews};
  }
  function parseOfx(text,accountId,origin){const blocks=[...String(text).matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>))/gi)];
    if(!blocks.length)throw Error('OFX sem lançamentos STMTTRN reconhecíveis');
    const field=(body,tag)=>{const m=body.match(new RegExp('<'+tag+'>([^\r\n<]*)','i'));return m?m[1].trim():''};
    let movements=[],reviews=[]; for(let i=0;i<blocks.length;i++){let b=blocks[i][1];try{const cents=money(field(b,'TRNAMT'));if(!cents)throw Error('Valor zero'); const dt=date(field(b,'DTPOSTED'));const history=[field(b,'NAME'),field(b,'MEMO')].filter(Boolean).join(' — ');if(!history)throw Error('Histórico vazio');movements.push({id:id(),date:dt,cents,history,party:field(b,'NAME'),accountId,origin,line:i+1,status:'PENDENTE',counterpart:'',fitid:field(b,'FITID')});}catch(e){reviews.push({origin,line:i+1,content:b.slice(0,450),reason:e.message});}}return{movements,reviews};
  }
  function parseLedger(rows,origin) {let entries=[],reviews=[];for(const r of mapped(rows))try{
    const dt=date(get(r.data,['Data']));const debit=get(r.data,['Debito','Débito','Conta debito','Codigo debito','Cod. conta debito']); const credit=get(r.data,['Credito','Crédito','Conta credito','Codigo credito','Cod. conta credito']);const cents=Math.abs(money(get(r.data,['Valor','R$'])));
    if(!debit||!credit||!cents)throw Error('Débito, crédito ou valor não preenchido');
    entries.push({id:id(),date:dt,debit,credit,cents,history:get(r.data,['Historico','Histórico','Complemento histórico']),origin,line:r.rowNumber});
  }catch(e){reviews.push({origin,line:r.rowNumber,content:r.values.join(' | '),reason:e.message});}return{entries,reviews};}
  const dayDistance=(a,b)=>Math.abs(Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000));
  const periodMovements=(company,period)=>company.movements.filter(m=>m.date.slice(0,7)===period);
  function transferSuggestions(company,period){ const movements=periodMovements(company,period).filter(m=>m.status!=='PENDENTE_DUPLICIDADE'), accepted=new Set((company.transfers||[]).filter(t=>t.status==='CONFIRMADA').flatMap(t=>[t.outId,t.inId]));let proposals=[],ambiguous=[];
    const outs=movements.filter(m=>m.cents<0&&!accepted.has(m.id));const ins=movements.filter(m=>m.cents>0&&!accepted.has(m.id));
    const eligible=(out,inn)=>out.accountId!==inn.accountId && -out.cents===inn.cents && dayDistance(out.date,inn.date)<=2;
    for(const out of outs){const possible=ins.filter(inn=>eligible(out,inn));if(!possible.length)continue;
      const unique=possible.length===1 && outs.filter(o=>eligible(o,possible[0])).length===1;
      if(unique)proposals.push({outId:out.id,inId:possible[0].id,status:'SUGERIDA'});
      else ambiguous.push({outId:out.id,possibleInIds:possible.map(m=>m.id),reason:'Múltiplas correspondências possíveis'});
    }
    return{proposals,ambiguous};
  }
  function proposedJournal(company,period){let lines=[],errors=[];const mv=periodMovements(company,period);const accountMap=new Map(company.accounts.map(a=>[a.id,a]));const planMap=new Map(company.plan.map(a=>[a.code,a]));const confirmed=new Set();
    for(const t of company.transfers.filter(t=>t.status==='CONFIRMADA')){
      const out=mv.find(m=>m.id===t.outId),inn=mv.find(m=>m.id===t.inId);if(!out||!inn)continue;const src=accountMap.get(out.accountId),dst=accountMap.get(inn.accountId);
      if(!src||!dst||src.id===dst.id||out.cents>=0||inn.cents<=0||out.cents!==-inn.cents){errors.push('Transferência inválida '+t.outId);continue;}
      if(!planMap.get(src.chartCode)?.analytic||!planMap.get(dst.chartCode)?.analytic){errors.push('Código de banco inválido na transferência');continue;}
      confirmed.add(out.id);confirmed.add(inn.id);
      lines.push({id:'T-'+t.outId+'-'+t.inId,date:inn.date,debit:dst.chartCode,credit:src.chartCode,cents:inn.cents,history:`Transferência entre contas próprias • ${src.bank} → ${dst.bank}`,sources:[out.id,inn.id]});
    }
    for(const m of mv){if(confirmed.has(m.id)||m.status!=='CONFIRMADO')continue;const bank=accountMap.get(m.accountId);const cp=planMap.get(m.counterpart);
      if(!bank||!planMap.get(bank.chartCode)?.analytic||!cp?.analytic){errors.push('Conta não analítica ou inexistente para movimento '+m.id);continue;}
      lines.push({id:m.id,date:m.date,debit:m.cents>0?bank.chartCode:m.counterpart,credit:m.cents>0?m.counterpart:bank.chartCode,cents:Math.abs(m.cents),history:m.history,sources:[m.id]});
    }
    return {lines,errors};
  }
  function reconcile(company,period){const {lines,errors}=proposedJournal(company,period);const versions=company.ledger.filter(l=>l.period===period);const ledger=versions.length?versions[versions.length-1].entries:[];const key=x=>`${x.date}|${x.debit}|${x.credit}|${x.cents}`;
    const grouped=new Map();for(const l of ledger){const k=key(l);grouped.set(k,[...(grouped.get(k)||[]),l]);}
    let checked=[],matchedLedger=new Set();for(const row of lines){const ms=grouped.get(key(row))||[];if(ms.length===1 && lines.filter(o=>key(o)===key(row)).length===1){checked.push({...row,recon:'CONCILIADO',matchedId:ms[0].id});matchedLedger.add(ms[0].id);}else checked.push({...row,recon:ms.length>0?'AMBIGUO':'NAO_ENCONTRADO_NO_RAZAO'});}
    return {checked,missingLedger:ledger.filter(l=>!matchedLedger.has(l.id)),errors};
  }
  function previewExport(company,period){const report=reconcile(company,period);return {rows:report.checked.filter(l=>l.recon==='NAO_ENCONTRADO_NO_RAZAO'),blocked:report.checked.filter(l=>l.recon==='AMBIGUO'),errors:report.errors};}
  const csvCell=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
  const exportCsv=rows=>['Data;Cód. Conta Débito;Cód. Conta Crédito;Valor;Complemento Histórico',...rows.map(r=>[r.date.split('-').reverse().join('/'),r.debit,r.credit,(r.cents/100).toFixed(2).replace('.',','),r.history].map(csvCell).join(';'))].join('\r\n');
  return {norm,id,money,date,parseCsv,mapped,parsePlan,parseStatementCsv,parseOfx,parseLedger,dayDistance,periodMovements,transferSuggestions,proposedJournal,reconcile,previewExport,exportCsv};
});
