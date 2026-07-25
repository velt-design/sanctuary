# Mobile UX Roadmap Phase 3 implementation plan

Authoritative brief: `docs/mobile-ux-roadmap-v2.md`, Phase 3 and PRs 6-9.

Status: completed and production-verified on 25 July 2026. See `README.md`
for commits, measured outcomes, test results and explicit deferrals.

## Baseline and invariants

- Current and deployed commit before implementation:
  `84faf19acc96c8835b45d417588877381dd85746`.
- Before measurements and representative screenshots:
  `artifacts/mobile-ux-phase-3/before/`.
- Product claims, route identity, metadata and taxonomy remain owned by
  `apps/marketing/data/products.ts`.
- Enquiry destinations remain owned by `apps/marketing/lib/enquiryContext.ts`.
- Responsive disclosure state remains owned by the shared `Disclosure`.
- Project evidence remains owned by `apps/marketing/data/projects.ts`.
- No form, analytics, project-gallery, project-record or desktop-wide redesign
  is in scope.

## Acceptance-to-change map

| Roadmap outcome | Implementation owner | Focused verification | Evidence |
| --- | --- | --- | --- |
| Ten product routes expose outcome, essential fit, one constraint and governed evidence before no more than three optional groups | `components/products/ProductDetailPage.tsx`; a small product-detail view model; product CSS | Unit view-model tests; all-route product browser matrix; heading/copy/disclosure assertions | Before/after DOM, page height, screenshots and route matrix |
| Product details render one deliberate gallery without duplicated inventory | Shared `ResponsiveGallery`; product detail composition | Gallery DOM, keyboard, focus, accessible name, reduced motion, touch and image-request assertions | Gallery/image/payload comparison for all ten routes |
| Residential uses no more than six major sections, three process stages, three projects and compact investment drivers | `app/pergolas-auckland/page.tsx`; route-owned content; bounded CSS compatibility | Service content budgets, route/form context, links, metadata/schema and responsive browser checks | 430/390/360 screenshots, page-height/copy/section measurements |
| Custom uses the approved hierarchy but retains distinct constrained-project evidence and custom source context | `app/custom-pergolas-auckland/content.ts`; `components/seo-landing/SeoLandingPage.tsx` only for an explicit guide-navigation mode | Config/view-model tests, residential comparison, route/form payload, internal-link and responsive checks | 430/390/360 screenshots and exact content budgets |
| Product hub explains four main forms first and demotes integrated options to compact gateways | `components/products/ProductsHub.tsx`; `ProductCard.tsx` only if the compact gateway needs a bounded variant; product CSS | Four-form order/comparison, all ten canonical links, neutral enquiry context, touch/keyboard and desktop regression | Hub screenshots, sections/copy/page height and link manifest |
| Phase 1 routing and analytics plus Phase 2 project behaviour remain stable | Existing enquiry, contact, header, project and analytics suites; no contract changes | CTA query parsing, form-payload interception, canonical lower-case analytics, refresh/Back and project browse/gallery regression | Focused and full marketing test logs plus production smoke |

## Checkpoint and release gates

1. Product-detail consolidation, focused tests, then commit
   `feat(marketing): consolidate product detail journeys`.
2. Residential service simplification, focused tests, then commit
   `feat(marketing): simplify residential service journey`.
3. Custom service simplification, focused tests, then commit
   `feat(marketing): simplify custom service journey`.
4. Product-index hierarchy refinement, focused tests, then commit
   `feat(marketing): refine product index hierarchy`.
5. Full marketing unit/browser matrix; build, repository TypeScript, lint,
   architecture/dead-code guards; responsive, accessibility, no-JavaScript,
   metadata/schema/sitemap, image/payload and layout-shift evidence.
6. Confirm `main` matches `origin/main`, push, monitor deployment, run read-only
   production smoke with enquiry submission interception, record physical
   device exclusions, update current-state docs, then commit
   `docs(marketing): close mobile phase three`.
