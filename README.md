# ConCiliar+PLUS Web — demonstração v1.1 (Render)

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


## Dashboards BI integrados do ConCiliar+PLUS
A Visão Geral contém quatro perspectivas **dentro da página existente**, com módulos `dashboard-bi-metrics.js`, `dashboard-bi.js`, `dashboard-bi.css` e filtros de ano, competência, empresa e pesquisa. O layout azul-marinho/ciano utiliza dados reais do workspace acessível e não altera saldos/classificações. Os testes são executados no GitHub Actions com Chromium e Supabase local temporário; não é necessário instalar dependências pagas. Consulte `docs/DICIONARIO_DE_INDICADORES.md` e `docs/MANUAL_TECNICO.md`.
O indicador profissional não deve ser confundido com qualidade ou desempenho financeiro; ausência de medição não gera zero fictício. Nenhum token, senha ou backup corporativo é incluído no ZIP público do projeto.


## Melhoria 05 — segundo ciclo em desenvolvimento isolado (28/11/2026)
**A Melhoria 05 ainda NÃO está na produção. Nenhuma autorização de merge ou Render foi concedida para o segundo ciclo.** Ela é mantida na branch `feature/melhoria-05-inteligencia-operacional`, com fluxo de testes GitHub Actions e ambiente efêmero Supabase local.

Arquivos reais: `melhoria05-core.js` (regras puras; sem alteração de dados contábeis), `melhoria05-ui.js` (nove perspectivas internas, persistência privada CAS, relatórios), `melhoria05.css` (BI azul-marinho responsivo), `index.html` e `app.js` (encaixe na Visão Geral sem página principal duplicada), `supabase/migrations/20261128050000_melhoria05_user_states.sql` (SOMENTE proposta, não executada na produção), `testes/melhoria05-nucleo.test.cjs`, `testes/melhoria05-visual.html` e `testes/homologacao-melhoria05.cjs` (cálculos, fixture e E2E Auth/RLS no laboratório).

Reaproveitamento: `ConciliaBIMetrics`, `ConciliaTrackingCore`, `ConciliaManualProductivity.history()`, `ConciliaCloud`, dados existentes de documentos, CRM, empresas e aprendizagem. A nova coleção `user_melhoria05_states` é isolada por `auth.uid()` no RLS e usa revisão otimista (CAS) para proteger gravações; não substitui `user_workspaces` nem `user_productivity_states` e não altera o cronômetro. **O procedimento de publicação futura depende de aprovação separada e migração testada; não aplicar a migration automaticamente.**

Os registros de qualidade, metas, autoavaliações, diário, realizações e PDI são *declarações identificadas do profissional*, com origem e trilha de alterações. Indicadores automáticos de produtividade, conciliação e automação vêm apenas dos registros previamente autorizados. Classificação confirmada não significa conciliação aprovada; tempo manual não é somado ao cronômetro do Controle 04; metas, complexidade e análises não determinam punições nem juízos definitivos de competência.

Relatórios XLSX usam a biblioteca `XLSX` já presente; PDF depende da impressão/salvamento nativo do navegador. O portfólio exportável remove nomes/identificadores de clientes e textos livres para evitar vazamento de informações corporativas. A ausência de dados é representada por **Sem dados / Sem medição**, nunca por valores inventados.

Para extensão: incluir novos critérios em `docs/DICIONARIO_DE_INDICADORES.md`, testar RLS de dois usuários e concorrência CAS, validar logs dos GitHub Actions na mesma versão, revisar documentação, criar ZIP de homologação, e **aguardar autorização do segundo ciclo**. Não iniciar Melhoria 06.


## Segundo ciclo: Melhoria 05 — inteligência operacional (somente homologação)
O código candidato reside em `feature/melhoria-05-inteligencia-operacional` (PR #82, rascunho), sem publicação no Render. O módulo interno **Visão Geral → Inteligência operacional e desenvolvimento** amplia os dashboards existentes, sem criar novo aplicativo.

Consulte `docs/MANUAL_MELHORIA05.md` para uso, `docs/MATRIZ_REQUISITOS_MELHORIA05.md` para rastreabilidade completa e `docs/DICIONARIO_DE_INDICADORES.md` para fórmulas. A migração RLS está apenas proposta e deve ser testada isoladamente. Os dados privados não são exportados no ZIP do código.

A rotina CI executa testes unitários, regressão, Chromium responsivo, Supabase local com dois usuários e validação do pacote candidato. **Não publicar ou mesclar na main sem autorização específica para o segundo ciclo.** 
