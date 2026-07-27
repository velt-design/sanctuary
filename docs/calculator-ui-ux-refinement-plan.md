# Calculator UI/UX Refinement Plan

Status: Approved. Mandatory Slices 1-5 implemented and verified (2026-07-27); Slices 6-7 remain plan-only.

Source evidence: `docs/calculator-ui-ux-review.md`

## Outcome and boundaries

Implement the four observed high-priority defects first, then three small owner-aligned refinement slices. The intended outcome is that staff can configure a job, understand the authoritative result, resolve a problem, and reach Save or quote handoff without needing knowledge of the Calculator's implementation.

The following contracts do not change:

- `@sp/costing` remains the only costing source of truth.
- `CostInputsV1`, persisted Calculator inputs, `costingPayload.ts`, and the live request shape do not change.
- Module/pergola identity, ordering, active-module selection, and `aria-current` do not change.
- Current, Updating, waiting, stale, invalid, error, and last-valid meanings do not change.
- Save preflight, estimate locks, Preserve/Reprice, local-first queue/conflict behavior, warning acknowledgement, and quote eligibility do not change.
- Customer totals and quote lines continue to reconcile in exact cents; no UI calculation becomes authoritative.
- Materials, labour, and workings remain complete. Disclosure changes presentation, not quantities or availability.

CUX-12 is the only planned `packages/costing` edit: plain-language explanation strings and their tests in `packages/costing/src/engine/breakdownExplanation.ts`. Formulas, quantities, types, groupings, source IDs, and contracts remain byte-for-byte equivalent in meaning.

### Design Workbench Gate 0

- Legacy audit rows: `N/A`.
- Legacy posture: this builds on the protected Calculator V1 presentation, not Design Workbench legacy.
- Phase 2 dependency: none. There is no `inputs.modules` consumer migration or workbench commercial-input change.
- Costing/function consolidation: none. CUX-06 reads existing authoritative outputs; CUX-12 changes copy only.

If implementation discovers a need to change `CalculatorInputs`, `CostInputsV1`, `costingPayload.ts`, `inputs.modules`, or the meaning of downpipe `0`, stop and re-plan before coding.

## Delivery sequence

Each numbered slice is independently reviewable. Slices 1-4 are mandatory and land in order before hierarchy or density work.

| Order | Findings | Slice | Primary outcome |
| --- | --- | --- | --- |
| 1 | CUX-01 | Configuration containment | No hidden or clipped controls at any reviewed width. |
| 2 | CUX-02 | Sticky chrome ownership | Save remains visible, focusable, and hit-testable after deep scrolling. |
| 3 | CUX-03 | Deterministic issue routing | Jump closes the dialog and visibly focuses the correct field/error. |
| 4 | CUX-06 | Resolved automatic defaults | Raw automatic inputs and authoritative resolved values are both clear. |
| 5 | CUX-04, CUX-07, CUX-09, CUX-11 | Result hierarchy | Stacked results are discoverable; Inspector tabs start correctly; price and Workings have one clear lead answer. |
| 6 | CUX-05, CUX-12 | Breakdown scanability and language | Materials/Labour are bounded by group disclosure and use staff-facing language. |
| 7 | CUX-08, CUX-10 | Command and readiness clarity | Visual/focus order agrees and causes are distinguished from blocked checks. |

Do not combine all seven slices into one PR. A slice may be split further for reviewability, but its acceptance contract must stay intact.

### Implementation record

The approved CUX-01, CUX-02, CUX-03, and CUX-06 tranche is complete. No costing input, formula, module identity, freshness, Save/lock/conflict, or quote-reconciliation contract changed.

- CUX-01: templates and the Advanced Flashings table now reflow from their own container width. Both registered scenarios pass containment at 1600, 1366, 1024, 768, and 390px.
- CUX-02: sticky placement follows the actual scroll owner. Local Calculator scrollports use a local `top: 0`; an embedded Calculator using document scroll consumes the portal plus sticky-project offsets. Mobile document containment uses `overflow-x: clip`, avoiding an accidental vertical scroll container.
- CUX-03: issue routing waits two layout frames after dialog/module transition, reveals Advanced-only sections when required, finds the nearest scroll owner, reveals the complete field/error, focuses the invalid control without a second scroll, corrects geometry, and cancels stale work.
- CUX-06: current and retained automatic pitch/downpipe cues come only from the selected authoritative result. Raw blank pitch and downpipe `0` remain unchanged; validation errors temporarily replace the cue.

Focused component/helper tests, the 22-test Calculator trust suite, both registered five-width scenarios, standalone/project sticky geometry, cross-module issue routing, and hidden Advanced Flashings routing pass. The broader foundation suite's three targeted layout tests pass; its unrelated evidence-only test still records a local `estimate_cost_actuals` GET 500 when that optional migration is unavailable.

Slice 5 is implemented in the current worktree without changing costing, persisted inputs, module identity, freshness, Save/lock/conflict, permissions, or exact-cent quote handoff:

- CUX-04: the Workspace owns stacked result navigation. Below the `1080px` Calculator container breakpoint, one early rounded summary offers `View results` and conditional `Review issues`; the Inspector offers `Back to configuration`, restoring the last focused configuration control or the first editable fallback. Embedded stacked layouts suppress duplicate read-only Context, while standalone and split layouts retain it.
- CUX-07: the Workspace controls the active Inspector tab. A genuine tab change resets only an independently scrolling result rail; same-tab activation is a no-op, and ordinary stacked tab changes do not move the page.
- CUX-09: split layouts show the single rounded customer summary in the Inspector header, while stacked layouts show it before configuration. The Pricing panel now owns discount, before-discount, unpriced-item, and permission-gated internal-cost detail without a second total hero; `Price by item`, Save review, and quote handoff retain exact cents.
- CUX-11: the selected module's rafter result and written working now precede the Plan/Section views in DOM order and stacks above them at narrow widths.

Focused component coverage covers the new composition, routing, controlled-tab, pricing-detail, Context, and Workings-order contracts. Authenticated acceptance passed across both registered scenarios at 1600px, 1366px, 1024px, 768px, and 390px, including stacked result/issue/back routing, one visible rounded summary, Inspector scroll ownership, Workings order, embedded Context ownership, deep-scroll Save reachability, and exact-cent saved quote handoff.

## Slice 1 - CUX-01 configuration containment

### Ownership and change

- Primary: `apps/portal/app/staff/calculator/CalculatorJobTemplates.module.css`
- Advanced containment: the Flashings table styles in `CalculatorGrid.module.css`
- Component/test owner: `CalculatorJobTemplatePicker.tsx` and `CalculatorJobTemplatePicker.test.tsx`
- Browser owners: `playwright/portal.calculator-foundation-ui.spec.ts` and `playwright/portal.calculator.spec.ts`
- Preserve: `useCalculatorPreviewSplit.ts`, the split minimums, and form container breakpoints.

Replace the template card and action row's fixed intrinsic two-column minimums with intrinsic wrapping based on their own available inline size. Remove the viewport-only `760px` dependency. The card must stack its internal regions before it can widen `.configurationMain`; it must not change the Calculator split breakpoint. Apply the same owner-width rule to the Advanced Flashings grid, whose former viewport-only breakpoint could leave controls clipped inside a narrow split pane.

The browser containment helper must inspect every visible input, select, button, label, and field tile against the configuration pane and every ancestor whose computed overflow is `hidden` or `clip`. Keep the separate document-overflow assertion.

### Five-width contract

- 1600: split layout, three configuration columns, normal two-part template presentation.
- 1366: split layout, two configuration columns; the template reflows internally and no control is clipped.
- 1024: stacked layout, three configuration columns.
- 768: stacked layout, two configuration columns.
- 390: stacked layout, one configuration column; template select and Apply action stack.

Both registered scenarios must satisfy the same contract, including minimum and maximum allowed preview split positions at 1600 and 1366.

### Acceptance and tests

- `.leftCol`, `.configurationWorkspace`, and `.configurationMain` have no hidden horizontal overflow.
- Every visible template/form interactive rect is contained by each clipping ancestor.
- Every enabled control can receive focus and `click({ trial: true })`; disabled controls remain visible, contained, and correctly exposed as disabled.
- Simple and complex 1366 screenshots show the complete configuration pane.
- Extend `CalculatorJobTemplatePicker.test.tsx`.
- Extend both Calculator Playwright files; the current 1366 coverage of the preview rail is insufficient.

Risk: an over-broad breakpoint could stack the whole Calculator early or shrink the preview below its supported minimum. Mitigate with split-position assertions at 1600/1366 and existing form-column assertions.

No staff decision is required.

## Slice 2 - CUX-02 sticky chrome ownership

### Ownership and change

- Shell offset owner: `apps/portal/components/layout/PortalShell.module.css`
- Document containment owner: `apps/portal/app/globals.css`
- Embedded masthead owner: `apps/portal/components/projects/ProjectPage/ProjectPage.module.css`
- Existing masthead measurement: `ProjectPageFrame.tsx`
- Calculator owner: `CalculatorTrustUi.module.css`
- Focused tests: `FoundationStyles.test.ts`, `ProjectPageFrame.test.tsx`, `CalculatorCommandBar.test.tsx`, and the Calculator Playwright files.

Define one inherited `--portal-sticky-content-top` on portal content: `0px` without the mobile bar and `calc(var(--ui-mobile-bar, 56px) + env(safe-area-inset-top))` at 899px and below. Make the project masthead consume that offset.

Expose a project-local `--project-page-sticky-masthead-height`: measured masthead height while it is sticky, `0px` when it becomes static at 767px and below. When the embedded Calculator participates in document scrolling, its command bar uses:

`portal sticky top + project sticky masthead height`

The standalone Calculator and any embedded Calculator with its own internal scrollport use local `top: 0`, because external chrome already sits outside that scrollport. Preserve z-index ownership: portal bar above project masthead, project masthead above Calculator command bar. Use the same effective top value for Calculator `scroll-padding-top`/`scroll-margin-top` targets. At mobile widths, use `overflow-x: clip` rather than `hidden` on the document so horizontal containment does not manufacture a vertical scroll owner and disable viewport sticky behavior.

This small shared CSS contract is required because Calculator-local `top` values cannot know whether the project masthead is currently sticky.

### Five-width contract

- 1600/1366: the usual split command bar remains non-sticky; a container-narrow embedded hybrid may use a local Calculator scrollport and local sticky top.
- 1024: the stacked standalone command bar sticks to its Calculator scrollport; the embedded command bar sticks below the project masthead in document scroll.
- 768: portal bar is fixed, project masthead remains sticky, and embedded Calculator Save sits below both.
- 390: portal bar is fixed, project masthead is static, and Calculator Save sits below the portal bar only.

### Acceptance and tests

After deep scrolling in standalone and embedded routes:

- Save's full rect is below all visible shell/masthead chrome and inside the viewport.
- `elementFromPoint()` at Save's centre resolves to Save or a descendant.
- `click({ trial: true })` succeeds when enabled.
- Keyboard focus and its indicator are unobscured when Save is enabled; a disabled Save remains fully visible, unobstructed, and semantically disabled.
- The contract holds in current, Updating, invalid/last-valid, and warning/review states.
- Reduced motion does not alter placement, and the CSS/style test proves the offset retains `env(safe-area-inset-top)`.
- Capture 768 and 390 deep-scroll evidence.

Risk: the portal variable is inherited by other routes. It has no effect until a sticky consumer opts in; run focused shell and project-header regressions. Command-bar height changes in Slice 7 must re-run this full acceptance.

No staff decision is required.

## Slice 3 - CUX-03 deterministic issue routing

### Ownership and change

- State/orchestration: `useCalculatorIssueNavigation.ts`
- New pure DOM helper: `calculatorViewportNavigation.ts`
- Issue mapping remains: `calculatorIssueNavigation.ts`
- Modal remains: `CalculatorSaveDialogs.tsx` and shared `Modal.tsx`
- Prop assembly only: `CalculatorGridClient.tsx`

The immediate helper accepts a target element; the orchestration layer owns a cancellable two-frame scheduler. Together they:

1. waits for the Issues modal to unmount and any module switch to render;
2. finds the nearest real vertical scroll owner, falling back to `document.scrollingElement`;
3. computes the unobscured top from the sticky-offset contract and visible Calculator command bar;
4. corrects the real owner's `scrollTop` directly so correctness does not depend on animation;
5. focuses with `preventScroll`;
6. makes one final correction if the target or its inline error is outside the unobscured viewport; and
7. cancels stale work if another issue is selected or the component unmounts.

Issue routing needs module switch plus modal teardown. The existing blinds jump is same-page and may share only the final reveal/focus helper. Infill routing is inside an overlay with a different scroll owner and stays separate. Do not consolidate those differences away.

### Five-width contract

- 1600/1366 split: the left-pane scroll owner moves; the selected module and target field/error are visible.
- Stacked standalone: the Calculator root scroll owner moves.
- Stacked embedded: the document scroll owner moves when the Calculator has joined document flow.
- 768: the target is below portal, project, and Calculator sticky chrome.
- 390: dialog closes; target and inline error both intersect the usable viewport and target centre hit-tests correctly.

### Acceptance and tests

- Correct module has `aria-current`; target has focus, `aria-invalid`, and the expected `aria-describedby`.
- The Issues dialog is absent before focus is announced.
- The correct scroll owner moved; no unrelated Inspector scroll changes.
- The same assertions pass with reduced motion.
- Correcting the input restores the existing current/readiness/Save behavior.
- Expand `useCalculatorIssueNavigation.test.tsx` beyond mocked `scrollIntoView`.
- Add helper unit tests for nested scroll owners, sticky offsets, cancellation, missing targets, and fallback focus.
- Add cross-module browser cases at 1600, 768, and 390; capture the 390 resolved jump.

Risk: layout effects and dialog scroll locking can race. Use deterministic frame scheduling and cancellation, not fixed timeouts.

No staff decision is required.

## Slice 4 - CUX-06 resolved automatic defaults

### Ownership and change

- New pure presenter: `calculatorResolvedDefaults.ts`
- Field contract: `calculatorConfigurationSections.ts`
- Field definitions: `calculatorStructureFields.ts` and `calculatorSiteFields.ts`
- Rendering/association: `CalculatorConfigurationForm.tsx`, `FieldTile.tsx`, and component-owned CSS
- Authoritative inputs: the active `moduleResult.derived.roof_pitch_deg_used` and `moduleResult.inputs_normalized.downpipe_count` already selected by `useCalculatorResultPresentation.ts`
- `CalculatorGridClient.tsx` remains prop assembly; it must not calculate a default.

Add `resolvedDefaultText?: string` as a presentation-only configuration field property. `CalculatorConfigurationForm` passes only this property to FieldTile's descriptive-text slot; routine schema `helperText` remains suppressed. Validation errors win and temporarily suppress the cue.

The presenter receives the raw active-module values, the authoritative selected module result, gutter applicability, and result freshness. It never reimplements pitch or downpipe rules.

Copy contract:

- Current automatic value: `Auto - current result uses {value}`.
- Calculating/stale with retained output: `Auto - last valid result used {value}; updating`.
- Invalid/error with retained output: `Auto - last valid result used {value}; fix inputs to confirm`.
- Waiting/no result: `Auto - confirmed after a valid calculation`.
- Explicit positive pitch/downpipe: no Auto cue.
- Raw blank pitch and raw downpipe `0` remain unchanged.

The numeric value is whatever the authoritative active-module result reports; it is not hard-coded to 5 deg or one downpipe.

### Five-width contract

At all five widths the cue wraps within its field, is visually subordinate but readable, and is associated through `aria-describedby`. Module switching updates it without moving focus. At 390 it cannot create horizontal overflow or cover the next control.

### Acceptance and tests

- Pure presenter matrix: automatic/explicit values, all six freshness states, no result, gutter/no-gutter, and box-perimeter gutters.
- Structure/site builder tests prove raw values are unchanged.
- `CalculatorConfigurationForm.test.tsx` proves only resolved cues render, routine helpers remain suppressed, and errors win.
- Browser checks in both scenarios at all widths prove cue values match Workings/normalised results and Live totals do not change.
- Capture current cues at 1600 and retained cues at 390.

Risk: displaying a locally recomputed "default" would create a second source of truth. Require result-derived values in code review and parity tests.

Staff validation dependency: determine whether staff need an explicit no-downpipe state. That would change today's input semantics and is not authorised by this slice.

## Slice 5 - CUX-04, CUX-07, CUX-09, CUX-11 result hierarchy

### Ownership and change

- Composition and scroll owner: `CalculatorWorkspaceView.tsx`
- New stacked-only owner: `CalculatorStackedResultActions.tsx` plus its own CSS module
- Controlled tab semantics: `CalculatorResultInspector.tsx` and `CalculatorResultInspector.module.css`
- Configuration duplication: `CalculatorConfigurationForm.tsx` and `CalculatorConfigurationForm.module.css`
- Price hierarchy: `CalculatorPricingSummary.tsx`, `CalculatorPricingSummary.module.css`, and a new `CalculatorPricingDetails.tsx`
- Exact cents remain: `CalculatorItemPricingBreakdown.tsx`
- Workings owners: `CalculatorRafterExplanation.tsx` and `ModuleViewsCard.tsx`

Do not add inline state or layout to the 1073-line `CalculatorGridClient.tsx` or expand the 5061-line `CalculatorGrid.module.css`. `CalculatorWorkspaceView` adds and owns the active Inspector tab plus a new right-rail ref; GridClient continues to assemble domain props.

#### Stacked task order (CUX-04)

At widths below the 1080px Calculator container breakpoint, render:

1. command bar;
2. module navigator and selected-module identity;
3. one compact rounded price/freshness summary with `View results` and conditional `Review issues`;
4. common job template;
5. editable configuration;
6. Result Inspector.

For the embedded stacked route, hide the read-only Context section because project/design/draft identity is already present in the project masthead and command bar. Keep Context in the standalone route. Do not move the template relative to manual fields until staff validate that workflow.

`View results` selects Pricing, reveals the Inspector below sticky chrome, and focuses the Pricing tab. `Review issues` selects/focuses Issues. A stacked-only `Back to configuration` action returns focus to the last focused configuration control, falling back to the first editable field.

At 1600/1366 the current split task model remains: module/configuration left, Inspector right, no stacked shortcuts.

#### Inspector tab scroll (CUX-07)

Make the Inspector tab controlled by WorkspaceView. On a genuine tab change, if `.rightCol` is the active independent scroll owner, reset it to the Inspector start with `behavior: 'auto'`. Same-tab clicks do nothing. At 1024/768/390, ordinary tab changes do not move the outer page; only the explicit stacked result/back actions navigate the page.

Do not add per-tab scroll restoration in this slice; starting each newly selected task at its heading is the smaller predictable contract.

#### Price precision and duplication (CUX-09)

Show exactly one rounded customer summary:

- 1600/1366: the Inspector header summary;
- 1024/768/390: the early compact summary.

Label it `Customer price (rounded, inc GST)` and label its ex-GST value as rounded. Remove the repeated hero total from the Pricing panel. `CalculatorPricingDetails` owns discount scope, before-discount context, unpriced-item qualification, and the existing admin-only internal-cost disclosure without another customer-total hero.

`CalculatorItemPricingBreakdown`, Save review, Preserve/Reprice comparison, and quote projection continue to show/use exact cents.

#### Workings answer order (CUX-11)

Render `CalculatorRafterExplanation` before `ModuleViewsCard` in DOM order. At wide preview-rail widths they may remain side by side, with the result first; at stacked widths the result/calculation chain is above the diagram. Do not change `ModuleViewsCard` APIs or geometry inputs.

### Acceptance and tests

- `CalculatorWorkspaceView.test.tsx`: exact split/stacked composition and external result routing.
- `CalculatorConfigurationForm.test.tsx`: embedded stacked Context hidden; standalone Context retained.
- `CalculatorResultInspector.test.tsx`: controlled tabs, keyboard contract, same-tab behavior, tab reset requests, focus return, inactive-panel/disclosure persistence, and Workings DOM order.
- `CalculatorPricingSummary.test.tsx`, `CalculatorItemPricingBreakdown.test.tsx`, and new PricingDetails tests: one rounded summary, explicit precision labels, permissions, discount scope, and exact cents.
- Browser at all five widths: task order, result/issue/back routing, one visible summary, no overflow, and module identity unchanged.
- Browser at 1600/1366: scroll Materials deeply, select Workings, and see its heading/result at the top; stacked tab changes must not jump the page.
- Existing rafter parity, exact-cent Save, Preserve/Reprice, and quote-mapping tests remain green.

Risks:

- Moving Inspector state can regress keyboard tabs; retain `tablist`, `tab`, `tabpanel`, `aria-controls`, roving `tabIndex`, arrows, Home, and End.
- Removing a repeated price can accidentally remove admin detail or freshness context; test each permission and freshness state.
- An automatic `scrollIntoView` on every tab would be disruptive on mobile; gate scroll changes by the actual scroll owner.

Staff validation dependencies:

- template-before-fields remains provisional but unchanged;
- confirm whether the rounded persistent price should remain whole dollars or show cents;
- confirm the result-first Workings order against real explanation tasks.

## Slice 6 - CUX-05 and CUX-12 breakdown scanability and language

### Ownership and change

- UI owner: `CalculatorTrustedBreakdowns.tsx` and `CalculatorTrustedBreakdowns.module.css`
- Panel gate: `CalculatorPreviewDetails.tsx`
- Copy-only package owner: `packages/costing/src/engine/breakdownExplanation.ts`
- Drainage labels: `calculatorSiteFields.ts` and `calculatorIssueNavigation.ts`

Wrap each existing material/labour group in a native `<details>` disclosure. The summary contains:

- Materials: group label and row count.
- Labour: group label, activity count, and group crew hours.

Open the first group on initial render and collapse the rest. Preserve user-open state while the tab remains mounted. Every row, quantity, explanation, multiplier, cost permission, retained-result notice, and total remains available. Do not add search, filters, virtualisation, pagination, or truncation in this slice.

Use plain generated explanation copy, for example:

- `Required cuts total 31.57 m. Purchasing uses 11 whole 4 m bars.`
- `Bars are purchased whole; allocated waste is stock left after arranging required cuts.`

Remove `stock allocator`, `package-owned`, `engine driver`, and malformed `{profile} cuts` grammar from routine summaries. Keep source IDs unchanged but move each row source into a nested collapsed `Technical source` disclosure. Rename `DP joins/elbows` to `Downpipe joins/elbows` in both field and issue labels; IDs do not change.

### Five-width contract

- 1600/1366: group summaries bound the independent rail; one group starts open.
- 1024/768/390: the same group order is retained; summaries are keyboard operable and at least 44px high at 390.
- Opening one group never creates horizontal overflow; closing it restores the compact scan.
- Default visible copy contains no package ID or developer-only term. Technical source remains discoverable on demand.

### Acceptance and tests

- `CalculatorTrustedBreakdowns.test.tsx`: group counts/hours, initial state, toggling, state persistence, full row recovery, permission gates, retained notices, and technical sources.
- `CalculatorPreviewDetails.test.tsx`: view selection preserves the complete authoritative breakdown props and permission gates.
- `breakdownExplanation.test.ts`: corrected grammar and unchanged facts, values, rounding, source IDs, row/group counts, and quantities.
- `calculatorSiteFields.test.ts` and `calculatorIssueNavigation.test.ts`: full downpipe labels with unchanged IDs.
- Browser at 1600 and 390: Materials/Labour collapsed and expanded, no nested overflow, all rows recoverable.
- Normal disclosure assertions exclude implementation IDs; Technical source assertions include the unchanged IDs.

Risk: a controlled disclosure can lose user state on result refresh. Key groups by stable package group ID and test retained/current rerenders. Copy-only package edits must not alter trusted contract shape.

Staff validation dependencies: confirm first-open versus all-collapsed and identify real lookup/filter needs. Search and module/stage filters require a later evidence-based slice.

## Slice 7 - CUX-08 and CUX-10 command/readiness clarity

### Ownership and change

- Command source order: `CalculatorCommandBar.tsx` and `CalculatorTrustUi.module.css`
- Readiness presenter: new `calculatorReadinessSummary.ts`
- Status construction/gating: `calculatorQuoteStatusUi.ts`
- Issue count source: `CalculatorGridClient.tsx` (prop assembly only)
- Inspector/status rendering: `CalculatorResultInspector.tsx` and `QuoteStatusCard.tsx`
- Module grammar: `CalculatorModuleNavigator.tsx`
- If Quote Status styles change, extract them from `CalculatorGrid.module.css` into `QuoteStatusCard.module.css` rather than expanding the hotspot.

#### Visual and focus order (CUX-08)

Render one DOM sequence:

1. project/design/draft/module identity;
2. readiness status;
3. Basic then Advanced;
4. Save.

Wrap readiness, mode, and Save in one command-controls owner. Desktop and mobile CSS must present the same left-to-right/top-to-bottom order; do not use CSS `order` or grid placement to contradict source order. At 390 the controls may wrap only between logical groups, and Save remains a single control.

#### Cause versus blocked checks (CUX-10)

Keep every status row and `hasStatusBlockers` Save preflight. Add presentation metadata so a derived Engine check can declare `blockedBy: 'inputs'` when invalid inputs are the cause. Derive:

- causal issues/root causes for the primary command and Inspector message;
- blocked readiness-check count for Quote Status detail.

Examples:

- `1 input issue blocks Save`
- `2 readiness checks blocked`
- `Updating - Save waits for a current result`

Do not present an Updating wait as an independent defect. Engine errors remain an independent cause. Correct `1 issues` everywhere. This is display modelling only; it cannot make Save eligible.

### Five-width contract

- 1600/1366: one horizontal identity -> readiness -> mode -> Save order.
- 1024: wrapping preserves the same reading/focus order.
- 768/390: visual rows and Tab order agree; Save stays below the sticky chrome contract from Slice 2.
- Long retained/error text wraps or uses an accessible compact label without horizontal overflow.

### Acceptance and tests

- `CalculatorCommandBar.test.tsx`: DOM order, singular/plural copy, current/Updating/retained/error states, and one Save.
- `calculatorQuoteStatusUi.test.ts` and new presenter tests: zero/one/many issues; independent blockers; input-caused Engine check; warning-only review; Updating; engine error.
- `CalculatorResultInspector.test.tsx`, `QuoteStatusCard` tests, `CalculatorModuleNavigator.test.tsx`, and `calculatorModuleNavigation.test.ts`: cause/check wording and grammar.
- Browser at 768/390: Tab sequence matches visual order; focus ring is unobscured; invalid state says one cause can block two checks.
- Re-run all Slice 2 deep-scroll hit tests after the command-bar height/flow change.

Risk: deduplicating language must not deduplicate gating. Assert the old and new models produce identical `hasStatusBlockers` and Save-disabled outcomes for the same inputs.

No staff decision is required for causal wording or focus order.

## Cross-width acceptance contract

| Width | Layout and order | Scroll/sticky owner | Expected configuration |
| --- | --- | --- | --- |
| 1600x1000 | Split; module/configuration left, Inspector right | Independent left/right rails; command bar not sticky | Three columns; template two-part |
| 1366x900 | Split; same product order | Independent rails; no clipping | Two columns; template reflows internally |
| 1024x900 | Stacked; early summary/actions before template and fields, then Inspector | Page scroll; embedded command below sticky project masthead | Three columns |
| 768x1024 | Stacked, same task order | Page scroll; command below portal bar plus sticky project masthead | Two columns |
| 390x844 | Stacked, same task order | Page scroll; command below portal bar; project masthead static | One column |

At every width:

- no document, pane, field, disclosure, or tab-strip horizontal clipping;
- selected module remains visible and programmatically current;
- changed normal text meets 4.5:1 contrast; focus indicators and control boundaries meet 3:1;
- focus is visible, not covered by sticky chrome, and follows visual order;
- new primary actions, tabs, Jump, Save, and disclosure summaries are at least 44px at 390; other changed targets meet at least 24px;
- semantic labels, headings, `aria-describedby`, tab relationships, and status announcements remain complete;
- reduced motion does not alter correctness;
- no action requires hover or developer knowledge.

This does not authorise a broad all-control CUX-13 touch-target redesign.

## State and handoff regression matrix

| State/workflow | Required behavior |
| --- | --- |
| Current | Live result, current Auto cues, one rounded summary, exact detail, Save eligibility unchanged. |
| Calculating | Last valid price remains explicitly retained; Auto cues say last valid/updating; Save waits; navigation still works. |
| Waiting | No false price/default; neutral cue says confirmation follows a valid result; Save blocked. |
| Invalid | Causal input count leads; last valid result is labelled; Jump visibly focuses field/error; Save blocked. |
| Stale | Retained result and recalculation pending remain explicit; no current claim or enabled Save. |
| Engine error | Last valid result/update failure remain explicit; engine error is an independent cause; Save blocked. |
| Warning/review | Issues and consequence remain visible; required acknowledgement still occurs in Save; cancel does not persist. |
| Preserve | Reason remains required and at least 10 characters; stored pricing basis is explicit; no false exact-Live claim. |
| Reprice | Live exact cents replace stored basis; every projected quote line and total reconciles exactly. |
| Lock/conflict | Existing lock and conflict paths remain fail-closed; refinements cannot bypass them. |
| Local-first idle/error/conflict | Existing ineligible/error behavior remains. |
| Local-first queued/syncing/synced/offline | Existing outcome and handoff eligibility remain; copy does not imply server sync when offline/queued. |
| Blind or mapping mismatch | Invalid blind/mapping remains a blocker; quote creation remains unavailable. |
| Module switch | Active module identity, values, cues, issues, drawings, and Workings all switch together. |
| Staff/admin permissions | Customer totals remain visible as today; internal material/labour/true-cost values remain gated. |
| Old result without trusted breakdown | Existing unavailable/recalculate message remains; do not fabricate rows. |

## Verification plan

### Deterministic scenarios

- Give `project-with-estimate` a fixture revision before using it as the simple mutation scenario.
- Keep `calculator-multi-module` as the complex three-module/two-pergola trust scenario.
- Provision before authenticated runs, use `--workers=1`, and run mutating Preserve/Reprice cases last.
- Never click Create quote. Reprice may update only the deterministic local or explicitly approved staging estimate.
- Delay a costing request after an initial Live response to exercise Updating.
- Inject a schema-valid nonblocking warning in Playwright to exercise warning acknowledgement without changing package rules.
- Use the shared redacted evidence helper. Never capture login, credentials, cookies, storage state, or auth headers.

### Browser matrix

Run non-mutating simple and complex smoke at all five exact widths. Required evidence:

- 1366 configuration containment;
- 768 and 390 deep-scroll Save hit ownership;
- 390 issue Jump with focused field and inline error visible;
- automatic pitch/downpipe cues at 1600 and 390;
- all five top-level task-order views;
- Materials/Labour collapsed and expanded at 1600 and 390;
- Workings leading result at 1600 and 390;
- one rounded price summary at every width;
- Preserve outcome, Reprice exact-cent outcome, and one warning state.

Do not use brittle full-page pixel equality or exact content heights. Assert geometry, ownership, visibility, semantics, and authoritative values.

Test-infrastructure owners are `playwright/portal.calculator.spec.ts`, `playwright/portal.calculator-foundation-ui.spec.ts`, `playwright/support/portalScenarioRegistry.ts`, `scripts/ensure-portal-scenarios.ts`, and `package.json`.

Additional cross-cutting assertions:

- reuse or extract the computed contrast helper from `playwright/portal.ui-foundation.spec.ts`; require 4.5:1 for normal cue/status text and 3:1 for focus indicators and control boundaries in Live, retained, blocked, warning, and selected states;
- at 390, arrow through the horizontally constrained Inspector tablist and ensure the focused tab is scrolled into view without moving the page;
- add `CalculatorSaveOutcomeDialog.test.tsx` coverage for idle, queued, syncing, synced, offline, error, and conflict outcomes, preserving today's eligibility rules;
- browser-test one delayed save through queued/syncing to synced without creating a quote;
- retain compact module switching at 390 and add a valid blind plus 10 percent discount case at 1600 and 390, proving the discount excludes the blind and exact totals still match quote projection.

### Focused and full gates

Implementation should update `portal:calculator-ui` to include both Calculator Playwright files and run them serially. From the repo root:

```powershell
npx vitest run apps/portal/app/staff/calculator apps/portal/lib/localFirst apps/portal/components/sync/LocalFirstPortalMutations.test.tsx scripts/ensure-portal-scenarios.test.ts packages/costing/src/engine/breakdownExplanation.test.ts
npm run test:portal:projects
npm run portal:calculator-ui:provision
npm run typecheck
npm run build:portal
npm run portal:bundle-budget
npm run docs:guard
npm run architecture:changed
```

The Task 2 read-only audit baseline passed 25 focused files / 171 tests. That baseline is not a substitute for the new browser geometry and state cases.

### Implementation documentation

The implementation pass must keep current-state and command owners aligned:

- update `docs/projects-contacts-estimates-calculator.md` with the final task order, automatic-default cues, Inspector navigation, and readiness presentation;
- update `docs/testing-and-qa.md` when `portal:calculator-ui` begins running both Calculator Playwright files serially;
- assess `docs/costing-and-geometry.md` against the CUX-12 copy-only package change and update it if its explanation examples or ownership wording become stale;
- keep `docs/calculator-trust-and-explainability-goal.md` and this plan's status accurate at final handoff.

## Approval and staff-validation gates

Implementation may begin after approval of this plan. The direct defects and bounded presentation changes can proceed without invented staff evidence.

Approval of this plan also accepts the following provisional presentation defaults for the bounded implementation:

- keep the template before manual fields;
- keep the persistent summary whole-dollar rounded and label it as rounded;
- present the rafter result before the diagram;
- open the first breakdown group initially and collapse the rest;
- use the neutral procurement/crew wording specified in Slice 6.

If approval does not include any of those defaults, obtain the named staff decision before implementing that part of Slice 5 or 6. In all cases, obtain staff evidence before:

- adding an explicit no-downpipe semantic;
- adding breakdown search/filter dimensions;
- changing the provisional task order, precision, disclosure default, or terminology beyond this bounded plan.

Stop and re-plan if staff validation or implementation requires a wizard, new costing/input semantics, a second calculation path, package contract changes, persisted quote creation, or a broader responsive redesign.
