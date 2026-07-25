# Mobile Content Density Refinement

Status: current implementation record, including Mobile UX Roadmap Phases 3
and 4 production follow-up.

## Index

- Baseline evidence and method: [Audit method](#audit-method)
- Ownership and compatibility: [Content and consumer map](#content-and-consumer-map)
- Bounded decisions: [Bounded implementation plan](#bounded-implementation-plan)
- Measured outcome: [Implemented result](#implemented-result)
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

The pass covers the homepage, residential and custom service pages, the
product hub and product pages, commercial and professional journeys, the guide
hub and guide pages, and the contact introduction. Project-index and
project-detail copy and all project records remain out of scope.

The implementation must:

- preserve one semantic content tree and the complete supporting content;
- preserve desktop copy and composition unless correcting a narrow shared
  defect;
- keep proposition, suitability, constraints, evidence, and a next action in
  the default mobile reading path;
- use native, server-rendered, desktop-expanded disclosures for supporting
  detail rather than CSS truncation;
- preserve metadata, structured data, factual claims, internal links,
  enquiry context, and analytics contracts; and
- retain visible focus, 44px controls, reduced-motion handling, and zero
  horizontal overflow at 430px, 390px, and 360px.

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
| Homepage | `app/home-v2/Homepage.tsx`, `content.ts`, `MobileDisclosure.tsx`, `home-v2.module.css` | `data-homepage-event` analytics names, project/review evidence, enquiry links, metadata/schema |
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

### Remain unchanged

- Project-index and project-detail content and project records.
- Homepage and contact copy unless a narrowly shared accessibility correction
  requires a change.
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
| Product hub | The compact four-form comparison and one planning-guide group. Integrated options are direct secondary gateways, not disclosures. |
| Product details | Three groups per route: `fit-and-definition`; `specification-and-tradeoffs`; and `related-support`. |
| Commercial | Three groups: detailed operational outcomes; decisions, circulation and coordination risks; planning links and FAQs. |
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

- Desktop retains the complete copy and established section order from the
  same semantic tree. Responsive disclosure wrappers become layout-neutral
  and stay open above their route breakpoint.
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
- Project copy, records, links and filter behavior remain unchanged. As a
  build-compatibility adapter, the `/projects` route now passes its serialized
  query parameters through `ProjectsExperience` to `ProjectNavigator`.
  Existing filter, refresh, browser-history, sticky-rail and modal-navigation
  checks cover that bounded consumer.

## Verification and evidence

The focused browser contract covers all target families at 430px, 390px and
360px, representative desktop behavior at 1440px, native disclosure semantics,
keyboard activation, visible focus, minimum 44px targets, reduced motion,
heading hierarchy, unique IDs, first-layer budgets, CTA continuity, meaningful
links, metadata, schema, enquiry attribution, no horizontal overflow and
unclipped product summaries. A script-blocked lane proves pending and hydrated
mobile disclosures have the same height across homepage, service, product,
guide and project consumers and that pending hidden content cannot receive
focus. A separate JavaScript-disabled browser lane verifies one visible `main`,
one visible H1, complete open disclosure content and the next action on
representative routes.

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
- Homepage regions/disclosures fell from 8/7 to 7/5. Review proof now shares
  the final enquiry close. Footer height is 730 px at 430 px and 766 px at
  390 px and 360 px, with visible phone/email utility and no viewport minimum.
- Marketing units passed 45 files and 202 tests. The full deployed public
  browser surface passed 229 checks, with 11 capture skips and 18 expected
  failures confined to the deliberately production-disabled internal
  foundation catalogue, whose complete file passed locally.
- The deployed 36-record Phase 4 matrix recorded HTTP 200, zero horizontal
  overflow and zero measured layout shift throughout. Form requests were
  intercepted. Evidence is under `artifacts/mobile-ux-phase-4/`.

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
  first-layer simplification and compact footer/homepage close are resolved by
  Phase 4. Future changes must preserve their evidence order, canonical
  audience/source context, complete no-JavaScript depth, distinct guide
  headings, seven-region homepage and neutral direct contact.
- Product gallery duplication and residual service/product restructuring are
  resolved by Phase 3. Future changes must preserve the three-group product
  contract, one controlled gallery, service six-region budgets and the honest
  evidence states.
- Project-index and project-detail copy, records, photography and desktop
  composition remain deliberately untouched; Phase 2 changed payload and
  mobile gallery interaction only.
