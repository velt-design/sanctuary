# Mobile Content Density Refinement

Status: current implementation record, including the 29 July 2026 major copy
reduction.

## Index

- Baseline evidence and method: [Audit method](#audit-method)
- Ownership and compatibility: [Content and consumer map](#content-and-consumer-map)
- Bounded decisions: [Bounded implementation plan](#bounded-implementation-plan)
- Measured outcome: [Implemented result](#implemented-result)
- Current reduced state: [Major copy reduction](#29-july-2026-major-copy-reduction)
- Optional-detail boundaries: [Disclosure inventory](#disclosure-inventory)
- Tests and screenshots: [Verification and evidence](#verification-and-evidence)
- Follow-on work: [Remaining risks and deliberate deferrals](#remaining-risks-and-deliberate-deferrals)

## Purpose and boundary

The original pass applied the content-density direction in
[`mobile-ux-roadmap.md`](mobile-ux-roadmap.md) to the current marketing
implementation. It is a refinement of the Phase 5-7 foundations, not a new
desktop copy programme or a substitute for the later service, product,
commercial, professional, and guide migrations.

Mobile UX Roadmap v2 Phase 3 subsequently completed the approved residential,
custom, product-detail and product-hub consolidation. Phase 4 completed the
commercial, professional, guide, footer and homepage-close work. The
historical baseline and first-pass results remain below; the dated Phase 3 and
Phase 4 follow-ups define the current production state.

The 2026-07-26 homepage promotion supersedes only the homepage measurements and
disclosure inventory in this record. The production root now uses the bounded
first-question design conversation documented in
`docs/marketing-ui-foundation.md`; disclosure measurements below remain
historical evidence for the retired homepage.

The original pass covered the homepage, residential and custom service pages,
the product hub and product pages, commercial and professional journeys, the
guide hub and guide pages, and the contact introduction. Project-index and
project-detail copy were out of scope at that time. The 29 July 2026
implementation supersedes that boundary and reduces the shared header, footer,
forms, homepage, service pages, guides, product pages and project details.

The original disclosure-led implementation had to:

- preserve one semantic content tree and the complete supporting content;
- preserve desktop copy and composition unless correcting a narrow shared
  defect. The later approved copy-reduction pass intentionally supersedes this
  copy-preservation rule while retaining responsive structure and contracts;
- keep proposition, suitability, constraints, evidence, and a next action in
  the default mobile reading path;
- use native, server-rendered, desktop-expanded disclosures for supporting
  detail rather than CSS truncation;
- preserve metadata, structured data, factual claims, internal links,
  enquiry context, and analytics contracts; and
- retain visible focus, 44px controls, reduced-motion handling, and zero
  horizontal overflow at 430px, 390px, and 360px.

## 29 July 2026 major copy reduction

The current public site uses the following shorter decision path:

- The mobile menu contains `Projects`, `Pergola options`, `Commercial` and
  `Professionals`, followed by the route-aware `Start your project` action.
  The logo owns Home and the action owns Contact, so neither is repeated in the
  menu.
- The footer opens with `Tell us about your project.` and keeps one contact
  action, phone, email, three useful pathways, review proof, warehouse, privacy
  and social links. It no longer repeats a second project-pathway heading or
  closing pitch.
- Direct and embedded forms lead with project type, suburb, brief, contact
  details and files. Dimensions, form, roof and other technical choices are
  inside one `Add optional project details` disclosure. Required fields,
  payloads, retry identity, uploads, attribution, privacy and consented
  analytics are unchanged.
- Pages that already finish with an embedded form do not add another generic
  final conversion section. The product hub plus product and project details,
  which link to rather than embed the form, keep one short final project
  action before the shared footer.
- The homepage is `design_conversation_home_v3`. It retains one closed
  question and the same governed two-project match contract, but uses shorter
  hero, choice, result, capability and process copy. Stable
  `data-design-conversation-event` names and the existing storage key remain.
- The product hub retains all ten catalogue destinations with one-line
  summaries, one governed project and one guide. Product details retain one
  fit condition, one constraint, one controlled gallery, an honest evidence
  state and exactly three concise supporting disclosures.
- Project cards use the approved short summaries. Details show one summary,
  `Brief`, one `Response`, `Facts`, `Gallery` and `Technical details`.
  Curated related projects remain; the redundant circular previous/next
  project navigation is removed.
- `/acrylic-roof-pergolas-auckland` is the only acrylic landing-page owner.
  The retired noindex v2 source now permanently redirects there in one hop and
  is absent from internal navigation and the sitemap.

The current cross-family mobile budgets in
`playwright/marketing.mobile-content-density.spec.ts` are ceilings, not copy
targets: homepage and product detail 450 words, residential/custom/commercial
and representative guide detail 650, product hub 500, guide hub and contact
350. The suite applies these budgets with disclosure bodies closed at 430px,
390px and 360px. It also requires the route-specific proposition, evidence or
constraint, one useful action, meaningful links, schema and canonical identity,
44px controls, keyboard/focus behavior, reduced motion, no horizontal overflow,
server-rendered supporting content and expanded desktop detail. Focused
homepage, header, contact, product, project, acrylic, service and guide suites
cover their complete route matrices and redirect behavior.

## Audit method

The baseline was captured against the local marketing application on
2026-07-25. Each representative route was measured after hydration at
430x932, 390x844, and 360x800. "Initially visible words" are words in rendered
`main.innerText` while optional disclosures are closed, excluding
`.visually-hidden` context supplied only to accessible names. "Major sections"
are heading-bearing content regions, including the enquiry form where present.
First-screen copy, long paragraphs, disclosure bodies, CTA positions, heading
order, duplicate IDs, and horizontal overflow were inspected separately.

Representative mobile and desktop screenshots are in
`artifacts/mobile-content-density-refinement/before/`.

### Baseline

| Family / route | Initially visible words 430 / 390 / 360 | First-screen words 430 / 390 / 360 | Major sections | Existing disclosed detail | Main finding |
| --- | ---: | ---: | ---: | ---: | --- |
| Homepage `/` | 653 / 653 / 653 | 59 / 59 / 59 | 8 | 7 disclosures; about 454 words | Already follows the roadmap's first-layer pattern; retain. |
| Residential `/pergolas-auckland` | 2,370 / 2,370 / 2,370 | 70 / 70 / 66 | 15 | FAQs only; about 324 words | About 88% of semantic copy is initially visible and supporting roof/site guidance delays the next enquiry action. |
| Custom `/custom-pergolas-auckland` | 1,849 / 1,849 / 1,849 | 75 / 75 / 65 | 13 | FAQs only; about 279 words | Site-reading, decisions, constraints, and related-resource ideas repeat before the final action. |
| Product hub `/products` | 807 / 807 / 807 | 52 / 52 / 52 | 8 | One product-support disclosure | Planning support competes with the primary product-choice path. |
| Product pages, 10 routes | 638-752 at all widths | 52-68 | 12 | 6-8 details per page | Definition, overview, fit, specification, alternatives, related products, guides, and FAQs carry similar visual weight. |
| Commercial `/commercial-pergolas-auckland` | 1,638 / 1,638 / 1,638 | 65 / 65 / 65 | 12 | FAQs only | Operational outcomes and coordination detail delay project proof; proof begins roughly 3.5 mobile screens down. |
| Guide hub `/pergola-guides` | 547 / 547 / 547 | 53 / 53 / 53 | 6 | None | All ten card descriptions are exposed; they account for about 173 words. |
| Guide pages, 7 routes | 1,360-1,680 at all widths | 67-76 | 11-12 | FAQs only | Opening guidance, decisions, constraints, related guidance, and FAQs repeat the same site-specific caution at equal weight. |
| Contact `/contact` | 339 / 339 / 339 | 40 / 42 / 40 | 2 | None | The introduction is already concise; the form action remains above the fold. |
| Professional contact journey | about 370 at all widths | 40-45 | 2 | None | Source-aware contact context is essential and no professional capability route exists yet. |

All audited routes had zero horizontal overflow at all three widths. Most
paragraphs were below 42 words; the density problem is cumulative equal-weight
sections rather than isolated paragraph length. Two pitched-product
paragraphs were approximately 64 and 62 words and need a better optional-detail
boundary rather than clipping.

Residential CTA continuity is the weakest: the hero action appears around
`y=643`, a project link around `y=7,252`, and the next enquiry action around
`y=19,060` at 390px. Custom follows the same pattern at approximately `y=662`,
`y=5,977`, and `y=15,320`. Homepage and contact actions remain appropriately
distributed.

## Content and consumer map

| Surface | Content and composition owners | Contracts that must remain stable |
| --- | --- | --- |
| Homepage | `app/_home/Homepage.tsx`, `DesignConversation.tsx`, `matching.ts`, `content.ts`, `homepage.module.css` | `data-design-conversation-event` analytics names, governed project/review evidence, enquiry references, metadata/schema and the first-question-only boundary |
| Residential | `app/pergolas-auckland/page.tsx`, route `content.ts` and CSS, shared acrylic/SEO styles | Public section anchors, guide links, project evidence, embedded enquiry attribution |
| Custom, commercial, guide detail | Thin route config plus `components/seo-landing/SeoLandingPage.tsx`, `SeoLandingBlocks.tsx`, `types.ts`, and `seo-landing.css` | Nine shared-renderer consumers, route-specific metadata/schema, claims, section IDs, related links, enquiry audience |
| Products | `data/products.ts`, `ProductsHub.tsx`, `ProductDetailPage.tsx`, `ProductCard.tsx`, `MobileProductDisclosure.tsx`, `product-pages.module.css` | Catalogue as claim/metadata/schema/sitemap truth, product slugs, project references, product enquiry context |
| Guide hub | `app/pergola-guides/page.tsx`, `pergola-guides.css`, `data/pergolaGuides.ts` | CollectionPage/ItemList/Breadcrumb schema, ten guide routes and summaries |
| Contact | `app/contact/page.tsx`, `ContactEnquiryForm.tsx`, `contactFormModel.ts`, `enquiryRoute.ts`, `contact.css` | `enquiry_type`, `source_path`, `source_component`, project/product values, `embedded_form`, attachments, attribution and consent analytics |
| Route shell | `app/template.tsx`, `components/AnimatedRouteTemplate.tsx`, `components/ScrollReset.tsx`, global route styles | One meaningful main landmark, server/no-JavaScript visibility, fragment navigation, reduced motion |

Metadata and structured data are generated independently from the visible
mobile disclosure state and will not be shortened. Meaningful links remain
rendered in the same semantic tree. Enquiry payload fields and analytics event
names are not part of the editing surface.

## Bounded implementation plan

### Remain initially visible

- Homepage and contact introduction: retain their current first layer.
- Residential/custom: hero proposition, concise suitability framing, first
  project evidence, process or delivery sequence, meaningful constraints,
  and the next enquiry action.
- Products: hero/outcome, suitability, evidence, high-value options and
  trade-offs, and enquiry action.
- Commercial: operational proposition, concise outcomes, early project proof,
  delivery process, and enquiry action.
- Guides: decision framing, the core comparison or decision tool, project
  evidence where present, process, and next action.
- Guide hub: route title, guide titles, and direct guide links.

### Become concise summaries with complete detail disclosed

- Residential: the detailed design-test/questions sequence; roof form,
  material, and open-edge guidance; specialist guides, site-dependent detail,
  and FAQs.
- Custom: site-reading detail; the decisions/clarity/boundaries sequence; and
  related guides, products, and FAQs.
- Product hub: the secondary planning-guide run.
- Product pages: definitions/specifications and the alternatives, related
  products, guide, and FAQ support run.
- Commercial: detailed operational outcomes; delivery coordination, risk, and
  FAQ support.
- Guide pages: secondary anatomy/layer detail; post-proof decisions,
  constraints, related guidance, and FAQs. Core comparison tables stay
  initially visible.
- Guide hub (historical first pass): each card's existing complete description
  behind an accessible "About this guide" disclosure without nesting controls.
  Phase 4 subsequently replaced these ten repeated controls with one useful
  visible hub summary.

Route-level grouping in the shared SEO renderer will be explicit and opt-in.
Unconfigured consumers retain their current output. Complete sections remain
in DOM order and are emitted open in server HTML; hydrated mobile behavior
closes optional groups while desktop remains visually expanded.

### Remain unchanged in the historical first pass

- Project-index and project-detail content and project records were unchanged
  until the 29 July 2026 reduction recorded above.
- Homepage and contact copy were unchanged in the first pass; their current
  compact versions are recorded above.
- Metadata, canonical URLs, schema payloads, public claims, meaningful link
  destinations, source-aware enquiry routing, payloads, and analytics names.
- Professional source context. The Phase 7 professional capability page is
  not pulled forward into this pass.

## Narrow defects included

1. Residential duplicates `id="weather-boundary"` on a section and its
   heading. Preserve the public section anchor, give the heading a unique ID,
   and point `aria-labelledby` to it.
2. Product hub and related-product summaries use CSS line clamps that visually
   remove semantic copy at 360px. Remove the clamps and rely on concise
   summaries/disclosures.
3. The client route template leaves streamed page content inside a hidden
   Next.js segment when JavaScript is disabled. Replace the client landmark
   shell with a server-rendered non-landmark wrapper while retaining a
   reduced-motion-safe entry treatment.
4. The shared SEO renderer ignores its existing `enquiryType` configuration
   and infers audience from one commercial route. Honour the configured value
   with the current residential default so present routes do not change.
5. Removing the top-level loading boundary exposes the project navigator's
   `useSearchParams` call during static generation of project-detail routes.
   Keep project content and records unchanged, but let the already
   query-owning `/projects` server route serialize its parameters for the
   navigator instead of requiring a prerender-blocking client hook.

## Compatibility risks and controls

- **Hydration and no JavaScript:** desktop-expanded disclosures must be open in
  server HTML. Mobile hydration may close them; JavaScript-disabled users must
  still see all content. Browser tests must verify both states.
- **Desktop composition:** placing complete sections in `<details>` can affect
  grid and spacing. Desktop CSS must use layout-neutral detail/body wrappers,
  and representative 1440px screenshots plus structural assertions must guard
  parity.
- **Shared renderer reach:** the SEO renderer serves nine routes. New grouping
  is optional config with unchanged defaults, and every consumer is included
  in route tests.
- **Interactive card semantics:** guide cards cannot place a disclosure inside
  a link. The title remains the direct navigation control and the separate
  summary is a 44px native disclosure with visible focus.
- **Claims and SEO:** summaries may paraphrase only existing support and cannot
  strengthen claims. Raw HTML tests retain headings, links, metadata, schema,
  and complete supporting phrases.
- **Conversion:** collapsing support must not remove the next action or alter
  enquiry query parameters. CTA continuity and parsed enquiry context are
  asserted.
- **Analytics:** stable event attributes and form analytics are not renamed.
- **Roadmap alignment:** this pass creates reusable optional-detail boundaries
  but does not introduce the Phase 7 commercial/professional architecture,
  comparison tools, filters, or project-detail PR 10.

## Verification contract

Focused automated coverage will assert:

- first-layer word/section budgets by family at 430px, 390px, and 360px;
- native disclosure roles, labels, keyboard activation, 44px targets, visible
  focus, and reduced-motion behavior;
- complete no-JavaScript/server-rendered content;
- heading hierarchy, unique IDs, CTA continuity, meaningful links, metadata,
  canonical URLs, and schema retention;
- source-aware residential, commercial, product, guide, and professional
  enquiry context;
- zero horizontal overflow at all target widths; and
- visually expanded desktop detail, stable section order, and representative
  1440px regression evidence.

## Implemented result

The first density pass produced the same measured word and section count at
430px, 390px and 360px. Counts below use the baseline audit method above; a
range represents every route in that family.

| Family | Initially visible words, before -> after | Major sections, before -> after | Result |
| --- | ---: | ---: | --- |
| Homepage | 653 -> 653 | 8 -> 8 | Deliberately unchanged; its existing seven disclosures already implement the roadmap pattern. |
| Residential | 2,370 -> 1,245 | 15 -> 7 | 47.5% fewer initially visible words and an earlier post-evidence enquiry action. |
| Custom | 1,849 -> 1,161 | 13 -> 7 | 37.2% fewer initially visible words. |
| Product hub | 807 -> 741 | 8 -> 8 | The main product-choice path stays visible; secondary planning support is optional. |
| Product details, 10 routes | 638-752 -> 391-471 | about 12 -> 7 | Evidence, primary suitability, constraint, options and next action remain visible. |
| Commercial | 1,638 -> 962 | 12 -> 6 | 41.3% fewer initially visible words while project proof stays in the first layer. |
| Guide hub | 547 -> 411 | 6 -> 6 | Guide titles and destinations stay visible; ten descriptions become optional. |
| Guide details, 7 routes | 1,360-1,680 -> 935-1,316 | 11-12 -> 7-9 | 21.7%-31.3% fewer initially visible words; comparison and decision tools remain visible. |
| Contact | 339 -> 339 | 2 -> 2 | Deliberately unchanged; the introduction and form action were already concise. |
| Professional contact journey | about 370 -> about 370 | 2 -> 2 | Deliberately unchanged; source context and attachment guidance remain essential. |

Residential's first post-proof enquiry action now appears at approximately
`y=4,944` rather than waiting until the final form around `y=9,147` at 390px.
The hero action remains in the first viewport. Product and SEO-landing actions
retain their existing destinations and form positions.

## Disclosure inventory

Every new group uses the shared native `Disclosure` contract. It is rendered
open in server HTML and without JavaScript. When scripting is enabled, shared
CSS hides the pending body at the route's governed mobile breakpoint, so the
pre-hydration box already matches the final native closed state. Hydration
resolves the same tree to closed mobile or open desktop state, where the summary
is hidden from interaction.

| Surface | Content moved into the optional mobile layer |
| --- | --- |
| Residential | One compact `service-planning-support` group for secondary planning questions, roof/edge detail and useful guide links. |
| Custom | One compact `custom-planning-support` group for site-reading depth, technical boundaries and useful guide links. |
| Product hub | No responsive disclosure. Four form cards and two text-led option gateways expose all ten destinations, followed by one project and one guide. |
| Product details | Three groups per route: `fit-and-definition` (`How it works`); `specification-and-tradeoffs` (`What to confirm`); and `related-support` (`Compare and plan`). |
| Commercial | One `commercial-planning-support` group for four common questions. Project proof, the three-stage process, consolidated capability and operating-site guidance, plus professional and cost pathways remain visible. |
| Outdoor rooms | Everyday-use detail; coordinated room decisions; planning links and FAQs. |
| Aluminium | Frame outcomes; specification detail; planning links and FAQs. |
| Gable and pitched roofs | Coordinated roof-form decisions; planning links and FAQs. |
| Cost guide | Estimate-quality detail; quote-scope checklist and FAQs. |
| Blinds | Integration detail; coordinated blind decisions; planning links and FAQs. |
| Acrylic versus louvres | Comparison method; fixed-acrylic detail; comparison links and FAQs. |
| Guide hub (historical first pass, superseded in Phase 4) | Each of the ten complete guide-card descriptions, behind a separate "About this guide" control. The guide title remains a direct link, so controls are not nested. |

The mobile summaries paraphrase only existing content. No factual claim,
project evidence record, product catalogue field, metadata field or schema
payload was rewritten.

## Preserved contracts and affected consumers

- Desktop and mobile use the same reduced semantic tree. Responsive disclosure
  bodies remain complete for their current purpose, become layout-neutral and
  stay open above their route breakpoint.
- Route metadata, canonicals, Open Graph values and structured data remain
  driven by their existing config and catalogue owners. Supporting headings
  and links remain rendered, semantic and crawlable.
- Residential, commercial and professional transitions retain validated
  `enquiry_type`, `source_path` and `source_component`. Project transitions
  also retain the governed project slug and audience. Product transitions
  retain route, component and product context while remaining audience-neutral
  until reliable entry context or the visitor's form choice supplies an
  audience. The shared SEO page honours its explicit `enquiryType`
  configuration with the prior residential default for configured service
  pages.
- Homepage analytics data attributes, consent handling, enquiry payloads,
  attachments and public routes are unchanged.
- The shared SEO renderer affects its nine configured consumers only through
  explicit, route-owned contiguous block groups. Unconfigured renderer
  consumers keep their prior output.
- The product catalogue remains the single owner for ten detail routes and
  all metadata, schema, sitemap, link and evidence consumers.
- The route template is now a server-rendered non-landmark wrapper. Removing
  the redundant top-level loading boundary prevents streamed public content
  remaining hidden when JavaScript is unavailable and preserves one
  route-owned `main` landmark. Global scroll handling now prefers a valid
  fragment target over its no-hash top reset, including targets outside a
  disclosure.
- Project routes still use the governed record, canonical slug, metadata,
  schema, gallery and enquiry context. The visible detail is reduced to the
  approved summary, brief, first response, facts, gallery and technical
  detail. Curated related work is the only end-of-story project navigation;
  the duplicate circular previous/next links are retired. Collection filters,
  refresh, browser history, sticky rail and modal navigation are unchanged.

## Verification and evidence

The focused browser contract covers all target families at 430px, 390px and
360px, representative desktop behavior at 1440px, native disclosure semantics,
keyboard activation, visible focus, minimum 44px targets, reduced motion,
heading hierarchy, unique IDs, first-layer budgets, CTA continuity, meaningful
links, metadata, schema, enquiry attribution, no horizontal overflow and
unclipped product summaries. A script-blocked lane proves pending and hydrated
mobile disclosures have the same height across service, product, guide and
project consumers and that pending hidden content cannot receive focus. The
homepage has no responsive disclosure; its focused lane verifies the radio
conversation separately. A JavaScript-disabled browser lane verifies one
visible `main`, one visible H1, complete supporting content and the next action
on representative routes.

Like-for-like 390px and 1440px screenshots for the homepage, residential,
product hub, product detail, commercial, guide hub, guide detail and contact
routes are stored in:

- `artifacts/mobile-content-density-refinement/before/`
- `artifacts/mobile-content-density-refinement/after/`

The `after/` set additionally includes scrolled `*-density-*` pairs showing
the changed mobile summaries beside the corresponding expanded desktop
content, rather than relying only on unchanged hero viewports.

The route matrices reported zero horizontal overflow at every target width.
The residential duplicate `weather-boundary` ID is corrected while preserving
the public section anchor. The shared disclosure also opens and scrolls to a
fragment target inside a mobile group, preserving the homepage's established
`#roofing-options` deep link. Product summary line clamps are removed rather
than hiding semantic copy. Repeated guide-card controls retain the concise
visible label while each accessible name includes its guide title.

Final focused results:

- production marketing build: 64 routes generated successfully, including all
  statically generated project-detail routes;
- mobile content-density Playwright lane: 9 passed;
- production Phase 1 route, payload, analytics and responsive-state smoke: 9
  passed against `https://www.sanctuarypergolas.co.nz`;
- project route-shell compatibility selection: 5 passed;
- broad marketing Playwright matrix: 235 passed and 7 intentional
  evidence-capture tests skipped; its JavaScript-disabled timeout passed when
  isolated, while two desktop hero-scroll assertions reproduced serially in an
  untouched, out-of-scope component;
- project-index cold/concurrent regression repeat: 10 passed across five
  workers;
- marketing unit suite: 39 files and 173 tests passed;
- Phase 1 form and disclosure evidence: 12 PNG files at 430px, 390px and 360px
  in `artifacts/mobile-ux-phase-1/`; and
- density-refinement evidence: 44 PNG files across before, after, mobile,
  desktop, top-of-page and scrolled-density states.

Phase 2 follow-up, 25 July 2026:

- `/projects` no longer mounts the selected case-study tree below 900px.
  Same-environment production capture records 84,549 HTML bytes and 288 DOM
  nodes after the release, down from 174,571 bytes and 510 nodes.
- Mobile project details use the shared controlled gallery with one active
  image, visible 44px controls, announced position, keyboard support and
  optional touch swipe. The desktop mosaic remains unchanged.
- Fourteen production smoke checks and a zero-CLS review passed at 430px,
  390px and 360px. Evidence is under `artifacts/mobile-ux-phase-2/`.

Phase 3 follow-up, 25 July 2026:

- Residential now records 739 full visible words and 706 comparable expanded
  first-layer words, down from 1,246 and 901. It uses six major regions,
  three projects, three process stages and one support disclosure.
- Custom now records 841 full visible words, down from 1,162, with six major
  regions, three constrained projects, three stages and one support
  disclosure.
- The product hub records 600 visible words, seven major regions and a
  deployed 8,505 px page height at 390 px. Four forms lead, integrated options
  use two compact gateways and all ten catalogue destinations remain.
- Across all ten product routes, visible copy is 294-344 words, page height is
  4,524-4,785 px, disclosures reduce from seven to three, gallery sequences
  reduce from two to one and the active gallery DOM reduces from four images
  to one.
- Marketing units passed 44 files and 188 tests. The optimized browser result
  is 240 passing non-capture checks. Seventy-nine deployed behavior checks and
  one production capture passed; form requests were intercepted.
- The deployed 39-record matrix at 430 px, 390 px and 360 px has zero
  horizontal overflow, zero measured layout shift and a high-priority hero on
  every record. Evidence is under `artifacts/mobile-ux-phase-3/`.

Phase 4 follow-up, 26 July 2026:

- Commercial now leads with three cases and three stages. At 390 px, visible
  words fell from 963 to 773 and measured main height from 11,369 px to
  9,554 px while commercial route and form context remain unchanged.
- `/architects-designers-builders` is a discoverable HTTP 200 capability route
  with role/collaboration/documentation guidance, three governed projects and
  the existing professional form/upload contract. The production baseline was
  a 404.
- The guide hub has zero repeated description controls, down from ten. Seven
  guide details lead with one answer, one governed project and a route back
  before one optional supporting-depth disclosure. Their 390 px visible-word
  range is 572-616, down from 936-1,315; measured main height is
  7,280-7,535 px, down from 11,079-14,934 px.
- The historical Phase 4 homepage fell from 8/7 regions/disclosures to 7/5.
  The production promotion later replaced that composition with the first
  design conversation, three capability pathways, three process stages and no
  responsive disclosure. Review proof and direct phone/enquiry utility remain.
- Marketing units passed 45 files and 202 tests. The full deployed public
  browser surface passed 229 checks, with 11 capture skips and 18 expected
  failures confined to the deliberately production-disabled internal
  foundation catalogue, whose complete file passed locally.
- The deployed 36-record Phase 4 matrix recorded HTTP 200, zero horizontal
  overflow and zero measured layout shift throughout. Form requests were
  intercepted. Evidence is under `artifacts/mobile-ux-phase-4/`.

Commercial structure and copy follow-up, 27 July 2026:

- The commercial route retains three governed projects and three delivery
  stages, with explicit role labels distinguishing Sanctuary-led hospitality
  design and build, consultant-led supply and installation, and architect-led
  workplace delivery.
- Five repeated middle and support sections are consolidated into one visible
  capability and operating-site section. Professional collaboration and cost
  pathways remain visible before the enquiry; only four common questions use
  the route's single responsive disclosure.
- The final first-brief checklist contains five grouped inputs. The existing
  commercial enquiry audience, source path, embedded-form component, required
  fields, payload and analytics contracts remain unchanged, with direct phone
  and email links added as an optional route-configured presentation detail.
- Verified Good Home and KiwiRail assets now give the hero, project proof and
  operating-site story distinct image roles. Project proof uses three columns
  on wide desktop, an intentional full-width third card after two intermediate
  columns, and the existing single-column mobile sequence.

Major copy-reduction follow-up, 29 July 2026:

- The cross-family contract now protects shorter page-specific H1s, one useful
  action and ceilings of 350 to 650 initially visible words at 430px, 390px and
  360px. These ceilings are regression limits, not permission to add filler.
- The shared mobile header removes duplicate Home and Contact links; the
  footer and embedded-form routes remove repeated closing pitches.
- Forms keep their first-brief fields visible and place technical choices in
  one optional disclosure without changing intake validation, attachment,
  retry, attribution or analytics behavior.
- The homepage advances to `design_conversation_home_v3`; event names,
  governed matches and closed-intent storage remain stable.
- Products keep all ten canonical routes, honest evidence states, one gallery
  and three disclosure IDs. Projects keep governed facts and media while
  removing repeated narrative and circular navigation.
- The canonical acrylic page absorbs the useful reduced content. The v2 route
  is retired through a permanent one-hop redirect rather than maintained as a
  second copy owner.

## Remaining risks and deliberate deferrals

- The earlier open-then-close disclosure risk is resolved. The server retains
  complete responsive detail for no-JavaScript access, script-capable mobile
  browsers hide pending detail before paint, and hydration establishes the
  native closed state without a measurable height jump at 430px, 390px or
  360px. Pending content is hidden and unfocusable.
- Browser Back follows the pre-existing no-hash top-reset policy and does not
  restore a previously open disclosure or exact mobile reading position. The
  fragment regression test proves the destination and route return, not
  reading-position restoration.
- Real iOS Safari, Android Chrome, VoiceOver and TalkBack journeys remain
  unverified. The product owner accepted their explicit deferral to Phase 5 /
  PR 14 when marking Phase 1 complete; automated Chromium remains supporting
  evidence rather than a substitute.
- Commercial proof ordering, the professional capability route, guide
  first-layer simplification and compact footer/homepage close are resolved.
  Future changes must preserve their evidence order, canonical audience/source
  context, complete no-JavaScript depth, distinct guide headings, the bounded
  v3 homepage and neutral direct contact.
- Product gallery duplication and residual service/product restructuring are
  resolved by Phase 3. Future changes must preserve the three-group product
  contract, one controlled gallery, service six-region budgets and the honest
  evidence states.
- Project records, facts and photography remain governed. The 29 July copy
  reduction intentionally changed their summaries and visible detail hierarchy
  while preserving the Phase 2 collection, filter and gallery interactions.
