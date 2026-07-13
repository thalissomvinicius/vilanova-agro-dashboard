-- Habilita miniaturas e metadados leves das fotos enviadas pelo app.
-- Rode no SQL Editor do Supabase. Nao apaga dados existentes.

alter table public.mobile_anexos
  add column if not exists thumbnail_storage_path text,
  add column if not exists thumbnail_tamanho_bytes bigint,
  add column if not exists original_tamanho_bytes bigint,
  add column if not exists otimizado boolean not null default false;

comment on column public.mobile_anexos.thumbnail_storage_path is
  'Caminho da miniatura leve no bucket mobile-anexos, usada pelo dashboard para preview.';

comment on column public.mobile_anexos.thumbnail_tamanho_bytes is
  'Tamanho aproximado da miniatura em bytes.';

comment on column public.mobile_anexos.original_tamanho_bytes is
  'Tamanho aproximado do arquivo local original antes da otimizacao.';

comment on column public.mobile_anexos.otimizado is
  'Indica se a foto foi otimizada/comprimida pelo app antes do envio.';
