/* Revisão e fechamento da conciliação no rascunho local da conta. */
(() => {
 'use strict';

 const form = $('#closingForm');
 const approve = $('#closingApprove');
 const status = $('#closingStatus');
 let context = '';
 let renderVersion = 0;
 let saving = false;

 function pending(company, month) {
  const imports = company.imports.filter(item => item.periods?.includes(month));
  const importIds = new Set(imports.map(item => item.id));
  const movements = Core.periodMovements(company, month);
  const issues = [];
  const discarded = new Set((company.reconciliationReview?.[month]?.decisions || [])
   .filter(item => item.decision === 'Arquivo rejeitado descartado').map(item => item.issueId));

  for (const item of imports) {
   if (item.type !== 'EXTRATO' || ['OK', 'MANUAL_OK'].includes(item.balanceCheck?.status)) continue;
   issues.push({
    id: JSON.stringify(['saldo', item.id, item.balanceCheck?.status, item.balanceCheck?.difference]),
    type: item.balanceCheck?.status === 'DIVERGENTE' ? 'Saldo divergente' : 'Saldo a conferir',
    source: item.name,
    detail: item.balanceCheck?.reason || 'Confira os saldos na lista de importações.',
    page: 'importar'
   });
  }
  for (const movement of movements.filter(item => item.status === 'PENDENTE_DUPLICIDADE')) {
   issues.push({
    id: 'duplicidade:' + movement.id, movementId: movement.id, type: 'Possível duplicidade',
    source: movement.origin,
    detail: datePT(movement.date) + ' · ' + currency(movement.cents) + ' · ' + movement.history,
    page: 'movimentos'
   });
  }
  for (const review of state.reviews.filter(item => item.companyId === company.id &&
   (importIds.has(item.importId) || (item.operational && !item.importId && item.period === month)))) {
   issues.push({
    id: JSON.stringify(['leitura', review.importId, review.origin, review.line, review.reason, review.content]),
    discardable: !review.importId,
    type: 'Linha a revisar', source: review.origin,
    detail: [review.line, review.reason, review.content].filter(Boolean).join(' · '), page: 'revisao'
   });
  }
  const audit = window.ConciliaAuditoria.audit(Core, company, month);
  for (const event of audit.events) {
   issues.push({
    id: JSON.stringify([event.type, event.movementId, event.bank, event.date, event.cents,
     event.document, event.documentNo, event.history, event.evidence]),
    type: event.type.replaceAll('_', ' '), source: event.document,
    detail: [event.history, event.evidence].filter(Boolean).join(' · '),
    page: event.type.startsWith('TRANSFERENCIA') ? 'transferencias' : 'conciliacao'
   });
  }
  return [...new Map(issues.filter(issue => !discarded.has(issue.id)).map(issue => [issue.id, issue])).values()];
 }

 function reviewRecord(company, month) {
  company.reconciliationReview ||= {};
  return company.reconciliationReview[month] ||= {decisions: [], approvals: []};
 }

 function evidence(company, month) {
  const moves = Core.periodMovements(company, month);
  const movementIds = new Set(moves.map(move => move.id));
  const accounts = new Set(moves.map(move => move.accountId));
  const review = company.reconciliationReview?.[month];
  return JSON.stringify([
   company.id, month, company.reconciliationTracking?.[month]?.end,
   moves, company.accounts.filter(account => accounts.has(account.id)),
   company.imports.filter(item => item.periods?.includes(month)),
   company.ledger.filter(item => item.period === month),
   company.transfers.filter(item => movementIds.has(item.outId) || movementIds.has(item.inId)),
   company.plan.map(item => [item.code, item.analytic]),
   review?.decisions || []
  ]);
 }

 function canApprove(company, month, issues) {
  return !!company?.reconciliationTracking?.[month]?.end && !issues.length &&
   window.ConciliaAssistente.analisar(Core, company, month).ready;
 }

 function timestamp(value) {
  return new Intl.DateTimeFormat('pt-BR', {
   dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo'
  }).format(new Date(value));
 }

 function render() {
  const version = ++renderVersion;
  const company = current(), month = period;
  const key = company ? company.id + '|' + month : '';
  if (key !== context) {context = key; form.reset();}
  const issues = company ? pending(company, month) : [];
  const record = company?.reconciliationReview?.[month];
  const decisions = record?.decisions || [];
  const approvals = record?.approvals || [];
  const byIssue = new Map(decisions.map(item => [item.issueId, item]));
  const latest = approvals.at(-1);

  $('#pendingSummary').textContent = company
   ? company.name + ' · ' + month + ' · ' + issues.length + ' pendência(s) ativa(s)'
   : 'Selecione uma empresa e uma competência.';
  $('#pendingList').innerHTML = company&&!issues.length
   ? (window.ConciliaAssistente?.analisar?.(Core,company,month)?.ready
      ? '<div class="pendencias-ok" role="status">✓ Nenhuma pendência identificada. Todas as classificações e validações necessárias foram concluídas.</div>'
      : '<div class="pendencias-neutral" role="status">Nenhuma ocorrência de revisão listada. A conciliação ainda pode exigir lançamentos ou conferência antes da aprovação.</div>')
   : table(['Ocorrência', 'Arquivo de origem', 'Evidência', 'Revisão', 'Ações'],
   issues.map((issue, index) => [
    safe(issue.type), safe(issue.source || '—'), safe(issue.detail),
    safe(byIssue.get(issue.id)?.reason || 'A revisar'),
    '<button type="button" class="secondary" data-open-issue="' + index + '">Ir para conferência</button> ' +
    '<button type="button" class="secondary" data-review-issue="' + index + '">Registrar análise</button>'
   ]));
  $('#pendingHistory').innerHTML = table(['Ocorrência', 'Arquivo', 'Decisão', 'Justificativa', 'Operador', 'Data'],
   decisions.slice().reverse().map(item => [
    safe(item.type), safe(item.source || '—'), safe(item.decision), safe(item.reason),
    safe(item.operator), safe(timestamp(item.at))
   ]));
  $('#closingHistory').innerHTML = table(['Aprovado em', 'Operador', 'Trabalho concluído em'],
   approvals.slice().reverse().map(item => [safe(timestamp(item.at)), safe(item.operator), safe(datePT(item.workEnd))]));

  approve.disabled = true;
  if (!company) {status.textContent = 'Selecione uma empresa e uma competência.';return;}
  const eligible = canApprove(company, month, issues);
  status.textContent = eligible ? 'Marque os itens conferidos para aprovar.' :
   'Registre a conclusão do trabalho e resolva as pendências da conciliação para liberar a aprovação.';
  approve.disabled = !eligible || saving;
  if (!latest) return;

  approve.disabled = true;
  const snapshot = evidence(company, month);
  hash(new TextEncoder().encode(snapshot)).then(digest => {
   if (version !== renderVersion) return;
   const valid = digest === latest.digest && eligible;
   status.textContent = valid
    ? 'Fechamento aprovado em ' + timestamp(latest.at) + ' por ' + latest.operator + '.'
    : 'Os dados da competência mudaram após a última aprovação. Faça uma nova conferência.';
   approve.disabled = valid || !eligible || saving;
  }).catch(error => {if (version === renderVersion) status.textContent = error.message;});
 }

 $('#pendingList').addEventListener('click', event => {
  const button = event.target.closest('[data-open-issue],[data-review-issue]');
  if (!button) return;
  action(async () => {
   const company = getCompany(), month = period;
   const issue = pending(company, month)[Number(button.dataset.openIssue ?? button.dataset.reviewIssue)];
   if (!issue) return;
   if (button.dataset.openIssue !== undefined) {
    showPage(issue.page);
    if (issue.movementId) {
     const movement = company.movements.find(item => item.id === issue.movementId);
     if (movement) {
      selectedMovementStatement = movementOriginKey(movement);
      renderMovements();
     }
    }
    return;
   }
   const distinct = issue.movementId && confirm('Os comprovantes demonstram que esta movimentação é uma operação distinta? OK para confirmar; Cancelar para registrar apenas a análise.');
   const discard = issue.discardable && confirm('Este arquivo rejeitado pode ser descartado da triagem desta competência? OK para descartar; Cancelar para registrar apenas a análise.');
   const reason = prompt('Descreva a decisão e a evidência conferida.');
   if (reason === null) return;
   if (!reason.trim()) throw Error('Informe a justificativa da análise.');
   const movement = distinct ? company.movements.find(item => item.id === issue.movementId) : null;
   const review = reviewRecord(company, month);
   const decision = {
    issueId: issue.id, type: issue.type, source: issue.source, reason: reason.trim(),
    decision: distinct ? 'Operação distinta' : discard ? 'Arquivo rejeitado descartado' : 'Análise registrada',
    at: new Date().toISOString(), operator: window.ConciliaCloud.identity()
   };
   if (movement) movement.status = 'PENDENTE';
   review.decisions.push(decision);
   try {await store('PENDENCIA_REVISADA', month);}
   catch (error) {
    review.decisions.splice(review.decisions.indexOf(decision), 1);
    if (movement) movement.status = 'PENDENTE_DUPLICIDADE';
    throw error;
   }
   say(movement ? 'Operação distinta registrada. Confirme a contrapartida em Classificações.' : 'Análise registrada no histórico.');
  });
 });

 form.addEventListener('submit', event => {
  event.preventDefault();
  if (saving) return;
  action(async () => {
   const company = getCompany(), month = period;
   if (!form.reportValidity() || !canApprove(company, month, pending(company, month)))
    throw Error('Conclua o checklist e resolva as pendências antes de aprovar.');
   saving = true;
   approve.disabled = true;
   try {
    const snapshot = evidence(company, month);
    const digest = await hash(new TextEncoder().encode(snapshot));
    if (company !== current() || month !== period || snapshot !== evidence(company, month) ||
        !canApprove(company, month, pending(company, month))) throw Error('Os dados mudaram. Confira novamente.');
    const record = reviewRecord(company, month);
    if (record.approvals.at(-1)?.digest === digest) throw Error('Esta versão já foi aprovada.');
    const approval = {at: new Date().toISOString(), operator: window.ConciliaCloud.identity(),
     workEnd: company.reconciliationTracking[month].end, digest};
    record.approvals.push(approval);
    try {await store('FECHAMENTO_APROVADO', month);}
    catch (error) {record.approvals.pop();throw error;}
    form.reset();
    say('Fechamento aprovado.');
   } finally {saving = false;render();}
  });
 });

 window.ConciliaReview = {render};
})();
