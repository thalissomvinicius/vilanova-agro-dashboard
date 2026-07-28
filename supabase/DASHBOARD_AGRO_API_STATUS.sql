-- Exposes only operational heartbeat fields to authenticated dashboard sessions.
-- Secrets and heartbeat write credentials remain protected by RLS.

create or replace function public.dashboard_agro_api_status(
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_heartbeat jsonb := '{}'::jsonb;
begin
  perform 1
  from public.dashboard_session_profile(p_session_token) actor
  limit 1;

  if not found then
    raise exception 'Sessao expirada ou invalida.';
  end if;

  select coalesce(to_jsonb(row_data), '{}'::jsonb)
    into v_heartbeat
  from (
    select
      h.instance_id,
      h.status,
      h.checked_at,
      h.received_at,
      h.version,
      h.uptime_seconds,
      h.api_status,
      h.api_latency_ms,
      h.database_status,
      h.database_latency_ms,
      h.database_last_success_at,
      h.clock_status,
      h.clock_skew_seconds,
      h.vpn_status,
      h.reason_code
    from public.agro_api_heartbeats h
    order by h.received_at desc nulls last
    limit 1
  ) row_data;

  return coalesce(v_heartbeat, '{}'::jsonb);
end;
$$;

revoke all on function public.dashboard_agro_api_status(text) from public;
grant execute on function public.dashboard_agro_api_status(text) to anon, authenticated;

comment on function public.dashboard_agro_api_status(text) is
  'Latest safe AGRO API heartbeat for authenticated dashboard sessions.';
