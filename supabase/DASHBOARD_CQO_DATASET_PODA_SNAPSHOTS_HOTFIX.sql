-- Hotfix: atualiza somente a RPC que alimenta o dashboard CQO.
-- Objetivo: fazer CQO Poda usar o snapshot mais recente por arquivo/aba,
-- considerando updated_at, file_last_write_time, imported_at e total_rows.

create or replace function public.dashboard_cqo_dataset(
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor record;
  v_mobile_rows jsonb := '[]'::jsonb;
  v_gps_rows jsonb := '[]'::jsonb;
  v_attachment_rows jsonb := '[]'::jsonb;
  v_form_rows jsonb := '[]'::jsonb;
  v_headcount_snapshots jsonb := '[]'::jsonb;
  v_cqo_snapshots jsonb := '[]'::jsonb;
  v_cqo_poda_snapshots jsonb := '[]'::jsonb;
begin
  select
    actor.matricula,
    actor.nome,
    actor.departamento,
    actor.cargo,
    actor.gestor,
    actor.status,
    actor.role,
    actor.permissions,
    actor.session_expires_at
    into v_actor
  from public.dashboard_session_profile(p_session_token) actor
  limit 1;

  if not found then
    raise exception 'Sessao expirada ou invalida.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.criado_em desc nulls last), '[]'::jsonb)
    into v_mobile_rows
  from (
    select
      r.id,
      r.formulario_id,
      r.formulario_versao,
      r.usuario_id,
      r.status,
      r.criado_em,
      r.enviado_em,
      r.recebido_em,
      r.updated_at,
      r.dados_json
    from public.mobile_respostas r
    where coalesce(r.status::text, '') <> 'excluido'
    order by r.criado_em desc nulls last
    limit 1000
  ) row_data;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.capturado_em asc nulls last), '[]'::jsonb)
    into v_gps_rows
  from (
    select id, resposta_id, campo_id, latitude, longitude, precisao, altitude, capturado_em
    from public.mobile_gps
    order by capturado_em asc nulls last
    limit 10000
  ) row_data;

  select coalesce(jsonb_agg(row_data.safe_row), '[]'::jsonb)
    into v_attachment_rows
  from (
    select
      (
        to_jsonb(a)
        || jsonb_build_object('usuario_id', r.usuario_id)
      )
        - 'senha'
        - 'password'
        - 'token'
        - 'secret'
        - 'authorization'
        - 'apikey'
        - 'api_key'
        - 'service_role_key'
        - 'access_token'
        - 'refresh_token' as safe_row
    from public.mobile_anexos a
    left join public.mobile_respostas r on r.id = a.resposta_id
    limit 10000
  ) row_data;

  select coalesce(jsonb_agg(row_data.safe_row), '[]'::jsonb)
    into v_form_rows
  from (
    select
      to_jsonb(f)
        - 'senha'
        - 'password'
        - 'token'
        - 'secret'
        - 'authorization'
        - 'apikey'
        - 'api_key'
        - 'service_role_key'
        - 'access_token'
        - 'refresh_token' as safe_row
    from public.mobile_formularios f
    limit 500
  ) row_data;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.reference_month desc nulls last, row_data.imported_at desc nulls last), '[]'::jsonb)
    into v_headcount_snapshots
  from (
    select
      import_key,
      fonte,
      reference_month,
      source_file,
      source_sheet,
      total_rows,
      columns_json,
      rows_json,
      imported_at,
      updated_at
    from public.headcount_import_snapshots
    where fonte = 'headcount_agricola'
    order by reference_month desc nulls last, imported_at desc nulls last
    limit 1
  ) row_data;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.updated_at desc nulls last, row_data.imported_at desc nulls last), '[]'::jsonb)
    into v_cqo_snapshots
  from (
    select
      import_key,
      fonte,
      source_file,
      source_path,
      file_last_write_time,
      corte_total_rows,
      carreamento_total_rows,
      corte_columns_json,
      carreamento_columns_json,
      corte_rows_json,
      carreamento_rows_json,
      imported_at,
      updated_at
    from public.cqo_import_snapshots
    order by
      case when import_key = 'cqo_1_digitacao_cqo' then 0 else 1 end,
      updated_at desc nulls last,
      imported_at desc nulls last
    limit 1
  ) row_data;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.updated_at desc nulls last, row_data.imported_at desc nulls last), '[]'::jsonb)
    into v_cqo_poda_snapshots
  from (
    select
      import_key,
      fonte,
      source_file,
      source_path,
      source_sheet,
      file_last_write_time,
      total_rows,
      columns_json,
      rows_json,
      imported_at,
      updated_at
    from (
      select distinct on (
        coalesce(nullif(source_file, ''), import_key),
        coalesce(nullif(source_sheet, ''), 'poda')
      )
        import_key,
        fonte,
        source_file,
        source_path,
        source_sheet,
        file_last_write_time,
        total_rows,
        columns_json,
        rows_json,
        imported_at,
        updated_at
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
      limit 500
    ) latest_poda
    order by
      greatest(
        coalesce(updated_at, '-infinity'::timestamptz),
        coalesce(file_last_write_time, '-infinity'::timestamptz),
        coalesce(imported_at, '-infinity'::timestamptz)
      ) desc,
      total_rows desc
  ) row_data;

  return jsonb_build_object(
    'response_table', 'mobile_respostas',
    'mobile_respostas', v_mobile_rows,
    'mobile_gps', v_gps_rows,
    'mobile_anexos', v_attachment_rows,
    'mobile_formularios', v_form_rows,
    'headcount_import_snapshots', v_headcount_snapshots,
    'cqo_import_snapshots', v_cqo_snapshots,
    'cqo_poda_import_snapshots', v_cqo_poda_snapshots
  );
end;
$$;

grant execute on function public.dashboard_cqo_dataset(text) to anon, authenticated;
