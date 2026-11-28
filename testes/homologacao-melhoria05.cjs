'use strict';
/* Homologação Melhoria 05: SOMENTE Supabase Docker em 127.0.0.1. Dados fictícios. */
const assert=require('node:assert/strict'),{chromium}=require('playwright'),path=require('node:path');
const root=process.env.TEST_SUPABASE_URL,key=process.env.TEST_SUPABASE_KEY,site='http://127.0.0.1:8765/index.html';
if(!/^http:\/\/127\.0\.0\.1:54321\/?$/.test(root||''))throw Error('Bloqueado: teste só permitido em Supabase local');
if(!key)throw Error('Chave efêmera de laboratório indisponível');
const stamp=Date.now(),users=[
 {email:'melhoria05-a-'+stamp+'@example.test',password:'Lab#C05a2026'},
 {email:'melhoria05-b-'+stamp+'@example.test',password:'Lab#C05b2026'}];
const H={apikey:key,'Content-Type':'application/json'};
async function request(url,{method='GET',user,body,prefer}={}){
 const r=await fetch(root+url,{method,headers:{...H,...(user?.token?{Authorization:'Bearer '+user.token}:{}),...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await r.text(),data=raw?JSON.parse(raw):null;
 if(!r.ok)throw Error(method+' '+url+' HTTP '+r.status+' '+raw.slice(0,400));
 return data;
}
async function register(u){
 const sign=await request('/auth/v1/signup',{method:'POST',body:{email:u.email,password:u.password}});
 assert.ok(sign.user?.id,'Usuário fictício criado');u.id=sign.user.id;
 const login=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:u.email,password:u.password}});
 assert.ok(login.access_token);u.token=login.access_token;
}
async function login(page,u){
 await page.goto(site,{waitUntil:'domcontentloaded'});
 await page.locator('#cloudEmail').fill(u.email);
 await page.locator('#cloudPassword').fill(u.password);
 await page.locator('#cloudLogin').click();
 await page.waitForFunction(()=>!document.querySelector('#app')?.hidden,{timeout:15000});
 await page.waitForFunction(()=>document.querySelector('#melhoria05Panel .m05-head small')?.textContent?.includes('sincronizados'),{timeout:20000});
 await page.locator('button[data-page="visao"]').click();
 await page.locator('[data-m05-tab="quality"]').waitFor({state:'visible',timeout:15000});
}
(async()=>{
 await Promise.all(users.map(register));
 const [a,b]=users,table='/rest/v1/user_melhoria05_states';
 const notMine=await request(table+'?select=user_id,payload',{user:b});assert.equal(notMine.length,0);
 const initial={version:1,quality:[],goals:[],competencies:[],diary:[],achievements:[],development:[]};
 const created=await request(table,{method:'POST',user:a,body:{user_id:a.id,payload:initial,revision:1},prefer:'return=representation'});
 assert.equal(created.length,1);
 const visibleA=await request(table+'?select=user_id,revision&user_id=eq.'+a.id,{user:a});assert.equal(visibleA.length,1);
 const visibleB=await request(table+'?select=user_id&user_id=eq.'+a.id,{user:b});assert.equal(visibleB.length,0,'RLS SELECT');
 const blocked=await request(table+'?user_id=eq.'+a.id,{method:'PATCH',user:b,body:{payload:{version:1,quality:[{id:'INJECAO'}]},revision:5},prefer:'return=representation'});
 assert.equal(blocked.length,0,'RLS UPDATE bloqueia adulteração entre usuários');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1380,height:950}});
  page.on('pageerror',err=>console.warn('PAGE:',err.message));
  await login(page,a);
  assert.equal(await page.locator('[data-m05-tab]').count(),9,'9 perspectivas em UI');
  await page.locator('[data-m05-tab="quality"]').click();
  await page.locator('[data-m05-form="quality"]').click();
  await page.locator('#m05NewForm input[name="title"]').fill('Ocorrência fictícia E2E');
  await page.locator('#m05NewForm select[name="category"]').selectOption('Documentação do cliente');
  await page.locator('#m05NewForm button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('#melhoria05Panel')?.textContent?.includes('Ocorrência fictícia E2E'),{timeout:20000});
  const row=await request(table+'?select=payload,revision&user_id=eq.'+a.id,{user:a});
  assert.equal(row.length,1);assert.equal(row[0].payload.quality.length,1);assert.equal(row[0].revision,2);assert.equal(row[0].payload.quality[0].audit.length,1);
  await page.screenshot({path:path.join(process.env.RUNNER_TEMP||'/tmp','melhoria05-auth-desktop.png')});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#melhoria05Panel .m05-head small')?.textContent?.includes('sincronizados'),{timeout:20000});
  await page.locator('button[data-page="visao"]').click();
  await page.locator('[data-m05-tab="quality"]').click();
  assert.match(await page.locator('#melhoria05Panel').textContent(),/Ocorrência fictícia E2E/,'Persistência real após reload');
  await page.locator('[data-m05-resolve]').first().click();
  await page.waitForFunction(()=>document.querySelector('#melhoria05Panel')?.textContent?.includes('Resolvida'),{timeout:12000});
  const final=await request(table+'?select=payload,revision&user_id=eq.'+a.id,{user:a});
  assert.equal(final[0].revision,3);assert.equal(final[0].payload.quality[0].status,'Resolvida');assert.equal(final[0].payload.quality[0].audit.length,2);
  // Cenários 05.1 a 05.8: data de execução, competência, auditoria, revisão, calendário, relatórios.
  await page.locator('[data-m05-tab="productivity"]').click();
  await page.locator('[data-m05x="range"]').selectOption('day');
  await page.locator('[data-m05x="day"]').fill(new Date().toISOString().slice(0,10));
  await page.locator('[data-m05x-form="activity"] input[name="title"]').fill('Medição fictícia auditada');
  await page.locator('[data-m05x-form="activity"] input[name="effectiveSeconds"]').fill('3600');
  await page.locator('[data-m05x-form="activity"] input[name="waitSeconds"]').fill('1200');
  await page.locator('[data-m05x-form="activity"] input[name="movements"]').fill('14');
  await page.locator('[data-m05x-form="activity"] button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('#melhoria05Panel')?.textContent?.includes('Medição fictícia auditada'),{timeout:15000});
  const savedActivity=await request(table+'?select=payload,revision&user_id=eq.'+a.id,{user:a});
  assert.equal(savedActivity[0].payload.activities.length,1);
  assert.equal(savedActivity[0].payload.activities[0].waitSeconds,1200);
  assert.equal(savedActivity[0].payload.activities[0].effectiveSeconds,3600);
  await page.locator('[data-m05-tab="quality"]').click();
  const qualityId=final[0].payload.quality[0].id;
  await page.locator('[data-m05x-review="'+qualityId+'"][data-review-to="Aguardando revisão"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-review-to="Em revisão"]'),{timeout:12000});
  await page.locator('[data-review-to="Em revisão"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-review-to="Aprovada"]'),{timeout:12000});
  await page.locator('[data-review-to="Aprovada"]').click();
  await page.waitForFunction(()=>document.querySelector('#melhoria05Panel')?.textContent?.includes('Aprovada'),{timeout:12000});
  const reviewed=await request(table+'?select=payload&user_id=eq.'+a.id,{user:a});
  assert.equal(reviewed[0].payload.quality[0].reviewStatus,'Aprovada');
  assert.equal(reviewed[0].payload.quality[0].firstReviewOutcome,'Aprovada');
  assert.equal(reviewed[0].payload.quality[0].reviewEvents.length,3);
  await page.locator('[data-m05-tab="goals"]').click();
  await page.locator('[data-m05x-form="calendar"] input[name="deadline"]').fill('2026-12-18');
  await page.locator('[data-m05x-form="calendar"] input[name="dailyHours"]').fill('6');
  await page.locator('[data-m05x-form="calendar"] button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('#melhoria05Panel')?.textContent?.includes('dias úteis disponíveis'),{timeout:15000});
  const withCalendar=await request(table+'?select=payload&user_id=eq.'+a.id,{user:a});
  assert.equal(withCalendar[0].payload.calendar.length,1);
  await page.locator('[data-m05-tab="reports"]').click();
  const evidence=await page.evaluate(()=>{
   const p=window.Concilia05Reports.build({
    filter:window.Concilia05Advanced.filter(),
    state:window.Concilia05.privateState(),companies:window.ConciliaBIMetrics.authorized(window.Concilia05.context().companies,window.Concilia05.owner()),
    owner:window.Concilia05.owner(),analytics:window.Concilia05Analytics,B:window.ConciliaBIMetrics,tracking:window.ConciliaTrackingCore
   });
   const pdf=window.Concilia05Reports.html(p);
   if(!window.XLSX)throw Error('Biblioteca XLSX não disponível no navegador');
   const workbook=window.XLSX.utils.book_new();
   for(const sheet of p.sheets)window.XLSX.utils.book_append_sheet(workbook,window.XLSX.utils.json_to_sheet(sheet.rows.length?sheet.rows:[{Mensagem:'Sem dados'}]),sheet.name);
   const bytes=window.XLSX.write(workbook,{type:'array',bookType:'xlsx'});
   return {pdf:pdf.includes('<table>')&&pdf.includes('CONCILIAR+'),xlsxSheets:workbook.SheetNames.length,xlsxSize:bytes.byteLength};
  });
  assert.equal(evidence.pdf,true,'PDF diagramado');
  assert.equal(evidence.xlsxSheets,10,'Excel temático');
  assert.ok(evidence.xlsxSize>8000,'XLSX com conteúdo real');
  console.log('MELHORIA 05 AVANÇADA: atividade, revisão completa, calendário, PDF HTML e 10 abas XLSX: OK');
  const pageB=await browser.newPage({viewport:{width:390,height:850}});
  await login(pageB,b);
  await pageB.locator('[data-m05-tab="quality"]').click();
  assert.doesNotMatch(await pageB.locator('#melhoria05Panel').textContent(),/Ocorrência fictícia E2E/);
  await pageB.screenshot({path:path.join(process.env.RUNNER_TEMP||'/tmp','melhoria05-auth-mobile.png')});
  assert.equal((await request(table+'?select=user_id',{user:b})).length,0);
  // Simular dois salvamentos concorrentes do MESMO proprietário com revisão otimista.
  // Só um pode vencer; o segundo deve falhar por CAS sem sobrescrever histórico.
  const beforeRace=(await request(table+'?select=payload,revision&user_id=eq.'+a.id,{user:a}))[0];
  const where=table+'?user_id=eq.'+a.id+'&revision=eq.'+beforeRace.revision;
  const race=await Promise.all([
   request(where,{method:'PATCH',user:a,body:{payload:beforeRace.payload,revision:beforeRace.revision+1},prefer:'return=representation'}),
   request(where,{method:'PATCH',user:a,body:{payload:beforeRace.payload,revision:beforeRace.revision+1},prefer:'return=representation'})
  ]);
  assert.deepEqual(race.map(x=>x.length).sort(),[0,1],'CAS rejeita sobrescrita simultânea');
  const afterRace=(await request(table+'?select=payload,revision&user_id=eq.'+a.id,{user:a}))[0];
  assert.equal(afterRace.revision,beforeRace.revision+1);
  assert.equal(afterRace.payload.quality[0].reviewStatus,'Aprovada','Revisão permaneceu após corrida');
  assert.equal(afterRace.payload.activities.length,1,'Atividade não duplicada após concorrência');
  console.log('CAS 05: duas gravações concorrentes, somente uma confirmada e históricos preservados: OK');
  console.log('HOMOLOGAÇÃO MELHORIA 05 LAB: Auth A/B, RLS SELECT/UPDATE, 9 visões, criação, CAS, auditoria, recuperação e responsividade: APROVADO');
 }finally{await browser.close();}
})().catch(e=>{console.error('HOMOLOGAÇÃO MELHORIA 05 FALHOU:',e.stack||e);process.exitCode=1});
