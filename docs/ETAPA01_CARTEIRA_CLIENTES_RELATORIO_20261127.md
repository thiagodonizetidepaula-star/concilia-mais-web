# ConCiliar+ — Etapa 01: Carteira de Clientes (revisão em branch)
Data: 27/11/2026

## 1. Estado da entrega
- Branch de revisão: `feature/carteira-clientes-etapa01-review-20261127`.
- Recuperação: `main` no commit **dfd68f90cbb3a3683add94623eb7254c2a46a3cd** (nenhuma alteração aplicada à branch principal).
- **Não publicado em produção e não mesclado à main.**
- Sem alteração de tabelas, registros ou políticas RLS em produção.

## 2. Diagnóstico e estruturas reaproveitadas
- Aplicativo é HTML/CSS/JavaScript, mantido no repositório `thiagodonizetidepaula-star/concilia-mais-web`.
- `index.html`: menu lateral, página de empresas e formulários existentes.
- `app.js`: função atual de importar planos do Domínio; `state.companies`, `showPage`, `store`, `render`.
- `cloud.js`: autenticação Supabase, `user_workspaces`, sincronização e RLS por `auth.uid()`.
- `partners.js` e formulários existentes `#partnerForm` / `#relatedCompanyForm`: sócios e empresas relacionadas.
- `core.js` e `pdf-reader.js`: identificação de empresa e códigos do plano.
- Existem tabelas relacionais `companies` e `company_members` protegidas por RLS, porém o aplicativo operacional atual utiliza cadastros em `user_workspaces`. O fluxo atual não sincroniza automaticamente `state.companies` com `companies/company_members`.

## 3. Implementação feita na branch
- Nova opção **Carteira de Clientes** no menu, sem mover ou substituir as abas.
- Nova tela responsiva com contador real da carteira da conta autenticada, pesquisa por razão social/CNPJ, cartões, detalhes e formulário de edição.
- Edição de razão social, nome fantasia, CNPJ validado e observações, com botões Salvar/Cancelar. CNPJ inválido, duplicado e exclusão do CNPJ existente são bloqueados; mudança legítima requer confirmação explícita.
- Atalhos funcionais por navegação para plano de contas ativo, cadastro de sócios e empresas relacionadas — sem duplicar as estruturas.
- Importação de plano do Domínio continua seu fluxo original e passa a registrar a identidade do importador em `walletAssignedUserIds` (campo na empresa existente do workspace).
- Busca de CNPJ normalizado, confirmação ao importar sem CNPJ verificável, proteção contra fusão de empresas homônimas com CNPJs distintos, confirmação de divergência de razão social, proteção de nomes editados manualmente.
- Para cadastros legados sem `walletAssignedUserIds`, a carteira mostra empresas já contidas **no próprio workspace autenticado**, sem mover dados entre contas.
- Dados continuam persistidos pelo fluxo `store` / `user_workspaces`, sem tabela paralela.

## 4. Arquivos
- `index.html` — inclusão do botão no menu, seção `p-carteira`, CSS e JS com cache-busting.
- `client-wallet.js` — componente de carteira, pesquisa, detalhes, edição e atalhos.
- `client-wallet.css` — estilos isolados responsivos, alinhados ao visual existente.
- `app.js` — integração de render/navegação e ajuste protegido da importação de plano do Domínio.
- Este documento de auditoria e entrega.
- **Inalterados**: `cloud.js`, `core.js`, `partners.js`, `retention-policy.js`, `productivity-manual-v2.js`, `reconciliation-tracking.js`, `excel-export.js`, `tax-reconciliation.js` e demais módulos.

## 5. Testes realmente executados (simulações isoladas com objetos em memória)
- Análise sintática de `app.js`, `client-wallet.js` e 8 módulos críticos preservados: **aprovada**.
- Comparação de SHA dos arquivos dos módulos críticos entre `main` e branch: **idênticos**.
- Contador da carteira usa número real da lista autorizada, e empresa atribuída a outro usuário não aparece no mock: **aprovado**.
- Sem sessão autenticada, lista vazia: **aprovado**.
- HTML contém ações de detalhes, editar, plano, sócios, relacionadas: **aprovado quanto à renderização do HTML**.
- CNPJ de teste válido aceito e inválido rejeitado: **aprovado**.
- Reimportação simulada de empresa com mesmo CNPJ reutiliza cadastro, não perde regras/sócios/relacionadas nem nome editado manualmente: **aprovada**.
- Reimportação com mesmo nome e CNPJ diferente mantém empresas separadas: **aprovada**.
- CNPJ de importação inválido bloqueado: **aprovado**.
- Edição de razão social, nome fantasia, observações preserva códigos e estruturas existentes: **aprovada**.
- CNPJ duplicado não é salvo e falha simulada no `store` restaura os dados anteriores: **aprovadas**.
- Navegação e inclusão dos assets no HTML e hooks da tela: **validação estrutural aprovada**.

## 6. Testes ainda NÃO executados
- Importação real de PDF/CSV do Domínio após a alteração, com documentos e contas autenticadas.
- Teste com navegador real logado no ambiente isolado e avaliação visual da nova página (sem deploy de prévia para não contrariar a restrição de publicação).
- Conferência de persistência efetiva em conta Supabase após logout/login com mais de um usuário.
- Testes completos de acessibilidade e responsividade em múltiplos dispositivos.
- Regressão ponta a ponta das rotinas de extrato, Razão, conciliação, Domínio e produtividade.
- Fluxo compartilhado de uma empresa para dois colaboradores.

## 7. Limitação de segurança importante
A aplicação atual tem isolamento por `user_workspaces` (cada conta gerencia seus registros). Apesar de o banco possuir `company_members`, a camada de cadastro/autorização compartilhada **não está integrada ao fluxo operacional**. Portanto, **esta etapa não habilita compartilhamento de empresas entre contas**; não seria seguro simulá-lo com IDs informados no navegador. Para essa função será necessária integração formal de empresas/membros/RLS com o workspace, condicionada a uma revisão e autorização separadas.

## 8. Evidência visual
Não existe captura de tela homologada desta branch porque não foi implantado ambiente de prévia isolado com sessão de testes. **Não apresentar mockup ou screenshot fictício como evidência de funcionamento real.** Os componentes são revisáveis no código do PR.

## 9. Recuperação
Como `main` e Supabase de produção não foram alterados, basta fechar o PR e remover a branch para descartar esta etapa. Caso uma revisão futura seja implantada, será necessário criar um backup específico antes de publicar.

## 10. Próxima ação
Revisar o PR e autorizar explicitamente (a) homologação num ambiente isolado com usuários e documentos de teste e (b) eventual publicação/merge na `main`. Nenhuma outra funcionalidade futura foi iniciada.
