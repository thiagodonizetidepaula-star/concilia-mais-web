# ConCiliar+PLUS — proposta de administração de equipe

## Estado
Esta funcionalidade está em branch isolada e **não está ativa em produção**. A tabela `public.concilia_admins` começa vazia de propósito. Ninguém recebe privilégios administrativos automaticamente. Conceder acesso somente depois de confirmar o UUID da conta autenticada e a identidade da pessoa autorizada. Não inferir o administrador a partir do e-mail do proprietário do repositório, da empresa usuária ou da titularidade da marca.

## Capacidades
- Administrador geral: acesso ao painel, gerenciamento de funcionários existentes e convites por e-mail via Edge Function segura.
- Gestor, funcionário e consulta: vínculos cadastrais; não ampliam por si sós acesso à carteira contábil ou aos workspaces.
- Desativação de funcionário sem apagar dados; trilha `concilia_admin_audit` de toda alteração.
- Sem alteração de saldos, lançamentos, classificações ou conciliações.

## Homologação exigida antes de produção
1. Preparar backup e executar migração em Supabase **local**.
2. Testar um usuário administrador e outro funcionário, validando RLS de leitura/escrita, negação de autopromoção e separação de dados.
3. Implantar `supabase/functions/concilia-invite-staff` apenas após verificar o código e a configuração de redirecionamento de convite. `SUPABASE_SERVICE_ROLE_KEY` só no servidor.
4. Confirmar o identificador UUID da conta administrativa com o usuário; só então operador privilegiado aplica concessão pontual, auditada.
5. Testar convite, acesso inicial, alteração de perfil, desativação, tentativa de invasão e regressão do ConCiliar+PLUS.
6. Validar que permissões de empresa estão isoladas. O painel **não** altera políticas RLS existentes de `user_workspaces`; compartilhamento de conciliações entre funcionários é uma etapa de arquitetura separada.

## Limitações
O painel não é editor do código-fonte: melhorias técnicas continuam revisadas no GitHub e publicadas no Render. Convite por e-mail é funcionalidade candidata: exige implantação da Edge Function, testes autenticados e configuração de SMTP do Supabase. Até isso, nenhuma mensagem é enviada.
