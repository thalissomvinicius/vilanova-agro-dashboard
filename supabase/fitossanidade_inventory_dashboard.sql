-- Execute depois de docs/SUPABASE_FITOSSANIDADE_SCHEMA.sql do aplicativo.
-- Disponibiliza somente os dados necessarios ao dashboard autenticado.

create or replace function public.dashboard_fitossanidade_inventory_dataset(
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor record;
  v_records jsonb := '[]'::jsonb;
  v_attachments jsonb := '[]'::jsonb;
begin
  select actor.*
    into v_actor
  from public.dashboard_session_profile(p_session_token) actor
  limit 1;

  if not found then
    raise exception 'Sessao expirada ou invalida.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.criado_em desc), '[]'::jsonb)
    into v_records
  from (
    select
      r.id,
      r.formulario_id,
      r.formulario_versao,
      r.usuario_id,
      r.status,
      r.origem,
      r.criado_em,
      r.enviado_em,
      r.recebido_em,
      r.atualizado_em,
      r.dados_json
    from public.fitossanidade_respostas r
    where r.formulario_id = 'form_fitossanidade_inventario'
      and coalesce(r.status, '') <> 'excluido'
    order by r.criado_em desc
    limit 3000
  ) row_data;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.criado_em asc), '[]'::jsonb)
    into v_attachments
  from (
    select
      a.id,
      a.resposta_id,
      a.campo_id,
      a.storage_path,
      a.thumbnail_storage_path,
      a.nome_arquivo,
      a.tamanho_bytes,
      a.tipo_mime,
      a.criado_em
    from public.fitossanidade_anexos a
    join public.fitossanidade_respostas r on r.id = a.resposta_id
    where r.formulario_id = 'form_fitossanidade_inventario'
    order by a.criado_em asc
  ) row_data;

  return jsonb_build_object(
    'records', v_records,
    'attachments', v_attachments,
    'generated_at', now()
  );
end;
$$;

revoke all on function public.dashboard_fitossanidade_inventory_dataset(text) from public;
grant execute on function public.dashboard_fitossanidade_inventory_dataset(text) to anon, authenticated;

comment on function public.dashboard_fitossanidade_inventory_dataset(text) is
  'Inventarios de campo da Fitossanidade para sessoes autenticadas do dashboard.';
