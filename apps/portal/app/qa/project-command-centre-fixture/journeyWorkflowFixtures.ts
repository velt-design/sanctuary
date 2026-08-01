import type { ProjectPageSnapshot } from "@/lib/projects/types";
import type {
  ProjectWorkItem,
  ProjectWorkProjection,
} from "@/lib/projects/workItems/types";

export const COMMAND_CENTRE_JOURNEY_WORK_SCENARIOS = [
  "v2-contacted-site-visit",
  "v2-site-visit",
  "v2-site-visit-complete",
  "v2-quoting",
] as const;

export type CommandCentreJourneyWorkScenario =
  (typeof COMMAND_CENTRE_JOURNEY_WORK_SCENARIOS)[number];

type JourneyWorkFixture = {
  workModel: "v2";
  projectWork: ProjectWorkProjection;
  stage: ProjectPageSnapshot["project"]["stage"];
};

export function createJourneyWorkflowFixtures(params: {
  base: ProjectWorkProjection;
  stageReviewItem: ProjectWorkItem;
}): Record<CommandCentreJourneyWorkScenario, JourneyWorkFixture> {
  const { base, stageReviewItem } = params;
  return {
    "v2-contacted-site-visit": {
      workModel: "v2",
      projectWork: {
        ...base,
        primaryAction: {
          kind: "specialist",
          key: "journey-site-visit:arrange:proj_fixture",
          title: "Arrange the site visit",
          reason:
            "The customer has been contacted and the normal next step is a site visit. If no visit is required, deliberately correct the stage to Quoting.",
          owner: "Operations",
          expectedResult:
            "The visit is booked, or a reasoned stage correction records that no visit is required.",
          href: "/staff/schedule?view=site-visits&project=proj_fixture",
          actionLabel: "Arrange site visit",
        },
        openItems: [stageReviewItem],
      },
      stage: "contacted",
    },
    "v2-site-visit": {
      workModel: "v2",
      projectWork: {
        ...base,
        primaryAction: {
          kind: "specialist",
          key: "journey-site-visit:complete:proj_fixture",
          title: "Complete the site visit",
          reason:
            "The project is at Site Visit and no completion has been recorded.",
          owner: "Operations",
          expectedResult:
            "The visit is booked or confirmed and its completion is recorded before quoting.",
          href: "/staff/schedule?view=site-visits&project=proj_fixture",
          actionLabel: "Book or confirm site visit",
        },
        openItems: [stageReviewItem],
      },
      stage: "site_visit",
    },
    "v2-site-visit-complete": {
      workModel: "v2",
      projectWork: {
        ...base,
        primaryAction: {
          kind: "workItem",
          item: stageReviewItem,
          dueState: "future",
          reason: "This is the earliest due current work.",
        },
        openItems: [stageReviewItem],
        confirmedFacts: [
          {
            id: "10000000-0000-4000-8000-000000000011",
            type: "SITE_VISIT_COMPLETED",
            subjectKind: "PROJECT",
            subjectId: "proj_fixture",
            occurredAt: "2026-07-29T03:00:00.000Z",
            recordedAt: "2026-07-29T03:01:00.000Z",
          },
        ],
      },
      stage: "site_visit",
    },
    "v2-quoting": {
      workModel: "v2",
      projectWork: {
        ...base,
        primaryAction: {
          kind: "specialist",
          key: "estimate-quote:est_fixture_1",
          title: "Prepare the quote",
          reason:
            "The project is explicitly at Quoting, a current estimate exists, and no quote owns the commercial position.",
          owner: "Commercial",
          expectedResult: "A draft quote is created from the current estimate.",
          href: "/staff/projects/proj_fixture?tab=quotes&createFromEstimateId=est_fixture_1",
          actionLabel: "Create draft quote",
        },
        openItems: [stageReviewItem],
      },
      stage: "quoting",
    },
  };
}
