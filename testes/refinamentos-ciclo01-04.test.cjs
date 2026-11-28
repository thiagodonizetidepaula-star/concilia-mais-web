'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const L=require('../classification-learning.js');
const base=()=>({
 id:'empresa-alfa',plan:[{code:'536',analytic:true},{code:'192',analytic:true},{code:'479',analytic:true}],
 accounts:[{id:'itau',chartCode:'536',bank:'ITAU',label:'CONTA'}],
 movements:[{id:'m1',accountId:'itau',date:'2026-11-05',cents:-10000,history:'PIX PAGAMENTO ALFA',status:'PENDENTE'}],
 learnedCodes:[{key:'REGRA_ANTERIOR',codes:{'479':1},examples:1,verifiedExamples:1}]
});
const line=(code='192',id='m1')=>'Data\tDébito\tCrédito\tValor\tHistórico\tBanco\tID\n05/11/2026\t'+code+'\t536\t-100,00\tPIX PAGAMENTO ALFA\t536\t'+id;
const learn=(c,m,code)=>{c.learnedCodes.push({key:'NEW_'+m.id,codes:{[code]:1},verifiedExamples:1});return true;};
test('Excel completo: aplica uma vez, resolve status pendente e preserva memória preexistente',()=>{
 const c=base(),a=L.applyValidatedPaste(c,'2026-11',line(),learn);
 assert.equal(a.applied,1);assert.equal(c.movements[0].status,'CONFIRMADO');assert.equal(c.movements[0].counterpart,'192');
 assert.equal(c.learnedCodes.length,2);assert.equal(c.learnedCodes[0].key,'REGRA_ANTERIOR');
 assert.equal(L.applyValidatedPaste(c,'2026-11',line(),learn).applied,0);
});
test('regressão: códigos inválidos ou trocados não alteram status',()=>{
 for(const bad of [line('999'),line().replace('\t536\t-100,00','\t192\t-100,00')]){
  const c=base(),r=L.applyValidatedPaste(c,'2026-11',bad,learn);
  assert.equal(r.applied,0);assert.equal(c.movements[0].status,'PENDENTE');assert.equal(c.learnedCodes.length,1);
 }
});
test('duplicidades e divergências reais permanecem na Central',()=>{
 for(const status of ['PENDENTE_DUPLICIDADE','DIVERGENTE']){
  const c=base();c.movements[0].status=status;
  const r=L.applyValidatedPaste(c,'2026-11',line(),learn);
  assert.equal(r.applied,0);assert.equal(c.movements[0].status,status);
 }
});
test('match financeiro ambíguo ou não encontrado nunca confirma',()=>{
 for(const fm of ['AMBIGUA','SEM_CORRESPONDENCIA']){
  const c=base();c.movements[0].financialMatch=fm;
  assert.equal(L.applyValidatedPaste(c,'2026-11',line(),learn).applied,0);
 }
});
test('mesmo lançamento colado duas vezes: no máximo uma confirmação',()=>{
 const c=base(),raw=line()+'\n'+line().split('\n')[1],r=L.applyValidatedPaste(c,'2026-11',raw,learn);
 assert.equal(r.applied,1);assert.ok(r.issues.some(x=>/repetido/.test(x)));
});
test('mesmos data, valor e histórico em dois bancos são ambíguos sem identificador',()=>{
 const c=base();c.accounts.push({id:'caixa',chartCode:'479',bank:'CAIXA'});
 c.movements.push({...c.movements[0],id:'m2',accountId:'caixa'});
 const raw='Data\tDébito\tCrédito\tValor\tHistórico\n05/11/2026\t192\t536\t-100,00\tPIX PAGAMENTO ALFA';
 const r=L.applyValidatedPaste(c,'2026-11',raw,learn);
 assert.equal(r.applied,0);assert.equal(c.movements[0].status,'PENDENTE');
});
test('rollback restaura lançamentos e aprendizado integralmente',()=>{
 const c=base(),before=JSON.stringify(c),r=L.applyValidatedPaste(c,'2026-11',line(),learn);
 r.undo();assert.equal(JSON.stringify(c),before);
});
test('competência incorreta não seleciona movimentos de outra competência',()=>{
 const c=base(),r=L.applyValidatedPaste(c,'2026-10',line(),learn);
 assert.equal(r.applied,0);assert.equal(c.movements[0].status,'PENDENTE');
});
