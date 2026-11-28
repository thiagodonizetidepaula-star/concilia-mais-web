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
PR 79 foi integrado à main em 2026-11-28 UTC; testes automatizados e E2E isolado aprovados. A verificação interativa de produção com credenciais profissionais não foi realizada nesta auditoria.

## Publicação oficial do primeiro ciclo — 2026-11-28 UTC
- PR #79 integrado diretamente à `main` preservando a cadeia das Melhorias 01 a 04. Commit de merge: `72401eb8a027b2db30436630fd96d439e7a961f4`.
- GitHub Actions no commit candidato `83595ac5fc274a39cfeb66bb44ee7a2757ed3f8d`: 82 testes, 82 aprovados, zero falhas (https://github.com/thiagodonizetidepaula-star/concilia-mais-web/actions/runs/46101160997); E2E autenticado em Supabase isolado com 18 verificações e isolamento entre usuários aprovados (https://github.com/thiagodonizetidepaula-star/concilia-mais-web/actions/runs/46101161016).
- Render original: serviço `srv-db9ttbtg1s2s73a19a9g`; deploy `dep-dc54bcl9el5s73c8e5c0` **live**, commit `72401eb8a027b2db30436630fd96d439e7a961f4`, https://concilia-mais-web.onrender.com.
- Sem migração de produção necessária às quatro melhorias: usam campos JSONB opcionais no workspace existente. Nenhuma mudança nas permissões ou serviços adicionais.
- Antes do merge: 62 empresas, das quais 60 na carteira (55 ativas/5 inativas), 4 planos somando 2.415 registros; backup privado de recuperação `e2a5d544-cfb0-4b03-98f2-8202634fcbe2`, SHA-256 e igualdade dos três payloads testados sem sobrescrever produção.
- Avaliação de segurança: zero avisos de saúde no Supabase; avisos `WARN` remanescentes para três funções SECURITY DEFINER legítimas das políticas RLS (anon sem EXECUTE; auth.uid() nas funções) e proteção de senhas vazadas não habilitada, recurso Supabase Pro+ não contratado. Não afirmar risco zero nem que essas recomendações foram corrigidas.
- Status de validação: deploy live e logs do Render conferidos; testes de funcionamento completo executados em laboratório isolado. Não foi possível inspecionar diretamente a sessão autenticada no endereço de produção nesta execução.
- Melhoria 05 fora do escopo e não implementada.


## Refinamento 01–04 (candidato, PR #80; ainda não publicado)
- Carteira: busca por Domínio/CNPJ/razão/fantasia e limpar pesquisa, sem afetar cadastros.
- CRM: cartões responsivos com detalhes expansíveis, todos os contatos manuais preservados.
- Colagem Excel: `classification-learning.js` valida banco, competência, data, histórico, valor, orientação débito/crédito, plano analítico, duplicidade e conflitos; `applyValidatedPaste` confirma apenas matches inequívocos, aprende por empresa e oferece rollback. `app.js` aguarda a persistência de rascunhos operacionais e da memória no Supabase, sem acionar retenção.
- Central: mensagem verde só quando o assistente de conciliação marca `ready` e não há questões abertas.
- Controle: gráficos rosca/barras/tempo com métricas existentes; campos e edição agrupados, retenção avançada recolhível e cronômetro preservado.
- Produtividade: salvamento automático existente, falhas e alterações locais não protegidas visíveis; inicia manualmente, impede contagem simultânea com Controle 04.
- Testes: `testes/refinamentos-ciclo01-04.test.cjs`, Chromium e `testes/homologacao-real-supabase.cjs` com autenticação e dados fictícios. Não declarar homologação sem CI verde do último commit.
- Banco: sem nova tabela/DDL. Backup privado `764a05ff-96cd-4634-8b2b-148d8605de97` (rev. 696), restauração transacional sem tocar produção e três payloads iguais, hash SHA-256 válido.


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
