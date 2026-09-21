# Marketing UI Foundation

## Product clarity refinement (21 September 2026)

The hub introduces bespoke design alongside the roofline choice, with a dedicated
section immediately after the three cards. Hub and product bespoke links use the
existing bespoke enquiry intent, not Help me choose. Gable direction uses the
foundation segmented radio style (dark selected state, visible keyboard focus).
Sides retain four labelled standard configurations that update the live 3D model. The separate side diagram is removed; other combinations remain available in the full designer.
Pitched now features the governed residential Tindalls Bay project, explicitly
identified as bespoke evidence. Featured product alternatives link the three
current families; the canonical Hip route is retained.

## Mobile product journey refinement (21 September 2026)

Pitched, Gable and Box retain the desktop composition. On mobile, identity and
preview lead; price follows the dimensions, with only the active choice panel
visible. Non-actionable repeated helper copy is suppressed, while constraints,
draft labels and recovery remain. Size always shows its footprint above the mobile dimension controls. Mobile Size/Roof/Sides tabs use a dark selected state and single-line labels; their selection summaries remain desktop-only. A compact
estimate/Enquire bar carries the exact current draft; Customise further stays
beside the choices. Inclusions and supporting reading use disclosures, and the
built evidence appears before that reading on small phones.

The mobile preview is a single-tap entry into a native modal dialog. The same
viewer remains mounted: resizing preserves its orbit direction. The X or Escape
closes it, restores focus and page position, unlocks scrolling and reveals the
enquiry bar. The preview overlay accepts vertical scrolling outside fullscreen.
Desktop keeps inline rotation, Plan and Built example.
Crossing into the mobile layout returns Built example or Plan to the selected
3D design because the desktop view tabs are hidden there. Ordinary selection
changes retain the current view, including Plan recovery when 3D is unavailable.
Verify repeated opening, nonzero scroll return, keyboard trapping/closing, rotation, responsive changes,
and exact enquiry handoff. Physical-phone performance still needs device review.

## Pergolas selection hub (21 September 2026)

Owner-approved product selection: `/products` leads with three equal Pitched, Gable
and Box cards beneath a compact introduction. Matched existing house-attached
roofline illustrations replace unrelated project photographs in this comparison;
real project evidence remains below. Each card states the same 6 x 3 m acrylic,
open-sided example plus its attachment, using canonical product defaults and
existing price hooks. Development prices remain draft; unavailable/partial
prices never become invented offers. Product links preserve any saved choices,
which the example note explains. No WebGL scene runs on the hub.
Hip is removed from the featured cards, comparison and hub ItemList, while its
canonical detail page and other contextual discovery remain. The optional roof
comparison follows the cards; accessories, project proof and help follow below.
Production release is authorised after checks; pricing uses the existing approved version.

## Shared product/design controls (21 September 2026)

Owner-approved reference: the mobile configurator's bold, clear controls and
review presentation. Pitched, gable and box product pages and the desktop
configurator now share this foundation locally; production release remains separate.

- DimensionControl owns the thin architectural track, square thumb, ticks,
  direct metre input, select-all on focus, keyboard behaviour and reserved
  validation region. New product/configurator dimension controls must reuse it;
  do not recreate native accented range bars. Callers retain their constraints.
- design-controls.module.css owns black primary design actions, outlined secondary
  actions and strong selected-card borders. ArrowUpRight is the SVG CTA arrow;
  do not use font arrow characters for these actions. Back/next directional
  navigation retains its meaning. Editorial site navigation remains unchanged.
- Product previews and desktop Review share mobile studio lighting/materials and
  an illustrative furnished setting. Detailed editing uses the same treatment
  without furniture. Existing adaptive detail, on-demand rendering and plan
  recovery remain. Furniture is unpriced and uses the existing clearance rules.
- PergolaFootprint is the shared quiet plan for mobile Size and product Plan;
  it consumes solved geometry. The detailed desktop plan remains available for
  roof fall, side editing and inspection. Domain rendering stays in configurator.
- Product mobile choices include the current estimate beside the controls;
  draft, tailored and unavailable states stay explicit. No pricing rules move
  into the UI foundation. Current selections must survive enquiry, full designer,
  return and reload. Choice panels reserve space; warnings stay relevant.

Working specimens: /__foundation/marketing#design-controls. The catalogue uses
actual controls and links to the product/designer patterns; it is not a parallel
implementation. Verify click-to-select text, keyboard slider input, invalid and
out-of-range values, stable panels, small/large furniture, same-design prices,
and responsive transitions when extending these components.

## Local product-selection trial (21 September 2026)

The pitched, gable and box-perimeter routes open with one integrated model, identity, estimate
and selection area: size, acrylic/solid/mixed roof, and four blind arrangements.
Marketing foundation type, colours and actions remain the UI owner. The built
project photograph is available through Built example; existing product evidence
stays below. Size/Roof/Sides tabs use a stable shared panel region, visual choices,
keyboard navigation and explicit current-choice summaries. The trial is local,
not a production release or approval of a new standard offer. The owner approved
extending the pitched experience to gable and box on 21 September.

ProductSelector owns the limited controls, ProductModel consumes the existing
preview, and productSelection converts choices into a canonical preview draft.
The region reserves model and changing-copy space; roof/side choices do not
move the following controls. St Heliers has an explicit roof-shape/footprint
starting point with unsupported tint, custom frame and height disclosed. The
product page's lower next-step action returns to its own selection section so it
cannot accidentally reopen a different saved configurator draft.
The global saved-design bar is omitted on all three for the same reason; the
page's enquiry and customisation actions carry its current product selection.
Each family keeps separate session choices and uses its own roof illustrations.
Attachment assumptions remain explicit. Existing roof projection limits apply
before model and price updates; a resulting size adjustment is explained in the
reserved status region. Existing built photographs remain project references,
not representations of the customer's selected dimensions or price.


Status: Current marketing-only UI contract with approved public-route adoptions.

This document owns the Architectural Editorial UI system demonstrated at the standalone internal route `/__foundation/marketing`. It applies only to `apps/marketing`; it does not describe or set direction for the staff portal. Existing checked-in marketing routes and their rendered behavior are canonical. The catalogue documents shared owners and regression examples for current consumers, not a blanket instruction to restyle public routes. A new route adoption or broader visual change still requires separate, explicit approval.

## Source Of Truth

### Web-coherence candidate (19 September 2026)

Local review changes preserve the homepage and configured-design owners. Contact
continues a known pathway or validated project/product reference into a brief;
references without stronger intent use Help, not an inferred bespoke design.
The selected pathway is a compact native Change disclosure, kept open while
choosing. Neutral entry retains choices. Choice changes do not auto-scroll;
contact/brief fields and business details survive pathway round trips. The
existing contextual source, validation, retry and submission contracts remain.
Response wording uses the approved claims register.

Cost-guide and pergola-product decision panels link to the existing designer
and contextual help; configured designs needing individual quotes are not
relabeled bespoke. The product hub features Pitched, Gable and Box. Hip and
accessory products retain their specific brief CTA; only Pitched, Gable and Box
offer the designer, matching its current supported forms. Guide navigation presents related
decisions instead of implying a required sequence. No generic price example or
search-ranking claim is added.

The non-homepage design continuation is currently in normal flow at its existing
mount after the footer, so it cannot cover reading content. This trades persistent
visibility for an end-of-page continuation. Homepage floating behavior remains.
The integrated local preview and independent review verified unobscured reading
and the unchanged homepage continuation at desktop and phone widths.

Local tests cover continuity, consent, closed click metadata and receipt event
identity. Independent local review completed the cost-to-help, project-to-brief,
product comparison and designer-to-enquiry/Edit journeys at desktop and phone
widths. Hosted staging and live delivery remain separate verification gates. Local pricing availability is not proof
of the live pricebook, and no pricebook is enabled by this change. An overlapping
marketing-foundation task uses a separate worktree; reconcile both owning-doc
changes during integration without overwriting either agreement.

### Proposed evolution catalogue (17 September 2026)

The owner approved an isolated comparison at `/__foundation/marketing/evolution`,
linked from the existing catalogue. It inherits the catalogue's environment gate
and noindex metadata. This catalogue remains a design study; the later Editorial families approval below
owns public-route implementation scope.
The page reuses Foundation typography, surfaces, editorial cards, facts,
disclosures and the controlled gallery. Its scoped CSS and small study components
own Quiet / Expressive variants of Respond, Reveal, Transition and Arrive.
The existing Radix Dialog dependency owns menu focus trapping and dismissal.

The three examples are a project card with a working gallery, illustrative
material selection with native disclosure, and an opaque menu linking the studies.
Motion changes preserve the material selection; reload resets local choices.
Reduced motion can be previewed manually and the device preference always wins.
Arrival begins on first intersection without hiding content; replay brings the
image into view. No customer data, pricing, enquiry submission, new dependency,
or public navigation is introduced. Existing public routes retain their UI owners.

Focused browser coverage: `playwright/marketing.foundation-evolution.spec.ts`.
Task agreement and evidence: `artifacts/marketing-foundation-evolution/work-record.md`.

The next owner-authorised review stage applies the foundation to two connected,
gated reference pages at `/__foundation/marketing/evolution/project` and
`/__foundation/marketing/evolution/product`. Warkworth facts and Gable product
claims come from the existing data owners, not new fixture specifications.
Reference-only composition, motion and roof-exploration settings live in the URL
and survive reference navigation/reload. The customer content is separated from
the compact review-settings panel. The pages use the existing contextual contact
handoff; a roof approach is exploratory and is not passed as a specified design.
Browser verification must block enquiry submission and check return behaviour.
In-page journey links use Next Link so browser Back retains the route state.
`playwright/marketing.foundation-reference.spec.ts` owns this reference matrix.
These pages are a review candidate toward the owner's exceptional-quality target;
they do not establish public adoption, a final 10/10 rating or rollout approval.
Jordan selected Editorial composition with Quiet motion on 17 September 2026.
This supersedes the builder's Split recommendation for this reference direction.
Reference fact summaries use contiguous rules; detailed specifications use
full-width label/value rows to keep long material descriptions readable. Gallery
captions are concise editorial labels while descriptive image alt text is retained.
These local reference choices do not authorise changes to shared public components.

### Editorial website — authorised local review version (17 September 2026)

Jordan approved **Editorial composition + Quiet motion**, then expanded the scope
from project/product families to the full public website except the configurator.
The earlier family implementation transferred selected styling while retaining
older page composition; Jordan's screenshot reopened that visual acceptance.
The current rollout must match the approved reference composition, not merely
its colours, typography and individual components. Jordan confirmed the phone
checks and authorised production release on 18 September 2026.

Scope covers the homepage, project and product collections, all fourteen project
and ten product details, service/commercial/professional pages, the guide hub and
guides, contact, confirmation and privacy. The configurator, its design-enquiry
screen and contact preview entry, staff surfaces and private quote/invoice pages
retain their owners. Archived homepage experiments and the gated reference
catalogue are not public rollout targets.

Shared owners under components/marketing-foundation/editorial/:

- EditorialWebsite and website.css: route boundary, paper surfaces, solid
  stacked-wordmark header, footer and scoped page-family integration.
- EditorialLandingHero: consistent split hero, copy rhythm and responsive media
  for products, service pages and guides. Simple cover retains its
  mobile/desktop image selection and original configurator destination.
- EditorialProductContent and EditorialProjectContent: full editorial story
  composition, governed content, disclosures and contextual enquiry actions.
- EditorialFacts, MeasurementGroups and RoofApproaches: contiguous summary
  rules, readable full-width specification rows and exploratory roof comparison.

Quiet motion uses small arrivals and brief state changes; reduced-motion wins. In the product/configurator viewer, finishes and side selections keep the camera fixed. Dimension changes preserve the angle and settle framing gently; direct orbit input interrupts framing. Furniture waits for a sizing pause before changing arrangement and never scales to fit. Price loading must not change the canvas dimensions. Review actual continuous edits as well as settled screens.
Gable roof exploration persists in the URL and does not become an engineered
selection or an enquiry field. Other products retain only supported choices.
Project filtering and view scale belong to the collection. Case studies use
All projects, named desktop Previous/Next links and a photographic Next card.
Mobile uses one compact row with 44px arrow targets and destination names in
accessible labels, followed by the project title, hero image and then summary.
Returning to the collection preserves filters and scroll position. Switching,
history, metadata, finder context and enquiry contracts remain supported.
The project gallery now uses the reference's shared ResponsiveGallery with one
active image, keyboard controls and swipe. Project changes focus the new title;
returning from an enquiry restores the URL's project and metadata.
Missing project years and footprints are omitted. Product evidence limitations
remain visible, including the absence of a named heater installation.

This approved composition supersedes the historical full-viewport hero,
transparent-header, three-mobile-disclosure and closed-page-height prescriptions
elsewhere in this document for the public routes above. Those earlier paragraphs
explain the previous design and its tests, not the current visual acceptance.
Functional content, metadata, accessibility, consent and enquiry requirements
remain in force. The configurator's layout contracts are unaffected.

Homepage exception approved by Jordan on 18 September 2026: restore the original
full-viewport CinematicHero and its transparent overlay-header behavior above
the fold. Retain the approved new below-the-fold homepage content and finder.
The general split-hero prescription above no longer applies to the homepage.
Preserve the original responsive art direction, quiet/reduced-motion behavior,
finder state, enquiry context and browser-history return journey. This owner
decision supersedes the homepage portion of the 17 September rollout direction.

The public header and full-screen mobile menu use HeaderEditorial.module.css,
imported by Header so their markup carries its stylesheet dependency. The menu
has large sentence-case links, one close control and separate design/enquiry
actions. Retain its opaque surface until navigation arrives, then quietly fade;
preserve reduced motion, focus recovery and scroll position. Physical phone
screenshots exposed mixed new markup and legacy styling; the corrected local
candidate was confirmed by Jordan on the affected phone on 18 September 2026.

Single-destination navigation cards have a whole-card native link with one
clear accessible name, full-card focus treatment and normal new-tab behavior.
Keep independent controls and multi-destination groups usable. Decorative
up-right arrows use shared ArrowUpRight SVG, never emoji-prone text. Jordan's
18 September screenshots authorise this icon-only change inside the public
configurator too; configurator behavior, pricing and layout remain unchanged.

Acceptance uses playwright/marketing.editorial-website.spec.ts for all44 public
routes at360/768/1440, boundary checks, and matched-width Gable/Warkworth reference
comparison. Product/project/header and focused finder/contact suites cover
navigation, keyboard/touch, factual content and intercepted enquiry recovery.
Actual-browser independent review must inspect full body composition and perform
normal discovery-to-enquiry-and-return journeys. Hero geometry alone cannot
establish visual parity. Private review evidence remains in the local working
record; the release PR records public validation and deployment evidence.

Header visibility repair (17 September 2026): keep `styles/header.css` encoded
as UTF-8 without a BOM. In the production bundle, the BOM became part of the
`:root` selector, so shared header surface, blur and divider tokens never
applied. The shared-header browser regression checks painted header and mobile
menu backgrounds over product content against a production build.

Enquiry navigation (16 September 2026): the owner approved a home-linked
Sanctuary wordmark and "Back to website" returning to the source browsing page.
Unsafe or enquiry-loop sources fall back home. "Edit my design" sits beside the
preview. Existing session form recovery and design storage remain unchanged.
Local leave/return verification preserved the entered details and design; twelve
focused return-path/recovery tests and marketing typecheck passed. Publication
was explicitly approved after the local review. This changes no pricing or
submission contract.

Contact pathway refinement (16 September 2026): the configurator
entry is a full-width image-led card with a charcoal "Try the configurator"
action. Help, bespoke and commercial enquiry radios remain below under
"Prefer to talk to us?". At 760px and below the feature and choices stack.
Existing routing, selection and submission contracts are unchanged. This is an
owner-approved presentation change, approved for production after local review.

The owner-approved `/configurator-preview` route is an isolated UI experiment
using this marketing system. It adds fixed 3D, plan views and Simple
cover controls without changing existing public routes. It has no navigation or
sitemap entry and emits `noindex, nofollow`; its direct URL remains public.
Scope and technical boundaries are recorded in
`customer-configurator-architecture.md` under "Isolated UI preview".

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
- `ResponsiveGallery` keeps one active semantic `Figure`, with a labelled carousel region, visible Previous and Next buttons, a polite `Image n of total` status and Arrow Left, Arrow Right, Home and End support. Navigation wraps and focus stays on the control used. Its default non-swipe mode continues to mount only the active figure.
- Shared disclosure summaries and gallery controls have visible focus treatment and targets at least 44px high. Gallery controls remain visible at 360px. Directly relevant transitions are removed when reduced motion is requested.
- The internal catalogue owns the complete disclosure/gallery fixture. Approved public adapters now cover project, product, residential-service, guide and config-driven SEO-landing content. Each adapter delegates viewport state to the shared owner while retaining route-owned labels, classes and stable data attributes. Responsive detail is visually closed before and after mobile hydration, expanded on desktop and complete without JavaScript. The current homepage uses its bounded radio conversation instead of a responsive disclosure.

TM-01 establishes the shared motion and pressed-state contract:

- `apps/marketing/styles/tokens.css` owns the canonical instant, short, panel-enter and panel-exit durations, the standard, enter and exit easing curves, and restrained press scale and opacity values. Reduced motion resolves every shared duration to zero and press scale to one while retaining immediate non-motion feedback.
- Foundation `Button`, `TextLink`, `EditorialCard`, `Disclosure` summary and controlled-gallery controls own their pressed feedback in CSS. Small controls may use the shared `.992` scale; architectural cards never scale.
- Hover-only Foundation treatments for those owners run only on hover-capable fine pointers. Existing focus-visible, selected, disabled and semantic state ownership remains unchanged.
- The route entry treatment remains a documented exception, but its inactive `.page-layer` wrapper no longer carries a persistent compositing hint. The actively transformed route-progress bar retains its narrow `will-change`.
- `test/marketing-motion-contract.test.ts` guards only the shared token and Foundation owners in TM-01. Route adapters and shared chrome join that contract in the separately scoped TM-02.
- Product consumers opt into the `ResponsiveGallery` direct-manipulation mode. It defers pointer capture until an 8 px horizontal-intent threshold wins by a 1.2 dominance ratio, follows touch or primary-pen movement through one animation-frame-batched transform, and commits one adjacent item at the retained 48 px release threshold. Vertical intent cancels ownership and cannot be reclaimed. Before proximity it mounts one frame; a 160 px vertical `IntersectionObserver` margin or first operation enables only previous/current/next visual frames. Inactive frames are `aria-hidden`, use empty image alternatives and omit captions, so the labelled region, current caption and polite status expose one active item. Settling uses the governed short/enter tokens and resolves immediately under reduced motion; pointer cancellation, lost capture, resize, visibility, item changes, a second pointer and unmount clear transient movement.

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

The shared public header now uses the architectural editorial treatment across marketing routes: Instrument Sans branding, Inter navigation, square controls, a thin 1px rule, the olive `#4f5748` project action, and a 64px solid collapsed mobile state. Its four desktop destinations are split into two pairs so the midpoint between Products and Commercial sits on the viewport centreline rather than inheriting unequal outer-link widths. The mobile menu exposes Projects, Pergola options, Commercial and Professionals, followed by `Start your project`. It preserves source context, keeps body scroll locked, contains keyboard focus within the open navigation and trigger, closes with Escape, navigation or a tap on the dimmed page backdrop, and prevents that outside tap from reaching underlying page controls. It returns focus to its trigger when a keyboard visitor dismisses it. The root skip link uses critical inline positioning to stay outside the initial layout even when the stylesheet is delayed or unavailable, while the shared focus rule still reveals it to keyboard users.

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
expanded with non-interactive summaries above 640px. WebPage and BreadcrumbList
schema describe these quote-led catalogue pages. Product rich-result markup is
not emitted without eligible, visible offer or product-specific review data;
do not invent prices or reuse business-wide ratings to satisfy it.
Retired FAQ copy is no longer emitted as visible content or
FAQ schema. Governed, context-only and not-published evidence caveats remain
visible and cannot be upgraded by presentation code.

Visible product-page copy and decorative markers use natural punctuation without em dashes. Catalogue unit coverage governs the ten product records, while the product browser suite checks rendered copy and generated marker content on representative routes.

`/contact` is an approved route-scoped adoption. Its small server page owns the unchanged editorial introduction, governed Warkworth project image and validated query context before hydration. `ContactEnquiryForm.tsx` owns one responsive submission tree at every width, `contactJourney.ts` owns the local Simple/Custom/Commercial-Professional presentation mapping, and `contact.css` owns the square, rule-led Foundation presentation. The three retired legacy contact stylesheets and duplicated desktop/mobile page trees must not be restored.

The contact opening mirrors the homepage with three local sales pathways without changing the canonical intake audience: Simple and Custom both submit as residential, while Commercial / Professional asks which governed business audience applies. Trusted finder direction, Simple source route, or commercial/professional audience may preselect the matching pathway; a generic residential audience remains open because it does not distinguish Simple from Custom. Switching pathways retains shared suburb, brief, files and contact fields while unmounted branch-only organisation, role and stage values do not enter another branch's payload.

Simple embeds the shared marketing calculator with `placement: contact`; the calculator is not a nested form. Shared enquiry fields remain closed until the visitor continues with a priced, Custom or unavailable result. The handoff reuses the shared authenticated calculation-reference payload owner and summary; no costing or geometry logic is copied into Contact. Custom retains the residential project brief. Commercial / Professional adds organisation, project role and project stage, while the shared message becomes project scope. Custom and business paths keep dimensions, pergola form, roof approach and other options inside one native full-width `04 Additional project details` disclosure with an Optional label and visible plus/minus state. The complete summary remains keyboard-operable and at least 44 pixels high.

The direct and embedded residential, custom, commercial and professional enquiry forms continue to share the contract in `apps/marketing/lib/enquiryFormContract.ts`. Name, phone and email remain required once a contact pathway reaches the shared form; project suburb, project brief/scope and technical choices remain optional. Upload controls use the governed attachment accept list and the shared concise eight-file, 20 MB total helper. Do not add route-local reachability rules or upload copy.

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
form; direct `/contact` stays neutral and unknown values are ignored. The
enhanced Contact payload adds only the closed local `contactPathway`, project
role and project stage values to project details. Visible and generated contact
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
residential choices. The opening is cinematic without changing this owner. The
single H1, `Outdoor spaces designed around the way you live.`, is immediately
visible over the charcoal welcome veil and remains in the same position while
that veil reveals the priority Warkworth hero image. The shared header is
inaccessible and visually absent before the reveal begins, then its complete
brand-and-navigation unit fades in with the image. The veil still starts leaving
as soon as the image is decoded, or after a bounded 1.4-second fallback; only its
softer 650ms fade duration changes, and the fade is removed for reduced-motion
visitors. The image uses the dedicated portrait
`warkworth-gable-02.jpg` art direction through 760px and the existing wide
project image above that breakpoint. Within the H1, `Outdoor spaces` uses 78%
white while `designed around the way you live.` uses a 98% opaque near-white
warm ivory (`rgb(250, 247, 240)`), preserving one semantic heading while
creating two coherent editorial phrases.
After the image is visible, the eyebrow,
support copy and Warkworth attribution remain in place and fade in over one
second after an 800ms delay through the 900px mobile and tablet range, or a
700ms delay from 901px upward. The bottom-centred continue chevron fades over
600ms beginning 200ms after the supporting layer starts. Reduced-motion visitors
receive the complete supporting layer immediately. The supporting reveal waits
while the mobile menu is open. The chevron has no stem, label, background or
visible enclosing shape and advances
to the measured question-and-three-choices wrapper. When that complete wrapper
fits between the live header and visual viewport bottom it is centred in the
available space; otherwise its top is aligned eight pixels beneath the header.
The hero owns exactly one viewport and does not intercept wheel, touch or
keyboard input; ordinary scrolling is native and there is no scroll-controlled
copy stage or extended sticky runway. The header stays transparent and withholds
its desktop project action until the hero boundary is left, then returns to its
opaque surface. JavaScript-disabled visitors bypass the veil and receive the
complete hero story plus the existing direct fallback. Mobile keeps compact complete
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

`/simple-pergolas-auckland` is the dedicated product and conversion continuation
for the Simple cover choice. It owns the focused Simple pitched acrylic intent:
it is self-canonical, `index,follow`, included in the sitemap and directly
accessible with or without JavaScript. Its split image-led
hero leads with `Cover the space without losing light.` and the primary
`Price your Simple cover` action. The complete governed calculator now appears
immediately after that hero and absorbs the former long fit section. The
calculator is followed immediately by one real-project comparison using the
existing ground-level and elevated-deck images. Desktop keeps the pair side by
side beneath one grouped heading; mobile stacks equal-ratio cards with source
order and captions intact. The remaining
mobile page shows the Sanctuary-finish heading and three compact proof points,
hides the standalone inclusions panel while the live-result strip retains GST
and installation context, reduces material/blind choices to three option rows,
and uses two concise Simple-versus-Custom qualification cards. The review
section consumes the shared live/fallback Google rating owner and curated
review records for one rating/count trust treatment plus Google attribution
beside each reviewer; it does not copy aggregate or quote data into the route.
The trust treatment sits beside the grouped review heading on desktop and
beneath it on narrower screens, while review cards retain content-led mobile
height and two-column alignment where space permits.

At 560 CSS pixels and below the embedded calculator introduction shows only
the existing eyebrow and `Price your Simple cover.`; the standalone calculator
retains its fuller introduction. A priced result's `Request a site measure`
action carries the closed configuration and opaque calculation reference into
a visible summary above the final form. Supporting copy states that Sanctuary
reviews the request and confirms whether a site measure is the right next step;
the CTA does not book a visit or promise a quote. Custom and unavailable
results keep selection-aware review continuations and do not invent a price.
Redundant project-type, roof-form, attachment, dimensions, deck-level and
connection questions remain removed from this focused form. It intentionally
omits project detours and extended guide copy. Homepage direction and priority
context continues through the page, embedded form and shared header.
`/acrylic-roof-pergolas-auckland` remains the broader acrylic-roof research
owner. The two routes stay distinct through research-led acrylic comparison on
that route and sales-first Simple cover fit and pricing on this route.

`/simple-cover-calculator` remains the separate shareable calculator route. It
is self-canonical and `noindex,follow`; both routes render the same component,
with only intro placement and continuation behavior varying. The component owns
its marketing presentation and does not import portal UI or drawing CSS. Native 100 mm range
controls use the Projects view-scale language with metre stops and square handles;
editable metre values cover 1-10 m width and 1-6 m projection
with a 6 x 3 m default, a ground/elevated choice, automatic post layout and an
accessible architectural concept plan. The plan topline owns the live area beside
the level, keeping that design fact attached to the drawing. The plan uses the
package-owned acrylic-rafter layout even when price is unavailable, with scaled 50 mm
rafter/ledger and 100 mm beam/post outlines, technical dimensions and a distinct
marketing presentation. A valid Simple combination shows `From $X`, GST,
standard installation wording, the public costing version and the clear
`Request a site measure` next step. The standalone CTA stores the closed handoff in same-tab session storage
before continuing to the focused sales page; no price, dimensions or reference
enter the URL. An over-limit combination keeps the dimensions, removes price,
gives the exact 30 m2 or 20 m2 reason and offers both Sanctuary review and the
Custom design route. Published costing failure keeps the design visible, shows
no price and still offers a selection-aware review continuation.

At 560 CSS pixels and below, normal-height phones use one bounded focus stage
beneath the fixed header containing only the concept plan, prominent live price
and two dimension controls. Its composition is capped and vertically centred,
so taller phones gain balanced whitespace while a 393 x 650 Safari-usable
viewport contracts that whitespace before reducing the essential plan and
control space. Each range input owns a 60-pixel touch lane while retaining the
thin architectural rail and compact square handle. The dimensions heading keeps
the previous price in a subdued updating state while a new price is resolved.

The focus stage consumes `100svh` minus the header, settles with native
`position: sticky` for a short page-owned runway, then releases into a separate
72-pixel-minimum deck-level choice followed by options and assumptions. The
supporting live-result strip comes after every price-affecting input and carries
GST, installation and pricing-set context plus the next-step CTA instead of
repeating a second large price; Custom and unavailable states retain their full
route-specific guidance.
The stage does not intercept wheel or touch input and
does not use document scroll snap. Viewports below 580 CSS pixels in height,
mobile landscape and widths at or below 320 CSS pixels use the same semantic
controls in normal document flow so browser chrome, keyboard use and zoom cannot
trap or clip the calculator. The governed mobile matrix includes 430 x 932,
393 x 650, 390 x 844 and 360 x 800; short-height, landscape and 200 percent
zoom-equivalent checks prove the native-scrolling fallback.

The focused public-calculator owner is
`playwright/marketing.simple-cover-calculator.spec.ts`, backed by the costing,
resolver, route, component and root parity unit suites named in
`docs/testing-and-qa.md`.

The Simple cover hero owns one viewport when its content fits, but its desktop
grid must grow with the copy on short screens rather than letting the copy,
media or proof rail escape a definite-height row. At 900 pixels and below the
approved image-first stack remains the route contract. The stacked media begins
below the fixed header; phone crops bias upward and restore about 2.5rem of
visible image while keeping the complete hero copy ahead of the next section. Plain and
homepage-attributed documents keep contiguous hero, optional saved-brief and
fit-section boundaries, visible headline-to-intro spacing, aligned media edges,
fixed-header anchor clearance and zero horizontal overflow from 320 to 1440
pixels, including viewport heights down to 500 pixels.

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
schema, the retired-route redirect, 320-1440 responsive behavior, one-viewport
mobile hero height, the decoded-image welcome deadline, stable loading-to-image
H1, synchronized 650ms image/header fade, responsive in-place supporting-copy
delay and duration, reduced-motion exit, the single continue control, native
input behavior, transparent-to-solid root header boundary,
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
metadata, WebPage/BreadcrumbList schema, reduced motion, no nested scroller and
honest unpublished heater evidence. The projects suite retains the Phase 2
collection, gallery, filter, selector and responsive contracts while asserting
the reduced Brief/Response hierarchy and single related-project navigation
system. The contact suite retains canonical and legacy preselection,
project/product refresh and history, validation, attachment, duplicate-submit,
consented analytics and lower-case non-personal context coverage. The finder
and hero-navigation suites preserve the approved desktop composition,
`project_finder_home_v2` and responsive header states.

### Desktop configurator editorial pass (18 September 2026)

Jordan authorised a general desktop UI pass to match the Editorial + Quiet
website. At widths above 1000px, the existing configurator CSS owners provide a
wider choices panel, larger section headings, underlined stage/view navigation,
ruled Personalise choices and a divided dimension/estimate strip. The dialog, embedded design entry and review share these
styles. Mobile and tablet composition remains unchanged; a separate mobile
redesign awaits the owner's direction. Native controls, focus indication, night
colours and reduced-motion preference remain supported.

This is a local review version, not a production release. Pricing, geometry,
selection persistence and enquiry contracts remain with their existing owners.
Browser coverage: `playwright/marketing.configurator-editorial.spec.ts`.
The site footer now has an explicit `data-site-footer` styling boundary. Website
footer rules must not style the configurator's action footer when the dialog is
opened from a marketing page. The desktop regression includes homepage entry.

The approved Day/Night transition is integrated into this local desktop version:
scene lighting and the full interface share the same reversible one-second
animation. Desktop foreground aliases match each warm/elevated/selected surface;
independent CSS colour transitions are disabled to avoid lag. Reduced motion
uses the endpoint immediately. The later experimental shader-preparation work
is not included. See `customer-configurator-architecture.md` for the owner
contract and `playwright/marketing.configurator-transition.spec.ts` for coverage.

### Mobile configurator guided draft (18 September 2026)

Jordan approved a four-page mobile journey on 19 September: Roof, Size, Sides & Lighting, Review. This supersedes the earlier five-page version; the model is optional through Explore your design on Review. Desktop retains its editorial composition. Roof combines shape and material rows with nine matched architectural references: the three approved acrylic renders and six solid/combination variants in the same warm treatment. Each shape/material selection changes the visual. These illustrate the combination; the later actual model reflects dimensions, ridge direction and refinements.

Main choices, their visual and the next action fit above the fold at 360–430px wide and 750px viewport height. Fixed visual regions prevent selection jumps. Advanced options remain disclosed, and smaller viewports or enlarged text can scroll safely. Gable ridge direction sits in the optional roof details. Ground/Elevated may scroll below the main size and attachment choices; neither is required above the fold. Specific house connections stay in More design options.

Roof references retain their full 4:3 composition rather than a shallow cropped strip. Side and lighting previews use the available content height, preserving room for their primary controls and the fixed next action. The Size plan has a larger readable drawing region; optional site controls may scroll. Check actual screen use as well as element visibility: unused space is not a reason to keep a small image.

Sides and Lighting are tabs within page 3. Sides leads with a large actual-model viewport and left/right SVG chevrons. Swipe or keyboard controls browse five complete configurations: open, front blinds, front-and-side blinds, front blinds with timber sides, and timber sides with an open front. The camera remains steady, each deliberate choice applies immediately, and only configurations that fit the available openings are offered. A concrete material/position title and count explain the choice without a second descriptive line. Existing individual settings are labelled Your combination rather than silently replaced. Customise sides retains grouped opening checkboxes, all five materials, the opening map and individual refinements below. There is no Apply or confirmation subpage. Lighting retains three presets, an actual steady night model and detailed fittings/LED controls in a disclosure. Downstream notices belong with extras and Review, not above introductory roof choices.

Size uses a quiet architectural plan with double-line rafters, beams, gutters and ridge from solved geometry. Acrylic has a faint blue tint and subdued hatch; solid regions mask underlying rafters. Attached/Freestanding precedes Ground/Elevated. The daylight model is optional from Review, with a direct return. Mobile has no view/time switches; night is confined to the lighting tab.

Review keeps a fresh actual-design portrait, compact specification, Enquire/Share actions near the top, permanently open price lines and essential exclusions. A white Edit design action beside Share design opens a dedicated four-section chooser with current roof, size, sides and lighting summaries. Editors offer All sections and Return to review, retaining enquiry details. Detailed pricing and the inline enquiry form may scroll; primary actions remain near the top. See customer-configurator-architecture.md for state and workflow ownership.

Mobile arrow icons use SVG; range inputs retain native keyboard/touch behavior but their native paint is transparent, with one CSS handle above the track. Touch selection does not receive a second focus outline; keyboard focus remains visible. WebKit browser evidence complements Chromium checks and does not establish physical iPhone acceptance.
The design-enquiry preview retains its 3D/Plan switch as understated text tabs with a thin active underline, matching desktop configurator styling at both mobile and desktop widths; the guided mobile configurator itself has no view switch.

Mobile configurator finish: one minimal Review with portrait/specification, a dedicated edit chooser, open price lines and essential exclusions. White Edit design and Share design actions are paired above a full-width black Enquire action. There is no secondary Copy link button in this mobile row; Share design uses native sharing when available and clipboard/manual-copy fallback otherwise. Enquiry opens inline, sharing retains a version-specific design link. Success language is conditional on actual submission/clipboard/share completion. The compact form and its entered details survive design editing. Desktop/standalone enquiry presentation is unchanged.
Mobile choice images use high fetch priority for the actual selected reference. The Review/enquiry module loads on first reaching Review, then stays mounted through edits to preserve entered details. Returning and shared designs do not fetch an assumed default roof image.

Mobile copy refinement: omit the duplicate visible Review title, portrait caption, save/share helper, edit subtitle and edit-menu question. Draft pricing retains Draft price, GST, provisional allowances and exclusions; Owner review is omitted only in the expanded mobile draft price. Roof keeps a short material benefit and an Illustrative example note in details. Size relies on the labelled plan, and lighting keeps the layout-replacement consequence without redundant preview prose. Site/structure confirmation wording is consolidated. Essential fit, storage, price and recovery notices remain.
Mobile 3D uses the approved enhanced materials and demand-rendered shadows automatically. Choosing views stay clean; Review/Explore add illustrative paving, architectural context and full-size furniture where it fits. Desktop keeps its default renderer. Orbit temporarily lowers pixel density; the settled view restores capped detail without continuous idle rendering. Fine roof aliasing remains a known visual limitation.

Mobile extras use one compact row for lighting presets with fitting counts and the site's black selected state, including at night. Side recommendations retain large chevrons and add a three-face treatment summary; current design total appears below either editor without repeating a full breakdown. Stale totals clear while a new estimate is loading. Review allocates more height to its captured model and uses a more frontal composition while retaining visible Enquire/Share actions. Advanced editing and price caveats remain available; the four-page sequence is unchanged.

Mobile Sides comparisons use a lower exterior overview. Lighting uses an interior eye-level composition to reveal the ceiling and illuminated surfaces, held steady when choosing brightness. Selected screens remain in the actual design; the preview does not lift them or change fabric transparency. Review and desktop compositions remain separate.

The owner-endorsed roof-choice interaction is the mobile benchmark: a clear choice, an obvious visual consequence and little explanatory burden. Earlier selection views stay clean; Review/Explore earns richer architectural context and realistic, full-size furniture to communicate scale and value. The current four-page journey supersedes the former five-page journey and separate model stop; this distinction is mobile-only.

Review/Explore roof shading filters subpixel profile normals while retaining the solved sheet and silhouette. Upholstery has restrained seams and sheen; contact cues sit above paving. Explore fits the complete product with a size-aware opening angle rather than cropping the posts with a fixed zoom multiplier. These finishes preserve fixed-size furniture and demand rendering, and do not alter the clean earlier choices. Fine silhouette aliasing at low pixel density remains possible.

Review furniture uses charcoal upholstered dining chairs with curved backs and angular black frames, following the owner's dark-chair reference. Arrangements must demonstrate useful capacity, especially the popular 6 x 3 m footprint, rather than merely pass a collision check. Full-size lounge and dining groups can sit side by side in wide spaces or in sequence in deep spaces, with connected access and seating facing into the usable area. Shallow spaces use real compact furnishings or a sofa/bench setting; furniture is never scaled down to fill a gap. The compact four-place table pairs two dark chairs with a two-place bench. Larger social settings use a 2400 mm sofa with two lounge chairs; the L lounge remains available where its proportions fit. Review daylight balances a softer key with fill/environment, with quiet glazing, plaster and paving variation. Earlier choice views remain unchanged.

### Side orientation across product and configurator views

Opening names retain the existing customer-design contract: left/right are named
looking out from the house (or rear of a freestanding pergola). House-at-top plans
now face the house, matching the default garden-facing 3D view: home-left appears
on the viewer's right. Product side diagrams, full plans and size footprints use
this same projection. Reflect rendered geometry only; keep labels readable and
keep stored opening IDs, pricing and saved design positions unchanged. Verify
both asymmetric left/right selections in plan, 3D and enquiry after camera/view
changes; a symmetric all-sides fixture cannot establish orientation parity.

## Homepage product entry (21 September 2026)
The homepage reuses the product hub cards and example-price owner. Its compact mobile variant stacks three image/text cards; visible links lead to the product pages and the comparison hub. Bespoke and commercial/professional pathways stay visible below. Keep price/status space stable while estimates load; retain the shared arrow and focus treatments. Cards use h3 beneath the section h2; hub cards remain h2 beneath its h1.

## Portrait roofline image trial (21 September 2026)
The owner rejected the compact homepage thumbnail treatment as too weak. An isolated, noindex /review/portrait-rooflines page trials three full-width 4:5 mobile images, with title, estimate and action underneath. Model screenshots at 1600 mm eye height and about 30 degrees to the frontage guide generated structure; furniture is newly generated using model placement as a layout template. Keep the gable apex, pitched fall and box perimeter visible. This trial does not replace homepage imagery; desktop compositions follow owner feedback. Generated images remain illustrative, not dimensional or engineering evidence.

Homepage roofline selection uses full-width 4:5 furnished model-based portraits, short descriptions and compact shared example pricing. Common GST/site qualifications remain visible; complete example specifications and illustration exclusions sit in an accessible details disclosure. Bespoke and professional pathways remain visible. Do not restore the previous thumbnail/text split on mobile.

### Product mobile refinement (21 September 2026)
Product estimate totals use the shared nearest-5-dollar display formatter; the pricing result and shared estimate payload retain their exact values. Breakdowns disclose the display rounding. Product viewers show a labelled starting illustration until the first rendered frame, with mobile pixel ratio capped at 1.25 and reduced foliage/shadow detail. Mobile Roof/Sides panels size to content; the side diagram is retired in favour of four labelled presets and the live model. Mobile Customise further enters Edit your design with product choices retained; normal shared/project links keep their prior Review entry. The product hub uses the approved portrait roofline imagery on all breakpoints.

Size-plan framing stays fixed during pointer/keyboard slider gestures; the footprint and dimension labels update in that fixed viewport and may be clipped. Release refits over650ms with smooth proportional zoom and no overshoot; new input interrupts at the current scale. Typed values refit on commit. Reduced-motion preference fits immediately. Shared footprint applies this to mobile sizing and product Plan views; surrounding layout remains fixed.
