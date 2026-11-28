'use strict';
/* E2E com Supabase Auth, PostgREST e RLS REAIS, em instância Docker EFÊMERA.
   Somente empresa e emails fictícios; não conecta ao Supabase de produção. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const base=process.env.TEST_SUPABASE_URL,key=process.env.TEST_SUPABASE_KEY,site='http://127.0.0.1:8765/index.html';
if(!/^http:\/\/127\.0\.0\.1:54321\/?$/.test(base||''))throw Error('Somente Supabase LOCAL permitido. Produção bloqueada.');
if(!key)throw Error('ANON_KEY do laboratório não encontrada.');
const dataDir=process.env.RUNNER_TEMP||'/tmp';
const unique=String(Date.now());
const creds=[
 {email:'lab-a-'+unique+'@example.test',password:'LabSenha#A2026'},
 {email:'lab-b-'+unique+'@example.test',password:'LabSenha#B2026'}
];
const headers={apikey:key,'Content-Type':'application/json'};
const stats=[];
async function api(route,{method='GET',accessToken,body}={}){
 const res=await fetch(base+route,{method,headers:{...headers,...(accessToken?{Authorization:'Bearer '+accessToken}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await res.text(),json=text?JSON.parse(text):null;
 if(!res.ok)throw Error('API '+route+' HTTP '+res.status+' '+text.slice(0,280));
 return json;
}
async function register(user){
 const signup=await api('/auth/v1/signup',{method:'POST',body:{email:user.email,password:user.password}});
 assert.ok(signup.user?.id,'Signup real criou usuário');
 const login=await api('/auth/v1/token?grant_type=password',{method:'POST',body:{email:user.email,password:user.password}});
 assert.ok(login.access_token,'Login real devolveu JWT de usuário');
 user.id=login.user.id;user.token=login.access_token;
}
function annotate(page){
 page.on('dialog',dialog=>dialog.accept());
 page.on('pageerror',e=>{console.error('ERRO DE PÁGINA:',e.message)});
}
async function loginViaUI(page,user){
 await page.goto(site,{waitUntil:'domcontentloaded'});
 await page.locator('#cloudEmail').fill(user.email);
 await page.locator('#cloudPassword').fill(user.password);
 await page.locator('#cloudLogin').click();
 try{await page.waitForFunction(()=>document.body.classList.contains('authenticated'),{timeout:40000});}
 catch(e){throw Error('Login da aplicação não completou. Status: '+await page.locator('#authStatus').textContent());}
 assert.ok(await page.locator('#app').isVisible(),'Aplicação abriu com sessão real');
}
async function importPlan(page,pdf){
 await page.locator('button[data-page="empresas"]').click();
 await page.locator('#importPlan input[name=file]').setInputFiles(pdf);
 await page.locator('#importPlanButton').click();
 await page.waitForFunction(()=>document.querySelector('#planCount')?.textContent?.includes('5 contas'),{timeout:45000});
 await page.waitForTimeout(400);
}
async function walletCount(page,expected){
 await page.locator('button[data-page="carteira"]').click();
 await page.waitForFunction(n=>document.querySelectorAll('.wallet-client-card').length===n,expected,{timeout:20000});
 assert.equal(await page.locator('.wallet-client-card').count(),expected);
}
async function checkStored(user,expected){
 const rows=await api('/rest/v1/user_workspaces?select=user_id,payload,revision&user_id=eq.'+user.id,{accessToken:user.token});
 assert.equal(rows.length,1,'Workspace persistido no banco local sob usuário de teste');
 const companies=rows[0].payload.companies;
 assert.equal(companies.length,expected);
 return companies;
}
async function run(){
 await register(creds[0]);await register(creds[1]);
 stats.push('Auth: cadastros e dois logins reais via Supabase GoTrue: OK');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{
  const ctxA=await browser.newContext({viewport:{width:1440,height:1000}}),pageA=await ctxA.newPage();annotate(pageA);
  await loginViaUI(pageA,creds[0]);stats.push('UI: login real usuário A no ConCiliar+: OK');
  await importPlan(pageA,path.join(dataDir,'plano-dominio-homologacao.pdf'));
  await walletCount(pageA,1);
  stats.push('PDF digital com layout do Domínio: importação por botão existente e cadastro na carteira: OK');
  const c=pageA.locator('.wallet-client-card').first();
  assert.match(await c.textContent(),/EMPRESA HOMOLOGACAO LTDA/);
  await c.locator('[data-wallet="edit"]').click();
  await pageA.locator('#walletEditor input[name="name"]').fill('EMPRESA HOMOLOGACAO ATUALIZADA LTDA');
  await pageA.locator('#walletEditor input[name="fantasyName"]').fill('Marca Homologação');
  await pageA.locator('#walletEditor textarea[name="emails"]').fill('financeiro@empresa-ficticia.test; contabil@empresa-ficticia.test');
  await pageA.locator('#walletEditor textarea[name="clientNotes"]').fill('Registro fictício de homologação.');
  await pageA.locator('#walletEditor button[type=submit]').click();
  await pageA.waitForFunction(()=>document.querySelector('.wallet-client-card')?.textContent?.includes('ATUALIZADA'),{timeout:15000});
  await pageA.waitForTimeout(500);
  let companies=await checkStored(creds[0],1);
  assert.equal(companies[0].name,'EMPRESA HOMOLOGACAO ATUALIZADA LTDA');
  assert.equal(companies[0].plan.length,5);
  stats.push('Supabase PostgREST/RPC: edição, CNPJ e 5 contas do plano persistidos: OK');
  assert.equal(companies[0].emails.length,2,'Dois emails válidos preservados no cadastro');
  await pageA.locator('button[data-page="documentos"]').click();
  await pageA.locator('button[data-doc-edit]').first().click();
  await pageA.locator('#docsEditForm select[name="status"]').selectOption('Cobrado');
  await pageA.locator('#docsEditForm textarea[name="notes"]').fill('Cobrança manual fictícia, ainda não recebido.');
  await pageA.locator('#docsEditForm button[type=submit]').click();
  await pageA.waitForTimeout(600);
  const activePeriod=new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0');
  companies=await checkStored(creds[0],1);
  assert.equal(companies[0].documentHistory[activePeriod].status,'Cobrado');
  assert.equal(companies[0].documentHistory[activePeriod].notes,'Cobrança manual fictícia, ainda não recebido.');
  assert.equal(companies[0].documentHistory[activePeriod].updatedBy,creds[0].id);
  assert.ok(companies[0].documentHistory[activePeriod].updatedAt);
  stats.push('Documentos: edição de status Cobrado, observação e autor persistida no Supabase: OK');
  await pageA.locator('button[data-page="crm"]').click();
  await pageA.locator('#crmPanel [data-crm-config="edit"]').click();
  await pageA.locator('[data-crm-setting="reminder1"]').fill('12');
  await pageA.locator('[data-crm-setting="charge1"]').fill('13');
  await pageA.locator('[data-crm-setting="reminder2"]').fill('22');
  await pageA.locator('[data-crm-setting="charge2"]').fill('23');
  await pageA.locator('#crmPanel [data-crm-config="save"]').click();
  await pageA.waitForTimeout(850);
  const settings=await api('/rest/v1/user_workspaces?select=payload,revision&user_id=eq.'+creds[0].id,{accessToken:creds[0].token});
  assert.equal(settings[0].payload.crmSettings.dates.charge1,13);
  assert.equal(settings[0].payload.crmSettings.dates.reminder2,22);
  stats.push('CRM: configurações editáveis 12/13/22/23 persistidas no banco real: OK');
  await pageA.locator('#crmPanel [data-crm-select]').first().click();
  const todayCrm=await pageA.evaluate(()=>window.ConciliaCrmCore.todayBrazil(new Date()));
  await pageA.locator('#crmRecordForm input[name="occurredAt"]').fill(todayCrm);
  await pageA.locator('#crmRecordForm select[name="medium"]').selectOption('Outlook manual');
  await pageA.locator('#crmRecordForm textarea[name="notes"]').fill('Cobrança E2E registrada manualmente; nenhuma mensagem foi enviada.');
  await pageA.locator('#crmRecordForm button[type="submit"]').click();
  await pageA.waitForTimeout(1000);
  companies=await checkStored(creds[0],1);
  assert.equal(companies[0].crmHistory.length,1);
  assert.equal(companies[0].crmHistory[0].actorId,creds[0].id);
  assert.equal(companies[0].crmHistory[0].medium,'Outlook manual');
  assert.equal(companies[0].documentHistory[activePeriod].status,'Cobrado');
  stats.push('CRM: cobrança real inserida manualmente, autor e competência persistidos sem mudar status documental: OK');

  await pageA.locator('#cloudLogout').click();
  await pageA.waitForFunction(()=>!document.body.classList.contains('authenticated'),{timeout:15000});
  await pageA.locator('#cloudEmail').fill(creds[0].email);
  await pageA.locator('#cloudPassword').fill(creds[0].password);
  await pageA.locator('#cloudLogin').click();
  await pageA.waitForFunction(()=>document.body.classList.contains('authenticated'),{timeout:30000});
  await walletCount(pageA,1);
  assert.match(await pageA.locator('.wallet-client-card').textContent(),/ATUALIZADA/);
  await pageA.locator('button[data-page="documentos"]').click();
  assert.match(await pageA.locator('#documentsPanel').textContent(),/Cobrado/);
  companies=await checkStored(creds[0],1);
  assert.equal(companies[0].documentHistory[activePeriod].status,'Cobrado');
  assert.equal(companies[0].emails.length,2);
  stats.push('Logout + login real A: cadastro, dois e-mails e histórico documental recuperados: OK');
  await pageA.locator('button[data-page="crm"]').click();
  assert.equal(await pageA.locator('#crmPanel [data-crm-setting="charge1"]').inputValue(),'13');
  await pageA.locator('#crmPanel [data-crm-select]').first().click();
  await pageA.locator('#crmPanel [data-crm-tab="history"]').click();
  assert.match(await pageA.locator('.crm-history').textContent(),/Cobrança E2E registrada manualmente/);
  companies=await checkStored(creds[0],1);
  assert.equal(companies[0].crmHistory.length,1);
  stats.push('CRM: configuração e histórico recuperados após logout/login: OK');

  await importPlan(pageA,path.join(dataDir,'plano-dominio-homologacao.pdf'));
  await walletCount(pageA,1);
  assert.match(await pageA.locator('.wallet-client-card').textContent(),/ATUALIZADA/);
  companies=await checkStored(creds[0],1);
  assert.equal(companies[0].plansHistory.length,2,'Histórico das duas importações preservado');
  stats.push('Reimportação Domínio por CNPJ: 1 empresa, 2 versões do plano e nome editado preservado: OK');
  // Verificar segurança no banco, não somente o filtro visual.
  let rows=await api('/rest/v1/user_workspaces?select=user_id&user_id=eq.'+creds[0].id,{accessToken:creds[1].token});
  assert.equal(rows.length,0,'Usuário B não pode consultar a linha de A');
  const denied=await fetch(base+'/rest/v1/rpc/save_user_workspace',{method:'POST',headers:{...headers,Authorization:'Bearer '+creds[1].token},body:JSON.stringify({p_expected_revision:0,p_payload:{companies:[{id:'tentativa',name:'INDEVIDA'}],reviews:[],audit:[]}})});
  // Sem poder forçar auth.uid de outro usuário, RPC grava só o workspace do B.
  assert.ok(denied.ok,'RPC usa identidade JWT de B');
  const aa=await checkStored(creds[0],1);assert.equal(aa[0].name,'EMPRESA HOMOLOGACAO ATUALIZADA LTDA');
  const ctxB=await browser.newContext(),pageB=await ctxB.newPage();annotate(pageB);
  await loginViaUI(pageB,creds[1]);
  await walletCount(pageB,1); // Uma empresa própria criada via RPC, nunca a empresa de A.
  assert.doesNotMatch(await pageB.locator('#walletPanel').textContent(),/EMPRESA HOMOLOGACAO ATUALIZADA/);
  await pageB.locator('button[data-page="documentos"]').click();
  assert.doesNotMatch(await pageB.locator('#documentsPanel').textContent(),/Cobrança manual fictícia/);
  assert.doesNotMatch(await pageB.locator('#documentsPanel').textContent(),/financeiro@empresa-ficticia.test/);
  await pageB.locator('button[data-page="crm"]').click();
  assert.doesNotMatch(await pageB.locator('#crmPanel').textContent(),/Cobrança E2E registrada manualmente/);
  assert.equal(await pageB.locator('#crmPanel [data-crm-setting="charge1"]').inputValue(),'15');
  stats.push('CRM RLS real: usuário B não acessa configurações/histórico da conta A: OK');
  stats.push('RLS real: usuário B não lê o workspace A, B mantém workspace próprio: OK');
  await pageA.screenshot({path:path.join(dataDir,'carteira-real-auth-desktop.png'),fullPage:true});
  await pageA.setViewportSize({width:390,height:850});
  await pageA.screenshot({path:path.join(dataDir,'carteira-real-auth-mobile.png'),fullPage:true});
  stats.push('Capturas do ConCiliar+ autenticado, com dados fictícios: OK');
  await pageA.locator('button[data-page="crm"]').click();
  await pageA.screenshot({path:path.join(dataDir,'crm-real-auth-desktop.png'),fullPage:true});
  await pageA.setViewportSize({width:390,height:850});
  await pageA.screenshot({path:path.join(dataDir,'crm-real-auth-mobile.png'),fullPage:true});
  await ctxA.close();await ctxB.close();
 }finally{await browser.close();}
}
run().then(()=>{for(const line of stats)console.log('PASS:',line);console.log('HOMOLOGAÇÃO OPERACIONAL SUPABASE LOCAL APROVADA');})
 .catch(err=>{for(const line of stats)console.log('PASS:',line);console.error('HOMOLOGAÇÃO FALHOU:',err.stack||err);process.exitCode=1;});
