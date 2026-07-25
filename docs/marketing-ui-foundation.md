# Marketing UI Foundation

Status: Current foundation with approved public-route adoptions.

This document owns the Architectural Editorial UI system demonstrated at the standalone internal route `/__foundation/marketing`. It is an image-led, square-cornered, restrained reference for future explicitly approved marketing work. Public routes adopt it only through separately approved, route-scoped migrations.

## Source Of Truth

- Shared semantic colour, type, layout, and responsive tokens: `MarketingPage` and `foundation.module.css` in `apps/marketing/components/marketing-foundation/`.
- Catalogue-only presentation and token overrides: `apps/marketing/app/%5F%5Ffoundation/marketing/catalogue.module.css`.
- Reusable primitives, controls, and editorial patterns: `apps/marketing/components/marketing-foundation/`.
- Live catalogue: `/__foundation/marketing`, implemented by the escaped Next.js route folder `apps/marketing/app/%5F%5Ffoundation/marketing/`.
- Shared header fonts: Instrument Sans and Inter, loaded by the public root layout; foundation routes use the same families.

Public content owners, integrations and route layouts remain outside this
foundation unless a separate task explicitly approves migration. The shared
public header and Phase 4 compact utility footer are approved site-wide
adoptions.

Use Instrument Sans for display text and Inter for body, navigation, forms, and technical information. Keep corners square, borders and dividers at 1px, shadows absent, and use olive green as the single action and conversion accent.

## Component Contract

The foundation exports layout and content primitives (`MarketingPage`, `Container`, `Section`, `SectionHeader`, `Eyebrow`, `Heading`, `Text`, `ActionGroup`, `Button`, `TextLink`, `Rule`, `Figure`, `ProjectMeta`, `FactList`, `CardGrid`, `EditorialCard`), interaction primitives (`Disclosure`, `ResponsiveGallery`) and labelled form controls (`Field`, `TextareaField`, `SelectField`, `CheckboxField`, `RadioGroup`). Prefer their semantic variants instead of route-local colour, alignment, or spacing props.

It also exports navigation, homepage and project heroes, introductions, split narratives, principles, full-bleed statements, galleries, specification rows, materials, project stories, testimonials, process steps, comparisons, FAQs, responsive examples, and conversion sections. The catalogue demonstrates these reusable exports rather than maintaining parallel mock markup.

### Shared responsive contract

Phase 3 PR 6 establishes the following compatible contract without changing the existing Tailwind v4, PostCSS, React, or CSS-module architecture:

- `MarketingPage` owns the shared semantic tokens and mobile section/type scale. `Container` keeps the existing wide, standard, compact, and reading widths. Headings retain their character-based measures, large body copy retains its 42rem measure, and `SectionHeader` constrains supporting copy to 34rem while moving from the established 12-column desktop composition to a one-column mobile flow.
- `ActionGroup` lays out related actions. `Button` exposes primary and secondary hierarchy, with the former `outline` prop retained as a secondary-style compatibility alias. `TextLink` remains the quiet tertiary action. Buttons are at least 48px high and text links at least 44px high.
- `EditorialCard` supports `image-led`, `balanced`, and `compact` density through one linked semantic tree. `CardGrid` owns the responsive collection layout; consumers should not create separate mobile cards.
- `FactList` renders project facts as a semantic description list and changes column presentation without changing its markup.
- `Figure` supports `wide`, `landscape`, `standard`, `portrait`, and `square` ratios plus optional `mobileRatio` and `mobileObjectPosition`. Use the shared focal position for repeated project imagery, and supply a mobile focal point only where the narrower crop needs different framing.
- Shared actions and linked cards have component-owned visible focus treatment. Their directly relevant transitions are disabled when reduced motion is requested.

Phase 3 PR 7 adds the following interaction contract:

- `Disclosure` renders one native `details` and `summary` tree. Manual disclosures leave open state to the browser. The compatible `desktop-expanded` mode renders complete open server markup for no-JavaScript access, but its shared scripting-aware CSS hides only a pending mobile body before hydration. Hydration resolves the same native tree to closed mobile or open desktop state without changing its visual height. Supported route breakpoints are the governed 641px, 721px and 900px boundaries. A fragment target inside responsive detail opens its mobile ancestor and is brought into view, so established deep links do not land on hidden content. Consumers may retain route-owned classes and data attributes without duplicating viewport content or viewport state.
- `ResponsiveGallery` renders only the active `Figure`, with a labelled carousel region, visible Previous and Next buttons, a polite `Image n of total` status and Arrow Left, Arrow Right, Home and End support. Navigation wraps, focus stays on the control used, and no swipe gesture is required.
- Shared disclosure summaries and gallery controls have visible focus treatment and targets at least 44px high. Gallery controls remain visible at 360px. Directly relevant transitions are removed when reduced motion is requested.
- The internal catalogue owns the complete disclosure/gallery fixture. Approved public adapters now cover homepage, project, product, residential-service, guide and config-driven SEO-landing content. Each adapter delegates viewport state to the shared owner while retaining route-owned labels, classes and stable data attributes. Responsive detail is visually closed before and after mobile hydration, expanded on desktop and complete without JavaScript.

The public route template is a server-rendered, non-landmark wrapper. Its restrained entry treatment is CSS-only and disabled for reduced motion. Do not add a top-level loading boundary or client visibility gate that can leave streamed public content hidden when JavaScript is unavailable; every route continues to own its one meaningful `main` landmark.

`ScrollReset` returns ordinary path changes to the top but must prefer a valid
fragment target on cross-route and same-route navigation. It works with the
responsive disclosure reveal contract so links to visible form sections and
sections inside closed optional detail both land on the content promised by
the source action.

Phase 3 PR 8 adds the shared public mobile-navigation contract:

- `Header.tsx` remains the only global public-header owner. `headerNavigation.ts` owns the established Home, Projects, Products and Contact destinations plus the approved mobile commercial and professional pathways. Desktop labels and composition remain unchanged; mobile clarifies Products as `Pergola options`.
- The professional link targets the canonical
  `/architects-designers-builders` capability route. That route owns the
  professional embedded-form context; the existing estimate action continues
  to infer its audience from the current route and retains its analytics
  attribute.
- The closed portalled menu is `aria-hidden` and inert. Opening moves focus to Home; Tab and Shift+Tab cycle through the visible trigger and menu links; Escape closes and returns focus; route, history and desktop-breakpoint changes close without leaving stale scroll locks.
- The JavaScript breakpoint matches the CSS mobile range through 900px. Body position, inline styles and reading position are reversibly locked on every public route, while destination navigation leaves scroll ownership to the router. Short viewports scroll within the menu, every control remains at least 44px high, and directly relevant transitions are removed for reduced motion.
- PR 8 does not add a global sticky action. The fixed consent banner, Projects selector sheet, existing route-local overlays and a legacy route-local mobile action cannot guarantee that another site-wide fixed control would avoid consent controls, form fields and content at short viewport heights. The shared menu and existing route-aware page actions remain the calm persistent path.

The internal catalogue is the complete fixture for the shared primitives and interactions. The approved homepage is the first public compatibility consumer for `MarketingPage`, `SectionHeader`, `ActionGroup`, balanced pathway cards, project facts, responsive featured-project media and the shared disclosure behavior. Project, product, residential-service and SEO-landing routes now reuse the same disclosure contract through route-scoped adapters without creating viewport-specific content trees.

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

The ten-route SEO landing-page programme is the second approved adoption. It uses the config-driven owners in `apps/marketing/components/seo-landing/` for the page shell, editorial blocks, responsive comparison matrix, structured data, conversion section and route-configured enquiry copy. Route content and metadata remain in each route folder, while the existing enquiry API, attachment, attribution, privacy and conversion-event contracts remain unchanged. Nine routes opt into route-owned, unique and contiguous `mobileDisclosureGroups`; unconfigured consumers keep their previous output. The groups move supporting sections behind concise mobile summaries while leaving the complete blocks in DOM order and expanded on desktop.

The programme routes are listed in `docs/landing-pages/seo-landing-page-programme.md`. They share the architectural system without sharing substantial copy: each has a distinct search intent, metadata identity, H1, section narrative, project selection and FAQ set. Every route retains `#4f5748` olive green as the action accent; burgundy and purple are not part of this adoption.

`/pergola-guides` is the programme's approved public directory. It presents all ten routes as an editorial design library grouped into three decision-led chapters: planning the project, choosing form and structure, and comparing scope and components. The page owns its metadata, `CollectionPage`, ordered `ItemList` and breadcrumb schema through `apps/marketing/app/pergola-guides/`; the typed directory content in `apps/marketing/data/pergolaGuides.ts` is the single owner of guide names, routes and summaries. Each card keeps its title as a direct navigation link and shows its concise prompt and summary without a repeated description control. The directory therefore exposes ten distinct choices with zero per-card disclosures at every width.

Guide card numbers follow their displayed reading order across the three chapters: 01 to 04, 05 to 07 and 08 to 10. Programme-owned visible copy, metadata and structured data use natural sentence punctuation without en or em dashes; the browser suite enforces both content rules.

The directory is self-canonical, indexable, included in the public sitemap and
linked from the compact utility footer. The route retains the same
square-cornered, rule-led foundation and `#4f5748` olive accent as the
programme pages. On desktop, its 50/50 hero split shares the viewport
centreline with the midpoint between Projects and Products in the navigation.

Seven guide-detail routes opt into the shared `guideFirstLayer` view model.
Each config names its answer block, one governed project, relevant return route
and route-specific supporting headings. The shared renderer exposes the first
answer paragraph, selected project and return link before one optional
supporting-depth disclosure. Remaining authored paragraphs, project records
and blocks stay in original order inside that disclosure, remain expanded
without JavaScript and keep distinct headings across the SEO programme.

The shared public header now uses the architectural editorial treatment across marketing routes: Instrument Sans branding, Inter navigation, square controls, a thin 1px rule, the olive `#4f5748` estimate action, and a 64px solid collapsed mobile state. Its desktop navigation is centred on the midpoint of the space between Projects and Products rather than on the unequal outer link widths. The mobile menu exposes Home, Projects, Pergola options, Commercial, Architects/designers/builders, Contact and the route-aware estimate action. It preserves source context, keeps body scroll locked, contains keyboard focus within the open navigation and trigger, closes with Escape or navigation, and returns focus to its trigger when the visitor dismisses it.

The ten programme routes and `/pergola-guides` additionally use the approved hero-overlay state on desktop. At the top of those pages, the hero begins at the viewport edge beneath a transparent header with white navigation and a fine light rule, fills at least one viewport, and keeps the following section below the fold. After a deliberate scroll, the header returns to the solid canvas, dark text and blur treatment. At 900px and below the header stays solid and the hero begins below it. Keep transparent overlap limited to routes listed by the shared header; all other public routes use the same new header in its solid state.

The residential `/pergolas-auckland` route uses six major regions before its final enquiry: hero, fit, three-project proof, three-stage process, compact investment drivers and one support gateway. One route-owned `service-planning-support` disclosure contains secondary planning questions, roof/edge detail and useful guide links. A post-evidence enquiry action remains early without changing its residential source context.

The custom `/custom-pergolas-auckland` route adopts the same six-region budget without becoming a copy of residential. Three constrained-project examples and explicit site conditions explain why custom design is needed; a three-stage process leads to one `custom-planning-support` disclosure. The dominant guide-series navigation is disabled on both service routes while the useful canonical guide links remain. Custom enquiry links retain a residential audience with the custom source path.

The commercial `/commercial-pergolas-auckland` route uses the same configured
renderer without forking it. An explicit complete block order puts three
governed commercial cases immediately after the hero and a three-stage process
next. Three responsive groups then own commercial value, coordination and
planning support so no more than six major regions precede the enquiry.
Header, early and embedded-form actions retain the commercial audience and
canonical route source.

`/architects-designers-builders` is the canonical professional capability
route. It is discoverable from the mobile header, homepage, footer and sitemap.
The route explains role boundaries, collaboration, documentation inputs and
engineering interfaces using only governed project and service records. Three
projects precede the professional form. Optional organisation, role, stage,
team and scope fields extend the brief without changing shared required fields
or attachment policy. Payload and consented analytics retain `professional`,
the route source and `embedded_form` component in lower-case canonical
properties without personal values.

`SiteFooter.tsx` owns the approved compact site utility. It has no viewport
minimum, displays the public phone and email as direct actions, keeps one
neutral `/contact` action, three project-pathway links, review proof, warehouse,
privacy and social utility. At the target production widths its height is
730-766px and all footer actions are at least 44px high. It does not duplicate
the full header navigation.

The public homepage is an approved route-scoped foundation adoption described below. Its content, responsive presentation and shared header remain owned by the root homepage implementation rather than by the internal catalogue.

`/projects` and every canonical `/projects/[slug]` case-study route are an approved route-scoped adoption. They use one governed project source and one responsive semantic tree per route. The collection keeps the established sticky project rail and selected case study on desktop; below 900px the same navigator list becomes a normal-flow one-column sequence of image-led cards. Mobile collection requests receive typed summaries only and do not mount the selected case-study component, hero, gallery or video. A desktop media boundary dynamically loads the governed full record and detail component at 900px and above, preserving the legacy `?slug=` selection without shipping that hidden tree to mobile. Detail routes retain the focus-managed mobile selector sheet as their only collection interaction. Canonical project links, metadata and structured data continue to point to the detail routes.

The projects surface owns its Foundation-derived tokens and square, rule-led editorial layout in `apps/marketing/app/projects/projects.css`. It preserves the existing header, footer, consent, contact destination, project URLs and project data owner. Facts omit unavailable values, and the visible brief, constraint, design response, roof approach, gallery, technical detail, related work and circular previous/next links all come from the governed project record rather than route-local claims. Desktop case-study heroes use the taller editorial frame, while repeated portrait or gable media retain a governed focal position so the roof apex is not lost in wide crops.

On the mobile collection, project imagery uses the shared `EditorialCard` and `Figure` contract in a reserved 4:5 frame. Each card exposes only its canonical title, location, residential/commercial audience and existing roof-form label, and every non-leading image remains lazy. Hidden desktop card media requests only the one-pixel fallback size, so the desktop rail does not acquire a second portfolio payload. The existing audience and roof-form fields are filters, not a new project taxonomy.

Collection filters use the shared single-tree `Disclosure` contract. They are optional on mobile and expanded in the established desktop rail. Validated `audience` and `form` query parameters own collection state, preserve unrelated legacy or attribution parameters, survive refresh and browser history, and fail unknown values to the all-project state. Active filters expose a 44px reset; empty combinations retain a `View all projects` recovery and the live result count. Canonical card destinations never inherit filter parameters, so Back returns to the filtered collection without changing project URLs.

At 640px and below, detail routes add a compact, tappable return breadcrumb. Their project selector remains a focus-managed modal sheet with reversible body scroll locking, Escape handling and focus restoration. Case-study heroes use a 4:3 frame. Below 900px project media uses the shared controlled `ResponsiveGallery`: one active image, visible previous and next controls, an announced count, Arrow/Home/End support and optional horizontal touch swipe with vertical page scrolling preserved. The established desktop editorial mosaic remains unchanged. Related projects become compact horizontal cards, and the introductory and final enquiry actions remain visible.

The mobile case study keeps a governed dimension or area and roof summary, the design constraint and the first Sanctuary response visible. Full facts, the original brief, additional response paragraphs and technical detail use native disclosures when available. Their complete content is rendered open in server HTML, remains visible without JavaScript and is expanded with non-interactive summaries hidden on desktop. Hydrated mobile clients close the secondary content. Visible and generated project-page content must not use em dashes.

`/products` and all ten canonical `/products/[category]/[item]` routes are an approved route-scoped adoption. The index is a complete decision hub for four pergola forms, three screen or edge treatments and three lighting or heating options. Detail routes use one server-rendered editorial composition with a pergola-form and integrated-option variant. Both use normal document flow rather than the retired accordion rail or nested page scrollers, and every detail route exposes one visible H1 at every width.

`apps/marketing/data/products.ts` is the single typed owner of product routes, categories, index summaries, hero and gallery media, customer outcomes, technical detail, design questions, trade-offs, options, FAQs, related products, guide links, project evidence and metadata inputs. The former `mega.ts`, `productContent.ts`, `productDescriptions.ts`, `productImages.ts`, slug-to-image switch, accordion and legacy product-details renderer are retired. Sitemap, metadata, Open Graph and structured-data consumers all use the same catalogue.

Project evidence has three explicit states. `governed` links a product decision to a current project record; `context-only` permits a relevant project image or design context only when the page states that it is not proof of the exact product; and `not-published` exposes the evidence gap instead of inferring an installation. Acrylic infill and slat screens currently use context-only evidence. Patio heaters currently use the not-published state. Do not upgrade either state without a current governed project or product record.

The product presentation is owned by `apps/marketing/components/products/` and its scoped CSS module. It keeps square corners, one-pixel rules, Foundation typography and the olive action accent. Product details render one deliberate shared `ResponsiveGallery` sequence with one active image; built-project evidence does not mount the same inventory again. Privacy has its own Foundation-derived module and is not imported by product routes. Product enquiry actions use the shared enquiry-context builder so the product slug, source path and CTA component survive the contact transition. Product routes do not invent a residential audience; the contact form remains neutral unless reliable metadata or entry context supplies one.

The product hub leads immediately from its hero into four image-led pergola forms and a compact non-horizontal comparison. Screens/walls and lighting/heating are two text-led secondary gateways with three canonical destinations each; they do not repeat a ten-item primary inventory. Two projects and one compact guide disclosure complete the decision path. All ten canonical catalogue routes and the neutral source-aware product enquiry remain.

Product details keep the outcome, one primary suitability, one meaningful constraint, project evidence and both enquiry actions visible. A small typed view model consolidates supporting content into exactly three native groups: `fit-and-definition`, `specification-and-tradeoffs` and `related-support`. Their complete content remains server rendered, open without JavaScript and expanded with non-interactive summaries above 640px. Governed, context-only and not-published evidence caveats remain visible and cannot be upgraded by presentation code.

Visible product-page copy and decorative markers use natural punctuation without em dashes. Catalogue unit coverage governs the ten product records, while the product browser suite checks rendered copy and generated marker content on representative routes.

`/contact` is an approved route-scoped adoption. Its small server page owns the editorial introduction, governed Warkworth project image and query-string preselection before hydration. `ContactEnquiryForm.tsx` owns one responsive form tree at every width, and `contact.css` owns the square, rule-led Foundation presentation. The three retired legacy contact stylesheets and the duplicated desktop/mobile page trees must not be restored.

The direct and embedded residential, custom, commercial and professional enquiry forms share the contract in `apps/marketing/lib/enquiryFormContract.ts`. Required fields match the intake API: project type, name and phone; project suburb, desired outcome, email and technical choices are optional. Both form families put project type, location, desired outcome and contact details before optional dimensions, style, `Roof approach` and add-ons. Their upload controls use the governed attachment accept list and describe the actual eight-file, 20 MB per-file and 20 MB total limits. Do not add route-local required-field rules or upload copy.

The forms keep the existing `/api/enquiry` payload, browser-generated submission UUID across retries, shared residential/commercial/professional attachment policy and metadata fallback, attribution fields, consent-gated conversion events, privacy link and direct contact routes. Every visible field has a persistent label, validation focuses a linked error summary, result focus is explicit, and failed or successful submissions retain entered values. A synchronous ref lock closes the double-click window before any asynchronous upload or request begins. The shared enquiry-context contract server-renders validated audience, source path, source component, project slug and product slug values above the form and repeats recognised context in the success state; direct `/contact` stays neutral and unknown values are ignored. Visible and generated contact content must not use em dashes.

The approved public homepage lives at `/` and is implemented by `apps/marketing/app/home-v2/`; the former `/home-v2` comparison URL permanently redirects to `/`. The root page reuses the production foundation primitives, project data, curated review content, live Google rating source, shared header and footer, analytics, consent and existing `/contact` enquiry destination. Its hero is included in the shared header's desktop overlay allowlist, while tablet and mobile keep the solid 64px header.

The homepage presents Sanctuary as an Auckland designer, builder and installer of bespoke fixed-roof architectural pergolas. It keeps the Warkworth project as the first strong evidence after the hero and proof rail, then follows one seven-section semantic order at every width: hero, featured project, audience pathways, selected projects, planning options, process and qualified enquiry. Home is the primary pathway; custom conditions are explained within it, while commercial and professional capability routes remain discoverable. Selected work, process and review content do not use duplicated mobile and desktop render trees. Forms/pergola forms share one planning disclosure and roof/material/comfort decisions share a second, with three further purposeful disclosures elsewhere for five total. The process exposes three concise stages and incorporates the former project-assurance content. Review proof is integrated into the qualified-enquiry close. The final enquiry keeps one primary residential action, quieter commercial/professional routes, two featured guide links and the all-guides link. Desktop uses the same content tree and retains the established grid-led composition.

Homepage interaction links and controls expose stable event attributes. The route-local tracker records only the event name, V2 variant, viewport category, destination and optional editorial label, and only after analytics consent. Hero, pathway, pergola-form, roof, project, disclosure, guide and final-enquiry interactions therefore remain distinguishable without collecting project or customer details.

The homepage owns its content and route-specific presentation under `apps/marketing/app/home-v2/`, while its shared page tokens, section headers, action groups, pathway cards, project facts and responsive featured media use the Foundation owners described above. The root page is indexable, self-canonical at `/`, present in the sitemap and backed by the approved title, description, Open Graph identity and WebSite/WebPage schema. The retired `/home-v2` URL remains absent from navigation, footer and sitemap output and must continue to redirect permanently to `/`. The established legacy owners `apps/marketing/app/home.css` and `apps/marketing/components/home/**` remain unchanged.

Root height and overflow normalisation must preserve the shared mobile-menu and consent locks. The homepage browser suite opens the mobile menu from a non-zero scroll position and verifies that the document stays fixed, Escape restores focus, and the prior reading position returns when the menu closes.

## Verification

- `npx vitest run apps/marketing/app/%5F%5Ffoundation/marketing/foundationAccess.test.ts`
- `npx vitest run apps/marketing/components/marketing-foundation/Primitives.test.tsx`
- `npx vitest run apps/marketing/components/marketing-foundation/Interactions.test.tsx`
- `npx vitest run apps/marketing/components/Header.test.tsx apps/marketing/components/headerNavigation.test.ts`
- `npx tsc -p apps/marketing/tsconfig.json --noEmit --incremental false`
- `npm run test:marketing:browser`
- `npm run build:marketing`
- `npx playwright test playwright/marketing.foundation.spec.ts --config=playwright.marketing.config.ts`
- `npx playwright test playwright/marketing.home-v2.spec.ts --config=playwright.marketing.config.ts`
- `npx playwright test playwright/marketing.projects.spec.ts --config=playwright.marketing.config.ts`
- `npx playwright test playwright/marketing.products.spec.ts --config=playwright.marketing.config.ts`
- `npx playwright test playwright/marketing.contact.spec.ts --config=playwright.marketing.config.ts`
- `npx playwright test playwright/marketing.mobile-content-density.spec.ts --config=playwright.marketing.config.ts`
- `npx playwright test playwright/marketing.phase-four.spec.ts --config=playwright.marketing.config.ts --workers=1`
- `npx playwright test playwright/marketing.shared-header.spec.ts --config=playwright.marketing.config.ts`
- Shared-header Playwright coverage at desktop and mobile widths, including geometry, green accent, keyboard focus, and representative public-route screenshots.

The Foundation browser suite exercises the shared responsive specimens at 430px, 390px, 360px, tablet, compact desktop, and desktop widths. It asserts single-tree card and fact-list presentation, semantic CTA hierarchy, minimum touch targets, focus visibility, reduced-motion behavior, mobile and desktop media ratios and focal points, stable desktop card geometry, and no horizontal overflow. Its interaction lane additionally verifies native disclosure state, keyboard and focus behavior, touch gallery controls, one active accessible image, live position text, reduced motion, homepage adapter compatibility and stable desktop composition. An isolated-context matrix also smoke-tests every distinct direct Foundation consumer type at 390px and 1440px so the existing animated route transition cannot leave an exiting page in a strict locator. Set `MARKETING_FOUNDATION_CAPTURE=1` when running the focused spec to write PR 6 screenshots to `artifacts/mobile-ux-phase-3-pr-6/`. Set `MARKETING_FOUNDATION_INTERACTIONS_CAPTURE=1` to write the three PR 7 interaction screenshots to `artifacts/mobile-ux-phase-3-pr-7/`.

The Playwright lane checks the standalone catalogue, shared header, homepage, every SEO programme route, the product hub and details, the project collection and case studies, the contact route, and the guide directory at desktop, compact desktop, tablet and mobile widths. It covers metadata, canonical/index state, unique identities, project and FAQ rendering, internal destinations, overflow, navigation, form attribution, sitemap inclusion and visible schema parity.

The mobile-content-density suite owns cross-family first-layer, disclosure, keyboard, focus, 44px target, reduced-motion, heading, link, metadata, schema, enquiry, overflow, desktop expansion and no-JavaScript contracts at 430px, 390px and 360px. Its script-blocked lane proves pending detail is hidden and unfocusable before hydration and resolves without changing height.

The dedicated Phase 3 suite visits the hub, all ten product routes, residential and custom at all three target widths. It enforces exact disclosure IDs, one controlled gallery and active image, no duplicate image request, HTML and visible-copy budgets, six-region service structures, high-priority hero loading and CLS at or below `0.1`. Set `MARKETING_PHASE_THREE_CAPTURE=1` to write production-compatible measurements and representative screenshots under `artifacts/mobile-ux-phase-3/`.

The dedicated Phase 4 suite covers commercial proof/stages/context, the
professional capability route and intercepted payload/analytics, the guide hub
and all seven guide first layers, refresh/Back, no-JavaScript completeness,
homepage region/disclosure budgets and footer utility at 430px, 390px and
360px. Set `MARKETING_PHASE_FOUR_CAPTURE=before|after` and
`MARKETING_PHASE_FOUR_WIDTH=430|390|360` for reproducible evidence under
`artifacts/mobile-ux-phase-4/`. A deployed capture must also set
`MARKETING_BASE_URL=https://www.sanctuarypergolas.co.nz`; every form test must
continue intercepting `**/api/enquiry`.

The internal `/__foundation/marketing` catalogue is intentionally unavailable
in production unless explicitly enabled. Full deployed browser runs therefore
report its 18 catalogue-only assertions as expected failures; public-route
results and the complete local foundation suite are the relevant signals.

The product suite additionally verifies every catalogue route, one visible H1, loaded imagery, early and final CTA continuity, the single gallery, keyboard-operable server-rendered detail, 44px targets, height budgets, metadata, schema, reduced motion, no nested scroller and honest unpublished heater evidence. The projects suite retains the complete Phase 2 collection, gallery, filter, navigation and responsive contract. The contact suite retains canonical and legacy preselection, project/product refresh and history, validation, attachment, duplicate-submit, consented analytics and lower-case non-personal context coverage. Homepage and hero-navigation suites preserve the established desktop composition and responsive header states.
