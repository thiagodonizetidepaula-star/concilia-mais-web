/* Concilia+ Web — experiência de teste 100% navegador. Dados persistidos no IndexedDB local. */
'use strict';
const Core=window.ConciliaCore, Pdf=window.ConciliaPDF, $=s=>document.querySelector(s), BRL=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const currency=c=>BRL.format((c||0)/100),safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const empty=x=>`<div class="empty">${safe(x)}</div>`;
let state={companies:[],reviews:[],audit:[]},companyId='',period='2026-08',currentPage='visao',db,ultimoExcluido=null;
let cloudSyncEnabled=false,legacyData=null,authReady=false;
const blankState=()=>({companies:[],reviews:[],audit:[]});
 let movementFilterScope='',selectedMovementStatement='';
const current=()=>state.companies.find(c=>c.id===companyId);
const getCompany=()=>{const c=current();if(!c)throw Error('Importe o plano de contas da empresa primeiro.');return c};
function setStatementStatus(kind,message){const el=$('#statementStatus');if(el){el.textContent=message;el.className='import-status '+kind;}}
function say(msg,error=false){const t=$('#toast');t.textContent=msg;t.className='toast'+(error?' error':'');t.style.display='block';clearTimeout(say.t);say.t=setTimeout(()=>t.style.display='none',5500)}
function action(fn){Promise.resolve().then(fn).catch(e=>{console.error(e);say(e.message||String(e),true)})}
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('ConciliaMaisBrowserDB',1);r.onupgradeneeded=()=>r.result.createObjectStore('app');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function loadDB(){return new Promise((resolve,reject)=>{const tx=db.transaction('app','readonly');const req=tx.objectStore('app').get('workspace');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
// O payload da nuvem contém apenas cadastros e referências.
function durableWorkspace(workspace){
 const copy=JSON.parse(JSON.stringify(workspace||blankState()));
 for(const c of copy.companies||[]){
  c.imports=[];
  c.movements=[];
  c.ledger=[];
  c.transfers=[];
  c.financialControls=[];
  c.taxSplits=[];
  delete c.reconciliationReview;
 }
 copy.reviews=(copy.reviews||[]).filter(r=>!r.importId&&!r.operational);
 copy.audit=(copy.audit||[]).filter(a=>!/(EXTRATO|RAZAO|RAZÕES|RAZOES|CONTROLE_FINANCEIRO|CRUZAMENTO_FINANCEIRO|TRIAGEM_AUTOMATICA|SUGESTOES_GERADAS|IMPORTACAO|RESTAURACAO)/i.test(String(a.action||'')));
 return copy;
}
const draftFields=['imports','movements','ledger','transfers','financialControls','reconciliationReview','taxSplits'];
let draftRevision=0;

function draftKey(){
 const accountId=window.ConciliaCloud?.accountId?.();
 return accountId?'reconciliation-draft:'+accountId:'';
}

function loadDraft(workspace){
 const key=draftKey();
 draftRevision=0;
 if(!key)return Promise.resolve(null);
 return new Promise((resolve,reject)=>{
  const request=db.transaction('app','readonly').objectStore('app').get(key);
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const draft=request.result;
   if(!draft)return resolve(null);
   draftRevision=draft.revision;
   const recognized=new Set(workspace.companies.map(company=>company.id));
   for(const company of workspace.companies){
    const saved=draft.companies.find(item=>item.id===company.id);
    if(saved)for(const field of draftFields)company[field]=saved[field]||(field==='reconciliationReview'?{}:[]);
   }
   workspace.reviews.push(...draft.reviews.filter(review=>recognized.has(review.companyId)));
   const selected=draft.companies.find(item=>item.id===draft.companyId);
   const hasWork=selected&&draftFields.some(field=>Object.keys(selected[field]||[]).length);
   resolve(hasWork&&recognized.has(draft.companyId)&&/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.period)?draft:null);
  };
 });
}

function saveDB({operational=true}={}){
 const key=operational&&authReady?draftKey():'';
 const draft=key?{
  companyId,period,
  companies:state.companies.map(company=>Object.fromEntries([
   ['id',company.id],...draftFields.map(field=>[field,company[field]||(field==='reconciliationReview'?{}:[])])
  ])),
  reviews:state.reviews.filter(review=>review.importId||review.operational)
 }:null;
 const snapshot=draft?structuredClone(draft):null;
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('app','readwrite');
  const bucket=tx.objectStore('app');
  let conflict=false,nextRevision;
  tx.oncomplete=()=>{
   if(nextRevision&&key===draftKey())draftRevision=nextRevision;
   resolve();
  };
  tx.onabort=()=>reject(conflict
   ?Error('O rascunho foi atualizado em outra aba. Recarregue a página para recuperar a versão salva.')
   :tx.error||Error('Não foi possível salvar o rascunho neste navegador.'));
  bucket.put(durableWorkspace(state),'workspace');
  if(!snapshot)return;
  const existing=bucket.get(key);
  existing.onsuccess=()=>{
   const revision=existing.result?.revision||0;
   if(revision!==draftRevision){conflict=true;tx.abort();return;}
   nextRevision=revision+1;
   bucket.put({...snapshot,revision:nextRevision},key);
  };
 });
}
function log(type,detail){state.audit.push({at:new Date().toISOString(),companyId,action:type,detail});}
async function store(type,detail){if(!['EXTRATO_REFAZER','IMPORTACAO_EXCLUIDA','RESTAURACAO_IMPORTACOES'].includes(type))ultimoExcluido=null;log(type,detail);await saveDB();render();if(cloudSyncEnabled&&window.ConciliaCloud?.authenticated()){try{await window.ConciliaCloud.serializedSave(durableWorkspace(state));cloudMessage('Alterações salvas na nuvem e cópia local atualizada.');}catch(err){cloudSyncEnabled=false;cloudMessage('Falha ao sincronizar: '+err.message+'. Cópia local preservada. Faça backup JSON antes de continuar.',true)}}}
function table(headers,rows){if(!rows.length)return empty('Nenhum registro para exibir.');return `<div class="tablewrap"><table><thead><tr>${headers.map(h=>`<th>${safe(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${v??''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
function badge(s){const kind=/CONFIRM|CONCILIADO|OK/.test(s)?'ok':/PENDENTE|SUGERIDA|AMBIGU|DUPLIC/.test(s)?'warn':'';return `<span class="badge ${kind}">${safe(s)}</span>`}
function datePT(d){return String(d||'').split('-').reverse().join('/')}
function month(x){return String(x||'').slice(0,7)}
function fileExt(name){return name.split('.').pop().toLowerCase()}
async function asText(file){const bytes=await file.arrayBuffer();let txt=new TextDecoder('utf-8').decode(bytes);if(txt.includes('\uFFFD'))txt=new TextDecoder('windows-1252').decode(bytes);return {txt,bytes}}
async function hash(bytes){if(crypto.subtle){const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('')}let h=2166136261;for(const x of new Uint8Array(bytes))h=Math.imul(h^x,16777619);return 'NAO-CRIPTO-'+(h>>>0).toString(16)}
function asData(form){return Object.fromEntries(new FormData(form).entries())}
function sortedMoves(c){return Core.periodMovements(c,period).sort((a,b)=>a.date.localeCompare(b.date)||a.history.localeCompare(b.history))}
function analyticalSelect(id,placeholder){const c=current();const select=$(id);const prev=select.value;select.innerHTML=`<option value="">${safe(placeholder)}</option>`+(c?c.plan.filter(p=>p.analytic).map(p=>`<option value="${safe(p.code)}">${safe(p.code)} — ${safe(p.description)}</option>`).join(''):'');if([...select.options].some(o=>o.value===prev))select.value=prev;}
function validBankAccounts(c){const allowed=new Set(c.plan.filter(p=>p.analytic).map(p=>p.code));return c.accounts.filter(a=>allowed.has(a.chartCode))}
function canImport(c){return !!c && c.plan.length>0}
function optionsFor(c,selected=''){return '<option value="">Selecione código analítico</option>'+c.plan.filter(p=>p.analytic).map(p=>`<option value="${safe(p.code)}" ${p.code===selected?'selected':''}>${safe(p.code)} — ${safe(p.description)}</option>`).join('')}

function cloudMessage(msg,error=false){
 const el=$('#cloudStatus'),auth=$('#authStatus');
 if(el){el.textContent=msg;el.classList.toggle('cloud-error',error);}
 if(auth&&!document.body.classList.contains('authenticated')){auth.textContent=msg;auth.classList.toggle('error',error);}
}
function cloudDisplay(){
 const cloud=window.ConciliaCloud,logged=authReady&&cloud?.authenticated();
 document.body.classList.toggle('authenticated',!!logged);
 const panel=$('#app');panel.hidden=!logged;panel.inert=!logged;
 if(logged){
  $('#cloudUser').textContent=cloud.identity()+(cloudSyncEnabled?' · Sincronização ativa':' · Aguardando sincronização');
  $('#cloudLogout').disabled=false;
 }
}
async function activateCloud(){
 const cloud=window.ConciliaCloud;
 if(!cloud?.authenticated()){authReady=false;cloudDisplay();return;}
 const remote=await cloud.fetchWorkspace();
 if(remote&&!Array.isArray(remote.companies))throw Error('Workspace da nuvem inválido.');
 // Preservar um retrato local de recuperação ANTES de carregar a nuvem.
 // Não enviar dados locais antigos automaticamente para a conta conectada.
 const previousLocal=await loadDB();
 if(previousLocal&&Array.isArray(previousLocal.companies)&&previousLocal.companies.length){
  const tx=db.transaction('app','readwrite');
  tx.objectStore('app').put(durableWorkspace(previousLocal),'recovery-before-cloud');
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
 }
 state=durableWorkspace(remote||blankState());
 const draft=await loadDraft(state);
 companyId=draft?.companyId||'';
 if(draft){period=draft.period;$('#period').value=period;}
 ultimoExcluido=null;cloudSyncEnabled=true;authReady=true;
 // Limpar automaticamente dados operacionais legados já salvos no workspace.
 // A eventual falha de limpeza remota não traz lançamentos antigos à sessão.
 await saveDB({operational:false});
 const hasOldImports=(remote?.companies||[]).some(c=>(c.imports||[]).length||(c.movements||[]).length||(c.ledger||[]).length||(c.financialControls||[]).length||(c.transfers||[]).length);
 if(hasOldImports){
  try{await cloud.serializedSave(durableWorkspace(state));}
  catch(err){cloudSyncEnabled=false;cloudMessage('Histórico antigo ignorado nesta sessão, mas a limpeza na nuvem falhou: '+err.message+'. Confira a conexão.',true);}
 }
 $('#companySearch').value='';renderSelection();showPage(draft?'importar':'empresas');
 cloudDisplay();
 if(draft)say('Rascunho local recuperado. Confira a empresa e a competência no cabeçalho.');
 if(cloudSyncEnabled)cloudMessage('Cadastros sincronizados. Os rascunhos operacionais ficam neste navegador.');
}
async function initializeCloud(){
 const cloud=window.ConciliaCloud;authReady=false;cloudDisplay();
 if(!cloud){cloudMessage('Conexão Supabase indisponível. Atualize a página.',true);return;}
 try{await cloud.session();if(cloud.authenticated())await activateCloud();else cloudMessage('Entre com e-mail e senha para acessar os dados.');}
 catch(e){cloudSyncEnabled=false;authReady=false;state=blankState();cloudDisplay();cloudMessage('Não foi possível validar a conta. '+e.message,true);}
}
function bindCloud(){
 const cloud=window.ConciliaCloud;
 $('#loginForm').onsubmit=e=>{e.preventDefault();action(async()=>{
  const email=$('#cloudEmail').value.trim(),pwd=$('#cloudPassword').value;
  if(!email||!pwd){cloudMessage('Informe e-mail e senha.',true);return;}
  $('#cloudLogin').disabled=true;
  try{
   cloudMessage('Verificando acesso...');
   await cloud.signIn(email,pwd);
   $('#cloudPassword').value='';
   await activateCloud();
  }catch(err){authReady=false;cloudSyncEnabled=false;cloudDisplay();cloudMessage('Não foi possível entrar: '+err.message,true);}
  finally{$('#cloudLogin').disabled=false;}
 });};
 $('#cloudSignup').onclick=()=>action(async()=>{
  const email=$('#cloudEmail').value.trim(),pwd=$('#cloudPassword').value;
  if(!email||pwd.length<6){cloudMessage('Informe e-mail e senha com pelo menos 6 caracteres.',true);return;}
  try{await cloud.signUp(email,pwd);$('#cloudPassword').value='';cloudMessage('Cadastro solicitado. Verifique o e-mail para confirmar o acesso.');}
  catch(err){cloudMessage('Erro no cadastro: '+err.message,true);}
 });
 $('#cloudForgot').onclick=()=>action(async()=>{
  const email=$('#cloudEmail').value.trim();
  if(!email){cloudMessage('Digite seu e-mail para recuperar a senha.',true);return;}
  const {error}=await cloud.connect().auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  if(error){cloudMessage('Falha ao solicitar recuperação: '+error.message,true);return;}
  cloudMessage('Se o e-mail estiver cadastrado, você receberá instruções para recuperação.');
 });
 $('#cloudLogout').onclick=()=>{
  authReady=false;cloudSyncEnabled=false;state=blankState();companyId='';ultimoExcluido=null;
  $('#cloudPassword').value='';cloudDisplay();renderSelection();render();cloudMessage('Encerrando sessão...');
  $('#cloudLogin').disabled=true;
  action(async()=>{
   try{await cloud.waitWrites();await cloud.signOut();cloudMessage('Sessão encerrada. Entre novamente.');}
   catch(err){
    try{await cloud.connect().auth.signOut({scope:'local'});}catch(_){}
    cloudMessage('Acesso local bloqueado. Confira sua conexão e entre novamente.',true);
   }finally{$('#cloudLogin').disabled=false;}
  });
 };
 $('#cloudDownload').onclick=()=>action(async()=>{
  if(!confirm('Recarregar a cópia da nuvem? Alterações locais não sincronizadas podem ser perdidas.'))return;
  try{await cloud.waitWrites();await activateCloud();cloudMessage('Nuvem recarregada com sucesso.');}
  catch(err){cloudMessage('Falha ao carregar dados: '+err.message,true);}
 });
 $('#cloudUpload').onclick=()=>action(async()=>{
  if(!legacyData?.companies?.length){cloudMessage('Não há cadastros antigos neste navegador para migrar.');return;}
  if(!confirm('Migrar '+legacyData.companies.length+' empresa(s) deste navegador para a conta '+cloud.identity()+'? Confirme que os dados pertencem a esta conta. Faça um backup JSON antes de continuar. Se existir informação na nuvem, nada será substituído.'))return;
  try{
   const remote=await cloud.fetchWorkspace();
   if(remote?.companies?.length){cloudMessage('Já existem empresas na nuvem. A migração foi bloqueada para evitar sobrescrita.',true);return;}
   if(remote&&remote.audit?.length){cloudMessage('A nuvem já contém dados. Migração bloqueada por segurança.',true);return;}
   await cloud.saveWorkspace(durableWorkspace(legacyData));
   await activateCloud();
   cloudMessage('Migração concluída. '+state.companies.length+' empresa(s) recebidas no Supabase.');
  }catch(err){cloudMessage('Não foi possível migrar: '+err.message,true);}
 });
}
function renderSelection(){
 const prev=companyId,sel=$('#companySelect'),search=Core.norm($('#companySearch')?.value||'');
 const options=state.companies.filter(c=>!search||Core.norm(c.name).includes(search)||Core.norm(c.cnpj).includes(search)||Core.norm(c.dominio).includes(search)||c.id===prev);
 sel.innerHTML='<option value="">'+(options.length?'Escolha uma empresa cadastrada':'Nenhuma empresa encontrada')+'</option>'+options.map(c=>`<option value="${safe(c.id)}">${safe(c.name)} • ${safe(c.cnpj||c.dominio||'sem CNPJ')}</option>`).join('');
 sel.value=state.companies.some(c=>c.id===prev)?prev:'';
 if(sel.value!==prev)companyId=sel.value;
}

function showPage(page){currentPage=page;document.querySelectorAll('.page').forEach(x=>x.classList.toggle('visible',x.id==='p-'+page));document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===page));const titles={pendencias:['Central de pendências','REVISÃO','Investigue as ocorrências da empresa e competência selecionadas.'],controle:['Controle de conciliações','ACOMPANHAMENTO','Registre e consulte os trabalhos por empresa e competência.'],visao:['Visão geral','PAINEL OPERACIONAL','Selecione uma empresa e acompanhe o andamento da competência.'],empresas:['Empresas e plano de contas','CONFIGURAÇÃO INICIAL','Cada empresa utiliza seu próprio plano, seus bancos e suas regras.'],importar:['Importar extratos e Razão','PROCESSAMENTO DE DOCUMENTOS','O plano de contas é obrigatório antes dos extratos.'],movimentos:['Classificações','MOVIMENTAÇÕES','Conferência das contrapartidas e regras da empresa selecionada.'],tributos:['Tributos e separação','RECEITA FEDERAL','Consulta rápida, comprovantes DARF/DAS e conferência de separações sem duplicidade.'],transferencias:['Transferências entre contas','CRUZAMENTO DE BANCOS','Propostas que exigem confirmação da titularidade.'],conciliacao:['Conciliação e exportação','RAZÃO CONTÁBIL','Somente lançamentos confirmados e não encontrados no Razão.'],revisao:['Revisão de leitura','CONTROLE DE PENDÊNCIAS','Nenhuma linha ilegível deve desaparecer.']} ;const [title,eye,sub]=titles[page]||titles.visao;$('#pageTitle').textContent=title;$('#eyebrow').textContent=eye;$('#subtitle').textContent=sub;render()}
function render(){const c=current();if(c)autoLinkBankCodes(c);$('#statementButton').disabled=!canImport(c);$('#importPlanButton').disabled=false;$('#addBank').disabled=!c||!c.plan.length;$('#addRule').disabled=!c||!c.plan.length;$('#ledgerButton').disabled=!c;$('#financialButton').disabled=!c;$('#matchFinancial').disabled=!c;$('#downloadCsv').disabled=!c;$('#downloadExcel').disabled=!c;$('#downloadStatement').disabled=!c;const resetButton=$('#resetAll');if(resetButton)resetButton.disabled=!c;renderSetup();renderDashboard();renderImport();renderTaxes();renderMovements();renderTransfers();renderRecon();renderAuditoria();renderReviews();renderAssistente();window.ConciliaTracking?.render();window.ConciliaReview?.render();}
function renderDashboard(){const c=current();if(!c){$('#stepBanner').innerHTML='<strong>Primeiro passo:</strong> importe o plano de contas; a empresa será criada automaticamente.';$('#metrics').innerHTML='';$('#steps').innerHTML='';$('#recentFiles').innerHTML=empty('Sem empresas cadastradas.');return}
  const mv=Core.periodMovements(c,period);const balance=Core.reconcile(c,period);const acc=new Set(mv.map(x=>x.accountId));const confirmed=balance.checked.filter(x=>x.recon==='CONCILIADO').length;
  const availablePeriods=[...new Set(c.imports.filter(x=>x.type==='EXTRATO').flatMap(x=>x.periods||[]))].sort().reverse();
  const prettyPeriod=ym=>ym.split('-').reverse().join('/');
  const banner=!mv.length&&availablePeriods.length&&!availablePeriods.includes(period)?
    '<strong>Filtro de competência:</strong> você está vendo '+prettyPeriod(period)+', mas seus extratos são de '+availablePeriods.map(prettyPeriod).join(', ')+'. <button type="button" class="status-inline-btn" data-use-period="'+availablePeriods[0]+'">Ver '+prettyPeriod(availablePeriods[0])+'</button>':
    mv.length?'<strong>Importação concluída:</strong> '+mv.length+' movimentações em '+prettyPeriod(period)+'. Confira Classificações e exporte o Excel.':
    '<strong>Nenhuma movimentação exibida em '+prettyPeriod(period)+'.</strong> O plano está carregado, mas você precisa importar um extrato. <button type="button" class="status-inline-btn" data-go="importar">Abrir importação</button>';
  $('#stepBanner').innerHTML=banner;
  const metrics=[['Entradas',currency(mv.filter(x=>x.cents>0).reduce((a,m)=>a+m.cents,0)),`${mv.filter(x=>x.cents>0).length} créditos bancários`],['Saídas',currency(-mv.filter(x=>x.cents<0).reduce((a,m)=>a+m.cents,0)),`${mv.filter(x=>x.cents<0).length} débitos bancários`],['Movimentações',mv.length,`${acc.size} contas no período`],['Conciliados',confirmed,`${balance.checked.length} lançamentos confirmados para comparação`]];
  $('#metrics').innerHTML=metrics.map(([k,v,h])=>`<div class="metric"><small>${k}</small><strong>${v}</strong><span>${h}</span></div>`).join('');
  const activeCount=c.imports.filter(x=>x.type==='EXTRATO'&&x.periods.includes(period)).length;const flow=[['Empresa identificada pelo plano',true],['Importar plano da empresa',!!c.plan.length],['Banco identificado no plano',validBankAccounts(c).length>0],['Importar extratos do mês',activeCount>0],['Classificar e confirmar',mv.length>0&&mv.some(x=>x.status==='CONFIRMADO')],['Conciliar com Razão',c.ledger.some(l=>l.period===period)]];
  $('#steps').innerHTML=flow.map(([t,ok],i)=>`<div class="step ${ok?'complete':''}"><b>${ok?'✓':i+1}</b><strong>${t}</strong><em>${ok?'Concluída':'Pendente'}</em></div>`).join('');
  const imp=c.imports.filter(x=>x.periods.includes(period));$('#recentFiles').innerHTML=imp.length?table(['Documento','Tipo','Linhas'],imp.slice(-10).reverse().map(x=>[safe(x.name),badge(x.type),x.movementCount??x.count??0])):empty('Nenhum arquivo importado nesta competência.');
}
function renderSetup(){const c=current();const count=c?.plan.length||0;$('#planStatus').textContent=c?count?`${count} contas cadastradas para ${c.name}. ${c.plan.filter(p=>p.analytic).length} marcadas como analíticas.`:'Nenhum plano nesta empresa. Use o botão abaixo para importar o arquivo do Domínio.':'Importe um plano de contas primeiro.';
  $('#companyIdentity').innerHTML=c?'<div class="hint"><strong>'+safe(c.name)+'</strong><br>CNPJ: '+safe(c.cnpj||'não identificado')+' • Domínio: '+safe(c.dominio||'não informado')+(c.identityVerified?'':'<br>⚠ Identificação provisória: confirme o titular antes de usar.')+'</div>':'';$('#planCount').textContent=`${count} contas`;
  analyticalSelect('#bankCode','Primeiro importe o plano');analyticalSelect('#ruleCode','Primeiro importe o plano');
  analyticalSelect('#partnerCode','Selecione um código analítico do plano');
  analyticalSelect('#relatedCompanyCode','Selecione um código analítico do plano');
  const related=c?.relatedCompanies||[];
  $('#relatedCompanyList').innerHTML=c?related.length?table(['Empresa relacionada','Código','Ações'],related.map(p=>[safe(p.name),safe(p.code),'<button class="secondary" type="button" data-delete-related-company="'+safe(p.id)+'">Excluir</button>'])):'<p class="subtle">Nenhuma empresa relacionada cadastrada.</p>':empty('Selecione uma empresa.');
  const partners=c?.partners||[];
  $('#partnerList').innerHTML=c?partners.length?table(['Nome do sócio','Código','Ações'],partners.map(p=>[safe(p.name),safe(p.code),'<button class="secondary" type="button" data-delete-partner="'+safe(p.id)+'">Excluir</button>'])):'<p class="subtle">Nenhum sócio cadastrado nesta empresa.</p>':empty('Selecione uma empresa.');
  $('#planTable').innerHTML=c?table(['Código','Classificação','Descrição','Tipo','Editar'],c.plan.map(p=>[safe(p.code),safe(p.classification||'—'),safe(p.description),badge(p.analytic?'A — analítica':'S — sintética'),`<button type="button" data-edit-plan="${safe(p.code)}" class="secondary">Editar</button>`])):empty('Sem empresa selecionada.');
  $('#bankTable').innerHTML=c?table(['Banco','Identificação','Código','Corrigir vínculo'],c.accounts.map(a=>{
   const valid=c.plan.some(p=>String(p.code)===String(a.chartCode)&&p.analytic);
   const known=bankPlanCandidates(c,a.bank);
   const hint=known.length===1?'Sugestão única no plano: '+known[0].code:known.length>1?known.length+' contas deste banco no plano — selecione a correta':'Selecione a conta correta no plano';
   return [safe(a.bank),safe(a.label),valid?safe(a.chartCode):'<span class="flag">SEM CÓDIGO VÁLIDO</span>',
     '<div class="inline-actions"><select aria-label="Código da conta bancária '+safe(a.bank)+'" data-bank-link="'+safe(a.id)+'">'+optionsFor(c,valid?a.chartCode:known.length===1?known[0].code:'')+'</select><button type="button" class="secondary" data-save-bank-link="'+safe(a.id)+'">Vincular</button></div><small>'+safe(hint)+'</small>'];
  })):empty('Cadastre uma empresa.');
  $('#ruleTable').innerHTML=c?table(['Termo','Contrapartida'],c.rules.map(r=>[safe(r.term),safe(r.counterpart)])):empty('Cadastre uma empresa.');
  const bankSelect=$('#statementAccount');const previous=bankSelect.value;bankSelect.innerHTML='<option value="">Identificar automaticamente no extrato</option>'+(c?validBankAccounts(c).map(a=>`<option value="${safe(a.id)}">${safe(a.bank)} • ${safe(a.label)} • código ${safe(a.chartCode)}</option>`).join(''):'');if([...bankSelect.options].some(o=>o.value===previous))bankSelect.value=previous;
}
function renderAssistente(){
 const c=current(),assist=window.ConciliaAssistente;if(!assist)return;
 const guide=$('#workflowGuide'),banner=$('#completionBanner'),status=assist.analisar(Core,c,period),steps=assist.etapas(Core,c,period);
 const currentStep=steps.findIndex(x=>!x[2]);if(guide)guide.innerHTML='<div class="guide-head"><div><strong>Seu assistente contábil</strong><p>Siga as etapas. Cada código pertence ao plano da empresa selecionada.</p></div><span>'+safe(c?.name||'Nenhuma empresa')+'</span></div><div class="guide-items">'+steps.map((t,i)=>`<button type="button" data-go="${safe(t[3])}" class="guide-step ${t[2]?'done':i===currentStep?'next':''}"><b>${t[2]?'✓':i+1}</b><span><strong>${safe(t[0])}</strong><small>${safe(t[1])}</small></span><em>${t[2]?'Concluído':i===currentStep?'Próximo passo':'Pendente'}</em></button>`).join('')+'</div>';
 if(banner){let message=status.ready?'CONCILIAÇÃO COM RAZÃO CONCLUÍDA: relatório disponível.':status.exportable?'PRÉVIA PARA REVISÃO: '+status.notInLedger+' lançamento(s) candidato(s) não encontrado(s) no Razão; ainda não significa conciliação finalizada.':status.status==='DIVERGENCIA'?'AUDITORIA DISPONÍVEL: consulte os detalhes na tabela abaixo.':status.total?'CONFERÊNCIA EM ANDAMENTO: '+status.pending+' lançamento(s) precisam de código ou conferência.':'AGUARDANDO EXTRATOS E RAZÃO: comece pelas etapas acima.';
 banner.className='completion-banner '+(status.ready?'done':'pending');
 banner.innerHTML='<strong>'+safe(message)+'</strong><div>'+status.total+' movimentações • '+status.files+' extrato(s) • '+status.transfers+' transferências confirmadas • '+status.pending+' pendências manuais • '+status.divergences+' alertas de divergência • '+status.notInLedger+' registros não encontrados no Razão • '+status.unverified+' saldos não verificados • '+status.pendingReading+' linhas para revisão • '+status.orphanBankLedger+' lançamentos bancários do Razão sem vínculo • '+(status.withoutLedger?.length||0)+' bancos sem Razão • '+(status.ledgerBalanceDifferences?.length||0)+' divergências de saldo contábil × bancário • Razão: '+(status.ledger?'importado':'pendente')+'</div><p>O Excel de conferência e o PDF ficam disponíveis com pendências indicadas; somente códigos confirmados podem integrar lançamentos prontos.</p>';}
 if(banner&&status.withoutLedger?.length)banner.innerHTML+='<p><b>Razão faltante para banco(s) de código: '+safe(status.withoutLedger.join(', '))+'</b>. A conferência não poderá ser finalizada sem esses documentos.</p>';
 $('#downloadPdf').disabled=!status.total;
 const undo=$('#undoRemove');if(undo)undo.hidden=!ultimoExcluido;
}
function renderTaxes(){
 const c=current(),Tax=window.ConciliaTax;
 if(!Tax)return;
 const input=$('#taxRuleCode');
 if(input){
  const previous=input.value;
  input.innerHTML='<option value="">Escolha a conta do plano</option>'+(c||{plan:[]}).plan.filter(p=>p.analytic).map(p=>'<option value="'+safe(p.code)+'">'+safe(p.code)+' — '+safe(p.description)+'</option>').join('');
  if([...input.options].some(o=>o.value===previous))input.value=previous;
 }
 const query=Core.norm($('#taxCodeSearch')?.value||'');
 const rules=(c?.taxRules||[]).filter(r=>!query||Core.norm(r.key+' '+r.description+' '+r.code).includes(query));
 $('#taxCodeList').innerHTML=c?rules.length?table(['Receita / Identificação','Descrição','Código no plano','Situação',''],rules.map(r=>{
  const valid=c.plan.some(p=>p.analytic&&String(p.code)===String(r.code));
  return [safe(r.key),safe(r.description),safe(r.code),r.referenceOnly?'SOMENTE CONSULTA':valid?'CÓDIGO VÁLIDO':'NÃO CONSTA NO PLANO','<button type="button" class="secondary" data-remove-tax-rule="'+safe(r.key)+'">Excluir</button>'];
 })):'<p>Nenhum código encontrado. Clique em Cadastrar minhas referências tributárias para começar.</p>':'<p>Selecione uma empresa.</p>';
 const splits=(c?.taxSplits||[]).filter(x=>x.period===period&&x.status==='CONFIRMADA');
 $('#taxConfirmedList').innerHTML=c?splits.length?table(['Pagamento bancário','Documentos','Componentes','Total',''],splits.map(x=>{
  const movement=c.movements.find(m=>m.id===x.movementId);
  return [safe(movement?datePT(movement.date)+' • '+movement.history:'Movimento original indisponível'),safe((x.receiptIds||[]).join(', ')),x.lines.length,currency(Math.abs(x.cents)),'<button type="button" class="secondary" data-remove-tax-split="'+safe(x.id)+'">Desfazer separação</button>'];
 })):'<p>Nenhuma separação tributária confirmada para esta competência.</p>':'<p>Selecione uma empresa.</p>';
}
function renderImport(){const c=current();$('#allImports').innerHTML=c?table(['Arquivo','Tipo','Competência(s)','Movimentos','Saldos','Situação','Ações'],c.imports.slice().reverse().map(i=>[
 safe(i.name),badge(i.type),safe((i.periods||[]).join(', ')),i.movementCount??i.count??0,
 i.balanceCheck?.status==='DIVERGENTE'?'<span class="status-red">DIVERGENTE</span>':['OK','MANUAL_OK'].includes(i.balanceCheck?.status)?badge((i.balanceCheck?.status==='MANUAL_OK'?'CONFERIDO MANUALMENTE':'OK')+' · diferença '+currency(i.balanceCheck.difference)):badge(i.balanceCheck?.status||'NÃO CONFERIDO'),
 badge(i.partialCount?'PENDENTE CONTRAPARTIDA':i.reviewCount?'COM REVISÕES':'IMPORTADO'),
 ['EXTRATO','RAZAO','RAZAO_REFERENCIA'].includes(i.type)?'<div class="inline-actions">'+(i.type==='EXTRATO'&&!['OK','MANUAL_OK'].includes(i.balanceCheck?.status)?'<button type="button" data-balance-check="'+safe(i.id)+'">Conferir saldo</button>':'')+'<button type="button" data-delete-import="'+safe(i.id)+'">Excluir</button><button type="button" data-redo-import="'+safe(i.id)+'">Refazer</button></div>':'—'
 ])):empty('Importe o plano de contas para iniciar.');
}

function transferIds(c){return new Set(c.transfers.filter(t=>t.status==='CONFIRMADA').flatMap(t=>[t.outId,t.inId]))}
function movementOriginKey(m){return m.importId?'id:'+m.importId:'legacy:'+String(m.origin||'SEM_ORIGEM');}
function movementOriginLabel(m,imports,accounts){
 const imp=m.importId?imports.get(m.importId):null;
 const filename=imp?.name||m.origin||'Origem não identificada';
 const bank=imp?.bank||accounts.get(m.accountId)?.bank||'Banco não informado';
 return bank+' — '+filename;
}
function renderMovements(){
 const c=current(),filter=$('#movementStatementFilter'),summary=$('#movementFilterSummary');
 if(!c){filter.innerHTML='<option value="">Selecione uma empresa</option>';summary.textContent='';$('#movementTable').innerHTML=empty('Selecione uma empresa.');return;}
 const matched=transferIds(c),accounts=new Map(c.accounts.map(a=>[a.id,a])),imports=new Map(c.imports.filter(i=>i.type==='EXTRATO').map(i=>[i.id,i]));
 const all=sortedMoves(c),scope=companyId+'|'+period;
 const sources=new Map();
 for(const m of all){
  const key=movementOriginKey(m);
  if(!sources.has(key))sources.set(key,{key,label:movementOriginLabel(m,imports,accounts),count:0,at:imports.get(m.importId)?.at||''});
  sources.get(key).count++;
 }
 const ordered=[...sources.values()].sort((a,b)=>b.at.localeCompare(a.at)||a.label.localeCompare(b.label,'pt-BR'));
 if(movementFilterScope!==scope){movementFilterScope=scope;selectedMovementStatement='';}
 if(!ordered.some(x=>x.key===selectedMovementStatement))selectedMovementStatement=ordered[0]?.key||'';
 filter.innerHTML=ordered.length?ordered.map(x=>`<option value="${safe(x.key)}">${safe(x.label)} (${x.count})</option>`).join(''):'<option value="">Nenhum extrato nesta competência</option>';
 filter.disabled=!ordered.length;
 filter.value=selectedMovementStatement;
 const list=all.filter(m=>movementOriginKey(m)===selectedMovementStatement);
 summary.textContent=ordered.length?list.length+' lançamento(s) deste extrato · '+ordered.length+' extrato(s) na competência '+period:'Nenhuma movimentação nesta competência.';
 const rows=list.map(m=>[
  datePT(m.date),safe(accounts.get(m.accountId)?.bank||'Conta excluída'),`<span title="${safe(movementOriginLabel(m,imports,accounts))}">${safe(imports.get(m.importId)?.name||m.origin||'Origem não identificada')}</span>`,
  `<span class="fiscal">${safe(m.history)}<div class="subtle">${safe(m.financialDescription?('Controle financeiro: '+String(m.financialDescription||'').replace(/^\s*\d+(?:\.\d+)*\s*[-–.]?\s*/,'').trim()+' ['+(m.financialMatch||'SUGERIDA')+']'):(m.financialMatch==='AMBIGUA'?'Controle financeiro: múltiplas correspondências — revisar':m.party||'Sem contraparte informada'))}${m.historicalDescriptionMatch?'<div class="subtle">'+safe(m.historicalDescriptionMatch)+'</div>':''}</div></span>`,
  `<span class="${m.cents<0?'flag':''}">${currency(m.cents)}</span>`,
  (()=>{const acc=accounts.get(m.accountId),code=c.plan.some(p=>p.analytic&&String(p.code)===String(acc?.chartCode))?String(acc.chartCode):'';return code&&m.cents>0?safe(code):'—'})(),
  (()=>{const acc=accounts.get(m.accountId),code=c.plan.some(p=>p.analytic&&String(p.code)===String(acc?.chartCode))?String(acc.chartCode):'';return code&&m.cents<0?safe(code):'—'})(),
  badge(matched.has(m.id)?'TRANSFERÊNCIA':m.status),
  matched.has(m.id)?'<small>Vínculo confirmado</small>':`<div class="inline-actions"><select id="cp_${safe(m.id)}" ${m.status==='PENDENTE_DUPLICIDADE'?'disabled':''}>${optionsFor(c,m.counterpart||m.suggested)}</select><button data-classify="${safe(m.id)}" ${m.status==='PENDENTE_DUPLICIDADE'?'disabled':''}>Confirmar</button></div>`
 ]);
 $('#movementTable').innerHTML=table(['Data','Banco','Extrato de origem','Histórico','Valor','Débito banco','Crédito banco','Situação','Contrapartida'],rows);
 $('#movementTable').querySelectorAll('tbody tr').forEach((row,i)=>{const m=list[i];if(!m)return;row.classList.add(m.status==='PENDENTE_DUPLICIDADE'?'row-red':matched.has(m.id)||m.status==='CONFIRMADO'?'row-green':'row-yellow');});
}
function renderTransfers(){const c=current();if(!c){$('#transferTable').innerHTML=empty('Selecione uma empresa.');$('#transferSummary').innerHTML='';return}const mv=new Map(Core.periodMovements(c,period).map(m=>[m.id,m]));const accounts=new Map(c.accounts.map(a=>[a.id,a]));const suggestions=Core.transferSuggestions(c,period);const stored=c.transfers.filter(t=>mv.has(t.outId)&&mv.has(t.inId));const present=new Set(stored.map(t=>t.outId+'|'+t.inId));const all=stored.concat(suggestions.proposals.filter(t=>!present.has(t.outId+'|'+t.inId)));
  $('#transferSummary').innerHTML=`<div class="pills">${badge(`${c.transfers.filter(t=>t.status==='CONFIRMADA').length} confirmadas`)}${badge(`${suggestions.ambiguous.length} saídas ambíguas`)+badge(`${(suggestions.unmatched||[]).length} possível(is) transferência(s) sem par`)}</div>`;
  $('#transferTable').innerHTML=table(['Saída / origem','Entrada / destino','Valor','Situação','Conferência'],all.map(t=>{const out=mv.get(t.outId),inn=mv.get(t.inId);return[`${datePT(out.date)} — ${safe(accounts.get(out.accountId)?.bank)}<div class="subtle">${safe(out.history)}</div>`,`${datePT(inn.date)} — ${safe(accounts.get(inn.accountId)?.bank)}<div class="subtle">${safe(inn.history)}</div>`,currency(inn.cents),badge(t.status),t.status==='SUGERIDA'?`<div class="inline-actions"><button data-transfer="${safe(t.outId)}|${safe(t.inId)}" data-decision="CONFIRMADA">Confirmar</button><button data-transfer="${safe(t.outId)}|${safe(t.inId)}" data-decision="REJEITADA">Rejeitar</button></div>`:'—']}))+(suggestions.ambiguous.length?`<div class="hint">⚠ ${suggestions.ambiguous.length} movimentação(ões) com valores repetidos e vários pares possíveis: nenhuma foi vinculada automaticamente.</div>`:'')+(suggestions.unmatched?.length?`<div class="hint">⚠ ${suggestions.unmatched.length} movimento(s) indicam transferência, mas não há par identificado em outro extrato. Confira manualmente.</div>`:'');
}
function renderRecon(){const c=current();if(!c){$('#previewTable').innerHTML=empty('Selecione uma empresa.');$('#missingLedger').innerHTML='';$('#reconStats').innerHTML='';return}const rec=Core.reconcile(c,period),preview=Core.previewExport(c,period);$('#reconStats').innerHTML=`<div class="pills">${badge(`${rec.checked.filter(x=>x.recon==='CONCILIADO').length} conciliado(s)`)}${badge(`${preview.rows.length} não encontrado(s) no Razão`)}${badge(`${preview.blocked.length} ambíguo(s)`)}${badge(`${rec.missingLedger.length} lançamentos do Razão sem vínculo`)}</div>`+(rec.errors.length?`<p class="flag">${rec.errors.length} erros de conta inválida impedem a exportação.</p>`:'');
  $('#previewTable').innerHTML=table(['Data','Débito','Crédito','Valor','Histórico','Comparação'],rec.checked.map(l=>[datePT(l.date),safe(l.debit),safe(l.credit),currency(l.cents),safe(l.history),badge(l.recon)]));
  $('#missingLedger').innerHTML=table(['Data','Débito','Crédito','Valor'],rec.missingLedger.map(l=>[datePT(l.date),safe(l.debit),safe(l.credit),currency(l.cents)]));
 const discrepancy=window.ConciliaAssistente?.divergenciasSaldo(c,period)||[];
 if(discrepancy.length)$('#reconStats').innerHTML+='<div class="audit-differences">'+discrepancy.map(d=>'<div>'+safe(d.bank)+' (cód. '+safe(d.bankCode)+') — Saldo Razão '+currency(d.accountingFinal)+' x banco '+currency(d.bankFinal)+' • Diferença '+currency(d.difference)+'</div>').join('')+'</div>';

}
function renderAuditoria(){
 const main=$('#auditTable'),stats=$('#auditStats'),c=current(),api=window.ConciliaAuditoria;
 if(!main||!stats||!api)return;
 if(!c||!Core.periodMovements(c,period).length){main.innerHTML=empty('Importe o extrato e o Razão definitivo para identificar os lançamentos faltantes.');stats.innerHTML='';return;}
 const analysis=api.audit(Core,c,period);
 const missing=analysis.events.filter(e=>e.type==='EXTRATO_SEM_RAZAO');
 const uncertain=analysis.events.filter(e=>['AMBIGUIDADE','CORRESPONDENCIA_PARA_REVISAO'].includes(e.type));
 stats.innerHTML='<div class="pills">'+badge(missing.length+' lançamento(s) do extrato sem Razão')+(uncertain.length?badge(uncertain.length+' ocorrência(s) ainda sem identificação segura'):'')+'</div>';
 const rows=missing.map(e=>[
  safe(e.date?api.dateBR(e.date):'—'),
  safe(e.bank||'—'),
  '<b>'+safe(e.history||'Histórico não informado')+'</b>',
  currency(e.cents),
  e.cents<0?'Saída do banco (crédito na conta bancária)':'Entrada no banco (débito na conta bancária)',
  '<b>Débito:</b> '+safe(e.guidance?.debit||'A confirmar')+'<div><b>Crédito:</b> '+safe(e.guidance?.credit||'A confirmar')+'</div>'
 ]);
 main.innerHTML=rows.length?table(['Data','Banco','Nome / histórico do extrato','Valor','Movimento','Débito e crédito no Domínio'],rows):empty(uncertain.length?'Não há lançamento individual comprovadamente faltante. Existem correspondências ambíguas; confira os favorecidos no Razão.':'Nenhum lançamento do extrato sem correspondência identificado no Razão importado.');
}
function renderReviews(){const c=current();$('#reviewTable').innerHTML=c?table(['Arquivo','Linha','Conteúdo original','Motivo'],state.reviews.filter(r=>r.companyId===companyId).slice(-300).reverse().map(r=>[safe(r.origin),safe(r.line),`<div class="fiscal">${safe(r.content)}</div>`,safe(r.reason)])):empty('Selecione uma empresa.');}
async function afterImport(type,c,file,result,sha,importId=''){const rr=result.reviews||[];state.reviews.push(...rr.map(r=>({...r,companyId:c.id,importId,period:importId?'':period,operational:type!=='PLANO'})));return {reviewCount:rr.length}}
function putFile(file,name,content){const blob=new Blob([content],{type:'text/plain;charset=utf-8'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000)}

function planSource(text){const rows=String(text).replace(/^\uFEFF/,'').split(/\r?\n/);const index=rows.findIndex(x=>/(?:codigo|c[oó]digo|classificacao|classifica[cç][aã]o)/i.test(x)&&/(?:descricao|descri[cç][aã]o|nome)/i.test(x));if(index<0)throw Error('O plano precisa de colunas Código e Descrição. Exporte para CSV/TXT pelo Domínio.');return {table:rows.slice(index).join('\n'),metadata:rows.slice(0,Math.max(index,1)).join('\n')}}
function bankPlanCandidates(c,bank){
 const n=Core.norm(bank);
 if(!n)return [];
 const aliases=n.includes('itau')?['itau']:n.includes('caixa')?['caixaeconomica','bancocaixa']:n.includes('sicredi')?['sicredi']:n.includes('stone')?['stone']:n.includes('bradesco')?['bradesco']:n.includes('santander')?['santander']:n.includes('nubank')?['nubank','nuconta']:n.includes('pagbank')||n.includes('pagseguro')?['pagbank','pagseguro']:n.includes('bancodobrasil')?['bancodobrasil']:n.includes('inter')?['bancointer']:null;
 if(!aliases)return [];
 return (c.plan||[]).filter(a=>{
  if(!a.analytic)return false;
  const d=Core.norm(a.description);
  // O código interno da conta é variável por empresa. NÃO exigir prefixo fixo
  // "1.1.1.02." nem confundir aplicação, empréstimo ou receita com banco.
  if(/emprestimo|financiamento|cartao|aplicacao|rendimento|tarifa|despesa|fundofixo|receita/.test(d))return false;
  return aliases.some(x=>d.includes(x));
 });
}
function bankAccountDigits(value){
 const t=String(value||'');
 const match=t.match(/(?:C\/?C|CONTA(?:\s+CORRENTE)?|CTA)\s*[:.\-]*\s*(\d[\d.\-\/ ]{2,18}\d)/i);
 const raw=match?.[1]||'';
 return raw.replace(/\D/g,'');
}
function bankStatementDigits(text){
 const t=String(text||'').slice(0,1800);
 const match=t.match(/(?:CONTA(?:\s+CORRENTE)?|C\/?C|CTA)\s*[:.\-]*\s*(\d[\d.\-\/ ]{2,18}\d)/i);
 return (match?.[1]||'').replace(/\D/g,'');
}
function bankCodeFromPlan(c,bank,identity=''){
 const matches=bankPlanCandidates(c,bank);
 if(matches.length===1)return String(matches[0].code);
 if(matches.length<2)return '';
 const digits=bankStatementDigits(identity);
 if(digits.length<5)return '';
 const suffix=digits.slice(-Math.min(digits.length,7));
 const byAccount=matches.filter(p=>{
  const d=bankAccountDigits(p.description);
  return d.length>=5&&(d.endsWith(suffix)||suffix.endsWith(d.slice(-Math.min(d.length,7))));
 });
 return byAccount.length===1?String(byAccount[0].code):'';
}
function guessBankAccount(c,bank,identity=''){return bankCodeFromPlan(c,bank,identity)}
function autoLinkBankCodes(c){
 let linked=0;
 for(const account of c.accounts||[]){
  if(c.plan.some(p=>p.analytic&&String(p.code)===String(account.chartCode)))continue;
  const imports=(c.imports||[]).filter(i=>i.type==='EXTRATO'&&i.accountId===account.id);
  // Nunca escolher arbitrariamente quando o plano possui mais de uma conta do banco.
  const code=bankCodeFromPlan(c,account.bank,account.label+' '+imports.map(i=>i.name||'').join(' '));
  if(!code)continue;
  account.chartCode=code;linked++;
 }
 return linked;
}
// Memória de classificações confirmadas. Apenas padrões específicos da empresa e banco;
// PIX/boletos genéricos sem identificação de contraparte nunca viram aprendizado automático.
function learningKey(c,m){
 const bank=financialBank(c.accounts.find(a=>a.id===m.accountId)?.bank||'');
 const description=String(m.financialDescription||'').replace(/\s*\(identificação individual pendente\)/i,'').trim();
 const raw=description||String(m.history||'').trim();
 const normalized=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
 if(!bank||!normalized||(normalized.length<8&&!/^(?:iof|juros|rend|tarifa|tarifas|cesta)$/.test(normalized)))return '';
 if(!description&&/^(?:cre pix ch|cred pix|deb pix ch|envio pix|pag boleto|compra|transferencia|pagamento|recebimento|pix recebido|pix enviado)$/.test(normalized))return '';
 if(m.financialMatch&&m.financialMatch!=='SUGERIDA'&&description)return '';
 const direction=m.cents>0?'ENTRADA':'SAIDA';
 return bank+'|'+direction+'|'+normalized;
}
function learnedKeys(c,m){
 const primary=learningKey(c,m);
 const original=learningKey(c,{...m,financialDescription:''});
 return [...new Set([primary,original].filter(Boolean))];
}
function learnConfirmed(c,m,cp,source='MANUAL'){
 const keys=learnedKeys(c,m);
 if(!keys.length)return false;
 c.learnedCodes=c.learnedCodes||[];
 for(const key of keys){
  let rule=c.learnedCodes.find(r=>r.key===key);
  if(!rule){rule={key,bank:financialBank(c.accounts.find(a=>a.id===m.accountId)?.bank),label:key===keys[0]?(m.financialDescription||m.history):m.history,codes:{},examples:0,verifiedExamples:0,updatedAt:''};c.learnedCodes.push(rule);}
  rule.codes=rule.codes||{};
  rule.codes[String(cp)]=(rule.codes[String(cp)]||0)+1;
  rule.examples=Object.values(rule.codes).reduce((n,v)=>n+v,0);
  if(source==='IMPORTACAO_VALIDADA'||source==='MANUAL')rule.verifiedExamples=(rule.verifiedExamples||0)+1;
  rule.updatedAt=new Date().toISOString();
 }
 return true;
}
function applyLearnedCode(c,m){
 if(m.status==='CONFIRMADO'||m.status==='PENDENTE_DUPLICIDADE'||m.financialMatch==='AMBIGUA'||m.financialMatch==='SEM_CORRESPONDENCIA')return false;
 if(m.suggested&&m.confidence&&!String(m.confidence).startsWith('Aprendizado'))return false;
 const keys=learnedKeys(c,m);
 const evidence=[];
 for(const key of keys){
  const rule=(c.learnedCodes||[]).find(x=>x.key===key);
  if(!rule)continue;
  const codes=Object.entries(rule.codes||{}).filter(([code])=>c.plan.some(p=>String(p.code)===code&&p.analytic)&&!c.accounts.some(a=>String(a.chartCode)===code));
  const total=Object.values(rule.codes||{}).reduce((n,v)=>n+v,0);
  if(codes.length!==1||codes[0][1]!==total||(!rule.verifiedExamples&&total<2))continue;
  evidence.push({code:codes[0][0],total,verified:!!rule.verifiedExamples});
 }
 const distinct=[...new Set(evidence.map(e=>e.code))];
 if(distinct.length!==1)return false;
 m.suggested=distinct[0];
 m.confidence='Aprendizado da empresa: '+Math.max(...evidence.map(e=>e.total))+' ocorrência(s) — exige confirmação';
 return true;
}
function applyLearningPeriod(c,ym){
 let count=0;
 for(const m of Core.periodMovements(c,ym))if(applyLearnedCode(c,m))count++;
 return count;
}
function autoSuggest(c,m){
 if(m.status==='PENDENTE_DUPLICIDADE'||m.status==='CONFIRMADO')return;
 const h=Core.norm(m.history);
 const matches=(terms)=>c.plan.filter(x=>x.analytic&&terms.some(term=>Core.norm(x.description).includes(term))&&!c.accounts.some(a=>String(a.chartCode)===String(x.code)));
 // Só indica conta se houver UM candidato inequívoco dentro do plano da própria empresa.
 // Boleto e PIX genéricos nunca determinam automaticamente a contrapartida.
 let candidates=[];
 // RES APLIC AUT MAIS é resgate de aplicação financeira, nunca rendimento.
 const isAplicacao=/RES\s+APLIC\s+AUT\s+MAIS/i.test(String(m.history||''))||h.includes('resaplicautmais');
 // REND isolado identifica rendimento (sem confundir com parte de outra palavra).
 const isRendimento=/\bREND\b/i.test(String(m.history||''))||/rendimentosrendpagoaplic|rendimentodeaplicacao|rendimentosaplic/.test(h);
 if(isAplicacao){
   candidates=matches(['aplicacaofinanceira','aplicacoesfinanceiras','aplicacaoautomatica','aplicacoesautomaticas','aplicacaodeliquidez','resgatedeaplicacao']);
 }else if(isRendimento){
   candidates=matches(['rendimentodeaplicacao','rendimentosdeaplicacoes','rendimentosfinanceiros','receitafinanceira','receitasfinanceiras','rendimentosdeaplicacoesfinanceiras']);
 }else if(/tarifa|tarif|pacoteservico|tarliq/.test(h)){
   candidates=matches(['tarifabancaria','despesasbancarias','tarifasbancarias']);
 }
 if(candidates.length===1){m.suggested=String(candidates[0].code);m.confidence='Sugestão por histórico e plano de contas — exige confirmação';}
 // Não substituir essas categorias com aprendizados de outros históricos.
 // Sem conta analítica única no plano da empresa, a operação fica pendente.
 if(!isAplicacao&&!isRendimento)applyLearnedCode(c,m);
 window.ConciliaPartners?.suggest(c,m);
}

function financialDate(v){
 if(v instanceof Date&&!isNaN(v))return v.toISOString().slice(0,10);
 if(typeof v==='number'&&v>20000&&v<90000)return new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000).toISOString().slice(0,10);
 const t=String(v||'').trim(),m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'): /^\d{4}-\d{2}-\d{2}/.test(t)?t.slice(0,10):'';
}
function financialBank(t){
 const n=Core.norm(t);
 if(/stone/.test(n))return 'stone';
 if(/sicredi/.test(n))return 'sicredi';
 if(n==='caixa'||/caixaeconomica|cef|extratocaixa/.test(n))return 'caixa';
 if(/itau/.test(n))return 'itau';
 if(/santander/.test(n))return 'santander';
 if(/nubank|nuconta/.test(n))return 'nubank';
 if(/pagbank|pagseguro/.test(n))return 'pagbank';
 if(/bancointer/.test(n))return 'inter';
 if(/bancodobrasil/.test(n))return 'brasil';
 return n||'';
}
function financialRows(workbook){
 const sheet=workbook.Sheets['Livro Diário FC']||workbook.Sheets[workbook.SheetNames.find(n=>Core.norm(n).includes('livrodiario'))];
 if(!sheet)throw Error('Aba Livro Diário FC não encontrada no Excel do cliente.');
 // Este modelo usa formatação em mais de 1 milhão de linhas vazias.
 // Percorrer !ref diretamente consome memória e interrompe a leitura no navegador.
 const indexes=Object.keys(sheet).filter(k=>/^(?:C|E|K)\d+$/.test(k)&&sheet[k]&&sheet[k].v!==undefined&&sheet[k].v!=='').map(k=>Number(k.match(/\d+$/)[0]));
 const maxRow=Math.min(150000,indexes.reduce((n,v)=>Math.max(n,v),10));
 const range={s:{r:0,c:2},e:{r:maxRow-1,c:10}};
 const rows=window.XLSX.utils.sheet_to_json(sheet,{header:'A',defval:'',raw:true,range,blankrows:false});
 const out=[];
 let headerFound=false;
 for(const [idx,r] of rows.entries()){
  if(!headerFound){
   if(Core.norm(r.C)==='data'&&Core.norm(r.E).includes('descricao')&&Core.norm(r.K).includes('origdest'))headerFound=true;
   continue;
  }
  const date=financialDate(r.C);
  if(!date)continue;
  const bank=financialBank(r.K),description=String(r.E||'').trim(),category=String(r.D||'').trim();
  if(!bank||(!description&&!category))continue;
  const readAmount=v=>{if(v===''||v===null||v===undefined)return 0;try{return Math.abs(Core.money(v))}catch{return 0}};
  // Colunas G/H são a referência principal do controle do cliente; I/J apenas quando G/H não trazem valor.
  const income=readAmount(r.G)||readAmount(r.I),expense=readAmount(r.H)||readAmount(r.J);
  if(income>0&&expense>0)continue;
  const cents=income>0?income:-expense;
  if(!cents)continue;
  out.push({id:Core.id(),date,bank,description,category,cents,sourceRow:Number(r.__rowNum__??idx)+1});
 }
 if(!headerFound)throw Error('Cabeçalho Data / Descrição / Orig/Dest não encontrado na aba Livro Diário FC.');
 return out;
}
function financialCodeSuggestions(c,m){
 if(!m.financialDescription||!['SUGERIDA','CATEGORIA_COMPARTILHADA'].includes(m.financialMatch)||m.status==='CONFIRMADO')return '';
 const bankCodes=new Set(c.accounts.map(a=>String(a.chartCode)));
 const choices=c.plan.filter(p=>p.analytic&&!bankCodes.has(String(p.code)));
 // Número da categoria do cliente não equivale ao código contábil Domínio.
 const clean=t=>String(t||'').replace(/^\s*\d+(?:\.\d+)*\s*[-–.]?\s*/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
 const term=clean(m.financialCategory);
 if(term.length<5)return '';
 const exact=choices.filter(p=>clean(p.description)===term);
 if(exact.length===1)return String(exact[0].code);
 const stop=new Set(['de','da','do','das','dos','para','com','em','e','a','o','itens','item','receita','receitas','despesa','despesas','pagamento','gastos','conta','contas','servicos','servico']);
 const words=t=>new Set(clean(t).split(' ').filter(w=>w.length>=4&&!stop.has(w)));
 const want=words(term);
 if(!want.size)return '';
 const hits=choices.map(p=>{
  const got=words(p.description);
  const same=[...want].filter(w=>got.has(w)).length;
  return {code:String(p.code),same,ratio:same/Math.max(want.size,got.size),missing:want.size-same};
 }).filter(x=>x.same>=1&&x.ratio>=0.75&&x.missing===0);
 if(hits.length===1)return hits[0].code;
 // Categorias não padronizadas não devem ser convertidas em conta contábil por suposição.
 return '';
}
// Coluna D é o histórico principal; coluna E apenas complementa com palavras novas.
function composeFinancialDescription(category,detail){
 const strip=x=>String(x??'').trim().replace(/^\d+(?:\.\d+)*\s*[-–.:]?\s*/,'').trim();
 const base=strip(category),extra=strip(detail);
 if(!base)return extra;
 if(!extra)return base;
 const normalized=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const tokens=x=>x.match(/[\p{L}\p{N}]+(?:[-/][\p{L}\p{N}]+)*/gu)||[];
 const present=new Set(tokens(base).map(normalized));
 const already=new Set();
 const novel=tokens(extra).filter(t=>{
   const key=normalized(t);
   if(present.has(key)||already.has(key))return false;
   already.add(key);return true;
 });
 return novel.length?base+' — '+novel.join(' '):base;
}
function financialMatches(c,ym){
 const controls=(c.financialControls||[]).filter(x=>x.period===ym);
 const entries=controls.flatMap(x=>(x.rows||[]).map(r=>({...r,sourceFile:x.name,uniqueKey:x.id+'|'+r.id})));
 const moves=Core.periodMovements(c,ym).filter(m=>m.status!=='PENDENTE_DUPLICIDADE');
 const transfers=Core.transferSuggestions(c,ym);
 const protectedIds=new Set([...(c.transfers||[]).filter(x=>x.status==='CONFIRMADA').flatMap(x=>[x.outId,x.inId]),...transfers.proposals.flatMap(x=>[x.outId,x.inId]),...transfers.ambiguous.flatMap(x=>[x.outId,...x.possibleInIds])]);
 const banks=new Map(c.accounts.map(a=>[a.id,financialBank(a.bank)]));
 // Se a planilha de extrato não traz o banco no conteúdo, usar o nome explícito do arquivo,
 // sem atribuir automaticamente um código contábil não confirmado.
 for(const m of moves){
   const account=c.accounts.find(a=>a.id===m.accountId);
   if(!account||!['banconaoidentificado','outrobanco',''].includes(Core.norm(account.bank)))continue;
   const originBank=financialBank(m.origin||'');
   if(['caixa','stone','sicredi','itau','santander','nubank','pagbank','inter','brasil'].includes(originBank)){
     account.bank=originBank==='caixa'?'Caixa Econômica Federal':originBank;
     banks.set(account.id,originBank);
   }
 }
 const cleanCat=t=>String(t||'').replace(/^\s*\d+(?:\.\d+)*\s*[-–.]?\s*/,'').trim();
 const byBankAmount=new Map();
 for(const e of entries){
  const key=e.bank+'|'+e.cents;
  if(!byBankAmount.has(key))byBankAmount.set(key,[]);
  byBankAmount.get(key).push(e);
 }
 const candidates=new Map(),referenceCounts=new Map();
 for(const m of moves){
  let options=protectedIds.has(m.id)?[]:[
    ...(byBankAmount.get(banks.get(m.accountId)+'|'+m.cents)||[]).filter(e=>Core.dayDistance(e.date,m.date)<=4),
    ...(byBankAmount.get('|'+m.cents)||[]).filter(e=>e.date===m.date)
  ];
  if(options.length){const closest=Math.min(...options.map(e=>Core.dayDistance(e.date,m.date)));options=options.filter(e=>Core.dayDistance(e.date,m.date)===closest);}
  candidates.set(m.id,options);
  for(const e of options)referenceCounts.set(e.uniqueKey,(referenceCounts.get(e.uniqueKey)||0)+1);
 }
 const source=e=>({description:e.description,category:e.category,sourceRow:e.sourceRow,date:e.date,sourceFile:e.sourceFile});
 const clear=m=>{
  if(['SUGERIDA','CATEGORIA_COMPARTILHADA','AGRUPADA'].includes(m.financialMatch)){
   delete m.financialDescription;delete m.financialDetail;delete m.financialCategory;delete m.financialSourceRow;delete m.financialSourceFile;
   if(m.confidence==='Controle financeiro + conta analítica do plano — confirmar'||String(m.confidence||'').startsWith('Razão histórico (')){delete m.suggested;delete m.confidence;delete m.historicalCodeConflict;}
  }
  delete m.financialCandidates;
 };
 let matched=0,ambiguous=0,coded=0,unmatched=0,shared=0,grouped=0;
 for(const m of moves){
  if(m.status==='CONFIRMADO'||protectedIds.has(m.id))continue;
  const options=candidates.get(m.id)||[];
  const unique=options.length===1&&referenceCounts.get(options[0].uniqueKey)===1;
  if(unique){
   const e=options[0];
   m.financialDescription=composeFinancialDescription(e.category,e.description);m.financialDetail=e.description;m.financialCategory=e.category;
   m.financialSourceRow=e.sourceRow;m.financialSourceFile=e.sourceFile;m.financialMatch='SUGERIDA';delete m.financialCandidates;matched++;
   if(!m.suggested||m.confidence==='Controle financeiro + conta analítica do plano — confirmar'){
    const code=financialCodeSuggestions(c,m);
    if(code){m.suggested=code;m.confidence='Controle financeiro + conta analítica do plano — confirmar';coded++;}
   }
   continue;
  }
  clear(m);
  // Mesmo valor exato repetido: descrever a categoria somente se TODAS as alternativas
  // pertencerem à mesma conta da coluna D, sem alegar identificar qual linha/cliente.
  const labels=[...new Set(options.map(e=>cleanCat(e.category)).filter(Boolean))];
  if(options.length&&labels.length===1){
   m.financialDescription=labels[0]+' (identificação individual pendente)';m.financialCategory=options[0].category;
   m.financialMatch='CATEGORIA_COMPARTILHADA';m.financialCandidates=options.map(source);shared++;matched++;
   // Categoria é unânime, mas a linha/cliente específico permanece indeterminado.
   if(!m.suggested){const code=financialCodeSuggestions(c,m);if(code){m.suggested=code;m.confidence='Controle financeiro + conta analítica do plano — confirmar';coded++;}}
   continue;
  }
  if(options.length){m.financialMatch='AMBIGUA';m.financialCandidates=options.map(source);ambiguous++;}
  else{m.financialMatch='SEM_CORRESPONDENCIA';unmatched++;}
 }
 const learned=applyLearningPeriod(c,ym);
 return {matched,ambiguous,coded,unmatched,shared,grouped,learned,total:entries.length};
}
function suggestFromHistoricalLedger(c,ym){
 // Razão anterior é SOMENTE referência de históricos e de códigos explicitamente conhecidos.
 // O banco é sempre debitado em entradas e creditado em saídas, mesmo SEM Razão.
 const refs=(c.referenceLedgers||[]).filter(r=>(r.periods||[]).some(p=>p<ym));
 const valid=new Set((c.plan||[]).filter(p=>p.analytic).map(p=>String(p.code)));
 const banks=new Set((c.accounts||[]).map(a=>String(a.chartCode)).filter(x=>valid.has(x)));
 const byId=new Map((c.accounts||[]).map(a=>[a.id,String(a.chartCode)]));
 const norm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 const clean=t=>norm(String(t||'').replace(/^\s*\d+(?:\.\d+)*\s*[-–.]?\s*/,'')).replace(/^(?:CRE PIX CH|CRED PIX|DEB PIX CH|ENVIO PIX|PAG BOLETO|PAGAMENTO|COMPRA|CRED TED|ENVIO TED|DEBITO|CREDITO)\s+/,'').trim();
 const generic=new Set(['','CRE PIX CH','CRED PIX','DEB PIX CH','ENVIO PIX','PAG BOLETO','TRANSFERENCIA','PAGAMENTO','RECEBIMENTO','INSS','IR']);
 // codes: descrições com contrapartida efetivamente identificada; descriptions: apenas evidência textual.
 const codes=[[],[]],descriptions=[[],[]];
 for(const ref of refs){
  for(const e of ref.entries||[]){
   const h=clean(e.history);if(generic.has(h)||h.length<7)continue;
   const debit=String(e.debit),credit=String(e.credit),period=e.date?.slice(0,7)||'';
   if(banks.has(debit)&&valid.has(credit)&&!banks.has(credit))codes[1].push({h,cp:credit,period});
   if(banks.has(credit)&&valid.has(debit)&&!banks.has(debit))codes[0].push({h,cp:debit,period});
  }
  for(const e of ref.partialEntries||[]){
   const h=clean(e.history);if(generic.has(h)||h.length<7)continue;
   // D e C correspondem às colunas do Razão (não ao valor assinado do extrato).
   const side=e.side==='D'?1:e.side==='C'?0:-1;
   if(side>=0)descriptions[side].push({h,period:e.date?.slice(0,7)||'',file:ref.file||''});
  }
 }
 const transfer=Core.transferSuggestions(c,ym);
 const protectedIds=new Set([...(c.transfers||[]).filter(t=>t.status==='CONFIRMADA').flatMap(t=>[t.outId,t.inId]),...transfer.proposals.flatMap(t=>[t.outId,t.inId]),...transfer.ambiguous.flatMap(t=>[t.outId,...t.possibleInIds])]);
 let applied=0,ambiguous=0,notFound=0,descriptionMatches=0;
 for(const m of Core.periodMovements(c,ym)){
  if(m.status==='CONFIRMADO'||m.status==='PENDENTE_DUPLICIDADE'||protectedIds.has(m.id))continue;
  const bank=byId.get(m.accountId),category=['SUGERIDA','CATEGORIA_COMPARTILHADA'].includes(m.financialMatch)?clean(m.financialCategory||m.financialDescription):'',raw=clean(m.history);
  if(!valid.has(bank)){notFound++;continue;}
  const side=m.cents>0?1:0;
  const match=(data)=>data.filter(x=>x.h===category||x.h===raw);
  const eligible=match(codes[side]);
  const partial=match(descriptions[side]);
  if(partial.length){
   m.historicalDescriptionMatch='Razão anterior: '+partial.length+' descrição(ões) correspondente(s), sem contrapartida informada — conferir código no plano de contas';
   descriptionMatches++;
  }else delete m.historicalDescriptionMatch;
  if(!eligible.length){notFound++;continue;}
  const distinct=[...new Set(eligible.map(x=>x.cp))];
  if(distinct.length!==1){ambiguous++;m.historicalCodeConflict=distinct;continue;}
  const code=distinct[0];
  if(!valid.has(code)||banks.has(code)||code===bank){notFound++;continue;}
  if(m.suggested&&String(m.suggested)!==code){
   ambiguous++;m.historicalCodeConflict=[String(m.suggested),code];continue;
  }
  m.suggested=code;
  m.confidence='Razão histórico: descrição exata e código do plano de contas — exige confirmação';
  delete m.historicalCodeConflict;
  applied++;
 }
 return {applied,ambiguous,notFound,descriptionMatches};
}
function suggestFromLedger(c,ym){
 const analysis=Core.ledgerSuggestions(c,ym);let applied=0,conflicts=0;
 if(!analysis.hasLedger)return {applied,conflicts,ambiguous:0};
 const lookup=new Map(c.movements.map(m=>[m.id,m]));
 for(const item of analysis.suggestions){const m=lookup.get(item.movementId);if(!m||m.status==='CONFIRMADO'||m.status==='PENDENTE_DUPLICIDADE')continue;
  if(m.suggested&&m.suggested!==item.counterpart){m.suggestionConflict=true;conflicts++;continue;}
  m.suggested=item.counterpart;m.confidence='Razão: data, valor, conta bancária e sentido';m.suggestionConflict=false;applied++;
 }
 return {applied,conflicts,ambiguous:analysis.ambiguous};
}
function binds(){
 bindCloud();
 $('#companySearch').oninput=()=>renderSelection();
 $('#restartWorkspace').onclick=()=>{const dlg=$('#restartDialog');if(!dlg.open)dlg.showModal();};
 $('#restartDialog').addEventListener('close',()=>{
  if($('#restartDialog').returnValue!=='confirm')return;
  const choice=$('input[name="restartChoice"]:checked')?.value;
  if(choice==='selection'){
   companyId='';selectedMovementStatement='';movementFilterScope='';
   $('#companySearch').value='';renderSelection();showPage('empresas');
   say('Área reiniciada. Selecione uma empresa cadastrada ou importe um novo plano de contas.');
  }else if(choice==='period'||choice==='company'){
   if(!current()){say('Selecione uma empresa primeiro.',true);return;}
   $('#resetScope').value=choice;$('#resetAll').click();
  }
 });

 $('#movementStatementFilter').onchange=e=>{selectedMovementStatement=e.target.value;renderMovements();};document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showPage(b.dataset.go));
 document.addEventListener('click',e=>{const b=e.target.closest('[data-use-period]');if(!b)return;period=b.dataset.usePeriod;$('#period').value=period;render()});
 document.addEventListener('click',e=>{const b=e.target.closest('#stepBanner [data-go],#workflowGuide [data-go]');if(b)showPage(b.dataset.go)});
 $('#period').onchange=()=>{period=$('#period').value;taxReset();render()};$('#companySelect').onchange=()=>{companyId=$('#companySelect').value;taxReset();render()};

 $('#importPlan').onsubmit=e=>{e.preventDefault();action(async()=>{const f=e.currentTarget,file=f.elements.file.files[0];if(!file)throw Error('Selecione o plano de contas');const ext=fileExt(file.name);if(!['pdf','csv','txt'].includes(ext))throw Error('Plano: selecione PDF, CSV ou TXT do Domínio.');const bytes=await file.arrayBuffer(),sha=await hash(bytes);const pdf=ext==='pdf'?await Pdf.extractPdf(file):null;const parts=ext==='pdf'?null:planSource((await asText(file)).txt);const parsed=ext==='pdf'?Pdf.parsePlanPdf(pdf,file.name):Core.parsePlan(Core.parseCsv(parts.table));if(!parsed.accounts.length||!parsed.accounts.some(p=>p.analytic))throw Error('Plano inválido: falta Código, Descrição ou contas marcadas como Analítica=Sim.');const info=ext==='pdf'?parsed.identity:Pdf.identity(parts.metadata,file.name);const old=current();let c=info.cnpj?state.companies.find(x=>x.cnpj===info.cnpj):null;
if(!c&&old&&old.identitySha===sha)c=old;if(!c&&old&&info.name&&Core.norm(old.name)===Core.norm(info.name))c=old;
if(c&&c.plan.length&&!confirm('Atualizar o plano desta empresa preservando o anterior no histórico?'))return;
if(!c){c={id:Core.id(),name:info.name||'Plano: '+file.name.replace(/\.(csv|txt|pdf)$/i,'').replace(/[_-]/g,' ').slice(0,70),cnpj:info.cnpj||'',dominio:info.dominio||'',identityVerified:!!info.cnpj,identitySha:sha,plan:[],plansHistory:[],accounts:[],rules:[],partners:[],relatedCompanies:[],taxRules:[],taxSplits:[],movements:[],imports:[],ledger:[],transfers:[]};state.companies.push(c)}
c.name=info.name||c.name;c.cnpj=info.cnpj||c.cnpj;c.dominio=info.dominio||c.dominio;c.identitySha=sha;c.identityVerified=!!c.cnpj;c.plansHistory.push({at:new Date().toISOString(),name:file.name,hash:sha,accounts:c.plan});c.plan=parsed.accounts;companyId=c.id;await afterImport('PLANO',c,file,parsed,sha);await store('PLANO_IMPORTADO',file.name+' • '+c.plan.length+' contas');renderSelection();f.reset();showPage('importar');say('Plano importado: '+c.plan.length+' contas. Importe agora os extratos bancários.')})};
 // Cadastro manual e edição segura de contas do plano, separado por empresa.
 const clearPlanEditor=()=>{const form=$('#manualPlanForm');form.reset();form.dataset.original='';$('#manualPlanCode').readOnly=false;$('#manualPlanSave').textContent='Salvar conta';};
 $('#manualPlanCancel').onclick=()=>{clearPlanEditor();$('#manualPlanStatus').textContent='Edição cancelada. Você pode incluir um novo código.';};
 $('#manualPlanForm').onsubmit=e=>{e.preventDefault();action(async()=>{
   const c=getCompany(),form=e.currentTarget,values=asData(form);
   const code=String(values.code||'').trim(),description=String(values.description||'').trim(),classification=String(values.classification||'').trim(),analytic=values.analytic==='A',original=String(form.dataset.original||'');
   if(!code||!description)throw Error('Preencha código e descrição.');
   if(code.length>80||description.length>250)throw Error('Código ou descrição muito longo.');
   if(original&&original!==code)throw Error('Para proteger lançamentos antigos, não é permitido alterar o número de uma conta existente. Cadastre o novo código separadamente.');
   const found=c.plan.find(p=>String(p.code)===code);
   if(found&&!original)throw Error('Este código já existe. Clique em Editar na tabela para atualizar a descrição ou o tipo.');
   if(original&&!found)throw Error('A conta em edição não foi encontrada no plano.');
   const inUse=c.accounts.some(x=>String(x.chartCode)===code)||c.rules.some(x=>String(x.counterpart)===code)||(c.partners||[]).some(x=>String(x.code)===code)||(c.relatedCompanies||[]).some(x=>String(x.code)===code)||c.movements.some(x=>String(x.counterpart)===code||String(x.suggested)===code)||(c.learnedCodes||[]).some(x=>Object.hasOwn(x.codes||{},code));
   if(found&&!analytic&&inUse)throw Error('Este código está em uso em bancos, classificações ou aprendizados. Mantenha como analítico.');
   if(found){found.description=description;found.classification=classification;found.analytic=analytic;found.rawAnalytic=analytic?'A':'S';}
   else c.plan.push({code,description,classification,analytic,rawAnalytic:analytic?'A':'S',manual:true});
   clearPlanEditor();
   await store(found?'PLANO_CONTA_EDITADA':'PLANO_CONTA_CRIADA',code+' — '+description);
   $('#manualPlanStatus').textContent=(found?'Conta atualizada: ':'Nova conta adicionada: ')+code+' — '+description+'. Disponível para classificação se for analítica.';
   say(found?'Conta atualizada no plano.':'Novo código disponível nas classificações.');
 })};
 document.addEventListener('click',e=>{
   const btn=e.target.closest('button[data-edit-plan]');
   if(!btn)return;
   const c=current(),p=c?.plan.find(x=>String(x.code)===btn.dataset.editPlan);
   if(!p)return;
   const form=$('#manualPlanForm');form.dataset.original=String(p.code);
   $('#manualPlanCode').value=p.code;$('#manualPlanCode').readOnly=true;
   $('#manualPlanDescription').value=p.description||'';
   $('#manualPlanClassification').value=p.classification||'';
   $('#manualPlanAnalytic').value=p.analytic?'A':'S';
   $('#manualPlanSave').textContent='Salvar alterações';
   $('#manualPlanStatus').textContent='Editando conta '+p.code+'. O número do código será preservado.';
   form.scrollIntoView({behavior:'smooth',block:'center'});
 });
 $('#bankForm').onsubmit=e=>{e.preventDefault();action(async()=>{const c=getCompany(),f=e.currentTarget,v=asData(f);if(!c.plan.some(a=>a.code===v.chartCode&&a.analytic))throw Error('O código do banco deve existir como conta analítica neste plano.');if(c.accounts.some(a=>a.bank===v.bank&&a.label===v.label.trim()))throw Error('Esta conta já foi vinculada');c.accounts.push({id:Core.id(),bank:v.bank,label:v.label.trim(),chartCode:v.chartCode});await store('BANCO_VINCULADO',`${v.bank}, ${v.label}, código ${v.chartCode}`);f.reset();say('Banco vinculado. Importar extratos foi liberado.')})};
 // Corrige vínculos de contas já importadas SEM reimportar extratos, mexer em valores ou IDs.
 document.addEventListener('click',e=>{const btn=e.target.closest('button[data-save-bank-link]');if(!btn)return;
  action(async()=>{
   const c=getCompany(),acc=c.accounts.find(a=>a.id===btn.dataset.saveBankLink);
   if(!acc)throw Error('Conta bancária não encontrada.');
   const chosen=document.querySelector('select[data-bank-link="'+CSS.escape(acc.id)+'"]')?.value||'';
   const record=c.plan.find(p=>p.analytic&&String(p.code)===String(chosen));
   if(!record)throw Error('Selecione um código analítico válido do plano de contas.');
   const affected=c.movements.filter(m=>m.accountId===acc.id).length;
   const other=c.accounts.find(a=>a.id!==acc.id&&String(a.chartCode)===String(chosen));
   if(other&&!confirm('O código '+chosen+' já está vinculado à conta '+other.bank+' ('+other.label+'). Confirma que se trata da mesma conta contábil?'))return;
   if(!confirm('Vincular '+acc.bank+' ('+acc.label+') ao código '+chosen+' — '+record.description+'? '+affected+' movimentação(ões) existentes usarão esse código bancário nas colunas corretas. Nenhuma contrapartida será confirmada automaticamente.'))return;
   acc.chartCode=String(chosen);
   await store('BANCO_CODIGO_VINCULADO',acc.bank+' • '+acc.label+' → '+chosen+'; '+affected+' movimentos preservados');
   say('Código do banco atualizado para '+chosen+'. Reabra o relatório PDF para conferir.');
  });
 });
 $('#relatedCompanyForm').onsubmit=e=>{e.preventDefault();action(async()=>{
   const c=getCompany(),form=e.currentTarget,values=asData(form);
   const name=String(values.name||'').trim().replace(/\s+/g,' '),code=String(values.code||'').trim(),checker=window.ConciliaPartners;
   if(!checker?.words)throw Error('Reconhecimento de nomes indisponível. Atualize a página.');
   if(name.length<7||name.split(/\s+/).length<2)throw Error('Informe o nome da empresa conforme aparece no extrato, com pelo menos duas palavras.');
   if(!c.plan.some(p=>p.analytic&&String(p.code)===code))throw Error('Selecione um código analítico válido no plano desta empresa.');
   if(c.accounts.some(a=>String(a.chartCode)===code))throw Error('A contrapartida não pode ser o próprio código bancário.');
   c.relatedCompanies=c.relatedCompanies||[];
   const normalized=checker.words(name);
   if(c.relatedCompanies.some(p=>checker.words(p.name)===normalized)||(c.partners||[]).some(p=>checker.words(p.name)===normalized))throw Error('Este nome já está cadastrado como sócio ou empresa relacionada desta empresa.');
   c.relatedCompanies.push({id:Core.id(),name,code});
   let total=0;
   for(const m of c.movements||[])if(checker.suggest(c,m))total++;
   await store('EMPRESA_RELACIONADA_CADASTRADA',name+' → '+code+'; '+total+' sugestões de extrato');
   form.reset();
   say('Empresa relacionada cadastrada. '+total+' movimentação(ões) receberam sugestão para conferência.');
 })};
 document.addEventListener('click',e=>{const button=e.target.closest('button[data-delete-related-company]');if(!button)return;action(async()=>{
   const c=getCompany(),item=(c.relatedCompanies||[]).find(x=>x.id===button.dataset.deleteRelatedCompany);
   if(!item)return;
   if(!confirm('Excluir '+item.name+' das empresas relacionadas? Os lançamentos confirmados não serão alterados.'))return;
   c.relatedCompanies=c.relatedCompanies.filter(x=>x.id!==item.id);
   for(const m of c.movements||[]){
    if(m.status==='CONFIRMADO'||m.relatedCompanyName!==item.name)continue;
    if(String(m.suggested)===String(item.code)&&String(m.confidence||'').startsWith('Empresa relacionada cadastrada:')){delete m.suggested;delete m.confidence;}
    delete m.relatedCompanyName;
   }
   await store('EMPRESA_RELACIONADA_EXCLUIDA',item.name+' ('+item.code+')');
   say('Empresa relacionada excluída.');
 })});
 $('#partnerForm').onsubmit=e=>{e.preventDefault();action(async()=>{
   const c=getCompany(),form=e.currentTarget,values=asData(form),name=String(values.name||'').trim().replace(/\s+/g,' '),code=String(values.code||'').trim();
   if(!window.ConciliaPartners?.words)throw Error('Leitor de sócios indisponível. Atualize a página.');
   if(name.length<7||name.split(/\s+/).length<2)throw Error('Informe o nome completo do sócio, com pelo menos nome e sobrenome.');
   if(!c.plan.some(p=>p.analytic&&String(p.code)===code))throw Error('Selecione um código analítico válido do plano desta empresa.');
   if(c.accounts.some(a=>String(a.chartCode)===code))throw Error('O código do sócio não pode ser a própria conta do banco.');
   c.partners=c.partners||[];
   const normalized=window.ConciliaPartners.words(name);
   if(c.partners.some(p=>window.ConciliaPartners.words(p.name)===normalized))throw Error('Este sócio já está cadastrado para a empresa.');
   c.partners.push({id:Core.id(),name,code});
   let count=0;
   for(const m of c.movements||[]){if(window.ConciliaPartners.suggest(c,m))count++;}
   await store('SOCIO_CADASTRADO',name+' → '+code+'; '+count+' sugestões em extratos existentes');
   form.reset();
   say('Sócio cadastrado. '+count+' movimentação(ões) receberam sugestão para conferência.');
 })};
 document.addEventListener('click',e=>{const button=e.target.closest('button[data-delete-partner]');if(!button)return;action(async()=>{
   const c=getCompany(),p=(c.partners||[]).find(x=>x.id===button.dataset.deletePartner);
   if(!p)return;
   if(!confirm('Excluir o sócio '+p.name+' do cadastro desta empresa? As classificações já confirmadas permanecerão.'))return;
   c.partners=c.partners.filter(x=>x.id!==p.id);
   for(const m of c.movements||[]){if(m.status==='CONFIRMADO'||m.partnerName!==p.name)continue;if(String(m.suggested)===String(p.code)&&String(m.confidence||'').startsWith('Sócio cadastrado:')){delete m.suggested;delete m.confidence;}delete m.partnerName;}
   await store('SOCIO_EXCLUIDO',p.name+' ('+p.code+')');
   say('Sócio excluído do cadastro da empresa.');
 })});
 $('#ruleForm').onsubmit=e=>{e.preventDefault();action(async()=>{const c=getCompany(),v=asData(e.currentTarget);if(!c.plan.some(a=>a.code===v.counterpart&&a.analytic))throw Error('Contrapartida deve existir no plano analítico da empresa.');if(c.rules.some(r=>Core.norm(r.term)===Core.norm(v.term)))throw Error('Regra já cadastrada.');c.rules.push({id:Core.id(),term:v.term.trim(),counterpart:v.counterpart});await store('REGRA_CRIADA',`${v.term} → ${v.counterpart}`);e.currentTarget.reset();say('Regra salva. Ela sugerirá classificações para confirmação humana.')})};

 $('#importFinancial').onsubmit=e=>{e.preventDefault();action(async()=>{
  const c=getCompany(),file=e.currentTarget.elements.file.files[0];
  if(!file)throw Error('Selecione um documento financeiro do cliente.');
  const ext=fileExt(file.name),bytes=await file.arrayBuffer(),sha=await hash(bytes);
  const existing=(c.financialControls||[]).find(x=>x.sha===sha&&x.period===period);
  let allRows,format='EXCEL',docCnpj='';
  if(ext==='pdf'){
    if(!window.ConciliaFinancialPDF)throw Error('Leitor financeiro PDF indisponível. Atualize a página.');
    const pdf=await Pdf.extractPdf(file);
    const result=window.ConciliaFinancialPDF.parse(pdf.text,Core);
    allRows=result.rows;format=result.format;docCnpj=result.cnpj;
  }else if(['xlsx','xls'].includes(ext)){
    if(!window.XLSX)throw Error('Biblioteca Excel não carregou. Atualize a página.');
    allRows=financialRows(window.XLSX.read(bytes,{type:'array',cellDates:false}));
  }else throw Error('Formato de controle financeiro não suportado. Use PDF, XLSX ou XLS.');
  if(c.cnpj&&docCnpj&&c.cnpj!==docCnpj)throw Error('O CNPJ do documento financeiro não corresponde ao cliente selecionado.');
  const rows=allRows.filter(x=>x.date.startsWith(period));
  if(!rows.length)throw Error('Documento lido, mas nenhum dos '+allRows.length+' pagamentos pertence à competência '+period+'. Confira a DATA DO PAGAMENTO, não a data de emissão ou vencimento.');
  c.financialControls=c.financialControls||[];
  if(existing){existing.rows=rows;existing.at=new Date().toISOString();existing.name=file.name;existing.format=format;}
  else c.financialControls.push({id:Core.id(),sha,period,name:file.name,format,rows,at:new Date().toISOString()});
  const result=financialMatches(c,period);
  await store('CONTROLE_FINANCEIRO_IMPORTADO',file.name+': '+rows.length+' linhas, '+result.matched+' correspondências únicas, '+result.ambiguous+' ambíguas');
  $('#financialStatus').textContent=(existing?'Controle reprocessado ':'Controle importado ')+file.name+': '+rows.length+' lançamentos de '+period+'; '+result.matched+' descrições sugeridas, '+result.coded+' novos códigos sugeridos e '+result.ambiguous+' correspondências ambíguas. Confira as contrapartidas antes de contabilizar.';
  say('Controle financeiro importado. Confira as descrições sugeridas em Movimentações.');
 })};
 $('#matchFinancial').onclick=()=>action(async()=>{const c=getCompany();if(!(c.financialControls||[]).some(x=>x.period===period))throw Error('Nenhum controle financeiro importado para '+period+'. Primeiro clique em Importar controle financeiro; escolher o arquivo não realiza a importação.');const result=financialMatches(c,period);await store('CRUZAMENTO_FINANCEIRO',result.matched+' correspondências sugeridas; '+result.coded+' novos códigos; '+result.ambiguous+' ambíguas');$('#financialStatus').textContent='Descrições: '+result.matched+'; novos códigos sugeridos: '+result.coded+'; ambíguas: '+result.ambiguous+'. Confira as movimentações.';say('Cruzamento atualizado.')});

/* Leitura de extratos Excel com identificação de cabeçalho por aba e revisão de linhas ambíguas. */
function inspectStatementWorkbook(fileBytes){
 if(!window.XLSX?.read)return null;
 const book=window.XLSX.read(fileBytes,{type:'array',cellDates:false});
 for(const name of book.SheetNames){
  const sheet=book.Sheets[name];
  const cell=(a)=>String(sheet[a]?.v??'').trim();
  const labels=['A2','A3','A4','A5','A7','A8'].map(cell);
  const isItau=/atualiza[cç][aã]o/i.test(labels[0])&&/nome/i.test(labels[1])&&/ag[eê]ncia/i.test(labels[2])&&/^conta/i.test(labels[3])&&/lan[cç]amentos/i.test(labels[4]);
  if(isItau){
   const header=[...Array.from({length:12},(_,i)=>[cell('A'+(i+1)),cell('B'+(i+1))].join(' ')),...['C2','C3','C4','C5','D2','D3','D4','D5'].map(cell)].join(' ');
   const extracted=(header.match(/(?:CNPJ|C\.N\.P\.J\.)\s*[:\-]?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})/i)||[])[1]||'';
   return {bank:'Itaú',owner:cell('B3'),agency:cell('B4'),account:cell('B5'),periodLabel:cell('B8'),cnpj:extracted.replace(/\D/g,'')};
  }
 }
 return null;
}
function parseStatementWorkbook(fileBytes, origin, accountId){
 if(!window.XLSX)throw Error('Leitor Excel indisponível. Atualize a página e tente novamente.');
 const book=window.XLSX.read(fileBytes,{type:'array',cellDates:false});
 const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const match=(headers,aliases)=>headers.findIndex(h=>aliases.includes(h));
 const isBlank=x=>x==null||String(x).trim()==='';
 const money=x=>Core.money(String(x).replace(/\s*[CD]\s*$/i,''));
 const convertedDate=x=>{
   if(typeof x==='number'&&x>1&&x<100000){
     const v=window.XLSX.SSF.parse_date_code(x);
     if(!v)throw Error('Data Excel inválida: '+x);
     return Core.date(String(v.y).padStart(4,'0')+'-'+String(v.m).padStart(2,'0')+'-'+String(v.d).padStart(2,'0'));
   }
   if(x instanceof Date)return Core.date(x);
   let s=String(x??'').trim();
   if(/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(s))s=s.replace(/(\d{2})$/,'20$1');
   if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)){const p=s.split('/');s=p[0].padStart(2,'0')+'/'+p[1].padStart(2,'0')+'/'+p[2];}
   return Core.date(s);
 };
 const movements=[],reviews=[];let detectedSheets=0;
 for(const sheetName of book.SheetNames){
   // Alguns extratos do Itaú contêm !ref=A1:F13, apesar de haver dados reais
   // até a linha 151. SheetJS ignora tudo depois de !ref se não corrigirmos.
   const sheet=book.Sheets[sheetName];
   const previousRange=sheet['!ref']||'';
   const occupied=Object.keys(sheet).filter(k=>/^[A-Z]{1,3}[1-9]\d*$/.test(k)&&sheet[k]?.v!==undefined&&sheet[k]?.v!=='');
   if(occupied.length){
     const coordinates=occupied.map(k=>window.XLSX.utils.decode_cell(k));
     const minR=Math.min(...coordinates.map(x=>x.r)),maxR=Math.max(...coordinates.map(x=>x.r));
     const minC=Math.min(...coordinates.map(x=>x.c)),maxC=Math.max(...coordinates.map(x=>x.c));
     const corrected=window.XLSX.utils.encode_range({s:{r:minR,c:minC},e:{r:maxR,c:maxC}});
     const declared=previousRange?window.XLSX.utils.decode_range(previousRange):null;
     if(!declared||maxR>declared.e.r||maxC>declared.e.c||minR<declared.s.r||minC<declared.s.c){
       sheet['!ref']=corrected;
       reviews.push({origin,line:sheetName,content:'Faixa declarada: '+(previousRange||'ausente')+'; faixa real: '+corrected,reason:'Faixa do Excel corrigida em memória para não omitir lançamentos; arquivo original preservado'});
     }
   }
   const rows=window.XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:''});
   let head=-1,cols=null;
   for(let i=0;i<Math.min(rows.length,45);i++){
     const hh=(rows[i]||[]).map(norm);
     const date=match(hh,['data','datamov','datamovimento','datalancamento','datatransacao','datadaoperacao','dtmovimento']);
     const hist=match(hh,['historico','descricao','lancamento','lancamentos','detalhe','detalhes','memo','transacao','movimentacao']);
     const value=match(hh,['valor','valorr','valorlancamento','valortransacao','amount','valoroperacao']);
     const entry=match(hh,['entrada','entradas','entradar','entradasr','credito','creditos','creditor','creditosr','valorcredito','valorcreditor','recebimentos']);
     const out=match(hh,['saida','saidas','saidar','saidasr','debito','debitos','debitor','debitosr','valordebito','valordebitor','pagamentos']);
     if(date>=0&&hist>=0&&(value>=0||entry>=0||out>=0)){
       head=i;cols={date,hist,value,entry,out,kind:match(hh,['tipo','natureza','dc','debitocredito','operacao']),doc:match(hh,['documento','nrdoc','numerodocumento','doc'])};break;
     }
   }
   if(head<0){if(rows.some(r=>r.some(x=>!isBlank(x))))reviews.push({origin,line:sheetName,content:'Cabeçalho não identificado',reason:'Aba Excel não possui colunas reconhecidas de data, histórico e valores'});continue;}
   detectedSheets++;
   for(let i=head+1;i<rows.length;i++){
     const row=rows[i]||[],get=k=>cols[k]<0?'':row[cols[k]],rawHist=String(get('hist')??'').trim();
     if(row.every(isBlank))continue;
     if(/^(saldo(?:\s+do\s+dia|\s+dia|\s+anterior|\s+final)?|total|subtotal|resumo)\b/i.test(rawHist))continue;
     if(isBlank(get('date'))&&isBlank(get('value'))&&isBlank(get('entry'))&&isBlank(get('out')))continue;
     try{
       const date=convertedDate(get('date'));
       if(!rawHist)throw Error('Histórico vazio');
       const en=get('entry'),out=get('out'),v=get('value');
       let cents;
       if(!isBlank(en)||!isBlank(out)){
         const e=isBlank(en)?0:Math.abs(money(en));
         const o=isBlank(out)?0:Math.abs(money(out));
         if(e&&o)throw Error('Entrada e saída preenchidas na mesma linha');
         cents=e-o;
       }else{
         if(isBlank(v))throw Error('Valor vazio');
         cents=money(v);
         const dir=norm(get('kind')), suffix=String(v).trim().match(/([CD])$/i);
         if(dir==='d'||dir==='debito'||dir==='saida'||suffix?.[1]?.toUpperCase()==='D')cents=-Math.abs(cents);
         if(dir==='c'||dir==='credito'||dir==='entrada'||suffix?.[1]?.toUpperCase()==='C')cents=Math.abs(cents);
       }
       if(!cents)throw Error('Valor zero');
       movements.push({id:Core.id(),date,cents,history:rawHist,document:String(get('doc')??'').trim(),party:'',accountId,origin,line:sheetName+'!'+(i+1),status:'PENDENTE',counterpart:''});
     }catch(err){reviews.push({origin,line:sheetName+'!'+(i+1),content:row.map(x=>String(x??'')).join(' | ').slice(0,550),reason:err.message});}
   }
 }
 if(!detectedSheets)throw Error('Não foi encontrada aba com cabeçalho Data, Histórico e Valor (ou Entrada/Saída).');
 return {movements,reviews,format:'EXCEL',sheetRangeCorrected:reviews.some(r=>/Faixa do Excel corrigida/.test(r.reason||''))};
}

 $('#importStatement').onsubmit=e=>{e.preventDefault();action(async()=>{try{setStatementStatus('working','Lendo o extrato. Aguarde a confirmação da quantidade de movimentações.');const c=getCompany(),f=e.currentTarget;if(!canImport(c))throw Error('Importe primeiro o plano de contas.');const files=Array.from(f.elements.file.files);if(!files.length)throw Error('Selecione pelo menos um extrato.');if(files.length>20)throw Error('Importe até 20 extratos por lote para evitar lentidão no celular.');const selectedAccount=f.elements.accountId.value;const batchResults=[];for(const file of files){try{setStatementStatus('working',`Processando ${batchResults.length+1} de ${files.length}: ${file.name}...`);const ext=fileExt(file.name);if(!['pdf','csv','txt','ofx','xlsx','xls'].includes(ext))throw Error('Use PDF digital, Excel XLSX/XLS, CSV, TXT ou OFX.');const bytes=await file.arrayBuffer(),sha=await hash(bytes);const previous=c.imports.find(x=>x.type==='EXTRATO'&&x.sha===sha);if(previous){
 if(ext==='xlsx'||ext==='xls'){
  const verified=parseStatementWorkbook(bytes,file.name,previous.accountId);
  if(verified.movements.length>(previous.movementCount||0)){
   throw Error('IMPORTAÇÃO ANTERIOR INCOMPLETA: o arquivo possui '+verified.movements.length+' lançamentos, mas a importação já salva tem somente '+(previous.movementCount||0)+'. Na lista Rascunho desta conciliação, clique em Refazer neste arquivo e importe novamente. Os dados não foram apagados automaticamente.');
  }
 }
 batchResults.push({ok:false,skipped:true,name:file.name,periods:previous.periods||[],count:previous.movementCount||0});continue;
}
let txt='',pdf=null;if(ext==='pdf'){say('Extraindo movimentações do PDF digital...');try{pdf=await Pdf.extractPdf(file);txt=pdf.text}catch(err){throw Error('PDF não interpretado: '+err.message+'; tente CSV ou OFX.')}}else if(ext!=='xlsx'&&ext!=='xls')txt=(await asText(file)).txt;
const workbookIdentity=(ext==='xlsx'||ext==='xls')?inspectStatementWorkbook(bytes):null;
const bank=ext==='pdf'?(window.ConciliaLayouts.bankOf(pdf,file.name)||Pdf.detectBank(txt,file.name)):(ext==='xlsx'||ext==='xls')?(workbookIdentity?.bank||({'caixa':'Caixa Econômica Federal','stone':'Stone','sicredi':'Sicredi','itau':'Itaú','santander':'Santander','nubank':'Nubank','pagbank':'PagBank','inter':'Banco Inter','brasil':'Banco do Brasil'}[financialBank(file.name)]||Pdf.detectBank('',file.name))):Pdf.detectBank(txt,file.name);
if(ext==='pdf'&&bank==='Bradesco'&&window.ConciliaBradescoRaw){
 try{
  const raw=await window.ConciliaBradescoRaw.recover(new Uint8Array(bytes));
  pdf={...pdf,...raw};
 }catch(rawError){
  // Se for o modelo Type3 comprovado, exibir a causa da falha; não aceitar lançamentos inventados.
  if(!/EXTRATO MENSAL|LANÇAMENTO|LANCAMENTO/i.test(pdf.text||''))throw Error('Bradesco Type3: '+rawError.message);
 }
}
// A empresa selecionada e seu plano definem o destino da importação.
// Identificadores de PDFs podem faltar: nesses casos, registrar alerta, não bloquear a leitura.
let identityWarning='';
if(ext==='pdf'){
 const header=Pdf.identity(pdf.lines.slice(0,18).map(x=>x.content).join('\n'));
 header.cnpj=header.cnpj||window.ConciliaLayouts.documentCnpj(pdf);
 if(c.cnpj&&header.cnpj&&c.cnpj!==header.cnpj)
   throw Error('O PDF contém CNPJ diferente do cliente selecionado. Selecione a empresa correta.');
 if(!header.cnpj)identityWarning='PDF sem CNPJ identificável. Confira titular e conta bancária da empresa selecionada.';
}
// Planilha bancária pode ter titular de outra pessoa jurídica mesmo com
// agência/conta semelhantes. Exigir confirmação explícita, nunca trocar cliente.
if(workbookIdentity){
 // Primeiro a identidade verificável: se houver CNPJ divergente, não permitir
 // que nome anterior ou confirmação manual contornem esse conflito.
 const documentCnpj=String(workbookIdentity.cnpj||'').replace(/\D/g,'');
 const companyCnpj=String(c.cnpj||'').replace(/\D/g,'');
 if(documentCnpj&&companyCnpj&&documentCnpj!==companyCnpj)
  throw Error('CNPJ DIVERGENTE: o extrato informa '+documentCnpj+', mas o cadastro selecionado possui '+companyCnpj+'. Selecione a empresa correta. A confirmação de nome anterior não autoriza importar CNPJ diferente.');
 if(documentCnpj&&!companyCnpj)
  throw Error('Extrato com CNPJ '+documentCnpj+', mas a empresa selecionada não possui CNPJ validado. Atualize a identificação antes de importar.');
 const owner=String(workbookIdentity.owner||'').trim().replace(/\s+/g,' ');
 if(owner&&c.name&&Core.norm(owner)!==Core.norm(c.name)){
  const digits=String(workbookIdentity.account||'').replace(/\D/g,'').replace(/^0+/,'');
  const sameAccount=value=>{
   const d=bankAccountDigits(value).replace(/^0+/,'');
   return d.length>=5&&digits.length>=5&&(d===digits||d.endsWith(digits)||digits.endsWith(d));
  };
  const bankAccountMatch=(c.accounts||[]).some(a=>{
   const plan=c.plan.find(p=>p.analytic&&String(p.code)===String(a.chartCode));
   return Core.norm(a.bank)===Core.norm(bank)&&sameAccount(String(a.label||'')+' '+String(plan?.description||''));
  })||bankPlanCandidates(c,bank).some(p=>sameAccount(p.description));
  const aliases=c.previousNames||[];
  const knownAlias=aliases.some(a=>Core.norm(a.name)===Core.norm(owner)&&Core.norm(a.bank)===Core.norm(bank)&&String(a.account||'').replace(/\D/g,'').replace(/^0+/,'')===digits);
  // Nome diferente e CNPJ comprovadamente igual: deixar passar e registrar
  // observação. Sem CNPJ, vincular por conta bancária E confirmação do usuário.
  if(documentCnpj&&documentCnpj===companyCnpj){
   identityWarning=[identityWarning,'Razão social no extrato: '+owner+'; CNPJ confere com a empresa.'].filter(Boolean).join(' ');
  }else{
   if(!bankAccountMatch)throw Error('NOME DO TITULAR DIFERENTE E CNPJ AUSENTE: o extrato informa '+owner+', mas a empresa selecionada é '+c.name+'. A conta Itaú '+workbookIdentity.account+' não foi localizada de forma inequívoca no plano. Confira a titularidade antes de importar.');
   if(!knownAlias){
    const message='CONFIRMAR RAZÃO SOCIAL ANTERIOR\n\nEmpresa selecionada: '+c.name+
      '\nNome que consta no extrato: '+owner+
      '\nCNPJ: não aparece neste arquivo Excel'+
      '\nBanco: '+bank+' | Agência: '+workbookIdentity.agency+' | Conta: '+workbookIdentity.account+
      '\n\nA conta foi encontrada no plano de contas desta empresa, mas só você pode confirmar que houve mudança de razão social e que o extrato pertence ao mesmo CNPJ.\n\nConfirma que este é um nome anterior da MESMA pessoa jurídica?';
    if(!confirm(message))throw Error('Importação cancelada: razão social anterior não confirmada.');
    c.previousNames=c.previousNames||[];
    c.previousNames.push({name:owner,bank,account:workbookIdentity.account,confirmedAt:new Date().toISOString(),method:'CONFIRMACAO_OPERADOR_SEM_CNPJ_NO_EXTRATO'});
   }
   identityWarning=[identityWarning,'Nome anterior '+owner+(knownAlias?' já confirmado anteriormente':' confirmado pelo operador')+'; CNPJ não informado no extrato.'].filter(Boolean).join(' ');
  }
 }
}
// Resolver vínculos de extratos antigos ANTES de escolher destino da importação.
autoLinkBankCodes(c);
let newAccount=false;
let account=c.accounts.find(a=>a.id===selectedAccount);
if(account&&bank&&Core.norm(account.bank)!==Core.norm(bank))
 throw Error('Banco selecionado difere do encontrado no extrato.');
if(!account){
 const code=bankCodeFromPlan(c,bank,(pdf?.text||'').slice(0,2000)+' '+(workbookIdentity?'CONTA '+workbookIdentity.account+' AG '+workbookIdentity.agency:'')+' '+file.name);
 const possible=c.accounts.filter(x=>Core.norm(x.bank)===Core.norm(bank)&&(code?String(x.chartCode)===code:c.plan.some(p=>String(p.code)===String(x.chartCode)&&p.analytic)));
 if(possible.length===1)account=possible[0];
 // Reutilizar conta pendente antiga (sem código) quando for a única do banco.
 if(!account&&code){
  const pending=c.accounts.filter(x=>Core.norm(x.bank)===Core.norm(bank)&&!c.plan.some(p=>p.analytic&&String(p.code)===String(x.chartCode)));
  if(pending.length===1){account=pending[0];account.chartCode=code;}
 }
}
if(!account){
 const code=guessBankAccount(c,bank,(pdf?.text||'').slice(0,2000)+' '+(workbookIdentity?'CONTA '+workbookIdentity.account+' AG '+workbookIdentity.agency:'')+' '+file.name);
 if(bank&&code){account={id:Core.id(),bank,label:'Identificação automática do extrato',chartCode:code};newAccount=true;}
}
if(!account){
 // Conta não classificada: permitir leitura e revisão, sem associar código contábil falso.
 account={id:Core.id(),bank:bank||'Banco não identificado',label:'Conta pendente de identificação contábil',chartCode:''};
 newAccount=true;
 identityWarning=[identityWarning,'Conta bancária ainda sem código validado no plano. Revise antes de exportar para contabilização.'].filter(Boolean).join(' ');
}
const parsed=ext==='pdf'?window.ConciliaLayouts.parseStatement(pdf,file.name,account.id,period,Core,bank,()=>Pdf.parseStatementPdf(pdf,file.name,account.id,period,Core,bank)):(ext==='xlsx'||ext==='xls')?parseStatementWorkbook(bytes,file.name,account.id):ext==='ofx'?Core.parseOfx(txt,account.id,file.name):Core.parseStatementCsv(Core.parseCsv(txt),account.id,file.name);
if(!parsed.movements.length){await afterImport('EXTRATO',c,file,parsed,sha);await store('ARQUIVO_REVISAO',file.name+' • nenhuma movimentação reconhecida');throw Error(ext==='pdf'?(pdf?.text?.trim()?'PDF contém texto, mas o formato das movimentações não foi reconhecido. Confira Revisão e informe o modelo do banco.':'PDF sem texto selecionável: é necessário OCR para interpretar o documento digitalizado.'):'Nenhum movimento reconhecido no arquivo. Confira Revisão e o formato das colunas.')}
if(newAccount)c.accounts.push(account);
let overlaps=0;
const fingerprint=m=>m.accountId+'|'+m.date+'|'+m.cents+'|'+Core.norm(m.history);
const existingByFingerprint=new Map(),knownFitIds=new Set();
for(const m of c.movements){
 const key=fingerprint(m);
 if(!existingByFingerprint.has(key))existingByFingerprint.set(key,[]);
 existingByFingerprint.get(key).push(m);
 if(m.fitid)knownFitIds.add(JSON.stringify([m.accountId,m.fitid]));
}
for(const m of parsed.movements){
 const fitKey=m.fitid?JSON.stringify([m.accountId,m.fitid]):'';
 const sameHistory=existingByFingerprint.get(fingerprint(m))||[];
 const duplicate=(fitKey&&knownFitIds.has(fitKey))||sameHistory.some(prior=>!m.fitid||!prior.fitid);
 if(fitKey)knownFitIds.add(fitKey);
 if(duplicate){m.status='PENDENTE_DUPLICIDADE';overlaps++;}
 else autoSuggest(c,m);
}
if(identityWarning)parsed.reviews.push({origin:file.name,line:'cabeçalho',content:identityWarning,reason:'Conferir identificação bancária antes da contabilização'});
const periods=[...new Set(parsed.movements.map(x=>month(x.date)))],importId=Core.id();for(const m of parsed.movements)m.importId=importId;c.movements.push(...parsed.movements);c.imports.push({id:importId,type:'EXTRATO',name:file.name,sha,accountId:account.id,bank:account.bank,periods,movementCount:parsed.movements.length,reviewCount:parsed.reviews.length,balanceCheck:parsed.balanceCheck||null,at:new Date().toISOString(),format:parsed.format||ext.toUpperCase(),identityConfirmation:ext==='pdf'&&!Pdf.identity(pdf.lines.slice(0,18).map(x=>x.content).join('\n')).cnpj&&!window.ConciliaLayouts.documentCnpj(pdf)?'CONFIRMADA_MANUALMENTE':'DOCUMENTO_COM_CNPJ'});await afterImport('EXTRATO',c,file,parsed,sha,importId);if(periods.length===1){period=periods[0];$('#period').value=period}await store('EXTRATO_IMPORTADO',file.name+': '+parsed.movements.length+' movimentos, '+parsed.reviews.length+' revisões; saldos '+(parsed.balanceCheck?.status||'indeterminado'));batchResults.push({ok:true,name:file.name,count:parsed.movements.length,review:parsed.reviews.length,duplicate:overlaps,periods});
 }catch(fileError){console.warn('Extrato não importado',file.name,fileError);batchResults.push({ok:false,name:file.name,error:fileError.message||String(fileError)});} }

 f.reset();
 const ok=batchResults.filter(r=>r.ok),skipped=batchResults.filter(r=>r.skipped),bad=batchResults.filter(r=>!r.ok&&!r.skipped);
 const total=ok.reduce((n,r)=>n+r.count,0),pending=ok.reduce((n,r)=>n+r.review,0),duplicate=ok.reduce((n,r)=>n+r.duplicate,0);
 const allPeriods=[...new Set(batchResults.filter(r=>r.ok||r.skipped).flatMap(r=>r.periods||[]))];
 if(allPeriods.length===1){period=allPeriods[0];$('#period').value=period;}
 let totalSuggested=0,possibleTransfers=0,ambiguousTransfers=0,ledgerHits=0,financeMatched=0,financeAmbiguous=0,financeUnmatched=0;
 for(const ym of allPeriods){if((c.financialControls||[]).some(x=>x.period===ym)){const fm=financialMatches(c,ym);financeMatched+=fm.matched;financeAmbiguous+=fm.ambiguous;financeUnmatched+=fm.unmatched;}applyLearningPeriod(c,ym);ledgerHits+=suggestFromHistoricalLedger(c,ym).applied;const moves=Core.periodMovements(c,ym);totalSuggested+=moves.filter(m=>m.suggested&&!m.counterpart).length;const pairs=Core.transferSuggestions(c,ym);possibleTransfers+=pairs.proposals.length;ambiguousTransfers+=pairs.ambiguous.length;}
 if(ok.length||ledgerHits)await store('IMPORTACAO_EM_LOTE',`${ok.length} novos, ${skipped.length} já existentes, ${bad.length} falhas; ${total} novas movimentações`);else render();
 const failures=bad.map(r=>`${r.name}: ${r.error}`).join(' | ');
 const diagnostics=batchResults.map(r=>(r.ok?'IMPORTADO':r.skipped?'JÁ EXISTENTE':'FALHOU')+' — '+r.name+(r.ok?' ('+r.count+' lançamentos)':'')+(r.error?' — '+r.error:'')).join(' | ');
 const existingTotal=allPeriods.reduce((n,ym)=>n+Core.periodMovements(c,ym).length,0);
 let summary;
 if(!ok.length&&skipped.length&&!bad.length){
   summary=`ARQUIVO(S) JÁ IMPORTADO(S): ${skipped.length} arquivo(s) já cadastrado(s) para ${allPeriods.join(', ')||'a empresa'}. ${existingTotal} movimentações já armazenadas. Nenhum registro foi apagado nem duplicado. ${totalSuggested} contrapartida(s) sugerida(s) aguardam revisão. Vá para Classificações ou Conciliação e exportação.`;
 }else{
   summary=`LOTE PROCESSADO: ${ok.length} novo(s), ${skipped.length} já importado(s), ${bad.length} com falha(s). ${total} novas movimentações, ${existingTotal} no(s) período(s) analisado(s), ${pending} linha(s) em revisão e ${duplicate} possível(is) duplicidade(s). ${totalSuggested} sugestão(ões) de contrapartida existente(s) (${ledgerHits} nova(s) do Razão); ${possibleTransfers} transferência(s) candidata(s), ${ambiguousTransfers} ambígua(s). Nenhuma contrapartida incerta foi confirmada.`;
 }
 setStatementStatus(bad.length?'error':'success',(bad.length?'ERRO NO EXTRATO: '+failures+'\n\n':'')+summary+(financeMatched||financeAmbiguous||financeUnmatched?' CONTROLE FINANCEIRO: '+financeMatched+' descrições sugeridas, '+financeAmbiguous+' ambíguas e '+financeUnmatched+' sem correspondência individual.':'')+'\nDETALHES POR ARQUIVO: '+diagnostics);
 if(skipped.length&&!ok.length&&!bad.length)say(`Extrato já importado: ${existingTotal} movimentações preservadas. Abra Classificações.`);
 else if(bad.length) say(`Falha ao importar ${bad[0].name}: ${bad[0].error}`,true);
 else say(`${ok.length} novo(s), ${skipped.length} já importado(s), ${bad.length} falha(s). ${total} novas movimentações.`);
 }catch(err){setStatementStatus('error','IMPORTAÇÃO NÃO CONCLUÍDA: '+(err.message||String(err))+'. Confira o arquivo ou a empresa e tente novamente.');throw err;}})};
 let pasteClassificationDraft=null;
 const resetPastePreview=()=>{
  pasteClassificationDraft=null;
  $('#pasteConfirmButton').hidden=true;
  $('#pasteConfirmButton').disabled=true;
  $('#pasteClassificationsPreview').innerHTML='';
 };
 $('#pasteClearButton').onclick=()=>{
  $('#pasteClassificationsText').value='';
  resetPastePreview();
  $('#pasteClassificationsStatus').textContent='Área limpa. Cole novas linhas do Excel para conferir.';
 };
 $('#pasteClassificationsText').addEventListener('input',()=>{
  if(pasteClassificationDraft){
   resetPastePreview();
   $('#pasteClassificationsStatus').textContent='O texto foi alterado. Clique em Conferir códigos colados para gerar uma nova prévia.';
  }
 });
 $('#pasteClassificationsForm').onsubmit=e=>{e.preventDefault();action(async()=>{
  resetPastePreview();
  const c=getCompany(),Learning=window.ConciliaLearning;
  if(!Learning)throw Error('Módulo de aprendizado não carregado. Atualize a página.');
  autoLinkBankCodes(c);
  const content=$('#pasteClassificationsText').value;
  const parsed=Learning.parsePastedExcel(content);
  const result=Learning.pastedProposals(c,period,parsed.rows);
  const issues=[...parsed.issues,...result.issues];
  const valid=result.proposals;
  const headers=['Data','Banco','Débito','Crédito','Valor','Histórico','Contrapartida'];
  const rows=valid.slice(0,100).map(item=>[
   safe(datePT(item.date)),safe(item.bankName),safe(item.amount>0?item.bank:item.code),
   safe(item.amount<0?item.bank:item.code),currency(item.amount),safe(item.history),safe(item.code)
  ]);
  $('#pasteClassificationsPreview').innerHTML=
   (valid.length?'<h3>Prévia: '+valid.length+' classificação(ões) pronta(s) para confirmação</h3>'+table(headers,rows)+(valid.length>100?'<p>Exibindo os primeiros 100 lançamentos válidos.</p>':''):'<p>Nenhuma classificação segura identificada para confirmar.</p>')+
   (issues.length?'<details open><summary>'+issues.length+' linha(s) para revisão — não serão aplicadas</summary><div class="import-status">'+safe(issues.slice(0,60).join('\n'))+(issues.length>60?' (e mais '+(issues.length-60)+' linha(s))':'')+'</div></details>':'');
  $('#pasteClassificationsStatus').textContent='Empresa: '+c.name+' • Competência: '+period+'. '+valid.length+' classificação(ões) válidas; '+issues.length+' linha(s) em revisão. Nada foi gravado ainda.';
  if(!valid.length)return;
  pasteClassificationDraft={companyId:c.id,period,text:content,records:valid.map(x=>({...x}))};
  $('#pasteConfirmButton').hidden=false;
  $('#pasteConfirmButton').disabled=false;
 })};
 $('#pasteConfirmButton').onclick=()=>action(async()=>{
  const draft=pasteClassificationDraft,c=getCompany(),Learning=window.ConciliaLearning;
  if(!draft||draft.companyId!==c.id||draft.period!==period||draft.text!==$('#pasteClassificationsText').value)
   throw Error('Empresa, competência ou texto mudou. Gere a prévia novamente.');
  const checked=Learning.pastedProposals(c,period,Learning.parsePastedExcel(draft.text).rows).proposals;
  if(JSON.stringify(checked)!==JSON.stringify(draft.records))throw Error('Os lançamentos mudaram desde a prévia. Confira novamente.');
  if(!confirm('Confirmar '+checked.length+' classificação(ões) para '+c.name+' e gravar o aprendizado somente nesta empresa?'))return;
  let applied=0,learned=0;
  for(const item of checked){
   const m=c.movements.find(x=>x.id===item.movementId),acc=c.accounts.find(a=>a.id===m?.accountId);
   if(!m||m.status==='CONFIRMADO'||m.status==='PENDENTE_DUPLICIDADE'||String(acc?.chartCode)!==String(item.bank)||
      !c.plan.some(p=>p.analytic&&String(p.code)===String(item.code)))continue;
   m.counterpart=String(item.code);
   m.suggested=String(item.code);
   m.status='CONFIRMADO';
   m.confidence='Classificação colada do Excel, validada e confirmada';
   if(learnConfirmed(c,m,item.code,'IMPORTACAO_VALIDADA'))learned++;
   applied++;
  }
  resetPastePreview();
  await store('CLASSIFICACOES_COLADAS',applied+' códigos confirmados; '+learned+' históricos aprendidos para '+c.name+' na competência '+period);
  $('#pasteClassificationsStatus').textContent=applied+' lançamento(s) atualizado(s) e '+learned+' histórico(s) aprendido(s) para '+c.name+'. No próximo mês, o ConCiliar+ poderá sugerir esses códigos para conferência.';
  say('Classificações coladas e aprendizado registrados.');
 });
 let taxDraft=null;
 const taxShow=(message,level='')=>{const el=$('#taxReceiptStatus');el.textContent=message;el.className='import-status '+level;};
 const taxReset=()=>{taxDraft=null;$('#taxConfirmButton').hidden=true;$('#taxConfirmButton').disabled=true;$('#taxReceiptPreview').innerHTML='';};
 $('#taxCodeSearch').oninput=()=>renderTaxes();
 $('#taxLoadDefaults').onclick=()=>action(async()=>{
  const c=getCompany(),Tax=window.ConciliaTax;
  const existing=c.taxRules||[];
  const additions=Tax.defaults().filter(r=>!existing.some(x=>x.key===r.key));
  if(!additions.length){say('As referências tributárias já estão cadastradas nesta empresa.');return;}
  if(!confirm('Adicionar '+additions.length+' referências de códigos tributários à empresa '+c.name+'? Os códigos só serão utilizados automaticamente se existirem no plano analítico.'))return;
  c.taxRules=[...existing,...additions];
  taxReset();
  await store('CODIGOS_TRIBUTARIOS_CADASTRADOS',additions.length+' referências para '+c.name);
  say('Biblioteca de códigos tributários cadastrada somente nesta empresa.');
 });
 $('#taxRuleForm').onsubmit=e=>{e.preventDefault();action(async()=>{
  const c=getCompany(),form=e.currentTarget,values=asData(form);
  const key=String(values.key||'').trim().toUpperCase(),description=String(values.description||'').trim(),code=String(values.code||'').trim();
  if(!key||!description||!code)throw Error('Preencha identificador, descrição e código.');
  if(!c.plan.some(p=>p.analytic&&String(p.code)===code))throw Error('Este código não é uma conta analítica do plano da empresa.');
  c.taxRules=c.taxRules||[];
  const existing=c.taxRules.find(r=>r.key===key);
  if(existing&&!confirm('Atualizar a referência tributária '+key+' de '+existing.code+' para '+code+'?'))return;
  if(existing){existing.description=description;existing.code=code;existing.referenceOnly=false;}
  else c.taxRules.push({id:Core.id(),key,description,code});
  taxReset();
  await store('CODIGO_TRIBUTARIO_SALVO',key+' → '+code);
  form.reset();say('Código tributário registrado na empresa.');
 })};
 document.addEventListener('click',e=>{
  const button=e.target.closest('[data-remove-tax-rule]');
  if(!button)return;action(async()=>{
   const c=getCompany(),key=button.dataset.removeTaxRule;
   if(!confirm('Remover a referência tributária '+key+' da empresa? Separações já confirmadas serão preservadas.'))return;
   c.taxRules=(c.taxRules||[]).filter(r=>r.key!==key);
   taxReset();await store('CODIGO_TRIBUTARIO_EXCLUIDO',key);
  });
 });
 document.addEventListener('click',e=>{
  const button=e.target.closest('[data-remove-tax-split]');
  if(!button)return;action(async()=>{
   const c=getCompany(),entry=(c.taxSplits||[]).find(x=>x.id===button.dataset.removeTaxSplit);
   if(!entry)return;
   if(!confirm('Desfazer separação do pagamento de '+currency(Math.abs(entry.cents))+'? O lançamento original do extrato continuará preservado.'))return;
   c.taxSplits=c.taxSplits.filter(x=>x.id!==entry.id);
   await store('SEPARACAO_TRIBUTARIA_DESFEITA',entry.id);taxReset();
  });
 });
 const analyzeTaxReceipts=async()=>{
  const c=getCompany(),Tax=window.ConciliaTax,form=$('#taxReceiptForm'),files=[...(form?.elements?.file?.files||[])];
  taxReset();
  if(!files.length)throw Error('Selecione ao menos um comprovante.');
  if(files.length>15)throw Error('Selecione até 15 arquivos PDF por análise.');
  const company=c.id,ym=period,receipts=[],issues=[];
  taxShow('Lendo comprovantes e conferindo totais...', 'working');
  for(const file of files){
   if(fileExt(file.name)!=='pdf')throw Error('Envie comprovantes PDF da Receita Federal.');
   const pdf=await Pdf.extractPdf(file);
   const parsed=Tax.parseReceipts(pdf,file.name);
   for(const r of parsed.receipts){
    if(receipts.some(x=>x.id===r.id)){issues.push('Documento '+r.id+' repetido em arquivos diferentes.');continue;}
    receipts.push(r);
   }
   issues.push(...parsed.reviews);
  }
  if(company!==companyId||ym!==period)throw Error('Empresa ou competência alterada. Refaça a análise.');
  const result=Tax.matches(c,ym,receipts);
  issues.push(...result.issues);
  const proposals=result.proposals;
  const rows=proposals.flatMap(p=>p.lines.map(l=>[
   safe(datePT(p.date)),safe(p.history),safe(p.receipts.map(r=>r.id).join(', ')),
   safe(l.description),safe(l.revenueCode),l.code?safe(l.code):'<span class="flag">SEM CÓDIGO VÁLIDO'+(l.registered?' ('+safe(l.registered)+')':'')+'</span>',
   currency(l.cents)
  ]));
  const sum=proposals.map(p=>{
   const total=p.lines.reduce((n,l)=>n+l.cents,0);
   const valid=p.lines.every(l=>l.code)&&total===-p.cents;
   return {movementId:p.movementId,valid};
  });
  const good=sum.filter(x=>x.valid).length;
  const missingLibrary=!(c.taxRules||[]).some(r=>r.key==='DAS');
  $('#taxReceiptPreview').innerHTML=
   '<p><strong>'+receipts.length+'</strong> comprovante(s) identificado(s), <strong>'+proposals.length+'</strong> pagamento(s) bancário(s) com correspondência única; <strong>'+good+'</strong> apto(s) à confirmação.</p>'+
   (missingLibrary?'<p class="status-red"><strong>Atenção:</strong> os códigos tributários desta empresa ainda não foram cadastrados. Abra a Consulta rápida de códigos tributários na etapa 3 e clique em Cadastrar minhas referências tributárias; depois analise novamente.</p>':'')+
   (rows.length?table(['Data','Histórico do extrato','Documento RFB','Tributo','Receita','Código contábil','Valor'],rows):'<p>Não foram localizados pagamentos com correspondência única nesta competência.</p>')+
   proposals.map(p=>{
    const total=p.lines.reduce((n,l)=>n+l.cents,0);
    return '<p><strong>'+safe(datePT(p.date))+' | '+safe(p.history)+'</strong>: extrato '+currency(Math.abs(p.cents))+' • separados '+currency(total)+' • diferença '+currency(Math.abs(p.cents)-total)+(p.lines.some(l=>!l.code)?' • há código pendente':'')+'</p>';
   }).join('')+
   (issues.length?'<details open><summary>'+issues.length+' ocorrência(s) para revisão (não aplicadas)</summary><pre style="white-space:pre-wrap">'+safe(issues.slice(0,80).join('\n'))+'</pre></details>':'');
  taxShow('Empresa: '+c.name+' | Competência: '+ym+' | '+good+' pagamento(s) apto(s). A prévia não altera o extrato.');
  const allowed=result.proposals.filter(p=>sum.some(x=>x.movementId===p.movementId&&x.valid));
  if(!allowed.length)return;
  taxDraft={companyId:c.id,period:ym,proposals:allowed,receiptIds:receipts.map(r=>r.id)};
  $('#taxConfirmButton').hidden=false;$('#taxConfirmButton').disabled=false;
 };
 $('#taxReceiptForm').onsubmit=e=>{e.preventDefault();action(analyzeTaxReceipts)};
 $('#taxConfirmButton').onclick=()=>action(async()=>{
  const c=getCompany(),Tax=window.ConciliaTax,draft=taxDraft;
  if(!draft||draft.companyId!==c.id||draft.period!==period)throw Error('Empresa ou competência mudou. Gere a prévia novamente.');
  if(!confirm('Confirmar '+draft.proposals.length+' separação(ões) com totais e códigos válidos? O extrato original permanecerá preservado; o Excel substituirá as linhas totais pelos tributos.'))return;
  let count=0;
  for(const p of draft.proposals){
   Tax.confirm(c,p);count++;
  }
  taxReset();
  await store('TRIBUTOS_SEPARADOS',count+' pagamento(s) conferido(s) e separado(s) em '+c.name+' | '+period);
  taxShow(count+' pagamento(s) separado(s) com sucesso. Consulte o Excel codificado para visualizar os tributos sem duplicidade.','success');
  formClearTax();
 });
 const formClearTax=()=>{$('#taxReceiptForm').reset();};
 $('#learnClassificationsForm').onsubmit=e=>{e.preventDefault();const form=e.currentTarget;action(async()=>{
  const c=getCompany(),file=form.elements.file.files?.[0],status=$('#learnClassificationsStatus'),button=$('#learnClassificationsButton');
  if(!file)throw Error('Selecione o Excel preenchido ou o Razão atualizado.');
  const activeCompany=c.id,activePeriod=period;
  button.disabled=true;
  const show=(tone,message)=>{status.className='import-status '+tone;status.textContent=message;};
  show('working','Verificando códigos, banco, datas e valores...');
  try{
   const ext=fileExt(file.name),Learning=window.ConciliaLearning;
   if(!Learning)throw Error('Módulo de aprendizado não carregado. Atualize o navegador.');
   autoLinkBankCodes(c);
   let result,priorExamples=[],fileSha='';
   if(ext==='xlsx'||ext==='xls'){
    if(!window.XLSX?.read)throw Error('Leitor XLSX indisponível.');
    const bytes=await file.arrayBuffer();
    const workbook=window.XLSX.read(bytes,{type:'array',cellDates:false});
    if(workbook.Sheets?.Extrato_Classificado){
     result=Learning.proposals(c,activePeriod,Learning.parseExcel(workbook),'EXCEL');
    }else{
     fileSha=await hash(bytes);
     const ledger=Learning.parseLedgerExcel(workbook);
     result=Learning.ledgerProposals(c,activePeriod,ledger.entries.filter(row=>row.date?.startsWith(activePeriod)));
     const history=Learning.historicalLedgerExamples(c,activePeriod,ledger.entries);
     priorExamples=history.examples;
     result.issues.push(...ledger.issues,...history.issues);
     if(priorExamples.length&&(c.learningImports||[]).some(entry=>entry.sha===fileSha)){
      result.issues.push('Este Razão Excel já foi utilizado para aprendizado nesta empresa.');
      priorExamples=[];
     }
    }
   }else if(ext==='pdf'){
    const doc=await Pdf.extractPdf(file);
    const docCnpj=window.ConciliaLayouts.documentCnpj(doc);
    if(!docCnpj||!c.cnpj||docCnpj!==c.cnpj)throw Error('CNPJ do Razão ausente ou diferente da empresa selecionada.');
    const parsed=window.ConciliaLayouts.parseDominioLedgerPdf(doc,file.name,Core);
    const bytes=await file.arrayBuffer();
    fileSha=await hash(bytes);
    const ledgerRows=parsed.entries||[];
    result=Learning.ledgerProposals(c,activePeriod,ledgerRows.filter(row=>row.date?.startsWith(activePeriod)));
    const history=Learning.historicalLedgerExamples(c,activePeriod,ledgerRows);
    priorExamples=history.examples;
    result.issues.push(...history.issues);
    if(priorExamples.length&&(c.learningImports||[]).some(entry=>entry.sha===fileSha)){
     result.issues.push('Este Razão histórico já ensinou seus códigos à empresa. A aprendizagem não será duplicada.');
     priorExamples=[];
    }
    if(parsed.partialEntries?.length)result.issues.push(parsed.partialEntries.length+' lançamento(s) do PDF sem contrapartida não serão aprendidos.');
   }else throw Error('Importe XLSX, XLS ou PDF do Razão.');
   const examples=result.issues.slice(0,10).join('\n');
   if(!result.proposals.length&&!priorExamples.length){
    show('error','Nenhuma classificação segura encontrada para a empresa e competência atuais.'+(examples?'\nRevisões:\n'+examples:''));
    return;
   }
   if(activeCompany!==companyId||activePeriod!==period)throw Error('Empresa ou competência alterada. Inicie a importação novamente.');
   const sample=result.proposals.slice(0,5).map(x=>x.date+' | '+(x.amount/100).toFixed(2)+' | '+x.history+' → '+x.code).concat(priorExamples.slice(0,5).map(x=>x.date+' | '+x.history+' → '+x.code+' (histórico)')).join('\n');
   const message='CONCILIAR+ — APRENDER CLASSIFICAÇÕES\n\nEmpresa: '+c.name+'\nCompetência: '+activePeriod+'\nArquivo: '+file.name+'\n\n'+result.proposals.length+' classificação(ões) com correspondência única.\n'+priorExamples.length+' referência(s) históricas com código válido para aprender.\n'+result.issues.length+' linha(s) exigem revisão e serão ignoradas.\n\nExemplos:\n'+sample+'\n\nConfirmar códigos encontrados e gravar o aprendizado para esta empresa?';
   if(!confirm(message)){show('working','Importação cancelada. Nenhum lançamento foi modificado.');return;}
   let updated=0,learned=0;
   for(const item of result.proposals){
    const m=c.movements.find(x=>x.id===item.movementId);
    if(!m||m.status==='CONFIRMADO'||m.status==='PENDENTE_DUPLICIDADE')continue;
    const acc=c.accounts.find(a=>a.id===m.accountId),bank=String(acc?.chartCode||'');
    if(!c.plan.some(p=>p.analytic&&String(p.code)===bank)||!c.plan.some(p=>p.analytic&&String(p.code)===item.code)||item.code===bank)continue;
    m.counterpart=String(item.code);m.suggested=String(item.code);m.status='CONFIRMADO';
    m.confidence='Classificação importada e confirmada pelo operador ('+item.source+')';
    if(learnConfirmed(c,m,item.code,'IMPORTACAO_VALIDADA'))learned++;
    updated++;
   }
   let historyCount=0;
   for(const item of priorExamples){
    const sampleMovement={accountId:item.accountId,history:item.history,cents:item.cents,financialDescription:''};
    if(learnConfirmed(c,sampleMovement,item.code,'IMPORTACAO_VALIDADA'))historyCount++;
   }
   if(priorExamples.length&&fileSha){
    c.learningImports=c.learningImports||[];
    c.learningImports.push({sha:fileSha,file:file.name,at:new Date().toISOString(),count:historyCount});
   }
   await store('CLASSIFICACOES_APRENDIDAS',file.name+' • '+updated+' lançamentos confirmados, '+(learned+historyCount)+' históricos aprendidos, '+result.issues.length+' revisões');
   show(result.issues.length?'working':'success',updated+' lançamento(s) classificados e '+(learned+historyCount)+' histórico(s) aprendido(s) para '+c.name+'. '+result.issues.length+' linha(s) ignoradas para revisão.'+(examples?'\n'+examples:'')+'\nO aprendizado dos próximos meses gera sugestões para conferência.');
   form.reset();
  }finally{button.disabled=false;}
 })};
 $('#importLedger').onsubmit=e=>{e.preventDefault();const form=e.currentTarget;action(async()=>{
 const c=getCompany(),files=Array.from(form.elements.file.files||[]),button=$('#ledgerButton'),status=$('#ledgerStatus'),historic=$('#ledgerMode').value==='reference';
 if(!files.length)throw Error('Selecione um ou mais Razões para importar.');
 if(files.length>20)throw Error('Escolha até 20 Razões por lote para evitar sobrecarga no celular.');
 const results=[];button.disabled=true;
 const show=(type,message)=>{if(status){status.textContent=message;status.className='import-status '+type;}};
 try{
  for(const file of files){
   show('working','Lendo Razão '+(results.length+1)+' de '+files.length+': '+file.name+'. Os outros Razões serão preservados.');
   try{
    const ext=fileExt(file.name);
    if(!['pdf','csv','txt'].includes(ext))throw Error('Formato incompatível. Envie PDF digital, CSV ou TXT.');
    const bytes=await file.arrayBuffer(),sha=await hash(bytes);
    const previous=c.imports.find(i=>i.type===(historic?'RAZAO_REFERENCIA':'RAZAO')&&i.sha===sha);
    if(previous){results.push({name:file.name,type:'existing',count:previous.count||0,accountCode:previous.accountCode||'',periods:previous.periods||[]});continue;}
    let parsed,accountCode='';
    if(ext==='pdf'){
     const doc=await Pdf.extractPdf(file);
     const docCnpj=window.ConciliaLayouts.documentCnpj(doc);
     if(!docCnpj||!c.cnpj||docCnpj!==c.cnpj)throw Error('CNPJ do PDF ausente ou diferente do plano da empresa. Não misturar empresas.');
     parsed=window.ConciliaLayouts.parseDominioLedgerPdf(doc,file.name,Core);
     accountCode=String(parsed.accountCode||'');
     if(!c.plan.some(p=>p.analytic&&String(p.code)===accountCode))throw Error('Conta '+accountCode+' do Razão não existe como analítica no plano desta empresa.');
    }else{
     const txt=(await asText(file)).txt;
     parsed=Core.parseLedger(Core.parseCsv(txt),file.name);
    }
    const incomplete=parsed.partialEntries||[],complete=parsed.entries||[];
    // Referências sem código de contrapartida são guardadas como pendentes, não contabilizadas.
    if(!complete.length&&!incomplete.length)throw Error('Nenhum lançamento reconhecido. Confira se é um Razão legível.');
    if(!historic&&!complete.length)throw Error(incomplete.length+' lançamento(s) identificados sem contrapartida. Para conciliação definitiva, obtenha o Razão completo no Domínio.');
    const periods=[...new Set([...complete,...incomplete].map(l=>month(l.date)))];
    if(!historic&&accountCode){
     const overlapping=periods.filter(p=>(c.ledger||[]).some(l=>l.period===p&&String(l.accountCode||'')===accountCode));
     if(overlapping.length)throw Error('Já existe Razão para a conta '+accountCode+' na(s) competência(s) '+overlapping.join(', ')+'. Use Refazer no arquivo anterior para atualizar, evitando substituir lançamentos sem aviso.');
    }
    const importId=Core.id(),at=new Date().toISOString();
    if(historic){c.referenceLedgers=c.referenceLedgers||[];c.referenceLedgers.push({importId,accountCode,periods,entries:complete,partialEntries:incomplete,file:file.name,at});}
    else for(const p of periods)c.ledger.push({id:Core.id(),importId,period:p,accountCode,openingBalance:parsed.openingBalance??null,at,entries:complete.filter(l=>month(l.date)===p),file:file.name});
    c.imports.push({id:importId,type:historic?'RAZAO_REFERENCIA':'RAZAO',name:file.name,sha,periods,accountCode,format:parsed.format||ext.toUpperCase(),count:complete.length,partialCount:incomplete.length,reviewCount:(parsed.reviews||[]).length,at});
    await afterImport('RAZAO',c,file,parsed,sha,importId);
    results.push({name:file.name,type:'success',count:complete.length,partialCount:incomplete.length,accountCode,periods,reviews:(parsed.reviews||[]).length});
   }catch(err){console.warn('Razão não importado:',file.name,err);results.push({name:file.name,type:'error',reason:err.message||String(err)});}
  }
  const success=results.filter(x=>x.type==='success'),existing=results.filter(x=>x.type==='existing'),errors=results.filter(x=>x.type==='error');
  let matched=0;
  if(success.length){
   const periods=[...new Set(success.flatMap(x=>x.periods))];
   if(historic){try{matched+=suggestFromHistoricalLedger(c,period).applied;}catch(err){console.warn('Referência histórica:',err);}}else for(const p of periods){try{matched+=suggestFromLedger(c,p).applied;}catch(err){console.warn('Sugestões do Razão:',err);}}
   await store('RAZOES_IMPORTADOS_EM_LOTE',success.length+' novo(s), '+existing.length+' repetido(s), '+errors.length+' erro(s). '+success.reduce((n,x)=>n+x.count,0)+' lançamentos contábeis; '+matched+' sugestões.');
  }else render();
  const pendingTotal=success.reduce((n,x)=>n+(x.partialCount||0),0);
  const header=(historic?'REFERÊNCIAS HISTÓRICAS: ':'RAZÕES: ')+success.length+' importado(s), '+existing.length+' já existente(s), '+errors.length+' com erro. '+success.reduce((n,x)=>n+x.count,0)+' lançamentos completos; '+pendingTotal+' incompletos, pendentes de contrapartida; '+matched+' sugestões a revisar.';
  const detail=results.map(x=>x.type==='success'?(x.partialCount?'⚠ ':'✓ ')+x.name+': '+x.count+' completo(s), '+(x.partialCount||0)+' pendente(s) sem contrapartida, conta '+(x.accountCode||'múltiplas')+', '+x.periods.join(', ')+(x.reviews?' • '+x.reviews+' linha(s) em revisão':'')+(x.partialCount?' • NÃO geram sugestões nem conciliação':''):x.type==='existing'?'↷ '+x.name+': já cadastrado, preservado':'✕ '+x.name+': '+x.reason).join('\n');
  show(errors.length?'error':'success',header+'\n'+detail+'\nOs Razões de outros bancos não foram apagados.');
  if(success.length||existing.length)form.reset();
  if(!historic&&success.length&&Core.periodMovements(c,period).length){renderAuditoria();showPage('conciliacao');$('#auditTable')?.scrollIntoView({behavior:'smooth',block:'start'});}
  say(header,!!errors.length);
 }catch(err){show('error','Falha ao salvar o lote: '+(err.message||String(err))+'. Verifique o histórico antes de tentar novamente.');throw err;}
 finally{button.disabled=false;}
 })};
 $('#suggest').onclick=()=>action(async()=>{const c=getCompany();let changed=0;for(const m of Core.periodMovements(c,period)){if(m.status==='PENDENTE_DUPLICIDADE'||m.status==='CONFIRMADO'||transferIds(c).has(m.id))continue;const rules=c.rules.filter(r=>Core.norm(m.history).includes(Core.norm(r.term)));const codes=[...new Set(rules.map(r=>r.counterpart))];if(codes.length===1){m.suggested=codes[0];m.confidence='regra própria';changed++;}else if(!codes.length){autoSuggest(c,m);if(m.suggested)changed++;}}const finance=financialMatches(c,period);changed+=finance.coded;const hist=suggestFromHistoricalLedger(c,period);changed+=hist.applied;await store('SUGESTOES_GERADAS',`${changed} sugestões para ${period}; ${hist.applied} do Razão anterior; ${hist.ambiguous} ambíguas`);say(`${changed} sugestões de contrapartida geradas. Confirme cada uma.`)});
 $('#autoAnalyze').onclick=()=>action(async()=>{const c=getCompany(),moves=Core.periodMovements(c,period);if(!moves.length)throw Error('Importe os extratos da competência antes de analisar.');let rules=0;for(const m of moves){if(m.status==='CONFIRMADO'||m.status==='PENDENTE_DUPLICIDADE'||transferIds(c).has(m.id))continue;if(!m.suggested){autoSuggest(c,m);if(m.suggested)rules++;}}
 const finance=financialMatches(c,period);
 const history=suggestFromHistoricalLedger(c,period);
 const ledger={applied:0,ambiguous:0},pairs=Core.transferSuggestions(c,period);const totalSuggested=moves.filter(m=>!!m.suggested&&!m.counterpart).length;await store('TRIAGEM_AUTOMATICA',`Competência ${period}: ${moves.length} movimentos; ${rules} novas regras; ${totalSuggested} sugestões presentes; ${ledger.applied} novas sugestões Razão; ${pairs.proposals.length} transferências possíveis`);
 setStatementStatus('success',`TRIAGEM AUTOMÁTICA ${period}: ${moves.length} movimentos já importados; ${finance.matched} descrições do controle financeiro; ${finance.ambiguous} correspondências ambíguas; ${totalSuggested} sugestões de contrapartida no total (${rules} por regras, ${history.applied} pelo histórico e ${ledger.applied} pelo Razão atual); ${ledger.ambiguous} registros do Razão ambíguos; ${pairs.proposals.length} transferências candidatas e ${pairs.ambiguous.length} ambiguidades. Sugestões não são confirmações: confira Classificações.`);
 const pdfFiles=$('#taxReceiptForm')?.elements?.file?.files;
 if(pdfFiles?.length){
  await analyzeTaxReceipts();
  say('Triagem e conferência dos comprovantes concluídas. Revise a separação tributária antes de confirmar.');
 }else{
  taxShow('Triagem dos extratos e referências concluída. Agora importe os comprovantes DARF/DAS na seção abaixo e clique em Analisar comprovantes e conferir separação. Selecione os PDFs antes de usar Analisar e cruzar documentos para fazer tudo em uma etapa.');
  say('Triagem concluída. Confira Classificações e Transferências antes de exportar.');
 }
});
 $('#findTransfers').onclick=()=>action(async()=>{const c=getCompany(),s=Core.transferSuggestions(c,period);say(`${s.proposals.length} par(es) com correspondência única; ${s.ambiguous.length} ambíguos. Nenhuma transferência foi confirmada automaticamente.`);renderTransfers()});
 $('#runRecon').onclick=()=>action(()=>{const c=getCompany();renderRecon();renderAuditoria();showPage('conciliacao');$('#auditTable')?.scrollIntoView({behavior:'smooth',block:'start'});const rec=Core.reconcile(c,period);say(`${rec.checked.filter(x=>x.recon==='CONCILIADO').length} lançamento(s) conciliados; ${rec.missingLedger.length} registros do Razão sem vínculo.`)});
 $('#downloadStatement').onclick=()=>action(()=>{const c=getCompany();autoLinkBankCodes(c);const data=window.ConciliaExcel.reportStatement(Core,c,period);const filename='EXTRATO_CODIFICADO_'+(c.cnpj||Core.norm(c.name)).replace(/[^A-Za-z0-9]/g,'')+'_'+period+'.xlsx';window.ConciliaExcel.download(data,filename);say('Extrato gerado sem Razão. Confira os códigos pendentes antes de lançar no Domínio.');});
 $('#downloadExcel').onclick=()=>action(()=>{const c=getCompany();autoLinkBankCodes(c);const data=window.ConciliaExcel.report(Core,c,period);const filename='CONFERENCIA_'+(c.cnpj||Core.norm(c.name)).replace(/[^A-Za-z0-9]/g,'')+'_'+period+'.xlsx';window.ConciliaExcel.download(data,filename);say(`Excel gerado: ${data.counts.movements} movimentações, ${data.counts.ready} lançamentos prontos, ${data.counts.suggested} sugestões a confirmar.`);});
 $('#downloadPdf').onclick=()=>{try{const c=getCompany();autoLinkBankCodes(c);const html=window.ConciliaAssistente.relatorioHtml(Core,c,period);const file=new Blob([html],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(file);const w=window.open(url,'_blank');if(!w){URL.revokeObjectURL(url);throw Error('O navegador bloqueou a janela do PDF. Permita pop-ups para este site e tente novamente.');}setTimeout(()=>URL.revokeObjectURL(url),60000);say('Relatório aberto. Escolha Imprimir → Salvar como PDF.');}catch(e){say(e.message,true)}};
 $('#downloadCsv').onclick=()=>action(()=>{const c=getCompany(),audit=window.ConciliaAssistente.analisar(Core,c,period);if(!audit.exportable)throw Error('Prévia de lançamentos bloqueada: confira contrapartidas, extratos, saldos, duplicidades, transferências e Razão antes de exportar. Excel de conferência e PDF seguem disponíveis.');const out=Core.previewExport(c,period);if(c.imports.some(i=>i.type==='EXTRATO'&&i.periods.includes(period)&&i.balanceCheck?.status==='DIVERGENTE'))throw Error('Extrato com diferença de saldos: resolva a divergência antes de exportar.');if(out.errors.length)throw Error(`Há ${out.errors.length} erro(s) de código contábil. Corrija antes de exportar.`);if(!c.ledger.some(l=>l.period===period))throw Error('Importe ou atualize o Razão desta competência antes de liberar a exportação.');if(!out.rows.length)throw Error('Não há lançamentos confirmados e não encontrados no Razão para exportar.');if(!confirm(`Exportar ${out.rows.length} lançamento(s) em prévia CSV? Valide o arquivo antes de importar no Domínio.`))return;putFile(null,`PREVIA_${c.dominio}_${period}.csv`,'\uFEFF'+Core.exportCsv(out.rows));say('Prévia CSV exportada. Ainda não homologada no Domínio.')});
 document.addEventListener('click',e=>{const button=e.target.closest('[data-balance-check]');if(!button)return;action(async()=>{
  const c=getCompany(),item=c.imports.find(i=>i.id===button.dataset.balanceCheck);
  if(!item||item.type!=='EXTRATO')throw Error('Extrato não encontrado.');
  if(['OK','MANUAL_OK'].includes(item.balanceCheck?.status))throw Error('Este extrato já possui saldos conferidos.');
  const enteredStart=prompt('Informe o SALDO INICIAL deste extrato (exemplo: 9798,49). Use o saldo indicado no documento, não um valor estimado:');
  if(enteredStart===null)return;
  const enteredEnd=prompt('Informe o SALDO FINAL do mesmo extrato. O sistema comparará com a soma dos movimentos importados:');
  if(enteredEnd===null)return;
  const initial=Core.money(enteredStart),final=Core.money(enteredEnd);
  const movements=c.movements.filter(m=>m.importId?m.importId===item.id:m.origin===item.name);
  if(!movements.length)throw Error('Nenhuma movimentação vinculada ao arquivo.');
  const sum=movements.reduce((n,m)=>n+m.cents,0),difference=initial+sum-final;
  if(Math.abs(difference)>1){
    item.balanceCheck={status:'DIVERGENTE',method:'OPERADOR',initial,final,movementSum:sum,difference,checkedAt:new Date().toISOString()};
    await store('SALDO_DIVERGENTE',item.name+': diferença '+currency(difference));
    say('DIVERGÊNCIA de '+currency(difference)+'! Não é seguro liberar os lançamentos deste extrato.',true);return;
  }
  if(!confirm('A soma bate, mas você precisa conferir que TODAS as páginas e movimentações foram importadas. Confirma ter verificado o extrato completo e os saldos inicial/final?'))return;
  item.balanceCheck={status:'MANUAL_OK',method:'OPERADOR',initial,final,movementSum:sum,difference,checkedAt:new Date().toISOString()};
  await store('SALDO_CONFERIDO_PELO_OPERADOR',item.name+': '+movements.length+' movimentos; '+currency(sum));
  say('Saldo conferido manualmente. Isso não substitui a comparação com o Razão.');
 });});
 document.addEventListener('click',e=>{const target=e.target.closest('[data-delete-import],[data-redo-import]');if(!target)return;action(async()=>{const c=getCompany(),id=target.dataset.deleteImport||target.dataset.redoImport,item=c.imports.find(i=>i.id===id);if(!item)throw Error('Importação não encontrada');const redo=!!target.dataset.redoImport;
 const message=redo?'Refazer '+item.name+'? O processamento anterior será removido. Depois selecione o mesmo arquivo novamente. Salve backup se necessário.':'Excluir '+item.name+' e seus movimentos associados? Os outros extratos serão mantidos. Antes de excluir, recomenda-se baixar o backup.';
 if(!confirm(message))return;
 ultimoExcluido=JSON.parse(JSON.stringify(state));
 let result;if(item.type==='RAZAO_REFERENCIA'){c.referenceLedgers=(c.referenceLedgers||[]).filter(r=>r.importId!==item.id);c.imports=c.imports.filter(i=>i.id!==item.id);state.reviews=state.reviews.filter(r=>r.importId!==item.id);result={removed:0};}else{result=window.ConciliaAssistente.remover(c,item,state.reviews);state.reviews=result.reviews;}
 await store(redo?'EXTRATO_REFAZER':'IMPORTACAO_EXCLUIDA',item.type+': '+item.name+'; '+result.removed+' movimentos removidos');
 showPage('importar');say((redo?'Pronto para refazer. Selecione novamente o arquivo.':'Importação excluída. ')+result.removed+' movimento(s) removido(s); os demais extratos foram preservados.');
 });});
 $('#resetAll').onclick=()=>action(async()=>{
  const c=getCompany(),scope=$('#resetScope').value,companyName=c.name||'empresa',when=scope==='period'?'competência '+period:'todos os períodos desta empresa';
  const attachments=(c.imports||[]).filter(i=>['EXTRATO','RAZAO'].includes(i.type)&&(scope==='company'||(i.periods||[]).includes(period)));
  if(scope==='period'){
    const mixed=attachments.filter(i=>(i.periods||[]).some(p=>p!==period));
    if(mixed.length)throw Error('Existem arquivos que abrangem mais de um mês: '+mixed.map(i=>i.name).join(', ')+'. Para preservar as outras competências, escolha todos os períodos da empresa ou refaça esses arquivos individualmente.');
  }
  const moves=c.movements.filter(m=>scope==='company'||m.date?.slice(0,7)===period).length;
  const ledgers=c.ledger.filter(l=>scope==='company'||l.period===period).length;
  if(!attachments.length&&!moves&&!ledgers){$('#resetStatus').textContent='Não existem extratos nem Razões para recomeçar neste escopo.';return;}
  if(!confirm('RESTAURAR TUDO — '+companyName+'\n\nEscopo: '+when+'\n\nSerão limpos '+attachments.length+' arquivo(s), '+moves+' movimento(s) e '+ledgers+' versão(ões) do Razão, além de vínculos, classificações e revisões correspondentes.\n\nO plano de contas, contas bancárias cadastradas, regras e outras empresas NÃO serão apagados.\n\nDeseja preparar um backup antes de continuar?'))return;
  const backupPayload=JSON.stringify({format:'concilia-plus-demo-backup-v1',exported:new Date().toISOString(),state},null,2);
  const filename='ConciliaMais_ANTES_RESTAURAR_'+String(c.cnpj||c.id).replace(/[^a-zA-Z0-9]/g,'')+'_'+(scope==='period'?period:'TODOS')+'.json';
  putFile(null,filename,backupPayload);
   if(!confirm('Backup de segurança solicitado: '+filename+'\n\nVerifique na pasta Downloads se o arquivo JSON foi salvo.\n\nATENÇÃO: ao continuar, serão removidos apenas os extratos, Razões e respectivas análises de '+when+'. Os cadastros, planos de contas, bancos e regras serão preservados.\n\nDeseja realmente limpar essas importações agora?')){$('#resetStatus').textContent='Operação cancelada. Nenhum dado foi apagado. Backup solicitado.';return;}
  const snapshot=JSON.parse(JSON.stringify(state));
  const result=window.ConciliaAssistente.restaurarImportacoes(c,period,state.reviews,scope);
  state.reviews=result.reviews;ultimoExcluido=snapshot;
  await store('RESTAURACAO_IMPORTACOES',companyName+' — '+when+'; '+result.stats.imports+' arquivo(s), '+result.stats.movements+' movimento(s), '+result.stats.ledgerVersions+' Razão/versão(ões) e '+result.stats.transfers+' vínculo(s) removidos.');
  $('#resetStatus').textContent='Restauração concluída: '+result.stats.imports+' arquivo(s) e '+result.stats.movements+' movimento(s) limpos. Plano e contas mantidos. Pode importar novamente extratos e Razões. Se necessário, use Desfazer última exclusão/restauração.';
  $('#resetStatus').className='import-status success';
  say('Pronto para reimportar: '+result.stats.imports+' arquivo(s) limpos. Plano de contas preservado.');
  showPage('importar');
 });
 $('#undoRemove').onclick=()=>action(async()=>{if(!ultimoExcluido)throw Error('Nenhuma exclusão para desfazer');if(!confirm('Restaurar a última exclusão?'))return;state=ultimoExcluido;ultimoExcluido=null;await saveDB();renderSelection();render();say('Última exclusão desfeita.');});
 $('#backup').onclick=()=>action(()=>{const payload=JSON.stringify({format:'concilia-plus-demo-backup-v1',exported:new Date().toISOString(),state},null,2);putFile(null,'ConciliaMais_backup_'+new Date().toISOString().slice(0,10)+'.json',payload);say('Backup exportado. Guarde o arquivo com segurança.')});
 $('#restore').onchange=e=>{action(async()=>{
  const field=e.currentTarget,file=field.files[0];if(!file)return;
  try{
   if(!cloudSyncEnabled||!window.ConciliaCloud?.authenticated())throw Error('Entre na sua conta e carregue a nuvem antes de restaurar um backup.');
   const {txt}=await asText(file),obj=JSON.parse(txt);
   if(obj.format!=='concilia-plus-demo-backup-v1'||!Array.isArray(obj.state?.companies))throw Error('Arquivo de backup inválido');
   if(!confirm('ATENÇÃO: restaurar o JSON substituirá os dados atuais desta conta também na nuvem. Faça antes um backup JSON dos dados atuais. Deseja continuar?'))return;
   await window.ConciliaCloud.waitWrites();
   await window.ConciliaCloud.serializedSave(durableWorkspace(obj.state));
   state=obj.state;companyId='';ultimoExcluido=null;await saveDB();renderSelection();showPage('empresas');
   cloudMessage('Backup recuperado na nuvem. Selecione a empresa para continuar.');
  }finally{field.value='';}
 })};
 document.addEventListener('click',e=>{const b=e.target.closest('button[data-classify],button[data-transfer]');if(!b)return;
 if(b.dataset.classify){action(async()=>{const c=getCompany(),m=c.movements.find(m=>m.id===b.dataset.classify);if(!m)throw Error('Movimento não encontrado');if(m.status==='PENDENTE_DUPLICIDADE')throw Error('Resolva suspeita de duplicidade antes de classificar');const cp=$('#cp_'+CSS.escape(m.id))?.value||m.suggested;if(!c.plan.some(p=>p.code===cp&&p.analytic))throw Error('Escolha uma contrapartida analítica válida.');if(String(c.accounts.find(a=>a.id===m.accountId)?.chartCode)===String(cp))throw Error('A contrapartida deve ser diferente da conta bancária.');if(!confirm(`Confirma que o código ${cp} é a contrapartida correta deste lançamento?`))return;m.counterpart=cp;m.status='CONFIRMADO';learnConfirmed(c,m,cp);await store('CLASSIFICACAO_CONFIRMADA',`${m.date}, ${m.cents}, ${cp}`);say('Classificação confirmada.')})}
 if(b.dataset.transfer){action(async()=>{const c=getCompany(),[outId,inId]=b.dataset.transfer.split('|'),decision=b.dataset.decision;const mv=new Map(c.movements.map(m=>[m.id,m])),out=mv.get(outId),inn=mv.get(inId);if(!out||!inn)throw Error('Movimentação não encontrada');const src=c.accounts.find(a=>a.id===out.accountId),dst=c.accounts.find(a=>a.id===inn.accountId);if(!src||!dst||src.id===dst.id)throw Error('Contas de origem/destino inválidas');if(decision==='CONFIRMADA'){
   if(out.status==='PENDENTE_DUPLICIDADE'||inn.status==='PENDENTE_DUPLICIDADE')throw Error('Existe duplicidade pendente neste par');
   if(String(src.chartCode)===String(dst.chartCode))throw Error('As contas da transferência devem ter códigos contábeis distintos.');
   if(out.cents!==-inn.cents||out.cents>=0||Core.dayDistance(out.date,inn.date)>2)throw Error('Par não atende às condições de conferência');
   const conflicts=c.transfers.some(t=>t.status==='CONFIRMADA'&&([t.outId,t.inId].includes(outId)||[t.outId,t.inId].includes(inId)));if(conflicts)throw Error('Uma destas movimentações já foi vinculada');
   if(!confirm(`Você verificou nos extratos que ${src.bank} (${src.label}) e ${dst.bank} (${dst.label}) pertencem à mesma empresa? Confirmar lançamento único?`))return;
 }else if(!confirm('Rejeitar esta correspondência sugerida?'))return;
 const existing=c.transfers.find(t=>t.outId===outId&&t.inId===inId);if(existing)existing.status=decision;else c.transfers.push({outId,inId,status:decision});await store('TRANSFERENCIA_'+decision,`${outId} → ${inId}`);say('Decisão sobre a transferência registrada.')})}
 });
}
(async()=>{try{
 document.body.classList.remove('authenticated');
 window.lucide?.createIcons();
 db=await openDB();
 const old=await loadDB();
 if(old&&Array.isArray(old.companies))legacyData=old;
 state=blankState();companyId='';
 renderSelection();binds();
 await initializeCloud();
 }catch(e){console.error(e);authReady=false;cloudSyncEnabled=false;document.body.classList.remove('authenticated');cloudMessage('Não foi possível iniciar a aplicação: '+e.message,true);}
})();
