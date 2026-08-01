import type {
  CommandCentreDeliveryState,
  CommandCentreSource,
  ProjectCommandCentreCurrentDesign,
} from '../commandCentre/types';
import type { RecoveryActionCandidate, SpecialistActionCandidate } from './primaryAction';
import { SITE_VISIT_SPECIALIST_KEY_PREFIX } from './prohibitedWork';

export type ProjectWorkDomainActions = {
  recoveryAction: RecoveryActionCandidate | null;
  specialistAction: SpecialistActionCandidate | null;
};

type ProjectWorkCommercialActionContext = {
  source: CommandCentreSource;
  designState: ProjectCommandCentreCurrentDesign['designState'];
  estimate: { id: string } | null;
  quote: {
    id: string;
    deliveryState: CommandCentreDeliveryState;
  } | null;
  links: ProjectCommandCentreCurrentDesign['links'];
};

export type ProjectWorkDomainActionContext = {
  projectId: string;
  stage: string;
  siteVisitCompleted: boolean;
  currentDesign: ProjectWorkCommercialActionContext;
};

function projectPath(projectId: string): string {
  return `/staff/projects/${encodeURIComponent(projectId)}`;
}

function siteVisitHref(projectId: string): string {
  return `/staff/schedule?view=site-visits&project=${encodeURIComponent(projectId)}`;
}

function quoteCreationHref(projectId: string, estimateId: string): string {
  return `${projectPath(projectId)}?tab=quotes&createFromEstimateId=${encodeURIComponent(estimateId)}`;
}

function journeySpecialistAction(context: ProjectWorkDomainActionContext): SpecialistActionCandidate | null {
  const stage = context.stage.trim().toLowerCase();
  if (context.siteVisitCompleted) return null;

  if (stage === 'contacted') {
    return {
      kind: 'specialist',
      key: `${SITE_VISIT_SPECIALIST_KEY_PREFIX}arrange:${context.projectId}`,
      title: 'Arrange the site visit',
      reason:
        'The customer has been contacted and the normal next step is a site visit. If no visit is required, deliberately correct the stage to Quoting.',
      owner: 'Operations',
      expectedResult: 'The visit is booked, or a reasoned stage correction records that no visit is required.',
      href: siteVisitHref(context.projectId),
      actionLabel: 'Arrange site visit',
    };
  }

  if (stage === 'site_visit') {
    return {
      kind: 'specialist',
      key: `${SITE_VISIT_SPECIALIST_KEY_PREFIX}complete:${context.projectId}`,
      title: 'Complete the site visit',
      reason: 'The project is at Site Visit and no completion has been recorded.',
      owner: 'Operations',
      expectedResult: 'The visit is booked or confirmed and its completion is recorded before quoting.',
      href: siteVisitHref(context.projectId),
      actionLabel: 'Book or confirm site visit',
    };
  }

  return null;
}

/**
 * Adapts authoritative journey and commercial facts into references to their
 * specialist-owned workflows. It never copies those actions into work items.
 */
export function projectWorkDomainActions(
  context: ProjectWorkDomainActionContext,
  durableRecoveryAction: RecoveryActionCandidate | null = null,
): ProjectWorkDomainActions {
  if (durableRecoveryAction) {
    return {
      recoveryAction: durableRecoveryAction,
      specialistAction: null,
    };
  }

  const { currentDesign } = context;
  if (currentDesign.quote?.deliveryState === 'failed') {
    return {
      recoveryAction: {
        kind: 'recovery',
        key: `quote-delivery:${currentDesign.quote.id}`,
        title: 'Recover quote delivery',
        reason: 'The authoritative quote delivery record is failed.',
        href: currentDesign.links.quote ?? currentDesign.links.quotes,
        actionLabel: 'Review quote delivery',
      },
      specialistAction: null,
    };
  }

  const journeyAction = journeySpecialistAction(context);
  if (journeyAction) {
    return { recoveryAction: null, specialistAction: journeyAction };
  }

  if (context.stage.trim().toLowerCase() !== 'quoting') {
    return { recoveryAction: null, specialistAction: null };
  }

  if (currentDesign.source === 'draft_quote' && currentDesign.quote) {
    return {
      recoveryAction: null,
      specialistAction: {
        kind: 'specialist',
        key: `draft-quote:${currentDesign.quote.id}`,
        title: 'Finalise and send the draft quote',
        reason: 'A draft quote is the current commercial record.',
        owner: 'Commercial',
        expectedResult: 'The quote is durably finalised and sent.',
        href: currentDesign.links.quote ?? currentDesign.links.quotes,
        actionLabel: 'Open draft quote',
      },
    };
  }

  if (currentDesign.source === 'estimate' && currentDesign.estimate && currentDesign.designState === 'available') {
    return {
      recoveryAction: null,
      specialistAction: {
        kind: 'specialist',
        key: `estimate-quote:${currentDesign.estimate.id}`,
        title: 'Prepare the quote',
        reason:
          'The project is explicitly at Quoting, a current estimate exists, and no quote owns the commercial position.',
        owner: 'Commercial',
        expectedResult: 'A draft quote is created from the current estimate.',
        href: quoteCreationHref(context.projectId, currentDesign.estimate.id),
        actionLabel: 'Create draft quote',
      },
    };
  }

  return { recoveryAction: null, specialistAction: null };
}
