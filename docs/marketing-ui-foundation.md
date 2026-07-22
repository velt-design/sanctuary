# Marketing UI Foundation

Status: Current foundation with approved public-route adoptions.

This document owns the Architectural Editorial UI system demonstrated at the standalone internal route `/__foundation/marketing`. It is an image-led, square-cornered, restrained reference for future explicitly approved marketing work. Public routes adopt it only through separately approved, route-scoped migrations.

## Source Of Truth

- Route-local semantic colour, type, layout, and responsive tokens: `apps/marketing/app/%5F%5Ffoundation/marketing/catalogue.module.css`.
- Reusable primitives, controls, and editorial patterns: `apps/marketing/components/marketing-foundation/`.
- Live catalogue: `/__foundation/marketing`, implemented by the escaped Next.js route folder `apps/marketing/app/%5F%5Ffoundation/marketing/`.
- Route-local fonts: Instrument Sans and Inter, loaded by the foundation layout only.

Public marketing tokens, global CSS, navigation, footer, homepage components, content owners, integrations, and routes remain outside this foundation and must retain their established presentation and behavior unless a later task explicitly approves migration.

Use Instrument Sans for display text and Inter for body, navigation, forms, and technical information. Keep corners square, borders and dividers at 1px, shadows absent, and use olive green as the single action and conversion accent.

## Component Contract

The foundation exports layout and content primitives (`Container`, `Section`, `Eyebrow`, `Heading`, `Text`, `Button`, `TextLink`, `Rule`, `Figure`, `ProjectMeta`) and labelled form controls (`Field`, `TextareaField`, `SelectField`, `CheckboxField`, `RadioGroup`). Prefer their semantic variants instead of route-local colour, alignment, or spacing props.

It also exports navigation, homepage and project heroes, introductions, split narratives, principles, full-bleed statements, galleries, specification rows, materials, project stories, testimonials, process steps, comparisons, FAQs, responsive examples, and conversion sections. The catalogue demonstrates these reusable exports rather than maintaining parallel mock markup.

## Catalogue Guard

The catalogue is `noindex`, absent from public navigation and sitemap output, and available in development. In production its content is unavailable unless `ENABLE_MARKETING_FOUNDATION=true` is set explicitly. Keep this fail-closed access rule in `foundationAccess.ts` so it remains unit-testable.

The public root layout still renders its normal chrome structurally. Route-local catalogue CSS hides that chrome only when `[data-marketing-foundation]` is present, allowing the catalogue to demonstrate its own navigation without changing public components.

## Public Boundary

The following files are explicitly not foundation owners and must not be changed as a side effect of catalogue work:

- `apps/marketing/styles/tokens.css`
- `apps/marketing/app/globals.css`
- `apps/marketing/app/page.tsx`
- `apps/marketing/components/Header.tsx`
- `apps/marketing/components/SiteFooter.tsx`
- `apps/marketing/components/home/**`

Analytics, consent, pixels, structured data, project content, reviews, enquiry flows, and all existing public-route behavior remain untouched. A future migration requires its own approval and focused regression plan.

## Approved Public Adoption

`/acrylic-roof-pergolas-auckland` is the first approved route-scoped adoption. It imports the foundation fonts and reusable `Container`, `Section`, `Heading`, `Eyebrow`, `Text`, `Button`, `TextLink`, and `ProcessSteps` exports, while its specialised tint comparison, project proof, FAQ, and enquiry form remain route-owned.

The route defines the same semantic tokens locally and may restyle the existing global header and mobile-menu chrome only while `.acrylic-landing` is present. Its approved copy, canonical URL, metadata, FAQ schema, project links, attribution, secure attachment upload, enquiry API contract, consent behavior, and form-state logic remain owned by the landing page and existing marketing integrations. Homepage and other public-route presentation remain outside this adoption.

The ten-route SEO landing-page programme is the second approved adoption. It uses the config-driven owners in `apps/marketing/components/seo-landing/` for the page shell, editorial blocks, responsive comparison matrix, structured data, conversion section and route-configured enquiry copy. Route content and metadata remain in each route folder, while the existing enquiry API, attachment, attribution, privacy and conversion-event contracts remain unchanged.

The programme routes are listed in `docs/landing-pages/seo-landing-page-programme.md`. They share the architectural system without sharing substantial copy: each has a distinct search intent, metadata identity, H1, section narrative, project selection and FAQ set. Every route retains `#4f5748` olive green as the action accent; burgundy and purple are not part of this adoption.

`/pergola-guides` is the programme's approved public directory. It presents all ten routes as an editorial design library grouped into three decision-led chapters: planning the project, choosing form and structure, and comparing scope and components. The page owns its metadata, `CollectionPage`, ordered `ItemList` and breadcrumb schema through `apps/marketing/app/pergola-guides/`; the typed directory content in `apps/marketing/data/pergolaGuides.ts` is the single owner of guide names, routes and summaries.

Guide card numbers follow their displayed reading order across the three chapters: 01 to 04, 05 to 07 and 08 to 10. Programme-owned visible copy, metadata and structured data use natural sentence punctuation without en or em dashes; the browser suite enforces both content rules.

The directory is self-canonical, indexable, included in the public sitemap and linked from the existing footer. Its footer change is limited to one discovery link; the established footer layout, reviews, social links and contact action are unchanged. The route retains the same square-cornered, rule-led foundation and `#4f5748` olive accent as the programme pages. On desktop, its 50/50 hero split shares the viewport centreline with the midpoint between Projects and Products in the navigation.

The ten programme routes and `/pergola-guides` use the foundation navigation-state contract on desktop. At the top of the page, the hero begins at the viewport edge beneath a transparent header with white navigation and a fine light rule, fills at least one viewport, and keeps the following section below the fold. The shared desktop navigation is centred on the midpoint of the space between Projects and Products rather than on the unequal outer link widths. After a deliberate scroll, the header returns to the solid canvas, dark text and blur treatment. At 900px and below, the established solid collapsed header and mobile menu remain unchanged; the hero begins below that header. Keep the hero-overlay behavior route-scoped in the shared header and landing-page CSS rather than changing homepage or unrelated public routes.

The public homepage remains outside this adoption and retains its established implementation.

## Verification

- `npx vitest run apps/marketing/app/%5F%5Ffoundation/marketing/foundationAccess.test.ts`
- `npx tsc -p apps/marketing/tsconfig.json --noEmit --incremental false`
- `npm run test:marketing:browser`
- `npm run build:marketing`
- `git diff --quiet HEAD -- <public-boundary-files>` to prove public presentation source parity.

The Playwright lane checks the standalone catalogue and unchanged homepage plus every SEO programme route and the guide directory at desktop, compact desktop, tablet and mobile widths. It covers metadata, canonical/index state, unique identities, green accent, project and FAQ rendering, all ten directory destinations, horizontal overflow, mobile navigation, form attribution, sitemap inclusion, resolving internal links and visible schema parity. The hero-navigation matrix additionally proves every programme route has true desktop image/header overlap, no canvas gap at the fold, a viewport-centred Projects/Products gap, the guide hero split on that same centreline, transparent top and solid scrolled states, and the unchanged solid collapsed treatment at tablet and mobile widths.
