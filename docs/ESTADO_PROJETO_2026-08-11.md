# Estado do projeto em 11/08/2026

## Entrega consolidada

- dashboard React/Vite com CQO Corte, Carreamento, Poda e Rampa;
- peso medio de cachos coletado no campo;
- area de Perdas integrada por proxies de servidor com a API AGRO TI;
- auditoria de coletas com aprovacao, reprovacao, exclusao e edicao;
- processamento em lote resiliente, com progresso e resumo de falhas;
- fotos e miniaturas pelo Supabase Storage;
- mapas Leaflet com shapes de parcelas;
- inventario de parcelas e fitossanidade;
- login, sessoes curtas, permissoes e auditoria via RPC;
- painel de status da API/VPN/SQL em Configuracoes;
- filtros persistidos por rota e carregamento global.

## Ultimas correcoes incorporadas

- aprovacao em lote limitada por concorrencia, com timeout, progresso e resultado parcial;
- exclusao de respostas de subprodutos/despejo do dataset CQO;
- protecao contra arrays ausentes na normalizacao das respostas;
- documentacao de retomada e protecao de binarios internos no Git.

## Integracoes externas

### Supabase

Fonte de autenticacao, sessoes, coletas, formularios, GPS, anexos, snapshots e auditoria. O frontend usa RPCs autenticadas para dados operacionais.

### API AGRO TI

Fonte de balanca, producao, prontidao de perdas e peso medio mensal. O navegador chama apenas proxies da Vercel; HMAC e Cloudflare Access ficam no servidor.

### Vercel

Hospeda o frontend e as rotas serverless em `api/agro/`. O deploy depende das variaveis `VITE_SUPABASE_*` e `AGRO_*` cadastradas no projeto.

## Pontos que continuam exigindo validacao operacional

- homologacao mensal de peso medio e producao para Perdas;
- consistencia de fotos antigas que foram sincronizadas antes da rotina de miniaturas;
- conciliacao de shapes, fazenda, parcela e ano de plantio;
- aplicacao e inventario das migracoes SQL no Supabase de producao;
- disponibilidade do computador, VPN, API e Cloudflare Tunnel da API AGRO TI;
- testes reais em celulares de menor capacidade antes de cada build mobile.

## Limites desta entrega

- o aplicativo mobile nao esta dentro deste repositorio;
- planilhas, PBIX, fotos, dumps e credenciais nao foram publicados;
- o GitHub e publico e deve permanecer livre de dados corporativos confidenciais.
