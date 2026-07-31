import { describe, expect, it } from 'vitest';
import { mapProjectRecord } from './projectRecord';

const row = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Deck Build',
  created_at: '2026-07-31T00:00:00.000Z',
  pipeline_stage: 'SENT',
};

describe('mapProjectRecord', () => {
  it('maps server-owned operational and effective state fields', () => {
    expect(
      mapProjectRecord({
        ...row,
        operational_state: 'WAITING',
        effective_state: 'ARCHIVED',
      }),
    ).toEqual(expect.objectContaining({
      operationalState: 'WAITING',
      effectiveState: 'ARCHIVED',
    }));
  });

  it('does not invent state when the server fields are missing or invalid', () => {
    expect(
      mapProjectRecord({
        ...row,
        archived_at: '2026-07-31T01:00:00.000Z',
        operational_state: 'UNKNOWN',
        effective_state: 'PAID',
      }),
    ).toEqual(expect.objectContaining({
      operationalState: undefined,
      effectiveState: undefined,
      isArchived: true,
    }));
  });
});
