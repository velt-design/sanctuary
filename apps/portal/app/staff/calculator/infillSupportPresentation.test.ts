import { describe, expect, it } from 'vitest';

import type { InfillSupportInput } from '@/lib/types/calculator';
import {
  getUnsureEdges,
  inferEdgeConfirmations,
  makeUnsureEdgeConfirmations,
  resolveSupportConfirmations,
  supportConfirmationSummary,
  updateEdgeConfirmation,
} from './infillSupportPresentation';

const legacySupport = (overrides: Partial<InfillSupportInput> = {}): InfillSupportInput => ({
  hasTop: true,
  hasBottom: false,
  hasLeft: true,
  hasRight: false,
  internalSupportMode: 'none',
  internalSupportPositionsM: [],
  ...overrides,
});

describe('infill support confirmation presentation', () => {
  it('infers legacy booleans without changing their resolved costing values', () => {
    const confirmations = inferEdgeConfirmations(legacySupport());
    expect(confirmations).toEqual({ top: 'yes', bottom: 'no', left: 'yes', right: 'no' });
    expect(resolveSupportConfirmations({ ...legacySupport(), edgeConfirmations: confirmations })).toMatchObject({
      hasTop: true,
      hasBottom: false,
      hasLeft: true,
      hasRight: false,
    });
  });

  it('resolves no and unsure conservatively while yes keeps the existing member', () => {
    const support = resolveSupportConfirmations({
      ...legacySupport(),
      edgeConfirmations: { top: 'yes', bottom: 'no', left: 'unsure', right: 'yes' },
    });
    expect(support).toMatchObject({ hasTop: true, hasBottom: false, hasLeft: false, hasRight: true });
  });

  it('updates one edge without losing other confirmations or internal support settings', () => {
    const support = updateEdgeConfirmation(
      { ...legacySupport(), edgeConfirmations: makeUnsureEdgeConfirmations(), internalSupportMode: 'center' },
      'top',
      'yes',
    );
    expect(support.edgeConfirmations).toEqual({ top: 'yes', bottom: 'unsure', left: 'unsure', right: 'unsure' });
    expect(support).toMatchObject({ hasTop: true, hasBottom: false, hasLeft: false, hasRight: false, internalSupportMode: 'center' });
  });

  it('explains uncertain edges as included supports rather than warnings', () => {
    const support = updateEdgeConfirmation(
      { ...legacySupport(), edgeConfirmations: makeUnsureEdgeConfirmations() },
      'top',
      'yes',
    );
    expect(getUnsureEdges(support)).toEqual(['bottom', 'left', 'right']);
    expect(supportConfirmationSummary(support)).toBe('Bottom, Left and Right edges were not confirmed, so a new support is included.');
  });
});
