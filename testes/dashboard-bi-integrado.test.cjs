'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const BI=require('../dashboard-bi-metrics.js');
const company=(id,over={})=>({id,name:'Empresa '+id,dominio:id,cnpj:'11.111.111/0001-11',walletAssignedUserIds:['a'],documentHistory:{'2026-11':{status:'Recebido'}},reconciliationTracking:{'2026-11':{start:'2026-11-04',end:'2026-11-09',deadline:'2026-11-12'}},movements:[{id:'m'+id,date:'2026-11-05',status:'CONFIRMADO',confidence:'Excel colado — validado automaticamente'},{id:'n'+id,date:'2026-11-06',status:'PENDENTE'}],crmHistory:[{type:'charge',periods:['2026-11']}],learnedCodes:[{key:'banco',codes:{'100':1}}],...over});
const t={effective:(c,p)=>({data:{...c.reconciliationTracking?.[p],status:c.reconciliationTracking?.[p]?.end?'Concluída':'Não iniciada',effectiveSeconds:c.reconciliationTracking?.[p]?.end?3600:null,pendingRemaining:1,reworkCount:0}})};
test('sem conta autenticada não mostra empresas',()=>assert.deepEqual(BI.authorized([company('1')],''),[]));
test('não permite visualizar empresa de outra carteira',()=>assert.deepEqual(BI.authorized([company('1'),company('2',{walletAssignedUserIds:['b']})],'a').map(x=>x.id),['1']));
test('cartões de inativos preservados e sem obrigatoriedade corrente',()=>{
 const items=[company('1'),company('2',{clientInactive:true})],s=BI.summarize(items,'a','2026-11',{tracking:t}).summary;
 assert.equal(s.total,2);assert.equal(s.active,1);assert.equal(s.inactive,1);assert.equal(s.applicable,1);assert.equal(s.concluded,1);
});
test('mesmo id de empresa contado uma única vez na competência',()=>{
 const s=BI.summarize([company('1')],'a','2026-11',{tracking:t}).summary;
 assert.equal(s.total,1);assert.equal(s.movements,2);assert.equal(s.classified,1);
});
test('taxa de automação não conta colagem do Excel como automática',()=>{
 const s=BI.summarize([company('1')],'a','2026-11',{tracking:t}).summary;
 assert.equal(s.automaticRate,0);assert.equal(s.excelRate,100);assert.equal(s.excel,1);
});
test('percentual de conclusão depende do universo aplicável',()=>{
 const c2=company('2',{reconciliationTracking:{'2026-11':{start:'2026-11-05'}}});
 const s=BI.summarize([company('1'),c2],'a','2026-11',{tracking:t}).summary;
 assert.equal(s.completion,50);assert.equal(s.remaining,1);
});
test('tempo médio só usa conclusões com tempo válido',()=>{
 const c2=company('2',{reconciliationTracking:{'2026-11':{start:'2026-11-05'}}});
 const s=BI.summarize([company('1'),c2],'a','2026-11',{tracking:t}).summary;
 assert.equal(s.timed,1);assert.equal(s.seconds,3600);assert.equal(s.averageSeconds,3600);
});
test('sem medição não apresenta zero como tempo efetivo',()=>{
 const s=BI.summarize([company('1',{reconciliationTracking:{}})],'a','2026-11').summary;
 assert.equal(s.seconds,null);assert.equal(s.averageSeconds,null);
});
test('taxas com denominador zero são indisponíveis',()=>{assert.equal(BI.ratio(0,0),null);assert.equal(BI.ratio(1,0),null)});
test('histórico temporal preserva 12 competências ordenadas',()=>{
 const rows=BI.timeline([company('1')],'a',2026,{tracking:t});assert.equal(rows.length,12);assert.equal(rows[0].period,'2026-01');assert.equal(rows[11].period,'2026-12');
});
test('filtros de empresa isolam a agregação sem alterar a entrada',()=>{
 const rows=[company('1'),company('2')],snapshot=JSON.stringify(rows);
 const s=BI.summarize(rows,'a','2026-11',{companyId:'2',tracking:t}).summary;
 assert.equal(s.total,1);assert.equal(JSON.stringify(rows),snapshot);
});
test('dados documentais recebidos e cobrados não são sinônimos',()=>{
 const c=company('1',{documentHistory:{'2026-11':{status:'Cobrado'}}});
 const s=BI.summarize([c],'a','2026-11',{tracking:t}).summary;
 assert.equal(s.documentEligible,1);assert.equal(s.documentReceived,0);assert.equal(s.documentRate,0);assert.equal(s.charges,1);
});
test('competência inválida é rejeitada',()=>assert.throws(()=>BI.summarize([company('1')],'a','2026-13'),/inválida/));
