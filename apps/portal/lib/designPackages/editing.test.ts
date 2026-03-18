import { describe, expect, it } from 'vitest';
import { applyOptimisticDesignListCellValue, normalizeDesignListCellInput } from './editing';
import { DESIGN_PACKAGE_DESIGNERS, buildDesignPackageDesignerLookups } from './designers';
import type { DesignListRow, DesignPackagesResponse } from './types';

function makeRow(overrides: Partial<DesignListRow> = {}): DesignListRow {
  return {
    requestId: 'dpr_1',
    projectId: 'proj_1',
    estimateId: 'est_1',
    estimateVersionLabel: 'v1',
    requestVersion: 1,
    status: 'OPEN',
    priorityTier: 'TIER_2',
    priceTotalIncGstCents: 1230000,
    requestSource: 'estimates_tab',
    requestedAt: '2026-03-18T00:00:00Z',
    dueAt: '2026-03-21T09:00:00Z',
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    updatedAt: '2026-03-18T00:00:00Z',
    rowVersion: 'v1',
    quoteName: 'Alex Santos',
    projectName: 'Santos Project',
    clientName: 'Alex Santos',
    siteAddress: '29A Victor St',
    siteVisitRep: 'SC',
    sentAt: null,
    sentQuoteRef: null,
    visitStatus: 'CONFIRMED',
    visitCompletedAt: null,
    notes: '',
    requestNote: null,
    designerNote: null,
    assignedDesignerId: null,
    ...overrides,
  };
}

const LOOKUPS: DesignPackagesResponse['lookups'] = {
  designers: buildDesignPackageDesignerLookups([]),
};

describe('normalizeDesignListCellInput', () => {
  it('accepts blank and known designer options', () => {
    expect(normalizeDesignListCellInput('designer', null)).toEqual({ ok: true, value: null });
    expect(normalizeDesignListCellInput('designer', '   ')).toEqual({ ok: true, value: null });
    expect(normalizeDesignListCellInput('designer', DESIGN_PACKAGE_DESIGNERS[0].id)).toEqual({
      ok: true,
      value: DESIGN_PACKAGE_DESIGNERS[0].id,
    });
  });

  it('rejects unsupported designer values', () => {
    expect(normalizeDesignListCellInput('designer', 'joe')).toEqual({
      ok: false,
      error: 'Designer must be a valid option.',
    });
  });
});

describe('applyOptimisticDesignListCellValue', () => {
  it('updates the assigned designer and row version', () => {
    const row = applyOptimisticDesignListCellValue(makeRow(), 'designer', DESIGN_PACKAGE_DESIGNERS[1].id, LOOKUPS);

    expect(row.assignedDesignerId).toBe(DESIGN_PACKAGE_DESIGNERS[1].id);
    expect(row.rowVersion).toContain(DESIGN_PACKAGE_DESIGNERS[1].id);
  });
});
