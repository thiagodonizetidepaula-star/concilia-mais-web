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
  const pageB=await browser.newPage({viewport:{width:390,height:850}});
  await login(pageB,b);
  await pageB.locator('[data-m05-tab="quality"]').click();
  assert.doesNotMatch(await pageB.locator('#melhoria05Panel').textContent(),/Ocorrência fictícia E2E/);
  await pageB.screenshot({path:path.join(process.env.RUNNER_TEMP||'/tmp','melhoria05-auth-mobile.png')});
  assert.equal((await request(table+'?select=user_id',{user:b})).length,0);
  console.log('HOMOLOGAÇÃO MELHORIA 05 LAB: Auth A/B, RLS SELECT/UPDATE, 9 visões, criação, CAS, auditoria, recuperação e responsividade: APROVADO');
 }finally{await browser.close();}
})().catch(e=>{console.error('HOMOLOGAÇÃO MELHORIA 05 FALHOU:',e.stack||e);process.exitCode=1});
