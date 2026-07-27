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
- the inspector keeps a compact customer price, result freshness, input-issue count, and quote readiness above the tabs;
- inactive panels remain mounted so tab changes do not discard local disclosure, drawing, debug, or actual-cost state;
- Materials and Labour are explicitly labelled as whole-job output, while Workings follows the selected module;
- existing admin and Advanced-mode disclosure boundaries remain unchanged;
- the tab strip scrolls at narrow preview widths, while stacked calculator layouts retain their existing page-owned scrolling.

### 2. Build One Trusted Working End To End

- Use rafter cut length as the reference calculation.
- Define an authoritative explanation contract containing inputs, intermediate values, result, units, assumptions, and source.
- Render an accurate annotated Section diagram from those same facts.
- Prove the visual result and written calculation agree across supported roof styles and edge cases.

### 3. Turn Breakdowns Into Explanations

- Replace debug-oriented ordering and labels with user-facing material and labour groups.
- Add `Why this quantity?` disclosure to supported material and labour rows.
- Expand Workings only after the rafter pattern is proven, prioritising the calculations users most often question.
- Retain technical trace export for diagnosis without making it the everyday interface.

### 4. Validate Trust And Usability

- Test reconciliation between Pricing and quote handoff.
- Test selected-module scoping, stale/current transitions, warnings, permissions, keyboard use, and responsive layouts.
- Review the language and diagrams with real staff using representative simple and complex estimates.
- Treat a user being unable to explain a result as a product defect, even when the arithmetic is correct.

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
- `docs/costing-and-geometry.md`
- `docs/design-workbench-architecture.md`
- `docs/quotes-invoices-job-packs.md`
- `docs/testing-and-qa.md`
