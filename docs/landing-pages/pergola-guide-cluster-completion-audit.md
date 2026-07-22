# Pergola Guide Cluster Completion Audit

Audit date: 22 July 2026

Scope: `/pergola-guides`, its ten linked guides, every indexable marketing route in the generated sitemap, and the historic Sanctuary brochure route.

This audit separates implemented website work from business evidence that still needs approval. An editorial review date does not approve pricing, warranty, product or technical claims.

Production check: the live routes returned direct `200` responses on 22 July 2026, but they did not yet contain the current editorial-review markup. The live historic PDF response also lacked `X-Robots-Tag`. Deployment and post-deployment verification are therefore still required before the production site can be treated as corrected.

| Brief requirement | Current evidence | Status |
| --- | --- | --- |
| Keep the two Auckland pages and give them different roles | `/pergolas-auckland` owns broad Auckland design, build and installation intent. `/custom-pergolas-auckland` owns bespoke and complex-project intent. Product-guide titles and descriptions no longer borrow the custom page's primary modifier. Automated copy-similarity and unique-heading checks cover both service pages. | Complete |
| Strengthen the custom page around genuine constraints | The custom page names difficult connections, irregular footprints, changing levels, restricted posts, unusual spans, drainage, mixed materials, renovation, new-build and consultant coordination. Its four project examples include dimensions, constraints and responses. | Complete |
| Clarify fixed roofs versus louvres | The comparison guide states that the Sanctuary approaches presented are fixed acrylic, solid and combination roofs. A louvre option is treated as an external supplier proposal unless Sanctuary confirms otherwise for the enquiry. | Complete for current public wording. Formal product-range approval remains pending. |
| Correct conflicting warranty, timing and performance claims | Unsupported durations, combined warranty wording, category-wide UV and heat outcomes, generic span ranges, wind thresholds, broad maintenance comparisons and absolute weather language were removed or made product-specific. A browser regression check now covers every indexable sitemap route, including product and project pages. | Complete for current source. Deployment and evidence approvals remain pending. |
| Separate service, product and guide intent | Every guide has a declared `service`, `product-guide` or `decision-guide` role. Service schema is limited to service pages. Product and decision guides use WebPage and collection relationships instead. | Complete |
| Reduce repeated process, cost, consent and FAQ content | Generic repeated sections were removed or reassigned to the relevant owner page. Filtered-out cost and consent FAQ objects were removed from source rather than left as stale hidden copy. FAQ schema was removed as a rich-result tactic while useful visible questions remain. | Complete |
| Improve contextual links and progression | Every guide has visible breadcrumbs, previous and next navigation, a hub return, contextual owner-page links and a final enquiry route. The custom page directly links broad service, cost, gable, pitched, outdoor-room, commercial and current product-owner pages. | Complete |
| Make forms relevant to each page | The shared enquiry form supports page-specific fields. Route attribution, attachments, validation and existing API integration are preserved and browser-tested. | Complete |
| Strengthen project examples | Project cards use existing project records and add verified dimensions, constraints, materials or coordination facts. Decorative-only examples were removed from the guide cluster. | Complete |
| Improve the Cost guide with approved numerical guidance | The page now owns cost intent, explains scope confidence, quotation comparison, inclusions, exclusions, GST treatment and evidence needed for pricing. No number was published because no approved dated price set is available. | Pending Sanctuary commercial and finance approval |
| Replace the outdated brochure | Product-page links point to the current web guide library. The historic PDF endpoint is permanently redirected to `/pergola-guides`, with `X-Robots-Tag: noindex, nofollow` retained as transition protection. A direct-response test verifies the redirect. | Current source complete. Deployment, live-response verification and Search Console removal remain external. |
| Establish a governed claims register | `docs/marketing-claims-register.md` records wording status, evidence needed, limitations, approval owner, review date and affected pages. | Complete as a register. Business approvals remain pending. |
| Add reviewer and review dates | The hub and all ten guides show `Editorial review: Sanctuary Pergolas`, dated 22 July 2026. WebPage and CollectionPage schema include `dateModified` and `reviewedBy`. The adjacent note keeps technical claims subject to written evidence. | Complete |
| Verify technical SEO | Tests prove unique titles, descriptions and H1s, self-referencing canonicals, index/follow metadata, direct 200 responses, sitemap inclusion, breadcrumbs, collection markup, global Organization and LocalBusiness schema, internal-link status and absence of FAQ schema. | Complete in the local build |
| Verify mobile and image behaviour | All routes pass at 1440, 1024, 768 and 390 pixel widths with no horizontal overflow. Guide images expose responsive `srcset` and `sizes`; hero images use eager loading and high fetch priority. | Complete in the local build |
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

## Verification evidence

- `npx tsc -p apps/marketing/tsconfig.json --noEmit --incremental false`
- `npm run test:marketing`
- `npx playwright test --config=playwright.marketing.config.ts playwright/marketing.guide-hub.spec.ts playwright/marketing.seo-landing.spec.ts playwright/marketing.seo-programme.spec.ts`
- `npx playwright test --config=playwright.marketing.config.ts playwright/marketing.seo-copy-hygiene.spec.ts`
- `npm --prefix apps/marketing run build`
- `npm run architecture:changed`
