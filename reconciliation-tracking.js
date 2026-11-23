/* Registro gerencial por empresa e competência, persistido com o cadastro. */
(() => {
 'use strict';

 const form = $('#reconciliationTrackingForm');
 const companyFilter = $('#trackingCompanyFilter');
 const periodFilter = $('#trackingPeriodFilter');
 const statusFilter = $('#trackingStatusFilter');
 let context = null;
 let saving = false;

 function renderHistory() {
  const records = state.companies.flatMap(company =>
   Object.entries(company.reconciliationTracking || {}).map(([month, record]) => ({
    ...record, companyId: company.id, companyName: company.name, month
   }))
  ).filter(record =>
   (!companyFilter.value || record.companyId === companyFilter.value) &&
   (!periodFilter.value || record.month === periodFilter.value) &&
   (!statusFilter.value || statusFilter.value === (record.end ? 'done' : 'open'))
  ).sort((a, b) => b.month.localeCompare(a.month) || a.companyName.localeCompare(b.companyName, 'pt-BR'));
  const completed = records.filter(record => record.end).length;
  $('#trackingTotals').textContent = records.length + ' registradas · ' + completed +
   ' concluídas · ' + (records.length - completed) + ' em andamento · ' +
   new Set(records.map(record => record.companyId)).size + ' empresas';
  $('#trackingHistory').innerHTML = table(
   ['Empresa', 'Competência', 'Início', 'Conclusão', 'Duração', 'Situação', 'Observações', 'Ação'],
   records.map(record => [
    safe(record.companyName), safe(record.month.split('-').reverse().join('/')),
    safe(datePT(record.start)), record.end ? safe(datePT(record.end)) : '—',
    record.end ? Core.dayDistance(record.start, record.end) + ' dia(s)' : '—',
    badge(record.end ? 'CONCLUÍDA' : 'EM ANDAMENTO'), safe(record.notes || '—'),
    '<button type="button" class="secondary" data-tracking-company="' + safe(record.companyId) +
     '" data-tracking-month="' + safe(record.month) + '">Editar registro</button>'
   ])
  );
 }

 function render() {
  const company = current();
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
  const key = company && validMonth ? company.id + '|' + period : '';
  if (context !== key) {
   context = key;
   const record = key ? company.reconciliationTracking?.[period] : null;
   form.elements.start.value = record?.start || '';
   form.elements.end.value = record?.end || '';
   form.elements.notes.value = record?.notes || '';
  }
  $('#reconciliationTrackingContext').textContent = key
   ? company.name + ' · ' + period.split('-').reverse().join('/')
   : 'Selecione uma empresa e uma competência.';
  $('#saveTracking').disabled = !key || saving;

  const selected = companyFilter.value;
  companyFilter.innerHTML = '<option value="">Todas</option>' + state.companies.map(item =>
   '<option value="' + safe(item.id) + '">' + safe(item.name) + '</option>'
  ).join('');
  if (state.companies.some(item => item.id === selected)) companyFilter.value = selected;
  renderHistory();
 }

 form.addEventListener('submit', event => {
  event.preventDefault();
  if (saving) return;
  action(async () => {
   const company = getCompany();
   const month = period;
   if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error('Selecione uma competência válida.');
   const start = Core.date(form.elements.start.value);
   const end = form.elements.end.value ? Core.date(form.elements.end.value) : '';
   if (end && end < start) throw Error('A data de conclusão deve ser igual ou posterior ao início.');
   const previous = company.reconciliationTracking?.[month];
   const notes = form.elements.notes.value.trim();
   company.reconciliationTracking ||= {};
   company.reconciliationTracking[month] = {start, end, notes, updatedAt: new Date().toISOString()};
   saving = true;
   render();
   try {
    await store('CONTROLE_CONCILIACAO_SALVO', month + ' · ' + (end ? 'Concluída' : 'Em andamento'));
    say(cloudSyncEnabled ? 'Registro salvo.' : 'Registro salvo neste navegador. Confira a sincronização da conta.');
   } catch (error) {
    if (previous) company.reconciliationTracking[month] = previous;
    else delete company.reconciliationTracking[month];
    throw error;
   } finally {
    saving = false;
    render();
   }
  });
 });

 for (const filter of [companyFilter, periodFilter, statusFilter]) {
  filter.addEventListener('change', renderHistory);
 }
 $('#trackingHistory').addEventListener('click', event => {
  const button = event.target.closest('button[data-tracking-company]');
  if (!button) return;
  companyId = button.dataset.trackingCompany;
  period = button.dataset.trackingMonth;
  $('#period').value = period;
  renderSelection();
  render();
  form.elements.start.focus();
 });

 window.ConciliaTracking = {render};
})();
