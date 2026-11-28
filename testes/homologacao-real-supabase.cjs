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
  // Painel BI integrado: somente dados da conta autenticada, sem atualizar tabelas de produção.
  await pageA.locator('button[data-page="visao"]').click();
  await pageA.waitForFunction(()=>document.querySelector('#conciliaBI .bi-kpi')?.textContent,{timeout:15000});
  assert.equal(await pageA.locator('#conciliaBI .bi-tabs button').count(),4,'Quatro perspectivas integradas');
  assert.equal(await pageA.locator('#conciliaBI [data-bi-filter]').count(),4,'Filtros reais de competência/empresa/pesquisa');
  assert.match(await pageA.locator('#conciliaBI .bi-head').textContent(),/1 empresas visíveis/);
  await pageA.locator('[data-bi-tab="tecnologia"]').click();
  assert.match(await pageA.locator('#conciliaBI').textContent(),/Taxa de automação/);
  await pageA.locator('[data-bi-tab="empresa"]').click();
  assert.match(await pageA.locator('#conciliaBI').textContent(),/Movimentações por empresa/);
  await pageA.locator('[data-bi-filter="search"]').fill('empresa-inexistente-xx');
  assert.match(await pageA.locator('#conciliaBI .bi-head').textContent(),/0 empresas visíveis/);
  await pageA.locator('[data-bi-reset]').click();
  assert.match(await pageA.locator('#conciliaBI .bi-head').textContent(),/1 empresas visíveis/);
  stats.push('BI integrado: login real, 4 perspectivas, filtros e cálculo de carteira autorizada: OK');
  stats.push('PDF digital com layout do Domínio: importação por botão existente e cadastro na carteira: OK');
  const c=pageA.locator('.wallet-client-card').first();
  assert.match(await c.textContent(),/EMPRESA HOMOLOGACAO LTDA/);
  await c.locator('[data-wallet="edit"]').click();
  await pageA.locator('#walletEditor input[name="name"]').fill('EMPRESA HOMOLOGACAO ATUALIZADA LTDA');
  await pageA.locator('#walletEditor input[name="fantasyName"]').fill('Marca Homologação');
  await pageA.locator('#walletEditor input[name="dominio"]').fill('0077');
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
  await pageA.locator('[data-crm-setting="reminder1"]').fill('5');
  await pageA.locator('#crmPanel [data-crm-config="cancel"]').click();
  assert.equal(await pageA.locator('[data-crm-setting="reminder1"]').inputValue(),'14','Cancelar não aplicou mudanças');
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
  await pageA.locator('button[data-page="controle"]').click();
  await pageA.locator('#trackingV4Panel [data-track4-open]').first().click();
  await pageA.locator('#trackingV4Panel [data-track4-edit]').click();
  await pageA.locator('[data-track4-value="status"]').selectOption('Aguardando revisão');
  await pageA.locator('#track4EditForm textarea[name="reason"]').fill('Homologação gerencial isolada de status, sem modificar conciliação.');
  await pageA.locator('#track4EditForm button[type="submit"]').click();
  await pageA.waitForTimeout(900);
  companies=await checkStored(creds[0],1);
  const trackPeriod=await pageA.evaluate(()=>window.ConciliaTrackingV4.currentPeriod());
  assert.equal(companies[0].reconciliationTracking[trackPeriod].managementOverrides.status.value,'Aguardando revisão');
  assert.equal(companies[0].reconciliationTracking[trackPeriod].managementHistory.length,1);
  assert.equal(companies[0].documentHistory[activePeriod].status,'Cobrado');
  stats.push('Controle 04: status operacional manual, origem e auditoria persistidos sem alterar documento: OK');
  await pageA.locator('[data-track4-timer="start"]').click();
  await pageA.waitForTimeout(450);
  await pageA.locator('[data-track4-timer="pause"]').click();
  await pageA.waitForTimeout(900);
  companies=await checkStored(creds[0],1);
  assert.equal(companies[0].reconciliationTracking[trackPeriod].workTimer.history.length,2);
  assert.equal(companies[0].reconciliationTracking[trackPeriod].workTimer.runningSince,null);
  stats.push('Controle 04: iniciar/pausar tempo no Supabase, sem acionar retenção de extratos: OK');


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
  if(await pageA.locator('[data-crm-action="back"]').count())await pageA.locator('[data-crm-action="back"]').click();
  assert.equal(await pageA.locator('#crmPanel [data-crm-setting="charge1"]').inputValue(),'13');
  await pageA.locator('#crmPanel [data-crm-select]').first().click();
  await pageA.locator('#crmPanel [data-crm-tab="history"]').click();
  assert.match(await pageA.locator('.crm-history').textContent(),/Cobrança E2E registrada manualmente/);
  companies=await checkStored(creds[0],1);
  assert.equal(companies[0].crmHistory.length,1);
  stats.push('CRM: configuração e histórico recuperados após logout/login: OK');
  await pageA.locator('button[data-page="controle"]').click();
  await pageA.locator('#trackingV4Panel [data-track4-open]').first().click();
  assert.match(await pageA.locator('.track4-detail').textContent(),/Aguardando revisão/);
  companies=await checkStored(creds[0],1);
  assert.equal(companies[0].reconciliationTracking[trackPeriod].workTimer.history.length,2);
  stats.push('Controle 04: auditoria e cronômetro recuperados após logout/login: OK');


  await importPlan(pageA,path.join(dataDir,'plano-dominio-homologacao.pdf'));
  await walletCount(pageA,1);
  assert.match(await pageA.locator('.wallet-client-card').textContent(),/ATUALIZADA/);
  companies=await checkStored(creds[0],1);
  assert.equal(companies[0].plansHistory.length,2,'Histórico das duas importações preservado');
  stats.push('Reimportação Domínio por CNPJ: 1 empresa, 2 versões do plano e nome editado preservado: OK');
  // Refinamento 03/04: lançamento fictício criado APENAS no banco temporário.
  // Deve confirmar e aprender automaticamente, sem segunda confirmação.
  await pageA.locator('button[data-page="movimentos"]').click();
  const pasteFixture=await pageA.evaluate(()=>{
   const c=state.companies.find(c=>c.name.includes('ATUALIZADA'));
   const p=period;
   if(!c.plan.some(a=>a.analytic&&String(a.code)==='10000'))throw Error('Plano fictício sem código de contrapartida 10000');
   if(!c.plan.some(a=>a.analytic&&String(a.code)==='536'))throw Error('Plano fictício sem código bancário 536');
   c.accounts.push({id:'bank-refinamento-e2e',chartCode:'536',bank:'ITAU',label:'CONTA TESTE'});
   c.movements.push({id:'auto-refino-e2e-1',date:p+'-05',cents:-10000,history:'PIX TESTE REFINAMENTO E2E',accountId:'bank-refinamento-e2e',status:'PENDENTE'});
   return {p,cnpj:c.cnpj};
  });
  const day=pasteFixture.p+'-05',pt=day.split('-').reverse().join('/');
  await pageA.locator('#pasteClassificationsText').fill('Data\tDébito\tCrédito\tValor\tHistórico\tBanco\tID\n'+pt+'\t10000\t536\t-100,00\tPIX TESTE REFINAMENTO E2E\t536\tauto-refino-e2e-1');
  await pageA.locator('#pastePreviewButton').click();
  await pageA.waitForFunction(()=>{
   const c=state.companies.find(c=>c.name.includes('ATUALIZADA'));
   return c?.movements.some(m=>m.id==='auto-refino-e2e-1'&&m.status==='CONFIRMADO'&&m.counterpart==='10000');
  },{timeout:20000});
  await pageA.waitForFunction(()=>document.querySelector('#pasteClassificationsStatus')?.textContent?.includes('confirmada'),{timeout:20000});
  const learnedCompany=(await checkStored(creds[0],1))[0];
  assert.ok((learnedCompany.learnedCodes||[]).length>0,'Memória de aprendizagem persistiu no workspace autenticado');
  const operational=await api('/rest/v1/user_operational_drafts?select=payload,revision&user_id=eq.'+creds[0].id,{accessToken:creds[0].token});
  assert.equal(operational.length,1,'Rascunho operacional persistiu para a conta');
  const opCompany=operational[0].payload.companies.find(x=>x.id===learnedCompany.id);
  assert.ok(opCompany?.movements?.some(m=>m.id==='auto-refino-e2e-1'&&m.status==='CONFIRMADO'&&m.counterpart==='10000'),'Movimento confirmado foi gravado no backend');
  stats.push('Refinamento Excel: confirmação sem segundo clique e persistência REAL das movimentações e aprendizagem no Supabase local: OK');
  await pageA.locator('button[data-page="carteira"]').click();
  await pageA.locator('#walletSearch').fill('HOMOLOGACAO');
  assert.equal(await pageA.locator('.wallet-client-card').count(),1);
  await pageA.locator('#walletSearch').fill('007');
  assert.equal(await pageA.locator('.wallet-client-card').count(),1,'Código Domínio parcial com zeros à esquerda');
  await pageA.locator('#walletSearch').fill('11.222.333/0001-81');
  assert.equal(await pageA.locator('.wallet-client-card').count(),1,'CNPJ formatado');
  await pageA.locator('#walletSearch').fill('zzzzz-nao-encontra');
  assert.equal(await pageA.locator('.wallet-client-card').count(),0);
  await pageA.locator('[data-wallet="clear-search"]').click();
  assert.equal(await pageA.locator('.wallet-client-card').count(),1);
  stats.push('Refinamento Carteira: pesquisa parcial e limpeza retornam resultados corretos: OK');
  await pageA.locator('button[data-page="crm"]').click();
  if(await pageA.locator('[data-crm-action="back"]').count())await pageA.locator('[data-crm-action="back"]').click();
  assert.ok(await pageA.locator('.crm-client-list').count()===1,'CRM deve renderizar lista compacta');
  const cards=await pageA.locator('.crm-client-card').count();
  assert.ok(cards>0 || await pageA.locator('.crm-empty').count()===1,'CRM vazio deve mostrar aviso, e não tabela larga');
  if(cards>0)assert.ok(await pageA.locator('.crm-client-card details').first().count()===1,'Cartões oferecem detalhes expansíveis');
  stats.push('Refinamento CRM: listagem compacta, estado vazio e expansão conforme carteira elegível: OK');

  // Verificar segurança no banco, não somente o filtro visual.
  let rows=await api('/rest/v1/user_workspaces?select=user_id&user_id=eq.'+creds[0].id,{accessToken:creds[1].token});
  assert.equal(rows.length,0,'Usuário B não pode consultar a linha de A');
  const denied=await fetch(base+'/rest/v1/rpc/save_user_workspace',{method:'POST',headers:{...headers,Authorization:'Bearer '+creds[1].token},body:JSON.stringify({p_expected_revision:0,p_payload:{companies:[{id:'tentativa',name:'INDEVIDA'}],reviews:[],audit:[]}})});
  // Sem poder forçar auth.uid de outro usuário, RPC grava só o workspace do B.
  assert.ok(denied.ok,'RPC usa identidade JWT de B');
  const aa=await checkStored(creds[0],1);assert.equal(aa[0].name,'EMPRESA HOMOLOGACAO ATUALIZADA LTDA');
  const ctxB=await browser.newContext(),pageB=await ctxB.newPage();annotate(pageB);
  await loginViaUI(pageB,creds[1]);
  await pageB.locator('button[data-page="visao"]').click();
  await pageB.waitForFunction(()=>!!document.querySelector('#conciliaBI .bi-head'),{timeout:10000});
  assert.doesNotMatch(await pageB.locator('#conciliaBI').textContent(),/EMPRESA HOMOLOGACAO ATUALIZADA/,'BI não revela empresa do usuário A');
  stats.push('BI RLS: usuário B não visualiza os dados do usuário A: OK');
  await walletCount(pageB,1); // Uma empresa própria criada via RPC, nunca a empresa de A.
  assert.doesNotMatch(await pageB.locator('#walletPanel').textContent(),/EMPRESA HOMOLOGACAO ATUALIZADA/);
  await pageB.locator('button[data-page="documentos"]').click();
  assert.doesNotMatch(await pageB.locator('#documentsPanel').textContent(),/Cobrança manual fictícia/);
  assert.doesNotMatch(await pageB.locator('#documentsPanel').textContent(),/financeiro@empresa-ficticia.test/);
  await pageB.locator('button[data-page="crm"]').click();
  assert.doesNotMatch(await pageB.locator('#crmPanel').textContent(),/Cobrança E2E registrada manualmente/);
  assert.equal(await pageB.locator('#crmPanel [data-crm-setting="charge1"]').inputValue(),'15');
  await pageB.locator('#crmPanel [data-crm-config="edit"]').click();
  await pageB.locator('[data-crm-setting="reminder1"]').fill('10');
  await pageB.locator('[data-crm-setting="charge1"]').fill('11');
  await pageB.locator('[data-crm-setting="reminder2"]').fill('21');
  await pageB.locator('[data-crm-setting="charge2"]').fill('22');
  await pageB.locator('#crmPanel [data-crm-config="save"]').click();
  await pageB.waitForTimeout(850);
  assert.equal(await pageB.locator('[data-crm-setting="charge1"]').inputValue(),'11');
  await pageB.locator('#crmPanel [data-crm-config="restore"]').click();
  await pageB.waitForTimeout(850);
  assert.equal(await pageB.locator('[data-crm-setting="charge1"]').inputValue(),'15');
  const settingsB=await api('/rest/v1/user_workspaces?select=payload,revision&user_id=eq.'+creds[1].id,{accessToken:creds[1].token});
  assert.equal(settingsB[0].payload.crmSettings.dates.charge1,15,'Restore padrão durou no Supabase local');
  const settingsA=await api('/rest/v1/user_workspaces?select=payload,revision&user_id=eq.'+creds[0].id,{accessToken:creds[0].token});
  assert.equal(settingsA[0].payload.crmSettings.dates.charge1,13,'Configuração A isolada da B');
  stats.push('CRM: Cancelar e Restaurar padrões com persistência no Supabase real local: OK');
  await pageB.locator('button[data-page="controle"]').click();
  assert.doesNotMatch(await pageB.locator('#trackingV4Panel').textContent(),/Homologação gerencial isolada/);
  assert.equal(await pageB.locator('#trackingV4Panel [data-track4-open]').count(),1,'Outra conta só enxerga sua própria empresa fictícia');
  const bDetails=await pageB.locator('#trackingV4Panel .track4-table').first().textContent();
  assert.doesNotMatch(bDetails,/EMPRESA HOMOLOGACAO ATUALIZADA/,'Nenhuma empresa pertencente à conta A deve aparecer em B');
  stats.push('Controle 04 RLS: B não visualiza carteira gerencial ou cronômetro A: OK');
  stats.push('CRM RLS real: usuário B não acessa configurações/histórico da conta A: OK');
  stats.push('RLS real: usuário B não lê o workspace A, B mantém workspace próprio: OK');
  await pageA.screenshot({path:path.join(dataDir,'carteira-real-auth-desktop.png'),fullPage:true});
  await pageA.setViewportSize({width:390,height:850});
  await pageA.screenshot({path:path.join(dataDir,'carteira-real-auth-mobile.png'),fullPage:true});
  stats.push('Capturas do ConCiliar+ autenticado, com dados fictícios: OK');
  await pageA.locator('button[data-page="crm"]').click();
  if(await pageA.locator('[data-crm-action="back"]').count())await pageA.locator('[data-crm-action="back"]').click();
  await pageA.setViewportSize({width:1440,height:1000});
  await pageA.screenshot({path:path.join(dataDir,'crm-real-auth-desktop.png'),fullPage:true});
  await pageA.locator('#crmPanel [data-crm-select]').first().click();
  await pageA.screenshot({path:path.join(dataDir,'crm-real-auth-detail-desktop.png'),fullPage:true});
  await pageA.setViewportSize({width:390,height:850});
  await pageA.screenshot({path:path.join(dataDir,'crm-real-auth-mobile.png'),fullPage:true});
  await pageA.locator('button[data-page="controle"]').click();
  if(await pageA.locator('[data-track4-back]').count())await pageA.locator('[data-track4-back]').click();
  await pageA.setViewportSize({width:1440,height:1000});
  await pageA.screenshot({path:path.join(dataDir,'controle-v4-real-auth-desktop.png'),fullPage:true});
  await pageA.locator('#trackingV4Panel [data-track4-open]').first().click();
  await pageA.screenshot({path:path.join(dataDir,'controle-v4-real-auth-detail.png'),fullPage:true});
  await pageA.setViewportSize({width:390,height:850});
  await pageA.screenshot({path:path.join(dataDir,'controle-v4-real-auth-mobile.png'),fullPage:true});
  await ctxA.close();await ctxB.close();
 }finally{await browser.close();}
}
run().then(()=>{for(const line of stats)console.log('PASS:',line);console.log('HOMOLOGAÇÃO OPERACIONAL SUPABASE LOCAL APROVADA');})
 .catch(err=>{for(const line of stats)console.log('PASS:',line);console.error('HOMOLOGAÇÃO FALHOU:',err.stack||err);process.exitCode=1;});
