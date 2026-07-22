# Pergola Guide Cluster Completion Audit

Audit date: 22 July 2026

Scope: `/pergola-guides`, its ten linked guides, every indexable marketing route in the generated sitemap, and the historic Sanctuary brochure route.

This audit separates implemented website work from business evidence that still needs approval. An editorial review date does not approve pricing, warranty, product or technical claims.

Production check: the live routes returned direct `200` responses on 22 July 2026, but they did not yet contain the current editorial-review markup. The live historic PDF response also lacked `X-Robots-Tag`. Deployment and post-deployment verification are therefore still required before the production site can be treated as corrected.

| Brief requirement | Current evidence | Status |
| --- | --- | --- |
| Keep the two Auckland pages and give them different roles | `/pergolas-auckland` remains the broad Auckland design, build and installation service page. `/custom-pergolas-auckland` remains the bespoke and complex-project service page. Their titles, descriptions, headings, project evidence and forms remain distinct, with automated copy-similarity and identity checks covering both. | Complete |
| Strengthen the custom page around genuine constraints | The custom page names difficult connections, irregular footprints, changing levels, restricted posts, unusual spans, drainage, mixed materials, renovation, new-build and consultant coordination. Its four project examples include dimensions, constraints and responses. | Complete |
| Clarify fixed roofs versus louvres | The comparison guide states near the top that Sanctuary designs fixed acrylic, solid and combination roof approaches. Louvre systems are described as external supplier proposals, not as a Sanctuary product, and the visible answer no longer leaves future supply scope ambiguous. | Complete for current public wording. Formal product-range approval remains pending. |
| Correct conflicting warranty, timing and performance claims | Unsupported durations, combined warranty wording, category-wide UV and heat outcomes, generic span ranges, wind thresholds, broad maintenance comparisons and absolute weather language were removed or made product-specific. Homepage comparison scores and broad rain-noise or heat language were replaced with assembly-specific considerations. Lighting, heater, roof, screen and infill pages now defer measurable outcomes to current selected-product evidence. | Complete for current source. Deployment and evidence approvals remain pending. |
| Separate service, product and guide intent | The hub uses customer-facing Service, Planning, Material, Roof-form, Cost, Integration and Comparison guide labels. The fixed-acrylic product page now concentrates on the supplied assembly, exact product documents, care, warranty and relevant projects instead of repeating the guide-cluster process and cost content. Service schema remains limited to service pages. | Complete |
| Reduce repeated process, cost, consent and FAQ content | Generic repeated sections were removed or linked to the relevant guide. The acrylic product page no longer repeats a full project process or cost guide, and its generic cost, consent, service-area and timing FAQs were removed. FAQ schema remains absent while useful visible questions remain. | Complete |
| Improve contextual links and progression | Every guide has visible breadcrumbs, previous and next navigation, a hub return, natural contextual links and a final enquiry route. Visible transitions explain the benefit of the next guide or product without page-ownership, cluster-management or SEO terminology. | Complete |
| Make forms relevant to each page | The shared enquiry form supports page-specific fields. Route attribution, conditional values, attachments, validation, accessible errors and existing API integration are preserved and browser-tested. An end-to-end attachment test confirms selected-file feedback and submitted metadata. | Complete |
| Strengthen project examples | Project cards use current project records and retain dimensions, roof form, materials and design response. Contradictory legacy details were removed from Good Home, KiwiRail, Tindalls Bay, Atelier Shu, Muriwai and Waiheke records, with source-level claim tests preventing their return. | Complete, with the KiwiRail area basis pending confirmation. |
| Improve the Cost guide with approved numerical guidance | The page now owns cost intent, explains scope confidence, quotation comparison, inclusions, exclusions, GST treatment and evidence needed for pricing. No number was published because no approved dated price set is available. | Pending Sanctuary commercial and finance approval |
| Replace the outdated brochure | Product-page links point to the current web guide library. A before-files rewrite sends the historic PDF URL through a dedicated 308 handler so the redirect to `/pergola-guides` carries `X-Robots-Tag: noindex, nofollow`. Direct-response tests verify both status and header; sitemap, metadata, schema and current links omit the PDF. | Current source complete. Deployment, live-response verification and Search Console removal remain external. |
| Establish a governed claims register | `docs/marketing-claims-register.md` records wording status, evidence needed, limitations, approval owner, review date and affected pages. | Complete as a register. Business approvals remain pending. |
| Add reviewer and review dates | The hub and all ten guides show `Editorial review: Sanctuary Pergolas`, dated 22 July 2026. WebPage and CollectionPage schema include `dateModified` and `reviewedBy`. The adjacent note keeps technical claims subject to written evidence. | Complete |
| Verify technical SEO | Tests prove unique titles, descriptions and H1s, self-referencing canonicals, index/follow metadata, direct 200 responses, sitemap inclusion, breadcrumbs, Open Graph identity, accurate WebPage/CollectionPage/ItemList/Service use, global Organization and LocalBusiness schema, internal-link status and absence of FAQ schema. | Complete in the local build |
| Verify rendering and duplication | Every refined guide and acrylic product route renders one H1, one form and one final CTA section, with no sticky duplicate CTA or repeated H1/H2. Responsive tests cover 1440, 1024, 768 and 390 pixel widths, image hints, overflow, hydration/console errors and mobile form usability. The standalone project gallery no longer repeats its lead hero image below the carousel. | Complete in the local build |
| Verify Search Console canonical selection and query overlap | Requires access to the production Search Console property and sufficient live data after deployment. | External dependency |
| Publish consent terminology guidance | Current pages use project-specific language and do not promise exemption or approval. Final terminology should be approved against current authority and legal guidance before stronger public advice is added. | Pending Sanctuary design or legal approval |

## Required approval package

1. A dated set of representative project price bands with GST treatment, inclusions, exclusions, engineering, consent, access and accessory assumptions.
2. Current signed workmanship warranty terms plus manufacturer and coating warranty schedules.
3. Current manufacturer documents for acrylic UV, solar-control, span, operating and maintenance claims.
4. A formal statement on whether Sanctuary supplies, installs, resells or only compares louvre systems.
5. Approved consent terminology and the internal owner responsible for keeping it current.
6. Search Console property access for canonical selection, query-overlap review and removal of the indexed historic PDF.
7. Deployment of the current marketing build, followed by live-response, metadata, schema, form and PDF-header verification.
8. Confirmation of the KiwiRail published area basis: the current record states a 30.0 m by 3.0 m plan and 115 m² total area.

## Verification evidence

- `npx tsc -p apps/marketing/tsconfig.json --noEmit --incremental false`
- `npm run test:marketing`
- `npx playwright test --config=playwright.marketing.config.ts marketing.guide-cluster-final-refinement.spec.ts marketing.guide-hub.spec.ts marketing.seo-copy-hygiene.spec.ts marketing.seo-landing.spec.ts marketing.seo-programme.spec.ts marketing.acrylic-foundation.spec.ts`
- `npm --prefix apps/marketing run build`
- `npm run architecture:changed`
