# Vila Nova Agro Dashboard

Painel operacional React/Vite para acompanhamento de CQO, coletas, inventario, rampa, colaboradores e mapa georreferenciado.

## Requisitos

- Node.js compativel com Vite 8
- npm
- Projeto Supabase com chaves configuradas por ambiente

## Setup local

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Preencha `.env.local` com:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
VITE_ENABLE_DEVELOPMENT_PAGE=false
```

Sem URL e anon key, o frontend inicia, mas as chamadas ao Supabase retornam erro de configuracao em vez de usar fallbacks hardcoded.

A pagina de desenvolvimento fica oculta em builds de producao. Para habilita-la explicitamente para usuarios admin, defina `VITE_ENABLE_DEVELOPMENT_PAGE=true`.

Para login, leituras online e mutacoes auditaveis em producao, aplique `supabase/production_hardening.sql` no Supabase antes do deploy. O dashboard usa funcoes RPC para autenticar, emitir sessao curta, carregar CQO, headcount e bonificacao, atualizar acesso de colaboradores, aprovar/reprovar fichas e marcar fichas como excluidas sem expor colunas sensiveis ao frontend.

O runtime do dashboard nao faz leitura REST direta de tabelas operacionais; as chamadas online passam por RPCs de sessao. O SQL tambem remove permissao de criacao no schema `public` para papeis nao confiaveis.

O login registra tentativas no banco e bloqueia temporariamente uma matricula apos falhas repetidas, sem armazenar senhas digitadas.

Depois de aplicar o SQL, cadastre ao menos uma matricula administradora para liberar mutacoes privilegiadas:

```sql
insert into public.dashboard_access_users (matricula, role, permissions)
values ('SUA_MATRICULA', 'admin', '{}'::text[])
on conflict (matricula) do update
set role = excluded.role,
    permissions = excluded.permissions,
    active = true,
    updated_at = now();
```

Permissoes granulares aceitas para perfis nao-admin: `review_response`, `delete_response` e `manage_collaborators`. Matriculas sem registro ativo em `dashboard_access_users` nao conseguem autenticar no dashboard.

Para migrar senhas legadas em texto para hash dentro do banco, rode em lotes apos aplicar o SQL:

```sql
select public.dashboard_hash_legacy_passwords(500);
```

Repita ate retornar `0`. O login de producao exige `senha_hash`; novas trocas de senha feitas pelo dashboard ja gravam `senha_hash` e limpam o campo legado `senha`.

A rotina de autenticacao tambem limpa sessoes expiradas e tentativas de login antigas. Para manutencao manual pelo SQL Editor/service role:

```sql
select * from public.dashboard_prune_security_state(7, 30, null);
```

Os parametros representam dias de retencao para sessoes, tentativas de login e auditoria. O terceiro parametro deve ficar `null` para preservar eventos de auditoria indefinidamente.

A tela de colaboradores consome o snapshot importado de headcount. Alteracoes de status e senha continuam passando apenas por RPC autenticado e auditado, sem leitura direta de `headcount_colaboradores` pelo frontend.

## Scripts

```bash
npm run lint
npm test
npm run verify
npm run build
npm run preview
```

## Dados e assets

- `public/data/farm-parcels.geojson`: parcelas usadas pelo mapa Leaflet.
- `public/data/inventory-parcels.json`: dados estaticos de inventario.
- `public/bonificacaoSnapshot.json`: fallback publico para bonificacao quando a RPC online nao retorna snapshot.
- `src/data/bonificacaoSnapshot.json`: copia historica local; o runtime usa carregamento sob demanda pelo arquivo publico.
- `supabase/*.sql`: views auxiliares para dashboards e snapshots.
- `supabase/production_hardening.sql`: indices e tabela de auditoria para revisar em staging antes de producao.

## Producao

Antes de publicar:

1. Configure variaveis no provedor de deploy, nunca no codigo.
2. Rode `npm run lint`, `npm run build` e `npm audit`.
3. Rode `npm test`.
4. Valide politicas RLS e permissoes no Supabase.
5. Revise e aplique `supabase/production_hardening.sql` em staging antes de producao.
6. Revise headers em `vercel.json`.
7. Rode `npm run verify`.
8. Remova artefatos locais e temporarios do pacote de entrega. A `.vercelignore` ja exclui `scratch/`, logs, dumps, PBIX e scripts operacionais do deploy.

## Scripts auxiliares

Scripts em `scripts/` e `scratch/` sao operacionais. Qualquer script que envie dados ao Supabase deve receber credenciais por variaveis de ambiente, nunca por valores fixos no arquivo.
