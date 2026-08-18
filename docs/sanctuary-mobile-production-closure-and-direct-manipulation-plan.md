# Sanctuary Pergolas Mobile Production Closure and Direct-Manipulation Refinement Plan

> **Status:** Authoritative next-phase implementation brief  
> **Repository:** `velt-design/sanctuary`  
> **Recommended repository path:** `docs/sanctuary-mobile-production-closure-and-direct-manipulation-plan.md`  
> **Original repository snapshot inspected:** `main` at `cec83a4279b05cd6267f937954e0c90a2888b3cf`
> **Refinement reconciliation:** `main` at `99eb62c359c70e875301ef4f24655627d4248683` and production release `cec83a4279b05cd6267f937954e0c90a2888b3cf`, checked 27 July 2026
> **PDR-01 closure:** PR #29 merged and production release `a9011d88e0d7f673dfa214b36211116f3c2826a8` passed the exact-release and three-width route matrices on 27 July 2026
> **PDR-02 implementation:** Contained direct manipulation and focused component/browser contracts implemented 17 August 2026; protected-preview, merge and exact-release production gates remain open
> **Live production inspected:** 27 July 2026  
> **Target mobile widths:** approximately 430 px, 390 px and 360 px, plus short-height and zoomed mobile conditions  
> **Programme model:** three required pull requests
> **Primary outcome:** one verified production release, one directly manipulated product-gallery interaction, and one authorised production enquiry reconciliation
> **Owner amendment:** physical-device and assistive-technology testing were removed from this programme on 27 July 2026; they are not merge or completion gates

> **Homepage-owner supersession (2 August 2026):** references below to
> `apps/marketing/app/_home/**` and `playwright/marketing.homepage.spec.ts`
> describe the completed PDR-01 snapshot. The current production owner is
> `apps/marketing/app/_home-project-finder/**`, verified by
> `playwright/marketing.home-project-finder.spec.ts`.

## Document purpose and authority

This document converts the completed Sanctuary Pergolas mobile UX and implementation maturity review into the next bounded implementation programme.

It is authoritative for the work described here:

1. production release and semantic parity;
2. controlled product-gallery direct manipulation;
3. one authorised production enquiry and analytics reconciliation.

It is additive to the following current repository authorities:

- `docs/mobile-ux-roadmap-v2.md`
- `docs/mobile-ux-phase-5-validation.md`
- `docs/marketing-ui-foundation.md`
- `docs/decision-log.md`
- `docs/security-privacy-quality.md`
- `docs/testing-and-qa.md`
- the current implementation and tests under `apps/marketing/`, `test/` and `playwright/`

`docs/mobile-ux-roadmap-v2.md` remains the broad mobile roadmap.  
`docs/mobile-ux-phase-5-validation.md` remains the existing evidence record until this programme updates or closes its outstanding gates.  
`docs/marketing-ui-foundation.md` remains the durable owner of Foundation UI, responsive semantics, shared motion values and protected interaction architecture.

The previously referenced file `docs/sanctuary-mobile-touch-motion-implementation-plan.md` is not present on current `main`. It was removed after the shared tactile-motion work was implemented and absorbed into durable Foundation contracts. This plan does not restore that removed document. It carries forward only the still-relevant controlled product-gallery outcome.

Production is the source of truth for what customers receive. Current `main` is the source of truth for the intended implementation. Neither is sufficient alone:

- repository presence does not prove deployment;
- a visually plausible production page does not prove its source revision;
- an accepted API response does not by itself prove the received enquiry, stored attachment and analytics event reconcile.

A pull request that needs to change the programme sequence, protected architecture, evidence gates or conditional remediation boundaries must amend this document first or include a narrowly reasoned amendment in the same pull request.

## Start here

PDR-01 is complete. PDR-02 implementation is complete in its bounded repository slice, but the phase is not closed until protected-preview, merge and exact-release gates pass. Physical-device testing is not required.

### Confirmed starting state

- PDR-01 is merged and deployed. Its exact-release, route-semantic and three-width production matrices passed.
- Custom, commercial and professional routes expose the approved structure and enquiry context without guide framing.
- `ResponsiveGallery` now defers capture until horizontal intent wins, follows the pointer through one rAF-batched transform, retains the 48 px commit threshold and activates no more than previous/current/next visual frames near the viewport or on first operation.
- The retired metadata-only attachment expectation was removed from `playwright/marketing.contact.spec.ts` and `docs/testing-and-qa.md` during PDR-01. Current attachment code and tests require stored uploads or a visible failure.

### Phase readiness

| Phase | State now | Start condition |
|---|---|---|
| PDR-01 | Complete | PR #29 merged; preview `947c701d514fc4c9c84ca3980d9dd4fdeeb754df` and production `a9011d88e0d7f673dfa214b36211116f3c2826a8` passed |
| PDR-02 | Implemented; release gates open | Focused component, motion and three-width product browser contracts pass locally; protected preview, merge and exact-release production evidence remain |
| PDR-04 test repair | Complete | Retired metadata-only fallback assertions and QA wording were aligned during PDR-01 |
| PDR-04 live reconciliation | Blocked | Named approval, operator, analytics debug, received-record access and Storage readiness |

PDR-01 required no manual cache purge or production form write. Merging `main`
triggered the production deployment, and all 24 normal/cache-busted primary
route responses identified the exact merge release. The production browser
matrix passed 36 of 36 route/viewport cases at 430, 390 and 360 px. Evidence is
stored under `artifacts/mobile-production-closure/pdr-01/`.

### Access and ownership record

Complete this table before the relevant gate. Unassigned fields are blockers only for the named gate, not permission to proceed.

| Capability | Required by | Named owner or operator | Current status |
|---|---|---|---|
| Protected preview and production deployment/cache access | PDR-01 completion | Jordan, Vercel account `jordanbvelt-2954` | Confirmed for `jordans-projects-43df95bd/sanctuary`; `main` auto-deploys and preview/production deployment is authorised after checks |
| Production enquiry approval and operator | PDR-04 live run | Unassigned | Not authorised |
| GTM/GA debug access | PDR-04 live run | Unassigned | Not confirmed |
| Accepted enquiry and notification/workbench inspection | PDR-04 live run | Unassigned | Not confirmed |
| Production private Storage inspection | PDR-04 live run | Unassigned | Not confirmed |

## Evidence classifications

Every important finding, acceptance result and completion claim must use one of the following classifications.

### Verified production

Observed on the public production origin and tied, where required, to an exact `X-Sanctuary-Release` value.

A production result is not considered release-verified when the source revision is unknown, inconsistent across routes or different between normal and cache-busted responses.

### Verified repository

Confirmed in current `main`, its source, tests, generated output or repository evidence.

This does not imply that the behaviour is deployed.

### Inferred

A likely customer effect or technical risk derived from implementation and supporting evidence, without direct production proof.

An inferred issue must not be treated as a confirmed defect.

### Operational validation required

Requires production access or authority beyond read-only browser inspection, including:

- an authorised synthetic production enquiry;
- production analytics debug access;
- inspection of the accepted enquiry record;
- inspection of the received notification or workbench record;
- confirmation of private Storage readiness and stored attachment paths; or
- a deliberate production deployment or cache operation.

A blocked operational result is not a pass or a fail. The owner, missing access and next action must be recorded.

## Current-state reconciliation

### PDR-01 starting snapshot

The next stage is narrower than the earlier review suggested.

The approved homepage has now reached the public root and the shared tactile-motion system is implemented in current `main`. The principal production-closure problem has moved to route parity: the public custom and commercial service pages still expose guide-series framing and older long-form structures even though current route configs disable that framing and define the approved consolidated service compositions.

The direct-manipulation work remains genuinely open. `ResponsiveGallery` still renders one active item and makes a swipe decision only at pointer-up. It does not move the image with deliberate horizontal finger movement. Product details continue to use this shared owner, so the improvement can remain focused.

Authorised production outcome validation remains open. The existing Phase 5 evidence is useful as a regression baseline, but it was recorded against an earlier release and cannot close the current programme.

### Reconciliation table

| Area | Completed review finding | Current repository state | Current production state | Evidence classification | Planning consequence |
|---|---|---|---|---|---|
| Homepage owner | The review found a production-to-repository mismatch | `apps/marketing/app/page.tsx` exports `apps/marketing/app/_home/Homepage.tsx`; the current owner has `data-homepage-variant="design_conversation_home_v2"` and H1 `Begin with built work.` | The public root now exposes the same bounded first design conversation and H1 | Verified repository and verified production | The old homepage mismatch is resolved. Phase 1 verifies the exact release and markers; it does not redesign the homepage |
| Homepage content revision | The review treated the public root as an older implementation | Current `main` retains the approved homepage and has no marketing implementation diff from the sampled production revision | The public structure is current and sampled responses identify release `cec83a4`; the full primary-route matrix is still pending | Verified repository and partial verified production | Require one exact release SHA across the complete route matrix rather than relying on matching structure |
| Custom service | Current `main` was stronger than production | `showGuideNavigation: false`; three governed projects; three process stages; one `custom-planning-support` disclosure | Public output still includes `Service guide 02 of 10`, four projects, four process stages, long supporting content and an older required-field presentation | Verified repository and verified production mismatch | PDR-01 must close deployment and semantic parity before any new service-page design work |
| Commercial service | Current `main` was stronger than production | `showGuideNavigation: false`; commercial audience; three projects immediately after the hero; three stages; three responsive support groups | Public output still includes `Service guide 04 of 10` | Verified repository and verified production mismatch | Treat primarily as release, deployment or cache parity; do not rewrite the working route config first |
| Professional service | A discoverable professional route existed in current code | `showGuideNavigation: false`; professional audience; three project models; two support disclosures; professional embedded form | Public route is HTTP 200, exposes the approved capability journey and embedded professional context, contains no guide sequence and identifies release `cec83a4` | Verified repository and sampled verified production | Retain the route in exact release, semantic, form-context, sitemap and browser checks |
| Professional header enquiry | Intended route-aware professional context | The professional page config owns `enquiryType: 'professional'`, but `getEnquiryRouteContext()` does not enumerate `/architects-designers-builders`; the shared header derives its context from that helper | Public header link preserves source path and component but omits `enquiry_type=professional` | Verified repository and verified production inconsistency | PDR-01 must add the focused assertion and correct the shared route helper |
| Release identity | Earlier evidence recorded a release header | `releaseIdentity.ts` and `next.config.ts` emit `X-Sanctuary-Release`; `marketing.phase-five.spec.ts` already checks one value across normal and cache-busted responses | Sampled normal and cache-busted homepage, custom, commercial and professional responses all identify `cec83a4`; the complete route matrix has not yet run | Verified repository and partial verified production | PDR-01 remains a full release gate, not a visual QA pass |
| Retired homepages | Duplicate homepage implementations were a risk | `/home-v2` and `/home-experimental` permanently redirect to `/`; the canonical owner is `_home/Homepage.tsx` | Public root is the promoted homepage | Verified repository and verified production | Preserve redirects, sitemap exclusion and one homepage owner |
| Shared tactile motion | Touch feedback was previously inconsistent | Shared tokens and TM-01/TM-02 consumer adoption are present; motion contract and touch-motion browser tests exist | Exact current-release deployment is proven by PDR-01 | Verified repository and production | Do not reimplement pressed states |
| Native project gallery | Earlier versions lacked a visible non-swipe path | Current project gallery remains a native variable-height horizontal strip with Previous/Next controls, live position, keyboard support and reduced-motion handling | Representative public project route is available | Verified repository and production | Preserve architecture and do not include it in PDR-02 |
| Controlled product gallery | Direct manipulation implemented in the bounded owner | `ResponsiveGallery` uses pending intent, deferred capture, rAF-batched finger follow, a 48 px commit threshold and bounded adjacent visual readiness; product details opt in with `swipe` | Production remains on the last verified release until this slice is merged and deployed | Verified repository; production verification required | Preserve the native project gallery and complete protected-preview/exact-release gates |
| Product-gallery tests | Component and browser gesture contracts added | Component tests cover arbitration, capture, finger follow, commit/cancel cleanup, reduced motion and active-only adjacent frames; product browser tests exercise deliberate horizontal, vertical and short gestures at 430, 390 and 360 px | Protected-preview request timing and exact-release performance evidence remain open | Verified repository; deployment evidence required | Run the protected-preview and production evidence gates before closing PDR-02 |
| Header and menu | Strong automated contract | Portalled menu, inert closed state, focus cycle, Escape return, body-fixed scroll lock, popstate close and breakpoint cleanup exist | Current automated contracts are green | Verified repository | Preserve owner; no speculative lock refactor |
| Project navigator | Separate modal sheet contract | Detail sheet uses root/body classes, focus containment, Escape and focus restoration; its lock model differs from the header | Current automated contracts are green | Verified repository | Preserve its separate owner |
| Scroll reset and history | Browser Back/Forward was a remaining risk | `ScrollReset` prefers valid fragments, otherwise resets route scroll immediately and on the next frame | Current automated contracts are green | Verified repository | Do not include speculative history work |
| Project filter state | Query-state continuity was implemented | Collection filters write validated query params with `router.push(..., { scroll: false })`; canonical project links exclude filter params | Current automated contracts are green | Verified repository | Preserve current behaviour |
| Form contract | Required effort was reduced | Shared contract requires project type, name, phone and email; suburb, brief and technical detail are optional | Public custom output still presents an older required-field contract | Verified repository and verified production mismatch | PDR-01 must verify direct and embedded required/optional semantics against the exact release |
| Enquiry context | Canonical non-personal source context exists | Route, component, project and product values are validated and lower-case; products remain neutral unless an audience is explicitly known | Current public service parity is incomplete | Verified repository; production verification required | PDR-01 verifies all entry paths; PDR-04 reconciles the accepted production result |
| Submission reconciliation | Automated ID contract existed, authorised reconciliation was blocked | `lead_event_id` is expected to reuse the accepted `submissionId`; contact browser tests assert one event and duplicate-submit exclusion | No authorised current-release event-to-record proof | Verified repository; operational validation required | PDR-04 is mandatory |
| Google analytics loading | Earlier docs referenced a coded GA loader | GTM is now the only Google browser runtime loader; `/runtime-ga.js` has been retired; consent mode is set before GTM loads | Production debug behaviour requires access | Verified repository; operational validation required | PDR-04 must use GTM/GA debug evidence and must not restore or test the retired coded loader |
| Attachment integrity | Earlier tests allowed metadata-only fallback | Current attachment code requires signed private-Storage upload or a visible failure; current head includes a production-readiness guard | `playwright/marketing.contact.spec.ts` and `docs/testing-and-qa.md` still describe and expect the retired metadata-only fallback | Verified repository inconsistency | Repair stale tests and docs before treating production attachment validation as trustworthy |
| Performance | Strong earlier Chromium and homepage field baseline | Existing route matrix and Lighthouse artifacts remain available; current main includes later homepage, motion, analytics, claim and attachment changes | Current-release route matrix and current field outcome are not established | Verified repository historical baseline; current production verification required | Re-run after PDR-01 and compare again after PDR-02 |

### Findings that are resolved or superseded

The following findings from earlier reviews must not be reopened as active implementation work unless new evidence contradicts the current state:

1. **The public root uses the wrong homepage.**  
   Resolved at the structural level. The current public root presents `Begin with built work.` and the bounded first design conversation.

2. **The mobile project gallery has no visible controls or position feedback.**  
   Superseded. Current `ProjectGallery` provides Previous/Next, `Image n of total`, edge state and keyboard navigation while preserving the native strip.

3. **Shared pressed-state and motion vocabulary still needs to be designed.**  
   Superseded. The canonical tokens and route adoption are implemented and protected by automated contracts.

4. **Selected enquiry attachments may fall back to metadata-only submission.**  
   Retired by current code. A requested file must store successfully or fail visibly. The remaining work is to align stale tests/docs and prove the production bucket.

5. **The historical Phase 5 release record closes current production.**  
   Superseded as a completion claim. It remains a useful baseline, but it references an earlier release than current `main`.

6. **The removed touch-motion implementation plan remains an active repository authority.**  
   Superseded. Durable rules now live in Foundation, tests and the decision log. This document becomes the active owner for the remaining programme.

## Executive implementation summary

### Why this is consolidation and optimisation, not redesign

The mobile architecture is already coherent:

- there is one responsive website and one semantic content source;
- project-led evidence is the primary credibility mechanism;
- the homepage has one bounded project-starting question;
- service and product pages use purposeful first layers and native disclosures;
- direct and embedded forms share validation and context contracts;
- native vertical scrolling remains authoritative;
- the project-detail gallery preserves native momentum and mixed architectural image proportions;
- shared navigation, focus, pressed states and reduced motion have defined owners;
- the repository has broad responsive and production-supporting automated coverage.

The remaining work is to improve one controlled interaction and reconcile one authorised production outcome.

A separate mobile site, another broad redesign, a new animation framework or a global history abstraction would expand risk without addressing the verified gates.

### Expected customer outcome

After completion:

- every primary route identifies the same intended production revision;
- customers receive the approved homepage and consolidated service structures;
- high-intent service pages do not present themselves as numbered guide articles;
- professional, commercial, residential, project and product enquiry context is preserved correctly;
- product images move with deliberate horizontal touch before release;
- vertical page scrolling remains reliable through product galleries;
- project galleries retain native movement and accessible non-swipe controls;
- one authorised production enquiry reconciles to one accepted record, one non-personal success event and, when included, one verified stored attachment;
- current performance evidence is attached to the exact deployed release.

### Programme shape

- **Required phases:** 3
- **Required pull requests:** 3
- **Expected required PRs:** PDR-01, PDR-02 and PDR-04

### Highest implementation risk

Controlled product-gallery direct manipulation is the highest implementation risk. Gesture arbitration, pointer capture, adjacent image readiness, accessibility-tree ownership and bounded image loading must work together without intercepting vertical scroll or adding a carousel framework.

### Highest validation risk

The highest validation risk is production-system reconciliation:

- private attachment Storage readiness;
- consent-aware GTM/GA debug evidence; and
- one authorised accepted enquiry without duplicate events.

## Governing principles and non-negotiable constraints

1. **Production is not complete without exact release identity.**  
   Every normal and cache-busted primary-route response must expose the same approved SHA through `X-Sanctuary-Release`.

2. **Fix deployment before rewriting correct source.**  
   When current route config and tests are correct but production is stale, investigate build, deployment, route output and cache ownership before changing page components.

3. **One responsive website remains mandatory.**  
   Do not create a separate mobile route tree, duplicate mobile content or device-specific CMS source.

4. **One semantic content tree remains mandatory.**  
   Responsive presentation may change, but content, headings, forms, disclosure bodies and project records must not fork by viewport.

5. **Native vertical scrolling is authoritative.**  
   Do not replace browser momentum, add global smooth scrolling or intercept ordinary document scroll.

6. **The native project-detail gallery is protected.**  
   Do not move it into `ResponsiveGallery`, a single-frame carousel or a third-party library. Its mixed 4:3 and 3:4 frames, top alignment, native swipe and captions remain.

7. **`ResponsiveGallery` remains the controlled product-gallery owner.**  
   Add the minimum internal behaviour required for direct manipulation. Do not introduce a generic carousel architecture or a second product-gallery owner.

8. **Resolve gesture intent before taking ownership.**  
   Pointer-down may record an origin. Pointer capture and direct manipulation begin only after horizontal intent is clear. A vertical winner is released to native page scrolling.

9. **Use transform, opacity, colour and border before layout animation.**  
   Do not animate height, width, grid tracks, margins or content-driven page geometry.

10. **No spring, bounce, elastic overshoot or exaggerated scale.**  
    Movement stays calm, precise and architectural.

11. **Bound adjacent media.**  
    Before gallery proximity or first interaction, preserve the current one-active-image request contract. After activation, mount no more than previous, current and next visual frames.

12. **Keep one active accessible slide.**  
    Adjacent visual frames are `aria-hidden`, have empty alternative text and contain no focusable content. Buttons, keyboard support and one polite status remain.

13. **Reduced motion removes autonomous travel, not control.**  
    Direct finger-follow may remain while the finger is down. Release resolves immediately without animated settling.

14. **Semantic states outrank transient feedback.**  
    Focus-visible, current, selected, checked, disabled, sending, error and success states must remain stronger than pressed or drag states.

15. **Do not refactor history or locks speculatively.**  
    `ScrollReset`, Header and ProjectNavigator remain outside this programme unless separately authorised from a reproduced defect.

16. **Do not optimise project-gallery geometry speculatively.**  
    The rAF geometry-reading path remains outside this programme unless separately authorised from a reproduced defect.

17. **One pull request has one user outcome.**  
    Release parity, direct manipulation and operational reconciliation remain independently reviewable.

18. **Keep tests aligned with current behaviour.**  
    A stale browser test or QA document is a product risk. Retired metadata-only attachment expectations must be removed before production sign-off.

19. **No personal information enters analytics evidence.**  
    Evidence may record route, audience, component, governed slugs, release SHA and opaque submission identifiers. It must not record names, phones, emails, messages, dimensions, filenames or attachment contents.

20. **Production writes require explicit authority.**  
    Read-only and intercepted tests may run freely. A real enquiry, attachment or analytics-debug reconciliation requires named approval and an agreed synthetic test record.

21. **Preserve current URLs, metadata and indexation.**  
    Do not change canonical project, product, service or guide URLs. Retired homepage routes continue to redirect permanently to `/`.

22. **No desktop regression.**  
    Shared changes receive representative desktop tests. Mobile-specific gesture behaviour is contained through input capability and current responsive contracts.

23. **No unrelated cleanup.**  
    This programme does not absorb SEO rewrites, general copy changes, portal work, calculator work, dependency upgrades or broad CSS cleanup.

24. **Evidence must identify its source and limits.**  
    Every artifact records date, branch or release, origin, browser, viewport, consent state and whether the result is automated, read-only or write-authorised.
## Phase roadmap

### Phase 1: Production release and semantic parity

#### Objective

Establish one known customer-facing marketing release and prove that every primary route serves its approved role, composition, enquiry context, metadata and accessibility markers from that release.

#### Customer outcome

A customer receives the same intended Sanctuary experience whether they enter through the homepage, a service page, a project, a product, a guide or direct contact, and whether the response is warm, cold, normal or cache-busted.

#### Justification

Current `main` contains the approved homepage and consolidated service configurations. The public root now presents the approved homepage structure, but public custom and commercial responses still expose guide progression and older long-form structures. This is direct evidence that visually checking one route is not an adequate deployment gate.

The existing release-identity implementation and Phase 5 semantic test provide the correct foundation. The phase should extend and run those contracts against the exact current release rather than redesigning already-correct source.

#### Exact scope

1. Record the approved `main` SHA at implementation start.
2. Build the marketing application from a clean worktree and record the generated page count.
3. Verify `X-Sanctuary-Release` against the protected preview head.
4. Deploy only after preview identity and semantic checks pass.
5. Verify the exact approved SHA across every normal and cache-busted primary route.
6. Verify the homepage owner:
   - one canonical `/`;
   - H1 `Begin with built work.`;
   - `data-homepage-variant="design_conversation_home_v2"`;
   - one first-question radiogroup;
   - three closed starting points;
   - two governed project references per selected path;
   - no duplicate production homepage implementation.
7. Verify retired homepage routes:
   - `/home-v2` returns a permanent redirect to `/`;
   - `/home-experimental` returns a permanent redirect to `/`;
   - neither appears in the sitemap;
   - neither has a separate canonical implementation.
8. Verify residential service role:
   - approved service marker;
   - three project cases;
   - three process stages;
   - one support gateway;
   - residential enquiry context;
   - shared required/optional form contract.
9. Verify custom service role:
   - `showGuideNavigation: false` in source;
   - no `Pergola guide progression`, `Service guide`, `Previous guide` or `Next guide` landmark/text in generated or deployed output;
   - three governed project cases;
   - three process stages;
   - one `custom-planning-support` disclosure;
   - residential/custom source path and custom CTA context;
   - project type, name, phone and email required by the shared intake contract.
10. Verify commercial service role:
    - no guide progression;
    - three commercial projects precede the three-stage process;
    - three supporting disclosure groups follow;
    - commercial header, hero and embedded form context;
    - only the shared required fields are required.
11. Verify professional service role:
    - route is HTTP 200, canonical and in the sitemap;
    - no guide progression;
    - professional capability, three governed project models and role boundaries appear before enquiry;
    - professional embedded form context;
    - shared header `Get an estimate` retains `enquiry_type=professional`, canonical source path and `source_component=header`.
12. Add the professional route to `getEnquiryRouteContext()` if the focused header assertion confirms the current neutral result.
13. Verify project surfaces:
    - project collection marker and canonical project links;
    - native project gallery shell;
    - `responsive-strip` layout;
    - contextual Previous/Next names;
    - polite live position;
    - project audience and slug reach contact.
14. Verify product surfaces:
    - products index and product-detail markers;
    - one primary controlled gallery;
    - product slug reaches contact;
    - no audience is invented for a product-only entry.
15. Verify guide surfaces:
    - guide hub remains indexable;
    - representative guide detail exposes its answer, governed project and return action before optional supporting depth;
    - service routes do not inherit guide progression.
16. Verify direct contact:
    - direct `/contact` remains neutral;
    - query preselection is server rendered;
    - malformed context is ignored;
    - shared required/optional labels are present.
17. Verify shared footer:
    - compact utility owner is present on all primary routes;
    - direct phone and email remain;
    - no old full navigation/footer generation is served on stale service pages.
18. Verify sitemap, canonical, robots and structured-data continuity.
19. Record response diagnostics for every route:
    - requested URL;
    - cache-busted or normal;
    - HTTP status;
    - `X-Sanctuary-Release`;
    - cache headers available to the operator;
    - canonical URL;
    - semantic pass/fail.
20. When a route serves the wrong release or semantics:
    - first compare protected preview and production;
    - then inspect deployment target, build source and route output;
    - then inspect edge/cache behaviour;
    - purge or redeploy only through the approved hosting workflow;
    - change source only when the source itself fails the local or preview contract.
21. Update the Phase 5 evidence record with the exact new production release.
22. Update the docs index to link this plan when it is committed.

#### Affected owners

Primary:

- `apps/marketing/app/page.tsx`
- `apps/marketing/app/_home-project-finder/**`
- `apps/marketing/app/pergolas-auckland/**`
- `apps/marketing/app/custom-pergolas-auckland/content.ts`
- `apps/marketing/app/commercial-pergolas-auckland/content.ts`
- `apps/marketing/app/architects-designers-builders/content.ts`
- `apps/marketing/components/seo-landing/**`
- `apps/marketing/components/Header.tsx`
- `apps/marketing/components/headerNavigation.ts`
- `apps/marketing/lib/enquiryContext.ts`
- `apps/marketing/lib/releaseIdentity.ts`
- `apps/marketing/next.config.ts`
- `apps/marketing/app/sitemap.ts`
- `playwright/marketing.phase-five.spec.ts`

Focused supporting owners:

- `playwright/marketing.home-project-finder.spec.ts`
- `playwright/marketing.phase-three.spec.ts`
- `playwright/marketing.phase-four.spec.ts`
- `playwright/marketing.contact.spec.ts`
- `playwright/marketing.projects.spec.ts`
- `playwright/marketing.products.spec.ts`
- `playwright/marketing.mobile-content-density.spec.ts`
- `playwright/marketing.shared-header.spec.ts`
- `docs/mobile-ux-phase-5-validation.md`
- `docs/testing-and-qa.md`
- `docs/README.md`

Deployment configuration or hosting settings are in scope only where evidence identifies them as the actual parity owner.

#### Dependencies

- Current `main` builds successfully.
- Protected preview access is available.
- Production deployment authority is available.
- The expected release SHA can be supplied through `MARKETING_EXPECTED_RELEASE_SHA`.
- Form tests intercept writes unless a later phase explicitly authorises production submission.

#### Non-goals

- no homepage redesign;
- no service-page copy rewrite;
- no new guide taxonomy;
- no product-gallery gesture change;
- no history or scroll-lock refactor;
- no new form fields;
- no analytics vendor change;
- no portal or calculator work;
- no broad cache-policy rewrite without route evidence.

#### Acceptance criteria

- All twelve primary routes return HTTP 200, except the two retired homepage routes which return the intended permanent redirect.
- All normal and cache-busted primary-route responses expose one identical hexadecimal `X-Sanctuary-Release`.
- The release equals the approved deployed commit, not merely any valid SHA.
- The public root contains the approved homepage variant and H1.
- The custom, commercial and professional routes contain no guide-progression marker or visible sequence framing.
- Residential and custom expose exactly three governed project cases and three process stages.
- Commercial exposes exactly three governed cases before exactly three process stages.
- Professional exposes the intended capability route and professional form context.
- The professional header action carries professional audience context.
- Direct contact remains neutral.
- Product entry remains audience-neutral while retaining product context.
- Project entry retains governed audience and project context.
- Direct and embedded forms expose project type, name, phone and email as required.
- Current footer utility appears across the route matrix.
- Canonicals, robots, sitemap entries and structured-data types remain correct.
- No route has more than one `main` or visible H1.
- No primary route introduces horizontal overflow, a broken viewport image, duplicate IDs or a primary target below 44 px.
- The evidence record contains the exact deployed SHA and capture date.

#### Automated tests

Required focused tests:

```bash
npx vitest run \
  apps/marketing/lib/releaseIdentity.test.ts \
  apps/marketing/lib/enquiryContext.test.ts \
  apps/marketing/components/Header.test.tsx \
  apps/marketing/components/headerNavigation.test.ts

npx playwright test \
  playwright/marketing.phase-five.spec.ts \
  --config=playwright.marketing.config.ts \
  --workers=1

npx playwright test \
  playwright/marketing.home-project-finder.spec.ts \
  playwright/marketing.phase-three.spec.ts \
  playwright/marketing.phase-four.spec.ts \
  playwright/marketing.contact.spec.ts \
  playwright/marketing.shared-header.spec.ts \
  --config=playwright.marketing.config.ts \
  --workers=1
```

Required quality gates:

```bash
npm run test:marketing
npx tsc -p apps/marketing/tsconfig.json --noEmit --incremental false
npm run lint
npm run build:marketing
```

Required production parity invocation:

```bash
MARKETING_BASE_URL=https://www.sanctuarypergolas.co.nz \
MARKETING_EXPECTED_RELEASE_SHA=<approved-full-sha> \
npx playwright test \
  playwright/marketing.phase-five.spec.ts \
  --config=playwright.marketing.config.ts \
  --workers=1 \
  --grep "release identity and semantic route state"
```

Use the platform-appropriate environment syntax when running on Windows.

#### Manual browser smoke

Production smoke must confirm on at least one phone-sized browser viewport:

- homepage H1 and first question;
- custom page with no guide sequence;
- commercial page with no guide sequence;
- professional route and header enquiry context;
- project gallery controls;
- direct contact required/optional labels.

#### Accessibility validation

- one `main` and one H1 per route;
- logical heading order on changed routes;
- link and control names remain stable;
- direct and embedded required labels agree with the shared contract;
- no guide-navigation landmark remains on service routes;
- no accessible-name regression in review links or project-gallery controls;
- focus-visible and reduced-motion browser lanes remain green.

#### Performance validation

- run the existing 12-route by three-width Phase 5 matrix against the approved preview and production release;
- compare total, image and script transfer against the most recent valid baseline;
- record FCP, LCP, TTFB, CLS and long tasks as supporting lab evidence;
- do not classify a warm, unthrottled Chromium result as mobile field performance;
- investigate any material route delta before moving to PDR-02.

A material unexplained regression is:

- new CLS above 0.1;
- any new failed user request or response;
- any new broken viewport image;
- any primary target below 44 px;
- any new long task over 50 ms attributable to changed code;
- initial script or image transfer increase above normal run variance without a documented reason.

#### Production verification

Production closure requires:

- one intended full SHA;
- one SHA across all route responses;
- normal/cache-busted parity;
- semantic parity;
- production screenshots for homepage, custom, commercial, professional and contact at 430, 390 and 360 px;
- a route-measurement JSON tied to the same release;
- a short record of any deployment or cache action required;
- confirmation that no real enquiry was sent during PDR-01.

#### Effort

Medium.

#### Risk

Medium. Source changes should be small, but deployment, stale route output or cache ownership may be operationally complex.

#### Rollback strategy

- If a source change causes a regression, revert that source commit and redeploy the last known release.
- If the issue is deployment or cache configuration, restore the prior configuration without reverting correct page code.
- Keep release identity active during rollback so every route can be checked against the restored SHA.
- Do not leave a partial state where some routes expose the new release and others expose the old one.

#### Completion gate

Phase 1 is complete only when PDR-01 is merged, deployed and the exact-release semantic matrix passes against production.

PDR-02 may be developed on a branch while PDR-01 is under review, but it must not be merged or used as the production comparison baseline until PDR-01 has established one known release.

### Phase 2: Controlled product-gallery direct manipulation

#### Objective

Make the shared controlled product gallery follow deliberate horizontal finger movement before release while preserving native vertical scrolling, current accessible controls, one active semantic item and bounded adjacent image loading.

#### Customer outcome

A customer inspecting a pergola form or integrated option feels the image respond to a deliberate horizontal drag, can reverse or cancel naturally, and can still scroll vertically through the page without the gallery stealing the gesture.

#### Justification

Current `ResponsiveGallery` is a good semantic owner but has a finger-to-content gap:

- it records pointer origin;
- it captures the pointer immediately;
- it waits until pointer-up;
- it changes the active item only when horizontal distance reaches 48 px and exceeds vertical distance;
- it renders one active image.

The existing controls, keyboard operation, live status, focus retention, ratios and product ownership should remain. The change is internal to the shared controlled gallery and its product consumer.

#### Interaction contract

##### Gesture states

Use a small internal state machine:

1. `idle`
2. `pending-intent`
3. `dragging-horizontal`
4. `settling`

The state name may be implemented as refs, a reducer or an equivalent contained model. Do not create a site-wide gesture framework.

##### Pointer-down

On qualifying touch or primary-pen pointer-down:

- record pointer ID;
- record start X and Y;
- record current X;
- record viewport width;
- record current active index;
- set state to `pending-intent`;
- do not change active index;
- do not capture the pointer yet;
- do not mount the entire gallery;
- do not call `preventDefault()` speculatively.

Mouse drag is not required. Buttons and keyboard remain the fine-pointer path.

##### Intent threshold

Begin with an approximately 8 CSS px intent threshold.

While pending:

- if vertical distance reaches the threshold first, or clearly dominates horizontal movement, cancel gallery ownership and return to `idle`;
- if horizontal distance reaches the threshold and clearly dominates vertical movement, set state to `dragging-horizontal`, capture that pointer and begin direct manipulation;
- once vertical intent wins, the gallery must not later reclaim the same gesture;
- once horizontal intent wins, vertical page movement must not occur for that captured gesture.

Use an initial horizontal-dominance ratio of approximately `1.2`. The exact ratio may be tuned within the PR only from focused gesture tests across 360 to 430 px. Record the chosen value and why. Do not add velocity-based arbitration in this first implementation.

##### Finger-follow movement

During `dragging-horizontal`:

- write the latest horizontal delta to a ref;
- schedule no more than one animation-frame callback;
- update a CSS custom property or direct transform in that callback;
- do not call React state setters on every pointer move;
- clamp or damp movement at the logical boundary;
- use no elastic overshoot;
- let direction changes update the same transform without switching the active item prematurely.

The visual rail may contain previous, current and next frames. It must not contain an unbounded cloned strip.

##### Commit and cancellation

Retain the existing 48 px minimum commit threshold as the initial contract.

On pointer-up:

- commit one adjacent item when the horizontal delta reaches the threshold;
- otherwise return to the current item;
- use direction, not velocity, as the commit owner;
- update active state once;
- update the live position once;
- release pointer capture;
- clear transient refs;
- settle using `--motion-duration-short` and `--motion-ease-enter` or the closest existing governed values.

    A width-relative threshold may be introduced only if focused automated comparison shows that the fixed 48 px threshold is materially inconsistent between the target widths. Do not add it speculatively.

On any of the following, return safely to the current item with no stale transform:

- `pointercancel`;
- lost pointer capture;
- visibility change;
- viewport resize;
- item-list change;
- component unmount;
- a second pointer;
- unsupported pointer type.

##### Adjacent image readiness

Before the gallery is near the viewport:

- preserve one mounted active visual frame;
- preserve one initial requested gallery image;
- do not request all product-gallery images.

Activate adjacent readiness when either:

- an `IntersectionObserver` reports the gallery within a bounded preload margin; or
- the visitor first operates the gallery.

After activation:

- mount no more than previous, current and next visual frames;
- preserve governed ratio and focal position;
- avoid a layout shift when frames mount;
- keep current content visible while an adjacent frame decodes;
- avoid committing to an unexplained blank frame on a cold connection.

The initial root margin should remain modest and documented. It must not cause all below-fold product galleries to preload during initial page load.

##### Accessibility ownership

The controlled gallery retains:

- labelled region;
- `aria-roledescription="carousel"`;
- contextual Previous and Next names;
- Arrow Left, Arrow Right, Home and End;
- focus retention;
- one polite `Image n of total` status;
- one active image and caption in the accessibility tree.

Adjacent visual frames:

- use `aria-hidden="true"`;
- use empty `alt`;
- contain no links, buttons or focusable content;
- do not duplicate caption or detail announcements;
- must not cause the live status to announce during drag.

The status changes only after a committed active-index change.

##### Reduced motion

With `prefers-reduced-motion: reduce`:

- direct finger-follow remains while the finger is down;
- autonomous post-release travel is removed;
- committed index changes resolve immediately;
- cancelled gestures return immediately;
- pressed and selected feedback remains visible;
- no duplicate status announcement is introduced.

#### Exact scope

1. Refactor `ResponsiveGallery` into a contained direct-manipulation owner.
2. Preserve its public props unless one narrowly typed optional prop is required for testing or preload policy.
3. Add pending intent and deferred pointer capture.
4. Add pointer-move handling through one rAF-batched transform path.
5. Add commit, cancellation and cleanup handling.
6. Add bounded adjacent readiness.
7. Add active-only accessibility ownership.
8. Preserve button, keyboard, status and focus contracts.
9. Preserve product ratios, focal positions and captions.
10. Preserve current wrap behaviour for button and keyboard navigation unless a current product contract says otherwise.
11. Keep the native project gallery byte- and behaviour-unchanged.
12. Add component and browser tests for all gesture states.
13. Add request-timing evidence before and after near-viewport activation.
14. Add before/after route script and image transfer evidence.
15. Update `docs/marketing-ui-foundation.md` with the final direct-manipulation contract.
16. Update this plan only if implementation needs to depart from the bounded three-frame or active-only semantic model.

#### Affected owners

Expected:

- `apps/marketing/components/marketing-foundation/ResponsiveGallery.tsx`
- `apps/marketing/components/marketing-foundation/Interactions.module.css`
- `apps/marketing/components/marketing-foundation/Interactions.test.tsx`
- `playwright/marketing.foundation.spec.ts`
- `playwright/marketing.products.spec.ts`
- `docs/marketing-ui-foundation.md`
- `test/marketing-motion-contract.test.ts`, only if the final CSS adds governed motion sources
- `apps/marketing/components/products/ProductDetailPage.tsx`, only if near-viewport activation cannot remain internal to `ResponsiveGallery`
- evidence under `artifacts/mobile-production-closure/pdr-02/`

Not expected:

- `apps/marketing/app/projects/ProjectGallery.tsx`
- `apps/marketing/app/projects/ProjectGallery.module.css`
- product data or route metadata
- enquiry code
- header, footer or scroll reset

#### Dependencies

- PDR-01 has established one production baseline.
- Current Foundation motion tokens remain available.
- Current product gallery items retain stable IDs or image paths.
- Protected preview and mobile browser testing are available.

#### Non-goals

- no native project-gallery change;
- no thumbnails;
- no autoplay;
- no fullscreen viewer;
- no pinch-to-zoom system;
- no infinite cloned rail;
- no momentum or velocity physics;
- no spring or bounce;
- no third-party carousel or motion dependency;
- no eager loading of the complete gallery;
- no caption redesign;
- no product content change;
- no global gesture abstraction.

#### Acceptance criteria

- A deliberate horizontal gesture visibly moves the product image before pointer-up.
- A normal vertical gesture scrolls the page and does not change gallery position.
- A vertical winner is never recaptured later in the same gesture.
- A clear horizontal winner captures only the active pointer.
- A diagonal gesture resolves consistently according to the documented threshold and dominance rule.
- A short horizontal gesture below 48 px returns to the current image.
- A committed gesture changes exactly one item.
- Reversing direction before release follows the current delta and resolves predictably.
- `pointercancel`, lost capture, resize, visibility change and unmount clear all transient state.
- Previous, Next, Arrow Left, Arrow Right, Home and End retain their current operation.
- Focus remains on the operated control or region.
- The live status changes once after commit and not during drag.
- Before proximity activation, only the active gallery image is mounted and requested.
- After activation, no more than three visual frames are mounted.
- Only the active image and caption are exposed to assistive technology.
- No adjacent frame contains focusable content.
- Reduced motion removes post-release travel.
- Adjacent-frame mount and item change produce no layout shift above the current zero target.
- Initial product-detail image and script transfer remain within the approved budgets.
- No pointer handler creates a task over 50 ms.
- The native project-gallery source and behaviour remain unchanged.
- Representative desktop product composition remains stable.

#### Unit and component tests

Add coverage for:

- empty and single-item galleries;
- pending intent below threshold;
- vertical intent cancellation;
- horizontal intent capture;
- horizontal movement updates;
- direction reversal;
- below-threshold release;
- next commit;
- previous commit;
- boundary or wrap behaviour;
- pointer cancellation;
- lost pointer capture;
- second pointer rejection;
- resize during drag;
- item change during drag;
- unmount cleanup;
- reduced-motion commit and cancellation;
- button focus retention;
- keyboard focus retention;
- one status update per commit;
- adjacent readiness activation;
- maximum three visual frames;
- inactive frame `aria-hidden`;
- inactive frame empty alt;
- no focusable inactive content;
- active ratio and focal-position continuity.

#### Playwright tests

At 430, 390 and 360 px, include:

- slow deliberate horizontal drag;
- fast deliberate horizontal drag;
- vertical swipe beginning inside the image;
- diagonal swipe;
- below-threshold horizontal drag;
- direction reversal;
- repeated previous/next gesture;
- buttons after gesture;
- keyboard after gesture;
- reduced motion;
- pointer cancellation;
- viewport resize after pending and active drag;
- no document horizontal overflow;
- no nested vertical scroller;
- no changed vertical scroll position after a cancelled horizontal gesture beyond normal browser tolerance;
- live status and active image;
- active-only accessibility tree;
- image-request capture before gallery proximity;
- image-request capture after proximity;
- cold adjacent-image readiness;
- representative gable, drop-down blind and heater variants;
- desktop regression.

Touch-enabled Chromium at the governed mobile widths is the interaction gate for this programme.

#### Accessibility validation

- Automated accessibility inspection exposes one gallery region and one active item.
- Inactive visual frames are skipped.
- Buttons retain contextual names.
- Status is polite and not repeated excessively.
- Dragging does not create live announcements.
- Keyboard operation remains complete.
- Focus-visible remains visible.
- Reduced motion behaves as specified.
- 200 percent zoom does not clip controls or status.

#### Performance validation

Before and after evidence must record:

- initial image request count;
- initial image transfer bytes;
- post-proximity image request count;
- product-route script transfer;
- compressed feature-chunk delta;
- CLS;
- long-task count and maximum duration;
- pointer-handler trace;
- 60 Hz frame trace during repeated drags;
- cold adjacent-image decode behaviour.

Budgets:

- no increase in initial gallery image requests before proximity;
- no complete-gallery preload;
- no more than three mounted visual frames after activation;
- compressed route script increase below 10 KB unless separately justified;
- no task over 50 ms attributable to the new handlers;
- no sustained sequence of three or more frames above 32 ms during repeated 60 Hz gestures;
- CLS remains at the current zero target and never exceeds 0.1;
- no failed image request or active blank frame.

High-refresh results may be recorded separately. Do not generalise 60 Hz results to 120 Hz or vice versa.

#### Production verification

After deployment:

- verify exact release identity;
- run representative product routes at 430, 390 and 360 px;
- verify initial request timing on a fresh context;
- verify no product audience is invented in enquiry links;
- record before/after evidence under the same release identity.

#### Effort

Medium to large.

#### Risk

Medium. Gesture arbitration and media readiness are contained but interaction-sensitive.

#### Rollback strategy

Revert PDR-02 to the prior one-active-image, pointer-up implementation.

The rollback must preserve:

- product routes and data;
- Previous/Next controls;
- keyboard support;
- live status;
- enquiry links;
- Foundation motion tokens;
- native project gallery.

Because PDR-02 changes no data or API contract, rollback is code-only.

#### Completion gate

Phase 2 is complete when PDR-02 is merged, deployed to an exact release, and the automated gesture, accessibility, request-timing and performance contracts pass against preview and production.
### PDR-04: Production enquiry and analytics reconciliation

#### Objective

Complete one authorised synthetic production enquiry and prove that the browser, attachment system, intake API, received record and consent-aware analytics describe the same single successful lead without exposing personal information in analytics evidence.

#### Customer outcome

A successful customer enquiry is accepted once, reaches Sanctuary with any selected files actually stored and available, and produces one trustworthy conversion signal. Validation or service failure does not create false success.

#### Justification

Automated and intercepted contracts already prove much of the shape, but the existing evidence record explicitly leaves current production analytics debug and authorised submission reconciliation blocked.

Current `main` also changed two operational assumptions after the earlier evidence:

- GTM is now the only Google browser runtime loader;
- selected attachments must store successfully or fail visibly.

The reconciliation must test these current contracts, not the retired coded GA loader or metadata-only attachment fallback.

#### Authorisation and privacy prerequisites

Before any production write:

1. Name the approving owner.
2. Name the operator.
3. Define one synthetic test contact record outside this document.
4. Mark the record so staff can identify it as a test without placing that marker in analytics.
5. Confirm production analytics debug access.
6. Confirm access to the accepted enquiry record and received notification.
7. Confirm the private `enquiry-attachments` bucket exists in the exact production Supabase project.
8. Confirm the current release includes the signed-upload failure contract.
9. Agree whether one small generated PDF, JPG, PNG or WebP file will be included.
10. Agree the retention, archive or cleanup treatment through the normal authorised workflow.
11. Do not write real customer information into screenshots, logs or the repository.

#### Smallest safe production procedure

##### Preparation

1. Deploy the exact PDR-01/PDR-02 release.
2. Pass read-only release and semantic checks.
3. Run the current form unit and intercepted browser suites.
4. Repair the stale metadata-only browser test and QA wording before the live run.
5. Verify the production Storage bucket and signing endpoint without uploading customer data.
6. Create one approved synthetic file when attachment validation is in scope.
7. Open analytics debug tooling.
8. Start a fresh private browser session.

##### Consent-negative control

Use a separate intercepted or read-only session:

1. Deny analytics and marketing consent.
2. Confirm optional Google/Meta/ArchiPro runtimes do not load beyond the allowed consent contract.
3. Complete form interactions with the enquiry endpoint intercepted.
4. Confirm no optional analytics transmission occurs.
5. Do not send a second production enquiry.

This control proves consent behaviour without creating another lead.

##### Authorised successful submission

1. Start a clean private session.
2. Grant analytics consent only, unless the approved test also requires marketing consent.
3. Enter the approved synthetic test values.
4. Select the approved route and context.
5. When file validation is authorised, attach one small synthetic file.
6. Record the browser-generated `submissionId` locally in the restricted operator record.
7. Confirm the signing response and upload complete.
8. Confirm the file descriptor submitted to intake contains a private path and a valid session token.
9. Activate submit once.
10. Confirm a second rapid activation does not create another request.
11. Record the accepted API response.
12. Confirm the success state is announced.
13. Record the `lead_submitted` dataLayer event.
14. Confirm `lead_event_id` equals the submitted `submissionId`.
15. Confirm the debug event reaches the intended analytics property or conversion tag once.
16. Confirm the accepted enquiry record exists once.
17. Confirm the received notification or workbench record exists once.
18. Confirm the attachment is available through the expected verified attachment or signed-link path when a file was included.
19. Confirm no validation or API failure event was logged as success.
20. Record only non-personal metadata in the shared evidence.

#### Required reconciliation record

The shared repository evidence may contain:

- release SHA;
- timestamp rounded sufficiently for correlation;
- route template;
- audience;
- source component;
- governed project or product slug;
- opaque `submissionId` or a one-way/redacted representation approved for repository use;
- API status;
- record existence;
- attachment stored yes/no;
- success event count;
- consent state;
- pass/fail.

It must not contain:

- name;
- phone;
- email;
- message;
- street address;
- dimensions;
- filename;
- file contents;
- signed URL;
- upload token;
- analytics client ID;
- raw IP or user agent;
- unredacted received email.

#### Exact scope

1. Repair stale attachment browser and QA contracts.
2. Verify private Storage readiness.
3. Verify GTM is the only Google runtime loader.
4. Run consent-negative control without a production submission.
5. Send one authorised synthetic production enquiry.
6. Reconcile submission ID, lead event ID, API result and accepted record.
7. Verify exactly one success event.
8. Verify exactly one accepted enquiry.
9. Verify attachment storage and delivery when an attachment is included.
10. Verify no personal properties enter analytics.
11. Verify denied consent prevents optional transmission.
12. Append the dated result to the active validation record.
13. Record any blocker without inventing a pass.
14. Do not broaden into analytics implementation redesign.

#### Affected owners

Expected test and documentation changes:

- `playwright/marketing.contact.spec.ts`
- `playwright/marketing.consent.spec.ts`
- `apps/marketing/lib/enquiryAttachments.test.ts`
- `apps/marketing/app/api/enquiry/route.test.ts`
- `docs/mobile-ux-phase-5-validation.md`
- `docs/testing-and-qa.md`
- `docs/security-privacy-quality.md`, only when current operational guidance is incomplete
- evidence under `artifacts/mobile-production-closure/pdr-04/`

Product code changes are not expected unless the pre-production contract tests reproduce a real current defect.

Relevant current owners:

- `apps/marketing/app/contact/ContactEnquiryForm.tsx`
- embedded SEO/service form owner
- `apps/marketing/lib/enquiryAttachments.ts`
- `apps/marketing/app/api/enquiry/attachments/sign/**`
- `apps/marketing/app/api/enquiry/route.ts`
- `apps/marketing/components/GoogleTagManager.tsx`
- consent and tracking helpers
- durable enquiry/attachment database and Storage owners

#### Dependencies

- PDR-01 exact release is deployed.
- PDR-02 is deployed if it is part of the release under final programme test.
- Production submission authority is explicit.
- Analytics debug and received-record access are available.
- Private Storage readiness is confirmed.
- Synthetic test values and retention treatment are approved.

#### Non-goals

- no new analytics vendor;
- no new tag architecture;
- no enhanced-conversion rollout;
- no CRM replacement;
- no form redesign;
- no new required fields;
- no customer-data export;
- no bulk production submissions;
- no use of a thank-you-page conversion shortcut;
- no restoration of `/runtime-ga.js`;
- no metadata-only file fallback.

#### Acceptance criteria

- The stale metadata-only test and QA wording are removed.
- Signing failure or direct upload failure prevents enquiry submission while a file remains selected.
- The user receives a clear retry/remove-files error.
- One authorised production submission is accepted.
- Exactly one accepted enquiry record exists.
- Exactly one received notification or equivalent durable record exists.
- Exactly one `lead_submitted` event exists.
- `lead_event_id` equals the accepted submission identifier.
- No success event exists for client validation failure, attachment failure or API failure.
- Denied analytics consent prevents optional analytics transmission.
- GTM is the only Google browser runtime loader.
- No personal form value appears in shared analytics evidence.
- When a file is included, it is verified as stored and available through the intended staff delivery path.
- The success state is announced and the form cannot double-submit.
- The shared evidence identifies the exact production release.
- Any blocked access is named and prevents completion rather than being treated as passed.

#### Automated tests

Before the authorised run:

```bash
npx vitest run \
  apps/marketing/lib/enquiryFormContract.test.ts \
  apps/marketing/lib/enquiryAttachments.test.ts \
  apps/marketing/app/contact/contactFormModel.test.ts \
  apps/marketing/app/contact/enquiryRoute.test.ts \
  apps/marketing/app/api/enquiry/route.test.ts

npx playwright test \
  playwright/marketing.contact.spec.ts \
  playwright/marketing.consent.spec.ts \
  playwright/marketing.phase-four.spec.ts \
  --config=playwright.marketing.config.ts \
  --workers=1
```

Production read-only/intercepted checks must continue to intercept `/api/enquiry` until the single authorised step.

#### Authorised browser run

The single authorised success run must cover:

- file selection;
- upload progress or status;
- submit lock;
- announced success.

One authorised lead is sufficient; all other browser cases use intercepted or designated environments.

#### Accessibility validation

- selected-file state is announced;
- upload failure is announced;
- error remains associated with the file control;
- retry/remove path is understandable;
- sending state is conveyed;
- success is focused or announced;
- duplicate activation does not create repeated live output.

#### Performance validation

This phase is not a performance optimisation project.

Record:

- upload duration;
- submit response duration;
- whether a timeout or long task affected the visible state;
- any duplicate or stalled request.

Do not publish private network payloads.

#### Production verification

The operator must verify all five layers:

1. browser state;
2. stored attachment state, when used;
3. accepted API response;
4. durable or received enquiry record;
5. consent-aware analytics debug event.

A four-of-five result is not completion.

#### Effort

Small to medium in code, medium operationally.

#### Risk

Medium because it writes one synthetic record to production and may include a private attachment.

#### Rollback strategy

The evidence PR is documentation and test alignment. If a code defect is found before the authorised run, fix it in a separate narrowly scoped commit and repeat all affected checks.

Do not attempt to erase the audit trail by directly deleting database or analytics records. Apply the agreed normal test-record retention or archive process.

#### Completion gate

PDR-04 is complete when it is merged and the authorised reconciliation passes all required layers.

Without submission authority, analytics debug access or Storage readiness, the phase remains blocked and the overall programme is not complete.

## Pull-request handoff cards

The Phase roadmap above is the sole authority for scope, tests, acceptance, rollback and completion. These cards are short entry points only; they must not duplicate or override the phase contracts.

| PR | Title | One outcome | Start evidence | Merge or completion gate |
|---|---|---|---|---|
| PDR-01 | `chore(marketing): close production release and semantic parity` | Every primary route serves the approved experience from one identifiable release | Current source-versus-production raw responses, including normal and cache-busted samples | Exact production SHA and semantic matrix pass; no real enquiry sent |
| PDR-02 | `feat(marketing): add direct manipulation to controlled product galleries` | Deliberate horizontal touch moves product media while vertical scrolling stays native | PDR-01 baseline plus current `ResponsiveGallery` gesture and request evidence | Automated gesture, accessibility, bounded-media, performance, preview and exact-release contracts pass |
| PDR-04 | `test(marketing): reconcile one production enquiry and conversion event` | One authorised synthetic lead reconciles across browser, attachment, API, durable record and analytics | Repaired attachment tests plus named approval, operator and production access | All five layers reconcile once, consent-negative control passes, and shared evidence contains no personal data |

Review PDR-01 by source/build/deployment/cache ownership before visual wording. Review PDR-02 by gesture ownership, vertical-scroll safety and request evidence before animation polish. Review PDR-04 by evidence completeness rather than code volume.

## Validation matrix

### Route and journey matrix

| ID | Route or journey | Required semantic state | Required interaction evidence | Enquiry/context evidence | Release evidence |
|---|---|---|---|---|---|
| R1 | `/` | Current homepage variant, one H1, one first-question radiogroup, three starting points, deterministic project matches | selection, keyboard, no-JS fallback, menu from non-zero scroll | project reference and general enquiry paths | normal and cache-busted exact SHA |
| R2 | `/projects` | collection marker, typed summary cards, optional filters, no hidden detail payload | filter, reset, refresh, Back and Forward | canonical project destination | exact SHA at 430/390/360 |
| R3 | `/projects/warkworth-outdoor-room` | native gallery shell, mixed ratios, controls, live position, project facts | native swipe, controls, keyboard, selector sheet, cold image | residential project slug and source | exact SHA at 430/390/360 |
| R4 | `/pergolas-auckland` | approved six-region service, three projects, three stages, one support gateway, no guide sequence | disclosure, early/final CTA, Back/Forward | residential source and shared form contract | exact SHA at 430/390/360 |
| R5 | `/custom-pergolas-auckland` | three projects, three stages, one support disclosure, no guide sequence | disclosure, design-review CTA, Back/Forward | residential/custom source and shared form contract | exact SHA at 430/390/360 |
| R6 | `/products` | four primary forms, two secondary gateways, governed project support | product comparison and route selection | neutral until reliable audience | exact SHA at 430/390/360 |
| R7 | `/products/pergolas/gable` | one controlled gallery, fit, constraint, evidence, three detail groups | direct manipulation, controls, keyboard, reduced motion, cold load | product slug, neutral audience | exact SHA at 430/390/360 |
| R8 | `/commercial-pergolas-auckland` | three cases before three stages, three support groups, no guide sequence | disclosure, enquiry, menu/history | commercial header, hero and embedded form | exact SHA at 430/390/360 |
| R9 | `/architects-designers-builders` | capability, role boundaries, three projects, two support groups, no guide sequence | disclosure, global header CTA, embedded form | professional header and embedded context | exact SHA at 430/390/360 |
| R10 | `/pergola-guides` | ten distinct guide choices and no repeated card disclosures | route selection and Back | useful service/enquiry path | exact SHA at 430/390/360 |
| R11 | `/pergola-cost-auckland` | answer, governed project and return before optional depth | disclosure, return, Back | service/enquiry continuity | exact SHA at 430/390/360 |
| R12 | `/contact` | neutral direct state, shared required fields, context banner only when valid | validation, keyboard, autofill, file, failure, retry, success | payload, UUID, event and accepted record | exact SHA at 430/390/360 |
| R13 | `/home-v2` | permanent redirect to `/` | redirect only | none | redirect target belongs to exact release |
| R14 | `/home-experimental` | permanent redirect to `/` | redirect only | none | redirect target belongs to exact release |
| J1 | homepage to project to enquiry | R1 -> R3 -> R12 | selection, navigation, Back/Forward | project context retained | one release throughout |
| J2 | homepage to residential enquiry | R1 -> R4 -> R12 | CTA, disclosure, history | residential context retained | one release throughout |
| J3 | filtered collection to project and Back | R2 -> R3 -> R2 | query, scroll, edge-Back | no context contamination | one release throughout |
| J4 | products to product enquiry | R6 -> R7 -> R12 | direct manipulation and vertical scroll | product retained, audience neutral | one release throughout |
| J5 | commercial to enquiry | R8 -> embedded/direct intake | service proof and form | commercial context | one release throughout |
| J6 | professional to enquiry | R9 -> embedded/direct intake | header and form | professional context | one release throughout |
| J7 | guide to service/enquiry | R10 -> R11 -> R4/R12 | disclosure, return, Back | source remains useful | one release throughout |
| J8 | direct contact correction/retry | R12 | error focus, file failure, retry, success | one UUID and one accepted lead | one release throughout |

### Viewport and capability matrix

| ID | Width/height or mode | Purpose | Required phases |
|---|---|---|---|
| V1 | 430 x 932 | large mobile baseline | PDR-01, PDR-02 |
| V2 | 390 x 844 | primary mobile baseline | PDR-01, PDR-02 |
| V3 | 360 x 800 | small mobile baseline | PDR-01, PDR-02 |
| V4 | approximately 360 x 480 | short-height menu, overlay and keyboard reach | focused automated suites |
| V5 | 320 x 568 | narrow compatibility | focused homepage/contact/product suites |
| V6 | 360 x 400 or supported 200 percent zoom equivalent | zoomed actionable-content reach | focused automated suites |
| V7 | 768 x 1024 | tablet shared-behaviour regression | PDR-02 |
| V8 | 1024 x 768 | compact desktop/header transition | PDR-01 and focused keyboard suites |
| V9 | 1440 x 900 or 1440 x 1000 | desktop regression | PDR-01, PDR-02 |
| C1 | reduced motion | zero autonomous travel and retained feedback | PDR-01, PDR-02 |
| C2 | JavaScript disabled | server content and direct paths | PDR-01 |
| C3 | script blocked before hydration | pending disclosure stability | PDR-01 regression |
| C4 | cold/cleared image cache | gallery readiness and blank-frame risk | PDR-02 |
| C5 | denied analytics/marketing consent | no optional transmission | PDR-04 |
| C6 | analytics granted, marketing denied | minimal authorised conversion evidence | PDR-04 |

### Release-parity matrix

For each primary route, record both normal and cache-busted response results.

| Field | Required value |
|---|---|
| Requested path | canonical route |
| Request mode | normal or cache-busted |
| Status | expected HTTP status |
| Release header | full or accepted shortened SHA matching approved deploy |
| Release equality | same as every other primary route |
| Required markers | pass |
| Forbidden markers | absent |
| H1 count | 1 |
| Main count | 1 |
| Canonical | expected URL |
| Robots | expected index/follow state |
| Sitemap | expected inclusion or exclusion |
| Footer owner | current compact utility |
| Evidence date | recorded |
| Capture source | preview or production |

A release-parity pass requires the entire matrix to agree. Do not report individual green routes as programme closure while another route serves a different generation.

### Form and analytics reconciliation matrix

| Layer | Negative/failure evidence | Success evidence | Shared evidence allowed |
|---|---|---|---|
| Client validation | no API request, no success event | valid form proceeds | field names and pass/fail only |
| Attachment validation | invalid file blocks submit | valid file accepted | policy error only |
| Attachment signing | signing failure blocks intake | signed upload descriptors returned | status and opaque session presence |
| Storage upload | upload failure blocks intake | private stored path exists | stored yes/no, no path |
| Intake API | service failure retains values/UUID and emits no success | one accepted response | status and redacted/opaque ID |
| Durable record | no record on failed intake | one accepted record | exists yes/no |
| Notification/workbench | no success notification on failed intake | one received item | exists yes/no |
| dataLayer | no `lead_submitted` on failure/denied consent | one `lead_submitted` | event name, non-personal context, redacted ID |
| GTM/analytics debug | no optional transmission when denied | one intended event/tag result | event count and pass/fail |
| Duplicate lock | double activation creates one request | one accepted request | request count |
| Success state | none after failure | announced/focused once | pass/fail |

### Performance measures

#### Release baseline measures

- HTTP and request failures;
- FCP;
- LCP;
- TTFB;
- CLS;
- long-task count and maximum duration;
- HTML bytes;
- total transfer bytes;
- image request count and transfer;
- script request count and transfer;
- DOM nodes where captured;
- visible broken images;
- duplicate IDs;
- primary target size;
- route height;
- release SHA.

#### Direct-manipulation measures

- active image request count before gallery proximity;
- adjacent request count after proximity;
- mounted visual frame count;
- compressed route/chunk delta;
- pointer-move callback count versus animation frames;
- task duration attributable to gesture handlers;
- frame duration during repeated drags;
- decode time for adjacent image;
- blank active-frame occurrences;
- CLS during readiness and commit;
- vertical scroll delta during vertical gesture;
- horizontal document overflow;
- status update count per commit.

#### Form and operational measures

- upload duration;
- intake response duration;
- accepted-record latency;
- notification latency;
- success-event count;
- duplicate request count.

These measurements are diagnostic and regression evidence. They do not by themselves prove a conversion increase.

### Evidence-storage conventions

Use:

```text
artifacts/mobile-production-closure/
  pdr-01/
    README.md
    release-parity.json
    route-measurements.json
    screenshots/
  pdr-02/
    README.md
    before/
    after/
    request-evidence/
    performance/
  pdr-04/
    README.md
    reconciliation-redacted.json
    consent-negative/
```

Evidence rules:

1. Every README identifies date, branch, commit, origin and operator.
2. Screenshots use descriptive route/viewport/state names.
3. Do not commit raw personal form values.
4. Do not commit signed URLs, upload tokens, cookies or analytics client identifiers.
5. Redact browser chrome only when needed for privacy; do not crop away evidence of the state being tested.
6. Keep failed evidence and append the retest.
7. Separate preview, production, automated and write-authorised evidence.
8. Record commands that reproduce automated evidence.
9. Use JSON for machine-comparable route and performance records.
10. Use Markdown for operator observations.
11. Keep evidence bounded. Do not add repeated screenshots when a structured result is sufficient.

## Sequencing and dependencies

### Required sequence

1. **PDR-01: Production release and semantic parity**
2. **PDR-02: Controlled product-gallery direct manipulation**
3. **PDR-04: Production enquiry and analytics reconciliation**

### Merge and deployment rules

| PR | May be developed in parallel? | May merge independently? | Must deploy before next phase? | Merge evidence |
|---|---|---|---|---|
| PDR-01 | Yes, first | Yes | Yes, establishes baseline | exact release and semantic matrix |
| PDR-02 | May branch after PDR-01 | Yes, after all scoped automated and protected-preview gates pass | Yes | gesture, accessibility, request, performance and exact-release evidence |
| PDR-04 | Test repair may start earlier; authorised run waits | Yes, after PDR-02 deploy and operational access are ready | It verifies current deployed state | authorised reconciliation and consent-negative control |

### Dependency details

- PDR-01 is the release source for every later comparison.
- PDR-02 uses the current Foundation tokens and product data; it does not depend on service-page source changes except for a stable baseline.
- PDR-04 may repair stale tests earlier, but its authorised production write occurs only after PDR-02 is deployed and operational access is ready.
- A production Storage or analytics defect discovered during PDR-04 stays in the operational owner.
- A release mismatch discovered after PDR-01 reopens PDR-01 closure before later evidence is trusted.

### Failures that require a plan amendment

Amend this plan rather than expanding a PR when:

- direct manipulation requires more than three mounted visual frames;
- a third-party carousel or motion dependency appears necessary;
- native project gallery architecture must change;
- form payload or required-field policy must change;
- a new analytics vendor or conversion model is proposed;
- a global history or lock manager is proposed;
- a separate mobile site or duplicate content tree is proposed;
- current project, product or service URLs would change;
- more than one production test enquiry is required;
- a broad service-page rewrite is proposed before release parity.

### Work that is explicitly conditional

- any `ScrollReset` change;
- any shared overlay-lock extraction;
- any project-gallery geometry caching;
- any fixed-blur removal;
- any footer/header scroll synchronisation change;
- any current-position algorithm change;
- any additional production submission.

## Measurement and success criteria

### Release parity

Success means:

- one approved SHA;
- one SHA across all primary routes;
- one SHA across normal and cache-busted responses;
- current semantic markers;
- no service guide progression;
- correct redirects;
- stable canonicals and sitemap;
- current footer;
- no production route generation outside the approved owner.

### Route semantics

Success means:

- one main and one H1;
- correct route role;
- correct project/stage/disclosure budget;
- one semantic content tree;
- no hidden viewport-specific duplicate content;
- correct enquiry audience and item context;
- direct contact neutral;
- product-only context neutral.

### Customer pathway continuity

Success means:

- project filters survive expected history;
- canonical detail URLs remain clean;
- Back and Forward produce expected route and query state;
- menu and project sheet do not leave stale locks;
- fragments reveal promised content;
- context survives refresh;
- form values survive correction and retry.

### Gallery gesture success

Record:

- percentage of scripted horizontal gestures that commit as expected;
- percentage of vertical gestures that leave active index unchanged;
- cancelled short/diagonal gesture result;
- direction-reversal result;
- blank active-frame count;
- status update count;
- focus retention.

The release gate is deterministic pass/fail for the defined scripts, not an aggregate success-rate target that can hide individual failures.

### Unintended vertical-scroll interception

Success means:

- a vertical gesture begun within the controlled gallery scrolls the page;
- active index does not change;
- the same gesture is not captured after vertical intent wins;
- no visible sticky transform remains;
- the governed automated mobile-width matrix passes.

### Image request and transfer changes

Success means:

- initial offscreen product-gallery request count does not increase;
- adjacent requests begin only near viewport or interaction;
- no complete-gallery preload;
- maximum three mounted frames;
- no unexplained initial image-byte increase;
- no failed request or blank active frame.

### Layout shift

- target: zero for controlled gallery activation and item change;
- hard ceiling: 0.1 per route measurement;
- any new visible gallery jump fails PDR-02 even if aggregate CLS remains below 0.1.

### Long tasks and frame continuity

Success means:

- no new handler task over 50 ms;
- no sustained three-frame sequence above 32 ms at 60 Hz attributable to the interaction;
- no repeatable layout-driven project-gallery frame failure;
- browser traces identify any remaining limitation.

### Form starts and accepted submissions

Observe after release:

- form starts by source;
- accepted submissions by source;
- validation error occurrence;
- retry occurrence;
- attachment selection;
- attachment failure;
- project-reference use;
- completion by audience.

These are observational measures. Do not claim that a release caused a conversion change without sufficient volume, comparable periods and confound review.

### Source-context retention

Success means:

- residential, commercial and professional contexts remain correct;
- project slug remains;
- product slug remains;
- product audience remains neutral until chosen;
- direct contact stays neutral;
- lower-case canonical values reach payload and analytics;
- callers cannot overwrite validated context fields.

### Project-reference use

Track, with consent:

- first-question selection;
- matched project view;
- project open;
- project-reference selection;
- continuation without a project reference;
- accepted enquiry with governed project slug.

Do not infer lead quality solely from click-through. Reconcile with qualified lead review when sufficient data exists.

### Qualified-enquiry indicators

Potential later operational indicators:

- usable suburb or site context;
- useful project brief;
- photos or plans supplied;
- correct audience;
- governed project or product reference;
- sales team classification;
- progression to site visit or design review.

These are not required to close the implementation programme and must not create new required fields.

### Accessibility completion

Success means:

- meaningful names, roles, states and order;
- no trap or invisible focus;
- error summary and success announced;
- one active controlled-gallery item;
- automated keyboard, reduced-motion and zoom checks pass.

### Technical maturity

The technical programme is production-mature when:

- release identity is exact;
- current route semantics are deployed;
- current tests describe current behaviour;
- direct manipulation meets payload and frame budgets;
- automated accessibility contracts pass;
- one operational submission is reconciled;
- no unexplained P0/P1 failure remains.

## Completion definition

The Sanctuary Pergolas Mobile Production Closure and Direct-Manipulation Refinement programme is complete only when all of the following are true:

1. PDR-01 is merged and deployed.
2. Every primary route exposes one intended `X-Sanctuary-Release`.
3. Normal and cache-busted responses agree.
4. The public homepage matches the approved owner and current semantic contract.
5. Residential, custom, commercial and professional service routes match their approved role and composition.
6. No high-intent service route exposes guide progression.
7. Professional global-header and embedded-form context agree.
8. Direct, project, product and audience enquiry contexts pass.
9. Retired homepage routes redirect permanently and remain out of the sitemap.
10. PDR-02 is merged and deployed.
11. Controlled product galleries follow deliberate horizontal touch.
12. Vertical page scrolling remains native through controlled galleries.
13. Adjacent media remains bounded and active-only semantics are preserved.
14. No initial image, script, CLS or long-task regression exceeds the programme budgets.
15. Native project gallery architecture remains unchanged.
16. Automated accessibility, keyboard, reduced-motion and zoom contracts pass.
17. PDR-04 is merged.
18. Stale metadata-only attachment expectations are removed from tests and docs.
19. Production private Storage readiness is confirmed.
20. One authorised synthetic enquiry is accepted exactly once.
21. One corresponding received/durable record exists.
22. One corresponding non-personal `lead_submitted` event exists.
23. `lead_event_id` reconciles with the accepted submission identifier.
24. Any selected synthetic attachment is verified as stored and available.
25. Denied consent prevents optional analytics transmission.
26. Current performance evidence is attached to the exact final release.
27. Every unresolved lower-priority issue is recorded with evidence, owner and priority.
28. The broad mobile roadmap and active validation record reflect completion without claiming unsupported causal conversion improvement.

## Deferred backlog

Only the following evidence-backed items remain outside this programme unless a qualifying failure changes their status.

### CTA promise-language alignment

Current labels such as `Get an estimate`, `Share your project details`, `Request a design review` and `Discuss your venue` imply different next steps. This may affect expectation, but no current evidence justifies a global rewrite.

Defer until:

- production parity is stable;
- source-specific lead data is available;
- sales feedback can distinguish lead quality from submission volume.

### Optional technical-form presentation

The required burden is low, but optional technical fields may appear extensive on embedded forms.

Defer a disclosure or presentation experiment until:

- automated keyboard and accessibility validation is complete;
- form-start and completion data is available;
- lead-quality impact can be monitored;
- the experiment preserves every field and payload.

### Route-level field performance

Homepage field data exists, but non-home URL samples may be insufficient.

Continue collecting route-family Web Vitals. Do not block this programme indefinitely on statistically unavailable URL-level CrUX data.

### Fixed blur and header/footer synchronisation

Inspect only when a browser trace shows a customer-visible frame or readability problem. Do not remove blur for theoretical performance.

### Native project-gallery geometry caching

The current rAF path reads gallery and figure geometry. Keep it unchanged unless a separately reproduced customer defect justifies a scoped change.

### High-refresh-rate optimisation

Record 120 Hz results when hardware is available, but do not turn a 60 Hz passing contract into a 120 Hz guarantee without testing.

### Broader conversion optimisation

After this programme, a separate evidence-led conversion phase may study:

- first-question selection;
- project-reference use;
- pathway exits;
- form start and completion;
- qualified lead progression.

Do not fold experiments into production closure.

### Development-only timing and tooling

Transient development `networkidle`, HMR and Windows Lighthouse cleanup issues remain tooling work unless reproduced in the production build or CI owner. Do not change customer UI to satisfy an isolated development-only failure.

## Recommended next Codex goal

Use this prompt with the plan attached:

> Implement and close PDR-02 from this plan. Preserve `ResponsiveGallery` as the controlled product-gallery owner and keep the native project gallery unchanged. Add deferred pointer capture, horizontal finger-follow, bounded three-frame readiness and active-only accessibility while preserving vertical scrolling, buttons, keyboard, focus, captions, ratios and reduced motion. Add the full focused component, browser, request-timing and performance evidence. Create a branch, commit, push and open a draft PR; verify the protected preview, then mark ready, merge and verify the exact production release when every scoped automated gate passes. Physical-device testing is not required. Do not send a real enquiry or include PDR-04 work.
