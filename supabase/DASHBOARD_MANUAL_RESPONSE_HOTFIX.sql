-- Hotfix: permite lancar fichas CQO preenchidas em papel pelo dashboard.
-- Execute no SQL Editor do Supabase depois do production_hardening.sql.

drop function if exists public.dashboard_create_manual_response(text, text, jsonb, text);

create or replace function public.dashboard_create_manual_response(
  p_session_token text,
  p_formulario_id text,
  p_dados_json jsonb,
  p_status text default 'aprovado'
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
  v_form_id text := trim(coalesce(p_formulario_id, ''));
  v_status text := lower(trim(coalesce(p_status, 'aprovado')));
  v_form_version integer;
  v_response_id text := 'manual_' || replace(gen_random_uuid()::text, '-', '');
  v_payload jsonb;
  v_usuario_id text;
  v_created_at timestamptz := now();
begin
  select
    actor.matricula,
    actor.nome,
    actor.departamento,
    actor.cargo,
    actor.gestor,
    actor.status
    into v_actor
  from (
    select * from public.dashboard_authorized_actor(p_session_token, 'create_manual_response')
    union all
    select * from public.dashboard_authorized_actor(p_session_token, 'review_response')
  ) actor
  limit 1;

  if not found then
    raise exception 'Sessao expirada, invalida ou sem permissao.';
  end if;

  if v_form_id not in (
    'form_cqo_corte',
    'form_cqo_carreamento_fruto_solto',
    'form_cqo_poda'
  ) then
    raise exception 'Formulario manual invalido.';
  end if;

  if jsonb_typeof(coalesce(p_dados_json, '{}'::jsonb)) <> 'object' then
    raise exception 'Dados da ficha manual devem ser um objeto JSON.';
  end if;

  if v_status not in ('aprovado', 'pendente_validacao') then
    raise exception 'Status inicial invalido.';
  end if;

  select f.versao
    into v_form_version
  from public.mobile_formularios f
  where f.id = v_form_id
  limit 1;

  if not found then
    raise exception 'Formulario nao encontrado em mobile_formularios.';
  end if;

  v_payload := coalesce(p_dados_json, '{}'::jsonb)
    || jsonb_build_object(
      'origem_manual_dashboard', true,
      'origem_manual_tipo', 'papel',
      'gps_nao_aplicavel', true,
      'lancado_por_matricula', v_actor.matricula,
      'lancado_por_nome', v_actor.nome,
      'data_lancamento_manual', now()
    );

  v_usuario_id := nullif(trim(coalesce(v_payload->>'matricula_avaliador', '')), '');
  if v_usuario_id is null then
    v_usuario_id := v_actor.matricula;
  end if;

  begin
    if nullif(trim(coalesce(v_payload->>'data_hora_avaliacao', '')), '') is not null then
      v_created_at := (v_payload->>'data_hora_avaliacao')::timestamptz;
    elsif nullif(trim(coalesce(v_payload->>'data_avaliacao', '')), '') is not null then
      v_created_at := (v_payload->>'data_avaliacao')::timestamptz;
    end if;
  exception when others then
    v_created_at := now();
  end;

  insert into public.mobile_respostas (
    id,
    formulario_id,
    formulario_versao,
    usuario_id,
    dados_json,
    status,
    dispositivo_id,
    origem,
    criado_em,
    enviado_em,
    recebido_em,
    atualizado_em,
    updated_at
  ) values (
    v_response_id,
    v_form_id,
    v_form_version,
    v_usuario_id,
    v_payload,
    v_status,
    'dashboard-manual',
    'dashboard_manual',
    v_created_at,
    now(),
    now(),
    now(),
    now()
  );

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
    'create_manual_response',
    'mobile_respostas',
    v_response_id,
    null,
    jsonb_build_object(
      'status', v_status,
      'formulario_id', v_form_id,
      'usuario_id', v_usuario_id
    ),
    jsonb_build_object('origem', 'dashboard_manual')
  );

  return query select v_response_id, v_status, now();
end;
$$;

revoke all on function public.dashboard_create_manual_response(text, text, jsonb, text) from public;
grant execute on function public.dashboard_create_manual_response(text, text, jsonb, text) to anon, authenticated;

comment on function public.dashboard_create_manual_response(text, text, jsonb, text) is
  'Creates an app-source manual CQO response from a paper form after validating a dashboard session and writes an audit event.';

-- Garanta a permissao para usuarios nao-admin que precisam lancar papel:
-- update public.dashboard_access_users
-- set permissions = array(
--   select distinct permission
--   from unnest(coalesce(permissions, '{}'::text[]) || array['create_manual_response']::text[]) as permission
-- )
-- where matricula = '2170';
