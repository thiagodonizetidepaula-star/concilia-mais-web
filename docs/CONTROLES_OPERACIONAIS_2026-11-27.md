# ConCiliar+ — implantação incremental de controles operacionais

Data: 2026-11-27. Esta branch não é uma publicação em produção.

## Entregue nesta branch (primeira etapa)
- Botões de produtividade: recalcular indicadores, zerar medição, iniciar novo ciclo e restaurar último ciclo.
- Antes de zerar/iniciar outro ciclo, arquivar registro anterior no navegador (até 30 ciclos por empresa/competência).
- Registros de ações no navegador (até 500 eventos), com horário e identidade disponível da conta.
- Confirmar ações que alteram a contagem, sem modificar extratos, Razão, classificações ou documentos.
- Conferência estática de sintaxe JS; **ainda requer homologação funcional**.

## Limitações explícitas
- Os arquivos do painel usam localStorage; ciclos e ações não são auditoria central persistente.
- "Recalcular" atualiza as métricas a partir da sessão, não refaz conciliação nem reimporta arquivos.
- O botão "Zerar" reinicia somente a medição de produtividade; não apaga registros contábeis.
- O app possui código Supabase e operações locais, portanto não substituir a trilha operacional por localStorage.
- Não há testes automatizados de navegador para esta alteração.

## Próximas entregas — pendentes
1. Auditoria por usuário **no servidor** com isolamento de organizações, revisão de RLS e escrita imutável.
2. Versionamento de conciliações com cópia recuperável, concorrência segura e testes de restauração.
3. Editor de lançamentos com desfazer/refazer por evento, preservando valores originais do extrato.
4. Reimportação idempotente por documento/banco/competência com prévia de diferenças.
5. Central de pendências baseada nos dados de conciliação e auditoria existentes.
6. Conferência de saldo bancário versus Razão definitivo com sinais, período e saldos iniciais.
7. Biblioteca versionada de modelos PDF/XLSX; OCR somente com validação.
8. Gerenciamento de regras aprendidas com escopo empresarial, desativação e exclusão lógica.
9. Dashboard sincronizado com métricas reais e trilha central, sem duplicidade em reprocessamentos.

## Critérios de homologação antes do merge
- Fluxos existentes de importação, classificação, geração Excel/PDF e auditoria sem regressão.
- Testar dois bancos da mesma competência e troca de empresa/competência.
- Testar iniciar, pausar, finalizar, zerar e restaurar ciclos.
- Testar recarregar a página, storage indisponível e múltiplas abas.
- Testar que reinício do painel não altera lançamentos no banco/estado.
- Criar backup validado antes de qualquer migração ou implantação.

**Regra de execução:** nenhuma migração destrutiva, merge automático ou deploy em produção sem testes e validação.

## Atualização de execução (27/11/2026)

- Dashboard reforçado: em falha de arquivamento no armazenamento local, a ação de zerar é cancelada sem apagar a medição.
- Exportação CSV agora inclui ciclos arquivados e atuais.
- Metadados de auditoria operacional no app: competência e identificador do usuário conectado.
- Nova tela **Regras aprendidas**, por empresa: editar rótulo, definir/remover preferência de código analítico validado, ativar/desativar, arquivar/restaurar.
- Regras desativadas ou arquivadas não geram sugestões; restauração exige ação do operador.
- Simulações executadas em JavaScript: iniciar/zerar/restaurar/novo ciclo; falha de armazenamento; edição, código bancário inválido, desativação e arquivamento.
- **Ainda não houve teste completo no navegador, merge nem deploy de produção.**
- **Auditoria operacional continua local**: evento com identificador não constitui trilha central imutável.
- O código existente usa rascunhos operacionais em IndexedDB, enquanto o Supabase sincroniza cadastros. Versionamento remoto precisa de desenho específico para evitar perda de conciliações.

### Verificação de segurança Supabase (somente leitura)

O projeto identificado no Supabase foi `Concilia+ Web`, ref `csnvudadurtzhudlplij`.
O verificador de segurança em 27/11/2026 exibiu avisos sobre três funções SECURITY DEFINER executáveis por usuários autenticados (`company_can_read`, `company_can_write`, `company_is_owner`) e proteção contra senhas vazadas desativada.
Esses avisos precisam de revisão do modelo de permissões; não revogar acesso automaticamente sem testar as políticas RLS que dependem dessas funções.
Documentação de referência: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable e https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

### Ainda pendente de implantação
- Desfazer/refazer lançamentos com trilha de eventos e testes contábeis.
- Snapshots de conciliação recuperáveis e idempotência por arquivo.
- Conferência automática de saldos além dos leitores já existentes.
- Biblioteca de modelos personalizável, preservando os leitores de bancos atuais.
- Auditoria de usuários central, com RLS validada e armazenamento imutável.
