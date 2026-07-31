import { describe, expect, it } from "vitest";
import {
  PROJECT_JOURNEY_PHASES,
  aggregateProjectStageCountsByJourney,
  buildProjectJourneyStageSet,
  resolveProjectJourney,
  type ProjectJourneyPhase,
} from "./projectJourney";

describe("projectJourney", () => {
  it.each([
    ["new", "ENQUIRY", "Enquiry", "New"],
    ["contacted", "ENQUIRY", "Enquiry", "Contacted"],
    ["site_visit", "PROPOSAL", "Proposal", "Site Visit"],
    ["quoting", "PROPOSAL", "Proposal", "Quoting"],
    ["sent", "PROPOSAL", "Proposal", "Sent"],
    ["deposit", "CONFIRMED", "Confirmed", "Deposit"],
    ["scheduled", "DELIVERY", "Delivery", "Scheduled"],
    ["completed", "DELIVERY", "Delivery", "Completed"],
    ["paid", "SETTLED", "Settled", "Paid"],
  ] as const)(
    "maps %s to %s while preserving its detailed stage",
    (stage, phase, phaseLabel, stageLabel) => {
      expect(resolveProjectJourney(stage)).toEqual({
        knownStage: true,
        phase,
        phaseLabel,
        stage,
        stageLabel,
      });
    },
  );

  it.each([undefined, null, "", "lead", "archived", 42, {}])(
    "fails safely for an unknown stage: %s",
    (stage) => {
      expect(resolveProjectJourney(stage)).toEqual({
        knownStage: false,
        phase: null,
        phaseLabel: "Unknown",
        stage: null,
        stageLabel: "Unknown",
      });
    },
  );

  it("aggregates canonical stage counts into all five journey phases", () => {
    expect(
      aggregateProjectStageCountsByJourney({
        new: 2,
        contacted: 3,
        site_visit: 5,
        quoting: 7,
        sent: 11,
        deposit: 13,
        scheduled: 17,
        completed: 19,
        paid: 23,
      }),
    ).toEqual({
      ENQUIRY: 5,
      PROPOSAL: 23,
      CONFIRMED: 13,
      DELIVERY: 36,
      SETTLED: 23,
    });
  });

  it("treats missing or invalid counts as zero", () => {
    expect(
      aggregateProjectStageCountsByJourney({
        new: Number.NaN,
        contacted: -2,
        quoting: Number.POSITIVE_INFINITY,
        paid: 4,
      }),
    ).toEqual({
      ENQUIRY: 0,
      PROPOSAL: 0,
      CONFIRMED: 0,
      DELIVERY: 0,
      SETTLED: 4,
    });
  });

  it("builds a deduplicated stage set for selected phase filters", () => {
    const phases: ProjectJourneyPhase[] = [
      "ENQUIRY",
      "PROPOSAL",
      "ENQUIRY",
    ];

    expect([...buildProjectJourneyStageSet(phases)]).toEqual([
      "new",
      "contacted",
      "site_visit",
      "quoting",
      "sent",
    ]);
  });

  it("builds the complete canonical stage set from all phases", () => {
    expect([...buildProjectJourneyStageSet(PROJECT_JOURNEY_PHASES)]).toEqual([
      "new",
      "contacted",
      "site_visit",
      "quoting",
      "sent",
      "deposit",
      "scheduled",
      "completed",
      "paid",
    ]);
  });
});
