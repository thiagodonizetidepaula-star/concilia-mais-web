# Changelog — ConCiliar+PLUS

## [Publicado no Render em 2026-11-28] — Primeiro ciclo (01–04)
- Melhoria 01: Carteira de Clientes; branch `feature/carteira-clientes-etapa01-review-20261127`.
- Melhoria 02: Gestão de Documentos por competência; branch `feature/melhoria02-gestao-documentos-homologacao-20261128`.
- Melhoria 03: CRM contábil com calendário e registros manuais; branch `feature/melhoria03-crm-manual-homologacao-20261128`.
- Melhoria 04: controle gerencial e cronômetro com auditoria; PR #79, branch `feature/melhoria04-controle-conciliacoes-homologacao-20261128`.
- 2026-11-28 UTC: auditoria de refs, Supabase e Render e inclusão de manuais de continuidade; **sem merge/deploy/migração**.
- Bloqueios a fechar: conferência final de CI e testes essenciais; avaliação de funções privilegiadas e proteção de senhas; validação de backup restaurável; conferência operacional real.

## [Produção anterior] — 2026-11-27
- `dfd68f90cbb3a3683add94623eb7254c2a46a3cd`: política de retenção operacional protegida de três meses; último deploy conhecido live no Render `dep-dc4udae0tbcc73dlhsn0`.

Este histórico diferencia **desenvolvido** de **publicado**. Nenhuma Melhoria 05 foi iniciada nesta revisão.


## [Auditoria de preparação de release] — 2026-11-28 UTC
- Criado backup privado `e2a5d544-cfb0-4b03-98f2-8202634fcbe2` no Supabase existente, workspace revisão 696.
- Teste de recuperação: cópia para tabela temporária dentro de transação revertida, 1 registro, igualdade dos 3 payloads (workspace, operacional, produtividade) e hashes SHA-256 = verdadeiro. **Não é recuperação completa da infraestrutura**.
- Contagem corporativa read-only: 62 empresas, 60 da carteira importada (55 ativas, 5 inativas), 76 e-mails, 60 históricos documentais e de fechamento com 12 meses, 4 planos de contas com 2.415 lançamentos, 62 CNPJs distintos.
- RLS leitura em transações revertidas: sessão autenticada titular acessa 1 workspace; usuário diferente acessa 0.
- Security Advisor: três avisos sobre funções `SECURITY DEFINER` utilizadas por políticas RLS, EXECUTE proibido para `anon` e permitido para `authenticated`; outro aviso sobre proteção de senhas vazadas desativada. Não houve mudança crítica de permissões sem teste de regressão.
- CI dos commits atuais do primeiro ciclo não pôde ser atestado pelo acesso disponível. Publicação bloqueada conforme condição expressa do solicitante: não executar merge/deploy com teste essencial ou segurança pendente.

## Publicação oficial do primeiro ciclo — 2026-11-28 UTC
- PR #79 integrado diretamente à `main` preservando a cadeia das Melhorias 01 a 04. Commit de merge: `72401eb8a027b2db30436630fd96d439e7a961f4`.
- GitHub Actions no commit candidato `83595ac5fc274a39cfeb66bb44ee7a2757ed3f8d`: 82 testes, 82 aprovados, zero falhas (https://github.com/thiagodonizetidepaula-star/concilia-mais-web/actions/runs/46101160997); E2E autenticado em Supabase isolado com 18 verificações e isolamento entre usuários aprovados (https://github.com/thiagodonizetidepaula-star/concilia-mais-web/actions/runs/46101161016).
- Render original: serviço `srv-db9ttbtg1s2s73a19a9g`; deploy `dep-dc54bcl9el5s73c8e5c0` **live**, commit `72401eb8a027b2db30436630fd96d439e7a961f4`, https://concilia-mais-web.onrender.com.
- Sem migração de produção necessária às quatro melhorias: usam campos JSONB opcionais no workspace existente. Nenhuma mudança nas permissões ou serviços adicionais.
- Antes do merge: 62 empresas, das quais 60 na carteira (55 ativas/5 inativas), 4 planos somando 2.415 registros; backup privado de recuperação `e2a5d544-cfb0-4b03-98f2-8202634fcbe2`, SHA-256 e igualdade dos três payloads testados sem sobrescrever produção.
- Avaliação de segurança: zero avisos de saúde no Supabase; avisos `WARN` remanescentes para três funções SECURITY DEFINER legítimas das políticas RLS (anon sem EXECUTE; auth.uid() nas funções) e proteção de senhas vazadas não habilitada, recurso Supabase Pro+ não contratado. Não afirmar risco zero nem que essas recomendações foram corrigidas.
- Status de validação: deploy live e logs do Render conferidos; testes de funcionamento completo executados em laboratório isolado. Não foi possível inspecionar diretamente a sessão autenticada no endereço de produção nesta execução.
- Melhoria 05 fora do escopo e não implementada.


## [Refinamento 01–04 — histórico de homologação anterior à publicação] 2026-11-28
- Busca ampliada da Carteira; CRM em cartões; classificação inequívoca do Excel com confirmação/aprendizagem automática e persistência dupla; pendências reais preservadas; Controle com gráficos, detalhes expansíveis e retenção avançada; dashboard de produtividade sem jargões de infraestrutura e sem cronômetros em paralelo.
- Backup de dados privado validado `764a05ff-96cd-4634-8b2b-148d8605de97`, rev. 696; nenhuma DDL de produção.
- Testes de regressão, Chromium e E2E Supabase local em execução na branch isolada. Sem publicação sem aprovação.


## Homologação e publicação oficial do refinamento do primeiro ciclo — 2026-11-28 UTC
**Estado final:** alterações das Melhorias 01–04 e refinamentos autorizados integradas à `main`, sem iniciar Melhoria 05.

- PR nº 80: https://github.com/thiagodonizetidepaula-star/concilia-mais-web/pull/80 — merge `55fd20f09c5d285489fd6ba6be8af06b7dd94279`.
- CI no commit candidato `7b96b2e3c204fea457e68597a6e699397892f7c8`: `46106167365`, 90 testes Node/regressão e Chromium desktop/mobile aprovados, zero falhas.
- E2E no Supabase local isolado: `46106167360`, aprovado com autenticação real fictícia, plano de contas, documentos, CRM, Controle 04, reimportação idempotente, RLS e **confirmação do Excel sem segundo clique, com movimentação e aprendizado verificados por consultas ao banco temporário**.
- Publicação automática Render oficial: serviço `srv-db9ttbtg1s2s73a19a9g`, deploy `dep-dc558va9lscs73f3jil0`, estado `live`, commit `55fd20f09c5d285489fd6ba6be8af06b7dd94279`, endereço `https://concilia-mais-web.onrender.com`. Logs confirmam checkout, upload do site e mensagem 'Your site is live'.
- Supabase de produção `csnvudadurtzhudlplij`: sem alteração de schema, permissões, planos nem dados reais na implantação. Integridade pós-deploy: revisão 696, 62 empresas (57 ativas, 5 inativas), 2.415 registros de contas, checksum workspace `4e791dd3d7a60300c411fe7cac183dcf7b4e0adf61b4c4357eb8a07bb8c65040` idêntico ao pré-refinamento. Saúde: zero avisos.
- Backup anterior `764a05ff-96cd-4634-8b2b-148d8605de97` privado na tabela `app_private.conciliar_workspace_backups`, recuperado em tabela temporária SQL dentro de transação com `ROLLBACK`: workspace, operacional e produtividade iguais; hash SHA-256 válido.
- Limitações remanescentes: avisos `WARN` do Security Advisor sobre três `SECURITY DEFINER` usadas pelas políticas RLS (anon sem EXECUTE; autenticados sujeitos a `auth.uid()`) e proteção de senha vazada não habilitada na configuração atual. Não adquirir plano pago nem alterar permissões essenciais sem migração testada. O teste interativo com credenciais profissionais no URL público **não foi executado**; verificação operacional foi no laboratório autenticado e verificação de publicação pelo Render.
- Recuperação da versão anterior: no Render existente, redeploy do commit anterior `1923bee56e04517071a53306c3a2a54a2cdd8341` caso haja regressão grave; não substituir dados vivos do Supabase automaticamente. Comparar revisões e hashes antes de qualquer restauração.
- Sem Vercel, nenhuma infraestrutura nova, nenhuma contratação, nenhuma migração destrutiva, nenhuma Melhoria 05.


## [BI integrado permanente — refinamento do primeiro ciclo] 2026-11-28
- Estabelecida regra permanente: cada nova funcionalidade autorizada exige revisão de impactos no BI; dashboards devem evoluir em quatro dimensões, com indicadores reais, históricos e RLS; sem Melhoria 05.
- Adicionado `dashboard-bi-metrics.js` (núcleo agregador sem efeitos), `dashboard-bi.js` (quatro visões no painel existente) e `dashboard-bi.css` (visual escuro profissional) com filtros por ano, competência, empresa e pesquisa.
- Reaproveitadas empresas autorizadas, documentos, CRM, reconciliações, histórico disponível, status do Domínio/contagem de movimentos, produtividade registrada e memória de classificação. Dados ausentes não são inventados.
- Incluído `docs/DICIONARIO_DE_INDICADORES.md` com fórmulas, origens, filtros, limites e procedimento para novos indicadores.
- Testes adicionados em `testes/dashboard-bi-integrado.test.cjs` e `testes/dashboard-bi-visual.html`, com CI Chromium desktop/mobile, Supabase local e regressões das Melhorias 01–04.
- Nenhuma nova página principal, serviço externo, custo, migração destrutiva ou funcionalidade da Melhoria 05.
- Publicação e backup ZIP somente após aprovação do CI no commit candidato.

## [Melhoria 05 — candidato isolado, NÃO PUBLICADO] 2026-11-28
- Adicionadas nove perspectivas na Visão Geral: produtividade, empresas, qualidade, eficiência, automação, metas, evolução profissional, inteligência gerencial e relatórios.
- Núcleo puro `melhoria05-core.js`, UI `melhoria05-ui.js`, tema escuro `melhoria05.css`, integração em `app.js` e `index.html`.
- Nova migração proposta `user_melhoria05_states` com RLS por usuário e controle de revisão; **não aplicada na produção**.
- Testes de núcleo, fixtures Chromium e E2E Supabase temporário; o CI define o resultado, não esta documentação.
- Backups e código oficial anteriores preservados, sem merge/Render, Vercel, cobranças ou Melhoria 06.


## [Melhoria 05 — continuação não publicada do segundo ciclo] 2026-11-28
- Auditoria individual do prompt original: matriz em `docs/MATRIZ_REQUISITOS_MELHORIA05.md` com 1.118 itens e status conservador; sem declaração prematura de completude.
- Adicionado motor `melhoria05-analytics.js` para intervalos diários/semanais/mensais/trimestrais/semestrais/anuais/personalizados, competência separada de execução, agregação histórica, revisão e metas por período correto.
- Acrescentados registros privados de atividades, eventos de regras e calendário, sem interferir nos dados contábeis. O plano de contas, saldos e cronômetros originais são preservados.
- Implementado `melhoria05-advanced-ui.js` e `melhoria05-advanced.css`: filtros integrados, séries, tabelas, aprovações/retrabalhos, metas e histórico profissional em BI azul-marinho.
- Relatórios profissionais `melhoria05-reports.js` em PDF via impressão e Excel em dez abas temáticas mais capa, com fórmulas, comparativos e anonimização de nomes/CNPJs/campos livres.
- `app.js` registra uso prospectivo de regras aprendidas como metadado auditável no movimento e distingue sugestão de confirmação/correção.
- Testes estendidos em `testes/melhoria05-integral.test.cjs`, fixtures Chromium e E2E Autenticação + RLS + registro + PDF/XLSX no Supabase local.
- **Nada da Melhoria 05 foi mesclado à main, implantado no Render ou migrado no Supabase de produção.** PR #82 permanece em rascunho; Melhoria 06 não iniciada.


### Adições de integridade e rastreabilidade da Melhoria 05
- Gravação de `company.learnedUsageMonthly` antes de retenção para preservar dados agregados de aprendizagem sem extratos.
- Histórico de uso real por regra e competência, distinto dos eventos manuais.
- Edição auditada de tempo/volume com motivo obrigatório e valores antes/depois.
- Cobertura adicionada de integridade de retensão, ajustes auditáveis e concorrência CAS no Supabase local.

## Identidade institucional independente — 28/11/2026
Marca principal: **ConCiliar+PLUS** — Software de automação e conciliação contábil. Assinatura institucional, conforme informação do titular: **Produto independente — titularidade BEATRIZ CRISSILA**. **Romeiro Soluções Empresariais** é identificada como ambiente de uso atual, não como marca proprietária do aplicativo. Essa indicação visual não substitui registro ou comprovação jurídica de propriedade intelectual. Login, sidebar, footer e relatórios atualizados em arquivos isolados; sem modificar domínio, dados, RLS ou integrações.
