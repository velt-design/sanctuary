import {
  DEFAULT_CALCULATOR_ATTACHMENT_SIDE,
  normalizeAttachmentSide,
  supportsHouseFootprints,
  type CalculatorModuleInputs,
} from '@/lib/types/calculator';
import type {
  DeckModel,
  DeckSupportClassification,
  DeckSupportWarningCode,
} from './compat/objectWorkbenchCompatibilityModel';

export type DeckSupportAttachmentSide = NonNullable<CalculatorModuleInputs['attachmentSide']>;
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

function deckTouchesActiveHostSide(
  deck: DeckModel,
  activeHostSide: DeckSupportAttachmentSide,
): boolean {
  return (
    deck.hostEdgeId === activeHostSide ||
    deck.supportContext.nearestHouseEdgeId === activeHostSide
  );
}

function resolveRelevantClassification(
  decks: DeckModel[],
): DeckSupportResolvedClassification {
  if (decks.some((deck) => deck.supportContext.classification === 'threshold_attached')) {
    return 'threshold_attached';
  }
  if (decks.some((deck) => deck.supportContext.classification === 'mixed_or_unclear')) {
    return 'mixed_or_unclear';
  }
  if (decks.some((deck) => deck.supportContext.classification === 'ground_supported')) {
    return 'ground_supported';
  }
  return 'none';
}

export function resolveWorkbenchDeckSupportActiveSide(
  module: Partial<CalculatorModuleInputs> | null | undefined,
): DeckSupportAttachmentSide {
  if (!module) return DEFAULT_CALCULATOR_ATTACHMENT_SIDE;
  if (module.houseConnectionType === 'none') return DEFAULT_CALCULATOR_ATTACHMENT_SIDE;
  if (!supportsHouseFootprints(module.pergolaStyle ?? 'pitched')) {
    return DEFAULT_CALCULATOR_ATTACHMENT_SIDE;
  }
  return normalizeAttachmentSide(module.attachmentSide);
}

export function buildWorkbenchDeckSupportDiagnostic(input: {
  activeHostSide: DeckSupportAttachmentSide;
  decks: DeckModel[];
}): WorkbenchDeckSupportDiagnostic {
  const relevantDecks = input.decks.filter((deck) =>
    deckTouchesActiveHostSide(deck, input.activeHostSide),
  );
  const positiveDecks = relevantDecks.filter(
    (deck) => deck.supportContext.classification === 'threshold_attached',
  );
  const eligibleDecks = positiveDecks;
  const warningCodes = Array.from(
    new Set(relevantDecks.flatMap((deck) => deck.supportContext.warningCodes)),
  );
  const warningMessages = Array.from(
    new Set(relevantDecks.flatMap((deck) => deck.supportContext.warningMessages)),
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
