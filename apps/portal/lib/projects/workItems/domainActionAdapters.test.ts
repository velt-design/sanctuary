import { describe, expect, it } from 'vitest';
import type { ProjectCommandCentreCurrentDesign } from '../commandCentre/types';
import { projectWorkDomainActions, type ProjectWorkDomainActionContext } from './domainActionAdapters';

const PROJECT_ID = 'proj_11111111-1111-4111-8111-111111111111';

function design(overrides: Partial<ProjectCommandCentreCurrentDesign> = {}): ProjectCommandCentreCurrentDesign {
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
      designs: `/staff/projects/${PROJECT_ID}?tab=estimates`,
      quotes: `/staff/projects/${PROJECT_ID}?tab=quotes`,
      estimate: null,
      quote: null,
    },
    ...overrides,
  };
}

function context(
  stage: string,
  currentDesign: ProjectCommandCentreCurrentDesign = design(),
  siteVisitCompleted = false,
): ProjectWorkDomainActionContext {
  return { projectId: PROJECT_ID, stage, siteVisitCompleted, currentDesign };
}

function estimateDesign(): ProjectCommandCentreCurrentDesign {
  return design({
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
      designs: `/staff/projects/${PROJECT_ID}?tab=estimates`,
      quotes: `/staff/projects/${PROJECT_ID}?tab=quotes`,
      estimate: `/staff/projects/${PROJECT_ID}?tab=estimates&estimateId=est_1`,
      quote: null,
    },
  });
}

describe('project-work domain actions', () => {
  it('surfaces durable and failed-delivery recovery ahead of journey actions', () => {
    const durableRepair = {
      kind: 'recovery' as const,
      key: 'quote-cadence-repair:repair-1',
      title: 'Repair quote follow-up sync',
      reason: 'The follow-up reminder could not be created.',
      href: '/quotes/qv_1',
      actionLabel: 'Repair quote follow-up',
    };
    expect(projectWorkDomainActions(context('contacted', estimateDesign()), durableRepair)).toEqual({
      recoveryAction: durableRepair,
      specialistAction: null,
    });

    const failed = projectWorkDomainActions(
      context(
        'contacted',
        design({
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
        }),
      ),
    );
    expect(failed.recoveryAction).toMatchObject({
      title: 'Recover quote delivery',
      actionLabel: 'Review quote delivery',
      href: '/quotes/qv_1',
    });
    expect(failed.specialistAction).toBeNull();
  });

  it('keeps New enquiry work authoritative even when an estimate exists', () => {
    expect(projectWorkDomainActions(context('new', estimateDesign()))).toEqual({
      recoveryAction: null,
      specialistAction: null,
    });
  });

  it('routes Contacted and incomplete Site Visit stages to the real visit workflow', () => {
    const contacted = projectWorkDomainActions(context('contacted', estimateDesign()));
    expect(contacted.specialistAction).toMatchObject({
      title: 'Arrange the site visit',
      actionLabel: 'Arrange site visit',
      owner: 'Operations',
      href: `/staff/schedule?view=site-visits&project=${PROJECT_ID}`,
    });

    const siteVisit = projectWorkDomainActions(context('site_visit', estimateDesign()));
    expect(siteVisit.specialistAction).toMatchObject({
      title: 'Complete the site visit',
      actionLabel: 'Book or confirm site visit',
      href: `/staff/schedule?view=site-visits&project=${PROJECT_ID}`,
    });
  });

  it('stops promoting the visit after its completion is recorded', () => {
    expect(projectWorkDomainActions(context('site_visit', estimateDesign(), true))).toEqual({
      recoveryAction: null,
      specialistAction: null,
    });
  });

  it('unlocks quote creation only at Quoting and uses the canonical handoff', () => {
    for (const stage of ['new', 'contacted', 'site_visit', 'sent']) {
      expect(projectWorkDomainActions(context(stage, estimateDesign())).specialistAction?.title).not.toBe(
        'Prepare the quote',
      );
    }

    expect(projectWorkDomainActions(context('quoting', estimateDesign())).specialistAction).toMatchObject({
      title: 'Prepare the quote',
      actionLabel: 'Create draft quote',
      href: `/staff/projects/${PROJECT_ID}?tab=quotes&createFromEstimateId=est_1`,
    });
  });

  it('promotes a draft quote only when the project is explicitly at Quoting', () => {
    const draft = design({
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
    });
    expect(projectWorkDomainActions(context('contacted', draft)).specialistAction).toMatchObject({
      title: 'Arrange the site visit',
    });
    expect(projectWorkDomainActions(context('quoting', draft)).specialistAction).toMatchObject({
      title: 'Finalise and send the draft quote',
      actionLabel: 'Open draft quote',
    });
  });

  it('does not invent work for sent or accepted commercial records', () => {
    expect(projectWorkDomainActions(context('sent', design({ source: 'sent_quote' })))).toEqual({
      recoveryAction: null,
      specialistAction: null,
    });
    expect(projectWorkDomainActions(context('deposit', design({ source: 'accepted_quote' })))).toEqual({
      recoveryAction: null,
      specialistAction: null,
    });
  });
});
