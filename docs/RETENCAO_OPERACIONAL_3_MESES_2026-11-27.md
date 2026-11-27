# Retenção automática de três meses — ConCiliar+ (27/11/2026)

## Regra implementada

Para cada **empresa e competência (AAAA-MM)**, a limpeza só acontece quando TODAS as condições são verdadeiras:
1. O último dia do terceiro mês seguinte à competência já passou (ex.: julho/2026 → 31/outubro/2026; agosto/2026 → 30/novembro/2026).
2. O registro em **Controle de Conciliações** possui data de conclusão.
3. O responsável marcou **Conciliação lançada e conferida no Domínio**.
4. O responsável marcou **DRE concluída/conferida e documentos dispensáveis**.

Exemplo: em 27/11/2026, julho/2026 pode ser elegível se as confirmações estiverem registradas; agosto/2026 NÃO é elegível. Não é considerado concluído apenas porque o relatório está pronto ou o tempo de produtividade foi encerrado.

## Quando a limpeza roda

- Automaticamente ao acessar a conta e carregar os dados da nuvem (somente se a sincronização operacional estiver disponível);
- Automaticamente ao salvar alterações no aplicativo;
- Uma vez por dia enquanto o aplicativo permanecer aberto.

Não há neste lançamento job cron executado remotamente sem o aplicativo aberto. Se ninguém acessar o sistema, a remoção pode ocorrer no próximo acesso.

## O que é removido

Somente registros operacionais identificados **com segurança por competência**:
- Importações de extratos/Razão com todos os períodos da importação elegíveis;
- Movimentações bancárias da competência;
- Razão, controles financeiros, taxSplits, transferências vinculadas a movimentações removidas;
- Revisões mensais e registros operacionais vinculados a importações removidas.

Importações que abrangem vários períodos, dos quais alguns ainda estão protegidos, são conservadas. Itens sem competência identificável não são apagados.

## O que é preservado sem exceção pela função

- Empresas, CNPJ, dados cadastrais, contas bancárias, plano de contas e versões do plano;
- Regras e códigos aprendidos, parceiros/sócios, empresas relacionadas, regras tributárias;
- Histórico gerencial de Controle de Conciliações, inclusive datas de fechamento e confirmações;
- Histórico resumido de produtividade, separado na tabela `user_productivity_states`;
- Qualquer competência sem confirmação formal de Domínio e DRE.

## Onde é aplicado

A mesma limpeza atua sobre o estado operacional que é salvo no IndexedDB e replicado para a tabela `user_operational_drafts` do Supabase. O workspace cadastral `user_workspaces` permanece íntegro.

## Garantias e limitações

- Código foi testado em dados fictícios (competências vencidas, protegidas, mistas e repetição).
- A exclusão é definitiva após a sincronização e não deve substituir políticas legais ou contratuais de guarda de documentação. Confirme os prazos obrigatórios de arquivamento dos documentos originais em outro repositório (SharePoint/Domínio/arquivo oficial).
- Nenhum registro existente foi excluído durante o desenvolvimento; a primeira limpeza ocorre apenas quando um usuário com dados elegíveis e confirmações registradas abrir/salvar no aplicativo.
- Itens sem indicação clara de competência são retidos por segurança e podem exigir revisão posterior.

