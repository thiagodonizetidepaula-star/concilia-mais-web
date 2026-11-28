'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'crm-core.js'),'utf8');
const sandbox={window:{},Date,Intl,console,Math,JSON,Set,Object,String,Number,RegExp};vm.runInNewContext(code,sandbox);
const C=sandbox.window.ConciliaCrmCore,defaultDates={...C.DEFAULTS};
const base=(n='c1',inactive=false)=>({id:n,name:'EMPRESA '+n,cnpj:'11222333000181',dominio:'114',clientInactive:inactive,documentHistory:{
 '2026-09':{status:'Pendente'},'2026-10':{status:'Cobrado',rawStatus:'Cobrado '},'2026-11':{status:'Parcialmente recebido'},'2026-12':{status:'Pendente'},
 '2026-08':{status:'Recebido'},'2026-07':{status:'Não se aplica'},'2026-06':{status:'Sem registro',sourceEmpty:true}
},crmHistory:[],walletAssignedUserIds:['employee-a'],plan:[{code:'192'}],rules:[{term:'CEF MATRIZ',code:'192'}],partners:[{id:'s1'}],relatedCompanies:[{id:'r1'}]});
const fixed='2026-11-27';
test('defaults recurring reminders/charges 14/15/24/25',()=>{
 assert.deepEqual(Array.from(C.eventsForMonth(2026,11).map(x=>x.date)),['2026-11-14','2026-11-15','2026-11-24','2026-11-25']);
 assert.deepEqual(Array.from(C.eventsForMonth(2027,1).map(x=>x.date)),['2027-01-14','2027-01-15','2027-01-24','2027-01-25']);
});
test('Brasília timezone uses local day across UTC rollover',()=>{
 assert.equal(C.todayBrazil(new Date('2026-11-28T01:15:00Z')),'2026-11-27');
 assert.equal(C.todayBrazil(new Date('2026-11-28T04:00:00Z')),'2026-11-28');
});
test('schedule changes take effect for future only',()=>{
 const custom=C.schedule({reminder1:10,charge1:11,reminder2:21,charge2:22});
 assert.equal(C.eventsForMonth(2027,2,custom)[0].date,'2027-02-10');
 assert.equal(C.eventsForMonth(2026,11)[0].date,'2026-11-14');
});
test('invalid chronology and invalid days rejected',()=>{
 assert.throws(()=>C.schedule({reminder1:16,charge1:15}),/lembrete 1/);
 assert.throws(()=>C.schedule({reminder2:33}),/Dia inválido/);
 assert.throws(()=>C.schedule({shortMonth:'automatic-business-day'}),/meses curtos/);
});
test('February and short months: last-day versus skip',()=>{
 const last=C.schedule({reminder1:27,charge1:29,reminder2:30,charge2:31,shortMonth:'last-day'});
 const skip=C.schedule({...last,shortMonth:'skip'});
 assert.equal(C.eventsForMonth(2026,2,last).length,4);
 assert.equal(C.eventsForMonth(2026,2,skip).length,1);
 assert.equal(C.eventsForMonth(2026,2,last)[3].date,'2026-02-28');
 assert.equal(C.eventsForMonth(2028,2,last)[3].date,'2028-02-29');
});
test('next reminder and charge when cycle crosses year boundary',()=>{
 const future=C.scheduleNext('2026-12-27',C.DEFAULTS);
 assert.equal(future[0].date,'2027-01-14');assert.equal(future[1].date,'2027-01-15');
});
test('does not automatically shift weekends or holidays',()=>{
 assert.equal(C.eventsForMonth(2026,11)[0].date,'2026-11-14');
 assert.equal(C.eventsForMonth(2026,11)[1].date,'2026-11-15');
});
test('due status: pending, partial and charged still not received',()=>{
 const p=C.eligiblePeriods(base(),fixed,C.DEFAULTS);
 assert.deepEqual(Array.from(p.due.map(x=>x.period)),['2026-09','2026-10','2026-11']);
});
test('received, not applicable and future competencies excluded',()=>{
 const p=C.eligiblePeriods(base(),fixed,C.DEFAULTS);
 assert.ok(!p.due.some(x=>['2026-07','2026-08','2026-12'].includes(x.period)));
});
test('blank statuses separated from automatic collection',()=>{
 const p=C.eligiblePeriods(base(),fixed,C.DEFAULTS);
 assert.equal(p.unknown.length,1);assert.equal(p.unknown[0].period,'2026-06');
});
test('current competency only after first collection date',()=>{
 const p=C.eligiblePeriods(base(),'2026-11-10',C.DEFAULTS);
 assert.ok(!p.due.some(x=>x.period==='2026-11'));
 assert.ok(C.eligiblePeriods(base(),'2026-11-15',C.DEFAULTS).due.some(x=>x.period==='2026-11'));
});
test('inactive company excluded including existing distractDate',()=>{
 const a=base('1',true),b=base('2');b.distractDate='2026-05-31';
 const x=C.summary([a,b],'employee-a',fixed,C.DEFAULTS);
 assert.equal(x.companiesDue,0);
});
test('wallet ownership enforced and unknown user sees no company',()=>{
 const a=base(),x=C.summary([a],'employee-b',fixed,C.DEFAULTS);
 assert.equal(x.companiesDue,0);
 assert.equal(C.authorizedCompanies([a],null).length,0);
});
test('60-client fixture, 55 active 5 inactive, report eligibility',()=>{
 const companies=Array.from({length:60},(_,i)=>base('c'+i,i>=55));
 const p=C.summary(companies,'employee-a',fixed,C.DEFAULTS);
 assert.equal(p.companiesDue,55);
 assert.equal(p.companiesUnknown,55);
 assert.equal(p.documentPending,55);
 assert.equal(p.recurrent,55);
});
test('document receipt removes only received competence without deleting history',()=>{
 const a=base();const e=C.eventInput(a,{type:'charge',periods:['2026-09','2026-10'],occurredAt:'2026-11-20',medium:'Outlook manual',status:'Aguardando retorno',round:1},{userId:'employee-a',today:fixed});
 C.addEvent(a,e);a.documentHistory['2026-09'].status='Recebido';
 assert.ok(!C.eligiblePeriods(a,fixed,C.DEFAULTS).due.some(x=>x.period==='2026-09'));
 assert.equal(a.crmHistory.length,1);
 assert.equal(C.statusFor(a,'2026-09'),'Documentação recebida');
});
test('registered collections are independent of import Cobrado status',()=>{
 const a=base();assert.equal(C.summary([a],'employee-a',fixed,C.DEFAULTS).roundCharged,0);
 assert.equal(C.statusFor(a,'2026-10'),'A cobrar');
});
test('real manual charge allows multiple competencies and actor',()=>{
 const a=base();
 const e=C.eventInput(a,{type:'charge',periods:['2026-09','2026-10'],occurredAt:'2026-11-25',medium:'Outlook manual',status:'Aguardando retorno',round:2,notes:'Contato manual'},{userId:'employee-a',today:fixed});
 C.addEvent(a,e);
 assert.deepEqual(Array.from(e.periods),['2026-09','2026-10']);
 assert.equal(e.actorId,'employee-a');assert.equal(e.source,'manual');assert.equal(e.occurredAt,'2026-11-25');
 assert.equal(C.summary([a],'employee-a',fixed,C.DEFAULTS).roundCharged,1);
});
test('accidental duplicate blocked but legitimate repeated contact permitted',()=>{
 const a=base(),fields={type:'charge',periods:['2026-09'],occurredAt:'2026-11-25',medium:'Outlook manual',status:'Aguardando retorno',round:2};
 C.addEvent(a,C.eventInput(a,fields,{userId:'employee-a',today:fixed}));
 assert.throws(()=>C.eventInput(a,fields,{userId:'employee-a',today:fixed}),/POSSIVEL_DUPLICIDADE/);
 C.addEvent(a,C.eventInput(a,fields,{userId:'employee-a',today:fixed,allowDuplicate:true}));
 assert.equal(a.crmHistory.length,2);
});
test('client reply and notes kept in chronological immutable event log',()=>{
 const a=base();
 C.addEvent(a,C.eventInput(a,{type:'charge',periods:['2026-09'],occurredAt:'2026-11-20',medium:'Outlook manual'},{userId:'employee-a',today:fixed}));
 C.addEvent(a,C.eventInput(a,{type:'reply',periods:['2026-09'],occurredAt:'2026-11-22',medium:'Telefone',notes:'Resposta manual'},{userId:'employee-a',today:fixed}));
 assert.equal(C.statusFor(a,'2026-09'),'Cliente respondeu');
 assert.equal(a.crmHistory[0].type,'charge');
 assert.equal(a.crmHistory[1].type,'reply');
});
test('reject unauthorized actor, missing date, future and non-existing competencies',()=>{
 const a=base(),fields={type:'charge',periods:['2026-09'],occurredAt:'2026-11-25',medium:'Outlook manual'};
 assert.throws(()=>C.eventInput(a,fields,{userId:'employee-b',today:fixed}),/fora da carteira/);
 assert.throws(()=>C.eventInput(a,{...fields,occurredAt:''},{userId:'employee-a',today:fixed}),/data efetiva/);
 assert.throws(()=>C.eventInput(a,{...fields,occurredAt:'2026-12-01'},{userId:'employee-a',today:fixed}),/data efetiva/);
 assert.throws(()=>C.eventInput(a,{...fields,periods:['2027-01']},{userId:'employee-a',today:fixed}),/competências existentes/);
});
test('no fabricated number of charges or dates',()=>{
 const a=base();assert.equal(a.crmHistory.length,0);
 assert.equal(C.summary([a],'employee-a',fixed,C.DEFAULTS).roundCharged,0);
 assert.equal(C.statusFor(a,'2026-10'),'A cobrar');
});
test('CRM does not mutate plan, rules, partners, related companies',()=>{
 const a=base(),before=JSON.stringify({plan:a.plan,rules:a.rules,partners:a.partners,relatedCompanies:a.relatedCompanies,documentHistory:a.documentHistory});
 C.addEvent(a,C.eventInput(a,{type:'note',periods:['2026-10'],occurredAt:'2026-11-26',medium:'Outro',notes:'Comentário'},{userId:'employee-a',today:fixed}));
 assert.equal(JSON.stringify({plan:a.plan,rules:a.rules,partners:a.partners,relatedCompanies:a.relatedCompanies,documentHistory:a.documentHistory}),before);
});
test('new app navigation and no automatic external messaging',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),crm=fs.readFileSync(path.join(root,'crm.js'),'utf8');
 assert.ok(html.includes('data-page="crm"')&&html.includes('id="p-crm"')&&html.includes('id="crmOverviewAlerts"'));
 assert.ok(html.includes('crm-core.js')&&html.includes('crm.js')&&html.includes('crm.css'));
 assert.ok(app.includes('window.ConciliaCRM?.render()')&&app.includes("crm:['CRM Contábil'"));
 assert.ok(!/fetch\(\s*['"]https?:\/\/|sendMail\(|graph\.microsoft|smtp/i.test(crm));
});
