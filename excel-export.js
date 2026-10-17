/* Concilia+ Web | exportador XLSX sem bibliotecas externas, dados locais no navegador. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ConciliaExcel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const enc=new TextEncoder();
const asXml=s=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const text=x=>String(x??'');
const dateBR=d=>String(d||'').split('-').reverse().join('/');
const formulaText=s=>String(s??'').slice(0,32767); // Excel inlineStr: strings never formulas
const number=n=>({n:Number(n)});
function report(core,company,period){
 if(!company||!Array.isArray(company.plan)||!company.plan.length)throw Error('Importe o plano de contas desta empresa antes de exportar.');
 if(!/^\d{4}-\d{2}$/.test(period))throw Error('Selecione uma competência válida.');
 const plan=new Map(company.plan.map(a=>[String(a.code),a]));
 const accounts=new Map((company.accounts||[]).map(a=>[a.id,a]));
 const moves=core.periodMovements(company,period).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.history.localeCompare(b.history));
 if(!moves.length)throw Error('Nenhuma movimentação nesta competência. Importe o extrato antes de exportar Excel.');
 const transferPairs=new Map();
 for(const t of company.transfers||[]){if(t.status!=='CONFIRMADA')continue;const outgoing=moves.find(m=>m.id===t.outId);const incoming=moves.find(m=>m.id===t.inId);if(outgoing&&incoming){transferPairs.set(outgoing.id,{other:incoming.id,type:'ORIGEM'});transferPairs.set(incoming.id,{other:outgoing.id,type:'DESTINO'});}}
 const rec=core.reconcile(company,period);
 const hasLedger=(company.ledger||[]).some(l=>l.period===period);
 const journalBySource=new Map();
 for(const l of rec.checked)for(const source of l.sources||[])journalBySource.set(source,l);
 const headers=['Data','Cód. Conta Débito','Cód. Conta Crédito','Valor Extrato (R$)','Complemento Histórico','Situação Classificação','Conciliação com Razão','Banco','Código do Banco','Contraparte','Arquivo de Origem','Observações'];
 const confer=[headers];
 let blocked=0,suggested=0,confirmed=0;
 for(const m of moves){
   const bank=accounts.get(m.accountId);
   const bankCode=bank&&plan.get(String(bank.chartCode))?.analytic?String(bank.chartCode):'';
   const cp=String(m.counterpart||'');
   const suggestedCode=String(m.suggested||'');
   const approved=!!(m.status==='CONFIRMADO'&&plan.get(cp)?.analytic);
   const proposed=!!(!approved&&m.status!=='PENDENTE_DUPLICIDADE'&&plan.get(suggestedCode)?.analytic);
   const tr=transferPairs.get(m.id);
   const journal=journalBySource.get(m.id);
   let debit='',credit='',situation='',reconStatus='NÃO VERIFICADO',notes='';
   if(!bankCode){situation='BLOQUEADO — BANCO SEM CÓDIGO VÁLIDO';notes='Vincule uma conta analítica do plano desta empresa.';blocked++;}
   else if(m.status==='PENDENTE_DUPLICIDADE'){situation='PENDENTE — POSSÍVEL DUPLICIDADE';notes='Nenhuma contrapartida aprovada até resolver a duplicidade.';blocked++;}
   else if(tr&&journal){debit=String(journal.debit);credit=String(journal.credit);situation='TRANSFERÊNCIA CONFIRMADA';reconStatus=hasLedger?journal.recon.replaceAll('_',' '):'RAZÃO NÃO IMPORTADO';notes=tr.type==='ORIGEM'?'Par bancário vinculado; lançamento único na aba Prontos.':'Movimento correspondente da transferência; não contabilizar novamente.';confirmed++;}
   else if(approved&&journal){debit=String(journal.debit);credit=String(journal.credit);situation='CLASSIFICAÇÃO CONFIRMADA';reconStatus=hasLedger?journal.recon.replaceAll('_',' '):'RAZÃO NÃO IMPORTADO';confirmed++;}
   else if(proposed){debit=m.cents>0?bankCode:suggestedCode;credit=m.cents>0?suggestedCode:bankCode;situation='SUGERIDA — CONFIRMAR CONTRAPARTIDA';notes='Códigos são sugestão, não lançamento confirmado.';suggested++;}
   else{debit=m.cents>0?bankCode:'';credit=m.cents<0?bankCode:'';situation='PENDENTE — CONTRAPARTIDA NÃO IDENTIFICADA';notes='Campo de contrapartida não preenchido para evitar código fictício.';blocked++;}
   if(journal&&!tr&&journal.recon==='AMBIGUO')notes=(notes?notes+' ':'')+'Correspondência duplicada/ambígua no Razão.';
   confer.push([dateBR(m.date),debit,credit,number(m.cents/100),formulaText(m.history),situation,reconStatus,bank?.bank||'',bankCode,formulaText(m.party||''),formulaText(m.origin||''),notes]);
 }
 const ready=[['Data','Cód. Conta Débito','Cód. Conta Crédito','Valor','Complemento Histórico']];
 const periodImports=(company.imports||[]).filter(i=>i.type==='EXTRATO'&&Array.isArray(i.periods)&&i.periods.includes(period));
 const divergentBalance=periodImports.some(i=>i.balanceCheck?.status==='DIVERGENTE');
 const exportable=hasLedger&&!rec.errors.length&&!divergentBalance?core.previewExport(company,period).rows:[];
 for(const j of exportable){
   if(!plan.get(String(j.debit))?.analytic||!plan.get(String(j.credit))?.analytic)continue;
   ready.push([dateBR(j.date),String(j.debit),String(j.credit),number(j.cents/100),formulaText(j.history)]);
 }
 const entrySum=moves.filter(m=>m.cents>0).reduce((a,m)=>a+m.cents,0);
 const exitSum=moves.filter(m=>m.cents<0).reduce((a,m)=>a+m.cents,0);
 const summary=[['Campo','Informação'],['Empresa',company.name||''],['CNPJ',company.cnpj||'NÃO IDENTIFICADO'],['Competência',period],['Origem dos códigos','Plano de contas importado da empresa (códigos não universais)'],['Movimentações do extrato',number(moves.length)],['Entradas (R$)',number(entrySum/100)],['Saídas (R$)',number(exitSum/100)],['Classificações/transferências confirmadas — linhas bancárias',number(confirmed)],['Sugestões pendentes',number(suggested)],['Sem contrapartida / duplicidades / código inválido',number(blocked)],['Lançamentos prontos para revisão de exportação',number(ready.length-1)],['Razão da competência importado?',hasLedger?'SIM':'NÃO'],['Observação sobre Razão',hasLedger?'Somente confirmados NÃO encontrados no Razão são incluídos em Lançamentos Prontos.':'Sem Razão atualizado, nenhum lançamento é liberado na aba Lançamentos Prontos.'],['Divergências de código',number(rec.errors.length)],['Saldo bancário divergente?',divergentBalance?'SIM — BLOQUEIA LANÇAMENTOS PRONTOS':'NÃO IDENTIFICADO'],['Aviso','Planilha de conferência e prévia. Antes de importar no Domínio, confirme contabilidade, layout e duplicidades.'],['Gerado em',new Date().toLocaleString('pt-BR')]];
 const source=[['Código','Classificação','Descrição','Analítica?']];
 for(const a of company.plan)source.push([text(a.code),text(a.classification),formulaText(a.description),a.analytic?'SIM':'NÃO']);
 const imports=[['Arquivo','Banco','Formato','Movimentos','Verificação de Saldos','Diferença (R$)']];
 for(const i of periodImports)imports.push([text(i.name),text(i.bank),text(i.format),number(i.movementCount||0),text(i.balanceCheck?.status||'NÃO DISPONÍVEL'),typeof i.balanceCheck?.difference==='number'?number(i.balanceCheck.difference/100):'']);
 return {sheets:[{name:'Resumo',rows:summary,widths:[48,82]},{name:'Conferencia',rows:confer,widths:[15,20,20,20,72,46,35,21,19,43,43,66]},{name:'Lancamentos_Prontos',rows:ready,widths:[16,24,24,20,82]},{name:'Plano_de_Contas',rows:source,widths:[18,32,62,16]},{name:'Extratos_Importados',rows:imports,widths:[53,24,16,18,29,22]}],counts:{movements:moves.length,ready:ready.length-1,suggested,blocked,confirmed,hasLedger,codeErrors:rec.errors.length,divergentBalance}};
}
const colName=n=>{let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
function sheetXml(sheet){const columns=sheet.widths||[];const out=['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">','<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>','<sheetFormatPr defaultRowHeight="18"/>','<cols>'+columns.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${Math.min(w,100)}" customWidth="1"/>`).join('')+'</cols>','<sheetData>'];
 for(let i=0;i<sheet.rows.length;i++){
  const row=sheet.rows[i];out.push(`<row r="${i+1}"${i===0?' ht="26" customHeight="1"':''}>`);
  for(let j=0;j<row.length;j++){
   const val=row[j];if(val===null||val===undefined||val==='')continue;
   const ref=colName(j+1)+(i+1);
   if(typeof val==='object'&&val.n!==undefined&&Number.isFinite(val.n))out.push(`<c r="${ref}" s="${i===0?1:2}"><v>${val.n}</v></c>`);
   else out.push(`<c r="${ref}" t="inlineStr" s="${i===0?1:0}"><is><t xml:space="preserve">${asXml(formulaText(val))}</t></is></c>`);
  }
  out.push('</row>');
 }
 out.push('</sheetData>');
 const last=`${colName(Math.max(1,sheet.rows[0]?.length||1))}${sheet.rows.length}`;
 if(sheet.rows.length>1)out.push(`<autoFilter ref="A1:${last}"/>`);
 out.push('</worksheet>');return out.join('');
}
const contentTypes=names=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+names.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>';
const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF183750"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
function packBytes(entries){
 const bytes=[],directory=[],timestamp=0,crcTable=[];
 for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crcTable[i]=c>>>0;}
 const crc=data=>{let c=0xFFFFFFFF;for(const byte of data)c=crcTable[(c^byte)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0};
 const u16=(arr,v)=>{arr.push(v&255,(v>>>8)&255)};
 const u32=(arr,v)=>{arr.push(v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255)};
 const append=(arr,dat)=>{for(const x of dat)arr.push(x)};
 for(const [name,content] of entries){const nm=enc.encode(name),data=enc.encode(content),check=crc(data),offset=bytes.length;
  u32(bytes,0x04034B50);u16(bytes,20);u16(bytes,0);u16(bytes,0);u16(bytes,0);u16(bytes,0);u32(bytes,check);u32(bytes,data.length);u32(bytes,data.length);u16(bytes,nm.length);u16(bytes,0);append(bytes,nm);append(bytes,data);
  u32(directory,0x02014B50);u16(directory,20);u16(directory,20);u16(directory,0);u16(directory,0);u16(directory,0);u16(directory,0);u32(directory,check);u32(directory,data.length);u32(directory,data.length);u16(directory,nm.length);u16(directory,0);u16(directory,0);u16(directory,0);u16(directory,0);u32(directory,0);u32(directory,offset);append(directory,nm);
 }
 const end=bytes.length;append(bytes,directory);u32(bytes,0x06054B50);u16(bytes,0);u16(bytes,0);u16(bytes,entries.length);u16(bytes,entries.length);u32(bytes,directory.length);u32(bytes,end);u16(bytes,0);return new Uint8Array(bytes);
}
function xlsx(reportData){const sheets=reportData.sheets;if(!sheets?.length)throw Error('Relatório sem abas.');
 const files=[['[Content_Types].xml',contentTypes(sheets)],['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>`<sheet name="${asXml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>'],['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+`<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`+'</Relationships>'],['xl/styles.xml',styles],...sheets.map((s,i)=>[`xl/worksheets/sheet${i+1}.xml`,sheetXml(s)])];return packBytes(files);
}
function download(data,name){const blob=new Blob([xlsx(data)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
return {report,xlsx,download};
});