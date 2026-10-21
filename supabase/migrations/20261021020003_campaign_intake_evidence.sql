begin;
-- Preserve the existing scoped source checks and canonical outcome calculation.
alter function public.sanctuary_campaign_outcomes(uuid,text,text,text,uuid,text,uuid) rename to sanctuary_campaign_outcomes_without_intake;
revoke all on function public.sanctuary_campaign_outcomes_without_intake(uuid,text,text,text,uuid,text,uuid) from public,anon,authenticated,service_role;
create function public.sanctuary_campaign_outcomes(p_actor uuid,p_account text,p_binding text,p_source text,p_connection uuid,p_environment text,p_operation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; contacts jsonb;
begin
 result:=public.sanctuary_campaign_outcomes_without_intake(p_actor,p_account,p_binding,p_source,p_connection,p_environment,p_operation);
 select coalesce(jsonb_agg(contact||jsonb_build_object('intake',
   case when (e.page in('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland') or e.page='/contact' and e.raw_payload#>>'{enquiryContext,sourcePath}' in('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland'))
     and jsonb_typeof(e.raw_payload->'suburb')='string' and e.raw_payload->>'suburb'=coalesce(e.suburb,'')
     and jsonb_typeof(e.raw_payload->'message')='string' and e.raw_payload->>'message'=coalesce(e.message,'')
   then jsonb_build_object('provenance','meta_form_user_text','suburb',left(coalesce(e.suburb,''),100),'message',left(coalesce(e.message,''),400),
     'shortened',length(coalesce(e.suburb,''))>100 or length(coalesce(e.message,''))>400)
   else null end) order by ordinal),'[]') into contacts
 from jsonb_array_elements(result#>'{correspondence,contacts}') with ordinality input(contact,ordinal)
 left join public.enquiry_requests e on e.id=(contact->>'enquiryId')::uuid;
 return jsonb_set(result,'{correspondence,contacts}',contacts);
end $$;
revoke all on function public.sanctuary_campaign_outcomes(uuid,text,text,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.sanctuary_campaign_outcomes(uuid,text,text,text,uuid,text,uuid) to service_role;
commit;
