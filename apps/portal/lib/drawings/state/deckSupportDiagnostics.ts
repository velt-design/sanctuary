import type { WorkbenchAttachmentSide } from './objectFirstWorkbenchModel';

type DeckSupportClassification = 'ground_supported' | 'threshold_attached' | 'mixed_or_unclear';
type DeckSupportWarningCode =
  | 'insufficient_host_edge_contact'
  | 'detached_too_close_to_house'
  | 'threshold_alignment_offset'
  | 'unsupported_house_intersection';

type DeckSupportAttachmentSide = WorkbenchAttachmentSide;
type DeckSupportResolvedClassification = DeckSupportClassification | 'none';

export type WorkbenchDeckSupportDiagnostic = {
  activeHostSide: DeckSupportAttachmentSide;
  hasRelevantDeck: boolean;
  relevantDeckIds: string[];
  relevantDeckCount: number;
  positiveDeckIds: string[];
  eligibleDeckIds: string[];
  resolvedClassification: DeckSupportResolvedClassification;
  deckBracketEligible: boolean;
  warningCodes: DeckSupportWarningCode[];
  warningMessages: string[];
};

