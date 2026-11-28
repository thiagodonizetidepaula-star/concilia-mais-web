# ConCiliar+ — Manual técnico (primeiro ciclo)

Atualizado em 2026-11-28 UTC. **Documento de auditoria, não certificado de publicação.**

## Infraestrutura
- Código: GitHub `thiagodonizetidepaula-star/concilia-mais-web`, branch oficial `main`.
- Hospedagem oficial existente: serviço estático Render `srv-db9ttbtg1s2s73a19a9g`, URL https://concilia-mais-web.onrender.com, deploy automático em pushes na main.
- Supabase: projeto `csnvudadurtzhudlplij` (Concilia+ Web, sa-east-1). Autenticação Supabase e persistência com RLS.
- Frontend: aplicação HTML/CSS/JavaScript estática, módulos incluídos no `index.html`, com processamento local de documentos. Não existe `package.json` na raiz da branch examinada.
- Persistência gerencial/operacional: `public.user_workspaces` (`payload` JSONB, `revision`, `updated_at`), `public.user_productivity_states` e `public.user_operational_drafts`, isoladas por usuário e RLS. Demais tabelas: `companies`, `company_members`, `chart_accounts`, `bank_accounts`, `classification_rules`, `statement_imports`, `movements`, `ledger_imports`, `ledger_entries` e auxiliares. Nem todos os módulos utilizam essas tabelas diretamente.
- Backups privados em `app_private.conciliar_workspace_backups`. Staging de importação em `app_private.beatriz_2026_import_staging`. Não disponibilizar payloads, e-mails ou chaves em logs/commits.

## Módulos do primeiro ciclo
1. Carteira de Clientes: `client-wallet.js` / `client-wallet.css`; importação e atualização com controle de duplicidade e associação à carteira.
2. Documentos: `document-import.js`, `document-management.js`, CSS; acompanhamento documental por competência.
3. CRM contábil manual: `crm-core.js`, `crm.js`, `crm.css`; calendário e histórico de cobrança sem disparo automático de e-mail.
4. Controle de Conciliações: `tracking-core-v4.js`, `tracking-control-v4.js`, `tracking-control-v4.css`; cronômetro, indicadores e alterações auditáveis vinculados ao controle existente.
- Preservar leitura de extratos/razão/plano de contas, regras bancárias e contábeis, transferências, aprendizagem, Central de Pendências, exportações Domínio, sócios e relacionadas; não reimplementar esses módulos.

## Dados e invariantes
- Workspace corporativo verificado em leitura: revisão 696, 62 empresas (60 da carteira e 2 adicionais no snapshot). O relatório da Melhoria 03 registra 55 ativas, 5 inativas, 76 e-mails e 2.415 registros de plano de contas de quatro empresas originais; revalidar contagens por SQL antes do deploy.
- Preservar histórico documental janeiro–dezembro 2026 e todos os dados posteriores; proibir limpeza/duplicação/reescrita global.
- A política de retenção operacional existente exige verificar condições de encerramento antes de expurgar dados; não disparar limpeza em ambiente de teste corporativo.
- A estrutura por usuário não demonstra compartilhamento multiusuário irrestrito: confirmar permissões e isolamento.

## Testes e limites
- Testes versionados em `testes/`, workflows `.github/workflows/homologacao-carteira-etapa01.yml` e `homologacao-operacional-supabase-local.yml`. O segundo usa Supabase temporário local e arquivos fictícios; não comprova aceitação corporativa em produção.
- Evidências históricas no GitHub Actions e relatórios em `docs/`. Repetir testes no commit EXATO candidato a deploy, revisar logs, screenshots desktop/mobile, autenticação real autorizada, RLS, regressões, persistência, duplicação e importação/exportação.
- Supabase Security Advisor reportou avisos sobre três funções SECURITY DEFINER acessíveis por `authenticated`, e proteção de senhas vazadas desabilitada. Antes de qualquer ajuste, auditar dependências e aprovar política de autorização; não revogar permissões às cegas.

## Procedimento seguro de release
1. Capturar SHAs de main/branches/PRs e deploy atual; verificar branches sequenciais 01→02→03→04.
2. Backup do banco e dos estados operacionais, com revisão, integridade/hash e recuperação testada sem alterar dados reais; preservar snapshot privado existente.
3. Rodar todas as suítes no head final e testar fluxos autenticados, integridade e segurança.
4. Resolver bloqueios de segurança relevantes, migrar com SQL idempotente revisado apenas se necessário e reexecutar verificações.
5. Fazer merge controlado e inspecionar deploy automático da main no serviço Render existente. Não acionar um segundo deploy desnecessário.
6. Smoke test autenticado e monitoramento, comparando revisão, quantidade de empresas e trilhas de dados antes/depois; documentar SHA e deploy ID.
7. Em falha: interromper alterações, restaurar código pelo fluxo Git/Render à versão estável e somente restaurar dados mediante análise de revisão para não sobrescrever eventos novos. Não executar recuperação cega.

## Limitações nesta revisão
PR 79 continua draft e não integrado; homologação em laboratório não substitui validação operacional. Não foram executados merge, migração nem deploy nesta revisão documental. Melhoria 05 excluída.
