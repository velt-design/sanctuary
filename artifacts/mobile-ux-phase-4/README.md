# Mobile UX Roadmap Phase 4 evidence

Status: complete and production-verified on 26 July 2026.

Authoritative brief: `docs/mobile-ux-roadmap-v2.md`, Phase 4 and PRs 10-13.

## Release identity

- Starting repository and production commit:
  `45230e70` (`docs(marketing): close mobile phase three`).
- Production-verified implementation commit:
  `eda1cc1d` (`test(marketing): verify phase four completion`).
- Branch: `main`; `origin/main...main` was `0 5` immediately before push.
- Marketing deployment:
  [Vercel sanctuary deployment](https://vercel.com/jordans-projects-43df95bd/sanctuary/6sGEdG6Si792frN8ADM2jhiw2mtB)
  reported success.
- Portal companion deployment:
  [Vercel sanctuary-portal deployment](https://vercel.com/jordans-projects-43df95bd/sanctuary-portal/92vc1eAN457FssApBx6FpbtZwGWF)
  reported success; no portal source changed.
- Production origin used by the final smoke and capture:
  `https://www.sanctuarypergolas.co.nz`.
- The documentation closure is the separate
  `docs(marketing): close mobile phase four` commit containing this file.

## Completed checkpoints

| Roadmap checkpoint | Commit | Result |
| --- | --- | --- |
| PR 10, reorder and condense commercial | `19a89302` | Three governed cases follow the hero, delivery uses three stages and three responsive groups own optional operational depth. |
| PR 11, create professional capability | `acc5ac12` | `/architects-designers-builders` is discoverable, shows role/documentation/interface guidance and three governed projects, then submits the existing professional contract. |
| PR 12, simplify guide journeys | `bc07464a` | The hub shows ten distinctions with no repeated controls; seven details lead with one answer, one project and a route back before optional depth. |
| PR 13, refine site utility/homepage | `35c1ea5f` | The footer is compact phone/email utility; the homepage closes in seven regions and integrates review proof into final enquiry. |
| Phase 4 completion contract | `eda1cc1d` | Route-specific guide headings, updated inherited assertions, 36 responsive records and production-compatible evidence. |

## Actual implementation and test files

- Commercial:
  `apps/marketing/app/commercial-pergolas-auckland/content.ts`.
- Professional:
  `apps/marketing/app/architects-designers-builders/content.ts`,
  `page.tsx`, `apps/marketing/components/headerNavigation.ts`,
  `headerNavigation.test.ts`, `apps/marketing/app/sitemap.ts` and homepage
  route links.
- Guides:
  `apps/marketing/app/pergola-guides/page.tsx`,
  `pergola-guides.css`, the seven guide `content.ts` files, and
  `apps/marketing/components/seo-landing/SeoLandingPage.tsx`,
  `SeoLandingMobileDisclosure.tsx`, `seoLandingViewModel.ts`,
  `seoLandingViewModel.test.ts`, `types.ts` and `seo-landing.css`.
- Footer/homepage:
  `apps/marketing/components/SiteFooter.tsx` and
  `apps/marketing/app/home-v2/{Homepage.tsx,content.ts,home-v2.module.css}`.
- Browser and evidence:
  `playwright/marketing.phase-four.spec.ts`,
  `playwright.marketing.config.ts`, and focused updates in contact, foundation,
  guide-hub, homepage, density, project, SEO-programme and shared-header specs.
- Baseline, implementation plan, screenshots and measurements:
  `artifacts/mobile-ux-phase-4/{before,after,implementation-plan.md}`.

No enquiry utility, required-field contract, attachment policy, API/CRM
mapping, project record, product catalogue, gallery primitive or disclosure
primitive was forked.

## Before and after at 390 px

Measurements use production before and production after. `mainHeight` is used
for guide routes because their document shell reports a viewport-locked
document height.

| Surface | Before | After | Outcome |
| --- | ---: | ---: | --- |
| Commercial visible words | 963 | 773 | 19.7% lower with three cases and three delivery stages. |
| Commercial measured main height | 11,369 px | 9,554 px | Proof appears before secondary operational depth. |
| Professional capability route | HTTP 404 / 7 words | HTTP 200 / 802 words | One governed capability journey now precedes professional enquiry. |
| Guide-hub visible words | 452 | 553 | Useful distinctions moved from hidden controls into the visible card layer. |
| Guide-hub repeated controls | 10 | 0 | Every title, prompt, summary and direct destination is visible. |
| Seven guide details, visible-word range | 936-1,315 | 572-616 | One answer/project/return path leads before optional depth. |
| Seven guide details, main-height range | 11,079-14,934 px | 7,280-7,535 px | The mobile decision path is materially shorter. |
| Guide-detail disclosure count | 2-3 | 1 | Complete supporting content remains in one optional depth control. |
| Homepage regions / disclosures | 8 / 7 | 7 / 5 | Planning is two groups and review proof shares the final close. |
| Homepage main height / visible words | 8,636 px / 659 | 8,176 px / 642 | Targeted lower-half consolidation without a new homepage concept. |
| Footer height / minimum height | 844 px / 844 px | 766 px / 0 px | Visible phone/email and reduced navigation replace the viewport minimum. |

Footer after height is 730 px at 430 px and 766 px at both 390 px and
360 px. The direct `/contact` footer action is neutral.

## Responsive and production evidence

`after/route-measurements.json` contains 36 deployed records: homepage,
commercial, the retained professional contact entry, the new professional
route, guide hub and seven guide details at 430x932, 390x844 and 360x800.
Every record returned HTTP 200 with:

- zero horizontal overflow;
- cumulative layout shift `0`;
- footer `min-height: 0`;
- one selected guide project and its return route before optional depth on
  guide details; and
- the same route-owned first-layer structure at all three widths.

Representative screenshots include top states at all three widths and 390 px
full/footer states for homepage, commercial, professional entry/capability,
guide hub, aluminium and cost routes. `before/` and `after/` are directly
comparable production captures.

## Verification

- Marketing units: 45 files and 202 tests passed.
- Route/view-model unit: 14 tests passed, including unique route-owned
  supporting headings and complete authored paragraph/project retention.
- Affected browser files: 126 passed and four intentional capture skips;
  canonical contact then passed 16 with one capture skip after its setup
  correction.
- Phase 4: all seven active behavior tests passed. The seven-route
  no-JavaScript case passed under its standard extended multi-route budget.
- Full deployed matrix: 229 public checks passed and 11 capture-only checks
  skipped. Eighteen failures were all internal foundation-catalogue assertions;
  `/__foundation/marketing` deliberately returns 404 in production and its
  complete browser file passed locally.
- Full workspace `npm run typecheck` passed.
- `npm run lint` passed, including docs, package, cache, brand, mojibake and
  ESLint guards.
- `npm run build:marketing` generated the 65-page production build.
- Base/head `npm run architecture:changed` audited 33 code files. The only
  dead-code finding was an unnecessary private type export; it was removed,
  retested and the focused dead-code report then returned no findings.
- `playwright/marketing.mobile-content-density.spec.ts` remains a warning-size
  established cross-route harness at 1,204 lines, 34 fewer than the Phase 3
  baseline. Phase 4 added its new responsibility to the focused
  `marketing.phase-four.spec.ts` instead of expanding that hotspot.

The first unconstrained local browser invocation overloaded the Next
development server. The authoritative local gates use one worker. Two
development-runtime desktop header-scroll cases passed against the deployed
optimized site, matching the earlier Phase 3 result.

## Enquiry, payload and analytics regression

Production and intercepted checks confirm:

- direct `/contact` remains neutral and unknown values fail safely;
- residential, commercial and professional audiences retain their validated
  context;
- project and product source context, refresh and Back behavior remain;
- product enquiry remains neutral without reliable audience evidence;
- the professional payload contains canonical `enquiry_type`,
  `source_path` and `source_component` plus the optional brief fields;
- consented events use canonical lower-case context; and
- name, phone, email, organisation, message and file values do not enter
  analytics.

All `/api/enquiry` requests were intercepted. No real customer enquiry, upload,
email or CRM write was made.

## Preserved contracts and non-goals

Phase 1 canonical routing, neutral unknown/product behavior, shared
required/optional form rules, upload policy and lower-case non-personal
analytics remain. Phase 2 project collection payload, filters, gallery,
navigation and contextual enquiry behavior remain. Phase 3 service six-region
budgets, product taxonomy, three product disclosure groups, one controlled
gallery and honest evidence states remain.

Phase 4 did not create a professional portal or document-management system,
delete or redirect a guide, rewrite broad SEO content, change service/product
taxonomy, add a commercial claim, redesign the form, alter required fields or
uploads, change CRM behavior, broadly redesign desktop/homepage/brand, or
begin Phase 5.

## Physical-device deferral

Chromium emulation is not physical-device evidence. No physical iOS Safari,
Android Chrome, VoiceOver or TalkBack task was completed in Phase 4. These
remain explicitly unverified and are the core of Phase 5 / PR 14.

## Recommended Phase 5 goal

```text
/goal # Goal: Plan and complete Mobile UX Roadmap Phase 5 - real-device,
accessibility, performance and outcome validation

Use docs/mobile-ux-roadmap-v2.md, Phase 5 and PR 14, as the authoritative
brief. Phases 1-4 are complete and must remain stable. Work directly on main,
do not create a branch or PR, and commit each independently completed
validation or bounded-fix checkpoint.

First inspect main, origin/main, the deployed marketing site, Phase 1-4
evidence and all current testing/analytics/privacy guidance. Produce a dated
validation plan mapping every Phase 5 acceptance criterion to an owner,
device/browser, assistive technology, task, metric, evidence file and pass/fail
rule.

Run the primary residential, commercial, professional, project, product,
guide, contact and footer tasks on physical iOS Safari and Android Chrome.
Repeat the essential journey with VoiceOver and TalkBack and retain the
desktop keyboard lane. Verify Back/forward, refresh, menu focus, disclosures,
galleries, uploads, validation, success context and unobscured controls.
Never describe emulation as physical-device evidence. If a required device or
analytics account is unavailable, prepare the exact runnable task pack, mark
the item unverified and stop before declaring Phase 5 complete.

Review production Core Web Vitals and representative lab traces, image
payload, layout shift and interaction latency. Verify canonical lower-case,
non-personal production events in approved debug tooling and reconcile them
with designated test submissions only when explicit safe test authority and
test identity are available. Do not send an ordinary customer enquiry or add
personal analytics data.

Make only small evidence-backed fixes. Preserve Phase 1 routing/forms,
Phase 2 project behavior, Phase 3 service/product contracts, Phase 4
commercial/professional/guide/footer/homepage structure, canonical URLs,
claims, metadata, schema, no-JavaScript access and established desktop
presentation. Do not redesign the brand, change taxonomy, add an analytics
vendor or infer conversion causality from insufficient data.

After each bounded fix, rerun focused and inherited gates. Finish with the
device/assistive-technology matrix, performance and analytics evidence,
before/after results, unresolved backlog, exact commits/files, production
smoke, explicit limitations and a separate final documentation commit.
```
