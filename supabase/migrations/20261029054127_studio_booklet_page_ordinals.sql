-- Align durable checkpoint ordinals with the immutable v3 manifest maximum.
-- studio_client_document_page_stage retains its per-job 0..total_pages-1 fence.
alter table private.studio_client_document_pages
  drop constraint studio_client_document_pages_page_index_check;
alter table private.studio_client_document_pages
  add constraint studio_client_document_pages_page_index_check
  check (page_index between 0 and 192);
