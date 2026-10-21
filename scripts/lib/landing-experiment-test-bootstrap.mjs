import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {marketingEnquiryTestIntakeSql} from './marketing-enquiry-test-intake.mjs';
export function landingExperimentTestBootstrap(root){
 const read=path=>readFileSync(join(root,path),'utf8');
 return `create role anon;create role authenticated;create role service_role;create table projects(id uuid primary key);\n`
  +read('supabase/tests/marketing_enquiry_delivery_bootstrap.sql')
  +read('supabase/enquiry_requests.sql').replace('create extension if not exists pgcrypto;','')
  +marketingEnquiryTestIntakeSql(root)
  +read('supabase/migrations/20261021000001_marketing_outdoor_room_optional_phone.sql')
  +read('supabase/migrations/20261021020001_marketing_blinds_optional_phone.sql')
  +`create schema private;create table private.enquiry_qualification_events(enquiry_id uuid,state text,version int);`;
}
