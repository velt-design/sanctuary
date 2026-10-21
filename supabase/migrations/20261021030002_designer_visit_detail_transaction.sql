-- The existing actor check locks user/access rows FOR SHARE. PostgREST executes
-- POST calls to STABLE functions in a read-only transaction, which rejects that
-- lock (25006). Match the canonical agenda reader's VOLATILE transaction mode.
-- This changes no function body, grants, authentication checks or business data.
alter function public.outlook_site_visit_detail_read(uuid,uuid) volatile;
