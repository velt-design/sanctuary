export const GUIDED_HOME_PATH = '/home-guided';
export const GUIDED_HOME_VARIANT = 'guided_design_conversation_home_v1';
export const GUIDED_ENQUIRY_SOURCE_EXPERIENCE = 'guided-home-v1';

export const guidedAudiences = ['home', 'business', 'professional'] as const;
export const guidedHomeGoals = [
  'straightforward-cover',
  'outdoor-room',
  'difficult-site',
] as const;
export const guidedCoverFocuses = ['daylight', 'shade', 'balanced'] as const;
export const guidedOutdoorUses = ['everyday', 'entertaining', 'poolside'] as const;
export const guidedSiteConstraints = [
  'connection',
  'structure',
  'coordination',
] as const;
export const guidedBusinessSectors = [
  'hospitality',
  'workplace',
  'recreation',
] as const;
export const guidedBusinessRoles = [
  'lead',
  'collaborate',
  'feasibility',
] as const;
export const guidedProfessionalStages = [
  'concept',
  'developed',
  'delivery',
] as const;
export const guidedProfessionalNeeds = [
  'design-input',
  'scope',
  'delivery-coordination',
] as const;
export const guidedResultIds = [
  'residential-cover',
  'outdoor-room',
  'bespoke',
  'commercial',
  'professional',
] as const;

export type GuidedAudience = (typeof guidedAudiences)[number];
export type GuidedHomeGoal = (typeof guidedHomeGoals)[number];
export type GuidedCoverFocus = (typeof guidedCoverFocuses)[number];
export type GuidedOutdoorUse = (typeof guidedOutdoorUses)[number];
export type GuidedSiteConstraint = (typeof guidedSiteConstraints)[number];
export type GuidedBusinessSector = (typeof guidedBusinessSectors)[number];
export type GuidedBusinessRole = (typeof guidedBusinessRoles)[number];
export type GuidedProfessionalStage = (typeof guidedProfessionalStages)[number];
export type GuidedProfessionalNeed = (typeof guidedProfessionalNeeds)[number];
export type GuidedResultId = (typeof guidedResultIds)[number];

export type GuidedFocusId =
  | GuidedCoverFocus
  | GuidedOutdoorUse
  | GuidedSiteConstraint
  | GuidedBusinessRole
  | GuidedProfessionalNeed;

export function isGuidedValue<const T extends readonly string[]>(
  values: T,
  value: string | null | undefined,
): value is T[number] {
  return value !== null && value !== undefined && values.includes(value);
}
