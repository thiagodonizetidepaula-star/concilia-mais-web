"""Catálogo inicial público; não é busca em tempo real."""
from known_businesses import known
import unicodedata
def key(s):return "".join(c for c in unicodedata.normalize("NFKD",s.lower()) if not unicodedata.combining(c)).strip()
# Registros: nome, endereço, URL da fonte. Telefones serão adicionados somente após verificação.
S={
"maua":{
"Salões de beleza":[("Belas Raízes","Av. Portugal, 71 - Jardim Pilar","https://localdir.com.br/negocio/belas-raizes-salao-de-beleza-e-estetica-maua-7ucg14"),("Studio Lumiina","Rua São João da Boa Vista, 128 - Jardim Haydee","https://www.trinks.com/studio-lumina")],
"Barbearias":[("Barbearia Jozza Moreira","Rua General Osório, 85 - Vila Bocaina","https://barbeariajozzamoreira.com.br/"),("V8 Barbearia","Av. Armando Sales de Oliveira, 399 - Parque São Vicente","https://v8barbearia.ageenda.com.br/")],
"Restaurantes":[("Bistrô 56","Rua Bolívia, 250 - Parque das Américas","https://www.maua.sp.gov.br/Destaques/Detalhes/14"),("Restaurante Campo do Jordão","Av. Papa João XXIII, 3665 - Vila Carlina","https://www.maua.sp.gov.br/Destaques/Detalhes/14")],
"Cafeterias":[("Becas Café","Rua Sorocaba, 35 - Matriz","https://www.maua.sp.gov.br/Destaques/Detalhes/14"),("Democrata Café ABC","Rua Francisco Ortega Escobar, 374","https://saborcidade.com/maua")],
"Padarias":[("Confeitaria Alemão","Av. Barão de Mauá, 1754","https://saborcidade.com/maua"),("Padaria Columbia","Rua Giovanna Salvatore Donatiello, 364","https://saborcidade.com/maua/padarias/padaria-columbia")],
"Lojas de roupas":[("Antonella Boutique","Rua Clodoaldo Portugal Caribe, 185 - Vila Assis","https://antonellaboutiquemaua.com.br/"),("Toda Bella Store","Rua Vereador Ângelo Gianoni, 41 - Centro","https://www.guiatelefone.com/empresas/maua-sp/vestuario-calcados-e-acessorios/lojas-de-roupas-femininas")],
"Pet shops":[("Bicho Zen Banho e Tosa Pet","Rua José Eduardo Pires Livramento, 193 - Jardim Itapark","https://www.cylex.com.br/maua/pet%2Bshops.html"),("Petz Shopping Mauá","Av. Gov. Mário Covas Júnior, 01 - Centro","https://www.petz.com.br/loja/petz-shopping-maua")],
"Dentistas":[("COSB Clínica Odontológica Mauá","Rua Aquidabam, 445 - Jardim Pilar","https://www.cosb.com.br/unidade/cosb-maua/"),("Instituto Castelo - Mauá","Rua Ribeirão Preto, 198 - Matriz","https://instcastelo.com.br/")]
},
"santo andre":{
"Salões de beleza":[("Espaço Toutes","Rua Araci, 123 - Vila Curuçá","https://espacotoutessantoandre.com.br/"),("Gisele Capelli Embelezamento","Rua Javri, 449 A - Vila Assunção","https://localbrazil.net/categoria/saloes-de-beleza/sao-paulo/santo-andre")],
"Barbearias":[("Emerson Barber Shop","Av. São Paulo, 723","https://booksy.com/pt-br/s/saloes-de-beleza/1039031_santo-andre"),("Siqueira's Barber Shop","Rua Javri, 270 - Vila Eldizia","https://booksy.com/pt-br/s/saloes-de-beleza/1039031_santo-andre")],
"Restaurantes":[("Balderi Pasta e Arte","Rua Tabaiares, 142 - Vila Assunção","https://www3.santoandre.sp.gov.br/turismosantoandre/restaurantes/"),("Baby Beef Jardim","Rua das Bandeiras, 166 - Jardim","https://www3.santoandre.sp.gov.br/turismosantoandre/restaurantes/")],
"Cafeterias":[("Bilu Coffee","Rua Santo Egídio, 20 - Jardim Bela Vista","https://www3.santoandre.sp.gov.br/turismosantoandre/padarias-confeitarias-e-cafeterias/"),("Cafeteria Doce Villa","Rua Guilherme Marconi, 418 - Vila Assunção","https://localbrazil.net/categoria/cafeterias/sao-paulo/santo-andre")],
"Padarias":[("Padaria Brasileira - Jardim","Rua das Figueiras, 664 - Jardim","https://www3.santoandre.sp.gov.br/turismosantoandre/padarias-confeitarias-e-cafeterias/"),("Palácio do Pão","Av. Itamarati, 1001 - Vila Curuçá","https://localbrazil.net/categoria/padarias-confeitarias/sao-paulo/santo-andre")],
"Lojas de roupas":[("Binomio Boutique","Rua Coronel Ortiz, 558 - Centro","https://www.guiatelefone.com/empresas/santo-andre-sp/vestuario-calcados-e-acessorios/lojas-de-roupas-femininas"),("Thati Modas","Rua Doutor Cesário Mota, 263 - Centro","https://www.guiatelefone.com/empresas/santo-andre-sp/vestuario-calcados-e-acessorios/lojas-de-roupas-femininas")],
"Pet shops":[("Petz Santo André","Av. Ramiro Colleoni, 355 - Vila Assunção","https://www.petz.com.br/loja/petz-santo-andre"),("Cobasi Pereira Barreto","Praça Eng. Roldão dos Santos Ferreira, 477","https://www.cobasi.com.br/lojas/cobasi-santo-andre-pereira-barreto")],
"Dentistas":[("Oral Confort Clínica Odontológica","Rua Dona Elisa Fláquer, 70 - Centro","https://localbrazil.net/categoria/dentistas/sao-paulo/santo-andre"),("OdontoCompany Carijós","Rua Carijós, 1663 - Vila Linda","https://localbrazil.net/categoria/dentistas/sao-paulo/santo-andre")]
}}
def catalog(city,category):
    ck=key(city)
    if ck not in S or category=="Oficinas mecânicas":return known(city,category)
    data=S[ck].get(category)
    if data is None:return None
    return [dict(id=f"source:{ck}:{category}:{i}",nome=n,endereco=a+", "+city+" - SP",telefone="",whatsapp="",site="",instagram="",lat=None,lon=None,fonte=src) for i,(n,a,src) in enumerate(data)]
