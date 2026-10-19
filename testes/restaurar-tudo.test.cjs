'use strict';
const assert=require('node:assert/strict');
const {restaurarImportacoes}=require('../assistente.js');
function workspace(){
 return {id:'empresa-teste',name:'EMPRESA FICTICIA',plan:[{code:'12',analytic:true}],accounts:[{id:'b',chartCode:'12'}],rules:[{id:'r',term:'tarifa'}],
 movements:[{id:'m1',date:'2026-09-03',importId:'e1'},{id:'m2',date:'2026-10-04',importId:'e2'}],
 ledger:[{id:'l1',period:'2026-09',importId:'r1'},{id:'l2',period:'2026-10',importId:'r2'}],
 transfers:[{outId:'m1',inId:'m2',status:'CONFIRMADA'}],
 imports:[{id:'e1',type:'EXTRATO',name:'set.pdf',periods:['2026-09']},{id:'e2',type:'EXTRATO',name:'out.pdf',periods:['2026-10']},{id:'r1',type:'RAZAO',name:'razao-set.pdf',periods:['2026-09']},{id:'r2',type:'RAZAO',name:'razao-out.pdf',periods:['2026-10']},{id:'p1',type:'PLANO',name:'plano.pdf',periods:[]}]};
}
const notes=[{companyId:'empresa-teste',importId:'e1'},{companyId:'empresa-teste',importId:'e2'},{companyId:'outra',origin:'set.pdf'}];
const sep=workspace();const r1=restaurarImportacoes(sep,'2026-09',notes,'period');
assert.equal(r1.stats.imports,2);assert.equal(sep.movements.length,1);assert.equal(sep.movements[0].date,'2026-10-04');
assert.equal(sep.ledger.length,1);assert.equal(sep.transfers.length,0);assert.equal(sep.imports.length,3);
assert.equal(r1.reviews.length,2);assert.equal(sep.plan.length,1);assert.equal(sep.accounts.length,1);assert.equal(sep.rules.length,1);
const all=workspace();const r2=restaurarImportacoes(all,'2026-09',notes,'company');
assert.equal(r2.stats.imports,4);assert.equal(all.movements.length,0);assert.equal(all.ledger.length,0);
assert.equal(all.imports.length,1);assert.equal(all.imports[0].type,'PLANO');
assert.equal(r2.reviews.length,1);assert.equal(r2.reviews[0].companyId,'outra');
const mixed=workspace();mixed.imports[0].periods.push('2026-10');
assert.throws(()=>restaurarImportacoes(mixed,'2026-09',notes,'period'),/também contêm outras competências/);
assert.equal(mixed.movements.length,2);assert.equal(mixed.imports.length,5);
console.log('OK: reinício por mês/empresa, multi-competência bloqueada e plano/contas/regras preservados');
