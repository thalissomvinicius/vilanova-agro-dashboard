-- Diagnostico CQO Poda: rode no SQL Editor do Supabase e envie os resultados.
-- Objetivo: descobrir se os dados novos estao na tabela, se a RPC esta escolhendo
-- o snapshot certo e se as linhas tem datas/fazendas/parcelas reconheciveis.

-- 1) Todos os snapshots de poda existentes na tabela.
select
  import_key,
  fonte,
  source_file,
  source_sheet,
  total_rows,
  jsonb_array_length(coalesce(rows_json, '[]'::jsonb)) as linhas_json,
  file_last_write_time,
  imported_at,
  updated_at,
  greatest(
    coalesce(updated_at, '-infinity'::timestamptz),
    coalesce(file_last_write_time, '-infinity'::timestamptz),
    coalesce(imported_at, '-infinity'::timestamptz)
  ) as ordem_usada_no_dashboard
from public.cqo_poda_import_snapshots
order by ordem_usada_no_dashboard desc, total_rows desc, import_key;

-- 2) Snapshot(s) que a funcao dashboard_cqo_dataset passaria a escolher apos o hotfix.
with latest_poda as (
  select distinct on (
    coalesce(nullif(source_file, ''), import_key),
    coalesce(nullif(source_sheet, ''), 'poda')
  )
    import_key,
    fonte,
    source_file,
    source_sheet,
    total_rows,
    jsonb_array_length(coalesce(rows_json, '[]'::jsonb)) as linhas_json,
    file_last_write_time,
    imported_at,
    updated_at,
    greatest(
      coalesce(updated_at, '-infinity'::timestamptz),
      coalesce(file_last_write_time, '-infinity'::timestamptz),
      coalesce(imported_at, '-infinity'::timestamptz)
    ) as ordem_usada_no_dashboard
  from public.cqo_poda_import_snapshots
  order by
    coalesce(nullif(source_file, ''), import_key),
    coalesce(nullif(source_sheet, ''), 'poda'),
    greatest(
      coalesce(updated_at, '-infinity'::timestamptz),
      coalesce(file_last_write_time, '-infinity'::timestamptz),
      coalesce(imported_at, '-infinity'::timestamptz)
    ) desc,
    total_rows desc
)
select *
from latest_poda
order by ordem_usada_no_dashboard desc, total_rows desc, import_key;

-- 3) Leitura das linhas brutas, com as colunas que o dashboard tenta reconhecer.
with flat as (
  select
    s.import_key,
    s.source_file,
    s.source_sheet,
    s.updated_at,
    row_number() over (partition by s.import_key order by ordinality) as linha_json_n,
    r.row
  from public.cqo_poda_import_snapshots s
  cross join lateral jsonb_array_elements(coalesce(s.rows_json, '[]'::jsonb)) with ordinality as r(row, ordinality)
)
select
  import_key,
  source_file,
  source_sheet,
  count(*) as linhas,
  count(*) filter (where coalesce(
    row->>'data_avaliacao_iso',
    row->>'DataAvaliacao',
    row->>'Data Avaliacao',
    row->>'DataAvaliação',
    row->>'Data Avaliação',
    row->>'Data',
    row->>'data'
  ) is not null) as linhas_com_data_reconhecivel,
  count(*) filter (where coalesce(
    row->>'NomeFazenda',
    row->>'Nome Fazenda',
    row->>'Fazenda',
    row->>'fazenda'
  ) is not null) as linhas_com_fazenda_reconhecivel,
  count(*) filter (where coalesce(
    row->>'parcela_normalizada',
    row->>'ParcelaNormalizada',
    row->>'Parcela',
    row->>'parcela'
  ) is not null) as linhas_com_parcela_reconhecivel,
  array_agg(distinct coalesce(
    row->>'data_avaliacao_iso',
    row->>'DataAvaliacao',
    row->>'Data Avaliacao',
    row->>'DataAvaliação',
    row->>'Data Avaliação',
    row->>'Data',
    row->>'data'
  )) filter (where coalesce(
    row->>'data_avaliacao_iso',
    row->>'DataAvaliacao',
    row->>'Data Avaliacao',
    row->>'DataAvaliação',
    row->>'Data Avaliação',
    row->>'Data',
    row->>'data'
  ) is not null) as datas_distintas,
  array_agg(distinct coalesce(
    row->>'NomeFazenda',
    row->>'Nome Fazenda',
    row->>'Fazenda',
    row->>'fazenda'
  )) filter (where coalesce(
    row->>'NomeFazenda',
    row->>'Nome Fazenda',
    row->>'Fazenda',
    row->>'fazenda'
  ) is not null) as fazendas_distintas
from flat
group by import_key, source_file, source_sheet
order by max(updated_at) desc nulls last, import_key;

-- 4) Amostra das 20 primeiras linhas do snapshot mais recente, para validar nomes de colunas.
with latest as (
  select *
  from public.cqo_poda_import_snapshots
  order by greatest(
    coalesce(updated_at, '-infinity'::timestamptz),
    coalesce(file_last_write_time, '-infinity'::timestamptz),
    coalesce(imported_at, '-infinity'::timestamptz)
  ) desc, total_rows desc
  limit 1
)
select
  latest.import_key,
  latest.source_file,
  latest.source_sheet,
  r.ordinality as linha_json_n,
  r.row
from latest
cross join lateral jsonb_array_elements(coalesce(latest.rows_json, '[]'::jsonb)) with ordinality as r(row, ordinality)
order by r.ordinality
limit 20;

-- 5) Se voce souber qual import_key deveria ser o novo, rode substituindo abaixo.
-- select
--   import_key,
--   source_file,
--   total_rows,
--   jsonb_array_length(rows_json) as linhas_json,
--   rows_json->0 as primeira_linha,
--   rows_json->(jsonb_array_length(rows_json)-1) as ultima_linha
-- from public.cqo_poda_import_snapshots
-- where import_key = 'COLOQUE_AQUI_O_IMPORT_KEY_NOVO';
