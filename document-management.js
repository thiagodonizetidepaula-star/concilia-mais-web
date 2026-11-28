/* ConCiliar+ Melhoria 02 — interface documental mensal/anual e prévia local.
   Proibição deliberada de importar dados reais nesta branch:
   a única operação Excel é leitura em memória do navegador + contagem. */
(()=>{'use strict';
const M=window.ConciliaDocumentImport;
const $=selector=>document.querySelector(selector);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const period=(y,m)=>String(y)+'-'+String(m).padStart(2,'0');
const nameEmail=e=>typeof e==='string'?e:e?.value||'';
const dstatus=s=>({'Recebido':'received','Pendente':'pending','Cobrado':'charged','Parcialmente recebido':'partial','Não se aplica':'na','Sem registro':'unset'})[s]||'special';
const badge=s=>'<span class="docs-badge '+dstatus(s)+'">'+esc(s)+'</span>';
const option=(value,label,current)=>'<option value="'+esc(value)+'"'+(String(value)===String(current)?' selected':'')+'>'+esc(label)+'</option>';
let mode='mensal',year=String(new Date().getFullYear()),month=new Date().getMonth()+1,search='',lifecycle='active',selectedStatus='',selectedRegime='',selectedPlan='',editingId='',editingMonth=1,preview=null,dryRun=null;
const companies=()=>window.ConciliaWallet?.visible?.()||[];
function matches(c){
 if(lifecycle==='active'&&c.clientInactive)return false;
 if(lifecycle==='inactive'&&!c.clientInactive)return false;
 const query=norm(search.trim()),digits=M.digits(search);
 if(query&&!([c.name,c.cnpj,c.dominio,...(c.emails||[]).map(nameEmail)].some(v=>norm(v).includes(query))||(digits&&M.digits(c.cnpj).includes(digits))))return false;
 if(selectedRegime&&String(c.regimeTributario||'')!==selectedRegime)return false;
 if(selectedPlan&&String(c.contractedPlan||'')!==selectedPlan)return false;
 if(selectedStatus){const statuses=mode==='anual'?M.MONTHS.map((_,i)=>c.documentHistory?.[period(year,i+1)]?.status||'Sem registro'):[c.documentHistory?.[period(year,month)]?.status||'Sem registro'];if(!statuses.includes(selectedStatus))return false;}
 return true;
}
const current=()=>companies().filter(matches);
const years=()=>[...new Set([year,String(new Date().getFullYear()),...companies().flatMap(c=>Object.keys(c.documentHistory||{}).map(x=>x.slice(0,4)))])].filter(x=>/^\d{4}$/.test(x)).sort().reverse();
function filters(){
 const all=companies(),regimes=[...new Set(all.map(c=>c.regimeTributario).filter(Boolean))],plans=[...new Set(all.map(c=>c.contractedPlan).filter(Boolean))],statuses=[...new Set([...M.STANDARD,...all.flatMap(c=>Object.values(c.documentHistory||{}).map(v=>v?.status).filter(Boolean))])];
 return '<div class="docs-filters"><label>Pesquisar<input id="docsSearch" type="search" placeholder="Razão social, CNPJ ou e-mail" value="'+esc(search)+'"></label>'+
 '<label>Ano<select data-doc-filter="year">'+years().map(x=>option(x,x,year)).join('')+'</select></label>'+
 (mode==='mensal'?'<label>Mês<select data-doc-filter="month">'+M.MONTHS.map((s,i)=>option(i+1,s,month)).join('')+'</select></label>':'')+
 '<label>Situação<select data-doc-filter="status">'+option('','Todas',selectedStatus)+statuses.map(s=>option(s,s,selectedStatus)).join('')+'</select></label>'+
 '<label>Regime tributário<select data-doc-filter="regime">'+option('','Todos',selectedRegime)+regimes.map(s=>option(s,s,selectedRegime)).join('')+'</select></label>'+
 '<label>Plano contratado<select data-doc-filter="plan">'+option('','Todos',selectedPlan)+plans.map(s=>option(s,s,selectedPlan)).join('')+'</select></label>'+
 '<label>Clientes<select data-doc-filter="lifecycle">'+[['active','Ativos'],['inactive','Inativos (distrato)'],['all','Todos']].map(x=>option(x[0],x[1],lifecycle)).join('')+'</select></label></div>';
}
function detailForm(c){
 const p=period(year,editingMonth),record=c.documentHistory?.[p],value=record?.status||'Sem registro';
 return '<form id="docsEditForm" class="docs-editor"><div class="docs-editor-head"><h3>'+esc(c.name)+' · '+esc(M.MONTHS[editingMonth-1])+'/'+esc(year)+'</h3><button type="button" class="secondary" data-doc-cancel>Cancelar</button></div>'+
 '<input type="hidden" name="company" value="'+esc(c.id)+'"><input type="hidden" name="month" value="'+editingMonth+'">'+
 '<label>Status<select name="status">'+[...new Set([...M.STANDARD,value])].map(x=>option(x,x,value)).join('')+'</select></label>'+
 '<label>Observações<textarea maxlength="1200" name="notes" rows="3" placeholder="Ex.: falta receber o extrato bancário do Itaú.">'+esc(record?.notes||'')+'</textarea></label>'+
 '<p>Data da alteração e colaborador serão registrados; datas efetivas de recebimento e cobrança não são inventadas.</p>'+
 '<button type="submit" class="primary">Salvar alteração manual</button></form>';
}
function table(){
 const list=current();if(!list.length)return '<div class="docs-empty">Nenhum cliente encontrado neste filtro.</div>';
 if(mode==='anual'){
  return '<div class="docs-scroll"><table><thead><tr><th>Empresa / CNPJ</th>'+M.MONTHS.map(m=>'<th>'+esc(m.slice(0,3))+'</th>').join('')+'</tr></thead><tbody>'+
  list.map(c=>'<tr><td><strong>'+esc(c.name)+'</strong><small>'+esc(c.cnpj||'CNPJ não cadastrado')+'</small></td>'+
   M.MONTHS.map((_,i)=>{const s=c.documentHistory?.[period(year,i+1)]?.status||'Sem registro';return '<td><button type="button" class="docs-cell" data-doc-edit="'+esc(c.id)+'" data-doc-month="'+(i+1)+'">'+badge(s)+'</button></td>';}).join('')+'</tr>').join('')+'</tbody></table></div>';
 }
 return '<div class="docs-scroll"><table><thead><tr><th>Razão social / CNPJ</th><th>E-mails</th><th>Status</th><th>Observação</th><th>Ações</th></tr></thead><tbody>'+
 list.map(c=>{const d=c.documentHistory?.[period(year,month)];return '<tr><td><strong>'+esc(c.name)+'</strong><small>'+esc(c.cnpj||'CNPJ não cadastrado')+'</small></td>'+
  '<td>'+esc((c.emails||[]).map(nameEmail).join('; ')||'—')+'</td><td>'+badge(d?.status||'Sem registro')+'</td><td>'+esc(d?.notes||'—')+'</td>'+
  '<td><button type="button" class="secondary" data-doc-edit="'+esc(c.id)+'" data-doc-month="'+month+'">Editar</button></td></tr>'}).join('')+'</tbody></table></div>';
}
function previewForm(){
 const counts=preview?.counts;
 return '<section class="docs-preview"><h3>Prévia segura da planilha</h3>'+
 '<p>O Excel é processado apenas neste navegador. <strong>Importação definitiva bloqueada nesta versão até a sua aprovação.</strong> Nenhum cliente da planilha será gravado em produção.</p>'+
 '<div class="docs-preview-row"><label>Ano da planilha (confirmado)<input type="number" id="docsYearSource" min="1900" max="2099" value="2026" readonly></label>'+
 '<label>Planilha Excel (.xlsx)<input type="file" id="docsExcel" accept=".xlsx"></label>'+
 '<button type="button" class="primary" data-doc-preview>Verificar e gerar prévia</button></div>'+
 (counts?'<div class="docs-review-summary"><h4>Resumo da prévia — '+preview.year+'</h4><p>'+counts.all+' empresas Beatriz: '+counts.active+' ativas e '+counts.inactive+' com distrato.</p>'+
 '<p>'+counts.emails+' endereços válidos (por empresa), '+counts.invalidEmails+' para revisão, '+counts.monthlyCells+' competências preservadas incluindo '+(counts.monthlyCells-counts.filledCells)+' células vazias e '+counts.closingCells+' registros mensais históricos de fechamento.</p>'+
 '<p>'+preview.issues.length+' observações de validação.</p><div class="docs-issues">'+preview.issues.slice(0,30).map(x=>'<p>'+esc(x)+'</p>').join('')+'</div>'+
 (dryRun?'<div class="docs-dryrun"><h4>Simulação local — SEM GRAVAR</h4><p><strong>'+dryRun.counts.created+'</strong> cadastros novos, <strong>'+dryRun.counts.reused+'</strong> cadastros reaproveitados, <strong>'+dryRun.counts.newEmails+'</strong> e-mails adicionais, <strong>'+dryRun.counts.docRecords+'</strong> competências documentais novas, <strong>'+dryRun.counts.closingRecords+'</strong> históricos de fechamento preservados.</p><p>'+dryRun.counts.conflicts.length+' conflito(s) bloqueado(s). Nenhuma alteração foi aplicada ao cadastro ou ao Supabase.</p><div class="docs-issues">'+dryRun.counts.conflicts.slice(0,15).map(x=>'<p>'+esc(x)+'</p>').join('')+'</div></div>':'')+
 '<button type="button" disabled>Importação definitiva desabilitada — aprovação pendente</button></div>':'')+'</section>';
}
function render(){
 const el=$('#documentsPanel');if(!el)return;
 const list=current(),all=companies(),active=all.filter(c=>!c.clientInactive);
 const selected=all.find(c=>c.id===editingId);
 const counts={};if(mode==='mensal')for(const c of list){const s=c.documentHistory?.[period(year,month)]?.status||'Sem registro';counts[s]=(counts[s]||0)+1;}
 el.innerHTML='<div class="docs-header"><div><span class="prod-kicker">GESTÃO DE DOCUMENTOS</span><h2>Acompanhamento documental</h2><p>Recebimento e cobranças manuais por competência, sem cadastrar bancos ou extratos individuais.</p></div><div class="docs-kpis"><div><strong>'+active.length+'</strong><small>ativos</small></div><div><strong>'+(all.length-active.length)+'</strong><small>inativos</small></div></div></div>'+
 '<div class="docs-tabs"><button type="button" data-doc-mode="mensal" '+(mode==='mensal'?'class="active"':'')+'>Visão mensal</button>'+
 '<button type="button" data-doc-mode="anual" '+(mode==='anual'?'class="active"':'')+'>Visão anual</button>'+
 '<button type="button" data-doc-mode="preview" '+(mode==='preview'?'class="active"':'')+'>Prévia de importação Excel</button></div>'+
 (mode==='preview'?previewForm():filters()+'<p class="docs-summary">Exibindo '+list.length+' empresa(s)'+(mode==='mensal'?' · '+Object.entries(counts).map(([k,v])=>badge(k)+' '+v).join(' · '):'')+'</p>'+
 (selected?detailForm(selected):'')+table())+
 '<p class="docs-note">Cobrado ≠ Recebido. Sem registro não é pendente. Datas de recebimento/cobrança só serão registradas se realmente informadas. Histórico persistente vinculado ao workspace autenticado.</p>';
}
async function saveEdit(form){
 const formData=new FormData(form),id=String(formData.get('company')||''),m=Number(formData.get('month')),status=String(formData.get('status')),notes=String(formData.get('notes')||'').trim();
 const c=companies().find(x=>x.id===id);
 if(!c||!Number.isInteger(m)||m<1||m>12||!/^\d{4}$/.test(year))throw Error('Seleção de empresa ou mês inválida.');
 if(c.clientInactive&&!confirm('Empresa com distrato. Salvar somente histórico sem reativar?'))return;
 if(![...M.STANDARD,...Object.values(c.documentHistory||{}).map(x=>x.status)].includes(status))throw Error('Status não reconhecido.');
 c.documentHistory ||= {};
 const p=period(year,m),old=c.documentHistory[p]===undefined?null:JSON.parse(JSON.stringify(c.documentHistory[p]));
 const crmBefore=Array.isArray(c.crmHistory)?c.crmHistory.slice():null;
 c.documentHistory[p]={...old,status,notes,source:'manual',updatedAt:new Date().toISOString(),updatedBy:window.ConciliaCloud?.accountId?.()||null};
 // A data efetiva de recebimento continua desconhecida. Registrar apenas a
 // mudança manual do status e o instante da alteração, sem inventar data de envio.
 if(status==='Recebido'&&old?.status!=='Recebido'&&window.ConciliaCRM){
   c.crmHistory ||= [];
   c.crmHistory.push({id:'doc-'+c.id+'-'+p+'-'+Date.now(),type:'receipt',periods:[p],occurredAt:null,
     medium:'Controle de Documentos',status:'Documentação recebida',notes:notes||'Status documental alterado manualmente para Recebido.',
     createdAt:c.documentHistory[p].updatedAt,actorId:c.documentHistory[p].updatedBy,source:'document-control'});
 }
 try{
  await store('DOCUMENTOS_CONTROLE_MANUAL',c.id+' · '+p);
  editingId='';render();
  if(typeof cloudSyncEnabled!=='undefined'&&!cloudSyncEnabled)alert('Alteração ficou apenas na cópia local. A sincronização Supabase está pendente.');
 }catch(err){if(old)c.documentHistory[p]=old;else delete c.documentHistory[p];if(crmBefore===null)delete c.crmHistory;else c.crmHistory=crmBefore;render();throw err;}
}
async function previewFile(file,yr){
 if(!window.ConciliaCloud?.authenticated?.())throw Error('Entre na sua conta para comparar com o workspace autenticado; a planilha não será gravada.');
 if(typeof cloudSyncEnabled!=='undefined'&&!cloudSyncEnabled)throw Error('Sincronização Supabase indisponível: comparação com a carteira real foi bloqueada para evitar resultado desatualizado.');
 if(String(yr)!=='2026')throw Error('Nesta homologação o ano autorizado para conferência é 2026.');
 if(!file||!/\.xlsx$/i.test(file.name))throw Error('Selecione uma planilha .xlsx.');
 if(file.size>20000000)throw Error('Planilha excede o limite de 20 MB.');
 if(!window.XLSX?.read)throw Error('Leitor Excel indisponível.');
 const book=window.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
 for(const name of ['Conferência de Documentos','Fechamento Contábil','DASHBOARD'])if(!book.SheetNames.includes(name))throw Error('Aba obrigatória não encontrada: '+name);
 const sheet=name=>window.XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,raw:true,defval:null,blankrows:true});
 preview=M.parseWorkbookRows(sheet('Conferência de Documentos'),sheet('Fechamento Contábil'),yr);
 // Somente simulação: M.merge faz deep clone de state e não possui API de gravação.
 // Pode comparar com o workspace autenticado já carregado, mas não envia o Excel à rede.
 if(typeof state==='undefined'||!Array.isArray(state.companies))throw Error('Workspace autenticado indisponível para comparação.');
 dryRun=M.merge(state,preview,'excel-preview-2026',window.ConciliaCloud?.accountId?.()||'');
 // Descartar cópia com dados reais simulados: manter somente números e conflitos,
 // não expor empresa/e-mail/CNPJ identificáveis em logs ou no PR.
 dryRun={counts:dryRun.counts};
 render();return {preview,counts:dryRun.counts};
}
function init(){
 const el=$('#documentsPanel');if(!el)return;
 el.addEventListener('click',event=>{
  const tab=event.target.closest('[data-doc-mode]');
  if(tab){mode=tab.dataset.docMode;editingId='';render();return;}
  const edit=event.target.closest('[data-doc-edit]');
  if(edit){editingId=edit.dataset.docEdit;editingMonth=Number(edit.dataset.docMonth);render();return;}
  if(event.target.closest('[data-doc-cancel]')){editingId='';render();return;}
  if(event.target.closest('[data-doc-preview]')){previewFile($('#docsExcel')?.files?.[0],$('#docsYearSource')?.value).catch(err=>alert(err.message));return;}
 });
 el.addEventListener('change',event=>{
  const k=event.target.dataset.docFilter;if(!k)return;
  const v=event.target.value;
  if(k==='year')year=v;
  if(k==='month')month=Number(v);
  if(k==='status')selectedStatus=v;
  if(k==='regime')selectedRegime=v;
  if(k==='plan')selectedPlan=v;
  if(k==='lifecycle')lifecycle=v;
  editingId='';render();
 });
 el.addEventListener('input',event=>{
  if(event.target.id==='docsSearch'){search=event.target.value;const caret=event.target.selectionStart;render();$('#docsSearch')?.focus();$('#docsSearch')?.setSelectionRange(caret,caret);}
 });
 el.addEventListener('submit',event=>{
  if(event.target.id!=='docsEditForm')return;
  event.preventDefault();saveEdit(event.target).catch(err=>alert(err.message));
 });
}
window.ConciliaDocuments={render,previewFile,saveEdit,canImportDefinitively:false};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();