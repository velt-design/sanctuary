import { z } from 'zod';

export const STAFF_CORRESPONDENCE_VERSION = 'sanctuary.staff-correspondence.v1';
export const STAFF_CORRESPONDENCE_PATH = '/api/customer-journey/staff-summary';
export const CORRESPONDENCE_MAX_AGE_MS = 120_000;

export function correspondenceSourceHref(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const outlook = ['outlook.office.com', 'outlook.office365.com', 'outlook.cloud.microsoft', 'outlook.live.com'];
    if (outlook.includes(url.hostname)) return url.href;
    if (url.hostname === 'portal.sanctuarypergolas.co.nz' && url.pathname.startsWith('/staff/projects/')) return url.href;
    return null;
  } catch { return null; }
}

const text = (max: number) => z.string().max(max);
const instant = z.iso.datetime({ offset: true });
const source = z.object({
  id: text(100).min(1), title: text(500), url: text(2048).refine(value => correspondenceSourceHref(value) !== null),
  observedAt: instant, recordedAt: instant,
  association: z.enum(['project', 'customer_address_only']), excerpted: z.boolean(),
}).strict();
const section = z.object({
  topic: z.enum(['agreement', 'job_status', 'next_action']),
  kind: z.enum(['recorded', 'interpretation', 'recommendation', 'unknown']),
  answer: text(900), caveat: text(500),
  citations: z.array(z.object({ sourceId: text(100), quote: text(2000).min(1) }).strict()).max(12),
}).strict();

// Validates transport; Velt owns exact excerpt validation and synthesis.
export const correspondenceContextSchema = z.object({
  observedAt: instant,
  answer: z.object({ sections: z.array(section).length(3) }).strict(),
  sources: z.array(source).max(100), limitations: z.array(text(1000)).max(40),
}).strict().superRefine((value, ctx) => {
  const ids = new Set(value.sources.map(item => item.id));
  if (ids.size !== value.sources.length || new Set(value.answer.sections.map(item => item.topic)).size !== 3) {
    ctx.addIssue({ code: 'custom', message: 'Duplicate correspondence evidence.' });
  }
  for (const item of value.answer.sections) {
    if ((item.kind !== 'unknown' && item.citations.length === 0) || item.citations.some(citation => !ids.has(citation.sourceId))) {
      ctx.addIssue({ code: 'custom', message: 'Missing correspondence evidence.' });
    }
  }
});
export type ProjectCorrespondenceContext = z.infer<typeof correspondenceContextSchema>;

export function parseStaffCorrespondence(value: unknown, projectId: string, requestId: string, now: number): ProjectCorrespondenceContext {
  const result = z.object({
    schemaVersion: z.literal(STAFF_CORRESPONDENCE_VERSION), projectId: z.uuid(), requestId: z.uuid(),
    context: correspondenceContextSchema,
  }).strict().parse(value);
  if (result.projectId !== projectId || result.requestId !== requestId) throw new Error('Correspondence binding mismatch.');
  const dates = [result.context.observedAt, ...result.context.sources.map(item => item.observedAt)];
  if (dates.some(date => now - Date.parse(date) > CORRESPONDENCE_MAX_AGE_MS || Date.parse(date) - now > 5000)) {
    throw new Error('Correspondence evidence is not current.');
  }
  return result.context;
}
