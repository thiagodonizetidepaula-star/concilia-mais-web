# Concilia+ Web — demonstração v1.1 (Render)

Aplicativo web em português para testar conciliação contábil por empresa, sem exigir cadastro manual.

## Como testar

1. Abra https://concilia-mais-web.onrender.com em um navegador atualizado.
2. Clique em **Plano de contas e empresa** e importe `demo/PLANO_CONTAS_DEMO.csv` (o projeto já inclui o arquivo de teste). O aplicativo cria a empresa automaticamente. Se o plano não trouxer CNPJ/razão social, usa identidade provisória; isso **não prova titularidade**.
3. Em **Importar extratos e Razão**, selecione os CSVs `demo/EXTRATO_NUBANK_DEMO_AGO_2026.csv` e `demo/EXTRATO_ITAU_DEMO_AGO_2026.csv`. O banco é identificado e o código bancário só é associado se houver um código analítico único e adequado no plano. Havendo dúvida, vincule o banco manualmente para evitar erros.
4. Para PDF digital, escolha **Extrato PDF**. O leitor extrai texto no navegador com PDF.js (biblioteca obtida do CDN); tenta identificar data, histórico, valor, sinal e banco. PDFs digitalizados sem camada de texto exigem OCR (ainda não implementado). Textos ambíguos, saldos e linhas não reconhecidas aparecem em **Revisão**.
5. Examine as classificações sugeridas (nunca confirmadas automaticamente), transferências, conciliação e prévia de exportação.
6. Para comparar com o Razão, importe a versão correspondente à competência em CSV usando `demo/RAZAO_DEMO_AGO_2026.csv`.

## Limites importantes

- **PROTÓTIPO PARA DADOS FICTÍCIOS OU ANONIMIZADOS APENAS.** Site estático sem login, backend ou autorização por empresa. Os dados ficam no IndexedDB do navegador, não são compartilhados entre dispositivos e podem ser apagados com os dados de navegação. Faça backup JSON.
- Planos de contas neste estágio: **CSV/TXT** com colunas `Codigo;Descricao;Analitica`. Planos exportados como PDF/XLSX exigem validação de layout.
- PDFs de **extratos bancários digitais**: leitura experimental, não homologada para todos os bancos. O PDF é processado no navegador, sem envio de arquivo ao Render pelo app; a biblioteca do leitor é baixada da CDN. Falha de CDN pode impedir a leitura.
- Não executa OCR, não possui comparação integral de saldos nem importa diretamente no Domínio.
- A conciliação contábil definitiva depende do Razão do período; códigos não identificados não são inventados e transações incertas exigem revisão.
- A exportação CSV das cinco colunas é **prévia**, não um layout homologado do Domínio.

Repositório: https://github.com/thiagodonizetidepaula-star/concilia-mais-web


## Dashboards BI integrados do ConCiliar+
A Visão Geral contém quatro perspectivas **dentro da página existente**, com módulos `dashboard-bi-metrics.js`, `dashboard-bi.js`, `dashboard-bi.css` e filtros de ano, competência, empresa e pesquisa. O layout azul-marinho/ciano utiliza dados reais do workspace acessível e não altera saldos/classificações. Os testes são executados no GitHub Actions com Chromium e Supabase local temporário; não é necessário instalar dependências pagas. Consulte `docs/DICIONARIO_DE_INDICADORES.md` e `docs/MANUAL_TECNICO.md`.
O indicador profissional não deve ser confundido com qualidade ou desempenho financeiro; ausência de medição não gera zero fictício. Nenhum token, senha ou backup corporativo é incluído no ZIP público do projeto.
