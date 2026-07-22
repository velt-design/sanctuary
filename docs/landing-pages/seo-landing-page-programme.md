# SEO Landing Page Programme

The current guide-cluster page roles and rewrite decisions are recorded in [Pergola Guide Cluster Improvement](pergola-guide-cluster-improvement.md). The requirement-by-requirement state is recorded in the [Pergola Guide Cluster Completion Audit](pergola-guide-cluster-completion-audit.md). Public pricing, warranty, timing, performance and product-position statements are governed by the [Marketing Claims Register](../marketing-claims-register.md).

Status: Active implementation checklist.

This document tracks the ten approved Sanctuary marketing landing pages. Pages are built and proved one at a time. A page is complete only after content, claim, SEO, conversion, responsive, link, schema, typecheck, browser and production-build checks pass.

## Page checklist

| Order | Page | Route | Status | Distinct search intent and narrative |
| --- | --- | --- | --- | --- |
| 1 | Pergolas Auckland | `/pergolas-auckland` | Complete | Broad category entry point. Starts with the relationship between the outdoor room, adjoining home and site; introduces form, roofing, edges, scope and process. |
| 2 | Custom Pergolas Auckland | `/custom-pergolas-auckland` | Complete | Bespoke design and site-specific problem solving. |
| 3 | Aluminium Pergolas Auckland | `/aluminium-pergolas-auckland` | Complete | Aluminium structure, architectural detailing and material decisions. |
| 4 | Pergola Cost Auckland | `/pergola-cost-auckland` | Awaiting pricing approval | Scope, cost drivers, quotation comparison and qualification are complete. Numerical guidance needs a dated approved price set. |
| 5 | Gable Pergolas Auckland | `/gable-pergolas-auckland` | Complete | Gable form, height, proportion and integration with the existing roofline. |
| 6 | Pitched Pergolas Auckland | `/pitched-pergolas-auckland` | Complete | Mono-pitched form, height constraints, drainage and restrained house connection. |
| 7 | Outdoor Rooms Auckland | `/outdoor-rooms-auckland` | Complete | Complete room planning across roof, edges, lighting, heating and use. |
| 8 | Pergolas With Blinds | `/pergolas-with-blinds` | Complete | Edge protection, wind, low sun, privacy, enclosure and blind integration. |
| 9 | Acrylic Pergolas vs Louvre Roofs | `/acrylic-pergolas-vs-louvre-roofs` | Complete | Decision-led comparison with all product and performance claims gated for review. |
| 10 | Commercial Pergolas Auckland | `/commercial-pergolas-auckland` | Complete | Hospitality and selected commercial scope, coordination and operational context. |

## Public guide directory

`/pergola-guides` is the public, indexable directory for all ten programme pages. It is designed as a decision-led library rather than a flat SEO sitemap:

- Plan the project: broad Auckland pergolas, custom pergolas, outdoor rooms and commercial pergolas.
- Choose form and structure: aluminium, gable and pitched pergolas.
- Compare scope and components: cost, blinds and acrylic-versus-louvre roof behaviour.

The directory uses the approved architectural editorial foundation, retains `#4f5748` olive green as its only action accent and is discoverable from the public footer and sitemap. A typed data owner keeps all ten route labels, summaries and destinations aligned with the rendered directory and ordered `ItemList` schema.

Focused browser QA covers 1440 x 1000, 1024 x 768, 768 x 1024 and 390 x 844. It verifies one H1, self-canonical indexable metadata, exactly ten direct guide links, three chapters, resolving destinations, ordered schema, footer and sitemap discovery, loaded imagery, green accent and no horizontal overflow. The current hub and guide suite passes 76 of 76 checks, with four additional technical SEO, brochure-retirement and copy-governance checks passing. The claims regression reads every indexable sitemap route rather than only the guide pages. The production build statically generates `/pergola-guides`. Visual evidence is stored in `artifacts/marketing-seo-landing/pergola-guides/`.

## Page 1 decisions

- `/pergolas-auckland` is self-canonical and included in the public sitemap because it is a distinct, indexable broad-service page.
- The page reuses the approved architectural editorial foundation and existing enquiry API, attachment, attribution, privacy and conversion-event contracts.
- Green remains the accent through the approved olive/green foundation token. No burgundy or purple accent has been introduced.
- The narrative is intentionally broader than `/acrylic-roof-pergolas-auckland`: it begins with use, house integration and site conditions, then compares roof form, roof approach, open edges, process and complete scope.
- Internal links connect the broad service page to the custom, product, cost, project and enquiry owners without creating redirect chains.
- Structured data uses `WebPage`, `Service` and `BreadcrumbList`. FAQ content remains visible but is not marked up as `FAQPage`; no rating, review, offer or price schema is added.
- The existing landing-page enquiry form now accepts a route-owned roof-preference configuration. The acrylic route keeps its acrylic-specific options; the broad page offers acrylic, solid or lined, combination and unsure choices while preserving the same API and tracking behavior.

## Claims and assets requiring verification

These items are deliberately omitted or stated conditionally until approved evidence exists:

- Starting, example or square-metre pricing, including GST and dated scope.
- Response, design, fabrication or installation time promises.
- Exact Auckland service boundary, island travel and travel charges.
- Consent exemptions, council determinations or a universal approval pathway.
- Span, post-free, wind-zone, coastal, engineering or structural-performance claims.
- Waterproof, watertight, leak-proof, heat, UV, durability, coating, lifespan or maintenance-performance claims.
- Product manufacturers, profiles, thicknesses, warranties and availability.
- Any categorical Sanctuary louvre-supply claim until the current product-range position is formally approved.
- Testimonials, ratings or review schema not already verified and eligible for use.

Existing project photography and project facts come from `apps/marketing/data/projects.ts`. No stock or AI-generated project imagery is used.

## Completed QA evidence

### Page 1: Pergolas Auckland

- Marketing typecheck: passed.
- Focused browser contract: 7 of 7 passed across 1440, 1024, 768 and 390 pixel widths.
- Full marketing unit suite: 64 of 64 passed.
- Full marketing browser suite: 31 of 31 passed.
- Production marketing build: passed; `/pergolas-auckland` generated as a static route.
- Visual evidence: `artifacts/marketing-seo-landing/pergolas-auckland/` includes top, project-proof, roof-option and form captures at all four widths.
- Verified: one H1, self-canonical URL, explicit index/follow, sitemap inclusion, `WebPage`/`Service`/`BreadcrumbList` schema, no FAQ schema, resolving internal links, form validation, route attribution, green accent, no horizontal overflow and materially distinct copy from the acrylic reference route.

### Page 2: Custom Pergolas Auckland

- Marketing typecheck and mojibake guard: passed.
- Sequential Page 1–2 browser contract: 14 of 14 passed across 1440, 1024, 768 and 390 pixel widths.
- Full marketing browser suite: 38 of 38 passed.
- Production marketing build: passed; `/custom-pergolas-auckland` generated as a static route.
- Visual evidence: `artifacts/marketing-seo-landing/custom-pergolas-auckland/` includes hero, project-proof, bespoke-decision, product-context and form captures at all four widths.
- Verified: self-canonical indexable metadata, sitemap inclusion, visible FAQ content without FAQ schema, resolving links, enquiry attribution, page-specific project fields, green accent, no overflow and no repeated H1/H2 or material 10-word shingle overlap with Page 1.
- Distinct narrative: custom work is presented as resolving the joins between site constraints, geometry, structure, light and scope, not as a generic premium upgrade list.

### Page 3: Aluminium Pergolas Auckland

- Focused browser contract: 7 of 7 passed across four responsive widths, including comparisons with Pages 1–2 and the acrylic reference.
- Full marketing browser suite: 45 of 45 passed.
- Production marketing build: passed; `/aluminium-pergolas-auckland` generated as a static route.
- Visual evidence: `artifacts/marketing-seo-landing/aluminium-pergolas-auckland/` includes frame-detail hero, project, specification and form captures.
- Claim gate: no universal span, coastal, coating, durability, warranty or maintenance-performance statement is made. The exact frame, structural mix, finish and product documents remain project-specific.
- Distinct narrative: the page follows how the frame establishes openings, roof edges, junctions, finish and integrated services rather than repeating the broad or bespoke-design pages.

### Page 4: Pergola Cost Auckland

- Focused browser contract: 7 of 7 passed at four widths, including originality against every earlier/reference page.
- Full marketing browser suite: 52 of 52 passed.
- Production marketing build: passed; `/pergola-cost-auckland` generated as a static route.
- Visual evidence: `artifacts/marketing-seo-landing/pergola-cost-auckland/` includes scope-led hero, project-comparison, cost-driver and form captures.
- Claim gate: no starting price, example price, square-metre price, offer schema or timing promise is published. Project cards are explicitly presented as scope examples, not price examples.
- Distinct narrative: the page teaches readers to trace a number back to geometry, assembly, site work and responsibilities, then compare like-for-like scopes.

### Page 5: Gable Pergolas Auckland

- Focused browser contract: 7 of 7 passed across four widths and all earlier-page originality comparisons.
- Full marketing browser suite: 59 of 59 passed.
- Production marketing build: passed; `/gable-pergolas-auckland` generated as a static route.
- Visual evidence: `artifacts/marketing-seo-landing/gable-pergolas-auckland/` includes ridge-led hero, project, gable-decision and form captures.
- Distinct narrative: the page treats the gable as a section problem across ridge, eaves, pitch, end treatment, support and two-plane drainage.

### Page 6: Pitched Pergolas Auckland

- Focused browser contract: 7 of 7 passed across four widths and all earlier-page originality comparisons.
- Isolated rerun of one unrelated project-link concurrency failure: passed; subsequent full suite passed 66 of 66.
- Production marketing build: passed; `/pitched-pergolas-auckland` generated as a static route.
- Visual evidence: `artifacts/marketing-seo-landing/pitched-pergolas-auckland/` includes single-plane hero, project, roof-fall decision and form captures.
- Distinct narrative: the page follows one roof plane from high edge to low edge through fall, daylight, support and drainage rather than reusing the gable section story.

### Page 7: Outdoor Rooms Auckland

- Focused browser contract: 7 of 7 passed across four widths and all earlier-page originality comparisons.
- Full marketing browser suite: 73 of 73 passed.
- Production marketing build: passed; `/outdoor-rooms-auckland` generated as a static route.
- Visual evidence: `artifacts/marketing-seo-landing/outdoor-rooms-auckland/` includes room-led hero, project, coordination-decision and form captures.
- Distinct narrative: the page begins with dining, lounging, circulation and views, then coordinates the boundaries above, around, below and beside the room.

### Page 8: Pergolas With Blinds

- Focused browser contract: 7 of 7 passed across four widths and all earlier-page originality comparisons.
- Full marketing browser suite: 80 of 80 passed with one worker. Parallel runs exposed an existing intermittent Next.js development-server JSON parse failure on project routes; the affected existing link checks passed in isolation.
- Production marketing build: passed; `/pergolas-with-blinds` generated as a static route.
- Visual evidence: `artifacts/marketing-seo-landing/pergolas-with-blinds/` includes edge-led hero, screened-project, blind-decision and form captures.
- Claim gate: no weatherproof, wind-rating, product-performance, warranty or universal operating statement is made. Manual and motorised availability is supported by the current product navigation; exact controls and limits remain supplier-specific.
- Distinct narrative: the page treats a blind as a changing side boundary and maps direction, opening, view, supports and controls before product selection.

### Page 9: Acrylic Pergolas vs Louvre Roofs

- Focused browser contract: 7 of 7 passed across four widths and originality comparisons against all earlier pages.
- Full marketing browser suite: 87 of 87 passed with one worker.
- Marketing typecheck and production build: passed; `/acrylic-pergolas-vs-louvre-roofs` generated as a static route.
- Visual evidence: `artifacts/marketing-seo-landing/acrylic-pergolas-vs-louvre-roofs/` includes decision-led hero, acrylic project proof, responsive comparison matrix and form captures.
- Claim gate: the page states no universal winner, makes all louvre observations conditional on a supplier-specific proposal and publishes no price, waterproofing, heat, UV, wind, lifespan, maintenance or warranty performance claim. It explicitly does not confirm a current Sanctuary louvre offer.
- Distinct narrative: readers define required roof states, compare exact evidence in a purpose-built matrix and normalise complete installed scope before choosing.

### Page 10: Commercial Pergolas Auckland

- Focused browser contract: 7 of 7 passed across four widths and originality comparisons against all earlier pages.
- Final marketing browser suite: 95 of 95 passed with one worker, including programme-wide unique route/title/description/H1 checks and a computed `#4f5748` olive-green accent assertion on every page.
- Marketing typecheck and production build: passed; `/commercial-pergolas-auckland` generated as a static route. The final build used an isolated output directory because an existing local development server held the default `.next` directory open.
- Visual evidence: `artifacts/marketing-seo-landing/commercial-pergolas-auckland/` includes operational hero, four fully loaded project proofs, coordination decisions and form captures at all four widths.
- Distinct narrative: the page maps people, place and responsibility through use, circulation, building identity, services, staging and handover instead of presenting a residential page with commercial labels.

## Programme closure

- All ten routes are self-canonical, indexable, present in the public sitemap and generated statically.
- Each route has a unique metadata title, description and H1; no route repeats an H1 or H2 from any earlier programme page or the approved acrylic reference.
- Every route uses `WebPage` and `BreadcrumbList` schema. Only service-role pages add `Service`; visible FAQ content is not marked up as `FAQPage`. Existing enquiry, attachment and attribution integration remains intact.
- Every route exposes the 22 July 2026 editorial review date and reviewer in visible copy and structured data without presenting that date as approval of pending claims.
- The historic brochure endpoint permanently redirects to the governed guide library, and product downloads no longer present it as current guidance.
- Known unapproved timing, warranty and performance statements are checked across every indexable marketing route in the generated sitemap.
- Responsive browser coverage spans 1440 x 1000, 1024 x 768, 768 x 1024 and 390 x 844 with no horizontal overflow.
- The approved olive green remains the sole action accent. No burgundy or purple theme was introduced.

## Sources and guardrails

- `docs/Sanctuary_Pergolas_AI_Copywriting_Context_Pack.md`
- `docs/marketing-ui-foundation.md`
- `docs/landing-pages/acrylic-roof-pergolas-auckland/03_CONTENT_GOVERNANCE.md`
- Supplied Marketing Brain v1.1 handoff and strategy-extraction prompt. These sources define evidence, privacy and claim-review discipline; they do not provide approved numerical public claims.
