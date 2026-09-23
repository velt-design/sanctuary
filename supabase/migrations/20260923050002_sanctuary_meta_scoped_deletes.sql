begin;
-- PostgREST loads safeupdate. Keep that guard and explicitly target the one
-- permitted snapshot row; do not rewrite the already-applied pilot migration.
do $migration$
declare target oid; source text; definition text; before_catalog jsonb; item record;
 old_delete constant text := 'delete from private.sanctuary_meta_snapshot;';
 new_delete constant text := 'delete from private.sanctuary_meta_snapshot where singleton=true;';
begin
 for item in select * from (values
  ('public.sanctuary_meta_command(uuid,text,text,text,uuid,text,text,uuid,text,text,text)', '6a794fb36e344d21e3a641a477b04c31', 3),
  ('private.sanctuary_meta_changed()', 'cc62b3c634a9a2b143af2642b95060cf', 1)
 ) as expected(signature, body_hash, delete_count) loop
  target:=to_regprocedure(item.signature);
  select replace(p.prosrc,chr(13),''),pg_get_functiondef(p.oid),to_jsonb(p)
   into source,definition,before_catalog from pg_proc p where p.oid=target;
  if target is null or md5(source) is distinct from item.body_hash
   or before_catalog->>'prosecdef' is distinct from 'true'
   or (length(source)-length(replace(source,old_delete,'')))/length(old_delete)<>item.delete_count
  then raise exception 'Unknown Meta source function; refuse scoped-delete patch';end if;
  execute replace(definition,old_delete,new_delete);
  if (select to_jsonb(p)-'prosrc' from pg_proc p where p.oid=target) is distinct from before_catalog-'prosrc'
   or (select replace(p.prosrc,chr(13),'') from pg_proc p where p.oid=target) is distinct from replace(source,old_delete,new_delete)
  then raise exception 'Meta function contract changed';end if;
 end loop;
end $migration$;
commit;
