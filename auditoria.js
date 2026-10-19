/* Concilia+ — painel de divergências por lançamento. Somente leitura, nenhum lançamento automático. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ConciliaAuditoria=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const abs=x=>Math.abs(Number(x)||0);
const norm=s=>String(s??'');
const byDate=(a,b)=>norm(a.date).localeCompare(norm(b.date))||abs(b.cents)-abs(a.cents);
function audit(Core,company,period){
 if(!company||!Array.isArray(company.plan)||!Core)return {events:[],counts:{},banks:[],complete:false};
 const plan=new Map(company.plan.filter(p=>p.analytic).map(p=>[String(p.code),p]));
 const accounts=(company.accounts||[]).slice(),byId=new Map(accounts.map(a=>[a.id,a]));
 const movements=Core.periodMovements(company,period).slice();
 const versions=(company.ledger||[]).filter(v=>v.period===period);
 const events=[],summary=[],mappedLedger=new Set();
 const knownCode=x=>plan.has(String(x||''))?String(x):'';
 const identifier=(m)=>m?.id||m?.line||'';
 const detail=(m)=>[m.history,m.party].filter(Boolean).join(' • ').slice(0,400);
 const candidateOf=(m)=>{const b=byId.get(m.accountId),bankCode=knownCode(b?.chartCode),cp=knownCode(m.status==='CONFIRMADO'?m.counterpart:'');return {debit:m.cents>0?bankCode:cp,credit:m.cents<0?bankCode:cp};};
 const latestFor=(code)=>{const targeted=versions.filter(v=>String(v.accountCode||'')===String(code)).at(-1);if(targeted)return{entries:(targeted.entries||[]).filter(e=>String(e.debit)===code||String(e.credit)===code),source:targeted.file,version:targeted};
  const general=versions.filter(v=>!v.accountCode).at(-1);return general?{entries:(general.entries||[]).filter(e=>String(e.debit)===code||String(e.credit)===code),source:general.file,version:general}:null;
 };
 const add=e=>events.push({bank:'',bankCode:'',sourceBank:'',targetBank:'',debit:'',credit:'',date:'',cents:0,document:'',evidence:'',action:'Conferir documentos antes de lançar.',tone:'yellow',...e});
 const periodAccounts=accounts.filter(a=>movements.some(m=>m.accountId===a.id)||versions.some(v=>String(v.accountCode)===String(a.chartCode)));
 for(const account of periodAccounts){
  const code=String(account.chartCode||''),codeSafe=knownCode(code),bank=account.bank||account.label||'Banco',statement=movements.filter(m=>m.accountId===account.id).sort(byDate),ledgerData=latestFor(code);
  const lm=ledgerData?.entries||[],amountKey=(dt,cent,side)=>[dt,abs(cent),side].join('|');
  const mg=new Map(),lg=new Map();
  for(const m of statement){const key=amountKey(m.date,m.cents,m.cents>0?'D':'C');mg.set(key,[...(mg.get(key)||[]),m]);}
  for(const l of lm){const side=String(l.debit)===code?'D':String(l.credit)===code?'C':'';if(!side)continue;const key=amountKey(l.date,l.cents,side);lg.set(key,[...(lg.get(key)||[]),l]);}
  let matched=0,missingBank=0,missingLedger=0,ambiguous=0;
  if(!ledgerData){if(statement.length)add({type:'RAZAO_AUSENTE',tone:'yellow',bank,bankCode:codeSafe,evidence:statement.length+' movimentações sem Razão importado para esta conta.',action:'Importe o Razão da conta '+code+' do mês '+period+'.'});}
  else{
   const keys=new Set([...mg.keys(),...lg.keys()]);
   for(const key of keys){
    const ms=mg.get(key)||[],ls=lg.get(key)||[];
    if(ms.length===1&&ls.length===1){matched++;mappedLedger.add(ls[0].id);continue;}
    if(ms.length&&ls.length){ambiguous+=ms.length+ls.length;add({type:'AMBIGUIDADE',tone:'red',bank,bankCode:codeSafe,date:ms[0].date,cents:ms[0].cents,document:(ms[0].origin||'')+' / '+(ledgerData.source||''),evidence:ms.length+' movimento(s) do extrato e '+ls.length+' do Razão com a mesma data, valor e natureza; par não identificado com segurança.',action:'Conferir comprovantes e números de documento, sem confirmar automaticamente.'});continue;}
    for(const m of ms){
     missingLedger++;const codes=candidateOf(m);
     add({type:'EXTRATO_SEM_RAZAO',tone:'red',bank,bankCode:codeSafe,sourceBank:m.cents<0?bank:'',targetBank:m.cents>0?bank:'',debit:codes.debit,credit:codes.credit,date:m.date,cents:m.cents,history:detail(m),document:m.origin||'',movementId:identifier(m),evidence:'Movimento do extrato sem correspondência exata por data, valor e natureza no Razão '+code+'.',action:'Localizar lançamento contábil correspondente; conferir data, agrupamentos e contrapartida. Não criar lançamento duplicado.'});
    }
    for(const l of ls){
     missingBank++;const sameSignMovements=movements.filter(m=>m.accountId!==account.id&&m.date===l.date&&abs(m.cents)===abs(l.cents)&&(m.cents>0)===(String(l.debit)===code));
     const candidates=[...new Set(sameSignMovements.map(m=>byId.get(m.accountId)?.bank+' (cód. '+byId.get(m.accountId)?.chartCode+')'))].filter(x=>!x.startsWith('undefined'));
     add({type:'RAZAO_SEM_EXTRATO',tone:'red',bank,bankCode:codeSafe,sourceBank:String(l.credit)===code?bank:'',targetBank:String(l.debit)===code?bank:'',debit:knownCode(l.debit),credit:knownCode(l.credit),date:l.date,cents:String(l.credit)===code?-abs(l.cents):abs(l.cents),history:l.history||'',document:ledgerData.source||'',documentNo:l.documentNo||'',evidence:'Lançamento do Razão '+(l.documentNo?'nº '+l.documentNo+' ':'')+'sem movimento bancário correspondente nesta conta.'+(candidates.length?' Mesmo valor/data/sentido aparece em '+candidates.join(', ')+'.':''),action:candidates.length?'Verificar se o banco contábil foi escolhido incorretamente; confirmar comprovante antes de corrigir.':'Conferir Razão, data, valor e possível ausência de extrato; não excluir automaticamente.'});
    }
   }
  }
  summary.push({bank,bankCode:code,movements:statement.length,ledger:ledgerData?.entries.length??0,matched,missingBank,missingLedger,ambiguous,ledgerSource:ledgerData?.source||''});
 }
 // Transferências próprias são CANDIDATAS até a pessoa responsável conferir ambas as contas.
 const transfers=Core.transferSuggestions(company,period);
 for(const p of transfers.proposals||[]){
  const out=movements.find(m=>m.id===p.outId),inn=movements.find(m=>m.id===p.inId);if(!out||!inn)continue;
  const source=byId.get(out.accountId),target=byId.get(inn.accountId),deb=knownCode(target?.chartCode),cred=knownCode(source?.chartCode);
  add({type:'TRANSFERENCIA_CANDIDATA',tone:'yellow',date:out.date,cents:out.cents,bank:source?.bank||'',bankCode:cred,sourceBank:source?.bank||'',targetBank:target?.bank||'',debit:deb,credit:cred,history:detail(out),document:(out.origin||'')+' ↔ '+(inn.origin||''),evidence:'Saída e entrada de mesmo valor em contas cadastradas desta empresa, com intervalo de até dois dias. Titularidade e finalidade ainda não confirmadas.',action:'Conferir titularidade, comprovantes e Razões das duas contas. Confirmar ou rejeitar a transferência no aplicativo; nunca lançar duas vezes.'});
 }
 for(const p of transfers.ambiguous||[]){const m=movements.find(x=>x.id===p.outId);if(!m)continue;const account=byId.get(m.accountId);
  add({type:'TRANSFERENCIA_AMBIGUA',tone:'red',date:m.date,cents:m.cents,bank:account?.bank||'',bankCode:knownCode(account?.chartCode),document:m.origin||'',history:detail(m),evidence:'Mais de uma entrada bancária pode corresponder à mesma saída.',action:'Conferir comprovantes, contas e números Pix antes de vincular.'});
 }
 // Saldos somente quando existe saldo final identificável no documento e Razão com saldo anterior.
 for(const account of accounts){
  const code=String(account.chartCode||''),lv=versions.filter(v=>String(v.accountCode||'')===code&&typeof v.openingBalance==='number').at(-1);
  if(!lv)continue;
  const imports=(company.imports||[]).filter(i=>i.type==='EXTRATO'&&i.accountId===account.id&&(i.periods||[]).includes(period)&&typeof i.balanceCheck?.final==='number');
  if(imports.length!==1)continue; // vários arquivos segmentados exigem conferir primeiro os limites do período
  const imp=imports[0],sum=(lv.entries||[]).reduce((v,l)=>v+(String(l.debit)===code?l.cents:0)-(String(l.credit)===code?l.cents:0),0);
  const accounting=lv.openingBalance+sum,bank=imp.balanceCheck.final,diff=accounting-bank;
  if(abs(diff)>1)add({type:'SALDO_DIVERGENTE',tone:'red',bank:account.bank||'',bankCode:knownCode(code),cents:diff,date:imp.balanceCheck.endDate||period+'-30',document:(lv.file||'Razão')+' / '+imp.name,evidence:'Saldo final do Razão '+moneyBR(accounting)+' × saldo do extrato '+moneyBR(bank)+'; diferença '+moneyBR(diff)+'.',action:'Conferir saldo inicial, lançamentos sem par e arquivos de períodos sobrepostos. Não ajustar saldo automaticamente.'});
 }
 const priority={SALDO_DIVERGENTE:0,RAZAO_SEM_EXTRATO:1,EXTRATO_SEM_RAZAO:2,AMBIGUIDADE:3,TRANSFERENCIA_AMBIGUA:4,TRANSFERENCIA_CANDIDATA:5,RAZAO_AUSENTE:6};
 events.sort((a,b)=>(priority[a.type]??10)-(priority[b.type]??10)||a.date.localeCompare(b.date));
 const types={};for(const e of events)types[e.type]=(types[e.type]||0)+1;
 return{events,counts:{...types,review:events.filter(e=>e.tone==='red').length,candidates:types.TRANSFERENCIA_CANDIDATA||0,matched:summary.reduce((s,x)=>s+x.matched,0)},banks:summary,period,complete:events.length===0&&movements.length>0};
}
function moneyBR(c){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(c)||0)/100)}
function dateBR(d){return/^\d{4}-\d{2}-\d{2}$/.test(d||'')?d.split('-').reverse().join('/'):(d||'')}
const header=['Data','Tipo de ocorrência','Banco','Origem provável','Destino provável','Cód. Débito','Cód. Crédito','Valor (R$)','Histórico / Referência','Evidência','Ação necessária','Arquivos de origem','Situação'];
function excelRows(Core,company,period){const r=audit(Core,company,period);return[header,...r.events.map(e=>[dateBR(e.date),e.type.replaceAll('_',' '),e.bank,e.sourceBank,e.targetBank,e.debit,e.credit,{n:e.cents/100},e.history||e.documentNo||'',e.evidence,e.action,e.document,e.tone==='red'?'DIVERGÊNCIA — REVISAR':'PENDENTE — CONFERIR'])]}
return {audit,excelRows,header,moneyBR,dateBR};
});
