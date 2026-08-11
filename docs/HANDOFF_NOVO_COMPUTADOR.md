# Handoff para outro computador

Este documento permite retomar o dashboard em outro computador sem depender de arquivos locais desta maquina.

## 1. Baixar o projeto

```powershell
git clone https://github.com/thalissomvinicius/vilanova-agro-dashboard.git
Set-Location .\vilanova-agro-dashboard
git switch master
git pull --ff-only origin master
```

O repositorio remoto e publico. Nao grave chaves, senhas, planilhas internas, arquivos PBIX ou exportacoes com dados reais nele.

## 2. Requisitos usados nesta entrega

- Git para Windows
- Node.js 24
- npm 11
- acesso ao projeto Supabase
- acesso ao projeto Vercel para configurar variaveis de servidor

Instalacao e verificacao:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run verify
npm run dev
```

O Vite informa no terminal a URL local, normalmente `http://localhost:5173`.

## 3. Variaveis de ambiente

Preencha `.env.local` somente na maquina local. No deploy, cadastre as mesmas variaveis nas configuracoes da Vercel.

Frontend, expostas ao navegador por necessidade:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_ENABLE_DEVELOPMENT_PAGE
```

Servidor Vercel, nunca prefixar com `VITE_`:

```text
AGRO_API_BASE_URL
AGRO_API_CLIENT_ID
AGRO_API_CLIENT_SECRET
AGRO_CF_ACCESS_CLIENT_ID
AGRO_CF_ACCESS_CLIENT_SECRET
```

As cinco variaveis `AGRO_*` sao usadas exclusivamente pelas rotas em `api/agro/`. Elas assinam chamadas HMAC e adicionam o Service Token do Cloudflare Access sem enviar segredos ao navegador.

## 4. Arquitetura resumida

```text
Navegador
  -> React/Vite
  -> RPCs autenticadas do Supabase
  -> funcoes serverless /api/agro/* na Vercel
       -> Cloudflare Access + HMAC
       -> API AGRO TI
       -> VPN corporativa
       -> SQL Server
```

Responsabilidades:

- `src/pages/`: telas operacionais e de apresentacao.
- `src/components/`: layout, tabelas, graficos, mapas, modais e feedback global.
- `src/utils/cqoData.js`: normalizacao, RPCs CQO, anexos e consolidacao APP/Excel.
- `src/utils/agroApiData.js`: leitura dos contratos retornados pela API AGRO TI.
- `server/agroApiProxy.js`: assinatura HMAC, Cloudflare Access, validacao e limites das rotas de servidor.
- `api/agro/`: endpoints serverless usados pelo frontend.
- `supabase/`: funcoes, views e hotfixes SQL versionados.
- `public/data/`: shapes e inventario estatico usados no mapa.

O aplicativo mobile CQO/Fitossanidade e um projeto separado. Este repositorio contem somente o dashboard web e seus contratos de integracao.

## 5. Rotas principais

| Rota | Area |
| --- | --- |
| `/campo` | CQO Corte |
| `/peso-medio` | Peso medio de cachos no campo |
| `/carreamento` | CQO Carreamento |
| `/poda` | CQO Poda |
| `/perdas` | Perdas e integracao com a balanca |
| `/rampa` | CQO Rampa |
| `/coletas` | Auditoria, aprovacao e edicao de fichas |
| `/inventario` | Inventario de parcelas |
| `/mapa` | Georreferenciamento |
| `/fitossanidade/inventario` | Inventario de campo |
| `/fitossanidade/armadilhas` | Armadilhas RP |
| `/configuracoes` | Configuracoes e status da API/SQL |

## 6. Supabase

O frontend nao deve consultar tabelas operacionais sensiveis diretamente. Login, datasets, aprovacao, exclusao, edicao e gestao de acesso passam por RPCs com sessao curta.

Para um ambiente novo, revise os scripts nesta ordem logica, sempre primeiro em staging:

1. `supabase/production_hardening.sql`
2. `supabase/DASHBOARD_CQO_DATASET_SCALING_HOTFIX.sql`
3. `supabase/DASHBOARD_CQO_RESPONSES_PAGING_HOTFIX.sql`
4. `supabase/DASHBOARD_CQO_LOAD_RESILIENCE_HOTFIX.sql`
5. `supabase/DASHBOARD_CQO_DATASET_PODA_SNAPSHOTS_HOTFIX.sql`
6. `supabase/DASHBOARD_MANUAL_RESPONSE_HOTFIX.sql`
7. `supabase/DASHBOARD_RESPONSE_EDIT_HOTFIX.sql`
8. `supabase/BALANCA_PERDAS_INTEGRATION.sql`
9. `supabase/DASHBOARD_AGRO_API_STATUS.sql`
10. `supabase/fitossanidade_inventory_dashboard.sql`
11. `supabase/fitossanidade_rhynchophorus_dashboard.sql`
12. `supabase/mobile_anexos_thumbnails.sql`

Os scripts de diagnostico nao devem ser tratados como migracao. Antes de reaplicar qualquer hotfix em producao, compare a assinatura atual das funcoes no Supabase.

## 7. API AGRO TI

O dashboard usa estes proxies serverless:

- `/api/agro/scale-tickets`
- `/api/agro/quality-scale-tickets`
- `/api/agro/quality-losses`
- `/api/agro/production-summary`
- `/api/agro/losses-readiness`
- `/api/agro/monthly-bunch-weights`
- `/api/agro/monthly-bunch-weights/:monthKey/tickets`

A API interna precisa estar publicada pelo Cloudflare Tunnel, e o computador de origem precisa estar ligado, com VPN, API e tunnel ativos. Credenciais HMAC e Cloudflare devem existir apenas na Vercel e no armazenamento protegido da API interna.

## 8. Verificacao antes de publicar

```powershell
npm run lint
npm test
npm audit --audit-level=moderate
npm run build
git status --short
git diff --check
```

Depois do push, confirme o commit remoto e aguarde o deploy da Vercel. Teste ao menos login, `/campo`, `/coletas`, `/poda`, `/perdas`, fotos e uma acao de aprovacao em staging.

## 9. Arquivos mantidos fora do GitHub

Os binarios abaixo devem ser transferidos por canal corporativo autorizado quando forem realmente necessarios:

- planilhas Excel com dados operacionais;
- arquivos Power BI (`.pbix`);
- dumps e exportacoes do Supabase;
- `.env.local` e credenciais;
- arquivos protegidos da API AGRO TI;
- anexos e fotos originais.

O documento `BI_QUALIDADE_PROJECAO_FONTES.md` preserva a estrutura tecnica das fontes sem publicar os dados reais.
