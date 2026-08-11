# Fontes BI de Qualidade e Projecao

Este registro preserva a especificacao logica das fontes recebidas sem versionar planilhas internas ou o arquivo PBIX no repositorio publico.

## Artefatos originais mantidos fora do GitHub

- `Base Qualidade CFF.xlsx`
- `Qualidade e Projecao.pbix`
- `Tabela de Preco - CFF 07-11.xlsx`

Esses arquivos contem dados e metadados corporativos. Devem ser transferidos separadamente por canal autorizado.

## Estrutura logica conhecida

| Consulta do BI | Origem na planilha |
| --- | --- |
| `f_Balanca` | `Entrada de CFF` |
| `f_CQO` | `CQO - Rampa` |
| `f_Faturamento` | `Faturamento` |
| `f_TipoForn` | `Tipo Fornecedor` |
| `f_PrecoForn` | `Preco Fornecedor` |

## Uso no sistema

- balanca e producao devem entrar pelo contrato homologado da API AGRO TI;
- CQO Rampa pode continuar identificado por origem, periodo e fornecedor;
- precos e faturamento nao devem ser publicados no frontend sem regra de acesso especifica;
- arquivos importados precisam de hash, competencia, data da fonte e rastreabilidade do lote;
- uma atualizacao nunca deve misturar silenciosamente bases de competencias diferentes;
- ausencia de fonte oficial deve aparecer como `N/D`, sem peso ou producao padrao.

## Regras para retomada

1. Nao conectar o navegador diretamente a arquivos locais ou caminhos de rede.
2. Nao colocar credenciais de Power BI, SQL ou Supabase no PBIX versionado.
3. Preferir a API AGRO TI ou snapshots versionados no Supabase.
4. Conciliar totais do dashboard com a fonte original antes de liberar uma nova competencia.
5. Documentar formula, unidade, filtros e data de fechamento de cada indicador.
