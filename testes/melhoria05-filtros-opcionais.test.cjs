'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const B=require('../dashboard-bi-metrics.js');
const C=require('../melhoria05-core.js');

function setup(){
 const owner='user-05-test';
 const companies=[
  {id:'a',name:'ALFA TESTE',taxRegime:'Simples Nacional',serviceType:'Conciliação',accounts:[],
   walletAssignedUserIds:[owner],movements:[],reconciliationTracking:{'2026-11':{pendingRemaining:0,reworkCount:0}}},
  {id:'b',name:'BETA TESTE',regimeTributario:'Lucro Presumido',tipoServico:'Auditoria',accounts:[],
   walletAssignedUserIds:[owner],movements:[],reconciliationTracking:{'2026-11':{pendingRemaining:0,reworkCount:0}}},
  {id:'c',name:'SEM METADADOS',walletAssignedUserIds:[owner],movements:[]},
  {id:'secret',name:'NÃO AUTORIZADO',taxRegime:'Lucro Real',serviceType:'Fiscal',
   walletAssignedUserIds:['another-user'],movements:[]}
 ];
 const handlers={};
 const root={addEventListener:(type,fn)=>{handlers[type]=fn;}};
 const ui={owner:()=>owner,mode:()=> 'reports',context:()=>({companies}),privateState:()=>({}),render:()=>{}};
 const window={Concilia05:ui,Concilia05Core:C,ConciliaBIMetrics:B,Concilia05Analytics:{},ConciliaTrackingCore:null};
 const document={readyState:'loading',addEventListener:()=>{},querySelector:()=>root};
 const source=fs.readFileSync(path.join(__dirname,'../melhoria05-advanced-ui.js'),'utf8');
 vm.runInNewContext(source,{window,document,Date,Intl,console},{filename:'melhoria05-advanced-ui.js'});
 window.Concilia05Advanced.init();
 const change=(key,value)=>handlers.change({target:{dataset:{m05x:key},value}});
 return {panel:()=>window.Concilia05Advanced.panel(),change};
}
test('filtros opcionais apresentam apenas valores da carteira autorizada',()=>{
 const x=setup().panel();
 assert.match(x,/Regime tributário \(quando disponível\)/);
 assert.match(x,/Simples Nacional/);
 assert.match(x,/Lucro Presumido/);
 assert.doesNotMatch(x,/Lucro Real/);
 assert.match(x,/Tipo de serviço \(quando disponível\)/);
 assert.doesNotMatch(x,/Fiscal/);
 assert.match(x,/Complexidade \(quando avaliada\)/);
});
test('seleções filtram lista de empresas sem presumir metadados ausentes',()=>{
 const x=setup();
 x.change('taxRegime','Simples Nacional');
 assert.match(x.panel(),/ALFA TESTE/);
 assert.doesNotMatch(x.panel(),/BETA TESTE/);
 x.change('taxRegime','');
 x.change('serviceType','Auditoria');
 assert.match(x.panel(),/BETA TESTE/);
 assert.doesNotMatch(x.panel(),/ALFA TESTE/);
});
test('complexidade é derivada somente de cinco critérios mensurados',()=>{
 const x=setup();
 x.change('month','2026-11');
 x.change('complexityLevel','Baixa');
 assert.match(x.panel(),/ALFA TESTE/);
 assert.match(x.panel(),/BETA TESTE/);
 assert.doesNotMatch(x.panel(),/SEM METADADOS/);
});
