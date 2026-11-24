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
 const hits=(company.partners||[]).filter(p=>matchName(p.name,source)&&chart.has(String(p.code))&&String(p.code)!==bank);
 const codes=[...new Set(hits.map(p=>String(p.code)))];
 if(hits.length!==1||codes.length!==1)return {type:hits.length>1?'AMBIGUO':'SEM_CORRESPONDENCIA',matches:hits.length};
 return {type:'SOCIO',name:hits[0].name,code:codes[0]};
}
function suggest(company,movement){
 if(movement.status==='CONFIRMADO'||movement.status==='PENDENTE_DUPLICIDADE')return false;
 const found=find(company,movement);
 if(found.type!=='SOCIO')return false;
 if(movement.suggested&&String(movement.suggested)!==String(found.code)){
  movement.partnerSuggestionConflict=[String(movement.suggested),String(found.code)];
  return false;
 }
 movement.suggested=found.code;
 movement.partnerName=found.name;
 movement.confidence='Sócio cadastrado: '+found.name+' — código sugerido; conferir natureza da operação';
 delete movement.partnerSuggestionConflict;
 return true;
}
return {words,matchName,find,suggest};
});