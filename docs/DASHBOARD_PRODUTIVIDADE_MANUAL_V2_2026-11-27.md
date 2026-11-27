# Dashboard de Produtividade Manual — 27/11/2026

- **Nova tela isolada** em `productivity-manual-v2.js` e `productivity-manual-v2.css`.
- **Medição começa somente com Iniciar:** todos os números começam zerados, independentemente dos extratos existentes.
- **Contagem manual** de lançamentos, pendências e divergências; tempo gasto medido pelo cronômetro, referência de tempo manual = contagem informada × minutos por lançamento.
- **Concluir e salvar** registra data/hora de início e fim, duração, indicadores e empresa/competência.
- **Zerar tudo / Novo ciclo** reinicia todos os números do ciclo atual, arquivando o rascunho anterior para restauração sem excluir conciliações concluídas.
- **Gráficos e tabela** exibem histórico de medição pessoal: conciliações concluídas, última conclusão, duração média, tempo por conciliação, produtividade por ciclo, conciliações por dia.
- **Filtros** por 7 dias, 30 dias, todo o histórico e empresa selecionada; exportação CSV.
- **Persistência** no navegador (`localStorage` chave `concilia-prod-manual-v2`), separada por usuário autenticado/empresa/competência. A versão anterior (`concilia-prod-v1`) fica intacta, mas não é carregada nesta nova medição, conforme pedido de começar do zero.
- **Não interfere** em lançamentos reais, banco, Razão ou Controle de Conciliações contábil.
- **Cronômetro** continua ao navegar entre telas e alternar abas; pausa ao fechar/recarregar a página. Iniciar em outra empresa pausa a sessão anterior do mesmo usuário.
- **Economia estimada** e **produtividade (%)** somente aparecem depois de concluir a medição. Fórmula: economia = referência manual - tempo real, produtividade = economia/referência × 100. Resultado negativo indica execução mais lenta do que a referência.
- **Segurança**: quando o navegador não permite salvar, a alteração é cancelada. O histórico é local ao dispositivo e não é sincronizado com a nuvem.
- **Teste simulado**: dados contábeis antigos não influenciam zeros, registro manual, conclusão/histórico, reset integral, restauração, falha de armazenamento, isolamento por usuário, nova empresa.
- **Pendente**: homologação funcional no navegador autenticado com dados reais, backup/sincronização opcional multi-dispositivo.
