'use strict';
const assert=require('node:assert/strict');
const Core=require('../core.js'),Audit=require('../auditoria.js'),Assist=require('../assistente.js');
const plan=['536','608','8','1211'].map(code=>({code,description:'Conta '+code,analytic:true}));
function company(){
 return {id:'demo',name:'EMPRESA FICTÍCIA',cnpj:'00000000000000',plan,
 accounts:[{id:'i',bank:'Itaú',chartCode:'536'},{id:'p',bank:'PagBank',chartCode:'608'},{id:'n',bank:'Nubank',chartCode:'8'}],
 movements:[],transfers:[],rules:[],imports:[],ledger:[]};
}
const movement=(id,accountId,date,cents)=>({id,accountId,date,cents,origin:accountId+'.pdf',status:'PENDENTE',history:'Teste fictício',counterpart:''});
const c=company();
c.movements.push(movement('p1','p','2026-09-08',-103291),movement('i1','i','2026-09-08',103291));
c.ledger.push({period:'2026-09',accountCode:'8',file:'razao_nu.pdf',entries:[{id:'l1',date:'2026-09-08',debit:'536',credit:'8',cents:103291,documentNo:'4057'}]});
const audit=Audit.audit(Core,c,'2026-09');
const transfer=audit.events.find(e=>e.type==='TRANSFERENCIA_CANDIDATA'&&e.sourceBank==='PagBank'&&e.targetBank==='Itaú');
assert.equal(transfer?.debit,'536');assert.equal(transfer?.credit,'608');
const nubank=audit.events.find(e=>e.type==='RAZAO_SEM_EXTRATO'&&e.bank==='Nubank');
assert.equal(nubank?.cents,-103291);
assert.match(nubank.evidence,/PagBank/);
assert.equal(audit.events.some(e=>e.type==='EXTRATO_SEM_RAZAO'&&e.bank==='PagBank'),false,'Sem Razão não chamar movimentação de divergência comprovada');
const multi=company();
multi.movements.push(movement('a','p','2026-09-08',-5000),movement('b','i','2026-09-08',5000),movement('c','i','2026-09-08',5000));
const suggestions=Audit.audit(Core,multi,'2026-09').events;
assert.equal(suggestions.some(e=>e.type==='TRANSFERENCIA_CANDIDATA'),false,'Duas correspondências: não escolher uma');
assert(suggestions.some(e=>e.type==='TRANSFERENCIA_AMBIGUA'),'Sinalizar múltiplas possibilidades');
const counts=Assist.analisar(Core,c,'2026-09');
assert.equal(counts.ready,false);
assert.equal(counts.exportable,false);
console.log('OK: transferência candidata, possível lançamento em conta errada, valores repetidos e exportação bloqueada.');
