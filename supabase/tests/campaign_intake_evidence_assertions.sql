begin;
create function pg_temp.intake_read() returns jsonb language sql as $$
 select public.sanctuary_campaign_outcomes('a0000000-0000-4000-8000-000000000001','synthetic','binding','source',null,'test',null)#>'{correspondence,contacts,0,intake}'
$$;
insert into public.enquiry_requests(id,enquiry_type,suburb,message,page,raw_payload)
values('a2000000-0000-4000-8000-000000000001','residential','Auckland','Pergola for our home.','/acrylic-roof-pergolas-auckland',
 '{"suburb":"Auckland","message":"Pergola for our home.","enquiryType":"residential","customerDesign":{"seeded":true}}');
insert into private.intake_evidence_fixture values('{"correspondence":{"contacts":[{"enquiryId":"a2000000-0000-4000-8000-000000000001","key":"opaque-fixture"}]}}');
do $$begin
 if pg_temp.intake_read() is distinct from '{"provenance":"meta_form_user_text","suburb":"Auckland","message":"Pergola for our home.","shortened":false}'::jsonb then raise exception 'Explicit intake not retained';end if;
 update enquiry_requests set raw_payload=raw_payload||'{"suburb":"Changed"}';
 if pg_temp.intake_read()<>'null'::jsonb then raise exception 'Mismatched raw/canonical accepted';end if;
 update enquiry_requests set suburb='',message='',raw_payload='{"suburb":"","message":"","enquiryType":"residential","customerDesign":{"seeded":true}}';
 if pg_temp.intake_read()->>'message'<>'' or pg_temp.intake_read() ? 'customerDesign' or pg_temp.intake_read() ? 'enquiryType' then raise exception 'Hidden defaults leaked';end if;
 update enquiry_requests set page='/not-allowed';
 if pg_temp.intake_read()<>'null'::jsonb then raise exception 'Wrong route accepted';end if;
 update enquiry_requests set page='/contact',raw_payload=raw_payload||'{"enquiryContext":{"sourcePath":"/auckland-outdoor-living"}}';
 if pg_temp.intake_read() is null or pg_temp.intake_read()='null'::jsonb then raise exception 'Canonical designer return lost';end if;
 begin perform public.sanctuary_campaign_outcomes(null,'synthetic','binding','source',null,'test',null);raise exception 'Source denial bypassed';exception when raise_exception then if sqlerrm<>'Denied source' then raise;end if;end;
 if has_function_privilege('anon','public.sanctuary_campaign_outcomes(uuid,text,text,text,uuid,text,uuid)','execute') or has_function_privilege('service_role','public.sanctuary_campaign_outcomes_without_intake(uuid,text,text,text,uuid,text,uuid)','execute') then raise exception 'Source privilege widened';end if;
end $$;
rollback;
