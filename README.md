# Dashboard VNA

Painel React + Recharts para comparar os cortes `01-18/06` e `19-30/06` por produtor.

## Uso

```bash
npm install
npm run dev
```

O app tenta carregar automaticamente:

- `public/BI_Import.csv`
- `public/Resumo_Prod_Corte.csv`

Os CSVs desta entrega já foram gerados a partir de:

```text
C:\Users\thali\Downloads\Comparativo_Qualidade_CFF_Junho_2026_VNA_x_BBB_BI_Live_v6_Periodos.xlsx
```

Fonte usada: aba `Base_VNA_BI_Junho`. Foram geradas `939` linhas no `BI_Import.csv`, `51` produtores e `102` linhas no `Resumo_Prod_Corte.csv`.

## Gráficos

- `Qualidade geral`: soma toda a seleção e separa apenas por corte, sem divisão por produtor.
- `Próprios x Terceiros`: compara os 5 próprios contra todos os demais produtores, separando `01-18/06` e `19-30/06`.
- `Próprios escolhidos x Terceiros`: permite marcar 1 a 5 próprios e comparar esse grupo contra terceiros, também separado por corte.
- `Qualidade por Produtor`: fica fechado por padrão para manter o painel rápido; ao abrir, mostra até 12 produtores em gráficos separados.

Produtores classificados como próprios:

- `BOIBA/PALMARES`
- `CUPU/PALMARES`
- `FE EM DEUS`
- `VILA NOVA`
- `NOVA CONCEICAO`

## Regra de cálculo

Todos os indicadores percentuais são agregados por média ponderada pelo peso:

```text
indicador% = soma(Peso_t * indicador) / soma(Peso_t)
```

O rodapé compara os cálculos contra `Resumo_Prod_Corte.csv` com tolerância de `0,01` ponto percentual para os indicadores.

Os valores gerais `VNA: Antes x Depois` conferem com a aba `Resumo_Periodos` da planilha original e com o cálculo ponderado direto do `BI_Import.csv`. A tela usa o mesmo padrão de apresentação do Excel para percentuais, com 2 casas decimais:

| Indicador | VNA 01-18/06 | VNA 19-30/06 |
| --- | ---: | ---: |
| Verde | 10,28% | 5,05% |
| Maduro | 68,20% | 83,36% |
| Passado | 7,43% | 4,77% |
| Avermelhado | 10,97% | 6,83% |
| Talo Comprido | 7,20% | 3,51% |
| Bucha | 3,13% | 0,00% |
