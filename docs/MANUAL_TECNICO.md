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


## Governança permanente dos dashboards e arquitetura BI integrada (2026-11-28)
**Regra de desenvolvimento vinculante, inclusive em futuras conversas ChatGPT Work/Codex:** nenhuma funcionalidade autorizada está completamente desenvolvida sem análise de impacto no BI, identificação de fontes, indicadores pertinentes, cálculo, filtros, permissões, testes e atualização dos painéis existentes. Indicadores só aparecem se fontes reais os sustentarem. A ausência de novas métricas pertinentes deve ser explicitamente justificada e registrada. Esta regra não antecipa a Melhoria 05 nem autoriza serviços ou custos.
Quatro perspectivas permanentes: (1) produtividade e desenvolvimento profissional; (2) desempenho operacional individual por empresa; (3) gestão consolidada da carteira; (4) tecnologia, automação e aprendizagem. São informações de naturezas diferentes: não confundir velocidade/eficiência, qualidade, complexidade ou finanças.

### Arquivos reais — mapa de responsabilidades
- `dashboard-bi-metrics.js`: núcleo puro de cálculos e agregações somente leitura, reutilizando `ConciliaTrackingCore.effective`, `state.companies`, `documentHistory`, `crmHistory`, `reconciliationTracking`, `movements` e `learnedCodes`.
- `dashboard-bi.js`: apresentação responsiva dentro da **Visão Geral** existente, quatro perspectivas internas, filtros de ano, competência, empresa e pesquisa, séries mensais, estados sem medição, gráficos e cartões.
- `dashboard-bi.css`: tokens visuais e componentes de BI escuro em escopo `#conciliaBI`, sem mudar estilos globais das abas antigas.
- `index.html` e `app.js`: carregamento e renderização dentro do fluxo existente sem duplicar telas nem dados.
- `tracking-control-v4.js`, `tracking-core-v4.js`, `productivity-manual-v2.js`, `crm.js`, `document-management.js`: fontes e fluxos preservados; suas permissões e regras permanecem vigentes.
- `testes/dashboard-bi-integrado.test.cjs`: cálculos, acesso por usuário, zero denominador, séries, tempo ausente, inativos, separação Excel/automação.
- `testes/dashboard-bi-visual.html`: screenshot e DOM no Chromium de dados **exclusivamente fictícios**, sem conexões corporativas.
- `testes/homologacao-real-supabase.cjs`: integração autenticada em Supabase temporário, incluindo vistas do BI e isolamento entre usuários.
- `docs/DICIONARIO_DE_INDICADORES.md`: identificadores, fórmulas, fontes, unidades, filtros, disponibilidade e limitações, além do procedimento de extensão.

### Fluxo obrigatório para cada atualização futura
1. Identificar dados novos e seus significados, disponibilidade temporal e natureza (contábil, operacional, profissional, tecnológica).
2. Verificar identidade, autorização do usuário, carteira e isolamento do Supabase; não aumentar privilégios para viabilizar indicadores.
3. Definir/ajustar indicadores no dicionário; evitar double-count de empresa, movimento, sessão ou histórico.
4. Implementar no núcleo puro de métricas e na perspectiva correspondente, sem duplicar a fonte.
5. Atualizar filtros, gráficos, drilldowns somente quando justificáveis. Dados inexistentes são indisponíveis, não zeros inventados.
6. Executar unitários, integração, cálculos, regressão, histórico, RLS, estados vazios, responsividade e visual (desktop/mobile).
7. Atualizar `MANUAL_TECNICO.md`, `CONTINUIDADE_DO_PROJETO.md`, `DICIONARIO_DE_INDICADORES.md`, `CHANGELOG.md` e `README.md` como apropriado.
8. Criar backup seguro, trabalhar em branch, registrar commit/PR e homologar; publicar via **Render original** apenas se o CI e o controle de integridade estiverem aprovados.
9. Confirmar versão live e dados pós-deploy; gerar **CONCILIAR_PLUS_PROJETO_COMPLETO.zip** com código completo publicado, docs e evidências, excluindo credenciais. Backup de dados corporativos permanece protegido/separado no Supabase, não exportado no ZIP.
10. Registrar limitações e caminhos de recuperação. Não criar Melhoria 05 automaticamente.

### Padrão BI aprovado
Fundo `#080F20`, cartões `#111B35`, secundário `#14213D`, ciano `#20CEE6`, verde `#35D99C`, âmbar `#FFA600`, vermelho de alerta `#EF4444`, borda `#253354` e texto `#98AACB`. A imagem é **referência visual**, sem copiar a marca Romeiro ou números do exemplo. A identidade do ConCiliar+ continua própria. Sem React/TSX novo: projeto real é JavaScript navegador e CSS, com scripts existentes, sem pipeline de compilação.


## Melhoria 05 — segundo ciclo em desenvolvimento isolado (28/11/2026)
**A Melhoria 05 ainda NÃO está na produção. Nenhuma autorização de merge ou Render foi concedida para o segundo ciclo.** Ela é mantida na branch `feature/melhoria-05-inteligencia-operacional`, com fluxo de testes GitHub Actions e ambiente efêmero Supabase local.

Arquivos reais: `melhoria05-core.js` (regras puras; sem alteração de dados contábeis), `melhoria05-ui.js` (nove perspectivas internas, persistência privada CAS, relatórios), `melhoria05.css` (BI azul-marinho responsivo), `index.html` e `app.js` (encaixe na Visão Geral sem página principal duplicada), `supabase/migrations/20261128050000_melhoria05_user_states.sql` (SOMENTE proposta, não executada na produção), `testes/melhoria05-nucleo.test.cjs`, `testes/melhoria05-visual.html` e `testes/homologacao-melhoria05.cjs` (cálculos, fixture e E2E Auth/RLS no laboratório).

Reaproveitamento: `ConciliaBIMetrics`, `ConciliaTrackingCore`, `ConciliaManualProductivity.history()`, `ConciliaCloud`, dados existentes de documentos, CRM, empresas e aprendizagem. A nova coleção `user_melhoria05_states` é isolada por `auth.uid()` no RLS e usa revisão otimista (CAS) para proteger gravações; não substitui `user_workspaces` nem `user_productivity_states` e não altera o cronômetro. **O procedimento de publicação futura depende de aprovação separada e migração testada; não aplicar a migration automaticamente.**

Os registros de qualidade, metas, autoavaliações, diário, realizações e PDI são *declarações identificadas do profissional*, com origem e trilha de alterações. Indicadores automáticos de produtividade, conciliação e automação vêm apenas dos registros previamente autorizados. Classificação confirmada não significa conciliação aprovada; tempo manual não é somado ao cronômetro do Controle 04; metas, complexidade e análises não determinam punições nem juízos definitivos de competência.

Relatórios XLSX usam a biblioteca `XLSX` já presente; PDF depende da impressão/salvamento nativo do navegador. O portfólio exportável remove nomes/identificadores de clientes e textos livres para evitar vazamento de informações corporativas. A ausência de dados é representada por **Sem dados / Sem medição**, nunca por valores inventados.

Para extensão: incluir novos critérios em `docs/DICIONARIO_DE_INDICADORES.md`, testar RLS de dois usuários e concorrência CAS, validar logs dos GitHub Actions na mesma versão, revisar documentação, criar ZIP de homologação, e **aguardar autorização do segundo ciclo**. Não iniciar Melhoria 06.


## Melhoria 05 — extensão modular e governança (candidata, 2026-11-28)
**Sem merge ou publicação do segundo ciclo.** Matriz original com 1.118 requisitos listados por linha: `docs/MATRIZ_REQUISITOS_MELHORIA05.md`. Manual operacional: `docs/MANUAL_MELHORIA05.md`.

**Contrato de código:** `melhoria05-core.js` (tipos, auditoria, metas e eventos privados), `melhoria05-analytics.js` (filtros puros, séries, revisões, comparação, metas, dias úteis, learning e estimativas), `melhoria05-ui.js` (persistência RLS/CAS e nove perspectivas), `melhoria05-advanced-ui.js` (filtros e drilldowns), `melhoria05-reports.js` (PDF HTML para impressão + Excel temático), `melhoria05.css` e `melhoria05-advanced.css` (BI sem CSS global), `app.js` (metadados prospectivos de uso de regra no próprio movimento), `index.html` (carregamento integrado).
**Persistência proposta:** `supabase/migrations/20261128050000_melhoria05_user_states.sql`, com `user_id` FK, JSONB payload, revision CAS e RLS de dono; aplicada **somente ao laboratório Supabase** até autorização expressa para o segundo ciclo.

**Limites e fontes:** competência não é dia de execução. Cronômetro 04 e Produtividade Manual são fontes distintas; o módulo 05 nunca soma ambas sem vínculo auditável. `learningUsage` registra sugestões de regras novas prospectivamente com `ruleKeys`, código sugerido e data, sem mudar débito/crédito; confirmação é observada apenas quando o lançamento realmente está CONFIRMADO com código igual. Nenhuma data retroativa é inferida. `melhoria05-reports.js` produz relatórios privados filtrados e saída externa que descarta campos livres confidenciais.

**Testes candidatos:** `testes/melhoria05-nucleo.test.cjs`, `testes/melhoria05-integral.test.cjs`, `testes/melhoria05-visual.html`, `testes/homologacao-melhoria05.cjs` e todas as regressões 01–04. CI deverá comprovar RLS real (dois usuários fictícios), CAS, exportação XLSX, HTML diagramado para PDF, cronômetros isolados, responsividade, fórmulas e históricos. Nenhum CI verde em commit antigo confirma alterações posteriores. Backup ZIP com commit exato e hashes após a homologação da branch.


### Retenção e aprendizagem — agregação idempotente
`app.js` adiciona `captureLearningMonthly()`, que sintetiza contagens de sugestões, confirmações e correções das regras por competência e `ruleKey`, antes do salvamento e da limpeza operacional. Os resumos `company.learnedUsageMonthly` são gerenciais, não armazenam extratos ou saldos e não são removidos com movimentos antigos; os dados só aparecem se eventos reais `movement.learningUsage` tiverem sido registrados. A função `learningFromCompanies()` prefere eventos disponíveis e recorre aos resumos dos meses já sem movimentos, sem dupla contagem e sem alocar totais mensais a dias.
Ajustes manuais de `effectiveSeconds`, pausas, espera, retrabalho ou volume exigem `adjustmentReason` não vazio e são auditados em `record.audit` com antes/depois, autor e data.
