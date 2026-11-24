/* Regression tests for Receita Federal PDF total fields displaced from "Totais". */
/* Run: node tests/tax-reconciliation.test.js */
const assert=require('node:assert/strict');
const Tax=require('../tax-reconciliation.js');
function receipt(page,kind,id,paid,apuracao,lines,total){
 const text=[
  'Comprovamos que consta nos sistemas da Receita Federal registro de arrecadação de '+kind+' com os dados a seguir:',
  '28.637.576/0001-83 JL INFINITY RECURSOS HUMANOS LTDA',
  'Período Apuração Data de Vencimento Número do Documento',
  apuracao+' '+paid+' '+id,
  'Composição do Documento de Arrecadação',
  'Código Descrição Principal Multa Juros Total',
  ...lines,'Totais','Banco Data de Arrecadação','341 - BANCO ITAU S A '+paid
 ].map(content=>({page,content}));
 const items=[{page,x:22,y:360,str:'Totais'},...[
  ['407,58',340],['81,49',410],['61,33',480],[total,550]
 ].map(([str,x])=>({page,x,y:357,str}))];
 return {text,items};
}
const six550=[
 '1099 Contrib Prev Descontada de Segurado Contribuinte Individual 26,05 5,21 0,78 32,04',
 '1079 TJLP - Cont Previd Descontada Segurado - - 2,98 2,98',
 '0561 IRRF - Rendimentos do trabalho assalariado 94,19 18,83 3,56 116,58',
 '0016 TJLP - IRRF - Parcelamentos - - 10,85 10,85',
 '1082 Contrib Previd Descontada de Segurados 287,34 57,45 10,12 354,91',
 '1079 TJLP - Cont Previd Descontada Segurado - - 33,04 33,04'
];
const docs=[
 receipt(1,'DARF','07032601932174400','30/01/2026','30/01/2026',six550,'550,40'),
 receipt(2,'DARF','07162535790944451','20/01/2026','31/12/2025',[
 '1082 Contrib Previd Descontada de Segurados 1.313,75 - - 1.313,75',
 '0561 IRRF - Rendimentos do trabalho assalariado 212,41 - - 212,41'
 ],'1.526,16'),
 receipt(3,'DAS','07202601536820191','20/01/2026','12/2025',[
 '1001 IRPJ - SIMPLES NACIONAL 8.191,97 - - 8.191,97'
 ],'8.191,97'),
 receipt(4,'DARF','07032600761820703','12/01/2026','28/11/2025',six550,'550,40'),
 receipt(5,'DARF','07032600761874072','12/01/2026','30/12/2025',six550,'550,40'),
 receipt(6,'DAS','07182601298412841','12/01/2026','01/2026',[
 '1001 IRPJ - SIMPLES NACIONAL 9.430,02 - - 9.430,02'
 ],'9.430,02')
];
const data=Tax.parseReceipts({lines:docs.flatMap(d=>d.text),items:docs.flatMap(d=>d.items)});
assert.equal(data.receipts.length,6);
assert.equal(data.reviews.length,0);
assert.ok(data.receipts.every(r=>r.valid&&r.declared===r.totalCents));
const company={
 cnpj:'28.637.576/0001-83',
 plan:['536','336','680','178','478','479'].map(code=>({code,analytic:true})),
 accounts:[{id:'itau',chartCode:'536'}],
 taxRules:Tax.defaults(),
 movements:[
  ['m550','2026-01-30',-55040,'PAGAMENTOS TRIB COD BARRAS'],
  ['m1526','2026-01-20',-152616,'SISPAG TRIBUTOS DARF'],
  ['m8191','2026-01-20',-819197,'SISPAG TRIBUTOS DAS'],
  ['m1100','2026-01-12',-110080,'SISPAG TRIBUTOS DARF'],
  ['m9430','2026-01-12',-943002,'SISPAG TRIBUTOS DAS']
 ].map(([id,date,cents,history])=>({id,date,cents,history,accountId:'itau'}))
};
const matches=Tax.matches(company,'2026-01',data.receipts);
assert.equal(matches.issues.length,0);
assert.equal(matches.proposals.length,5);
const grouped=new Map(matches.proposals.map(p=>[p.movementId,p]));
assert.equal(grouped.get('m1100').receipts.length,2);
assert.equal(grouped.get('m550').lines.length,6);
assert.equal(grouped.get('m1526').lines.find(l=>l.revenueCode==='0561').code,'178');
assert.equal(grouped.get('m9430').lines.length,1);
assert.equal(grouped.get('m9430').lines[0].code,'479');
for(const proposal of matches.proposals){
 assert.equal(proposal.lines.reduce((sum,l)=>sum+l.cents,0),-proposal.cents);
 Tax.confirm(company,proposal);
}
assert.equal(company.taxSplits.length,5);
assert.equal(Tax.matches(company,'2026-01',data.receipts).proposals.length,0);
const noTotal=Tax.parseReceipts({lines:docs[0].text,items:[]});
assert.equal(noTotal.receipts[0].valid,false);
assert.match(noTotal.reviews[0],/total do comprovante não localizado/);
console.log('PASS: seis comprovantes, cinco pagamentos, DARF separado, DAS integral, sem duplicidade.');
