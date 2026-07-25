# Mobile UX Roadmap v2 — Phase 4 implementation plan

Authoritative brief: `docs/mobile-ux-roadmap-v2.md`, Phase 4, PRs 10–13.

## Baseline

- Branch: `main`
- Starting commit: `45230e70` (`docs(marketing): close mobile phase three`)
- Production origin: `https://www.sanctuarypergolas.co.nz`
- Required viewports: 430 × 932, 390 × 844 and 360 × 800
- Physical-device follow-up remains Phase 5 work; it is not presented as completed here.

## Checkpoint 1 — condense the commercial journey

Acceptance:

- Put governed commercial project evidence immediately after the hero.
- Present three clear delivery stages before deeper coordination detail.
- Keep no more than six major regions before the enquiry.
- Preserve commercial enquiry context and all existing Phase 1–3 contracts.

Implementation owners:

- `apps/marketing/app/commercial-pergolas-auckland/content.ts`
- `playwright/marketing.phase-four.spec.ts`

The shared config-driven SEO landing renderer remains the owner. The work changes the
commercial configuration rather than forking a one-off page.

## Checkpoint 2 — add the professional capability journey

Acceptance:

- Add a discoverable professional route for architects, designers and builders.
- Explain Sanctuary's role, collaboration model, documentation inputs and engineering
  interfaces without inventing unsupported claims.
- Show three governed project records.
- Carry canonical professional enquiry context and the existing supported-file contract
  into the form.

Implementation owners:

- `apps/marketing/app/architects-designers-builders/`
- `apps/marketing/components/headerNavigation.ts`
- `apps/marketing/app/home-v2/`
- `apps/marketing/app/sitemap.ts`
- shared `SeoLandingPage` and enquiry-context utilities, without a new form fork

## Checkpoint 3 — simplify the guide journeys

Acceptance:

- Replace ten repeated guide-card description controls with concise visible distinctions.
- Give each of the seven guide-detail routes a concise answer, one relevant project and a
  route back before optional depth.
- Preserve canonical URLs, body content, internal links, metadata and no-JavaScript access.

Implementation owners:

- `apps/marketing/app/pergola-guides/page.tsx`
- `apps/marketing/app/pergola-guides/pergola-guides.module.css`
- `apps/marketing/components/seo-landing/`
- the seven guide content configs
- focused unit and browser coverage

The first-layer transformation will live in one pure shared view-model helper. Each guide
declares only its answer block, governed project and return route; seven route-specific
rendering forks are explicitly avoided.

## Checkpoint 4 — refine site utility and the homepage close

Acceptance:

- Make phone and email visible in a compact footer and remove the viewport-height footer.
- Keep core navigation, legal, review and address utility without repeating the header.
- Keep the homepage at no more than eight major regions, combine lower-page testimonial
  proof with the final close, reduce repetitive planning controls and keep guide links
  compact.
- Do not alter unrelated desktop composition.

Implementation owners:

- `apps/marketing/components/SiteFooter.tsx`
- `apps/marketing/app/home-v2/Homepage.tsx`
- `apps/marketing/app/home-v2/content.ts`
- `apps/marketing/app/home-v2/home-v2.module.css`
- focused unit and browser coverage

## Verification and evidence

- Capture production-before and deployed-after metrics at all three required viewports.
- Record HTML size, document height/width, first-layer words, major-region counts,
  disclosure counts, image requests/bytes, CLS, overflow, touch-target findings and footer
  geometry.
- Capture representative screenshots for commercial, professional, guide hub, guide
  detail, homepage and footer states.
- Assert semantic landmarks, keyboard focus, reduced motion, no-JavaScript completeness,
  enquiry context, canonical metadata, sitemap discovery, analytics properties and form
  payloads.
- Run focused Vitest and Playwright checks after each checkpoint, then the full repository
  quality gate and `npm run architecture:changed` before release.

## Maintainability and scope controls

- The existing `playwright/marketing.mobile-content-density.spec.ts` is already a warning
  hotspot, so Phase 4 cross-route evidence belongs in a new focused spec.
- No required form fields, uploads, gallery/disclosure primitives, CRM mappings or
  Phase 1–3 enquiry contracts are redesigned.
- No Phase 5 work, broad desktop redesign or unrelated portal work is included.
