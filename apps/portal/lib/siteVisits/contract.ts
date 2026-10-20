import { z } from 'zod';

const visitKind = z.enum(['visit', 'provisional', 'review', 'excluded']);
export type VisitKind = z.infer<typeof visitKind>;
export type CalendarVisit = {
  id: string; revision: number; sourceKey: string; subject: string; startsAt: string; endsAt: string;
  isAllDay: boolean; allDayStartDate: string|null; allDayEndDate: string|null;
  sourceUrl: string | null; address: string | null; staff: Array<{ name: string; email: string }>;
  assignmentHint: string | null; kind: VisitKind; sourceKind: VisitKind; cancelled: boolean; removed: boolean;
  duplicate: boolean; reviewReasons: string[]; projectId: string | null; projectName: string | null;
  contactName: string | null; phone: string | null; linkMode: 'auto' | 'manual'; kindOverride:VisitKind|null;
};
export type VisitSnapshot = {
  enabled: boolean; lastSuccess: string | null; lastAttempt: string | null; error: string | null;
  rangeStart: string | null; rangeEnd: string | null; syncing: boolean; events: CalendarVisit[];
};
export const mirrorEventSchema = z.object({
  sourceKey: z.string().min(1).max(1200), sourceId: z.string().min(1).max(1200),
  subject: z.string().max(500), startsAt: z.iso.datetime(), endsAt: z.iso.datetime(),
  isAllDay:z.boolean(), allDayStartDate:z.iso.date().nullable(), allDayEndDate:z.iso.date().nullable(),
  sourceUrl: z.string().max(3000).nullable(), address: z.string().max(500).nullable(),
  staff: z.array(z.object({name:z.string().max(150),email:z.email().max(254)})).max(50),
  assignmentHint: z.string().max(150).nullable(), kind: visitKind,
  customerEmails:z.array(z.email().max(254)).max(50), cancelled:z.boolean(), duplicate:z.boolean(),
  reviewReasons:z.array(z.string().max(200)).max(10),
}).strict().refine(event=>event.isAllDay?Boolean(event.allDayStartDate&&event.allDayEndDate&&event.allDayEndDate>event.allDayStartDate):event.allDayStartDate===null&&event.allDayEndDate===null,{message:'Invalid all-day calendar range'});
export type MirrorEvent = z.infer<typeof mirrorEventSchema>;
export const reviewCommand = z.object({
  id:z.uuid(),revision:z.number().int().positive(),projectId:z.uuid().nullable(),
  linkMode:z.enum(['manual','auto']),kind:visitKind.nullable(),
}).strict();
