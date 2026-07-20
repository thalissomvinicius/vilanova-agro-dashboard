-- Keeps every app response available without serializing the complete history
-- inside one PostgREST statement. The client requests the remaining pages only
-- after learning the bounded total from the first page.

create or replace function public.dashboard_cqo_response_page(
  p_session_token text,
  p_offset integer,
  p_limit integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_actor record;
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_total integer := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  select actor.*
    into v_actor
  from public.dashboard_session_profile(p_session_token) actor
  limit 1;

  if not found then
    raise exception 'Sessao expirada ou invalida.';
  end if;

  select least(count(*)::integer, 1000)
    into v_total
  from public.mobile_respostas r
  where coalesce(r.status::text, '') <> 'excluido';

  select coalesce(
    jsonb_agg(to_jsonb(row_data) order by row_data.criado_em desc nulls last),
    '[]'::jsonb
  )
    into v_rows
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
    limit v_limit
    offset v_offset
  ) row_data;

  return jsonb_build_object(
    'response_table', 'mobile_respostas',
    'mobile_respostas', v_rows,
    'total_rows', v_total,
    'offset', v_offset,
    'limit', v_limit,
    'has_more', v_offset + jsonb_array_length(v_rows) < v_total
  );
end;
$$;

revoke all on function public.dashboard_cqo_response_page(text, integer, integer) from public;
grant execute on function public.dashboard_cqo_response_page(text, integer, integer) to anon, authenticated;

comment on function public.dashboard_cqo_response_page(text, integer, integer) is
  'Returns a bounded page of CQO app responses for the authenticated dashboard session.';
