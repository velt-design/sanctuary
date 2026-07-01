-- Private storage bucket for professional enquiry attachments.
--
-- Files are uploaded client-side via short-lived signed upload URLs minted by
-- the marketing app (service role) and read back server-side to attach to the
-- enquiry autoresponder. The bucket is private with no anon/public policies:
-- access is service-role only, plus token-authorized signed upload/download
-- URLs. Per-file cap is 20 MB; the marketing app enforces the 8-file / 20 MB
-- total cap before minting upload URLs.

insert into storage.buckets (id, name, public, file_size_limit)
values ('enquiry-attachments', 'enquiry-attachments', false, 20971520)
on conflict (id) do nothing;
