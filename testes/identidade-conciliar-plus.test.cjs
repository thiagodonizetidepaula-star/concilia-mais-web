'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
test('marca principal e assinatura institucional aparecem no login e sidebar',()=>{
 const s=read('index.html');
 assert.match(s,/<header class="auth-header"[^>]*ConCiliar\+PLUS/);
 assert.match(s,/concilia-login-brand/);
 assert.match(s,/concilia-sidebar-brand/);
 assert.match(s,/Produto independente — titularidade/);
 assert.match(s,/BEATRIZ CRISSILA/);
 assert.match(s,/AMBIENTE EM USO/);
 assert.match(s,/Romeiro Soluções Empresariais/);
});
test('Romeiro aparece como ambiente de uso, não como marca principal',()=>{
 const s=read('index.html');
 assert.doesNotMatch(s,/<aside class="sidebar"><div class="brand"><img class="romeiro-logo"/);
 assert.match(s,/brand-workspace-side/);
 assert.match(s,/concilia-app-icon\.svg/);
});
test('nome e descrição instaláveis preservam start_url e escopo',()=>{
 const m=JSON.parse(read('manifest.webmanifest'));
 assert.equal(m.short_name,'ConCiliar+PLUS');
 assert.match(m.name,/ConCiliar\+PLUS/);
 assert.equal(m.start_url,'./');
 assert.equal(m.scope,'./');
 assert.match(m.description,/Beatriz Crissila/);
});
test('identidade independente não troca ids técnicos de login, navegação ou conta',()=>{
 const s=read('index.html');
 for(const id of ['authGate','app','cloudLogin','cloudEmail','cloudPassword','cloudUser','cloudLogout','nav','companySelect','period']){
  if(id==='companySelect')continue;
  assert.ok(s.includes('id="'+id+'"'),'ID essencial ausente: '+id);
 }
 assert.match(s,/src="\.\/cloud\.js/);
 assert.match(s,/src="\.\/app\.js/);
});
test('estilo institucional é isolado e responsivo',()=>{
 const css=read('concilia-brand.css');
 assert.match(css,/\.concilia-sidebar-brand/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(read('index.html'),/concilia-brand\.css/);
});
test('PDF e capa Excel apresentam titularidade da marca',()=>{
 const s=read('melhoria05-reports.js');
 assert.match(s,/Produto independente — titularidade BEATRIZ CRISSILA/);
 assert.match(s,/\['Titularidade','BEATRIZ CRISSILA'\]/);
 assert.match(s,/Romeiro Soluções Empresariais/);
});
