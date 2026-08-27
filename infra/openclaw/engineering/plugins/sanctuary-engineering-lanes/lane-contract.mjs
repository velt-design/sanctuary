import { randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

export const ENGINEERING_LANE_OWNER_SCHEMA =
  "sanctuary-engineering-lane-owner-v1";
export const ENGINEERING_RUNTIME_PROFILE = "sanctuary-engineering";
export const ENGINEERING_REPOSITORY = "velt-design/sanctuary";
export const ENGINEERING_REMOTE_URL =
  "https://github.com/velt-design/sanctuary.git";

const TASK_ID_PATTERN = /^eng_[0-9]{8}_[a-z0-9][a-z0-9_-]{2,63}$/;
const MANIFEST_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

export function assertTaskIdentity(taskId, manifestHash) {
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error("The task id is not a valid engineering task id.");
  }
  if (!MANIFEST_HASH_PATTERN.test(manifestHash)) {
    throw new Error("The manifest hash is not a canonical SHA-256 identity.");
  }
}

export function ensurePrivateDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
}

export function assertPrivateDirectory(path, label) {
  const stats = lstatSync(path);
  if (
    !stats.isDirectory() ||
    stats.isSymbolicLink() ||
    resolve(realpathSync(path)) !== resolve(path) ||
    (process.platform !== "win32" && (stats.mode & 0o077) !== 0)
  ) {
    throw new Error(`${label} is not a private, non-symlink directory.`);
  }
}

export function writeProtectedAtomic(path, content, mode = 0o600) {
  ensurePrivateDirectory(dirname(path));
  const temporaryPath = `${path}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
  writeFileSync(temporaryPath, content, { encoding: "utf8", mode });
  chmodSync(temporaryPath, mode);
  renameSync(temporaryPath, path);
  chmodSync(path, mode);
}

export function writeProtectedJson(path, value) {
  writeProtectedAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function readProtectedJson(path, label) {
  const stats = statSync(path);
  if (
    !stats.isFile() ||
    (process.platform !== "win32" && (stats.mode & 0o077) !== 0)
  ) {
    throw new Error(`${label} is missing or readable outside its owner.`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

export function assertPathInside(root, candidate, label) {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  const pathFromRoot = relative(resolvedRoot, resolvedCandidate);
  if (
    !pathFromRoot ||
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${sep}`) ||
    resolve(resolvedRoot, pathFromRoot) !== resolvedCandidate
  ) {
    throw new Error(`${label} is outside its dedicated engineering root.`);
  }
  return resolvedCandidate;
}

export function resolveLanePaths({ stateDir, taskId }) {
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error("The task id is not a valid engineering task id.");
  }
  const workerRoot = join(stateDir, "workspaces", "worker");
  const tasksRoot = join(workerRoot, "tasks");
  const laneRoot = assertPathInside(
    tasksRoot,
    join(tasksRoot, taskId),
    "Task lane",
  );
  return {
    stateDir,
    workerRoot,
    tasksRoot,
    laneRoot,
    worktreePath: join(laneRoot, "repo"),
    ownerPath: join(laneRoot, "owner.json"),
    manifestPath: join(laneRoot, "manifest.json"),
    promptPath: join(laneRoot, "worker-prompt.md"),
    leasePath: join(tasksRoot, "active-lane.json"),
    runtimeOwnerPath: join(stateDir, "sanctuary-engineering-owner.json"),
  };
}

function runContractCommand(repoRoot, command, path) {
  const tsxCli = join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const contractCli = join(
    repoRoot,
    "scripts",
    "ai",
    "engineering-contract.ts",
  );
  if (!existsSync(tsxCli) || !existsSync(contractCli)) {
    throw new Error(
      "The controller checkout is missing the pinned contract runtime.",
    );
  }
  const execution = spawnSync(
    process.execPath,
    [tsxCli, contractCli, command, path],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (execution.status !== 0) {
    throw new Error(
      `Engineering contract ${command} failed: ${execution.stderr.trim() || "invalid task"}`,
    );
  }
  return execution.stdout;
}

function withTemporaryManifest(stateDir, manifest, operation) {
  const temporaryRoot = join(stateDir, "tmp");
  ensurePrivateDirectory(temporaryRoot);
  const path = join(
    temporaryRoot,
    `manifest-${process.pid}-${randomBytes(8).toString("hex")}.json`,
  );
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  try {
    return operation(path);
  } finally {
    rmSync(path, { force: true });
  }
}

export const defaultContractAdapter = Object.freeze({
  resolve(manifest, { repoRoot, stateDir }) {
    return withTemporaryManifest(stateDir, manifest, (path) => {
      const output = runContractCommand(repoRoot, "resolve-task", path);
      return JSON.parse(output);
    });
  },
  render(manifest, { repoRoot, stateDir }) {
    return withTemporaryManifest(stateDir, manifest, (path) =>
      runContractCommand(repoRoot, "render-worker-prompt", path),
    );
  },
  validateCompletion(completion, { repoRoot, stateDir }) {
    return withTemporaryManifest(stateDir, completion, (path) => {
      runContractCommand(repoRoot, "validate-completion", path);
      return completion;
    });
  },
  validateReview(review, { repoRoot, stateDir }) {
    return withTemporaryManifest(stateDir, review, (path) => {
      runContractCommand(repoRoot, "validate-review", path);
      return review;
    });
  },
});

export function buildBoundWorkerPrompt({
  manifest,
  manifestHash,
  worktreePath,
  canonicalPrompt,
}) {
  return (
    `# Bound engineering lane\n\n` +
    `Task: \`${manifest.taskId}\`\n\n` +
    `Manifest: \`${manifestHash}\`\n\n` +
    `Assigned worktree: \`${worktreePath}\`\n\n` +
    `Start by changing directory to the assigned worktree and confirming ` +
    `that \`git branch --show-current\` is exactly \`${manifest.branch}\`. ` +
    `Do not create, attach, remove, or switch worktrees yourself. Before ` +
    `editing, call \`sanctuary_engineering_lane_status\` with this task id ` +
    `and manifest hash. After focused checks and a clean commit, call ` +
    `\`sanctuary_engineering_lane_publish\`; do not obtain or print a GitHub ` +
    `token and do not use a raw merge or deployment command.\n\n` +
    canonicalPrompt
  );
}

function globToRegExp(pattern) {
  let expression = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    const next = pattern[index + 1];
    if (character === "*" && next === "*") {
      const after = pattern[index + 2];
      if (after === "/") {
        expression += "(?:.*/)?";
        index += 2;
      } else {
        expression += ".*";
        index += 1;
      }
    } else if (character === "*") {
      expression += "[^/]*";
    } else if (character === "?") {
      expression += "[^/]";
    } else {
      expression += character.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  return new RegExp(`${expression}$`);
}

export function matchesRepoPattern(path, pattern) {
  return globToRegExp(pattern).test(path);
}

export function assertChangedPathsOwned(changedPaths, manifest) {
  const violations = changedPaths.filter((path) => {
    const excluded = manifest.excludedPaths.some((pattern) =>
      matchesRepoPattern(path, pattern),
    );
    const owned = manifest.ownedPaths.some((pattern) =>
      matchesRepoPattern(path, pattern),
    );
    return excluded || !owned;
  });
  if (violations.length > 0) {
    throw new Error(
      `Changed paths are outside the manifest lane: ${violations.join(", ")}`,
    );
  }
}

export function createExclusiveProtectedJson(path, value) {
  ensurePrivateDirectory(dirname(path));
  const descriptor = openSync(path, "wx", 0o600);
  try {
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  } finally {
    closeSync(descriptor);
  }
  chmodSync(path, 0o600);
}
