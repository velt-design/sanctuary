-- Enquiry attachment URLs are issued only by the audited staff API route.
-- The route verifies the staff session and project relationship with an
-- auth-bound client, then uses a server-owned client to sign the private object.
drop policy if exists enquiry_attachments_staff_signed_read on storage.objects;
