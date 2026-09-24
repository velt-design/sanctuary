import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { metaReportSchema, validateMetaPeriod } from './report';

const available = z.object({ status: z.literal('available'), operation: z.uuid(), generation: z.number().int().positive(),
  payload: z.string().max(262144), resultHash: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: z.iso.datetime({ offset: true }) }).strict();

/** The integration consumer and staff reader verify the same retained evidence. */
export function parseMetaSnapshot(raw: unknown, now = new Date()) {
  const saved = available.parse(raw);
  if (Buffer.byteLength(saved.payload) > 262144 || createHash('sha256').update(saved.payload).digest('hex') !== saved.resultHash) throw new Error('Source integrity unavailable.');
  const report = metaReportSchema.parse(JSON.parse(saved.payload));
  validateMetaPeriod(report.period, new Date(report.fetchedAt), report.timezone);
  if (Date.parse(report.fetchedAt) > now.getTime() + 5000 || Date.parse(saved.expiresAt) <= now.getTime()
    || Date.parse(saved.expiresAt) !== Date.parse(report.fetchedAt) + 7 * 86400000) throw new Error('Source report expired.');
  return { saved, report };
}
