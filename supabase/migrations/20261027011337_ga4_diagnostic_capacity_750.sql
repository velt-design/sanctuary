-- Change only the acquisition cardinality accepted by the existing validator.
-- Completion/read, byte bounds, privileges and all existing data stay intact.
-- The migration runner owns the surrounding schema/history transaction.
do $capacity$
declare
 target oid := to_regprocedure('private.sanctuary_ga4_diagnostics_valid(jsonb,jsonb)');
 before_catalog jsonb;
 after_catalog jsonb;
 definition text;
begin
 perform pg_catalog.set_config('lock_timeout', '5s', true);
 if target is null then raise exception 'GA4 diagnostics validator missing'; end if;
 select to_jsonb(p) into before_catalog from pg_proc p where oid = target;
 if encode(sha256(convert_to(replace(before_catalog->>'prosrc', E'\r\n', E'\n'), 'UTF8')), 'hex')
   <> 'dcb43438a145572faf0e6e7d5be820973ab22904bf97126eeca6111fa8c0bb6b'
 then raise exception 'Unreviewed GA4 diagnostics validator'; end if;
 definition := pg_get_functiondef(target);
 execute replace(definition, 'jsonb_array_length(a->''rows'')>200', 'jsonb_array_length(a->''rows'')>750');
 select to_jsonb(p) into after_catalog from pg_proc p where oid = target;
 if before_catalog - 'prosrc' is distinct from after_catalog - 'prosrc'
   or encode(sha256(convert_to(replace(after_catalog->>'prosrc', E'\r\n', E'\n'), 'UTF8')), 'hex')
     <> '5350b2b90bf450340d801a6c9a20c858e375caa12728102d477eeae1d46fa86b'
 then raise exception 'Unexpected GA4 capacity change'; end if;
end $capacity$;
