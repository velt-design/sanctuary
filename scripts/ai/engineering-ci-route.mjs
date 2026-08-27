import { execFileSync } from "node:child_process";
import { readFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const FOUNDATION_PATTERNS = [
  /^\.github\/workflows\/autonomous-engineering\.yml$/,
  /^infra\/openclaw\/engineering\//,
  /^packages\/ai\//,
  /^scripts\/ai\//,
  /^scripts\/worktree-ownership-report\.mjs$/,
  /^test\/ai-engineering-/,
  /^test\/ai-operations-/,
  /^docs\/ai\/README\.md$/,
  /^docs\/ai\/operations\//,
  /^docs\/decision-log\.md$/,
  /^scripts\/(?:dead-code|file-decomposition)-registry\.json$/,
  /^(?:package|package-lock)\.json$/,
  /^(?:tsconfig|vitest\.config)\.json$/,
];

export const FOUNDATION_OWNER_PATTERNS = [
  ".github/workflows/autonomous-engineering.yml",
  "infra/openclaw/engineering/**",
  "packages/ai/**",
  "scripts/ai/**",
  "scripts/worktree-ownership-report.mjs",
  "test/ai-engineering-*",
  "test/ai-operations-*",
  "docs/ai/README.md",
  "docs/ai/operations/**",
  "docs/decision-log.md",
  "scripts/*-registry.json",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vitest.config.ts",
];

function assertSha(value, label) {
  if (!SHA_PATTERN.test(value))
    throw new Error(`${label} is not an exact Git SHA.`);
  return value;
}

function gitLines(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split(/\r?\n/)
    .map((line) => line.trim().replaceAll("\\", "/"))
    .filter(Boolean);
}

export function routeEngineeringCi(changedPaths) {
  const unique = [...new Set(changedPaths)].sort();
  if (unique.length > 5_000)
    throw new Error("The CI change set is unexpectedly large.");
  for (const path of unique) {
    if (
      !path ||
      path.startsWith("/") ||
      /^[A-Za-z]:/.test(path) ||
      path.includes("\\") ||
      path.split("/").includes("..")
    ) {
      throw new Error("The CI change set contains an unsafe repository path.");
    }
  }
  const relevantPaths = unique.filter((path) =>
    FOUNDATION_PATTERNS.some((pattern) => pattern.test(path)),
  );
  return {
    schema: "sanctuary-engineering-ci-route-v1",
    mode: relevantPaths.length > 0 ? "foundation" : "not_applicable",
    relevant: relevantPaths.length > 0,
    changedPaths: unique,
    relevantPaths,
    ownerPatterns: FOUNDATION_OWNER_PATTERNS,
  };
}

export function changedPathsForEvent(event, git = gitLines) {
  if (event?.pull_request) {
    const base = assertSha(event.pull_request.base?.sha, "Pull request base");
    const head = assertSha(event.pull_request.head?.sha, "Pull request head");
    return git([
      "diff",
      "--name-only",
      "--diff-filter=ACDMRTUXB",
      `${base}...${head}`,
    ]);
  }
  if (event?.before && event?.after && !/^0+$/.test(event.before)) {
    const before = assertSha(event.before, "Push base");
    const after = assertSha(event.after, "Push head");
    return git([
      "diff",
      "--name-only",
      "--diff-filter=ACDMRTUXB",
      before,
      after,
    ]);
  }
  return git([
    "diff",
    "--name-only",
    "--diff-filter=ACDMRTUXB",
    "HEAD^",
    "HEAD",
  ]);
}

function writeOutputs(route, outputPath) {
  if (!outputPath) return;
  appendFileSync(
    outputPath,
    [
      `mode=${route.mode}`,
      `relevant=${route.relevant}`,
      `owner_patterns=${route.ownerPatterns.join(",")}`,
      `changed_count=${route.changedPaths.length}`,
      "",
    ].join("\n"),
  );
}

function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const event = eventPath ? JSON.parse(readFileSync(eventPath, "utf8")) : {};
  const route = routeEngineeringCi(changedPathsForEvent(event));
  writeOutputs(route, process.env.GITHUB_OUTPUT);
  console.log(JSON.stringify(route, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(`Engineering CI route: ERROR - ${error.message}`);
    process.exitCode = 1;
  }
}
