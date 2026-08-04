# Sanctuary Pergolas Guide Ecosystem Implementation Roadmap

**Status:** Active implementation programme; major copy reduction and G27
variant consolidation complete
**Prepared:** 24 July 2026  
**Repository:** `velt-design/sanctuary`  
**Current repository path:** `docs/landing-pages/sanctuary-pergola-guide-ecosystem-roadmap.md`
**Primary implementation surface:** `apps/marketing`, related marketing tests, and guide governance documents

## Roadmap authority and use

This document is the implementation authority for restructuring the Sanctuary Pergolas guide ecosystem. It is intentionally standalone. An agent should be able to begin any goal below without needing the original external audit.

Read these sources before implementation:

1. `AGENTS.md`
2. This roadmap
3. `docs/Sanctuary_Pergolas_AI_Copywriting_Context_Pack.md`
4. `docs/marketing-claims-register.md`
5. `docs/testing-and-qa.md`
6. The current source and focused tests for the goal
7. `docs/landing-pages/pergola-guide-cluster-improvement.md`
8. `docs/landing-pages/pergola-guide-cluster-completion-audit.md`
9. `docs/landing-pages/seo-landing-page-programme.md`

Authority order:

- `docs/marketing-claims-register.md` governs whether a public claim may be made.
- An Approved entry in that register is sufficient publication authority for
  its recorded wording and scope. The approval may be based on explicit
  Sanctuary business approval, including a supplier statement, without the
  underlying source document being stored in the repository.
- `docs/Sanctuary_Pergolas_AI_Copywriting_Context_Pack.md` governs brand positioning, terminology, tone, customer language, and copy boundaries.
- This roadmap governs target information architecture, guide visibility, implementation order, and pull-request scope.
- Current code and tests define the implementation baseline that must be changed safely.
- The earlier guide-cluster improvement, completion-audit, and SEO-programme documents remain useful implementation history. Their assumption that all ten programme pages belong in the public guide directory is superseded by this roadmap.

### 29 July 2026 implementation checkpoint

The approved major copy-reduction pass changed presentation density without
changing the roadmap's unresolved guide-classification goals:

- homepage tracking is now `design_conversation_home_v3`;
- the mobile header, footer and enquiry forms use the compact shared contracts;
- service and guide pages that end in an embedded form no longer repeat a
  generic final CTA below it;
- the guide hub and retained guide pages use shorter, decision-led copy while
  the current ten-route directory model remains in place until its dedicated
  classification goals are implemented;
- product and project surfaces use the reduced decision paths recorded in
  `docs/mobile-content-density-refinement.md`; and
- G27 is complete: `/acrylic-roof-pergolas-auckland` is the sole canonical
  content owner and `/acrylic-roof-pergolas-auckland-v2` permanently redirects
  there in one hop.

This checkpoint does not mark G04 through G23 complete and does not approve the
optional form or consent guides. Claims and evidence gates below remain active.

### 2 August 2026 homepage-owner checkpoint

The approved project-led visual finder now owns the production `/` route at
`apps/marketing/app/_home-project-finder/**`, with its regression contract in
`playwright/marketing.home-project-finder.spec.ts`. The former
`apps/marketing/app/_home/**` owner and `playwright/marketing.homepage.spec.ts`
are retired. G22 remains not started, but its executable prompt and file list
below are suspended: re-scope G22 against the current finder journey and obtain
approval for that revised placement before implementation. Do not recreate the
deleted homepage tree or use its historical event contract.

### 3 August 2026 Simple cover conversion checkpoint

The production homepage Simple cover result now continues to
`/simple-pergolas-auckland`. This is an intentionally separate, noindex
conversion page, not a new guide or a duplicate acrylic content owner. It is
self-canonical, excluded from the sitemap and built around solution fit,
the Sanctuary standard, optional side blinds, honest limitations, governed
reviews and a low-friction initial-estimate enquiry. It intentionally avoids
project detours and extended research copy. The legacy no-JavaScript homepage path
and the noindex `/home-guided` experiment use the same destination. The existing
`/acrylic-roof-pergolas-auckland` route remains the sole indexable acrylic SEO
owner and is unchanged by this checkpoint. The new route uses only approved
general claims and product-fit limits and preserves the existing
consent and enquiry-attribution contracts.

## Operating protocol for coding agents

For every goal:

1. Run `git status --short` before editing.
2. Read `AGENTS.md`, this roadmap, the governing copy and claims files, and the smallest relevant source and test files.
3. Work only on the named goal. Do not begin later roadmap goals in the same pull request.
4. Preserve unrelated user changes and dirty-worktree work.
5. Keep the public URL, canonical, robots directive, and sitemap entry unchanged unless the goal explicitly says otherwise.
6. Do not publish an unsupported claim because it appears in an old project record, quotation, brochure, hidden test fixture, or internal note.
7. Keep customer-facing copy in New Zealand English and use no em dashes.
8. Add or update focused tests in the same pull request as the behaviour change.
9. Run the narrowest relevant checks while iterating, then the stated handoff checks.
10. Run `npm run architecture:changed` before handoff for non-trivial code changes.
11. Update this roadmap goal status and add the pull-request reference when the document is present in the repository.
12. Stop at the decision gate when evidence or approval is missing. Apply the documented safe fallback rather than guessing.

---

## 1. Current-state summary

### Central problem

The individual pages are generally substantial and technically well implemented, but the current public guide hub treats all ten SEO-programme pages as equal members of one numbered guide sequence. That combines four different page jobs:

- customer planning guides
- broad and specialist service pages
- material and form pages close to product intent
- commercial or comparison landing pages

The result is page-role confusion rather than a lack of content. The hub currently behaves like a polished directory for the SEO programme, not a tightly curated planning library.

### Current implementation coupling

The current architecture couples several decisions that must become independent:

- `apps/marketing/data/pergolaGuides.ts` combines page role, public guide membership, hub order, labels, chapter membership, and the linear sequence.
- `apps/marketing/components/seo-landing/PergolaGuideNavigation.tsx` derives previous, next, and "X of 10" from that array.
- `apps/marketing/components/seo-landing/SeoLandingPage.tsx` uses the same membership lookup for collection breadcrumbs, `isPartOf`, and Service schema.
- `apps/marketing/app/pergola-guides/page.tsx` builds the visible cards and `ItemList` from the same ten-page list.
- `playwright/marketing.guide-hub.spec.ts`, `playwright/marketing.seo-programme.spec.ts`, and `playwright/marketing.guide-cluster-final-refinement.spec.ts` encode the ten-page directory and linear progression as expected behaviour.

The sitemap and robots configuration are already separate. Removing a page from the hub therefore does not require removing its URL, canonical, indexation, or sitemap entry.

### Target page classification

| Route | Target role | Guide visibility |
| --- | --- | --- |
| `/outdoor-rooms-auckland` | Use-led planning guide with a genuine service pathway | Core |
| `/pergola-cost-auckland` | Cost and quote-comparison guide | Core |
| `/acrylic-pergolas-vs-louvre-roofs` | Roof-behaviour comparison guide | Core |
| `/pergolas-with-blinds` | Enclosure and changing-edge guide | Core |
| `/gable-pergolas-auckland` | Detailed form guide | Secondary |
| `/pitched-pergolas-auckland` | Detailed form guide | Secondary |
| `/aluminium-pergolas-auckland` | Material and frame guide | Secondary |
| `/commercial-pergolas-auckland` | Commercial planning and service resource | Secondary |
| `/pergolas-auckland` | Primary residential pergola service page | None |
| `/custom-pergolas-auckland` | Specialist custom and complex-project service page | None |

The fixed-acrylic page, product routes, project routes, homepage, and contact page remain outside the guide library.

### Main factual and claims risks

The active claims register correctly blocks unsupported pricing, lead-time, warranty, heat, ultraviolet, waterproofing, wind, span, coastal, maintenance, and consent claims. The remaining risk is mainly contextual language and project evidence:

- project narratives can still imply broad weather, daylight, glare, or comfort outcomes
- the KiwiRail record states a 30.0 m by 3.0 m plan and a 115 m2 total area without an approved explanation
- exact product, control, accessory, engineering, and trade details may appear stronger than the approved project evidence
- the current browser claim test relies heavily on a fixed list of phrases and can miss unsupported synonyms or assertive context

### Intended final hierarchy

Immediate public library:

1. Getting started: Outdoor Rooms
2. Cost and project definition: Pergola Cost
3. Choosing the roof approach: Acrylic Pergolas vs Louvre Roofs
4. Blinds and enclosure: Pergolas With Blinds
5. Choosing a specific form: Gable and Pitched
6. Materials and complex projects: Aluminium and Commercial

Optional mature additions:

- Choosing the right pergola form, comparing pitched, gable, hip, and box-perimeter forms
- Pergola consent and site constraints in Auckland, only after legal and technical approval

---

## 2. Target end state

### Guide hub

`/pergola-guides` remains the self-canonical, indexable CollectionPage for the curated library.

Immediate state:

- four prominent core guides
- four lower-prominence secondary guides
- a separate service pathway for `/pergolas-auckland` and `/custom-pergolas-auckland`
- no global "10 guides", "3 chapters", or numbered programme sequence
- `ItemList` contains the eight actual guide-library members only
- metadata describes planning decisions, not a content count

Mature state after optional approved additions:

- six core guides
- four secondary guides
- the same two service pathways outside the ItemList

### Core guides

Core guides answer high-value customer planning questions and receive the strongest hub card treatment:

- `/outdoor-rooms-auckland`
- `/pergola-cost-auckland`
- `/acrylic-pergolas-vs-louvre-roofs`
- `/pergolas-with-blinds`
- optional `/pergola-forms-auckland`
- optional `/pergola-consent-auckland`

### Secondary guides

Secondary guides remain discoverable but do not compete equally with the first planning decisions:

- `/gable-pergolas-auckland`
- `/pitched-pergolas-auckland`
- `/aluminium-pergolas-auckland`
- `/commercial-pergolas-auckland`

### Service pages

`/pergolas-auckland` and `/custom-pergolas-auckland` remain:

- indexable
- self-canonical
- in the sitemap
- eligible for Service schema
- prominent from the homepage and relevant guide pathways
- separate URLs with distinct search and conversion roles

They must not display guide numbering, previous or next guide navigation, or collection breadcrumbs.

### Product pages

Product pages continue to own:

- current product and configuration presentation
- exact available options
- product-specific specification
- current supplier or manufacturer evidence
- maintenance and warranty documents for the selected product
- product alternatives and related products

A product page may link to one primary planning guide, but it must not duplicate the full guide narrative.

### Project pages

Project pages continue to own:

- one completed project brief
- the measured constraint
- the project-specific design response
- verified facts and materials
- relevant images

Each project should link to one useful guide and one product or service destination through an explicit mapping. Project evidence must not be presented as a universal result.

### Contact pathways

The existing enquiry API, upload flow, UTM attribution, page attribution, consent behaviour, and conversion events remain intact.

Target improvements:

- guide and project CTAs use the most relevant residential, commercial, or professional contact state
- the commercial page may preselect Commercial while keeping the field editable
- hub and guide-link events are tracked only after analytics consent
- no personally identifiable information is added to analytics events

### Metadata, canonical, robots, and sitemap

For all existing public routes:

- preserve the current URL
- preserve self-referencing canonicals
- preserve index, follow
- preserve sitemap inclusion
- preserve direct 200 responses

Removing a service page from the guide hub must not alter any of those behaviours.

The approved redirect is now implemented:
`/acrylic-roof-pergolas-auckland-v2` permanently redirects in one hop to
`/acrylic-roof-pergolas-auckland`. The primary route remains self-canonical,
indexable and in the sitemap; the retired variant is not a content or sitemap
member.

### Schema

Target schema ownership:

| Route type | Schema |
| --- | --- |
| Guide hub | `CollectionPage`, guide-only `ItemList`, `BreadcrumbList` |
| Editorial guide | `WebPage`, `BreadcrumbList`, `isPartOf` guide collection |
| Guide that also represents a real service | `WebPage`, `Service`, `BreadcrumbList`, `isPartOf` guide collection |
| Service page outside the hub | `WebPage`, `Service`, service-oriented `BreadcrumbList`, no guide `isPartOf` |
| Product page | Existing `Product` and product breadcrumbs |
| Project collection and detail | Existing collection or `WebPage` and project breadcrumbs |
| Contact | Existing page schema and conversion behaviour |

Service schema is independent from guide visibility.

### Internal links

Target progression:

```text
Homepage
  -> guide hub
      -> core guide
          -> related decision guide
          -> relevant product
          -> relevant project
          -> service page
          -> contact
      -> secondary guide
          -> core decision owner
          -> relevant product
          -> relevant project
          -> service or contact

Homepage
  -> service page
      -> relevant guide
      -> product
      -> project
      -> contact

Product page
  -> one primary planning guide
  -> alternatives
  -> project proof
  -> contact

Project page
  -> one guide
  -> one product or service destination
  -> related projects
  -> contact
```

There is no global previous or next sequence.

### Mobile presentation

The guide hub should show useful choices earlier:

- combined hero treatment of roughly one viewport or less
- no three-panel chapter navigation before the first guide
- core guides first
- secondary guides in compact rows or disclosures
- service pathways visually separate
- minimum 44 pixel interactive targets
- no horizontal overflow
- no nested vertical content scroller
- concise card descriptions

### Analytics attribution

Preserve the current enquiry payload fields, including `page`, `source`, UTM values, and browser attribution.

Add consent-gated interaction events with stable fields:

- source path
- destination path
- guide tier
- guide topic or route
- interaction type
- viewport category

Do not set success targets until a baseline exists.

### URLs that remain unchanged

The following existing URLs remain unchanged throughout required phases:

- `/pergola-guides`
- `/pergolas-auckland`
- `/custom-pergolas-auckland`
- `/outdoor-rooms-auckland`
- `/commercial-pergolas-auckland`
- `/aluminium-pergolas-auckland`
- `/gable-pergolas-auckland`
- `/pitched-pergolas-auckland`
- `/pergola-cost-auckland`
- `/pergolas-with-blinds`
- `/acrylic-pergolas-vs-louvre-roofs`
- `/acrylic-roof-pergolas-auckland`
- `/products` and all current product routes
- `/projects` and all current project routes
- `/contact`

`/acrylic-roof-pergolas-auckland-v2` is retired through the approved permanent
redirect to the primary route. Direct redirect tests run with automatic
redirect following disabled.

---

## 3. Phased roadmap

### Phase 1 - Factual and claims corrections

**Objective:** Make project evidence and public claims safe before any information-architecture change reuses them more widely.

**Why this phase comes first:** The guide hub, guide cards, product pages, and project pages all reuse typed project records. Restructuring first would spread unresolved wording and project facts through a cleaner but less trustworthy system.

**Dependencies:** None. Business evidence may improve the result, but the safe fallback is to remove or qualify the unsupported statement.

**Likely files and components:**

- `apps/marketing/data/projects.ts`
- `apps/marketing/data/projects.claims.test.ts`
- `apps/marketing/app/projects/projectPresentation.ts`
- `playwright/marketing.projects.spec.ts`
- `playwright/marketing.guide-cluster-final-refinement.spec.ts`
- `playwright/marketing.seo-copy-hygiene.spec.ts`
- `docs/marketing-claims-register.md`

**Pages affected:** Project pages and any guide, product, or homepage module that renders their data.

**Included:**

- project narrative qualification
- unresolved fact quarantine
- stronger claim-regression rules
- evidence and limitation documentation

**Excluded:**

- guide-hub redesign
- page reclassification
- new public price, warranty, timing, performance, or consent claims
- project-page visual redesign

**Expected customer outcome:** Project evidence is more credible and less likely to imply a universal result.

**Expected SEO outcome:** Existing URLs and indexation remain stable while risky snippet language is corrected.

**Primary risks:** Over-correcting useful design description, removing a verified project fact without checking the current record, or creating broad regex rules that flag customer questions and qualified warnings.

**Validation required:** Project unit tests, project Playwright tests, rendered sitemap claim scan, metadata and schema checks, and manual review of every changed project page.

**Phase complete when:**

- unsupported project outcomes are removed or qualified
- the KiwiRail area conflict is resolved or safely omitted
- claim rules catch contextual synonyms without relying only on a short fixed phrase list
- no URL, canonical, robots, or sitemap change has occurred

### Phase 2 - Page-role and guide-visibility model

**Objective:** Introduce a typed model that separates public guide visibility from page role, Service schema, indexation, and sitemap inclusion.

**Why this phase comes now:** The current data model makes it unsafe to remove service pages from the hub because the same lookup also drives navigation and schema.

**Dependencies:** Phase 1 should be complete so the new registry is built on trusted content records.

**Likely files and components:**

- `apps/marketing/data/pergolaGuides.ts`
- optional new `apps/marketing/data/pergolaEcosystem.ts`
- focused Vitest tests for the new data contract
- relevant Playwright fixtures that currently duplicate page roles

**Pages affected:** All ten programme pages and the guide hub, with no visible change in this phase.

**Included:**

- typed role definitions
- core, secondary, and none visibility
- Service schema eligibility independent of guide visibility
- collection membership independent of page existence
- compatibility exports so later PRs can migrate incrementally

**Excluded:**

- visible hub changes
- schema output changes
- breadcrumb changes
- content rewrites
- sitemap or robots changes

**Expected customer outcome:** None visible yet. This phase removes the architectural coupling that would otherwise create regressions.

**Expected SEO outcome:** No output change. Tests prove that guide visibility is not an indexation switch.

**Primary risks:** Over-engineering a generic CMS model or accidentally making the new registry authoritative for canonical, robots, or sitemap behaviour.

**Validation required:** Typecheck, focused data tests, existing guide and SEO browser tests unchanged.

**Phase complete when:** The target classification is represented in one typed source, compatibility exports preserve current rendering, and tests explicitly assert that `/pergolas-auckland` and `/custom-pergolas-auckland` can have `guideVisibility: none` while remaining indexable service pages.

### Phase 3 - Schema, collection membership, and breadcrumbs

**Objective:** Make structured data and visible navigation follow the new page profile instead of the old ten-page list.

**Why this phase comes now:** Schema and breadcrumb correctness must be established before the hub removes service pages from its collection.

**Dependencies:** Phase 2.

**Likely files and components:**

- `apps/marketing/components/seo-landing/SeoLandingPage.tsx`
- `apps/marketing/components/seo-landing/PergolaGuideNavigation.tsx`
- `apps/marketing/app/pergolas-auckland/page.tsx`
- shared editorial-review or breadcrumb component created during the phase
- `playwright/marketing.seo-programme.spec.ts`
- `playwright/marketing.guide-cluster-final-refinement.spec.ts`

**Pages affected:** All ten programme pages.

**Included:**

- Service schema independent from hub membership
- guide `isPartOf` only for actual guide-library members
- service-oriented breadcrumbs for broad and custom service pages
- guide-oriented breadcrumbs for core and secondary guides
- preserved editorial review information

**Excluded:**

- hub layout
- contextual related-guide navigation
- content pruning
- new routes

**Expected customer outcome:** Service pages stop presenting themselves as numbered guide chapters.

**Expected SEO outcome:** More accurate schema and breadcrumbs without URL or indexation changes.

**Primary risks:** Removing Service schema from hybrid guide/service pages, duplicating breadcrumbs, or accidentally changing canonical output.

**Validation required:** Schema-type assertions per route, breadcrumb assertions, one H1, direct 200, self-canonical, index/follow, and sitemap presence.

**Phase complete when:** Service pages outside the hub have no guide collection membership, all actual guides retain collection membership, and Service schema remains on `/pergolas-auckland`, `/custom-pergolas-auckland`, `/outdoor-rooms-auckland`, and `/commercial-pergolas-auckland`.

### Phase 4 - Curated guide-hub restructuring

**Objective:** Replace the equal ten-card programme directory with four core guides, four secondary guides, and two separate service pathways.

**Why this phase comes now:** The model and schema can now support the IA change without conflating it with indexation.

**Dependencies:** Phases 2 and 3.

**Likely files and components:**

- `apps/marketing/app/pergola-guides/page.tsx`
- `apps/marketing/app/pergola-guides/pergola-guides.css`
- the typed ecosystem registry
- `playwright/marketing.guide-hub.spec.ts`
- `playwright/marketing.hero-navigation.spec.ts`
- hub visual evidence under `artifacts/marketing-seo-landing/pergola-guides/`

**Pages affected:** `/pergola-guides` only, plus tests that inspect the collection.

**Included:**

- core and secondary groups
- separate residential and custom service pathways
- guide-only `ItemList`
- count-free metadata and copy
- earlier first-guide exposure on mobile
- accessible card hierarchy

**Excluded:**

- individual guide rewrites
- homepage or global navigation changes
- new guide routes
- redirects

**Expected customer outcome:** The hub becomes a clear planning resource rather than a directory of all SEO pages.

**Expected SEO outcome:** Internal-link prominence moves toward genuine guide intent while service pages retain their independent search value.

**Primary risks:** Accidentally dropping service-page internal links entirely, weakening mobile discoverability, or changing the hub canonical or indexation.

**Validation required:** Hub Playwright matrix, schema order, direct-link status, mobile overflow, image loading, keyboard focus, 44 pixel targets, reduced motion, and screenshots.

**Phase complete when:** The hub visibly presents four core guides and four secondary guides, keeps broad and custom service links in a separate utility section, and its ItemList contains only actual guides.

### Phase 5 - Decision-led guide navigation and service pathways

**Objective:** Replace the arbitrary previous or next sequence with topic-specific progression and clean up service-page references.

**Why this phase comes now:** Related routes should follow the curated library, not the previous ten-page order.

**Dependencies:** Phase 4.

**Likely files and components:**

- `apps/marketing/components/seo-landing/PergolaGuideNavigation.tsx`
- ecosystem relationship data
- content files that call service pages "guides"
- `apps/marketing/app/pergolas-auckland/page.tsx`
- `apps/marketing/app/custom-pergolas-auckland/content.ts`
- relevant Playwright tests

**Pages affected:** All core and secondary guides, plus the broad and custom service pages.

**Included:**

- contextual next decision
- related guide links
- hub return
- accurate service labels
- no self-links or duplicate links

**Excluded:**

- major page-content pruning
- product or project mapping overhaul
- analytics implementation
- new routes

**Expected customer outcome:** The next link explains the next useful decision rather than the next item in a programme list.

**Expected SEO outcome:** Internal links reinforce distinct page roles and reduce semantic cannibalisation.

**Primary risks:** Circular navigation, excessive crosslinking, or removing an important conversion path.

**Validation required:** Relationship data tests, link-resolution tests, manual journey checks, and no `rel=prev` or `rel=next` sequence on guide pages.

**Phase complete when:** No public page displays "X of 10", no service page is called a guide, and every actual guide has one clear next decision plus a small related set.

### Phase 6 - Retained-guide content refinement

**Objective:** Reduce repetition and make each retained guide own one clear customer decision.

**Why this phase comes now:** The page roles, hub, schema, and navigation are stable, so copy can be pruned without moving the target during the rewrite.

**Dependencies:** Phases 1 through 5.

**Likely files and components:**

- the eight guide `content.ts` files
- page metadata files only where a material mismatch exists
- shared SEO landing blocks only if a reusable content pattern is genuinely missing
- `playwright/marketing.seo-programme.spec.ts`
- `playwright/marketing.seo-landing.spec.ts`
- focused content and claims tests

**Pages affected:** One guide per pull request.

**Included:**

- duplicate section removal
- focused customer questions
- page-specific CTA and related links
- reduction of repeated process, cost, consent, and generic FAQ copy
- preserved project proof where distinct and verified

**Excluded:**

- full visual redesign
- multiple guide rewrites in one pull request
- unapproved numeric guidance
- new keyword variants
- new product claims

**Expected customer outcome:** Shorter, clearer, more useful decision support.

**Expected SEO outcome:** Stronger intent separation and lower overlap with service and product pages.

**Primary risks:** Removing useful query coverage, weakening a page's main answer, or introducing a new unsupported claim during simplification.

**Validation required:** One-page responsive checks, metadata and H1 alignment, originality tests, link checks, claim tests, form attribution, and manual copy review against the Context Pack.

**Phase complete when:** All eight retained guides have a distinct role, concise hierarchy, useful next step, and no unnecessary generic sections.

### Phase 7 - Product, project, contact, and analytics connections

**Objective:** Complete two-way progression between planning guidance, exact products, built evidence, and enquiry.

**Why this phase comes now:** The final guide roles and content owners are known.

**Dependencies:** Phase 6. Claims work from Phase 1 must remain enforced.

**Likely files and components:**

- `apps/marketing/data/products.ts`
- `apps/marketing/components/products/ProductDetailPage.tsx`
- `apps/marketing/data/projects.ts`
- `apps/marketing/app/projects/projectPresentation.ts`
- `apps/marketing/app/projects/ProjectDetailContent.tsx`
- `apps/marketing/app/acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm.tsx`
- a small consent-gated guide interaction tracker
- product, project, contact, and consent tests

**Pages affected:** Product pages, project pages, guide pages, and contact pathways.

**Included:**

- explicit product-to-guide ownership
- explicit project context links
- context-aware contact destinations
- consent-gated guide interaction events
- preservation tests for form page attribution and UTM data

**Excluded:**

- product specification rewrite
- project visual redesign
- enquiry API redesign
- personally identifiable analytics data

**Expected customer outcome:** Visitors can move from a planning question to exact evidence and then to the right enquiry path without dead ends.

**Expected SEO outcome:** Stronger semantic relationships among guides, products, projects, and services.

**Primary risks:** Inferred project links that misrepresent evidence, analytics before consent, or accidental API contract changes.

**Validation required:** Product and project unit tests, Playwright link matrices, consent-on and consent-off analytics tests, contact attribution tests, and no broken internal routes.

**Phase complete when:** Every relevant product and project has an intentional planning link, every guide has useful product and project pathways, and interaction events respect consent.

### Phase 8 - Homepage and global discovery

**Objective:** Give the curated library appropriate visibility without displacing project and enquiry pathways.

**Why this phase comes now:** The hub and its analytics are stable enough to receive more traffic.

**Dependencies:** Phases 4, 5, and 7.

**Likely files and components:**

- `apps/marketing/app/_home/Homepage.tsx`
- `apps/marketing/app/_home/content.ts`
- `apps/marketing/components/Header.tsx`
- homepage and shared-header Playwright tests
- homepage interaction tracking

**Pages affected:** Homepage and global header.

**Included:**

- repositioned or refined guide gateway
- three featured core planning decisions
- Guides in desktop and mobile navigation
- active state and event coverage

**Excluded:**

- homepage hero redesign
- product or project section redesign
- changes to the main enquiry CTA
- unrelated header refactoring

**Expected customer outcome:** Visitors can find planning guidance from the homepage and primary navigation without losing clear commercial pathways.

**Expected SEO outcome:** The hub gains stronger internal discovery and crawl prominence.

**Primary risks:** Header crowding, mobile overflow, or reducing the prominence of Projects, Products, Contact, or Get an estimate.

**Validation required:** Homepage and header responsive tests at 320, 390, 430, tablet, and desktop widths, keyboard navigation, active states, event tests, and no layout overflow.

**Phase complete when:** The curated guide hub is available from desktop and mobile navigation and the homepage gateway features only core planning decisions.

### Phase 9 - Optional new guides

**Objective:** Add only the missing guides with clear customer and conversion value.

**Why this phase is optional and later:** Existing roles and content should stabilise before introducing new routes. Consent content also needs external evidence and approval.

**Dependencies:** Required phases 1 through 8. The consent guide has an additional legal and technical gate.

**Likely files and components:**

- new route and content files under `apps/marketing/app/`
- ecosystem registry
- hub
- sitemap
- relevant service, product, and guide links
- new focused Playwright tests
- evidence brief for consent content

**Pages affected:** New form-comparison and consent routes plus relevant links.

**Included:**

- one neutral form-comparison guide
- one consent and site-constraints guide only after approval
- one new route per pull request

**Excluded:**

- suburb variants
- separate guides for every tint or accessory
- generic blog content
- unverified legal or technical advice

**Expected customer outcome:** Visitors can compare all four forms and understand how to prepare for approval questions.

**Expected SEO outcome:** New routes cover genuine unmet intent without creating filler or duplicating existing form pages.

**Primary risks:** Cannibalising form guides or publishing stale consent guidance.

**Validation required:** Editorial review, claims review, route identity, schema, canonical, sitemap, internal links, responsive browser tests, and legal or technical approval for consent.

**Phase complete when:** The form guide is distinct and useful, and the consent guide is either approved and published or remains deliberately blocked with its evidence brief current.

### Phase 10 - Variant consolidation, documentation, and final regression

**Objective:** Keep the completed acrylic consolidation aligned in
documentation and prove the completed ecosystem.

**Why this phase comes last:** The useful variant copy is consolidated and the
redirect is live. Final regression should test that settled architecture
rather than the retired two-page state.

**Dependencies:** The editorial consolidation decision is complete. Final
ecosystem regression still depends on the required roadmap phases and
production/external verification.

**Likely files and components:**

- `/acrylic-roof-pergolas-auckland` source files
- `apps/marketing/next.config.ts`
- sitemap and `playwright/marketing.acrylic-copy-variant.spec.ts`
- guide programme documentation
- full marketing test suite and build

**Pages affected:** The acrylic primary route, retired-route redirect response,
documentation and final tests.

**Included:**

- approved copy consolidation
- one-hop permanent redirect
- dead-code verification
- final documentation alignment
- production verification checklist

**Excluded:**

- changes to the primary acrylic URL
- unrelated cleanup

**Expected customer outcome:** One authoritative acrylic page remains.

**Expected SEO outcome:** Duplicate variant risk is removed while the primary canonical retains continuity.

**Primary risks:** Reintroducing variant content, breaking the one-hop redirect,
missing external-link monitoring, or leaving old tests and docs that
reintroduce the ten-guide assumption.

**Validation required:** Redirect response, primary canonical and indexability, sitemap absence for the variant, full marketing unit and browser suites, production build, docs guards, dead-code check, and production crawl.

**Phase complete when:** The primary acrylic page remains authoritative, the
variant redirect stays one hop, all roadmap docs reflect the final
architecture, and the full marketing gate passes. The redirect portion is
complete; final ecosystem regression remains G28 work.

---

## 4. Incremental agent goals

Each goal below is intended to be handed to Codex as a separate task. The embedded prompt is the minimum standalone context for that task, but the agent must still read `AGENTS.md` and the files listed under the goal.

Status vocabulary:

- `Not started`
- `Ready`
- `In progress`
- `Blocked`
- `In review`
- `Complete`
- `Deferred`
- `Not approved`

Required goals should proceed in recommended order. G11 through G18 may run as controlled parallel content lanes after G09 and G10 merge. G24 through G26 are optional and must not be started merely because earlier phases are complete.

### G01 - Correct unsupported project narrative claims

**Phase:** Phase 1 - Factual and claims corrections  
**Status:** Complete  
**Relative effort:** Medium  
**Implementation risk:** Medium  
**Dependencies:** None
**Completed:** 27 July 2026  
**Pull request:** Not yet assigned

**Historical Codex goal prompt (completed; do not rerun)**

The prompt below is retained as implementation evidence.

```text
Work only on roadmap goal G01 in `velt-design/sanctuary`.

Read `AGENTS.md`, `docs/Sanctuary_Pergolas_AI_Copywriting_Context_Pack.md`, `docs/marketing-claims-register.md`, this roadmap, and the current project source and tests.

Audit the public project narratives in `apps/marketing/data/projects.ts` for assertive weather, daylight, glare, heat, comfort, and integration outcomes that are not backed by current approved evidence. Prioritise Mt Maunganui, Lilliput Mini Golf, Riverhead, Tindalls Bay, Good Home, Dairy Flat, Ardmore, St Heliers, KiwiRail, and Atelier Shu. Replace or qualify phrases such as "all-season", "maximum light", "plenty of daylight", "strong weather protection", "proper weather protection", "blends seamlessly", or categorical glare reduction. Preserve verified dimensions, materials, design constraints, and architectural decisions. Do not convert customer goals such as "reduce glare" into prohibited phrases when they are clearly framed as a brief rather than a delivered performance result.

Update focused project and browser tests so the corrected wording is protected. Do not change routes, metadata identity, canonicals, robots, sitemap entries, layouts, or guide classification. Do not add any new performance claim.

Run focused project tests, the relevant Playwright project and claim specs, marketing typecheck, and `npm run architecture:changed`. Return a concise summary of each corrected claim family and the tests run.
```

**Context Codex must inspect**

- `apps/marketing/data/projects.ts`
- `apps/marketing/data/projects.claims.test.ts`
- `playwright/marketing.projects.spec.ts`
- `playwright/marketing.guide-cluster-final-refinement.spec.ts`
- `playwright/marketing.seo-copy-hygiene.spec.ts`
- `docs/marketing-claims-register.md` and the Context Pack claim guidance

**Exact scope**

- Correct public project descriptions, blurbs, constraints, and section copy only where the current wording overstates an outcome.
- Update dependent guide or homepage project snippets only when they repeat the same unsupported assertion.
- Add regression coverage for the specific corrected wording.

**Likely files**

- `apps/marketing/data/projects.ts`
- `apps/marketing/data/projects.claims.test.ts`
- `playwright/marketing.projects.spec.ts`
- `playwright/marketing.guide-cluster-final-refinement.spec.ts`
- `playwright/marketing.seo-copy-hygiene.spec.ts` if a new high-confidence rule is appropriate
- `docs/marketing-claims-register.md` only if the public fallback or pending item changes

**Implementation requirements**

- Distinguish design intent from demonstrated outcome.
- Use site-specific, conditional wording where a benefit depends on orientation, product, open edges, drainage, or assembly.
- Keep the copy calm, architectural, concrete, and in New Zealand English.
- Keep all changed customer-facing copy free of em dashes.

**Exclusions and guardrails**

- No route, redirect, canonical, robots, sitemap, schema, or layout change.
- No new numeric claim, supplier claim, warranty, timing, consent, span, or coastal claim.
- No broad rewrite of project pages.
- Do not delete a project or remove verified project evidence.

**Acceptance criteria**

- The flagged project pages contain no categorical all-weather, all-season, maximum-light, guaranteed-glare, or similar unsupported result.
- Verified project facts and design logic remain readable and useful.
- Customer objectives are not mistaken for performance guarantees.
- Existing metadata, canonical, indexability, project order, and project URLs remain unchanged.
- No em dash is introduced.

**Tests to add or update**

- Extend `apps/marketing/data/projects.claims.test.ts` with the corrected current wording and retired unsafe wording.
- Update `playwright/marketing.guide-cluster-final-refinement.spec.ts` where it currently expects stronger project phrases.
- Run `npx vitest run apps/marketing/data/projects.claims.test.ts apps/marketing/app/projects/projectPresentation.test.ts`.
- Run `npx playwright test playwright/marketing.projects.spec.ts playwright/marketing.guide-cluster-final-refinement.spec.ts playwright/marketing.seo-copy-hygiene.spec.ts --config=playwright.marketing.config.ts`.
- Run `npx tsc -p apps/marketing/tsconfig.json --noEmit --incremental false`.

**Manual checks**

- Read every changed project page at mobile and desktop widths.
- Check that project copy still explains the brief, design response, and material composition.
- Check guide and homepage project cards that reuse each changed record.
- Confirm no changed phrase creates a stronger implied claim in metadata or image captions.

**SEO or redirect risk**

Low route risk and medium copy risk. Search snippets may change, but removing unsupported wording is intentional. Do not change titles, canonicals, or URLs in this goal.

**Definition of done**

All identified project narrative claims are corrected or qualified, focused tests pass, and the pull request lists every public phrase changed with its reason.

**Completion record**

- Corrected unsupported weather, daylight, glare, comfort and integration outcomes in the current project records without changing verified project facts, routes, metadata identity, canonicals, robots or sitemap membership.
- Updated the dependent Dairy Flat and Tindalls Bay guide snippets and the Dairy Flat and Mt Maunganui homepage project rationales where they repeated the retired outcomes.
- Added source-level regressions for every corrected project and rendered regressions for project pages, dependent guide snippets and homepage project cards.
- Focused project tests, the required Playwright matrix, marketing typecheck, full marketing unit suite, production build and `npm run architecture:changed` passed on 27 July 2026.

### G02 - Resolve or quarantine unverified project facts

**Phase:** Phase 1 - Factual and claims corrections  
**Status:** Not started  
**Relative effort:** Small to medium  
**Implementation risk:** High  
**Dependencies:** G01

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G02 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, `docs/marketing-claims-register.md`, the project data model, project presentation helpers, and every public use of the affected facts.

Start with the KiwiRail record, which currently combines a 30.0 m by 3.0 m plan with a 115 m2 total area. Search the repository for an approved explanation or source. Also inspect exact accessory, control, engineering, coating, product-thickness, and trade details that the claims register identifies as pending or potentially inferred from tags.

Do not invent a reconciliation. Where approved evidence is absent, use the smallest safe fallback: omit the unresolved public fact, retain the verified facts, and record the evidence dependency in the claims register. Ensure guide cards, product evidence, project facts, metadata, and structured data do not continue to render the quarantined value through another path.

Add focused data invariants that prevent the unresolved value from returning without an explicit evidence note or approved record. Do not redesign the project model beyond what this goal needs.

Run focused project tests, project browser tests, marketing typecheck, and `npm run architecture:changed`. Report which facts were verified, which were omitted, and what evidence is still required.
```

**Context Codex must inspect**

- `apps/marketing/data/projects.ts`
- `apps/marketing/app/projects/projectPresentation.ts`
- `apps/marketing/app/projects/ProjectDetailContent.tsx`
- Guide and product content files that reference KiwiRail or another affected project
- `apps/marketing/data/projects.claims.test.ts`
- `docs/marketing-claims-register.md`

**Exact scope**

- Reconcile the KiwiRail area if an approved repository source exists.
- Otherwise remove the unresolved area from public rendering while retaining verified plan dimensions.
- Quarantine any other exact project fact in the same pending-evidence category only when its lack of support is demonstrable.
- Document the remaining approval dependency.

**Likely files**

- `apps/marketing/data/projects.ts`
- `apps/marketing/app/projects/projectPresentation.ts` if omission behaviour needs adjustment
- Guide content files that hard-code an affected fact
- `apps/marketing/data/projects.claims.test.ts`
- `playwright/marketing.projects.spec.ts`
- `docs/marketing-claims-register.md`

**Implementation requirements**

- Search for all consumers before changing a typed project fact.
- Prefer omission over an invented estimate or explanation.
- Keep project cards and detail pages consistent.
- Preserve current project route, title, canonical, images, and verified facts.

**Exclusions and guardrails**

- No broad project data migration.
- No new public measurement derived from arithmetic unless the approved source says it represents the complete published area.
- No deletion or redirect of a project page.
- No guide-hub or product-page redesign.

**Acceptance criteria**

- No public surface shows the unresolved KiwiRail 115 m2 figure unless its basis is explicitly verified.
- Guide cards, project facts, and project detail agree.
- Any removed exact accessory or engineering detail is recorded as pending rather than silently replaced.
- No other verified project dimensions are lost.
- The claims register states the current evidence status.

**Tests to add or update**

- Add a focused invariant for KiwiRail and any other quarantined fact in `projects.claims.test.ts`.
- Update project presentation tests for honest missing-data treatment.
- Run `npx vitest run apps/marketing/data/projects.claims.test.ts apps/marketing/app/projects/projectPresentation.test.ts`.
- Run `npx playwright test playwright/marketing.projects.spec.ts playwright/marketing.guide-cluster-final-refinement.spec.ts --config=playwright.marketing.config.ts`.
- Run marketing TypeScript.

**Manual checks**

- Inspect KiwiRail project detail, Commercial guide proof, Pitched guide proof, and any homepage or product use.
- Confirm omission does not leave broken punctuation, an empty fact row, or a misleading total.
- Confirm project images and route identity remain unchanged.

**SEO or redirect risk**

Low URL risk and medium evidence risk. Removing one unresolved fact is safer than retaining a contradiction. Do not alter the project URL, canonical, title, or sitemap entry.

**Definition of done**

Every affected project fact is either supported by a repository source or absent from public output, with tests and the claims register aligned.

### G03 - Strengthen contextual marketing-claims regression

**Phase:** Phase 1 - Factual and claims corrections  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Medium  
**Dependencies:** G01 and G02

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G03 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, `docs/marketing-claims-register.md`, `docs/Sanctuary_Pergolas_AI_Copywriting_Context_Pack.md`, `playwright/marketing.seo-copy-hygiene.spec.ts`, and the source-level project and product claim tests.

Replace the current claim guard's dependence on a short pair of regular expressions with a small, typed, maintainable claim-rule catalogue. Cover claim families for price, timing, warranty, ultraviolet and heat performance, waterproof or all-weather language, wind and span, coastal suitability, maintenance, consent, and unsupported superlatives. Scan rendered visible copy, metadata, and JSON-LD for every route in the generated sitemap.

Rules must distinguish an assertion from a customer question, design objective, negation, or explicit qualification. Do not silently allowlist a phrase. Any exception must state the route, rule identifier, reason, evidence source, and review owner. Add source-level tests for typed project and product content where rendered browser coverage alone would make failures hard to locate.

Keep this PR focused on test and guard infrastructure. Do not rewrite broad page content except for a minimal fixture needed to prove the rule. Run focused tests, the complete claim scan, marketing typecheck, and `npm run architecture:changed`.
```

**Context Codex must inspect**

- `playwright/marketing.seo-copy-hygiene.spec.ts`
- `apps/marketing/data/projects.claims.test.ts`
- `apps/marketing/data/products.test.ts`
- `docs/marketing-claims-register.md`
- All sitemap routes generated by `apps/marketing/app/sitemap.ts`

**Exact scope**

- Create a typed claim-rule catalogue with stable identifiers and claim areas.
- Scan rendered copy, metadata, and JSON-LD sentence by sentence or within a similarly useful context window.
- Add explicit, documented exceptions only where current approved evidence exists.
- Add focused source-level tests for high-risk typed content.

**Likely files**

- Optional new `apps/marketing/lib/marketingClaimRules.ts` or an equivalently narrow owner file
- `playwright/marketing.seo-copy-hygiene.spec.ts`
- `apps/marketing/data/projects.claims.test.ts`
- `apps/marketing/data/products.test.ts`
- `docs/marketing-claims-register.md` if rule identifiers or exception format are documented
- `docs/testing-and-qa.md` only if the canonical command or test strategy changes

**Implementation requirements**

- Rules must be readable and easy to extend.
- Every exception must be evidence-backed and reviewable.
- Negated warnings such as "do not promise waterproofing" must not fail.
- Customer priorities such as "reduce glare" must not fail unless presented as an achieved categorical result.
- Failure messages must identify route, rule, and offending context.

**Exclusions and guardrails**

- No AI or external API dependency in CI.
- No opaque semantic-scoring system.
- No broad content rewrite.
- No lowering of existing sitemap-wide coverage.
- No unbounded allowlist.

**Acceptance criteria**

- The guard catches contextual variants such as all-season, maximum light, maintenance-free, no consent, post-free, coastal-ready, or weatherproof when used as unsupported assertions.
- The guard permits explicit limitations, questions, and design objectives.
- Failures show an actionable route and rule identifier.
- All existing approved public routes pass.
- The test remains deterministic and practical in the current Playwright lane.

**Tests to add or update**

- Add unit tests for rule matching, qualification, negation, and documented exceptions.
- Run `npx vitest run` for the new rule catalogue and project/product claim tests.
- Run `npx playwright test playwright/marketing.seo-copy-hygiene.spec.ts --config=playwright.marketing.config.ts`.
- Run `npm run test:marketing` if the catalogue is used by multiple source tests.
- Run marketing TypeScript.

**Manual checks**

- Review the rule list against every row in the active claims register.
- Temporarily test representative unsafe and safely qualified phrases locally, then remove any temporary fixture.
- Confirm the suite does not flag ordinary customer language or project constraints.

**SEO or redirect risk**

No direct SEO output change. The risk is false confidence from an incomplete guard or excessive false positives that encourage broad exceptions.

**Definition of done**

The repository has one understandable claim-rule owner, sitemap-wide contextual coverage, focused source tests, and no unexplained exceptions.

### G04 - Introduce the typed guide-ecosystem profile

**Phase:** Phase 2 - Page-role and guide-visibility model  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Medium  
**Dependencies:** Phase 1 complete

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G04 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, the current `apps/marketing/data/pergolaGuides.ts`, `SeoLandingPage.tsx`, `PergolaGuideNavigation.tsx`, the guide hub, and tests that duplicate page roles.

Introduce one typed guide-ecosystem profile that separates:
- page role
- guide visibility: core, secondary, or none
- guide-library membership
- Service schema eligibility
- hub label, prompt, summary, group, and order
- editorial review visibility
- relationship data needed by later goals

Represent the target classification exactly:
core: Outdoor Rooms, Cost, Acrylic vs Louvre, Blinds
secondary: Gable, Pitched, Aluminium, Commercial
none: Pergolas Auckland, Custom Pergolas Auckland

Do not make this registry the source of truth for canonical, robots, or sitemap behaviour. Those remain owned by page metadata and `app/sitemap.ts`. Preserve compatibility exports so the current hub and navigation can continue to render until their dedicated goals. Add focused type and data-contract tests, including assertions that service pages can have no guide visibility while remaining service-schema eligible.

Do not change visible UI, schema output, breadcrumbs, content, metadata, indexation, or routes in this PR. Run focused tests, existing guide browser tests, marketing typecheck, and `npm run architecture:changed`.
```

**Context Codex must inspect**

- `apps/marketing/data/pergolaGuides.ts`
- `apps/marketing/components/seo-landing/SeoLandingPage.tsx`
- `apps/marketing/components/seo-landing/PergolaGuideNavigation.tsx`
- `apps/marketing/app/pergola-guides/page.tsx`
- `playwright/marketing.guide-hub.spec.ts`
- `playwright/marketing.seo-programme.spec.ts`

**Exact scope**

- Add the target classification and public hub metadata to one typed source.
- Provide compatibility selectors or exports for the current implementation.
- Add data-contract tests for uniqueness, valid relationships, and role combinations.

**Likely files**

- `apps/marketing/data/pergolaGuides.ts` or a new narrow `apps/marketing/data/pergolaEcosystem.ts`
- A new focused Vitest test beside the data owner
- Only minimal import changes required for compatibility

**Implementation requirements**

- No route may appear twice.
- Guide order must be unique within each tier.
- Only core and secondary entries are guide-library members.
- Service schema eligibility must be independent from guide visibility.
- The model must remain specific to this ecosystem rather than becoming a generic CMS framework.

**Exclusions and guardrails**

- No visible hub change.
- No JSON-LD or breadcrumb change.
- No sitemap or robots flag in the profile as an authoritative switch.
- No content rewrite.
- No removal of the old compatibility exports until consumers migrate.

**Acceptance criteria**

- The target ten-page classification is represented exactly.
- `/pergolas-auckland` and `/custom-pergolas-auckland` have guide visibility none and service-schema eligibility true.
- `/outdoor-rooms-auckland` and `/commercial-pergolas-auckland` can be guide members and service-schema eligible.
- Existing pages render unchanged.
- Focused data tests protect uniqueness and valid combinations.

**Tests to add or update**

- Add a focused Vitest contract for the ecosystem profile.
- Run the new test and `npm run test:marketing`.
- Run `npx playwright test playwright/marketing.guide-hub.spec.ts playwright/marketing.seo-programme.spec.ts --config=playwright.marketing.config.ts` to prove no visible regression.
- Run marketing TypeScript.

**Manual checks**

- Compare the profile with the target classification table in this roadmap.
- Confirm compatibility exports preserve current order only as a temporary migration aid.
- Confirm no metadata, sitemap, or robots file changed.

**SEO or redirect risk**

No intended SEO output change. The main risk is creating an accidental indexation switch or changing existing exported order before the hub migration.

**Definition of done**

One typed source represents page role and guide visibility independently, compatibility is preserved, and no public output changes.

### G05 - Decouple schema from guide membership

**Phase:** Phase 3 - Schema, collection membership, and breadcrumbs  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** High  
**Dependencies:** G04

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G05 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, the new ecosystem profile, `SeoLandingPage.tsx`, the manually implemented `/pergolas-auckland` page, the guide hub schema, and current schema tests.

Change structured-data selection so Service schema is controlled by the page profile, not by whether the page is in the guide array. Emit guide-collection `isPartOf` only for core and secondary guide members. Keep `WebPage`, `dateModified`, and `reviewedBy` on the current reviewed programme pages. Use service-oriented breadcrumb schema for `/pergolas-auckland` and `/custom-pergolas-auckland`; use guide-oriented breadcrumb schema for actual guide members.

Required Service schema routes:
- `/pergolas-auckland`
- `/custom-pergolas-auckland`
- `/outdoor-rooms-auckland`
- `/commercial-pergolas-auckland`

Do not change visible breadcrumbs in this goal. Do not change metadata titles, descriptions, canonical URLs, robots directives, sitemap entries, page copy, or layouts. Add route-by-route schema assertions and prove that the two service pages outside the hub remain indexable and retain Service schema.

Run focused schema Playwright tests, marketing typecheck, and `npm run architecture:changed`.
```

**Context Codex must inspect**

- The ecosystem profile from G04
- `apps/marketing/components/seo-landing/SeoLandingPage.tsx`
- `apps/marketing/app/pergolas-auckland/page.tsx`
- `apps/marketing/app/pergola-guides/page.tsx`
- `playwright/marketing.seo-programme.spec.ts`
- `playwright/marketing.guide-cluster-final-refinement.spec.ts`

**Exact scope**

- Structured data selection and breadcrumb JSON-LD only.
- Route-specific tests for Service and collection membership.
- Preserve global Organization and LocalBusiness schema emitted elsewhere.

**Likely files**

- `apps/marketing/components/seo-landing/SeoLandingPage.tsx`
- `apps/marketing/app/pergolas-auckland/page.tsx`
- Optional narrow schema helper if it reduces duplication
- `playwright/marketing.seo-programme.spec.ts`
- `playwright/marketing.guide-cluster-final-refinement.spec.ts`

**Implementation requirements**

- Service schema and guide membership must be independent.
- Only actual guides receive `isPartOf` the guide CollectionPage.
- Service-page breadcrumb schema must not call the page a guide.
- All URLs in JSON-LD must use `absoluteUrl`.

**Exclusions and guardrails**

- No visible navigation or breadcrumb changes.
- No hub ItemList change yet.
- No metadata or route change.
- No FAQPage schema.
- No Offer, Review, AggregateRating, or price schema.

**Acceptance criteria**

- The four named routes emit Service schema.
- The two service-only routes do not emit guide `isPartOf`.
- The eight guide-visible routes emit guide `isPartOf`.
- All routes retain WebPage and BreadcrumbList.
- Canonicals, robots, sitemap, H1, and page copy are unchanged.

**Tests to add or update**

- Update route profiles in `marketing.seo-programme.spec.ts` so service-schema assertions no longer reuse guide visibility.
- Add explicit assertions for `isPartOf` presence or absence.
- Run focused SEO programme and final-refinement Playwright specs.
- Run marketing TypeScript and the production marketing build if the schema helper changes shared server rendering.

**Manual checks**

- Inspect JSON-LD on one service-only page, one hybrid service guide, one editorial guide, and the hub.
- Validate no duplicate Service node is emitted.
- Check all breadcrumb items resolve.

**SEO or redirect risk**

Medium to high schema risk, but no URL risk. Incorrect implementation could remove valid Service schema or imply false collection membership.

**Definition of done**

Schema output matches the target role table on every programme route and all existing SEO identity remains stable.

### G06 - Separate visible guide navigation from service-page context

**Phase:** Phase 3 - Schema, collection membership, and breadcrumbs  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Medium  
**Dependencies:** G05

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G06 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, the ecosystem profile, `PergolaGuideNavigation.tsx`, `SeoLandingPage.tsx`, and the manual `/pergolas-auckland` page.

Make visible breadcrumb and editorial-review rendering follow the page profile:
- core and secondary guides show Home / Pergola Guides / Current page
- `/pergolas-auckland` shows a service breadcrumb beginning at Home
- `/custom-pergolas-auckland` may use Home / Pergolas Auckland / Custom Pergolas Auckland
- service-only pages do not show "X of 10" or a guide progression block
- editorial review information remains available without requiring guide membership

Extract a small editorial-review or page-context component only if it creates a clear owner. Keep the current linear guide progression temporarily for the eight guide members; G09 will replace it. Do not restructure the hub, rewrite page content, alter schema work from G05, or change routes, metadata, canonicals, robots, or sitemap.

Update focused visible-navigation tests and run the SEO programme, broad service-page tests, marketing typecheck, and `npm run architecture:changed`.
```

**Context Codex must inspect**

- `apps/marketing/components/seo-landing/PergolaGuideNavigation.tsx`
- `apps/marketing/components/seo-landing/SeoLandingPage.tsx`
- `apps/marketing/app/pergolas-auckland/page.tsx`
- `apps/marketing/app/custom-pergolas-auckland/content.ts`
- Current CSS for `.seo-guide-navigation`
- SEO programme and service-page Playwright tests

**Exact scope**

- Visible breadcrumbs, guide-navigation eligibility, and editorial-review presentation.
- Service-page breadcrumb destinations and labels.
- Focused tests for absence of guide numbering on service-only pages.

**Likely files**

- `apps/marketing/components/seo-landing/PergolaGuideNavigation.tsx`
- Optional new small breadcrumb or editorial-review component
- `apps/marketing/components/seo-landing/SeoLandingPage.tsx`
- `apps/marketing/app/pergolas-auckland/page.tsx`
- Shared SEO landing CSS only if the service context needs a minimal layout adjustment
- Relevant Playwright tests

**Implementation requirements**

- Guide breadcrumbs must match actual guide membership.
- Editorial review must not imply claim approval.
- Service pages must retain a clear route back to relevant planning resources through ordinary contextual links.
- No duplicate breadcrumb landmarks.

**Exclusions and guardrails**

- No contextual relationship redesign yet.
- No guide-hub restructuring.
- No content pruning.
- No schema changes beyond preserving G05.
- No new sticky navigation.

**Acceptance criteria**

- Broad and custom service pages show no guide numbering or guide progression landmark.
- Actual guides still show a hub breadcrumb and current temporary progression.
- Editorial review date and limitation remain visible where currently required.
- Breadcrumbs are keyboard accessible and match schema labels.
- No URL or metadata changes.

**Tests to add or update**

- Update `playwright/marketing.seo-programme.spec.ts` to distinguish visible guide members from service pages.
- Add assertions for service breadcrumbs and absence of guide progression.
- Run focused service and guide Playwright specs.
- Run marketing TypeScript.

**Manual checks**

- Check `/pergolas-auckland`, `/custom-pergolas-auckland`, `/outdoor-rooms-auckland`, and `/pergola-cost-auckland` at mobile and desktop widths.
- Confirm the review note is readable but visually subordinate.
- Confirm no extra vertical gap remains where the guide navigation was removed.

**SEO or redirect risk**

Low URL risk and medium internal-navigation risk. Breadcrumb changes must stay consistent with JSON-LD from G05.

**Definition of done**

Visible page context accurately distinguishes service-only pages from guide-library members without changing indexation or page identity.

### G07 - Rebuild the hub around core, secondary, and service pathways

**Phase:** Phase 4 - Curated guide-hub restructuring  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Medium  
**Dependencies:** G04, G05, and G06

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G07 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, the ecosystem profile, the current guide hub page, guide hub CSS, and guide hub tests.

Replace the current ten-page, three-chapter, numbered directory with:
- four core guides: Outdoor Rooms, Cost, Acrylic vs Louvre, Blinds
- four secondary guides: Gable, Pitched, Aluminium, Commercial
- a separate service pathway for Pergolas Auckland and Custom Pergolas Auckland

Keep the H1 "Find the guide for the decision in front of you" unless a repository conflict requires a small correction. Remove "Ten practical guides", the 10/03/01 count rail, the three chapter navigation panels, and global guide numbers. Update metadata and Open Graph copy so they describe decisions rather than a guide count.

Build the hub `ItemList` from the eight guide-library members only. Service links must remain visible but must not appear in that ItemList or use guide labels. Use the existing marketing foundation and project imagery. Make only the minimum CSS changes needed for a stable intermediate layout; the dedicated mobile and visual refinement is G08.

Update hub tests to assert the target groups, service separation, ItemList, canonical, index/follow, and direct route resolution. Do not alter individual guide content, service-page indexation, sitemap entries, or global navigation.
```

**Context Codex must inspect**

- `apps/marketing/app/pergola-guides/page.tsx`
- `apps/marketing/app/pergola-guides/pergola-guides.css`
- The ecosystem profile
- `playwright/marketing.guide-hub.spec.ts`
- `apps/marketing/app/sitemap.ts` and `robots.ts` for no-change verification

**Exact scope**

- Hub content structure, metadata, and ItemList.
- Core, secondary, and service-pathway grouping.
- Focused hub tests.
- Only minimal CSS needed to keep the intermediate page usable.

**Likely files**

- `apps/marketing/app/pergola-guides/page.tsx`
- `apps/marketing/app/pergola-guides/pergola-guides.css`
- The ecosystem data owner if selectors are needed
- `playwright/marketing.guide-hub.spec.ts`
- Possibly `playwright/marketing.seo-copy-hygiene.spec.ts` for updated hub copy

**Implementation requirements**

- Core guides appear in the roadmap order.
- Secondary guides are visibly lower prominence.
- Broad and custom service pages remain linked in a separately labelled section.
- The CollectionPage remains self-canonical and indexable.
- The ItemList contains eight actual guides in rendered order.
- No service page loses its sitemap entry or internal discovery.

**Exclusions and guardrails**

- No individual guide rewrite.
- No homepage or header change.
- No new guide route.
- No redirect.
- No count-led hero language.

**Acceptance criteria**

- Exactly four core and four secondary guide links render.
- Exactly two service pathway links render outside guide card semantics.
- No global guide number, "X of 10", or three chapter navigation appears on the hub.
- The ItemList contains only the eight guide routes.
- All ten destinations still resolve directly and remain in the sitemap where they already were.
- The hub title, canonical, robots, and one-H1 contract remain correct.

**Tests to add or update**

- Rewrite `playwright/marketing.guide-hub.spec.ts` around tier and role rather than the old ten-page sequence.
- Assert ItemList order and exclusion of the two service-only routes.
- Assert service links remain present.
- Run the guide hub, hero navigation, and SEO copy hygiene specs.
- Run marketing TypeScript.

**Manual checks**

- Review desktop and mobile structure before the visual refinement PR.
- Confirm service pathways are easy to find but do not look like guides.
- Confirm project image caption remains accurate and no count is shown in metadata.

**SEO or redirect risk**

Medium internal-link and schema risk. Existing page URLs, canonicals, robots, and sitemap entries must remain unchanged.

**Definition of done**

The public hub reflects the target classification and guide-only ItemList, with all service URLs preserved and linked separately.

### G08 - Refine guide-hub hierarchy and mobile density

**Phase:** Phase 4 - Curated guide-hub restructuring  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Low to medium  
**Dependencies:** G07

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G08 in `velt-design/sanctuary`.

Read `AGENTS.md`, `docs/marketing-ui-foundation.md`, the roadmap, the restructured hub from G07, current hub CSS, and responsive guide-hub tests.

Refine the hub presentation without changing its content model, routes, metadata, schema, or link destinations. Give core guides the strongest card treatment, secondary guides a compact treatment, and service pathways a clearly separate utility treatment. Reduce the mobile approach to the first core guide by shortening the combined hero treatment and removing unnecessary viewport-height minimums. Keep the project image but avoid making the copy section and image each consume most of a viewport.

Required responsive coverage: 320, 390, 430, 768, 1024, and 1440 pixels. Preserve the olive action accent, responsive Next.js image hints, reduced-motion behaviour, 44 pixel targets, keyboard focus, no horizontal overflow, and no nested vertical scroller.

Do not rewrite hub copy, reorder guides, change the ItemList, add a carousel, add sticky UI, alter the header, or change any individual guide page. Capture before and after screenshots in the existing artifact directory. Run focused hub Playwright tests, marketing typecheck, production build, and `npm run architecture:changed`.
```

**Context Codex must inspect**

- `docs/marketing-ui-foundation.md`
- `apps/marketing/app/pergola-guides/page.tsx` after G07
- `apps/marketing/app/pergola-guides/pergola-guides.css`
- `playwright/marketing.guide-hub.spec.ts`
- Existing visual evidence under `artifacts/marketing-seo-landing/pergola-guides/`

**Exact scope**

- Hub CSS and small presentation-only markup adjustments.
- Core versus secondary visual hierarchy.
- Mobile hero and card density.
- Responsive and accessibility tests and screenshots.

**Likely files**

- `apps/marketing/app/pergola-guides/pergola-guides.css`
- `apps/marketing/app/pergola-guides/page.tsx` only for presentation hooks
- `playwright/marketing.guide-hub.spec.ts`
- Visual evidence artifacts if the repository retains them

**Implementation requirements**

- Core guide cards must be recognisably primary without using hype.
- Secondary guides must remain visible without dominating.
- The first core guide should appear materially earlier on mobile than in the current design.
- Focus states and target sizes must remain clear.
- Use existing tokens and marketing foundation patterns.

**Exclusions and guardrails**

- No content rewrite or guide reclassification.
- No schema, metadata, route, sitemap, or robots change.
- No global header work.
- No new animation system or client-side carousel.

**Acceptance criteria**

- No horizontal overflow at all required widths.
- No nested vertical content scroller.
- All interactive targets meet the current 44 pixel expectation.
- Core, secondary, and service treatments remain understandable without colour alone.
- Reduced-motion mode removes non-essential transition.
- Images load with valid `srcset` and `sizes`.

**Tests to add or update**

- Extend the guide-hub responsive matrix to 320 and 430 pixels.
- Assert mobile height or first-core-guide visibility using a stable structural measure rather than a brittle screenshot pixel count.
- Run `npx playwright test playwright/marketing.guide-hub.spec.ts playwright/marketing.hero-navigation.spec.ts --config=playwright.marketing.config.ts`.
- Run marketing TypeScript and `npm run build:marketing`.

**Manual checks**

- Review screenshots at every required width.
- Keyboard through all hub links.
- Check long summaries and text wrapping.
- Check the overlay header at the top and solid header after scrolling.

**SEO or redirect risk**

No intended SEO change. Risk is limited to accidental hidden content or broken links caused by presentation changes.

**Definition of done**

The hub is visually curated, mobile-efficient, accessible, and unchanged in classification, schema, and SEO identity.

### G09 - Replace linear guide progression with decision-led relationships

**Phase:** Phase 5 - Decision-led guide navigation and service pathways  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Medium  
**Dependencies:** G07 and G08

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G09 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, the ecosystem profile, `PergolaGuideNavigation.tsx`, all eight retained guide link sections, and relevant tests.

Replace the array-position previous and next navigation with explicit decision-led relationships. Each guide should show:
- a breadcrumb and return to the guide hub
- one recommended next decision
- up to two additional related guide links
- no global number
- no "X of 10"
- no `rel=prev` or `rel=next` based on programme order

Use the target relationship map in this roadmap:
Outdoor Rooms -> Cost, Blinds, roof comparison
Cost -> Outdoor Rooms, form guidance, Custom service where scope is complex
Roof comparison -> Acrylic product, Cost, Outdoor Rooms
Blinds -> Outdoor Rooms, Cost, blind product
Gable <-> Pitched, plus Cost or Custom
Aluminium -> Gable or Pitched, Custom, Cost
Commercial -> Cost, Custom, Projects

Do not create links to optional new routes before they exist. Validate relationships for no self-link, duplicate destination, or dead route. Keep service pathways and product links visually distinct from related guides. Do not rewrite guide bodies beyond replacing the navigation module.

Run focused data tests, all guide navigation and link tests, marketing typecheck, and `npm run architecture:changed`.
```

**Context Codex must inspect**

- `apps/marketing/components/seo-landing/PergolaGuideNavigation.tsx`
- The ecosystem relationship data
- Guide `content.ts` link-card sections
- `playwright/marketing.seo-programme.spec.ts`
- `playwright/marketing.guide-hub.spec.ts`

**Exact scope**

- Explicit relationship data for the eight current guides.
- Navigation component redesign around next decision and related guides.
- Validation and link-resolution tests.

**Likely files**

- The ecosystem data owner
- `apps/marketing/components/seo-landing/PergolaGuideNavigation.tsx`
- Shared SEO landing CSS for the navigation module
- Focused Vitest data test
- `playwright/marketing.seo-programme.spec.ts`

**Implementation requirements**

- One recommended next decision per guide.
- No more than three guide destinations in the module.
- Service and product links use accurate role labels.
- No optional route is linked before publication.
- The hub return remains clear.

**Exclusions and guardrails**

- No service-page navigation change beyond preserving G06.
- No full content rewrite.
- No new route.
- No metadata, schema, sitemap, or robots change.
- No sticky CTA.

**Acceptance criteria**

- No guide displays previous, next, sequence number, or "X of 10".
- Every guide has a valid recommended next decision.
- No self-link or duplicate route exists.
- All destinations resolve without redirects where a direct route exists.
- The module is accessible and responsive.

**Tests to add or update**

- Add a relationship contract test for uniqueness, membership, and no self-links.
- Update `marketing.seo-programme.spec.ts` to assert the new navigation landmark and remove old progression assumptions.
- Run link-resolution checks across all eight guides.
- Run marketing TypeScript.

**Manual checks**

- Follow each eight-guide journey once on mobile and desktop.
- Confirm labels describe the reason to continue.
- Confirm product or service destinations are not disguised as guides.

**SEO or redirect risk**

Medium internal-link risk and no redirect risk. The change intentionally redistributes internal prominence around customer decisions.

**Definition of done**

All eight guides use explicit, valid, decision-led navigation with no residual programme sequence.

### G10 - Correct service-page labels and planning handoffs

**Phase:** Phase 5 - Decision-led guide navigation and service pathways  
**Status:** Not started  
**Relative effort:** Small  
**Implementation risk:** Low  
**Dependencies:** G09

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G10 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, `/pergolas-auckland`, `/custom-pergolas-auckland`, the eight guide content files, and the hub service-pathway copy.

Find customer-facing links or labels that still call the broad or custom service pages "guides", "guide 01", "guide 02", "broad guide", or "custom guide". Replace them with accurate service language such as residential pergola planning, pergola design and installation, or custom design capability. Preserve contextual links to those pages where they are useful.

Keep this PR narrow. Do not rewrite the service pages, change their metadata, remove them from the sitemap, alter Service schema, or change the curated hub classification. Do not replace meaningful descriptive links with generic "Learn more".

Update focused copy and link tests. Run the affected guide and service-page Playwright specs, marketing typecheck, and `npm run architecture:changed`.
```

**Context Codex must inspect**

- `apps/marketing/app/pergolas-auckland/page.tsx` and content
- `apps/marketing/app/custom-pergolas-auckland/content.ts`
- All retained guide `content.ts` files
- `apps/marketing/app/pergola-guides/page.tsx`
- SEO copy hygiene and link tests

**Exact scope**

- Customer-facing labels and contextual handoffs only.
- Accurate distinction between guide, service, product, and project destinations.
- Focused regression tests.

**Likely files**

- Affected service and guide content files
- `apps/marketing/app/pergola-guides/page.tsx` if service utility labels need correction
- `playwright/marketing.seo-programme.spec.ts` or focused copy tests

**Implementation requirements**

- Use descriptive destination language.
- Preserve important service links from guides.
- Keep New Zealand English and the calm design-specialist tone.
- Use no em dashes.

**Exclusions and guardrails**

- No page-body restructure.
- No metadata, schema, route, canonical, robots, or sitemap change.
- No removal of service URLs.
- No new CTA system.

**Acceptance criteria**

- No customer-facing copy presents either service page as a numbered guide.
- The service pages remain linked from the hub and relevant guides.
- Link labels explain the destination role.
- No broken route or duplicate link is introduced.

**Tests to add or update**

- Add a copy-hygiene assertion for retired service-as-guide labels.
- Run affected SEO programme and hub specs.
- Run marketing TypeScript.

**Manual checks**

- Search rendered and source copy for "broad guide", "custom guide", and old sequence labels.
- Check the hub final service section and at least one core and secondary guide.
- Confirm service CTAs remain conversion-oriented rather than generic.

**SEO or redirect risk**

Low risk. This is an intent-clarification change with no URL or indexation impact.

**Definition of done**

Broad and custom pages are consistently described as services or capabilities, while useful planning handoffs remain.

### G11 - Refine the Outdoor Rooms core guide

**Phase:** Phase 6 - Retained-guide content refinement  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Medium  
**Dependencies:** G09 and G10

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G11 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, the Context Pack, claims register, `apps/marketing/app/outdoor-rooms-auckland/content.ts`, the shared SEO landing blocks, relevant product pages, and guide tests.

Refine `/outdoor-rooms-auckland` as the primary use-led getting-started guide. Preserve its strongest material:
- start with activities, furniture, circulation, views, and adjoining rooms
- the four boundaries above, around, below, and beside
- honest limits of an outdoor room
- selected built evidence

Remove or consolidate repeated generic service process, product-catalogue copy, broad cost explanation, repeated consent caveats, and FAQs owned by other pages. Keep only project examples that demonstrate clearly different room-planning decisions. Use contextual links to Cost, Blinds, roof comparison, relevant products, projects, and the residential service page.

Keep the current URL, canonical, indexation, sitemap, Service schema, guide membership, and enquiry API. Do not add comfort, heating, all-season, or weather-exclusion claims. Keep the use-led CTA and page-specific form fields.

Update focused tests and run the single-page browser matrix, claims tests, marketing typecheck, and `npm run architecture:changed`.
```

**Context Codex must inspect**

- `apps/marketing/app/outdoor-rooms-auckland/content.ts`
- `apps/marketing/app/outdoor-rooms-auckland/page.tsx`
- `apps/marketing/components/seo-landing/SeoLandingBlocks.tsx`
- Blinds, lighting, heater, and acrylic infill product pages
- Warkworth, Riverhead, and Tindalls project records
- SEO programme and claim tests

**Exact scope**

- One page only.
- Content hierarchy, duplicated sections, FAQs, project proof, CTA support copy, and contextual links.
- Metadata only if the existing title or description materially conflicts with the refined role.

**Likely files**

- `apps/marketing/app/outdoor-rooms-auckland/content.ts`
- `apps/marketing/app/outdoor-rooms-auckland/page.tsx` only if metadata needs a small alignment
- Focused tests

**Implementation requirements**

- The main question is how to plan the room, not which product to buy.
- Keep practical depth on circulation, furniture, thresholds, light, edges, and services.
- Use no more project examples than add distinct evidence.
- Link product details rather than repeating specification.
- Keep one primary CTA.

**Exclusions and guardrails**

- No new route.
- No broad service-page rewrite.
- No numeric price, timing, warranty, heat, weather, or consent claim.
- No visual redesign or shared-block refactor unless essential.
- No change to form API or attachments.

**Acceptance criteria**

- The page answers a clear getting-started planning question.
- Generic process, cost, consent, and product duplication is reduced.
- The strongest use-led sections remain.
- Related guides, products, projects, and service pathways are useful and non-duplicative.
- One H1, one embedded form, no post-form CTA, the current canonical and the
  current schema remain.

**Tests to add or update**

- Update the Outdoor Rooms entry in `playwright/marketing.seo-programme.spec.ts` if section or project counts change.
- Run the focused SEO programme route and SEO copy hygiene spec.
- Run claims tests and marketing TypeScript.
- Run a production marketing build if shared block rendering changes.

**Manual checks**

- Read the page as an early-stage homeowner.
- Check the first screen, section order, project relevance, form close and
  footer transition at mobile and desktop widths.
- Confirm Riverhead and Tindalls snippets use the corrected project evidence from Phase 1.

**SEO or redirect risk**

Medium content-pruning risk. Preserve the main query answer, unique H1, title intent, and important customer questions.

**Definition of done**

Outdoor Rooms is a concise, use-led core guide with distinct evidence and a clear route to the next decision.

### G12 - Refine the Pergola Cost core guide

**Phase:** Phase 6 - Retained-guide content refinement  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Medium  
**Dependencies:** G09 and G10

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G12 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, the Context Pack, claims register, `apps/marketing/app/pergola-cost-auckland/content.ts`, the current Cost guide tests, and any page that links to cost guidance.

Refine `/pergola-cost-auckland` as the sole owner of guide-cluster cost education. Preserve:
- the groups of cost drivers
- the information that improves an early assessment
- early indication versus final quotation
- like-for-like quote comparison
- a readable inclusion, exclusion, GST, responsibility, and option checklist

Consolidate repeated statements that area alone is insufficient and that scope matters. Remove generic service process and broad design education owned elsewhere. Keep project examples only as scope examples, never price examples.

Do not publish a price, range, square-metre rate, historic quote, lead time, or offer schema. If approved pricing is still unavailable, retain the current evidence gate. Preserve the URL, canonical, indexation, sitemap, guide membership, form API, and route attribution.

Update focused tests and run the Cost route browser matrix, claim scan, marketing typecheck, and `npm run architecture:changed`.
```

**Context Codex must inspect**

- `apps/marketing/app/pergola-cost-auckland/content.ts`
- `apps/marketing/app/pergola-cost-auckland/page.tsx`
- `docs/marketing-claims-register.md` pricing row
- Cost references in other guide and service pages
- Current project records used as scope examples
- SEO programme tests

**Exact scope**

- One page only.
- Cost hierarchy, project examples, quote checklist, FAQs, and related links.
- No numerical pricing unless a separately approved later goal is created.

**Likely files**

- `apps/marketing/app/pergola-cost-auckland/content.ts`
- `apps/marketing/app/pergola-cost-auckland/page.tsx` only for material metadata alignment
- Focused tests

**Implementation requirements**

- Make assumptions, inclusions, exclusions, GST, options, professional inputs, and unresolved responsibilities visible.
- Keep project cards explicitly labelled as scope evidence.
- Retain a page-specific cost enquiry CTA.
- Use concise customer language without defensiveness.

**Exclusions and guardrails**

- No public price number.
- No quote calculator.
- No generic site-wide pricing rewrite.
- No Offer or Product schema.
- No route, canonical, sitemap, robots, or form API change.

**Acceptance criteria**

- The page remains the clear owner of cost and quote-comparison intent.
- Repetition is reduced without losing useful cost drivers or quotation checks.
- No project is presented as a price example.
- No unsupported commercial term appears.
- All existing technical SEO and conversion contracts remain.

**Tests to add or update**

- Update Cost route counts and section assertions in `marketing.seo-programme.spec.ts`.
- Add or retain an explicit assertion that no public price or Offer schema is present.
- Run SEO copy hygiene, focused route, and claim tests.
- Run marketing TypeScript.

**Manual checks**

- Read the page as a buyer comparing two quotations.
- Confirm the checklist makes differences in structure, site work, approvals, electrical work, and GST understandable.
- Check mobile density around the scope checklist and FAQ.

**SEO or redirect risk**

Medium content risk and high claim risk if pricing is added. This goal must remain number-free without approved evidence.

**Definition of done**

The Cost guide is shorter, owns cost education clearly, and retains a safe path to a scoped first assessment.

### G13 - Refine the Pergolas With Blinds core guide

**Phase:** Phase 6 - Retained-guide content refinement  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Medium  
**Dependencies:** G09 and G10

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G13 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, the Context Pack, claims register, the Blinds guide, the drop-down blind product page, relevant project records, and current tests.

Refine `/pergolas-with-blinds` as the decision guide for whether, where, and how a changing edge belongs. Preserve:
- directional edge mapping
- the affected activity and view
- head, side, bottom, power, and access conditions
- open and lowered states
- honest limits of a deployable edge

Move exact current system, operation, control, fabric, maintenance, and warranty detail to `/products/screens-walls/drop-down-blinds`. Keep manual or motorised wording only where current product evidence supports it. Distinguish blinds from slat screens and acrylic infill without creating a full product catalogue.

Use only project evidence that demonstrates a distinct edge decision. Qualify wind and rain language. Preserve the URL, canonical, indexation, sitemap, guide membership, form API, and CTA intent.

Update focused tests and run the Blinds route, product tests where links change, claim scan, marketing typecheck, and `npm run architecture:changed`.
```

**Context Codex must inspect**

- `apps/marketing/app/pergolas-with-blinds/content.ts`
- `apps/marketing/app/pergolas-with-blinds/page.tsx`
- `apps/marketing/data/products.ts` drop-down blind record
- Tindalls Bay, Waiheke, and Good Home project records
- Blinds guide and product Playwright tests
- Claims register blind and weather rows

**Exact scope**

- One guide page only, plus link-label corrections required to maintain the product boundary.
- Content hierarchy, project examples, FAQs, and related links.
- No product specification rewrite.

**Likely files**

- `apps/marketing/app/pergolas-with-blinds/content.ts`
- Focused tests
- `apps/marketing/data/products.ts` only if a link label must be corrected, not for specification changes

**Implementation requirements**

- The page must answer which edge needs to change and why.
- Exact product limits stay on the product page and in supplier evidence.
- Open-sided weather limits remain explicit.
- The CTA continues to ask for the affected edge, direction, and opening.

**Exclusions and guardrails**

- No generic weatherproof claim.
- No unsupported operating limit, wind rating, sensor, motor, warranty, or maintenance interval.
- No broad Outdoor Rooms rewrite.
- No new product route or guide route.
- No metadata or SEO identity change unless materially required.

**Acceptance criteria**

- The guide and product page have clearly different jobs.
- No current project example implies a sealed room or universal wind or rain result.
- Blind, slat, and acrylic infill pathways are understandable.
- The page retains one H1, one embedded form, no post-form CTA, its canonical
  and guide membership.

**Tests to add or update**

- Update route counts and expected sections in `marketing.seo-programme.spec.ts`.
- Run focused Blinds guide and product Playwright tests.
- Run `npx vitest run apps/marketing/data/products.test.ts apps/marketing/data/projects.claims.test.ts`.
- Run claim hygiene and marketing TypeScript.

**Manual checks**

- Read the page for a new pergola and an existing-pergola retrofit scenario.
- Check project cards against the approved project record.
- Confirm product links explain what additional detail the user will find.

**SEO or redirect risk**

Medium overlap risk with the blind product page. Preserve the guide's decision intent and the product page's current-system intent.

**Definition of done**

The Blinds guide owns edge planning, the product page owns exact system detail, and all weather language is proportionate.

### G14 - Refine the Acrylic vs Louvre core guide

**Phase:** Phase 6 - Retained-guide content refinement  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Medium to high  
**Dependencies:** G09 and G10

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G14 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, the Context Pack, claims register, the acrylic-versus-louvre guide, the fixed-acrylic page, Cost and Outdoor Rooms guides, and focused tests.

Refine `/acrylic-pergolas-vs-louvre-roofs` as a neutral comparison guide. Preserve:
- the requirement to define roof states and the effect on adjoining rooms
- one clear disclosure that Sanctuary's published offer is fixed acrylic, solid, and combination roofs
- the two-column evidence matrix
- the requirement to compare complete installed scope and exact supplier documents
- relevant fixed-roof project evidence

Remove repeated versions of the same louvre disclosure and repeated warnings that already appear in the matrix or claims note. Keep the comparison calm and non-adversarial. Do not state that Sanctuary supplies louvres unless the active claims register has approved that position.

Do not compare category-wide price, heat, ultraviolet, waterproofing, maintenance, wind, lifespan, or warranty performance. Preserve URL, canonical, indexation, sitemap, guide membership, form API, and external-proposal attachment pathway.

Update focused tests and run the comparison route, acrylic route, claim scan, marketing typecheck, and `npm run architecture:changed`.
```

**Context Codex must inspect**

- `apps/marketing/app/acrylic-pergolas-vs-louvre-roofs/content.ts`
- `apps/marketing/app/acrylic-pergolas-vs-louvre-roofs/page.tsx`
- `apps/marketing/app/acrylic-roof-pergolas-auckland/page.tsx` and content
- Cost and Outdoor Rooms guide links
- Claims register louvre and performance rows
- Comparison and acrylic Playwright tests

**Exact scope**

- One guide page only.
- Disclosure placement, matrix support copy, project evidence, process repetition, FAQs, and related links.
- No change to the current product-range position without approval.

**Likely files**

- `apps/marketing/app/acrylic-pergolas-vs-louvre-roofs/content.ts`
- Focused comparison tests
- The claims register only if an approved louvre position has formally changed

**Implementation requirements**

- One explicit Sanctuary fixed-roof disclosure near the top.
- The matrix must remain evidence-led and supplier-specific.
- No universal winner.
- The CTA must invite a common brief and external proposal evidence.

**Exclusions and guardrails**

- No competitor criticism.
- No category performance score.
- No current louvre offer claim without approval.
- No price or warranty comparison.
- No rewrite of the fixed-acrylic page.

**Acceptance criteria**

- The page answers the comparison question without repeated defensive copy.
- The disclosure is unambiguous and appears before the main matrix.
- The matrix retains exact-evidence prompts.
- No unsupported comparative claim appears.
- SEO and conversion identity remain stable.

**Tests to add or update**

- Update the comparison route assertions in `marketing.seo-programme.spec.ts`.
- Retain or update the louvre-position assertion in `marketing.guide-cluster-final-refinement.spec.ts`.
- Run comparison, acrylic, and claim-hygiene Playwright specs.
- Run marketing TypeScript.

**Manual checks**

- Read the page from the perspective of a homeowner holding an external louvre quote.
- Check the comparison matrix at narrow widths.
- Confirm fixed-acrylic project proof is not presented as evidence about louvres.

**SEO or redirect risk**

Medium cannibalisation risk with the acrylic landing page and high claim risk. Keep comparison intent and product intent distinct.

**Definition of done**

The comparison page is concise, neutral, evidence-led, and clear about Sanctuary fixed roofs without repeating or overstating the position.

### G15 - Refine the Gable secondary guide

**Phase:** Phase 6 - Retained-guide content refinement  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Medium  
**Dependencies:** G09 and G10

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G15 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, the Context Pack, claims register, the Gable guide, the gable product page, the Pitched guide, relevant projects, and focused tests.

Refine `/gable-pergolas-auckland` as a secondary form-selection guide. Preserve:
- ridge, eaves, pitch, width, and gable-end relationships
- attached versus freestanding considerations
- suitability tests based on available height, outlook, volume, and the existing house
- a small set of distinct project applications
- form-specific weather and structure limitations

Move current configuration, exact product, finish, maintenance, and warranty detail to `/products/pergolas/gable`. Remove generic service process, broad cost explanation, repeated consent caveats, and FAQs that are not specific to gable form.

Keep the page neutral. Do not promise a pitch range, span, post-free opening, drainage performance, consent outcome, or universal daylight result. Preserve URL, canonical, indexation, sitemap, guide membership, and form API.

Update focused tests and run the Gable, product, claim, and marketing typecheck gates.
```

**Context Codex must inspect**

- `apps/marketing/app/gable-pergolas-auckland/content.ts`
- `apps/marketing/app/gable-pergolas-auckland/page.tsx`
- `apps/marketing/data/products.ts` gable record
- `/pitched-pergolas-auckland` for intent separation
- Dairy Flat, St Heliers, Warkworth, Riverhead, and Good Home project records
- SEO programme and product tests

**Exact scope**

- One guide page only.
- Form-specific hierarchy, examples, FAQs, CTA support copy, and product handoff.
- No product specification change.

**Likely files**

- `apps/marketing/app/gable-pergolas-auckland/content.ts`
- Focused tests
- Page metadata file only if title or description no longer matches the refined role

**Implementation requirements**

- The guide must answer when a gable helps and what must be resolved.
- The gable product page must remain the exact current configuration destination.
- Project examples must represent distinct architectural roles.
- Keep one primary CTA based on roofline and section information.

**Exclusions and guardrails**

- No new form-comparison route in this goal.
- No generic pitch or span rule.
- No product or service rewrite.
- No URL or schema-role change.

**Acceptance criteria**

- The page is clearly different from the gable product page and Pitched guide.
- Generic process and duplicated FAQ content are reduced.
- Project evidence is distinct and current.
- No unsupported structural, weather, or approval claim appears.
- Current technical SEO and conversion contracts remain.

**Tests to add or update**

- Update Gable route counts and sections in `marketing.seo-programme.spec.ts`.
- Run Gable route, product, projects, and claim Playwright tests.
- Run products and project claim unit tests.
- Run marketing TypeScript.

**Manual checks**

- Read the page beside the gable product page and identify the different job of each.
- Check section drawing language and project cards on mobile.
- Confirm all links resolve and no optional form-comparison route is linked yet.

**SEO or redirect risk**

Medium overlap risk with `/products/pergolas/gable`. Maintain a neutral suitability guide versus current product presentation.

**Definition of done**

The Gable page is a focused secondary guide to form suitability, with exact product detail handed to the product page.

### G16 - Refine the Pitched secondary guide

**Phase:** Phase 6 - Retained-guide content refinement  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Medium  
**Dependencies:** G09 and G10

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G16 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, the Context Pack, claims register, the Pitched guide, the pitched product page, the Gable guide, relevant projects, and focused tests.

Refine `/pitched-pergolas-auckland` as a secondary mono-pitch form guide. Preserve:
- high edge, low edge, roof depth, fall, and drainage direction
- attachment versus freestanding considerations
- available-height and adjoining-room daylight questions
- a small set of distinct project applications
- form-specific open-edge and structural limitations

Move exact product, profile, finish, care, warranty, and current configuration detail to `/products/pergolas/pitched`. Remove generic service process, broad cost explanation, repeated consent material, and non-specific FAQs.

Do not publish a generic minimum pitch, maximum projection, span, gutter capacity, consent outcome, or universal drainage result. Correct or omit KiwiRail proof until G02 evidence is resolved. Preserve URL, canonical, indexation, sitemap, guide membership, and form API.

Update focused tests and run Pitched, product, project, claim, and marketing typecheck gates.
```

**Context Codex must inspect**

- `apps/marketing/app/pitched-pergolas-auckland/content.ts`
- `apps/marketing/app/pitched-pergolas-auckland/page.tsx`
- `apps/marketing/data/products.ts` pitched record
- `/gable-pergolas-auckland` for intent separation
- Tindalls, Velskov, Waiheke, Lilliput, and KiwiRail records
- SEO programme and product tests

**Exact scope**

- One guide page only.
- Mono-pitch hierarchy, project examples, FAQs, CTA support copy, and product handoff.
- No product specification change.

**Likely files**

- `apps/marketing/app/pitched-pergolas-auckland/content.ts`
- Focused tests
- Page metadata file only if materially misaligned

**Implementation requirements**

- The guide must explain the section from high edge to low edge.
- Keep drainage as a project path to resolve, not a guaranteed outcome.
- Keep exact current product data on the product page.
- Use one primary CTA asking for both edges and the house connection.

**Exclusions and guardrails**

- No new form-comparison route.
- No generic pitch, span, or water-capacity rule.
- No service-page rewrite.
- No route or schema-role change.

**Acceptance criteria**

- The page is distinct from the pitched product page and Gable guide.
- Generic process and repeated FAQ material are reduced.
- Project proof is current and the KiwiRail inconsistency does not reappear.
- No unsupported structural or weather claim appears.
- SEO and conversion contracts remain.

**Tests to add or update**

- Update Pitched route expectations in `marketing.seo-programme.spec.ts`.
- Run Pitched route, product, projects, and claim Playwright specs.
- Run products and project claim unit tests.
- Run marketing TypeScript.

**Manual checks**

- Read the page beside the pitched product page.
- Check the high-edge and low-edge explanation on mobile.
- Confirm project links and dimensions reflect G02.

**SEO or redirect risk**

Medium overlap risk with `/products/pergolas/pitched`. Keep the guide about suitability and the product page about current configuration.

**Definition of done**

The Pitched page is a focused secondary guide with honest section, height, and drainage decisions and no duplicated product role.

### G17 - Refine the Aluminium secondary guide

**Phase:** Phase 6 - Retained-guide content refinement  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Medium  
**Dependencies:** G09 and G10

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G17 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, the Context Pack, claims register, the Aluminium guide, the current product records, project evidence, and focused tests.

Refine `/aluminium-pergolas-auckland` as a secondary material and frame guide. Preserve:
- frame rhythm, member placement, visual weight, and openings
- house junctions, roof edge, drainage, and integrated services
- the fact that some completed structures combine aluminium and steel
- finish and coating questions framed around exact specification and site exposure
- selected project evidence

Remove generic service process, broad cost teaching, and repeated form descriptions owned by other guides and product pages. Fix the current card labelled "Compare gable and pitched forms" so its destinations and label agree.

Do not publish alloy, coating, corrosion, coastal, maintenance, warranty, span, or structural-capacity claims without approved exact evidence. Preserve URL, canonical, indexation, sitemap, guide membership, form API, and current Service-schema absence.

Update focused tests and run Aluminium, product, project, claim, and marketing typecheck gates.
```

**Context Codex must inspect**

- `apps/marketing/app/aluminium-pergolas-auckland/content.ts`
- `apps/marketing/app/aluminium-pergolas-auckland/page.tsx`
- `apps/marketing/data/products.ts` form records
- Dairy Flat, St Heliers, Ardmore, and Warkworth records
- Claims register structural and coastal rows
- SEO programme tests

**Exact scope**

- One guide page only.
- Material and frame hierarchy, selected evidence, FAQ, CTA, and related links.
- Correction of the gable-and-pitched link mismatch.

**Likely files**

- `apps/marketing/app/aluminium-pergolas-auckland/content.ts`
- Focused tests
- Page metadata only if materially misaligned

**Implementation requirements**

- Translate frame choices into customer-visible consequences.
- Keep mixed steel and aluminium wording project-specific.
- Ask for exact coating and care documents rather than promising performance.
- Link to form guides and product pages without repeating them.

**Exclusions and guardrails**

- No universal span or post-free claim.
- No general coastal suitability claim.
- No new product specifications.
- No broad custom-service rewrite.
- No route or schema change.

**Acceptance criteria**

- The page clearly owns frame and material decisions.
- The gable and pitched comparison link is accurate.
- Generic process and form repetition are reduced.
- Project evidence remains verified and specific.
- No unsupported finish, structural, or maintenance claim appears.

**Tests to add or update**

- Update Aluminium route expectations in `marketing.seo-programme.spec.ts`.
- Add a link assertion for the corrected form comparison handoff.
- Run product, project, and claim tests.
- Run marketing TypeScript.

**Manual checks**

- Read the page as a buyer asking what aluminium changes in the finished design.
- Check that mixed structural materials are clear without implying a standard assembly.
- Check all related links at mobile and desktop widths.

**SEO or redirect risk**

Medium overlap risk with form product pages. Keep the page centred on material and frame judgement rather than complete service or product ownership.

**Definition of done**

The Aluminium guide has a precise material role, accurate handoffs, and no unsupported structural or coastal promise.

### G18 - Refine the Commercial secondary guide

**Phase:** Phase 6 - Retained-guide content refinement  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Medium to high  
**Dependencies:** G09 and G10

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G18 in `velt-design/sanctuary`.

Read `AGENTS.md`, the roadmap, the Context Pack, claims register, the Commercial guide, commercial project records, contact routing, and focused tests.

Refine `/commercial-pergolas-auckland` as a secondary commercial planning and service resource. Preserve:
- operating plan, site plan, and responsibility plan
- circulation, frontage, services, staging, access, and handover
- project-team and consultant coordination
- distinct commercial project evidence
- Service schema and commercial search intent

Remove residential generic process, broad product catalogue copy, repeated cost teaching, and generic consent FAQs. Hand off detailed scope comparison to the Cost guide and difficult interfaces to the Custom service page. Use a commercial contact destination in CTA links while preserving the embedded enquiry flow until its dedicated contact-path goal.

Do not promise continuous operation, programme, compliance, accessibility, fire performance, structural capability, maintenance intervals, or handover documents unless they are explicitly in the project scope. Preserve URL, canonical, indexation, sitemap, secondary guide membership, Service schema, and enquiry API.

Update focused tests and run Commercial, project, contact-link, claim, and marketing typecheck gates.
```

**Context Codex must inspect**

- `apps/marketing/app/commercial-pergolas-auckland/content.ts`
- `apps/marketing/app/commercial-pergolas-auckland/page.tsx`
- Good Home, KiwiRail, Lilliput, and Atelier Shu records
- `apps/marketing/app/contact/enquiryRoute.ts`
- Commercial route and project Playwright tests
- Claims register commercial-relevant rows

**Exact scope**

- One guide page only.
- Commercial hierarchy, project evidence, FAQs, related links, and CTA destinations.
- No shared form behaviour change yet.

**Likely files**

- `apps/marketing/app/commercial-pergolas-auckland/content.ts`
- Focused tests
- Page metadata only if materially misaligned

**Implementation requirements**

- Keep commercial operations and responsibility ownership central.
- Link to Cost, Custom, Projects, and commercial or professional contact states.
- Preserve Service schema independently from secondary guide membership.
- Use current project evidence only.

**Exclusions and guardrails**

- No compliance guarantee.
- No delivery schedule promise.
- No commercial pricing guidance.
- No project record rewrite except through Phase 1.
- No shared enquiry API or attachment change.

**Acceptance criteria**

- The page is clearly commercial and not a residential guide with different labels.
- Generic repeated material is reduced.
- Project proof is current and each example represents a distinct operational context.
- CTA pathways are appropriate to commercial or professional users.
- Service schema and guide membership both remain correct.

**Tests to add or update**

- Update Commercial route expectations in `marketing.seo-programme.spec.ts`.
- Run commercial route, project, contact routing, and claim tests.
- Run marketing TypeScript.
- Run production build if CTA route handling changes server rendering.

**Manual checks**

- Read the page as a client, architect, and venue operator.
- Check commercial CTA destinations and form choice.
- Confirm no copy implies a consent, programme, or compliance outcome.

**SEO or redirect risk**

Medium content risk and medium schema risk. Preserve distinct commercial service intent while reducing generic material.

**Definition of done**

The Commercial page is a concise secondary guide and valid service page focused on operations, responsibility, and delivery context.

### G19 - Clarify product-to-guide ownership and handoffs

**Phase:** Phase 7 - Product, project, contact, and analytics connections  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Low to medium  
**Dependencies:** G09 and the relevant Phase 6 content goals

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G19 in `velt-design/sanctuary`.

Read `AGENTS.md`, this roadmap, the Sanctuary Context Pack, the claims register, `apps/marketing/data/products.ts`, `apps/marketing/components/products/ProductDetailPage.tsx`, and the retained guide content files.

Make product-to-guide handoffs explicit without rewriting the product catalogue. Product pages must own current configurations, exact options, supplier or selected-product evidence, specification, care, and product-fit questions. Guides must own neutral planning decisions, suitability, trade-offs, and the next customer question.

Audit the `guide` field and related links for all product records. Ensure pitched, gable, drop-down blinds, and relevant integrated products point to the correct retained guide with descriptive link labels. Keep hip and box-perimeter product pages linked to the products hub or the future form-comparison guide only when that route exists. Remove or revise any product-page wording that implies the product page and guide have the same role. Do not alter product URLs, Product schema, canonicals, indexation, enquiry behaviour, or product availability claims.

Update focused product data and browser tests. Run the product tests, marketing typecheck, relevant Playwright specs, production marketing build if shared product rendering changes, and `npm run architecture:changed`.
```

**Context Codex must inspect**

- `apps/marketing/data/products.ts`
- `apps/marketing/components/products/ProductDetailPage.tsx` and related product components
- `apps/marketing/data/products.test.ts`
- `playwright/marketing.products.spec.ts`
- Retained guide content files for Gable, Pitched, Blinds, Aluminium, and Outdoor Rooms
- `docs/Sanctuary_Pergolas_AI_Copywriting_Context_Pack.md` and `docs/marketing-claims-register.md`

**Exact scope**

- Audit and correct each product record's related planning-guide destination, label, and summary.
- Clarify product-versus-guide ownership in customer-facing handoff copy.
- Add focused tests that assert the intended guide mapping for relevant product records.
- Keep the product-page conversion path and related-product system intact.

**Likely files**

- `apps/marketing/data/products.ts`
- `apps/marketing/data/products.test.ts`
- `apps/marketing/components/products/ProductDetailPage.tsx` only if the handoff component needs a small semantic adjustment
- `playwright/marketing.products.spec.ts`
- Relevant retained-guide content files only for reciprocal link corrections

**Implementation requirements**

- Use descriptive labels such as `Review the pitched form guide` rather than generic `Learn more`.
- Do not duplicate product specifications inside guides.
- Do not imply that a planning guide is a product offer or that a product page is neutral editorial guidance.
- Preserve Product schema and existing project-evidence caveats.
- Keep all changed customer-facing copy in New Zealand English and free of em dashes.

**Exclusions and guardrails**

- No new product, supplier, warranty, performance, availability, or price claim.
- No product-page redesign.
- No new route.
- No change to product canonicals, sitemap entries, robots directives, or contact API.
- No implementation of the optional form-comparison guide in this goal.

**Acceptance criteria**

- Every relevant product record points to the correct current guide or intentionally has no guide dependency.
- Gable, Pitched, and Drop-down Blinds have reciprocal, role-clear links with their planning guides.
- Hip and Box-perimeter do not link to a nonexistent future guide.
- Product pages retain one H1, Product schema, current canonical, enquiry CTA, and related-product navigation.
- All internal destinations resolve directly.

**Tests to add or update**

- Update `apps/marketing/data/products.test.ts` with the guide-mapping contract.
- Update `playwright/marketing.products.spec.ts` to verify descriptive guide handoffs on representative form and integrated-product pages.
- Run `npx vitest run apps/marketing/data/products.test.ts`.
- Run `npx playwright test playwright/marketing.products.spec.ts --config=playwright.marketing.config.ts`.
- Run `npx tsc -p apps/marketing/tsconfig.json --noEmit --incremental false`.

**Manual checks**

- Open the products hub, Gable, Pitched, Hip, Box-perimeter, and Drop-down Blinds at desktop and mobile widths.
- Follow each related-guide link and confirm the destination answers a planning question rather than repeating the product page.
- Check that the product page still presents current options and evidence without relying on the guide for essential product facts.

**SEO or redirect risk**

Low. Internal link labels and destinations change, but no indexation, URL, canonical, or schema identity should change.

**Definition of done**

Product pages and planning guides have explicit, reciprocal, non-duplicative roles, with focused tests protecting the mapping.

### G20 - Replace heuristic project links with explicit context pathways

**Phase:** Phase 7 - Product, project, contact, and analytics connections  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Medium  
**Dependencies:** G01, G02, and G09

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G20 in `velt-design/sanctuary`.

Read `AGENTS.md`, this roadmap, the Context Pack, claims register, project data, `projectPresentation.ts`, project detail rendering, and project tests.

Replace the current broad project-link heuristic with a small typed, explicit context-link model. Each published project should be able to identify the most relevant planning guide, product or service destination, and enquiry pathway based on verified project evidence. Keep the visible module concise, normally one guide and one product or service link. Do not infer blind systems, controls, coating performance, structural capacity, or other facts from tags alone.

Route residential project CTAs to the residential contact state and commercial project CTAs to the commercial or professional state as appropriate, while preserving existing enquiry API, attachment, UTM, source-route, and attribution behaviour. Keep all project URLs, metadata, schema, order, and indexation unchanged.

Add unit and Playwright coverage for representative residential, commercial, gable, pitched, perimeter, acrylic, outdoor-room, and blind-related projects. Run focused project and contact tests, relevant Playwright specs, marketing typecheck, and `npm run architecture:changed`.
```

**Context Codex must inspect**

- `apps/marketing/data/projects.ts`
- `apps/marketing/app/projects/projectPresentation.ts`
- `apps/marketing/app/projects/ProjectDetailContent.tsx`
- `apps/marketing/app/projects/projectPresentation.test.ts`
- `apps/marketing/data/projects.claims.test.ts`
- `playwright/marketing.projects.spec.ts` and `playwright/marketing.contact.spec.ts`
- Current contact query-state and attribution contracts

**Exact scope**

- Introduce an explicit typed project context-link field or a single typed project-link map owned by the project domain.
- Use the explicit data in `getProjectContextLinks` instead of deriving important claims from tags.
- Set appropriate residential, commercial, or professional contact destinations for project CTAs.
- Limit visible context links to the most useful next steps.

**Likely files**

- `apps/marketing/data/projects.ts`
- `apps/marketing/app/projects/projectPresentation.ts`
- `apps/marketing/app/projects/ProjectDetailContent.tsx` if the link model requires a small rendering change
- `apps/marketing/app/projects/projectPresentation.test.ts`
- `playwright/marketing.projects.spec.ts`
- `playwright/marketing.contact.spec.ts` only for query-state continuity

**Implementation requirements**

- Use project evidence only where the project record supports the link.
- Prefer one planning guide plus one product or service destination over a long related-link list.
- Commercial projects must not default to a residential enquiry state.
- Preserve project route metadata, WebPage schema, breadcrumbs, galleries, related-project pagination, and project order.
- Keep changed copy factual and free of em dashes.

**Exclusions and guardrails**

- No project-page redesign.
- No new project claim.
- No change to project URLs, canonicals, robots, sitemap, or project schema.
- No change to the enquiry API or upload contract.
- No analytics implementation in this goal.

**Acceptance criteria**

- Context links are explicitly declared and type checked.
- Representative projects route to relevant guides and products without relying on generic tags for unsupported detail.
- Residential and commercial project CTAs open the appropriate contact state.
- No project exposes more context links than the defined concise limit.
- All context and contact destinations resolve directly.

**Tests to add or update**

- Add unit tests for the explicit project-link mapping and contact destination.
- Update `playwright/marketing.projects.spec.ts` for representative project pathways.
- Run `npx vitest run apps/marketing/app/projects/projectPresentation.test.ts apps/marketing/data/projects.claims.test.ts apps/marketing/app/contact/enquiryRoute.test.ts`.
- Run `npx playwright test playwright/marketing.projects.spec.ts playwright/marketing.contact.spec.ts --config=playwright.marketing.config.ts`.
- Run marketing TypeScript.

**Manual checks**

- Check Warkworth, Riverhead, Tindalls Bay, Gable, Pitched, Perimeter, Good Home, KiwiRail, and Atelier Shu project pages.
- Confirm the planning link is relevant to the published design decision.
- Open each project CTA and confirm the contact form state is correct and attribution remains available.

**SEO or redirect risk**

Low to medium. Internal link distribution changes, but no project identity or indexation should change. Crawl the affected project pages after release.

**Definition of done**

Project case studies provide explicit, evidence-based pathways into the guide, product, service, and enquiry ecosystem.

### G21 - Add consent-gated guide journey analytics

**Phase:** Phase 7 - Product, project, contact, and analytics connections  
**Status:** Not started  
**Relative effort:** Medium  
**Implementation risk:** Medium  
**Dependencies:** G07, G09, G19, and G20

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G21 in `velt-design/sanctuary`.

Read `AGENTS.md`, `docs/security-privacy-quality.md`, `docs/testing-and-qa.md`, this roadmap, the existing consent provider, homepage interaction tracker, guide hub, guide navigation, product handoffs, project context links, and enquiry attribution code.

Add a small consent-gated analytics layer for the guide journey. Track only useful navigation events: hub core-guide click, hub secondary-guide click, hub service-pathway click, guide-to-guide click, guide-to-product click, guide-to-project click, guide-to-service click, and guide-originated form submission or contact transition. Include source route, destination, guide tier or relationship type, and viewport category where available. Do not send personal data, form values, project addresses, free text, or attachment information.

Reuse the existing consent and dataLayer conventions. No analytics or marketing event may fire before the relevant stored consent. Analytics failure must never block navigation or enquiry submission. Preserve existing homepage and lead events unless an exact duplicate is intentionally consolidated and tested.

Update consent and focused browser tests, the security/privacy owner doc if event behaviour changes, marketing typecheck, and `npm run architecture:changed`.
```

**Context Codex must inspect**

- `docs/security-privacy-quality.md`
- `apps/marketing/components/ConsentProvider.tsx` and tracking helpers
- `apps/marketing/app/_home/HomepageDesignConversationTracker.tsx`
- `apps/marketing/app/pergola-guides/page.tsx`
- Guide relationship/navigation components created in G09
- `apps/marketing/app/acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm.tsx`
- `playwright/marketing.consent.spec.ts`, guide-hub tests, product tests, project tests, and contact tests

**Exact scope**

- Define a compact event taxonomy for guide-journey clicks and conversions.
- Implement consent-gated event delegation or a small reusable tracker for the guide ecosystem.
- Add source-route and destination context without collecting personal data.
- Document the event names and properties in the appropriate current-state tracking doc.

**Likely files**

- A new narrowly scoped tracker under `apps/marketing/components` or `apps/marketing/lib`
- `apps/marketing/app/pergola-guides/page.tsx` and guide relationship component for data attributes
- `apps/marketing/components/products/ProductDetailPage.tsx` and project detail components only for data attributes
- `apps/marketing/app/acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm.tsx` only if a non-duplicative guide-origin property is needed
- `playwright/marketing.consent.spec.ts` and focused page specs
- `docs/security-privacy-quality.md`

**Implementation requirements**

- Analytics must be disabled before explicit analytics consent.
- Marketing pixels must remain separately controlled by marketing consent.
- Event payloads may contain route, destination, tier, relationship, item identifier, and viewport category only.
- Navigation and form submission must work when tracking throws or is blocked.
- Keep event naming stable and documented.

**Exclusions and guardrails**

- No third-party analytics product change.
- No new cookie, consent category, pixel, or personal-data field.
- No alteration to enquiry request contents except a narrowly justified non-personal source classification already supported by the API.
- No guide-hub visual redesign.
- No invented performance target.

**Acceptance criteria**

- No guide-journey event fires before stored analytics consent.
- Expected events fire once after consent on representative hub, guide, product, project, and form pathways.
- Events contain source and destination context but no personal or free-text data.
- Existing lead events and homepage events remain intact and non-duplicated.
- Tracking errors do not block navigation or successful enquiry submission.

**Tests to add or update**

- Extend `playwright/marketing.consent.spec.ts` to observe guide events before and after consent.
- Add focused assertions to guide-hub, product, project, and contact specs for event attributes or dataLayer payloads.
- Run `npm run test:marketing`.
- Run the relevant marketing Playwright specs with the marketing config.
- Run marketing typecheck and lint for changed files.

**Manual checks**

- Use browser developer tools with no stored consent, analytics-only consent, and analytics-plus-marketing consent.
- Click each defined relationship type and inspect the dataLayer.
- Submit a mocked enquiry from a guide and confirm one lead event plus the intended journey context.

**SEO or redirect risk**

None directly. The primary risk is privacy or duplicate-event regression, not search visibility.

**Definition of done**

The guide ecosystem has a documented, consent-safe event taxonomy that measures progression without collecting personal data or affecting conversion behaviour.

### G22 - Align the homepage guide gateway with the curated library

**Phase:** Phase 8 - Homepage and global discovery  
**Status:** Not started  
**Relative effort:** Small to medium  
**Implementation risk:** Low  
**Dependencies:** G07 and G09

> **Current-owner note (2 August 2026):** The ready-to-use prompt, file list and
> test command below describe the retired homepage owner and must not be run as
> written. Re-scope this goal to `app/_home-project-finder/**` and
> `marketing.home-project-finder.spec.ts`, preserving the approved project-led
> structure unless a separate product decision authorises a placement change.

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G22 in `velt-design/sanctuary`.

Read `AGENTS.md`, this roadmap, the homepage content and component, the curated guide registry, the Context Pack, and homepage tests.

Update the existing homepage planning-guide gateway so it reflects the curated library. Feature three core customer decisions: planning the complete outdoor room, understanding pergola cost and scope, and comparing fixed acrylic roofs with louvre proposals. Use customer-question language, preserve the link to `/pergola-guides`, and keep the module subordinate to project, product, service, and enquiry pathways.

Move the existing guide gateway only if the current page order places it materially after less relevant process or reassurance content. The intended position is after form, roof, and integrated-option orientation and before the final process or conversion sequence, without redesigning unrelated homepage sections. Preserve all existing homepage URLs, metadata, review integrations, consent, event contracts, and performance budgets.

Update homepage browser tests and event assertions. Do not add a new guide topic or rewrite the homepage.
```

**Context Codex must inspect**

- `apps/marketing/app/_home/Homepage.tsx`
- `apps/marketing/app/_home/content.ts`
- `apps/marketing/app/_home/homepage.module.css` only if a small placement
  adjustment is necessary
- `playwright/marketing.homepage.spec.ts`
- Curated guide data from G07
- Existing homepage guide click events

**Exact scope**

- Update the three featured guide cards and their order.
- Confirm the full-library link remains visible.
- Adjust the section's position within the homepage only if required by the approved journey.
- Preserve existing homepage conversion and project pathways.

**Likely files**

- `apps/marketing/app/_home/content.ts`
- `apps/marketing/app/_home/Homepage.tsx`
- `playwright/marketing.homepage.spec.ts`
- Homepage interaction tests if the event payload changes

**Implementation requirements**

- Feature only current core guides.
- Use restrained, decision-led copy.
- Keep `Explore all pergola guides` or an equivalent explicit hub link.
- Preserve consent-gated event attributes and all current project and enquiry
  actions.
- Keep customer-facing copy free of em dashes.

**Exclusions and guardrails**

- No homepage hero rewrite.
- No redesign of product, project, review, process or enquiry pathways.
- No new analytics system.
- No new route.
- No change to homepage canonical, schema, robots, or metadata unless a factual error is discovered.

**Acceptance criteria**

- The homepage guide gateway features Outdoor Rooms, Cost, and Acrylic versus Louvre.
- The full guide-hub link is present and resolves directly.
- The gateway appears at the approved point in the homepage journey on desktop and mobile.
- Existing project, product, contact, review, and estimate pathways remain functional.
- Homepage performance and mobile-height checks continue to pass.

**Tests to add or update**

- Update `playwright/marketing.homepage.spec.ts` for guide order, links,
  placement, mobile visibility and event attributes.
- Run `npx playwright test playwright/marketing.homepage.spec.ts --config=playwright.marketing.config.ts`.
- Run marketing typecheck.
- Run the production marketing build if section order or shared rendering changes.

**Manual checks**

- Review the homepage at 320, 390, 430, 768, 1024, and 1440 pixel widths.
- Confirm the guide gateway is visible but does not compete with the primary enquiry and project pathways.
- Follow all three guide links and the full-library link.

**SEO or redirect risk**

Low. Internal link prominence changes, but the homepage URL, metadata, canonical, and schema remain unchanged.

**Definition of done**

The homepage promotes the curated planning library through three high-value decisions without becoming a guide-directory landing page.

### G23 - Add the curated guide hub to global navigation

**Phase:** Phase 8 - Homepage and global discovery  
**Status:** Not started  
**Relative effort:** Small  
**Implementation risk:** Low to medium  
**Dependencies:** G07 and production readiness of the restructured hub

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G23 in `velt-design/sanctuary`.

Read `AGENTS.md`, this roadmap, `Header.tsx`, shared-header styles and tests, the guide hub, and accessibility guidance.

Add a `Guides` link to the desktop and mobile primary navigation after the curated guide hub is ready. Preserve Home, Projects, Products, Contact, the estimate CTA, header overlay behaviour, active-state behaviour, mobile focus handling, scroll locking, and minimum target sizes. The active state should cover `/pergola-guides` and actual guide members, but it must not incorrectly mark broad service or product pages as Guides solely because they share historical programme code.

Do not redesign the header or change the estimate CTA. Update shared-header and hero-navigation tests across supported widths. Run focused Playwright, marketing typecheck, and `npm run architecture:changed`.
```

**Context Codex must inspect**

- `apps/marketing/components/Header.tsx`
- Header and navigation CSS
- `playwright/marketing.shared-header.spec.ts`
- `playwright/marketing.hero-navigation.spec.ts`
- Curated guide membership API from G04 through G07
- Mobile navigation accessibility behaviour

**Exact scope**

- Add a Guides link to desktop primary navigation.
- Add a Guides link to the mobile menu.
- Implement an accurate active state based on actual guide membership and the hub route.
- Preserve all existing header and mobile-menu interactions.

**Likely files**

- `apps/marketing/components/Header.tsx`
- Relevant shared header style files only if spacing requires a small adjustment
- `playwright/marketing.shared-header.spec.ts`
- `playwright/marketing.hero-navigation.spec.ts`

**Implementation requirements**

- Use one source of truth for actual guide membership where practical.
- Do not classify `/pergolas-auckland`, `/custom-pergolas-auckland`, product routes, or project routes as active Guides.
- Maintain keyboard focus, Escape handling, scroll preservation, and 44 pixel mobile target expectations.
- Preserve overlay-to-solid header behaviour on all hero routes.

**Exclusions and guardrails**

- No header redesign or navigation taxonomy expansion beyond Guides.
- No resource or blog section.
- No CTA label change.
- No route, sitemap, schema, or metadata change.
- No new analytics beyond existing navigation event attributes.

**Acceptance criteria**

- Guides is visible and functional in desktop and mobile navigation.
- The active state is correct on the hub and actual guides and absent on service and product pages.
- Existing navigation items and estimate CTA remain visible and functional.
- Mobile menu focus, Escape, scroll locking, and close-on-navigation behaviour remain intact.
- No header overflow appears at supported desktop widths.

**Tests to add or update**

- Update `playwright/marketing.shared-header.spec.ts` for link presence, active states, keyboard behaviour, and representative widths.
- Update `playwright/marketing.hero-navigation.spec.ts` if route-state expectations change.
- Run both focused Playwright specs with `playwright.marketing.config.ts`.
- Run marketing typecheck.

**Manual checks**

- Check 320, 390, 430, 720, 768, 1024, and 1440 pixel widths.
- Navigate between hub, core guide, secondary guide, service page, product page, project page, and contact.
- Verify active states and overlay contrast.

**SEO or redirect risk**

Low. This increases internal prominence of the hub without changing indexation. The main implementation risk is header layout or inaccurate active-state classification.

**Definition of done**

The curated guide library is globally discoverable through an accessible Guides link with correct active-state semantics.

### G24 - Implement the optional pergola-form comparison guide

**Phase:** Phase 9 - Optional new guides  
**Status:** Not started  
**Relative effort:** Large  
**Implementation risk:** Medium  
**Dependencies:** G07, G09, G15, G16, G19, and verified project records

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G24 in `velt-design/sanctuary`.

This is an optional new-content goal. Confirm it is authorised before coding.

Read `AGENTS.md`, this roadmap, the Context Pack, claims register, form product records, Gable and Pitched guides, relevant project records, shared SEO landing components, sitemap, guide registry, and tests.

Create one new neutral planning route at `/pergola-forms-auckland` that helps customers compare Pitched, Gable, Hip, and Box-perimeter forms through actual decisions: available height, relationship to the house roofline, perceived volume, outlook, attachment, drainage direction, roof depth, intended use, and site constraints. It must not describe one form as universally best, publish generic pitch or span limits, duplicate product specifications, or turn into four keyword sections.

Use verified Sanctuary project evidence to show distinct applications. Link to the four current product pages and the detailed Gable and Pitched secondary guides. Add the route as a core guide, update the curated hub and ItemList, sitemap, contextual relationships, metadata, WebPage schema, breadcrumb, and focused tests. Do not alter existing form URLs or redirect any page.

This is the maximum acceptable scope for one new-route PR. If the diff also requires a major shared-component refactor or rewrites existing guides, stop and split the work into a route-content PR and a later ecosystem-integration PR.
```

**Context Codex must inspect**

- `apps/marketing/data/products.ts` form records
- `apps/marketing/app/gable-pergolas-auckland/content.ts`
- `apps/marketing/app/pitched-pergolas-auckland/content.ts`
- `apps/marketing/data/projects.ts` and claims tests
- `apps/marketing/components/seo-landing/*`
- `apps/marketing/data/pergolaGuides.ts` after the typed ecosystem refactor
- `apps/marketing/app/pergola-guides/page.tsx`
- `apps/marketing/app/sitemap.ts`
- Marketing guide, product, SEO, and claim tests

**Exact scope**

- Create one new form-comparison page and its route-owned content.
- Add the page as a core guide and update the hub, relationships, sitemap, and structured data.
- Use four form products and a small set of verified project examples.
- Add reciprocal links from form products and detailed form guides where useful.

**Likely files**

- `apps/marketing/app/pergola-forms-auckland/page.tsx`
- `apps/marketing/app/pergola-forms-auckland/content.ts`
- Shared page types or blocks only if an existing pattern cannot express the comparison cleanly
- `apps/marketing/data/pergolaGuides.ts`
- `apps/marketing/app/pergola-guides/page.tsx` only for data-driven integration
- `apps/marketing/app/sitemap.ts`
- `apps/marketing/data/products.ts` for reciprocal links
- Focused Vitest and Playwright specs

**Implementation requirements**

- Compare forms through customer decisions, not a scorecard or keyword list.
- Keep product specifications on product pages.
- Use project examples as contextual evidence, not universal proof.
- Use one self-canonical URL, one H1, WebPage schema, guide breadcrumb, and contextual relationships.
- Keep all claims conditional where structure, pitch, drainage, exposure, or approval is project-specific.
- Keep customer-facing copy free of em dashes.

**Exclusions and guardrails**

- No redirect or consolidation of Gable, Pitched, Hip, or Box-perimeter pages.
- No new form or product offer.
- No numeric span, pitch, wind, weather, performance, price, warranty, timing, or consent claim.
- No broad redesign of the guide hub.
- No implementation of the consent guide.

**Acceptance criteria**

- The new route answers the form-choice question distinctly from product and single-form pages.
- All four current forms are compared using the same decision dimensions.
- The route is core-visible in the hub and included once in ItemList and sitemap.
- All product and related-guide links resolve directly.
- Existing form pages retain their URLs, metadata, canonicals, indexation, and roles.
- Responsive, accessibility, metadata, schema, claim, and originality tests pass.

**Tests to add or update**

- Add route and content unit tests where data ownership benefits from them.
- Extend guide-hub tests for the additional core guide and ItemList order.
- Extend SEO programme or a focused new-guide spec for metadata, schema, one H1, direct 200, links, form attribution, and mobile overflow.
- Run product tests and `playwright/marketing.products.spec.ts` for reciprocal links.
- Run project claim tests for every evidence card used.
- Run marketing typecheck, focused Playwright, and production build.

**Manual checks**

- Review the comparison at 320, 390, 430, 768, 1024, and 1440 pixel widths.
- Confirm a customer can understand why each form may or may not suit without reading every product page.
- Check that the new guide does not make Gable or Pitched pages redundant.
- Inspect all project facts against the approved project record.

**SEO or redirect risk**

Medium. The new route is intentionally indexable and may overlap form product and detailed-guide queries. Distinct metadata, headings, internal ownership, and post-launch Search Console monitoring are required.

**Definition of done**

A neutral, evidence-led form-comparison guide is live as a core guide without cannibalising or redirecting existing form and product pages.

### G25 - Prepare the consent-guide evidence and governance gate

**Phase:** Phase 9 - Optional new guides  
**Status:** Not started  
**Relative effort:** Small to medium  
**Implementation risk:** High subject-matter risk  
**Dependencies:** G03 and business participation

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G25 in `velt-design/sanctuary`.

This is a governance and evidence goal. Do not create a public route.

Read `AGENTS.md`, this roadmap, the Context Pack, claims register, current consent wording across service and guide pages, and the repository documentation rules.

Create a concise approval brief for a future Auckland pergola consent and site-constraints guide. Inventory the customer questions already repeated across the guide ecosystem, the site and design variables that can change the pathway, the current fallback wording, and every factual assertion that requires current authority or legal review. Identify the evidence owner, source date, review cadence, approved terminology, expiry or re-review trigger, and the precise route implementation that remains blocked.

Update `docs/marketing-claims-register.md` only if the consent gate needs a clearer evidence or owner field. Link the brief from this roadmap or the active landing-page programme. Do not quote or paraphrase legal requirements from memory, do not browse from code, and do not publish thresholds, exemptions, or approval promises.

Run docs-only guards and return the unresolved approval checklist.
```

**Context Codex must inspect**

- `docs/Sanctuary_Pergolas_AI_Copywriting_Context_Pack.md`
- `docs/marketing-claims-register.md`
- `docs/landing-pages/sanctuary-pergola-guide-ecosystem-roadmap.md`
- Current consent and approval FAQs in service and guide content files
- `docs/README.md`, `AGENTS.md`, and documentation guard rules

**Exact scope**

- Create one concise consent-guide approval brief.
- Inventory repeated current questions and safe fallback wording.
- Define required external sources, internal owner, review date, and change triggers.
- Record which implementation goal is blocked until approval.

**Likely files**

- A new concise document such as `docs/landing-pages/pergola-consent-guide-approval-brief.md`
- `docs/marketing-claims-register.md` only for governance clarification
- `docs/landing-pages/sanctuary-pergola-guide-ecosystem-roadmap.md` or `seo-landing-page-programme.md` for a link and status update

**Implementation requirements**

- Clearly separate current repository wording from facts requiring external validation.
- Name the approval owner and evidence requirements.
- Define safe fallback language that remains project-specific.
- Keep the document ASCII and repo-relative.
- State explicitly that the brief is not public legal or building-consent advice.

**Exclusions and guardrails**

- No public route, metadata, sitemap, navigation, schema, or customer-facing copy.
- No legal conclusion, consent threshold, or exemption claim.
- No unverified authority citation.
- No implementation of G26.
- No unrelated documentation expansion.

**Acceptance criteria**

- The approval brief lists all evidence required before a public consent guide can be implemented.
- The claims register and roadmap clearly show the blocked status and owner.
- Safe fallback wording allows current pages to remain useful without stronger legal claims.
- No public application file changes.
- Docs navigation and guard checks pass.

**Tests to add or update**

- Run `npm run docs:guard`.
- Run `npm run docs:impact`.
- Run `npm run docs:navigation`.
- Run `npm run text:mojibake`.

**Manual checks**

- Have the Sanctuary design or legal owner review the checklist.
- Confirm every proposed source has an owner, publication or retrieval date, and re-review trigger.
- Confirm the document cannot be mistaken for approved customer advice.

**SEO or redirect risk**

None. This goal creates no public route. Its purpose is to prevent a high-risk SEO page from being published without governance.

**Definition of done**

A reviewed approval package exists, and the public consent guide remains explicitly blocked until the named evidence and terminology are approved.

### G26 - Implement the approved consent and site-constraints guide

**Phase:** Phase 9 - Optional new guides  
**Status:** Not started  
**Relative effort:** Large  
**Implementation risk:** High  
**Dependencies:** G25 completed with written approval, plus G07 and G09

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G26 in `velt-design/sanctuary`.

Do not start unless the approval brief created in G25 contains current written approval, named sources, approved terminology, an owner, and a review date.

Read `AGENTS.md`, this roadmap, the approved consent brief, Context Pack, claims register, current repeated consent content, shared guide components, guide registry, sitemap, and tests.

Create one public planning route at `/pergola-consent-auckland`. Explain which property, use, height, boundary, attachment, existing-condition, structural, drainage, and documentation variables may affect the assessment; what Sanctuary can review; what requires authority or professional confirmation; and what information a customer should gather. Use only approved wording from the evidence brief. Do not promise exemption, approval, council outcome, or a universal area or height rule.

Add the route as a core guide, with a visible source-review date, owner, self-canonical, WebPage schema, guide breadcrumb, contextual links, sitemap entry, and contact pathway. Replace repeated generic consent FAQs on other guides only with a concise handoff to the new guide. Add strong tests for approved statements and prohibited blanket claims.

If the approved evidence package is incomplete, stop and report the missing gate instead of implementing a weaker page.
```

**Context Codex must inspect**

- Approved `docs/landing-pages/pergola-consent-guide-approval-brief.md`
- `docs/marketing-claims-register.md`
- All current guide and service content containing consent or approval questions
- `apps/marketing/components/seo-landing/*`
- `apps/marketing/data/pergolaGuides.ts`
- `apps/marketing/app/pergola-guides/page.tsx`
- `apps/marketing/app/sitemap.ts`
- SEO, guide-hub, claim, contact, and accessibility tests

**Exact scope**

- Create one approved public consent and site-constraints guide.
- Add core guide membership, sitemap, metadata, schema, contextual links, and a relevant enquiry pathway.
- Replace duplicated generic consent explanations with concise links to the guide.
- Add review-date and governance cues required by the approval brief.

**Likely files**

- `apps/marketing/app/pergola-consent-auckland/page.tsx`
- `apps/marketing/app/pergola-consent-auckland/content.ts`
- `apps/marketing/data/pergolaGuides.ts`
- `apps/marketing/app/pergola-guides/page.tsx` through data-driven rendering
- `apps/marketing/app/sitemap.ts`
- Relevant retained-guide and service content files for concise handoffs
- Focused Vitest and Playwright specs
- `docs/marketing-claims-register.md` for approved status and review date

**Implementation requirements**

- Use only the approved evidence and terminology.
- Display the evidence review date and responsible owner in a way that does not imply a guaranteed outcome.
- Distinguish Sanctuary's initial assessment from authority, legal, planning, engineering, or other professional determination.
- Keep all conclusions conditional on the actual site and completed design.
- Keep customer-facing copy free of em dashes.

**Exclusions and guardrails**

- No blanket area, height, boundary, or attachment rule.
- No legal advice or promise of consent exemption or approval.
- No unapproved cost, timing, engineering, structural, or service-scope claim.
- No redirect or removal of existing service pages.
- No second new route in the same PR.

**Acceptance criteria**

- The page answers a genuine planning question using current approved evidence.
- No prohibited blanket rule or certainty language appears.
- The route is core-visible in the hub, included once in ItemList and sitemap, and linked from repeated consent questions.
- Metadata, canonical, schema, review date, accessibility, links, form attribution, and responsive layout pass.
- The claims register records the exact approval owner and review date.

**Tests to add or update**

- Add source-level tests for every approved key statement and every prohibited blanket formulation.
- Extend guide-hub and SEO route tests.
- Extend `marketing.seo-copy-hygiene.spec.ts` with contextual consent rules.
- Run contact attribution tests for the page.
- Run marketing typecheck, focused Playwright, unit tests, docs guards, and production build.

**Manual checks**

- Have the named design or legal owner review the rendered production candidate.
- Verify all source links or citations in the approved internal evidence pack remain current.
- Check mobile disclosure, heading order, CTA, and all related links.
- Confirm the page does not answer a project-specific consent question without assessment.

**SEO or redirect risk**

High subject-matter and medium search risk. The route can attract high-value queries, but inaccurate or stale advice creates legal, trust, and search-quality risk. Do not release without the documented approval gate.

**Definition of done**

The approved consent guide is live, governed, date-stamped, technically sound, and the single owner of generic consent planning within the guide ecosystem.

### G27 - Consolidate the acrylic copy variant

**Phase:** Phase 10 - Variant consolidation, documentation, and final regression  
**Status:** Complete, 29 July 2026
**Relative effort:** Small to medium  
**Implementation risk:** Low  
**Dependencies:** Approved editorial consolidation decision; external
Search Console and link monitoring remain a post-release check

**Implemented outcome:** Useful copy was consolidated into the shorter primary
acrylic page. The v2 source and variant-only presentation were retired.
`apps/marketing/next.config.ts` owns a permanent one-hop redirect to the
self-canonical primary route, and the redirect spec checks the response with
automatic following disabled.

**Historical Codex goal prompt (completed; do not rerun)**

The prompt below is retained as implementation evidence. Its decision gate and
v2 source paths are no longer current instructions.

```text
Work only on roadmap goal G27 in `velt-design/sanctuary`.

Read `AGENTS.md`, this roadmap, the primary and v2 acrylic routes, their tests, redirect configuration, sitemap, Search Console notes if available, and the documented copy decision.

Only proceed when the owner has chosen which v2 copy elements, if any, belong on `/acrylic-roof-pergolas-auckland`. Merge only approved winning content into the primary route. Then replace `/acrylic-roof-pergolas-auckland-v2` with a one-hop permanent redirect to the primary route. Remove internal references and obsolete copy-variant tests or fixtures only after proving they are unused. Keep the primary route self-canonical, indexable, in the sitemap, and technically unchanged outside the approved copy.

Do not redirect or change any other guide, service, product, or project page. Preserve the primary acrylic page's role as an indexed product and service landing page outside the curated guide hub.

Add redirect and regression tests, run focused acrylic, SEO, redirect, dead-code, marketing typecheck, build, and `npm run architecture:changed`.
```

The remaining G27 scope and checklists are historical implementation evidence;
references to v2 source files describe paths that existed before retirement.

**Context Codex must inspect**

- `apps/marketing/app/acrylic-roof-pergolas-auckland/page.tsx` and content
- `apps/marketing/app/acrylic-roof-pergolas-auckland-v2/page.tsx` and content
- `apps/marketing/next.config.ts` redirect configuration
- `apps/marketing/app/sitemap.ts`
- `playwright/marketing.acrylic-foundation.spec.ts`
- `playwright/marketing.acrylic-copy-variant.spec.ts`
- `playwright/marketing.guide-cluster-final-refinement.spec.ts`
- Any Search Console or external-link evidence available to the owner

**Exact scope**

- Merge approved v2 content into the primary acrylic page.
- Add one permanent redirect from the v2 route to the primary route.
- Remove internal v2 references and retire variant-only code and tests after proving they are unused.
- Protect the primary route's metadata, canonical, indexation, schema, sitemap, and conversion path.

**Likely files**

- Primary and v2 acrylic route files
- `apps/marketing/next.config.ts`
- Relevant acrylic and SEO tests
- Dead-code or decomposition registry only if needed for retired files
- Active landing-page programme or roadmap status

**Implementation requirements**

- The redirect must be permanent and one hop.
- The primary route remains the only indexable canonical acrylic landing page.
- Any merged copy must pass the Context Pack and claims register.
- Retirement must follow `docs/code-retirement-and-bloat-control.md` and repo search.
- No customer-facing em dash may be introduced.

**Exclusions and guardrails**

- No change to the acrylic versus louvre comparison route.
- No redirect of product or guide pages.
- No new supplier, tint, warranty, UV, heat, waterproof, maintenance, or availability claim.
- No broad acrylic-page redesign.
- No deletion before proving no live consumers remain.

**Acceptance criteria**

- The v2 route returns a permanent one-hop redirect to the primary route.
- The primary route is self-canonical, indexable, in the sitemap, and has one H1 and one conversion path.
- No internal link references the v2 route.
- Variant-only code and tests are removed or intentionally retained with a documented reason.
- All acrylic and programme regression tests pass.

**Tests to add or update**

- Add a direct redirect assertion with redirects disabled.
- Update or retire `playwright/marketing.acrylic-copy-variant.spec.ts` appropriately.
- Run acrylic foundation, guide-cluster final refinement, SEO hygiene, and route-resolution specs.
- Run `npm run dead-code:changed` for retired files.
- Run marketing typecheck and production build.

**Manual checks**

- Check the primary acrylic page on mobile and desktop.
- Inspect the v2 response headers and redirect target.
- Search the repository and generated site for the v2 path.
- Confirm external-link and Search Console checks have been recorded by the owner.

**SEO or redirect risk**

Low. Keep the permanent redirect one hop and check external links without
restoring a second content or canonical owner.

**Definition of done**

One authoritative acrylic landing page remains, with the test variant permanently redirected and all obsolete internal references safely retired.

### G28 - Synchronise governance docs and run final ecosystem regression

**Phase:** Phase 10 - Variant consolidation, documentation, and final regression  
**Status:** In progress; copy-reduction docs aligned, final regression pending
**Relative effort:** Medium  
**Implementation risk:** Medium  
**Dependencies:** All approved required goals; optional goals only if authorised and completed

**Ready-to-use Codex goal prompt**

```text
Work only on roadmap goal G28 in `velt-design/sanctuary`.

Read `AGENTS.md`, `docs/README.md`, `docs/testing-and-qa.md`, this roadmap, the old guide-cluster implementation documents, current guide model, hub, service pages, guides, product and project links, sitemap, robots, redirects, analytics, and all marketing tests.

Bring current-state documentation and regression tests into alignment with the completed guide ecosystem. Update the old programme and completion documents so they no longer state that all ten programme pages are equal members of the guide library. Preserve their historical implementation evidence, but mark the new roadmap and current model as authoritative for guide visibility. Record completed, deferred, blocked, and optional goals accurately.

Run a final production-oriented regression covering guide classification, hub ItemList, service schema, collection membership, metadata, canonicals, robots, sitemap, direct route responses, redirects, internal links, form attribution, consent-gated analytics, prohibited claims, image loading, accessibility, mobile overflow, unique identities, project evidence, and production build. Do not fix unrelated failures in the same PR. Report unrelated failures separately.

This is a documentation and verification goal, not a last-minute redesign.
```

**Context Codex must inspect**

- `docs/landing-pages/sanctuary-pergola-guide-ecosystem-roadmap.md`
- `docs/landing-pages/pergola-guide-cluster-improvement.md`
- `docs/landing-pages/pergola-guide-cluster-completion-audit.md`
- `docs/landing-pages/seo-landing-page-programme.md`
- `docs/marketing-claims-register.md`
- All guide, product, project, contact, header, homepage, consent, and SEO test suites
- `apps/marketing/app/sitemap.ts`, `robots.ts`, and redirect configuration

**Exact scope**

- Update current-state guide programme documentation and status.
- Ensure tests reflect actual core, secondary, service-only, product, project, campaign, and variant roles.
- Run and record the complete marketing verification matrix.
- Produce a production rollout and external-monitoring checklist.

**Likely files**

- Current guide-cluster documentation
- Guide-hub, SEO programme, final refinement, claim, product, project, contact, consent, header, and homepage tests where expectations are stale
- No customer-facing implementation file unless a regression exposes an in-scope defect caused by the roadmap work

**Implementation requirements**

- Keep one authoritative current-state owner for guide visibility and link older documents to it.
- Do not erase historical implementation evidence.
- Record business approval gates and external monitoring as unresolved where applicable.
- Run tests from the repository root using the canonical command source.
- Separate in-scope regressions from unrelated repository failures.

**Exclusions and guardrails**

- No new guide, product, project, service, or campaign route.
- No content expansion or redesign.
- No redirect beyond already approved consolidation.
- No attempt to fabricate Search Console or analytics evidence.
- No unrelated portal or marketing cleanup.

**Acceptance criteria**

- Documentation accurately describes the final guide ecosystem and no longer states that all ten programme pages are equal hub guides.
- Required URLs, canonicals, indexability, sitemap inclusion, and redirects match the roadmap.
- Core and secondary guide membership, Service schema, collection membership, and navigation are protected by tests.
- All in-scope focused and broad marketing tests pass, or any unrelated failure is clearly isolated and reported.
- A production and external-monitoring checklist is ready for deployment.

**Tests to add or update**

- Run `npm run docs:guard`, `npm run docs:impact`, `npm run docs:navigation`, and `npm run text:mojibake`.
- Run `npm run test:marketing`.
- Run `npm run test:marketing:browser` with one worker if required by the existing marketing test environment.
- Run `npx tsc -p apps/marketing/tsconfig.json --noEmit --incremental false`.
- Run `npm run build:marketing`.
- Run `npm run architecture:changed`.
- Record focused reruns for any flaky or unrelated failure rather than hiding it.

**Manual checks**

- Crawl the locally built site and check every route in the generated sitemap.
- Review hub, one core guide, one secondary guide, both service-only pages, one product page, one project page, contact, homepage, and global navigation at mobile and desktop widths.
- Inspect structured data, canonical tags, robots tags, redirects, and consent behaviour.
- Confirm the production checklist names Search Console, analytics, crawl, and enquiry-attribution checks without inventing results.

**SEO or redirect risk**

Medium verification risk. This goal should not alter search identity, but it is the final gate that catches accidental canonical, schema, internal-link, or indexation regressions.

**Definition of done**

The repository documentation, tests, and production checklist agree on the implemented guide ecosystem, and every in-scope technical and editorial guard is verified.

## 5. Pull-request sizing and review discipline

### Default rule

One roadmap goal should produce one focused pull request. A pull request should have one primary review question that can be answered without reconstructing the whole programme.

The default review sequence is:

1. Verify the goal and non-goals.
2. Confirm affected routes and public behaviour.
3. Review claims and evidence.
4. Review implementation and data ownership.
5. Review focused tests.
6. Review manual evidence.
7. Confirm canonical, robots, sitemap, schema, redirect, analytics, and enquiry effects.
8. Merge only when the goal's definition of done is met.

### Concerns that should remain separate

Keep these concerns in separate pull requests unless a goal explicitly requires them to move together:

- project claims corrections
- project evidence verification
- claims-regression infrastructure
- page-role and guide-visibility model
- schema derivation
- visible breadcrumb and navigation behaviour
- hub content hierarchy
- hub responsive layout
- contextual relationship data
- service-page labelling
- one retained-guide content refinement
- product-to-guide links
- project-to-guide links
- analytics
- homepage guide gateway
- global navigation
- one new public route
- one redirect or route retirement
- final documentation and regression

A shared file being touched by two concerns is not a reason to combine them. For example, `apps/marketing/data/pergolaGuides.ts` may be changed in the model PR, hub PR, and optional new-guide PR at different times.

### Maximum practical PR size

A PR is probably too large when any of these conditions apply:

- it materially rewrites more than one customer-facing guide
- it creates more than one new public route
- it changes page classification, schema, hub layout, and customer-facing copy together
- it combines analytics or consent changes with a visual redesign
- it changes a redirect and also restructures unrelated pages
- it touches both the guide ecosystem and unrelated marketing or portal surfaces
- reviewers cannot describe the primary outcome in one sentence
- the diff requires several unrelated approval decisions
- a test failure cannot be attributed to one clear behaviour change

When a goal grows beyond that boundary, stop and split it before implementation.

### Goals requiring extra scope control

| Goal | Why it can grow | Required split if scope expands |
| --- | --- | --- |
| G03 | A claim-rule engine can become a generic lint platform | Keep the first PR to marketing claims, current sitemap routes, and documented rule metadata only |
| G04 | A data-model refactor can absorb rendering and copy changes | Keep the first PR to types, records, selectors, and unit tests |
| G07 | Hub restructuring can turn into a full visual redesign | Keep card hierarchy and section order in G07; defer responsive density to G08 |
| G09 | Relationship data can become a site-wide recommendation engine | Limit it to the guide ecosystem and typed explicit links |
| G11 to G18 | Content refinement can become a cluster-wide rewrite | One retained guide per PR |
| G21 | Tracking can spread into a new analytics architecture | Use existing consent and dataLayer patterns only |
| G24 | A new guide can trigger product and existing-guide rewrites | If required, split into route/content first and ecosystem integration second |
| G26 | Consent content carries legal and technical risk | Implement only one route after the approval gate; no second compliance page |
| G28 | Final verification can become an unrelated cleanup pass | Fix only roadmap-caused regressions; report unrelated failures separately |

### Required PR description

Every implementation PR should state:

- roadmap goal number and title
- primary outcome
- explicit non-goals
- routes affected
- files or data owners changed
- claim areas reviewed
- approvals relied on
- canonical impact
- robots impact
- sitemap impact
- schema impact
- redirect impact
- enquiry and attribution impact
- analytics and consent impact
- focused tests run
- broader tests run
- manual viewport checks
- screenshots or rendered evidence where visual behaviour changed
- known deferred work
- rollback approach when the change is difficult to reverse

### Reviewable acceptance evidence

Prefer small, direct evidence:

- a typed unit test for classification or relationship data
- one focused Playwright assertion for public behaviour
- a before-and-after screenshot for a visual change
- a direct response assertion for redirects or indexability
- a source evidence reference for a project fact
- a dataLayer capture for analytics
- a generated sitemap or schema snapshot for SEO behaviour

Do not use a large production build alone as proof that the goal is correct.

## 6. Decision and approval gates

A missing approval blocks only the claim or public feature that depends on it. It must not block claims-safe information-architecture, schema, hub, navigation, or internal-link improvements.

### Default approval inputs and safe fallbacks

The table below describes the information normally requested before Sanctuary
approves a claim. It is not a second approval system and does not override an
Approved entry in `docs/marketing-claims-register.md`. Sanctuary leadership may
approve a claim on another recorded basis; once that approval is in the claims
register, the related copy is no longer blocked within the approved scope.

| Gate | Recommended approval input | Likely owner | Goals blocked while claim remains Pending | Safe fallback if unavailable |
| --- | --- | --- | --- | --- |
| Current pergola pricing | A dated set of representative current sell-price examples or bands, project scopes, GST treatment, inclusions, exclusions, engineering, consent, access, accessories, and known outliers | Sanctuary commercial lead and finance | Any numerical addition to G12; no structural roadmap goal | Keep the Cost guide scope-led and publish no number |
| Lead times and installation duration | Current operational data by stage and project type, definitions of each stage, capacity assumptions, exclusions, and review date | Sanctuary operations | Any new general timing copy in G11 to G18, G24, or G26 | State that the programme is confirmed for the completed project in writing |
| Workmanship warranty | Current signed workmanship terms, duration, coverage, exclusions, claim path, and owner | Sanctuary leadership and legal | Any public workmanship-warranty duration or coverage expansion | Say only that applicable written terms are confirmed for the project |
| Product and coating warranties | Current manufacturer schedules for each offered product and coating, exposure conditions, maintenance obligations, exclusions, and review date | Sanctuary product lead | Product-specific warranty copy in G13, G17, G19, G24, or G27 | Keep warranties product-specific and defer to the selected written documents |
| Acrylic product and tint information | Current offered sheet products, manufacturer, grade, thickness, tint, UV and solar-control data, light data, maintenance, warranty, availability, and date | Sanctuary product lead | Numeric or categorical acrylic claims in G14, G19, G24, or G27 | Use qualitative site-specific trade-offs and name no percentage |
| Blind supplier and system information | Current offered systems, manual and motorised availability, maximum openings, guide or channel type, controls, sensors, operating limits, care, warranty, power requirements, and supplier support | Sanctuary product lead and current supplier | Exact product, controls, limits, or availability copy in G13 and G19 | Describe blind integration generically and require exact selected-system confirmation |
| Coastal and coating suitability | Current coating-system documentation, exposure categories, preparation and cut-edge requirements, dissimilar-metal rules, cleaning schedule, exclusions, and warranty implications | Sanctuary product lead | General coastal suitability or maintenance claims in G17, G19, or product pages | State that exposure, finish, detailing, care, and exclusions must be checked for the property |
| Wind, span, post-free, and structural capability | Project engineering, approved system documentation, exact geometry and loads, support conditions, and responsible engineer | Sanctuary design lead and project engineer | Any general threshold or capability claim in G15 to G18, G24, or G26 | Keep all answers project-specific and ask for the site, dimensions, and desired openings |
| Project dimensions and technical detail | Approved project file, drawings, as-built record, producer statements where relevant, supplier schedules, and permission to publish | Sanctuary project lead and marketing lead | G02 facts for the affected project and any evidence card that depends on them | Omit the uncertain fact while retaining the verified design brief and response |
| KiwiRail published area basis | Approved explanation of how a 30.0 m by 3.0 m plan relates to the recorded 115 m2 total area, or a corrected approved figure | Sanctuary project lead and marketing lead | Prominent use of the area in G02, G18, G20, or later content | Remove the 115 m2 figure until reconciled |
| Louvre product-range position | Written confirmation of whether Sanctuary supplies, installs, resells, partners on, or only compares louvre systems | Sanctuary product lead and leadership | Any change from the current external-proposal position in G14, G19, or G27 | Retain the current disclosure that Sanctuary's published offer is fixed acrylic, solid, and combination roofs |
| Consent and approval terminology | Current authority and building-control sources, legal or technical review, approved wording, named internal owner, review date, and re-review triggers | Sanctuary design lead, legal adviser, and relevant authority where required | G26 and any stronger consent copy elsewhere | Keep current project-specific caveats; do not publish a dedicated consent route |
| Service area and site-visit terms | Current service boundary, travel conditions, availability of site visits, any fee, and review date | Sanctuary operations and commercial lead | Any exact location or free-visit expansion in guide and service copy | Use Auckland only where already verified and avoid free or universal availability wording |
| Acrylic v2 consolidation decision | Complete 29 July 2026: approved reduced primary copy, retired variant source and one-hop permanent redirect. External-link and Search Console monitoring remain post-release checks. | Sanctuary marketing and SEO owner | None; G27 complete | Keep the primary route authoritative and the redirect one hop |
| Search Console access | Production property access, URL Inspection, page and query data, canonical selection, external links, and removal tools where needed | Sanctuary marketing or SEO owner | No code goal; required for post-release validation and prudent G27 checking | Proceed with repository-safe changes and record external verification as pending |
| Analytics access and baseline | Current analytics property access, consent-aware event visibility, route and conversion baseline, and data-quality review | Sanctuary marketing or analytics owner | No structural code goal; required to judge outcomes after G21 and later releases | Implement consent-safe events, validate technically, and avoid numerical success targets |

### Approval artefact standard

A claim or optional guide is not approved merely because:

- the wording appeared in an old website, quotation, brochure, email, or project note
- a project tag suggests an accessory was present
- a supplier made a general category claim
- a customer described a desired outcome
- a photograph appears to show a result
- an old test expects the wording
- an internal person remembers a number
- an editorial review date exists

A usable approval artefact should identify:

- exact claim
- exact product, project, service, or design to which it applies
- source document or approved record
- limitations
- owner
- approval date
- review or expiry date
- affected routes
- required maintenance of the claim
- safe fallback if the evidence expires

### Agent behaviour at a blocked gate

When a goal reaches a blocked gate, the agent should:

1. state the exact missing evidence
2. name the affected claim or route
3. identify the responsible owner from the gate register
4. implement any unrelated claims-safe work that remains in scope
5. use the documented fallback
6. leave the blocked public claim or route unchanged
7. update the roadmap status to `Blocked` with the missing evidence
8. avoid creating placeholder public copy such as `VERIFY` or an invented range

## 7. Testing strategy

### Testing principles

- Use the smallest test that proves the changed contract.
- Put data ownership and classification rules in unit tests.
- Put rendered metadata, schema, links, responsive behaviour, consent, and route behaviour in Playwright.
- Test public routes directly rather than inferring behaviour from source.
- Preserve a distinction between required route existence and guide visibility.
- Do not let one broad test suite be the only evidence for a high-risk change.
- Do not call external AI, legal, supplier, analytics, or Search Console services from CI.
- Keep external approvals as repository data or documentation, not runtime test dependencies.
- Run the production marketing build after shared rendering, metadata, schema, route, or redirect changes.

### Canonical command source

Use `docs/testing-and-qa.md` as the command authority. The common handoff set for this programme is:

```bash
npm run test:marketing
npm run test:marketing:browser
npx tsc -p apps/marketing/tsconfig.json --noEmit --incremental false
npm run build:marketing
npm run lint
npm run architecture:changed
```

Use the focused commands in each goal while iterating.

### Test layers

#### 1. Type checking

Type checking must prove that:

- every page has an explicit ecosystem profile
- guide tier and guide category are required only when guide visibility is present
- service schema can exist independently of guide visibility
- service-only pages cannot accidentally appear in the guide ItemList
- relationship destinations use known routes or a route-safe type
- optional new guide records cannot be partially configured
- project context links and product-guide links use the declared typed shape

Recommended command:

```bash
npx tsc -p apps/marketing/tsconfig.json --noEmit --incremental false
```

#### 2. Unit and domain tests

Add focused unit tests for:

- page-role and guide-visibility selectors
- core and secondary membership
- hub order
- service schema eligibility
- collection membership
- breadcrumb mode
- relationship mapping
- product-to-guide mapping
- project context-link mapping
- contact destination selection
- claims-rule metadata and exception validation
- sitemap route generation where data-driven route changes are introduced
- approved project evidence and retired wording

High-value source-level contracts should fail with route-specific messages.

#### 3. Playwright route tests

Playwright should verify the public result, not just the data record.

For the hub:

- one H1
- self-canonical
- index, follow
- CollectionPage
- guide-only ItemList
- exact core and secondary membership
- service pathways excluded from ItemList
- core order
- secondary order
- direct route resolution
- loaded images
- no horizontal overflow
- mobile hierarchy and disclosure behaviour
- minimum interactive target size
- keyboard access
- reduced-motion behaviour
- footer and global navigation discovery

For actual guides:

- direct 200
- one H1
- unique title and description
- self-canonical
- index, follow
- WebPage
- guide collection `isPartOf`
- guide breadcrumb
- contextual next-step navigation
- no global previous or next sequence
- correct form fields
- route attribution
- no duplicate final CTA
- no FAQPage schema unless a later explicit policy changes
- responsive images and no horizontal overflow

For service-only pages:

- direct 200
- one H1
- unique metadata
- self-canonical
- index, follow
- Service schema
- no guide collection `isPartOf`
- no guide numbering
- no guide previous or next navigation
- service-oriented breadcrumb
- contextual links to guides
- unchanged form and attribution

For product pages:

- Product schema
- product breadcrumb
- current guide handoff
- related products
- evidence caveat
- CTA continuity
- sitemap discovery
- no duplication of the guide's neutral decision content

For project pages:

- verified project facts
- no retired or unsupported claim
- explicit guide and product or service link
- correct residential or commercial contact state
- project metadata and schema unchanged
- responsive gallery and disclosures
- no horizontal or nested vertical scroll

For contact and analytics:

- query-state preselection
- editable enquiry type
- attachments and validation unchanged
- page, source, UTM, and attribution retained
- no tracking before consent
- one event after consent
- no personal or free-text data in the event
- tracking failure does not block submission

#### 4. Metadata and canonical tests

For every existing public route in scope, assert:

- exact canonical URL
- unique title
- unique description
- one H1
- correct Open Graph URL
- intended robots directive
- no accidental canonical to the hub or another page

Removing a page from the hub must not alter its canonical or robots directive.

For a new optional route, test its canonical, metadata identity, and intended indexability before adding it to the sitemap.

#### 5. Robots and sitemap tests

Test these concepts independently:

- `robots.ts` still allows public crawling and advertises the sitemaps
- every preserved existing route remains in the generated sitemap
- service pages remain in the sitemap after hub removal
- hub ItemList membership is not treated as sitemap membership
- noindex test variants are absent from the sitemap
- optional approved guides appear once when launched
- the primary acrylic page remains in the sitemap
- the v2 acrylic route is absent before and after consolidation

#### 6. Schema tests

Parse all JSON-LD nodes and assert by route profile:

- hub: CollectionPage, ItemList, BreadcrumbList
- guide: WebPage, BreadcrumbList, guide collection `isPartOf`
- guide plus service: WebPage, Service, BreadcrumbList, collection membership
- service-only: WebPage, Service, service breadcrumb, no guide collection membership
- product: Product and product breadcrumb
- project: current project schema and breadcrumb

Do not use `role === service` inside guide membership as the schema rule. Test the independent selector.

#### 7. Direct response and redirect tests

Use requests with redirects disabled where relevant:

- all existing public guide, service, product, project, hub, and contact routes return direct 200 responses
- removing a page from the hub creates no redirect
- the historic brochure keeps its intended permanent redirect and robots header
- G27's permanent redirect from the v2 acrylic route to the primary route
  remains one hop
- no redirect chain or loop appears

#### 8. Internal-link tests

For each rendered route:

- collect unique same-site paths
- exclude in-page anchors when appropriate
- request each destination
- fail on 4xx and 5xx
- fail on unexpected redirect chains for current destinations
- test no self-link in contextual relationship modules
- test no duplicate relationship destination
- test no link to a blocked or nonexistent optional guide
- test service-only pages are still reachable from relevant guides and homepage pathways
- test product and project pages return to the correct guide or service

#### 9. Mobile and responsive tests

Use representative widths already established in the repository:

- 320
- 390
- 430
- 768
- 1024
- 1440

The hub should also keep the existing 1440 x 1000, 1024 x 768, 768 x 1024, and 390 x 844 matrix where useful.

Test:

- no horizontal overflow
- no nested content scroller
- core guides appear before secondary guides
- service pathways are visibly separate
- mobile hero height stays within the approved budget
- disclosure content is server rendered and keyboard operable
- minimum 44 pixel targets
- logical focus order
- visible focus
- no content hidden only for test convenience
- no image-loading or sizes warnings
- reduced motion removes nonessential transitions

#### 10. Accessibility

At minimum, verify:

- one H1
- logical H2 and H3 order
- meaningful navigation labels
- breadcrumb `aria-label`
- current-page state
- disclosure semantics
- keyboard operation
- visible focus
- image alt text
- no empty link text
- buttons and links are used for the correct interaction
- error text remains associated with form controls
- no colour-only distinction between core, secondary, and service cards

Use existing repository accessibility assertions and add focused automated checks where the current suites support them. Manual keyboard review remains required for redesigned hub and navigation surfaces.

### Claims-regression improvement

The current sitemap-wide browser check is useful, but its fixed regular expressions only detect known exact phrases. It should become a two-layer, repository-owned claims control.

#### Layer A: explicit exact-pattern guard

Retain high-confidence patterns for:

- prohibited numeric durations
- combined warranty durations
- unsupported percentages
- explicit wind-speed thresholds
- known retired supplier or product terms
- exact phrases already removed from the public site

This layer should remain deterministic and easy to review.

#### Layer B: contextual claim-rule guard

Create a typed rule set with fields such as:

```ts
type MarketingClaimRule = {
  id: string;
  area:
    | 'price'
    | 'timing'
    | 'warranty'
    | 'uv-heat-light'
    | 'weather'
    | 'wind-structure'
    | 'coastal-maintenance'
    | 'consent'
    | 'project-evidence';
  triggers: RegExp[];
  qualifiers?: RegExp[];
  prohibitedCombinations?: RegExp[];
  routes?: string[];
  sourcePaths?: string[];
  owner: string;
  evidenceRequirement: string;
  fallback: string;
};
```

The evaluator should inspect sentence or paragraph context rather than only the whole page. It should flag, for example:

- absolute or categorical weather outcome plus no site or open-edge qualification
- heat, UV, glare, or light outcome presented as delivered performance rather than design intent
- a structural capability word paired with a generic threshold
- a consent or exemption conclusion without project-specific qualification
- coastal suitability or maintenance language without an exact selected-product reference
- a project fact not present in the governed project snapshot

It should distinguish:

- a customer's desired outcome from a delivered result
- a question from an answer
- a negated warning such as `do not promise waterproof` from a waterproof promise
- a route-specific approved exception from an unapproved general claim

#### Exception discipline

Any exception must be a typed record with:

- rule ID
- route or source path
- exact permitted wording or narrow pattern
- reason
- evidence source
- owner
- approval date
- review date

Do not use broad path exclusions or `skip this page` flags.

#### Source and rendered coverage

Run contextual claim checks against:

- source-controlled public content records
- project data
- product data
- rendered visible text
- metadata
- structured data
- sitemap routes

A source-level test catches a risky phrase before rendering. A rendered test catches composition, reused snippets, metadata, and structured-data exposure.

#### CI boundary

The claim guard must remain:

- deterministic
- offline
- reviewable
- based on repository rules and approved evidence
- free of external AI classification
- free of runtime network calls

Human editorial review remains necessary. The guard reduces known regression risk; it does not grant claim approval.

### Required test matrix by change type

| Change type | Minimum focused checks | Broader handoff checks |
| --- | --- | --- |
| Project claims | Project claim unit tests, project presentation tests, project Playwright, SEO claim spec | Marketing typecheck, relevant final-refinement spec, architecture report |
| Ecosystem model | New model unit tests, TypeScript | SEO programme and guide tests, marketing unit suite |
| Schema or breadcrumb | Schema selector tests, route Playwright | Marketing browser subset, build |
| Hub content | Guide-hub Playwright | TypeScript, build |
| Hub layout | Guide-hub responsive matrix and accessibility checks | Shared header or hero tests if affected, build |
| Guide navigation | Relationship unit tests and guide route Playwright | SEO programme, link crawl |
| One guide refinement | Relevant content tests, SEO identity, claim spec, form attribution | TypeScript, build if shared blocks change |
| Product links | Product data tests and product Playwright | Link crawl, typecheck |
| Project links | Project presentation tests and project Playwright | Contact query-state tests |
| Analytics | Consent spec and focused event assertions | Marketing unit suite and affected browser specs |
| Homepage gateway | Homepage Playwright | TypeScript, build |
| Header Guides link | Shared-header and hero-navigation Playwright | TypeScript |
| New route | Unit, metadata, schema, hub, sitemap, link, form, responsive, claim tests | Full marketing unit, browser lane, build |
| Redirect | Direct request with redirects disabled, canonical and sitemap tests | Build and dead-code changed report |
| Docs only | Docs guard, impact, navigation, mojibake | None unless documented commands changed |
| Final regression | All focused suites | Full marketing unit, browser, typecheck, lint, build, architecture report |

## 8. Rollout and monitoring

### Baseline before the first public IA release

Before G07 changes the hub, record the current production baseline where access exists:

- production response status for every affected URL
- current canonical selected by Google
- index coverage
- sitemap discovery
- current hub entrances and source channels
- card clicks from the existing hub
- homepage guide-gateway clicks
- guide landing-page sessions
- guide-to-form starts
- form completions by source route
- guide-to-product clicks
- guide-to-project clicks
- guide-to-service clicks
- mobile scroll depth to the first guide card
- query overlap among service, guide, and product routes
- known external links to the acrylic v2 route
- current indexed state of the historic brochure URL

A missing baseline does not block claims corrections, model separation, schema correction, or hub restructuring. It means the post-release report must describe observed behaviour without claiming an uplift against unavailable historical data.

### Release groups

Do not hold all work for one large launch.

#### Release group A: factual safety

Goals:

- G01
- G02
- G03

Post-release checks:

- crawl changed project and guide pages
- inspect rendered claims and snippets
- confirm metadata and canonical values are unchanged
- request re-crawl for materially corrected project pages where appropriate
- verify no existing high-value route disappeared from the sitemap
- record unresolved evidence gates

#### Release group B: architecture and schema

Goals:

- G04
- G05
- G06

Post-release checks:

- direct 200 for all existing routes
- canonical and robots parity
- sitemap parity
- schema by route profile
- breadcrumb behaviour
- no accidental hub membership change before G07
- form and attribution continuity

This group may be deployed without a visible hub change if the compatibility layer preserves the existing output.

#### Release group C: curated hub and navigation

Goals:

- G07
- G08
- G09
- G10

Post-release checks:

- crawl hub and all guide links
- confirm ItemList contains actual guides only
- confirm broad and custom service pages remain indexed, in the sitemap, and linked from the service pathway
- inspect mobile hierarchy and scroll depth
- check guide card clicks by tier
- check service-pathway clicks
- inspect Search Console coverage and selected canonical for every reclassified route
- monitor query and landing-page movement without assuming a negative or positive effect from the IA change alone

#### Release group D: retained guide refinements

Goals:

- G11 through G18

Deploy one guide refinement at a time or in very small groups with non-overlapping ownership.

Post-release checks for each guide:

- production crawl
- metadata and H1 parity
- internal links
- guide-to-guide, guide-to-product, guide-to-project, and guide-to-service behaviour
- form starts and completions by route
- Search Console queries and pages
- evidence that no important customer question was lost
- claims review

Do not use total word-count reduction as a success measure. Judge whether the page answers its owned decision more clearly and moves users to an appropriate next step.

#### Release group E: ecosystem connections and analytics

Goals:

- G19
- G20
- G21

Post-release checks:

- reciprocal product and guide links
- project pathway relevance
- residential versus commercial contact state
- event visibility only after consent
- event uniqueness
- source and destination fields
- absence of personal data
- lead event continuity
- analytics data quality before interpreting behaviour

#### Release group F: discovery

Goals:

- G22
- G23

Post-release checks:

- homepage and header link availability
- navigation active states
- mobile menu behaviour
- homepage guide-gateway clicks
- hub entrances from homepage and global navigation
- no header overflow
- no measurable technical performance regression attributable to the changes

#### Release group G: optional new guides

Goals:

- G24
- G25
- G26

Release G24 only after its distinct role is confirmed. Release G26 only after the approval package is complete.

Post-release checks:

- new route indexed only as intended
- canonical selected correctly
- sitemap discovery
- query overlap with existing form, service, and product pages
- contextual progression
- claims and source review date
- customer engagement and enquiry attribution
- no drop in visibility caused by accidental internal-link displacement of existing pages

#### Release group H: consolidation and closeout

Goals:

- G27
- G28

Post-release checks:

- one-hop v2 redirect
- primary acrylic canonical and indexability
- no internal v2 links
- historic brochure redirect remains correct
- full production crawl
- full schema and metadata sample
- Search Console URL Inspection
- analytics events
- final documentation status

### Production crawl checklist

After every release that changes public pages or links:

1. Crawl from `/`.
2. Crawl from `/pergola-guides`.
3. Load the generated sitemap.
4. Request every affected route directly.
5. Record status, final URL, canonical, robots, title, description, H1 count, schema types, and inlinks.
6. Check for redirect chains, orphaned routes, broken anchors, and duplicate titles.
7. Confirm service-only pages remain reachable.
8. Confirm optional blocked routes do not exist publicly.
9. Confirm noindex variants remain outside the sitemap.
10. Compare the result with the intended route profile in this roadmap.

### Search Console checks

Where access exists, review:

- index coverage for every affected URL
- Google-selected versus user-declared canonical
- sitemap discovery
- URL Inspection after major reclassification
- queries and landing pages for:
  - `/pergolas-auckland`
  - `/custom-pergolas-auckland`
  - `/outdoor-rooms-auckland`
  - `/pergola-cost-auckland`
  - `/pergolas-with-blinds`
  - `/acrylic-pergolas-vs-louvre-roofs`
  - Gable and Pitched guide and product pairs
  - Aluminium
  - Commercial
- query overlap between guide and product pages
- query overlap between broad and custom service pages
- query overlap introduced by optional new guides
- external links to pages being consolidated
- stale results containing corrected claims
- the historic brochure index state

Do not conclude that two pages are cannibalising solely because they share some queries. Compare the dominant query intent, landing-page suitability, click-through, position, and conversion role.

### Analytics checks

After G21 has passed technical consent verification, monitor:

- hub entrances by source
- core versus secondary guide click-through
- service-pathway click-through
- guide exits
- guide-to-guide progression
- guide-to-product progression
- guide-to-project progression
- guide-to-service progression
- contact transitions
- form starts
- successful enquiries
- enquiry type
- source route
- viewport category
- mobile scroll depth to the first guide choice
- homepage guide-gateway clicks
- global Guides navigation clicks

Do not send or analyse customer message text, addresses, names, contact details, or attachment metadata as analytics dimensions.

### Enquiry-quality review

Quantitative events do not show whether the guide ecosystem improves lead quality. Periodically review, using privacy-safe operational data:

- whether the enquiry includes suburb, photos, and rough dimensions
- whether the desired use is clear
- whether the customer has identified a roof, form, edge, cost, or site-constraint question
- whether commercial and professional enquiries reach the correct pathway
- whether the first response can recommend a meaningful next step
- whether a guide is generating unsuitable DIY, kitset, cheapest-only, or out-of-area leads

Do not attribute a sales outcome to one phrase or guide without sufficient evidence.

### Mobile engagement review

For the hub and major guides, review:

- time or scroll required to reach the first decision
- core-card visibility
- secondary-guide disclosure use
- service-pathway visibility
- repeated back-and-forth between hub and service pages
- form abandonment on smaller screens
- accidental taps or small targets
- horizontal overflow
- long hero or image sections delaying useful content

### Monitoring cadence

Use a staged interpretation:

- immediately after deployment: technical crawl, redirects, metadata, schema, forms, events, and errors
- after sufficient search recrawl: index coverage, selected canonical, snippets, and initial query distribution
- after sufficient behavioural data: pathway use, mobile engagement, and conversion progression
- after sufficient lead review: enquiry quality and pathway suitability

The owner should define the reporting window from available traffic and business cadence. This roadmap does not invent a fixed numerical target or claim that a result should appear within a particular number of days.

### Rollback principles

Roll back or patch promptly when:

- an existing route becomes unavailable
- a canonical changes unintentionally
- a service page becomes noindex or leaves the sitemap
- Service schema is removed from a genuine service route unintentionally
- the hub ItemList includes service-only or nonexistent pages
- the enquiry API, uploads, attribution, or consent behaviour breaks
- tracking fires before consent
- a redirect chain or loop appears
- unsupported public claims are introduced
- mobile navigation or hub interaction becomes inaccessible

Do not roll back a correct claims qualification merely because the old wording was stronger.

## 9. Roadmap summary table

Values are relative within this programme. `High` does not imply a numerical forecast. Optional goals G24 through G26 require separate authorisation or approval.

| Goal | Phase | Primary outcome | Affected area | Dependency | Effort | User value | SEO value | Conversion value | Implementation risk | Approval required | Recommended order |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: |
| G01 | 1 | Correct unsupported project outcome language | Project data and claim tests | None | Medium | High | Medium | High | Medium | Project evidence where wording remains specific | 1 |
| G02 | 1 | Verify or quarantine uncertain project facts | Project evidence and cards | G01 | Small to medium | High | Medium | Medium | Medium | Yes, for affected facts | 2 |
| G03 | 1 | Add contextual claims regression | Claims rules and rendered route tests | G01 | Medium | High | High | Medium | Medium | No new claim approval; rule owners required | 3 |
| G04 | 2 | Create independent ecosystem profile | Guide data model and selectors | G03 | Medium | High | High | High | Medium | No | 4 |
| G05 | 3 | Decouple schema and collection membership | SEO landing schema and breadcrumbs | G04 | Medium | Medium | High | Medium | Medium | No | 5 |
| G06 | 3 | Separate guide navigation from service context | Shared navigation components | G04 and G05 | Medium | High | High | High | Medium | No | 6 |
| G07 | 4 | Publish the curated 4-core, 4-secondary hub | Hub content, ItemList, tests | G04 to G06 | Medium | High | High | High | Medium | No | 7 |
| G08 | 4 | Improve hub hierarchy and mobile density | Hub CSS and responsive behaviour | G07 | Medium | High | Medium | High | Low to medium | No | 8 |
| G09 | 5 | Replace linear sequence with explicit relationships | Guide relationship data and UI | G04 to G07 | Medium | High | Medium | High | Medium | No | 9 |
| G10 | 5 | Reposition broad and custom pages as services | Service labels, breadcrumbs, links | G06 and G09 | Small to medium | High | High | High | Low | No | 10 |
| G11 | 6 | Refine Outdoor Rooms as a core guide | Outdoor Rooms content and links | G09 and G10 | Medium | High | Medium | High | Medium | Only for new factual claims | 11 |
| G12 | 6 | Refine Cost as the scope owner | Cost content and links | G09 and G10 | Medium | High | High | High | Medium | Pricing approval only for numbers | 12 |
| G13 | 6 | Refine Blinds as the enclosure owner | Blinds content and links | G09 and G10 | Medium | High | High | High | Medium | Supplier approval for exact system claims | 13 |
| G14 | 6 | Refine Acrylic versus Louvre comparison | Comparison content and links | G09 and G10 | Medium | High | High | High | Medium | Louvre position and exact product data for changes | 14 |
| G15 | 6 | Refine the Gable secondary guide | Gable content and links | G09 and G10 | Medium | High | Medium | High | Medium | Structural or product evidence for stronger claims | 15 |
| G16 | 6 | Refine the Pitched secondary guide | Pitched content and links | G09 and G10 | Medium | High | Medium | High | Medium | Structural or drainage evidence for stronger claims | 16 |
| G17 | 6 | Refine the Aluminium secondary guide | Aluminium content and links | G09 and G10 | Medium | High | High | High | Medium | Coating, coastal, warranty, or structural evidence | 17 |
| G18 | 6 | Refine the Commercial secondary guide | Commercial content and links | G09 and G10 | Medium | High | High | High | Medium to high | Project, operations, or compliance evidence where used | 18 |
| G19 | 7 | Clarify product-to-guide ownership | Product data and handoff modules | Relevant Phase 6 goals | Medium | High | High | High | Low to medium | Current product information for exact claims | 19 |
| G20 | 7 | Create explicit project pathways | Project data, links, contact states | G01, G02, G09 | Medium | High | Medium | High | Medium | Approved project records | 20 |
| G21 | 7 | Measure the guide journey safely | Consent-gated analytics | G07, G09, G19, G20 | Medium | Medium | Low | High | Medium | Marketing or analytics owner approves taxonomy | 21 |
| G22 | 8 | Align the homepage guide gateway | Homepage content and section order | G07 and G09 | Small to medium | High | Medium | High | Low | No | 22 |
| G23 | 8 | Add Guides to global navigation | Header and mobile menu | G07 live-ready | Small | Medium | Medium | Medium | Low to medium | No | 23 |
| G24 | 9 | Add the optional form-comparison guide | New route, hub, products, sitemap | G07, G09, G15, G16, G19 | Large | High | High | High | Medium | Authorisation and verified project evidence | 24 |
| G25 | 9 | Prepare the consent evidence gate | Governance documentation | G03 | Small to medium | Medium | High | Medium | High subject-matter | Design and legal owner participation | 25 |
| G26 | 9 | Add the approved consent guide | New route, hub, sitemap, content | G25 approved | Large | High | High | High | High | Mandatory written legal and technical approval | 26 |
| G27 | 10 | Consolidate the acrylic test variant | Primary route, redirect, retired code | Variant decision | Small to medium | Medium | Medium | Medium | Low | Marketing and SEO owner decision | 27 |
| G28 | 10 | Synchronise docs and verify the final ecosystem | Docs and full marketing regression | All required approved goals | Medium | High | High | High | Medium | External access for post-release checks only | 28 |

### Critical path

The required critical path is:

```text
G01 -> G02 -> G03
   -> G04 -> G05 -> G06
   -> G07 -> G08
   -> G09 -> G10
   -> G11 through G18, one guide per PR
   -> G19 -> G20 -> G21
   -> G22 -> G23
   -> G27 (complete)
   -> G28
```

G11 through G18 can proceed in parallel only when:

- each agent owns a different content file and focused test lane
- G09 and G10 have merged
- the claims and relationship contracts are stable
- the shared `SeoLandingPage` component is not being changed concurrently
- project evidence files are not being edited concurrently without an explicit owner lane

G24 is optional and should follow the form-guide and product ownership work. G25 may begin once the claims gate exists, but G26 remains blocked until written approval is complete.

### Required versus optional

Required for the audited target state:

- G01 through G23
- G27 (complete)
- G28

Optional expansion:

- G24, form-comparison guide
- G25, consent evidence package
- G26, public consent guide after approval

G25 is valuable even when G26 remains deferred because it clarifies the evidence needed and prevents speculative consent content.

## 10. Recommended starting goal

### Start with G01: Correct unsupported project narrative claims

This is the best first goal because it:

- improves customer trust immediately
- reduces legal, brand, and conversion risk
- protects the evidence reused by guides, products, projects, and the homepage
- does not depend on the new guide data model
- does not change URLs, indexation, schema, sitemap, layout, or conversion architecture
- creates a safer baseline for every later content and information-architecture PR

### Complete ready-to-paste Codex prompt

```text
Repository: `velt-design/sanctuary`

Implement roadmap goal G01 only: Correct unsupported project narrative claims.

Read before editing:

1. `AGENTS.md`
2. `docs/landing-pages/sanctuary-pergola-guide-ecosystem-roadmap.md`
3. `docs/Sanctuary_Pergolas_AI_Copywriting_Context_Pack.md`
4. `docs/marketing-claims-register.md`
5. `docs/testing-and-qa.md`
6. `apps/marketing/data/projects.ts`
7. `apps/marketing/data/projects.claims.test.ts`
8. `apps/marketing/app/projects/projectPresentation.test.ts`
9. `playwright/marketing.projects.spec.ts`
10. `playwright/marketing.guide-cluster-final-refinement.spec.ts`
11. `playwright/marketing.seo-copy-hygiene.spec.ts`

Before making changes:

- run `git status --short`
- preserve unrelated worktree changes
- inspect all consumers of each project record you change
- identify whether each questionable phrase is a customer brief, a factual assembly description, or a delivered performance assertion

Goal:

Audit the public project narratives in `apps/marketing/data/projects.ts` for assertive weather, daylight, glare, heat, comfort, integration, structural, or maintenance outcomes that are not backed by current approved evidence.

Prioritise these project records:

- Mt Maunganui Box
- Lilliput Mini Golf
- Riverhead Gable Pavilion
- Tindalls Bay Patio and Carport
- The Good Home Takanini
- Dairy Flat Estate
- Ardmore Box Carport
- St Heliers Townhouse
- KiwiRail Head Office
- Atelier Shu Cafe

Review blurbs, constraints, descriptions, section paragraphs, section bullets, roof approaches, materials, tags, captions, and any reused guide or homepage snippets.

Correct or qualify phrases such as:

- all-season
- maximum light
- plenty of daylight
- strong weather protection
- proper weather protection
- blends seamlessly
- categorical glare reduction
- categorical comfort improvement
- clean shedding or waterproof-style rain outcomes
- universal wind protection
- any equivalent wording that presents an intended outcome as proven performance

Implementation rules:

- Preserve verified dimensions, form, materials, project dates, design constraints, and architectural decisions.
- Distinguish a customer objective from a delivered performance result. A brief may say the customer wanted more shade or less glare, but the response must not state that an exact result was achieved without approved evidence.
- Prefer concrete assembly language. Describe the roof form, selected material, open edge, blind or screen location, drainage element, and design intention.
- Use conditional or site-specific wording where the result depends on orientation, product, roof depth, open edges, drainage, installation, or exposure.
- Do not introduce any price, timing, warranty, UV, heat, wind, span, coastal, consent, waterproof, maintenance, or structural claim.
- Do not add manufacturer or supplier details unless the claims register and approved project record support them.
- Keep Sanctuary's calm, design-led tone and New Zealand English.
- Use no em dashes in customer-facing copy.

Scope limits:

- Do not change any route.
- Do not change metadata identity unless a metadata description directly repeats an unsafe project claim.
- Do not change canonical URLs.
- Do not change robots directives.
- Do not change sitemap entries.
- Do not change schema types.
- Do not change guide classification.
- Do not redesign project pages.
- Do not delete projects or verified project evidence.
- Do not begin the guide-hub restructuring.

Tests:

1. Extend `apps/marketing/data/projects.claims.test.ts` so each corrected project has:
   - an expected safe current phrase or fact
   - a retired unsafe phrase or pattern that must not return
2. Update `playwright/marketing.guide-cluster-final-refinement.spec.ts` where it currently expects stronger project wording.
3. Update `playwright/marketing.seo-copy-hygiene.spec.ts` only for a high-confidence reusable rule. Do not add a broad expression that creates false positives for warnings, questions, or customer objectives.
4. Preserve existing project presentation and browser contracts.

Run:

```bash
npx vitest run apps/marketing/data/projects.claims.test.ts apps/marketing/app/projects/projectPresentation.test.ts
npx playwright test playwright/marketing.projects.spec.ts playwright/marketing.guide-cluster-final-refinement.spec.ts playwright/marketing.seo-copy-hygiene.spec.ts --config=playwright.marketing.config.ts
npx tsc -p apps/marketing/tsconfig.json --noEmit --incremental false
npm run architecture:changed
```

Run `npm run build:marketing` if shared rendering, metadata, or a route component changes.

Manual checks:

- open every changed project page at a mobile and desktop width
- confirm the copy still explains the brief, design response, and visible assembly
- check homepage and guide cards that reuse the changed project
- confirm no stronger implication appears in captions, metadata, or structured data
- verify all affected links and enquiry CTAs still work

Definition of done:

- flagged projects contain no categorical all-weather, all-season, maximum-light, guaranteed-glare, or equivalent unsupported result
- verified project evidence remains useful and specific
- customer goals are not mistaken for guaranteed outcomes
- all existing project URLs, metadata identities, canonicals, robots directives, sitemap entries, schema, order, and enquiry paths remain intact
- focused tests pass
- the handoff lists each claim family corrected, files changed, tests run, and any evidence still requiring Sanctuary approval

Do not start G02 or any later roadmap goal in this pull request.
```
