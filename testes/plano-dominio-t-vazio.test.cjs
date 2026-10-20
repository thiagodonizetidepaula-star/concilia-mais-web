'use strict';
// Teste sintético: no PDF do Domínio, T vazio representa conta analítica.
const assert = require('node:assert/strict');
const Reader = require('../pdf-reader.js');
const rows = [
  'Empresa: EMPRESA FICTICIA LTDA Folha: 0001',
  'C.N.P.J.: 00.000.000/0001-00',
  'PLANO DE CONTAS',
  'Código T Classificação Nome Grau',
  '1 S 1 ATIVO 1',
  '7 S 1.1.1.02 BANCOS CONTA MOVIMENTO 4',
  '8 1.1.1.02.000001 BANCO DO BRASIL 5',
  '536 1.1.1.02.000002 BANCO STONE 5',
  '10000 A 1.1.2.01.000001 CLIENTES 5',
  '400 S 4.1.1.01 DESPESAS 4'
];
const pdf = { lines: rows.map((content, i) => ({page:1,line:i+1,content})), pages:1 };
const parsed = Reader.parsePlanPdf(pdf,'plano-ficticio.pdf');
assert.equal(parsed.accounts.length,6);
assert.equal(parsed.accounts.filter(a=>a.analytic).length,3);
assert.equal(parsed.accounts.find(a=>a.code==='7').analytic,false);
assert.equal(parsed.accounts.find(a=>a.code==='8').analytic,true);
assert.equal(parsed.accounts.find(a=>a.code==='536').analytic,true);
assert.equal(parsed.accounts.find(a=>a.code==='10000').analytic,true);
assert.equal(parsed.accounts.find(a=>a.code==='400').analytic,false);
assert.equal(parsed.identity.name,'EMPRESA FICTICIA LTDA');
assert.equal(parsed.identity.cnpj,'00000000000100');
console.log('OK: Domínio PDF aceita T vazio como analítica, S como sintética e A como analítica.');
