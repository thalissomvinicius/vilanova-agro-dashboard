begin;

create table if not exists public.balanca_import_snapshots (
  import_key text primary key,
  source_file text not null,
  source_path text not null,
  source_hash text not null,
  file_last_write_time timestamptz,
  total_rows integer not null default 0,
  snapshot_json jsonb not null default '{}'::jsonb,
  validation_json jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_balanca_import_snapshots_updated
  on public.balanca_import_snapshots (updated_at desc);

alter table public.balanca_import_snapshots enable row level security;

revoke all on table public.balanca_import_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.balanca_import_snapshots to service_role;

create or replace function public.dashboard_balanca_snapshot(
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_snapshot jsonb := '{}'::jsonb;
begin
  perform 1
  from public.dashboard_session_profile(p_session_token) actor
  limit 1;

  if not found then
    raise exception 'Sessao expirada ou invalida.';
  end if;

  select coalesce(to_jsonb(row_data), '{}'::jsonb)
    into v_snapshot
  from (
    select
      snapshot_json,
      source_file,
      source_path,
      source_hash,
      total_rows,
      validation_json,
      imported_at,
      updated_at
    from public.balanca_import_snapshots
    where import_key = 'balanca_perdas_agricolas'
    order by updated_at desc nulls last, imported_at desc nulls last
    limit 1
  ) row_data;

  return coalesce(v_snapshot, '{}'::jsonb);
end;
$$;

revoke all on function public.dashboard_balanca_snapshot(text) from public;
grant execute on function public.dashboard_balanca_snapshot(text) to anon, authenticated;

comment on table public.balanca_import_snapshots is
  'Snapshot consolidado da balanca para peso medio mensal e producao das fazendas.';

comment on function public.dashboard_balanca_snapshot(text) is
  'Entrega ao dashboard o snapshot mais recente da balanca apos validar a sessao.';

commit;
