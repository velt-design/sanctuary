// Synthetic concurrency fixture, not proof of Project Work domain semantics.
export const ACTOR = '00000000-0000-4000-8000-000000000001';
export const PROJECT = '00000000-0000-4000-8000-000000000003';
export const COMMAND = '00000000-0000-4000-8000-000000000005';
export const HASH = 'a'.repeat(64);

export const bootstrap = `
create role anon; create role authenticated; create role service_role;
create schema auth; create schema private;
create table auth.users(id uuid primary key);
create table public.portal_users(user_id uuid primary key references auth.users,role text not null);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.projects(id uuid primary key,name text,pipeline_stage text,archived_at timestamptz);
create table public.project_operational_states(project_id uuid primary key references public.projects,
  state text,row_version bigint,closed_outcome text,closed_note text);
create table public.project_command_receipts(command_id uuid primary key);
create table private.core_calls(project_id uuid,command_id uuid,actor_user_id uuid);
create function private.project_operational_state_command_core(p_project uuid,p_command uuid,p_action text,p_payload jsonb,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_version bigint;
begin
  select row_version into v_version from public.project_operational_states where project_id=p_project for update;
  if v_version is distinct from (p_payload->>'expectedRowVersion')::bigint then
    raise exception 'synthetic stale state' using errcode='40001';
  end if;
  insert into private.core_calls values(p_project,p_command,p_actor);
  update public.project_operational_states set state='CLOSED',row_version=row_version+1,
    closed_outcome=p_payload->>'outcome',closed_note=p_payload->>'note' where project_id=p_project;
  insert into public.project_command_receipts values(p_command);
  if current_setting('synthetic.fail_core',true)='true' then
    raise exception 'synthetic failure after writes' using errcode='P0001';
  end if;
  return jsonb_build_object('project_id',p_project,'row_version',v_version+1,'replayed',false);
end $$;
revoke all on function private.project_operational_state_command_core(uuid,uuid,text,jsonb,uuid)
  from public,anon,authenticated,service_role;
insert into auth.users values('${ACTOR}');
insert into public.portal_users values('${ACTOR}','admin');
insert into public.projects values('${PROJECT}','Synthetic project','NEW',null);
insert into public.project_operational_states values('${PROJECT}','ACTIVE',1,null,null);
`;

export const reset = `
truncate private.portal_action_receipts,private.portal_action_approvals,private.portal_action_grants,
  private.core_calls,public.project_command_receipts;
update private.portal_action_installation set enabled=true,environment='staging';
update public.portal_users set role='admin';
update public.projects set pipeline_stage='NEW',archived_at=null;
update public.project_operational_states set state='ACTIVE',row_version=1,closed_outcome=null,closed_note=null;
set request.jwt.claim.sub='${ACTOR}';
set role authenticated;
select public.portal_action_grant_issue('${HASH}',jsonb_build_object(
  'version','portal_actions_v1','environment','staging','taskReference','synthetic concurrency',
  'label','Synthetic grant','expiresAt',clock_timestamp()+interval '2 hours',
  'projectIds',jsonb_build_array('${PROJECT}'), 'actions',jsonb_build_array(jsonb_build_object(
    'commandId','${COMMAND}','projectId','${PROJECT}','command','CLOSE','expectedRowVersion',1,
    'expiresAt',clock_timestamp()+interval '1 hour','outcome','LOST_NO_RESPONSE',
    'note','Synthetic approved closure','cancellationReason','Synthetic cancellation'))));
reset role;
`;
export const execute = `set role service_role;
select public.portal_action_execute('${HASH}','staging','${COMMAND}');`;
export const revoke = `set request.jwt.claim.sub='${ACTOR}';set role authenticated;
select public.portal_action_grant_revoke((current_setting('synthetic.grant_id'))::uuid);`;
export const evidence = `select jsonb_build_object(
  'calls',(select count(*) from private.core_calls),
  'receipts',(select count(*) from private.portal_action_receipts),
  'domainReceipts',(select count(*) from public.project_command_receipts),
  'state',(select state from public.project_operational_states where project_id='${PROJECT}'),
  'rowVersion',(select row_version from public.project_operational_states where project_id='${PROJECT}'));`;
