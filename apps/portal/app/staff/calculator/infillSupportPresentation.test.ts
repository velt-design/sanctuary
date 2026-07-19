import { describe, expect, it } from 'vitest';

import type { InfillSupportInput } from '@/lib/types/calculator';
import {
  explicitInfillSelectionPatch,
  inferEdgeConfirmations,
  makeNoEdgeConfirmations,
  normalizeEdgeConfirmations,
  resolveSupportConfirmations,
  updateEdgeConfirmation,
} from './infillSupportPresentation';
import { makeDefaultInfillItem } from './calculatorInputs';

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

  it('maps legacy unsure answers to No while preserving the conservative costing value', () => {
    expect(normalizeEdgeConfirmations(
      { top: 'yes', bottom: 'no', left: 'unsure', right: 'yes' },
      legacySupport(),
    )).toEqual({ top: 'yes', bottom: 'no', left: 'no', right: 'yes' });
    const support = resolveSupportConfirmations({
      ...legacySupport(),
      edgeConfirmations: { top: 'yes', bottom: 'no', left: 'unsure', right: 'yes' },
    });
    expect(support).toMatchObject({ hasTop: true, hasBottom: false, hasLeft: false, hasRight: true });
  });

  it('updates one edge without losing other confirmations or internal support settings', () => {
    const support = updateEdgeConfirmation(
      { ...legacySupport(), edgeConfirmations: makeNoEdgeConfirmations(), internalSupportMode: 'center' },
      'top',
      'yes',
    );
    expect(support.edgeConfirmations).toEqual({ top: 'yes', bottom: 'no', left: 'no', right: 'no' });
    expect(support).toMatchObject({ hasTop: true, hasBottom: false, hasLeft: false, hasRight: false, internalSupportMode: 'center' });
  });

  it('pins legacy automatic selections to the current resolved choices', () => {
    const item = makeDefaultInfillItem({ acrylicSource: 'auto', panelOrientation: 'auto' });
    expect(explicitInfillSelectionPatch(item, 'strip_620', 'horizontal')).toEqual({
      acrylicSource: 'strip_620',
      panelOrientation: 'horizontal',
      targetPanelWidthM: '0.64',
      maxPanelWidthM: '0.64',
    });
    expect(explicitInfillSelectionPatch(
      makeDefaultInfillItem({ acrylicSource: 'sheet_panels', panelOrientation: 'vertical' }),
      'strip_620',
      'horizontal',
    )).toBeNull();
  });
});
