export const EMAIL_DESIGN_CONSULTATION_BOOKED_V1 = 'EMAIL_DESIGN_CONSULTATION_BOOKED_V1' as const;
export const EMAIL_QUOTE_READY_V1 = 'EMAIL_QUOTE_READY_V1' as const;
export const EMAIL_PROJECT_SCHEDULED_V1 = 'EMAIL_PROJECT_SCHEDULED_V1' as const;
export const EMAIL_PROJECT_COMPLETED_V1 = 'EMAIL_PROJECT_COMPLETED_V1' as const;

export type PortalTransactionalTemplateId =
  | typeof EMAIL_DESIGN_CONSULTATION_BOOKED_V1
  | typeof EMAIL_QUOTE_READY_V1
  | typeof EMAIL_PROJECT_SCHEDULED_V1
  | typeof EMAIL_PROJECT_COMPLETED_V1;

const TEMPLATE_BASE_BY_ID: Record<PortalTransactionalTemplateId, string> = {
  [EMAIL_DESIGN_CONSULTATION_BOOKED_V1]: 'design-consultation-booked',
  [EMAIL_QUOTE_READY_V1]: 'quote-ready',
  [EMAIL_PROJECT_SCHEDULED_V1]: 'project-scheduled',
  [EMAIL_PROJECT_COMPLETED_V1]: 'project-completed',
};

const TEMPLATE_IDS = new Set<PortalTransactionalTemplateId>(Object.keys(TEMPLATE_BASE_BY_ID) as PortalTransactionalTemplateId[]);

export function isPortalTransactionalTemplateId(value: string): value is PortalTransactionalTemplateId {
  return TEMPLATE_IDS.has(value as PortalTransactionalTemplateId);
}

export function portalTransactionalTemplateBaseName(templateId: PortalTransactionalTemplateId): string {
  return TEMPLATE_BASE_BY_ID[templateId];
}

