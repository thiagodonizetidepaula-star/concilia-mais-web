/* ConCiliar+ | Política conservadora de retenção de documentos operacionais.
   A exclusão só é elegível quando competência >= 3 meses após o fechamento
   E o responsável registrou conclusão, envio ao Domínio e DRE conferida.
   Nunca remove empresas, configurações, planos, regras ou aprendizado. */
(function(global){'use strict';
 const validMonth=m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(m||''));
 const monthFromDate=d=>/^\d{4}-(0[1-9]|1[0-2])-\d{2}/.test(String(d||''))?String(d).slice(0,7):'';
 function expiration(month){
  if(!validMonth(month))return NaN;
  const [y,m]=month.split('-').map(Number);
  // Último dia do terceiro mês posterior ao encerramento da competência, UTC.
  return Date.UTC(y,m+3,0,23,59,59,999);
 }
 function verifiedRecord(record){
  return !!record?.end&&!!record?.dominioConfirmed&&!!record?.dreConfirmed;
 }
 function eligibleMonths(company,now=Date.now()){
  const tracking=company?.reconciliationTracking||{};
  return new Set(Object.entries(tracking).filter(([month,record])=>
   validMonth(month)&&verifiedRecord(record)&&now>expiration(month)
  ).map(([month])=>month));
 }
 const countBy=(o,name)=>{o[name]=(o[name]||0)+1;};
 function cleanupCompany(company,now=Date.now()){
  const eligible=eligibleMonths(company,now);
  const stats={eligible:[...eligible].sort(),deleted:{}};
  if(!eligible.size)return stats;
  const removeList=(field,match)=>{
   const items=company[field];if(!Array.isArray(items))return;
   const after=items.filter(item=>{
    if(!item||!match(item))return true;
    countBy(stats.deleted,field);return false;
   });
   company[field]=after;
  };
  const removableImportIds=new Set();
  for(const imp of company.imports||[]){
   const periods=Array.isArray(imp?.periods)?imp.periods:[];
   if(periods.length&&periods.every(p=>eligible.has(p))&&imp.id!=null)removableImportIds.add(String(imp.id));
  }
  removeList('imports',item=>removableImportIds.has(String(item?.id)));
  const removedMovements=new Set();
  removeList('movements',m=>{
   const month=monthFromDate(m?.date);
   const remove=month&&eligible.has(month);
   if(remove&&m.id!=null)removedMovements.add(String(m.id));
   return remove;
  });
  removeList('ledger',l=>validMonth(l?.period)&&eligible.has(l.period));
  removeList('financialControls',f=>validMonth(f?.period)&&eligible.has(f.period));
  removeList('taxSplits',t=>validMonth(t?.period)&&eligible.has(t.period));
  removeList('transfers',t=>removedMovements.has(String(t?.outId))||removedMovements.has(String(t?.inId)));
  // Revisões podem ser objeto indexado por competência OU lista mensal.
  if(company.reconciliationReview&&typeof company.reconciliationReview==='object'){
   if(Array.isArray(company.reconciliationReview)){
    removeList('reconciliationReview',r=>validMonth(r?.period)&&eligible.has(r.period));
   }else{
    for(const p of Object.keys(company.reconciliationReview)){
     if(eligible.has(p)){delete company.reconciliationReview[p];countBy(stats.deleted,'reconciliationReview');}
    }
   }
  }
  // O registro gerencial de conclusão é permanente. A política nunca o altera,
  // e não toca em plan/accounts/rules/plansHistory/partners/relatedCompanies/taxRules.
  return {...stats,removableImportIds:[...removableImportIds],removedMovements:[...removedMovements]};
 }
 function cleanupWorkspace(workspace,now=Date.now()){
  const result={companies:0,deleted:{},months:[]};
  if(!workspace||!Array.isArray(workspace.companies))return result;
  for(const c of workspace.companies){
   const x=cleanupCompany(c,now);
   if(!x.eligible.length)continue;
   result.companies++;
   result.months.push({companyId:c.id,months:x.eligible});
   for(const [field,total] of Object.entries(x.deleted))result.deleted[field]=(result.deleted[field]||0)+total;
   // Revisões ligadas a um import eliminado devem ser removidas somente do
   // conjunto operacional e apenas para empresas/competências elegíveis.
   if(Array.isArray(workspace.reviews)){
    const importIds=new Set(x.removableImportIds),movements=new Set(x.removedMovements);
    workspace.reviews=workspace.reviews.filter(r=>{
     if(r?.companyId!==c.id)return true;
     const period=validMonth(r?.period)?r.period:monthFromDate(r?.date);
     const linked=(r?.importId!=null&&importIds.has(String(r.importId)))||
       (r?.movementId!=null&&movements.has(String(r.movementId)));
     const shouldRemove=!!((period&&x.eligible.includes(period))||linked);
     if(shouldRemove)countBy(result.deleted,'reviews');
     return !shouldRemove;
    });
   }
  }
  return result;
 }
 global.ConciliaRetention={eligibleMonths,expiration,cleanupCompany,cleanupWorkspace};
})(window);
