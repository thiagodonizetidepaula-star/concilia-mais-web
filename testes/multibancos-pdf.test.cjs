'use strict';
/* Testes com dados 100% fictícios — nunca incluir PDFs reais de clientes neste repositório. */
const assert=require('node:assert/strict');
const Core=require('../core.js');
const Reader=require('../pdf-layouts.js');
const Assist=require('../assistente.js');
const mk=(s,page=1)=>({page,content:s,line:s.slice(0,20)});
const pdf=lines=>({lines:lines.map(s=>mk(s)),pages:1,text:lines.join('\n')});
const p=Reader.parsePagBank(pdf([
'08/09/2026 Pix enviado - Própria Empresa -R$ 1.032,91',
'08/09/2026 Saldo do dia R$ 0,00',
'16/09/2026 Vendas - Crédito VISA R$ 63,04',
'16/09/2026 Vendas - Crédito VISA R$ 171,24',
'16/09/2026 Saldo do dia R$ 234,28',
'18/09/2026 Vendas - Crédito MASTERCARD R$ 237,81',
'18/09/2026 Saldo do dia R$ 472,09',
'21/09/2026 Pix enviado - Própria Empresa -R$ 472,09',
'21/09/2026 Saldo do dia R$ 0,00']), 'pag.pdf','p',Core);
assert.deepEqual(p.movements.map(x=>x.cents),[-103291,6304,17124,23781,-47209]);
assert.equal(p.balanceCheck.final,0);
const stone=Reader.parseStone(pdf([
'21/09/26 Saída Empresa LTDA - R$ 270,00 R$ 2,74 Itaú Transferência',
'21/09/26 Entrada Venda R$ 34,69 R$ 272,74',
'08/09/26 Saída Empresa LTDA - R$ 758,58 R$ 0,00 Itaú Transferência']), 'stone.pdf','s',Core);
assert.equal(stone.movements.length,3);
assert.equal(stone.balanceCheck.final,274);
const nubank=Reader.parseNubank(pdf([
'Saldo inicial 19,18','Saldo final do período 10,04',
'08 SET 2026 Total de entradas + 4.781,50',
'Transferência recebida pelo Pix Própria Empresa 4.781,50',
'Total de saídas - 4.800,68',
'Resgate de empréstimo 4.800,68',
'16 SET 2026 Total de entradas + 1.000,00',
'Transferência recebida pelo Pix Própria Empresa 1.000,00',
'Total de saídas - 1.000,00',
'Pagamento de fatura 1.000,00',
'17 SET 2026 Total de entradas + 4.500,00',
'Transferência recebida pelo Pix Própria Empresa 4.500,00',
'Total de saídas - 3.389,96',
'Resgate de empréstimo 959,09',
'Pagamento de fatura 2.430,87',
'21 SET 2026 Total de saídas - 1.100,00',
'Transferência enviada pelo Pix Própria Empresa 1.100,00']), 'nu.pdf','n',Core);
assert.equal(nubank.movements.length,8);
assert.equal(nubank.balanceCheck.status,'OK');
const plan=['536','1211','608','10000'].map(code=>({code,analytic:true}));
const company={plan,accounts:[{id:'s',bank:'Stone',chartCode:'1211'},{id:'p',bank:'PagBank',chartCode:'608'}],movements:[],transfers:[],imports:[
 {id:'i1',type:'EXTRATO',periods:['2026-09'],accountId:'s',name:'stone.pdf',balanceCheck:{status:'INDETERMINADO',final:274}},
 {id:'i2',type:'EXTRATO',periods:['2026-09'],accountId:'p',name:'pag.pdf',balanceCheck:{status:'INDETERMINADO',final:0}}],
 ledger:[
 {period:'2026-09',accountCode:'1211',openingBalance:106480,entries:[{id:'s1',date:'2026-09-01',debit:'1211',credit:'10000',cents:48759},{id:'s2',date:'2026-09-08',debit:'536',credit:'1211',cents:75858}]},
 {period:'2026-09',accountCode:'608',openingBalance:103291,entries:[{id:'p1',date:'2026-09-16',debit:'608',credit:'10000',cents:47209}]}]};
const diffs=Assist.divergenciasSaldo(company,'2026-09');
assert.equal(diffs.find(x=>x.bank==='Stone').difference,79107);
assert.equal(diffs.find(x=>x.bank==='PagBank').difference,150500);
console.log('OK: PagBank, Stone, Nubank, saldos divergentes e dados sem identificação de clientes.');
