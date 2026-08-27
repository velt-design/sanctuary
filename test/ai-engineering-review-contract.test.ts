// @vitest-environment node

import { describe, expect, it } from "vitest";

import { ENGINEERING_TASK_REVIEW_SCHEMA_V1 } from "../packages/ai/src/index";

function review() {
  return {
    schema: "sanctuary-engineering-review-v1",
    taskId: "eng_20260826_review_contract",
    manifestHash: `sha256:${"a".repeat(64)}`,
    verdict: "approved",
    branch: "ai/review-contract",
    baseSha: "b".repeat(40),
    headSha: "c".repeat(40),
    pullRequest: {
      number: 123,
      url: "https://github.com/velt-design/sanctuary/pull/123",
    },
    ciEvidenceHash: `sha256:${"d".repeat(64)}`,
    acceptanceResults: [
      {
        criterion: "The exact change is independently reviewed.",
        status: "passed",
        evidence: "The reviewer inspected the supplied evidence packet.",
      },
    ],
    findings: [],
    reviewer: {
      agent: "sanctuary-code-reviewer",
      model: "openai/gpt-5.6-sol",
      sessionId: "agent:sanctuary-code-reviewer:subagent:review",
      costCents: 25,
      startedAt: "2026-08-26T00:00:00.000Z",
      completedAt: "2026-08-26T00:05:00.000Z",
    },
    safety: {
      readOnly: true,
      merged: false,
      productionEffects: false,
    },
    nextAction: "Human review and merge.",
  };
}

describe("engineering review contract", () => {
  it("accepts exact read-only approval evidence", () => {
    expect(ENGINEERING_TASK_REVIEW_SCHEMA_V1.parse(review())).toEqual(review());
  });

  it("rejects approval with a failed criterion or blocking finding", () => {
    const input = review();
    input.acceptanceResults[0].status = "failed";
    input.findings.push({
      id: "finding-1",
      severity: "blocking",
      summary: "Acceptance evidence is incomplete.",
      evidence: "The required check was absent.",
      path: null,
      line: null,
    });
    expect(() => ENGINEERING_TASK_REVIEW_SCHEMA_V1.parse(input)).toThrow(
      /Invalid Sanctuary AI contract/,
    );
  });

  it("rejects mutation, merge, production, unknown fields and unsafe paths", () => {
    for (const unsafe of [
      { safety: { readOnly: false, merged: false, productionEffects: false } },
      { safety: { readOnly: true, merged: true, productionEffects: false } },
      { safety: { readOnly: true, merged: false, productionEffects: true } },
      {
        findings: [
          {
            id: "finding-1",
            severity: "advisory",
            summary: "Unsafe path.",
            evidence: "Fixture.",
            path: "../outside",
            line: 1,
          },
        ],
      },
      { unexpected: true },
    ]) {
      expect(() =>
        ENGINEERING_TASK_REVIEW_SCHEMA_V1.parse({ ...review(), ...unsafe }),
      ).toThrow(/Invalid Sanctuary AI contract/);
    }
  });

  it("requires a blocking finding when changes are requested", () => {
    expect(() =>
      ENGINEERING_TASK_REVIEW_SCHEMA_V1.parse({
        ...review(),
        verdict: "changes_requested",
      }),
    ).toThrow(/Invalid Sanctuary AI contract/);
  });
});
