'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DOCS=['Cod. Do Sistema','Data de Inicio','Data de Distrato','E-mails','Cliente','CNPJ','Regime Tributário','Plano Contratado','Responsavel',...months,'Observação'];
const CLOSING=['Cod. Do Sistema','Data de Inicio','Data de Distrato','Cliente','CNPJ','Regime Tributário','Plano Contratado','Responsáveis',...months,'Observação'];
function cnpj(i){const digits=('00000000'+String(10000000+i)).slice(-8)+'0001';let s=digits;for(const n of [12,13]){let w=n-7,z=0;for(let j=0;j<n;j++){z+=Number(s[j])*w;w=w===2?9:w-1;}s+=String(z%11<2?0:11-z%11);}return s;}
function fixtures(){
 const docs=[DOCS],closing=[CLOSING];
 for(let i=0;i<63;i++){
  const b=i<60,cn=b?cnpj(i):cnpj(100+i),status=['Recebido','Pendente','Cobrado',null,'Parcialmente recebido','Sem movimentação','Não se aplica'][i%7];
  const ended=i<60&&i>=55?'2026-10-15':null;
  docs.push([i,45000,ended,i===0?'a@example.test / segundo@example.test':i===1?'invalido@':null,'Empresa Fictícia '+i,cn,'SIMPLES','Básico',b?'Beatriz':'Outro',...months.map((m,j)=>j%2===0?status:null),null]);
  closing.push([i,45000,ended,'Empresa Fictícia '+i,cn,'SIMPLES','Básico',b?'Beatriz':'Outro',...months.map((m,j)=>j%3===0?'concluido':null),null]);
 }
 return {docs,closing};
}
function load(){
 const win={},src=fs.readFileSync(path.join(root,'document-import.js'),'utf8');
 vm.runInNewContext(src,{window:win,console,Date,Map,Set,Object,String,Number,RegExp});
 return win.ConciliaDocumentImport;
}
const imp=load(),fixture=fixtures();
test('Beatriz: 60 empresas, 55 ativas, 5 distratos; excluir outras equipes',()=>{
 const d=imp.parseWorkbookRows(fixture.docs,fixture.closing,2026);
 assert.equal(d.counts.all,60);assert.equal(d.counts.active,55);assert.equal(d.counts.inactive,5);
 assert.equal(d.sourceRows.closing,60);
 assert.ok(!d.selected.some(x=>x.name==='Empresa Fictícia 60'));
});
test('CNPJ normalizado com dígito verificador',()=>{
 assert.equal(imp.cnpjValid(cnpj(1)),true);
 assert.equal(imp.cnpjValid('00000000000000'),false);
 assert.equal(imp.digits('11.222.333/0001-81'),'11222333000181');
});
test('12 competências, células vazias e situações especiais preservadas',()=>{
 const d=imp.parseWorkbookRows(fixture.docs,fixture.closing,2026);
 assert.equal(d.counts.monthlyCells,720);
 assert.equal(d.selected[0].months.length,12);
 assert.equal(d.selected[0].months[1].value,'Sem registro');
 assert.equal(d.selected[0].months[1].empty,true);
 assert.equal(d.selected[5].months[0].value,'Sem movimentação');
 assert.equal(d.selected[5].months[0].special,true);
 assert.equal(d.selected[2].months[0].value,'Cobrado');
 assert.equal(d.selected[2].closing[0].raw,'concluido');
});
test('não inventa recebimento nem cobrança e mantém dados separados',()=>{
 const out=imp.merge({companies:[]},imp.parseWorkbookRows(fixture.docs,fixture.closing,2026),'fake-2026','user-a');
 assert.equal(out.counts.created,60);assert.equal(out.counts.docRecords,720);
 assert.equal(out.counts.closingRecords,720);
 const row=out.workspace.companies[0].documentHistory['2026-01'];
 assert.equal(row.receivedAt,null);assert.equal(row.chargedAt,null);assert.equal(row.updatedAt,null);
 assert.equal(out.workspace.companies[0].closingHistory['2026-01'].rawStatus,'concluido');
});
test('Excel com ano não confirmado bloqueado',()=>{
 assert.throws(()=>imp.parseWorkbookRows(fixture.docs,fixture.closing,''),/ano de referência/);
});
test('e-mails múltiplos, inválidos e repetidos',()=>{
 const x=imp.emails('A@EXAMPLE.TEST / b@example.test ; a@example.test / invalido@');
 assert.equal(x.valid.length,2);assert.equal(x.review.length,1);assert.equal(x.raw.includes('invalido@'),true);
});
test('idempotência: reimportar não duplica clientes, e-mails ou competências',()=>{
 const p=imp.parseWorkbookRows(fixture.docs,fixture.closing,2026);
 const a=imp.merge({companies:[]},p,'first','user-a'),b=imp.merge(a.workspace,p,'second','user-a');
 assert.equal(b.counts.created,0);assert.equal(b.counts.reused,60);
 assert.equal(b.counts.docRecords,0);assert.equal(b.counts.closingRecords,0);assert.equal(b.counts.newEmails,0);
 assert.equal(b.workspace.companies.length,60);
});
test('empresa já cadastrada mantém códigos aprendidos e observações manuais',()=>{
 const p=imp.parseWorkbookRows(fixture.docs,fixture.closing,2026);
 const old={id:'empresa-antiga',name:'Nome editado manualmente',cnpj:cnpj(0),plan:[{code:'599'}],plansHistory:[{at:'2026'}],rules:[{term:'APL APLIC AUT MAIS',counterpart:'599'}],partners:[{name:'Socia Teste'}],relatedCompanies:[{name:'Outra Empresa'}],reconciliationTracking:{'2026-01':{end:'2026-02-14'}},documentHistory:{'2026-01':{status:'Recebido',notes:'Manualmente corrigido',updatedBy:'user-a'}}};
 const result=imp.merge({companies:[old]},p,'xlsx','user-a');const c=result.workspace.companies.find(x=>x.id==='empresa-antiga');
 assert.equal(c.name,'Nome editado manualmente');assert.equal(c.plan[0].code,'599');
 assert.equal(c.rules[0].counterpart,'599');assert.equal(c.partners.length,1);assert.equal(c.relatedCompanies.length,1);
 assert.equal(c.documentHistory['2026-01'].notes,'Manualmente corrigido');assert.ok(c.reconciliationTracking['2026-01']);
});
test('empresa vinculada a outra pessoa não sofre atualização',()=>{
 const p=imp.parseWorkbookRows(fixture.docs,fixture.closing,2026);
 const old={id:'outro',name:'Empresa protegida',cnpj:cnpj(0),walletAssignedUserIds:['user-b'],plan:[{code:'192'}],rules:[{code:'192'}]};
 const out=imp.merge({companies:[old]},p,'xlsx','user-a');const c=out.workspace.companies.find(x=>x.id==='outro');
 assert.equal(c.name,'Empresa protegida');assert.equal(c.documentHistory,undefined);assert.equal(c.rules[0].code,'192');
 assert.equal(out.counts.conflicts.length,1);
});
test('bloqueio permanente de importação definitiva na branch',()=>{
 const s=fs.readFileSync(path.join(root,'document-management.js'),'utf8');
 assert.ok(s.includes('canImportDefinitively:false'));
 assert.ok(!s.includes("mergePreview(state"));
});
test('interface foi adicionada sem substituir módulos de conciliação',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 assert.ok(html.includes('data-page="documentos"')&&html.includes('id="p-documentos"'));
 assert.ok(html.includes('document-import.js')&&html.includes('document-management.js'));
 assert.ok(app.includes('window.ConciliaDocuments?.render()'));
 for(const key of ['id="importPlanButton"','data-page="importar"','data-page="movimentos"','data-page="transferencias"','data-page="carteira"'])assert.ok(html.includes(key));
});

test('prévia de importação é leitura somente e confirma o ano 2026',()=>{
 const app=fs.readFileSync(path.join(root,'document-management.js'),'utf8');
 assert.match(app,/id="docsYearSource"[^>]*value="2026"/);
 assert.match(app,/dryRun=M.merge\(state,preview/);
 assert.match(app,/canImportDefinitively:false/);
 assert.ok(!app.includes('store(\'IMPORTACAO_XLSX'));
});
test('nome ou código Domínio coincidente com CNPJ divergente NÃO cria empresa duplicada',()=>{
 const p=imp.parseWorkbookRows(fixture.docs,fixture.closing,2026);
 const original={id:'old',name:p.selected[0].name,cnpj:'',dominio:p.selected[0].code,plan:[{code:'599'}],rules:[{counterpart:'599'}]};
 const out=imp.merge({companies:[original]},p,'dryrun','user-a');
 assert.equal(out.counts.conflicts.length,1);
 assert.equal(out.workspace.companies.length,60);
 assert.equal(out.workspace.companies.find(x=>x.id==='old').rules[0].counterpart,'599');
});
test('múltiplos registros existentes com mesmo CNPJ interrompem associação ambígua',()=>{
 const p=imp.parseWorkbookRows(fixture.docs,fixture.closing,2026);
 const a={id:'dup-1',name:'Cliente antigo',cnpj:p.selected[0].cnpj,plan:[{code:'1'}]};
 const b={id:'dup-2',name:'Outro antigo',cnpj:p.selected[0].cnpj,plan:[{code:'2'}]};
 const out=imp.merge({companies:[a,b]},p,'dryrun','user-a');
 assert.equal(out.counts.conflicts.length,1);
 assert.ok(out.workspace.companies.find(x=>x.id==='dup-1').plan.length===1);
 assert.ok(out.workspace.companies.find(x=>x.id==='dup-2').plan.length===1);
});
test('mesclagem em memória jamais modifica o workspace original',()=>{
 const p=imp.parseWorkbookRows(fixture.docs,fixture.closing,2026);
 const original={companies:[{id:'old',name:'Empresa protegida',cnpj:cnpj(0),plan:[{code:'192'}],rules:[{code:'192'}],documentHistory:{'2026-01':{status:'Cobrado'}}}]};
 const before=JSON.stringify(original);imp.merge(original,p,'dryrun','user-a');
 assert.equal(JSON.stringify(original),before);
});

test('status padronizado mantém classificação Cobrado, mas preserva o valor bruto com espaço final',()=>{
 const x=imp.status('Cobrado ');
 assert.equal(x.value,'Cobrado');
 assert.equal(x.raw,'Cobrado ');
 assert.equal(x.empty,false);
});
