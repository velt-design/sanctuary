import { createHash } from "node:crypto";

import { createGitRuntime } from "./lane-git.mjs";

const REPOSITORY = "velt-design/sanctuary";
const AI_FOUNDATION_CHECK = "AI Foundation / Provider-neutral contracts";
const AI_FOUNDATION_WORKFLOW = "ai-foundation.yml";
const TRANSIENT_CONCLUSIONS = new Set([
  "ACTION_REQUIRED",
  "CANCELLED",
  "STALE",
  "STARTUP_FAILURE",
  "TIMED_OUT",
]);
const BLOCKED_CONCLUSIONS = new Set(["NEUTRAL", "SKIPPED"]);
const TRANSIENT_LOG_PATTERNS = [
  /runner (?:has )?(?:lost communication|received a shutdown signal)/i,
  /the operation was canceled/i,
  /ECONNRESET|ETIMEDOUT|EAI_AGAIN/i,
  /502 Bad Gateway|503 Service Unavailable|504 Gateway Timeout/i,
];

function hashJson(value) {
  return `sha256:${createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`)
    .digest("hex")}`;
}

function parseJson(output, label) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${label} did not return valid JSON.`);
  }
}

function runIdFromUrl(url) {
  if (typeof url !== "string") return null;
  const match = url.match(
    /^https:\/\/github\.com\/velt-design\/sanctuary\/actions\/runs\/([1-9][0-9]*)(?:\/job\/[1-9][0-9]*)?(?:\?.*)?$/,
  );
  return match?.[1] ?? null;
}

function normalizeCheck(raw) {
  if (raw?.__typename === "CheckRun") {
    const name = raw.name;
    if (typeof name !== "string" || !name || name.length > 200) {
      throw new Error("GitHub returned an invalid check-run name.");
    }
    return {
      name,
      kind: "check_run",
      status: raw.status ?? null,
      conclusion: raw.conclusion ?? null,
      url: raw.detailsUrl || null,
      workflowName: raw.workflowName || null,
      runId: runIdFromUrl(raw.detailsUrl),
      startedAt: raw.startedAt ?? null,
      completedAt: raw.completedAt ?? null,
    };
  }
  if (raw?.__typename === "StatusContext") {
    const name = raw.context;
    if (typeof name !== "string" || !name || name.length > 200) {
      throw new Error("GitHub returned an invalid status-context name.");
    }
    return {
      name,
      kind: "status_context",
      status: raw.state ?? null,
      conclusion: raw.state ?? null,
      url: raw.targetUrl || null,
      workflowName: null,
      runId: runIdFromUrl(raw.targetUrl),
      startedAt: null,
      completedAt: null,
    };
  }
  throw new Error("GitHub returned an unknown status-check shape.");
}

function signaturePairs(log) {
  const expected = [...log.matchAll(/Expected:\s*([^\r\n]+)/g)].map((match) =>
    match[1].trim(),
  );
  const received = [...log.matchAll(/Received:\s*([^\r\n]+)/g)].map((match) =>
    match[1].trim(),
  );
  return expected
    .slice(0, received.length)
    .map((value, index) => `${value}\u0000${received[index]}`);
}

export function classifyFailureLog(log) {
  if (typeof log !== "string" || log.length > 2_000_000) {
    return {
      disposition: "actionable",
      reason: "No bounded failure log was available.",
    };
  }
  if (TRANSIENT_LOG_PATTERNS.some((pattern) => pattern.test(log))) {
    return {
      disposition: "transient",
      reason:
        "The failed run contains a recognized runner or network interruption.",
    };
  }
  const pairs = signaturePairs(log);
  if (log.includes("Retry #") && new Set(pairs).size > 1) {
    return {
      disposition: "transient",
      reason:
        "The original and built-in retry failed with different assertions, so one workflow rerun is allowed as suspected flakiness.",
    };
  }
  return {
    disposition: "actionable",
    reason:
      "The failed check needs a same-lane coding-worker diagnosis or repair.",
  };
}

function checkLifecycle(check) {
  if (check.kind === "check_run" && check.status !== "COMPLETED") {
    return {
      disposition: "pending",
      reason: "The required check is still running.",
    };
  }
  if (
    check.kind === "status_context" &&
    ["EXPECTED", "PENDING"].includes(check.status)
  ) {
    return {
      disposition: "pending",
      reason: "The required status is still pending.",
    };
  }
  if (check.conclusion === "SUCCESS") {
    return { disposition: "passed", reason: "The required check passed." };
  }
  if (check.conclusion === "FAILURE") {
    return { disposition: "failure", reason: "The required check failed." };
  }
  if (TRANSIENT_CONCLUSIONS.has(check.conclusion)) {
    return {
      disposition: "transient",
      reason: `The required check ended ${String(check.conclusion).toLowerCase()}.`,
    };
  }
  if (check.conclusion === "ERROR") {
    return {
      disposition: "transient",
      reason: "The status provider returned an error.",
    };
  }
  if (BLOCKED_CONCLUSIONS.has(check.conclusion)) {
    return {
      disposition: "blocked",
      reason: `The required check ended ${String(check.conclusion).toLowerCase()}.`,
    };
  }
  return {
    disposition: "blocked",
    reason: "The required check has an unknown terminal state.",
  };
}

function assertPullRequestIdentity(pullRequest, manifest, completion) {
  if (
    pullRequest?.number !== completion.pullRequest?.number ||
    pullRequest?.url !== completion.pullRequest?.url ||
    pullRequest?.state !== "OPEN" ||
    pullRequest?.isDraft !== true ||
    pullRequest?.headRefName !== manifest.branch ||
    pullRequest?.headRefOid !== completion.headSha ||
    pullRequest?.baseRefName !== manifest.base.ref ||
    pullRequest?.baseRefOid !== manifest.base.sha ||
    !Array.isArray(pullRequest?.statusCheckRollup)
  ) {
    throw new Error(
      "GitHub CI evidence does not match the exact open draft pull request.",
    );
  }
}

export function createGitHubCiRuntime(options = {}) {
  const git =
    options.gitRuntime ??
    createGitRuntime({
      repoRoot: options.repoRoot,
      stateDir: options.stateDir,
      environment: options.environment,
    });

  function pullRequest(number) {
    if (!Number.isSafeInteger(number) || number < 1) {
      throw new Error("The CI pull request number is invalid.");
    }
    return parseJson(
      git.safeGh([
        "pr",
        "view",
        String(number),
        "--repo",
        REPOSITORY,
        "--json",
        "number,url,state,isDraft,baseRefName,baseRefOid,headRefName,headRefOid,statusCheckRollup",
      ]).stdout,
      "GitHub pull-request evidence",
    );
  }

  function failureLog(runId) {
    if (!/^[1-9][0-9]*$/.test(runId)) {
      throw new Error("The workflow run id is invalid.");
    }
    return git.safeGh([
      "run",
      "view",
      runId,
      "--repo",
      REPOSITORY,
      "--log-failed",
    ]).stdout;
  }

  function inspect({ manifest, completion }) {
    if (!completion?.pullRequest || !completion.headSha) {
      throw new Error(
        "CI inspection requires successful worker pull-request evidence.",
      );
    }
    const pr = pullRequest(completion.pullRequest.number);
    assertPullRequestIdentity(pr, manifest, completion);
    const requiredNames = manifest.verification.ciChecks;
    const allChecks = pr.statusCheckRollup.map(normalizeCheck);
    const requiredChecks = requiredNames.map((name) => {
      const matches = allChecks.filter((check) => check.name === name);
      if (matches.length > 1) {
        throw new Error(
          `GitHub returned duplicate required check evidence for ${name}.`,
        );
      }
      if (matches.length === 0) {
        return {
          name,
          kind: "missing",
          status: null,
          conclusion: null,
          url: null,
          workflowName: null,
          runId: null,
          startedAt: null,
          completedAt: null,
          disposition: "pending",
          reason: "The required check has not appeared for this exact head.",
        };
      }
      return { ...matches[0], ...checkLifecycle(matches[0]) };
    });
    for (const check of requiredChecks) {
      if (check.disposition !== "failure") continue;
      const logResult = check.runId
        ? classifyFailureLog(failureLog(check.runId))
        : {
            disposition: "actionable",
            reason: "The failed status has no exact Actions run log.",
          };
      check.disposition = logResult.disposition;
      check.reason = logResult.reason;
    }
    let classification = "passed";
    if (requiredChecks.some((check) => check.disposition === "blocked")) {
      classification = "blocked";
    } else if (
      requiredChecks.some((check) => check.disposition === "pending")
    ) {
      classification = "pending";
    } else if (
      requiredChecks.some((check) => check.disposition === "actionable")
    ) {
      classification = "repair_required";
    } else if (
      requiredChecks.some((check) => check.disposition === "transient")
    ) {
      classification = "transient";
    }
    const evidence = {
      schema: "sanctuary-engineering-ci-evidence-v1",
      repository: REPOSITORY,
      pullRequest: {
        number: pr.number,
        url: pr.url,
        baseRef: pr.baseRefName,
        baseSha: pr.baseRefOid,
        headRef: pr.headRefName,
        headSha: pr.headRefOid,
        draft: pr.isDraft,
      },
      requiredChecks,
      classification,
    };
    return { ...evidence, evidenceHash: hashJson(evidence) };
  }

  function diff(evidence) {
    const number = evidence?.pullRequest?.number;
    if (!Number.isSafeInteger(number) || number < 1) {
      throw new Error("The review evidence has no exact pull request.");
    }
    const output = git.safeGh([
      "pr",
      "diff",
      String(number),
      "--repo",
      REPOSITORY,
      "--patch",
    ]).stdout;
    if (!output || Buffer.byteLength(output, "utf8") > 150_000) {
      throw new Error(
        "The pull-request diff is empty or too large for bounded autonomous review.",
      );
    }
    const current = pullRequest(number);
    if (
      current.headRefOid !== evidence.pullRequest.headSha ||
      current.baseRefOid !== evidence.pullRequest.baseSha ||
      current.state !== "OPEN" ||
      current.isDraft !== true
    ) {
      throw new Error(
        "The pull request changed while review evidence was being assembled.",
      );
    }
    return output;
  }

  function dispatchMissing({ manifest, completion, evidence }) {
    if (
      evidence?.classification !== "pending" ||
      evidence.requiredChecks?.length !== 1 ||
      evidence.requiredChecks[0]?.name !== AI_FOUNDATION_CHECK ||
      evidence.requiredChecks[0]?.kind !== "missing" ||
      manifest?.verification?.ciChecks?.length !== 1 ||
      manifest.verification.ciChecks[0] !== AI_FOUNDATION_CHECK
    ) {
      return null;
    }
    const pr = pullRequest(completion.pullRequest.number);
    assertPullRequestIdentity(pr, manifest, completion);
    git.safeGh([
      "workflow",
      "run",
      AI_FOUNDATION_WORKFLOW,
      "--repo",
      REPOSITORY,
      "--ref",
      manifest.branch,
    ]);
    return {
      workflow: AI_FOUNDATION_WORKFLOW,
      branch: manifest.branch,
      headSha: completion.headSha,
    };
  }

  function rerunTransient(evidence) {
    if (evidence?.classification !== "transient") {
      throw new Error("Only transient CI evidence can request a rerun.");
    }
    const runIds = [
      ...new Set(
        evidence.requiredChecks
          .filter((check) => check.disposition === "transient")
          .map((check) => check.runId)
          .filter(Boolean),
      ),
    ];
    if (runIds.length < 1 || runIds.length > 10) {
      throw new Error(
        "Transient CI evidence does not identify a bounded workflow run.",
      );
    }
    for (const runId of runIds) {
      git.safeGh(["run", "rerun", runId, "--failed", "--repo", REPOSITORY]);
    }
    return runIds;
  }

  return Object.freeze({ inspect, diff, dispatchMissing, rerunTransient });
}
