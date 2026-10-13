-- Completed outcomes describe the current configuration. Keep historical audit
-- rows, all-generation pending work and credential quarantine untouched.
do $$
declare
  definition text := pg_get_functiondef('public.google_ads_staff_read()'::regprocedure);
  old_clause text := 'where d.lane=lanes.lane and d.finished_at is not null';
  new_clause text := 'where d.lane=lanes.lane and d.generation=c.generation and d.finished_at is not null';
begin
  if (length(definition)-length(replace(definition,old_clause,'')))/length(old_clause)<>1
    or strpos(definition,new_clause)>0 then
    raise exception 'Unexpected Google health baseline; reconcile before applying generation filter' using errcode='55000';
  end if;
  execute replace(definition,old_clause,new_clause);
end $$;
