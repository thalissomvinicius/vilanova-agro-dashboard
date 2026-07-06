-- Production hardening helpers for Vila Nova Agro Dashboard.
-- Review in staging before applying to production.

create extension if not exists pgcrypto;

-- Prevent untrusted roles from creating objects in public, which protects
-- security definer functions from search_path/object-shadowing surprises.
revoke create on schema public from public;
grant usage on schema public to anon, authenticated;

-- Query performance for dashboard reads.
create index if not exists idx_mobile_respostas_status_form_criado
  on public.mobile_respostas (status, formulario_id, criado_em desc);

create index if not exists idx_mobile_respostas_form_recebido
  on public.mobile_respostas (formulario_id, recebido_em desc);

create index if not exists idx_mobile_respostas_usuario
  on public.mobile_respostas (usuario_id);

create index if not exists idx_mobile_respostas_dados_json
  on public.mobile_respostas using gin (dados_json jsonb_path_ops);

create index if not exists idx_mobile_gps_resposta_capturado
  on public.mobile_gps (resposta_id, capturado_em asc);

create index if not exists idx_mobile_anexos_resposta
  on public.mobile_anexos (resposta_id);

create index if not exists idx_mobile_formularios_id_versao
  on public.mobile_formularios (id, versao);

create index if not exists idx_headcount_colaboradores_matricula_status
  on public.headcount_colaboradores (matricula, status);

alter table public.headcount_colaboradores
  add column if not exists senha_hash text;

comment on column public.headcount_colaboradores.senha_hash is
  'Password hash used by dashboard authentication. New password changes should populate this and clear legacy senha.';

create index if not exists idx_headcount_import_snapshots_fonte_ref
  on public.headcount_import_snapshots (fonte, reference_month desc, imported_at desc);

create index if not exists idx_cqo_import_snapshots_key_updated
  on public.cqo_import_snapshots (import_key, updated_at desc);

do $$
begin
  if to_regclass('public.bonificacao_import_snapshots') is not null then
    execute 'create index if not exists idx_bonificacao_import_snapshots_key_updated on public.bonificacao_import_snapshots (import_key, updated_at desc)';
  end if;
end;
$$;

create table if not exists public.dashboard_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null unique,
  matricula text not null,
  nome text,
  departamento text,
  cargo text,
  gestor text,
  status text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_dashboard_sessions_matricula_created
  on public.dashboard_sessions (matricula, created_at desc);

create index if not exists idx_dashboard_sessions_active_expiry
  on public.dashboard_sessions (expires_at)
  where revoked_at is null;

create index if not exists idx_dashboard_sessions_revoked_at
  on public.dashboard_sessions (revoked_at)
  where revoked_at is not null;

alter table public.dashboard_sessions enable row level security;

comment on table public.dashboard_sessions is
  'Server-side dashboard sessions. Only token hashes are stored.';

create table if not exists public.dashboard_login_attempts (
  id uuid primary key default gen_random_uuid(),
  matricula text,
  success boolean not null default false,
  reason text,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_dashboard_login_attempts_matricula_recent
  on public.dashboard_login_attempts (matricula, attempted_at desc);

create index if not exists idx_dashboard_login_attempts_failed_recent
  on public.dashboard_login_attempts (matricula, attempted_at desc)
  where success = false;

create index if not exists idx_dashboard_login_attempts_attempted_at
  on public.dashboard_login_attempts (attempted_at);

alter table public.dashboard_login_attempts enable row level security;

comment on table public.dashboard_login_attempts is
  'Server-side audit trail and rate-limit source for dashboard authentication attempts. Never stores submitted passwords.';

create table if not exists public.dashboard_access_users (
  matricula text primary key,
  role text not null default 'viewer',
  permissions text[] not null default '{}'::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_access_users_role_check
    check (role in ('admin', 'auditor', 'viewer'))
);

create index if not exists idx_dashboard_access_users_active_role
  on public.dashboard_access_users (active, role);

alter table public.dashboard_access_users enable row level security;

comment on table public.dashboard_access_users is
  'Allowlist and RBAC permissions for privileged dashboard actions. Seed at least one admin before production.';

drop function if exists public.dashboard_prune_security_state(integer, integer, integer);

create or replace function public.dashboard_prune_security_state(
  p_session_retention_days integer default 7,
  p_login_attempt_retention_days integer default 30,
  p_audit_retention_days integer default null
)
returns table (
  sessions_deleted integer,
  login_attempts_deleted integer,
  audit_events_deleted integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  with deleted_sessions as (
    delete from public.dashboard_sessions sessions
    where coalesce(sessions.revoked_at, sessions.expires_at)
      < now() - make_interval(days => greatest(coalesce(p_session_retention_days, 7), 1))
    returning 1
  ),
  deleted_login_attempts as (
    delete from public.dashboard_login_attempts attempts
    where attempts.attempted_at
      < now() - make_interval(days => greatest(coalesce(p_login_attempt_retention_days, 30), 1))
    returning 1
  ),
  deleted_audit_events as (
    delete from public.dashboard_audit_events audit
    where p_audit_retention_days is not null
      and audit.created_at
        < now() - make_interval(days => greatest(p_audit_retention_days, 30))
    returning 1
  )
  select
    (select count(*)::integer from deleted_sessions),
    (select count(*)::integer from deleted_login_attempts),
    (select count(*)::integer from deleted_audit_events);
end;
$$;

-- Secure dashboard authentication wrappers.
-- These functions prevent the frontend from selecting the senha column directly.
drop function if exists public.dashboard_authenticate(text, text);
drop function if exists public.dashboard_cqo_dataset(text);
drop function if exists public.dashboard_headcount_snapshot(text);
drop function if exists public.dashboard_bonificacao_snapshot(text);
drop function if exists public.dashboard_update_collaborator_access(text, text, text);
drop function if exists public.dashboard_update_collaborator_access(text, text, text, text);

create or replace function public.dashboard_authenticate(
  p_matricula text,
  p_senha text
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
  session_token text,
  session_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user record;
  v_token text;
  v_matricula text := trim(coalesce(p_matricula, ''));
  v_failed_attempts integer := 0;
  v_expires_at timestamptz := now() + interval '12 hours';
begin
  if nullif(v_matricula, '') is null
    or nullif(trim(coalesce(p_senha, '')), '') is null then
    return;
  end if;

  perform public.dashboard_prune_security_state(7, 30, null);

  select count(*)::integer
    into v_failed_attempts
  from public.dashboard_login_attempts attempts
  where attempts.matricula = v_matricula
    and attempts.success = false
    and attempts.attempted_at > now() - interval '15 minutes';

  if v_failed_attempts >= 5 then
    insert into public.dashboard_login_attempts (matricula, success, reason)
    values (v_matricula, false, 'rate_limited');

    raise exception 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.';
  end if;

  select
    c.matricula::text,
    c.nome::text,
    c.departamento::text,
    c.cargo::text,
    c.gestor::text,
    c.status::text,
    access.role::text,
    access.permissions::text[]
  into v_user
  from public.headcount_colaboradores c
  join public.dashboard_access_users access
    on access.matricula = c.matricula::text
   and access.active = true
  where c.matricula::text = v_matricula
    and c.status::text = 'ATIVO'
    and nullif(c.senha_hash, '') is not null
    and c.senha_hash = crypt(trim(p_senha), c.senha_hash)
  limit 1;

  if not found then
    insert into public.dashboard_login_attempts (matricula, success, reason)
    values (v_matricula, false, 'invalid_credentials');

    return;
  end if;

  insert into public.dashboard_login_attempts (matricula, success, reason)
  values (v_matricula, true, 'authenticated');

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.dashboard_sessions (
    session_token_hash,
    matricula,
    nome,
    departamento,
    cargo,
    gestor,
    status,
    expires_at
  ) values (
    encode(digest(v_token, 'sha256'), 'hex'),
    v_user.matricula,
    v_user.nome,
    v_user.departamento,
    v_user.cargo,
    v_user.gestor,
    v_user.status,
    v_expires_at
  );

  return query select
    v_user.matricula,
    v_user.nome,
    v_user.departamento,
    v_user.cargo,
    v_user.gestor,
    v_user.status,
    v_user.role,
    v_user.permissions,
    v_token,
    v_expires_at;
end;
$$;

create or replace function public.dashboard_session_actor(
  p_session_token text
)
returns table (
  matricula text,
  nome text,
  departamento text,
  cargo text,
  gestor text,
  status text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if nullif(trim(coalesce(p_session_token, '')), '') is null then
    return;
  end if;

  return query
  update public.dashboard_sessions s
  set last_seen_at = now()
  where s.session_token_hash = encode(digest(trim(p_session_token), 'sha256'), 'hex')
    and s.revoked_at is null
    and s.expires_at > now()
  returning
    s.matricula,
    s.nome,
    s.departamento,
    s.cargo,
    s.gestor,
    s.status;
end;
$$;

create or replace function public.dashboard_logout(
  p_session_token text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if nullif(trim(coalesce(p_session_token, '')), '') is null then
    return;
  end if;

  update public.dashboard_sessions s
  set revoked_at = coalesce(s.revoked_at, now())
  where s.session_token_hash = encode(digest(trim(p_session_token), 'sha256'), 'hex')
    and s.revoked_at is null;
end;
$$;

create or replace function public.dashboard_authorized_actor(
  p_session_token text,
  p_permission text
)
returns table (
  matricula text,
  nome text,
  departamento text,
  cargo text,
  gestor text,
  status text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select
    actor.matricula,
    actor.nome,
    actor.departamento,
    actor.cargo,
    actor.gestor,
    actor.status
  from public.dashboard_session_actor(p_session_token) actor
  join public.dashboard_access_users access
    on access.matricula = actor.matricula
  where access.active = true
    and (
      access.role = 'admin'
      or trim(coalesce(p_permission, '')) = any(access.permissions)
    );
end;
$$;

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
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if nullif(trim(coalesce(p_session_token, '')), '') is null then
    return;
  end if;

  return query
  update public.dashboard_sessions s
  set last_seen_at = now()
  from public.dashboard_access_users access
  where s.session_token_hash = encode(digest(trim(p_session_token), 'sha256'), 'hex')
    and s.revoked_at is null
    and s.expires_at > now()
    and access.matricula = s.matricula
    and access.active = true
  returning
    s.matricula,
    s.nome,
    s.departamento,
    s.cargo,
    s.gestor,
    s.status,
    access.role::text,
    access.permissions::text[],
    s.expires_at;
end;
$$;

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

create or replace function public.dashboard_headcount_snapshot(
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

  return coalesce(v_snapshot, '{}'::jsonb);
end;
$$;

create or replace function public.dashboard_bonificacao_snapshot(
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

  if to_regclass('public.bonificacao_import_snapshots') is null then
    return '{}'::jsonb;
  end if;

  execute $sql$
    select coalesce(to_jsonb(row_data), '{}'::jsonb)
    from (
      select snapshot_json, source_path, imported_at, updated_at
      from public.bonificacao_import_snapshots
      where import_key = 'bonificacao_qualidade_cff'
      order by updated_at desc nulls last, imported_at desc nulls last
      limit 1
    ) row_data
  $sql$
    into v_snapshot;

  return coalesce(v_snapshot, '{}'::jsonb);
end;
$$;

create or replace function public.dashboard_update_collaborator_access(
  p_session_token text,
  p_matricula text,
  p_status text default null,
  p_senha text default null
)
returns table (
  matricula text,
  nome text,
  departamento text,
  cargo text,
  gestor text,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor record;
  v_previous_value jsonb;
  v_next_matricula text;
  v_next_nome text;
  v_next_departamento text;
  v_next_cargo text;
  v_next_gestor text;
  v_next_status text;
  v_next_updated_at timestamptz;
begin
  select
    actor.matricula,
    actor.nome,
    actor.departamento,
    actor.cargo,
    actor.gestor,
    actor.status
    into v_actor
  from public.dashboard_authorized_actor(p_session_token, 'manage_collaborators') actor;

  if not found then
    raise exception 'Sessao expirada, invalida ou sem permissao.';
  end if;

  if nullif(trim(coalesce(p_matricula, '')), '') is null then
    raise exception 'Matricula obrigatoria.';
  end if;

  select jsonb_build_object(
    'status', c.status,
    'senha_configurada', c.senha_hash is not null and c.senha_hash <> '',
    'senha_hash_configurada', c.senha_hash is not null and c.senha_hash <> ''
  )
    into v_previous_value
  from public.headcount_colaboradores c
  where c.matricula::text = trim(p_matricula)
  for update;

  if not found then
    raise exception 'Colaborador nao encontrado.';
  end if;

  update public.headcount_colaboradores c
  set
    status = coalesce(nullif(trim(p_status), ''), c.status),
    senha_hash = case
      when nullif(trim(p_senha), '') is not null
        then crypt(trim(p_senha), gen_salt('bf', 12))
      else c.senha_hash
    end,
    senha = case
      when nullif(trim(p_senha), '') is not null then ''
      else c.senha
    end,
    updated_at = now()
  where c.matricula::text = trim(p_matricula)
  returning
    c.matricula::text,
    c.nome::text,
    c.departamento::text,
    c.cargo::text,
    c.gestor::text,
    c.status::text,
    c.updated_at
    into
      v_next_matricula,
      v_next_nome,
      v_next_departamento,
      v_next_cargo,
      v_next_gestor,
      v_next_status,
      v_next_updated_at;

  insert into public.dashboard_audit_events (
    actor_matricula,
    actor_nome,
    action,
    target_table,
    target_id,
    previous_value,
    next_value
  ) values (
    v_actor.matricula,
    v_actor.nome,
    'update_collaborator_access',
    'headcount_colaboradores',
    v_next_matricula,
    v_previous_value,
    jsonb_build_object(
      'status', v_next_status,
      'senha_alterada', nullif(trim(coalesce(p_senha, '')), '') is not null
    )
  );

  return query select
    v_next_matricula,
    v_next_nome,
    v_next_departamento,
    v_next_cargo,
    v_next_gestor,
    v_next_status,
    v_next_updated_at;
end;
$$;

create or replace function public.dashboard_hash_legacy_passwords(
  p_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_updated integer := 0;
begin
  with candidates as (
    select ctid
    from public.headcount_colaboradores
    where nullif(senha_hash, '') is null
      and nullif(senha::text, '') is not null
    limit greatest(coalesce(p_limit, 500), 1)
  )
  update public.headcount_colaboradores c
  set
    senha_hash = crypt(c.senha::text, gen_salt('bf', 12)),
    senha = '',
    updated_at = now()
  from candidates
  where c.ctid = candidates.ctid;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.dashboard_authenticate(text, text) from public;
revoke all on function public.dashboard_session_actor(text) from public, anon, authenticated;
revoke all on function public.dashboard_logout(text) from public;
revoke all on function public.dashboard_authorized_actor(text, text) from public, anon, authenticated;
revoke all on function public.dashboard_session_profile(text) from public;
revoke all on function public.dashboard_cqo_dataset(text) from public;
revoke all on function public.dashboard_headcount_snapshot(text) from public;
revoke all on function public.dashboard_bonificacao_snapshot(text) from public;
revoke all on function public.dashboard_update_collaborator_access(text, text, text, text) from public;
revoke all on function public.dashboard_hash_legacy_passwords(integer) from public, anon, authenticated;
revoke all on function public.dashboard_prune_security_state(integer, integer, integer) from public, anon, authenticated;

grant execute on function public.dashboard_authenticate(text, text) to anon, authenticated;
grant execute on function public.dashboard_logout(text) to anon, authenticated;
grant execute on function public.dashboard_session_profile(text) to anon, authenticated;
grant execute on function public.dashboard_cqo_dataset(text) to anon, authenticated;
grant execute on function public.dashboard_headcount_snapshot(text) to anon, authenticated;
grant execute on function public.dashboard_bonificacao_snapshot(text) to anon, authenticated;
grant execute on function public.dashboard_update_collaborator_access(text, text, text, text) to anon, authenticated;

comment on function public.dashboard_authenticate(text, text) is
  'Authenticates dashboard access and issues an opaque short-lived session token.';

comment on function public.dashboard_authorized_actor(text, text) is
  'Internal helper that validates a dashboard session and checks dashboard_access_users permissions.';

comment on function public.dashboard_session_profile(text) is
  'Refreshes an active dashboard session and returns current RBAC role and permissions.';

comment on function public.dashboard_cqo_dataset(text) is
  'Returns the CQO dashboard read dataset for an active dashboard session without exposing table reads directly to the frontend.';

comment on function public.dashboard_headcount_snapshot(text) is
  'Returns the latest headcount import snapshot for an active dashboard session.';

comment on function public.dashboard_bonificacao_snapshot(text) is
  'Returns the latest bonificacao snapshot for an active dashboard session, or an empty object when the optional import table is absent.';

comment on function public.dashboard_update_collaborator_access(text, text, text, text) is
  'Updates collaborator status and optional password without returning stored password values.';

comment on function public.dashboard_hash_legacy_passwords(integer) is
  'One-time operational helper to hash legacy plaintext passwords inside the database. Execute manually as an owner/service role.';

comment on function public.dashboard_prune_security_state(integer, integer, integer) is
  'Operational helper that removes old dashboard sessions and login attempts. Audit events are preserved unless an explicit audit retention window is provided.';

-- Audit trail for privileged dashboard actions.
create table if not exists public.dashboard_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_matricula text,
  actor_nome text,
  action text not null,
  target_table text not null,
  target_id text,
  previous_value jsonb,
  next_value jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_dashboard_audit_events_actor_created
  on public.dashboard_audit_events (actor_matricula, created_at desc);

create index if not exists idx_dashboard_audit_events_target_created
  on public.dashboard_audit_events (target_table, target_id, created_at desc);

create index if not exists idx_dashboard_audit_events_action_created
  on public.dashboard_audit_events (action, created_at desc);

create index if not exists idx_dashboard_audit_events_created_at
  on public.dashboard_audit_events (created_at);

alter table public.dashboard_audit_events enable row level security;

comment on table public.dashboard_audit_events is
  'Append-only audit trail for dashboard review, deletion and collaborator access changes.';

comment on column public.dashboard_audit_events.action is
  'Examples: review_response, delete_response, update_collaborator_access.';

drop function if exists public.dashboard_review_response(text, text, text, text);
drop function if exists public.dashboard_review_response(text, text, text);
drop function if exists public.dashboard_delete_response(text, text, text);
drop function if exists public.dashboard_delete_response(text, text);

create or replace function public.dashboard_review_response(
  p_session_token text,
  p_response_id text,
  p_status text
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
  v_previous_status text;
  v_next_id text;
  v_next_status text;
  v_next_updated_at timestamptz;
  v_status text := lower(trim(coalesce(p_status, '')));
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

  if nullif(trim(coalesce(p_response_id, '')), '') is null then
    raise exception 'Ficha obrigatoria.';
  end if;

  if v_status not in ('aprovado', 'reprovado') then
    raise exception 'Status de validacao invalido.';
  end if;

  select r.status::text
    into v_previous_status
  from public.mobile_respostas r
  where r.id::text = trim(p_response_id)
  for update;

  if not found then
    raise exception 'Ficha nao encontrada.';
  end if;

  update public.mobile_respostas r
  set
    status = v_status,
    updated_at = now()
  where r.id::text = trim(p_response_id)
  returning r.id::text, r.status::text, r.updated_at
    into v_next_id, v_next_status, v_next_updated_at;

  insert into public.dashboard_audit_events (
    actor_matricula,
    actor_nome,
    action,
    target_table,
    target_id,
    previous_value,
    next_value
  ) values (
    v_actor.matricula,
    v_actor.nome,
    'review_response',
    'mobile_respostas',
    v_next_id,
    jsonb_build_object('status', v_previous_status),
    jsonb_build_object('status', v_next_status)
  );

  return query select v_next_id, v_next_status, v_next_updated_at;
end;
$$;

create or replace function public.dashboard_delete_response(
  p_session_token text,
  p_response_id text
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
  v_previous_status text;
  v_next_id text;
  v_next_status text;
  v_next_updated_at timestamptz;
begin
  select
    actor.matricula,
    actor.nome,
    actor.departamento,
    actor.cargo,
    actor.gestor,
    actor.status
    into v_actor
  from public.dashboard_authorized_actor(p_session_token, 'delete_response') actor;

  if not found then
    raise exception 'Sessao expirada, invalida ou sem permissao.';
  end if;

  if nullif(trim(coalesce(p_response_id, '')), '') is null then
    raise exception 'Ficha obrigatoria.';
  end if;

  select r.status::text
    into v_previous_status
  from public.mobile_respostas r
  where r.id::text = trim(p_response_id)
  for update;

  if not found then
    raise exception 'Ficha nao encontrada.';
  end if;

  update public.mobile_respostas r
  set
    status = 'excluido',
    updated_at = now()
  where r.id::text = trim(p_response_id)
  returning r.id::text, r.status::text, r.updated_at
    into v_next_id, v_next_status, v_next_updated_at;

  insert into public.dashboard_audit_events (
    actor_matricula,
    actor_nome,
    action,
    target_table,
    target_id,
    previous_value,
    next_value
  ) values (
    v_actor.matricula,
    v_actor.nome,
    'delete_response',
    'mobile_respostas',
    v_next_id,
    jsonb_build_object('status', v_previous_status),
    jsonb_build_object('status', v_next_status)
  );

  return query select v_next_id, v_next_status, v_next_updated_at;
end;
$$;

revoke all on function public.dashboard_review_response(text, text, text) from public;
revoke all on function public.dashboard_delete_response(text, text) from public;

grant execute on function public.dashboard_review_response(text, text, text) to anon, authenticated;
grant execute on function public.dashboard_delete_response(text, text) to anon, authenticated;

comment on function public.dashboard_review_response(text, text, text) is
  'Reviews a mobile response after validating a dashboard session and writes an audit event in one database transaction.';

comment on function public.dashboard_delete_response(text, text) is
  'Marks a mobile response as excluded after validating a dashboard session and writes an audit event in one database transaction.';

-- RLS should be finalized together with Supabase Auth or Edge Functions.
-- Do not enable RLS on existing operational tables in production before policies are tested in staging.
