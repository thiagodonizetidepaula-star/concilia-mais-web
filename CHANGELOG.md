# Changelog — ConCiliar+

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


## [Refinamento 01–04 candidato / não publicado] 2026-11-28
- Busca ampliada da Carteira; CRM em cartões; classificação inequívoca do Excel com confirmação/aprendizagem automática e persistência dupla; pendências reais preservadas; Controle com gráficos, detalhes expansíveis e retenção avançada; dashboard de produtividade sem jargões de infraestrutura e sem cronômetros em paralelo.
- Backup de dados privado validado `764a05ff-96cd-4634-8b2b-148d8605de97`, rev. 696; nenhuma DDL de produção.
- Testes de regressão, Chromium e E2E Supabase local em execução na branch isolada. Sem publicação sem aprovação.
