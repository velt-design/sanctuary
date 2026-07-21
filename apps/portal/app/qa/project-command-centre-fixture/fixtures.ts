import type {
  ProjectCommandActionSummary,
  ProjectCommandCentreCurrentDesign,
  ProjectCommandCentreOperations,
  ProjectCommandStaffSummary,
} from '@/lib/projects/commandCentre/types';

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

export const COMMAND_CENTRE_ACTION_SCENARIOS = ['primary', 'empty', 'conflict', 'critical', 'undated', 'admin', 'admin-conflict'] as const;
type CommandCentreActionFixtureScenario = (typeof COMMAND_CENTRE_ACTION_SCENARIOS)[number];

export const commandCentreFixtureStaff: ProjectCommandStaffSummary[] = [
  { userId: '00000000-0000-4000-8000-000000000001', displayName: 'Sam Sales', email: 'sam@example.test', accessRole: 'staff' },
  { userId: '00000000-0000-4000-8000-000000000002', displayName: 'Dana Design', email: 'dana@example.test', accessRole: 'staff' },
];

const PRIMARY_ACTION: ProjectCommandActionSummary = {
  sourceKind: 'automation_task',
  sourceId: '00000000-0000-4000-8000-000000000010',
  title: 'Finalise and send quote',
  category: 'Quote',
  sourceLabel: 'Automation task',
  sourceType: 'FINALIZE_SEND_QUOTE',
  owner: commandCentreFixtureStaff[0],
  ownerSource: 'source_assignee',
  dueAt: '2026-07-20T05:00:00.000Z',
  dueState: 'overdue',
  dueLabel: 'Overdue · 20 Jul, 5:00 pm',
  isCustomerFacing: true,
  isCritical: false,
  criticalReason: null,
  rescheduleCount: 1,
  createdAt: '2026-07-16T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
  requiresDueDate: false,
  isExplicitlySelected: true,
  selectionBaselineHash: 'cc_fixture_primary',
};

const UNDATED_ACTION: ProjectCommandActionSummary = {
  ...PRIMARY_ACTION,
  sourceId: '00000000-0000-4000-8000-000000000011',
  title: 'Book site visit',
  category: 'Site visit',
  sourceType: 'BOOK_SITE_VISIT',
  dueAt: null,
  dueState: 'needs_due_date',
  dueLabel: 'Due date required',
  requiresDueDate: true,
  isExplicitlySelected: false,
  selectionBaselineHash: 'cc_fixture_undated',
};

const CHALLENGER: ProjectCommandActionSummary = {
  ...PRIMARY_ACTION,
  sourceKind: 'quote_followup',
  sourceId: '00000000-0000-4000-8000-000000000012',
  title: 'Call for quote follow-up',
  category: 'Call',
  sourceLabel: 'Quote follow-up',
  sourceType: 'FOLLOWUP_CALL',
  dueAt: '2026-07-18T05:00:00.000Z',
  dueLabel: 'Overdue · 18 Jul, 5:00 pm',
  isExplicitlySelected: false,
  selectionBaselineHash: 'cc_fixture_challenger',
};

const BASE_OPERATIONS: ProjectCommandCentreOperations = {
  owner: {
    owner: { key: 'jordan', displayName: 'Jordan' },
    required: true,
    missing: false,
    version: '2026-07-19T00:00:00.000Z',
    permissions: { canManage: false },
  },
  primaryAction: PRIMARY_ACTION,
  candidates: [PRIMARY_ACTION, UNDATED_ACTION],
  candidateCount: 2,
  candidateRevision: 'cc_fixture_revision',
  manualSelectionBaselineHash: 'cc_fixture_manual',
  selectionConflict: null,
  permissions: { canCreate: true, canSelect: true, canComplete: true, canReschedule: true, canReassign: true, canSetCritical: true, canResolveConflict: false },
  audit: Array.from({ length: 6 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(20 + index).padStart(12, '0')}`,
    eventType: index === 0 ? 'primary_action_selected' : 'project_owner_changed',
    actor: commandCentreFixtureStaff[0],
    reason: index === 0 ? 'Confirmed customer quote work' : null,
    createdAt: `2026-07-${String(19 - index).padStart(2, '0')}T04:00:00.000Z`,
    source: index === 0 ? { sourceKind: PRIMARY_ACTION.sourceKind, sourceId: PRIMARY_ACTION.sourceId } : null,
  })),
  exceptions: { missingOwner: false, noPrimaryAction: false, selectionConflict: false },
};

export const commandCentreActionFixtures: Record<CommandCentreActionFixtureScenario, ProjectCommandCentreOperations> = {
  primary: BASE_OPERATIONS,
  empty: {
    ...BASE_OPERATIONS,
    primaryAction: null,
    candidates: [],
    candidateCount: 0,
    permissions: { ...BASE_OPERATIONS.permissions, canComplete: false, canReschedule: false, canReassign: false, canSetCritical: false },
    exceptions: { ...BASE_OPERATIONS.exceptions, noPrimaryAction: true },
  },
  conflict: {
    ...BASE_OPERATIONS,
    candidates: [CHALLENGER, PRIMARY_ACTION, UNDATED_ACTION],
    candidateCount: 3,
    selectionConflict: {
      current: PRIMARY_ACTION,
      challenger: CHALLENGER,
      outrankingCandidates: [CHALLENGER],
      challengerCount: 1,
      candidateRevision: 'cc_fixture_conflict',
    },
    permissions: { ...BASE_OPERATIONS.permissions, canSelect: false, canReschedule: false, canReassign: false, canSetCritical: false },
    exceptions: { ...BASE_OPERATIONS.exceptions, selectionConflict: true },
  },
  critical: {
    ...BASE_OPERATIONS,
    primaryAction: { ...PRIMARY_ACTION, isCritical: true, criticalReason: 'Customer cannot proceed without a revised quote.' },
  },
  undated: {
    ...BASE_OPERATIONS,
    primaryAction: null,
    candidates: [UNDATED_ACTION],
    candidateCount: 1,
    permissions: { ...BASE_OPERATIONS.permissions, canComplete: false, canReschedule: false, canReassign: false, canSetCritical: false },
    exceptions: { ...BASE_OPERATIONS.exceptions, noPrimaryAction: true },
  },
  admin: {
    ...BASE_OPERATIONS,
    owner: { ...BASE_OPERATIONS.owner, permissions: { canManage: true } },
  },
  'admin-conflict': {
    ...BASE_OPERATIONS,
    candidates: [CHALLENGER, PRIMARY_ACTION, UNDATED_ACTION],
    candidateCount: 3,
    selectionConflict: {
      current: PRIMARY_ACTION,
      challenger: CHALLENGER,
      outrankingCandidates: [CHALLENGER],
      challengerCount: 1,
      candidateRevision: 'cc_fixture_conflict',
    },
    permissions: {
      ...BASE_OPERATIONS.permissions,
      canCreate: false,
      canSelect: false,
      canReschedule: false,
      canReassign: false,
      canSetCritical: false,
      canResolveConflict: true,
    },
    exceptions: { ...BASE_OPERATIONS.exceptions, selectionConflict: true },
  },
};

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

export function isCommandCentreActionFixtureScenario(value: string): value is CommandCentreActionFixtureScenario {
  return COMMAND_CENTRE_ACTION_SCENARIOS.includes(value as CommandCentreActionFixtureScenario);
}
