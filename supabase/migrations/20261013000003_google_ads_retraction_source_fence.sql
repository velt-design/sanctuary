-- Forward-only correction: a claimed retraction must still match current source
-- facts immediately before the irreversible provider request, just like ingestion.
-- Keep the installed RPC, grants, authority/canary fences and frozen receipts intact.
do $$
declare
  definition text := pg_get_functiondef('public.google_ads_command(uuid,text,text,uuid,jsonb)'::regprocedure);
  old_clause text := 'if s.state=''SENDING'' then';
  new_clause text := 'if s.state in(''SENDING'',''RETRACTING'') then';
begin
  if (length(definition)-length(replace(definition,old_clause,'')))/length(old_clause)<>1
    or strpos(definition,new_clause)>0 then
    raise exception 'Unexpected Google command baseline; reconcile before applying source fence' using errcode='55000';
  end if;
  execute replace(definition,old_clause,new_clause);
end $$;
