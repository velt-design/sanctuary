export type CommitResult = { ok: boolean; error?: string };

export type DrawOutlineTarget =
  | { kind: 'footprint'; deckId: null }
  | { kind: 'deck'; deckId: string };

export type { DeckInteractionTelemetry } from '@/lib/drawings/interactions/deckInteractionContract';
