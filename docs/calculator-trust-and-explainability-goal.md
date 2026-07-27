# Calculator Trust And Explainability Goal

Status: Active product goal.

## North Star

Make the Calculator a dependable internal estimating tool that staff can understand, check, and confidently use in customer conversations.

The Calculator should not behave like a black box. For the current job and selected module, it should clearly answer:

- What is the customer price and what is included?
- What materials and labour does the estimate assume?
- How were important physical results derived?
- Which assumptions, warnings, overrides, and rounding rules affected the result?
- Is the result current, complete, and safe to save or hand off to a quote?

Trust should come from clear evidence, not from showing every internal field. The normal view should explain the result in plain language, with deeper technical detail available progressively.

## Current Starting Point

The Calculator already has many of the required building blocks:

- current versus last-valid result freshness;
- customer pricing and price-by-item output;
- BOM quantities and admin-only material costs;
- labour actions and structure outputs in Advanced mode;
- Plan and Section module drawings;
- warnings, validation, save readiness, and costing provenance;
- a technical materials trace outside production or when debug is enabled.

The main gap is that these outputs are fragmented, inconsistently detailed, and not presented as one coherent explanation of the selected module.

## Target Experience

The right column becomes a persistent **Result Inspector**. It follows the selected module while keeping job-level pricing and readiness clearly distinguished from module-level workings.

Its primary tabs are:

### Pricing

- Complete customer total, inc-GST and ex-GST.
- Price by pergola, blind, shared site cost, and preserved legacy item.
- Discount scope, unpriced items, and internal costing where the current admin permission allows it.
- Clear `Live result` or `Last valid result` status.

### Materials

- Human-readable material and procurement breakdown.
- Quantity, unit, stock length or sheet count, waste/rounding allowance, and module/pergola ownership where available.
- A `Why this quantity?` explanation for supported lines.
- Internal dollar costs only for users with the existing admin permission.

### Labour

- Plain-language installation activities, quantities, minutes, total crew hours, and relevant multipliers.
- Grouping by meaningful work stage rather than engine/debug ordering.
- Labour dollar costs only for users with the existing admin permission.

### Workings

- Calculations for the selected module only.
- An accurate annotated diagram beside a short input-to-result explanation.
- Inputs used, intermediate values, formula or rule, final result, assumptions, and rounding.
- Rafter cut length is the first reference implementation:

```text
entered span and setbacks
  -> effective projected run
  -> pitch adjustment
  -> rafter cut length
  -> stock/material consequence
```

For a supported roof, the explanation may show:

```text
rafter cut length = effective run / cos(pitch)
```

The diagram and explanation must consume the same calculation facts. The UI must not independently recreate costing or geometry formulas.

### Issues

- Blocking errors, review warnings, assumptions, manual overrides, and informational notices.
- Each issue states its consequence and provides a direct route to the relevant input where possible.
- A concise quote-readiness result explains what remains before Save or quote handoff.

## Trust Contract

Every result presentation should follow these rules:

- Always distinguish current results from retained last-valid results.
- Clearly separate job-level, pergola-level, and selected-module information.
- Show the inputs and units that actually produced an explained result.
- Label assumptions, defaults, overrides, interpolation, waste, and rounding where they materially affect the result.
- Show the costing configuration version or frozen legacy provenance associated with saved results.
- Make displayed pricing reconcile with the exact quote-handoff lines.
- Keep explanations readable by default; raw trace data remains an optional diagnostic tool.
- Never imply accuracy that the underlying source data cannot support.
- Do not reveal internal monetary costs beyond the existing calculator permission boundary without a separate explicit product decision.

## Ownership Boundaries

- `@sp/costing` remains the only owner of costing formulas, material quantities, labour actions, multipliers, rounding, warnings, and trace semantics.
- Geometry-derived physical facts remain owned by `packages/geometry` where they are part of the canonical geometry contract.
- Calculator components may adapt authoritative outputs into diagrams and explanations but must not create parallel calculation rules.
- Customer totals continue to use the same cent-accurate quote-handoff projection as quote creation.
- Estimate Save, locks, local-first state, conflicts, and Preserve/Reprice behavior remain unchanged unless separately approved.
- The Calculator and Design Workbench remain separate product paths. This goal must not reintroduce calculator state or costing into the live object-first workbench.

## Brief Pathway

### 1. Establish The Result Inspector - Complete

The first phase is implemented:

- the right column is a keyboard-accessible Result Inspector with Pricing, Materials, Labour, Workings, and Issues tabs;
- existing price, BOM, labour, structure, warning, quote-status, drawing, impact, and actual-cost surfaces are routed into their appropriate tab without changing their source data;
- the workspace keeps exactly one compact rounded customer summary: in the Inspector header for split layouts and before configuration for stacked layouts;
- inactive panels remain mounted so tab changes do not discard local disclosure, drawing, debug, or actual-cost state;
- Materials and Labour are explicitly labelled as whole-job output, while Workings follows the selected module;
- existing admin and Advanced-mode disclosure boundaries remain unchanged;
- the Workspace controls the active tab, resets only the independent desktop result rail on a genuine task change, and leaves ordinary stacked tab changes to the existing page-owned scrolling;
- explicit stacked result shortcuts reveal and focus Pricing or Issues, and `Back to configuration` restores the last focused editable control.

### 2. Build One Trusted Working End To End - Complete

The rafter cut-length reference implementation is complete:

- `@sp/costing` publishes a versioned explanation contract beside the existing takeoff result, containing the normalized span, engine-selected pitch, profile, plane-specific deductions, effective projected run, sloped length, angle-cut allowance, final cut, formula, assumptions, source, and display-rounding rule;
- pitched, gable, low-gable, and hip common rafters are supported, including separate house/outer gable results and box-perimeter pitch selection;
- invalid effective runs and hip-corner modules fail closed rather than presenting inferred workings; hip corners remain deferred until a two-wing Section explanation exists;
- the Workings tab presents the selected module's authoritative input-to-result chain before its Plan/Section views and labels retained last-valid inputs explicitly;
- the Section diagram and written workings consume the same contract values, while input-fallback and old results are labelled as schematic or unavailable;
- the former portal-only rafter-length estimate, whose deductions and angle allowance differed from the engine takeoff, has been removed;
- package, integration, component, and authenticated browser tests prove plane-value parity, module switching, current/retained state, keyboard-accessible regions, and responsive layouts.

### 3. Turn Breakdowns Into Explanations - Complete

The first trusted material and labour breakdowns are implemented:

- `@sp/costing` publishes compact whole-job material and labour breakdown contracts from the actual BOM lines, install actions, totals, notes, scopes, and applied multipliers;
- every result row is placed in a stable user-facing purpose or work-stage group, with source IDs retained for traceability and separate unique instance IDs for repeated BOM lines;
- material rows show purchase quantity, unit, pergola/module ownership where available, profile, and permission-gated internal cost;
- stock-bar explanations show required cut length, stock length, bars purchased, allocated waste, and whole-stock rounding in plain purchasing language; roofing sheets retain the calculated area or strip-yield note and whole-sheet rounding;
- labour rows show activity quantity, unit, estimated minutes, crew hours, relevant non-neutral loadings, ownership, and permission-gated internal cost;
- each material/labour group is a native disclosure keyed by its stable group ID; the first starts open, the rest start closed, summaries show line/activity counts and labour hours, and user open state survives mounted result rerenders;
- `Why this quantity?` keeps facts, assumptions, and rounding behind progressive disclosure, with unchanged package IDs nested separately under collapsed `Technical source`;
- Materials remains available to staff without internal costs, while Labour retains the existing admin plus Advanced-mode gate;
- current and retained last-valid states are explicit, and old results without the contracts fail closed with a recalculate message;
- the existing Advanced/admin material trace remains available for diagnosis and is not used as the everyday breakdown.

Further Workings calculations remain deferred until prioritised from staff feedback.

### 4. Validate Trust And Usability - Technical Validation Complete; Staff Review Ready

- A focused integration matrix runs representative simple and complex inputs through the real costing engine, Live Calculator pricing, repriced estimate payload, optimistic saved snapshot, and proposed quote mapping. It proves the same priced inclusions and exact-cent total without requiring Calculator and quote rows to share presentation order.
- Repriced save outcomes now compare the Live Calculator total with the saved estimate's proposed quote total. An exact match is explicit; an unexpected mismatch blocks the Create quote action. Preserve remains explicit that the saved stored-cost basis may intentionally differ from Live.
- Authenticated Playwright covers the exact-cent save/handoff match, selected-module workings, retained/current transitions, validation issue routing, keyboard tab behavior, and responsive layouts. Focused component tests retain the staff/admin monetary gates.
- Automatic pitch and downpipe inputs now explain the authoritative value used by the current or retained result without rewriting the raw input or duplicating a costing rule.
- Issue Jump now completes module and Basic/Advanced disclosure changes before revealing and focusing the invalid control within the active scroll owner.
- Result-hierarchy refinement now provides one rounded lead price per layout, explicit stacked result/back routing, predictable desktop Inspector starts, exact-cent Pricing detail, and a result-first Workings order. Authenticated acceptance passed across both registered scenarios at 1600px, 1366px, 1024px, 768px, and 390px without changing costing, freshness, Save, permissions, or exact-cent quote handoff.
- The command bar now uses one identity -> readiness -> Basic -> Advanced -> Save source/focus order. A shared readiness presenter distinguishes causal issues from blocked checks while retaining every Quote Status row and the existing Save gate.
- Focused hardening covers disclosure state/completeness, copy-only costing parity, readiness cause/check grammar, Quote Status dependencies, and idle/queued/syncing/synced/offline/error/conflict save outcomes. Authenticated acceptance passed the 30-test in-scope Calculator run, including disclosure and command geometry, keyboard/focus and computed contrast, causal readiness, deep-scroll Save reachability, and queued/syncing/synced exact-cent save reconciliation without selecting Create quote.
- The two staff-review scenarios and checklist below are ready for a real session. No staff feedback has been recorded or inferred yet.
- A user being unable to explain a result remains a product defect even when the arithmetic is correct.

#### Staff Review Protocol

Use local or approved staging data only. Provision the registered portal scenarios before the session.

**Simple scenario - `project-with-estimate`**

- One attached pitched acrylic module with no optional add-ons or discount.
- Ask the reviewer to identify the customer total and inclusions, inspect material and labour assumptions, explain the rafter cut length from the written working and Section diagram, and state whether the result is safe to save.

**Complex scenario - `calculator-multi-module`**

- Three modules across two pergolas covering pitched, gable, and hip roofs.
- In the browser draft, add one valid blind and a temporary quote discount, switch between all modules, temporarily clear and restore one required dimension, then review the proposed quote handoff after Reprice and save.
- Ask the reviewer to distinguish whole-job Materials/Labour from selected-module Workings, identify the retained result while invalid, follow the issue back to its input, explain important rounding or waste, and reconcile the exact Price by item total with the saved quote handoff.

For each scenario, record:

1. Reviewer role, viewport/device, date, and scenario.
2. Whether they could answer each question without help.
3. Their exact words for anything unclear; do not paraphrase a pass into existence.
4. Any trust defect, its screen/state, severity, and follow-up owner.
5. `Pass` only when the reviewer can explain the result and proposed handoff; otherwise record `Needs change`.

Staff feedback status: **Not yet collected.**

## Done Criteria

This goal is complete when a typical staff user can, without developer help:

- identify the complete customer total and its inclusions;
- inspect the materials and labour assumed for the job;
- explain the selected module's rafter length from its diagram and workings;
- identify important assumptions, overrides, rounding, and warnings;
- tell whether the result is live, stale, blocked, or ready to save;
- reconcile the Calculator result with the proposed quote handoff.

The implementation is also complete only when explanations derive from authoritative outputs, monetary permissions remain enforced, and calculator UI changes do not create a second costing or geometry source of truth.

## Deferred Improvements

The following ideas are deliberately outside this goal and can be reconsidered later:

- change-impact explanations;
- side-by-side scenario comparison;
- a guided estimate wizard;
- broader redesign of the left-side configuration workflow;
- live Design Workbench pricing;
- editable formulas or calculation policy in the Calculator.

## Planning Boundary

For Design Workbench Gate 0 purposes, the expected legacy audit mapping is `N/A`: this goal improves the protected Calculator V1 product path and does not extend workbench legacy. It builds on the current calculator presentation, not on calculator compatibility inside the workbench. The tab and explanation work has no Phase 2 workbench commercial-input dependency; any future workbench pricing rollout remains a separate downstream solved-geometry/takeoff programme.

Related current-state references:

- `docs/projects-contacts-estimates-calculator.md`
- `docs/calculator-ui-ux-review.md`
- `docs/calculator-ui-ux-refinement-plan.md`
- `docs/costing-and-geometry.md`
- `docs/design-workbench-architecture.md`
- `docs/quotes-invoices-job-packs.md`
- `docs/testing-and-qa.md`
