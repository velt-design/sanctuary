-- Disposable test only. Existing source authorization is represented by a
-- deny-by-default base function; the migration must preserve its call boundary.
begin;
create table private.intake_evidence_fixture(result jsonb);
create function public.sanctuary_campaign_outcomes(uuid,text,text,text,uuid,text,uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if $1 is distinct from 'a0000000-0000-4000-8000-000000000001'::uuid then raise exception 'Denied source';end if;
 return (select result from private.intake_evidence_fixture);
end $$;
commit;
