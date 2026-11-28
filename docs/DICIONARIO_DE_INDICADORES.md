# ConCiliar+ — Dicionário de Indicadores BI

Versão: ciclo 01 · 2026-11-28. Código de cálculo: `dashboard-bi-metrics.js`; apresentação: `dashboard-bi.js` e `dashboard-bi.css`. **Indicadores de leitura somente.** Não criar tabelas/cópias de dados para visualização.

## Regras gerais
- Autorização: primeiro `ConciliaCloud.accountId()`, depois `ConciliaWallet`/atribuição `walletAssignedUserIds`, e RLS do workspace de origem. Sem usuário autenticado, nenhuma empresa visível.
- Empresa atual: `clientInactive` ou `distractDate` exclui a empresa do total **ativo** e das obrigações atuais; registros históricos no workspace não são excluídos. Datas de distrato para competências anteriores necessitam tratamento explícito quando o histórico oferecer o período efetivo.
- Competência `AAAA-MM` é distinta da data de execução do trabalho.
- Quando o denominador for zero, exibir **Sem dados** (não 0%). Quando a duração não estiver registrada, exibir **Sem medição**.
- Classificação confirmada **não** é sinônimo de conciliação concluída; exportação **não** comprova importação no Domínio.
- Valores de origem desconhecida não podem ser rotulados como automação: são agrupados em “Outras ou sem origem”.
- Números apresentados provêm de campos realmente registrados; não derivar qualidade ou finanças da velocidade do funcionário.
- Os gráficos por competência só mostram histórico que ainda esteja disponível conforme a retenção operacional já autorizada. Não inventar séries anteriores.

## Indicadores implementados

| ID | Categoria | Fórmula | Fonte existente | Unidade e filtros | Limitação |
|---|---|---|---|---|---|
| BI-001 | Carteira | Contagem distinta de empresas autorizadas no workspace | `state.companies` | empresas / usuário, empresa | Não equivale à carteira global de todos os usuários |
| BI-002 | Carteira | Empresas `!clientInactive && !distractDate` | campos cadastrais | empresas / usuário | Estado cadastral atual, não projeção retrospectiva |
| BI-003 | Carteira | BI-001 − BI-002 | campos cadastrais | empresas | Inativas/distratadas permanecem em históricos |
| BI-004 | Operacional | Empresas concluídas ÷ aplicáveis × 100 | `reconciliationTracking[period]`, `ConciliaTrackingCore.effective` | % / competência | Não incluir inativas ou não aplicáveis; ausência de base = Sem dados |
| BI-005 | Operacional | Empresas aplicáveis − concluídas | mesma origem | empresas / competência | Status operacional não substitui conferência contábil final |
| BI-006 | Operacional | Contagem `started && !finished` | registros de início/conclusão | empresas / competência | Não inicia cronômetro |
| BI-007 | Documentos | `status==='Recebido'` ÷ status exigíveis identificados × 100 | `documentHistory[period]` | % / competência | Situações sem registro não entram no denominador conhecido |
| BI-008 | CRM | Empresas aplicáveis com `crmHistory.type==='charge'` no período | `crmHistory` | empresas / competência | Não representa e-mails enviados automaticamente |
| BI-009 | Operacional | Contagem de movimentos cuja data começa com competência | `movements` do workspace operacional | movimentos / competência | Histórico sujeito à política de retenção |
| BI-010 | Classificação | Movimentos `status==='CONFIRMADO'` | `movements` | movimentos / competência | Não representa saldo conciliado |
| BI-011 | Tecnologia | Confirmadas com evidência de origem em `confidence` Aprendizado/Automação | `movements.confidence` | movimentos / competência | Aproximação baseada em evidência textual; não inferir dados ausentes |
| BI-012 | Tecnologia | Confirmadas com origem “Excel colado” | `movements.confidence` | movimentos / competência | Classificação assistida, nunca automática |
| BI-013 | Tecnologia | BI-011 ÷ BI-010 × 100 | registros confirmados | % / competência | Denominador zero = Sem dados |
| BI-014 | Tecnologia | BI-012 ÷ BI-010 × 100 | registros confirmados | % / competência | Independente da taxa de automação |
| BI-015 | Tecnologia | Regras `learnedCodes` não arquivadas/não desativadas | `company.learnedCodes` | regras por empresa | Estoque atual de regras; não número de utilizações |
| BI-016 | Profissional | Soma do tempo registrado das conclusões com valor válido | `ConciliaTrackingCore.effective.effectiveSeconds` | segundos / competência | Sem medição = indicador indisponível |
| BI-017 | Profissional | BI-016 ÷ concluintes com tempo válido | mesmo núcleo | segundos / conclusão | Ignora durações não registradas |
| BI-018 | Qualidade operacional | Pendências ainda em aberto registradas | `effective.pendingRemaining` | ocorrências / competência | Não equivale à qualidade geral do serviço |
| BI-019 | Qualidade operacional | Concluídas com `end <= deadline` ÷ concluídas com datas válidas | registros operacionais | % / competência | Exclui tarefas sem prazo ou datas confirmadas |
| BI-020 | Histórico | Reagregação de BI-001 a BI-019 nas 12 competências do ano | mesmas fontes, filtradas por competência | séries mensais | Sem dados não é zero para tempo/percentual |

## Como registrar um novo indicador
1. Confirmar existência e significado da fonte e permissão; não criar campo fictício.
2. Registrar ID, fórmula com numerador/denominador, unidade, período, filtros, origem, limitações e versão neste documento.
3. Acrescentar cálculo puro no núcleo `dashboard-bi-metrics.js`, sem mutação de workspace.
4. Expor no componente `dashboard-bi.js` apropriado, respeitando o visual e o escopo.
5. Testar divisão por zero, competência futura, históricos, autorização, estado vazio, filtros combinados e responsividade.
6. Atualizar `MANUAL_TECNICO.md`, `CONTINUIDADE_DO_PROJETO.md` e `CHANGELOG.md` na mesma atualização; registrar CI, commit, deploy e backup.
7. Não iniciar módulos futuros, nem Melhoria 05, sem autorização própria.

## Fórmulas planejadas, mas não declaradas como implementadas
Produtividade por hora, taxa de retrabalho por conciliação, custo por empresa, rentabilidade, DRE, balancetes, gestão de funcionários, taxas históricas de uso de regras: **não há prova de base completa para medir todos esses indicadores de modo profissional no estado atual**. Exigir dados auditáveis antes de exibi-los.

Padrão visual: azul-marinho `#080f20`, cartões `#111b35`, ciano `#20cee6`, âmbar `#ffa600`, verde `#35d99c`, vermelho de divergência `#ef4444`; identidade própria ConCiliar+.


## Melhoria 05 — segundo ciclo em desenvolvimento isolado (28/11/2026)
**A Melhoria 05 ainda NÃO está na produção. Nenhuma autorização de merge ou Render foi concedida para o segundo ciclo.** Ela é mantida na branch `feature/melhoria-05-inteligencia-operacional`, com fluxo de testes GitHub Actions e ambiente efêmero Supabase local.

Arquivos reais: `melhoria05-core.js` (regras puras; sem alteração de dados contábeis), `melhoria05-ui.js` (nove perspectivas internas, persistência privada CAS, relatórios), `melhoria05.css` (BI azul-marinho responsivo), `index.html` e `app.js` (encaixe na Visão Geral sem página principal duplicada), `supabase/migrations/20261128050000_melhoria05_user_states.sql` (SOMENTE proposta, não executada na produção), `testes/melhoria05-nucleo.test.cjs`, `testes/melhoria05-visual.html` e `testes/homologacao-melhoria05.cjs` (cálculos, fixture e E2E Auth/RLS no laboratório).

Reaproveitamento: `ConciliaBIMetrics`, `ConciliaTrackingCore`, `ConciliaManualProductivity.history()`, `ConciliaCloud`, dados existentes de documentos, CRM, empresas e aprendizagem. A nova coleção `user_melhoria05_states` é isolada por `auth.uid()` no RLS e usa revisão otimista (CAS) para proteger gravações; não substitui `user_workspaces` nem `user_productivity_states` e não altera o cronômetro. **O procedimento de publicação futura depende de aprovação separada e migração testada; não aplicar a migration automaticamente.**

Os registros de qualidade, metas, autoavaliações, diário, realizações e PDI são *declarações identificadas do profissional*, com origem e trilha de alterações. Indicadores automáticos de produtividade, conciliação e automação vêm apenas dos registros previamente autorizados. Classificação confirmada não significa conciliação aprovada; tempo manual não é somado ao cronômetro do Controle 04; metas, complexidade e análises não determinam punições nem juízos definitivos de competência.

Relatórios XLSX usam a biblioteca `XLSX` já presente; PDF depende da impressão/salvamento nativo do navegador. O portfólio exportável remove nomes/identificadores de clientes e textos livres para evitar vazamento de informações corporativas. A ausência de dados é representada por **Sem dados / Sem medição**, nunca por valores inventados.

Para extensão: incluir novos critérios em `docs/DICIONARIO_DE_INDICADORES.md`, testar RLS de dois usuários e concorrência CAS, validar logs dos GitHub Actions na mesma versão, revisar documentação, criar ZIP de homologação, e **aguardar autorização do segundo ciclo**. Não iniciar Melhoria 06.
