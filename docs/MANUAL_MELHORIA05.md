# ConCiliar+ — Manual da Melhoria 05 (candidata isolada)

**ATENÇÃO: a Melhoria 05 não está disponível no Render de produção.** A edição corrente existe exclusivamente na branch de desenvolvimento `feature/melhoria-05-inteligencia-operacional`, PR #82 em rascunho. A tabela proposta `public.user_melhoria05_states` só deve ser criada em ambiente seguro até que o segundo ciclo seja autorizado.

## Acesso e navegação
Entre na conta autorizada e abra **Visão Geral** → **Inteligência operacional e desenvolvimento**. As nove perspectivas utilizam a estrutura existente, sem alterar os saldos ou classificações contábeis. Os filtros avançados permitem intervalo por dia/semana/mês/trimestre/semestre/ano/personalizado, ano, dia de referência, competência contábil separada, empresa, tipo de atividade e status. Para funcionário, a versão atual disponibiliza **somente a própria conta**; não há recurso para visualizar colegas sem permissão gerencial expressa.

## 05.1 Produtividade
Acompanhe atividades com data real de execução, empresa, competência, tipo, tempo efetivo, pausa, espera, retrabalho e movimentações. Preencha somente tempos medidos. O ID da origem impede recontabilização acidental quando preenchido. Os cronômetros antigos permanecem em suas telas, e **não são somados automaticamente a este registro** sem correspondência comprovada. O histórico do cronômetro manual original é preservado.

## 05.2 Empresas
Selecione uma empresa para tabela de desempenho e série de competências. Complexidade só é calculada quando todos os cinco parâmetros têm valores auditáveis: volume, contas bancárias, pendências, classificações manuais e retrabalhos. Os limiares estão em `melhoria05-core.js`; não representam a qualidade da empresa.

## 05.3 Qualidade
Cadastre ocorrência com gravidade, categoria, causa e ação corretiva. Para registrar a revisão use as transições: **Executada → Aguardando revisão → Em revisão → Aprovada ou Devolvida → Correção realizada → Nova revisão → Aprovada ou Devolvida**. Cada mudança mantém autor, data e histórico; primeira revisão e retrabalho exigem eventos explícitos. Exportação do arquivo não significa aprovação.

## 05.4 Eficiência
A produtividade/hora só é exibida com tempo efetivo relacionado ao trabalho. Pausas e espera são separadas; ausência de medição não equivale a zero. A capacidade estimada depende do tempo histórico e da disponibilidade informada. Nenhuma promessa automática de conclusão é feita.

## 05.5 Aprendizagem
As sugestões geradas por regras aprendidas a partir desta versão registram `learningUsage` no movimento e podem ser comparadas ao código final confirmado. Isso distingue **sugestão, confirmação e correção** e impede inventar o histórico de regras anterior à instrumentação. Registros manuais adicionais de uso são armazenados separadamente com origem declarada.

## 05.6 Metas
Cadastre título, indicador, base, alvo, direção, frequência, início, prazo, empresa e competência. Cada meta utiliza **seu próprio período e empresa**, não a competência aberta na interface. Dia/semana/mês/ano são suportados apenas quando os dados têm granularidade correspondente; sem base é exibido **Sem dados**. Registre um calendário de horas diárias, folgas e prazo para cálculo de dias úteis e ritmo necessário.

## 05.7 Desenvolvimento
Categorize competências em Contabilidade, Administração, Análise de dados, Tecnologia e automação ou Gestão da qualidade; identifique autoavaliações e evidências. O diário, realizações, PDI e linha do tempo não geram certificações nem julgamentos automáticos.

## 05.8 Relatórios
Abra **Relatórios**. **Excel temático** cria dez planilhas com indicadores, empresas, produtividade, qualidade, metas, automação, desenvolvimento, tendência, metodologia e limitações, além de uma capa. **PDF profissional** utiliza o recurso de impressão do navegador: escolha **Salvar como PDF** no diálogo do sistema. A opção externa anonimizada remove campos livres, CNPJs e nomes de empresas; compartilhamento externo depende da política do escritório.

## Segurança, testes e publicação
`user_melhoria05_states` tem RLS `user_id=auth.uid()`, permissões específicas para `authenticated`, e revisão otimista por número de versão (CAS). A aplicação preserva o usuário, data, valor anterior e novo nos ajustes; a versão oficial na `main` e no Render permanece inalterada. Testar com Auth e dois usuários fictícios, RLS SELECT/UPDATE, exportações PDF/XLSX, concorrência, períodos e regressão antes de solicitar o segundo ciclo.

A matriz de requisitos está em `docs/MATRIZ_REQUISITOS_MELHORIA05.md` e é a fonte de acompanhamento das lacunas. **Não declarar conclusão integral até que os itens essenciais tenham evidência no commit candidato.** Não iniciar Melhoria 06.


### Ajustes de tempo com justificativa
Na perspectiva Produtividade, use **Ajustar** na linha da atividade. Informe os valores medidos e o **motivo do ajuste**. O sistema conserva usuário autenticado, data, valor anterior e valor ajustado no histórico, sem modificar lançamentos contábeis ou apagar a medição original.
