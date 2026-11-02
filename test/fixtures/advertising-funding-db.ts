import {initialiseRevisedQuoteDatabase} from '../support/revisedQuoteDatabase';
import {paymentSql,preparePaymentConversionAnalytics,paymentConversionMigration,type PaymentDatabase} from './verified-payment-conversion-db';
export const advertisingFundingMigration='migrations/20261102000002_advertising_reconciled_funding.sql';
export const advertisingActor='90000000-0000-4000-8000-000000000001';
export const advertisingBinding='a'.repeat(64);
/** Full current finance commands; explicit synthetic auth/reporting prerequisites. */
export async function prepareAdvertisingFunding(db:PaymentDatabase,install=true) {
 await initialiseRevisedQuoteDatabase(db);await preparePaymentConversionAnalytics(db);
 await db.exec(paymentSql(paymentConversionMigration));
 await db.exec(`alter table auth.users add column email text,add column email_confirmed_at timestamptz,add column deleted_at timestamptz,add column banned_until timestamptz;
  alter table contacts add column phone text;
  create table portal_users(user_id uuid,role text);
  insert into auth.users(id,email,email_confirmed_at) values('${advertisingActor}','jordan@sanctuarypergolas.co.nz',now());
  insert into portal_users values('${advertisingActor}','admin');
  create schema praxis_reporting;create schema cron;
  create function cron.schedule(text,text,text) returns integer language sql as 'select 1';
  create table praxis_reporting.source_identity_v1(singleton boolean,source_key text,connection_id uuid,environment text);`);
 for(const file of ['20260923050001_sanctuary_meta_reporting.sql',
  '20261013000001_google_ads_source.sql','20261013000002_google_ads_commands.sql','20261013000003_google_ads_retraction_source_fence.sql',
  '20261013000005_google_ads_current_generation_health.sql','20261014000001_advertising_scope_source.sql','20261014000002_meta_sale_source.sql',
  '20261014000003_meta_sale_commands.sql','20261014000004_google_ads_disclosure_compatibility.sql','20261014000005_meta_credential_renewal.sql']) await db.exec(paymentSql(`migrations/${file}`));
 // Install the actual current test-filter patch, not a parallel fixture policy.
 const policy=paymentSql('migrations/20261027024135_marketing_enquiry_sales_evidence.sql');
 await db.exec(policy.slice(policy.indexOf('do $advertising$'),policy.indexOf('-- Recheck current confirmed-project')));
 if(install)await db.exec(paymentSql(advertisingFundingMigration));
}
