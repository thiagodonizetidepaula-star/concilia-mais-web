'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),win={},src=fs.readFileSync(path.join(root,'tracking-core-v4.js'),'utf8');
vm.runInNewContext(src,{window:win,Date,Number,Object,Math,JSON,Set,String,RegExp,Intl});const T=win.ConciliaTrackingCore;
const comp=(name='A',inactive=false)=>({id:name,name:'Empresa '+name,cnpj:'23963478000112',dominio:'114',walletAssignedUserIds:['u1'],clientInactive:inactive,plan:[{code:'192'}],rules:[{history:'FGTS',code:'192'}],partners:[{name:'Pessoa'}],imports:[],movements:[],transfers:[],ledger:[],documentHistory:{'2026-10':{status:'Pendente'},'2026-11':{status:'Recebido'},'2026-12':{status:'Não se aplica'}},reconciliationTracking:{},reconciliationReview:{}});
test('conciliação aplicável: 55 ativas e 5 inativas sem dupla contagem',()=>{
 const companies=Array.from({length:60},(_,i)=>comp('N'+i,i>=55));
 const a=T.summarize(companies,'2026-11','u1');
 assert.equal(a.active,55);assert.equal(a.applicable,55);assert.equal(a.done,0);assert.equal(a.remaining,55);assert.equal(a.percent,0);
 const b=T.summarize(companies,'2026-12','u1');
 assert.equal(b.active,55);assert.equal(b.applicable,0);assert.equal(b.percent,0);
});
test('carteira isolada por funcionário e CNPJ preservado',()=>{
 const a=comp(),b=comp('B');b.walletAssignedUserIds=['u2'];
 assert.equal(T.summarize([a,b],'2026-11','u1').active,1);
 assert.equal(T.summarize([a,b],'2026-11','u2').active,1);
 assert.equal(T.summarize([a,b],'2026-11',null).active,0);
});
test('status documental e início real sem inferir conclusão',()=>{
 const c=comp(),before=T.auto(c,'2026-10');
 assert.equal(before.status,'Aguardando documentos');
 c.reconciliationTracking['2026-11']={start:'2026-11-06'};
 const after=T.auto(c,'2026-11');
 assert.equal(after.status,'Em andamento');assert.equal(after.end,null);
});
test('classificação automática não significa fechamento',()=>{
 const c=comp();c.movements=[{id:'1',date:'2026-11-07',status:'CONFIRMADO'},{id:'2',date:'2026-11-09',status:'PENDENTE'}];
 const r=T.auto(c,'2026-11');
 assert.equal(r.processed,2);assert.equal(r.classified,1);assert.notEqual(r.status,'Concluída');
});
test('edição gerencial não modifica as pendências ou regras reais',()=>{
 const c=comp();c.movements=[{id:'1',date:'2026-11-07',status:'PENDENTE'}];
 const before=JSON.stringify({movements:c.movements,plan:c.plan,rules:c.rules,transfers:c.transfers,ledger:c.ledger});
 const result=T.edit(c,'2026-11','pendingRemaining',0,'u1','controle ajustado');
 assert.equal(result.changed,true);assert.equal(T.effective(c,'2026-11').data.pendingRemaining,0);
 assert.equal(T.effective(c,'2026-11').auto.pendingRemaining,1);
 assert.equal(JSON.stringify({movements:c.movements,plan:c.plan,rules:c.rules,transfers:c.transfers,ledger:c.ledger}),before);
 assert.equal(c.reconciliationTracking['2026-11'].managementHistory.length,1);
});
test('restaurar automático mantém trilha de auditoria',()=>{
 const c=comp();T.edit(c,'2026-11','processed',12,'u1','planilha');T.restore(c,'2026-11','processed','u1','reversão');
 assert.equal(T.effective(c,'2026-11').data.processed,0);
 assert.equal(c.reconciliationTracking['2026-11'].managementHistory.length,2);
});
test('dados de origem, autoria e motivo preservados',()=>{
 const c=comp();T.edit(c,'2026-11','status','Aguardando revisão','u1','pendência de aprovação');
 const r=T.effective(c,'2026-11');assert.equal(r.origin.status.kind,'manual');
 assert.equal(r.origin.status.automatic,'Disponível para conciliação');
 assert.equal(c.reconciliationTracking['2026-11'].managementOverrides.status.actorId,'u1');
});
test('validação das datas, contagens e motivos de atraso',()=>{
 const c=comp();
 assert.throws(()=>T.edit(c,'2026-11','end','2026-02-30','u1'),/inexistente/);
 assert.throws(()=>T.edit(c,'2026-11','classified',12,'u1'),/excedem processados/);
 assert.throws(()=>T.edit(c,'2026-11','delayCategory','Funcionário','u1'),/inválida/);
 assert.throws(()=>T.edit(c,'2026-11','status','Aprovada automaticamente','u1'),/inválida/);
});
test('exportação não implica importação do Domínio',()=>{
 const c=comp();T.edit(c,'2026-11','exportStatus','Exportada','u1','arquivo gerado');
 assert.equal(T.effective(c,'2026-11').data.dominioStatus,'Não confirmada');
 assert.equal(c.reconciliationTracking['2026-11'].dominioConfirmed,undefined);
});
test('segregação de aprovação contábil e revisão gerencial',()=>{
 const c=comp();T.edit(c,'2026-11','reviewStatus','Aprovada','u1','apenas registro gerencial');
 assert.equal(T.auto(c,'2026-11').reviewStatus,'Não aprovada');
 assert.equal(c.reconciliationReview['2026-11'],undefined);
});
test('empresa inativa, não aplicável não entra na evolução percentual',()=>{
 const a=comp(),b=comp('B',true),c=comp('C');
 a.reconciliationTracking['2026-11']={start:'2026-11-03',end:'2026-11-07'};
 const s=T.summarize([a,b,c],'2026-11','u1');
 assert.equal(s.done,1);assert.equal(s.percent,50);assert.equal(s.remaining,1);
});
test('iniciar, pausar e retomar cronômetro contabiliza só intervalos ativos',()=>{
 const c=comp(),t0=new Date('2026-11-12T12:00:00Z');
 let t=T.timerTransition(c,'2026-11','start','u1',t0);c.reconciliationTracking['2026-11']={workTimer:t};
 t=T.timerTransition(c,'2026-11','pause','u1',new Date('2026-11-12T12:30:00Z'));c.reconciliationTracking['2026-11'].workTimer=t;
 t=T.timerTransition(c,'2026-11','resume','u1',new Date('2026-11-12T14:00:00Z'));c.reconciliationTracking['2026-11'].workTimer=t;
 t=T.timerTransition(c,'2026-11','finish','u1',new Date('2026-11-12T14:20:00Z'));
 assert.equal(Math.round(t.seconds),3000);assert.equal(t.runningSince,null);assert.equal(t.history.length,4);
});
test('cronômetro evita recomeço duplicado, empresa de outro funcionário',()=>{
 const c=comp(),now=new Date('2026-11-12T12:00:00Z');
 c.reconciliationTracking['2026-11']={workTimer:T.timerTransition(c,'2026-11','start','u1',now)};
 assert.throws(()=>T.timerTransition(c,'2026-11','start','u1',now),/já está/);
 assert.throws(()=>T.timerTransition(c,'2026-11','pause','u2',now),/outro funcionário|negado/);
});
test('zerar e reiniciar preservam histórico anterior do cronômetro',()=>{
 const c=comp(),date=new Date('2026-11-12T12:00:00Z');
 c.reconciliationTracking['2026-11']={workTimer:T.timerTransition(c,'2026-11','start','u1',date)};
 let t=T.timerTransition(c,'2026-11','reset','u1',new Date('2026-11-12T12:01:00Z'));
 assert.equal(t.seconds,0);assert.equal(t.history.length,2);c.reconciliationTracking['2026-11'].workTimer=t;
 t=T.timerTransition(c,'2026-11','restart','u1',new Date('2026-11-12T12:02:00Z'));
 assert.equal(t.history.length,3);assert.ok(t.runningSince);
});
test('edição manual do tempo não muda duração automática',()=>{
 const c=comp(),start=new Date('2026-11-12T12:00:00Z');
 c.reconciliationTracking['2026-11']={workTimer:T.timerTransition(c,'2026-11','start','u1',start)};
 let t=T.timerTransition(c,'2026-11','pause','u1',new Date('2026-11-12T12:10:00Z'));c.reconciliationTracking['2026-11'].workTimer=t;
 t=T.timerTransition(c,'2026-11','edit-time','u1',new Date('2026-11-12T12:10:00Z'),100);
 assert.equal(t.manualSeconds,100);assert.equal(Math.round(t.seconds),600);
 c.reconciliationTracking['2026-11'].workTimer=t;
 t=T.timerTransition(c,'2026-11','restore-auto','u1',new Date('2026-11-12T12:11:00Z'));
 assert.equal(t.manualSeconds,undefined);assert.equal(Math.round(t.seconds),600);
});
test('não criar aba duplicada, não apagar pendências, preservar 01–03',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),tracking=fs.readFileSync(path.join(root,'tracking-control-v4.js'),'utf8');
 assert.equal((html.match(/id="p-controle"/g)||[]).length,1);
 assert.ok(html.includes('id="trackingV4Panel"')&&html.includes('data-page="crm"')&&html.includes('id="p-documentos"')&&html.includes('id="p-carteira"'));
 assert.ok(app.includes('window.ConciliaTrackingV4?.render()'));
 assert.ok(tracking.includes('ConciliaSaveManagementV4')&&!tracking.includes("await store("));
 assert.ok(app.includes("function storeManagementV4(")&&!app.includes("storeManagementV4=store"));
});

test('evolução por competência retorna 12 meses sem contar empresas inativas',()=>{
 const a=comp(),b=comp('B',true);a.reconciliationTracking['2026-11']={start:'2026-11-03',end:'2026-11-07'};
 const e=T.evolution([a,b],2026,'u1');
 assert.equal(e.length,12);assert.equal(e[10].period,'2026-11');
 assert.equal(e[10].completed,1);assert.equal(e[10].percent,100);
 assert.equal(e[11].applicable,0);
});
test('Brasília é usada na apuração do prazo e na competência',()=>{
 assert.equal(T.todayBrazil(new Date('2026-11-28T01:00:00Z')),'2026-11-27');
 assert.equal(T.todayBrazil(new Date('2026-11-28T04:00:00Z')),'2026-11-28');
});
test('tempo abandonado é limitado pelo último heartbeat de sessão',()=>{
 const c=comp(),start=new Date('2026-11-12T12:00:00Z');
 c.reconciliationTracking['2026-11']={workTimer:T.timerTransition(c,'2026-11','start','u1',start)};
 const hb=T.timerTransition(c,'2026-11','heartbeat','u1',new Date('2026-11-12T12:00:30Z'));
 assert.equal(Math.round(hb.seconds),30);assert.equal(hb.history.length,1);
 assert.equal(Math.round(T.elapsed(hb,Date.parse('2026-11-12T12:30:00Z'))),120);
 assert.equal(T.stale(hb,Date.parse('2026-11-12T12:03:00Z')),true);
});
test('exportação, confirmação Domínio, revisão e espera são campos independentes auditáveis',()=>{
 const c=comp();
 for(const [field,v] of [['exportDate','2026-11-20'],['dominioImportDate','2026-11-21'],['reviewSentAt','2026-11-22'],['reviewedAt','2026-11-23'],['waitingSeconds',1800],['reworkCount',2]])T.edit(c,'2026-11',field,v,'u1','conferência gerencial');
 const x=T.effective(c,'2026-11');
 assert.equal(x.data.dominioImportDate,'2026-11-21');
 assert.equal(x.data.waitingSeconds,1800);
 assert.equal(x.origin.exportDate.kind,'manual');
 assert.equal(c.reconciliationTracking['2026-11'].dominioConfirmed,undefined);
 assert.equal(c.reconciliationReview['2026-11'],undefined);
});
test('formulário original não apaga ajustes e cronômetro da Melhoria 04',()=>{
 const old=fs.readFileSync(path.join(root,'reconciliation-tracking.js'),'utf8');
 assert.match(old,/reconciliationTracking\[month\] = \{\.\.\.\(previous\|\|\{\}\),start/);
 assert.match(old,/ConciliaSaveManagementV4/);
});
test('persistência gerencial evita limpeza de retenção de dados operacionais',()=>{
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 const match=app.match(/async function storeManagementV4[\s\S]*?(?=\nwindow\.ConciliaSaveManagementV4)/);
 assert.ok(match);assert.ok(!match[0].includes('runRetentionCleanup'));
 assert.match(match[0],/saveDB\(\{operational:false\}\)/);
 assert.match(match[0],/serializedSave/);
});
test('histórico cronológico inclui CRM, revisão, documentos e pendências sem recriar módulos',()=>{
 const ui=fs.readFileSync(path.join(root,'tracking-control-v4.js'),'utf8');
 assert.match(ui,/function timeline\(c,month\)/);
 assert.match(ui,/reconciliationReview/);
 assert.match(ui,/crmHistory/);
 assert.match(ui,/documentHistory/);
 assert.match(ui,/data-track4-filter="deadline"/);
});
