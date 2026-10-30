-- Preserve frozen design identity through generic commercial edits.
-- Deferred check runs after line insertion and binding in the same transaction.
create or replace function private.studio_quote_binding_required() returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare current_quote public.quote_versions%rowtype; binding private.studio_website_quote_snapshots%rowtype; marked boolean;
begin
 select * into current_quote from public.quote_versions where id=new.id;
 if not found then return null; end if;
 select s.* into binding from private.studio_website_quote_bindings b join private.studio_website_quote_snapshots s on s.id=b.snapshot_id where b.quote_version_id=current_quote.id;
 select coalesce(outputs ? 'studio_authored',false) into marked from public.estimates where id=current_quote.source_estimate_version_id;
 if marked and binding.id is null then raise exception 'studio_quote_binding_required'; end if;
 if binding.id is not null and (binding.estimate_id is distinct from current_quote.source_estimate_version_id
  or binding.project_id is distinct from (select project_id from public.quotes where id=current_quote.quote_id)
  or binding.commercial_scope_id is distinct from (select commercial_scope_id from public.quotes where id=current_quote.quote_id)
  or current_quote.pricing_source_metadata->>'studioSnapshotId' is distinct from binding.id::text
  or current_quote.pricing_source_metadata->>'studioSnapshotHash' is distinct from binding.content_hash) then raise exception 'studio_quote_binding_mismatch'; end if;
 return null;
end $$;
revoke all on function private.studio_quote_binding_required() from public,anon,authenticated,service_role;
drop trigger studio_quote_binding_required on public.quote_versions;
create constraint trigger studio_quote_binding_required after insert or update of source_estimate_version_id,pricing_source,pricing_source_metadata,quote_id on public.quote_versions
 deferrable initially deferred for each row execute function private.studio_quote_binding_required();
notify pgrst,'reload schema';
