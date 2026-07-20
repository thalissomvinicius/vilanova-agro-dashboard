# Arquitetura de Perdas Agricolas

## Diagnostico atual

A tela de Perdas ainda nao pode ser considerada uma fonte oficial. O dashboard combina:

1. perdas em toneladas prontas vindas de algumas linhas do Excel/BI;
2. estimativas locais feitas com amostra de CQO e inventario de plantas;
3. peso medio do cacho derivado do snapshot de balanca;
4. fallback de peso informado no registro ou valor fixo de 20 kg;
5. fallback de producao por fazenda, por mes ou global.

Esses caminhos produzem numeros mesmo quando faltam dados. Isso evita tela vazia, mas pode esconder uma base incompleta ou relacionar uma fazenda com producao global. Para Perdas, o comportamento correto e exibir `N/D` e a pendencia da base, nunca completar silenciosamente com um padrao.

O snapshot local atual de balanca foi gerado em 16/06/2026, termina em 03/2025 e apresenta pesos mensais de ate 239 kg/cacho. A ordem de grandeza mostra que o denominador de cachos nao esta conciliado com o peso liquido. Ele nao deve alimentar a versao de producao.

## Regra operacional proposta

Para uma coleta realizada no mes `M`, usar o peso medio homologado do mes calendario completo `M-1`.

### Peso medio

```text
peso_ajustado_origem_kg = cachos_origem / total_cachos_ticket * peso_liquido_ticket_kg
peso_medio_ponderado_kg = soma(peso_ajustado_origem_kg) / soma(cachos_origem)
```

O mes so pode ser publicado quando estiver fechado, conciliado e aprovado. Janeiro usa dezembro do ano anterior. Se o mes anterior estiver aberto, incompleto ou sem contagem confiavel de cachos, o resultado deve ser `N/D`.

### Perda de corte

```text
cachos_perdidos_estimados = cachos_esquecidos_amostra / plantas_avaliadas * plantas_vigentes_parcela
perda_corte_t = cachos_perdidos_estimados * peso_medio_m1_kg / 1000
```

### Perda de carreamento

```text
cachos_nao_carreados_estimados = cachos_nao_carreados_amostra / plantas_avaliadas * plantas_vigentes_parcela
perda_carreamento_t = cachos_nao_carreados_estimados * peso_medio_m1_kg / 1000
```

`Palha mal empilhada` e `cacho mal posicionado` sao indicadores operacionais, nao cachos perdidos. Eles nao entram na quantidade de cachos nem nas toneladas de perda.

### Percentuais

```text
perda_pct = perda_t / producao_aprovada_t_do_mes_e_escopo * 100
perda_t_ha = perda_t / area_vigente_avaliada_ha
```

O numerador e o denominador devem usar a mesma fazenda, periodo, origem e escopo. Nunca usar a producao global quando a fazenda nao for encontrada.

## Ponte para o computador com acesso ao E:

O dashboard e a Vercel nao devem acessar o disco de rede. Um agente de integracao deve rodar no computador que ja possui acesso ao `E:`.

Fluxo:

```text
E: somente leitura
  -> coletor Windows agendado
  -> staging local com hash e lote
  -> validacao e quarentena
  -> Supabase (lote imutavel)
  -> views aprovadas e versionadas
  -> dashboard
```

O primeiro passo e executar `scripts/diagnose-losses-sources.ps1` nesse computador. O pacote resultante permite fechar os nomes de arquivos, abas, colunas, formulas e chaves sem conceder ao dashboard acesso ao servidor.

Exemplo:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
& '.\scripts\diagnose-losses-sources.ps1' `
  -SourceRoots 'E:\TÉCNICA','E:\AGRICOLA' `
  -IncludeHashes
```

O script somente le a origem e grava o diagnostico no Desktop do usuario.

## Modelo de dados alvo no Supabase

### Camada de importacao

- `integracao_lotes`: origem, arquivo, hash, tamanho, data da fonte, inicio/fim e status.
- `integracao_erros`: lote, linha, campo, valor, regra e severidade.
- `balanca_tickets_staging`: conteudo normalizado sem publicacao analitica.

### Camada oficial

- `balanca_tickets`: ticket unico, data/hora, veiculo, bruto, tara, liquido e unidade.
- `balanca_ticket_origens`: rateio por fazenda/parcela/produtor e quantidade de cachos.
- `inventario_parcela_vigencias`: fazenda, parcela, plantas, area, inicio/fim da vigencia e fonte.
- `peso_medio_cacho_mensal`: mes, escopo, peso, contagens, formula, versao e aprovacao.
- `perda_estimativas`: coleta, tipo, entradas, formula, versao, resultado e linhagem.

### Views para o dashboard

- `vw_peso_medio_cacho_publicado`
- `vw_perdas_cqo_aprovadas`
- `vw_perdas_por_parcela`
- `vw_perdas_por_fazenda`
- `vw_perdas_por_fiscal_equipe`
- `vw_perdas_por_periodo`
- `vw_perdas_pendencias_base`

## Regras de publicacao

- somente coletas CQO aprovadas entram na analise;
- uma importacao repetida com o mesmo hash nao duplica dados;
- ticket repetido fica em quarentena;
- unidades sao estruturadas em kg, t, ha e quantidade;
- correcao cria nova versao, sem apagar o original;
- cada valor exibe fonte, competencia do peso, data da base e status de aprovacao;
- base incompleta gera pendencia visivel, nao fallback numerico;
- Excel historico e APP continuam identificados por origem.

## Decisoes que precisam de homologacao

1. Quais tipos de entrada da balanca pertencem ao escopo de dende proprio.
2. Como ratear ticket compartilhado entre fazendas, parcelas ou terceiros.
3. Qual coluna representa a contagem oficial de cachos.
4. Quem fecha e aprova o peso medio de cada mes.
5. Qual inventario e area possuem vigencia oficial para a data da coleta.
6. Se cachos esquecidos e nao carreados sao as unicas categorias de perda em toneladas.
7. Qual producao deve ser o denominador do percentual: colhida, recebida ou processada.
8. Como tratar coleta corrigida, duplicada ou reprovada.

## Sequencia de implantacao

1. Rodar o diagnostico no computador com `E:` e devolver o ZIP.
2. Homologar chaves, unidades, escopo e formula com Area Tecnica e Balanca.
3. Criar staging, lotes, quarentena e tabelas oficiais no Supabase.
4. Criar o agente Windows idempotente e agenda de sincronizacao.
5. Reprocessar dois meses e conciliar ticket, peso, cachos e producao.
6. Trocar o dashboard para as views publicadas e remover os fallbacks de 20 kg/global.
7. Validar por parcela, fazenda, fiscal e mes com amostras conhecidas.
8. Liberar a tela de Perdas com selo de competencia e qualidade da base.

## Criterio de pronto

A area de Perdas estara pronta quando toda tonelada exibida puder responder:

- qual coleta CQO originou a estimativa;
- quantos cachos foram encontrados e projetados;
- qual inventario e area foram usados;
- qual peso medio e competencia foram aplicados;
- quais tickets compuseram esse peso;
- qual producao formou o denominador;
- quem aprovou a coleta, a base mensal e a regra;
- qual versao da formula calculou o resultado.
