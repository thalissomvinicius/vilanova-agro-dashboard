# Dashboard Design System V2

## Objetivo

O Dashboard Intelligence UI organiza todos os módulos operacionais da Vila Nova com uma linguagem única, mais clara e responsiva. A atualização preserva as regras de negócio, permissões, rotas, filtros e integrações existentes.

## Direção visual

- Verde profundo representa operação, confiança e a identidade agrícola.
- Verde médio identifica ações e estados ativos.
- Âmbar é usado como acento de atenção e não como cor principal de todos os botões.
- Fundos neutros separam áreas sem excesso de sombras.
- Bordas e raios são moderados para manter aparência corporativa.
- Hierarquia tipográfica distingue contexto, título, indicador e metadado.

## Tokens principais

| Papel | Valor claro |
| --- | --- |
| Navegação | `#0b2f21` |
| Ação principal | `#155c3b` |
| Ação secundária | `#237a52` |
| Acento | `#d99118` |
| Fundo geral | `#f4f6f2` |
| Superfície | `#ffffff` |
| Texto principal | `#17241d` |
| Borda | `#dfe6de` |

Os tokens ficam no início de `src/styles/design-system-v2.css`. O mesmo arquivo contém as equivalências para o tema escuro.

## Estrutura das telas

1. Menu lateral com módulos agrupados e destaque inequívoco da rota ativa.
2. Cabeçalho compacto com busca, filtros globais, sincronização e ações.
3. Cabeçalho da página com contexto, título, explicação e ações.
4. Indicadores principais antes das análises detalhadas.
5. Cards, gráficos, mapas ou tabelas em superfícies consistentes.
6. Estados vazios, avisos e modais usando os mesmos padrões.

## Responsividade

- Acima de `1024px`: menu lateral fixo, redimensionável e recolhível.
- Até `1024px`: menu vira gaveta com fundo de bloqueio e fechamento por clique ou tecla `Esc`.
- Filtros passam a uma faixa horizontal rolável para não aumentar excessivamente a altura.
- Até `760px`: ações menos essenciais são ocultadas e o conteúdo recebe espaçamento compacto.
- Login muda de duas colunas para fluxo vertical em tablets e celulares.

## Arquivos centrais

- `src/styles/design-system-v2.css`: tokens, componentes visuais e breakpoints.
- `src/components/Sidebar.jsx`: navegação desktop e gaveta móvel.
- `src/components/Header.jsx`: contexto da rota, filtros e abertura do menu móvel.
- `src/App.jsx`: estado e acessibilidade da navegação móvel.
- `src/index.css`: importa o sistema V2 depois dos estilos legados.

## Regras para novas telas

- Reutilizar `PageHeader`, `MetricCard`, `SegmentedTabs`, `StatusBanner` e os estilos de `card`.
- Não criar novas cores diretamente no componente; adicionar um token quando necessário.
- Não duplicar cabeçalhos ou filtros globais dentro da página.
- Garantir alvo de toque mínimo próximo de 40px para botões.
- Usar badges apenas para estado ou categoria.
- Testar a tela em desktop, tablet e celular antes da publicação.

## Validação

Antes de publicar uma alteração visual:

```bash
npm run lint
npm test
npm run build
```

O conjunto atual passa em 12 arquivos de teste, totalizando 94 testes.
