# Mobile UX Phase 5 Validation

Status: In progress.

Authoritative brief: `docs/mobile-ux-roadmap-v2.md`, Phase 5 and PR 14.

This document is the dated evidence record and operator runbook for the final
mobile UX phase. Browser emulation and automated Chromium checks are supporting
evidence only. They do not replace a physical iOS Safari run, a physical Android
Chrome run, VoiceOver, or TalkBack.

## Completion rule

Phase 5 is complete only when all of the following have dated evidence:

- the primary task scripts pass on physical iOS Safari and Android Chrome at
  representative small and large mobile sizes;
- the same primary tasks pass with VoiceOver and TalkBack, and the desktop
  keyboard path passes;
- production analytics events reconcile with successful enquiries without
  personal information in analytics;
- field and lab performance evidence covers the primary deployed routes;
- any bounded fix is retested on every affected device, assistive technology,
  route and automated lane; and
- every unresolved result is recorded as an explicit prioritised backlog item.

`Blocked` means the required device, assistive technology, account access or
submission authority was not available. It is not a pass or a fail.

## Release under test

| Evidence | Value | Status |
|---|---|---|
| Evidence date | 26 July 2026 | Recorded |
| Local branch | `main` | Recorded |
| Local commit at Phase 6 audit start | `a1ccfacd` | Recorded |
| Remote checkpoint | `origin/main` at `a1ccfacd` | Recorded |
| Local divergence at audit start | No commit divergence; the supplied untracked completion review was preserved unchanged | Recorded |
| Production origin | `https://www.sanctuarypergolas.co.nz` | Reachable |
| Public deployment identity at audit start | No commit identifier was exposed by normal or cache-busted public responses | Blocked at audit start |
| Repository release identity fix | All marketing responses now receive `X-Sanctuary-Release` from an explicitly supplied or provider commit SHA; non-SHA values are rejected and local development reports `local` | Passed locally and in production |
| Protected preview release identity | PR #25 identified `59e6f25e106f8e34ad20074f2452db1b38f6c531`; stacked PR #26 identified `f2a2e2e22eb23b0fe96e592a0a86c3f06f128f75` | Passed with authenticated, read-only Vercel CLI requests |
| Phase 6 production identity | Merge release `f207a1e975421a42b3b6734be5a84bae1134b7da` | Passed on normal and cache-busted primary-route responses |

The public deployment serves the approved Phase 3 through Phase 6 route
structure, intercepted enquiry/review-name fixes, corrected commercial framing
and accessible native project-gallery controls. The protected PR #25 and
stacked PR #26 previews each passed 24 normal/cache-busted response checks
across the 12-route matrix and identified their exact head commit. After both
PRs merged, the same production contract passed against merge release
`f207a1e975421a42b3b6734be5a84bae1134b7da`.

## Primary task scripts

Run each applicable script with normal touch navigation first, then with the
named assistive technology. Record the result against the exact device,
operating-system version, browser version, viewport class, date and tester.

### T1 - Header, audience routes and browser history

1. Open the homepage from a fresh tab.
2. Open the mobile menu and confirm Home, Projects, Products, Commercial,
   Architects/designers/builders and Contact are understandable.
3. Confirm the menu does not expose or focus the page behind it.
4. Close with the visible control; repeat and close with the supported
   keyboard or screen-reader action.
5. Open Commercial, use the browser Back gesture and confirm the homepage
   returns predictably.
6. Open Architects/designers/builders and repeat the Back gesture.
7. Rotate once or use a short viewport and confirm the menu can still reach
   every destination without trapping page scroll after close.

Pass conditions: focus enters and leaves the menu predictably; background
scroll is locked only while open; controls remain visible; Back returns to the
expected page; no horizontal overflow appears.

### T2 - Residential service to enquiry

1. Open `/pergolas-auckland`.
2. Identify the proposition, built evidence, main suitability constraint and
   next action without opening supporting detail.
3. Open and close one supporting disclosure.
4. Follow the primary enquiry action.
5. Confirm Residential is selected and the recognised source is shown above
   the form.
6. Refresh and use browser Back/Forward.

Pass conditions: disclosure state and focus are announced; the source remains
recognisable after refresh; Back/Forward do not produce a stale or surprising
form state.

### T3 - Project discovery, gallery and contextual enquiry

1. Open `/projects`.
2. Select Commercial, open a commercial project and return with the browser
   Back gesture.
3. Confirm the filter and collection return predictably.
4. Open `/projects/warkworth-outdoor-room`.
5. Swipe through at least three images in the native horizontal gallery strip,
   then use Previous and Next without swiping.
6. Confirm the visible position text changes, disabled-edge state is conveyed,
   and focus remains on the operated control.
7. Confirm the images retain different aspect-ratio heights, remain aligned to
   the top, and each caption moves with its image.
8. With a keyboard, focus the gallery region, confirm its focus indicator is
   visible, and operate Arrow Left/Right, Home and End.
9. Follow the project enquiry action.
10. Confirm the project name, project slug and Residential audience are visible
   and preserved through refresh.

Pass conditions: the native strip moves without moving the page sideways;
different image heights remain top-aligned; the controls are at least 44 px,
have contextual names and report `Image n of total`; reduced motion removes
smooth scrolling; Back is predictable; no priority crop is unreadable; the
project and audience reach the form and eventual payload.

### T4 - Product comparison and contextual enquiry

1. Open `/products`.
2. Open `/products/pergolas/gable`.
3. Identify the outcome, fit, main constraint and evidence before opening
   optional detail.
4. Operate the gallery and each disclosure using the active input method.
5. Follow the enquiry action.
6. Confirm the product is visible above the form.
7. Confirm no Residential audience is forced without reliable entry context.

Pass conditions: product context survives refresh and submission; controls are
announced and visible; unknown or absent audience remains neutral.

### T5 - Commercial and professional paths

1. Open `/commercial-pergolas-auckland`, review the first commercial case and
   follow the enquiry path.
2. Confirm Commercial is selected and the source is visible.
3. Open `/architects-designers-builders`, review capability evidence and reach
   its form.
4. Confirm Professional is selected and the source is visible.
5. Add a supported test attachment only when submission authority is granted.

Pass conditions: the audiences cannot cross over; file guidance and status are
announced; source context reaches the payload.

### T6 - Guides and return to a decision

1. Open `/pergola-guides`.
2. Choose the cost guide.
3. Confirm the answer, one built example and the return action are available
   before optional depth.
4. Open optional depth, return to the service route, then use browser Back.

Pass conditions: reading order is logical; disclosure state is announced;
Back returns to a useful state; the guide does not trap the visitor away from a
decision or enquiry.

### T7 - Neutral contact, validation, retry and success

1. Open `/contact` directly in a new private tab.
2. Confirm no audience is preselected and no source-context banner is shown.
3. Attempt submission with required fields empty.
4. Confirm the error summary is announced or focused and its links move to the
   fields without losing entered values.
5. Select an approved test audience, complete the required fields and exercise
   mobile keyboard/autofill.
6. Exercise an approved reversible failure only in an intercepted or designated
   test environment; confirm values remain for retry.
7. With explicit production submission authority, send one designated test
   enquiry and confirm the success state is announced.

Pass conditions: direct contact stays neutral; validation is understandable;
values survive correction/retry; duplicate submission is prevented; success is
announced.

### T8 - Footer, zoom and outdoor readability

1. Reach the footer from the homepage, one long guide and Contact.
2. Confirm phone, email, core routes, privacy and social links remain distinct
   and tappable.
3. Check the page at 200 percent zoom where supported.
4. Spot-check hero crops, text-over-image contrast and muted metadata in bright
   conditions.

Pass conditions: no overlapping or obscured controls; no horizontal document
scroll; important crops and text remain understandable.

## Physical-device and assistive-technology matrix

| Run | Device requirement | Browser / AT | Scripts | Result | Evidence needed |
|---|---|---|---|---|---|
| D1 | Physical iPhone near 360 px CSS width | Safari, touch | T1-T8 | Blocked | Device model, iOS/Safari version, dated notes and screenshots for any failure |
| D2 | Physical iPhone near 430 px CSS width | Safari, touch | T1-T8 | Blocked | Device model, iOS/Safari version, dated notes and screenshots for any failure |
| D3 | Physical Android near 360 px CSS width | Chrome, touch | T1-T8 | Blocked | Device model, Android/Chrome version, dated notes and screenshots for any failure |
| D4 | Physical Android near 430 px CSS width | Chrome, touch | T1-T8 | Blocked | Device model, Android/Chrome version, dated notes and screenshots for any failure |
| A1 | One representative physical iPhone | VoiceOver and Safari | T1-T8 | Blocked | Spoken focus/order notes, control announcements, validation and success result |
| A2 | One representative physical Android | TalkBack and Chrome | T1-T8 | Blocked | Spoken focus/order notes, control announcements, validation and success result |
| A3 | Desktop | Keyboard-only Chromium | T1-T8 where applicable | Pending | Automated result plus dated manual focus-order check |

Automated browser coverage supplements A3 by exercising menu focus containment
and return, disclosures, galleries, filters, form error focus and success
announcements. Thirteen focused production keyboard/focus checks passed on 26
July 2026, and the affected five-test local regression set also passed. A dated
manual keyboard-only pass is still required because automation cannot judge
whether the complete focus order is understandable.

### Evidence return template

Return one block for each D1-D4 and A1-A3 run:

```text
Run:
Date and tester:
Device model:
OS and browser/AT versions:
CSS viewport or display-size setting:
Scripts completed:
Result: Pass / Fail / Blocked
Failure route and step:
Expected:
Observed:
Screenshot/video filename:
Retest result, if fixed:
```

For VoiceOver and TalkBack, include the spoken name, role and focus state for
the menu, one disclosure, the project gallery region and its image captions,
the form error summary, file control and success message. For the manual
desktop run, include the first
unexpected focus jump, invisible focus indicator or trap, even if a later
automated check passes.

## Production analytics and form reconciliation

### Required production run

1. Obtain explicit authority for one designated production test enquiry and
   access to the production analytics debug view plus the received enquiry.
2. Start a clean private session and grant only the consent category being
   tested.
3. Use one approved route/context combination per audience. Do not put names,
   phone numbers, email addresses, messages, dimensions, filenames or upload
   contents into analytics inspection notes.
4. Record the non-personal event name, timestamp, audience, source path, source
   component, project slug, product slug and opaque lead/submission identifier
   where present.
5. Reconcile the browser event with the successful API response and the
   received enquiry record.
6. Confirm exactly one success and `lead_submitted` event for one successful
   submission, and no success event for validation or API failure.
7. Confirm denied consent prevents optional analytics transmission.

### Current status

| Evidence | Result | Notes |
|---|---|---|
| Intercepted form payload and event shape | Pass locally and on current production | Direct and embedded-form tests reconcile `lead_event_id` to `submissionId`, preserve canonical context and exclude personal form values |
| Intercepted deployed direct and professional-form reconciliation | Pass on 26 July 2026 | Read-only production browser tests intercepted both API requests; exact IDs matched and no real enquiry was sent |
| Production analytics debug access | Blocked | Requires access to the production analytics property/debug tooling |
| Successful production test submission | Blocked | Requires explicit authority and approved test contact details |
| Exact event-to-submission reconciliation | Automated contract passed; authorised end-to-end run blocked | Production event transmission, received-enquiry and analytics-debug reconciliation still requires authority and access |

### Required post-deployment retest

The following PowerShell lane is read-only at the business boundary: both form
tests intercept `/api/enquiry`, so they do not send an enquiry. It must pass
against the deployment containing the local fixes before the authorised
analytics/submission run:

```powershell
$env:MARKETING_BASE_URL='https://www.sanctuarypergolas.co.nz'
npx playwright test `
  playwright/marketing.contact.spec.ts `
  playwright/marketing.home-v2.spec.ts `
  playwright/marketing.phase-four.spec.ts `
  --config=playwright.marketing.config.ts `
  --workers=1 `
  --grep "submit lock prevents duplicate|professional form submits canonical context|homepage V2 is responsive and complete at 390x844|homepage closes in seven regions"
Remove-Item Env:MARKETING_BASE_URL
```

Expected result: four passed tests. On 26 July 2026 the lane passed four of four
both locally and against the current deployment. The production run intercepted
both enquiry endpoints and sent no real enquiry.

The Phase 6 release and semantic-parity lane is separate:

```powershell
$env:MARKETING_BASE_URL='https://www.sanctuarypergolas.co.nz'
npx playwright test `
  playwright/marketing.phase-five.spec.ts `
  --config=playwright.marketing.config.ts `
  --workers=1 `
  --grep "release identity and semantic route state"
Remove-Item Env:MARKETING_BASE_URL
```

It must report one hexadecimal `X-Sanctuary-Release` value across all normal and
cache-busted responses, retain the approved route markers, and exclude guide
progression from the custom, commercial and professional service routes. On 26
July 2026 this lane passed against production release
`f207a1e975421a42b3b6734be5a84bae1134b7da`. Focused production checks for the
commercial journey and mobile gallery controls also passed in the same run.

## Performance evidence

Record both lab and field evidence. Lab results can identify regressions but
cannot prove field improvement.

### Required route set

- `/`
- `/projects`
- `/projects/warkworth-outdoor-room`
- `/pergolas-auckland`
- `/custom-pergolas-auckland`
- `/products`
- `/products/pergolas/gable`
- `/commercial-pergolas-auckland`
- `/architects-designers-builders`
- `/pergola-guides`
- `/pergola-cost-auckland`
- `/contact`

### Required measures

- mobile and desktop Lighthouse categories;
- LCP, CLS, INP or lab blocking/interaction proxy, and TTFB;
- HTML and total transfer size;
- image transfer size and request count;
- hero and initial project image priority/crop behavior; and
- before/after comparison for every performance fix.

### Current status

| Evidence | Result | Notes |
|---|---|---|
| Existing pre-Phase 5 lab evidence | Available | Repository artifacts contain earlier homepage and Phase 2-4 measurements |
| Current production Chromium route matrix | Pass | 36 records across 12 routes and 430/390/360 px: HTTP 200, zero overflow and CLS, no failed requests/responses, broken viewport images, duplicate IDs or primary target failures |
| Phase 6 local Chromium route matrix | Pass | 36 records across 12 routes and 430/390/360 px: HTTP 200, zero overflow and CLS, no failed responses, broken viewport images, duplicate IDs or primary target failures; every response identified the local build |
| Current Lighthouse lab run | Pass with runner cleanup warning | Valid reports were written before a Windows temporary-profile cleanup error; mobile scores 0.98/1.00/0.96/1.00 and desktop 1.00/1.00/0.96/1.00 |
| Production field Core Web Vitals | Pass with data limitations | Public PageSpeed/CrUX URL-level homepage data passes on mobile and desktop; INP and TTFB are unavailable, and checked non-home routes fall back to origin-level data because URL-level samples are insufficient |

## Findings and prioritised backlog

| ID | Priority | Evidence | Finding | Resolution / owner | Status |
|---|---:|---|---|---|---|
| P5-01 | P1 | Source audit and deployed intercepted tests | Direct and professional forms previously emitted different opaque UUIDs for `lead_event_id` and the durable `submissionId` | The validated submission UUID is now reused; local and production intercepted contracts pass without sending an enquiry | Automated production contract resolved; authorised analytics reconciliation remains P5-03 |
| P5-02 | Gate | Environment | Physical iOS/Android, VoiceOver and TalkBack evidence is unavailable in this environment | Product owner supplies dated matrix results using T1-T8 | Blocked |
| P5-03 | Gate | Access | Production analytics debug and successful-submission reconciliation require account access and submission authority | Product owner or authorised operator completes the production run | Blocked |
| P5-04 | P2 | Release metadata | The public response exposed no source commit at audit start, so exact release-to-commit identity was not independently verifiable | Repository responses now use a sanitized `X-Sanctuary-Release` commit SHA with normal/cache-busted parity coverage | Resolved in production |
| P5-05 | P1 | Lighthouse 13.4.1 and deployed browser tests | Homepage and footer review links previously overrode their visible labels with a different accessible name | The shared badge now lets the visible rating and review count provide the name | Resolved locally and on current production browser contract |
| P5-06 | P3 | Local tooling | Lighthouse writes a valid report, then exits non-zero on Windows while deleting its temporary Chrome profile | Preserve the valid JSON evidence; rerun the canonical LHCI command in CI/Linux before closure | Open tooling follow-up |
| P5-07 | P3 | Local Next development warning | The test's deliberate full-page lazy-image warm causes Next's development observer to report the reused Warkworth image as a late LCP candidate even though the initial product/project hero path is already eager/high-priority | Freeze initial-load paint metrics before the warm and retain lazy offscreen galleries; do not eager-load below-fold images without real initial-viewport evidence | Test-harness observation; no product fix justified |
| P6-01 | P1 | Production/main semantic comparison | The commercial service route still rendered numbered guide progression after its high-intent three-case/three-stage journey | Set `showGuideNavigation: false` and pin the commercial content contract and mobile journey | Resolved in production |
| P6-02 | P1 | Production/main project-gallery comparison | The preferred native strip had no visible alternative to swipe and no current-position feedback | Retain the variable-height strip and desktop mosaic; add contextual Previous/Next controls, live position, edge state, keyboard navigation, focus preservation and reduced-motion behavior | Automated production contract passed; physical touch/AT remains blocked |
| P6-03 | P3 | Long sequential local development browser lanes | A 1024 px hero-navigation assertion can retain the commercial overlay state after a scripted 140 px scroll in Next development mode; the same production check passes. Two long sequential `networkidle`/context-close checks also timed out once and passed immediately in isolation | Keep the optimized/production lane authoritative for release behavior and investigate development HMR/network-idle timing separately; do not change customer UI to satisfy an isolated dev-only state | Open tooling follow-up; no production failure reproduced |

## Automated evidence - 26 July 2026

### Production browser behavior

- The existing deployed sweep ran 116 cases: 107 passed and eight
  capture-only cases skipped.
- One Warkworth image-load assertion failed during the long sequential sweep.
  Its screenshot showed the image element without a loaded resource. The exact
  focused production check passed immediately on rerun and the later Phase 5
  cold-context matrix recorded no broken viewport image. The failure is
  retained as transient evidence rather than hidden or presented as a product
  fix.
- The Phase 6 production capture passed all three width tests and wrote 36
  records under `artifacts/mobile-ux-phase-5/automated/`. At audit time its
  separate release identity contract failed because the deployed responses
  exposed no `X-Sanctuary-Release`.
- The protected PR #25 preview passed 24 of 24 normal/cache-busted semantic
  requests across the 12 routes with one release value, its exact
  `59e6f25e106f8e34ad20074f2452db1b38f6c531` head commit.
- The protected stacked PR #26 preview passed the same 24 of 24 requests,
  including the gallery control/status markers, with its exact
  `f2a2e2e22eb23b0fe96e592a0a86c3f06f128f75` head commit.
- The final production release passed the 24 of 24 normal/cache-busted semantic
  requests with exact identity
  `f207a1e975421a42b3b6734be5a84bae1134b7da`; focused commercial-framing and
  mobile-gallery control tests also passed.

Phase 5 route-matrix summary:

| Measure | Result |
|---|---:|
| Routes | 12 |
| Widths | 430, 390 and 360 px |
| Records | 36 |
| HTTP failures | 0 |
| Non-prefetch request failures | 0 |
| Horizontal overflow | 0 |
| Maximum measured CLS | 0 |
| FCP range | 172-2,964 ms |
| LCP range | 172-2,964 ms |
| TTFB range | 46-2,784 ms |
| Recorded long tasks | 0 |
| Broken viewport images | 0 |
| Duplicate IDs | 0 |
| Primary controls below 44 px | 0 |
| Maximum total transferred bytes | 764,111 |
| Maximum image transferred bytes | 344,410 |
| Maximum script transferred bytes | 205,977 |

Aborted Next.js RSC prefetches are recorded separately from failed user
requests because the browser may cancel speculative prefetches without a failed
navigation or visible error. These route timings use an unthrottled headless
Chromium session against a warm production CDN and are comparative lab
evidence, not mobile-network field timings.

### Local quality gates

| Check | Result |
|---|---|
| Marketing Vitest suite | Pass: 51 files, 259 tests |
| Marketing TypeScript | Pass |
| Repository lint and policy guards | Downstream package, cache, brand, mojibake and ESLint checks pass; the aggregate command is blocked before ESLint by intentional smart quotes in the supplied untracked review copy, which was preserved unchanged |
| Marketing production build | Pass: 65 static pages generated |
| Changed-file architecture sweep | Pass: no warning/critical files, dead-code pressure, root compatibility growth, browser/service-role Supabase access or boundary findings |
| Changed-behaviour Playwright retest | Pass: Phase 3/4/5 12 tests; project changed contracts 10 tests; project capture 2 tests; product 18 tests; Foundation 34 tests; commercial SEO four-width retest 4 tests |
| Production keyboard/focus Playwright set | Pass: 13 tests covering header/menu focus, disclosures, project filters/modal, product interactions, validation and retry |
| Production direct/professional UUID reconciliation | Pass: both intercepted deployed event IDs equal their submission IDs; no real enquiry sent |
| Production review-link label-in-name checks | Pass: homepage and footer names contain the visible rating/review text |
| Production Phase 6 deployment checks | Pass: exact release identity, 24/24 normal/cache-busted route responses, corrected commercial framing and mobile gallery controls/status |
| Protected PR preview release/semantic checks | Pass: PR #25 24/24 and stacked PR #26 24/24; every normal/cache-busted response identified its exact head SHA |
| Current Lighthouse command | Blocked by documented Windows `EPERM` temporary-profile cleanup after the mobile homepage audit; the valid earlier reports and the current 36-record route matrix remain the performance evidence |

The initial 50-test local browser sweep recorded one failure in the unchanged
no-JavaScript guide loop. Its exact test passed immediately in isolation and
again in the five-test changed-behaviour set. As with the production Warkworth
image result, it is retained as transient evidence rather than counted as an
unqualified clean full-suite run.

### Production field Core Web Vitals

Public PageSpeed Insights exposed URL-level homepage Chrome UX Report data for
the latest 28-day period. The checked project-detail and Contact routes did not
have sufficient URL-level samples; PageSpeed disabled `This URL` and selected
the origin aggregate. Route-level evidence for those paths therefore remains
the production lab matrix above.

| Field profile | Assessment | LCP | CLS | FCP | INP | TTFB |
|---|---|---:|---:|---:|---:|---:|
| Homepage mobile | Pass | 1.6 s | 0.02 | 1.2 s | Unavailable | Unavailable |
| Homepage desktop | Pass | 1.1 s | 0.07 | 0.9 s | Unavailable | Unavailable |

The structured record is
`artifacts/mobile-ux-phase-5/automated/pagespeed-field-data-2026-07-26.json`;
the mobile field panel is retained as
`artifacts/mobile-ux-phase-5/automated/pagespeed-mobile-home-field-2026-07-26.png`.
The missing INP and TTFB samples are recorded as limitations and are not
represented as passes.

### Homepage Lighthouse lab evidence

| Profile | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT | Total bytes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Mobile, 390 x 844 | 0.98 | 1.00 | 0.96 | 1.00 | 2,421 ms | 0.0009 | 8 ms | 729,625 |
| Public PageSpeed mobile, Moto G Power | 0.96 | 1.00 | 0.96 | 1.00 | 2,700 ms | 0.001 | 0 ms | Not exported |
| Desktop, 1350 x 940 | 1.00 | 1.00 | 0.96 | 1.00 | 713 ms | 0.0301 | 0 ms | 1,022,980 |

The mobile performance score is above the 0.90 repository threshold and the
desktop score is above 0.95. Both profiles meet the 0.95 accessibility and best
practices thresholds and the 1.00 SEO threshold. The two mobile lab runs show
normal run-to-run variance without crossing a repository threshold. These are
lab results, not field Core Web Vitals. The reports are
`artifacts/mobile-ux-phase-5/automated/lighthouse-mobile-home.json` and
`artifacts/mobile-ux-phase-5/automated/lighthouse-desktop-home.json`.

The earlier deployed Lighthouse report found P5-05; current production browser
contracts now confirm that shared name fix. Lighthouse also recorded 25.6 KB of potentially unused JavaScript,
about 14 ms of named forced reflow plus unattributed work, and no estimated
image-format savings. These are observations, not evidence for a broad rewrite.

Broad redesign, new analytics vendors, personal tracking, speculative route or
form-contract changes and unsupported causal conversion claims remain explicit
non-goals.
