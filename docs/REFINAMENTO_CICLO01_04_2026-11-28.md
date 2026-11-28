# ConCiliar+ — Refinamentos no primeiro ciclo (01–04)

## Âmbito e recuperação
Refinamento autorizado em 28/11/2026, exclusivamente no aplicativo GitHub `thiagodonizetidepaula-star/concilia-mais-web`, Supabase `csnvudadurtzhudlplij` e Render oficial `srv-db9ttbtg1s2s73a19a9g`. Sem Vercel, sem serviços extras, sem Melhoria 05.

Antes do desenvolvimento, a `main` estava em `1923bee56e04517071a53306c3a2a54a2cdd8341`. Essa é a referência de recuperação do código. Backup de produção privado `app_private.conciliar_workspace_backups` ID `764a05ff-96cd-4634-8b2b-148d8605de97`, revisão 696. Teste de recuperação em tabela temporária com rollback: 1 workspace e cópias JSON de workspace, operacional e produtividade idênticas ao original; checksum SHA-256 validado. **Nunca restaurar sobre workspace vivo sem procedimento de comparação de revisão e janela de manutenção.**

## Auditoria da carteira
Supabase: 62 empresas no total; **57 ativas e 5 inativas**. Das 60 empresas importadas do Excel, 55 ativas e 5 inativas; mais 2 cadastros originais ativos, por isso 57. Não há motivo para excluir ou alterar nenhum cadastro. Os 4 planos de contas totalizam 2.415 registros; dados da revisão 696.

## Alterações desenvolvidas na branch isolada
- `client-wallet.js`, `client-wallet.css`: pesquisa em tempo de digitação por código Domínio (incluindo zeros à esquerda), CNPJ com e sem pontuação, razão social e nome fantasia; contador, ícone, limpar e estados vazios. Preservados cartões e ações existentes.
- `crm.js`, `crm.css`: substituir tabela larga por cartões responsivos com Domínio, identificação, quantidade de cobranças e competências, status, data do último contato, detalhes expansíveis e acesso ao CRM existente. Não enviar e-mails.
- `classification-learning.js`, `app.js`, `index.html`: confirmação automática apenas para correspondências individuais inequívocas e válidas de data, valor, banco, histórico, ID opcional e contrapartida analítica. Bloqueio adicional de duplicidade, divergência e conciliação financeira ambígua; aprendizagem por empresa e reversão de mutações quando houver erro de persistência. Sem confirmação redundante, sem alterações de impostos.
- `reconciliation-review.js`: situação vazia verde apenas se o assistente contábil sinalizar conciliação pronta; demais ocorrências reais e decisões mantidas.
- `tracking-control-v4.js`, `tracking-control-v4.css`: indicadores compactos, outros em expansível, rosca de conclusão, barras de competências, evolução do tempo real, campos e edição em seções recolhíveis; bloqueio da contagem simultânea com produtividade.
- `productivity-manual-v2.js`, `productivity-manual-v2.css`: interface sem jargão de infraestrutura, mensagem operacional apenas em erro real, salvamento automático preexistente preservado, botão de iniciar conciliação; bloqueio da contagem simultânea com o Controle 04.
- `index.html`: destaque da confirmação automática da colagem, controles antigos de retenção agrupados em detalhes avançados sem alterar regras ou prazo de três meses.
- `testes/refinamentos-ciclo01-04.test.cjs`, `testes/homologacao-real-supabase.cjs`, `testes/crm-homologacao-visual.html` e workflows: testes de duplicidade, divergência, reversão de aplicação, isolamento, interface e persistência local autenticada, sem dados reais.

## Segurança e publicação
Não foram realizadas migrações de estrutura em produção; os dados permanecem nas tabelas existentes e no workspace de usuário com RLS. Não executar limpeza de três meses durante o teste. A publicação **só deve ocorrer** depois que os dois GitHub Actions do último commit passarem integralmente, com revisão visual e regressão dos módulos não alterados, e após nova consulta à integridade dos dados.

PR de revisão: https://github.com/thiagodonizetidepaula-star/concilia-mais-web/pull/80. Até aprovação, `main` e Render permanecem na versão anterior. Os avisos residuais do Supabase Auth/SECURITY DEFINER foram documentados na versão anterior e não sofreram alterações de permissões.

## Recuperação
Se o deploy futuro falhar, usar o painel Render do serviço original e recuperar o deploy do commit `1923bee56e04517071a53306c3a2a54a2cdd8341`, sem alterar o workspace. Se houver indício de corrupção de dados, suspender gravações, comparar revisões e hashes do backup privado e testar restauração em transação isolada antes de qualquer substituição do workspace real.
