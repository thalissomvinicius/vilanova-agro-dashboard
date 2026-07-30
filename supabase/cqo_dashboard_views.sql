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

create or replace view public.vw_cqo_coletas as
select
  r.id as resposta_id,
  r.formulario_id,
  case
    when r.formulario_id = 'form_cqo_corte' then 'CQO Corte'
    when r.formulario_id = 'form_cqo_carreamento_fruto_solto' then 'CQO Carreamento'
    else r.formulario_id
  end as formulario_nome,
  r.formulario_versao,
  r.usuario_id,
  r.status,
  r.criado_em,
  r.enviado_em,
  r.recebido_em,
  r.dados_json ->> 'nome_polo' as polo,
  r.dados_json ->> 'nome_fazenda' as fazenda,
  r.dados_json ->> 'parcela' as parcela,
  (r.dados_json ->> 'data_avaliacao')::date as data_avaliacao,
  r.dados_json ->> 'ciclo_mes' as ciclo_mes,
  r.dados_json ->> 'matricula_avaliador' as matricula_avaliador,
  r.dados_json ->> 'fiscal_resp' as fiscal_resp,
  r.dados_json ->> 'observacao' as observacao
from public.mobile_respostas r
where r.formulario_id in (
  'form_cqo_corte',
  'form_cqo_carreamento_fruto_solto'
);

create or replace view public.vw_cqo_corte_linhas as
select
  r.id as resposta_id,
  row_item.ordinality as linha_seq,
  r.dados_json ->> 'nome_polo' as polo,
  r.dados_json ->> 'nome_fazenda' as fazenda,
  r.dados_json ->> 'parcela' as parcela,
  (r.dados_json ->> 'data_avaliacao')::date as data_avaliacao,
  r.dados_json ->> 'ciclo_mes' as ciclo_mes,
  r.dados_json ->> 'matricula_avaliador' as matricula_avaliador,
  r.dados_json ->> 'fiscal_resp' as fiscal_resp,
  row_item.row_json ->> 'rua_index' as rua_index,
  row_item.row_json ->> 'lado_linha' as lado_linha,
  row_item.row_json ->> 'linha' as linha,
  row_item.row_json ->> 'matricula_colaborador' as matricula_colaborador,
  public.to_num(row_item.row_json ->> 'numero_plantas_linha') as numero_plantas_linha,
  public.to_num(row_item.row_json ->> 'numero_plantas_observadas') as numero_plantas_observadas,
  public.to_num(row_item.row_json ->> 'numero_cachos_observados_papel') as numero_cachos_observados_papel,
  public.to_num(row_item.row_json ->> 'cacho_esquecido_ciclo') as cacho_esquecido,
  public.to_num(row_item.row_json ->> 'cacho_verde') as cacho_verde,
  public.to_num(row_item.row_json ->> 'cacho_maduro') as cacho_maduro,
  public.to_num(row_item.row_json ->> 'cacho_passado') as cacho_passado,
  public.to_num(row_item.row_json ->> 'cacho_infermo') as cacho_infermo,
  public.to_num(row_item.row_json ->> 'bucha') as bucha,
  public.to_num(row_item.row_json ->> 'folha_mamando') as folha_mamando,
  public.to_num(row_item.row_json ->> 'cacho_talo_comprido') as cacho_talo_comprido,
  public.to_num(row_item.row_json ->> 'folha_cortada_indevida') as folha_cortada_indevida,
  case
    when coalesce(r.formulario_versao, 0) >= 9
      then public.to_num(row_item.row_json ->> 'cacho_mal_posicionado')
    else 0
  end as cacho_mal_posicionado,
  public.to_num(row_item.row_json ->> 'cacho_estrela') as cacho_estrela,
  public.to_num(row_item.row_json ->> 'cacho_brocado') as cacho_brocado,
  public.to_num(row_item.row_json ->> 'cacho_avermelhado') as cacho_avermelhado,
  (
    public.to_num(row_item.row_json ->> 'cacho_esquecido_ciclo') +
    public.to_num(row_item.row_json ->> 'cacho_verde') +
    public.to_num(row_item.row_json ->> 'cacho_maduro') +
    public.to_num(row_item.row_json ->> 'cacho_passado') +
    public.to_num(row_item.row_json ->> 'cacho_infermo') +
    public.to_num(row_item.row_json ->> 'bucha') +
    public.to_num(row_item.row_json ->> 'cacho_talo_comprido') +
    public.to_num(row_item.row_json ->> 'cacho_estrela') +
    public.to_num(row_item.row_json ->> 'cacho_avermelhado')
  ) as total_cachos_observados,
  row_item.row_json -> '_plantas_cacho_esquecido' as plantas_cacho_esquecido_json,
  row_item.row_json as linha_json,
  case
    when coalesce(r.formulario_versao, 0) >= 9
      then public.to_num(row_item.row_json ->> 'palha_mal_empilhada')
    else public.to_num(row_item.row_json ->> 'cacho_mal_posicionado')
  end as palha_mal_empilhada
from public.mobile_respostas r
cross join lateral jsonb_array_elements(r.dados_json -> 'linhas_corte')
  with ordinality as row_item(row_json, ordinality)
where r.formulario_id = 'form_cqo_corte';

create or replace view public.vw_cqo_carreamento_linhas as
select
  r.id as resposta_id,
  row_item.ordinality as linha_seq,
  r.dados_json ->> 'nome_polo' as polo,
  r.dados_json ->> 'nome_fazenda' as fazenda,
  r.dados_json ->> 'parcela' as parcela,
  (r.dados_json ->> 'data_avaliacao')::date as data_avaliacao,
  r.dados_json ->> 'ciclo_mes' as ciclo_mes,
  r.dados_json ->> 'ano_plantio' as ano_plantio,
  r.dados_json ->> 'densidade' as densidade,
  r.dados_json ->> 'total_plantas_parcela' as total_plantas_parcela,
  r.dados_json ->> 'total_cachos_carreados' as total_cachos_carreados,
  r.dados_json ->> 'variedade' as variedade,
  r.dados_json ->> 'matricula_avaliador' as matricula_avaliador,
  r.dados_json ->> 'fiscal_resp' as fiscal_resp,
  row_item.row_json ->> 'rua_index' as rua_index,
  row_item.row_json ->> 'lado_linha' as lado_linha,
  row_item.row_json ->> 'linha' as linha,
  public.to_num(row_item.row_json ->> 'numero_plantas_linha') as numero_plantas_linha,
  public.to_num(row_item.row_json ->> 'cacho_mal_posicionado') as cacho_mal_posicionado,
  public.to_num(row_item.row_json ->> 'cacho_nao_carreado') as cacho_nao_carreado,
  row_item.row_json as linha_json
from public.mobile_respostas r
cross join lateral jsonb_array_elements(r.dados_json -> 'linhas_carreamento')
  with ordinality as row_item(row_json, ordinality)
where r.formulario_id = 'form_cqo_carreamento_fruto_solto';

create or replace view public.vw_cqo_gps as
select
  g.id as gps_id,
  g.resposta_id,
  r.formulario_id,
  g.campo_id,
  g.latitude,
  g.longitude,
  g.precisao,
  g.altitude,
  g.capturado_em,
  r.dados_json ->> 'nome_fazenda' as fazenda,
  r.dados_json ->> 'parcela' as parcela,
  (r.dados_json ->> 'data_avaliacao')::date as data_avaliacao
from public.mobile_gps g
join public.mobile_respostas r on r.id = g.resposta_id
where r.formulario_id in (
  'form_cqo_corte',
  'form_cqo_carreamento_fruto_solto'
);
