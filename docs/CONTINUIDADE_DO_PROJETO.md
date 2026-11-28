# ConCiliar+ — Continuidade segura do primeiro ciclo

Estado auditado em 2026-11-28 UTC. Referência para próximas conversas do ChatGPT Work / Codex.

## Identidade e refs
- Repositório: https://github.com/thiagodonizetidepaula-star/concilia-mais-web
- Main no início da auditoria: `dfd68f90cbb3a3683add94623eb7254c2a46a3cd`
- Branch 01: `feature/carteira-clientes-etapa01-review-20261127`
- Branch 02: `feature/melhoria02-gestao-documentos-homologacao-20261128`
- Branch 03: `feature/melhoria03-crm-manual-homologacao-20261128`
- Branch 04: `feature/melhoria04-controle-conciliacoes-homologacao-20261128`
- PR 79: https://github.com/thiagodonizetidepaula-star/concilia-mais-web/pull/79 ; base branch 03, head original `ff43f8819ddb57d0a5e407c27acdd88da18ddab3`. Estado inicial: aberto, draft, sem merge.
- Comparação main→head 04 no início: 114 commits à frente e 0 atrás.
- Render produção: `srv-db9ttbtg1s2s73a19a9g` / https://concilia-mais-web.onrender.com ; deploy inicial `dep-dc4udae0tbcc73dlhsn0`, commit dfd68f9, live.
- Supabase produção: `csnvudadurtzhudlplij`, não alterar outros projetos.

## Integridade auditada
- `public.user_workspaces` revisão 696 e 62 empresas; relatório Melhoria 03 detalha 60 na carteira, 55 ativas, 5 inativas, quatro originais e 2.415 contas.
- `app_private.conciliar_workspace_backups`: três snapshots identificados; o mais recente `4fc86089-8280-477a-a5e2-b14a7db70a8f`, revisão 696, JSONB integral igual ao payload atual na leitura de auditoria; SHA-256 armazenado (64 caracteres). Validação de restore isolado ainda necessária.
- Não expor nomes, CNPJs, e-mails, conteúdo de extratos nem material de backup.
- Supabase Security Advisor: três funções SECURITY DEFINER invocáveis por autenticados (`company_can_read`, `company_can_write`, `company_is_owner`) e proteção de senhas vazadas desabilitada. Avisos não corrigidos neste ponto.

## Escopo estrito
Somente Melhorias 01 Carteira, 02 Documentos, 03 CRM de cobranças manuais, 04 Controle de Conciliações/cronômetro. Não implementar 05, Outlook/Graph, automações de envio, DRE/novos demonstrativos nem infraestrutura adicional. Não usar Vercel. Não criar serviços ou custos.

## Antes de publicar
- Confirmar PRs encadeados e merge seguro em main.
- Verificar backups e restauração em ambiente isolado SEM sobrescrever produção.
- Confirmar CI verde no head final (não presumir pelas execuções anteriores).
- Testar login, autorização por usuário, importação Domínio, planos, idempotência, documentos, CRM, cronômetro e persistência com sessão real autorizada.
- Avaliar risco dos avisos de segurança e só corrigir política após revisão de dependências.
- Documentar contagens atuais antes/depois (os dados podem ter avançado desde a auditoria), registrar correções e artefatos.
- Se algum teste essencial estiver pendente ou houver risco crítico, **NÃO efetuar merge nem deploy**.

## Recuperação
Voltar código pela main/deploy anterior; restaurar banco somente com procedimento controlado, conferência de revisão e autorização se houver risco a registros mais recentes. Os snapshots são ponto de recuperação, não licença para sobrescrever dados.

## Histórico e fontes no próprio repositório
Consultar `docs/ETAPA01_CARTEIRA_CLIENTES_RELATORIO_20261127.md`, `docs/MELHORIA02_RELATORIO_HOMOLOGACAO_2026-11-28.md`, `docs/MELHORIA03_CRM_RELATORIO_2026-11-28.md`, PR 79 e workflows. Registrar cada novo resultado com URL do workflow, commit SHA, hora, dados sintéticos e ressalvas antes de afirmar homologação integrada.

## Status desta passagem
Auditoria read-only executada para refs, banco, backup e serviço Render; documentação adicionada na branch de melhoria, sem merge, migração nem publicação. Produção continua no commit anterior até que as condições de segurança e homologação estejam atendidas.


## Auditoria complementar — preparação do release 01–04
- Backup privado criado: `e2a5d544-cfb0-4b03-98f2-8202634fcbe2` (revisão 696), SHA-256 calculado para workspace e payload agregado.
- Recuperação não destrutiva em tabela temporária transacional: 1 registro, JSONB dos dados do workspace, operacionais e de produtividade iguais aos valores atuais; hashes válidos. `ROLLBACK` aplicado. Não substitui recuperação física nem teste de login após restauração.
- Contagens SQL: 62 empresas (60 carteira importada, 55 ativas, 5 inativas), 76 e-mails, históricos completos de 12 meses nas 60, 4 empresas com planos de contas somando 2.415 registros, 62 CNPJs distintos.
- Simulação read-only do RLS com identidade da própria workspace (1 linha visível) e identidade não relacionada (0 linhas).
- As três funções de acesso `company_can_read`, `company_can_write`, `company_is_owner` têm `SECURITY DEFINER`, `search_path` fixo, e referenciam `auth.uid()`; são usadas em diversas políticas RLS. `anon` não pode executar, `authenticated` pode. Revogação simples quebraria essas políticas; não alterar sem teste de regressão. Aviso remanescente sobre proteção de senhas vazadas.
- Workflows existentes incluem testes Node, Chromium e Supabase local; a execução verde no **commit atual** não foi comprovada com as interfaces disponíveis. Não declarar homologação do commit final. Não fazer merge/deploy.

## Homologação integrada CI comprovada — commit 7f157caa0d8c
- Workflow Node/sintaxe/regressão/Chromium: https://github.com/thiagodonizetidepaula-star/concilia-mais-web/actions/runs/46100655703 — success; log: 82 testes, 82 aprovados, zero falhas; capturas desktop/mobile dos quatro módulos com dados sintéticos.
- Workflow Supabase local GoTrue/Postgres/PostgREST/RPC: https://github.com/thiagodonizetidepaula-star/concilia-mais-web/actions/runs/46100655738 — success; 18 checkpoints positivos, incluindo duas contas, login/logout, importação do Domínio, idempotência, 01 Carteira, 02 Documentos, 03 CRM, 04 cronômetro, persistência e isolamento RLS.
- Security Advisor de produção classifica como WARN (não erro crítico): 3 funções SECURITY DEFINER empregadas por RLS, anon sem EXECUTE e authenticated com EXECUTE checando auth.uid(); proteção de senha vazada não habilitada — recurso Supabase Pro+ (custo proibido neste projeto). Não modificar permissões críticas sem suíte de regressão e autorização de risco.
- CI inicial já aprovou o snapshot de dados; antes do merge revisar se a revisão corporativa permanece e registrar commit exato do release.

## Publicação oficial do primeiro ciclo — 2026-11-28 UTC
- PR #79 integrado diretamente à `main` preservando a cadeia das Melhorias 01 a 04. Commit de merge: `72401eb8a027b2db30436630fd96d439e7a961f4`.
- GitHub Actions no commit candidato `83595ac5fc274a39cfeb66bb44ee7a2757ed3f8d`: 82 testes, 82 aprovados, zero falhas (https://github.com/thiagodonizetidepaula-star/concilia-mais-web/actions/runs/46101160997); E2E autenticado em Supabase isolado com 18 verificações e isolamento entre usuários aprovados (https://github.com/thiagodonizetidepaula-star/concilia-mais-web/actions/runs/46101161016).
- Render original: serviço `srv-db9ttbtg1s2s73a19a9g`; deploy `dep-dc54bcl9el5s73c8e5c0` **live**, commit `72401eb8a027b2db30436630fd96d439e7a961f4`, https://concilia-mais-web.onrender.com.
- Sem migração de produção necessária às quatro melhorias: usam campos JSONB opcionais no workspace existente. Nenhuma mudança nas permissões ou serviços adicionais.
- Antes do merge: 62 empresas, das quais 60 na carteira (55 ativas/5 inativas), 4 planos somando 2.415 registros; backup privado de recuperação `e2a5d544-cfb0-4b03-98f2-8202634fcbe2`, SHA-256 e igualdade dos três payloads testados sem sobrescrever produção.
- Avaliação de segurança: zero avisos de saúde no Supabase; avisos `WARN` remanescentes para três funções SECURITY DEFINER legítimas das políticas RLS (anon sem EXECUTE; auth.uid() nas funções) e proteção de senhas vazadas não habilitada, recurso Supabase Pro+ não contratado. Não afirmar risco zero nem que essas recomendações foram corrigidas.
- Status de validação: deploy live e logs do Render conferidos; testes de funcionamento completo executados em laboratório isolado. Não foi possível inspecionar diretamente a sessão autenticada no endereço de produção nesta execução.
- Melhoria 05 fora do escopo e não implementada.


## Estado do refinamento 2026-11-28 — PR #80
- Branch: `feature/refinamento-ciclo01-04-20261128` sobre `main` original `1923bee56e04517071a53306c3a2a54a2cdd8341`.
- Supabase `csnvudadurtzhudlplij`: 62 empresas, 57 ativas e 5 inativas. São 55 importadas ativas + 5 importadas inativas + 2 originais ativas, sem duplicações a excluir. Quatro planos e 2.415 registros.
- Backup privado `764a05ff-96cd-4634-8b2b-148d8605de97`, revisão 696, hash `4e791dd3d7a60300c411fe7cac183dcf7b4e0adf61b4c4357eb8a07bb8c65040`. Três payloads recuperados em tabela temporária, ROLLBACK aplicado.
- Implementação e componentes: `docs/REFINAMENTO_CICLO01_04_2026-11-28.md`.
- Pendente: resultado final integrado no commit mais recente, antes de publicar. Sem Melhoria 05.


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
