import { z } from 'zod';

export const qualificationCriteria = [
  ['location', 'Auckland or a confirmed serviceable location'],
  ['project', 'Suitable Sanctuary project'],
  ['contactAndConfiguration', 'Usable contact details and submitted configuration'],
  ['intent', 'Wants a quote or conversation'],
] as const;
export const criteriaSchema = z.object({
  location: z.boolean().nullable(), project: z.boolean().nullable(),
  contactAndConfiguration: z.boolean().nullable(), intent: z.boolean().nullable(),
}).strict();
export type QualificationCriteria = z.infer<typeof criteriaSchema>;
export const qualificationStateSchema = z.enum(['unreviewed', 'qualified', 'not_qualified']);
export type QualificationState = z.infer<typeof qualificationStateSchema>;
export const qualificationCommandSchema = z.object({
  commandId: z.string().uuid(), expectedVersion: z.number().int().min(0).max(2147483646),
  state: qualificationStateSchema, criteria: criteriaSchema, reason: z.string().trim().max(1000),
}).strict().superRefine((command, ctx) => {
  const error = assessmentError(command.state, command.criteria, command.reason, command.expectedVersion);
  if (error) ctx.addIssue({ code: 'custom', message: error });
});
export type QualificationCommand = z.infer<typeof qualificationCommandSchema>;
const decisionSchema = z.object({
  version: z.number().int().nonnegative(), state: qualificationStateSchema, criteria: criteriaSchema,
  reason: z.string(), actorId: z.string().nullable(), actorEmail: z.string().nullable(), recordedAt: z.string().nullable(),
  criteriaVersion: z.literal('configured-enquiry-v1'),
});
export const qualificationViewSchema = z.object({
  enquiryId: z.string().uuid(), projectId: z.string().uuid(), eligible: z.boolean(),
  current: decisionSchema, history: z.array(decisionSchema).max(20), replayed: z.boolean().optional(),
});
export type QualificationView = z.infer<typeof qualificationViewSchema>;
export const qualificationLabels: Record<QualificationState, string> = {
  unreviewed: 'Unreviewed', qualified: 'Qualified', not_qualified: 'Not qualified',
};
export function assessmentError(state: QualificationState, criteria: QualificationCriteria, reason: string, version: number): string | null {
  if (state === 'qualified' && !Object.values(criteria).every(value => value === true)) return 'Confirm all four criteria before marking qualified.';
  if (state === 'not_qualified' && !Object.values(criteria).some(value => value === false)) return 'Select at least one criterion that is not met.';
  if ((state === 'not_qualified' || version > 0) && !reason.trim()) return version > 0 ? 'Explain the correction so the review history stays clear.' : 'Explain why this enquiry is not qualified.';
  return null;
}
