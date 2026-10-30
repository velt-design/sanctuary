-- Distinct RPC makes required-address admission fail closed before this migration.
-- The original commercial/snapshot commit owner and the prior local wrapper remain unchanged.
create function public.studio_website_quote_commit_address(p_operation text,p_snapshot_id uuid,p_content_hash text,p_command jsonb)
returns public.quote_versions language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
 s private.studio_website_quote_snapshots%rowtype;
 q public.quote_versions%rowtype;
 already_committed boolean:=false;
 destination text;
 current_destination text;
 v_quote_id uuid;
 context jsonb;
 proof jsonb;
begin
 if p_operation is null or p_operation not in ('create','refresh','revise') or jsonb_typeof(p_command) is distinct from 'object' then raise exception 'studio_quote_command_invalid'; end if;
 select * into s from private.studio_website_quote_snapshots where id=p_snapshot_id and content_hash=p_content_hash;
 if not found then raise exception 'studio_snapshot_unavailable'; end if;
 if p_operation<>'refresh' then
  v_quote_id:=(p_command->>'p_quote_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended('commercial-quote:'||v_quote_id::text,0));
  select exists(select 1 from public.quote_versions where quote_id=v_quote_id and client_intent_id=trim(p_command->>'p_client_intent_id')) into already_committed;
 end if;
 -- Existing intent binding/source conflicts and frozen revise are still owned by the predecessor.
 q:=public.studio_website_quote_commit(p_operation,p_snapshot_id,p_content_hash,p_command);
 if p_operation<>'revise' and not already_committed then
  proof:=s.authored#>'{site,values,siteAddressProof}';
  context:=s.customer_view->'travelContext';
  if jsonb_typeof(proof) is distinct from 'object' or jsonb_typeof(context) is distinct from 'object' then raise exception 'studio_site_address_required' using errcode='PT409'; end if;
  destination:=context->>'destinationCanonical';
  if proof->>'schemaVersion' is distinct from 'studio_selected_address.v1'
   or proof->>'projectId' is distinct from 'proj_'||s.project_id::text
   or jsonb_typeof(proof->'destinationCanonical') is distinct from 'string'
   or proof->>'destinationCanonical' is distinct from destination
   or coalesce(proof->>'placeId','') !~ '^[A-Za-z0-9_-]{1,255}$'
   or coalesce(proof->>'proof','') !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(proof->'issuedAt') is distinct from 'number'
   or (select count(*) from jsonb_object_keys(proof))<>6
   or context->>'schemaVersion' is distinct from 'studio_quote_travel.v1'
   or jsonb_typeof(context->'destinationCanonical') is distinct from 'string'
   or destination is null or length(trim(destination))=0 or length(destination)>280
   or (select count(*) from jsonb_object_keys(context))<>2 then raise exception 'studio_site_address_invalid' using errcode='PT409'; end if;
  if s.authored#>>'{site,values,travelAllowance,mode}'='pending' then raise exception 'studio_travel_calculation_required' using errcode='PT409'; end if;
  if s.authored#>>'{site,values,travelAllowance,mode}'='automatic' and destination is distinct from s.authored#>>'{site,values,travelAllowance,receipt,destinationCanonical}' then raise exception 'studio_travel_destination_invalid' using errcode='PT409'; end if;
  -- Server preparation verifies HMAC; immutable snapshot binds it. No DB signing secret.
  -- FOR SHARE conflicts with ordinary site_address UPDATE and holds through commit.
  select site_address into current_destination from public.projects where id=s.project_id for share;
  if not found or current_destination is distinct from destination then raise exception 'studio_site_address_changed' using errcode='PT409'; end if;
 end if;
 return q;
end $$;
revoke all on function public.studio_website_quote_commit_address(text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.studio_website_quote_commit_address(text,uuid,text,jsonb) to service_role;
