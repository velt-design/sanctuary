# Design Tokens + Workbench Density — Plan

**Drafted**: 2026-05-26. **Status**: proposed, awaiting go-ahead.

Phase 1 establishes a unified design-tokens layer that both Tailwind v4 and CSS modules read from. Phase 2 uses it to ship the visual density change requested for the workbench. Phase 1 is a no-visual-change refactor; Phase 2 is the user-facing payoff.

---

## Read First

- Treat this as a visual-density plan, not the current workbench style contract.
- Use `docs/workbench-visual-snapshot-loop.md` before making visual changes.
- Check shipped markers in each PR section before assuming a step is still pending.

## 1. Goal

**Phase 1**: Make a single source of truth for design decisions — CSS custom properties at `:root`, exposed to Tailwind via `@theme inline`, referenced from CSS modules, with no visual change to the rendered app.

**Phase 2**: Tighten the workbench to match `public/images/sanctuary_pergola_workbench.png` density — smaller bubbles, more info per screen — by flipping token values inside a `[data-workbench-density="compact"]` scope. Zero changes to TSX, only token values and a single attribute on the workbench root.

---

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

Two:

- `docs/maintainability-principles.md` § "single source of truth" — design decisions today exist as ~194 magic `px` values scattered across 6 workbench CSS modules + duplicated values in `globals.css`. Tokens make the source-of-truth explicit and prevent the drift we've already paid for (e.g. `8px` appearing 47 times means 47 places to change if the design system shifts).
- `docs/design-workbench-architecture.md` § "Product North Star" treats the workbench as a CAD surface with different ergonomics than the rest of the portal (read-only 3D vs editable plan; CAD density vs marketing spacing). A density-variant token scope makes that distinction structural rather than ad-hoc.

### What alternatives were considered, and why rejected?

1. **Migrate the whole portal off CSS modules to Tailwind utility classes.** Rejected: ~1500-2500 LOC of JSX churn for zero functional improvement, and the workbench's repeated field/section primitives (~30 call sites of `.field { display: grid; ... }`) read worse as Tailwind class soup. Tailwind `@apply` directives would reinvent CSS modules badly.
2. **Leave the current mixed approach as-is and just edit individual CSS rules for the density change.** Rejected: short-term cheaper (~150 LOC) but pays the drift tax forever. Every future "tighten the workbench" or "rebrand" or "make the inspector wider" requires re-editing the same files. The tokens layer is a one-time investment that makes all future visual changes ~5-line edits.
3. **Build a custom design-system component library on top of either layer.** Rejected: premature. The token layer captures 80% of the long-term value at 10% of the cost. Components can come later if a real need emerges.

### What does this consciously NOT try to do?

- **NOT migrate any existing CSS module to Tailwind utility classes.** Both delivery mechanisms stay; they just read from shared tokens.
- **NOT touch JSX in Phase 1.** Pure refactor. Phase 2 changes one attribute on the workbench root and nothing else.
- **NOT introduce new components, hooks, or React abstractions.** The whole story is CSS variables.
- **NOT promote the marketing app's tokens up.** Marketing has its own `@theme inline` block with marketing-appropriate tokens (clamp-based responsive spacing). Portal gets its own block. The two apps are different products.
- **NOT add a UI toggle for density modes.** The `data-workbench-density` attribute is a hard-coded `"compact"` on the workbench root. If we ever want user-toggleable density that's a separate future PR; this plan just establishes the mechanism.
- **NOT change behavior of any field, section, row, or interaction.** Density is purely cosmetic.

### Net tech debt: pay down or add?

**Net pay-down.** Replaces ~194 scattered magic `px` values with ~25 named tokens, eliminates value drift between Tailwind and CSS modules, and gives every future design tweak a single edit point. The new `@theme inline` block adds ~25 lines but they're load-bearing infrastructure, not debt.

---

## 3. The new model

### Token registry — added to `apps/portal/app/globals.css`

```css
:root {
  /* Existing tokens stay unchanged */
  --portal-space-1: 6px;
  --portal-space-2: 10px;
  /* ... etc ... */

  /* NEW: size tokens (control / row / column dimensions) */
  --portal-size-control-sm: 28px;   /* compact buttons, status pills */
  --portal-size-control-md: 32px;   /* inline field controls (mockup target) */
  --portal-size-control-lg: 40px;   /* current default, kept for non-workbench */
  --portal-size-row-sm: 28px;       /* dense rail rows (mockup) */
  --portal-size-row-md: 36px;       /* current default rail row */
  --portal-size-row-lg: 48px;       /* current chunky row */
  --portal-size-rail-width: 280px;
  --portal-size-inspector-width: 360px;

  /* NEW: density-aware text size scale */
  --portal-font-xs: 11px;
  --portal-font-sm: 12px;
  --portal-font-md: 13px;
  --portal-font-lg: 14px;
}

/* NEW: compact density variant — flips values inside the scope */
[data-workbench-density="compact"] {
  --portal-space-1: 4px;
  --portal-space-2: 6px;
  --portal-space-3: 8px;
  --portal-space-4: 12px;
  --portal-space-5: 16px;
  --portal-size-control-md: 28px;
  --portal-size-row-sm: 24px;
  --portal-size-row-md: 32px;
  --portal-size-rail-width: 220px;
  --portal-size-inspector-width: 290px;
  --portal-radius-md: 8px;
}

/* NEW: expose tokens as Tailwind utilities */
@theme inline {
  --color-portal-page: var(--portal-bg-page);
  --color-portal-surface: var(--portal-bg-surface);
  --color-portal-ink: var(--portal-text);
  --color-portal-muted: var(--portal-text-muted);
  --color-portal-border: var(--portal-border);
  --spacing-portal-1: var(--portal-space-1);
  --spacing-portal-2: var(--portal-space-2);
  --spacing-portal-3: var(--portal-space-3);
  --spacing-portal-4: var(--portal-space-4);
  --spacing-portal-5: var(--portal-space-5);
  --spacing-portal-6: var(--portal-space-6);
  --radius-portal-sm: var(--portal-radius-sm);
  --radius-portal-md: var(--portal-radius-md);
  --radius-portal-lg: var(--portal-radius-lg);
  --radius-portal-pill: var(--portal-radius-pill);
  --shadow-portal-card: var(--portal-shadow-card);
  --shadow-portal-elevated: var(--portal-shadow-elevated);
}
```

### CSS module changes (Phase 1 sample)

```css
/* BEFORE (WorkbenchRail.module.css) */
.section {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(var(--portal-text-rgb), 0.03);
}

/* AFTER — same visual rendering, token-driven */
.section {
  display: grid;
  gap: var(--portal-space-3);
  padding: var(--portal-space-3);
  border-radius: var(--portal-radius-md);
  background: rgba(var(--portal-text-rgb), 0.03);
}
```

### Workbench root change (Phase 2)

```tsx
// DrawingWorkbench.tsx
<div className={styles.shell} data-workbench-density="compact">
  {/* nothing else changes */}
</div>
```

Effect: every CSS rule that references `var(--portal-space-3)`, `var(--portal-size-row-md)`, etc. inside the workbench tree now resolves to the compact variant value. One attribute, dozens of rule updates.

---

## 4. PR sequence

### PR-T1 — Token registry + Tailwind theme block

**One PR.** Adds the size + font-size + density tokens to `apps/portal/app/globals.css`. Adds the `@theme inline` block exposing tokens as Tailwind utilities. **Zero CSS module or TSX changes.**

Acceptance: typecheck clean, portal renders byte-identically (no visible diff), Tailwind classes like `bg-portal-page`, `p-portal-3` resolve. Confirms the infrastructure works before we depend on it.

### PR-T2 — Workbench CSS modules consume tokens

**One PR.** Replace magic `px` values in 6 workbench CSS modules with token references. **Zero TSX changes, zero visible diff** (tokens are set to current values).

Most-touched files: `WorkbenchRail.module.css` (95 px refs), `DrawingWorkbench.module.css` (38), `DesignWorkbenchEstimateClient.module.css` (31), `RightInspectorPanel.module.css` (14), `PlanCanvas.module.css` (9), `ObjectTreeSection.module.css` (7).

This is the load-bearing PR — once it lands, Phase 2 is a 2-line change.

### PR-T3 — Flip workbench to compact density

**One PR.** Add `data-workbench-density="compact"` to the workbench shell root in `DrawingWorkbench.tsx`. Define the compact-variant block in `globals.css`. Tweak any token values that need adjustment after browser-testing.

**This is the only PR with a visible diff.** Expected effect: workbench rail rows shrink from ~48px to ~28px, inspector field rows from ~40px to ~32px, column widths tighten, gaps compress. Rest of the portal unchanged.

---

## 5. Per-PR file map

### PR-T1 files

| File | Change | LOC |
|---|---|---|
| [globals.css](apps/portal/app/globals.css) | Add `--portal-size-*`, `--portal-font-*`, density-variant scaffold (empty `[data-workbench-density="compact"]` block), `@theme inline` block | +60 |

### PR-T2 files

| File | Change | LOC |
|---|---|---|
| [WorkbenchRail.module.css](apps/portal/components/drawings/rail/WorkbenchRail.module.css) | Replace magic px with token refs across `.section`, `.field`, `.fieldLabel`, button/select sizing, gaps | ~95 lines touched |
| [DrawingWorkbench.module.css](apps/portal/components/drawings/workbench/DrawingWorkbench.module.css) | Token refs for toolbar/page padding/gaps | ~38 lines touched |
| [DesignWorkbenchEstimateClient.module.css](apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchEstimateClient.module.css) | Token refs for column grid, gaps, button sizes | ~31 lines touched |
| [RightInspectorPanel.module.css](apps/portal/components/drawings/inspector/RightInspectorPanel.module.css) | Token refs for outer padding, header sizing | ~14 lines touched |
| [PlanCanvas.module.css](apps/portal/components/drawings/viewports/PlanViewport/canvas/PlanCanvas.module.css) | Token refs for toolbar position/padding | ~9 lines touched |
| [ObjectTreeSection.module.css](apps/portal/components/drawings/rail/objectTree/ObjectTreeSection.module.css) | Token refs for row sizing | ~7 lines touched |

Total: ~194 line replacements across 6 files.

### PR-T3 files

| File | Change | LOC |
|---|---|---|
| [DrawingWorkbench.tsx](apps/portal/components/drawings/workbench/DrawingWorkbench.tsx) | Add `data-workbench-density="compact"` to shell root div | +1 |
| [globals.css](apps/portal/app/globals.css) | Populate the `[data-workbench-density="compact"]` block with compact values | +20-30 |
| Possibly small tweaks to compact values after browser-test | — | ~10 |

---

## 6. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| `@theme inline` block conflicts with existing Tailwind classes (portal uses v3-style `@tailwind base` directives) | Low | Marketing app already uses `@theme inline` successfully with `@tailwindcss/postcss`. Portal's `@tailwind base/components/utilities` are v4-compatible aliases. Verify by checking that an existing Tailwind class still resolves after the change. |
| PR-T2 introduces a visible diff because I mis-mapped a value to a token | Med | Browser-test after PR-T2 by loading the workbench and visually comparing to a screenshot of HEAD. The tokens are set to current values precisely so PR-T2 is a true no-op. Any drift signals a wrong mapping. |
| Compact density values in PR-T3 break readability (text too small, controls too cramped to click) | Med | Browser-test in PR-T3 with real mouse interactions. Tweak compact values until acceptable. Mockup is the upper-bound target; we can land a less-aggressive compact if needed. |
| A non-workbench portal page accidentally inherits compact values | Very Low | `[data-workbench-density="compact"]` is scoped to the workbench shell root. Cannot leak via class collision; CSS variable scoping is structural. |
| Token name collision with Tailwind built-ins | Low | All new tokens prefixed `portal-*`. No collision with Tailwind's default `--color-*`, `--spacing-*`, etc. |
| Drawing workbench tests assert on specific pixel values | Low | Tests assert on test IDs and counts, not pixel values. Verified via grep across `apps/portal/**/*.test.tsx` — no `expect().toHaveStyle({ padding: '14px' })` patterns. |

---

## 7. Acceptance criteria

### PR-T1

- Typecheck clean: `npx tsc -p apps/portal/tsconfig.json --noEmit --incremental false`
- Portal renders byte-identically vs HEAD (manual: load `/staff/projects/[id]/design-workbench`, compare against pre-PR screenshot)
- New Tailwind utilities resolve in a test class (`<div className="p-portal-3 bg-portal-page" />` produces expected styles)
- Existing Tailwind utilities still resolve (regression check)

### PR-T2

- Typecheck clean
- All workbench tests stay green: `npx vitest run apps/portal/components/drawings apps/portal/lib/drawings apps/portal/components/drawings/inspector`
- HARD GATE: marketing email path 6/6 (`npx vitest run apps/marketing/lib/enquiryBudgets.test.ts apps/marketing/emails/templates/customerEstimateEmail.test.tsx`)
- Visual diff: zero. Workbench renders byte-identically to PR-T1.

### PR-T3

- Typecheck clean
- All workbench tests stay green
- HARD GATE: marketing email path 6/6
- Visual diff: workbench rail rows are visibly smaller, column widths tighter, fields more compact. **Browser-test required** — diff against the mockup and report any remaining gaps.
- Non-workbench portal pages render unchanged (load `/staff/contacts` or `/staff/projects`, verify no density regression)

---

## 8. Estimates

| PR | LOC | Risk | Est time |
|---|---|---|---|
| PR-T1 (token registry + @theme block) | ~60 | low | 30-60 min |
| PR-T2 (CSS modules consume tokens) | ~194 lines touched, 6 files | medium | 2-3 hours (careful sweep, browser-verify byte-identical) |
| PR-T3 (flip to compact density + tune) | ~30-50 + iteration | low-medium | 1-2 hours (most time on browser-tuning, not coding) |

Total: **4-6 hours** end-to-end. Each PR independently shippable; you can stop after T1, T2, or T3 if priorities shift.

---

## 9. Sequencing diagram

```
PR-T1 (registry + @theme)  ──→  PR-T2 (modules consume)  ──→  PR-T3 (compact density)
        |                              |                              |
        | no visual diff               | no visual diff               | VISIBLE EFFECT
        | proves infra works           | proves token coverage        | matches mockup
```

Each PR has a clear stopping point. If PR-T3 reveals problems, T1+T2 stay landed as pure pay-down — you don't have to roll back to keep the value.

---

## 10. What I'd push back on

The original ask ("just visual changes to make it look like the mockup") could be answered with a ~150 LOC CSS-edit PR that ships in an hour. The tokens-first approach is **3-4× the work for the same immediate visual result**. The tradeoff is real and worth naming:

- **If you only care about THIS density change**, skip the plan and ship a direct CSS edit. Defensible if the workbench design is final.
- **If you expect more density / theme / rebrand work over the next 6 months**, the tokens layer pays back fast. After T1+T2, every future "tighten the inspector" or "rebrand" is a 5-line edit.

The plan above assumes the second case. If that's wrong, the right move is a small direct-edit PR (call it PR-W13) and we revisit tokens when a second design change forces the question.

---

## 11. CTA

Three options, ordered by ambition:

1. **Full plan (PR-T1 → T2 → T3)**: best long-term, ~4-6 hours, you get tokens infra + visual density. **Recommended if you expect more design iteration.**
2. **Tokens infra only (PR-T1 + T2), defer T3**: pay down debt now, ship density later. Useful if you want to validate the infra without committing to the visual change.
3. **Skip tokens, ship direct CSS-edit PR-W13**: ~1 hour, gets you the density change immediately but locks in the magic-px pattern.

Say which and I'll start.
