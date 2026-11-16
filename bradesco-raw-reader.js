/* Bradesco PDFCreator 1.7.3 Type3: recuperar caracteres do conteúdo PDF, sem OCR. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ConciliaBradescoRaw=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const GLYPHS=[
"Extrao Mensl/PídTAZ ELRODPSICM|NJ:05.2764/1-9omedusáriaclvtpçã8h:Ag269|C05341-7gêní($)3,DLçmc.éi(R$)bSONTIQUBVXGHF*",
"DatLnçmeoc.Crédi (R$)bSl13/0726PIX RECBDOM:TALUGSH98.,NQ5-4VF*Z",
"DatLnçmeoc.Crédi (R$)bSlPIX RECBDOM:TALUGSH2/071348.5,FNQ9-6VZ*T23714,-9 5sdaocimtêbeàhãujlrçõÚs",
"DatLnçmeoc.Crédi (R$)bSl07/826AONTEI1.3,59TRANSF CPGEDIUOML4XB:HV*-ZQ1387,-52046svFá/PuHóVÁsdaocimtêbeàhãujlrçõ"
];
function literal(s){let out=[];for(let i=0;i<s.length;i++){let c=s.charCodeAt(i);if(c!==92){out.push(c);continue;}if(++i>=s.length)break;let t=s[i],v={n:10,r:13,t:9,b:8,f:12};if(v[t]!==undefined)out.push(v[t]);else if(/[0-7]/.test(t)){let n=t;for(let j=0;j<2&&i+1<s.length&&/[0-7]/.test(s[i+1]);j++)n+=s[++i];out.push(parseInt(n,8));}else if(t==='\n')continue;else if(t==='\r'){if(s[i+1]==='\n')i++;}else out.push(t.charCodeAt(0));}return out;}
function bin(b){let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return s;}
async function inflate(bytes){if(!globalThis.DecompressionStream)throw Error('Navegador sem descompactação de PDF.');const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));return new TextDecoder('latin1').decode(await new Response(stream).arrayBuffer());}
function compressedStreams(text){
 const out=[],re=/(?:^|\n)(\d+)\s+\d+\s+obj\b/g;let m;
 while((m=re.exec(text))){let a=m.index+m[0].length,end=text.indexOf('endobj',a);if(end<0)continue;let pos=text.indexOf('stream\n',a),cr=text.indexOf('stream\r\n',a);if(cr>=0&&(pos<0||cr<pos))pos=cr;if(pos<0||pos>end)continue;let start=pos+(text.startsWith('stream\r\n',pos)?8:7),stop=text.indexOf('endstream',start);if(stop<0||stop>end)continue;if(!/\/FlateDecode/.test(text.slice(a,pos)))continue;
 out.push(Uint8Array.from(text.slice(start,stop).replace(/\r?\n$/,'').split(''),x=>x.charCodeAt(0)));re.lastIndex=end+6;
 }return out;
}
function parseOps(stream,page){
 let x=0,y=0,lineX=0,lineY=0,fontSize=8,lead=0,chars=[];
 const commands=/(?:\bBT\b|\bET\b|\/R\d+\s+[-+\d.]+\s+Tf|[-+\d.]+(?:\s+[-+\d.]+){5}\s+Tm|[-+\d.]+\s+[-+\d.]+\s+Td|[-+\d.]+\s+TL|T\*|\[(?:\\.|[^\]])*\]\s*TJ|\((?:\\.|[^\\)])*\)\s*Tj)/g;
 const tokens=/\((?:\\.|[^\\)])*\)|[-+]?(?:\d*\.)?\d+/g;
 for(const m of stream.matchAll(commands)){let c=m[0];if(c==='BT'){x=y=lineX=lineY=0;continue;}if(c==='ET')continue;
 if(/\/R\d+/.test(c)&&c.endsWith('Tf')){fontSize=Number(c.trim().split(/\s+/)[1]);continue;}
 if(c.endsWith('Tm')){let n=c.trim().split(/\s+/).map(Number);x=lineX=n[4];y=lineY=n[5];continue;}
 if(c.endsWith('Td')){let n=c.trim().split(/\s+/).map(Number);lineX+=n[0];lineY+=n[1];x=lineX;y=lineY;continue;}
 if(c.endsWith('TL')){lead=Number(c.trim().split(/\s+/)[0]);continue;}
 if(c==='T*'){lineY-=lead;x=lineX;y=lineY;continue;}
 if(c.endsWith('TJ')||c.endsWith('Tj')){let body=c.endsWith('TJ')?c.slice(1,c.lastIndexOf(']')):c.slice(0,c.lastIndexOf(')')+1);
 for(let token of body.matchAll(tokens)){let part=token[0];if(part[0]==='('){for(let code of literal(part.slice(1,-1))){let s=GLYPHS[page][code]||'';if(s)chars.push({x,y,s});x+=fontSize;}}else x-=Number(part)*fontSize/1000;}
 }
 }
 const rows=[];for(const item of chars){let column=item.x<85?0:item.x<245?1:item.x<322?2:item.x<410?3:item.x<492?4:5;let r=rows.find(r=>r.column===column&&Math.abs(r.y-item.y)<1.65);if(!r){r={column,y:item.y,chars:[]};rows.push(r);}r.chars.push(item);}
 return rows.map(r=>({page:page+1,x:Math.min(...r.chars.map(x=>x.x)),y:r.y,str:r.chars.sort((a,b)=>a.x-b.x).map(x=>x.s).join('').trim()})).filter(x=>x.str);
}
async function recover(bytes){
 let text=bin(bytes instanceof ArrayBuffer?new Uint8Array(bytes):bytes);
 if(!/PDFCreator Version 1\.7\.3/.test(text)&&!/Ghostscript 9\.10/.test(text))throw Error('Formato Type3 diferente do modelo validado.');let streams=[];
 for(const b of compressedStreams(text)){let s;try{s=await inflate(b);}catch{continue;}if(/\bBT\b/.test(s)&&/\/R\d+\s+[\d.]+\s+Tf/.test(s)&&/\]TJ/.test(s))streams.push(s);}
 if(streams.length!==4)throw Error('O arquivo tem uma estrutura Type3 ainda não validada ('+streams.length+' páginas).');
 const items=streams.flatMap((s,i)=>parseOps(s,i));
 const intro=items.filter(i=>i.page===1&&i.y>775&&i.x>100).sort((a,b)=>b.y-a.y||a.x-b.x).map(i=>i.str).join('');
 if(!intro.includes('TAZ ELETRODEPOSICAO'))throw Error('Assinatura do layout Type3 não verificada.');
 const dates=items.filter(x=>/^\d{2}\/\d{2}\/\d{4}$/.test(x.str)&&x.x<87);
 const amounts=items.filter(x=>/^[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}$/.test(x.str)&&x.x>322);
 if(dates.length<10||amounts.length<80)throw Error('Leitura Type3 incompleta: '+dates.length+' datas e '+amounts.length+' valores.');
 return {items,pages:4,bradescoRaw:true,dates:dates.length,amounts:amounts.length};
}
return {recover};
});