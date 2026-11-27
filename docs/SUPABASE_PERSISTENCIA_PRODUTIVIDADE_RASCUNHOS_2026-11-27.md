# Persistência Supabase — produtividade e rascunhos operacionais

## Alterações publicadas em 27/11/2026

O ConCiliar+ já utiliza `public.user_workspaces` para cadastros e metadados duráveis. O novo esquema amplia a proteção para:

- `public.user_productivity_states`: sessões manuais atuais, conciliações concluídas, durações e histórico de evolução.
- `public.user_operational_drafts`: lançamentos importados, Razão, transferências, controles financeiros, comprovantes analisados e demais campos dos rascunhos operacionais que antes só ficavam no IndexedDB.

As tabelas têm `user_id` referenciado em `auth.users`, restrição de unicidade por usuário, `revision` para controle de edição concorrente e políticas RLS de leitura, inserção e atualização limitadas ao próprio `auth.uid()`.

O cliente `cloud.js` usa chave publicável, nunca `service_role`. Cada usuário só pode ler e alterar seu próprio registro. Essas regras não dão acesso automático aos dados contábeis de outro colaborador.

### Sincronização

O dashboard continua usando `localStorage` como cópia de recuperação e carrega o registro do Supabase após login. O primeiro login sincronizado migra o histórico manual que está no navegador para a conta autenticada, mesclando conciliações concluídas por identificador. Uma gravação só recebe status **Salvo no Supabase** depois da confirmação do servidor. Falhas ficam visíveis e podem ser reenviadas por **Sincronizar agora**.

Os rascunhos operacionais continuam no IndexedDB como cópia local e são enviados à tabela de backup após alterações. A ativação de sessão busca primeiro a cópia remota. Se houver operações no antigo `user_workspaces`, elas são preservadas na tabela nova antes do saneamento do workspace.

### Limitações e próximos passos

- O envio de rascunhos ocorre de forma assíncrona; não fechar o navegador antes da confirmação do backup.
- Backups de banco independentes (PITR/rotina de exportação) ainda precisam ser configurados, conforme o plano e as políticas da empresa. Salvar em nuvem **não garante perda zero** diante de todos os incidentes.
- Acesso compartilhado entre funcionários ainda requer implementação de vínculo de organização/empresa, perfis e aprovação de permissões. O comportamento atual é deliberadamente isolado por conta.
- Grandes PDFs/Excel originais como arquivos binários não foram migrados para Supabase Storage nesta etapa; o backup dos rascunhos abrange as representações e registros já armazenados pelo aplicativo.
- Verificação com dados de login reais e volume de produção ainda necessária; testes de integração locais e verificação de esquema/RLS foram realizados.
- O Supabase Security Advisor apresentou avisos preexistentes sobre funções `SECURITY DEFINER` de empresas e proteção de senhas comprometidas desativada; revisar antes de liberar colaboração ampla.

## DDL aplicado ao projeto Concilia+ Web

```sql
create table public.user_productivity_states (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{}'::jsonb,
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now()
);
create table public.user_operational_drafts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{}'::jsonb,
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now()
);
alter table public.user_productivity_states enable row level security;
alter table public.user_operational_drafts enable row level security;
-- As tabelas têm policies específicas de SELECT/INSERT/UPDATE para
-- TO authenticated com user_id=(select auth.uid()).
```
