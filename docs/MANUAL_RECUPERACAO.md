# Manual de recuperação — ConCiliar+ / primeiro ciclo

## Regras de segurança
- O ZIP `CONCILIAR_PLUS_PROJETO_COMPLETO.zip` contém **código e documentação**, não o backup confidencial dos clientes.
- Dados corporativos estão protegidos separadamente no **Supabase original**, nunca devem ser enviados para repositórios públicos.
- Não sobrescreva um workspace real sem verificar o usuário, revisão, hash e impacto sobre as alterações mais recentes.
- Recuperar o código do aplicativo não requer apagar o banco.
- A manutenção exige autenticação e autorização adequada pela empresa.

## Recuperação de interface publicada
1. Entre no **Render** do serviço existente `srv-db9ttbtg1s2s73a19a9g`, workspace `tea-d6pk776a2pns73fgd0q0`.
2. Abra **Deploys** e localize o commit anterior estável no histórico.
3. Utilize a opção do próprio Render para publicar novamente o deploy estável ou volte o commit correspondente na branch principal do repositório mediante procedimento controlado.
4. Confirme que o serviço está **Live** e verifique login, carteira, documentos, CRM, Controle, Produtividade e gráficos.
5. Confira novamente a revisão e o checksum do workspace no Supabase. **Não restaure dados só porque o código foi revertido.**

## Recuperação de código por ZIP
1. Baixe o artifact **CONCILIAR_PLUS_PROJETO_COMPLETO** da execução de backup oficial no GitHub Actions.
2. Extraia `CONCILIAR_PLUS_PROJETO_COMPLETO.zip` em local seguro.
3. Abra `RELEASE_METADATA.json` e confira o commit, a data, a lista de arquivos e os hashes.
4. Compare os hashes SHA-256 antes de utilizar como fonte de recuperação.
5. Configure as variáveis públicas de implantação conforme o ambiente original. Credenciais privadas não acompanham o ZIP.

## Backup protegido do banco
Backup pré-BI (tabela `app_private.conciliar_workspace_backups`): `4d75b2cf-1f2b-49d5-a52d-fd5c797e1b7f`, revisão 696. A validação transacional de restauração foi executada em tabela temporária e encerrada com `ROLLBACK`, sem substituir dados em produção.
Para recuperar um workspace, obtenha autorização corporativa específica, suspenda gravações concorrentes, salve o estado atual, valide os três payloads e revisões e execute a restauração apenas em procedimento controlado. Se a revisão tiver avançado, **não** substitua automaticamente o backup antigo.

## Validação pós-recuperação
Executar testes de login/RLS, importação de plano Domínio, documentos, CRM, conciliação, classificações por Excel, produtividade, dashboards e responsividade. Conferir contagem de empresas e registros sem expor informações individuais.

Não criar Melhoria 05 ou nova infraestrutura como parte do procedimento de recuperação.
