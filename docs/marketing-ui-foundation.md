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

The foundation exports layout and content primitives (`Container`, `Section`, `Eyebrow`, `Heading`, `Text`, `Button`, `TextLink`, `Rule`, `Figure`, `ProjectMeta`) and labelled form controls (`Field`, `TextareaField`, `SelectField`, `CheckboxField`, `RadioGroup`). Prefer their semantic variants instead of route-local colour, alignment, or spacing props. `Figure` and the image-led patterns accept an optional `objectPosition`; use the shared focal position for a repeated project image so its architectural subject remains consistently framed across landscape, square and responsive crops.

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

The public homepage is an approved route-scoped foundation adoption described below. Its content, responsive presentation and shared header remain owned by the root homepage implementation rather than by the internal catalogue.

`/projects` and every canonical `/projects/[slug]` case-study route are an approved route-scoped adoption. They use one server-rendered case-study composition at every width, with a sticky desktop project rail and a focus-managed mobile selector sheet as the only client interaction. The collection route keeps legacy `?slug=` selection compatible while canonical project links, metadata and structured data point to the detail routes.

The projects surface owns its Foundation-derived tokens and square, rule-led editorial layout in `apps/marketing/app/projects/projects.css`. It preserves the existing header, footer, consent, contact destination, project URLs and project data owner. Facts omit unavailable values, and the visible brief, constraint, design response, roof approach, gallery, technical detail, related work and circular previous/next links all come from the governed project record rather than route-local claims.

`/products` and all ten canonical `/products/[category]/[item]` routes are an approved route-scoped adoption. The index is a complete decision hub for four pergola forms, three screen or edge treatments and three lighting or heating options. Detail routes use one server-rendered editorial composition with a pergola-form and integrated-option variant. Both use normal document flow rather than the retired accordion rail or nested page scrollers, and every detail route exposes one visible H1 at every width.

`apps/marketing/data/products.ts` is the single typed owner of product routes, categories, index summaries, hero and gallery media, customer outcomes, technical detail, design questions, trade-offs, options, FAQs, related products, guide links, project evidence and metadata inputs. The former `mega.ts`, `productContent.ts`, `productDescriptions.ts`, `productImages.ts`, slug-to-image switch, accordion and legacy product-details renderer are retired. Sitemap, metadata, Open Graph and structured-data consumers all use the same catalogue.

Project evidence has three explicit states. `governed` links a product decision to a current project record; `context-only` permits a relevant project image or design context only when the page states that it is not proof of the exact product; and `not-published` exposes the evidence gap instead of inferring an installation. Acrylic infill and slat screens currently use context-only evidence. Patio heaters currently use the not-published state. Do not upgrade either state without a current governed project or product record.

The product presentation is owned by `apps/marketing/components/products/` and its scoped CSS module. It keeps square corners, one-pixel rules, Foundation typography and the olive action accent. Contact's historical grid primitives moved to `apps/marketing/app/contact/base.css`, and Privacy now has its own Foundation-derived module; neither is imported by product routes. The established header, footer, consent, analytics and `/contact?enquiry=residential#contact-form` destination remain unchanged.

The approved public homepage lives at `/` and is implemented by `apps/marketing/app/home-v2/`; the former `/home-v2` comparison URL permanently redirects to `/`. The root page reuses the production foundation primitives, project data, curated review content, live Google rating source, shared header and footer, analytics, consent and existing `/contact` enquiry destination. Its hero is included in the shared header's desktop overlay allowlist, while tablet and mobile keep the solid 64px header.

The homepage presents Sanctuary as an Auckland designer, builder and installer of bespoke fixed-roof architectural pergolas. It keeps the Warkworth project as the primary evidence and uses one server-rendered content source and semantic heading structure at every width. At 640px and below, residential and custom pathways stay visible while commercial and professional routes use one accessible disclosure; a two-project preview appears early; form and roof choices become image-led; the five process titles remain visible with expandable detail; one review is shown at a time with manual controls; assurance and secondary enquiry inputs use native disclosure; and the guide gateway exposes exactly three crawlable links. Desktop retains the established editorial composition apart from corrected CTA continuity, the reduced guide gateway and the adjacent design/pathway sequence.

Homepage interaction links and controls expose stable event attributes. The route-local tracker records only the event name, V2 variant, viewport category, destination and optional editorial label, and only after analytics consent. Hero, pathway, pergola-form, roof, project, disclosure, review-control, guide and final-enquiry interactions therefore remain distinguishable without collecting project or customer details.

The homepage owns its content and scoped tokens under `apps/marketing/app/home-v2/`. The root page is indexable, self-canonical at `/`, present in the sitemap and backed by the approved title, description, Open Graph identity and WebSite/WebPage schema. The retired `/home-v2` URL remains absent from navigation, footer and sitemap output and must continue to redirect permanently to `/`. The established legacy owners `apps/marketing/app/home.css` and `apps/marketing/components/home/**` remain unchanged.

Root height and overflow normalisation must preserve the shared mobile-menu and consent locks. The homepage browser suite opens the mobile menu from a non-zero scroll position and verifies that the document stays fixed, Escape restores focus, and the prior reading position returns when the menu closes.

## Verification

- `npx vitest run apps/marketing/app/%5F%5Ffoundation/marketing/foundationAccess.test.ts`
- `npx tsc -p apps/marketing/tsconfig.json --noEmit --incremental false`
- `npm run test:marketing:browser`
- `npm run build:marketing`
- `npx playwright test playwright/marketing.home-v2.spec.ts --config=playwright.marketing.config.ts`
- `npx playwright test playwright/marketing.projects.spec.ts --config=playwright.marketing.config.ts`
- `npx playwright test playwright/marketing.products.spec.ts --config=playwright.marketing.config.ts`
- Shared-header Playwright coverage at desktop and mobile widths, including geometry, green accent, keyboard focus, and representative public-route screenshots.

The Playwright lane checks the standalone catalogue, shared header, homepage, every SEO programme route, the product hub and details, the project collection and case studies, and the guide directory at desktop, compact desktop, tablet and mobile widths. It covers metadata, canonical/index state, unique identities, green accent, project and FAQ rendering, all ten directory destinations, horizontal overflow, mobile navigation, form attribution, sitemap inclusion, resolving internal links and visible schema parity. The product suite proves all ten catalogue routes remain discoverable, then exercises the index, one pergola form and one integrated accessory at desktop, tablet and mobile widths. It enforces one visible H1, loaded imagery, CTA continuity, no horizontal overflow, no nested content scroller, structured data, canonical metadata, reduced motion and an explicit unpublished-evidence treatment for heaters. The projects suite checks all canonical records, loaded hero media, intentional missing-data omission, the seven-width responsive matrix, desktop filtering and keyboard navigation, sticky behavior, focus-managed mobile scroll locking, progressive technical detail, circular navigation and reduced motion. The homepage suite additionally proves `/` is indexable and self-canonical, `/home-v2` redirects and remains unlisted, the root retains its live review and preselected enquiry paths, renders the approved visitor, product, project, process, trust and three-link guide structure, records consented device-segmented interactions without customer data, loads all visible imagery, preserves the Warkworth exterior gable apex with visible breathing room, uses the correct responsive header states, and preserves the desktop composition while applying the deliberate mobile treatment. The hero-navigation matrix proves every programme route has true desktop image/header overlap, no canvas gap at the fold, a viewport-centred Projects/Products gap, the guide hero split on that same centreline, transparent top and solid scrolled states, and the solid collapsed treatment at tablet and mobile widths.
