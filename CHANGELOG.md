# Changelog — ConCiliar+

## [Não publicado] — Primeiro ciclo (01–04)
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
