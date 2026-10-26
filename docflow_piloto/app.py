"""DocFlow AI – piloto de leitura de PDFs em nuvem.
Não acessa Outlook/OneDrive e não armazena PDFs.
"""
import csv
import hmac
import io
import os
import re
import unicodedata
from datetime import datetime
from pathlib import PurePath

import fitz
import streamlit as st

st.set_page_config(page_title="DocFlow AI | Piloto", page_icon="📁", layout="wide")
st.markdown("""
<style>
.block-container {max-width:1100px;padding-top:2rem}
[data-testid="stMetric"]{border:1px solid #d4dbe5;border-radius:14px;padding:12px}
h1{letter-spacing:-.8px}
</style>
""", unsafe_allow_html=True)

SECRET = os.environ.get("DOCFLOW_ACCESS_PASSWORD", "")
if not SECRET:
    st.error("O administrador ainda não configurou a senha do piloto.")
    st.stop()
if not st.session_state.get("autenticado", False):
    st.title("📁 DocFlow AI")
    st.caption("Acesso privado — piloto de automação documental")
    entered = st.text_input("Senha de acesso", type="password")
    if st.button("Entrar", use_container_width=True):
        if hmac.compare_digest(entered.encode(), SECRET.encode()):
            st.session_state.autenticado = True
            st.rerun()
        else:
            st.error("Senha incorreta.")
    st.stop()

def normalizar(s):
    d = unicodedata.normalize("NFKD", s or "")
    return re.sub(r"\s+", " ", "".join(c for c in d if not unicodedata.combining(c))).lower().strip()

def apenas_numeros(s):
    return re.sub(r"\D", "", s or "")

def nome_seguro(s):
    return re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", s or "").strip(" .")[:100] or "SEM_NOME"

MESES = {nome:i for i,nome in enumerate(
    ["janeiro","fevereiro","marco","abril","maio","junho","julho",
     "agosto","setembro","outubro","novembro","dezembro"], 1)}
TIPOS = {
    "Balancete":r"\bbalancete\b",
    "Balanço":r"\bbalanco\b",
    "DRE":r"\bdre\b|\bdemonstracao do resultado\b",
    "Razão":r"\brazao\b",
    "Extrato":r"\bextrato\b",
    "Nota Fiscal":r"\bnota fiscal\b|\bnf-e\b|\bnfse\b",
    "Recibo":r"\brecibo\b",
    "DARF":r"\bdarf\b",
    "Contrato":r"\bcontrato\b",
}
DEFAULT_CLIENTES = [{"empresa":"Empresa Demonstracao Ltda", "cnpj":"11.111.111/0001-11"}]

def extrair_competencia(nome, texto):
    fonte_nome = normalizar(nome).replace("_", " ").replace("-", " ")
    fonte_texto = normalizar(texto[:100000])
    achados = set()
    padrao = r"(?:competencia|mes de referencia|periodo de referencia)\s*[:\-]?\s*(0?[1-9]|1[0-2])\s*[/.\-]\s*(20\d{2})"
    for fonte in (fonte_nome, fonte_texto):
        for mes, ano in re.findall(padrao, fonte):
            achados.add(f"{int(mes):02d}.{ano}")
    for mes, ano in re.findall(r"(?<!\d)(0?[1-9]|1[0-2])\s*[/.]\s*(20\d{2})(?!\d)", fonte_nome):
        achados.add(f"{int(mes):02d}.{ano}")
    for fonte in (fonte_nome, fonte_texto):
        for nome_mes,ano in re.findall(
            r"(?:competencia\s*[:\-]?\s*)?\b("+"|".join(MESES)+r")\s+(?:de\s+)?(20\d{2})\b",
            fonte if fonte==fonte_nome else re.sub(r"(?<!competencia)xxxxxxxxx", "", fonte[:300])):
            # Mês escrito no corpo só vale se vier explicitamente após 'competência'
            if fonte==fonte_nome or "competencia" in fonte[:max(250, len(nome_mes)+10)]:
                achados.add(f"{MESES[nome_mes]:02d}.{ano}")
    return next(iter(achados)) if len(achados)==1 else None

def extrair_pdf(conteudo):
    if len(conteudo) > 12*1024*1024:
        raise ValueError("Limite do piloto: 12 MB por PDF.")
    if not conteudo.startswith(b"%PDF-"):
        raise ValueError("O arquivo não parece ser um PDF válido.")
    try:
        with fitz.open(stream=conteudo, filetype="pdf") as doc:
            if doc.is_encrypted:
                raise ValueError("PDF protegido por senha.")
            return "\n".join(doc[i].get_text("text") for i in range(min(len(doc), 40)))[:160000]
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("Falha na leitura deste PDF.") from exc

def analisar(nome, conteudo, clientes):
    texto = extrair_pdf(conteudo)
    fonte = normalizar(nome+" "+texto)
    casamentos = []
    for cli in clientes:
        empresa = cli.get("empresa","").strip()
        cnpj = apenas_numeros(cli.get("cnpj",""))
        nome_ok = len(normalizar(empresa))>=7 and normalizar(empresa) in fonte
        cnpj_ok = len(cnpj)==14 and bool(re.search(
            r"(?<!\d)"+r"\D*".join(cnpj)+r"(?!\d)", nome+"\n"+texto))
        if empresa and (nome_ok or cnpj_ok):
            casamentos.append(empresa)
    cliente = casamentos[0] if len(set(casamentos))==1 else None
    tipos_nome = [t for t,p in TIPOS.items() if re.search(p,normalizar(nome))]
    tipos_texto = [t for t,p in TIPOS.items() if re.search(p,normalizar(texto[:8000]))]
    tipos = tipos_nome if tipos_nome else tipos_texto
    tipo = tipos[0] if len(tipos)==1 else None
    competencia = extrair_competencia(nome,texto)
    faltas = []
    if len(texto.strip())<25: faltas.append("PDF sem texto selecionável: precisa de OCR")
    if not cliente: faltas.append("Cliente não identificado ou ambíguo")
    if not tipo: faltas.append("Tipo não identificado ou ambíguo")
    if not competencia: faltas.append("Competência não identificada ou ambígua")
    destino = ("DOCFLOW_TESTE/"+nome_seguro(cliente)+"/Contabil Doc/"
               +competencia[-4:]+"/"+competencia) if not faltas else ""
    return {"Arquivo":nome_seguro(nome),"Cliente":cliente or "—",
            "Tipo":tipo or "—","Competência":competencia or "—",
            "Status":"Revisão" if faltas else "Identificado",
            "Pasta sugerida":destino or "Não enviar",
            "Observação":"; ".join(faltas) if faltas else "Conferir antes de enviar"}

st.title("📁 DocFlow AI")
st.caption("Piloto web • leitura de PDF • classificação conservadora • teste pessoal")
st.info("🔒 Este piloto NÃO acessa seu Outlook ou OneDrive. Nenhum arquivo é enviado ou movido automaticamente.")
if "clientes" not in st.session_state:
    st.session_state.clientes=DEFAULT_CLIENTES
tab_leitor,tab_config,tab_conexao=st.tabs(
    ["📄 Leitor inteligente","⚙️ Clientes e regras","📬 Outlook e OneDrive"])

with tab_config:
    st.subheader("Cadastro de empresas para teste")
    st.write("Importe uma lista CSV com as colunas empresa,cnpj. Os documentos que não correspondem à lista vão para Revisão.")
    csv_input=st.file_uploader("Cadastro CSV", type=["csv"], key="cadastro")
    if csv_input and st.button("Aplicar cadastro"):
        try:
            reader=csv.DictReader(io.StringIO(csv_input.getvalue().decode("utf-8-sig")))
            novos=[{"empresa":(r.get("empresa") or "").strip(),
                    "cnpj":(r.get("cnpj") or "").strip()} for r in reader]
            novos=[c for c in novos if c["empresa"]]
            if not novos:
                st.warning("O CSV deve ter colunas empresa,cnpj e pelo menos uma empresa.")
            else:
                st.session_state.clientes=novos
                st.success(f"{len(novos)} empresas cadastradas nesta sessão.")
        except Exception:
            st.error("Não foi possível ler o CSV. Use UTF-8 e cabeçalho empresa,cnpj.")
    st.dataframe(st.session_state.clientes,hide_index=True,use_container_width=True)
    st.caption("Os cadastros são temporários; serão apagados ao reiniciar a sessão.")

with tab_leitor:
    st.subheader("Analisar documentos")
    st.write("Envie PDFs de exemplo. O aplicativo identifica cliente, tipo e competência, e mostra onde o arquivo deveria ficar.")
    doc=fitz.open()
    p=doc.new_page()
    p.insert_text((60,70),"Empresa Demonstracao Ltda",fontsize=16)
    p.insert_text((60,110),"CNPJ: 11.111.111/0001-11")
    p.insert_text((60,140),"Balancete - Competencia: 09/2026")
    p.insert_text((60,170),"Documento de teste ficticio, sem informacoes reais.")
    exemplo=doc.tobytes()
    doc.close()
    st.download_button("⬇️ Baixar PDF fictício para teste",data=exemplo,
        file_name="Balancete_Setembro_2026_Exemplo.pdf",mime="application/pdf")
    pdfs=st.file_uploader("Selecione seus PDFs", type=["pdf"],accept_multiple_files=True)
    if pdfs and st.button("🔎 Ler e identificar",type="primary"):
        resultados=[]
        for arq in pdfs[:20]:
            try:
                resultados.append(analisar(arq.name,arq.getvalue(),st.session_state.clientes))
            except ValueError as e:
                resultados.append({"Arquivo":arq.name,"Cliente":"—","Tipo":"—",
                    "Competência":"—","Status":"Erro","Pasta sugerida":"Não enviar",
                    "Observação":str(e)})
        st.session_state.resultados=resultados
    if st.session_state.get("resultados"):
        resultados=st.session_state.resultados
        c1,c2,c3=st.columns(3)
        c1.metric("PDFs analisados",len(resultados))
        c2.metric("Identificados",sum(x["Status"]=="Identificado" for x in resultados))
        c3.metric("Para revisão",sum(x["Status"]!="Identificado" for x in resultados))
        for item in resultados:
            with st.container(border=True):
                st.write("**"+item["Arquivo"]+"**")
                st.write("Cliente: "+item["Cliente"]+"  |  Tipo: "+item["Tipo"]
                         +"  |  Competência: "+item["Competência"])
                if item["Status"]=="Identificado":
                    st.success("Pasta sugerida: "+item["Pasta sugerida"])
                else:
                    st.warning(item["Status"]+": "+item["Observação"])
        output=io.StringIO()
        cols=list(resultados[0].keys())
        writer=csv.DictWriter(output,fieldnames=cols,delimiter=";")
        writer.writeheader()
        writer.writerows(resultados)
        st.download_button("⬇️ Baixar relatório CSV",
            data=output.getvalue().encode("utf-8-sig"),
            file_name="docflow_relatorio.csv",mime="text/csv")

with tab_conexao:
    st.subheader("Integração Microsoft — próxima fase")
    st.write("Para buscar anexos do Outlook e criar pastas no OneDrive, vamos usar Microsoft Graph com autorização da conta.")
    st.warning("A conexão está propositalmente DESATIVADA neste piloto publicado. Primeiro valide a classificação com documentos fictícios.")
    st.write("Quando ativada, a automação será limitada a DOCFLOW_TESTE e exigirá confirmação de cada envio na fase de testes.")
    st.write("Nenhum acesso ou permissão à conta da Beatriz foi solicitado.")

st.divider()
if st.button("Sair do piloto"):
    st.session_state.clear()
    st.rerun()
st.caption("DocFlow AI • Piloto protegido • sem OCR em PDFs escaneados • sem retenção permanente de arquivos • sem cobrança de IA")
