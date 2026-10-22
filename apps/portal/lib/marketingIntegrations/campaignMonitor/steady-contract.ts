import { z } from 'zod';

const id = z.string().regex(/^[1-9]\d{0,19}$/), stamp = z.iso.datetime({ offset: true });
/** Owned steady serving is separate from the immutable two experimental arms. */
export const steadyAdSchema = z.object({
  kind: z.literal('steady'), experiment: z.uuid(), id, creative: id, donor: id,
  account: id, campaign: id, adset: id, page: id,
  path: z.enum(['/auckland-outdoor-living', '/acrylic-roof-pergolas-auckland']),
  template: z.string().regex(/^[a-f0-9]{64}$/), current: z.boolean(),
  state: z.enum(['paused', 'active', 'uncertain']), observedAt: stamp,
  intervals: z.array(z.object({ start: stamp, end: stamp.nullable() }).strict()).max(40),
}).strict().superRefine((row, context) => {
  const observed = Date.parse(row.observedAt);
  if (row.intervals.some((v, i) => Date.parse(v.start) > observed || (v.end !== null && (Date.parse(v.end) < Date.parse(v.start) || Date.parse(v.end) > observed))
    || (i > 0 && (row.intervals[i - 1]!.end === null || Date.parse(row.intervals[i - 1]!.end!) > Date.parse(v.start)))
    || (v.end === null && (i !== row.intervals.length - 1 || row.state !== 'active')))) {
    context.addIssue({ code: 'custom', message: 'Steady serving intervals differ' });
  }
});
export type SteadyAd = z.infer<typeof steadyAdSchema>;
