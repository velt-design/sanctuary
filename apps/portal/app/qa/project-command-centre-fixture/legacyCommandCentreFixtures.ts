import type {
  ProjectCommandActionSummary,
  ProjectCommandCentreOperations,
} from "@/lib/projects/commandCentre/types";
import { commandCentreFixtureStaff } from "./commandCentreFixtureStaff";

const COMMAND_CENTRE_ACTION_SCENARIOS = [
  "primary",
  "empty",
  "conflict",
  "critical",
  "undated",
  "admin",
  "admin-conflict",
] as const;

type CommandCentreActionFixtureScenario =
  (typeof COMMAND_CENTRE_ACTION_SCENARIOS)[number];

const PRIMARY_ACTION: ProjectCommandActionSummary = {
  sourceKind: "automation_task",
  sourceId: "00000000-0000-4000-8000-000000000010",
  title: "Finalise and send quote",
  category: "Quote",
  sourceLabel: "Automation task",
  sourceType: "FINALIZE_SEND_QUOTE",
  owner: commandCentreFixtureStaff[0],
  ownerSource: "source_assignee",
  dueAt: "2026-07-20T05:00:00.000Z",
  dueState: "overdue",
  dueLabel: "Overdue · 20 Jul, 5:00 pm",
  isCustomerFacing: true,
  isCritical: false,
  criticalReason: null,
  rescheduleCount: 1,
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z",
  requiresDueDate: false,
  isExplicitlySelected: true,
  selectionBaselineHash: "cc_fixture_primary",
};

export const legacyUndatedActionFixture: ProjectCommandActionSummary = {
  ...PRIMARY_ACTION,
  sourceId: "00000000-0000-4000-8000-000000000011",
  title: "Book site visit",
  category: "Site visit",
  sourceType: "BOOK_SITE_VISIT",
  dueAt: null,
  dueState: "needs_due_date",
  dueLabel: "Due date required",
  requiresDueDate: true,
  isExplicitlySelected: false,
  selectionBaselineHash: "cc_fixture_undated",
};

const CHALLENGER: ProjectCommandActionSummary = {
  ...PRIMARY_ACTION,
  sourceKind: "quote_followup",
  sourceId: "00000000-0000-4000-8000-000000000012",
  title: "Call for quote follow-up",
  category: "Call",
  sourceLabel: "Quote follow-up",
  sourceType: "FOLLOWUP_CALL",
  dueAt: "2026-07-18T05:00:00.000Z",
  dueLabel: "Overdue · 18 Jul, 5:00 pm",
  isExplicitlySelected: false,
  selectionBaselineHash: "cc_fixture_challenger",
};

export const legacyBaseOperationsFixture: ProjectCommandCentreOperations = {
  owner: {
    owner: { key: "jordan", displayName: "Jordan" },
    required: true,
    missing: false,
    version: "2026-07-19T00:00:00.000Z",
    permissions: { canManage: false },
  },
  primaryAction: PRIMARY_ACTION,
  candidates: [PRIMARY_ACTION, legacyUndatedActionFixture],
  candidateCount: 2,
  candidateRevision: "cc_fixture_revision",
  manualSelectionBaselineHash: "cc_fixture_manual",
  selectionConflict: null,
  permissions: {
    canCreate: true,
    canSelect: true,
    canComplete: true,
    canReschedule: true,
    canReassign: true,
    canSetCritical: true,
    canResolveConflict: false,
  },
  audit: Array.from({ length: 6 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(20 + index).padStart(12, "0")}`,
    eventType:
      index === 0 ? "primary_action_selected" : "project_owner_changed",
    actor: commandCentreFixtureStaff[0],
    reason: index === 0 ? "Confirmed customer quote work" : null,
    createdAt: `2026-07-${String(19 - index).padStart(2, "0")}T04:00:00.000Z`,
    source:
      index === 0
        ? {
            sourceKind: PRIMARY_ACTION.sourceKind,
            sourceId: PRIMARY_ACTION.sourceId,
          }
        : null,
  })),
  exceptions: {
    missingOwner: false,
    noPrimaryAction: false,
    selectionConflict: false,
  },
};

export const commandCentreActionFixtures: Record<
  CommandCentreActionFixtureScenario,
  ProjectCommandCentreOperations
> = {
  primary: legacyBaseOperationsFixture,
  empty: {
    ...legacyBaseOperationsFixture,
    primaryAction: null,
    candidates: [],
    candidateCount: 0,
    permissions: {
      ...legacyBaseOperationsFixture.permissions,
      canComplete: false,
      canReschedule: false,
      canReassign: false,
      canSetCritical: false,
    },
    exceptions: {
      ...legacyBaseOperationsFixture.exceptions,
      noPrimaryAction: true,
    },
  },
  conflict: {
    ...legacyBaseOperationsFixture,
    candidates: [CHALLENGER, PRIMARY_ACTION, legacyUndatedActionFixture],
    candidateCount: 3,
    selectionConflict: {
      current: PRIMARY_ACTION,
      challenger: CHALLENGER,
      outrankingCandidates: [CHALLENGER],
      challengerCount: 1,
      candidateRevision: "cc_fixture_conflict",
    },
    permissions: {
      ...legacyBaseOperationsFixture.permissions,
      canSelect: false,
      canReschedule: false,
      canReassign: false,
      canSetCritical: false,
    },
    exceptions: {
      ...legacyBaseOperationsFixture.exceptions,
      selectionConflict: true,
    },
  },
  critical: {
    ...legacyBaseOperationsFixture,
    primaryAction: {
      ...PRIMARY_ACTION,
      isCritical: true,
      criticalReason: "Customer cannot proceed without a revised quote.",
    },
  },
  undated: {
    ...legacyBaseOperationsFixture,
    primaryAction: null,
    candidates: [legacyUndatedActionFixture],
    candidateCount: 1,
    permissions: {
      ...legacyBaseOperationsFixture.permissions,
      canComplete: false,
      canReschedule: false,
      canReassign: false,
      canSetCritical: false,
    },
    exceptions: {
      ...legacyBaseOperationsFixture.exceptions,
      noPrimaryAction: true,
    },
  },
  admin: {
    ...legacyBaseOperationsFixture,
    owner: {
      ...legacyBaseOperationsFixture.owner,
      permissions: { canManage: true },
    },
  },
  "admin-conflict": {
    ...legacyBaseOperationsFixture,
    candidates: [CHALLENGER, PRIMARY_ACTION, legacyUndatedActionFixture],
    candidateCount: 3,
    selectionConflict: {
      current: PRIMARY_ACTION,
      challenger: CHALLENGER,
      outrankingCandidates: [CHALLENGER],
      challengerCount: 1,
      candidateRevision: "cc_fixture_conflict",
    },
    permissions: {
      ...legacyBaseOperationsFixture.permissions,
      canCreate: false,
      canSelect: false,
      canReschedule: false,
      canReassign: false,
      canSetCritical: false,
      canResolveConflict: true,
    },
    exceptions: {
      ...legacyBaseOperationsFixture.exceptions,
      selectionConflict: true,
    },
  },
};
