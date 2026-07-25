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
| Local commit at audit start | `0da7b665` | Recorded |
| Remote checkpoint | `origin/main` at `cdda8093` | Recorded |
| Local divergence at audit start | 13 commits ahead, clean worktree | Recorded |
| Production origin | `https://www.sanctuarypergolas.co.nz` | Reachable |
| Public deployment identity | No commit identifier is exposed by the public response | Blocked pending Vercel release access or a release annotation |

The public deployment serves the completed Phase 4 route structure, including
the homepage, project collection and detail, products, commercial,
professional, guides and neutral contact route. A visible production match is
not enough to prove the exact deployed commit.

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
5. Swipe through at least three images in the native horizontal gallery strip.
6. Confirm the images retain different aspect-ratio heights, remain aligned to
   the top, and each caption moves with its image.
7. With a keyboard, focus the gallery region and confirm its focus indicator is
   visible.
8. Follow the project enquiry action.
9. Confirm the project name, project slug and Residential audience are visible
   and preserved through refresh.

Pass conditions: the native strip moves without moving the page sideways;
different image heights remain top-aligned; Back is predictable; no priority
crop is unreadable; the project and audience reach the form and eventual
payload.

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
| Intercepted form payload and event shape | Pass on local `main` worktree | Direct and embedded-form tests reconcile `lead_event_id` to `submissionId`, preserve canonical context and exclude personal form values |
| Intercepted deployed direct and professional-form reconciliation | Fail on current production | Read-only production browser tests intercepted both API requests and proved that deployed `lead_event_id` and `submissionId` are different UUIDs; no real enquiry was sent |
| Production analytics debug access | Blocked | Requires access to the production analytics property/debug tooling |
| Successful production test submission | Blocked | Requires explicit authority and approved test contact details |
| Exact event-to-submission reconciliation | Production fail; local fix passed | The local `main` worktree reuses the validated submission UUID as `lead_event_id`; deployment and authorised production reconciliation remain required |

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

Expected result: four passed tests. On 26 July 2026 the local lane passed
four of four; the current deployment fails all four new assertions across the
two UUID-reconciliation and two review-link accessible-name checks.

## Performance evidence

Record both lab and field evidence. Lab results can identify regressions but
cannot prove field improvement.

### Required route set

- `/`
- `/projects`
- `/projects/warkworth-outdoor-room`
- `/pergolas-auckland`
- `/products`
- `/products/pergolas/gable`
- `/commercial-pergolas-auckland`
- `/architects-designers-builders`
- `/pergola-guides`
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
| Current production Chromium route matrix | Pass | 30 records across ten routes and 430/390/360 px: HTTP 200, zero overflow and CLS, no failed responses, broken viewport images, duplicate IDs or primary target failures; FCP, LCP, TTFB, payload and long-task data are recorded per route |
| Current Lighthouse lab run | Pass with runner cleanup warning | Valid reports were written before a Windows temporary-profile cleanup error; mobile scores 0.98/1.00/0.96/1.00 and desktop 1.00/1.00/0.96/1.00 |
| Production field Core Web Vitals | Pass with data limitations | Public PageSpeed/CrUX URL-level homepage data passes on mobile and desktop; INP and TTFB are unavailable, and checked non-home routes fall back to origin-level data because URL-level samples are insufficient |

## Findings and prioritised backlog

| ID | Priority | Evidence | Finding | Resolution / owner | Status |
|---|---:|---|---|---|---|
| P5-01 | P1 | Source audit and deployed intercepted tests | Production direct and professional forms emit different opaque UUIDs for `lead_event_id` and the durable `submissionId`, so an event cannot be joined exactly to its submission | The local `main` worktree uses the already-generated non-personal submission UUID as the lead event identifier; direct and embedded tests pass | Confirmed production failure; fixed locally; deployment/retest required |
| P5-02 | Gate | Environment | Physical iOS/Android, VoiceOver and TalkBack evidence is unavailable in this environment | Product owner supplies dated matrix results using T1-T8 | Blocked |
| P5-03 | Gate | Access | Production analytics debug and successful-submission reconciliation require account access and submission authority | Product owner or authorised operator completes the production run | Blocked |
| P5-04 | P2 | Release metadata | The public response exposes no source commit, so exact release-to-commit identity is not independently verifiable | Record the Vercel deployment commit or release annotation | Blocked |
| P5-05 | P1 | Lighthouse 13.4.1 and deployed browser tests | Homepage and footer review links override their visible labels with a different accessible name, failing the experimental WCAG 2.5.3 label-in-name audit | The local `main` worktree lets the visible rating and review count provide the accessible name; homepage and footer browser tests pass locally and fail as expected against the deployed release | Confirmed production failure; fixed locally; deployment/retest required |
| P5-06 | P3 | Local tooling | Lighthouse writes a valid report, then exits non-zero on Windows while deleting its temporary Chrome profile | Preserve the valid JSON evidence; rerun the canonical LHCI command in CI/Linux before closure | Open tooling follow-up |
| P5-07 | P3 | Local Next development warning | The test's deliberate full-page lazy-image warm causes Next's development observer to report the reused Warkworth image as a late LCP candidate even though the initial product/project hero path is already eager/high-priority | Freeze initial-load paint metrics before the warm and retain lazy offscreen galleries; do not eager-load below-fold images without real initial-viewport evidence | Test-harness observation; no product fix justified |

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
- The dedicated Phase 5 capture then passed all three width tests and wrote 30
  records under `artifacts/mobile-ux-phase-5/automated/`.

Phase 5 route-matrix summary:

| Measure | Result |
|---|---:|
| Routes | 10 |
| Widths | 430, 390 and 360 px |
| Records | 30 |
| HTTP failures | 0 |
| Non-prefetch request failures | 0 |
| Horizontal overflow | 0 |
| Maximum measured CLS | 0 |
| FCP range | 156-896 ms |
| LCP range | 172-896 ms |
| TTFB range | 49-111 ms |
| Recorded long tasks | 0 |
| Broken viewport images | 0 |
| Duplicate IDs | 0 |
| Primary controls below 44 px | 0 |
| Maximum total transferred bytes | 759,497 |
| Maximum image transferred bytes | 344,410 |
| Maximum script transferred bytes | 206,168 |

Aborted Next.js RSC prefetches are recorded separately from failed user
requests because the browser may cancel speculative prefetches without a failed
navigation or visible error. These route timings use an unthrottled headless
Chromium session against a warm production CDN and are comparative lab
evidence, not mobile-network field timings.

### Local quality gates

| Check | Result |
|---|---|
| Marketing Vitest suite | Pass: 49 files, 251 tests |
| Marketing TypeScript | Pass |
| Repository lint and policy guards | Pass |
| Marketing production build | Pass: 65 static pages generated |
| Changed-file architecture sweep | Pass; no warning or critical changed source files, dead-code pressure or boundary findings |
| Changed-behaviour Playwright retest | Pass: five tests covering direct and professional reconciliation, homepage review-link naming, no-JavaScript guide completeness and footer naming |
| Production keyboard/focus Playwright set | Pass: 13 tests covering header/menu focus, disclosures, project filters/modal, product interactions, validation and retry |
| Production direct/professional UUID reconciliation | Expected failures: both deployed event IDs differ from their intercepted submission IDs; both local fixed tests pass |
| Production review-link label-in-name checks | Expected failures: homepage and footer still expose the mismatched deployed accessible names; both local fixed tests pass |

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

The deployed Lighthouse report found P5-05. The local `main` worktree fix is
covered locally but cannot be represented as a production Lighthouse pass
until it is deployed. Lighthouse also recorded 25.6 KB of potentially unused JavaScript,
about 14 ms of named forced reflow plus unattributed work, and no estimated
image-format savings. These are observations, not evidence for a broad rewrite.

Broad redesign, new analytics vendors, personal tracking, speculative route or
form-contract changes and unsupported causal conversion claims remain explicit
non-goals.
