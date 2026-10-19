import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';

export function outlookCalendarConfig() {
  const required=(name:string)=>{const value=process.env[name]?.trim();if(!value)throw new Error('CALENDAR_NOT_CONFIGURED');return value;};
  if(process.env.SANCTUARY_OUTLOOK_ENABLED!=='true')throw new Error('CALENDAR_DISABLED');
  const tenantId=z.uuid().parse(required('SANCTUARY_OUTLOOK_TENANT_ID'));
  const clientId=z.uuid().parse(required('SANCTUARY_OUTLOOK_CLIENT_ID'));
  const mailbox=z.email().parse(required('SANCTUARY_OUTLOOK_MAILBOX')).toLowerCase();
  const mailboxId=z.uuid().parse(required('SANCTUARY_OUTLOOK_MAILBOX_ID'));
  const calendarId=z.string().min(1).max(1200).parse(required('SANCTUARY_OUTLOOK_CALENDAR_ID'));
  const staffEmails=[...new Set(required('SANCTUARY_OUTLOOK_STAFF_EMAILS').split(',').map(email=>z.email().parse(email.trim()).toLowerCase()))].sort();
  const origin=outlookPortalOrigin();
  const binding=createHash('sha256').update(JSON.stringify({tenantId,clientId,mailboxId,mailbox,calendarId,staffEmails})).digest('hex');
  return {tenantId,clientId,mailboxId,mailbox,calendarId,staffEmails:new Set(staffEmails),binding,origin};
}
export function outlookPortalOrigin() {
  const origin=new URL(process.env.SANCTUARY_OUTLOOK_PORTAL_ORIGIN??'');
  const local=process.env.NODE_ENV!=='production'&&['localhost','127.0.0.1'].includes(origin.hostname);
  if((origin.protocol!=='https:'&&!(local&&origin.protocol==='http:'))||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)throw new Error('CALENDAR_INVALID_ORIGIN');
  return origin.origin;
}
export type OutlookCalendarConfig = ReturnType<typeof outlookCalendarConfig>;
