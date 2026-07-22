# Marketing UI Foundation

Status: Current foundation with approved public-route adoptions.

This document owns the Architectural Editorial UI system demonstrated at the standalone internal route `/__foundation/marketing`. It is an image-led, square-cornered, restrained reference for future explicitly approved marketing work. Public routes adopt it only through separately approved, route-scoped migrations.

## Source Of Truth

- Route-local semantic colour, type, layout, and responsive tokens: `apps/marketing/app/%5F%5Ffoundation/marketing/catalogue.module.css`.
- Reusable primitives, controls, and editorial patterns: `apps/marketing/components/marketing-foundation/`.
- Live catalogue: `/__foundation/marketing`, implemented by the escaped Next.js route folder `apps/marketing/app/%5F%5Ffoundation/marketing/`.
- Shared header fonts: Instrument Sans and Inter, loaded by the public root layout; foundation routes use the same families.

Public content owners, integrations, footer, and route layouts remain outside this foundation unless a separate task explicitly approves migration. The shared public header is an approved site-wide adoption.

Use Instrument Sans for display text and Inter for body, navigation, forms, and technical information. Keep corners square, borders and dividers at 1px, shadows absent, and use olive green as the single action and conversion accent.

## Component Contract

The foundation exports layout and content primitives (`Container`, `Section`, `Eyebrow`, `Heading`, `Text`, `Button`, `TextLink`, `Rule`, `Figure`, `ProjectMeta`) and labelled form controls (`Field`, `TextareaField`, `SelectField`, `CheckboxField`, `RadioGroup`). Prefer their semantic variants instead of route-local colour, alignment, or spacing props.

It also exports navigation, homepage and project heroes, introductions, split narratives, principles, full-bleed statements, galleries, specification rows, materials, project stories, testimonials, process steps, comparisons, FAQs, responsive examples, and conversion sections. The catalogue demonstrates these reusable exports rather than maintaining parallel mock markup.

## Catalogue Guard

The catalogue is `noindex`, absent from public navigation and sitemap output, and available in development. In production its content is unavailable unless `ENABLE_MARKETING_FOUNDATION=true` is set explicitly. Keep this fail-closed access rule in `foundationAccess.ts` so it remains unit-testable.

The public root layout still renders its normal chrome structurally. Route-local catalogue CSS hides that chrome only when `[data-marketing-foundation]` is present, allowing the catalogue to demonstrate its own navigation without changing public components.

## Public Boundary

The following files are not catalogue owners and must not be changed as a side effect of catalogue-only work:

- `apps/marketing/styles/tokens.css`
- `apps/marketing/app/globals.css`
- `apps/marketing/app/page.tsx`
- `apps/marketing/components/Header.tsx`
- `apps/marketing/components/SiteFooter.tsx`
- `apps/marketing/components/home/**`

Analytics, consent, pixels, structured data, project content, reviews, and enquiry flows remain untouched. Public-route migrations require their own approval and focused regression plan.

## Approved Public Adoption

`/acrylic-roof-pergolas-auckland` is the first approved route-scoped adoption. It imports the foundation fonts and reusable `Container`, `Section`, `Heading`, `Eyebrow`, `Text`, `Button`, `TextLink`, and `ProcessSteps` exports, while its specialised tint comparison, project proof, FAQ, and enquiry form remain route-owned.

The route defines the same semantic page tokens locally. Its approved copy, canonical URL, metadata, FAQ schema, project links, attribution, secure attachment upload, enquiry API contract, consent behavior, and form-state logic remain owned by the landing page and existing marketing integrations.

The ten-route SEO landing-page programme is the second approved adoption. It uses the config-driven owners in `apps/marketing/components/seo-landing/` for the page shell, editorial blocks, responsive comparison matrix, structured data, conversion section and route-configured enquiry copy. Route content and metadata remain in each route folder, while the existing enquiry API, attachment, attribution, privacy and conversion-event contracts remain unchanged.

The programme routes are listed in `docs/landing-pages/seo-landing-page-programme.md`. They share the architectural system without sharing substantial copy: each has a distinct search intent, metadata identity, H1, section narrative, project selection and FAQ set. Every route retains `#4f5748` olive green as the action accent; burgundy and purple are not part of this adoption.

`/pergola-guides` is the programme's approved public directory. It presents all ten routes as an editorial design library grouped into three decision-led chapters: planning the project, choosing form and structure, and comparing scope and components. The page owns its metadata, `CollectionPage`, ordered `ItemList` and breadcrumb schema through `apps/marketing/app/pergola-guides/`; the typed directory content in `apps/marketing/data/pergolaGuides.ts` is the single owner of guide names, routes and summaries.

Guide card numbers follow their displayed reading order across the three chapters: 01 to 04, 05 to 07 and 08 to 10. Programme-owned visible copy, metadata and structured data use natural sentence punctuation without en or em dashes; the browser suite enforces both content rules.

The directory is self-canonical, indexable, included in the public sitemap and linked from the existing footer. Its footer change is limited to one discovery link; the established footer layout, reviews, social links and contact action are unchanged. The route retains the same square-cornered, rule-led foundation and `#4f5748` olive accent as the programme pages. On desktop, its 50/50 hero split shares the viewport centreline with the midpoint between Projects and Products in the navigation.

The shared public header now uses the architectural editorial treatment across marketing routes: Instrument Sans branding, Inter navigation, square controls, a thin 1px rule, the olive `#4f5748` estimate action, and a 64px solid collapsed mobile state. Its desktop navigation is centred on the midpoint of the space between Projects and Products rather than on the unequal outer link widths. The mobile menu keeps body scroll locked, moves focus into the menu, closes with Escape, and returns focus to its trigger.

The ten programme routes and `/pergola-guides` additionally use the approved hero-overlay state on desktop. At the top of those pages, the hero begins at the viewport edge beneath a transparent header with white navigation and a fine light rule, fills at least one viewport, and keeps the following section below the fold. After a deliberate scroll, the header returns to the solid canvas, dark text and blur treatment. At 900px and below the header stays solid and the hero begins below it. Keep transparent overlap limited to routes listed by the shared header; all other public routes use the same new header in its solid state.

The public homepage content and layout remain on their established implementation; only its shared header presentation is part of this adoption.

`/home-v2` is an approved comparison route for evaluating a second homepage composition before any migration of `/`. It reuses the production foundation primitives, project data, curated review content, live Google rating source, shared header and footer, analytics, consent and existing `/contact` enquiry destination. Its hero is included in the shared header's desktop overlay allowlist, while tablet and mobile keep the solid 64px header.

The comparison route owns its content and scoped tokens under `apps/marketing/app/home-v2/`. It is `noindex, nofollow`, canonicalises to `/`, and remains absent from the sitemap, manifest, header, footer and public homepage links. Do not redirect, relink or replace `/` with this route without explicit approval. The established owners `apps/marketing/app/page.tsx`, `apps/marketing/app/home.css` and `apps/marketing/components/home/**` remain unchanged.

Root height and overflow normalisation on a comparison route must preserve the shared mobile-menu and consent locks. The V2 browser suite opens the mobile menu from a non-zero scroll position and verifies that the document stays fixed, Escape restores focus, and the prior reading position returns when the menu closes.

## Verification

- `npx vitest run apps/marketing/app/%5F%5Ffoundation/marketing/foundationAccess.test.ts`
- `npx tsc -p apps/marketing/tsconfig.json --noEmit --incremental false`
- `npm run test:marketing:browser`
- `npm run build:marketing`
- `npx playwright test playwright/marketing.home-v2.spec.ts --config=playwright.marketing.config.ts`
- Shared-header Playwright coverage at desktop and mobile widths, including geometry, green accent, keyboard focus, and representative public-route screenshots.

The Playwright lane checks the standalone catalogue, shared header, homepage, homepage comparison, every SEO programme route and the guide directory at desktop, compact desktop, tablet and mobile widths. It covers metadata, canonical/index state, unique identities, green accent, project and FAQ rendering, all ten directory destinations, horizontal overflow, mobile navigation, form attribution, sitemap inclusion, resolving internal links and visible schema parity. The homepage comparison suite additionally proves `/home-v2` is unlisted and noindex, retains its live review and enquiry paths, loads all imagery, uses the correct responsive header states and leaves the established homepage composition intact. The hero-navigation matrix proves every programme route has true desktop image/header overlap, no canvas gap at the fold, a viewport-centred Projects/Products gap, the guide hero split on that same centreline, transparent top and solid scrolled states, and the solid collapsed treatment at tablet and mobile widths.
