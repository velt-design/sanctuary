# Sanctuary Pergolas Mobile UX Implementation Review

**Review date:** 26 July 2026  
**Mobile scope:** approximately 430 px, 390 px and 360 px  
**Website:** Sanctuary Pergolas production website  
**Repository:** `velt-design/sanctuary`, current `main` reviewed at `c08b1f1208a997ab50060ac330f760eb80cd9920`  
**Implementation brief:** `mobile-ux-roadmap-v2.md`

## Evidence definitions

- **Verified:** directly observed on the production website, confirmed in current repository code, or recorded by the repository's dated production test evidence. The evidence source is identified in each finding.
- **Inferred:** a likely consequence or cause derived from verified evidence, but not directly proven.
- **Test required:** requires a physical device, assistive technology, production analytics access, an authorised submission, or another test that was not performed for this review.

## Review boundaries

This is a completion and implementation review, not a new broad audit. Production is treated as the customer-facing source of truth. Current repository code is used to identify intended behaviour, technical quality and deployment differences.

The 430 px, 390 px and 360 px assessment uses the repository's dated Playwright production matrix, route measurements and implementation tests, supplemented by direct inspection of current production routes. Chromium emulation is supporting evidence only. No claim is made that this review performed physical iOS Safari or Android Chrome testing, VoiceOver or TalkBack testing, a complete manual keyboard audit, production analytics inspection, or a real production enquiry submission.

---

# 1. Executive summary

**Overall judgement: improved but inconsistent.**

The programme has materially improved Sanctuary's underlying mobile information architecture. The strongest result is the shift to project-led proof. The homepage, project collection, project details, product hub and product details are clearer, more visual and more architecturally credible than a compressed desktop journey. Project facts, design constraints, built responses and contextual enquiry links now create a stronger path from inspiration to qualified contact. The product experience is also notably disciplined, with fit, one main constraint, evidence and optional depth presented in a useful order.

The largest remaining problem is not another content-design problem. It is **production parity and release reliability**. Current `main` contains the approved three-project and three-stage residential, custom and commercial structures, simplified guide first layers and one global compact footer. Current production still serves earlier residential, custom and commercial structures, older guide-detail sequencing and the old footer on several route groups. This means customers are receiving different programme states depending on the route. The exact deployed release is also not exposed, so the cause is inferred rather than proven.

The most important implementation regression is the project-detail gallery. The controlled gallery delivered in Phase 2 was deliberately superseded by a native horizontal strip. The strip feels more editorial and preserves image variety, but it again depends primarily on swipe or horizontal scrolling and provides no visible previous, next or current-position control.

The five phases are successful as a direction and as a body of repository work, but they are not yet a fully successful customer-facing release. Phase 5 is explicitly incomplete. The three highest-value next improvements are: establish one identifiable and atomic production release, deploy and reconcile the enquiry analytics and review-accessibility fixes, then add explicit controls and position feedback to the native project gallery.

---

# 2. Completed-phase scorecard

## Phase-level assessment

| Phase | Intended user outcome | Implementation status | Quality | Evidence | Remaining issue | Closed or still active |
|---|---|---|---|---|---|---|
| **Phase 1: conversion and responsive-state closure** | Preserve audience, source, project and product context through a stable, understandable enquiry journey | **Completed successfully** | High | **Verified repository and live:** canonical route context, neutral direct contact, audience-aware forms, uploads, semantic disclosures, focus handling and intercepted payload coverage | Production analytics event identity is still wrong, but that is a Phase 5 conversion-measurement defect rather than a reason to reopen the Phase 1 architecture | **Closed** |
| **Phase 2: project portfolio hardening** | Remove hidden collection payload and provide an accessible, controllable project browse and gallery loop | **Completed but needs refinement** | High for collection payload; medium-high for current gallery | **Verified repository and production evidence:** collection payload was materially reduced and project cards remain. **Verified repository:** the controlled gallery was later superseded by a native horizontal strip | Native strip has no visible previous, next or current-position control. Physical Back gestures and assistive-technology behaviour remain unverified | **Close the phase. Transfer the gallery defect to remaining work** |
| **Phase 3: service and product consolidation** | Shorter service and product decisions with early proof, three-stage processes and purposeful disclosure | **Partially implemented** | High in current `main`; inconsistent in production | **Verified:** product index and product details largely reflect the approved pattern live. **Verified production discrepancy:** residential and custom still expose earlier four-project, longer-process and guide-framed structures | Approved residential and custom structures are implemented in `main` but are not reliably customer-facing | **Active until production parity is closed** |
| **Phase 4: secondary audiences, guides and utility** | Proof-led commercial and professional pathways, simplified guides and a compact footer | **Partially implemented** | High in current `main`; inconsistent in production | **Verified:** homepage close and guide hub are improved. **Verified production discrepancy:** commercial, guide details and footer do not consistently match current `main`. Professional is repository-verified and returned HTTP 200 in automation, but direct customer-facing content could not be independently verified | Commercial remains stale live, the guide-detail first layer is stale live, and the global compact footer is not consistently served | **Active until production parity and professional verification are closed** |
| **Phase 5: device, accessibility, performance and outcome validation** | Prove cumulative behaviour on real devices, assistive technology and production measurement systems | **Partially implemented** | Methodical automated work, incomplete real-world evidence | **Verified repository:** 30 route-width records, no measured overflow or CLS, no broken viewport images, no duplicate IDs and no undersized primary targets. Local fixes pass focused tests | Physical iOS and Android, VoiceOver, TalkBack, dated manual keyboard review, exact production release identity, analytics debug access and an authorised submission remain incomplete. Two fixes are not deployed | **Active** |

## PR and work-item closure ledger

| PR or work item | Classification | Customer outcome achieved? | Remaining action |
|---|---|---|---|
| **PR 1: enquiry routing and source context** | **Completed successfully** | Yes. Major routes use canonical audience and source context, and direct contact remains neutral | Keep covered by parity and form-regression tests |
| **PR 2: form contract, terminology and uploads** | **Completed successfully** | Yes. Direct and embedded forms share audience-aware terminology, labels, validation and attachment support | Complete real-device input, file and success-state testing in the remaining validation work |
| **PR 3: deterministic responsive disclosures** | **Completed successfully** | Yes in code and browser tests. Server-rendered content and desktop-expanded behaviour are preserved | Complete physical screen-reader and fragment-navigation testing |
| **PR 4: remove hidden project-detail payload from collection** | **Completed successfully** | Yes. The project collection no longer carries the hidden detail tree and media burden | Keep a route payload budget to prevent regression |
| **PR 5: controlled project gallery and browse loop** | **Superseded** | Partly. The controlled gallery met the original requirement, but the product-owner decision restored a native strip | Preserve the native strip, then add explicit previous, next and position feedback without restoring a heavy controlled gallery |
| **PR 6: consolidate product-detail first layers** | **Completed successfully** | Yes. Representative product pages expose outcome, fit, constraint, evidence, one gallery and three purposeful detail groups | Only physical-device and assistive-technology testing remains |
| **PR 7: residential simplification** | **Implemented but not deployed** | Not reliably for production customers | Deploy the three-project, three-stage, six-region structure and remove dominant guide framing |
| **PR 8: custom simplification** | **Implemented but not deployed** | Not reliably for production customers | Deploy the three constrained projects, three stages and single support gateway |
| **PR 9: product-index hierarchy** | **Completed successfully** | Yes. Four forms lead, integrated options are secondary and comparison does not require a horizontal table | Retain current hierarchy and correct shared footer parity |
| **PR 10: commercial consolidation** | **Implemented but not deployed** | Not reliably for production customers | Deploy the three-case, three-stage proof-first sequence. Also set `showGuideNavigation: false` in the current commercial configuration |
| **PR 11: professional capability route** | **Unable to verify** | Repository implementation and automated HTTP 200 evidence are strong, but current production content and end-to-end file flow were not independently verified | Verify the live route, audience selection, uploads, Back and refresh against the same release as all other routes |
| **PR 12: guide hub and guide-detail first layers** | **Partially implemented** | The guide hub is successful. Representative guide detail is not serving the approved answer, one-project, return-route first layer | Deploy and verify the current guide-detail renderer across all governed guides |
| **PR 13: compact footer and homepage close** | **Partially implemented** | Homepage close is successful. The compact footer is live on some routes but the old footer remains on others | Make the current global `SiteFooter` the only production footer output |
| **PR 14: real-device, accessibility, performance and analytics validation** | **Partially implemented** | Automated stability evidence exists, but the defining real-world completion criteria have not been met | Complete devices, assistive technology, manual keyboard, release identity and authorised analytics reconciliation |

**Closure judgement:** Phases 1 and 2 can be considered closed. Minor polish should not keep them active. Phase 2's native-gallery control gap should exist as a new bounded defect, not as a reopening of all project work. Phases 3 and 4 are code-complete in substantial part but remain customer-facing deployment work. Phase 5 remains open by its own completion rule.

---

# 3. Updated mobile scorecard

Scores assess the current customer-facing experience, not only current `main`. No previous numerical scores are assumed.

| Metric | Current score | Evidence | Highest-value improvement |
|---|---:|---|---|
| **First-screen impact** | **8/10** | **Verified live:** strong architectural imagery, direct fixed-roof positioning and a clear primary action on the homepage and major detail routes | Make the same concise proposition reliably live on the service and commercial routes |
| **Immediate clarity** | **8/10** | **Verified live:** the homepage and product routes quickly establish what Sanctuary does. **Verified weakness:** stale service routes introduce guide framing and longer explanation early | Deploy the approved service first layers and remove numbered guide navigation from high-intent routes |
| **Premium brand perception** | **8/10** | **Verified live:** restrained typography, calm colour, full-scale project imagery and specific language support a premium impression | Remove route-to-route footer and structure inconsistencies that make the site feel less controlled |
| **Architectural credibility** | **9/10** | **Verified live and repository:** dimensions, form, materials, constraints, building relationships and consultant roles are concrete | Preserve this specificity while enforcing shorter production first layers |
| **Visual storytelling** | **8/10** | Projects are now the primary proof on the homepage, project collection and many product journeys | Put approved project proof immediately after the hero on live residential, custom and commercial pages |
| **Image use** | **8/10** | Large images, representative project evidence and mixed project-gallery proportions work well | Add gallery controls without shrinking images or flattening the editorial composition |
| **Copy restraint** | **6/10** | Strong on homepage, products, project details and the guide hub. Materially weak on live residential, custom, commercial and representative guide details | Deploy current concise page structures before making any new copy cuts |
| **Ease of scanning** | **7/10** | Clear headings, facts and card patterns work on modernised routes. Long stale routes create too many equal-weight sections | Standardise the six-region service first layer and one support gateway in production |
| **Reading effort** | **6/10** | Product and project journeys are controlled, but long service and commercial output still asks for substantial linear reading | Correct parity first; do not add more accordions as a substitute for removing or moving content |
| **Section pacing** | **7/10** | Image-led sections and evidence blocks create good rhythm on core routes | Ensure commercial proof and concise process are live before operational depth |
| **Perceived page length** | **6/10** | Homepage and product details are improved, but stale service, commercial and guide detail pages remain materially long | Deploy the approved disclosure and first-layer grouping across route families |
| **Navigation usability** | **8/10** | **Verified repository:** menu uses clear audience links, inert background, focus containment, scroll locking, Escape and 52 px links | Complete physical short-viewport, Back-gesture and screen-reader testing |
| **Pathway clarity** | **8/10** | Residential, commercial and professional routes are represented in the mobile menu and forms preserve audience context in code | Verify the professional route live and make high-intent route structure consistent |
| **Project discovery** | **9/10** | The project collection is image-led, filterable and no longer carries the hidden detail payload | Complete physical Back/filter restoration testing and retain payload budgets |
| **Project-detail experience** | **8/10** | Strong facts, brief, constraint, response, gallery, technical disclosure, related work and previous/next links | Add visible gallery controls and current-position feedback while retaining native scrolling |
| **Product comprehension** | **9/10** | Outcome, fit, one primary constraint, built evidence and honest trade-offs are clearly ordered | Correct shared footer parity and complete physical gallery/disclosure testing |
| **Service-page clarity** | **6/10** | Current `main` is strong, but production residential and custom pages are still article-like and guide-framed | Deploy the approved three-project, three-stage structures |
| **CTA visibility** | **8/10** | Primary actions appear in heroes, after proof and near final enquiries on current routes | Standardise promise language so "estimate", "project details" and "design review" accurately describe the next step |
| **Conversion effectiveness** | **7/10** | Contextual forms, visible source context and uploads support qualified enquiry. Exact event-to-lead reconciliation is broken in production | Deploy the shared submission identifier and complete one authorised production reconciliation |
| **Trust and evidence** | **9/10** | Governed projects, specific constraints and careful claim boundaries are a major strength | Fix the review-link accessible-name mismatch and keep evidence claims route-specific |
| **Enquiry experience** | **8/10** | Clear labels, only name and phone universally required, optional uploads, error summary, retry retention and announced success are well designed in code | Verify the complete direct, embedded and professional flow on real devices and in production analytics |
| **Touch usability** | **7/10** | Automated evidence found no primary target below 44 px and no horizontal document overflow | Add non-swipe gallery controls and complete physical-device spacing, keyboard and short-viewport checks |
| **Accessibility** | **7/10** | Semantic disclosures, focus-visible styles, form labels, errors and live success states are strong in code | Deploy the review-name fix, add gallery position feedback, then complete VoiceOver, TalkBack and manual keyboard testing |
| **Performance perception** | **8/10** | Project collection payload reduction, zero measured CLS/overflow and strong homepage lab results are positive | Establish one release identity and collect non-home field evidence after production is stable |
| **Overall mobile customer experience** | **7/10** | Core design direction is strong, but stale route groups and incomplete production validation prevent a higher score | Close production parity and conversion reliability before another design phase |

---

# 4. Page-group review

The repository's automated production matrix reports HTTP 200, no measured horizontal overflow, no measured CLS, no broken viewport images, no duplicate IDs and no undersized primary targets at 430 px, 390 px and 360 px across ten primary routes. This is useful stability evidence, but it does not replace a physical-device or full visual-quality review.

| Page or journey | What now works well | What remains weak | Deliberately mobile-designed? | Largest remaining opportunity | Priority |
|---|---|---|---|---|---:|
| **Homepage** | Strong first screen, early featured-project proof, clear audience paths, selected work, concise process and a focused final enquiry | Some CTA language still mixes "estimate" with broader project assessment. Physical crop and outdoor-readability checks remain | **Yes** | Retain structure, verify physical devices, then align CTA promise language | **P2** |
| **Mobile navigation** | Clear Home, Projects, Pergola options, Commercial, professional and Contact paths. Code supports inert background, focus loop, Escape, scroll lock and history close | Physical Back gestures, short-screen menu reach, rotation and VoiceOver/TalkBack behaviour remain unverified | **Yes, code-supported** | Complete the dated physical and assistive-technology task matrix | **P1** |
| **Residential service** | Current `main` has a clear proposition, three relevant projects, three stages, compact investment drivers, one support disclosure and a contextual embedded form | Production still exposes guide-series framing, four projects, five stages and extensive supporting education | **No in current production; yes in current `main`** | Deploy the approved Phase 3 page and verify exact section counts, order and context | **P0** |
| **Custom service** | Current `main` distinguishes custom through constraints, three governed projects, three stages and one support gateway | Production remains a longer guide-like route with four projects and four process stages | **No in current production; yes in current `main`** | Deploy the current custom configuration and remove dominant guide navigation | **P0** |
| **Products index** | Four pergola forms are visually primary, integrated options are secondary, project proof is useful and comparison avoids horizontal scrolling | Production still exposes the older footer on this route group | **Yes** | Make the compact global footer consistent and retain the current product hierarchy | **P1** |
| **Representative product pages** | Outcome, fit, main constraint, gallery, governed evidence and optional technical detail create excellent product comprehension | Physical operation of gallery and disclosures remains unverified. Old footer remains on live product routes | **Yes** | Correct footer parity and complete device and assistive-technology checks | **P1** |
| **Projects index** | Large-image discovery, optional filters, 14 project cards and removal of hidden detail payload create the strongest mobile collection experience | Physical browser Back and filter restoration need confirmation | **Yes** | Complete real-device filter, history and scroll-restoration tests | **P1** |
| **Representative project pages** | Premium case-study hierarchy, large hero, concise facts, brief, constraint, response, gallery, technical detail, related work, previous and next | Native gallery is swipe-first and lacks visible controls or a current/total position. Old footer remains live | **Mostly** | Add lightweight visible controls and status, preserving native strip behaviour | **P1** |
| **Commercial page** | Current `main` has an excellent proof-first three-case, three-stage structure and commercial form fields | Production still serves four cases, five stages and guide-series framing. Current `main` also omits `showGuideNavigation: false` | **No in current production; mostly in current `main`** | Deploy the current structure, disable guide navigation and verify commercial context | **P0** |
| **Professional pathway** | Repository route clearly explains roles, documentation, engineering interfaces, three projects and professional file-led enquiry | Production returned HTTP 200 in automation, but live content and complete upload continuity were not independently verified | **Repository indicates yes** | Verify the exact live release, visible route content and intercepted professional payload | **P1** |
| **Guide hub** | Ten guide distinctions are visible without ten repeated controls. Chapter grouping is easier to scan | Old shared footer remains live | **Yes** | Correct footer parity and retain the current direct-scanning structure | **P2** |
| **Representative guide details** | Current renderer can lead with one answer, one project, a return route and one optional depth control | Production representative cost guide still uses the earlier long sequence and does not expose the approved first layer | **No in current production; yes in current `main`** | Deploy the current guide-first-layer renderer across all governed guide routes | **P0** |
| **Contact and enquiry flow** | Direct contact is neutral, required and optional fields are explicit, uploads are available, error summary and success state are accessible in code | Exact production event-to-submission reconciliation fails. Real submission, autofill, keyboard, retry and success were not performed | **Yes** | Deploy event identity fix, then run authorised end-to-end reconciliation and physical form tests | **P0** |
| **Footer** | Current `main` footer is compact, includes phone, email, three pathways, review proof, address and legal/social links with 44 px minimum targets | Production serves the compact footer only on some routes and the old footer on others | **Yes in current `main`; inconsistent live** | Make one global footer output part of the release-parity gate | **P0** |

---

# 5. Remaining defects and regressions

## Conversion and routing

| ID | Issue and evidence status | User consequence | Affected pages or components | Priority | Recommended resolution |
|---|---|---|---|---:|---|
| **CR-01** | **Verified:** production route groups do not consistently match current `main` | Visitors receive different content density, proof order and utility depending on the route, reducing confidence and conversion consistency | Residential, custom, commercial, guide details, product/project/guide footers | **P0** | Establish an identifiable atomic release, purge or invalidate stale outputs, then verify route markers against the same build |
| **CR-02** | **Verified repository evidence:** production `lead_event_id` and accepted `submissionId` are different UUIDs | A successful enquiry cannot be reconciled exactly with its analytics success event, weakening conversion measurement and debugging | Direct and embedded enquiry forms, analytics utilities | **P0** | Deploy the current shared-ID fix and complete intercepted plus one authorised production reconciliation |
| **CR-03** | **Unable to verify:** professional route live content and file continuity | A high-value professional visitor may face an unverified route or context handoff | Professional route, mobile menu, embedded professional form, uploads | **P1** | Verify live content, audience, files, payload and refresh/Back on the exact release under test |

## Content and hierarchy

| ID | Issue and evidence status | User consequence | Affected pages or components | Priority | Recommended resolution |
|---|---|---|---|---:|---|
| **CH-01** | **Verified:** live residential, custom and commercial routes remain longer and more article-like than current `main` | High-intent visitors must read more before seeing fit, proof and a confident next step | Three high-intent service routes | **P0** | Deploy current approved structures. Do not perform another copy rewrite first |
| **CH-02** | **Inferred:** "Get an estimate", "send project details", "request a design review" and "discuss your venue" represent different promise levels | Some visitors may expect an immediate price where the real next step is a scoped assessment | Header, homepage and contextual CTAs | **P2** | Define a small CTA language matrix by route intent, then test lead quality before changing the global label |

## Progressive disclosure

| ID | Issue and evidence status | User consequence | Affected pages or components | Priority | Recommended resolution |
|---|---|---|---|---:|---|
| **PD-01** | **Verified:** approved service, commercial and guide disclosure groupings are not consistently live | Supporting education remains visible as linear page length instead of optional depth | Residential, custom, commercial and guide details | **P0** | Deploy current grouping and assert closed first-layer region counts in production tests |
| **PD-02** | **Verified repository:** commercial configuration does not set `showGuideNavigation: false` | Even after the main commercial restructure deploys, a high-intent service page can retain guide-series framing | Commercial configuration and shared SEO landing renderer | **P1** | Add the same explicit guide-navigation suppression used by custom and professional routes |
| **PD-03** | **Test required:** disclosure history, fragments and spoken state on physical browsers and screen readers | Back or hash navigation may create surprising collapsed states or focus order | Shared `Disclosure`, service/product/guide wrappers | **P1** | Run the Phase 5 task scripts on physical iOS/Android, VoiceOver and TalkBack after parity is stable |

## Navigation

| ID | Issue and evidence status | User consequence | Affected pages or components | Priority | Recommended resolution |
|---|---|---|---|---:|---|
| **NV-01** | **Test required:** menu focus, scroll lock, Back gesture, rotation and short-height reach have not been completed on physical devices | Users can be trapped, lose page position or fail to reach lower destinations despite strong code | Mobile header and menu | **P1** | Complete physical menu tasks on small and large iOS and Android devices |
| **NV-02** | **Verified:** footer navigation and direct contact utilities differ by route group | Users who reach the end of different pages receive inconsistent next steps | Global layout and route output | **P0** | Enforce the current compact `SiteFooter` as a release-wide contract |

## Projects

| ID | Issue and evidence status | User consequence | Affected pages or components | Priority | Recommended resolution |
|---|---|---|---|---:|---|
| **PJ-01** | **Verified repository:** native project gallery has no visible previous, next or current/total control | Visitors who do not discover horizontal swipe may miss project images. Keyboard and screen-reader users receive weak positional feedback | `ProjectGallery`, project-detail CSS | **P1** | Add lightweight buttons and an announced position tied to native scroll snap. Keep swipe optional and preserve mixed aspect ratios |
| **PJ-02** | **Test required:** filter state, scroll position and browser Back gestures on physical devices | Returning from a project may reset or disorient collection browsing | Project navigator, filters, history state | **P1** | Run commercial-filter and Back task on physical iOS and Android, then fix only observed failures |
| **PJ-03** | **Verified:** old footer remains on live project routes | A strong portfolio journey ends in a less useful and inconsistent utility layer | Project collection and detail routes | **P1** | Resolve through the global production-parity fix |

## Products

| ID | Issue and evidence status | User consequence | Affected pages or components | Priority | Recommended resolution |
|---|---|---|---|---:|---|
| **PRD-01** | **Verified:** product routes retain the old footer in production | Product decision journeys end without the current direct phone, email and pathway utility | Product index and details | **P1** | Resolve through global footer parity |
| **PRD-02** | **Test required:** controlled product gallery, disclosure announcements and focus behaviour are not physically verified | Swipe, focus and spoken state may differ from Chromium emulation | Shared product gallery and disclosures | **P2** | Include representative pergola and accessory routes in physical and assistive-technology testing |

## Service pages

| ID | Issue and evidence status | User consequence | Affected pages or components | Priority | Recommended resolution |
|---|---|---|---|---:|---|
| **SV-01** | **Verified:** residential production still has guide-series framing, four projects and five stages | General residential visitors face avoidable reading and weaker project-to-enquiry momentum | `/pergolas-auckland` | **P0** | Deploy current six-region, three-project, three-stage implementation and verify source context |
| **SV-02** | **Verified:** custom production still has four projects, four stages and a longer article sequence | Complex-site visitors receive duplicated general education instead of a concise custom distinction | `/custom-pergolas-auckland` | **P0** | Deploy the current custom configuration and verify constrained projects and custom form context |

## Commercial and professional pathways

| ID | Issue and evidence status | User consequence | Affected pages or components | Priority | Recommended resolution |
|---|---|---|---|---:|---|
| **CP-01** | **Verified:** commercial production still serves four cases, five stages and guide framing | Venue owners must work through more explanation before the clearest proof and responsibility model | Commercial route | **P0** | Deploy current three-case, three-stage order and suppress guide navigation |
| **CP-02** | **Unable to verify:** professional route production content and complete plan-upload path | Professional leads may not receive the intended capability evidence and role clarity | Professional route and form | **P1** | Verify live route markers, three governed projects, professional audience and upload payload |

## Forms

| ID | Issue and evidence status | User consequence | Affected pages or components | Priority | Recommended resolution |
|---|---|---|---|---:|---|
| **FM-01** | **Verified:** analytics success cannot currently reconcile exactly to one accepted intake | Commercial decisions are made with weaker attribution and duplicate-event confidence | Direct and embedded forms | **P0** | Deploy shared submission UUID and complete authorised production reconciliation |
| **FM-02** | **Test required:** physical autofill, mobile keyboard, attachment selection, failure retry, Back/refresh and success announcement | A form can pass automation yet still create real-device friction or lost entries | Direct, service, commercial and professional forms | **P1** | Execute the documented direct-contact and contextual-form device scripts |
| **FM-03** | **Inferred, data required:** suburb and project brief are optional on direct contact | Some enquiries may arrive with limited qualification context, but requiring more may reduce completion | Direct contact form | **P2** | Do not make fields required without reconciled completion and lead-quality evidence. Consider post-submit follow-up prompts first |

## Accessibility

| ID | Issue and evidence status | User consequence | Affected pages or components | Priority | Recommended resolution |
|---|---|---|---|---:|---|
| **AX-01** | **Verified repository evidence:** two live Google review links use an accessible name that does not match the visible rating/count purpose | Screen-reader users receive a misleading link name | Homepage and footer review links | **P1** | Deploy the current local accessible-name fix and add a production computed-name assertion |
| **AX-02** | **Verified:** project gallery lacks explicit controls and position feedback | Non-swipe and screen-reader navigation is less discoverable and less predictable | Project gallery | **P1** | Add labelled previous/next controls and `current of total` status |
| **AX-03** | **Test required:** VoiceOver, TalkBack and dated manual keyboard tasks remain incomplete | Semantic correctness in code is not enough to confirm understandable spoken and focus order | Entire primary journey | **P1** | Complete the documented task matrix after one stable production release |

## Rendering and performance

| ID | Issue and evidence status | User consequence | Affected pages or components | Priority | Recommended resolution |
|---|---|---|---|---:|---|
| **RP-01** | **Verified symptom, inferred cause:** production appears to serve route output from different implementation states | Customers see stale hierarchy and utility despite newer code existing | Static route generation, deployment, CDN/cache and release process | **P0** | Expose release identity, audit build/deploy inputs, invalidate stale output and add route-parity smoke tests |
| **RP-02** | **Test required:** field evidence is strong for the homepage but incomplete for non-home routes, INP and route-level TTFB | Performance confidence is concentrated on one route and may miss high-intent problems | Projects, services, products, commercial, professional and contact | **P1** | Record route-level field and lab evidence after parity closure, with HTML and image budgets |
| **RP-03** | **Test required:** priority crops and outdoor readability were not assessed on physical devices in bright conditions | Premium imagery or muted metadata may be hard to read in real use | Heroes, project cards, text over images, footer metadata | **P2** | Add the documented outdoor/brightness and 200 percent zoom checks to device validation |

## Analytics and production parity

| ID | Issue and evidence status | User consequence | Affected pages or components | Priority | Recommended resolution |
|---|---|---|---|---:|---|
| **AP-01** | **Verified:** the public response exposes no exact deployment commit or release identifier | Reviewers cannot prove which code is serving a route or reliably associate a regression with a release | Deployment pipeline and public marketing response | **P0** | Add a non-sensitive build SHA to a response header or version endpoint and record it in evidence |
| **AP-02** | **Verified:** event-to-submission UUID mismatch remains live | Success events cannot be matched exactly to accepted intake | Analytics and forms | **P0** | Deploy current fix and require exact identity equality in production smoke tests |
| **AP-03** | **Verified gap:** current tests assert route stability but do not prevent approved content markers from drifting by route release state | HTTP 200 and zero overflow can pass while customers receive stale content | Production route matrix | **P0** | Add semantic parity assertions for project count, process count, guide first layer, footer variant and release SHA |

---

# 6. Biggest improvements still available

| Rank | Problem | Affected users | Evidence | Recommended solution | Expected UX impact | Expected commercial impact | Effort | Implementation risk | Dependencies |
|---:|---|---|---|---|---|---|---|---|---|
| **1** | Production routes do not consistently serve the approved implementation | All visitors, especially residential, custom, commercial and guide users | **Verified** | Create release identity, deploy one atomic build, invalidate stale output and add semantic route-parity gates | **Very high:** consistent first layers, proof order and utility | **Very high:** removes avoidable friction on high-intent paths and restores confidence in every optimisation | Medium | Medium | Vercel/deployment access, current `main`, cache control |
| **2** | A successful lead cannot be reconciled exactly to its production analytics event, and review links retain a live naming defect | Enquirers, screen-reader users, marketing and operations | **Verified** | Deploy the current shared UUID and review-name fixes, run intercepted tests, then one authorised real production submission with analytics debug | **High:** reliable success feedback and correct accessible purpose | **Very high:** trustworthy conversion measurement and cleaner lead debugging | Small to medium | Medium due to production data and permissions | PR 1 release identity, analytics access, approved test contact |
| **3** | Project-detail gallery is visually strong but swipe-first with no explicit position or controls | Portfolio visitors, keyboard users and screen-reader users | **Verified** | Add compact previous/next controls and announced current/total status, driven by native scroll position | **High:** better discovery and control without losing editorial character | **High:** more project evidence consumed before enquiry | Medium | Low to medium | Stable current native strip, accessibility review |
| **4** | Real-device and assistive-technology completion remains unknown | All mobile users, particularly people using iOS gestures or screen readers | **Test required** | Complete the documented iOS, Android, VoiceOver, TalkBack and manual keyboard matrix after parity closure | **High:** removes interaction uncertainty and catches real browser issues | **High:** reduces failed journeys and production support risk | Medium | Low | One stable release, devices and testers |
| **5** | Professional capability and plan-led enquiry are not independently verified live | Architects, designers, builders and consultant-led projects | **Unable to verify** | Verify route content, role clarity, three project cases, files, professional audience and submitted context | **High for a valuable segment** | **High:** protects larger, better-qualified opportunities | Small to medium | Low to medium | Stable release, intercepted upload and payload environment |
| **6** | Performance and content regression gates focus on stability, not approved route shape or non-home field experience | All visitors, most importantly high-intent service and contact users | **Verified gap and test required** | Add semantic content budgets, HTML/image budgets and route-level field/lab monitoring | **Medium:** prevents page-length and payload regression | **Medium to high:** protects speed, crawl quality and conversion work over time | Medium | Low | Release identity and stable production routes |
| **7** | CTA language sometimes promises an estimate while the actual next step is a scoped project review | Early-stage and price-sensitive visitors | **Inferred** | Define route-specific CTA promise rules and compare completion plus lead quality before changing the global header | **Medium:** clearer expectation and less perceived bait-and-switch | **Medium:** potentially better qualification without increasing fields | Small | Low | Reconciled analytics and lead-quality review |

---

# 7. Recommended next phase

## Phase 6: Production parity and conversion reliability closure

### Objective

Make the public website match the approved responsive implementation across every primary route, expose the exact release under test, and prove that one successful enquiry maps to one accepted intake and one non-personal success event.

### Why this should be next

Further copy, visual or interaction refinement would be built on an unreliable customer-facing baseline. Current `main` already contains most of the intended service, commercial, professional, guide and footer work. The first priority is to ensure customers receive it consistently and that the business can verify which release and which successful lead it is measuring.

### Exact scope

1. Expose a non-sensitive production release identifier, preferably a full or short Git commit SHA, through a response header, version endpoint or release annotation used by tests.
2. Audit the marketing build, deployment and cache path so all primary routes resolve from one current release.
3. Deploy and verify the approved current structures:
   - residential: three projects, three process stages, six major regions and one support disclosure;
   - custom: three constrained projects, three stages and one support disclosure;
   - commercial: three projects immediately after hero, three stages and three supporting disclosures;
   - commercial guide navigation explicitly disabled;
   - professional route live and discoverable;
   - guide details: one concise answer, one governed project, one return route, then optional depth;
   - one compact global footer on every marketing route.
4. Deploy the shared `lead_event_id` and `submissionId` fix.
5. Deploy the review-link accessible-name fix.
6. Run cache-busted production smoke tests at 430 px, 390 px and 360 px, including server-rendered markers, no-JavaScript content, Back/refresh and intercepted forms.
7. With explicit authority, complete one designated production enquiry and reconcile browser event, API response and received lead record without recording personal data in analytics notes.

### Affected pages and components

- Root marketing layout and `SiteFooter`
- Header and route-context utilities
- Residential and custom service routes
- Commercial configuration and shared SEO landing renderer
- Professional route and embedded professional form
- Guide-detail renderer and governed guide configurations
- Direct and embedded enquiry forms
- Review badge/link components
- Deployment configuration, cache rules, release evidence and production Playwright suites

### Dependencies

- Access to the production deployment platform and current marketing project configuration
- Ability to deploy current `main` or an intentionally selected release branch
- Production analytics debug access
- Explicit authority and approved details for one test enquiry
- Existing intercepted form tests and route-width matrix

### Explicit non-goals

- Redesigning the homepage or desktop system
- Rewriting service, commercial or guide copy again
- Adding new required form fields
- Replacing the current project-gallery visual direction
- Introducing a separate mobile site
- Adding a new analytics vendor
- Performing the full physical-device and assistive-technology programme inside the same phase, beyond a release smoke check

### Recommended number of PRs

**Three independently reviewable PRs.**

### Acceptance criteria

- Every tested production route exposes the same expected release identifier.
- Cache-busted and normal requests return the same approved route structure.
- Residential and custom each expose exactly three project proofs and three process stages before their final enquiry.
- Commercial exposes exactly three project proofs immediately after the hero, three process stages and no numbered guide navigation.
- Representative guide details expose the answer, one project and return route before optional supporting depth.
- The professional route is HTTP 200, visibly complete and submits professional context.
- Every marketing route renders the compact footer with phone, email and three project pathways.
- Direct contact remains neutral. Contextual routes show and submit the correct audience, source path, source component and project or product context.
- A successful production submission uses the same non-personal UUID for intake and analytics reconciliation.
- Review-link accessible names accurately represent the visible rating/count purpose.
- No route has horizontal document overflow, broken priority images, duplicate IDs or primary targets below 44 px at 430 px, 390 px or 360 px.
- No real customer enquiry is sent during routine testing. The one production test is explicitly authorised and clearly identifiable.

### Testing requirements

- Unit tests for commercial guide-navigation suppression and release identifier formatting
- Build-level tests for current route markers and global footer use
- Production HTTP and cache-busted release-identity matrix
- DOM assertions for project counts, process counts, guide first layer and footer variant
- 430 px, 390 px and 360 px screenshots for each changed page group
- No-JavaScript server-render checks
- Back, Forward and refresh checks for contextual contact routes
- Intercepted direct, residential, commercial, professional, project and product payload tests
- Accessibility-name regression tests for review links
- One authorised production submission with event, API and received-record reconciliation
- Regression checks at representative desktop widths to protect the shared responsive site

### Implementation risk

**Medium.** The page code is largely complete. Risk sits in deployment configuration, cache invalidation, production analytics and ensuring that release changes do not create route-specific stale output. The phase should not be treated as a simple content deployment.

---

# 8. Recommended next three PRs

## PR 1: Expose production release identity and fail route-parity drift

| Field | Definition |
|---|---|
| **Single user outcome** | Every public route reliably comes from one known implementation release |
| **Exact scope** | Add non-sensitive release SHA exposure; record it in production evidence; add cache-busted route checks; assert approved semantic markers for primary route groups; investigate and correct deployment or cache fragmentation |
| **Probable components or page groups** | Marketing deployment configuration, root layout or response middleware, CI/release scripts, production Playwright route matrix |
| **Dependencies** | Deployment-platform access and an intentionally selected commit |
| **Acceptance criteria** | All primary routes return one release ID; normal and cache-busted requests match; tests fail on stale service counts, old guide first layers or old footer output |
| **Tests** | HTTP header/version test, 430/390/360 route matrix, no-JavaScript marker assertions, cache-busted repeat, representative desktop smoke |
| **Non-goals** | Copy changes, visual redesign, form-field changes, project-gallery changes |
| **Effort** | Medium |
| **Risk** | Medium |

## PR 2: Ship the approved service, guide and global-footer first layers

| Field | Definition |
|---|---|
| **Single user outcome** | High-intent visitors receive the concise proof-led journey that has already been approved |
| **Exact scope** | Deploy residential and custom Phase 3 structures; deploy commercial three-case and three-stage order; set commercial `showGuideNavigation: false`; deploy professional route; deploy guide-detail first layer; enforce compact global footer |
| **Probable components or page groups** | Residential page, custom config, commercial config, `SeoLandingPage`, guide configs, professional route, root layout and `SiteFooter` |
| **Dependencies** | PR 1 release identity and corrected deployment path |
| **Acceptance criteria** | Exact project/process counts and order pass on production; guide answer/project/return precede optional depth; professional route is complete; all routes use one footer; context and analytics properties remain canonical |
| **Tests** | DOM structure and content-budget tests, screenshots at three widths, route/link crawl, no-JavaScript, disclosure and form-context tests, desktop regression |
| **Non-goals** | New copy, new guide content, desktop redesign, new components unless required to enforce existing patterns |
| **Effort** | Medium |
| **Risk** | Medium |

## PR 3: Reconcile production enquiry identity and review accessibility

| Field | Definition |
|---|---|
| **Single user outcome** | A successful enquiry is reliably acknowledged, measurable and accessible |
| **Exact scope** | Deploy the existing shared submission UUID as `lead_event_id`; deploy review accessible-name correction; preserve non-personal context; document production reconciliation procedure |
| **Probable components or page groups** | Direct contact form, embedded enquiry form, analytics utilities, review badge/link components, production test documentation |
| **Dependencies** | PR 1 release identity, production analytics debug access and explicit test-submission authority |
| **Acceptance criteria** | One successful authorised enquiry has one accepted intake and one matching success event; no success event fires on validation or API failure; no personal form values enter analytics; review names match visible purpose; success state is announced |
| **Tests** | Unit and integration tests, intercepted API and analytics tests, consent-denied checks, duplicate-submit lock, error and retry path, one authorised production reconciliation, screen-reader-name assertion |
| **Non-goals** | New fields, CRM redesign, new analytics vendor, conversion-rate claims |
| **Effort** | Small to medium |
| **Risk** | Medium because production submission and analytics access are involved |

---

# 9. Final verdict

## Selected verdict

**The direction is correct but implementation remains inconsistent.**

The programme has changed the core mobile experience in meaningful ways. It is faster to understand on the homepage, more project-led, more architectural, clearer on product fit and better at preserving enquiry context. The project collection payload work and the product/detail hierarchy are substantial improvements, not cosmetic changes.

It would be inaccurate, however, to say that all five phases have been completed successfully for customers. The attached roadmap itself marks Phase 5 as in progress. More importantly, the current production website does not consistently expose the Phase 3 and Phase 4 structures that current `main` contains. A production release can pass HTTP, overflow and CLS checks while still serving stale hierarchy, content counts and footer output. That is now the most important quality problem.

## Roadmap disposition

**Replace `mobile-ux-roadmap-v2.md` with a shorter remaining-work roadmap, while retaining v2 as the completed-programme and decision-history record.**

The replacement should contain only:

1. production parity and conversion reliability closure;
2. project-gallery controls plus physical-device and assistive-technology validation;
3. post-release performance and qualified-lead outcome monitoring.

Phases 1 and 2 should remain closed. Phase 3 and Phase 4 implementation records should be archived once parity is verified. Phase 5's remaining device, accessibility, analytics and field-performance tasks should move into the shorter roadmap with dated owners and evidence gates. The new roadmap should not reopen broad content architecture or add another redesign phase.

---

# Evidence register

## Attached brief

- `mobile-ux-roadmap-v2.md`, status and delivery updates for Phases 1 to 5
- Phase 2 product-owner update that supersedes the controlled project gallery with the native horizontal strip
- Phase 5 completion rule and blocked device, assistive-technology, analytics and release-identity tasks

## Current repository implementation

- `apps/marketing/app/layout.tsx`
- `apps/marketing/components/SiteFooter.tsx`
- `apps/marketing/components/Header.tsx`
- `apps/marketing/components/headerNavigation.ts`
- `apps/marketing/app/pergolas-auckland/page.tsx`
- `apps/marketing/app/pergolas-auckland/content.ts`
- `apps/marketing/app/custom-pergolas-auckland/content.ts`
- `apps/marketing/app/commercial-pergolas-auckland/content.ts`
- `apps/marketing/app/architects-designers-builders/content.ts`
- `apps/marketing/components/seo-landing/SeoLandingPage.tsx`
- `apps/marketing/components/seo-landing/SeoLandingBlocks.tsx`
- `apps/marketing/app/pergola-cost-auckland/content.ts`
- `apps/marketing/components/products/ProductDetailPage.tsx`
- `apps/marketing/app/projects/ProjectDetailContent.tsx`
- `apps/marketing/app/projects/ProjectGallery.tsx`
- `apps/marketing/app/projects/projects.css`
- `apps/marketing/app/contact/ContactEnquiryForm.tsx`
- `docs/mobile-ux-phase-5-validation.md`
- `artifacts/mobile-ux-phase-5/automated/route-measurements.json`
- `playwright/marketing.phase-five.spec.ts`

## Production routes directly reviewed

- Homepage
- Residential service
- Custom service
- Commercial service
- Products index
- Representative product detail
- Projects index
- Representative project detail
- Guide hub
- Representative cost guide
- Contact

## Unverified or constrained evidence

- Physical iOS Safari and Android Chrome
- VoiceOver and TalkBack
- Complete dated manual keyboard path
- Production analytics debug view
- Real production success submission and received lead record
- Exact production release identity
- Independent full visual capture at all three widths
- Direct full content verification of the professional route
