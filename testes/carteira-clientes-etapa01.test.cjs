'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),walletSource=fs.readFileSync(path.join(root,'client-wallet.js'),'utf8'),appSource=fs.readFileSync(path.join(root,'app.js'),'utf8');
function makeCompany(id,cnpj,name='EMPRESA DE TESTE LTDA'){return {id,cnpj,name,dominio:'001',plan:[{code:'192',description:'FGTS',analytic:true}],plansHistory:[],accounts:[],rules:[{term:'CEF MATRIZ',code:'192'}],partners:[{id:'s1',name:'PESSOA FICTICIA',code:'192'}],relatedCompanies:[{id:'r1',name:'RELACIONADA FICTICIA',code:'192'}],taxRules:[{code:'479'}],imports:[],movements:[],ledger:[],transfers:[],reconciliationTracking:{'2026-07':{end:'2026-08-01'}}};}
function setup(companies=[makeCompany('c1','11222333000181')],opts={}){
 let uid=opts.uid??'user-a',logged=opts.logged??true,saveFails=opts.saveFails??false;
 const pane={innerHTML:'',listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}},select={value:''};
 const targets={'#walletPanel':pane,'#companySelect':select,'#planTable':{scrollIntoView(){}},'#partnerForm':{scrollIntoView(){}},'#relatedCompanyForm':{scrollIntoView(){}}};
 const notes=[],calls=[],state={companies},window={ConciliaCloud:{accountId:()=>uid,authenticated:()=>logged},lucide:{createIcons(){}}};
 const context={state,window,document:{readyState:'complete',querySelector:s=>targets[s]||null,addEventListener(){}},companyId:'',renderSelection(){calls.push('renderSelection')},showPage(p){calls.push(['showPage',p])},async store(kind,detail){if(saveFails)throw Error('Simulated write failure');calls.push(['store',kind,detail]);},say:s=>notes.push(s),confirm:()=>true,FormData:class{constructor(form){this.form=form;}get(k){return this.form[k]??null;}},console,Intl};
 vm.runInNewContext(walletSource,context,{filename:'client-wallet.js'});
 return {context,window,pane,select,notes,calls,setUid:x=>uid=x,setLogged:x=>logged=x,setSaveFails:x=>saveFails=x};
}
const apiFixture=f=>f.window.ConciliaWallet;
const action=(f,type,id)=>f.pane.listeners.click({target:{closest:()=>({dataset:{wallet:type,id}})},preventDefault(){}});
const save=async(f,fields)=>{f.pane.listeners.submit({target:{id:'walletEditor',...fields},preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));};
test('carteira usa cadastros existentes, contador real e navegação',()=>{
 const f=setup([makeCompany('a','11222333000181'),makeCompany('b','12345678000195')]);
 apiFixture(f).render();
 assert.equal(apiFixture(f).visible().length,2);assert.match(f.pane.innerHTML,/clientes vinculados/);assert.match(f.pane.innerHTML,/<strong>2<\/strong>/);
 for(const a of ['plan','partners','related','edit','detail'])assert.ok(f.pane.innerHTML.includes('data-wallet="'+a+'"'));
 assert.equal(f.context.state.companies.length,2);
});
test('isolamento por conta e logout',()=>{
 const a=makeCompany('a','11222333000181');a.walletAssignedUserIds=['user-a'];
 const b=makeCompany('b','12345678000195','EMPRESA OCULTA');b.walletAssignedUserIds=['user-b'];
 const f=setup([a,b]);assert.deepEqual(Array.from(apiFixture(f).visible(),x=>x.id),['a']);
 apiFixture(f).render();assert.doesNotMatch(f.pane.innerHTML,/EMPRESA OCULTA/);
 f.setUid('user-b');assert.deepEqual(Array.from(apiFixture(f).visible(),x=>x.id),['b']);
 f.setLogged(false);assert.equal(apiFixture(f).visible().length,0);
});
test('validar CNPJ, bloquear duplicidade e impedir exclusão de CNPJ',async()=>{
 const f=setup([makeCompany('a','11222333000181'),makeCompany('b','12345678000195')]);
 assert.equal(apiFixture(f).cnpjValid('11.222.333/0001-81'),true);
 assert.equal(apiFixture(f).cnpjValid('11.222.333/0001-82'),false);
 assert.equal(apiFixture(f).cnpjValid('00.000.000/0000-00'),false);
 action(f,'edit','a');await save(f,{name:'Nova razão',cnpj:'12345678000195'});
 assert.equal(f.context.state.companies[0].name,'EMPRESA DE TESTE LTDA');
 await save(f,{name:'Nova razão',cnpj:''});
 assert.equal(f.context.state.companies[0].cnpj,'11222333000181');
});
test('edição mantém aprendizado, sócios e conciliações',async()=>{
 const c=makeCompany('a','11222333000181'),f=setup([c]);
 action(f,'edit','a');
 await save(f,{name:'NOVA RAZÃO SOCIAL',fantasyName:'MARCA TESTE',cnpj:'11.222.333/0001-81',clientNotes:'Observação fictícia'});
 assert.equal(c.name,'NOVA RAZÃO SOCIAL');assert.equal(c.fantasyName,'MARCA TESTE');assert.equal(c.clientNotes,'Observação fictícia');
 assert.equal(c.rules[0].code,'192');assert.equal(c.partners.length,1);assert.equal(c.relatedCompanies.length,1);assert.ok(c.reconciliationTracking['2026-07']);
 assert.ok(f.calls.some(x=>Array.isArray(x)&&x[0]==='store'&&x[1]==='CARTEIRA_CLIENTE_ATUALIZADO'));
});
test('falha de salvamento restaura cadastro',async()=>{
 const c=makeCompany('a','11222333000181'),f=setup([c],{saveFails:true});
 action(f,'edit','a');await save(f,{name:'NÃO SALVO',fantasyName:'TMP',cnpj:'11.222.333/0001-81',clientNotes:'TMP'});
 assert.equal(c.name,'EMPRESA DE TESTE LTDA');assert.equal(c.fantasyName,undefined);
});
test('atalhos abrem a tela original sem criar estruturas paralelas',()=>{
 for(const a of ['plan','partners','related']){
  const f=setup();action(f,a,'c1');assert.equal(f.select.value,'c1');
  assert.ok(f.calls.some(x=>Array.isArray(x)&&x[0]==='showPage'&&x[1]==='empresas'));
 }
});
function importOne({companies,info,currentId='',sha='sha',owner='user-a',confirm=()=>true}){
 const start=appSource.indexOf('const old=current(),normalizedCnpj='),end=appSource.indexOf('companyId=c.id;await afterImport',start);
 assert.ok(start>=0&&end>start,'trecho original do importador encontrado');
 const body=appSource.slice(start,end)+'\nreturn c;';
 const Core={id:()=> 'new-'+(companies.length+1),norm:s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()};
 const window={ConciliaWallet:{cnpjValid:apiFixture(setup()).cnpjValid},ConciliaCloud:{accountId:()=>owner}};
 return Function('state','info','current','Core','window','sha','file','parsed','confirm',body)({companies},info,()=>companies.find(c=>c.id===currentId),Core,window,sha,{name:'PLANO_TESTE.pdf'},{accounts:[{code:'1',analytic:true}]},confirm);
}
test('reimportação por CNPJ preserva nome editado e aprendizagem',()=>{
 const c=makeCompany('c1','11222333000181');c.nameManuallyEdited=true;c.name='NOME EDITADO MANUALMENTE';const list=[c];
 importOne({companies:list,info:{cnpj:'11.222.333/0001-81',name:'NOME DO ARQUIVO'},currentId:'c1'});
 assert.equal(list.length,1);assert.equal(c.name,'NOME EDITADO MANUALMENTE');assert.equal(c.rules[0].code,'192');
 assert.equal(c.partners.length,1);assert.equal(c.relatedCompanies.length,1);assert.ok(c.reconciliationTracking['2026-07']);
 assert.deepEqual(c.walletAssignedUserIds,['user-a']);assert.equal(c.plansHistory.length,1);
});
test('mesmo nome com CNPJ distinto não mistura empresas',()=>{
 const a=makeCompany('c1','12345678000195','EMPRESA HOMÔNIMA'),list=[a];
 const b=importOne({companies:list,info:{cnpj:'11222333000181',name:'EMPRESA HOMÔNIMA'},currentId:'c1',sha:'different'});
 assert.equal(list.length,2);assert.notEqual(a.id,b.id);
});
test('sem CNPJ só importa após confirmação explícita',()=>{
 const list=[],r=importOne({companies:list,info:{cnpj:'',name:'EMPRESA SEM CNPJ'},confirm:()=>false});
 assert.equal(r,undefined);assert.equal(list.length,0);
});
test('CNPJ inválido não cria cadastro',()=>{
 const list=[];assert.throws(()=>importOne({companies:list,info:{cnpj:'00000000000000',name:'ERRO'}}),/CNPJ/);assert.equal(list.length,0);
});
test('UI e rotas integradas sem remover importador original',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const text of ['data-page="carteira"','id="p-carteira"','id="importPlanButton"','client-wallet.js','client-wallet.css'])assert.ok(html.includes(text));
 assert.ok(appSource.includes("document.querySelectorAll('[data-page]').forEach"));
 assert.ok(appSource.includes('window.ConciliaWallet?.render()'));
});
