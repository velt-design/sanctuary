import { describe, expect, it, vi } from 'vitest';
import type { ProjectCommandCentreCurrentDesign } from '../commandCentre/types';
import { getProjectWorkDomainActions } from './getProjectWorkDomainActions';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const QUOTE_VERSION_UUID = '22222222-2222-4222-8222-222222222222';

const currentDesign: ProjectCommandCentreCurrentDesign = {
  source: 'none',
  statusLabel: 'No current design',
  statusTone: 'neutral',
  designState: 'none',
  design: null,
  price: { source: 'none', totalIncGstCents: null },
  estimate: null,
  quote: null,
  newerEstimate: null,
  latestDeclinedQuote: null,
  warnings: [],
  links: {
    designs: `/staff/projects/${PROJECT_ID}?tab=estimates`,
    quotes: `/staff/projects/${PROJECT_ID}?tab=quotes`,
    estimate: null,
    quote: null,
  },
};

function client(result: { data: unknown; error: unknown }) {
  const query: Record<string, any> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(async () => result);
  return {
    from: vi.fn(() => query),
    query,
  };
}

describe('project-work domain action read', () => {
  it('maps the oldest open durable repair signal to a staff-safe recovery action', async () => {
    const supabase = client({
      data: [{
        id: 'repair-1',
        repair_kind: 'QUOTE_CADENCE_RECONCILIATION',
        quote_version_id: QUOTE_VERSION_UUID,
        error_message: 'The quote follow-up reminder could not be updated.',
      }],
      error: null,
    });

    await expect(getProjectWorkDomainActions({
      supabase: supabase as never,
      projectId: PROJECT_ID,
      projectUuid: PROJECT_UUID,
      currentDesign,
    })).resolves.toEqual({
      recoveryAction: {
        kind: 'recovery',
        key: 'quote-cadence-repair:repair-1',
        title: 'Repair quote follow-up sync',
        reason: 'The quote follow-up reminder could not be updated.',
        href: `/staff/projects/${PROJECT_ID}?tab=quotes&quoteId=qv_${QUOTE_VERSION_UUID}`,
      },
      specialistAction: null,
    });
    expect(supabase.from).toHaveBeenCalledWith('project_work_repair_signals');
    expect(supabase.query.eq).toHaveBeenNthCalledWith(1, 'project_id', PROJECT_UUID);
    expect(supabase.query.eq).toHaveBeenNthCalledWith(2, 'status', 'OPEN');
    expect(supabase.query.order).toHaveBeenNthCalledWith(
      1,
      'first_detected_at',
      { ascending: true },
    );
  });

  it('maps confirmation correction review without claiming a quote repair', async () => {
    const supabase = client({
      data: [{
        id: 'repair-2',
        repair_kind: 'CONFIRMATION_RETRACTION_REVIEW',
        quote_version_id: null,
        confirmation_event_id: '33333333-3333-4333-8333-333333333333',
        error_message: 'A recorded confirmation was corrected.',
      }],
      error: null,
    });

    await expect(getProjectWorkDomainActions({
      supabase: supabase as never,
      projectId: PROJECT_ID,
      projectUuid: PROJECT_UUID,
      currentDesign,
    })).resolves.toMatchObject({
      recoveryAction: {
        key: 'confirmation-retraction-review:repair-2',
        title: 'Review corrected confirmation',
        reason: 'A recorded confirmation was corrected.',
        href: `/staff/projects/${PROJECT_ID}?tab=activity`,
      },
    });
  });

  it('falls through to canonical specialist derivation when no repair is open', async () => {
    const supabase = client({ data: [], error: null });

    await expect(getProjectWorkDomainActions({
      supabase: supabase as never,
      projectId: PROJECT_ID,
      projectUuid: PROJECT_UUID,
      currentDesign: {
        ...currentDesign,
        source: 'draft_quote',
        quote: {
          id: `qv_${QUOTE_VERSION_UUID}`,
          quoteRef: 'Q-1',
          versionNumber: 1,
          status: 'DRAFT',
          createdAt: null,
          sentAt: null,
          deliveryState: 'draft',
        },
      },
    })).resolves.toMatchObject({
      recoveryAction: null,
      specialistAction: { title: 'Finalise and send the draft quote' },
    });
  });

  it('fails closed when the durable recovery read is unavailable or malformed', async () => {
    await expect(getProjectWorkDomainActions({
      supabase: client({
        data: null,
        error: { message: 'repair read unavailable', code: 'XX000' },
      }) as never,
      projectId: PROJECT_ID,
      projectUuid: PROJECT_UUID,
      currentDesign,
    })).rejects.toMatchObject({
      message: 'repair read unavailable',
      code: 'XX000',
    });

    await expect(getProjectWorkDomainActions({
      supabase: client({
        data: [{
          id: 'repair-1',
          repair_kind: 'QUOTE_CADENCE_RECONCILIATION',
          quote_version_id: null,
          error_message: 'Repair requires review.',
        }],
        error: null,
      }) as never,
      projectId: PROJECT_ID,
      projectUuid: PROJECT_UUID,
      currentDesign,
    })).rejects.toThrow('Open quote cadence repair signal is incomplete');
  });
});
