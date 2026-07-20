-- Restores dashboard reads after the CQO payload outgrew the anon role timeout.
-- The current production client can keep using dashboard_cqo_dataset while newer
-- clients request the same data in smaller, independently serialized parts.

create or replace function public.dashboard_session_profile(
  p_session_token text
)
returns table (
  matricula text,
  nome text,
  departamento text,
  cargo text,
  gestor text,
  status text,
  role text,
  permissions text[],
  session_expires_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    s.matricula,
    s.nome,
    s.departamento,
    s.cargo,
    s.gestor,
    s.status,
    access.role::text,
    access.permissions::text[],
    s.expires_at
  from public.dashboard_sessions s
  join public.dashboard_access_users access
    on access.matricula = s.matricula
   and access.active = true
  where nullif(trim(coalesce(p_session_token, '')), '') is not null
    and s.session_token_hash = encode(digest(trim(p_session_token), 'sha256'), 'hex')
    and s.revoked_at is null
    and s.expires_at > now()
  limit 1;
$$;

create or replace function public.dashboard_cqo_dataset_part(
  p_session_token text,
  p_part text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_actor record;
  v_part text := lower(trim(coalesce(p_part, '')));
  v_result jsonb := '{}'::jsonb;
begin
  select actor.*
    into v_actor
  from public.dashboard_session_profile(p_session_token) actor
  limit 1;

  if not found then
    raise exception 'Sessao expirada ou invalida.';
  end if;

  if v_part = 'responses' then
    select jsonb_build_object(
      'response_table', 'mobile_respostas',
      'mobile_respostas', coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.criado_em desc nulls last), '[]'::jsonb)
    )
      into v_result
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

  elsif v_part = 'gps' then
    select jsonb_build_object(
      'mobile_gps', coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.capturado_em asc nulls last), '[]'::jsonb)
    )
      into v_result
    from (
      with response_scope as (
        select r.id
        from public.mobile_respostas r
        where coalesce(r.status::text, '') <> 'excluido'
        order by r.criado_em desc nulls last
        limit 1000
      )
      select g.id, g.resposta_id, g.campo_id, g.latitude, g.longitude,
             g.precisao, g.altitude, g.capturado_em
      from public.mobile_gps g
      join response_scope scope on scope.id = g.resposta_id
      order by g.capturado_em asc nulls last
      limit 20000
    ) row_data;

  elsif v_part = 'metadata' then
    select jsonb_build_object(
      'mobile_anexos', coalesce((
        select jsonb_agg(row_data.safe_row)
        from (
          with response_scope as (
            select r.id
            from public.mobile_respostas r
            where coalesce(r.status::text, '') <> 'excluido'
            order by r.criado_em desc nulls last
            limit 1000
          )
          select (
            to_jsonb(a) || jsonb_build_object('usuario_id', r.usuario_id)
          )
            - 'senha' - 'password' - 'token' - 'secret' - 'authorization'
            - 'apikey' - 'api_key' - 'service_role_key' - 'access_token'
            - 'refresh_token' as safe_row
          from public.mobile_anexos a
          join response_scope scope on scope.id = a.resposta_id
          left join public.mobile_respostas r on r.id = a.resposta_id
          limit 10000
        ) row_data
      ), '[]'::jsonb),
      'mobile_formularios', coalesce((
        select jsonb_agg(row_data.safe_row)
        from (
          select to_jsonb(f)
            - 'senha' - 'password' - 'token' - 'secret' - 'authorization'
            - 'apikey' - 'api_key' - 'service_role_key' - 'access_token'
            - 'refresh_token' as safe_row
          from public.mobile_formularios f
          limit 500
        ) row_data
      ), '[]'::jsonb),
      'headcount_import_snapshots', coalesce((
        select jsonb_agg(to_jsonb(row_data) order by row_data.reference_month desc nulls last, row_data.imported_at desc nulls last)
        from (
          select import_key, fonte, reference_month, source_file, source_sheet,
                 total_rows, columns_json, rows_json, imported_at, updated_at
          from public.headcount_import_snapshots
          where fonte = 'headcount_agricola'
          order by reference_month desc nulls last, imported_at desc nulls last
          limit 1
        ) row_data
      ), '[]'::jsonb)
    ) into v_result;

  elsif v_part = 'cqo_import' then
    select jsonb_build_object(
      'cqo_import_snapshots', coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.updated_at desc nulls last, row_data.imported_at desc nulls last), '[]'::jsonb)
    )
      into v_result
    from (
      select import_key, fonte, source_file, source_path, file_last_write_time,
             corte_total_rows, carreamento_total_rows, corte_columns_json,
             carreamento_columns_json, corte_rows_json, carreamento_rows_json,
             imported_at, updated_at
      from public.cqo_import_snapshots
      order by case when import_key = 'cqo_1_digitacao_cqo' then 0 else 1 end,
               updated_at desc nulls last, imported_at desc nulls last
      limit 1
    ) row_data;

  elsif v_part = 'cqo_poda_import' then
    select jsonb_build_object(
      'cqo_poda_import_snapshots', coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.updated_at desc nulls last, row_data.imported_at desc nulls last), '[]'::jsonb)
    )
      into v_result
    from (
      select import_key, fonte, source_file, source_path, source_sheet,
             file_last_write_time, total_rows, columns_json, rows_json,
             imported_at, updated_at
      from (
        select distinct on (
          coalesce(nullif(source_file, ''), import_key),
          coalesce(nullif(source_sheet, ''), 'poda')
        )
          import_key, fonte, source_file, source_path, source_sheet,
          file_last_write_time, total_rows, columns_json, rows_json,
          imported_at, updated_at
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
      order by greatest(
        coalesce(updated_at, '-infinity'::timestamptz),
        coalesce(file_last_write_time, '-infinity'::timestamptz),
        coalesce(imported_at, '-infinity'::timestamptz)
      ) desc, total_rows desc
    ) row_data;

  else
    raise exception 'Parte de dataset invalida.';
  end if;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.dashboard_session_profile(text) from public;
revoke all on function public.dashboard_cqo_dataset_part(text, text) from public;
grant execute on function public.dashboard_session_profile(text) to anon, authenticated;
grant execute on function public.dashboard_cqo_dataset_part(text, text) to anon, authenticated;

-- Compatibility window for the current Vercel bundle. The split endpoint above
-- is the permanent path and stays under the anon role's regular three-second cap.
alter function public.dashboard_cqo_dataset(text) set statement_timeout = '20s';

comment on function public.dashboard_cqo_dataset_part(text, text) is
  'Returns one bounded CQO dataset segment so PostgREST does not serialize the entire dashboard payload in a single statement.';
