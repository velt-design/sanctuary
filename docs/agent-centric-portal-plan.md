# Agent-Centric Portal Plan

Status: Active roadmap.

Audience: humans and coding agents improving the portal, workbench, tests, fixtures, diagnostics, and repo quality gates.

Purpose: make the portal easy for agents to inspect, reproduce, test, and improve without relying on screenshots, manual setup, or hidden local state. The goal is an A+ agent-centric repo: clear ownership, deterministic repros, fast feedback, useful diagnostics, and fewer legacy escape hatches.

## Index

- `Plain-English Goal`: why this plan exists.
- `Target Grade`: what A+ looks like for agent-centric portal work.
- `PR Roadmap`: the simple explanation for each recommended PR.
- `Recommended Order`: the shortest useful sequence.
- `A+ Repo Checklist`: how to judge whether the repo is getting smarter.
- `Current Highest-Leverage Next Step`: what to do first.

## Plain-English Goal

Today an agent can read code and run tests, but some portal issues still depend on what a human sees in the browser. That slows us down because a screenshot does not include the exact app state, server state, local draft, console errors, network calls, or render diagnostics.

This plan makes the portal more like a lab bench:

- agents can open the same authenticated pages a staff user opens;
- important pages have seeded states;
- bugs can be captured as data;
- browser tests collect evidence automatically;
- quality reports show where the repo is getting better or worse.

## Target Grade

| Area | Current Direction | Target |
| --- | --- | --- |
| Architecture direction | Improving, but still carrying legacy workbench coexistence | Object-owned data paths with clear compatibility boundaries |
| Runtime reliability | Mixed: tests are improving, but visible workbench bugs still escape | Repro fixtures for every serious bug and browser evidence on failures |
| Agent productivity | Good in code, weaker in live portal inspection | Agents can open routes, capture state, and diagnose failures consistently |
| Maintainability | Improving through decomposition, still hotspot-heavy | Large files split by owner, strict changed-file pressure, clear docs |
| Debuggability | Workbench is improving, other pages need the same pattern | Gated debug exports and diagnostics for every complex portal workflow |

## PR Roadmap

### PR-Agent.1: Portal Agent Access Harness

Simple version: give agents a safe way to log in and open portal pages in Playwright.

Status: active first slice. This now owns the safe local/staging test-user provisioning path, shared authenticated route helper, browser evidence capture, and first agent access smoke for dashboard, projects, contacts, and schedule.

Why it matters: without authenticated browser access, agents can only test hidden QA pages or unauthenticated routes. This creates blind spots in the real staff portal.

What it should add:

- a local/staging-only staff test account setup;
- Playwright `storageState` generation for authenticated portal tests;
- a shared helper like `openPortalPage({ route })`;
- clear env preflight errors when credentials are missing.

Done when:

- one command can open an authenticated portal page in Playwright;
- console/page/network failures are captured by default;
- no production credentials or unsafe auth shortcuts are committed.

### PR-Agent.2: Portal Route Catalog

Simple version: make a map of the important portal pages and how to test each one.

Why it matters: agents should not guess which routes exist, which role they need, or which fixture data makes a page useful.

What it should add:

- a route catalog in docs or JSON;
- route, required role, owner doc, smoke test, and seed/fixture needs;
- initial coverage for project page, estimates, quotes, schedule, running jobs, design list, and design workbench.

Done when:

- an agent can pick a route from the catalog and know how to open and verify it;
- docs route ownership matches `docs/change-routing.md`.

### PR-Agent.3: Seeded Scenario Registry

Simple version: create known portal states agents can load again and again.

Why it matters: many portal bugs depend on specific projects, estimates, quotes, schedules, or drafts. Manual setup is slow and inconsistent.

What it should add:

- deterministic local/demo seed scenarios;
- named scenarios such as `project-with-estimate`, `quote-ready`, `schedule-board-basic`, and `workbench-multi-object`;
- one-command or documented setup.

Done when:

- a browser test can ask for a scenario by name;
- the scenario creates the same important IDs and state every time.

### PR-Agent.4: Page Debug Export Contract

Simple version: let complex pages copy a structured debug payload, not just a screenshot.

Why it matters: a screenshot shows the symptom but not the state that caused it. Workbench already started the right pattern with debug fixture export. Other complex pages need the same idea.

What it should add:

- a shared gated debug-export convention;
- only enabled in local/staging/debug environments;
- page payloads for selected IDs, local state, server state, queue state, diagnostics, and relevant route params.

Done when:

- workbench, estimates, quotes, schedule, running jobs, and design list each have an owner-approved debug payload shape or an explicit reason they do not need one yet;
- copied payloads can become fixtures or test inputs.

### PR-Agent.5: Browser Evidence Lane

Simple version: when a browser test fails, collect evidence automatically.

Why it matters: a failing Playwright test should tell us what happened without a human rerunning it and looking around.

What it should add:

- screenshots;
- traces;
- console logs;
- page errors;
- network failures;
- DOM snapshots where useful;
- canvas/3D pixel evidence for workbench views.

Done when:

- failing portal browser tests produce useful artifacts by default;
- workbench tests can prove a canvas is nonblank and diagnostics are finite.

### PR-Agent.6: Quality Scorecard

Simple version: create a repo health dashboard for humans and agents.

Why it matters: we need to know whether the repo is getting cleaner, not just whether a single PR passed.

What it should track:

- route smoke coverage;
- fixture coverage;
- debug-export coverage;
- file-size hotspots;
- dead-code findings;
- flaky or skipped tests;
- browser smoke status;
- workbench reliability status.

Done when:

- the scorecard can be updated from existing reports where possible;
- it highlights the next highest-leverage cleanup lane.

### PR-Agent.7: Strictness Ratchet

Simple version: gradually turn good advisory checks into stronger local or CI checks.

Why it matters: advisory reports are useful, but A+ repos prevent new debt from entering. The key is to ratchet slowly so current legacy debt does not block all work.

What it should add:

- choose one narrow strict rule at a time;
- start with new files or changed files only;
- document why the rule is safe to enforce.

Examples:

- block new unowned fixture modules;
- block new root compatibility files;
- block new browser Supabase reads outside approved adapters;
- block new critical-size files without decomposition notes.

Done when:

- at least one narrow quality check moves from advisory to enforceable;
- existing legacy debt remains tracked but does not block unrelated work.

### PR-Agent.8: Workbench Captured Repro Workflow

Simple version: make the workbench bug workflow: capture live state, bake fixture, fix first failing stage.

Why it matters: recent workbench improvements made diagnostics better, but visible bugs have persisted because screenshot approximations were not exact enough.

What it should formalize:

- screenshot-only bugs are not enough for solver changes;
- use `Copy debug fixture payload`;
- bake exact payload into a captured fixture;
- assert the failing object ID and stage;
- fix only the first failing stage;
- keep Plan/3D render policy unchanged unless diagnostics prove render policy is the failing stage.

Done when:

- the current house-roof failure exists as a captured fixture;
- the fixture either becomes healthy or reports the next exact failing stage;
- future workbench bug PRs follow this workflow.

## Recommended Order

1. PR-Agent.1: Portal Agent Access Harness
2. PR-Agent.2: Portal Route Catalog
3. PR-Agent.8: Workbench Captured Repro Workflow
4. PR-Agent.3: Seeded Scenario Registry
5. PR-Agent.5: Browser Evidence Lane
6. PR-Agent.4: Page Debug Export Contract
7. PR-Agent.6: Quality Scorecard
8. PR-Agent.7: Strictness Ratchet

This order gives immediate value first: agents can access real pages, know which routes matter, and capture exact workbench bugs. The later PRs improve coverage and quality pressure across the whole repo.

## What This Does Not Replace

This plan does not replace:

- `docs/agent-playbook.md` for agent operating protocol;
- `docs/testing-and-qa.md` for command catalog;
- `docs/portal-production-readiness.md` for production readiness;
- `docs/design-workbench-architecture.md` for workbench architecture;
- `docs/change-routing.md` for ownership and doc triggers.

This plan is the roadmap for making those systems easier for agents to use.

## A+ Repo Checklist

Use this as a simple target checklist:

- Every major portal route has a smoke test.
- Every complex workflow has a seeded scenario or fixture.
- Every serious bug can become a captured fixture.
- Every browser failure gives screenshots, traces, console, and network evidence.
- Every large file has an owner and decomposition path.
- Every changed-file quality report has a clear handoff answer.
- Every source-of-truth boundary is enforced by tests or guards.
- Every compatibility fallback has a retirement row.
- Every agent-facing command is documented and runnable from the repo root.

## Current Highest-Leverage Next Step

Build PR-Agent.1 first. Authenticated Playwright access is the foundation for viewing the portal like a staff user, capturing reliable browser evidence, and making every later debug/export/fixture workflow useful.
