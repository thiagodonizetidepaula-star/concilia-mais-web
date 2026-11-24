/* ConCiliar+ — aprendizagem segura por Excel classificado ou Razão. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ConciliaLearning=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const text=x=>String(x??'').trim();
const date=s=>{const t=text(s);const m=t.match(/^(\d\d)\/(\d\d)\/(\d{4})$/);return m?m[3]+'-'+m[2]+'-'+m[1]:/^\d{4}-\d\d-\d\d$/.test(t)?t:'';};
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
return {parseExcel,proposals,ledgerProposals,historyKey};
});