import { describe, expect, it } from 'vitest';
import type { ProjectCommandCentreCurrentDesign } from '../commandCentre/types';
import { commercialProjectWorkActions } from './domainActionAdapters';

function design(
  overrides: Partial<ProjectCommandCentreCurrentDesign> = {},
): ProjectCommandCentreCurrentDesign {
  return {
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
      designs: '/designs',
      quotes: '/quotes',
      estimate: null,
      quote: null,
    },
    ...overrides,
  };
}

describe('commercial project-work domain actions', () => {
  it('surfaces a durable repair signal ahead of every derived commercial action', () => {
    const repair = {
      kind: 'recovery' as const,
      key: 'quote-cadence-repair:repair-1',
      title: 'Repair quote follow-up sync',
      reason: 'The follow-up reminder could not be created.',
      href: '/quotes/qv_1',
    };
    const result = commercialProjectWorkActions(design({
      source: 'sent_quote',
      quote: {
        id: 'qv_1',
        quoteRef: 'Q-1',
        versionNumber: 1,
        status: 'SENT',
        createdAt: null,
        sentAt: null,
        deliveryState: 'failed',
      },
    }), repair);

    expect(result).toEqual({
      recoveryAction: repair,
      specialistAction: null,
    });
  });

  it('surfaces failed delivery as recovery ahead of normal specialist work', () => {
    const result = commercialProjectWorkActions(design({
      source: 'sent_quote',
      quote: {
        id: 'qv_1',
        quoteRef: 'Q-1',
        versionNumber: 1,
        status: 'SENT',
        createdAt: null,
        sentAt: null,
        deliveryState: 'failed',
      },
      links: {
        designs: '/designs',
        quotes: '/quotes',
        estimate: null,
        quote: '/quotes/qv_1',
      },
    }));
    expect(result.recoveryAction).toMatchObject({
      kind: 'recovery',
      title: 'Recover quote delivery',
      href: '/quotes/qv_1',
    });
    expect(result.specialistAction).toBeNull();
  });

  it('references the draft quote and quote-ready estimate without creating work', () => {
    expect(commercialProjectWorkActions(design({
      source: 'draft_quote',
      quote: {
        id: 'qv_1',
        quoteRef: 'Q-1',
        versionNumber: 1,
        status: 'DRAFT',
        createdAt: null,
        sentAt: null,
        deliveryState: 'draft',
      },
    })).specialistAction).toMatchObject({
      kind: 'specialist',
      title: 'Finalise and send the draft quote',
    });

    expect(commercialProjectWorkActions(design({
      source: 'estimate',
      designState: 'available',
      estimate: {
        id: 'est_1',
        versionLabel: 'V1',
        savedAt: null,
        isActiveDraft: true,
        isLocked: false,
        isQuoteSource: false,
        costingState: 'current',
      },
      links: {
        designs: '/designs',
        quotes: '/quotes',
        estimate: '/estimates/est_1',
        quote: null,
      },
    })).specialistAction).toMatchObject({
      kind: 'specialist',
      title: 'Prepare the quote',
      href: '/estimates/est_1',
    });
  });

  it('does not invent work for sent or accepted commercial records', () => {
    expect(commercialProjectWorkActions(design({ source: 'sent_quote' }))).toEqual({
      recoveryAction: null,
      specialistAction: null,
    });
    expect(commercialProjectWorkActions(design({ source: 'accepted_quote' }))).toEqual({
      recoveryAction: null,
      specialistAction: null,
    });
  });
});
