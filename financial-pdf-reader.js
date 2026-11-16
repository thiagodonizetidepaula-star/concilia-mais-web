/* Documento auxiliar: contas pagas do cliente. Nunca cria movimentações bancárias. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ConciliaFinancialPDF=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const money=s=>Math.round(Number(String(s).replace(/\./g,'').replace(',','.'))*100);
const date=s=>{const m=String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)return '';const d=m[3]+'-'+m[2]+'-'+m[1],obj=new Date(d+'T12:00:00Z');return !isNaN(obj.getTime())&&obj.toISOString().slice(0,10)===d?d:'';};
const row=/^(\S+)\s+([\d.,]+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.,]+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\S+)\s+(BOLETO|DEP[OÓ]SITO|PIX|TED|DOC|TRANSFER[EÊ]NCIA)\s+PAGO$/i;
function parse(text,Core){
const raw=String(text||'');if(!/Relação de Contas a Pagar/i.test(raw)||!/Títulos Pagos/i.test(raw))throw Error('PDF financeiro não reconhecido: modelo de Títulos Pagos não identificado.');
const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);let beneficiary='',rows=[],warnings=[],total=null,header=false;
for(let i=0;i<lines.length;i++){
const s=lines[i],m=s.match(row);
if(m){const paid=money(m[5]),nominal=money(m[2]),when=date(m[6]);if(!when||!date(m[3])||!date(m[4])||paid<=0||nominal<=0||!beneficiary)throw Error('Título incompleto ou inválido na linha '+(i+1));
rows.push({id:Core.id(),date:when,cents:-paid,bank:'',category:beneficiary,description:beneficiary+' — título '+m[1]+' — '+m[8],title:m[1],bankRef:m[7],operation:m[8],sourceRow:i+1});continue;}
const grand=s.match(/Total Geral:\s*([\d.,]+)\s+Total Geral Pago:\s*([\d.,]+)/i);if(grand){total=money(grand[2]);continue;}
if(/N[ºo°]\s*T[ií]tulo/i.test(s)){header=true;continue;}
if(header&&i+1<lines.length&&/N[ºo°]\s*T[ií]tulo/i.test(lines[i+1])){beneficiary=s;continue;}
if(i+1<lines.length&&/N[ºo°]\s*T[ií]tulo/i.test(lines[i+1])){beneficiary=s;continue;}
if(/^\S+\s+[\d.,]+\s+\d{2}\/\d{2}\/\d{4}\s/.test(s)&&!m)warnings.push('Linha '+(i+1)+' não reconhecida');
}
if(!rows.length)throw Error('PDF sem títulos pagos reconhecidos.');
const sum=rows.reduce((v,x)=>v-x.cents,0);
if(total===null)throw Error('Total Geral Pago não encontrado: PDF não validado.');
if(sum!==total)throw Error('Total Geral Pago difere da soma dos títulos ('+(sum/100).toFixed(2)+' versus '+(total/100).toFixed(2)+').');
if(warnings.length)throw Error('PDF contém '+warnings.length+' linha(s) potencialmente incompleta(s). Revise o documento.');
const cnpj=(raw.match(/CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})/i)||[])[1]?.replace(/\D/g,'')||'';
return {rows,total,cnpj,format:'PDF_TITULOS_PAGOS'};
}
return {parse};
});