/* ConCiliar+ — Melhoria 05 (isolada, nao publicada).
   Calculos puros, sem mutar registros contabeis e sem inferir qualidade a partir de velocidade. */
(function(root,factory){const core=factory();if(typeof module==='object'&&module.exports)module.exports=core;root.Concilia05Core=core;})(typeof globalThis!=='undefined'?globalThis:this,()=>{'use strict';
const TYPES=['quality','goal','competency','diary','achievement','development'];
const CATEGORIES=['Processo interno','Documentação do cliente','Arquivo importado','Regra contábil','Classificação manual','Automação','Configuração do sistema','Falha técnica','Falta de informações','Outros fatores'];
const LEVELS=['Não avaliado','Em aprendizagem','Em desenvolvimento','Aplicação prática','Proficiente','Avançado'];
const ISO=/^20\d\d-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const arr=x=>Array.isArray(x)?x:[];
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const finite=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:null;
const percent=(n,d)=>d>0?Math.round(1000*n/d)/10:null;
const validDay=x=>ISO.test(String(x))&&!Number.isNaN(Date.parse(x+'T00:00:00Z'));
const text=s=>String(s??'').trim().slice(0,2000);
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);
function blank(){return {version:1,quality:[],goals:[],competencies:[],diary:[],achievements:[],development:[],updatedAt:null};}
function normalize(x){const o=obj(x),b=blank();for(const k of Object.keys(b))if(Array.isArray(b[k]))b[k]=arr(o[k]).filter(y=>y&&typeof y==='object'&&typeof y.id==='string');return {...b,updatedAt:o.updatedAt||null};}
function create(kind,data,actorId,now=new Date()){
 if(!TYPES.includes(kind))throw Error('Tipo de registro desconhecido');
 if(!actorId)throw Error('Conta autenticada obrigatória');
 const d=obj(data),at=now.toISOString();
 const record={id:uid(),ownerId:actorId,createdAt:at,updatedAt:at,companyId:text(d.companyId||''),period:text(d.period||''),title:text(d.title),description:text(d.description),status:text(d.status||'Aberta'),source:'manual',audit:[{at,actorId,action:'create'}]};
 if(kind==='quality'){
   if(!record.title)throw Error('Descreva a ocorrência');
   record.category=CATEGORIES.includes(d.category)?d.category:'Outros fatores';
   record.severity=['Baixa','Média','Alta'].includes(d.severity)?d.severity:'Média';
   record.cause=text(d.cause);record.correctiveAction=text(d.correctiveAction);record.resolvedAt=null;record.status='Aberta';
 }
 if(kind==='goal'){
   if(!record.title||!text(d.metric))throw Error('Informe título e indicador da meta');
   record.metric=text(d.metric);record.start=validDay(d.start)?d.start:null;record.deadline=validDay(d.deadline)?d.deadline:null;
   record.baseline=finite(d.baseline)??0;record.target=finite(d.target);record.manualActual=finite(d.manualActual);
   record.direction=d.direction==='decrease'?'decrease':'increase';
   if(record.target===null||record.target===record.baseline)throw Error('Meta necessita resultado numérico diferente do inicial');
   if(record.direction==='increase'&&record.target<=record.baseline||record.direction==='decrease'&&record.target>=record.baseline)throw Error('Direção e valores da meta incompatíveis');
   record.status='Ativa';
 }
 if(kind==='competency'){
   if(!record.title)throw Error('Informe competência');
   record.level=LEVELS.includes(d.level)?d.level:'Não avaliado';record.evidence=text(d.evidence);record.status='Autoavaliação';
 }
 if(kind==='development'){
   if(!record.title)throw Error('Informe objetivo de desenvolvimento');
   record.action=text(d.action);record.expected=text(d.expected);record.deadline=validDay(d.deadline)?d.deadline:null;record.status='Em desenvolvimento';
 }
 if(kind==='diary'||kind==='achievement'){if(!record.title)throw Error('Informe título do registro');record.date=validDay(d.date)?d.date:at.slice(0,10);}
 return record;
}
function edit(previous,patch,actorId,now=new Date()){
 if(!previous||previous.ownerId!==actorId)throw Error('Edição não autorizada');
 const allowed=['title','description','status','category','severity','cause','correctiveAction','resolvedAt','level','evidence','action','expected','deadline','manualActual'];
 const changes={};for(const k of allowed)if(Object.prototype.hasOwnProperty.call(obj(patch),k)){
  let v=patch[k];if(['manualActual'].includes(k)){v=v===null?null:finite(v);if(v===null&&patch[k]!==null)throw Error('Número inválido');}
  else v=text(v);
  if(k==='deadline'&&v&&!validDay(v))throw Error('Data inválida');
  changes[k]=v;
 }
 if(changes.level&&!LEVELS.includes(changes.level))throw Error('Nível inválido');
 const at=now.toISOString();
 return {...previous,...changes,updatedAt:at,audit:[...arr(previous.audit),{at,actorId,action:'edit',changes:Object.fromEntries(Object.keys(changes).map(k=>[k,{before:previous[k]??null,after:changes[k]}]))}]};
}
function saveRecord(state,kind,record,actorId){
 if(!TYPES.includes(kind))throw Error('Coleção inválida');
 if(record.ownerId!==actorId)throw Error('Usuário não autorizado');
 const s=normalize(state),key=kind==='quality'?'quality':kind==='goal'?'goals':kind==='competency'?'competencies':kind==='diary'?'diary':kind==='achievement'?'achievements':'development';
 const items=arr(s[key]);const i=items.findIndex(x=>x.id===record.id);
 const next=i<0?[...items,record]:items.map((x,j)=>j===i?record:x);
 return {...s,[key]:next,updatedAt:record.updatedAt};
}
function resultGoals(goal,source){
 const d=obj(goal);
 const actual=finite(source?.[d.metric])??finite(d.manualActual);
 if(actual===null)return {actual:null,progress:null,source:'indisponível',status:d.status||'Ativa'};
 const base=finite(d.baseline)??0,target=finite(d.target);
 if(target===null||target===base)return {actual,progress:null,source:'inconsistente',status:d.status||'Ativa'};
 const fraction=(actual-base)/(target-base),progress=Math.max(0,Math.min(100,Math.round(fraction*1000)/10));
 return {actual,progress,source:finite(source?.[d.metric])!==null?'indicador':'manual',status:d.status||'Ativa'};
}
function summarizeQuality(records){
 const rs=arr(records),resolved=rs.filter(x=>x.status==='Resolvida'),reviewed=rs.filter(x=>x.status==='Aprovada'),open=rs.filter(x=>x.status==='Aberta');
 const durations=resolved.map(r=>r.resolvedAt&&r.createdAt?(Date.parse(r.resolvedAt)-Date.parse(r.createdAt))/3600000:null).filter(x=>finite(x)!==null);
 return {total:rs.length,open:open.length,resolved:resolved.length,approved:reviewed.length,
   resolutionRate:percent(resolved.length,rs.length),
   averageResolutionHours:durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length*10)/10:null,
   byCategory:CATEGORIES.map(k=>({category:k,count:rs.filter(r=>r.category===k).length})).filter(x=>x.count)};
}
function activitySummary(companies,userId,year,metrics,manualHistory=[]){
 const m=metrics;if(!m)throw Error('Núcleo BI indisponível');
 const list=m.authorized(companies,userId),months=m.months(year),sessions=arr(manualHistory).filter(r=>r.userId===userId&&r.finishedAt);
 const ids=new Set(list.map(c=>c.id));
 // Tempo do cronômetro manual é um conjunto diferente do Controle 04; não somar fontes sobrepostas.
 const history=sessions.filter(r=>ids.has(r.companyId));
 const distribution=months.map(p=>({period:p,records:history.filter(r=>String(r.finishedAt).slice(0,7)===p).length,
  manualSeconds:history.filter(r=>String(r.finishedAt).slice(0,7)===p).reduce((a,r)=>a+(finite(r.seconds)??0),0),
  reconciled:m.summarize(list,userId,p).summary.concluded}));
 return {totalCompanies:list.length,completedSessions:history.length,history,distribution,distinctCompanies:new Set(history.map(x=>x.companyId)).size};
}
function complexity(inputs){
 const d=obj(inputs),facts=['movements','accounts','pending','manual','rework'].map(k=>finite(d[k]));
 if(facts.some(x=>x===null))return {level:null,score:null,factors:[]};
 const [movements,accounts,pending,manual,rework]=facts;
 const factors=[{name:'Volume de movimentações',value:movements,score:movements>=1000?3:movements>=250?2:movements>=50?1:0},
 {name:'Quantidade de contas',value:accounts,score:accounts>=5?3:accounts>=3?2:accounts>=2?1:0},
 {name:'Pendências operacionais',value:pending,score:pending>=20?3:pending>=8?2:pending>=1?1:0},
 {name:'Classificações manuais',value:manual,score:manual>=100?3:manual>=25?2:manual>=5?1:0},
 {name:'Retrabalhos',value:rework,score:rework>=5?3:rework>=2?2:rework>=1?1:0}];
 const score=factors.reduce((a,b)=>a+b.score,0);
 return {score,level:score>=10?'Alta':score>=5?'Média':'Baixa',factors,method:'Critérios operacionais explícitos v1; não é avaliação do cliente.'};
}
function insights(aggregate,goals,quality){
 const a=obj(aggregate),q=obj(quality),items=[];
 if(a.pending>0)items.push({title:'Pendências operacionais registradas',value:a.pending,evidence:'Controle de Conciliações da competência',action:'Abrir Central de Pendências; verificar causas'});
 if(a.documentRate!==null&&a.documentRate<70)items.push({title:'Documentos com baixa taxa de recebimento',value:a.documentRate,evidence:'Histórico documental disponível',action:'Priorizar acompanhamento do CRM'});
 for(const g of arr(goals)){const r=resultGoals(g,a);if(r.progress!==null&&r.progress<50&&g.deadline)items.push({title:'Meta com progresso abaixo da metade',value:r.progress,evidence:g.title,action:'Revisar planejamento, prazo e circunstâncias'});}
 if(q.open>0)items.push({title:'Ocorrências de qualidade abertas',value:q.open,evidence:'Registros manuais de qualidade',action:'Acompanhar ações corretivas e revisões'});
 return items;
}
function anonymized(state,summary,userId){
 const s=normalize(state),b=obj(summary);
 return {generatedAt:new Date().toISOString(),scope:'Relatório pessoal sem identificadores de clientes',user:'Profissional',
  completed:Number(b.concluded)||0,qualityEvents:s.quality.filter(r=>r.ownerId===userId).length,
  goals:s.goals.filter(r=>r.ownerId===userId).length,
  achievements:s.achievements.filter(r=>r.ownerId===userId).map(r=>({title:r.title,date:r.date,description:r.description})),
  competencies:s.competencies.filter(r=>r.ownerId===userId).map(r=>({title:r.title,level:r.level,evidence:r.evidence}))};
}
return {TYPES,CATEGORIES,LEVELS,blank,normalize,create,edit,saveRecord,percent,validDay,resultGoals,summarizeQuality,activitySummary,complexity,insights,anonymized};
});
