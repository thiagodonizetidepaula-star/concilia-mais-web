/* ConCiliar+ — aprendizagem segura por Excel classificado ou Razão. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ConciliaLearning=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const text=x=>String(x??'').trim();
const date=s=>{if(typeof s==='number'&&s>20000&&s<90000)return new Date(Date.UTC(1899,11,30)+Math.round(s)*86400000).toISOString().slice(0,10);const t=text(s);const m=t.match(/^(\d\d)\/(\d\d)\/(\d{4})$/);return m?m[3]+'-'+m[2]+'-'+m[1]:/^\d{4}-\d\d-\d\d$/.test(t)?t:'';};
const cents=s=>{if(typeof s==='number')return Math.round(s*100);const t=text(s).replace(/R\$\s*/g,'').replace(/\s/g,'');if(!t)return NaN;const sign=t.startsWith('-')?-1:1;const raw=t.replace(/^[-+]/,'');const x=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;return sign*Math.round(Number(x)*100);};
const historyKey=s=>norm(text(s).replace(/^\s*(?:Controle(?: financeiro)?\s*:\s*)?/i,'').replace(/^\s*\d+(?:\.\d+)*\s*[-–.:]?\s*/,'').replace(/\d+/g,''));
function parseExcel(book){
 const sheet=book.Sheets?.Extrato_Classificado||book.Sheets?.Aprendizado_Concilia;
 if(!sheet)throw Error('A planilha precisa da aba Extrato_Classificado gerada pelo ConCiliar+.');
 const XLSX=globalThis.XLSX;
 if(!XLSX?.utils?.sheet_to_json)throw Error('Leitor de Excel não disponível.');
 const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true});
 const meta=book.Sheets?.Concilia_Identificadores?XLSX.utils.sheet_to_json(book.Sheets.Concilia_Identificadores,{header:1,defval:'',raw:true}):[];
 if(!rows.length||norm(rows[0][0])!=='data')throw Error('Cabeçalho do extrato classificado não reconhecido.');
 return rows.slice(1).map((r,i)=>({line:i+2,id:meta[i+1]?.[0]||'',metaDate:date(meta[i+1]?.[1]),metaCents:cents(meta[i+1]?.[2]),metaBank:text(meta[i+1]?.[3]),metaHistory:text(meta[i+1]?.[4]),date:date(r[0]),debit:text(r[1]),credit:text(r[2]),amount:cents(r[3]),history:text(r[4])})).filter(x=>x.date&&(x.debit||x.credit||x.history));
}
function parseLedgerExcel(book){
 const XLSX=globalThis.XLSX;
 if(!XLSX?.utils?.sheet_to_json)throw Error('Leitor de Excel não disponível.');
 const collected=[],issues=[];
 for(const sheetName of book.SheetNames||[]){
  if(['Extrato_Classificado','Concilia_Identificadores'].includes(sheetName))continue;
  const raw=XLSX.utils.sheet_to_json(book.Sheets[sheetName],{header:1,defval:'',raw:true});
  const idx=raw.findIndex(row=>{
   const n=row.map(norm);return n.includes('data')&&n.some(x=>x.includes('debito'))&&n.some(x=>x.includes('credito'))&&n.some(x=>x.includes('valor'));
  });
  if(idx<0)continue;
  const header=raw[idx].map(norm);
  const field=(row,term)=>{const pos=header.findIndex(x=>x===term||x.includes(term));return pos<0?'':row[pos];};
  for(let i=idx+1;i<raw.length;i++){
   const row=raw[i],dt=date(field(row,'data')),deb=text(field(row,'debito')),cred=text(field(row,'credito')),amount=Math.abs(cents(field(row,'valor')));
   if(!row.some(x=>text(x)))continue;
   if(!dt||!deb||!cred||!Number.isFinite(amount)||!amount){issues.push(sheetName+' linha '+(i+1)+': data, código ou valor inválido.');continue;}
   collected.push({date:dt,debit:deb,credit:cred,cents:amount,history:text(field(row,'historico')||field(row,'descricao')||''),origin:sheetName,line:i+1});
  }
 }
 if(!collected.length)throw Error('Razão Excel sem linhas válidas. São necessárias colunas Data, Débito, Crédito, Valor e, preferencialmente, Histórico.');
 return {entries:collected,issues};
}
// Texto copiado de células do Excel: colunas separadas por TAB e linhas por quebra de linha.
// Aceita o cabeçalho da aba Extrato_Classificado; Banco e ID são opcionais.
function parsePastedExcel(raw){
 const input=String(raw||'').replace(/^\uFEFF/,'').trim();
 if(!input)throw Error('Cole as células copiadas do Excel antes de conferir.');
 const lines=input.split(/\r?\n/).filter(line=>line.trim());
 if(lines.length>5001)throw Error('Cole até 5.000 lançamentos por conferência.');
 const rows=lines.map(line=>line.split('\t').map(cell=>cell.trim().replace(/^"([\s\S]*)"$/,'$1').replace(/""/g,'"')));
 const aliases={
  date:['data'],debit:['codcontadebito','codigodebito','coddebito','debito'],
  credit:['codcontacredito','codigocredito','codcredito','credito'],
  amount:['valorextrator','valorextrators','valorextrato','valor','valorbrl','valorrs'],history:['complementohistorico','historico','descricao','descricaohistorico'],
  bank:['banco','codigobanco','codigodobanco','codigocontabanco','contabancaria'],id:['idlancamento','idmovimento','id']
 };
 const normalized=rows[0].map(norm);
 const positions={};
 for(const [field, names] of Object.entries(aliases))positions[field]=normalized.findIndex(n=>names.includes(n));
 const hasHeader=positions.date>=0&&positions.debit>=0&&positions.credit>=0&&positions.amount>=0&&positions.history>=0;
 if(!hasHeader){
  // Sem cabeçalho, a ordem deve ser: Data, Débito, Crédito, Valor, Histórico, [Banco].
  if(rows[0].length<5||rows[0].length>7)throw Error('Selecione as colunas Data, Débito, Crédito, Valor, Histórico e, se houver, Banco.');
  Object.assign(positions,{date:0,debit:1,credit:2,amount:3,history:4,bank:rows[0].length>=6?5:-1,id:rows[0].length>=7?6:-1});
 }
 const result=[],issues=[];
 const start=hasHeader?1:0;
 for(let i=start;i<rows.length;i++){
  const cells=rows[i];
  const at=field=>positions[field]>=0?text(cells[positions[field]]):'';
  const day=date(at('date')),amount=cents(at('amount'));
  if(!day||!Number.isFinite(amount)||!amount||!at('history')){
   issues.push('Linha '+(i+1)+': data, valor ou histórico ausente/inválido.');continue;
  }
  result.push({line:i+1,date:day,debit:at('debit'),credit:at('credit'),amount,history:at('history'),bankHint:at('bank'),id:at('id')});
 }
 return {rows:result,issues,hasHeader};
}
function pastedProposals(company,period,rows){
 const plan=new Set((company.plan||[]).filter(p=>p.analytic).map(p=>String(p.code)));
 const banks=new Map((company.accounts||[]).map(a=>[a.id,a]));
 const moves=(company.movements||[]).filter(m=>m.date?.startsWith(period));
 const byId=new Map(moves.map(m=>[String(m.id),m]));
 const proposals=[],issues=[],used=new Set();
 for(const row of rows){
  const matches=row.id?[byId.get(String(row.id))].filter(Boolean):moves.filter(m=>m.date===row.date&&m.cents===row.amount&&historyKey(m.history)===historyKey(row.history));
  const filtered=matches.filter(m=>{
   const account=banks.get(m.accountId),code=String(account?.chartCode||'');
   const hint=norm(row.bankHint);
   if(!hint)return true;
   return hint===norm(code)||hint===norm(account?.bank)||hint===norm(account?.label)||hint===norm(account?.bank+' '+account?.label);
  });
  if(filtered.length!==1){issues.push('Linha '+row.line+': '+(filtered.length?'mais de um lançamento corresponde aos dados (informe Banco ou ID)':'movimentação não encontrada com data, valor, histórico e banco')+'.');continue;}
  const m=filtered[0],account=banks.get(m.accountId),bankCode=String(account?.chartCode||'');
  if(row.id&&(m.date!==row.date||m.cents!==row.amount||historyKey(m.history)!==historyKey(row.history))){
   issues.push('Linha '+row.line+': ID não corresponde à data, valor e histórico.');continue;
  }
  if(used.has(m.id)){issues.push('Linha '+row.line+': lançamento repetido nas células coladas.');continue;}
  used.add(m.id);
  if(!plan.has(bankCode)){issues.push('Linha '+row.line+': conta '+(account?.bank||'')+' sem código válido no plano.');continue;}
  if(m.status==='PENDENTE_DUPLICIDADE'||m.status==='DIVERGENTE'||m.financialMatch==='AMBIGUA'||m.financialMatch==='SEM_CORRESPONDENCIA'){
   issues.push('Linha '+row.line+': lançamento com duplicidade, divergência ou associação financeira em revisão.');continue;
  }
  const pastedBank=String(m.cents>0?row.debit:row.credit),cp=String(m.cents>0?row.credit:row.debit);
  if(pastedBank!==bankCode){issues.push('Linha '+row.line+': código bancário no lado errado; esperado '+bankCode+'.');continue;}
  if(!cp)continue;
  if(cp===bankCode||!plan.has(cp)){issues.push('Linha '+row.line+': contrapartida '+cp+' ausente ou inválida no plano da empresa.');continue;}
  if(m.status==='CONFIRMADO'){
   if(String(m.counterpart)!==cp)issues.push('Linha '+row.line+': classificação já confirmada com outro código.');
   continue;
  }
  proposals.push({movementId:m.id,code:cp,bank:bankCode,bankName:account.bank||'',history:m.history,date:m.date,amount:m.cents,source:'COLAGEM'});
 }
 return {proposals,issues};
}

/* A confirmação automática usa EXATAMENTE o mesmo validador da prévia.
 * Nunca aplica códigos a linhas ambíguas, empresas diferentes ou registros repetidos.
 * Retorna função de reversão para falhas de persistência. */
function applyValidatedPaste(company,period,raw,learnConfirmed){
 if(!company||!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period||'')))throw Error('Empresa ou competência inválida.');
 if(typeof learnConfirmed!=='function')throw Error('Memória de aprendizado indisponível.');
 const parsed=parsePastedExcel(raw),checked=pastedProposals(company,period,parsed.rows);
 const beforeRules=JSON.parse(JSON.stringify(company.learnedCodes||[])),hadRules=Object.prototype.hasOwnProperty.call(company,'learnedCodes');
 const before=new Map(),applied=[];
 try{
  for(const row of checked.proposals){
   const m=(company.movements||[]).find(x=>x.id===row.movementId);
   const acc=(company.accounts||[]).find(x=>x.id===m?.accountId);
   if(!m||!m.date?.startsWith(period)||m.date!==row.date||m.cents!==row.amount||
    historyKey(m.history)!==historyKey(row.history)||String(acc?.chartCode||'')!==String(row.bank)||
    !(company.plan||[]).some(p=>p.analytic&&String(p.code)===String(row.code))||
    ['CONFIRMADO','PENDENTE_DUPLICIDADE','DIVERGENTE'].includes(m.status)||
    ['AMBIGUA','SEM_CORRESPONDENCIA'].includes(m.financialMatch))continue;
   if(before.has(m.id))throw Error('Duplicidade entre classificações da mesma movimentação.');
   before.set(m.id,{counterpart:m.counterpart,suggested:m.suggested,status:m.status,confidence:m.confidence});
   m.counterpart=String(row.code);m.suggested=String(row.code);m.status='CONFIRMADO';
   m.confidence='Excel colado — validado automaticamente contra o plano e o extrato';
   learnConfirmed(company,m,row.code,'IMPORTACAO_VALIDADA');
   applied.push(m.id);
  }
 }catch(error){
  for(const m of company.movements||[]){if(!before.has(m.id))continue;const old=before.get(m.id);for(const key of Object.keys(old)){if(old[key]===undefined)delete m[key];else m[key]=old[key];}}
  if(hadRules)company.learnedCodes=beforeRules;else delete company.learnedCodes;
  throw error;
 }
 const undo=()=>{
  for(const m of company.movements||[]){if(!before.has(m.id))continue;const old=before.get(m.id);for(const key of Object.keys(old)){if(old[key]===undefined)delete m[key];else m[key]=old[key];}}
  if(hadRules)company.learnedCodes=beforeRules;else delete company.learnedCodes;
 };
 return {applied:applied.length,issues:[...parsed.issues,...checked.issues],undo,proposals:checked.proposals.length};
}

function proposals(company,period,rows,source='EXCEL'){
 const plan=new Set((company.plan||[]).filter(p=>p.analytic).map(p=>String(p.code)));
 const banks=new Map((company.accounts||[]).map(a=>[a.id,String(a.chartCode||'')]));
 const moves=(company.movements||[]).filter(m=>m.date?.startsWith(period));
 const byId=new Map(moves.map(m=>[m.id,m]));
 const proposals=[],issues=[];const used=new Set();
 for(const row of rows){
  let candidates=[];
  if(row.id){
   const m=byId.get(row.id);
   if(m&&row.metaDate===m.date&&row.metaCents===m.cents&&historyKey(row.metaHistory)===historyKey(m.history)&&row.metaBank===banks.get(m.accountId))candidates=[m];
   else {issues.push('Linha '+row.line+': identificador ou conteúdo original não confere com a empresa/competência.');continue;}
  }else{
   candidates=moves.filter(m=>m.date===row.date&&m.cents===row.amount&&historyKey(m.history)===historyKey(row.history));
  }
  if(candidates.length!==1){issues.push('Linha '+row.line+': lançamento '+(candidates.length?'ambíguo':'não encontrado')+'.');continue;}
  const m=candidates[0],bank=banks.get(m.accountId);
  if(!bank||!plan.has(bank)){issues.push('Linha '+row.line+': banco sem código analítico válido.');continue;}
  if(m.status==='PENDENTE_DUPLICIDADE'){issues.push('Linha '+row.line+': duplicidade pendente.');continue;}
  if(used.has(m.id)){issues.push('Linha '+row.line+': mesmo lançamento apareceu mais de uma vez.');continue;}
  used.add(m.id);
  if(row.id&&(row.date!==m.date||row.amount!==m.cents)){issues.push('Linha '+row.line+': data ou valor da planilha foi alterado.');continue;}
  const correctBank=m.cents>0?row.debit:row.credit;
  const cp=m.cents>0?row.credit:row.debit;
  if(correctBank!==bank){issues.push('Linha '+row.line+': código do banco na coluna incorreta; esperado '+bank+'.');continue;}
  if(!cp){continue;}
  if(cp===bank||!plan.has(cp)){issues.push('Linha '+row.line+': contrapartida '+cp+' inválida no plano.');continue;}
  if(m.status==='CONFIRMADO'&&String(m.counterpart)!==cp){issues.push('Linha '+row.line+': classificação já confirmada com código diferente.');continue;}
  if(m.status==='CONFIRMADO')continue;
  proposals.push({movementId:m.id,code:cp,bank,history:m.history,date:m.date,amount:m.cents,source});
 }
 return {proposals,issues};
}
function ledgerProposals(company,period,entries){
 const plan=new Set((company.plan||[]).filter(p=>p.analytic).map(p=>String(p.code)));
 const accounts=new Map((company.accounts||[]).map(a=>[a.id,String(a.chartCode||'')]));
 const moves=(company.movements||[]).filter(m=>m.date?.startsWith(period));
 const proposals=[],issues=[],used=new Set();
 for(const [i,row] of entries.entries()){
  const amount=Math.abs(Number(row.cents));
  const matches=moves.filter(m=>{
   const bank=accounts.get(m.accountId);
   return m.date===row.date&&Math.abs(m.cents)===amount&&bank&&bank===(m.cents>0?String(row.debit):String(row.credit));
  });
  if(matches.length!==1){issues.push('Razão linha '+(i+1)+': correspondência '+(matches.length?'ambígua':'ausente')+'.');continue;}
  const m=matches[0],bank=accounts.get(m.accountId),cp=String(m.cents>0?row.credit:row.debit);
  if(m.status==='PENDENTE_DUPLICIDADE'||used.has(m.id)||!plan.has(bank)||!plan.has(cp)||cp===bank){issues.push('Razão linha '+(i+1)+': conta inválida ou repetida.');continue;}
  used.add(m.id);
  if(m.status==='CONFIRMADO'){if(String(m.counterpart)!==cp)issues.push('Razão linha '+(i+1)+': conflito com classificação confirmada.');continue;}
  proposals.push({movementId:m.id,code:cp,bank,history:m.history,date:m.date,amount:m.cents,source:'RAZAO'});
 }
 return {proposals,issues};
}
function historicalLedgerExamples(company,selectedPeriod,entries){
 const valid=new Set((company.plan||[]).filter(p=>p.analytic).map(p=>String(p.code)));
 const banks=new Map((company.accounts||[]).filter(a=>valid.has(String(a.chartCode))).map(a=>[String(a.chartCode),a.id]));
 const examples=[],issues=[],seen=new Set();
 for(const [i,row] of entries.entries()){
  if(!row.date||row.date.slice(0,7)>=selectedPeriod)continue;
  const debit=String(row.debit||''),credit=String(row.credit||'');
  const bankIn=banks.has(debit),bankOut=banks.has(credit);
  if(bankIn===bankOut){issues.push('Razão histórico linha '+(i+1)+': não há banco e contrapartida únicos.');continue;}
  const accountId=banks.get(bankIn?debit:credit),code=bankIn?credit:debit;
  const history=text(row.history);
  if(!valid.has(code)||!history||historyKey(history).length<3){issues.push('Razão histórico linha '+(i+1)+': código ou descrição inválido.');continue;}
  const signed=bankIn?Math.abs(row.cents):-Math.abs(row.cents);
  const key=[accountId,bankIn?'E':'S',historyKey(history),code,row.date,Math.abs(row.cents)].join('|');
  if(seen.has(key))continue;
  seen.add(key);examples.push({accountId,history,cents:signed,code,date:row.date});
 }
 return {examples,issues};
}
return {parseExcel,parseLedgerExcel,parsePastedExcel,pastedProposals,applyValidatedPaste,proposals,ledgerProposals,historicalLedgerExamples,historyKey};
});