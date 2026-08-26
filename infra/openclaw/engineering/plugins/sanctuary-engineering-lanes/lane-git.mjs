import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  ENGINEERING_REMOTE_URL,
  ENGINEERING_REPOSITORY,
} from "./lane-contract.mjs";

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function normalizeExistingPath(path) {
  return resolve(realpathSync(path));
}

function commandError(command, args, execution) {
  const detail = execution.stderr?.trim() || execution.stdout?.trim();
  return new Error(
    `${command} ${args.join(" ")} failed${detail ? `: ${detail}` : "."}`,
  );
}

function runProcess(command, args, options = {}) {
  const execution = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: "utf8",
    input: options.input,
  });
  if (execution.error) throw execution.error;
  if (execution.status !== 0 && !options.allowFailure) {
    throw commandError(command, args, execution);
  }
  return {
    status: execution.status,
    stdout: execution.stdout?.trim() ?? "",
    stderr: execution.stderr?.trim() ?? "",
  };
}

function parseWorktreeList(raw) {
  return raw
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const record = {};
      for (const line of block.split(/\r?\n/)) {
        const separator = line.indexOf(" ");
        if (separator === -1) {
          record[line] = true;
        } else {
          record[line.slice(0, separator)] = line.slice(separator + 1);
        }
      }
      return record;
    });
}

function outputLines(raw) {
  return raw ? raw.split(/\r?\n/).filter(Boolean) : [];
}

export function createGitRuntime({
  repoRoot,
  stateDir,
  expectedRemoteUrl = ENGINEERING_REMOTE_URL,
  repository = ENGINEERING_REPOSITORY,
  gitBinary = process.env.SANCTUARY_ENGINEERING_GIT_BINARY ?? "git",
  authenticated = true,
  environment = process.env,
} = {}) {
  if (!repoRoot || !stateDir) {
    throw new Error("Git runtime requires a repository root and state root.");
  }
  const resolvedRepoRoot = normalizeExistingPath(repoRoot);
  const helperPath = join(
    resolvedRepoRoot,
    "scripts",
    "ai",
    "github-app-token.mjs",
  );
  const gitEnvironment = {
    ...environment,
    GIT_TERMINAL_PROMPT: "0",
    GH_PROMPT_DISABLED: "1",
  };

  function git(args, options = {}) {
    const useAuthentication = options.authenticate ?? false;
    const authArgs = [];
    if (useAuthentication && authenticated) {
      if (!existsSync(helperPath)) {
        throw new Error(
          "The repository-scoped GitHub credential helper is missing.",
        );
      }
      const helperCommand = `!${shellQuote(process.execPath)} ${shellQuote(
        helperPath,
      )} --git-credential`;
      authArgs.push(
        "-c",
        "credential.helper=",
        "-c",
        `credential.helper=${helperCommand}`,
        "-c",
        "credential.useHttpPath=true",
      );
    }
    return runProcess(gitBinary, [...authArgs, ...args], {
      cwd: options.cwd ?? resolvedRepoRoot,
      env: gitEnvironment,
      allowFailure: options.allowFailure,
    });
  }

  function safeGh(args) {
    if (!authenticated) {
      throw new Error("GitHub access is not configured for this lane runtime.");
    }
    return runProcess(process.execPath, [helperPath, "--safe-gh", ...args], {
      cwd: resolvedRepoRoot,
      env: {
        ...gitEnvironment,
        SANCTUARY_ENGINEERING_GH_BINARY:
          environment.SANCTUARY_ENGINEERING_GH_BINARY ??
          "/Users/sanctuary-runner/.local/lib/github-cli/bin/gh",
      },
    });
  }

  function assertSourceRepository() {
    const topLevel = normalizeExistingPath(
      git(["rev-parse", "--show-toplevel"]).stdout,
    );
    if (topLevel !== resolvedRepoRoot) {
      throw new Error(
        "The controller path is not the expected Git worktree root.",
      );
    }
    const remoteUrl = git(["remote", "get-url", "origin"]).stdout;
    if (remoteUrl !== expectedRemoteUrl) {
      throw new Error("The controller origin is not the Sanctuary repository.");
    }
    const pushUrl = git(["remote", "get-url", "--push", "origin"]).stdout;
    if (pushUrl !== expectedRemoteUrl) {
      throw new Error(
        "The controller push URL is not the Sanctuary repository.",
      );
    }
    const status = git([
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]).stdout;
    if (status) {
      throw new Error(
        "The controller checkout must be clean before lane provisioning.",
      );
    }
    return { repoRoot: resolvedRepoRoot, remoteUrl };
  }

  function assertBranchName(ref, label) {
    const result = git(["check-ref-format", "--branch", ref], {
      allowFailure: true,
    });
    if (result.status !== 0 || ref.startsWith("-") || ref.endsWith(".lock")) {
      throw new Error(`${label} is not a safe Git branch name.`);
    }
  }

  function fetchExactBase(base) {
    assertBranchName(base.ref, "Base ref");
    git(
      [
        "fetch",
        "--quiet",
        "--no-tags",
        expectedRemoteUrl,
        `refs/heads/${base.ref}`,
      ],
      { authenticate: true },
    );
    const fetched = git(["rev-parse", "FETCH_HEAD"]).stdout;
    if (fetched !== base.sha) {
      throw new Error(
        `The fetched base is ${fetched}, not the manifest base ${base.sha}.`,
      );
    }
    return fetched;
  }

  function remoteBranchHead(branch) {
    assertBranchName(branch, "Feature branch");
    const output = git(
      ["ls-remote", "--heads", expectedRemoteUrl, `refs/heads/${branch}`],
      { authenticate: true },
    ).stdout;
    if (!output) return null;
    const rows = output.split(/\r?\n/).filter(Boolean);
    if (rows.length !== 1) {
      throw new Error("GitHub returned an ambiguous feature branch.");
    }
    return rows[0].split(/\s+/)[0];
  }

  function localBranchHead(branch) {
    assertBranchName(branch, "Feature branch");
    const result = git(["show-ref", "--verify", `refs/heads/${branch}`], {
      allowFailure: true,
    });
    if (result.status !== 0) return null;
    return result.stdout.split(/\s+/)[0];
  }

  function worktrees() {
    return parseWorktreeList(git(["worktree", "list", "--porcelain"]).stdout);
  }

  function findWorktree(path) {
    const expected = isAbsolute(path)
      ? resolve(path)
      : resolve(resolvedRepoRoot, path);
    return (
      worktrees().find((entry) => {
        if (!entry.worktree) return false;
        return resolve(entry.worktree) === expected;
      }) ?? null
    );
  }

  function addNewWorktree(path, branch, baseSha) {
    assertBranchName(branch, "Feature branch");
    git(["worktree", "add", "-b", branch, path, baseSha]);
  }

  function attachWorktree(path, branch) {
    assertBranchName(branch, "Feature branch");
    git(["worktree", "add", path, branch]);
  }

  function removeWorktree(path) {
    git(["worktree", "remove", path]);
  }

  function inspectWorktree(path, baseSha) {
    const topLevel = normalizeExistingPath(
      git(["rev-parse", "--show-toplevel"], { cwd: path }).stdout,
    );
    const branch = git(["branch", "--show-current"], { cwd: path }).stdout;
    const headSha = git(["rev-parse", "HEAD"], { cwd: path }).stdout;
    const porcelain = git(
      ["status", "--porcelain=v1", "--untracked-files=all"],
      { cwd: path },
    ).stdout;
    const changedPaths = baseSha
      ? outputLines(
          git(
            [
              "diff",
              "--name-only",
              "--diff-filter=ACDMRTUXB",
              `${baseSha}...HEAD`,
            ],
            { cwd: path },
          ).stdout,
        )
      : [];
    return {
      path: topLevel,
      branch,
      headSha,
      clean: !porcelain,
      statusLines: outputLines(porcelain),
      changedPaths,
    };
  }

  function pushBranch(worktreePath, branch) {
    assertBranchName(branch, "Feature branch");
    git(
      ["push", expectedRemoteUrl, `refs/heads/${branch}:refs/heads/${branch}`],
      { cwd: worktreePath, authenticate: true },
    );
  }

  function isAncestor(ancestor, descendant, cwd = resolvedRepoRoot) {
    return (
      git(["merge-base", "--is-ancestor", ancestor, descendant], {
        cwd,
        allowFailure: true,
      }).status === 0
    );
  }

  function findOpenPullRequest(branch) {
    const result = safeGh([
      "pr",
      "list",
      "--repo",
      repository,
      "--head",
      branch,
      "--state",
      "open",
      "--json",
      "number,url,isDraft,headRefName,baseRefName",
    ]);
    const pullRequests = JSON.parse(result.stdout || "[]");
    if (pullRequests.length > 1) {
      throw new Error("More than one open pull request exists for the lane.");
    }
    return pullRequests[0] ?? null;
  }

  function createDraftPullRequest({ branch, baseRef, title, body }) {
    safeGh([
      "pr",
      "create",
      "--repo",
      repository,
      "--draft",
      "--base",
      baseRef,
      "--head",
      branch,
      "--title",
      title,
      "--body",
      body,
    ]);
    return findOpenPullRequest(branch);
  }

  return Object.freeze({
    repoRoot: resolvedRepoRoot,
    repository,
    assertSourceRepository,
    assertBranchName,
    fetchExactBase,
    remoteBranchHead,
    localBranchHead,
    worktrees,
    findWorktree,
    addNewWorktree,
    attachWorktree,
    removeWorktree,
    inspectWorktree,
    pushBranch,
    isAncestor,
    findOpenPullRequest,
    createDraftPullRequest,
  });
}
