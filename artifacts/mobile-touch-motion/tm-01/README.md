# TM-01 before-and-after evidence

## Capture identity

- Date: 2026-07-26
- Before source: `4139abb2`
- After source: `302b5b81` (`0a8a3ca2` is the implementation commit)
- Origin: isolated local Next.js Playwright server
- Browser: Playwright Chromium
- Viewport: 390 x 844
- Reduced motion: off for screenshots; separately asserted on in the browser suite
- Capture command:
  `MARKETING_TOUCH_MOTION_CAPTURE=1 npx playwright test playwright/marketing.foundation.spec.ts --config=playwright.marketing.config.ts`

| Interaction family | Before | After |
| --- | --- | --- |
| Foundation actions | [before](./before-foundation-actions-390x844.png) | [after](./after-foundation-actions-390x844.png) |
| Editorial card | [before](./before-editorial-card-390x844.png) | [after](./after-editorial-card-390x844.png) |
| Disclosure and gallery controls | [before](./before-foundation-interactions-390x844.png) | [after](./after-foundation-interactions-390x844.png) |

The screenshots force the CSS `:active` pseudo-state so finger-down feedback
can be reviewed without relying on capture timing. They do not dispatch click,
navigation, disclosure-toggle or gallery-change behaviour.

## Computed interaction evidence

The same 390 x 844 fixture was measured before and after forcing `:active`.
Layout measurements use `offsetWidth` and `offsetHeight`, which remain
independent of the deliberately small visual transform.

| Target | Before active feedback | After active feedback | Layout size before/after |
| --- | --- | --- | --- |
| Primary button | No visual change | Background `#41483c`, scale `.992` | 166 x 48 / 166 x 48 |
| Secondary button | No visual change | Background `#f1f0eb`, dark border, scale `.992` | 190 x 48 / 190 x 48 |
| Text link | No visual change | Opacity `.82` | 195 x 44 / 195 x 44 |
| Editorial card | No visual change | Elevated surface and opacity `.82`; no scale | 349 x 272 / 349 x 272 |
| Disclosure summary | No visual change | Quiet surface and opacity `.82`; no scale | 350 x 52 / 350 x 52 |
| Gallery control | No visual change | Neutral surface, dark border, scale `.992` | 110 x 44 / 110 x 44 |

The browser suite also proves:

- governed active transitions resolve through the 80 ms and 160 ms tokens
- fine-pointer hover treatments remain available on desktop
- a coarse-pointer tap releases to the normal state without sticky hover
- focus-visible treatment remains intact
- reduced-motion durations compute to `0s`, scales compute to `1`, and the
  `.86` non-motion press feedback remains
- Disclosure remains native and the controlled gallery still exposes one
  active image with unchanged `Image 1 of 3` status

## Production-build performance comparison

Both sources were built with `npm run build:marketing` and served with
`next start`. The public homepage was sampled in five fresh Chromium contexts
at 390 x 844 with analytics and marketing consent disabled.

| Measure | Before `4139abb2` | After `302b5b81` |
| --- | ---: | ---: |
| `.page-layer` computed `will-change` | `transform, opacity` | `auto` |
| Median first contentful paint | 60 ms | 60 ms |
| Median cumulative layout shift | 0 | 0 |
| DOM nodes | 891 | 891 |
| Median layout count | 6 (range 6-7) | 7 (range 6-8) |
| Median style recalculation count | 20 (range 19-23) | 21 (range 19-22) |
| Median used JS heap | 4,112,272 bytes | 4,130,116 bytes |
| Median total JS heap | 7,077,888 bytes | 7,077,888 bytes |

The layout, style and heap samples overlap their run-to-run ranges; no paint,
CLS, DOM-size or total-heap regression was observed. TM-01 adds no runtime
JavaScript, package or image request. The actively transformed two-pixel route
progress bar retains its existing narrow `will-change`.

## Clean-worktree validation

- Focused motion and Foundation unit suites: 3 files, 13 tests passed
- Marketing unit suite: 51 files, 259 tests passed
- Foundation browser suite with evidence capture: 29 passed, 2 unrelated
  capture-only tests skipped
- Marketing TypeScript: passed
- Repository lint and policy guards: passed
- Marketing production build: passed

Physical iPhone Safari and Android Chrome smoke remains a deployment-closure
gate from the roadmap and is not represented by this emulated evidence.
