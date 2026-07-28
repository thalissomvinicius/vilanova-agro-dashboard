-- Gives the bounded CQO read endpoints enough room for cold-cache and
-- concurrent dashboard loads. Client-side pagination and concurrency limits
-- remain the primary protection against oversized requests.

alter function public.dashboard_cqo_response_page(text, integer, integer)
  set statement_timeout = '15s';

alter function public.dashboard_cqo_dataset_part(text, text)
  set statement_timeout = '15s';

comment on function public.dashboard_cqo_response_page(text, integer, integer) is
  'Returns a bounded CQO response page with a dedicated timeout for resilient dashboard startup.';

comment on function public.dashboard_cqo_dataset_part(text, text) is
  'Returns one bounded CQO dataset segment with a dedicated timeout for resilient dashboard startup.';
