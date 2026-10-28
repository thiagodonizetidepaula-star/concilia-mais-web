import unicodedata
SOURCES={
"maua":[
("ELS Auto Mecânica","R. Francisco Moreira de Souza, 25 - Jardim Zaira","11975324021","11975324021","https://mecanicaels.com.br/"),
("Feras da Oficina Nakata","Rua Mauá, 1196 - Vila América","11989306161","11989306161","https://paginaamarela.com.br/empresa/feras-da-oficina-nakata/maua/sp/10268970"),
("Oficina Mecânica Magrinho","Rua Dr. Fernando Costa, 434","1145161962","","https://www.cylex.com.br/maua/oficinas-mec%C3%A2nicas/"),
("Oficina Express Mauá","Av. Barão de Mauá, 1473 - Vila América","1134205705","","https://www.cylex.com.br/maua/oficinas-mec%C3%A2nicas/"),
("Multiar Mecânica Automotiva","Av. Presidente Castelo Branco, 569 - Jardim Zaira","11973586482","","https://www.cylex.com.br/maua/oficinas-mec%C3%A2nicas/"),
("Auto Mecânica Bisqui","Rua Atílio dos Reis, 75","1145471829","","https://www.cylex.com.br/maua/oficinas-mec%C3%A2nicas/"),
("Alfa Mecânica de Mauá","Rua José Ricardo Nalle, 236 - Vila Mercedes","1145132800","","https://www.encontramaua.com.br/o/oficina-mecanica-em-maua.shtml")],
"santo andre":[
("Performance Super Cars","Rua Xingu, 635 - Vila Valparaíso","1144263218","11940328111","https://automoveisportalbrasil.com.br/clientes-em/santo-andre-1/sp/oficina-mecanica"),
("Torres Serviços Automotivos","Rua Grã-Bretanha, 445","1149900027","11999669158","https://automoveisportalbrasil.com.br/clientes-em/santo-andre-1/sp/oficina-mecanica"),
("ES Oficina Mecânica","Av. Dom Pedro I, 2429 - Vila Pires","","11960765026","https://automoveisportalbrasil.com.br/clientes-em/santo-andre-1/sp/oficina-mecanica"),
("MA Soluções Automotivas","Rua Vinte e Quatro de Maio, 650","1144745606","11994783861","https://automoveisportalbrasil.com.br/clientes-em/santo-andre-1/sp/oficina-mecanica"),
("JR Fabiano Reparação Automotiva","Rua América Central, 240","1149751366","11992473866","https://automoveisportalbrasil.com.br/clientes-em/santo-andre-1/sp/oficina-mecanica"),
("Oficina Mecânica Yoshio Auto Center","Av. Queirós dos Santos, 1856","11995196619","11995196619","https://localbrazil.net/categoria/oficinas-mecanicas/sao-paulo/santo-andre"),
("Auto Mix Mecânica e Elétrica","Rua Sud Menucci, 1326","11988937731","11988937731","https://localbrazil.net/categoria/oficinas-mecanicas/sao-paulo/santo-andre")]
}
def known(city, category):
 c="".join(v for v in unicodedata.normalize("NFKD",city.lower()) if not unicodedata.combining(v)).strip()
 if category!="Oficinas mecânicas" or c not in SOURCES:return None
 return [{"id":f"verified:{c}:{i}","nome":name,"endereco":address,
 "telefone":phone,"whatsapp":wa,"site":"","instagram":"",
 "lat":None,"lon":None,"fonte":src}
 for i,(name,address,phone,wa,src) in enumerate(SOURCES[c])]
