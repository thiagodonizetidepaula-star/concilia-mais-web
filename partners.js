/* ConCiliar+ | sócios por empresa e sugestões seguras */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ConciliaPartners=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function words(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
function matchName(name,history){
 const n=words(name),h=words(history);
 if(n.split(' ').length<2||n.length<7)return false;
 const padded=' '+h+' ',needle=' '+n+' ';
 const i=padded.indexOf(needle);
 if(i<0)return false;
 const tail=padded.slice(i+needle.length).trim().split(/\s+/)[0]||'';
 // Sufixo de parentesco não cadastrado diferencia pessoas com mesmo nome-base.
 if(/^(JUNIOR|JR|FILHO|NETO|SOBRINHO)$/.test(tail))return false;
 return true;
}
function find(company,movement){
 const chart=new Set((company.plan||[]).filter(p=>p.analytic).map(p=>String(p.code)));
 const bank=String((company.accounts||[]).find(a=>a.id===movement.accountId)?.chartCode||'');
 const source=[movement.history,movement.party,movement.financialDescription].filter(Boolean).join(' ');
 const matches=[
  ...(company.partners||[]).map(p=>({...p,kind:'SOCIO'})),
  ...(company.relatedCompanies||[]).map(p=>({...p,kind:'EMPRESA_RELACIONADA'}))
 ].filter(p=>matchName(p.name,source)&&chart.has(String(p.code))&&String(p.code)!==bank);
 // Nenhuma escolha arbitrária entre sócios, empresas, códigos ou nomes que se sobrepõem.
 if(matches.length!==1)return {type:matches.length>1?'AMBIGUO':'SEM_CORRESPONDENCIA',matches:matches.length};
 const hit=matches[0];
 return {type:hit.kind,name:hit.name,code:String(hit.code)};
}
function suggest(company,movement){
 if(movement.status==='CONFIRMADO'||movement.status==='PENDENTE_DUPLICIDADE')return false;
 const found=find(company,movement);
 if(found.type==='AMBIGUO'){
  movement.partnerSuggestionConflict=['Vários cadastros correspondem ao histórico'];
  return false;
 }
 if(found.type!=='SOCIO'&&found.type!=='EMPRESA_RELACIONADA')return false;
 if(movement.suggested&&String(movement.suggested)!==String(found.code)){
  movement.partnerSuggestionConflict=[String(movement.suggested),String(found.code)];
  return false;
 }
 movement.suggested=found.code;
 if(found.type==='SOCIO'){
  movement.partnerName=found.name;
  delete movement.relatedCompanyName;
 }else{
  movement.relatedCompanyName=found.name;
  delete movement.partnerName;
 }
 movement.confidence=(found.type==='SOCIO'?'Sócio cadastrado: ':'Empresa relacionada cadastrada: ')+found.name+' — código sugerido; exige confirmação';
 delete movement.partnerSuggestionConflict;
 return true;
}
return {words,matchName,find,suggest};
});