import type { ProjectCommandCentreCurrentDesign } from '@/lib/projects/commandCentre/types';

export const COMMAND_CENTRE_FIXTURE_SCENARIOS = [
  'new-lead',
  'no-current-design',
  'standard-estimate',
  'multiple-estimates',
  'sent-revision',
  'accepted-newer-estimate',
  'declined-quote',
  'missing-source',
  'missing-price',
] as const;

type CommandCentreFixtureScenario = (typeof COMMAND_CENTRE_FIXTURE_SCENARIOS)[number];

const BASE_LINKS = {
  designs: '/staff/projects/proj_fixture?tab=estimates',
  quotes: '/staff/projects/proj_fixture?tab=quotes',
  estimate: '/staff/projects/proj_fixture?tab=estimates&estimateId=est_fixture_1',
  quote: null,
};

const BASE_ESTIMATE: NonNullable<ProjectCommandCentreCurrentDesign['estimate']> = {
  id: 'est_fixture_1',
  versionLabel: 'V1',
  savedAt: '2026-07-01T00:00:00.000Z',
  isActiveDraft: true,
  isLocked: false,
  isQuoteSource: false,
  costingState: 'current',
};

const BASE: ProjectCommandCentreCurrentDesign = {
  source: 'estimate',
  statusLabel: 'Estimate current',
  statusTone: 'neutral',
  designState: 'available',
  design: {
    size: '6m x 4m',
    shape: 'Gable',
    roofing: 'Acrylic',
    additionalModuleCount: 0,
  },
  price: { source: 'estimate', totalIncGstCents: 123_456 },
  estimate: BASE_ESTIMATE,
  quote: null,
  newerEstimate: null,
  latestDeclinedQuote: null,
  warnings: [],
  links: BASE_LINKS,
};

function withQuote(
  status: 'SENT' | 'ACCEPTED',
  overrides: Partial<ProjectCommandCentreCurrentDesign> = {},
): ProjectCommandCentreCurrentDesign {
  const accepted = status === 'ACCEPTED';
  return {
    ...BASE,
    source: accepted ? 'accepted_quote' : 'sent_quote',
    statusLabel: accepted ? 'Quote accepted' : 'Quote sent',
    statusTone: accepted ? 'accepted' : 'sent',
    price: { source: 'quote', totalIncGstCents: 175_000 },
    estimate: { ...BASE_ESTIMATE, isActiveDraft: false, isLocked: true, isQuoteSource: true },
    quote: {
      id: 'qv_fixture_2',
      quoteRef: 'Q-0100',
      versionNumber: 2,
      status,
      createdAt: '2026-07-03T00:00:00.000Z',
      sentAt: '2026-07-03T01:00:00.000Z',
      deliveryState: accepted ? 'accepted' : 'sent',
    },
    links: {
      ...BASE_LINKS,
      quote: '/staff/projects/proj_fixture?tab=quotes&quoteId=qv_fixture_2',
    },
    ...overrides,
  };
}

export const commandCentreFixtures: Record<CommandCentreFixtureScenario, ProjectCommandCentreCurrentDesign> = {
  'new-lead': BASE,
  'no-current-design': {
    ...BASE,
    source: 'none',
    statusLabel: 'No current design',
    designState: 'none',
    design: null,
    price: { source: 'none', totalIncGstCents: null },
    estimate: null,
    links: { ...BASE_LINKS, estimate: null },
  },
  'standard-estimate': BASE,
  'multiple-estimates': {
    ...BASE,
    source: 'draft_quote',
    statusLabel: 'Draft quote',
    statusTone: 'draft',
    design: { ...BASE.design!, additionalModuleCount: 2 },
    price: { source: 'quote', totalIncGstCents: 140_000 },
    estimate: { ...BASE_ESTIMATE, isQuoteSource: true },
    quote: {
      id: 'qv_fixture_draft',
      quoteRef: 'Q-0100',
      versionNumber: 1,
      status: 'DRAFT',
      createdAt: '2026-07-03T00:00:00.000Z',
      sentAt: null,
      deliveryState: 'draft',
    },
    newerEstimate: {
      id: 'est_fixture_3',
      versionLabel: 'V3',
      savedAt: '2026-07-06T00:00:00.000Z',
    },
    links: {
      ...BASE_LINKS,
      quote: '/staff/projects/proj_fixture?tab=quotes&quoteId=qv_fixture_draft',
    },
  },
  'sent-revision': withQuote('SENT'),
  'accepted-newer-estimate': withQuote('ACCEPTED', {
    newerEstimate: {
      id: 'est_fixture_3',
      versionLabel: 'V3',
      savedAt: '2026-07-06T00:00:00.000Z',
    },
  }),
  'declined-quote': {
    ...BASE,
    latestDeclinedQuote: {
      quoteVersionId: 'qv_fixture_declined',
      quoteRef: 'Q-0100',
      versionNumber: 1,
      createdAt: '2026-07-03T00:00:00.000Z',
    },
  },
  'missing-source': withQuote('ACCEPTED', {
    designState: 'source_unavailable',
    design: null,
    estimate: null,
    warnings: ['source_design_unavailable'],
    links: {
      ...BASE_LINKS,
      estimate: null,
      quote: '/staff/projects/proj_fixture?tab=quotes&quoteId=qv_fixture_2',
    },
  }),
  'missing-price': withQuote('SENT', {
    price: { source: 'quote', totalIncGstCents: null },
    warnings: ['quote_price_unavailable'],
  }),
};

export function isCommandCentreFixtureScenario(value: string): value is CommandCentreFixtureScenario {
  return COMMAND_CENTRE_FIXTURE_SCENARIOS.includes(value as CommandCentreFixtureScenario);
}
