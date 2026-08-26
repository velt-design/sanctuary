import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

import {
  ENGINEERING_LANE_OWNER_SCHEMA,
  ENGINEERING_RUNTIME_PROFILE,
  assertChangedPathsOwned,
  assertPathInside,
  assertPrivateDirectory,
  assertTaskIdentity,
  buildBoundWorkerPrompt,
  createExclusiveProtectedJson,
  defaultContractAdapter,
  ensurePrivateDirectory,
  readProtectedJson,
  resolveLanePaths,
  writeProtectedAtomic,
  writeProtectedJson,
} from "./lane-contract.mjs";
import { createGitRuntime } from "./lane-git.mjs";

const OWNER_STATES = new Set([
  "provisioning",
  "active",
  "published",
  "worktree_removed",
]);

function timestamp(now) {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error("The lane clock returned an invalid timestamp.");
  }
  return date.toISOString();
}

function assertRuntimeOwner(paths) {
  assertPrivateDirectory(paths.stateDir, "Engineering state directory");
  const owner = readProtectedJson(
    paths.runtimeOwnerPath,
    "Engineering runtime owner",
  );
  if (
    owner.schemaVersion !== 1 ||
    owner.profile !== ENGINEERING_RUNTIME_PROFILE
  ) {
    throw new Error(
      "The state directory is not owned by the engineering runtime.",
    );
  }
}

function assertOwnerRecord(owner, { manifest, manifestHash, paths, repoRoot }) {
  if (
    owner.schema !== ENGINEERING_LANE_OWNER_SCHEMA ||
    !OWNER_STATES.has(owner.state) ||
    owner.profile !== ENGINEERING_RUNTIME_PROFILE ||
    owner.taskId !== manifest.taskId ||
    owner.goalId !== manifest.goalId ||
    owner.manifestHash !== manifestHash ||
    owner.branch !== manifest.branch ||
    owner.baseRef !== manifest.base.ref ||
    owner.baseSha !== manifest.base.sha ||
    resolve(owner.controllerRepoRoot) !== resolve(repoRoot) ||
    resolve(owner.worktreePath) !== resolve(paths.worktreePath)
  ) {
    throw new Error("The existing lane owner does not match this manifest.");
  }
  assertPathInside(paths.tasksRoot, owner.worktreePath, "Owned worktree");
  return owner;
}

function buildOwner({ manifest, manifestHash, paths, repoRoot, now }) {
  const createdAt = timestamp(now);
  return {
    schema: ENGINEERING_LANE_OWNER_SCHEMA,
    profile: ENGINEERING_RUNTIME_PROFILE,
    state: "provisioning",
    taskId: manifest.taskId,
    goalId: manifest.goalId,
    manifestHash,
    branch: manifest.branch,
    baseRef: manifest.base.ref,
    baseSha: manifest.base.sha,
    controllerRepoRoot: resolve(repoRoot),
    worktreePath: resolve(paths.worktreePath),
    createdAt,
    updatedAt: createdAt,
    headSha: null,
    pullRequest: null,
  };
}

function readLease(paths) {
  if (!existsSync(paths.leasePath)) return null;
  return readProtectedJson(paths.leasePath, "Engineering lane lease");
}

function acquireLease(paths, manifest, manifestHash, now) {
  ensurePrivateDirectory(paths.tasksRoot);
  assertPrivateDirectory(paths.tasksRoot, "Engineering task root");
  const existing = readLease(paths);
  if (existing) {
    if (
      existing.taskId === manifest.taskId &&
      existing.manifestHash === manifestHash
    ) {
      return false;
    }
    throw new Error(
      `Another engineering lane is active: ${existing.taskId ?? "unknown"}.`,
    );
  }
  createExclusiveProtectedJson(paths.leasePath, {
    schema: "sanctuary-engineering-lane-lease-v1",
    taskId: manifest.taskId,
    manifestHash,
    acquiredAt: timestamp(now),
  });
  return true;
}

function releaseLease(paths, manifest, manifestHash) {
  const existing = readLease(paths);
  if (!existing) return false;
  if (
    existing.taskId !== manifest.taskId ||
    existing.manifestHash !== manifestHash
  ) {
    throw new Error("Refusing to remove another engineering lane's lease.");
  }
  rmSync(paths.leasePath);
  return true;
}

function resolveController(options) {
  const repoRoot =
    options.repoRoot ?? process.env.SANCTUARY_ENGINEERING_REPO_ROOT;
  const stateDir = options.stateDir ?? process.env.OPENCLAW_STATE_DIR;
  if (!repoRoot || !stateDir) {
    throw new Error(
      "SANCTUARY_ENGINEERING_REPO_ROOT and OPENCLAW_STATE_DIR are required.",
    );
  }
  const now = options.now ?? (() => new Date());
  const contractAdapter = options.contractAdapter ?? defaultContractAdapter;
  const git =
    options.gitRuntime ??
    createGitRuntime({
      repoRoot,
      stateDir,
      expectedRemoteUrl: options.expectedRemoteUrl,
      authenticated: options.authenticatedGit ?? true,
      environment: options.environment,
    });
  return { repoRoot: git.repoRoot, stateDir, now, contractAdapter, git };
}

function resolveManifest(manifestInput, controller) {
  const resolved = controller.contractAdapter.resolve(manifestInput, {
    repoRoot: controller.repoRoot,
    stateDir: controller.stateDir,
  });
  const { manifest, manifestHash } = resolved;
  assertTaskIdentity(manifest.taskId, manifestHash);
  controller.git.assertBranchName(manifest.base.ref, "Base ref");
  controller.git.assertBranchName(manifest.branch, "Feature branch");
  if (manifest.branch === manifest.base.ref) {
    throw new Error("The feature branch must differ from its base branch.");
  }
  return { manifest, manifestHash };
}

function inspectOwnedWorktree(controller, paths, manifest) {
  const registered = controller.git.findWorktree(paths.worktreePath);
  if (!registered) {
    throw new Error("The owned worktree is not registered with Git.");
  }
  if (registered.branch !== `refs/heads/${manifest.branch}`) {
    throw new Error("The owned worktree is attached to the wrong branch.");
  }
  const status = controller.git.inspectWorktree(
    paths.worktreePath,
    manifest.base.sha,
  );
  if (
    resolve(status.path) !== resolve(paths.worktreePath) ||
    status.branch !== manifest.branch
  ) {
    throw new Error("The owned worktree identity does not match the manifest.");
  }
  return status;
}

function laneResult({ owner, status, paths, workerPrompt, resumed }) {
  return {
    taskId: owner.taskId,
    manifestHash: owner.manifestHash,
    state: owner.state,
    branch: owner.branch,
    baseSha: owner.baseSha,
    headSha: status?.headSha ?? owner.headSha,
    worktreePath: owner.worktreePath,
    clean: status?.clean ?? null,
    changedPaths: status?.changedPaths ?? [],
    pullRequest: owner.pullRequest,
    promptPath: paths.promptPath,
    workerPrompt,
    resumed,
  };
}

function writeLaneFiles(controller, paths, manifest, manifestHash) {
  const canonicalPrompt = controller.contractAdapter.render(manifest, {
    repoRoot: controller.repoRoot,
    stateDir: controller.stateDir,
  });
  const workerPrompt = buildBoundWorkerPrompt({
    manifest,
    manifestHash,
    worktreePath: paths.worktreePath,
    canonicalPrompt,
  });
  writeProtectedJson(paths.manifestPath, manifest);
  writeProtectedAtomic(paths.promptPath, workerPrompt);
  return workerPrompt;
}

function resumeOwnedLane(controller, paths, manifest, manifestHash, owner) {
  if (owner.state === "worktree_removed") {
    return laneResult({
      owner,
      status: null,
      paths,
      workerPrompt: null,
      resumed: true,
    });
  }
  if (existsSync(paths.worktreePath)) {
    if (owner.state !== "published") {
      acquireLease(paths, manifest, manifestHash, controller.now);
    }
    const status = inspectOwnedWorktree(controller, paths, manifest);
    if (owner.state === "provisioning") {
      const nextOwner = {
        ...owner,
        state: "active",
        updatedAt: timestamp(controller.now),
        headSha: status.headSha,
      };
      writeProtectedJson(paths.ownerPath, nextOwner);
      return laneResult({
        owner: nextOwner,
        status,
        paths,
        workerPrompt: readPrompt(paths),
        resumed: true,
      });
    }
    return laneResult({
      owner,
      status,
      paths,
      workerPrompt: readPrompt(paths),
      resumed: true,
    });
  }

  if (owner.state === "published") {
    return laneResult({
      owner,
      status: null,
      paths,
      workerPrompt: null,
      resumed: true,
    });
  }

  acquireLease(paths, manifest, manifestHash, controller.now);
  const localHead = controller.git.localBranchHead(manifest.branch);
  const expectedHead = owner.headSha ?? manifest.base.sha;
  if (localHead && localHead !== expectedHead) {
    throw new Error("The detached lane branch moved beyond its owner record.");
  }
  if (localHead) {
    controller.git.attachWorktree(paths.worktreePath, manifest.branch);
  } else {
    controller.git.fetchExactBase(manifest.base);
    controller.git.addNewWorktree(
      paths.worktreePath,
      manifest.branch,
      manifest.base.sha,
    );
  }
  const status = inspectOwnedWorktree(controller, paths, manifest);
  const nextOwner = {
    ...owner,
    state: "active",
    updatedAt: timestamp(controller.now),
    headSha: status.headSha,
  };
  writeProtectedJson(paths.ownerPath, nextOwner);
  return laneResult({
    owner: nextOwner,
    status,
    paths,
    workerPrompt: readPrompt(paths),
    resumed: true,
  });
}

function readPrompt(paths) {
  return existsSync(paths.promptPath)
    ? readProtectedText(paths.promptPath, "Bound worker prompt")
    : null;
}

function readProtectedText(path, label) {
  const stats = statSync(path);
  if (
    !stats.isFile() ||
    (process.platform !== "win32" && (stats.mode & 0o077) !== 0)
  ) {
    throw new Error(`${label} is missing or readable outside its owner.`);
  }
  return readFileSync(path, "utf8");
}

export function provisionEngineeringLane(manifestInput, options = {}) {
  const controller = resolveController(options);
  const { manifest, manifestHash } = resolveManifest(manifestInput, controller);
  const paths = resolveLanePaths({
    stateDir: controller.stateDir,
    taskId: manifest.taskId,
  });
  assertRuntimeOwner(paths);
  controller.git.assertSourceRepository();

  if (existsSync(paths.ownerPath)) {
    assertPrivateDirectory(paths.laneRoot, "Engineering task lane");
    const owner = assertOwnerRecord(
      readProtectedJson(paths.ownerPath, "Engineering lane owner"),
      { manifest, manifestHash, paths, repoRoot: controller.repoRoot },
    );
    return resumeOwnedLane(controller, paths, manifest, manifestHash, owner);
  }

  if (existsSync(paths.laneRoot)) {
    throw new Error("An unowned task lane already exists.");
  }
  if (controller.git.localBranchHead(manifest.branch)) {
    throw new Error(
      "An unowned local branch already uses the manifest branch.",
    );
  }
  if (controller.git.remoteBranchHead(manifest.branch)) {
    throw new Error(
      "An unowned remote branch already uses the manifest branch.",
    );
  }

  acquireLease(paths, manifest, manifestHash, controller.now);
  try {
    controller.git.fetchExactBase(manifest.base);
    ensurePrivateDirectory(paths.laneRoot);
    assertPrivateDirectory(paths.laneRoot, "Engineering task lane");
    const workerPrompt = writeLaneFiles(
      controller,
      paths,
      manifest,
      manifestHash,
    );
    let owner = buildOwner({
      manifest,
      manifestHash,
      paths,
      repoRoot: controller.repoRoot,
      now: controller.now,
    });
    writeProtectedJson(paths.ownerPath, owner);
    controller.git.addNewWorktree(
      paths.worktreePath,
      manifest.branch,
      manifest.base.sha,
    );
    const status = inspectOwnedWorktree(controller, paths, manifest);
    owner = {
      ...owner,
      state: "active",
      updatedAt: timestamp(controller.now),
      headSha: status.headSha,
    };
    writeProtectedJson(paths.ownerPath, owner);
    return laneResult({
      owner,
      status,
      paths,
      workerPrompt,
      resumed: false,
    });
  } catch (error) {
    releaseLease(paths, manifest, manifestHash);
    throw error;
  }
}

export function adoptPublishedEngineeringLane(manifestInput, options = {}) {
  const controller = resolveController(options);
  const { manifest, manifestHash } = resolveManifest(manifestInput, controller);
  const paths = resolveLanePaths({
    stateDir: controller.stateDir,
    taskId: manifest.taskId,
  });
  assertRuntimeOwner(paths);
  controller.git.assertSourceRepository();

  if (existsSync(paths.ownerPath)) {
    const owner = assertOwnerRecord(
      readProtectedJson(paths.ownerPath, "Engineering lane owner"),
      { manifest, manifestHash, paths, repoRoot: controller.repoRoot },
    );
    return resumeOwnedLane(controller, paths, manifest, manifestHash, owner);
  }
  if (existsSync(paths.laneRoot)) {
    throw new Error("An unowned task lane already exists.");
  }

  const remoteHead = controller.git.remoteBranchHead(manifest.branch);
  if (!remoteHead) {
    throw new Error("The published feature branch does not exist remotely.");
  }
  const fetchedHead = controller.git.fetchRemoteBranch(manifest.branch);
  if (fetchedHead !== remoteHead) {
    throw new Error(
      "The fetched feature branch does not match its remote head.",
    );
  }
  if (!controller.git.isAncestor(manifest.base.sha, remoteHead)) {
    throw new Error(
      "The published branch does not descend from its manifest base.",
    );
  }
  const changedPaths = controller.git.changedPathsBetween(
    manifest.base.sha,
    remoteHead,
  );
  if (changedPaths.length === 0) {
    throw new Error("The published branch has no committed manifest change.");
  }
  assertChangedPathsOwned(changedPaths, manifest);

  const pullRequest = controller.git.findOpenPullRequest(manifest.branch);
  assertDraftPullRequest(pullRequest, manifest);
  const localHead = controller.git.localBranchHead(manifest.branch);
  if (localHead && localHead !== remoteHead) {
    throw new Error("The local feature branch differs from the remote draft.");
  }

  acquireLease(paths, manifest, manifestHash, controller.now);
  ensurePrivateDirectory(paths.laneRoot);
  assertPrivateDirectory(paths.laneRoot, "Engineering task lane");
  const workerPrompt = writeLaneFiles(
    controller,
    paths,
    manifest,
    manifestHash,
  );
  const initialOwner = {
    ...buildOwner({
      manifest,
      manifestHash,
      paths,
      repoRoot: controller.repoRoot,
      now: controller.now,
    }),
    headSha: remoteHead,
  };
  writeProtectedJson(paths.ownerPath, initialOwner);
  if (localHead) {
    controller.git.attachWorktree(paths.worktreePath, manifest.branch);
  } else {
    controller.git.addNewWorktree(
      paths.worktreePath,
      manifest.branch,
      remoteHead,
    );
  }
  const status = inspectOwnedWorktree(controller, paths, manifest);
  if (
    !status.clean ||
    status.headSha !== remoteHead ||
    JSON.stringify(status.changedPaths) !== JSON.stringify(changedPaths)
  ) {
    throw new Error("The adopted worktree does not match the reviewed draft.");
  }
  const owner = {
    ...initialOwner,
    state: "published",
    updatedAt: timestamp(controller.now),
    pullRequest: {
      number: pullRequest.number,
      url: pullRequest.url,
      draft: true,
    },
  };
  writeProtectedJson(paths.ownerPath, owner);
  releaseLease(paths, manifest, manifestHash);
  return laneResult({
    owner,
    status,
    paths,
    workerPrompt,
    resumed: false,
  });
}

function resolveOwnedLane(taskId, manifestHash, options) {
  assertTaskIdentity(taskId, manifestHash);
  const controller = resolveController(options);
  const paths = resolveLanePaths({ stateDir: controller.stateDir, taskId });
  assertRuntimeOwner(paths);
  controller.git.assertSourceRepository();
  assertPrivateDirectory(paths.laneRoot, "Engineering task lane");
  if (!existsSync(paths.ownerPath) || !existsSync(paths.manifestPath)) {
    throw new Error("The engineering lane does not exist.");
  }
  const storedManifest = readProtectedJson(
    paths.manifestPath,
    "Engineering task manifest",
  );
  const resolved = resolveManifest(storedManifest, controller);
  if (resolved.manifestHash !== manifestHash) {
    throw new Error(
      "The stored manifest no longer matches its bound identity.",
    );
  }
  const manifest = resolved.manifest;
  const owner = assertOwnerRecord(
    readProtectedJson(paths.ownerPath, "Engineering lane owner"),
    { manifest, manifestHash, paths, repoRoot: controller.repoRoot },
  );
  return { controller, paths, manifest, owner };
}

export function statusEngineeringLane(taskId, manifestHash, options = {}) {
  const { controller, paths, manifest, owner } = resolveOwnedLane(
    taskId,
    manifestHash,
    options,
  );
  const status = existsSync(paths.worktreePath)
    ? inspectOwnedWorktree(controller, paths, manifest)
    : null;
  if (owner.state === "published") {
    if (
      !status ||
      status.headSha !== owner.headSha ||
      controller.git.remoteBranchHead(manifest.branch) !== owner.headSha
    ) {
      throw new Error(
        "The published lane no longer matches its recorded local and remote head.",
      );
    }
    const pullRequest = controller.git.findOpenPullRequest(manifest.branch);
    assertDraftPullRequest(pullRequest, manifest);
    if (
      pullRequest.number !== owner.pullRequest?.number ||
      pullRequest.url !== owner.pullRequest?.url
    ) {
      throw new Error(
        "The published lane no longer matches its recorded draft pull request.",
      );
    }
  }
  return laneResult({
    owner,
    status,
    paths,
    workerPrompt: null,
    resumed: true,
  });
}

function assertPublishText(title, body) {
  if (
    typeof title !== "string" ||
    title.trim() !== title ||
    title.length < 5 ||
    title.length > 200 ||
    /[\u0000-\u001f\u007f]/.test(title)
  ) {
    throw new Error("The draft pull request title is invalid.");
  }
  if (
    typeof body !== "string" ||
    body.length < 20 ||
    body.length > 30_000 ||
    body.includes("\u0000")
  ) {
    throw new Error("The draft pull request body is invalid.");
  }
}

function assertDraftPullRequest(pullRequest, manifest) {
  if (
    !pullRequest ||
    pullRequest.isDraft !== true ||
    pullRequest.headRefName !== manifest.branch ||
    pullRequest.baseRefName !== manifest.base.ref ||
    !Number.isInteger(pullRequest.number) ||
    !/^https:\/\/github\.com\/velt-design\/sanctuary\/pull\/[1-9][0-9]*$/.test(
      pullRequest.url,
    )
  ) {
    throw new Error("GitHub did not return the exact open draft pull request.");
  }
}

export function publishEngineeringLane(
  { taskId, manifestHash, title, body },
  options = {},
) {
  assertPublishText(title, body);
  const { controller, paths, manifest, owner } = resolveOwnedLane(
    taskId,
    manifestHash,
    options,
  );
  if (owner.state !== "active" && owner.state !== "published") {
    throw new Error(
      "Only an active or already-published lane can be published.",
    );
  }
  const status = inspectOwnedWorktree(controller, paths, manifest);
  if (!status.clean) {
    throw new Error(
      "Commit or remove every worktree change before publishing.",
    );
  }
  if (
    status.headSha === manifest.base.sha ||
    status.changedPaths.length === 0
  ) {
    throw new Error("The lane has no committed change to publish.");
  }
  if (
    !controller.git.isAncestor(
      manifest.base.sha,
      status.headSha,
      paths.worktreePath,
    )
  ) {
    throw new Error(
      "The feature branch no longer descends from its manifest base.",
    );
  }
  assertChangedPathsOwned(status.changedPaths, manifest);

  controller.git.pushBranch(paths.worktreePath, manifest.branch);
  const remoteHead = controller.git.remoteBranchHead(manifest.branch);
  if (remoteHead !== status.headSha) {
    throw new Error("The pushed remote branch does not match the local head.");
  }

  let pullRequest = controller.git.findOpenPullRequest(manifest.branch);
  if (!pullRequest) {
    pullRequest = controller.git.createDraftPullRequest({
      branch: manifest.branch,
      baseRef: manifest.base.ref,
      title,
      body,
    });
  }
  assertDraftPullRequest(pullRequest, manifest);
  const nextOwner = {
    ...owner,
    state: "published",
    updatedAt: timestamp(controller.now),
    headSha: status.headSha,
    pullRequest: {
      number: pullRequest.number,
      url: pullRequest.url,
      draft: true,
    },
  };
  writeProtectedJson(paths.ownerPath, nextOwner);
  releaseLease(paths, manifest, manifestHash);
  return laneResult({
    owner: nextOwner,
    status,
    paths,
    workerPrompt: null,
    resumed: owner.state === "published",
  });
}

export function cleanupEngineeringLane(taskId, manifestHash, options = {}) {
  const { controller, paths, manifest, owner } = resolveOwnedLane(
    taskId,
    manifestHash,
    options,
  );
  if (owner.state === "worktree_removed") {
    return laneResult({
      owner,
      status: null,
      paths,
      workerPrompt: null,
      resumed: true,
    });
  }
  if (owner.state !== "published" || !owner.pullRequest?.draft) {
    throw new Error("Only a published draft-PR lane can be cleaned up.");
  }
  const status = inspectOwnedWorktree(controller, paths, manifest);
  if (!status.clean || status.headSha !== owner.headSha) {
    throw new Error(
      "The published worktree is dirty or has moved since publishing.",
    );
  }
  if (controller.git.remoteBranchHead(manifest.branch) !== status.headSha) {
    throw new Error(
      "The remote feature branch no longer matches the owner record.",
    );
  }
  const pullRequest = controller.git.findOpenPullRequest(manifest.branch);
  assertDraftPullRequest(pullRequest, manifest);
  if (
    pullRequest.number !== owner.pullRequest.number ||
    pullRequest.url !== owner.pullRequest.url
  ) {
    throw new Error(
      "The open draft pull request no longer matches the owner record.",
    );
  }
  assertPathInside(paths.tasksRoot, paths.worktreePath, "Cleanup worktree");
  controller.git.removeWorktree(paths.worktreePath);
  if (existsSync(paths.worktreePath)) {
    throw new Error("Git did not remove the owned worktree.");
  }
  const nextOwner = {
    ...owner,
    state: "worktree_removed",
    updatedAt: timestamp(controller.now),
  };
  writeProtectedJson(paths.ownerPath, nextOwner);
  releaseLease(paths, manifest, manifestHash);
  return laneResult({
    owner: nextOwner,
    status: null,
    paths,
    workerPrompt: null,
    resumed: false,
  });
}
