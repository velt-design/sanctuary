# Marketing UI Foundation

Status: Current marketing-only UI contract with approved public-route adoptions.

This document owns the Architectural Editorial UI system demonstrated at the standalone internal route `/__foundation/marketing`. It applies only to `apps/marketing`; it does not describe or set direction for the staff portal. Existing checked-in marketing routes and their rendered behavior are canonical. The catalogue documents shared owners and regression examples for current consumers, not a blanket instruction to restyle public routes. A new route adoption or broader visual change still requires separate, explicit approval.

## Source Of Truth

- Shared semantic colour, type, layout, and responsive tokens: `MarketingPage` and `foundation.module.css` in `apps/marketing/components/marketing-foundation/`.
- Shared marketing motion durations, easing curves and pressed-state values: `apps/marketing/styles/tokens.css`.
- Catalogue-only presentation and token overrides: `apps/marketing/app/%5F%5Ffoundation/marketing/catalogue.module.css`.
- Reusable primitives, controls, and editorial patterns: `apps/marketing/components/marketing-foundation/`.
- Live catalogue: `/__foundation/marketing`, implemented by the escaped Next.js route folder `apps/marketing/app/%5F%5Ffoundation/marketing/`.
- Shared header fonts: Instrument Sans and Inter, loaded by the public root layout; foundation routes use the same families.

Public content owners, integrations and route layouts remain outside this
foundation unless a separate task explicitly approves a route-level change. The shared
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
- The internal catalogue owns the complete disclosure/gallery fixture. Approved public adapters now cover project, product, residential-service, guide and config-driven SEO-landing content. Each adapter delegates viewport state to the shared owner while retaining route-owned labels, classes and stable data attributes. Responsive detail is visually closed before and after mobile hydration, expanded on desktop and complete without JavaScript. The current homepage uses its bounded radio conversation instead of a responsive disclosure.

TM-01 establishes the shared motion and pressed-state contract:

- `apps/marketing/styles/tokens.css` owns the canonical instant, short, panel-enter and panel-exit durations, the standard, enter and exit easing curves, and restrained press scale and opacity values. Reduced motion resolves every shared duration to zero and press scale to one while retaining immediate non-motion feedback.
- Foundation `Button`, `TextLink`, `EditorialCard`, `Disclosure` summary and controlled-gallery controls own their pressed feedback in CSS. Small controls may use the shared `.992` scale; architectural cards never scale.
- Hover-only Foundation treatments for those owners run only on hover-capable fine pointers. Existing focus-visible, selected, disabled and semantic state ownership remains unchanged.
- The route entry treatment remains a documented exception, but its inactive `.page-layer` wrapper no longer carries a persistent compositing hint. The actively transformed route-progress bar retains its narrow `will-change`.
- `test/marketing-motion-contract.test.ts` guards only the shared token and Foundation owners in TM-01. Route adapters and shared chrome join that contract in the separately scoped TM-02.
- `ResponsiveGallery` retains its current one-active-image and pointer-up threshold architecture. Finger-follow movement and adjacent-frame readiness remain deferred to TM-03.

The public route template is a server-rendered, non-landmark wrapper. Its restrained entry treatment is CSS-only and disabled for reduced motion. Do not add a top-level loading boundary or client visibility gate that can leave streamed public content hidden when JavaScript is unavailable; every route continues to own its one meaningful `main` landmark.

`ScrollReset` returns ordinary path changes to the top but must prefer a valid
fragment target on cross-route and same-route navigation. It works with the
responsive disclosure reveal contract so links to visible form sections and
sections inside closed optional detail both land on the content promised by
the source action. Its only desktop route exception is an explicitly marked
canonical project-detail-to-project-detail history transition owned by the
persistent project experience; unmarked routes, mobile project navigation and
project-to-collection navigation keep the ordinary reset contract.

Phase 3 PR 8 adds the shared public mobile-navigation contract:

- `Header.tsx` remains the only global public-header owner.
  `headerNavigation.ts` keeps the established four-item desktop Projects,
  Products, Commercial and Professionals navigation. The compact mobile menu
  exposes Projects, `Pergola options`, Commercial and Professionals; the brand owns Home and the
  route-aware `Start your project` action owns Contact.
- The professional link targets the canonical
  `/architects-designers-builders` capability route. That route owns the
  professional embedded-form context; the existing estimate action continues
  to infer its audience from the current route and retains its analytics
  attribute.
- The closed portalled menu is `aria-hidden` and inert. Opening moves focus to
  the first visible destination; Tab and Shift+Tab cycle through the trigger,
  menu links and project action; Escape closes and returns focus; route,
  history and desktop-breakpoint changes close without leaving stale scroll
  locks.
- The JavaScript breakpoint matches the CSS mobile range through 900px. Body position, inline styles and reading position are reversibly locked on every public route, while destination navigation leaves scroll ownership to the router. Short viewports scroll within the menu, every control remains at least 44px high, and directly relevant transitions are removed for reduced motion.
- PR 8 does not add a global sticky action. The fixed consent banner, Projects selector sheet, existing route-local overlays and a legacy route-local mobile action cannot guarantee that another site-wide fixed control would avoid consent controls, form fields and content at short viewport heights. The shared menu and existing route-aware page actions remain the calm persistent path.

The optimized Next.js root can expose `/index` to client route hooks while the
public and matched route remains `/`. `getCanonicalHeaderPathname` converts
that one framework alias before the header derives active navigation, hero
overlay state or enquiry context. The generated and deployed root header must
therefore contain a residential estimate action with canonical
`source_path=/`, never `/index`.

The internal catalogue is the complete fixture for the shared primitives and interactions. The approved homepage consumes `MarketingPage`, `ActionGroup`, project facts and responsive project media while its route-local radio group owns the first design-conversation state. Project, product, residential-service and SEO-landing routes reuse the shared disclosure contract through route-scoped adapters without creating viewport-specific content trees.

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

The token-scoped public quote route is an approved presentation-only adoption. `apps/marketing/app/quote/[quoteId]/quoteEditorial.module.css` translates the Foundation into a no-imagery customer document: Instrument Sans display type, Inter body type, warm neutral surfaces, square controls, fine rules, and the olive action accent. The route keeps one visible commercial summary with explicit GST, stacks line-item labels and values without horizontal overflow at narrow widths, and preserves 44px actions. Public quote lookup, token/expiry handling, attachment authorization, acceptance form action and hidden token, status semantics, and all quote lifecycle behavior remain unchanged.

The token-scoped public invoice route is a separate approved presentation-only adoption. `apps/marketing/app/invoice/[invoiceId]/invoiceEditorial.module.css` and `InvoiceDocument.tsx` own its payment-led hierarchy: amount due, due date, payment reference, source quote context, GST ledger, authoritative bank-transfer lines, download actions, and clarification path. The route uses the same no-imagery type, colour, square-rule, and narrow-stacking vocabulary while remaining distinct from the quote owner. Public invoice lookup, token hashing/expiry, void handling, PDF and source-quote authorization, private/no-store behavior, server-owned service-role access, and invoice lifecycle remain unchanged.

`/acrylic-roof-pergolas-auckland` is the first approved route-scoped adoption. It imports the foundation fonts and reusable layout and type primitives, while its concise tint comparison, comfort and weather checks, three governed projects, four focused FAQs and enquiry form remain route-owned.

The route defines the same semantic page tokens locally. Its canonical URL,
metadata, visible FAQ content, project links, attribution, secure attachment
upload, enquiry API contract, consent behavior and form-state logic remain
owned by the landing page and existing marketing integrations.
`/acrylic-roof-pergolas-auckland-v2` is retired and permanently redirects to
this canonical route in one hop; it is not a second content, canonical or
sitemap owner.

The ten-route SEO landing-page programme is the second approved adoption. It
uses the config-driven owners in `apps/marketing/components/seo-landing/` for
the page shell, editorial blocks, responsive comparison matrix, structured
data and route-configured enquiry copy. The embedded enquiry form now closes
the shared page shell without a second conversion section. Route content and
metadata remain in each route folder, while the existing enquiry API,
attachment, attribution, privacy and conversion-event contracts remain
unchanged. Custom, commercial and professional routes own
`mobileDisclosureGroups`; seven other directory routes use `guideFirstLayer`
and one supporting-depth disclosure. Supporting content remains in DOM order,
server rendered and expanded on desktop.

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

The shared public header now uses the architectural editorial treatment across marketing routes: Instrument Sans branding, Inter navigation, square controls, a thin 1px rule, the olive `#4f5748` project action, and a 64px solid collapsed mobile state. Its four desktop destinations are split into two pairs so the midpoint between Products and Commercial sits on the viewport centreline rather than inheriting unequal outer-link widths. The mobile menu exposes Projects, Pergola options, Commercial and Professionals, followed by `Start your project`. It preserves source context, keeps body scroll locked, contains keyboard focus within the open navigation and trigger, closes with Escape or navigation, and returns focus to its trigger when the visitor dismisses it. The root skip link uses critical inline positioning to stay outside the initial layout even when the stylesheet is delayed or unavailable, while the shared focus rule still reveals it to keyboard users.

The ten programme routes and `/pergola-guides` additionally use the approved hero-overlay state on desktop. At the top of those pages, the hero begins at the viewport edge beneath a transparent header with white navigation and a fine light rule, fills at least one viewport, and keeps the following section below the fold. After a deliberate scroll, the header returns to the solid canvas, dark text and blur treatment. At 900px and below the header stays solid and the hero begins below it. Keep transparent overlap limited to routes listed by the shared header; all other public routes use the same new header in its solid state.

The residential `/pergolas-auckland` route uses six major regions before its final enquiry: hero, fit, three-project proof, three-stage process, compact investment drivers and one support gateway. One route-owned `service-planning-support` disclosure contains secondary planning questions, roof/edge detail and useful guide links. A post-evidence enquiry action remains early without changing its residential source context.

The custom `/custom-pergolas-auckland` route adopts the same six-region budget without becoming a copy of residential. Three constrained-project examples and explicit site conditions explain why custom design is needed; a three-stage process leads to one `custom-planning-support` disclosure. The dominant guide-series navigation is disabled on both service routes while the useful canonical guide links remain. Custom enquiry links retain a residential audience with the custom source path.

The commercial `/commercial-pergolas-auckland` route uses the same configured
renderer without forking it. An explicit complete block order puts three
governed commercial cases immediately after the hero and a three-stage process
next. One visible capability section consolidates Sanctuary-led and
consultant-led scope, project interfaces and operating-site controls. The
professional-collaboration and cost-driver pathways remain visible before one
responsive FAQ group, so the mobile journey does not hide its useful next
steps behind supporting detail. Project proof uses three columns at wide
desktop, two columns plus one intentional wide card at intermediate widths, and
one column on mobile. Route-owned verified image overrides give the hero,
project proof and operating-site story distinct roles without changing the
governed project records.
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
neutral `/contact` action, Commercial, Professionals and Pergola Guides links,
review proof, warehouse, privacy and social utility. It opens directly with
`Tell us about your project.` and does not repeat a project-pathway heading or
closing pitch. All footer actions remain at least 44px high and the footer does
not duplicate the full header navigation.

The public homepage is an approved route-scoped foundation adoption described below. Its content, responsive presentation and shared header remain owned by the root homepage implementation rather than by the internal catalogue.

`/projects` and every canonical `/projects/[slug]` case-study route are an approved route-scoped adoption. They use one governed project source and one responsive semantic tree per route. The collection opens with the two-tone `Built projects around NZ` heading: `projects` uses the primary near-black while the surrounding words use a deliberately pale warm grey, with no eyebrow. It is an image-led editorial directory at every width: one column below 900px, two columns from 900px and three columns from 1200px by default. From 1360px, the unified project-index bar adds a four-stop architectural `VIEW SCALE` with a thin rule, square marker, current mode and `02`–`05` notation for Showcase (two columns), Editorial (three), Compact (four) and Overview (up to five). Overview caps at four columns until the 1600px width can preserve a useful minimum card size. It renders typed collection summaries only and never mounts a selected case study, hero, gallery or video. The retained legacy `?slug=` parameter remains accepted without changing canonical collection identity, while every complete card links to its canonical detail route. Detail routes retain the persistent desktop rail and focus-managed mobile selector sheet as their collection interaction. Canonical project links, metadata and structured data continue to point to the detail routes.

At 900px and above, canonical detail routes keep one mounted
`ProjectDetailExperience` while visitors move between project links. The rail
DOM, filters, internal scroll and focus remain unchanged. The incoming full
record is loaded only inside the desktop media contract and its responsive hero
candidate must load and decode before URL, metadata, structured data and visible
content commit. If the current hero intersects the viewport, its viewport
anchor is retained; otherwise the incoming hero aligns immediately beneath the
fixed header. Marked History API entries keep the same owner through Back and
Forward without invoking global route progress or `ScrollReset`. Direct loads,
refresh, canonical links, modified clicks and no-JavaScript access retain real
`/projects/[slug]` documents, while below 900px normal Next route navigation and
the established selector-sheet behavior remain unchanged.

The projects surface owns its Foundation-derived tokens and square, rule-led editorial layout in `apps/marketing/app/projects/projects.css`, with collection-only composition in `projectCollection.css`. It preserves the existing header, footer, consent, contact destination, project URLs and project data owner. Facts omit unavailable values. The visible approved summary, Brief, first Response, roof approach, Gallery, Technical details and related work all come from the governed project record rather than route-local claims. Curated related work is the only end-of-story project navigation; the duplicate circular previous/next links are retired. Desktop case-study heroes use the taller editorial frame, while repeated portrait or gable media retain a governed focal position so the roof apex is not lost in wide crops.

On the collection, project imagery uses the shared `EditorialCard` and `Figure` contract in a reserved 4:5 frame at every width. Each complete card exposes only its canonical title, location, residential/commercial audience and existing roof-form label. The first card is the eager server-rendered LCP candidate; the existing desktop media enhancement also promotes the second visible card, while compact layouts keep every following card lazy. Its responsive `sizes` contract follows both the viewport and selected card density rather than retaining the retired one-pixel desktop rail fallback. The existing audience and roof-form fields are filters, not a new project taxonomy. View-scale preference is local presentation state rather than collection identity: it is stored in local storage, does not enter the URL, and safely falls back to Editorial when storage is missing or invalid. The visual drawing scale retains a labelled native range input, keyboard operation, four snapped values, explicit value text and a 44px interaction area. It is not server-rendered as an inert no-JavaScript affordance; without JavaScript, the collection remains complete at the default one-, two- or three-column density.

Card content density follows the selected desktop scale without creating duplicate card trees. Showcase and Editorial retain the complete location, audience, roof form and action treatment. Compact clamps a modestly reduced title to two lines, replaces the separate metadata fields with one single-line `region · audience · roof form` summary, and reduces the visible action to an arrow. Overview becomes a quieter photographic index with a smaller title, fixed 64px content block, maximum two-line clamp and optically aligned arrow; its visible metadata and action copy are suppressed. Every canonical card keeps a complete explicit accessible name across modes, and compact presentation rules apply only from 1360px so the established mobile card remains complete even when a denser preference was saved.

Collection filters use the shared single-tree `Disclosure` contract. They are optional on mobile and expanded in the desktop heading band above the grid. Validated `audience` and `form` query parameters own collection state, preserve unrelated legacy or attribution parameters, survive refresh and browser history, and fail unknown values to the all-project state. Active filters expose a 44px reset; empty combinations retain a `View all projects` recovery and the live result count. Canonical card destinations never inherit filter parameters, so Back returns to the filtered collection without changing project URLs. The final route-owned enquiry section follows the grid at every width.

At 640px and below, detail routes add a compact, tappable return breadcrumb. Their project selector remains a focus-managed modal sheet with reversible body scroll locking, Escape handling and focus restoration. Case-study heroes use a 4:3 frame. Below 900px project media uses one native horizontal strip containing the governed gallery images. Alternating 4:3 and 3:4 frames keep their different heights and align to the top, while native touch scrolling and scroll snap preserve the earlier free-swipe feel. Compact Previous/Next controls above the strip provide a non-swipe path without taking ownership away from native scrolling; they retain focus, expose contextual names and edge state, report `Image n of total`, support Arrow Left/Right plus Home/End on the focusable region, meet the 44px target and remove smooth scrolling under reduced motion. Every image keeps its caption and lazy-loading contract, and the established desktop editorial mosaic remains unchanged. This route-owned interaction is an explicit product-owner preference; project detail routes must not be moved back to a single-frame controlled carousel without approval. Product detail routes continue to use the shared controlled `ResponsiveGallery`. Related projects become compact horizontal cards, and the introductory and final enquiry actions remain visible.

The mobile case study keeps its approved summary, Brief and first Response
visible. Full Facts and Technical details use native disclosures when
available. Their complete content is rendered open in server HTML, remains
visible without JavaScript and is expanded with non-interactive summaries
hidden on desktop. Hydrated mobile clients close the secondary content.
Visible and generated project-page content must not use em dashes.

`/products` and all ten canonical `/products/[category]/[item]` routes are an approved route-scoped adoption. The index is a complete decision hub for four pergola forms, three screen or edge treatments and three lighting or heating options. Detail routes use one server-rendered editorial composition with a pergola-form and integrated-option variant. Both use normal document flow rather than the retired accordion rail or nested page scrollers, and every detail route exposes one visible H1 at every width.

`apps/marketing/data/products.ts` is the single typed owner of product routes, categories, index summaries, hero and gallery media, customer outcomes, technical detail, design questions, trade-offs, options, FAQs, related products, guide links, project evidence and metadata inputs. The former `mega.ts`, `productContent.ts`, `productDescriptions.ts`, `productImages.ts`, slug-to-image switch, accordion and legacy product-details renderer are retired. Sitemap, metadata, Open Graph and structured-data consumers all use the same catalogue.

Project evidence has three explicit states. `governed` links a product decision to a current project record; `context-only` permits a relevant project image or design context only when the page states that it is not proof of the exact product; and `not-published` exposes the evidence gap instead of inferring an installation. Acrylic infill and slat screens currently use context-only evidence. Patio heaters currently use the not-published state. Do not upgrade either state without a current governed project or product record.

The product presentation is owned by `apps/marketing/components/products/` and its scoped CSS module. It keeps square corners, one-pixel rules, Foundation typography and the olive action accent. Product details render one deliberate shared `ResponsiveGallery` sequence with one active image; built-project evidence does not mount the same inventory again. Privacy has its own Foundation-derived module and is not imported by product routes. Product enquiry actions use the shared enquiry-context builder so the product slug, source path and CTA component survive the contact transition. Product routes do not invent a residential audience; the contact form remains neutral unless reliable metadata or entry context supplies one.

The product hub leads immediately from its hero into four image-led pergola
forms. Screens/walls and lighting/heating are two text-led secondary gateways
with three canonical destinations each. One governed project and one direct
guide link complete the decision path without another hub disclosure. All ten
canonical catalogue routes and the neutral source-aware product enquiry
remain.

Product details keep one primary suitability, one meaningful constraint,
project evidence, one controlled gallery and both enquiry actions visible. A
small typed view model consolidates supporting content into exactly three
native groups: `fit-and-definition` (`How it works`),
`specification-and-tradeoffs` (`What to confirm`) and `related-support`
(`Compare and plan`). The final group exposes at most one alternative and one
guide. Supporting content remains server rendered, open without JavaScript and
expanded with non-interactive summaries above 640px. Product and Breadcrumb
schema remain; retired FAQ copy is no longer emitted as visible content or
FAQ schema. Governed, context-only and not-published evidence caveats remain
visible and cannot be upgraded by presentation code.

Visible product-page copy and decorative markers use natural punctuation without em dashes. Catalogue unit coverage governs the ten product records, while the product browser suite checks rendered copy and generated marker content on representative routes.

`/contact` is an approved route-scoped adoption. Its small server page owns the editorial introduction, governed Warkworth project image and query-string preselection before hydration. `ContactEnquiryForm.tsx` owns one responsive form tree at every width, and `contact.css` owns the square, rule-led Foundation presentation. The three retired legacy contact stylesheets and the duplicated desktop/mobile page trees must not be restored.

The direct and embedded residential, custom, commercial and professional enquiry forms share the contract in `apps/marketing/lib/enquiryFormContract.ts`. Required fields match the intake API: project type, name, phone and email; project suburb, project brief and technical choices are optional. Both form families keep project type, suburb, brief, contact details and files in the first layer. Dimensions, pergola form, roof approach and other options sit inside one native `Add optional project details` disclosure. Their upload controls use the governed attachment accept list and the shared concise eight-file, 20 MB total helper. Do not add route-local required-field rules or upload copy.

The enhanced forms keep the existing `/api/enquiry` payload and one
browser-generated submission UUID across retries. Their no-JavaScript action
uses `/api/enquiry/fallback`, which retains the core brief, repeated project
options and validated route context, assigns a server UUID, and returns a
noindex confirmation or safe recovery page without placing personal data in
the URL. File inputs remain disabled until enhancement because signed private
uploads require JavaScript. Both paths retain the shared
residential/commercial/professional attachment policy and metadata fallback,
attribution fields where available, consent-gated conversion events, privacy
link and direct contact routes. Every visible field has a persistent label,
validation focuses a linked error summary, result focus is explicit, and failed
or successful enhanced submissions retain entered values. A synchronous ref
lock closes the double-click window before any asynchronous upload or request
begins. The shared enquiry-context contract server-renders validated audience,
source path, source component, project slug and product slug values above the
form and repeats recognised context in the success state; direct `/contact`
stays neutral and unknown values are ignored. Visible and generated contact
content must not use em dashes.

Routes that already end in this embedded form do not render a second generic
conversion section after it. The shared footer supplies the final site-wide
contact path. The product hub plus product and project details link to, rather
than embed, the enquiry form and retain one short route-owned final action.

The approved public homepage lives at `/` and is owned by
`apps/marketing/app/_home-project-finder/`. Its production visual, interaction,
SEO, continuation and measurement contracts are defined in the project-finder
section below. The explicitly requested comparison route `/home-journey`
remains a separate, noindex guided-home
experiment owned by `apps/marketing/app/home-journey/`; it is self-contained,
canonicalises to `/`, stays out of the sitemap and does not change or duplicate
the approved root implementation. It shows one question at a time and branches
through two or three closed answers into eight deterministic directions:
insulated or daylight-first simple home cover; acrylic, timber-lined or mixed
material outdoor room; professional, hospitality or builder collaboration.
Every direction is assembled from the shared project catalogue, exposes two
static built references and fails closed if a governed record or image is
missing. Project proof is deliberately not a second action: the completed path
has one attributed enquiry action, plus low-emphasis Back and home utilities.

The guided route uses the Foundation typography, colour, line, motion, focus
and enquiry-context contracts but suppresses the global header and footer so
their navigation and conversion actions do not compete with the active
question. Its route-owned brand/progress bar is not a replacement global-header
owner. The client controller owns only closed answer state and focus transfer;
the server route resolves the governed model and noindex metadata. With
JavaScript disabled, the interactive shell is replaced by a compact map of all
eight directions and one direct enquiry link. `guided_home_v1` analytics record
only the route view, closed question/answer/back values and final destination
after analytics consent; pre-consent interactions are not backfilled.

The staged guided-design-conversation programme begins at `/home-guided`.
Its PR 1 baseline reuses the current homepage renderer inside the standard
shared marketing header and footer, canonicalises to `/`, remains noindex and
absent from the sitemap, and deliberately disables the production homepage
interaction tracker. The live `/` route entrypoint and its current behaviour
remain unchanged.

PR 2 replaces only the experimental renderer's conversation section. Static
question and result copy lives in `guidedConversationContent.ts`; pure state,
validation and URL resolution live in `guidedConversationModel.ts` beside it.
Together they validate closed URL state for 27 three-answer combinations
across homeowner, business and professional branches and resolve five stable
result routes. The client
owner renders completed summaries plus only the active question or result,
uses native same-document history for Back, Forward and refresh, and removes
incompatible downstream answers when a summary is changed. Type-led controls
reuse the production radio keyboard pattern with fieldset, legend, roving tab
stop, Arrow, Home and End behavior, visible focus and one polite live region.
The no-JavaScript layer contains five concise route links and no project
gallery. `guided_design_conversation_home_v1` events use the shared
consent owner and carry only closed answer, result, focus and destination
values. PR 2 does not personalise destination pages or add image-led decision
media; those remain PR 3 and PR 4 work under
`sanctuary-guided-design-conversation-homepage.md`.

PR 3 replaces the experimental route's inherited homepage sections with a
route-owned guided opening. Question 1 sits inside the governed Warkworth hero;
homeowner and business Question 2 choices use image-led cards; all other
questions remain type-led. `guidedConversationMedia.ts` resolves every hero,
choice and result image, alt, crop and attribution from the shared project
catalogue and fails closed when a referenced project or gallery entry is
missing. Only the active question or result mounts its branch media. Completed
results show one built reference and one destination action. The route keeps
the shared header, footer and mobile navigation, suppresses only the desktop
header CTA on canonical `/home-guided`, and replaces the old homepage proof,
capability, process and enquiry-close sections with a non-clickable reassurance
rail. The live `/` renderer remains unchanged. The PR 3 mobile and desktop
captures received explicit product-owner approval on 2026-08-01.

PR 4 continues the completed recommendation on the five existing indexed
landing routes. `guidedJourneyContext.ts` accepts only the closed focus, use,
constraint, sector/role or stage/need values owned by the guided contract and
returns one server-rendered context model; invalid, incomplete and duplicate
values render no contextual layer. `GuidedJourneyContext.tsx` appears directly
after the destination hero, adds no H1, repeats the visitor's selected starting
point, states the relevant qualification and links back to the exact completed
`/home-guided` state. Base canonicals do not change and direct entries remain
complete. The existing landing-page project blocks keep three governed projects
while the valid context may move the most relevant one first. Residential-cover
evidence uses Dairy Flat Estate, Mt Maunganui Box and St Heliers Townhouse;
outdoor-room, bespoke, commercial and professional evidence remains sourced
from their governed page configs and `projects.ts`.

The shared enquiry-context owner carries valid guided continuation through the
embedded destination form as `source_experience`, `source_pathway` and
`source_focus`, alongside the existing audience, route and component fields.
All three additions are allowlisted, lower-case, non-personal and kept only as a
complete group. Arbitrary values and partial guided attribution are discarded.

The approved project-led visual finder is the production `/` homepage and is
owned once by `apps/marketing/app/_home-project-finder/`. The root is indexable,
self-canonical and retains the approved title, description, Open Graph identity
and WebSite/WebPage schema. `/home-project-finder` is retired through a permanent
redirect to `/`, retains an `X-Robots-Tag: noindex, nofollow` response header and
stays out of the sitemap. The superseded `apps/marketing/app/_home/` owner and
its duplicate browser suite are deleted. `/home-v2` and `/home-experimental`
also remain permanent redirects; none is retained as a second homepage tree.

The production page reuses the shared Foundation header, footer and actions,
live Google review data, governed project catalogue and media, consent owner
and enquiry-context builder. Its immersive hero, ruled proof rail, three
desktop image-led directions, tailored recommendation, two governed projects per result
and evidence-first conversion close remain the approved visible structure. The
three first-layer choices are `Simple cover`, `Custom design` and `Commercial /
Professional`. The commercial/professional choice reveals a second three-card
radio group for `Extending a Venue`, `Builder or Contractor` and `Architects and
Designers`; it is part of the same owner and page, not a new route or homepage
variant. The optional six-priority brief remains available only for the two
residential choices. The opening is now cinematic without changing this owner:
an immediate charcoal welcome veil presents `WELCOME TO` in muted grey and
`SANCTUARY PERGOLAS` in white, with the shared header inaccessible and visually
absent. It leaves as soon as the priority Warkworth hero image is decoded, or
after a bounded 1.4-second fallback, and removes the fade for reduced-motion
visitors. The first full viewport is the project image with a transparent shared
header, no enquiry action and one bottom-centred bold open chevron, without a
stem, label, background or visible enclosing shape. Its Warkworth interior uses
the dedicated portrait `warkworth-gable-02.jpg` art direction through 760px and
the existing wide project image above that breakpoint. While the hero journey
is active, one forward wheel gesture, upward touch swipe or forward keyboard
scroll reveals the existing eyebrow, headline, support and Warkworth attribution;
the next advances to the measured question-and-three-choices wrapper rather than
the finder section's padded edge. When that complete wrapper fits between the
live header and visual viewport bottom it is centred in the available space;
otherwise its top is aligned eight pixels beneath the header. The matching
chevrons provide the same two steps. The bounded controller releases at the finder boundary, keeps reverse
scrolling native and does not add layout height dynamically. The header stays transparent and withholds its
desktop project action until the hero journey is left, then returns to its opaque
surface. JavaScript-disabled visitors bypass the veil and receive the complete
hero story plus the existing direct fallback. Mobile keeps compact complete
choice rows at 320-430px, tablet keeps full-width landscape rows through 900px,
and short-height layouts retain every required story element without colliding
with the header. Through 760px the first three starting-point choices become
large-title, text-only ruled rows; their imagery remains lazy and is not rendered.
Their vertical gaps and padding contract modestly so the complete opening fits
common phone viewports without removing copy or reducing touch targets.
The nested commercial/professional chooser keeps its existing image-led cards.
Only the hero is initially high priority; choice and evidence images are lazy.

The client finder uses one first-layer radio group, a conditionally mounted
commercial/professional radio group, native residential checkboxes, a three-item
priority ceiling, visible focus and one polite live region. URL state contains
one valid `project`, either up to three canonical residential `priorities` or one
canonical `professional_path`, supports Back, Forward and refresh, and stores no
visitor-entered text or PII. The no-JavaScript fallback exposes the two
residential destinations and all three commercial/professional destinations
directly. Invalid, duplicate, excess, incompatible and wrong-route values fail
closed.

`Simple cover` continues to `/simple-pergolas-auckland`; `Custom design`
continues to `/custom-pergolas-auckland`; `Extending a Venue` continues to
`/commercial-pergolas-auckland`; the builder/contractor and architect/designer
results continue to `/architects-designers-builders`. Recommended residential
service and project-detail links retain the closed direction and priorities. A
viewed residential project may add one validated matching reference slug. The
matching residential service repeats the governed brief and preserves it through
its embedded form and shared header; finder-origin project detail suppresses the
early introduction CTA while its related-project links, final CTA and header
retain the context. Commercial/professional service, header, footer and
direct-enquiry links carry the closed direction and `professional_path`, with
the correct commercial or professional enquiry audience. Destination page
content is not owned by the homepage. Project canonicals and ordinary non-finder
journeys remain unchanged. The in-page `Send your brief` action appears only
after the selected result and built work. Shared header and footer route
attribution canonicalise Next's production `/index` alias to `/`.

`/simple-pergolas-auckland` is the dedicated conversion continuation for the
Simple cover choice. It is a new route-owned Foundation adoption rather than a
second acrylic SEO page: it is self-canonical, `noindex,follow`, absent from the
sitemap and directly accessible with or without JavaScript. Its split image-led
hero leads with `Cover the space without losing light.`, followed by a clear fit
definition, the Sanctuary finish and inclusions, useful material and blind
choices, an honest Simple-versus-Custom boundary, two governed reviews and the
existing privacy-preserving enquiry contract reworded as an initial-estimate
request. It intentionally omits project detours and extended guide copy. Homepage
direction and priority context continues through the page, embedded form and
shared header. The fit section directly after the hero is the named future
integration point for a separately governed price configurator; the production
page must not show a synthetic price or inactive configurator controls.
`/acrylic-roof-pergolas-auckland` remains unchanged as the only indexable
acrylic landing-page and sitemap owner.

Consent-aware production analytics use `homepage_variant:
project_finder_home_v2`, `source_path: /` and the existing closed finder event
names. `project_result_view`, `project_view_click` and
`project_pathway_click` remain separate intents; `professional_path_select` and
`professional_path_change` measure the nested choice. Priority changes do not
repeat a result view and choosing `Commercial / Professional` does not emit a
result view until one of its three paths is selected. The retired reference
action has no event. The shared header enquiry maps into
`project_finder_direct_enquiry_click`. Events carry only closed direction,
professional-path, priority, component, project, destination and validated
enquiry-audience values. Enquiry continuation deliberately retains
`source_experience: project-finder-home-v1` as the stable journey contract; the
v2 homepage variant distinguishes the production release without breaking the
existing enquiry schema.

The focused production owner is
`playwright/marketing.home-project-finder.spec.ts`. It covers root metadata and
schema, the retired-route redirect, 320-1440 responsive behavior, mobile hero
height, the decoded-image welcome deadline, reduced-motion exit, image and story
stages, both down controls, transparent-to-solid root header boundary,
URL/history state, keyboard and no-JavaScript access, consent-aware analytics,
lazy image loading, service and residential project continuation, all five
tailored results, mobile-menu state, overflow and the complete residential and
commercial/professional journeys. The
authoritative product and acceptance history remains
`sanctuary-project-led-visual-finder-homepage-prototype.md`.

## Verification

- `npx vitest run test/marketing-motion-contract.test.ts`
- `npx vitest run apps/marketing/app/%5F%5Ffoundation/marketing/foundationAccess.test.ts`
- `npx vitest run apps/marketing/components/marketing-foundation/Primitives.test.tsx`
- `npx vitest run apps/marketing/components/marketing-foundation/Interactions.test.tsx`
- `npx vitest run apps/marketing/components/Header.test.tsx apps/marketing/components/headerNavigation.test.ts`
- `npx vitest run apps/marketing/app/home-journey/journey.test.ts apps/marketing/components/marketingRouteChrome.test.ts`
- `npx vitest run apps/marketing/app/_home-guided/guidedConversationModel.test.ts apps/marketing/app/_home-guided/guidedConversationMedia.test.ts apps/marketing/app/_home-guided/GuidedConversation.test.tsx apps/marketing/app/home-guided/page.test.tsx`
- `npx tsc -p apps/marketing/tsconfig.json --noEmit --incremental false`
- `npm run test:marketing:browser`
- `npm run build:marketing`
- `npx playwright test playwright/marketing.foundation.spec.ts --config=playwright.marketing.config.ts`
- `npx playwright test playwright/marketing.home-guided.spec.ts --config=playwright.marketing.config.ts`
- `npx playwright test playwright/marketing.home-project-finder.spec.ts --config=playwright.marketing.config.ts`
- `npx playwright test playwright/marketing.projects.spec.ts --config=playwright.marketing.config.ts`
- `npx playwright test playwright/marketing.products.spec.ts --config=playwright.marketing.config.ts`
- `npx playwright test playwright/marketing.contact.spec.ts --config=playwright.marketing.config.ts`
- `npx playwright test playwright/marketing.mobile-content-density.spec.ts --config=playwright.marketing.config.ts`
- `npx playwright test playwright/marketing.phase-four.spec.ts --config=playwright.marketing.config.ts --workers=1`
- `npx playwright test playwright/marketing.shared-header.spec.ts --config=playwright.marketing.config.ts`
- Shared-header Playwright coverage at desktop and mobile widths, including geometry, green accent, keyboard focus, and representative public-route screenshots.

The Foundation browser suite exercises the shared responsive specimens at 430px, 390px, 360px, tablet, compact desktop, and desktop widths. It asserts single-tree card and fact-list presentation, semantic CTA hierarchy, minimum touch targets, focus visibility, reduced-motion behavior, mobile and desktop media ratios and focal points, stable desktop card geometry, and no horizontal overflow. Its interaction lane additionally verifies native disclosure state, keyboard and focus behavior, touch gallery controls, one active accessible image, live position text, reduced motion, homepage radio compatibility and stable desktop composition. An isolated-context matrix also smoke-tests every distinct direct Foundation consumer type at 390px and 1440px so the existing animated route transition cannot leave an exiting page in a strict locator. Set `MARKETING_FOUNDATION_CAPTURE=1` when running the focused spec to write PR 6 screenshots to `artifacts/mobile-ux-phase-3-pr-6/`. Set `MARKETING_FOUNDATION_INTERACTIONS_CAPTURE=1` to write the three PR 7 interaction screenshots to `artifacts/mobile-ux-phase-3-pr-7/`.

The TM-01 browser lane additionally checks active-state feedback without layout
geometry changes, fine-pointer hover gating, touch release without sticky hover,
and retained reduced-motion feedback. Set `MARKETING_TOUCH_MOTION_CAPTURE=1`
when running the focused Foundation spec to write the 390px pressed-state
evidence to `artifacts/mobile-touch-motion/tm-01/`.

The Playwright lane checks the standalone catalogue, shared header, homepage, every SEO programme route, the product hub and details, the project collection and case studies, the contact route, and the guide directory at desktop, compact desktop, tablet and mobile widths. It covers metadata, canonical/index state, unique identities, project and FAQ rendering, internal destinations, overflow, navigation, form attribution, sitemap inclusion and visible schema parity.

The mobile-content-density suite owns cross-family first-layer, disclosure,
keyboard, focus, 44px target, reduced-motion, heading, link, metadata, schema,
enquiry, overflow, desktop expansion and no-JavaScript contracts at 430px,
390px and 360px. Current closed-detail ceilings are 450 words for the homepage
and product detail, 500 for the product hub, 650 for residential, custom,
commercial and representative guide detail, and 350 for the guide hub and
contact. These are maximums, not content targets. Its script-blocked lane
proves pending detail is hidden and unfocusable before hydration and resolves
without changing height.

The dedicated Phase 3 suite visits the hub, all ten product routes, residential and custom at all three target widths. It enforces exact disclosure IDs, one controlled gallery and active image, no duplicate image request, HTML and visible-copy budgets, six-region service structures, high-priority hero loading and CLS at or below `0.1`. Set `MARKETING_PHASE_THREE_CAPTURE=1` to write production-compatible measurements and representative screenshots under `artifacts/mobile-ux-phase-3/`.

The dedicated Phase 4 suite covers commercial proof/stages/context, the
professional capability route and intercepted payload/analytics, the guide hub
and all seven guide first layers, refresh/Back, no-JavaScript completeness,
the bounded homepage finder/proof structure and footer utility at 430px, 390px
and 360px. Set
`MARKETING_PHASE_FOUR_CAPTURE=before|after` and
`MARKETING_PHASE_FOUR_WIDTH=430|390|360` for reproducible evidence under
`artifacts/mobile-ux-phase-4/`. A deployed capture must also set
`MARKETING_BASE_URL=https://www.sanctuarypergolas.co.nz`; every form test must
continue intercepting `**/api/enquiry`.

The internal `/__foundation/marketing` catalogue is intentionally unavailable
in production unless explicitly enabled. Full deployed browser runs therefore
report its 18 catalogue-only assertions as expected failures; public-route
results and the complete local foundation suite are the relevant signals.

The product suite additionally verifies every catalogue route, one visible H1,
loaded imagery, both project actions, the single gallery, three
keyboard-operable server-rendered groups, 44px targets, height budgets,
metadata, Product/Breadcrumb schema, reduced motion, no nested scroller and
honest unpublished heater evidence. The projects suite retains the Phase 2
collection, gallery, filter, selector and responsive contracts while asserting
the reduced Brief/Response hierarchy and single related-project navigation
system. The contact suite retains canonical and legacy preselection,
project/product refresh and history, validation, attachment, duplicate-submit,
consented analytics and lower-case non-personal context coverage. The finder
and hero-navigation suites preserve the approved desktop composition,
`project_finder_home_v2` and responsive header states.
