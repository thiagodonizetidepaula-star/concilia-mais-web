import os, re, time, threading
from flask import Flask, jsonify, request, render_template_string
import requests
from catalog_v2 import catalog

app=Flask(__name__)
cache={}
lock=threading.Lock()
HEADERS={"User-Agent":"ProspectaAI-Piloto/1.0 (public business discovery demonstration)"}
CATEGORIES={
 "Oficinas mecânicas":'[shop=car_repair]',
 "Salões de beleza":'[shop=beauty]',
 "Barbearias":'[shop=hairdresser]',
 "Restaurantes":'[amenity=restaurant]',
 "Cafeterias":'[amenity=cafe]',
 "Padarias":'[shop=bakery]',
 "Lojas de roupas":'[shop=clothes]',
 "Pet shops":'[shop=pet]',
 "Dentistas":'[amenity=dentist]'
}
def get_json(url,params):
 r=requests.get(url,params=params,headers=HEADERS,timeout=22)
 r.raise_for_status()
 return r.json()
def cached(k,fn,ttl=900):
 with lock:
  if k in cache and time.time()-cache[k][0]<ttl: return cache[k][1]
 v=fn()
 with lock:cache[k]=(time.time(),v)
 return v
@app.get("/health")
def health():return {"status":"ok","mode":"real-public-data"}
@app.get("/api/search")
def search():
 city=request.args.get("cidade","Santo André").strip()[:90]
 category=request.args.get("segmento","Oficinas mecânicas")
 if category not in CATEGORIES or len(city)<3:return jsonify(error="Informe uma cidade válida e um segmento."),400
 pre=catalog(city,category)
 if pre is not None:
  return jsonify(resultados=pre,cidade=city+", SP",fonte="Fontes comerciais públicas — lista de referência",nota="Confira contatos antes de abordar. Esta lista não é em tempo real.")
 try:
  place=cached("city:"+city.lower(),lambda:get_json("https://nominatim.openstreetmap.org/search",{"q":city+", Brasil","format":"json","limit":1,"addressdetails":1}),86400)
  if not place:return jsonify(error="Não foi possível localizar a cidade."),404
  p=place[0]
  lat,lon=float(p["lat"]),float(p["lon"])
  # small radius avoids overloading public Overpass infrastructure
  rad=6000
  filt=CATEGORIES[category]
  q=f'[out:json][timeout:24];(nwr{filt}(around:{rad},{lat},{lon}););out center 65;'
  def buscar_osm():
   endpoints=[
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
   ]
   last=None
   for endpoint in endpoints:
    try:
     resp=requests.post(endpoint,data={"data":q},headers=HEADERS,timeout=18)
     resp.raise_for_status()
     result=resp.json()
     if isinstance(result,dict) and isinstance(result.get("elements"),list):return result
    except (requests.RequestException,ValueError) as exc:
     last=exc
   raise requests.RequestException("Não foi possível acessar os servidores públicos de estabelecimentos.") from last
  data=cached("osm-v2:"+category+":"+str(round(lat,3))+":"+str(round(lon,3)),
    buscar_osm,900)
  found=[]
  for el in data.get("elements",[]):
   t=el.get("tags",{})
   name=t.get("name")
   if not name:continue
   loc=el.get("center",el)
   la,lo=loc.get("lat"),loc.get("lon")
   if la is None or lo is None:continue
   phone=t.get("contact:whatsapp") or t.get("contact:phone") or t.get("phone","")
   digits=re.sub(r"\D","",phone.split(";")[0])
   if len(digits) in (10,11):digits="55"+digits
   whatsapp = (digits if 12<=len(digits)<=13 and digits.startswith("55") and t.get("contact:whatsapp") else "")
   if not whatsapp and t.get("contact:whatsapp") and 10<=len(digits)<=13:whatsapp=digits
   found.append({
    "id":str(el["type"])+str(el["id"]),
    "nome":name,"endereco":", ".join(filter(None,[t.get("addr:street"),t.get("addr:housenumber"),t.get("addr:suburb")])),
    "telefone":phone,"whatsapp":whatsapp,"site":t.get("website") or t.get("contact:website") or "",
    "instagram":t.get("contact:instagram") or "","lat":la,"lon":lo,
    "fonte":f'https://www.openstreetmap.org/{el["type"]}/{el["id"]}'
   })
  unique=list({b["id"]:b for b in found}.values())
  return jsonify(resultados=unique[:65],cidade=p.get("display_name",""),fonte="OpenStreetMap / Overpass",nota="Contatos podem não estar cadastrados. Sem auditoria do marketing e sem WhatsApp presumido.")
 except requests.RequestException:
  return jsonify(error="A fonte pública está temporariamente indisponível. Tente novamente mais tarde."),503
 except Exception:
  return jsonify(error="Não foi possível completar a consulta agora."),500

PAGE=r"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prospecta AI — Prospecção Local</title>
<style>
:root{font-family:Inter,system-ui,Arial;background:#0b1020;color:#f4f7ff}*{box-sizing:border-box}body{margin:0}.wrap{max-width:1120px;margin:auto;padding:24px 16px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #293349;padding:12px 0;margin-bottom:22px}h1{font-size:clamp(26px,5vw,40px);margin:4px 0}h2{font-size:19px}.muted{color:#a9b5d1;font-size:14px}.pill{background:#163c39;color:#baf5db;padding:6px 9px;border-radius:99px;font-size:12px}.panel,.item{background:#151e31;border:1px solid #2b3853;border-radius:16px;padding:20px;margin:14px 0}label{display:block;font-size:12px;color:#b5c3e2;margin-bottom:6px}input,select,textarea{width:100%;padding:12px;background:#101829;border:1px solid #405170;color:white;border-radius:10px;font:inherit}textarea{height:120px}.grid{display:grid;grid-template-columns:2fr 1.4fr 1fr auto;gap:12px;align-items:end}@media(max-width:750px){.grid{grid-template-columns:1fr 1fr}.wide{grid-column:span 2}}button,.btn{border:0;display:inline-block;border-radius:10px;padding:12px 16px;font-weight:650;text-decoration:none;cursor:pointer;background:#6b8aff;color:#071227}button:disabled{opacity:.5}a{color:#9cb3ff}.ghost{background:#26334c;color:white}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.results{display:grid;grid-template-columns:repeat(auto-fit,minmax(285px,1fr));gap:10px}.item{margin:0}.item h3{margin:0 0 8px}.item small{color:#b0bfdb}#status{margin:12px 0;color:#b3c6eb}.stat{display:flex;gap:14px;flex-wrap:wrap}.stat span{background:#25324a;border-radius:12px;padding:12px}.tag{display:inline-block;color:#ffd89d;background:#4c3a23;padding:4px 8px;border-radius:99px;font-size:12px}.btn{font-size:13px}.msg{white-space:pre-wrap}footer{padding:24px 0;color:#8e9cb8;font-size:12px}</style></head><body><div class="wrap">
<header><b>✦ Prospecta AI</b><span class="pill">Busca real • dados públicos</span></header>
<h1>Encontre empresas. Ofereça soluções.</h1><p class="muted">Pesquise estabelecimentos reais por cidade e segmento. Avalie suas oportunidades de marketing antes de abordá-los.</p>
<section class="panel"><div class="grid">
<div><label>Cidade</label><input id="cidade" placeholder="Ex.: Santo André" value="Santo André"></div>
<div><label>Segmento</label><select id="segmento"></select></div>
<div><label>Origem</label><input value="Fontes públicas" disabled></div>
<button class="wide" id="buscar" onclick="buscar()">🔎 Encontrar clientes</button>
</div><p class="muted">Mauá e Santo André: lista de referência com empresas reais por segmento. Outras cidades: consulta pública OpenStreetMap, sujeita a indisponibilidade. Telefones e WhatsApp só quando há confirmação.</p></section>
<div class="stat"><span id="quant">0 empresas encontradas</span><span id="cont">0 com telefone publicado</span><span id="whats">0 com WhatsApp explícito</span></div>
<div id="status">Escolha a cidade e clique em Encontrar clientes.</div><div id="resultados" class="results"></div>
<section class="panel"><h2>✍️ Proposta comercial</h2><label>Selecione uma empresa nos resultados para preparar uma mensagem</label><textarea id="mensagem">Olá! Trabalho com soluções de presença digital para negócios locais. Posso enviar uma análise gratuita com algumas oportunidades de melhoria?</textarea>
<div class="actions"><button class="ghost" onclick="navigator.clipboard.writeText(document.getElementById('mensagem').value).then(()=>alert('Mensagem copiada'))">Copiar mensagem</button></div><p class="muted">A mensagem é apenas uma sugestão. Nenhum contato é enviado automaticamente. Só faça afirmações sobre marketing após conferir os perfis da empresa.</p></section>
<section class="panel"><h2>📋 Acompanhamento local</h2><p class="muted">Salvo apenas neste navegador. Não é sincronizado com outros aparelhos.</p><div id="pipeline"></div><button class="ghost" onclick="limpar()">Limpar acompanhamento</button></section>
<footer>Prospecta AI • Protótipo em produção para testes • Não promete vendas, não inventa contatos e não envia mensagens em massa. Fontes: diretórios públicos identificados em cada cartão; outras cidades: OpenStreetMap (ODbL).</footer></div>
<script>
const segmentos=["Oficinas mecânicas","Salões de beleza","Barbearias","Restaurantes","Cafeterias","Padarias","Lojas de roupas","Pet shops","Dentistas"];
const s=document.getElementById('segmento'); segmentos.forEach(n=>{let o=document.createElement('option');o.value=n;o.textContent=n;s.appendChild(o)});
let registros={};try{registros=JSON.parse(localStorage.getItem('prospecta_pipeline')||'{}')}catch{}; let data=[];
function save(){localStorage.setItem('prospecta_pipeline',JSON.stringify(registros));renderPipe()}
function limpar(){if(confirm('Limpar os acompanhamentos salvos neste navegador?')){registros={};save()}}
function renderPipe(){const e=document.getElementById('pipeline');e.replaceChildren();let arr=Object.entries(registros);if(!arr.length){e.textContent='Nenhuma empresa acompanhada ainda.';return}for(let [id,x] of arr){let p=document.createElement('p');p.textContent=x.nome+' — '+x.status;e.appendChild(p)}}
function link(txt,url){let a=document.createElement('a');a.textContent=txt;a.className='btn ghost';a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a}
function selectLead(id){const b=data.find(x=>x.id===id);if(!b)return;document.getElementById('mensagem').value='Olá! Tudo bem? Encontrei a '+b.nome+' ao pesquisar negócios locais. Trabalho ajudando empresas a melhorar sua presença na internet e o atendimento digital. Posso apresentar uma análise gratuita com sugestões específicas para o seu negócio?';registros[id]={nome:b.nome,status:'Em análise'};save();document.getElementById('mensagem').scrollIntoView({behavior:'smooth'})}
function setStage(id,stage){if(registros[id]){registros[id].status=stage;save()}}
function render(){let el=document.getElementById('resultados');el.replaceChildren();for(let b of data){let d=document.createElement('article');d.className='item';let h=document.createElement('h3');h.textContent=b.nome;d.appendChild(h);let address=document.createElement('p');address.className='muted';address.textContent=b.endereco||'Endereço não cadastrado';d.appendChild(address);let tel=document.createElement('p');tel.textContent=b.telefone?'☎ '+b.telefone:'Telefone não divulgado nesta fonte';d.appendChild(tel);let a=document.createElement('div');a.className='actions';a.appendChild(link('📍 Mapa','https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((b.lat!=null&&b.lon!=null?b.lat+','+b.lon:b.nome+' '+document.getElementById('cidade').value))));a.appendChild(link('Fonte',b.fonte));if(b.site&&/^https?:\/\//.test(b.site))a.appendChild(link('Site',b.site));if(b.whatsapp)a.appendChild(link('WhatsApp','https://wa.me/'+encodeURIComponent(b.whatsapp)));let btn=document.createElement('button');btn.textContent='Criar abordagem';btn.onclick=()=>selectLead(b.id);a.appendChild(btn);d.appendChild(a);el.appendChild(d)}}
async function buscar(){const btn=document.getElementById('buscar');btn.disabled=true;document.getElementById('status').textContent='Buscando registros públicos...';try{const url='/api/search?cidade='+encodeURIComponent(document.getElementById('cidade').value)+'&segmento='+encodeURIComponent(s.value);let res=await fetch(url);let j=await res.json();if(!res.ok)throw Error(j.error||'Erro de consulta');data=j.resultados||[];document.getElementById('status').textContent=(data.length?'Resultados de '+j.cidade:'Nenhum cadastro encontrado. Tente outra cidade ou segmento.')+' • Origem: '+j.fonte;document.getElementById('quant').textContent=data.length+' empresas encontradas';document.getElementById('cont').textContent=data.filter(x=>x.telefone).length+' com telefone publicado';document.getElementById('whats').textContent=data.filter(x=>x.whatsapp).length+' com WhatsApp explícito';render()}catch(e){document.getElementById('status').textContent='⚠️ '+e.message}finally{btn.disabled=false}}
renderPipe();
</script></body></html>"""
@app.get("/")
def home():return render_template_string(PAGE)
if __name__=="__main__":
 app.run(host="0.0.0.0",port=int(os.environ.get("PORT","10000")))
