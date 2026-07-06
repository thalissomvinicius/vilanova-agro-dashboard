-- Hotfix: permite corrigir metadados principais de fichas do app pelo dashboard.
-- Execute no SQL Editor do Supabase.

drop function if exists public.dashboard_update_response_metadata(text, text, jsonb);

create or replace function public.dashboard_update_response_metadata(
  p_session_token text,
  p_response_id text,
  p_patch_json jsonb
)
returns table (
  id text,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor record;
  v_response_id text := trim(coalesce(p_response_id, ''));
  v_previous_json jsonb;
  v_previous_status text;
  v_formulario_id text;
  v_patch jsonb := '{}'::jsonb;
  v_next_json jsonb;
  v_next_id text;
  v_next_status text;
  v_next_updated_at timestamptz;
  v_created_at timestamptz;
  v_key text;
  v_value jsonb;
  v_allowed_keys text[] := array[
    'nome_polo',
    'nome_fazenda',
    'parcela',
    'ano_plantio',
    'ciclo_mes',
    'data_avaliacao',
    'hora_avaliacao',
    'data_hora_avaliacao',
    'matricula_avaliador',
    'matricula_avaliador_2',
    'fiscal_resp',
    'fiscal_resp_equipe',
    'observacao'
  ];
begin
  select
    actor.matricula,
    actor.nome,
    actor.departamento,
    actor.cargo,
    actor.gestor,
    actor.status
    into v_actor
  from public.dashboard_authorized_actor(p_session_token, 'review_response') actor;

  if not found then
    raise exception 'Sessao expirada, invalida ou sem permissao.';
  end if;

  if v_response_id = '' then
    raise exception 'Ficha obrigatoria.';
  end if;

  if jsonb_typeof(coalesce(p_patch_json, '{}'::jsonb)) <> 'object' then
    raise exception 'Dados de correcao devem ser um objeto JSON.';
  end if;

  for v_key, v_value in
    select key, value from jsonb_each(coalesce(p_patch_json, '{}'::jsonb))
  loop
    if v_key = any(v_allowed_keys) then
      v_patch := jsonb_set(v_patch, array[v_key], v_value, true);
    end if;
  end loop;

  if v_patch = '{}'::jsonb then
    raise exception 'Nenhum campo permitido para corrigir.';
  end if;

  select r.dados_json, r.status::text, r.formulario_id::text
    into v_previous_json, v_previous_status, v_formulario_id
  from public.mobile_respostas r
  where r.id::text = v_response_id
  for update;

  if not found then
    raise exception 'Ficha nao encontrada.';
  end if;

  if v_formulario_id like 'excel_%' or coalesce(v_previous_json->>'fonte_excel', 'false') = 'true' then
    raise exception 'Fichas de Excel devem ser corrigidas na planilha de origem.';
  end if;

  v_next_json := coalesce(v_previous_json, '{}'::jsonb)
    || v_patch
    || jsonb_build_object(
      'editado_dashboard', true,
      'editado_por_matricula', v_actor.matricula,
      'editado_por_nome', v_actor.nome,
      'editado_em', now()
    );

  begin
    if nullif(trim(coalesce(v_next_json->>'data_hora_avaliacao', '')), '') is not null then
      v_created_at := (v_next_json->>'data_hora_avaliacao')::timestamptz;
    elsif nullif(trim(coalesce(v_next_json->>'data_avaliacao', '')), '') is not null then
      v_created_at := (v_next_json->>'data_avaliacao')::timestamptz;
    end if;
  exception when others then
    v_created_at := null;
  end;

  update public.mobile_respostas r
  set
    dados_json = v_next_json,
    usuario_id = coalesce(nullif(trim(v_next_json->>'matricula_avaliador'), ''), r.usuario_id),
    criado_em = coalesce(v_created_at, r.criado_em),
    atualizado_em = now(),
    updated_at = now()
  where r.id::text = v_response_id
  returning r.id::text, r.status::text, r.updated_at
    into v_next_id, v_next_status, v_next_updated_at;

  insert into public.dashboard_audit_events (
    actor_matricula,
    actor_nome,
    action,
    target_table,
    target_id,
    previous_value,
    next_value,
    metadata
  ) values (
    v_actor.matricula,
    v_actor.nome,
    'update_response_metadata',
    'mobile_respostas',
    v_next_id,
    jsonb_build_object(
      'status', v_previous_status,
      'dados_json', v_previous_json
    ),
    jsonb_build_object(
      'status', v_next_status,
      'patch', v_patch
    ),
    jsonb_build_object('origem', 'dashboard_edit')
  );

  return query select v_next_id, v_next_status, v_next_updated_at;
end;
$$;

revoke all on function public.dashboard_update_response_metadata(text, text, jsonb) from public;
grant execute on function public.dashboard_update_response_metadata(text, text, jsonb) to anon, authenticated;

comment on function public.dashboard_update_response_metadata(text, text, jsonb) is
  'Updates allowed metadata fields for app CQO responses after validating a dashboard session and writes an audit event.';
