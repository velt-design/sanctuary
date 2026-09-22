import type { EmailReviewCommand, EmailReviewImport, EmailReviewImportItem } from './contracts';

export class EmailReviewInputError extends Error { constructor() { super('Invalid email review request'); } }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(): never { throw new EmailReviewInputError(); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}
function keys(v: Record<string, unknown>, allowed: string[]) { if (Object.keys(v).some(k => !allowed.includes(k))) fail(); }
function str(value: unknown, max: number, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || value.includes('\u0000')) fail();
  return value;
}
export function reviewUuid(value: unknown): string { const s = str(value, 36); if (!UUID.test(s)) fail(); return s; }
function recipient(value: unknown) { const s = str(value, 254); if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(s)) fail(); return s; }
function subject(value: unknown) { const s = str(value, 300); if (/[\r\n]/.test(s)) fail(); return s; }
function item(value: unknown): EmailReviewImportItem {
  const v = record(value); keys(v, ['sourceId','projectId','to','subject','body','prerequisites','evidence','context','threads']);
  if (!Array.isArray(v.prerequisites) || v.prerequisites.length > 30 || !Array.isArray(v.evidence) || v.evidence.length > 30) fail();
  return { sourceId: str(v.sourceId, 200), projectId: reviewUuid(v.projectId), to: recipient(v.to), subject: subject(v.subject),
    body: str(v.body, 20000), context: str(v.context, 10000, true), prerequisites: v.prerequisites.map(x => str(x, 2000)),
    threads: v.threads === undefined ? [] : (() => { if (!Array.isArray(v.threads) || v.threads.length > 20) fail();
      const threads = v.threads.map(x => { const t=record(x); keys(t,['messageId','webLink','subject','matchedRecipient']);
        const webLink=str(t.webLink,4000); try { const u=new URL(webLink); if(u.protocol!=='https:' || u.username || u.password || !['outlook.office.com','outlook.office365.com'].includes(u.hostname)) fail(); } catch { fail(); }
        return {messageId:str(t.messageId,2000),webLink,subject:subject(t.subject),matchedRecipient:recipient(t.matchedRecipient)}; });
      if(new Set(threads.map(t=>t.messageId)).size!==threads.length) fail(); return threads; })(),
    evidence: v.evidence.map(x => { const e = record(x); keys(e, ['label','url']); const url = str(e.url, 4000);
      try { const u = new URL(url); if (u.protocol !== 'https:' || u.username || u.password) fail(); } catch { fail(); }
      return { label: str(e.label, 300), url }; }) };
}
export function parseReviewImport(value: unknown): EmailReviewImport {
  const v = record(value); keys(v, ['commandId','sourceKey','title','reviewerId','items']);
  if (!Array.isArray(v.items) || !v.items.length || v.items.length > 500) fail();
  const items = v.items.map(item); if (new Set(items.map(x => x.sourceId)).size !== items.length) fail();
  return { commandId: reviewUuid(v.commandId), sourceKey: str(v.sourceKey, 200), title: str(v.title, 300), reviewerId: reviewUuid(v.reviewerId), items };
}
export function parseReviewCommand(value: unknown): EmailReviewCommand {
  const v = record(value); keys(v, ['commandId','expectedRevision','action','to','subject','body','note','prerequisitesConfirmed','threadConfirmed','acknowledgeContextChange','expectedContextHash','threadMessageId']);
  if (!Number.isSafeInteger(v.expectedRevision) || (v.expectedRevision as number) < 1 || !['save','approve','skip','unapprove'].includes(String(v.action))) fail();
  const action = v.action as EmailReviewCommand['action'];
  if (action !== 'save' && ['to','subject','body','acknowledgeContextChange','threadMessageId'].some(k => k in v)) fail();
  if (action === 'save' && !['to','subject','body','threadMessageId'].some(k => k in v) && v.acknowledgeContextChange !== true) fail();
  if ('prerequisitesConfirmed' in v && typeof v.prerequisitesConfirmed !== 'boolean') fail();
  if ('acknowledgeContextChange' in v && typeof v.acknowledgeContextChange !== 'boolean') fail();
  if (action === 'skip' && (typeof v.note !== 'string' || !v.note.trim())) fail();
  if (action === 'approve' && (v.prerequisitesConfirmed !== true || v.threadConfirmed !== true)) fail();
  if (v.acknowledgeContextChange === true && (typeof v.expectedContextHash !== 'string' || !/^[a-f0-9]{64}$/.test(v.expectedContextHash))) fail();
  return { commandId: reviewUuid(v.commandId), expectedRevision: v.expectedRevision as number, action,
    ...('to' in v ? {to:recipient(v.to)} : {}), ...('subject' in v ? {subject:subject(v.subject)} : {}),
    ...('body' in v ? {body:str(v.body,20000)} : {}), ...('note' in v ? {note:str(v.note,2000,true)} : {}),
    ...(v.prerequisitesConfirmed !== undefined ? {prerequisitesConfirmed:v.prerequisitesConfirmed as boolean} : {}),
    ...(v.threadConfirmed !== undefined ? {threadConfirmed:v.threadConfirmed === true} : {}),
    ...('threadMessageId' in v ? {threadMessageId:v.threadMessageId === null ? null : str(v.threadMessageId,2000)} : {}),
    ...(v.acknowledgeContextChange !== undefined ? {acknowledgeContextChange:v.acknowledgeContextChange as boolean} : {}),
    ...(v.expectedContextHash !== undefined ? {expectedContextHash:str(v.expectedContextHash,64)} : {}) };
}
