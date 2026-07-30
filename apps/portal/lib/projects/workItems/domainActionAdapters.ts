import type {
  CommandCentreDeliveryState,
  CommandCentreSource,
  ProjectCommandCentreCurrentDesign,
} from '../commandCentre/types';
import type {
  RecoveryActionCandidate,
  SpecialistActionCandidate,
} from './primaryAction';

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

/**
 * Adapts the authoritative commercial/design summary into references to
 * specialist-owned actions. It does not copy those actions into work items
 * and never infers quote state from the pipeline stage.
 */
export function commercialProjectWorkActions(
  currentDesign: ProjectWorkCommercialActionContext,
  durableRecoveryAction: RecoveryActionCandidate | null = null,
): ProjectWorkDomainActions {
  if (durableRecoveryAction) {
    return {
      recoveryAction: durableRecoveryAction,
      specialistAction: null,
    };
  }

  if (currentDesign.quote?.deliveryState === 'failed') {
    return {
      recoveryAction: {
        kind: 'recovery',
        key: `quote-delivery:${currentDesign.quote.id}`,
        title: 'Recover quote delivery',
        reason: 'The authoritative quote delivery record is failed.',
        href: currentDesign.links.quote ?? currentDesign.links.quotes,
      },
      specialistAction: null,
    };
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
      },
    };
  }

  if (
    currentDesign.source === 'estimate'
    && currentDesign.estimate
    && currentDesign.designState === 'available'
  ) {
    return {
      recoveryAction: null,
      specialistAction: {
        kind: 'specialist',
        key: `estimate-quote:${currentDesign.estimate.id}`,
        title: 'Prepare the quote',
        reason: 'A current estimate exists and no quote owns the commercial position.',
        owner: 'Commercial',
        expectedResult: 'A draft quote is created from the current estimate.',
        href: currentDesign.links.estimate ?? currentDesign.links.quotes,
      },
    };
  }

  return { recoveryAction: null, specialistAction: null };
}
