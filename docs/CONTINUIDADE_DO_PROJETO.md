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
