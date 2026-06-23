create or replace view public.vw_headcount_agricola_snapshots as
select
  s.import_key,
  s.fonte,
  s.reference_month,
  s.source_file,
  s.source_path,
  s.source_sheet,
  s.file_last_write_time,
  s.total_rows,
  s.columns_json,
  s.imported_at,
  s.updated_at
from public.headcount_import_snapshots s
where s.fonte = 'headcount_agricola';

create or replace view public.vw_headcount_agricola_atual as
with latest_snapshot as (
  select
    import_key,
    reference_month,
    source_file,
    source_sheet,
    imported_at,
    rows_json
  from public.headcount_import_snapshots
  where fonte = 'headcount_agricola'
  order by reference_month desc, imported_at desc
  limit 1
)
select
  row_number() over () as linha_seq,
  s.import_key,
  s.reference_month,
  s.source_file,
  s.source_sheet,
  s.imported_at,
  row ->> 'MATRÍCULA' as matricula,
  row ->> 'NOME' as nome,
  row ->> 'DEPARTAMENTO' as departamento,
  row ->> 'FUNÇÃO' as funcao,
  row ->> 'ADMISSÃO' as admissao,
  row ->> 'STATUS AGR' as status_agr,
  row as row_json
from latest_snapshot s
cross join lateral jsonb_array_elements(s.rows_json) as row;
