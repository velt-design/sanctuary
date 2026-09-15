-- A stale owner version is an application conflict, not a transient database
-- serialization failure. PT409 returns HTTP 409 through PostgREST without
-- inviting infrastructure retries of an immutable expected version.
do $patch$
declare
  definition text;
  old_clause text := 'raise exception ''owner assignment changed'' using errcode = ''40001'';';
  new_clause text := 'raise exception ''owner assignment changed'' using errcode = ''PT409'';';
  occurrences integer;
begin
  definition := pg_get_functiondef('public.project_command_set_owner(uuid,text,uuid,timestamptz)'::regprocedure);
  occurrences := (length(definition) - length(replace(definition, old_clause, ''))) / length(old_clause);
  if occurrences = 0 and strpos(definition, new_clause) > 0 then
    return;
  end if;
  if occurrences <> 2 then
    raise exception 'Owner conflict implementation changed; review migration';
  end if;
  execute replace(definition, old_clause, new_clause);
end;
$patch$;

notify pgrst, 'reload schema';
