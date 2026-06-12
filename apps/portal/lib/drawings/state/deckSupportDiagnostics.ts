import type { WorkbenchAttachmentSide } from './objectFirstWorkbenchModel';

type DeckSupportClassification = 'ground_supported' | 'threshold_attached' | 'mixed_or_unclear';
type DeckSupportWarningCode =
  | 'insufficient_host_edge_contact'
  | 'detached_too_close_to_house'
  | 'threshold_alignment_offset'
  | 'unsupported_house_intersection';

export type DeckSupportAttachmentSide = WorkbenchAttachmentSide;
export type DeckSupportResolvedClassification = DeckSupportClassification | 'none';

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

type DeckSupportDiagnosticDeck = {
  id: string;
  hostEdgeId: string | null;
  supportContext?: {
    classification: DeckSupportClassification;
    nearestHouseEdgeId: string | null;
    warningCodes: DeckSupportWarningCode[];
    warningMessages: string[];
  } | null;
};

function deckTouchesActiveHostSide(
  deck: DeckSupportDiagnosticDeck,
  activeHostSide: DeckSupportAttachmentSide,
): boolean {
  return (
    deck.hostEdgeId === activeHostSide ||
    deck.supportContext?.nearestHouseEdgeId === activeHostSide
  );
}

function resolveRelevantClassification(
  decks: DeckSupportDiagnosticDeck[],
): DeckSupportResolvedClassification {
  if (decks.some((deck) => deck.supportContext?.classification === 'threshold_attached')) {
    return 'threshold_attached';
  }
  if (decks.some((deck) => deck.supportContext?.classification === 'mixed_or_unclear')) {
    return 'mixed_or_unclear';
  }
  if (decks.some((deck) => deck.supportContext?.classification === 'ground_supported')) {
    return 'ground_supported';
  }
  return 'none';
}

export function buildWorkbenchDeckSupportDiagnostic(input: {
  activeHostSide: DeckSupportAttachmentSide;
  decks: DeckSupportDiagnosticDeck[];
}): WorkbenchDeckSupportDiagnostic {
  const relevantDecks = input.decks.filter((deck) =>
    deckTouchesActiveHostSide(deck, input.activeHostSide),
  );
  const positiveDecks = relevantDecks.filter(
    (deck) => deck.supportContext?.classification === 'threshold_attached',
  );
  const eligibleDecks = positiveDecks;
  const warningCodes = Array.from(
    new Set(relevantDecks.flatMap((deck) => deck.supportContext?.warningCodes ?? [])),
  );
  const warningMessages = Array.from(
    new Set(relevantDecks.flatMap((deck) => deck.supportContext?.warningMessages ?? [])),
  );

  return {
    activeHostSide: input.activeHostSide,
    hasRelevantDeck: relevantDecks.length > 0,
    relevantDeckIds: relevantDecks.map((deck) => deck.id),
    relevantDeckCount: relevantDecks.length,
    positiveDeckIds: positiveDecks.map((deck) => deck.id),
    eligibleDeckIds: eligibleDecks.map((deck) => deck.id),
    resolvedClassification: resolveRelevantClassification(relevantDecks),
    deckBracketEligible: eligibleDecks.length > 0,
    warningCodes,
    warningMessages,
  };
}
