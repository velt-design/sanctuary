import type {
  ProjectCommandCentreCurrentDesign,
  ProjectCommandCentreOperations,
} from "@/lib/projects/commandCentre/types";
import type { ProjectPageSnapshot } from "@/lib/projects/types";
import type {
  ProjectWorkItem,
  ProjectWorkProjection,
} from "@/lib/projects/workItems/types";
import { commandCentreFixtureStaff } from "./commandCentreFixtureStaff";
import {
  commandCentreActionFixtures,
  legacyBaseOperationsFixture,
  legacyUndatedActionFixture,
} from "./legacyCommandCentreFixtures";

export {
  commandCentreFixtureStaff,
  commandCentreActionFixtures,
};

export const COMMAND_CENTRE_FIXTURE_SCENARIOS = [
  "new-lead",
  "no-current-design",
  "standard-estimate",
  "multiple-estimates",
  "sent-revision",
  "accepted-newer-estimate",
  "declined-quote",
  "missing-source",
  "missing-price",
  "missing-estimate-price",
] as const;

type CommandCentreFixtureScenario =
  (typeof COMMAND_CENTRE_FIXTURE_SCENARIOS)[number];

export const COMMAND_CENTRE_WORK_SCENARIOS = [
  "v2-primary",
  "v2-missing-email",
  "v2-follow-up",
  "v2-close-review",
  "v2-critical",
  "v2-overdue",
  "v2-future",
  "v2-blocked",
  "v2-no-owner",
  "v2-no-action",
  "v2-correction-review",
  "v2-waiting",
  "v2-closed",
  "v2-archived",
  "v2-triage",
  "legacy",
  "legacy-prohibited",
] as const;
export type CommandCentreWorkFixtureScenario =
  (typeof COMMAND_CENTRE_WORK_SCENARIOS)[number];

export const COMMAND_CENTRE_VIEW_STATES = [
  "ready",
  "refreshing",
  "stale",
  "model-mismatch",
  "summary",
  "pending",
  "failed",
  "retry",
  "access-401",
  "access-403",
  "access-404",
] as const;
export type CommandCentreViewFixtureState =
  (typeof COMMAND_CENTRE_VIEW_STATES)[number];

const V2_PRIMARY_ITEM: ProjectWorkItem = {
  id: "10000000-0000-4000-8000-000000000001",
  projectId: "proj_fixture",
  title: "Email the customer with the first enquiry response",
  responsibilityArea: "CUSTOMER",
  status: "OPEN",
  dueAt: "2026-07-30T05:00:00.000Z",
  slaBreachAt: "2026-07-30T06:00:00.000Z",
  deadlinePolicy: "FIRST_ENQUIRY_EMAIL_V1",
  calendarRevision: "fixture-v1",
  assigneeUserId: commandCentreFixtureStaff[0].userId,
  effectiveAssignee: {
    kind: "staff",
    userId: commandCentreFixtureStaff[0].userId,
  },
  priority: "NORMAL",
  priorityReason: null,
  blockedReason: null,
  origin: "AUTOMATION",
  sourceType: "LEAD_CADENCE",
  sourceKey: "lead:first-email:fixture-request",
  seriesKey: "lead:fixture-request",
  subjectKind: "PROJECT",
  subjectId: "proj_fixture",
  rowVersion: 1,
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-29T00:00:00.000Z",
  completedAt: null,
  cancelledAt: null,
  outcome: null,
  cancellationReason: null,
};

const V2_SECONDARY_ITEM: ProjectWorkItem = {
  ...V2_PRIMARY_ITEM,
  id: "10000000-0000-4000-8000-000000000002",
  title: "Prepare the revised design brief",
  responsibilityArea: "DESIGN",
  dueAt: "2026-08-03T05:00:00.000Z",
  slaBreachAt: null,
  deadlinePolicy: null,
  assigneeUserId: null,
  effectiveAssignee: { kind: "projectOwner", ownerKey: "jordan" },
  origin: "MANUAL",
  sourceType: "MANUAL",
  sourceKey: null,
  seriesKey: null,
  subjectKind: null,
  subjectId: null,
};

const V2_FOLLOW_UP_ITEM: ProjectWorkItem = {
  ...V2_PRIMARY_ITEM,
  id: "10000000-0000-4000-8000-000000000004",
  title: "Email the customer with an enquiry follow-up",
  dueAt: "2026-07-29T05:00:00.000Z",
  sourceKey: "lead:follow-up:fixture-request:1",
  deadlinePolicy: "ENQUIRY_FOLLOW_UP_EMAIL_V1",
};

const V2_CLOSE_REVIEW_ITEM: ProjectWorkItem = {
  ...V2_PRIMARY_ITEM,
  id: "10000000-0000-4000-8000-000000000005",
  title: "Review whether this enquiry should stay active",
  dueAt: "2026-08-01T05:00:00.000Z",
  sourceKey: "lead:close-review:proj_fixture:v1",
  deadlinePolicy: "LEAD_CLOSE_REVIEW_V1",
};

const V2_BLOCKED_ITEM: ProjectWorkItem = {
  ...V2_SECONDARY_ITEM,
  id: "10000000-0000-4000-8000-000000000003",
  title: "Resolve missing site measurements",
  status: "BLOCKED",
  priority: "CRITICAL",
  priorityReason: "The design cannot be confirmed without measurements.",
  blockedReason: "Measurements have not been supplied.",
};

const V2_BASE: ProjectWorkProjection = {
  projectId: "proj_fixture",
  modelVersion: 2,
  operationalState: "ACTIVE",
  effectiveState: "ACTIVE",
  waitingUntil: null,
  waitingReason: null,
  closedOutcome: null,
  stateRowVersion: 3,
  primaryAction: {
    kind: "workItem",
    item: V2_PRIMARY_ITEM,
    dueState: "today",
  },
  openItems: [V2_PRIMARY_ITEM, V2_SECONDARY_ITEM],
  blockedItems: [],
  confirmedFacts: [],
  generatedAt: "2026-07-30T00:00:00.000Z",
};

export type CommandCentreWorkFixture = (
  | {
      workModel: "v2";
      projectWork: ProjectWorkProjection;
    }
  | {
      workModel: "legacy";
      operations: ProjectCommandCentreOperations;
    }
) & {
  tasks: ProjectPageSnapshot["tasks"];
  project?: Partial<ProjectPageSnapshot["project"]>;
};

export const commandCentreWorkFixtures: Record<
  CommandCentreWorkFixtureScenario,
  CommandCentreWorkFixture
> = {
  "v2-primary": {
    workModel: "v2",
    projectWork: V2_BASE,
    tasks: { stage: "new", items: [] },
  },
  "v2-missing-email": {
    workModel: "v2",
    projectWork: {
      ...V2_BASE,
      primaryAction: {
        kind: "recovery",
        key: "missing-customer-email",
        title: "Customer email required",
        reason:
          "The first enquiry email is due but the customer email is missing.",
        href: null,
      },
      openItems: [V2_PRIMARY_ITEM],
    },
    tasks: { stage: "new", items: [] },
    project: { contactEmail: "" },
  },
  "v2-follow-up": {
    workModel: "v2",
    projectWork: {
      ...V2_BASE,
      primaryAction: {
        kind: "workItem",
        item: V2_FOLLOW_UP_ITEM,
        dueState: "overdue",
      },
      openItems: [V2_FOLLOW_UP_ITEM],
    },
    tasks: { stage: "contacted", items: [] },
  },
  "v2-close-review": {
    workModel: "v2",
    projectWork: {
      ...V2_BASE,
      primaryAction: {
        kind: "workItem",
        item: V2_CLOSE_REVIEW_ITEM,
        dueState: "future",
      },
      openItems: [V2_CLOSE_REVIEW_ITEM],
    },
    tasks: { stage: "contacted", items: [] },
  },
  "v2-critical": {
    workModel: "v2",
    projectWork: {
      ...V2_BASE,
      primaryAction: {
        kind: "workItem",
        item: {
          ...V2_SECONDARY_ITEM,
          priority: "CRITICAL",
          priorityReason: "The customer decision is blocked.",
        },
        dueState: "critical",
      },
      openItems: [
        {
          ...V2_SECONDARY_ITEM,
          priority: "CRITICAL",
          priorityReason: "The customer decision is blocked.",
        },
      ],
    },
    tasks: { stage: "quoting", items: [] },
  },
  "v2-overdue": {
    workModel: "v2",
    projectWork: {
      ...V2_BASE,
      primaryAction: {
        kind: "workItem",
        item: V2_FOLLOW_UP_ITEM,
        dueState: "overdue",
      },
      openItems: [V2_FOLLOW_UP_ITEM],
    },
    tasks: { stage: "contacted", items: [] },
  },
  "v2-future": {
    workModel: "v2",
    projectWork: {
      ...V2_BASE,
      primaryAction: {
        kind: "workItem",
        item: V2_SECONDARY_ITEM,
        dueState: "future",
      },
      openItems: [V2_SECONDARY_ITEM],
    },
    tasks: { stage: "quoting", items: [] },
  },
  "v2-blocked": {
    workModel: "v2",
    projectWork: {
      ...V2_BASE,
      openItems: [V2_PRIMARY_ITEM],
      blockedItems: [V2_BLOCKED_ITEM],
    },
    tasks: { stage: "new", items: [] },
  },
  "v2-no-owner": {
    workModel: "v2",
    projectWork: {
      ...V2_BASE,
      primaryAction: {
        kind: "workItem",
        item: {
          ...V2_SECONDARY_ITEM,
          effectiveAssignee: { kind: "unassigned" },
        },
        dueState: "future",
      },
      openItems: [
        {
          ...V2_SECONDARY_ITEM,
          effectiveAssignee: { kind: "unassigned" },
        },
      ],
    },
    tasks: { stage: "quoting", items: [] },
    project: { owner: undefined },
  },
  "v2-no-action": {
    workModel: "v2",
    projectWork: {
      ...V2_BASE,
      primaryAction: {
        kind: "none",
        title: "No current project work",
        reason: "The server has no current next action.",
      },
      openItems: [],
    },
    tasks: { stage: "new", items: [] },
  },
  "v2-correction-review": {
    workModel: "v2",
    projectWork: {
      ...V2_BASE,
      primaryAction: {
        kind: "needsTriage",
        title: "Needs triage",
        reason:
          "A corrected confirmation requires explicit project-work review.",
      },
      openItems: [],
      confirmedFacts: [
        {
          id: "10000000-0000-4000-8000-000000000010",
          type: "FIRST_ENQUIRY_EMAIL_SENT",
          subjectKind: "PROJECT",
          subjectId: "proj_fixture",
          occurredAt: "2026-07-29T02:00:00.000Z",
          recordedAt: "2026-07-29T02:01:00.000Z",
        },
      ],
    },
    tasks: { stage: "contacted", items: [] },
  },
  "v2-waiting": {
    workModel: "v2",
    projectWork: {
      ...V2_BASE,
      operationalState: "WAITING",
      effectiveState: "WAITING",
      waitingUntil: "2026-08-05T05:00:00.000Z",
      waitingReason: "Waiting for the customer to confirm timing.",
      primaryAction: {
        kind: "stateReview",
        key: "waiting-review",
        title: "Review waiting project",
        reason: "The server wake-up time is due for review.",
        dueAt: "2026-08-05T05:00:00.000Z",
      },
      openItems: [],
    },
    tasks: { stage: "new", items: [] },
  },
  "v2-closed": {
    workModel: "v2",
    projectWork: {
      ...V2_BASE,
      operationalState: "CLOSED",
      effectiveState: "CLOSED",
      closedOutcome: "LOST_TIMING_DEFERRED",
      primaryAction: {
        kind: "none",
        title: "Project closed",
        reason: "The server has recorded a closed outcome.",
      },
      openItems: [],
    },
    tasks: { stage: "new", items: [] },
  },
  "v2-archived": {
    workModel: "v2",
    projectWork: {
      ...V2_BASE,
      operationalState: "CLOSED",
      effectiveState: "ARCHIVED",
      closedOutcome: "COMPLETE",
      primaryAction: {
        kind: "none",
        title: "Project archived",
        reason: "Archived projects remain read-only.",
      },
      openItems: [],
    },
    tasks: { stage: "paid", items: [] },
  },
  "v2-triage": {
    workModel: "v2",
    projectWork: {
      ...V2_BASE,
      primaryAction: {
        kind: "needsTriage",
        title: "Needs triage",
        reason: "No ranked current work is available.",
      },
      openItems: [],
    },
    tasks: { stage: "new", items: [] },
  },
  legacy: {
    workModel: "legacy",
    operations: legacyBaseOperationsFixture,
    tasks: {
      stage: "quoting",
      items: [
        {
          key: "create_quote",
          label: "Create quote",
          kind: "manual",
          isDone: false,
        },
        {
          key: "call_again_later_sent",
          label: "Call again later",
          kind: "manual",
          isDone: false,
        },
      ],
    },
  },
  "legacy-prohibited": {
    workModel: "legacy",
    operations: {
      ...legacyBaseOperationsFixture,
      primaryAction: {
        ...legacyUndatedActionFixture,
        dueAt: "2026-07-31T05:00:00.000Z",
        dueState: "tomorrow",
        dueLabel: "Tomorrow",
        requiresDueDate: false,
        isExplicitlySelected: true,
      },
      candidates: [legacyUndatedActionFixture],
      candidateCount: 1,
    },
    tasks: {
      stage: "site_visit",
      items: [
        {
          key: "book_site_visit",
          label: "Book site visit",
          kind: "action",
          isDone: false,
          cta: {
            label: "Book",
            href: "/staff/schedule?view=site-visits&project=proj_fixture",
          },
        },
        {
          key: "upload_photos_site_visit",
          label: "Upload photos",
          kind: "manual",
          isDone: false,
        },
      ],
    },
  },
};

export const commandCentreOverviewFixtureProject: ProjectPageSnapshot["project"] =
  {
    id: "proj_fixture",
    name: "Aroha Smith - Takapuna",
    stage: "quoting",
    contactId: "contact_fixture",
    contactName: "Aroha Smith",
    contactEmail: "aroha@example.invalid",
    contactPhone: "021 555 0100",
    siteAddress: "10 Example Road, Takapuna",
    region: "Auckland",
    quoteRef: "Q-2042",
    owner: { key: "jordan", displayName: "Jordan" },
  };

const BASE_LINKS = {
  designs: "/staff/projects/proj_fixture?tab=estimates",
  quotes: "/staff/projects/proj_fixture?tab=quotes",
  estimate:
    "/staff/projects/proj_fixture?tab=estimates&estimateId=est_fixture_1",
  quote: null,
};

const BASE_ESTIMATE: NonNullable<
  ProjectCommandCentreCurrentDesign["estimate"]
> = {
  id: "est_fixture_1",
  versionLabel: "V1",
  savedAt: "2026-07-01T00:00:00.000Z",
  isActiveDraft: true,
  isLocked: false,
  isQuoteSource: false,
  costingState: "current",
};

const BASE: ProjectCommandCentreCurrentDesign = {
  source: "estimate",
  statusLabel: "Estimate current",
  statusTone: "neutral",
  designState: "available",
  design: {
    size: "6m x 4m",
    shape: "Gable",
    roofing: "Acrylic",
    additionalModuleCount: 0,
  },
  price: { source: "estimate", totalIncGstCents: 123_456 },
  estimate: BASE_ESTIMATE,
  quote: null,
  newerEstimate: null,
  latestDeclinedQuote: null,
  warnings: [],
  links: BASE_LINKS,
};

function withQuote(
  status: "SENT" | "ACCEPTED",
  overrides: Partial<ProjectCommandCentreCurrentDesign> = {},
): ProjectCommandCentreCurrentDesign {
  const accepted = status === "ACCEPTED";
  return {
    ...BASE,
    source: accepted ? "accepted_quote" : "sent_quote",
    statusLabel: accepted ? "Quote accepted" : "Quote sent",
    statusTone: accepted ? "accepted" : "sent",
    price: { source: "quote", totalIncGstCents: 175_000 },
    estimate: {
      ...BASE_ESTIMATE,
      isActiveDraft: false,
      isLocked: true,
      isQuoteSource: true,
    },
    quote: {
      id: "qv_fixture_2",
      quoteRef: "Q-0100",
      versionNumber: 2,
      status,
      createdAt: "2026-07-03T00:00:00.000Z",
      sentAt: "2026-07-03T01:00:00.000Z",
      deliveryState: accepted ? "accepted" : "sent",
    },
    links: {
      ...BASE_LINKS,
      quote: "/staff/projects/proj_fixture?tab=quotes&quoteId=qv_fixture_2",
    },
    ...overrides,
  };
}

export const commandCentreFixtures: Record<
  CommandCentreFixtureScenario,
  ProjectCommandCentreCurrentDesign
> = {
  "new-lead": BASE,
  "no-current-design": {
    ...BASE,
    source: "none",
    statusLabel: "No current design",
    designState: "none",
    design: null,
    price: { source: "none", totalIncGstCents: null },
    estimate: null,
    links: { ...BASE_LINKS, estimate: null },
  },
  "standard-estimate": BASE,
  "multiple-estimates": {
    ...BASE,
    source: "draft_quote",
    statusLabel: "Draft quote",
    statusTone: "draft",
    design: { ...BASE.design!, additionalModuleCount: 2 },
    price: { source: "quote", totalIncGstCents: 140_000 },
    estimate: { ...BASE_ESTIMATE, isQuoteSource: true },
    quote: {
      id: "qv_fixture_draft",
      quoteRef: "Q-0100",
      versionNumber: 1,
      status: "DRAFT",
      createdAt: "2026-07-03T00:00:00.000Z",
      sentAt: null,
      deliveryState: "draft",
    },
    newerEstimate: {
      id: "est_fixture_3",
      versionLabel: "V3",
      savedAt: "2026-07-06T00:00:00.000Z",
    },
    links: {
      ...BASE_LINKS,
      quote: "/staff/projects/proj_fixture?tab=quotes&quoteId=qv_fixture_draft",
    },
  },
  "sent-revision": withQuote("SENT"),
  "accepted-newer-estimate": withQuote("ACCEPTED", {
    newerEstimate: {
      id: "est_fixture_3",
      versionLabel: "V3",
      savedAt: "2026-07-06T00:00:00.000Z",
    },
  }),
  "declined-quote": {
    ...BASE,
    latestDeclinedQuote: {
      quoteVersionId: "qv_fixture_declined",
      quoteRef: "Q-0100",
      versionNumber: 1,
      createdAt: "2026-07-03T00:00:00.000Z",
    },
  },
  "missing-source": withQuote("ACCEPTED", {
    designState: "source_unavailable",
    design: null,
    estimate: null,
    warnings: ["source_design_unavailable"],
    links: {
      ...BASE_LINKS,
      estimate: null,
      quote: "/staff/projects/proj_fixture?tab=quotes&quoteId=qv_fixture_2",
    },
  }),
  "missing-price": withQuote("SENT", {
    price: { source: "quote", totalIncGstCents: null },
    warnings: ["quote_price_unavailable"],
  }),
  "missing-estimate-price": {
    ...BASE,
    price: { source: "estimate", totalIncGstCents: null },
    warnings: ["estimate_price_unavailable"],
  },
};

export function isCommandCentreFixtureScenario(
  value: string,
): value is CommandCentreFixtureScenario {
  return COMMAND_CENTRE_FIXTURE_SCENARIOS.includes(
    value as CommandCentreFixtureScenario,
  );
}

export function isCommandCentreWorkFixtureScenario(
  value: string,
): value is CommandCentreWorkFixtureScenario {
  return COMMAND_CENTRE_WORK_SCENARIOS.includes(
    value as CommandCentreWorkFixtureScenario,
  );
}

export function isCommandCentreViewFixtureState(
  value: string,
): value is CommandCentreViewFixtureState {
  return COMMAND_CENTRE_VIEW_STATES.includes(
    value as CommandCentreViewFixtureState,
  );
}
