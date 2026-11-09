/* Romeiro Dashboard: camada de VISUALIZAÇÃO e navegação.
   Não confirma, altera, salva ou remove lançamentos, planos, Razões ou documentos. */
(function(){
 'use strict';
 const $=s=>document.querySelector(s);
 const ui={tab:'all',selection:new Set(),query:'',bank:'',status:'',rows:[],visible:[]};
 const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
 const num=new Intl.NumberFormat('pt-BR');
 const pct=(n,total)=>total?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(n*100/total)+'%':'0%';
 const dateBR=s=>/^\d{4}-\d\d-\d\d$/.test(String(s||''))?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):String(s||'—');
 const symbol=(bank)=>{
  const n=String(bank||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(n.includes('itau'))return ['itau','Itaú'];
  if(n.includes('bradesco'))return ['bradesco','♜'];
  if(n.includes('santander'))return ['santander','♨'];
  if(n.includes('caixa'))return ['caixa','CA'];
  if(n.includes('stone'))return ['stone','S'];
  if(n.includes('sicredi'))return ['sicredi','Si'];
  if(n.includes('inter'))return ['inter','i'];
  if(n.includes('nubank'))return ['nubank','Nu'];
  return ['generic',(bank||'B').slice(0,2).toUpperCase()];
 };
 const statusFor=(m,conciliated,withLedger,ledgerErrors)=>{
  if(m.status==='PENDENTE_DUPLICIDADE'||ledgerErrors.has(m.id))return 'DIVERGENTE';
  if(conciliated.has(m.id))return 'CONCILIADO';
  if(withLedger&&m.status==='CONFIRMADO')return 'DIVERGENTE';
  return 'PENDENTE';
 };
 const td=(text,cls='',title='')=>{
  const cell=document.createElement('td');
  if(cls)cell.className=cls;
  cell.textContent=String(text??'');
  if(title)cell.title=title;
  return cell;
 };
 const panelFor=c=>{
  if(!c)return [];
  const moves=window.ConciliaCore.periodMovements(c,typeof period==='string'?period:$('#period').value);
  const accounts=new Map((c.accounts||[]).map(a=>[a.id,a]));
  let result={checked:[],errors:[]};
  try{result=window.ConciliaCore.reconcile(c,typeof period==='string'?period:$('#period').value);}catch(e){}
  const withLedger=(c.ledger||[]).some(l=>l.period===(typeof period==='string'?period:$('#period').value));
  const reconciled=new Set((result.checked||[]).filter(x=>x.recon==='CONCILIADO').flatMap(x=>x.sources||[x.id]));
  const failed=new Set((result.checked||[]).filter(x=>x.recon==='AMBIGUO').flatMap(x=>x.sources||[x.id]));
  return moves.map(m=>{
   const bankAccount=accounts.get(m.accountId)||{};
   const bank=bankAccount.bank||'Banco não identificado';
   const counterpart=String(m.counterpart||m.suggested||'');
   const bankCode=String(bankAccount.chartCode||'');
   const positive=m.cents>0;
   return {id:String(m.id),date:m.date,bank,cents:m.cents,history:String(m.financialDescription||m.history||''),debit:positive?bankCode:counterpart,credit:positive?counterpart:bankCode,status:statusFor(m,reconciled,withLedger,failed),suggested:!!(!m.counterpart&&m.suggested),review:m.financialMatch==='AMBIGUA'||!!(m.historicalCodeConflict||[]).length};
  }).sort((a,b)=>a.date.localeCompare(b.date)||a.bank.localeCompare(b.bank));
 };
 function render(){
  const body=$('#uiLedgerRows');if(!body)return;
  let c=null;
  try{if(typeof current==='function')c=current();}catch(e){}
  const rows=panelFor(c);ui.rows=rows;
  const totals={CONCILIADO:0,PENDENTE:0,DIVERGENTE:0};
  for(const r of rows)totals[r.status]++;
  const total=rows.length;
  for(const [id,value] of [['uiTotal',total],['uiConciliados',totals.CONCILIADO],['uiPendentes',totals.PENDENTE],['uiDivergentes',totals.DIVERGENTE]]){
   const el=$('#'+id);if(el)el.textContent=num.format(value);
  }
  for(const [id,value] of [['uiConciliadosPercent',totals.CONCILIADO],['uiPendentesPercent',totals.PENDENTE],['uiDivergentesPercent',totals.DIVERGENTE]]){$('#'+id).textContent=pct(value,total);}
  $('#uiPendingTabCount').textContent='('+num.format(totals.PENDENTE)+')';
  $('#uiDivergentTabCount').textContent='('+num.format(totals.DIVERGENTE)+')';
  const banks=[...new Set(rows.map(r=>r.bank))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const select=$('#uiBankFilter');
  if(select){
   const previous=ui.bank;
   select.replaceChildren(new Option('Todos',''),...banks.map(bank=>new Option(bank,bank)));
   ui.bank=banks.includes(previous)?previous:'';
   select.value=ui.bank;
  }
  ui.selection=new Set([...ui.selection].filter(id=>rows.some(r=>r.id===id)));
  renderRows();
 }
 function renderRows(){
  const el=$('#uiLedgerRows');if(!el)return;
  const query=ui.query.trim().toLocaleLowerCase('pt-BR');
  ui.visible=ui.rows.filter(r=>{
   if(ui.tab==='pending'&&r.status!=='PENDENTE')return false;
   if(ui.tab==='divergent'&&r.status!=='DIVERGENTE')return false;
   if(ui.bank&&ui.bank!==r.bank)return false;
   if(ui.status&&ui.status!==r.status)return false;
   if(!query)return true;
   return [r.date,dateBR(r.date),r.bank,r.history,r.debit,r.credit,brl.format(r.cents/100)].some(s=>String(s).toLocaleLowerCase('pt-BR').includes(query));
  });
  const frag=document.createDocumentFragment();
  for(const r of ui.visible.slice(0,500)){
   const tr=document.createElement('tr');
   const selectTd=document.createElement('td'),checkbox=document.createElement('input');
   checkbox.type='checkbox';checkbox.className='ui-row-check';checkbox.dataset.id=r.id;checkbox.setAttribute('aria-label','Selecionar lançamento em '+dateBR(r.date));checkbox.checked=ui.selection.has(r.id);
   selectTd.appendChild(checkbox);tr.appendChild(selectTd);
   tr.appendChild(td(dateBR(r.date)));
   const bankTd=document.createElement('td');
   const bankWrap=document.createElement('span');bankWrap.className='bank-token';
   const sym=document.createElement('span');const [key,sign]=symbol(r.bank);sym.className='bank-token-symbol '+key;sym.textContent=sign;bankWrap.appendChild(sym);
   const name=document.createElement('span');name.textContent=r.bank;bankWrap.appendChild(name);bankTd.appendChild(bankWrap);tr.appendChild(bankTd);
   tr.appendChild(td(r.debit||'—',r.suggested?'ui-suggested':'',r.suggested?'Código sugerido — requer confirmação':''));
   tr.appendChild(td(r.credit||'—',r.suggested?'ui-suggested':'',r.suggested?'Código sugerido — requer confirmação':''));
   tr.appendChild(td(brl.format(r.cents/100)));
   tr.appendChild(td(r.history||'Sem histórico','',r.review?'Descrição requer revisão':''));
   const statusTd=document.createElement('td'),badge=document.createElement('span');badge.className='ui-status '+(r.status==='CONCILIADO'?'ok':r.status==='DIVERGENTE'?'bad':'pending');badge.textContent=(r.status==='CONCILIADO'?'✓  Conciliado':r.status==='DIVERGENTE'?'⊗  Divergente':'◷  Pendente');statusTd.appendChild(badge);tr.appendChild(statusTd);
   const last=document.createElement('td'),more=document.createElement('button');more.type='button';more.className='ui-row-more';more.dataset.uiGo='movimentos';more.title='Conferir lançamento na tela Classificações';more.setAttribute('aria-label','Abrir classificação');more.textContent='⋯';last.appendChild(more);tr.appendChild(last);
   frag.appendChild(tr);
  }
  if(!ui.visible.length){const tr=document.createElement('tr');const cell=td(ui.rows.length?'Nenhum lançamento corresponde aos filtros.':'Nenhum lançamento importado nesta competência.','ui-empty');cell.colSpan=9;tr.appendChild(cell);frag.appendChild(tr);}
  if(ui.visible.length>500){const tr=document.createElement('tr'),cell=td('Exibindo os primeiros 500 de '+num.format(ui.visible.length)+' lançamentos. Refine os filtros para encontrar os demais.','ui-empty');cell.colSpan=9;tr.appendChild(cell);frag.appendChild(tr);}
  el.replaceChildren(frag);
  const count=$('#uiSelectionCount');if(count)count.textContent=num.format(ui.selection.size)+' lançamento(s) selecionado(s)';
  const all=$('#uiSelectAll');if(all){all.checked=ui.visible.length>0&&ui.visible.every(r=>ui.selection.has(r.id));all.indeterminate=ui.visible.some(r=>ui.selection.has(r.id))&&!all.checked;}
  document.querySelectorAll('.ui-tab').forEach(b=>{const active=b.dataset.uiTab===ui.tab;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active?'true':'false');});
 }
 function go(page,focusId){
  const target=document.querySelector('nav button[data-page="'+page+'"]');
  if(target)target.click();
  if(focusId){const focus=$('#'+focusId);if(focus){focus.scrollIntoView({behavior:'smooth',block:'start'});}}
 }
 document.addEventListener('click',e=>{
  const jump=e.target.closest('[data-ui-go]');
  if(jump){go(jump.dataset.uiGo,jump.dataset.uiFocus);return;}
  const tab=e.target.closest('[data-ui-tab]');
  if(tab){ui.tab=tab.dataset.uiTab;renderRows();return;}
  if(e.target.closest('#uiClearFilters')){ui.query='';ui.bank='';ui.status='';ui.tab='all';$('#uiMovementSearch').value='';$('#uiBankFilter').value='';$('#uiStatusFilter').value='';renderRows();return;}
  if(e.target.closest('#uiSettingsNav')||e.target.closest('#uiProfileTop')){const details=$('.cloud-settings');if(details){details.open=true;details.scrollIntoView({behavior:'smooth',block:'center'});}return;}
  if(e.target.closest('#uiHelpTop')){go('visao','workflowGuide');return;}
  if(e.target.closest('#uiReconcileSelected')||e.target.closest('#uiReviewSelections')){
   go('movimentos','movementTable');
   const note=$('#uiDashboardNote');
   if(note)note.textContent='A seleção na tabela é visual. Confirme ou revise os códigos individualmente na tela Classificações, sem lançamento automático.';
  }
 });
 document.addEventListener('change',e=>{
  if(e.target.id==='uiBankFilter'){ui.bank=e.target.value;renderRows();}
  if(e.target.id==='uiStatusFilter'){ui.status=e.target.value;renderRows();}
  if(e.target.id==='uiSelectAll'){for(const row of ui.visible){if(e.target.checked)ui.selection.add(row.id);else ui.selection.delete(row.id);}renderRows();}
  if(e.target.matches('.ui-row-check')){if(e.target.checked)ui.selection.add(e.target.dataset.id);else ui.selection.delete(e.target.dataset.id);renderRows();}
 });
 const search=$('#uiMovementSearch');
 if(search)search.addEventListener('input',e=>{ui.query=e.target.value;renderRows();});
 const metrics=$('#metrics');
 if(metrics)new MutationObserver(()=>{if(document.body.classList.contains('authenticated'))render();}).observe(metrics,{childList:true});
 const periodInput=$('#period'),companyInput=$('#companySelect');
 if(periodInput)periodInput.addEventListener('change',()=>{ui.selection.clear();ui.bank='';render();});
 if(companyInput)companyInput.addEventListener('change',()=>{ui.selection.clear();ui.bank='';render();});
 document.addEventListener('DOMContentLoaded',()=>{render();if(window.lucide?.createIcons)window.lucide.createIcons();});
 render();
})();
