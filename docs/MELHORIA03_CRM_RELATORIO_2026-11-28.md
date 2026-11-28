# ConCiliar+ — Melhoria 03: CRM Contábil e Gestão Manual de Cobranças
## Relatório de auditoria, implementação e homologação

**Data-base:** 27/11/2026 (Brasília), verificação UTC de 28/11/2026.  
**Branch de desenvolvimento:** `feature/melhoria03-crm-manual-homologacao-20261128`.  
**Origem:** `feature/melhoria02-gestao-documentos-homologacao-20261128`, incorporando a Melhoria 01.  
**Produção:** **NÃO PUBLICADA**; Render `concilia-mais-web` continua na `main` (commit `dfd68f90cbb3a3683add94623eb7254c2a46a3cd`).

## 1. Diagnóstico e pré-condições
- As Melhorias 01/02 já existiam no código da branch-base (Carteira de Clientes, Controle de Documentos e importação segura por CNPJ).
- `user_workspaces.payload` é o armazenamento durável por usuário no Supabase, protegido por RLS: objetos `companies` contêm `plan`, `plansHistory`, `rules`, `partners`, `relatedCompanies`, `documentHistory`, `closingHistory` etc.
- O sistema já oferece `ConciliaWallet.visible()` para restringir empresas ao usuário da sessão e `store()`/ `ConciliaCloud.serializedSave()` para persistir via RPC protegida por revisão.
- Não existe uma central independente de notificações identificada na UI; os alertas foram adicionados à Visão Geral e à nova aba CRM, sem reconstruir dashboards.
- Proibição observada: sem Outlook/Graph, sem mensagens automáticas, sem contato externo e sem nova estrutura de serviços.

## 2. Ponto seguro de recuperação
Backup privado: `app_private.conciliar_workspace_backups`, ID:
`9a1581b7-1356-4f3c-b6f9-c448adaaeb50`.

Snapshot completo da revisão **696**, com **62 empresas** e checksum SHA-256 validado, incluindo payloads operacionais e produtividade quando existentes. A tabela privada não é acessível por `anon` ou `authenticated`. **Nenhuma restauração foi executada**. O Git possui a branch-base e os PRs anteriores para reversão de código.

## 3. Implementado na Melhoria 03
- Aba lateral **CRM Contábil**, identidade visual consistente com o ConCiliar+ e acesso aos cadastros existentes, sem tabelas paralelas de empresas.
- Calendário mensal e anual na timezone `America/Sao_Paulo`: dias **14, 15, 24, 25** por padrão; valida cronologia, limita dias a 1–31, permite `last-day` ou `skip` para meses curtos. Sem ajuste implícito de finais de semana/feriados.
- **Configurações de Cobranças** por workspace autenticado, com Editar, Salvar, Cancelar e Restaurar; `state.crmSettings.dates` é durável via fluxo existente. Alterações mudam o calendário futuro, não eventos históricos.
- Alertas de eventos previstos e vencidos na **Visão Geral** e no CRM, com contagem de empresas que possuem pendências. Não foram criadas notificações externas.
- Lista automática de cobranças: inclui `Pendente`, `Parcialmente recebido` e `Cobrado` não recebido, inclusive competências anteriores exigíveis. Exclui `Recebido`, `Não se aplica`, competência futura e empresas com distrato/inativas ou fora da carteira autenticada. `Sem registro` fica em painel separado de conferência.
- Tabela: código Domínio, razão social, CNPJ, e-mails, competências, status documental, última cobrança **manual conhecida**, contagem de contatos efetivamente registrados, situação CRM, acesso ao cadastro original.
- Formulários: copiar e-mails; registrar cobrança manual com múltiplas competências, data efetiva informada, meio (Outlook corporativo manual, telefone, WhatsApp manual, outro), responsável autenticado, observação, próximo acompanhamento e situação; registrar retorno e nota; consultar histórico cronológico.
- Status CRM: **A cobrar, Cobrança realizada, Aguardando retorno, Cliente respondeu, Documentação parcialmente recebida, Documentação recebida, Cobrança dispensada**. Status documental não é sobrescrito pelo status CRM.
- Histórico: `company.crmHistory[]`, eventos com ID, tipo, competências, data informada, meio, ator autenticado, data de registro, status e observação; rejeita duplicação acidental da mesma combinação contato/competências/data/meio/funcionário, permitindo repetição legítima com confirmação explícita.
- Integração com Controle de Documentos: mudar manualmente um documento para `Recebido` faz a competência desaparecer da cobrança e registra o fato como alteração de status **sem inventar data efetiva de recebimento**, mantendo o histórico anterior.
- Indicadores: empresas a cobrar, cobradas/pendentes na rodada, aguardando retorno, com pendências, com atrasos recorrentes (definidos como duas ou mais competências exigíveis), próximo lembrete e próxima cobrança. Filtros por empresa, competência, ano, situação.

## 4. Reaproveitamento e arquivos
**Novos**: `crm-core.js` (regras puras), `crm.js` (interface e persistência), `crm.css` (estilos), `testes/crm-melhoria03.test.cjs` (testes), `testes/crm-homologacao-visual.html` (captura fictícia), este relatório.

**Alterados**: `index.html` (aba, alertas na Visão Geral, CSS e scripts), `app.js` (título e atualização da UI), `document-management.js` (log de recebimento manual), `client-wallet.js` (abrir diretamente detalhes de empresa existente), workflows de CI e teste de Supabase local.

**Não modificados**: módulos de leitura/importação/exportação Domínio, Razão, bancos, conciliação, classificação aprendida, impostos, transferência, sócios e empresas relacionadas.

**Banco de produção**: nenhuma tabela, coluna ou migration nova para o CRM; apenas um backup privado de segurança. Nenhum registro real de cobrança, data ou empresa foi criado/modificado.

## 5. Verificação dos dados reais preservados (somente leitura)
A verificação SQL de 28/11/2026 confirmou:
| Critério | Resultado |
|---|---:|
| Revisão do workspace | 696 |
| Empresas totais | 62 |
| Carteira Beatriz | 60 |
| Ativas | 55 |
| Inativas/distrato | 5 |
| E-mails | 76 |
| Empresas com 12 competências documentais e de fechamento | 60 |
| Registros de planos de contas das 4 empresas originais | 2.415 |
| Checksum e igualdade com o backup da Melhoria 03 | Verdadeiro |
| Registros reais de CRM já gravados | 0 |

A ausência de `crmHistory` no workspace real é esperada: **nenhuma cobrança foi registrada ou presumida antes de o usuário usar a nova interface**.

## 6. Evidências e resultados
- **Suíte de código / regressão / Chromium**: 55/55 testes aprovados, 0 falhas, com snapshots desktop/mobile das melhorias 01, 02 e 03, executados em ambiente isolado. https://github.com/thiagodonizetidepaula-star/concilia-mais-web/actions/runs/46096174225
- **Supabase local/Auth/RLS real**: cenário E2E da Melhoria 01/02 estendido para salvar configuração de datas do CRM, registrar cobrança manual, verificar separação do status documental, persistir após logout/login e testar outro usuário. Evidência da execução operacional mais recente **deve ser verificada antes de declarar aprovação**.
- Evidências visuais geradas apenas com empresas **fictícias**; nenhum cliente real no repositório público ou em capturas.
- Correções encontradas: estilo da fixture de testes ocultava a interface sem a classe `authenticated` (corrigido); navegação direta da empresa; notas não reiniciam status de cobrança; rótulos traduzidos; estados de autenticação com seleção obsoleta; teste E2E passa à listagem antes de conferir configuração após login; histórico da mudança manual de recebimento sem data inventada.

## 7. Limitações / autorização de publicação
- Testes automatizados com arquivos sintéticos e Auth real em **Supabase local temporário** não substituem a aceitação manual da equipe corporativa com sessão de homologação.
- A Melhoria 01/02/03 está em branches **não publicadas**; o Render oficial não apresenta ainda a nova aba CRM.
- A conta Render atinge seu limite de 25 serviços; nenhum novo serviço foi criado. Hospedagem independente exigiria autorização de capacidade/custo antes de qualquer ação.
- A estrutura atual dos workspaces é por **usuário**, sem compartilhamento transversal de empresas entre contas distintas; não prometer compartilhamento sem integrar `company_members` com segurança.
- Avisos de segurança do Supabase sobre funções `SECURITY DEFINER` e proteção de senhas vazadas permanecem para análise pré-publicação; não foram alterados.
- Nenhum envio Outlook, leitura de resposta ou outro recurso futuro foi implementado.
- **Não realizar merge na main nem publicação no Render antes de aprovação explícita do solicitante.**
- **Melhoria 04 não iniciada.**

## 8. Recuperação
- Código: fechar/rejeitar PR da Melhoria 03, excluir a branch de desenvolvimento; `main` e os PRs #76/#77 permanecem intactos.
- Dados: nenhuma mudança funcional no workspace corporativo; backup privado `9a1581b7-1356-4f3c-b6f9-c448adaaeb50` retém a revisão 696. Qualquer recuperação real exige confirmação administrativa e conferência de revisão para não sobrescrever lançamentos posteriores.
