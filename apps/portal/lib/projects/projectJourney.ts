import type { ProjectStage } from "@/lib/projects/types";

export const PROJECT_JOURNEY_PHASES = [
  "ENQUIRY",
  "PROPOSAL",
  "CONFIRMED",
  "DELIVERY",
  "SETTLED",
] as const;

export type ProjectJourneyPhase = (typeof PROJECT_JOURNEY_PHASES)[number];

export const PROJECT_JOURNEY_PHASE_LABELS = {
  ENQUIRY: "Enquiry",
  PROPOSAL: "Proposal",
  CONFIRMED: "Confirmed",
  DELIVERY: "Delivery",
  SETTLED: "Settled",
} as const satisfies Record<ProjectJourneyPhase, string>;

const PROJECT_JOURNEY_STAGES = {
  ENQUIRY: ["new", "contacted"],
  PROPOSAL: ["site_visit", "quoting", "sent"],
  CONFIRMED: ["deposit"],
  DELIVERY: ["scheduled", "completed"],
  SETTLED: ["paid"],
} as const satisfies Record<ProjectJourneyPhase, readonly ProjectStage[]>;

const STAGE_PRESENTATION = {
  new: { label: "New", phase: "ENQUIRY" },
  contacted: { label: "Contacted", phase: "ENQUIRY" },
  site_visit: { label: "Site Visit", phase: "PROPOSAL" },
  quoting: { label: "Quoting", phase: "PROPOSAL" },
  sent: { label: "Sent", phase: "PROPOSAL" },
  deposit: { label: "Deposit", phase: "CONFIRMED" },
  scheduled: { label: "Scheduled", phase: "DELIVERY" },
  completed: { label: "Completed", phase: "DELIVERY" },
  paid: { label: "Paid", phase: "SETTLED" },
} as const satisfies Record<
  ProjectStage,
  { label: string; phase: ProjectJourneyPhase }
>;

type ProjectJourneyPresentation =
  | {
      knownStage: true;
      phase: ProjectJourneyPhase;
      phaseLabel: string;
      stage: ProjectStage;
      stageLabel: string;
    }
  | {
      knownStage: false;
      phase: null;
      phaseLabel: "Unknown";
      stage: null;
      stageLabel: "Unknown";
    };

type ProjectStageCounts = Readonly<
  Partial<Record<ProjectStage, number>>
>;

type ProjectJourneyPhaseCounts = Record<ProjectJourneyPhase, number>;

function isProjectStage(value: unknown): value is ProjectStage {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(STAGE_PRESENTATION, value)
  );
}

export function resolveProjectJourney(
  stage: unknown,
): ProjectJourneyPresentation {
  if (!isProjectStage(stage)) {
    return {
      knownStage: false,
      phase: null,
      phaseLabel: "Unknown",
      stage: null,
      stageLabel: "Unknown",
    };
  }

  const presentation = STAGE_PRESENTATION[stage];
  return {
    knownStage: true,
    phase: presentation.phase,
    phaseLabel: PROJECT_JOURNEY_PHASE_LABELS[presentation.phase],
    stage,
    stageLabel: presentation.label,
  };
}

export function aggregateProjectStageCountsByJourney(
  stageCounts: ProjectStageCounts,
): ProjectJourneyPhaseCounts {
  const phaseCounts: ProjectJourneyPhaseCounts = {
    ENQUIRY: 0,
    PROPOSAL: 0,
    CONFIRMED: 0,
    DELIVERY: 0,
    SETTLED: 0,
  };

  for (const phase of PROJECT_JOURNEY_PHASES) {
    for (const stage of PROJECT_JOURNEY_STAGES[phase]) {
      const count = stageCounts[stage];
      if (typeof count === "number" && Number.isFinite(count) && count > 0) {
        phaseCounts[phase] += count;
      }
    }
  }

  return phaseCounts;
}

export function buildProjectJourneyStageSet(
  phases: readonly ProjectJourneyPhase[],
): ReadonlySet<ProjectStage> {
  const stages = new Set<ProjectStage>();

  for (const phase of phases) {
    for (const stage of PROJECT_JOURNEY_STAGES[phase]) {
      stages.add(stage);
    }
  }

  return stages;
}
