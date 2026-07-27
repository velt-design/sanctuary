# Calculator UI/UX Review

Status: Task 1 evidence review complete. No Calculator product code changed.

Date: 2026-07-27

## Scope And Method

This review treats the current worktree and local application as authoritative. It covers the registered
`project-with-estimate` and `calculator-multi-module` scenarios at 1600, 1366, 1024, 768, and 390 px.
The complex workflow also covered module switching, one temporary valid blind, a temporary 10 percent
quote discount, an invalid-and-restored required dimension, Save review, local Reprice, and the proposed
quote handoff. No quote was created and no production data was used.

Evidence came from authenticated Playwright interaction, screenshots, accessibility snapshots, computed
layout and hit-testing, colour sampling, and focused source inspection where the UI exposed a contradiction.
Key screenshots are in `artifacts/calculator-ui-ux-review-task-1/`.

Severity means:

- Critical: unsafe or effectively impossible to complete.
- High: blocks or materially undermines a core staff task.
- Medium: creates avoidable uncertainty, navigation cost, or accessibility friction.
- Low: local polish with limited task impact.

No critical finding was observed.

## Strong Aspects To Preserve

- Current, updating, retained last-valid, blocked, and quote-ready states are explicit. Invalid input disables
  Save, identifies the module, preserves the last valid price, and provides an issue route.
- Module identity is strong. Desktop and compact navigators show pergola, module, roof style, size, completeness,
  issue state, and `aria-current`; Workings followed the selected module correctly.
- The Result Inspector has appropriate tab semantics, visible focus, arrow-key tab behaviour, whole-job versus
  selected-module labels, and a sticky header on wide layouts.
- Price by item clearly separates pergolas, shared site costs, blinds, and the exact customer total. Discount
  scope is explicit and correctly excludes blinds.
- Material and labour explanations expose authoritative quantities, time, waste, rounding, ownership, and
  source behind disclosure. The rafter chain and diagram agree.
- Save review makes Preserve versus Reprice explicit. After local Reprice, the handoff listed every proposed
  quote line and showed an exact-cent match before enabling Create quote.
- The tested pages had no document-level horizontal overflow or browser console errors. Key text samples met
  4.5:1 contrast, and the tested focus rings were clear.

## Prioritised Observed Findings

| ID | Severity | Type | Evidence and affected workflow | User consequence | Recommended direction |
| --- | --- | --- | --- | --- | --- |
| CUX-01 | High | Usability defect | At 1366 px in both scenarios, the configuration pane was 674 px wide with 768 px of content and `overflow-x: hidden`. The template action and the right side of Post connection, Height, Extrusion colour, Roof Span, post height, downpipe controls, and Extras were clipped. See `complex-1366-top.png` and `simple-1366-top.png`. | Staff cannot fully read or reliably operate routine inputs at a common laptop width; the hidden content has no reachable horizontal scroll. | Reflow the configuration at this width or enter the stacked layout earlier. Add a guard that checks all configuration controls stay inside the pane, not only the preview rail. |
| CUX-02 | High | Accessibility defect | After scrolling at 768 and 390 px, the Calculator command bar stuck at `top: 0` under the 54 px portal header. Save was at y=19 and hit-testing returned the portal `HEADER`, not the button. See `complex-768-save-covered-after-scroll.png` and `complex-390-save-covered-after-scroll.png`. | The sticky Save action becomes pointer-inoperable exactly when the user reaches results and is ready to save; the visible orange sliver falsely suggests it is available. | Give the Calculator sticky bar the shell-header offset, or move Save into a verified visible sticky action owner. Test pointer hit-target ownership after deep scroll at 768 and 390 px. |
| CUX-03 | High | Accessibility defect | At 390 px, clearing Roof Length, opening Issues, and choosing Jump focused `#lengthM` but left its bounding box at y=-1080 while the viewport stayed on Result Inspector. See `complex-390-issue-dialog.png` and `complex-390-issue-routed.png`. | Keyboard, magnification, and touch users are told they were routed to the error but cannot see the focused field or the inline recovery instruction. | Route through the actual owning scroll container, then focus with the mobile shell and sticky-bar offsets applied. Assert both focus and viewport intersection at 390 px. |
| CUX-04 | High | Possible structural improvement | In both scenarios, Result Inspector started at y=1739 (1024), y=2317 (768), and y=3074 (390). At 390 px the first editable job field began around y=858 because command context, module summary, compact price, template, and read-only Context came first. See `complex-1024-top.png`, `complex-768-top.png`, and `complex-390-top.png`. | Compact price remains visible, but Materials, Workings, Issues, and quote readiness are two to four screens away. The configure-check-correct loop becomes slow and important results are easy to miss. | For stacked layouts, define an explicit task order and a persistent View results/Issues route. Compress read-only context and decide whether the template belongs before the first job input. |
| CUX-05 | High | Possible structural improvement | The complex 390 px Materials panel was 10,455 px high for 60 lines, 58 disclosures, and 57 quantity explanations. Labour was 14,582 px high for 77 activities and 78 disclosures. See `complex-390-materials.png` and `complex-390-labour-advanced.png`. | Group headings help, but finding one purchase or activity still requires extreme scanning. Comparing modules, spotting exceptions, and returning to a prior row is low-confidence work. | Keep authoritative rows, but add compact group summaries, collapsible groups, and module/stage filtering or search. Prioritise exceptions, loadings, waste, and material consequences before the full inventory. |
| CUX-06 | High | Usability defect | Basic mode showed a blank Roof pitch while the Live result used 5 degrees. It showed Downpipes (count) as `0`, while Labour assumed one downpipe per module. Source inspection confirmed `0` resolves to one when "our" gutter exists; the field schema has default helper copy, but routine helpers are not rendered. | The form appears to record one thing while the result assumes another. Staff cannot confidently state what the job includes without discovering the assumption in a distant result panel. | Show the resolved default at the field: for example, `Auto (5 degrees)` and `Auto (1 with our gutter)`. Distinguish automatic choice from an explicit zero without changing package-owned costing rules. |
| CUX-07 | Medium | Usability defect | On wide layout, Materials was scrolled to 2200 px. Switching to Workings left the preview scroll at 904 px with the new panel top at y=-632, landing on the engine rule and final values rather than the Workings heading and module diagram. See `complex-1600-workings-after-material-scroll.png`. | A tab switch can open midway through a different information hierarchy, so context and the start of the explanation are silently skipped. | Give each Inspector tab an owned scroll position or reset a newly selected panel to its heading while preserving disclosure state separately. |
| CUX-08 | Medium | Accessibility defect | At 390 px, visual order is Save (y=75), project (y=137), Basic/Advanced (y=245), then module. DOM focus order is project, Basic, Advanced, Save, module. | Keyboard and switch focus moves down the header and then jumps back to the top-right Save action, weakening spatial predictability. | Make responsive DOM order match the visual order and add an asserted mobile tab sequence. Preserve the current high-contrast focus treatment. |
| CUX-09 | Medium | Visual refinement | At 1600/1366 px the same rounded customer total appears in the Inspector overview and Pricing preview. At stacked widths it appears a third time in the compact price card. The headline is `$48,567`; the exact total `$48,566.89` appears only in Price by item. | Repetition weakens hierarchy, while the unlabelled rounding makes exact quote reconciliation require extra interpretation. | Keep one persistent summary and one detailed price surface. Label the summary as rounded, or show cents at Save/handoff decision points. |
| CUX-10 | Medium | Usability defect | One missing Roof Length produced `2 blockers`, `1 input issue`, and the module label `1 issues`. The two blocked readiness checks share the same root cause. | Staff may read one correction as two independent defects, and the singular grammar reduces polish in an already stressful state. | Present the causal issue count first, then explain which readiness checks it blocks. Apply singular/plural copy consistently. |
| CUX-11 | Medium | Visual refinement | At 390 px, the Workings calculation heading began 630 px into a 1719 px panel. Initial Workings views at 1600, 768, and 390 px led with the full diagram; the final cut length was below the first view. See `complex-1600-workings.png` and `complex-390-workings-detail.png`. | The tab named Workings does not immediately answer the main question: the selected module result and how it was derived. | Lead with a concise final result and calculation chain, then pair or follow it with the diagram and deeper values. Keep the current authoritative facts. |
| CUX-12 | Medium | Usability defect | Quantity disclosures use phrases such as "stock allocator", "package-owned cut allocation", and source IDs such as `@sp/costing/materials-v1`; the first example says "Rafters cuts". Configuration also abbreviates downpipe controls as `DP joins` and `DP elbows`. See `complex-1600-material-why.png`. | Everyday explanations still require developer or engine vocabulary, weakening the goal of explanation without developer knowledge. | Use plain staff-facing language in the normal disclosure and move implementation identifiers to optional technical diagnostics. Define unavoidable trade terms and fix generated grammar. |
| CUX-13 | Low | Visual refinement | At 390 px, command actions and Inspector tabs are 44 px high, but Apply template is 34 px, add-on actions are 36 px, Reset baseline is 26 px, and modal Close is 33 px. | Targets meet the 24 px WCAG minimum sampled here, but the inconsistent touch rhythm makes secondary actions less comfortable and less predictable. | Normalise frequently used touch actions toward the existing 40-44 px mobile control rhythm where layout permits. |

## Preferences And Ideas Not Treated As Defects

- A bottom sheet, drawer, segmented stepper, or reordered single page could all improve the stacked workflow. This
  review does not select one without staff task-frequency evidence.
- Sticky mobile quote actions could make handoff faster, but the current deliberate requirement to review quote
  lines and exact reconciliation is valuable and should not be bypassed.
- A guided estimate wizard remains a larger product change, not a default answer to the density findings.
- Materials and Labour could default to exceptions only, but that depends on whether staff use these panels for
  procurement, estimate checking, customer explanation, or all three.

## Uncertainty Requiring Staff Validation

- No real staff session was conducted and no staff feedback is inferred.
- The registered scenarios produced no non-blocking warning, so warning comprehension and routing remain
  unvalidated with a realistic warning.
- Confirm whether `DP`, `install payout`, `true cost`, Preserve, and Reprice match established staff language.
- Confirm whether staff interpret Downpipes `0` as none or as automatic, and whether an explicit no-downpipe job
  must be representable.
- Observe which Materials and Labour questions staff actually answer, and whether they search by module, purchase
  stage, trade, high cost, waste, or exception.
- Validate the preferred stacked-layout task order on the devices staff really use. A 390 px layout can be robust
  without being a primary field-work surface.

## Recommended Task 2 Scope

Task 2 should produce an approved refinement plan, not implementation. It should:

1. Treat CUX-01, CUX-02, CUX-03, and CUX-06 as mandatory core-task defects.
2. Decide the stacked configuration/result order and breakdown navigation for CUX-04 and CUX-05.
3. Specify Inspector scroll ownership, Workings hierarchy, price hierarchy, blocker language, and staff-facing
   defaults for CUX-07 through CUX-12.
4. Define acceptance checks at all five reviewed widths, including hit-testing, focus visibility, focus/scroll
   routing, overflow, current/retained states, module switching, blind/discount scope, Preserve/Reprice, and
   exact-cent quote reconciliation.
5. Preserve costing and geometry source-of-truth boundaries, permissions, local-first Save semantics, and exact
   quote mapping. Do not redesign the costing rules or create a second calculation path.
6. Separate a small defect-fix slice from later hierarchy/density slices so responsive and accessibility failures
   can land without waiting for a broader information-architecture decision.

## Ready-To-Use Goal Prompt For Task 2

```text
/goal Conduct Task 2 of the Calculator UI/UX refinement project: produce an implementation-ready refinement plan only.

Start from docs/calculator-ui-ux-review.md and the current worktree. Re-verify any finding whose behaviour has
changed, but do not repeat Task 1 from scratch and do not invent staff feedback.

Plan mandatory fixes for CUX-01, CUX-02, CUX-03, and CUX-06 first. Then plan the smallest coherent hierarchy and
density improvements for CUX-04 through CUX-12. Keep preferences and staff-validation questions separate from
observed defects.

For each planned change, specify:
- the user problem and finding ID;
- the owning component or layer;
- the proposed behaviour at 1600, 1366, 1024, 768, and 390 px;
- keyboard, focus, semantics, contrast, touch, scrolling, sticky, and overflow acceptance criteria;
- current, updating, retained-last-valid, blocked, warning, Save, Preserve/Reprice, and quote-handoff states;
- test updates and screenshot evidence required;
- dependencies, risks, and whether staff validation is needed before implementation.

Split the plan into:
1. a defect-fix slice for responsive clipping, sticky action reachability, issue focus/scroll routing, and resolved
   default cues;
2. a stacked-layout and information-hierarchy slice;
3. a Materials/Labour navigation and progressive-disclosure slice;
4. copy, rounding, focus order, and touch-target polish.

Preserve module identity, authoritative Result Inspector facts, current-versus-retained status, permission gates,
local-first Save/lock/conflict behaviour, exact-cent quote reconciliation, @sp/costing ownership, geometry
ownership, and the separation from Design Workbench. Do not implement refinements until I approve the plan.
```
