# Sanctuary Pergolas Mobile UX Roadmap v2

> **Status:** Phases 1, 2, 3 and 4 complete; Phase 5 is the recommended next phase
> **Repository:** `velt-design/sanctuary`
> **Recommended repository path:** `docs/mobile-ux-roadmap-v2.md`
> **Live website:** `https://www.sanctuarypergolas.co.nz/`
> **Reviewed implementation commit:** `0002b2e1` (`fix(marketing): canonicalize production homepage header`)
> **Review date:** 26 July 2026
> **Mobile scope:** Approximately 430 px, 390 px and 360 px
> **Implementation model:** One responsive Next.js website, one shared content source, shared React components, Tailwind styling, preserved semantic content and existing analytics
> **Primary outcome:** More qualified enquiries through a calm, project-led, reliable and easier-to-scan mobile customer journey

## 1. Status and purpose

This document supersedes `docs/mobile-ux-roadmap.md` for future implementation planning. The original roadmap should remain in the repository as historical context and as a record of the original audit, principles and completed work.

Version 2 reconciles five evidence sources:

1. The original mobile UX audit.
2. `docs/mobile-ux-roadmap.md`.
3. The mobile implementation review completed after the first implementation phases.
4. The live production website observed on 25 July 2026.
5. The current `main` implementation and Phase 1-4 evidence, most recently
   verified at `0002b2e1`.

### Evidence states

- **Verified live:** Observed on the public production website, including visible content, exposed links and current form labels.
- **Verified repository:** Confirmed in current `main`, its tests or its generated evidence.
- **Inferred:** A likely customer effect derived from the current responsive implementation where the corresponding production build is not yet live.
- **Test required:** Behaviour requiring the deployed build, a real device, browser gestures, assistive technology or production analytics.

### Production audit caveat (historical baseline)

At the time of the v2 audit, the public website did not match the reviewed
`main` implementation. Production exposed legacy `enquiry=residential` links
from commercial and product contexts, neutral project enquiries and the
`Roof direction` label. Phase 1 replaced that audited state.

Production behaviour is the customer-facing source of truth. Repository work is not classified as complete until it is deployed and verified against the live route and form matrix.

### Phase 1 delivery update - 25 July 2026

The three Phase 1 implementation checkpoints are now on `main`: canonical
enquiry routing and source context (`e74a3021`), the shared direct/embedded form
contract (`a445a5b6`) and deterministic responsive disclosures (`5ec38e07`).
The marketing deployment for `5ec38e07` completed successfully, and nine
read-only or network-intercepted production checks passed across neutral,
residential, commercial, professional, project and product journeys. The live
checks also covered canonical analytics context, refresh and browser history,
no-JavaScript access and disclosure height at 430 px, 390 px and 360 px.

The historical production findings below describe the audit baseline that
motivated Phase 1; they are not the current deployed route/form state. On
25 July 2026, the product owner marked Phase 1 complete and accepted that
real-device iOS Safari and Android Chrome journeys, plus VoiceOver and TalkBack
smoke checks, will be completed in Phase 5 / PR 14. This explicit deferral no
longer blocks Phase 2.

### Phase 2 delivery update - 25 July 2026

Both Phase 2 checkpoints are deployed from `main`: mobile collection payload
separation (`97766455`) and the accessible controlled project gallery
(`1306d502`). At 430 px, 390 px and 360 px, `/projects` no longer contains a
hidden case-study tree, gallery or detail media request. Production HTML fell
from 174,571 bytes to 84,549 bytes and the rendered DOM from 510 to 288 nodes
while all 14 project cards and the established desktop rail remained.

Project detail routes now use the shared controlled gallery below 900 px with
visible previous and next controls, an announced position, stable keyboard
focus and optional touch swipe. The established desktop editorial mosaic is
unchanged. Fourteen production smoke checks passed across collection payload,
seven responsive layouts, project browse and Back/refresh, touch navigation,
canonical enquiry context, intercepted form payload and non-personal
lower-case analytics. Automated layout-shift review recorded zero cumulative
layout shift on the collection and representative detail route at all three
target widths.

Real iOS Safari and Android Chrome Back gestures, VoiceOver and TalkBack remain
unverified on physical devices. As agreed at Phase 1 closure, those tasks
remain owned by Phase 5 / PR 14 and are not represented by Chromium emulation.

### Phase 3 delivery update - 25 July 2026

All four Phase 3 checkpoints are deployed from `main`: product-detail
consolidation (`3cadd10a`), residential simplification (`53a65628`), custom
simplification (`8f8d414c`) and product-index refinement (`f752ac8d`). The
completion contract is recorded in `e717fc57`.

All ten product details now use three purposeful disclosure groups and one
controlled gallery with one active image. At 390 px, closed first-layer copy
is 294-344 words, down from 391-471; page height is 4,524-4,785 px, down from
6,578-6,850 px. Residential and custom each use six major regions before the
final enquiry, three projects, three process stages and one compact support
disclosure. Residential's comparable expanded first layer fell from 901 to
706 words, a 21.6 percent reduction; full visible residential and custom copy
fell to 739 and 841 words respectively.

The product hub now leads with four image-led pergola forms, keeps a compact
non-horizontal comparison and treats screens, walls, lighting and heating as
secondary gateways. All ten product URLs, route metadata, evidence states and
neutral product-enquiry behavior remain.

The implementation deployment and portal status both reported success.
Seventy-nine read-only or network-intercepted production behavior checks
passed, followed by one explicit production evidence capture. The deployed
39-route/width measurement matrix recorded zero horizontal overflow, zero
layout shift and high-priority hero loading at 430 px, 390 px and 360 px.
Evidence is under `artifacts/mobile-ux-phase-3/`.

Physical iOS Safari, Android Chrome, VoiceOver and TalkBack remain explicitly
unverified and owned by Phase 5 / PR 14.

### Phase 4 delivery update - 26 July 2026

All four Phase 4 checkpoints are deployed from `main`: commercial
consolidation (`19a89302`), the professional capability journey (`acc5ac12`),
guide simplification (`bc07464a`) and the compact footer/homepage close
(`35c1ea5f`). The production evidence and completion assertions are recorded
in `eda1cc1d`.

Commercial project evidence now follows the hero, delivery uses three stages
and secondary operational detail sits in three purposeful disclosures. The
discoverable `/architects-designers-builders` route explains collaboration,
documentation, engineering interfaces and role boundaries, shows three
governed projects and submits the existing professional form contract with
canonical lower-case source context.

The guide hub shows all ten distinctions without ten repeated controls. Each
of the seven guide details now leads with one concise answer, one governed
project and a route back before one optional supporting-depth control. Every
canonical URL, authored paragraph, project record and useful internal link
remains server rendered and available without JavaScript.

The homepage now closes in seven regions with five disclosures, down from
eight and seven. Its review is integrated into the final enquiry section. The
footer has visible phone and email actions, three project-pathway links and no
viewport minimum; production height is 730 px at 430 px and 766 px at both
390 px and 360 px.

The production 36-record route/width matrix recorded HTTP 200, zero horizontal
overflow and zero measured layout shift everywhere. A completion audit then
found that one optimized build exposed the root to `usePathname()` as
`/index`, making the homepage header lose its residential audience and desktop
overlay. `0002b2e1` canonicalizes that framework alias before all shared-header
decisions. The corrected deployed root emits canonical `source_path=/`.

The current production audit covers 230 public cases outside the deliberately
unavailable internal foundation catalogue: 221 active checks pass and nine
evidence-only cases skip. Form requests were intercepted. Footer text contrast
now has a permanent computed-colour check at all three target widths; all 18
text runs pass 4.5:1 and the minimum is 7.71:1. Evidence is under
`artifacts/mobile-ux-phase-4/`.

Physical iOS Safari, Android Chrome, VoiceOver and TalkBack remain explicitly
unverified. They are Phase 5 / PR 14 work and Chromium emulation is not
presented as a substitute.

### Direction-of-travel judgement

**The responsive information architecture is coherent; real-world validation
now sets the pace.**

Production enquiry routing, project discovery, service journeys and product
decisions now follow the intended mobile pattern. Commercial, professional,
guide and lower-page utility journeys use the same evidence-first discipline.
The remaining roadmap work is physical-device, assistive-technology,
performance and production-outcome validation rather than another structural
redesign.

---

## 2. Executive summary

Phases 1-4 now give the primary and secondary customer paths a consistent production
contract. Enquiry links preserve validated non-personal source context,
projects browse without a hidden detail payload, project and product galleries
have visible accessible controls, and the main residential, custom and product
journeys ask visitors to make fewer equal-weight decisions.

The strongest current experience remains project-led discovery. Service pages
now reach three relevant cases early, use three-stage delivery explanations
and keep secondary education in one support gateway. Product pages keep
outcome, fit, one real constraint and honest evidence visible while reducing
seven disclosure choices and two repeated gallery sequences to three and one.

Phase 4 applies the same discipline to secondary journeys: commercial proof
now leads, professional visitors have a capability route, guides expose a
decision first layer and the footer is compact utility. The highest-value
remaining work is Phase 5: validate the cumulative journey on physical iOS and
Android devices, with VoiceOver and TalkBack, then reconcile performance and
analytics evidence without reopening stable page architecture.

---

## 3. Current-state verdict

| Page or journey | Current quality | Change since previous review | Main remaining problem | Priority |
|---|---|---|---|---:|
| Homepage | Strong and concise | Phase 4 reduced the close to seven regions and five disclosures, with review proof integrated into final enquiry | Physical-device and screen-reader validation remains | P2 |
| Residential service | Strong and concise | Phase 3 reduced the journey to six major regions, three projects, three stages and one support disclosure | Physical-device and screen-reader validation remains | P2 |
| Custom service | Strong and distinct | Phase 3 retained three constrained projects while reducing the journey to six regions and one support disclosure | Physical-device and screen-reader validation remains | P2 |
| Products index | Clear hierarchy | Phase 3 made four pergola forms primary and converted integrated options into two compact gateways | Physical-device validation remains | P2 |
| Product detail | Clear controlled decision | Phase 3 reduced every route to three disclosures, one controlled gallery and a neutral context-aware enquiry | Physical-device and screen-reader validation remains | P2 |
| Projects index | Strong and hardened | Phase 2 removed the hidden mobile detail tree and cut production HTML and DOM weight materially | Physical-device Back gestures remain unverified | P1 |
| Project detail | Strong controlled proof | Phase 2 added visible gallery controls, count, keyboard support and optional swipe while preserving desktop | Physical-device and screen-reader validation remains | P1 |
| Commercial | Strong and proof-led | Phase 4 puts three governed cases after the hero, uses three delivery stages and keeps operational depth optional | Physical-device and screen-reader validation remains | P1 |
| Professional pathway | Strong and source-aware | Phase 4 adds one discoverable capability route with role boundaries, documentation inputs and three governed projects | Physical-device, assistive-technology and real-file task validation remains | P1 |
| Guide hub | Clear and directly scannable | Phase 4 replaced ten repeated controls with ten visible distinctions | Physical-device reading and link-task validation remains | P2 |
| Guide detail | Decision-led with complete optional depth | Seven routes now lead with one answer, one project and one route back before supporting content | Physical-device and screen-reader validation remains | P2 |
| Contact and enquiry | Reliable and source-aware | Phase 1 deployed canonical routing, terminology, context and form parity | Real-device and assistive-technology completion remains unverified | P1 |
| Mobile navigation | Strong and source-aware | Phase 4 sends professional visitors to the capability route while retaining the established focus and scroll contract | Physical-device menu and Back-gesture validation remains | P1 |
| Footer | Compact and useful | Phase 4 removes the viewport minimum, exposes phone/email and reduces navigation to three project pathways | Physical-device target/readability validation remains | P2 |

---

## 4. Updated mobile scorecard

Scores compare the current state with the previous implementation review completed in this project. They do not invent a numerical baseline for the original pre-roadmap website.

| Metric | Current score | Evidence and reason | Trend | Highest-value next improvement |
|---|---:|---|---|---|
| First-screen impact | 8/10 | The homepage establishes bespoke fixed-roof pergolas, Auckland scope, project imagery and proof quickly | Unchanged | Remove the hero submission instruction and verify final crops on the deployed build |
| Immediate clarity | 8/10 | Category, audience and design-build responsibility are clear | Unchanged | Replace outcome-implying estimate language with a consistent project-start label |
| Premium brand perception | 8/10 | Restrained typography, specific projects, measured language and a compact utility close remain strong | Improved | Validate outdoor readability and final crops on physical devices |
| Architectural credibility | 9/10 | Dimensions, roof forms, constraints, materials and building relationships are specific | Unchanged | Retain this evidence while reducing repeated explanation around it |
| Visual storytelling | 8/10 | Projects lead home, residential, commercial and professional journeys before secondary explanation | Improved | Validate representative crops on physical devices |
| Image use | 8/10 | Product details and project details each use one controlled mobile gallery, with deliberate production crops and no repeated product inventory | Improved from 7 | Complete physical-device crop and control review |
| Copy restraint | 8/10 | Decision-led first layers now cover residential, custom, products, commercial, professional and guides while retaining complete supporting content | Improved from 7 | Validate comprehension with real-device tasks and production outcomes |
| Ease of scanning | 9/10 | Service, product and guide journeys use purposeful first layers instead of repeated equal-weight controls | Improved from 7 | Confirm screen-reader rotor and reading order on physical devices |
| Reading effort | 8/10 | Commercial visible words fell from 963 to 773 at 390 px; guide details typically fell from 936-1,315 to 572-616 | Improved from 6 | Validate task completion rather than pursue further speculative cuts |
| Section pacing | 9/10 | Project proof, product fit, commercial cases and guide answers lead before secondary depth | Improved from 7 | Confirm the sequence with physical-device tasks |
| Perceived page length | 8/10 | The homepage is seven regions, guide first layers are materially shorter and the footer is 730-766 px without a viewport minimum | Improved from 6 | Measure field Core Web Vitals and real-device scroll effort |
| Navigation usability | 8/10 | Menu focus, scroll behaviour and route-aware residential/commercial/professional destinations are stable | Improved | Validate physical Back gestures and short-viewport thumb reach |
| Pathway clarity | 9/10 | Home, service, product, commercial and professional roles now have clear destinations and evidence | Improved from 6 | Reconcile pathway events with successful enquiries |
| Project discovery | 9/10 | The one-column image-led index retains premium proof without a hidden case-study payload | Improved from 8 | Verify Back gestures and scroll restoration on physical iOS and Android devices |
| Product comprehension | 9/10 | Every product route exposes outcome, fit, one constraint, honest evidence and one controlled gallery before three optional groups | Improved from 7 | Validate the complete task on physical devices |
| CTA visibility | 8/10 | Primary actions are easy to find across the main journeys | Unchanged | Make labels and destinations as reliable as their visual prominence |
| Conversion effectiveness | 8/10 | Production commercial, project and product routes preserve validated source context and audience rules | Improved from 5 | Reconcile field analytics and successful submissions in Phase 5 |
| Trust and evidence | 9/10 | Reviews, built projects, specific facts and honest caveats remain a major strength | Unchanged | Integrate proof into decisions rather than adding more proof sections |
| Enquiry experience | 8/10 | Direct and embedded forms now share terminology, context, upload and validation contracts in production | Improved from 5 | Complete real-device and assistive-technology form tasks |
| Touch usability | 8/10 | Shared targets, menus, filters and visible gallery controls are sound in automated tests | Improved from 7 | Complete physical-device thumb and Back-gesture testing |
| Accessibility | 8/10 | Disclosures and galleries have deterministic semantics, visible controls, stable focus and no-JavaScript safeguards | Improved from 7 | Complete VoiceOver and TalkBack tasks |
| Overall mobile customer experience | 9/10 | Primary and secondary route structure is reliable in production; remaining uncertainty is real-device, assistive-technology, performance and outcome validation | Improved from 7 | Complete Phase 5 validation |

---

## 5. Copy-reduction findings

### 5.1 Measured effect of the earlier density pass

This table records the density pass that formed the Phase 3 baseline. It is
retained for provenance rather than presented as current production.

| Page group | Before | After | Recorded effect | Interpretation |
|---|---:|---:|---:|---|
| Homepage | 653 words, 8 heading regions | 653 words, 8 heading regions | No change | Deliberately left unchanged because the previous homepage work already met the main density budget |
| Residential service | 2,370 words, 15 heading regions | 1,245 words, 7 heading regions | 47.5% fewer visible words | Material improvement, but still above the desired concise service pattern |
| Custom service | 1,849 words, 13 heading regions | 1,161 words, 7 heading regions | 37.2% fewer visible words | Material improvement, with further editorial reduction still justified |
| Products index | 807 words, 8 heading regions | 741 words, 8 heading regions | Minor reduction | The full product inventory remains visible and still controls page length |
| Product details | 638 to 752 words, about 12 heading regions | 391 to 471 words, 7 heading regions | Material reduction | Good density result, but achieved through seven disclosure groups per route |
| Commercial service | 1,638 words, 12 heading regions | 962 words, 6 heading regions | 41.3% fewer visible words | Strong improvement in current `main`, subject to deployment and order refinement |
| Guide hub | 547 words, 6 heading regions | 411 words, 6 heading regions | 24.9% fewer visible words | Titles and chapter structure are clearer, but repeated per-card controls are excessive |
| Guide details | 1,360 to 1,680 words, 11 to 12 heading regions | 935 to 1,316 words, 7 to 9 heading regions | 21.7% to 31.3% fewer visible words | Useful first pass, still materially article-heavy |
| Contact | 339 words, 2 heading regions | 339 words, 2 heading regions | No change | Copy is not the main problem; route, order and form parity are |

Phase 3 then measured the deployed result against commit `84faf19a` with the
same closed mobile state:

| Phase 3 surface | Baseline -> deployed | Structural result |
|---|---:|---|
| Residential | 1,246 -> 739 full visible words; 901 -> 706 comparable expanded first-layer words | Six major regions, three projects, three stages and one support disclosure |
| Custom | 1,162 -> 841 full visible words | Six major regions, three constrained projects, three stages and one support disclosure |
| Product hub | 741 -> 600 visible words; 9,878 -> 8,505 px page height | Four primary forms, two secondary option gateways and two project examples |
| Product details, ten routes | 391-471 -> 294-344 visible words; 6,578-6,850 -> 4,524-4,785 px | Three disclosures, one controlled gallery and one active gallery image |

### 5.2 Historical page-group assessment

The assessment below is the historical planning record used to define Phases
1-4. All of its implementation actions are superseded by the dated delivery
updates above; retain the rows as baseline provenance rather than active work.

| Page group | What improved | What remains too long or complex | Must remain visible | Move to disclosure | Move to supporting pages | Remove or consolidate | Essential meaning lost? | Remaining reduction opportunity |
|---|---|---|---|---|---|---|---|---:|
| Homepage | Existing concise first screen, early project proof, one selected-work block and compact guide gateway remain intact | Seven disclosure triggers, a separate testimonial section, repeated project-start instruction and full-screen footer | Category, Auckland scope, one strong project, review proof, audience routes and primary action | One combined design-options disclosure at most | Full form, roof and accessory detail | Merge review into process or final enquiry; remove repeated hero submission instruction | No verified loss | 10 to 20% of visible lower-page content |
| Residential service | Visible words and heading regions nearly halved; project proof remains early; three large topic groups are optional | Four project cards, four opening paragraphs, five process stages, a large cost section and guide-series framing | Broad home fit, two or three projects, main suitability conditions, three-stage process, high-level investment drivers and enquiry | Roof and edge detail, full cost checklist, FAQs and less common site conditions | Detailed product comparisons, consent and technical guides | Remove the commercial project card; reduce five stages to three; shorten the opening and price grid; remove prominent `Service guide 01 of 10` framing | No verified loss | 20 to 30% of current visible copy |
| Custom service | Strong custom conditions and project evidence remain; lower support content is grouped | Four projects, four-stage process, broad site-reading material and duplicated product-guide gateways | Why custom exists, two or three constrained projects, core interfaces, process and design-review CTA | Detailed site-reading, technical boundaries and FAQs | Product-level comparisons and long guide gateways | Remove the fourth project; merge clarity and boundaries; reduce duplicated guide and product link cards | No verified loss | 20 to 30% |
| Products index | Forms remain easy to identify and secondary guide content is optional | Full screens, edge treatments, lighting and heating catalogues remain visible before proof and conversion | Four forms, concise outcome comparison, one strong built example and route to enquiry | Detailed form matrix and secondary planning guides | Full screen, lighting and heating details | Turn integrated options into compact gateways; reduce three project stories to one or two | No verified loss | 15 to 25% |
| Product details | Default layer now prioritises proposition, fit, one constraint and built evidence | Seven disclosure groups, duplicated gallery, options list, alternatives, related products, guide and FAQs | What it is, where it fits, one essential constraint, one built project, one trade-off and CTA | One combined `How it works and fit` group; one `Specification and trade-offs` group; one `Alternatives and guidance` group | Full specifications, broad FAQs and general educational content | Remove the second gallery; merge overview and definition; merge suitability groups; limit related options | There is a risk that definition and fit are now fragmented across too many closed controls | 10 to 20% visible copy, plus major interaction simplification |
| Projects index | Already concise and image-led | No material copy problem | Project image, title, location, audience and roof form | Optional filters only | None | Do not add descriptions or guide content | No | 0 to 5% |
| Project details | Core facts, brief, constraint and response remain specific; detailed material is optional | The main issue is interaction rather than copy | Project identity, facts, concise response, large images, related work and contextual CTA | Complete specification and extended narrative | General product education | Keep copy largely stable; remove only repeated project context | No verified loss | 0 to 10% |
| Commercial | Current `main` is significantly shorter and retains operational evidence | Two explanatory sections precede cases; five process stages; four project cards; production still serves older content | Commercial proposition, three cases, responsibility model, coordination evidence and brief CTA | Detailed operational risks, trade interfaces, FAQ and handover detail | Cost, product and technical guides | Put cases directly after hero; reduce process to three stages; remove repeated responsibility explanations | No verified loss in current `main` | 15 to 20% |
| Professional | No dedicated page exists | The issue is missing evidence, not excess copy | Collaboration model, responsibilities, drawings, engineering and three projects | Detailed document examples and FAQs | Product and guide detail | Do not send visitors directly from first discovery to a generic form | Not applicable | Add a concise capability page rather than more form copy |
| Guide hub | Chapter grouping and titles now scan well | Ten repeated `About this guide` controls create mechanical interaction | Chapter, guide title, short prompt and direct link | Longer description at chapter level or selectively per guide | Full article content | Replace ten repeated controls with concise one-line summaries or one chapter-level disclosure | No verified loss | 10 to 15%, primarily interaction reduction |
| Guide details | Main answers are shorter and secondary sections are grouped | Many pages still expose 935 to 1,316 words and seven to nine heading regions | The question, concise answer, one relevant project and route back to a service or enquiry | Technical caveats, examples and FAQs | Broader educational content already covered elsewhere | Remove repeated introductions and support-card sets | No verified loss identified | 20 to 30% |
| Contact | Copy remains concise and direct in current `main` | Optional technical choices precede required contact and desired outcome; live terminology is stale | Selected context, required fields, what happens next, privacy, submit and phone/email | Dimensions, form, roof, accessories, timing and files where optional | No guide content belongs in the form flow | Reorder the first layer rather than delete more copy | No | 0 to 10% |
| Footer | None | Minimum 100dvh and repeated navigation make it feel like another page | Address, phone, email, review proof, core links, social and legal | None | None | Remove the oversized conversion composition and repeated full navigation | No | 50 to 60% of the footer's mobile height |

### Copy-reduction rule added in v2

A lower visible word count is not sufficient by itself. Editorial removal and reordering must happen before disclosure is added. A page that reaches its word budget through seven to ten repeated controls is not considered complete.

For major service and product pages:

- Aim for no more than three purposeful disclosure groups before the final enquiry.
- Keep the core decision, project proof and essential caveat visible.
- Do not use a disclosure for content that should be removed, merged or moved to a more appropriate page.
- Do not hide the only explanation of what a product is or why a service route exists.

---

## 6. Completed implementation and original roadmap reconciliation

### 6.1 Work that can be removed from the active roadmap

Completion here means the defined implementation outcome exists in current `main`. A production release guardrail may still remain.

| Completed item | Original roadmap reference | Current implementation | Ongoing guardrail |
|---|---|---|---|
| Mobile density measurement system | Cross-phase validation and measurement | Route budgets, visible-word checks, heading-region checks and evidence at 430 px, 390 px and 360 px are documented and tested | Keep budgets in CI and update them only with an explicit UX reason |
| First mobile copy-density pass | Phases 5, 6 and 7 content reduction | Residential, custom, product, commercial and guide routes now use a materially shorter default mobile layer | Do not treat disclosure count as success; continue editorial consolidation where listed in v2 |
| One semantic source tree for mobile and desktop | Mobile principle and Phase 3 | Full desktop content remains in the same semantic structure and mobile concision uses responsive disclosure | Fix hydration without introducing duplicate full mobile and desktop bodies |
| Homepage broad structural consolidation | Phase 2, original PRs 4 and 5 | Eight primary regions, one selected-work block, home-first pathways, three-stage homepage process and compact guide links are established | Limit future work to targeted lower-half and footer refinement |
| Mobile project-index visual direction | Phase 4, original PR 9 | One-column large-image cards and optional filters are established | Remove hidden detail rendering and preserve image-led discovery |
| Shared mobile primitives and menu foundation | Phase 3, original PRs 6 and 8 | Shared buttons, cards, media, focus states, mobile menu focus containment, scroll locking and route configuration exist in current `main` | Deploy, verify and avoid page-specific forks |
| Narrow regressions found during the copy pass | Copy-pass implementation notes | Duplicate ID, no-JavaScript route shell, product line-clamp, SEO enquiry-type and project query-serialization issues were addressed | Keep regression tests and do not reopen broad scope |

### 6.2 Original phase status

| Original phase | Status | v2 treatment |
|---|---|---|
| Phase 1: Conversion and routing corrections | Partially implemented | Becomes v2 Phase 1. Repository foundations exist, but production parity, commercial project inference, product audience rules, form consistency and analytics remain |
| Phase 2: Homepage mobile refinement | Completed but needs refinement | Remove broad homepage restructuring from the active roadmap. Retain only lower-half and footer polish later |
| Phase 3: Shared mobile UX component system | Partially implemented | Shared foundations are established. Deterministic disclosure and project gallery adoption remain |
| Phase 4: Projects experience | Partially implemented | Index direction is complete. Hidden payload, accessible gallery, Back behaviour and production context remain |
| Phase 5: Residential and custom service pages | Partially implemented | Copy reduction is complete as a first pass. Final editorial consolidation remains in separate PRs |
| Phase 6: Product discovery and product pages | Partially implemented | Shared pages and density reduction exist. Product index hierarchy, duplicate galleries and disclosure consolidation remain |
| Phase 7: Commercial, professional and guide journeys | Partially implemented | Commercial and guides have a first reduction pass. Professional capability remains absent |
| Phase 8: Validation and optimisation | Partially implemented | Automated viewport evidence exists. Real-device, assistive-technology and production analytics validation remain |

### 6.3 Original PR status

| Original PR | Status | v2 disposition |
|---:|---|---|
| 1. Fix enquiry routing and preserve source context | Partially implemented | Replace with v2 PR 1 and require production route verification |
| 2. Align enquiry form contract, terminology and uploads | Partially implemented | Replace with v2 PR 2 |
| 3. Repair enquiry accessibility and analytics continuity | Completed but needs refinement | Retain only analytics normalisation and production verification in v2 PRs 1, 2 and 14 |
| 4. Simplify homepage structure and remove repeated content | Completed but needs refinement | Close broad scope; retain targeted polish in v2 PR 13 |
| 5. Strengthen homepage imagery and final conversion | Completed but needs refinement | Close broad scope; retain crop and final conversion verification in v2 PRs 1 and 13 |
| 6. Establish shared layout, type, CTA and card primitives | Completed successfully | Remove from active roadmap and retain as component guardrails |
| 7. Establish accessible disclosure and gallery primitives | Partially implemented | Disclosure exists but needs deterministic rendering; gallery primitive exists but project pages do not use it |
| 8. Refine mobile navigation and contextual sticky action | Completed but needs refinement | Keep navigation routing fixes; a sticky action is no longer recommended without evidence of need |
| 9. Redesign mobile project index and filters | Completed but needs refinement | Visual redesign is closed; hidden payload and Back behaviour move to v2 PR 4 |
| 10. Refine project detail hierarchy, gallery and enquiry | Partially implemented | Replace with v2 PR 5, with context deployment also covered by v2 PR 1 |
| 11. Create reusable mobile service-page pattern | Partially implemented | Existing SEO and service renderers reduce the need for a new parallel shell. Finish each live service page using shared patterns |
| 12. Migrate residential service page | Partially implemented | Replace with v2 PR 7 |
| 13. Migrate custom service page | Partially implemented | Replace with v2 PR 8 |
| 14. Refine product index and mobile comparison | Partially implemented | Replace with v2 PR 9 |
| 15. Create reusable product-detail pattern | Completed but needs refinement | Pattern exists. Consolidate it in v2 PR 6 rather than create another template |
| 16. Migrate product pages to shared pattern | Completed but needs refinement | Pages use the shared component; quality and disclosure issues remain in v2 PR 6 |
| 17. Refine commercial journey | Partially implemented | Replace with v2 PR 10 |
| 18. Create professional capability journey | Not implemented | Retain as v2 PR 11 |
| 19. Simplify guide hub and reduce guide prominence | Partially implemented | Replace with v2 PR 12 |
| 20. Complete real-device and assistive-technology validation | Partially implemented | Automated emulation exists; retain real-device work in v2 PR 14 |
| 21. Validate analytics, performance and post-release outcomes | Partially implemented | Retain production verification and measurement in v2 PR 14 |

---

## 7. Remaining defects and regressions

Priority definitions:

- **P0:** Resolve before another broad page migration or customer-facing release is treated as complete.
- **P1:** Complete in the next two bounded phases.
- **P2:** Important refinement after conversion and interaction blockers.

### 7.1 Conversion and routing

| ID | Evidence | Affected area | User consequence | Priority | Resolution |
|---|---|---|---|---:|---|
| C1 | Verified live | Global header on commercial pages | Opens a residential enquiry | P0 | Deploy the canonical route builder and add a live route matrix test |
| C2 | Verified live and repository | Commercial project header | Live route is residential; current `main` also infers residential for every path except the commercial service route | P0 | Resolve audience from project metadata or an explicit route context, not one exact pathname |
| C3 | Verified live | Project CTAs | Selected project and audience are discarded | P0 | Display and submit canonical project context |
| C4 | Verified live | Product CTAs | Selected product is discarded and the legacy residential route is used | P0 | Display and submit product context; do not force an audience unless reliable |
| C5 | Verified repository | Product pages | All product CTAs hard-code residential, including products that can be reviewed by commercial or professional visitors | P1 | Default to neutral or inherit an explicit, reliable audience source |
| C6 | Verified live and repository | Professional pathway | Current `main` can preselect professional, but the live route is not reliable and no capability page exists | P1 | Retain professional context, but place a concise capability page before enquiry |

### 7.2 Form behaviour and analytics

| ID | Evidence | Affected area | User consequence | Priority | Resolution |
|---|---|---|---|---:|---|
| F1 | Verified live | Contact form | `Roof direction` inaccurately labels roof-material choices | P0 | Deploy `Roof approach` and test the live form |
| F2 | Verified live and repository | Direct versus embedded forms | Required fields and depth vary materially by route | P1 | Define one audience-aware field contract with documented exceptions |
| F3 | Verified repository | Direct contact | Optional dimensions and product choices precede required contact and desired outcome | P1 | Put audience, location, outcome and contact first; disclose optional design detail |
| F4 | Verified live and repository | Uploads | Production refers to uploads without showing a neutral-state control; repository shows upload only after type selection | P1 | Make upload availability and instructions consistent for each audience |
| F5 | Verified repository | Contact analytics | Canonical context properties can be overwritten by title-case or `Unknown` values | P0 | Normalise event properties once and preserve lower-case canonical values |
| F6 | Test required | Production analytics | Route, form-start, validation, submit and success events have not been reconciled with production submissions | P1 | Add a production debug and reconciliation checklist after deployment |

### 7.3 Content and hierarchy

| ID | Evidence | Affected area | User consequence | Priority | Resolution |
|---|---|---|---|---:|---|
| H1 | Verified repository | Product details | Seven closed controls fragment one decision journey | P1 | Consolidate to no more than three secondary-detail groups |
| H2 | Verified repository | Guide hub | Ten repeated `About this guide` controls create interaction work without adding hierarchy | P2 | Use concise visible summaries or chapter-level disclosure |
| H3 | Verified repository | Residential and custom | More than 1,100 visible words remain on each page | P1 | Complete editorial reduction rather than adding more disclosure |
| H4 | Verified live and repository | Service pages | Service routes are presented as numbered guide entries directly after the hero | P1 | Keep guide URLs and links, but remove dominant guide-series framing from conversion service pages |
| H5 | Verified repository | Homepage | Planning content still uses several consecutive disclosure triggers | P2 | Replace with one compact visible decision snapshot and at most two optional groups |

### 7.4 Responsive components

| ID | Evidence | Affected area | User consequence | Priority | Resolution |
|---|---|---|---|---:|---|
| R1 | Verified repository | Shared `Disclosure` | Server render starts desktop-expanded, then mobile closes after hydration, creating possible layout shift and transient state change | P0 | Make the initial visual and semantic state deterministic at target widths |
| R2 | Verified repository report | Disclosures | Browser Back does not restore open state or exact reading position | P1 | Define and test predictable Back behaviour where disclosure state matters |
| R3 | Test required | Hash and no-JavaScript behaviour | Any hydration fix could regress deep links or no-JavaScript access | P0 | Preserve hash reveal, semantic content and no-JavaScript fallback in the component contract |

### 7.5 Projects

| ID | Evidence | Affected area | User consequence | Priority | Resolution |
|---|---|---|---|---:|---|
| P1 | Verified repository | `/projects` | Full selected-project detail content is rendered and hidden on mobile | P0 | Do not render the case-study payload in collection mode at mobile widths or remove priority media and expensive children before render |
| P2 | Verified live and repository | Project gallery | Swipe is the only obvious mobile method; no visible previous, next or count | P0 | Use the existing accessible controlled gallery or an equivalent shared component |
| P3 | Test required | Project filters and Back | URL-backed filters are promising, but real-device Back and scroll restoration are unverified | P1 | Run iOS Safari and Android Chrome gesture tests and preserve filter state |
| P4 | Verified live | Project enquiry | Selected project and audience are not retained in production | P0 | Covered by v2 PR 1 |

### 7.6 Products

| ID | Evidence | Affected area | User consequence | Priority | Resolution |
|---|---|---|---|---:|---|
| D1 | Verified repository | Product details | The same gallery inventory is rendered before and after built evidence | P1 | Keep one purposeful image sequence and remove the duplicate gallery |
| D2 | Verified repository | Product details | Product overview, definition, fit, constraints, specification, trade-offs and support are split across seven controls | P1 | Merge related questions into a shorter first layer and three optional groups |
| D3 | Verified repository | Products index | Secondary option inventories still dominate a large part of the page | P2 | Turn screens, lighting and heating into compact gateways after form comparison and proof |
| D4 | Verified live and repository | Product enquiry | Live source context is lost; current `main` forces residential | P0 | Covered by v2 PR 1 |

### 7.7 Service pages

| ID | Evidence | Affected area | User consequence | Priority | Resolution |
|---|---|---|---|---:|---|
| S1 | Verified repository | Residential | Four project cards, five process stages and extensive cost explanation keep the page article-like | P1 | Reduce to two or three projects, three stages and a compact investment-driver block |
| S2 | Verified repository | Custom | Four projects and duplicated guide/product gateways exceed the required custom decision journey | P1 | Keep the best three constrained examples and one compact support gateway |
| S3 | Verified live and repository | Residential and custom | The service pages remain embedded in the guide-series navigation | P1 | Separate service role from guide role while preserving semantic links and URLs |

### 7.8 Commercial and professional pathways

| ID | Evidence | Affected area | User consequence | Priority | Resolution |
|---|---|---|---|---:|---|
| CP1 | Verified live | Commercial | Production content and routing are behind current `main` | P0 | Deploy only after conversion and visual smoke tests pass |
| CP2 | Verified repository | Commercial | Cases follow two explanatory blocks and the process has five stages | P1 | Put three strong cases directly after hero and condense delivery to three stages |
| CP3 | Verified live and repository | Professional | No capability page exists | P1 | Create a concise evidence-led capability journey before enquiry |

### 7.9 Touch and accessibility

| ID | Evidence | Affected area | User consequence | Priority | Resolution |
|---|---|---|---|---:|---|
| A1 | Verified repository | Menu and shared controls | Code foundations are strong but production parity is unverified | P1 | Include production keyboard and screen-reader smoke checks |
| A2 | Verified live | Project gallery | Users who cannot or do not discover swipe have no equivalent visible control | P0 | Covered by v2 PR 5 |
| A3 | Test required | Whole journey | No documented VoiceOver, TalkBack or real-device completion evidence | P1 | Complete scripted journeys at the end of each relevant phase, not only at the end of the programme |
| A4 | Test required | Outdoor readability and crop contrast | Exact production crops and contrast at 430 px, 390 px and 360 px remain unverified | P1 | Capture deployed screenshots and real-device evidence |

### 7.10 Performance and rendering

| ID | Evidence | Affected area | User consequence | Priority | Resolution |
|---|---|---|---|---:|---|
| PF1 | Verified repository | Project index | Hidden case-study media can compete with visible listing imagery | P0 | Covered by v2 PR 4 |
| PF2 | Verified repository | Product detail | Duplicated galleries increase image requests and page length | P1 | Covered by v2 PR 6 |
| PF3 | Verified repository | Shared disclosures | Hydration state change can contribute to layout shift | P0 | Covered by v2 PR 3 |
| PF4 | Test required | Production | Core Web Vitals and image payload have not been compared before and after the copy pass on the deployed build | P1 | Include field and lab comparison in v2 PR 14 |

### 7.11 Footer and utility

| ID | Evidence | Affected area | User consequence | Priority | Resolution |
|---|---|---|---|---:|---|
| U1 | Verified repository and live | Footer | Minimum 100dvh creates another full-screen destination after long pages | P2 | Replace with a compact utility footer |
| U2 | Verified repository and live | Footer | Phone and email are not visible footer utilities | P2 | Add separated tap-to-call and email links |

---

## 8. Updated mobile experience principles

These are implementation and code-review criteria.

| Principle | Requirement |
|---|---|
| 1. Prioritise the next customer decision | Every visible section should help the visitor understand fit, inspect evidence, compare a relevant choice or take the next action |
| 2. Lead with built proof | Place projects, dimensions, constraints and design responses before extended explanation on major conversion pages |
| 3. Reduce before disclosing | Delete, merge or relocate content before adding another accordion or disclosure |
| 4. Limit disclosure density | Major service and product pages should normally use no more than three purposeful mobile disclosure groups before the final enquiry |
| 5. Keep essential orientation visible | Do not hide the only explanation of what a product is, why a route exists, or which limitation prevents a false expectation |
| 6. Preserve one clear CTA hierarchy | Normally use one primary action per section, with restrained research links and no unsupported outcome language |
| 7. Preserve source context | Audience, source path, source component, selected project and selected product must survive refresh, Back and submission |
| 8. Render responsive state deterministically | The first server-rendered and hydrated mobile presentation must not expose and then close large content regions |
| 9. Do not ship hidden mobile payload | Content removed from the mobile layout must not continue to priority-load images, video or expensive detail components |
| 10. Art-direct images for mobile | Preserve roof geometry, building junctions, support lines and material detail at 430 px, 390 px and 360 px |
| 11. Design every interaction beyond swipe | Galleries, menus, filters and disclosures must work by touch, visible controls, keyboard and assistive technology |
| 12. Use shared responsive components | Reuse the existing marketing foundation and content sources. Do not introduce parallel mobile pages or duplicate full page bodies |
| 13. Protect premium architectural restraint | Prefer fewer, larger elements, clear whitespace, measured copy and useful evidence over dense cards, badges or sales urgency |
| 14. Preserve qualification caveats | Keep a concise visible caveat where removing it could create a false expectation about feasibility, consent, structure, cost, programme or warranty |
| 15. Treat production as the release gate | A route, form or component is not complete until the deployed behaviour is verified |
| 16. Validate on real devices before broad migration continues | Complete iOS, Android and assistive-technology tasks after shared interaction phases and again before final optimisation |
| 17. Release one customer outcome per PR | Do not combine routing, broad content restructuring and shared component redesign in one pull request |

---

## 9. Updated target journeys

| Audience | Visitor questions | Required evidence | Preferred page sequence | CTA behaviour | Enquiry context | Optional information |
|---|---|---|---|---|---|---|
| Residential homeowner | What does Sanctuary build, will it suit my home, and what happens next? | Clear first screen, two or three relevant projects, fit conditions, three-stage process, investment drivers and one-team responsibility | Homepage → Projects or Residential service → Relevant project or product only where useful → Enquiry | `Start your project` or equivalent after proof and at the final section | Residential, source page, source component and selected project or product | Detailed roof forms, materials, edges, consent, FAQs and accessories |
| Complex custom residential client | Can Sanctuary resolve difficult geometry, connections, levels or restricted supports? | Three constrained projects, explicit custom conditions, consultant and engineering interfaces, clear scope process | Homepage or Residential service → Custom service → Relevant constrained project → Enquiry | `Request a design review` after built evidence | Residential audience, custom source path and selected project where present | Product comparisons, technical boundaries, detailed engineering and broad FAQs |
| Commercial client | Can Sanctuary deliver around an operating venue, stakeholders and approvals? | Three strong cases immediately after hero, responsibility model, consultant and trade coordination, staging and handover | Commercial page → Commercial project → Commercial brief | `Share a commercial brief` from hero, after cases and at final section | Commercial, source page, source component and project where present | Detailed risk examples, product choices, handover detail, FAQs and guides |
| Architect, designer or builder | Can Sanctuary collaborate clearly, document responsibilities and receive plans? | Capability summary, drawings and documentation approach, engineering interfaces, role boundaries and three representative projects | Homepage or menu → Professional capability page → Project evidence → Plans or brief enquiry | `Send plans or a project brief` after capability evidence | Professional, source page, source component and selected project where present | Product specifications, detailed tender questions and secondary guides |

Products and guides support these journeys. They should not replace audience selection or become the default first route for a visitor who already has a project brief.

---

## 10. Remaining phased roadmap

### Phase 1: Production conversion and responsive-state closure

| Field | Definition |
|---|---|
| Status | **Complete - 25 July 2026** |
| Objective | Make every deployed enquiry route accurate, every form contract understandable and every responsive disclosure stable |
| User problem solved | Visitors are misclassified, lose source context, encounter inconsistent fields or see content change state after hydration |
| Exact scope | Canonical CTA routing; commercial project audience resolution; product audience rules; context display and payload; form terminology, field order and upload parity; canonical analytics properties; deterministic disclosure rendering |
| Affected pages and components | Header, homepage CTAs, contact route and forms, embedded forms, project and product CTAs, commercial and professional entries, `enquiryContext`, analytics utilities, shared `Disclosure` and wrappers |
| Dependencies | Existing context utility, current form endpoints, current marketing foundation and deployment pipeline |
| Explicit non-goals | Service-page copy restructuring, project gallery redesign, product gallery consolidation, professional capability page, footer redesign |
| Recommended PRs | 3 |
| Implementation risk | Medium |
| User impact | Very high |
| Commercial impact | Very high |

Acceptance criteria:

- Production no longer exposes legacy `enquiry=` links from major CTAs.
- Commercial content, including commercial projects, cannot silently select residential.
- Project and product context is visible above the form and included in the payload.
- Product audience remains neutral unless explicit metadata supports a preselection.
- Direct `/contact` remains neutral.
- Direct and embedded forms use an agreed audience-aware contract.
- `Roof approach` is deployed everywhere.
- Upload instructions and controls match actual support.
- Analytics retains canonical lower-case context without personal information.
- Mobile disclosure content does not open and then close after hydration.
- Hash links, no-JavaScript access, desktop-expanded presentation and accessibility semantics remain intact.

Testing requirements:

- Unit tests for context parsing, building and audience inference.
- Integration route matrix for residential, commercial, professional, project, product and neutral contact.
- Form-payload and upload tests.
- Analytics property tests and production debug verification.
- Server-render and hydration tests at 430 px, 390 px and 360 px.
- Keyboard and screen-reader smoke tests.
- Deployed production smoke test before phase closure.

Release evidence, 25 July 2026:

- `npm run test:marketing`: 39 files and 173 tests passed.
- Repository lint, the full workspace push-time typecheck, the 64-route
  production marketing build and changed-file architecture guards passed.
- The broad marketing browser matrix recorded 235 passes and seven intentional
  evidence-capture skips. Its JavaScript-disabled timeout passed immediately
  when isolated; two existing desktop hero-scroll assertions reproduced
  serially in an untouched component and remain outside Phase 1's explicit
  unrelated-desktop non-goal.
- Nine focused production checks passed against
  `https://www.sanctuarypergolas.co.nz`, including route context, intercepted
  form payloads, canonical analytics, refresh and browser history,
  no-JavaScript access, and hydration stability at 430 px, 390 px and 360 px.
- Real iOS Safari, Android Chrome, VoiceOver and TalkBack checks remain
  unverified and are explicitly deferred to Phase 5 / PR 14. Browser emulation
  is not a substitute, but the product owner has accepted the deferral and
  marked Phase 1 complete.

### Phase 2: Project portfolio hardening

| Field | Definition |
|---|---|
| Status | **Complete - 25 July 2026** |
| Objective | Complete the premium project browse and detail loop without hidden payload or swipe-only interaction |
| User problem solved | Mobile visitors receive avoidable hidden page weight and cannot clearly control project galleries |
| Exact scope | Remove hidden detail rendering from collection mode; preserve filter URL state; implement visible gallery controls, count, keyboard and reduced-motion behaviour; verify related, previous, next, all-projects and Back routes |
| Affected pages and components | `/projects`, `ProjectsExperience`, project navigator, collection CSS, project detail template, gallery component and project route tests |
| Dependencies | Phase 1 project context and Phase 1 disclosure stability where reused |
| Explicit non-goals | Rewriting project narratives, changing project URLs, replacing photography, redesigning desktop portfolio |
| Recommended PRs | 2 |
| Implementation risk | Medium |
| User impact | Very high |
| Commercial impact | High |

Acceptance criteria:

- Mobile collection mode does not render or priority-load hidden case-study content.
- Visible project cards retain large imagery and concise metadata.
- Gallery has visible previous and next controls, position count and accessible labels.
- Swipe remains optional.
- Project context survives enquiry.
- Filter, refresh and browser Back behaviour are predictable.
- No material desktop regression.

Testing requirements:

- Network-request and payload assertions.
- Touch, keyboard, screen-reader and reduced-motion gallery tests.
- 430 px, 390 px and 360 px visual regression.
- iOS Safari and Android Chrome Back gesture tests.
- Image-request and layout-shift review.

Release evidence, 25 July 2026:

- Checkpoint commits: `97766455` removed the hidden mobile collection detail
  payload; `1306d502` adopted the controlled gallery and optional touch swipe.
- Production `/projects` HTML reduced from 174,571 to 84,549 bytes (51.6
  percent) and DOM nodes reduced from 510 to 288 (43.5 percent) at 430 px,
  390 px and 360 px. Hidden case-study text, images, gallery figures and hero
  loading all reduced to zero while 14 cards remained.
- The responsive project suite passed 28 behaviour checks with two intentional
  evidence-capture skips. The shared foundation suite passed 26 behaviour
  checks with two intentional evidence-capture skips.
- The marketing unit suite passed 40 files and 175 tests. Repository lint,
  all-workspace typecheck, the 64-route production marketing build,
  changed-file architecture checks and strict dead-code checks passed.
- The broad marketing browser matrix recorded 235 passes and nine intentional
  evidence-capture skips. Its JavaScript-disabled and product-tablet
  contention failures passed immediately in isolation. Two existing desktop
  hero-scroll assertions remained red in an untouched, explicitly out-of-scope
  component.
- Fourteen deployed production smoke checks passed, covering the canonical
  enquiry and analytics route matrix, intercepted form payloads,
  refresh/Back, collection payload and media requests, seven responsive
  project layouts, browse navigation and touch swipe.
- Production layout-shift review recorded CLS `0` on `/projects` and
  `/projects/warkworth-outdoor-room` at 430 px, 390 px and 360 px.
- Same-environment payload data and before/after screenshots are stored in
  `artifacts/mobile-ux-phase-2/`.
- Physical iOS Safari, Android Chrome, VoiceOver and TalkBack validation
  remains explicitly unverified and deferred to Phase 5 / PR 14.

### Phase 3: Editorial consolidation of service and product journeys

| Field | Definition |
|---|---|
| Status | **Complete - 25 July 2026** |
| Objective | Replace residual article structure and disclosure density with shorter audience and product decisions |
| User problem solved | Major pages are shorter than before but still require too much reading or too many disclosure choices |
| Exact scope | Final residential and custom reduction; service versus guide role separation; product-detail disclosure consolidation; duplicate gallery removal; product-index hierarchy and compact integrated-option gateways |
| Affected pages and components | `/pergolas-auckland`, `/custom-pergolas-auckland`, `/products`, all product-detail routes, shared SEO blocks, product components and compact guide gateways |
| Dependencies | Phases 1 and 2 complete; stable shared disclosure and project components |
| Explicit non-goals | Deleting guide URLs, changing product taxonomy, unsupported pricing claims, broad desktop redesign |
| Recommended PRs | 4 |
| Implementation risk | Medium |
| User impact | High |
| Commercial impact | High |

Acceptance criteria:

- Residential and custom each use no more than six major visible sections before final enquiry.
- Each service page uses two or three projects, not four.
- Service processes use three concise stages.
- Prominent numbered guide-series navigation is removed from service first layers while useful links remain.
- Product details use no more than three purposeful disclosure groups before final enquiry.
- Each product page renders one deliberate gallery sequence.
- Product index distinguishes forms within the first screens and treats integrated options as secondary.
- All context and analytics behaviour from Phase 1 remains intact.

Testing requirements:

- Content budgets and heading hierarchy.
- Visual regression at target widths and representative desktop widths.
- CTA and form-context regression.
- Accordion and keyboard tests.
- Image payload comparison.
- Internal-link checks.

Release evidence, 25 July 2026:

- Checkpoint commits: `3cadd10a` consolidated product details, `53a65628`
  simplified residential, `8f8d414c` simplified custom and `f752ac8d`
  refined the product hub. `e717fc57` added the completion contract.
- All ten product routes use three disclosure groups, one controlled gallery
  and one active gallery image. At 390 px, visible copy is 294-344 words and
  page height is 4,524-4,785 px, down from 391-471 words and
  6,578-6,850 px.
- Residential and custom each use six major regions, three projects, three
  process stages and one support disclosure. Residential's comparable
  expanded first layer reduced 21.6 percent.
- The product hub preserves all ten canonical product destinations while
  making four forms primary and integrated options secondary.
- Marketing units passed 44 files and 188 tests. Workspace typecheck, lint,
  the 64-page production build and changed-file architecture/dead-code guards
  passed.
- The optimized browser result is 240 passing non-capture checks. Seventy-nine
  deployed behavior checks and one production evidence capture then passed
  without a real enquiry submission.
- The deployed 39-record responsive matrix has zero overflow, zero measured
  layout shift and high-priority hero images at 430 px, 390 px and 360 px.
  Measurements and screenshots are in `artifacts/mobile-ux-phase-3/`.
- Physical iOS Safari, Android Chrome, VoiceOver and TalkBack remain
  explicitly unverified and deferred to Phase 5 / PR 14.

### Phase 4: Secondary audiences, guides and site utility

| Field | Definition |
|---|---|
| Status | **Complete - `eda1cc1d`** |
| Objective | Complete commercial and professional pathways, simplify guide interaction and finish lower-page utility |
| User problem solved | Secondary audiences lack a consistent evidence journey, guides remain mechanically dense and the footer adds unnecessary length |
| Exact scope | Commercial proof order and three-stage delivery; professional capability page; guide hub and guide-detail first-layer simplification; compact utility footer; targeted homepage lower-half consolidation |
| Affected pages and components | Commercial page, professional route, guide hub and detail renderer, footer, homepage planning/review/final sections and navigation labels |
| Dependencies | Phase 1 routing; Phase 2 project components; Phase 3 content rules |
| Explicit non-goals | New professional portal, deleting guides, full homepage redesign, new brand system |
| Recommended PRs | 4 |
| Implementation risk | Medium |
| User impact | High |
| Commercial impact | High |

Acceptance criteria:

- Commercial cases appear directly after hero.
- Commercial delivery is explained in three stages.
- Professional visitors see capability, role and project evidence before enquiry.
- Guide hub avoids ten repeated description controls.
- Guide detail pages expose the concise answer, one relevant project and route back before optional depth.
- Footer includes phone and email and no longer requires a full viewport.
- Homepage planning and proof remain calm, with no new guide prominence.

Testing requirements:

- Route and context tests for commercial and professional.
- Guide internal-link and semantic checks.
- Footer touch-target and contrast checks.
- Homepage and desktop regression.
- Content and analytics event checks.

Release evidence, 26 July 2026:

- Checkpoint commits: `19a89302` condensed commercial, `acc5ac12` added the
  professional capability route, `bc07464a` simplified guides and `35c1ea5f`
  refined the footer/homepage close. `eda1cc1d` added the completion contract
  and production-compatible evidence. The completion audit added
  `0002b2e1` for production root canonicalization and `88191ec2` for stable
  focus/contrast assertions.
- At 390 px, commercial visible words fell from 963 to 773 and main height
  from 11,369 px to 9,554 px. Three cases follow the hero and delivery uses
  three stages.
- `/architects-designers-builders` changed from production 404 to HTTP 200 and
  now exposes capability, three governed projects, optional supported-file
  guidance and canonical professional form/analytics context.
- Guide-hub description controls fell from ten to zero. Across the seven guide
  details, visible words fell from a 936-1,315 range to 572-616 and main height
  from 11,079-14,934 px to 7,280-7,535 px at 390 px.
- Homepage regions/disclosures fell from 8/7 to 7/5. Footer production height
  is 730 px at 430 px and 766 px at 390 px and 360 px, with `min-height: 0`.
- Marketing units passed 45 files and 204 tests. Workspace typecheck, lint,
  the 65-page production build and base/head architecture/dead-code guards
  passed.
- The completion audit covered 230 deployed public cases outside the internal
  catalogue: 221 active checks passed and nine capture-only cases skipped.
  The production-disabled internal foundation catalogue remains separately
  proven by its complete local file.
- The production 36-record matrix has HTTP 200, zero horizontal overflow and
  zero measured layout shift throughout. Screenshots and measurements are in
  `artifacts/mobile-ux-phase-4/`.
- The deployed root header emits residential `source_path=/`, retains its
  desktop overlay, and computed footer text contrast has no failure below
  4.5:1 at 430 px, 390 px or 360 px.
- Physical iOS Safari, Android Chrome, VoiceOver and TalkBack remain explicitly
  unverified and deferred to Phase 5 / PR 14.

### Phase 5: Real-device, accessibility, performance and outcome validation

| Field | Definition |
|---|---|
| Objective | Verify the cumulative mobile journey in production and create an evidence-based optimisation backlog |
| User problem solved | Emulation and code inspection cannot confirm browser gestures, assistive technology, outdoor readability or field performance |
| Exact scope | iOS and Android tasks; VoiceOver and TalkBack; keyboard; production analytics; form reconciliation; Core Web Vitals; image payload; layout shift; bounded fixes and measurement documentation |
| Affected pages and components | Header, homepage, projects, services, products, commercial, professional, guides, contact and footer |
| Dependencies | Relevant prior phases deployed with release annotations |
| Explicit non-goals | New visual direction, new analytics vendor, broad redesign based on early data |
| Recommended PRs | 2, plus isolated evidence-backed fixes |
| Implementation risk | Low to medium |
| User impact | High |
| Commercial impact | High |

Acceptance criteria:

- Primary tasks pass on representative iOS Safari and Android Chrome devices near all target widths.
- Menu, disclosures, filters, galleries and forms pass keyboard and screen-reader review.
- No horizontal overflow, obscured controls or unreadable priority crops remain.
- Production analytics events reconcile with successful submissions without personal information.
- Performance is recorded before and after relevant releases.
- Future changes are tied to observed behaviour rather than preference.

---

## 11. Recommended PR sequence

### PR 1: Close production enquiry routing and source context

Implementation status, 25 July 2026: implemented and deployed from the
canonical enquiry checkpoint on `main` (`e74a3021`). The live production matrix
confirms neutral direct contact, reliable residential/commercial/professional
selection, visible project/product context, refresh and Back continuity, and
canonical lower-case analytics properties without personal information.

| Field | Definition |
|---|---|
| Single user outcome | Every visitor reaches an enquiry that recognises the correct audience, page, project or product |
| Exact scope | Central route builder; header audience inference; project and product source context; neutral direct contact; professional and commercial preselection; canonical analytics context; route-matrix tests |
| Probable components | `lib/enquiryContext.ts`, `Header.tsx`, homepage CTAs, project detail, product hub/detail, contact route and analytics utilities |
| Dependencies | None |
| Acceptance criteria | No major CTA uses legacy `enquiry=`; commercial projects select commercial; project/product context is visible and submitted; product audience is neutral unless reliable; direct contact stays neutral; malformed context fails safely |
| Tests | Unit context tests; integration route matrix; refresh and Back; payload; analytics property assertions; deployed link smoke test |
| Non-goals | Form redesign, disclosure changes, page copy, gallery work |
| Effort | Medium |
| Risk | Medium |

### PR 2: Align enquiry form contract, terminology and uploads

Implementation status, 25 July 2026: implemented in the Phase 1 form-contract
checkpoint on `main`. Direct and embedded forms now consume one validator,
audience option set, context presentation and upload instruction contract.
Focused unit, API, browser and deployed production checks are green. Phase 1 is
complete.

| Field | Definition |
|---|---|
| Single user outcome | A visitor sees one understandable first-step brief regardless of where the enquiry begins |
| Exact scope | Agree and implement audience-aware required fields; put outcome and contact before optional technical detail; deploy `Roof approach`; align uploads and instructions; preserve accessible error and success behaviour |
| Probable components | Direct contact form, embedded residential/custom/commercial forms, shared upload and validation, submission mapping and tests |
| Dependencies | PR 1 context contract |
| Acceptance criteria | Same field means the same thing everywhere; required and optional states are explicit; upload instructions always match a control; context remains visible; phone/email business requirements are preserved |
| Tests | Valid and invalid submissions; upload success/failure; mobile keyboard; focus and screen-reader errors; 430/390/360 visual checks |
| Non-goals | CRM replacement, multi-step redesign, new qualification policy, page restructuring |
| Effort | Medium to large |
| Risk | Medium |

### PR 3: Make responsive disclosure state deterministic

Implementation status, 25 July 2026: implemented in the Phase 1 disclosure
checkpoint on `main`. Homepage, service, product, project, SEO and guide
adapters now delegate viewport state to the shared owner. Script-blocked tests
prove pre/post-hydration height parity at 430px, 390px and 360px while the
separate no-JavaScript lane remains complete. Production verification passed;
real-device and assistive-technology checks are deferred to Phase 5 / PR 14.

| Field | Definition |
|---|---|
| Single user outcome | Mobile content does not appear and collapse after the page loads |
| Exact scope | Refactor shared disclosure initial state and wrappers; preserve one semantic tree, desktop-expanded behaviour, hash reveal and no-JavaScript access; add hydration and layout-shift tests |
| Probable components | Shared `Disclosure`, homepage mobile disclosure, service, product, SEO and guide wrappers, interaction tests |
| Dependencies | None, but release after PRs 1 and 2 to keep production validation focused |
| Acceptance criteria | No open-to-closed mobile transition at target widths; no unexpected scroll movement; state and labels remain semantic; desktop content remains available; hash targets reveal correctly |
| Tests | Server-render and hydration; visual regression; keyboard; screen reader; reduced motion; no-JavaScript; hash links |
| Non-goals | Copy editing, changing which sections are disclosed, gallery work |
| Effort | Medium |
| Risk | Medium to high |

### PR 4: Remove hidden project-detail payload from collection mode

| Field | Definition |
|---|---|
| Single user outcome | The project index loads only the content a mobile visitor can see and use |
| Exact scope | Stop rendering or priority-loading selected project detail in mobile collection mode; retain desktop collection behaviour and URL filters |
| Probable components | `ProjectsExperience`, project detail boundary, collection CSS, media priority and tests |
| Dependencies | PR 3 if project filters continue to use the shared disclosure |
| Acceptance criteria | No hidden hero, gallery or video requests on mobile index; cards and filters remain unchanged; desktop detail panel still works where intended |
| Tests | Network request assertions; payload comparison; visual regression; desktop smoke test |
| Non-goals | Gallery redesign, project copy, filter taxonomy |
| Effort | Medium |
| Risk | Medium |

Implementation status, 25 July 2026: complete in `97766455`. Mobile collection
requests now receive typed project summaries and never mount the case-study
tree. A desktop-only client boundary dynamically loads the governed full
records and detail component at 900 px and above, preserving the selected
legacy query, sticky rail, filters and canonical project links. Production
network checks confirm no selected detail image or video request below the
breakpoint.

### PR 5: Complete the accessible project gallery and browse loop

| Field | Definition |
|---|---|
| Single user outcome | Visitors can inspect, navigate and leave a project without relying on swipe |
| Exact scope | Use shared controlled gallery; visible controls and count; keyboard and reduced motion; verify related, previous, next, all-projects and Back routes |
| Probable components | Project detail template, `ResponsiveGallery`, project navigation and tests |
| Dependencies | PR 1 project context and PR 4 collection separation |
| Acceptance criteria | Swipe is optional; controls are at least 44 px; position is announced; focus is stable; Back is predictable; contextual enquiry remains intact |
| Tests | Touch, keyboard, screen reader, reduced motion, target widths, browser Back |
| Non-goals | New photography, project narrative rewrite, desktop portfolio redesign |
| Effort | Medium |
| Risk | Medium |

Implementation status, 25 July 2026: complete in `1306d502`. Mobile project
details use the shared `ResponsiveGallery`, render one active image, expose
44 px previous/next controls and a polite position status, and support
Arrow/Home/End keys plus horizontal touch swipe without changing focus.
The original desktop mosaic remains the desktop presentation. Production
checks cover enquiry context, related and circular navigation, Back, refresh,
reduced motion, target widths and zero horizontal overflow.

### PR 6: Consolidate product-detail first layers and remove duplicate galleries

| Field | Definition |
|---|---|
| Status | **Complete - `3cadd10a`** |
| Single user outcome | A visitor can understand one product without opening seven separate controls or seeing the same gallery twice |
| Exact scope | Merge overview and definition; merge fit groups; combine secondary specification, trade-off and support content; remove duplicate gallery; preserve one built project and product context |
| Probable components | `ProductDetailPage`, mobile product disclosure, gallery pattern, product CSS and route fixtures |
| Dependencies | PRs 1 and 3; PR 5 gallery pattern where appropriate |
| Acceptance criteria | No more than three disclosures before final enquiry; one gallery sequence; essential fit and one constraint visible; all product routes use the same approved structure |
| Tests | Representative route per product category; disclosure, image requests, context, headings and desktop regression |
| Non-goals | Product taxonomy, pricing, new claims or photography |
| Effort | Medium to large |
| Risk | Medium |

### PR 7: Finish the residential service-page simplification

| Field | Definition |
|---|---|
| Status | **Complete - `53a65628`** |
| Single user outcome | Homeowners reach fit, proof, process and enquiry without reading a broad design article |
| Exact scope | Reduce opening copy; retain two or three projects; reduce process to three stages; compact investment drivers; remove dominant guide-series framing; keep one support gateway |
| Probable components | `/pergolas-auckland`, service disclosures, process, project grid, guide navigation and embedded form placement |
| Dependencies | PRs 1, 2, 3 and 5 |
| Acceptance criteria | No more than six visible major sections before enquiry; 20 to 30 percent further visible-copy reduction; project proof early; one early CTA and one final form; guide URLs remain reachable |
| Tests | Content budget; headings; links; form context; target widths; desktop regression |
| Non-goals | Custom page, guide rewrites, unsupported price promises |
| Effort | Medium |
| Risk | Low to medium |

### PR 8: Finish the custom service-page simplification

| Field | Definition |
|---|---|
| Status | **Complete - `8f8d414c`** |
| Single user outcome | Complex clients understand why custom is needed through evidence rather than a second long general service page |
| Exact scope | Keep three constrained projects; merge site-reading and boundaries; three-stage process; one compact support gateway; remove dominant guide-series framing |
| Probable components | `/custom-pergolas-auckland`, shared SEO blocks, disclosure groups and form placement |
| Dependencies | PRs 1, 2, 3, 5 and approved residential pattern |
| Acceptance criteria | No more than six major sections; custom conditions are distinct; duplicated residential and product education is removed or linked; context remains residential with custom source |
| Tests | Residential comparison; content budget; project links; form context; target widths |
| Non-goals | New engineering claims, professional page, product rewrite |
| Effort | Medium |
| Risk | Low to medium |

### PR 9: Refine product-index hierarchy and integrated-option gateways

| Field | Definition |
|---|---|
| Status | **Complete - `f752ac8d`** |
| Single user outcome | Visitors compare the main pergola forms first and treat accessories as secondary decisions |
| Exact scope | Preserve four form cards and compact comparison; reduce full secondary product inventories; retain one or two built projects; compact guide gateway |
| Probable components | `/products`, product cards, comparison and option chapters |
| Dependencies | PRs 1 and 3; product decisions from PR 6 |
| Acceptance criteria | Main forms are clear within first screens; integrated options do not dominate; no horizontal comparison; product CTA remains context-aware |
| Tests | 360 px layout; touch, keyboard, links, context and desktop regression |
| Non-goals | Product-detail migration, ecommerce or pricing |
| Effort | Medium |
| Risk | Medium |

### PR 10: Reorder and condense the commercial journey

| Field | Definition |
|---|---|
| Status | **Complete - `19a89302`** |
| Single user outcome | Commercial visitors see relevant proof and delivery capability before extensive operational explanation |
| Exact scope | Deploy current proposition; put three cases after hero; reduce process to three stages; consolidate responsibility and coordination; retain early and final commercial CTA |
| Probable components | Commercial config, SEO landing blocks, project cards, process and embedded form entry |
| Dependencies | PRs 1, 2, 3 and 5 |
| Acceptance criteria | Cases immediately follow hero; all CTAs are commercial; no more than six major sections; detailed risk and FAQ content remains optional |
| Tests | Route and form context; content budget; target widths; disclosure; desktop regression |
| Non-goals | Professional page, new commercial claims, CRM changes |
| Effort | Medium |
| Risk | Medium |

### PR 11: Create the professional capability journey

| Field | Definition |
|---|---|
| Status | **Complete - `acc5ac12`** |
| Single user outcome | Architects, designers and builders see clear capability and responsibilities before being asked for a brief |
| Exact scope | Create or repurpose one capability route; collaboration model; documentation; engineering interfaces; role boundaries; three projects; plans or brief CTA |
| Probable components | Professional route, navigation, project cards, enquiry context and upload entry |
| Dependencies | PRs 1, 2 and 5 |
| Acceptance criteria | Route is discoverable; evidence precedes enquiry; no unsupported service claim; professional context and supported files carry into submission |
| Tests | Navigation, context, upload, headings, screen reader and target widths |
| Non-goals | Professional portal, microsite or new document-management system |
| Effort | Medium |
| Risk | Low to medium |

### PR 12: Simplify guide hub and guide-detail first layers

| Field | Definition |
|---|---|
| Status | **Complete - `bc07464a`** |
| Single user outcome | Visitors can select a guide quickly and return to the relevant project or service without navigating repeated drawers |
| Exact scope | Replace ten per-card description controls; simplify guide-detail first layer; retain semantic article content, URLs and internal links; reduce conversion-page guide prominence |
| Probable components | Guide hub, shared SEO landing disclosure groups, guide navigation and compact gateways |
| Dependencies | PR 3 and stable service/product page roles |
| Acceptance criteria | Titles and concise distinctions remain visible; no ten-control pattern; guide details lead with answer and evidence; all URLs and useful links remain |
| Tests | Heading hierarchy; keyboard; internal-link crawl; target widths; analytics event checks |
| Non-goals | Deleting guides, full SEO audit or rewriting every article |
| Effort | Medium to large |
| Risk | Medium |

### PR 13: Replace the full-screen footer and finish homepage lower-half polish

| Field | Definition |
|---|---|
| Status | **Complete - `35c1ea5f`** |
| Single user outcome | The end of the page remains useful and calm rather than becoming another full-screen decision layer |
| Exact scope | Compact footer with phone/email; reduce repeated navigation; merge testimonial proof; reduce homepage planning disclosures where justified; retain final CTA and compact guides |
| Probable components | `SiteFooter`, homepage review, planning and final sections |
| Dependencies | PRs 1 and 3; page-group decisions stable |
| Acceptance criteria | Footer does not require 100dvh; direct contact utilities are visible; homepage remains at or below eight major regions; no duplicate full content |
| Tests | Touch targets; contrast; target widths; desktop regression; links and context |
| Non-goals | New homepage concept, brand redesign or sticky sales banner |
| Effort | Medium |
| Risk | Low to medium |

### PR 14: Complete real-device, accessibility, performance and analytics validation

| Field | Definition |
|---|---|
| Single user outcome | The deployed mobile journey works reliably on real devices and can be measured |
| Exact scope | iOS and Android tasks; VoiceOver and TalkBack; keyboard; production route and form events; Core Web Vitals; image payload; bounded fixes and documented backlog |
| Probable components | Entire primary journey, test documentation, analytics utilities and isolated fixes |
| Dependencies | Relevant prior PRs deployed with release annotations |
| Acceptance criteria | No overflow or obscured controls; all interactions accessible; submissions reconcile with events; no personal analytics data; performance regressions corrected |
| Tests | Documented device matrix; task scripts; screen readers; production analytics debug; field and lab performance |
| Non-goals | Broad redesign, new analytics vendor or causal claims from insufficient data |
| Effort | Medium |
| Risk | Low to medium |

---

## 12. Immediate next phase

### Recommended phase

**Phase 5: Real-device, accessibility, performance and outcome validation**

### Why it should be next

Phases 1-4 made enquiry routing, project proof, service/product decisions,
secondary audiences, guides and site utility reliable in production. The
remaining uncertainty cannot be closed by more Chromium emulation or structural
rewrites: it concerns real browser gestures, screen-reader operation, outdoor
readability, field performance and whether canonical events reconcile with
successful enquiries.

### Work that must be completed

1. Run defined end-to-end tasks on physical iOS Safari and Android Chrome at
   representative small and large mobile sizes.
2. Run the same primary tasks with VoiceOver and TalkBack, plus the existing
   desktop keyboard path.
3. Verify production analytics in debug tooling and reconcile canonical,
   non-personal events with intercepted tests and successful submissions.
4. Review field and lab Core Web Vitals, image payload, layout shift and
   interaction latency on the deployed primary routes.
5. Make only bounded evidence-backed fixes, rerun the affected matrix and
   document a prioritised backlog for anything that should not change now.

### Work that must wait

- Broad homepage or brand redesign.
- New analytics vendors or expanded personal tracking.
- Taxonomy, route, form-contract or content-architecture changes without
  evidence from the validation tasks.
- Causal conversion claims without enough reconciled production data.

### Recommended number of PRs

**2, plus isolated evidence-backed fixes where needed**

### Completion gate

Phases 1-4 are complete. Phase 5 can begin with PR 14. Completion requires a
dated device/assistive-technology matrix, production performance and analytics
evidence, explicit pass/fail/backlog outcomes and no claim that browser
emulation substitutes for physical-device testing.

---

## 13. Completed Phase 1 goal archive

The following PR 1-3 goal briefs are retained as the implementation record.
They are complete and are no longer the recommended next work. Phase 2 / PRs
4 and 5, Phase 3 / PRs 6-9 and Phase 4 / PRs 10-13 are also complete; continue
with Phase 5 / PR 14.

### Next PR 1: Close production enquiry routing and source context

**Single user outcome**

Every visitor reaches an enquiry that visibly recognises the audience, page, project or product that led them there.

**Exact scope**

- Consolidate all major CTA destinations through the existing canonical enquiry builder.
- Replace exact-path-only audience inference with route or content metadata that correctly recognises commercial projects.
- Preserve residential, commercial and professional context where reliable.
- Preserve canonical project and product slugs.
- Keep direct `/contact` neutral.
- Make product enquiry type neutral unless explicit metadata or a reliable entry context supports preselection.
- Normalise analytics context properties so canonical lower-case values cannot be overwritten.
- Add a production route-matrix smoke test or documented deployment check.

**Likely files and page groups**

- `apps/marketing/lib/enquiryContext.ts`
- `apps/marketing/components/Header.tsx`
- homepage CTA and pathway configuration
- `apps/marketing/app/projects/ProjectDetailContent.tsx`
- `apps/marketing/components/products/ProductsHub.tsx`
- `apps/marketing/components/products/ProductDetailPage.tsx`
- contact page and form context display
- route, form and analytics tests

**Acceptance criteria**

- No major CTA generates the legacy `enquiry=` parameter.
- A commercial service header opens commercial.
- A commercial project header and project CTA open commercial with the project retained.
- A residential project retains residential and the project.
- A product CTA retains the product and does not force residential without reliable evidence.
- Professional pathways retain professional.
- Direct `/contact` is neutral.
- Recognised context is visible and submitted.
- Unknown values fail safely.
- No name, phone, email, message or file information enters the URL or analytics.

**Tests**

- Unit tests for build, parse and audience inference.
- Integration tests for neutral, residential, commercial, professional, project and product entry routes.
- Refresh and Back tests.
- Form-payload inspection.
- Analytics property assertions.
- Deployed link checks after merge.

**Non-goals**

- Do not redesign form layout.
- Do not change required fields or upload policy.
- Do not edit page copy beyond routing labels required for accuracy.
- Do not change disclosure or gallery components.
- Do not make unrelated desktop changes.

**Effort:** Medium
**Risk:** Medium

### Next PR 2: Align enquiry form contract, terminology and uploads

**Single user outcome**

A visitor can begin with the same understandable project brief regardless of whether the form is direct or embedded.

**Exact scope**

- Confirm the minimum operational field contract with current business requirements.
- Put audience, location, desired outcome and contact details before optional technical choices.
- Align required and optional states across direct and embedded forms.
- Deploy `Roof approach` everywhere.
- Ensure upload instructions, accepted files, limits and actual controls match each audience and endpoint.
- Keep context visible above the form and in the success state.
- Preserve the current accessible error summary, field association, honeypot exclusion and focus behaviour.

**Likely files and page groups**

- `apps/marketing/app/contact/ContactEnquiryForm.tsx`
- direct contact page
- `AcrylicPergolaEnquiryForm` and embedded residential, custom and commercial consumers
- shared upload, validation and submission mapping
- form interaction and accessibility tests

**Acceptance criteria**

- The same field has the same label and meaning in every form.
- Required and optional states are visually and semantically explicit.
- Technical choices are optional and follow the useful first brief.
- Upload copy never appears without a supported control.
- Accepted types and limits match backend validation.
- Selected audience, project and product context remains visible and submitted.
- Successful and failed submissions preserve entered values and announce status correctly.

**Tests**

- Valid and invalid direct and embedded submissions.
- Upload success, rejection and no-file submission.
- Mobile input mode and autofill.
- Keyboard and screen-reader error journey.
- Visual checks at 430 px, 390 px and 360 px.
- Desktop regression for shared form components.

**Non-goals**

- Do not create a multi-step form.
- Do not change CRM or submission provider.
- Do not add new qualification questions without an operational requirement.
- Do not restructure surrounding service pages.

**Effort:** Medium to large
**Risk:** Medium

### Next PR 3: Make responsive disclosure state deterministic

**Single user outcome**

Mobile pages load in their final visible state without large content regions appearing and then collapsing.

**Exact scope**

- Refactor the shared responsive disclosure contract so the server-rendered and hydrated mobile presentation is visually stable.
- Preserve one semantic content tree.
- Preserve desktop-expanded layouts.
- Preserve native or equivalent keyboard and screen-reader state.
- Preserve hash-target reveal and no-JavaScript access.
- Preserve reduced-motion behaviour.
- Add component and representative page regression tests.

**Likely files and page groups**

- shared `Disclosure`
- homepage mobile disclosure wrapper
- residential service wrapper
- SEO landing wrapper
- product mobile wrapper
- guide-card descriptions
- interaction, hydration and visual tests

**Acceptance criteria**

- At 430 px, 390 px and 360 px, a closed disclosure does not render as open and then close.
- The page does not make an unexpected vertical jump after hydration.
- Disclosure labels and state remain understandable to assistive technology.
- Hidden content is not focusable.
- Desktop content remains visible according to the current layout contract.
- Hash links reveal and scroll to content correctly.
- No-JavaScript access is preserved.
- Existing page copy and disclosure grouping are unchanged in this PR.

**Tests**

- Server-render and hydration state.
- Layout-shift and screenshot comparison.
- Keyboard and screen-reader interaction.
- Hash navigation.
- Reduced motion.
- No-JavaScript route checks.
- Representative homepage, service, product and guide smoke tests.

**Non-goals**

- Do not reduce or rewrite page copy.
- Do not change which content groups are disclosed.
- Do not redesign project galleries.
- Do not introduce duplicate mobile and desktop page bodies.

**Effort:** Medium
**Risk:** Medium to high

---

## 14. First Codex goal

```md
# Goal: Close production enquiry routing and preserve source context

Use `docs/mobile-ux-roadmap-v2.md`, Phase 1 and PR 1, as the authoritative brief.

Inspect current `main` and the deployed site first. Implement one canonical enquiry-link contract across the global header, homepage pathways, project pages, product pages, commercial content and professional entry points.

## Scope

- Use the existing enquiry-context utility, not hand-built query strings.
- Resolve commercial project audiences from reliable route or project metadata.
- Preserve validated audience, source path, source component, project slug and product slug.
- Keep direct `/contact` neutral.
- Do not force residential on product enquiries unless reliable metadata or entry context supports it.
- Show recognised context above the form and include it in submission.
- Keep analytics properties canonical, lower-case and free of personal information.

## Acceptance criteria

- Commercial service and commercial project CTAs open commercial enquiries.
- Residential projects remain residential and professional pathways remain professional.
- Project and product context is visible and submitted.
- Direct `/contact` remains neutral.
- Unknown values fail safely.
- Refresh and browser Back remain predictable.
- No major CTA uses the legacy `enquiry=` contract.

## Tests

Add unit tests for context building, parsing and audience inference; integration tests for neutral, residential, commercial, professional, project and product routes; form-payload and analytics assertions; and responsive checks at 430 px, 390 px and 360 px.

## Non-goals

Do not redesign forms, change required fields or uploads, restructure page content, modify disclosure or gallery components, or make unrelated desktop changes.

Open one focused PR. Include the roadmap reference, actual files changed, test evidence, responsive evidence, analytics checks and explicit confirmation of non-goals.
```
