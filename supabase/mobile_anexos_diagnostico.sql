-- Diagnostico somente leitura do fluxo de fotos APP -> Storage -> dashboard.
-- Pode ser executado no SQL Editor do Supabase sem alterar dados.

select
  count(*) as anexos_metadata,
  count(*) filter (where nullif(storage_path, '') is not null) as com_caminho_storage,
  count(*) filter (where nullif(thumbnail_storage_path, '') is not null) as com_miniatura,
  count(*) filter (where otimizado is true) as otimizados,
  round(coalesce(sum(tamanho_bytes), 0) / 1024.0 / 1024.0, 2) as tamanho_registrado_mb,
  round(coalesce(avg(tamanho_bytes) filter (where tamanho_bytes > 0), 0) / 1024.0, 1) as media_registrada_kb
from public.mobile_anexos;

select
  date_trunc('day', criado_em)::date as dia,
  count(*) as anexos,
  count(*) filter (where nullif(thumbnail_storage_path, '') is not null) as miniaturas,
  count(*) filter (where otimizado is true) as otimizados,
  round(coalesce(sum(tamanho_bytes), 0) / 1024.0 / 1024.0, 2) as tamanho_mb
from public.mobile_anexos
group by 1
order by 1 desc;

select
  a.resposta_id,
  a.campo_id,
  a.storage_path,
  a.tamanho_bytes,
  a.thumbnail_storage_path,
  a.otimizado,
  case when o.name is null then 'ARQUIVO AUSENTE' else 'OK' end as storage_status
from public.mobile_anexos a
left join storage.objects o
  on o.bucket_id = 'mobile-anexos'
 and o.name = a.storage_path
where nullif(a.storage_path, '') is not null
order by a.criado_em desc;
