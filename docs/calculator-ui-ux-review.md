# Calculator UI/UX Evidence Review

Status: Task 1 review complete (2026-07-27). Evidence and recommendations only; no product code changed.

## Scope and method

The Calculator was reviewed as an internal staff tool using the registered `project-with-estimate` and `calculator-multi-module` scenarios. The review covered the standalone and project-embedded routes at 1600x1000, 1366x900, 1024x900, 768x1024, and 390x844. It included mouse, keyboard, responsive, deep-scroll, invalid-input, retained-result, Result Inspector, Save, and quote-handoff paths.

The current worktree and rendered application were treated as authoritative. This review reports observed behavior, not staff feedback. Preferences and decisions needing staff evidence are called out separately.

## What is already strong

- Current, Updating, and last-valid result states are explicit and consistently tied to Save readiness.
- Module identity remains visible and the selected module is exposed with `aria-current`.
- The Result Inspector has a sound tablist/tabpanel structure and supports arrow, Home, and End keys.
- Pricing, materials, labour, workings, warnings, and quote readiness derive from authoritative Calculator or costing outputs.
- Internal costs remain permission-gated.
- Preserve/Reprice, estimate locks, local-first outcomes, and exact-cent quote reconciliation provide a strong handoff safety model.

These are product contracts to preserve, not redesign targets.

## Prioritised findings

| ID | Severity and type | Observed evidence | Staff consequence | Recommended direction |
| --- | --- | --- | --- | --- |
| CUX-01 | High - usability defect | At 1366px the split layout remains active, but the template card's intrinsic minimum width exceeds the remaining configuration column. `.leftCol` hides the overflow, clipping the template action and right-side controls. | A staff user can miss or be unable to reach configuration controls while the page appears otherwise valid. | Make the template card respond to its own available width and add containment checks for every visible control, not only the document or field grid. |
| CUX-02 | High - accessibility defect | At 768px and 390px, the sticky Calculator command bar uses `top: 0` while the portal mobile bar is fixed above it. After deep scrolling, the portal bar covers the Save control. The embedded 768px route also has a sticky project masthead. | Save can be visible but not clickable or keyboard-visible, undermining the primary completion action. | Establish one inherited sticky-content offset for portal chrome, project masthead, and Calculator command bar; verify actual hit ownership after deep scrolling. |
| CUX-03 | High - accessibility defect | From the Issues dialog at 390px, Jump moved focus to Roof Length but left its bounding box roughly 1080px above the viewport. The hook scrolls smoothly and focuses immediately while the dialog and module layout are changing. | Keyboard and screen-reader users are told focus moved but cannot see or confidently correct the field. | Route after modal teardown, identify the real scroll owner, position below sticky chrome without animation, then focus and verify the field plus error are visible. |
| CUX-04 | High - possible structural improvement | In the stacked layouts the Inspector begins far below configuration: about 1739px in the simple path and 2317px or more in the complex path. At 390px the first editable field began around 858px. | Staff must know results exist and undertake a long scroll before they can inspect price, readiness, or issues. | Preserve the configure-then-review model, but add an early result/issue route, remove redundant embedded context at stacked widths, and provide a return to configuration. |
| CUX-05 | High - possible structural improvement | The complex scenario produced about 60 material rows over roughly 10,455px and 77 labour rows over roughly 14,582px. Every group and row is expanded. | Finding one procurement or labour assumption is slow and error-prone, especially on mobile. | Use native group disclosures with compact summaries and keep every authoritative row available. Defer search/filter dimensions until staff identify common lookup tasks. |
| CUX-06 | High - usability defect | A blank Roof Pitch was costed using an automatic pitch (5 deg in the observed scenario), while a Downpipes value of `0` resolved to one downpipe when Sanctuary guttering applied. The form suppresses the helper text that mentions these defaults. | Entered values and costed values appear to disagree, reducing confidence in both inputs and results. | Show presentation-only resolved-default cues sourced from the active module's authoritative derived/normalised result. Do not change raw inputs or costing semantics. |
| CUX-07 | Medium - usability defect | After scrolling Materials to about 2200px, switching to Workings retained/clamped the Inspector rail near 904px instead of revealing the new tab's start. | A tab can look empty or incomplete because its heading and primary result begin above the visible area. | Reset the independent preview rail to the Inspector start on a genuine tab change; do not move the outer page in stacked layouts. |
| CUX-08 | Medium - accessibility defect | At narrow widths CSS places Save in the first visual row, but DOM/focus order remains identity, status/mode actions, then Save. | Keyboard progression does not match the visual layout, making the command bar harder to predict. | Put identity, readiness/mode, and Save into one source order and render that same order at every width. |
| CUX-09 | Medium - visual refinement | The rounded customer total appears two or three times depending on width, while exact cents appear later without the rounded-versus-exact distinction being labelled. | Repetition weakens hierarchy and small apparent discrepancies can look like reconciliation defects. | Show one rounded summary per layout, label it as rounded, and retain exact cents in Price by item, Save review, and quote handoff. |
| CUX-10 | Medium - usability defect | One missing input produced two blocked readiness rows, one input issue, and a compact `1 issues` label. Readiness-check counts are presented as though they were independent root defects. | Staff can overestimate the amount of correction required and cannot see cause and consequence at a glance. | Lead with causal input issues, label downstream rows as blocked checks, and correct singular/plural grammar without changing Save gating. |
| CUX-11 | Medium - possible structural improvement | Workings presents the module diagram before the final rafter result and calculation chain. On narrow layouts the answer is therefore well below the illustration. | Staff seeking the number needed for an explanation must scan past secondary context first. | Put the authoritative result/calculation first in DOM order and the diagram second; retain both and preserve geometry parity. |
| CUX-12 | Medium - usability defect | Routine explanations include phrases such as `stock allocator`, `package-owned`, package source IDs, `DP joins`, and generated grammar such as `Rafters cuts`. | Important assumptions require developer vocabulary and can be misread during customer or quote explanation. | Use plain procurement/crew language, expand downpipe labels, and move unchanged source IDs into optional technical details. |

## Observed defects versus validation questions

The clipping, sticky obstruction, off-screen issue focus, hidden automatic defaults, inherited tab scroll, source/visual focus-order mismatch, issue grammar, and unexplained abbreviations are defects supported by direct evidence.

The following choices need real staff validation before expanding scope:

- whether templates normally come before or after manual entry;
- whether staff need a true explicit "no downpipes" state (today `0` means automatic in the relevant gutter case);
- which material/labour lookup dimensions matter enough to justify search or filters;
- whether one breakdown group should start open or all should start closed;
- whether the persistent price should remain whole-dollar rounded or show cents;
- whether staff normally explain the rafter number or the diagram first;
- preferred staff language for stock plans, labour loadings, and crew hours.

## Recommended Task 2 boundary

Plan CUX-01, CUX-02, CUX-03, and CUX-06 first. Then plan the smallest coherent changes for CUX-04 through CUX-12. Do not change costing formulas, Calculator input/payload contracts, module identity, freshness semantics, Save/lock/conflict behavior, or exact-cent quote mapping. Broader wizard, template-order, filter, and all-control touch-target redesigns stay deferred.

## Ready-to-use Task 2 goal

> Produce an implementation-ready Calculator UI/UX refinement plan only. Start from `docs/calculator-ui-ux-review.md`. Plan CUX-01, CUX-02, CUX-03, and CUX-06 first, followed by the smallest coherent hierarchy and density improvements for CUX-04 through CUX-12. Specify component ownership, behavior at all five reviewed widths, accessibility and responsive acceptance criteria, state coverage, tests, risks, and staff-validation dependencies. Preserve costing ownership, module identity, retained-result semantics, Save/lock/conflict behavior, and exact-cent quote reconciliation. Do not implement refinements until the plan is approved.
