create or replace function public.to_num(value text)
returns numeric
language sql
immutable
as $$
  select case
    when value is null or trim(value) = '' then 0
    when trim(value) ~ '^-?[0-9]+([,.][0-9]+)?$'
      then replace(trim(value), ',', '.')::numeric
    else 0
  end;
$$;

create or replace view public.vw_cqo_excel_snapshots as
select
  s.import_key,
  s.fonte,
  s.source_file,
  s.source_path,
  s.file_last_write_time,
  s.corte_total_rows,
  s.carreamento_total_rows,
  s.corte_columns_json,
  s.carreamento_columns_json,
  s.imported_at,
  s.updated_at
from public.cqo_import_snapshots s
where s.import_key = 'cqo_1_digitacao_cqo';

create or replace view public.vw_cqo_excel_corte_linhas as
select
  s.import_key,
  s.source_file,
  s.file_last_write_time,
  s.imported_at,
  row_item.ordinality as linha_seq,
  row_data ->> 'NomePolo' as polo,
  row_data ->> 'NomeFazenda' as fazenda,
  row_data ->> 'Parcela' as parcela_original,
  row_data ->> 'parcela_normalizada' as parcela,
  (row_data ->> 'data_avaliacao_iso')::date as data_avaliacao,
  (row_data ->> 'mes_referencia_iso')::date as mes_referencia,
  row_data ->> 'Ano' as ano,
  row_data ->> 'MatriculaAvaliadores' as matricula_avaliadores,
  row_data ->> 'Fiscal Resp' as fiscal_resp,
  public.to_num(row_data ->> 'NumeroPlantasObservadas') as plantas_observadas,
  public.to_num(row_data ->> 'NumeroCahosObservados') as cachos_observados,
  public.to_num(row_data ->> 'CachoEsquecidoCiclo') as cacho_esquecido,
  public.to_num(row_data ->> 'CachoVerde') as cacho_verde,
  public.to_num(row_data ->> 'CachoMaduro') as cacho_maduro,
  public.to_num(row_data ->> 'CachoPassado') as cacho_passado,
  public.to_num(row_data ->> 'TaloComprido') as talo_comprido,
  public.to_num(row_data ->> 'CachoAvermelhado') as cacho_avermelhado,
  public.to_num(row_data ->> 'CachoMalPosicionado') as cacho_mal_posicionado,
  row_data as row_json,
  public.to_num(row_data ->> 'cachoMalOosicionado') as palha_mal_empilhada
from public.cqo_import_snapshots s
cross join lateral jsonb_array_elements(s.corte_rows_json) with ordinality as row_item(row_data, ordinality)
where s.import_key = 'cqo_1_digitacao_cqo';

create or replace view public.vw_cqo_excel_carreamento_linhas as
select
  s.import_key,
  s.source_file,
  s.file_last_write_time,
  s.imported_at,
  row_item.ordinality as linha_seq,
  row_data ->> 'NomePolo' as polo,
  row_data ->> 'NomeFazenda' as fazenda,
  row_data ->> 'Parcela' as parcela_original,
  row_data ->> 'parcela_normalizada' as parcela,
  (row_data ->> 'data_avaliacao_iso')::date as data_avaliacao,
  (row_data ->> 'mes_referencia_iso')::date as mes_referencia,
  row_data ->> 'Ano' as ano,
  row_data ->> 'MatriculaAvaliadores' as matricula_avaliadores,
  row_data ->> 'Fiscal Resp' as fiscal_resp,
  public.to_num(row_data ->> 'NumeroPlantasObservadas') as plantas_observadas,
  public.to_num(row_data ->> 'CachoNaoCarreado') as cacho_nao_carreado,
  public.to_num(row_data ->> 'cachoMalOosicionado') as cacho_mal_posicionado,
  row_data as row_json
from public.cqo_import_snapshots s
cross join lateral jsonb_array_elements(s.carreamento_rows_json) with ordinality as row_item(row_data, ordinality)
where s.import_key = 'cqo_1_digitacao_cqo';
