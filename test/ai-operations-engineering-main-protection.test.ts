// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  FOUNDATION_CHECK,
  applyMainProtection,
  assertFoundationCheckPromotable,
  assertSoleHumanMergeAuthority,
  buildMainProtectionPolicy,
  compareMainProtection,
  expectedMainProtectionSnapshot,
} from "../scripts/ai/github-main-protection.mjs";

function apiResponse(promoteFoundation = false) {
  const expected = expectedMainProtectionSnapshot({ promoteFoundation });
  return {
    required_status_checks: {
      strict: true,
      contexts: expected.requiredChecks,
    },
    enforce_admins: { enabled: true },
    required_pull_request_reviews: {
      required_approving_review_count: 0,
      dismiss_stale_reviews: false,
      require_code_owner_reviews: false,
      require_last_push_approval: false,
      bypass_pull_request_allowances: { users: [], teams: [], apps: [] },
    },
    restrictions: null,
    required_linear_history: { enabled: true },
    allow_force_pushes: { enabled: false },
    allow_deletions: { enabled: false },
    block_creations: { enabled: false },
    required_conversation_resolution: { enabled: true },
    lock_branch: { enabled: false },
    allow_fork_syncing: { enabled: false },
  };
}

describe("hosted main protection policy", () => {
  it("requires pull requests and stable checks with no app or review bypass", () => {
    expect(buildMainProtectionPolicy()).toMatchObject({
      required_status_checks: {
        strict: true,
        contexts: ["Portal Performance Report", "Portal Quality"],
      },
      enforce_admins: true,
      required_pull_request_reviews: {
        required_approving_review_count: 0,
      },
      restrictions: null,
      allow_force_pushes: false,
      allow_deletions: false,
    });
  });

  it("promotes the stable foundation check only after it exists on main", () => {
    expect(
      buildMainProtectionPolicy({ promoteFoundation: true })
        .required_status_checks.contexts,
    ).toContain(FOUNDATION_CHECK);
    const calls: string[][] = [];
    const run = (args: string[]) => {
      calls.push(args);
      if (args[1]?.includes("actions/workflows")) {
        return {
          state: "active",
          path: ".github/workflows/autonomous-engineering.yml",
        };
      }
      return {
        check_runs: [
          {
            name: FOUNDATION_CHECK,
            status: "completed",
            conclusion: "success",
          },
        ],
      };
    };
    expect(() => assertFoundationCheckPromotable(run)).not.toThrow();
    expect(calls).toHaveLength(2);
  });

  it("refuses promotion without one successful current-main foundation check", () => {
    const run = (args: string[]) =>
      args[1]?.includes("actions/workflows")
        ? {
            state: "active",
            path: ".github/workflows/autonomous-engineering.yml",
          }
        : { check_runs: [] };
    expect(() => assertFoundationCheckPromotable(run)).toThrow(
      /has not passed exactly once/,
    );
  });

  it("detects drift in direct-push, deletion, check and bypass controls", () => {
    expect(compareMainProtection(apiResponse())).toMatchObject({
      matches: true,
    });
    const drifted = apiResponse();
    drifted.allow_force_pushes.enabled = true;
    drifted.required_pull_request_reviews.bypass_pull_request_allowances = {
      users: [],
      teams: [],
      apps: [{ slug: "sanctuary-node-pr-bot" }],
    };
    expect(compareMainProtection(drifted)).toMatchObject({
      matches: false,
      actual: {
        forcePushesAllowed: true,
        reviewBypassApps: ["sanctuary-node-pr-bot"],
      },
    });
  });

  it("writes the exact policy as one API payload", () => {
    const calls: { args: string[]; options: Record<string, any> }[] = [];
    const run = (args: string[], options: Record<string, any> = {}) => {
      calls.push({ args, options });
      if (args[1] === "repos/velt-design/sanctuary") {
        return {
          owner: { login: "velt-design", type: "User" },
          permissions: { admin: true },
        };
      }
      if (args[1]?.includes("collaborators")) {
        return [
          {
            login: "velt-design",
            type: "User",
            permissions: { admin: true, push: true },
          },
        ];
      }
      return apiResponse();
    };
    applyMainProtection({}, run);
    expect(calls).toHaveLength(3);
    expect(calls[2].args).toEqual([
      "api",
      "--method",
      "PUT",
      "repos/velt-design/sanctuary/branches/main/protection",
      "--input",
      "-",
    ]);
    expect(JSON.parse(calls[2].options.input)).toEqual(
      buildMainProtectionPolicy(),
    );
  });

  it("requires exactly one human writer on the personal repository", () => {
    const run = (args: string[]) => {
      if (args[1] === "repos/velt-design/sanctuary") {
        return {
          owner: { login: "velt-design", type: "User" },
          permissions: { admin: true },
        };
      }
      return [
        {
          login: "velt-design",
          type: "User",
          permissions: { admin: true, push: true },
        },
      ];
    };
    expect(() => assertSoleHumanMergeAuthority(run)).not.toThrow();
    expect(() =>
      assertSoleHumanMergeAuthority((args) =>
        args[1] === "repos/velt-design/sanctuary"
          ? run(args)
          : [
              ...run(args),
              {
                login: "second-writer",
                type: "User",
                permissions: { push: true },
              },
            ],
      ),
    ).toThrow(/exactly one human write authority/);
  });
});
