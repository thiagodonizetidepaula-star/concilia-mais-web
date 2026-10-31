/* Concilia+ | motor de assistência operacional, sem acesso a serviços externos */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ConciliaAssistente=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[ch]));
const moeda=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((n||0)/100);
const dataBR=s=>String(s||'').split('-').reverse().join('/');
function divergenciasSaldo(c,period){
 const versions=(c.ledger||[]).filter(v=>v.period===period&&v.accountCode&&typeof v.openingBalance==='number');
 const byBank=new Map();for(const v of versions)byBank.set(String(v.accountCode),v);
 const out=[];
 for(const acc of c.accounts||[]){
   const version=byBank.get(String(acc.chartCode));if(!version)continue;
   const imports=(c.imports||[]).filter(i=>i.type==='EXTRATO'&&i.accountId===acc.id&&(i.periods||[]).includes(period)&&typeof i.balanceCheck?.final==='number');
   if(imports.length!==1)continue; // arquivos segmentados exigem consolidação antes de comparar saldos finais
   const imp=imports[0],bankSum=(version.entries||[]).reduce((sum,e)=>sum+(String(e.debit)===String(acc.chartCode)?e.cents:0)-(String(e.credit)===String(acc.chartCode)?e.cents:0),0);
   const accountingFinal=version.openingBalance+bankSum,bankFinal=imp.balanceCheck.final,difference=accountingFinal-bankFinal;
   if(Math.abs(difference)>1)out.push({bank:acc.bank,bankCode:acc.chartCode,accountingFinal,bankFinal,difference,reason:'Saldo final do Razão diferente do saldo final do extrato'});
 }
 return out;
}
function analisar(core,c,period){
 const zero={status:'SEM_PLANO',total:0,pending:0,divergences:0,ledger:false,ready:false,exportable:false,files:0,transfers:0,unverified:0,orphanBankLedger:0,withoutLedger:[],ledgerBalanceDifferences:[],pendingReading:0,notInLedger:0};
 if(!c||!c.plan?.length)return zero;
 const movements=core.periodMovements(c,period),mids=new Set(movements.map(m=>m.id));
 const transferred=new Set((c.transfers||[]).filter(t=>t.status==='CONFIRMADA'&&mids.has(t.outId)&&mids.has(t.inId)).flatMap(t=>[t.outId,t.inId]));
 const valid=new Set(c.plan.filter(x=>x.analytic).map(x=>String(x.code)));
 const bankCodes=new Set((c.accounts||[]).map(a=>String(a.chartCode)));
 const manual=movements.filter(m=>!transferred.has(m.id)&&!(m.status==='CONFIRMADO'&&valid.has(String(m.counterpart))));
 const imported=(c.imports||[]).filter(i=>i.type==='EXTRATO'&&(i.periods||[]).includes(period));
 const checkedBalances=imported.filter(i=>['OK','MANUAL_OK'].includes(i.balanceCheck?.status)).length;
 const unverified=imported.length-checkedBalances;
 const badBalances=imported.filter(i=>i.balanceCheck?.status==='DIVERGENTE').length;
 const pendingReading=imported.reduce((n,i)=>n+(i.reviewCount||0),0);
 const dup=movements.filter(m=>m.status==='PENDENTE_DUPLICIDADE').length;
 const versions=(c.ledger||[]).filter(l=>l.period===period),ledger=versions.length>0;
 const activeBanks=new Set(movements.map(m=>String(c.accounts.find(a=>a.id===m.accountId)?.chartCode||'')));
 const withoutLedger=[...activeBanks].filter(code=>!code||!versions.some(v=>String(v.accountCode||'')===code||(!v.accountCode&&(v.entries||[]).some(x=>String(x.debit)===code||String(x.credit)===code))));
 const checked=core.reconcile(c,period);
 const ambiguous=checked.checked.filter(x=>x.recon==='AMBIGUO').length;
 const notInLedger=checked.checked.filter(x=>x.recon==='NAO_ENCONTRADO_NO_RAZAO').length;
 const orphanBankLedger=ledger?checked.missingLedger.filter(l=>bankCodes.has(String(l.debit))||bankCodes.has(String(l.credit))).length:0;
 const invalidBank=movements.filter(m=>{const a=c.accounts.find(x=>x.id===m.accountId);return !a||!valid.has(String(a.chartCode))}).length;
 const transferCheck=core.transferSuggestions(c,period);
 const ledgerBalanceDifferences=divergenciasSaldo(c,period);
 const divergences=checked.errors.length+badBalances+dup+ambiguous+invalidBank+orphanBankLedger+ledgerBalanceDifferences.length;
 const pending=manual.length;
 const exportable=!!(movements.length&&ledger&&imported.length&&!pending&&!divergences&&!unverified&&!pendingReading&&!withoutLedger.length&&!transferCheck.ambiguous.length&&!transferCheck.proposals.length);
 const ready=exportable&&!notInLedger&&!withoutLedger.length;
 const status=ready?'CONFERIDO':exportable?'PRONTO_PARA_REVISAO':!movements.length?'SEM_EXTRATOS':divergences?'DIVERGENCIA':'PENDENTE';
 return {status,total:movements.length,pending,divergences,ledger,ready,exportable,notInLedger,files:imported.length,transfers:transferred.size/2,
 candidates:transferCheck.proposals.length,transferAmbiguous:transferCheck.ambiguous.length,
 confirmed:movements.length-pending,balancesBad:badBalances,unverified,pendingReading,withoutLedger,ledgerBalanceDifferences,orphanBankLedger,invalidBank,dup,ambiguous,
 entry:movements.filter(m=>m.cents>0).reduce((a,m)=>a+m.cents,0),
 exit:movements.filter(m=>m.cents<0).reduce((a,m)=>a+m.cents,0)};
}
function etapas(core,c,period){
 const v=analisar(core,c,period),plan=!!c?.plan?.length;
 return [
 ['Importar plano de contas','PDF do Domínio: empresa e códigos analíticos exclusivos',plan,'empresas'],
 ['Importar extratos bancários','Escolha vários PDFs, CSVs ou OFXs; cada PDF pode ter várias páginas',v.total>0,'importar'],
 ['Importar Razão da competência','Necessário para comparar lançamentos já contabilizados',v.ledger,'importar'],
 ['Conferir códigos, saldos e transferências',v.divergences?'Há divergências a tratar':v.pending+' contrapartida(s) pendente(s), '+v.unverified+' extrato(s) sem saldo validado, '+v.withoutLedger.length+' banco(s) sem Razão',v.total>0&&v.pending===0&&v.divergences===0&&v.unverified===0&&v.pendingReading===0&&!v.candidates,'movimentos'],
 ['Baixar Excel e PDF',v.ready?'Conciliação com Razão fechada':v.exportable?'Prévia de lançamentos disponível; validar antes do Domínio':'Conferência disponível com pendências destacadas',v.ready||v.exportable,'conciliacao']
 ];
}
function contasLinhas(core,c,period){
 const map=new Map(c.accounts.map(a=>[a.id,a])),plan=new Map(c.plan.map(x=>[String(x.code),x]));
 const mv=core.periodMovements(c,period).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.history.localeCompare(b.history));
 const paired=new Map();
 for(const t of c.transfers||[]){if(t.status!=='CONFIRMADA')continue;const o=mv.find(m=>m.id===t.outId),i=mv.find(m=>m.id===t.inId);if(!o||!i)continue;const src=map.get(o.accountId),dst=map.get(i.accountId);if(!src||!dst||src.id===dst.id)continue;paired.set(o.id,{debit:String(dst.chartCode),credit:String(src.chartCode),part:'origem'});paired.set(i.id,{debit:String(dst.chartCode),credit:String(src.chartCode),part:'destino'});}
 const recon=core.reconcile(c,period),jrn=new Map();for(const x of recon.checked)for(const id of x.sources||[])jrn.set(id,x);
 return mv.map(m=>{
  const bank=map.get(m.accountId),bankCode=String(bank?.chartCode||''),hasBank=plan.get(bankCode)?.analytic;
  const validated=m.status==='CONFIRMADO'&&plan.get(String(m.counterpart))?.analytic;
  const proposed=!validated&&plan.get(String(m.suggested))?.analytic;
  const transfer=paired.get(m.id),journal=jrn.get(m.id);
  let debit='',credit='',status='PENDENTE',tone='yellow',detail='Contrapartida não identificada: preenchimento manual';
  if(!hasBank){status='CÓDIGO DO BANCO INVÁLIDO';tone='red';detail='O código bancário não é conta analítica do plano';}
  else if(m.status==='PENDENTE_DUPLICIDADE'){status='POSSÍVEL DUPLICIDADE';tone='red';detail='Conferir repetição de extratos antes de contabilizar';}
  else if(transfer){debit=transfer.debit;credit=transfer.credit;status=transfer.part==='origem'?'TRANSFERÊNCIA VALIDADA':'PAR DA TRANSFERÊNCIA';tone='green';detail=transfer.part==='origem'?'Lançamento único entre as duas contas':'Não gerar segundo lançamento';}
  else if(validated||proposed){const cp=String(validated?m.counterpart:m.suggested);debit=m.cents>0?bankCode:cp;credit=m.cents>0?cp:bankCode;status=validated?'CÓDIGOS CONFIRMADOS':'SUGESTÃO A CONFERIR';tone=validated?'green':'yellow';detail=validated?'Contrapartida aprovada pelo operador':'Código sugerido; exige confirmação manual';}
  else {debit=m.cents>0?bankCode:'';credit=m.cents<0?bankCode:'';}
  if(journal?.recon==='AMBIGUO'){status='DIVERGÊNCIA NO RAZÃO';tone='red';detail='Há mais de um lançamento contábil com a mesma chave';}
  return {date:m.date,bank:bank?.bank||'',debit,credit,cents:m.cents,history:m.financialMatch==='SUGERIDA'&&(m.financialCategory||m.financialDescription)?String(m.financialCategory||m.financialDescription).replace(/^\s*(?:Controle(?: financeiro)?\s*:\s*)?/i,'').replace(/^\s*\d+(?:\.\d+)*\s*[-–.]?\s*/,'').trim():m.history,party:m.party||'',origin:m.origin||'',status,tone,detail,recon:journal?.recon||'NÃO COMPARADO'};
 });
}
function relatorioHtml(core,c,period){
 const s=analisar(core,c,period);if(!s.total)throw Error('Importe pelo menos um extrato da competência antes de gerar o PDF.');
 const rows=contasLinhas(core,c,period);
 const tr=rows.map(x=>'<tr class="'+x.tone+'"><td>'+esc(dataBR(x.date))+'</td><td>'+esc(x.bank)+'</td><td class="num">'+esc(x.debit||'—')+'</td><td class="num">'+esc(x.credit||'—')+'</td><td class="num">'+esc(moeda(x.cents))+'</td><td>'+esc(x.history)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.origin)+'</td></tr>').join('');
 const ad=typeof globalThis!=='undefined'&&globalThis.ConciliaAuditoria?globalThis.ConciliaAuditoria.audit(core,c,period):null;
 const warnings=ad?.events||[];
 const auditRows=warnings.map(e=>'<tr class="'+(e.tone==='red'?'red':'yellow')+'"><td>'+esc(dataBR(e.date))+'</td><td>'+esc(e.bank)+'</td><td>'+esc(e.sourceBank||'—')+' → '+esc(e.targetBank||'—')+'</td><td>'+esc(e.debit||'—')+' / '+esc(e.credit||'—')+'</td><td class="num">'+esc(moeda(e.cents))+'</td><td>'+esc(e.type.replaceAll('_',' '))+'</td><td>'+esc(e.evidence)+'</td><td>'+esc(e.action)+'</td></tr>').join('');
 const auditHtml='<section class="audit-section"><h2>Quadro de divergências e transferências para revisão</h2><p class="subtitle">'+warnings.length+' ocorrência(s) • O aplicativo não altera lançamentos no Domínio nem aprova sugestões sem conferência.</p>'+(warnings.length?'<table class="audit-table"><thead><tr><th>Data</th><th>Banco</th><th>Origem → Destino</th><th>Débito / Crédito</th><th>Valor</th><th>Ocorrência</th><th>Evidência</th><th>O que conferir</th></tr></thead><tbody>'+auditRows+'</tbody></table>':'<p>Nenhuma ocorrência encontrada pelos critérios disponíveis. A integridade dos documentos ainda precisa ser validada.</p>')+'</section>';
 const title=esc(c.name||'Empresa'),compet=esc(period);
 const msg=s.ready?'CONCILIAÇÃO COM RAZÃO CONCLUÍDA - REVISÃO FINAL RECOMENDADA':s.exportable?'CONFERÊNCIA OPERACIONAL PRONTA - LANÇAMENTOS AUSENTES NO RAZÃO EXIGEM REVISÃO':s.divergences?'CONFERÊNCIA COM DIVERGÊNCIAS - NÃO FINALIZADA':'CONFERÊNCIA PARCIAL - PENDÊNCIAS E/OU SALDOS NÃO VERIFICADOS';
 return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Concilia+ | '+title+' | '+compet+'</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#163049;font-size:10px}header{border-bottom:3px solid #087993;padding-bottom:12px;margin-bottom:12px}h1{margin:0;color:#0b6077;font-size:22px}.subtitle{font-size:12px;color:#62758a;margin-top:4px}.grid{display:flex;gap:8px;margin:12px 0}.k{flex:1;padding:10px;border-radius:7px;background:#f0f6fa;border:1px solid #d7e7ed}.k strong{display:block;font-size:15px}.k span{font-size:9px;color:#567}.alert{border-left:4px solid #d9992d;background:#fff8e7;padding:9px;margin:12px 0}.bad{border-color:#ba493b;background:#fff0ed}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.3px}thead{display:table-header-group}th{background:#173b53;color:white;text-align:left;padding:7px 4px}td{border-bottom:1px solid #e5ebee;padding:6px 4px;overflow-wrap:anywhere;vertical-align:top}tr{break-inside:avoid}.num{text-align:right;white-space:nowrap}th:nth-child(1){width:10%}th:nth-child(2){width:8%}th:nth-child(3),th:nth-child(4){width:8%}th:nth-child(5){width:11%}th:nth-child(6){width:24%}th:nth-child(7){width:17%}th:nth-child(8){width:14%}.yellow{background:#fff8db}.red{background:#ffe6e1}.green{background:#effaf3}.legend{margin:10px 0;padding:8px;border:1px solid #e2e8ed}.footer{font-size:9px;color:#677c8a;margin-top:16px;border-top:1px solid #ddd;padding-top:8px}.audit-section{break-before:page;margin-top:16px}.audit-section h2{font-size:17px;color:#0b6077;margin:10px 0}.audit-table th:nth-child(1){width:9%}.audit-table th:nth-child(2){width:9%}.audit-table th:nth-child(3){width:13%}.audit-table th:nth-child(4){width:10%}.audit-table th:nth-child(5){width:11%}.audit-table th:nth-child(6){width:13%}.audit-table th:nth-child(7){width:16%}.audit-table th:nth-child(8){width:19%}@media print{.noprint{display:none}}@media screen{body{padding:20px;max-width:1250px;margin:auto}.noprint{background:#087993;color:white;border:0;border-radius:8px;padding:12px;margin:8px 0;font-size:15px;cursor:pointer}}</style></head><body><button class="noprint" onclick="window.print()">Imprimir / Salvar como PDF</button><header><h1>Concilia+ | Relatório de Conciliação</h1><div class="subtitle">'+title+' &nbsp; • &nbsp; CNPJ '+esc(c.cnpj||'não identificado')+' &nbsp; • &nbsp; Competência '+compet+'</div></header><div class="grid"><div class="k"><span>Movimentações</span><strong>'+s.total+'</strong></div><div class="k"><span>Entradas</span><strong>'+esc(moeda(s.entry))+'</strong></div><div class="k"><span>Saídas</span><strong>'+esc(moeda(s.exit))+'</strong></div><div class="k"><span>Pendências manuais</span><strong>'+s.pending+'</strong></div><div class="k"><span>Divergências</span><strong>'+s.divergences+'</strong></div></div><div class="alert '+(s.divergences?'bad':'')+'"><strong>'+msg+'</strong><div>Razão da competência: '+(s.ledger?'importado':'não importado')+' • Transferências confirmadas: '+s.transfers+' • Extratos: '+s.files+' • Saldos não verificados: '+s.unverified+' • Linhas em revisão: '+s.pendingReading+' • Razão bancário sem par: '+s.orphanBankLedger+' • Contas sem Razão: '+s.withoutLedger.join(', ')+' • Diferenças de saldo entre Razão e banco: '+s.ledgerBalanceDifferences.map(d=>d.bank+' ('+d.bankCode+'): '+new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(d.difference/100)).join('; ')+' • Novos lançamentos candidatos: '+s.notInLedger+'</div></div><div class="legend">Cores: <b>verde</b> = códigos/transferências confirmados; <b>amarelo</b> = pendência manual ou sugestão; <b>vermelho</b> = divergência ou possível duplicidade. Nenhum código foi inventado. O extrato pode estar matematicamente conferido sem o Razão estar conciliado.</div><table><thead><tr><th>Data</th><th>Banco</th><th>Cód. Débito</th><th>Cód. Crédito</th><th>Valor (R$)</th><th>Histórico</th><th>Situação</th><th>Arquivo origem</th></tr></thead><tbody>'+tr+'</tbody></table>'+auditHtml+'<div class="footer">Relatório de apoio à conciliação contábil • Gerado em '+esc(new Date().toLocaleString('pt-BR'))+' • Prévia para conferência; valide antes de importar no Domínio. Arquivos originais e códigos permanecem associados à empresa.</div></body></html>';
}
/* Recomeçar a competência ou todas as importações da empresa,
   sem afetar plano, contas bancárias, regras e outras empresas. */
function restaurarImportacoes(c,period,reviews=[],scope='period'){
 if(!c||!Array.isArray(c.movements)||!Array.isArray(c.ledger)||!Array.isArray(c.imports))throw Error('Empresa não configurada.');
 if(scope!=='period'&&scope!=='company')throw Error('Escopo de restauração inválido.');
 if(scope==='period'&&!/^\d{4}-\d{2}$/.test(period))throw Error('Selecione uma competência válida.');
 const documentTypes=new Set(['EXTRATO','RAZAO']);
 const files=c.imports.filter(i=>documentTypes.has(i.type)&&(scope==='company'||(i.periods||[]).includes(period)));
 if(scope==='period'){
   const mixed=files.filter(i=>(i.periods||[]).some(p=>p!==period));
   if(mixed.length)throw Error('Os arquivos '+mixed.map(i=>i.name).join(', ')+' também contêm outras competências. Para evitar apagar dados de outros meses, escolha “Todos os períodos da empresa” ou refaça esses arquivos individualmente.');
 }
 const ids=new Set(files.map(i=>i.id));
 const isForPeriod=r=>scope==='company'||String(r.date||r.period||'').slice(0,7)===period;
 const removedMovements=c.movements.filter(isForPeriod),movementsIds=new Set(removedMovements.map(m=>m.id));
 const removedLedger=c.ledger.filter(v=>scope==='company'||v.period===period);
 const removedTransfers=(c.transfers||[]).filter(t=>scope==='company'||movementsIds.has(t.outId)||movementsIds.has(t.inId));
 // Revisões modernas têm importId. Para arquivos antigos, só apagar por nome quando
 // nenhum outro documento da empresa tem o mesmo nome.
 const originalNames=new Set(files.filter(i=>!c.imports.some(other=>other.id!==i.id&&other.name===i.name)).map(i=>i.name));
 const retainedReviews=(reviews||[]).filter(r=>!(r.companyId===c.id&&(scope==='company'||(r.importId?ids.has(r.importId):originalNames.has(r.origin)))));
 const stats={movements:removedMovements.length,ledgerVersions:removedLedger.length,transfers:removedTransfers.length,imports:files.length,reviews:(reviews||[]).length-retainedReviews.length};
 c.movements=c.movements.filter(m=>!isForPeriod(m));
 c.ledger=c.ledger.filter(v=>!(scope==='company'||v.period===period));
 c.transfers=(c.transfers||[]).filter(t=>!removedTransfers.includes(t));
 c.imports=c.imports.filter(i=>!ids.has(i.id));
 return {stats,reviews:retainedReviews};
}
function remover(c,item,allReviews){
 if(!c||!item||!['EXTRATO','RAZAO'].includes(item.type))throw Error('Apenas extrato ou versão do Razão podem ser excluídos.');
 const duplicatedName=c.imports.some(i=>i.id!==item.id&&i.type===item.type&&i.name===item.name);
 const oldUntagged=item.type==='EXTRATO'?c.movements.some(m=>m.origin===item.name&&!m.importId):c.ledger.some(l=>l.file===item.name&&!l.importId);
 if(duplicatedName&&oldUntagged)throw Error('Arquivos antigos com o mesmo nome: exclusão não é segura. Faça backup e revise manualmente.');
 const owned=(r)=>r.importId? r.importId===item.id : r.origin===item.name;
 const dropped=item.type==='EXTRATO'?c.movements.filter(owned):[];
 const ids=new Set(dropped.map(m=>m.id));
 c.movements=c.movements.filter(m=>!ids.has(m.id));
 c.transfers=(c.transfers||[]).filter(t=>!ids.has(t.outId)&&!ids.has(t.inId));
 if(item.type==='RAZAO')c.ledger=c.ledger.filter(l=>l.importId?l.importId!==item.id:!(l.file===item.name&&(item.periods||[]).includes(l.period)));
 c.imports=c.imports.filter(i=>i.id!==item.id);
 const reviews=allReviews.filter(r=>!(r.companyId===c.id&&(r.importId?r.importId===item.id:r.origin===item.name)));
 return {removed:dropped.length,reviews};
}
return {analisar,divergenciasSaldo,etapas,contasLinhas,relatorioHtml,remover,restaurarImportacoes};
});
