# TM-02 review evidence

Captured on 2026-07-26 for PR TM-02, “Adopt the tactile contract across shared chrome and route adapters.”

- Before source: `9e3580ef435740b30dbd2f209ab39a1fca52c1ba` (`origin/main`, TM-01 merge)
- Implementation source: `db7daf4fbaaaffff1224d47d6fb83b8e0681377d`
- Browser: Playwright Chromium
- Pressed-state captures: `prefers-reduced-motion: no-preference`
- Performance route and viewport: `/`, 390 × 844, three fresh production runs per source
- Additional behavioral coverage: 430 × 932, 390 × 844, 360 × 800, and desktop 1440 × 1000, including `prefers-reduced-motion: reduce`

## Before and after

| Interaction | Before | After | Review note |
| --- | --- | --- | --- |
| Short mobile menu / current route | [before](before-mobile-menu-active-360x480.png) | [after](after-mobile-menu-active-360x480.png) | Current-route identity remains stronger while the held link gains a quiet pressed surface. |
| Homepage intent | [before](before-homepage-intent-active-430x932.png) | [after](after-homepage-intent-active-430x932.png) | The existing immediate unselected response is intentionally unchanged; behavioral coverage now proves selected-state precedence. |
| Footer review action | [before](before-footer-review-active-430x932.png) | [after](after-footer-review-active-430x932.png) | The shared footer action now has immediate, scoped pressed feedback. |
| Project selector sheet | [before](before-project-sheet-active-390x844.png) | [after](after-project-sheet-active-390x844.png) | The close control gains feedback; the sheet uses the governed 220 ms enter / 150 ms exit vocabulary. |
| Product card | [before](before-product-card-active-390x844.png) | [after](after-product-card-active-390x844.png) | The native link gains restrained surface/opacity feedback without changing gallery ownership. |
| Contact audience choice | [before](before-contact-choice-active-390x844.png) | [after](after-contact-choice-active-390x844.png) | Transient feedback is visible while selected choices retain full-strength state. |
| Contact file removal | [before](before-contact-file-remove-active-390x844.png) | [after](after-contact-file-remove-active-390x844.png) | The semantic removal button gains immediate feedback and keeps its existing 44 px target. |

The screenshots force Chromium’s `:active` pseudo-state only for deterministic capture. Separate behavioral tests use a held mouse press and assert the real `:active` state before release.

## Runtime and performance

| Production measurement | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Resource requests | 53 | 53 | 0 |
| Script requests | 14 | 14 | 0 |
| Stylesheet requests | 11 | 11 | 0 |
| Script transfer | 190,417 B | 190,467 B | +50 B |
| Stylesheet transfer | 95,875 B | 96,940 B | +1,065 B |
| DOM nodes | 264 | 264 | 0 |
| CLS | 0.01818313267896049 | 0.01818313267896049 | 0 |
| Long tasks | 0 | 0 | 0 |
| Median FCP | 72 ms | 72 ms | 0 |
| Failed responses | 0 | 0 | 0 |

Raw runs: [before](before-performance.json) and [after](after-performance.json).

No tactile feedback handler, React state, effect, pointer listener, dependency, or motion library was added. The runtime TypeScript changes only bind scoped CSS classes to existing footer markup and remove superseded global hover utilities. The emitted script request count is unchanged; the 50-byte transfer difference contains no tactile JavaScript behavior. Initial resource count, layout size, CLS, FCP, and long-task observations are unchanged.

`RouteProgress` still owns navigation timing with `SHOW_DELAY_MS = 150`. Its focused browser check observes no loading class before the existing delay (140 ms timing tolerance), while the CSS-only visual durations now use the shared tokens.

## Reproduction

The paired screenshots were captured against separate worktrees:

```sh
MARKETING_BASE_URL=http://127.0.0.1:3021 \
MARKETING_TM02_CAPTURE_LABEL=before \
npx playwright test playwright/marketing.touch-motion.spec.ts \
  --config=playwright.marketing.config.ts --grep "capture TM-02"

MARKETING_BASE_URL=http://127.0.0.1:3022 \
MARKETING_TM02_CAPTURE_LABEL=after \
npx playwright test playwright/marketing.touch-motion.spec.ts \
  --config=playwright.marketing.config.ts --grep "capture TM-02"
```

Both worktrees were built with:

```sh
npm run build:marketing
```

## Validation

- Focused motion/Foundation Vitest: 6 files, 31 tests passed
- Full marketing Vitest: 52 files, 265 tests passed
- Marketing TypeScript check: passed
- Full repository lint: passed
- Production marketing build at before and after sources: passed, 66 pages each
- Focused TM-02 browser behavior: 10 tests passed
- Relevant Foundation/route browser regression, serial: 152 passed, 7 capture-only tests skipped
- Phase 5 12-route matrix at 430, 390, and 360 px plus cache-busted identity/state: 4 passed
- Mobile content density, semantics, hydration, no-JavaScript, context, and fragments: 9 passed
- `npm run architecture:changed` with the TM-02 owner lane declared: clean
- `git diff --check`: clean

## Production closure

Physical-device smoke remains required before production closure:

- iPhone Safari: homepage → menu → products/projects → contact, including file selection/removal
- Android Chrome: the same journey, including held presses, native gallery controls, and disclosure controls

These artifacts and Playwright runs are emulation evidence, not physical-device proof.
