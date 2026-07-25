# Mobile UX Roadmap Phase 3 evidence

Status: complete and production-verified on 25 July 2026.

Authoritative brief: `docs/mobile-ux-roadmap-v2.md`, Phase 3 and PRs 6-9.

## Release identity

- Baseline production and repository commit:
  `84faf19acc96c8835b45d417588877381dd85746`.
- Production-verified implementation commit:
  `e717fc57`.
- Branch: `main`; `origin/main...main` was `0 0` before release.
- Marketing deployment status:
  [Vercel sanctuary deployment](https://vercel.com/jordans-projects-43df95bd/sanctuary/9f9REBac7wUgAhWcWdM1uMZVYKgX)
  reported `success`.
- Portal deployment status:
  [Vercel sanctuary-portal deployment](https://vercel.com/jordans-projects-43df95bd/sanctuary-portal/EpoTvhGQbdeZ7HJimjShY7jDf9RY)
  reported `success`; no portal source changed.
- Production origin used by the release capture:
  `https://www.sanctuarypergolas.co.nz`.

## Completed checkpoints

| Roadmap checkpoint | Commit | Result |
| --- | --- | --- |
| PR 6, consolidate product-detail journeys | `3cadd10a` | All ten routes use one decision view model, one controlled gallery and three purposeful disclosure groups. |
| PR 7, simplify residential service | `53a65628` | Six major regions, three projects, three process stages, compact investment drivers and one support disclosure. |
| PR 8, simplify custom service | `8f8d414c` | Six major regions with three constrained-project examples, three stages, distinct custom conditions and one support disclosure. |
| PR 9, refine the product index | `f752ac8d` | Four image-led pergola forms lead; screens/walls and lighting/heating are compact secondary gateways. |
| Phase 3 completion contract | `e717fc57` | Repeatable all-route payload, responsive, accessibility, image and production-capture evidence. |

## Actual implementation and test files

- Product detail:
  `apps/marketing/components/products/ProductDetailPage.tsx`,
  `productDetailViewModel.ts`, `productDetailViewModel.test.ts` and
  `product-pages.module.css`.
- Product hub:
  `apps/marketing/components/products/ProductsHub.tsx`,
  `productHubViewModel.ts`, `productHubViewModel.test.ts` and the shared
  product stylesheet.
- Residential:
  `apps/marketing/app/pergolas-auckland/page.tsx`, `content.ts` and
  `content.test.ts`.
- Custom:
  `apps/marketing/app/custom-pergolas-auckland/content.ts` and
  `content.test.ts`.
- Shared configured service adapter:
  `apps/marketing/components/seo-landing/SeoLandingPage.tsx` and `types.ts`.
- Browser evidence:
  `playwright/marketing.phase-three.spec.ts`,
  `marketing.products.spec.ts`, `marketing.mobile-content-density.spec.ts`,
  `marketing.seo-landing.spec.ts` and `playwright.marketing.config.ts`.

No product catalogue, project record, enquiry utility, form, analytics or
gallery/disclosure primitive was rewritten.

## Before and after at 390 px

The before capture is from production at the baseline commit. The after
capture is from the deployed implementation. Word counts use closed responsive
detail unless explicitly described as expanded.

| Surface | Before | After | Outcome |
| --- | ---: | ---: | --- |
| Product detail visible words, ten-route range | 391-471 | 294-344 | Outcome, fit, one constraint, evidence and actions remain in the first layer. |
| Product detail major regions before final action | 11 | 9 | Repeated narrative regions were consolidated. |
| Product detail disclosures | 7 | 3 | Exact IDs are `fit-and-definition`, `specification-and-tradeoffs` and `related-support`. |
| Product gallery sequences / gallery image DOM | 2 / 4 | 1 / 1 | One shared controlled sequence replaces repeated inventory. |
| Product unique image requests, ten-route range | 3-4 | 2-3 | No duplicate image request was recorded on any detail route. |
| Product page height, ten-route range | 6,578-6,850 px | 4,524-4,785 px | A materially shorter mobile decision path. |
| Product HTML, ten-route range | 105,825-118,152 bytes | 96,007-108,820 bytes | Complete server-rendered supporting content remains available. |
| Residential full visible copy | 1,246 | 739 | 40.7% lower across the complete visible `main`. |
| Residential comparable expanded first layer | 901 | 706 | 21.6% lower, within the roadmap's further 20-30% target. |
| Residential major regions / disclosures / projects / stages | 9 / 3 / 4 / 5 | 6 / 1 / 3 / 3 | Proof remains early, with an early CTA and final enquiry. |
| Custom full visible copy | 1,162 | 841 | 27.6% lower while custom conditions stay distinct. |
| Custom major regions / disclosures / projects / stages | 9 / 3 / 4 / 5 | 6 / 1 / 3 / 3 | Three constrained examples lead into one compact support gateway. |
| Product hub visible words / major regions | 741 / 8 | 600 / 7 | Four forms lead and integrated options become secondary gateways. |
| Product hub HTML / page height | 118,618 bytes / 9,878 px | 92,502 bytes / 8,505 px | All ten canonical destinations remain present. |
| Product hub unique image requests | 5 | 5 | The hierarchy changed without adding a new image payload. |

The baseline service routes used a viewport-locked document shell, so their
captured `documentHeight` values are not valid before/after comparators and
are intentionally not reported.

## Responsive, image and layout evidence

`after/route-measurements.json` contains 39 deployed records: the product hub,
all ten product details, residential and custom at 430x932, 390x844 and
360x800. Every record has:

- no horizontal overflow;
- cumulative layout shift `0`;
- a hero image with `fetchpriority="high"` and eager loading; and
- the same route-owned content and disclosure budgets at all three widths.

Representative screenshots include:

- `products-{430,390,360}-top.png` and `products-390-full.png`;
- `products--pergolas--gable-{430,390,360}-top.png` and its 390 px full page;
- `products--lighting-heating--patio-heaters-{430,390,360}-top.png` and its
  390 px full page, including the not-published evidence state;
- residential and custom top screenshots at every target width; and
- useful 390 px project-evidence viewport captures for both service journeys.

The `before/` and `after/` folders are directly comparable for the hub, gable
and heater states. Service evidence deliberately uses top and scrolled
viewport captures because Chromium produced unusable blank off-screen
full-page service captures with the route's scrolling shell.

## Verification

- Product/service view-model and content tests passed as part of
  `npm run test:marketing`: 44 files and 188 tests.
- Full workspace `npm run typecheck` passed.
- Repository `npm run lint` passed, including docs, package, cache, brand,
  mojibake and ESLint guards.
- `npm run build:marketing` produced the 64-page production build.
- Changed-file architecture and dead-code reports were clean: 41 owned files,
  none unclaimed, no new dead code, root compatibility path, browser Supabase
  access or service-role access.
- The full serial browser matrix recorded 237 passes, 10 intentional capture
  skips and three desktop header-scroll failures found only under Next
  development runtime. Those exact three passed against production and the
  local optimized production build, giving 240 green non-capture checks on an
  optimized runtime. The unrelated desktop header was not changed.
- The deployed Phase 3 route matrix recorded 74 passes and one intentional
  capture skip across all ten product routes, both services, the product hub
  and Phase 2 project regression.
- Five additional deployed contact checks passed for neutral/audience
  routing, canonical and legacy parsing, project refresh/Back, intercepted
  product form payload and consent-controlled analytics.
- The opt-in deployed evidence capture passed separately and wrote this
  folder's after measurements and screenshots.

`playwright/marketing.mobile-content-density.spec.ts` is a pre-existing
cohesive cross-route harness and now has 1,238 lines after 66 Phase 3 assertion
lines were added. The dedicated `marketing.phase-three.spec.ts` owns the new
all-route measurement and capture responsibility; splitting the established
density harness during the release gate was deferred because it would add
unrelated risk.

## Enquiry and analytics regression

Production checks confirmed:

- direct `/contact` remains neutral;
- residential, commercial and professional routes retain their validated
  audience;
- project context survives refresh, Back and forward navigation;
- product context is visible above the form and product audience stays neutral
  until the visitor chooses or reliable entry context supplies one;
- the intercepted product payload retained `enquiry_type`, `source_path`,
  `source_component` and `source_product`;
- consented events retained lower-case canonical context; and
- names and phone values were absent from analytics data.

All form-request assertions intercepted `**/api/enquiry`; no real customer
enquiry was submitted.

## Accessibility and explicit deferrals

Automated coverage passed for semantic disclosures, keyboard activation,
visible focus, accessible gallery names and status, stable control focus,
44 px targets, reduced motion, one active gallery image and complete
no-JavaScript/server-rendered supporting content. Chromium emulation is not
real-device evidence.

No physical iOS Safari, Android Chrome, VoiceOver or TalkBack device was
available. Those four checks remain explicitly unverified and belong to Phase
5 / PR 14.

## Non-goals confirmed

Phase 3 did not change product taxonomy or URLs, delete guide routes, add
pricing or unsupported claims, rewrite project records or photography,
broadly redesign desktop, change enquiry fields/routing/uploads/analytics, or
start commercial, professional, guide, footer, homepage lower-half, Phase 4
or Phase 5 work.
