(()=>{
'use strict';
const fab=document.createElement('button');
fab.id='robotFab';fab.type='button';fab.setAttribute('aria-label','Abrir assistente contábil');fab.setAttribute('aria-expanded','false');
fab.innerHTML='<i data-lucide="bot"></i><span class="robot-ping" aria-hidden="true"></span>';
const panel=document.createElement('section');panel.id='robotPanel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Assistente Contábil');
panel.innerHTML='<div class="robot-header"><i data-lucide="bot"></i><div><strong>Concilia+ Assistente</strong><small>Ajuda contábil dentro do aplicativo</small></div><button class="robot-close" type="button" aria-label="Fechar assistente">×</button></div><div class="robot-messages" id="robotMessages" aria-live="polite"></div><div class="robot-quick"><button type="button" data-ask="Como começo?">Como começar</button><button type="button" data-ask="Como conferir divergências?">Divergências</button><button type="button" data-ask="Como importar Razão?">Importar Razão</button><button type="button" data-ask="Como exportar Excel?">Exportar Excel</button></div><form class="robot-form" id="robotForm"><input id="robotInput" autocomplete="off" maxlength="300" aria-label="Pergunte ao assistente" placeholder="Pergunte sobre conciliação..." required><button type="submit" aria-label="Enviar pergunta">➤</button></form><p class="robot-note">Assistente local de orientação. Não utiliza IA externa nem altera lançamentos.</p>';
document.body.append(panel,fab);
const messages=panel.querySelector('#robotMessages'),input=panel.querySelector('#robotInput');
function add(t,who){const el=document.createElement('div');el.className='robot-message '+who;el.textContent=t;messages.appendChild(el);messages.scrollTop=messages.scrollHeight}
function answer(q){const t=q.toLocaleLowerCase('pt-BR');const company=document.querySelector('#companySelect');const selected=company?.selectedOptions?.[0]?.textContent?.trim();const hasCompany=!!company?.value;
if(/começ|inici|passo|usar|ajud/.test(t))return 'Para iniciar: 1) importe o plano de contas do Domínio; 2) selecione a empresa e a competência; 3) importe extratos e Razões; 4) confira classificações; 5) execute a conciliação e revise pendências.';
if(/diverg|diferen|não bat|nao bat|pendên|penden|erro/.test(t))return 'Na aba “Conciliação e exportação”, clique em “Executar comparação”. Verifique valores, datas, conta bancária e duplicidades. Correspondências ambíguas devem ser revisadas manualmente; nenhuma contrapartida é inventada.';
if(/raz[aã]o|import/.test(t))return 'Abra “Importar extratos e Razão”. É possível selecionar múltiplos arquivos do Razão, separados por banco. Antes, confirme que a empresa e a competência corretas estão selecionadas.';
if(/excel|export|relat[oó]rio|pdf/.test(t))return 'Na aba “Conciliação e exportação”, use “Exportar conferência para Excel”. Confira as pendências e códigos antes de utilizar lançamentos em outro sistema.';
if(/empresa|selecion|cliente|per[ií]odo|compet/.test(t))return hasCompany?'A empresa atualmente selecionada é: '+selected+'. Confira também a competência no topo da tela.':'Nenhuma empresa foi selecionada. Importe um plano de contas ou escolha uma empresa no topo da tela.';
if(/transfer/.test(t))return 'Na aba “Transferências”, o sistema sugere pares entre contas da mesma empresa. Confirme a titularidade e os dados nos extratos antes de aprovar.';
if(/classific|c[oó]digo|plano/.test(t))return 'Os códigos contábeis devem vir do plano de contas exclusivo de cada empresa. Confira qualquer sugestão e confirme manualmente antes de exportar.';
return 'Posso orientar sobre importação, Razão, divergências, classificação, transferências e exportação. Esta primeira versão ainda não interpreta perguntas livres com IA nem acessa seus dados contábeis automaticamente.'}
function ask(q){add(q,'user');add(answer(q),'bot')}
function close(){panel.classList.remove('robot-open');fab.setAttribute('aria-expanded','false');fab.focus()}
fab.addEventListener('click',()=>{if(!document.body.classList.contains('authenticated'))return;const open=panel.classList.toggle('robot-open');fab.setAttribute('aria-expanded',String(open));if(open){if(!messages.children.length)add('Olá! 🤖 Sou seu assistente do Concilia+. Posso ajudar com os passos de conciliação. O que você precisa?','bot');input.focus()}})
panel.querySelector('.robot-close').addEventListener('click',close);
panel.querySelectorAll('[data-ask]').forEach(b=>b.addEventListener('click',()=>ask(b.dataset.ask)));
panel.querySelector('#robotForm').addEventListener('submit',e=>{e.preventDefault();const q=input.value.trim();if(q){ask(q);input.value=''}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('robot-open'))close()});
const observer=new MutationObserver(()=>{if(!document.body.classList.contains('authenticated')){panel.classList.remove('robot-open');fab.setAttribute('aria-expanded','false');messages.replaceChildren();input.value=''}});
observer.observe(document.body,{attributes:true,attributeFilter:['class']});
window.lucide?.createIcons();
})();