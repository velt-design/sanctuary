# Sanctuary Pergolas Mobile UX Roadmap

> **Status:** Authoritative implementation brief  
> **Repository:** `velt-design/sanctuary`  
> **Recommended repository path:** `docs/mobile-ux-roadmap.md`  
> **Primary scope:** Mobile customer experience at approximately 430 px, 390 px and 360 px  
> **Source:** The mobile UX audit completed in this conversation  
> **Implementation model:** One responsive Next.js website, one shared content source, shared React components, Tailwind styling, preserved semantic structure and existing analytics  
> **Primary outcome:** More qualified enquiries through a calmer, more project-led and easier-to-scan mobile experience

## How to use this roadmap

Every mobile UX pull request should:

1. Name the roadmap phase and proposed PR item it implements.
2. State its exact scope, dependencies, acceptance criteria and non-goals before code changes begin.
3. Avoid combining conversion logic, broad page restructuring and shared visual-system changes in one PR.
4. Preserve one content model and one responsive application. Mobile-specific layouts, image crops, concise summaries and progressive disclosure are allowed. Duplicate mobile pages or duplicated semantic content are not.
5. Include evidence at the implemented widths and update tests for any shared component behaviour that changes.

## Evidence status

This roadmap preserves the distinctions made in the original audit:

- **Verified:** Observed in the live page structure, visible content, exposed link destinations, form fields, image inventory or interaction labels.
- **Inferred:** A likely mobile risk based on content length, control labels, image composition or responsive structure where pixel-accurate viewport testing was unavailable.
- **Test required:** Behaviour that must be checked on real devices, with keyboards or with assistive technology before it can be treated as confirmed.

Verified issues should be corrected first. Inferred risks should guide implementation and then be validated. Test-required items must not be reported as resolved without direct testing.

---

## 1. Executive direction

Sanctuary's mobile experience already communicates architectural credibility better than a typical pergola installer. Strong completed projects, precise dimensions, material descriptions, design constraints, reviews and Auckland delivery responsibility support the premium positioning. The project pages contain the strongest evidence and should become the centre of the mobile journey.

The central problem is cumulative content weight. The homepage and primary service, product and commercial pages expose too many equally weighted sections, repeated explanations, repeated project sets, repeated enquiry instructions and detailed technical content before a visitor needs it. The site is responsive, but the journey often feels like a desktop information architecture compressed into a long phone scroll.

The intended experience is calmer and more selective. A visitor should understand Sanctuary within one screen, see compelling built evidence within the next few screens, choose a relevant pathway without diagnosing technical complexity, understand suitability and process quickly, and enter an enquiry that preserves the page, project, product and audience context that brought them there.

Implementation should proceed through small, independently testable pull requests. Incorrect conversion behaviour comes first. Shared responsive patterns come before broad page migration. Page groups are then simplified in sequence, followed by real-device validation and optimisation. This reduces regression risk, makes design decisions reviewable and prevents each page from developing its own mobile solution.

### Priority order

1. Correct routing, context loss, form inconsistencies and accessibility defects.
2. Reduce and reorder the homepage without changing the full site system at once.
3. Establish shared mobile layout, media, CTA and interaction patterns.
4. Make project discovery and project detail pages the primary proof system.
5. Migrate service, product, commercial, professional and guide journeys to the shared patterns.
6. Validate on real devices and measure qualified enquiry behaviour.

---

## 2. Mobile experience principles

These principles are implementation and code-review criteria, not general aspirations.

| Principle | Requirement for implementation and review |
|---|---|
| **1. Prioritise the next customer decision** | Each mobile screen or section should help the visitor understand Sanctuary, evaluate fit, inspect proof or take the next action. Remove content that only repeats a previous conclusion. |
| **2. Lead with built evidence** | Completed projects, dimensions, materials, constraints and design responses should do more persuasive work than explanatory copy. Major pages should place strong project proof before extended education. |
| **3. Maintain one clear CTA hierarchy** | A section should normally contain one primary action. Secondary links may support research, but they must not compete visually with the intended next step. |
| **4. Keep the first layer concise** | The default mobile state should contain the minimum content required for clarity and trust. Detailed specifications, caveats, FAQs and secondary options should use semantic progressive disclosure or linked pages. |
| **5. Preserve enquiry continuity** | Audience, source page, source component, selected project and selected product must survive the transition into the enquiry experience. Visitors must not be asked to restate context that the site already knows. |
| **6. Art-direct images for mobile** | Responsive images must preserve roof geometry, the relationship to the building and material detail. A desktop crop must not be accepted merely because it technically fits a narrow container. |
| **7. Design for touch before hover** | Controls must have sufficient target size and spacing, visible state changes and non-swipe alternatives. No required information or action may depend on hover. |
| **8. Use shared responsive components** | Page groups should use common CTA, card, media, disclosure, project-fact, gallery and enquiry components. Mobile variation should be controlled through component props, shared content fields and responsive layout, not copied markup. |
| **9. Protect premium architectural restraint** | Use fewer, larger elements, concise language, clear whitespace and purposeful imagery. Avoid crowded card grids, excessive badges, urgent sales language, decorative effects and repeated calls to action. |
| **10. Make accessibility part of the component contract** | Focus behaviour, semantic controls, labels, error handling, reduced motion and hidden responsive states must be defined when a component is built, not added after page migration. |
| **11. Do not hide complexity by duplicating content** | Prefer one semantic content structure with summaries and disclosure. Do not render separate desktop and mobile copies of the same complete section unless the inactive copy is fully removed from layout and the accessibility tree, IDs remain unique and duplication is demonstrably necessary. |
| **12. Release changes that can be measured independently** | Each PR should deliver one customer outcome or reusable system improvement, preserve analytics continuity and be small enough for visual, functional and regression review. |

### Code-review questions

A mobile UX PR should not be approved until reviewers can answer yes to the following:

- Does the change reduce or clarify a customer decision rather than add another layer?
- Does it preserve the strongest available project evidence?
- Is the primary action obvious without competing buttons?
- Is detailed content optional where it can be optional?
- Does context persist through the next route?
- Are the same content and analytics sources retained?
- Does the implementation work at 430 px, 390 px and 360 px?
- Can every interaction be used by touch, keyboard and assistive technology?
- Are non-goals respected?

---

## 3. Target mobile journey

### Preferred customer journey

| Stage | Visitor question | Required experience | Evidence or content | Preferred next action |
|---:|---|---|---|---|
| **1. Land on the homepage** | What is this company and is it relevant to me? | A composed first screen with a clearly readable pergola, concise architectural positioning, Auckland context, review proof and one dominant action. | Bespoke fixed-roof pergolas, Auckland design and installation, one strong project image, review rating. | View completed projects or start a project. |
| **2. Understand Sanctuary** | Is this a premium bespoke service or a generic product installer? | A signature project should demonstrate design quality before the visitor encounters a long explanation. | Dimensions, materials, one design constraint, one design response, one-team responsibility. | Open the project or choose an audience route. |
| **3. View relevant completed work** | Have they delivered something comparable to my property or brief? | Large project cards with useful variety and concise facts. Project pages should feel like an architectural portfolio. | Residential, contemporary, constrained and commercial examples; exterior, interior and detail imagery. | Open a project, browse the next project or enquire with that project retained as context. |
| **4. Select a pathway** | Which route is relevant to me? | Visitors choose by audience first, not by diagnosing technical complexity. | Home, commercial, architects/designers/builders. Custom conditions are explained within the relevant pathway. | Enter the appropriate service or capability page. |
| **5. Understand suitability and process** | Can Sanctuary solve my conditions, what will the process involve and what affects investment? | A concise page pattern with project proof, fit, process and investment drivers. Detailed education is optional. | Three principles, two or three projects, three-stage process, key scope and programme information. | Start an audience-specific enquiry or inspect one relevant guide. |
| **6. Enter an enquiry** | What information do I need to provide and what will happen with it? | A short first layer with preselected context, clear required and optional states, progressive fields and uploads where supported. | Enquiry type, source project or product, location, desired outcome, contact details, optional plans/photos. | Submit without repeating known context. |
| **7. Receive clear expectations** | What happens after submission? | An accessible success state that confirms receipt, restates the relevant context and explains the next operational step without unsupported promises. | Submission summary, expected response method, any supported response timeframe, direct contact route. | Await response, review the selected project or contact Sanctuary directly if needed. |

### Role of each page group

| Page group | Primary role in the mobile journey | What it should not become |
|---|---|---|
| **Homepage** | Establish category, premium fit, project credibility, audience route and a low-friction next step. | A complete buying guide or catalogue of every product and process detail. |
| **Residential service page** | Explain fit, project approach, process, investment drivers and how to begin. | A long article that repeats the product index, guide hub and FAQ library. |
| **Custom service page** | Demonstrate capability where junctions, levels, supports, drainage or architecture require a more resolved response. | A second general residential page with slightly different wording. |
| **Products index** | Help visitors understand major roof forms and material approaches through visual comparison. | A dense catalogue of equal-weight cards and accessory decisions. |
| **Product pages** | Explain where one option fits, what must be resolved, one built example and the main trade-offs. | A full specification manual before the visitor has established suitability. |
| **Projects index** | Provide premium visual discovery and enable visitors to find relevant built evidence quickly. | An administrative selector dominated by filters and metadata. |
| **Project pages** | Provide the strongest proof through images, facts, brief, constraints and design response. | A text-heavy case study with small images or a generic contact CTA that loses project context. |
| **Commercial page** | Demonstrate operational fit, delivery responsibility, consultant coordination and relevant cases. | A residential journey with commercial language added or an article that delays case evidence. |
| **Professional content** | Show architects, designers and builders how Sanctuary collaborates, documents and delivers. | A contact-form preselection without capability evidence. |
| **Guide hub and guide pages** | Support visitors who need specific education and retain useful semantic content. | A dominant route that repeatedly diverts high-intent visitors away from projects and enquiry. |
| **Enquiry experience** | Qualify the brief with minimal first-step friction and preserve source context. | Multiple inconsistent forms that ask visitors to repeat the same information. |

---

## 4. Phased rollout

### Phase 1: Conversion and routing corrections

| Item | Definition |
|---|---|
| **Objective** | Correct verified conversion defects and establish a reliable enquiry-context contract before visual restructuring. |
| **User problem solved** | Visitors are misrouted, lose project or product context, encounter inconsistent form expectations or cannot provide the files the preceding CTA asks for. |
| **Scope** | Context-aware CTA routing; commercial and professional enquiry preselection; project and product source tracking; source-page and source-component fields; form terminology corrections; consistent upload behaviour where the backend supports it; analytics continuity; form and responsive-duplicate accessibility defects. |
| **Explicitly out of scope** | Homepage section restructuring, broad copy reduction, new visual tokens, project-index redesign, full form redesign, new CRM or analytics vendor. |
| **Dependencies** | Confirm the current routing helpers, form schema, submission endpoint, upload support and analytics event implementation. |
| **Likely components or page groups** | Global header, CTA/link helpers, contact route, enquiry form components, homepage CTAs, commercial page, professional route, project pages, product pages and analytics utilities. |
| **Recommended number of PRs** | 3 |
| **Implementation risk** | Medium. Routing changes are low risk, but form submission and analytics changes require regression testing. |
| **Expected user impact** | Very high |
| **Expected commercial impact** | Very high |

#### Acceptance criteria

- A CTA opened from commercial content cannot silently preselect residential.
- A professional CTA opens a professional enquiry state.
- Project and product CTAs preserve the selected item and source page.
- A neutral contact URL remains possible and does not force an audience classification.
- Context is visible to the visitor at the top of the form and included in the submitted payload.
- Query parameters and hidden fields contain no personal information.
- Existing analytics events continue to fire, with documented source and audience properties added where supported.
- Residential upload instructions and upload controls are consistent. If the endpoint cannot support uploads, the instruction is removed until it can.
- `Roof direction` is replaced by an accurate label such as `Roof approach`.
- Spam-protection fields are excluded from visual, keyboard and screen-reader flows.
- Inactive responsive duplicates are removed from the accessibility tree, with one semantic version preferred.

#### Testing requirements

- Unit tests for route and context-building utilities.
- Integration tests for residential, commercial, professional, project and product entry routes.
- Submission tests for direct contact, preselected contact and context-bearing contact.
- Analytics regression checks without personal information in event properties.
- Keyboard and screen-reader checks for form labels, hidden fields and validation.
- Manual checks at 430 px, 390 px and 360 px.
- Browser Back and refresh behaviour with query parameters.

---

### Phase 2: Homepage mobile refinement

| Item | Definition |
|---|---|
| **Objective** | Reduce the homepage to a calm, project-led sequence that supports understanding, proof, pathway selection and enquiry. |
| **User problem solved** | Visitors encounter too many equally weighted sections, repeated project blocks, repeated education and a final decision tree after a long scroll. |
| **Scope** | Revised section order; removal of the second selected-work block; simplified audience pathways; approximately 40 to 50 percent less initially visible mobile copy; larger project imagery; consolidated process and assurances; compact guide gateway; stronger final enquiry hierarchy; mobile hero copy and crop refinement. |
| **Explicitly out of scope** | Full redesign of every shared card; project-index changes; rewriting all service-page copy; new content-management platform; unrelated desktop rework. |
| **Dependencies** | Phase 1 routing and enquiry context; confirmed homepage content source and responsive component structure. |
| **Likely components or page groups** | Homepage composition, hero, proof strip, featured project, audience pathways, selected projects, form and roof snapshot, process, testimonial, guides, final enquiry and footer. |
| **Recommended number of PRs** | 2 |
| **Implementation risk** | Medium. Content order and deletion are straightforward, but shared components and desktop regression require care. |
| **Expected user impact** | Very high |
| **Expected commercial impact** | High |

#### Acceptance criteria

- The mobile homepage contains no more than eight primary content sections before the footer.
- Only one selected-project section remains.
- Residential and custom do not appear as equal audience choices. Home is the primary residential route; custom conditions are explained within it.
- Commercial and professional routes remain discoverable.
- The first strong project proof appears immediately after the first-screen proposition and proof.
- The process is presented as three concise visible stages, with additional detail disclosed or linked.
- Project-specific assurances are merged into the process or final enquiry.
- The guide area initially exposes only cost, fixed roof versus louvres and an all-guides link.
- The final enquiry contains one primary action and one quieter commercial/professional route.
- The homepage uses one semantic content structure. Mobile concision is achieved through structured summaries and disclosure, not duplicate full sections.
- The hero remains legible and composed at all three target widths.

#### Testing requirements

- Visual regression at 430 px, 390 px, 360 px and representative desktop widths.
- Content-order and heading-hierarchy review.
- CTA destination checks after the section reorder.
- Screen-reader review for disclosed content and hidden responsive states.
- Image crop review on representative devices.
- Performance comparison for initial image payload and layout shift.

---

### Phase 3: Shared mobile UX component system

| Item | Definition |
|---|---|
| **Objective** | Establish reusable responsive rules before migrating multiple page groups. |
| **User problem solved** | Similar content currently risks inconsistent spacing, card density, CTA treatment, image scale and interaction behaviour across pages. |
| **Scope** | Mobile spacing and type behaviour; responsive image ratios and focal points; card hierarchy; CTA hierarchy; semantic accordions; project-fact groups; gallery controls; touch targets; mobile menu behaviour; optional sticky action rules; focus, reduced-motion and hidden-state requirements. |
| **Explicitly out of scope** | A new brand identity, global desktop redesign, replacement of Tailwind, replacement of React components that already meet the contract, automatic migration of every page. |
| **Dependencies** | Phase 2 should identify which homepage patterns are stable enough to generalise. Existing Tailwind configuration and component conventions must be inspected before adding tokens. |
| **Likely components or page groups** | Shared layout primitives, buttons and links, cards, responsive media, accordions, carousels/galleries, menu, fact lists, section headers and sticky action container. |
| **Recommended number of PRs** | 3 |
| **Implementation risk** | Medium to high because shared primitives can create broad regressions. Each primitive should be released separately or behind compatible props. |
| **Expected user impact** | High |
| **Expected commercial impact** | Medium to high through consistency and reduced migration risk. |

#### Acceptance criteria

- Shared mobile components have documented responsive behaviour and examples.
- Primary touch targets are at least 44 by 44 CSS pixels, with sufficient separation from adjacent controls.
- CTA variants have a clear primary, secondary and text-link hierarchy.
- Cards support image-led, balanced and compact variants without page-specific forks.
- Responsive media supports mobile focal point or art-directed source selection.
- Accordions use semantic buttons and expose state correctly.
- Galleries support touch, visible buttons, keyboard operation, screen-reader labels and reduced motion.
- Shared components do not require duplicate mobile and desktop DOM trees.
- Sticky actions are optional, context-aware and do not obscure content or form controls.
- Focus styles remain visible on all interactive states.
- No existing desktop layout is materially changed without explicit scope and review.

#### Testing requirements

- Component-level interaction tests.
- Story or fixture coverage at 430 px, 390 px and 360 px where the repository supports it.
- Keyboard, screen-reader and reduced-motion tests for interactions.
- Visual regression for all component variants.
- Page smoke tests for every shared primitive changed.

---

### Phase 4: Projects experience

| Item | Definition |
|---|---|
| **Objective** | Make projects the primary premium proof and discovery system on mobile. |
| **User problem solved** | The individual project content is strong, but the discovery interface can feel administrative, imagery can be too small and project enquiry context is lost. |
| **Scope** | One-column project index; compact filters and selector; large project cards; mobile gallery controls; concise project facts; brief, constraint and response hierarchy; previous and next navigation; related projects; source-aware enquiry; clear return-to-index behaviour. |
| **Explicitly out of scope** | Re-photographing all projects, changing project URLs, rewriting every case study, desktop portfolio redesign unrelated to shared changes. |
| **Dependencies** | Phase 1 enquiry context; Phase 3 media, card, disclosure and gallery components. |
| **Likely components or page groups** | `/projects`, project-card and filter components, representative project pages, project gallery, facts, related projects, previous/next controls and project CTA. |
| **Recommended number of PRs** | 2 |
| **Implementation risk** | Medium |
| **Expected user impact** | Very high |
| **Expected commercial impact** | High |

#### Acceptance criteria

- The project index leads with large images rather than filters.
- Mobile cards show only the facts needed to choose a project, such as title, location, residential/commercial and roof form.
- Filters are optional, compact and operable without horizontal overflow.
- Project pages keep dimensions, roof approach, year and one concise design response visible.
- Extended specification and narrative use progressive disclosure.
- Gallery position and previous/next controls are visible and accessible.
- Swipe is never the only gallery control.
- Every project page provides a clear all-projects route and predictable browser Back behaviour.
- Project-specific enquiries display and submit the selected project context.
- Related projects remain limited and visually useful.

#### Testing requirements

- Index and filter tests at all target widths.
- Gallery tests with touch, keyboard, screen reader and reduced motion.
- Browser Back tests after filter use and project navigation.
- Query/context submission tests from representative project pages.
- Image performance and layout-shift review.

---

### Phase 5: Residential and custom service pages

| Item | Definition |
|---|---|
| **Objective** | Replace long article-like service journeys with a reusable, concise decision pattern. |
| **User problem solved** | Visitors must read through forms, materials, edges, process, cost, guides, caveats and FAQs before reaching a clear next step. Residential and custom routes overlap. |
| **Scope** | Shared service-page structure; concise visible summary; project proof; suitability; three-stage process; investment drivers; early and final enquiry; progressive disclosure; clearer distinction between a standard residential route and conditions requiring a custom response. |
| **Explicitly out of scope** | Removing useful guide URLs, rewriting every technical guide, changing the fundamental service offering, adding unsupported price promises. |
| **Dependencies** | Phase 1 forms; Phase 3 shared components; Phase 4 project cards and project links. |
| **Likely components or page groups** | `/pergolas-auckland`, `/custom-pergolas-auckland`, service-page shell, service evidence blocks, process, investment drivers, accordions and enquiry modules. |
| **Recommended number of PRs** | 3 |
| **Implementation risk** | Medium |
| **Expected user impact** | Very high |
| **Expected commercial impact** | High |

#### Acceptance criteria

- Both pages use the same service-page shell where content types are equivalent.
- No more than six major content sections appear before the final enquiry.
- Residential explains the broad home pathway without requiring visitors to classify technical complexity.
- Custom explains the conditions that need a more resolved response and demonstrates them through built evidence.
- Each page presents two or three relevant projects before extended technical education.
- Detailed roof, edge, cost, consent and FAQ content is disclosed or linked.
- Repeated requests for suburb, photographs and dimensions appear once near the enquiry.
- An early CTA is available after proof, with the final form or route later in the page.
- Enquiry context identifies residential or custom source without inventing a new audience type if the submission model does not need one.
- Existing semantic guide content remains reachable.

#### Testing requirements

- Content and heading review at all target widths.
- CTA and form-context tests.
- Accordion and keyboard tests.
- Desktop regression where shared service components change.
- Analytics comparison for project engagement, form starts and guide exits.

---

### Phase 6: Product discovery and product pages

| Item | Definition |
|---|---|
| **Objective** | Help visitors compare major options quickly, then understand one option without reading a complete specification manual. |
| **User problem solved** | Product discovery can feel like a catalogue of repetitive cards, while individual pages repeat fit, constraints, proof, specification, options, trade-offs, related products, guides and FAQs at equal weight. |
| **Scope** | Image-led product index; mobile comparison behaviour; compact decision summaries; product-detail pattern; built-project evidence; key constraints; collapsed specifications and FAQs; related options; product-aware enquiry continuity. |
| **Explicitly out of scope** | Turning Sanctuary into an ecommerce catalogue, creating price cards, removing necessary technical content, changing product names solely for mobile. |
| **Dependencies** | Phase 1 enquiry context; Phase 3 media, cards and disclosure; Phase 4 project evidence components. |
| **Likely components or page groups** | `/products`, representative product pages, product cards, comparison modules, specification sections, related options and product CTA. |
| **Recommended number of PRs** | 3 |
| **Implementation risk** | Medium |
| **Expected user impact** | High |
| **Expected commercial impact** | Medium to high |

#### Acceptance criteria

- The index helps visitors distinguish roof form and material approach within the first few screens.
- Comparison controls do not require a wide table or horizontal scrolling at 360 px.
- Each product page visibly answers: what it is, where it fits, what must be resolved, what built project proves it and what action follows.
- Specifications, detailed options and FAQs are available without being initially dominant.
- One built project is more prominent than a collection of small repetitive cards.
- Product CTAs preserve and display product context in the enquiry.
- Related options are limited to genuinely adjacent decisions.
- Technical content remains semantic and crawlable.

#### Testing requirements

- Comparison and card tests at target widths.
- Product CTA context and submission tests.
- Accordion accessibility.
- Heading and internal-link review.
- Representative product-page visual regression before wider migration.

---

### Phase 7: Commercial, professional and guide journeys

| Item | Definition |
|---|---|
| **Objective** | Give secondary audiences clear, credible routes without allowing guide content to dominate conversion journeys. |
| **User problem solved** | Commercial is difficult to discover and was verified to misroute through the global header. Professional capability is fragmented. Guide content repeatedly reopens the research journey. |
| **Scope** | Commercial case-study prominence and concise delivery content; commercial enquiry continuity; professional capability page; professional plan/brief route; guide-hub simplification; reduced guide prominence on homepage, service and product journeys; preservation of semantic content and useful internal links. |
| **Explicitly out of scope** | Deleting the guide library, removing relevant internal links, creating separate mobile content silos, replacing the commercial service proposition. |
| **Dependencies** | Phase 1 routing; Phase 3 components; Phase 4 project patterns; service and product page decisions from Phases 5 and 6. |
| **Likely components or page groups** | Commercial page, mobile menu, professional route/page, guide hub, guide cards, guide-page navigation and guide gateways on conversion pages. |
| **Recommended number of PRs** | 3 |
| **Implementation risk** | Medium |
| **Expected user impact** | High for commercial and professional audiences; medium for the wider audience. |
| **Expected commercial impact** | High |

#### Acceptance criteria

- Commercial cases and operational evidence appear directly after the commercial first screen.
- Every commercial CTA preserves commercial context.
- The professional route has a concise capability page before enquiry.
- Professional content includes role boundaries, documentation, engineering or consultant coordination, representative projects and plan/brief submission.
- The guide hub initially presents chapter structure and guide titles without ten equally heavy descriptions.
- Conversion pages expose no more than two guide links plus an all-guides link.
- Guide URLs, semantic headings and useful internal links remain intact.
- Guide entry and exit behaviour is measured so reduced prominence can be evaluated.

#### Testing requirements

- Commercial and professional CTA routing and form tests.
- Mobile menu discovery tests.
- Guide-hub keyboard and disclosure tests.
- Internal-link and metadata regression checks.
- Analytics validation for commercial, professional and guide routes.

---

### Phase 8: Validation and optimisation

| Item | Definition |
|---|---|
| **Objective** | Confirm that the cumulative rollout works on real devices, remains accessible and improves measurable customer behaviour without performance regression. |
| **User problem solved** | Responsive, interaction and accessibility risks cannot be fully resolved through code inspection or desktop emulation alone. |
| **Scope** | Real-device testing at 430 px, 390 px and 360 px; keyboard and assistive-technology testing; performance checks; analytics validation; conversion monitoring; regression testing; focused post-release refinements. |
| **Explicitly out of scope** | A new redesign based on preference, unrelated feature development, declaring conversion success without sufficient data. |
| **Dependencies** | All prior phases or the subset being released. Baseline analytics and performance data should be captured before major changes where possible. |
| **Likely components or page groups** | Entire primary mobile journey, with priority on header, homepage, projects, service pages, commercial and enquiry. |
| **Recommended number of PRs** | 2, plus later isolated fixes supported by evidence. |
| **Implementation risk** | Low to medium. Most work should be validation and bounded corrections, but late findings may expose shared-component issues. |
| **Expected user impact** | High |
| **Expected commercial impact** | High through reliability and verified optimisation. |

#### Acceptance criteria

- The main journey is manually completed at 430 px, 390 px and 360 px on representative real devices.
- No horizontal overflow, obscured controls or unreadable image crops remain.
- Menu, accordions, galleries and forms pass keyboard and screen-reader checks.
- Reduced-motion behaviour is respected.
- Form validation and success states are announced correctly.
- Core performance metrics are recorded before and after relevant releases.
- Analytics events and context properties are verified in the production analytics environment.
- Release annotations allow pre-change and post-change comparison.
- Post-release refinements are based on observed behaviour, not unverified preference.

#### Testing requirements

- Real-device matrix using iOS Safari and Android Chrome at minimum.
- Keyboard-only journey.
- Screen-reader journey using appropriate platform tools.
- Automated accessibility and regression checks, followed by manual review.
- Production analytics event verification.
- Performance checks on representative mobile network and device conditions.
- Qualitative task testing with residential and professional/commercial participants.

---

## 5. Recommended PR sequence

The sequence below is intentionally granular. A PR may be split further if repository inspection shows that the proposed scope crosses unrelated systems. It should not be expanded to absorb later roadmap work.

### PR 1: Fix enquiry routing and preserve source context

| Field | Definition |
|---|---|
| **Goal** | Ensure every major CTA opens the correct enquiry type and preserves the source page, component, project or product. |
| **Exact scope** | Create or consolidate a central enquiry-link/context utility; correct global-header behaviour on commercial and professional routes; add canonical non-personal context parameters; read, validate and display them on the contact page; include them in the submission payload. |
| **Probable pages or component groups** | Header, CTA/link helpers, contact route, homepage CTAs, commercial, professional entry route, project pages, product pages and form submission mapping. |
| **Dependencies** | None. Inspect the existing routing, form and analytics conventions first. |
| **Acceptance criteria** | Commercial never preselects residential; professional preselects professional; residential routes remain correct; project and product context is visible and submitted; direct `/contact` stays neutral; unsupported parameter values fail safely; no personal information is placed in the URL. |
| **Testing checklist** | Unit tests for context utility; integration tests for each route type; refresh and Back behaviour; query sanitisation; form payload inspection; existing analytics smoke test. |
| **Non-goals** | Form-layout redesign, new fields beyond context, upload changes, homepage restructuring, broad CTA-copy changes. |
| **Effort** | Small to medium |
| **Risk** | Low to medium |

**This is the first recommended implementation PR.**

### PR 2: Align enquiry form contract, terminology and uploads

| Field | Definition |
|---|---|
| **Goal** | Make the enquiry experience consistent regardless of entry page. |
| **Exact scope** | Define one shared field contract; correct `Roof direction`; align required and optional states; ensure photograph/plan instructions match actual upload capability; share supported upload behaviour across relevant residential, commercial and professional forms. |
| **Probable pages or component groups** | Contact page, embedded service forms, commercial form, professional form, shared field and upload components, submission validation. |
| **Dependencies** | PR 1 context contract. |
| **Acceptance criteria** | Labels accurately describe choices; the same field has the same meaning across forms; required fields are visually and semantically clear; upload instructions never appear without a working control; accepted file types and limits match backend enforcement. |
| **Testing checklist** | Valid and invalid submissions; upload success and failure; required-state screen-reader review; mobile keyboard/input types; all target widths. |
| **Non-goals** | Multi-step form redesign, CRM replacement, new pricing or qualification policy. |
| **Effort** | Medium |
| **Risk** | Medium |

### PR 3: Repair enquiry accessibility and analytics continuity

| Field | Definition |
|---|---|
| **Goal** | Remove form-related accessibility defects and document a reliable conversion event schema. |
| **Exact scope** | Hide spam-protection fields from visual and accessibility flows; add accessible error summary and field associations where missing; confirm success-state announcements; remove inactive responsive duplicates from the accessibility tree; preserve existing analytics and add non-personal context properties. |
| **Probable pages or component groups** | Shared form, validation, success state, spam protection, analytics utilities and duplicated responsive sections identified on the homepage. |
| **Dependencies** | PRs 1 and 2. |
| **Acceptance criteria** | Keyboard focus moves predictably on errors and success; errors are announced and associated with fields; honeypot is not focusable or announced; analytics records enquiry type and source without personal information; one semantic version of repeated content is preferred. |
| **Testing checklist** | Keyboard; VoiceOver or equivalent; automated accessibility scan; analytics debug view; duplicate-ID check; failed and successful submission. |
| **Non-goals** | Broader page accessibility remediation, visual restyling, analytics-vendor change. |
| **Effort** | Medium |
| **Risk** | Medium |

### PR 4: Simplify homepage structure and remove repeated content

| Field | Definition |
|---|---|
| **Goal** | Reduce the homepage to the target section sequence without introducing a new visual system. |
| **Exact scope** | Remove the second selected-work section; simplify audience pathways; merge process and assurances; reduce visible copy; move secondary technical detail to existing linked pages or disclosure; establish the eight-section mobile order. |
| **Probable pages or component groups** | Homepage composition and its content configuration. |
| **Dependencies** | Phase 1 complete. |
| **Acceptance criteria** | No more than eight primary sections before footer; one selected-work section; home and commercial/professional routes are clear; no duplicated full mobile/desktop section content; CTA destinations remain correct. |
| **Testing checklist** | Content-order review; heading hierarchy; visual regression at target widths and desktop; link checks; screen-reader order. |
| **Non-goals** | Shared card redesign, project-index changes, new gallery, broad desktop restyling. |
| **Effort** | Medium |
| **Risk** | Medium |

### PR 5: Strengthen homepage imagery and final conversion

| Field | Definition |
|---|---|
| **Goal** | Make the shortened homepage more project-led and give the final enquiry a clear hierarchy. |
| **Exact scope** | Art-direct hero crop; enlarge signature and selected-project imagery; reduce repeated project imagery; consolidate process/review proof; replace the expanded guide block with two links and all-guides; simplify the final enquiry to one primary action. |
| **Probable pages or component groups** | Homepage hero, featured project, project cards, process/review, guide gateway and final enquiry. |
| **Dependencies** | PR 4 and PR 1 routing. |
| **Acceptance criteria** | Pergola structure reads clearly at all target widths; no same image is repeated on the page; project imagery is the dominant visual proof; guide links remain reachable without dominating; final action preserves audience context. |
| **Testing checklist** | Crop review at target widths; image payload and layout shift; CTA tests; contrast review for image text; desktop regression. |
| **Non-goals** | Project-index redesign, global media-component replacement, new photography. |
| **Effort** | Medium |
| **Risk** | Low to medium |

### PR 6: Establish shared mobile layout, type, CTA and card primitives

| Field | Definition |
|---|---|
| **Goal** | Define reusable responsive primitives before page-group migration. |
| **Exact scope** | Add or document mobile section spacing, content-width behaviour, heading and paragraph measures, CTA variants, card variants, fact-list layout and responsive media props using existing Tailwind and React conventions. |
| **Probable pages or component groups** | Shared design tokens or Tailwind configuration, section container, button/link, card, facts and media components. |
| **Dependencies** | Homepage decisions from PRs 4 and 5. |
| **Acceptance criteria** | Components support concise image-led, balanced and compact patterns; primary, secondary and text-link actions are distinct; no page-specific mobile forks are required for common patterns; desktop defaults remain stable. |
| **Testing checklist** | Component fixtures; visual regression across widths; consumer-page smoke tests; focus-state review. |
| **Non-goals** | Brand redesign, full page migration, menu or gallery behaviour. |
| **Effort** | Medium |
| **Risk** | Medium to high |

### PR 7: Establish accessible disclosure and gallery primitives

| Field | Definition |
|---|---|
| **Goal** | Provide one accessible implementation for progressive disclosure and responsive image browsing. |
| **Exact scope** | Shared accordion and gallery contracts; semantic state; visible previous/next controls; progress labelling; keyboard and screen-reader behaviour; reduced motion; no swipe-only action. |
| **Probable pages or component groups** | Accordion, carousel/gallery, project media and any existing disclosure component. |
| **Dependencies** | PR 6 where shared spacing and controls are used. |
| **Acceptance criteria** | Controls meet target size; state is announced; focus remains predictable; galleries work without swipe; motion is reduced when requested; inactive content is not duplicated in the accessibility tree. |
| **Testing checklist** | Component tests; keyboard; screen reader; reduced-motion setting; touch; 360 px overflow. |
| **Non-goals** | Project-page migration, menu work, content editing. |
| **Effort** | Medium |
| **Risk** | Medium |

### PR 8: Refine mobile navigation and contextual sticky action

| Field | Definition |
|---|---|
| **Goal** | Make audience and portfolio routes easy to reach while keeping any persistent action calm and context-aware. |
| **Exact scope** | Rename or clarify product discovery label; expose Projects, Home, Commercial and Architects/designers/builders in the menu; verify focus and scroll lock; add a sticky action only if it meets the roadmap rules and does not obscure content. |
| **Probable pages or component groups** | Global header, mobile menu, route configuration and optional sticky-action component. |
| **Dependencies** | PR 1 routing; PRs 6 and 7 control patterns. |
| **Acceptance criteria** | Menu opens with correct focus, traps focus where appropriate, closes predictably and returns focus; primary destinations are clear; sticky action reflects current context and does not cover controls or content. |
| **Testing checklist** | Keyboard and screen reader; touch at target widths; viewport-height variation; scroll and Back behaviour; route checks. |
| **Non-goals** | Desktop navigation redesign, new information architecture beyond listed routes, promotional banners. |
| **Effort** | Medium |
| **Risk** | Medium |

### PR 9: Redesign the mobile project index and filters

| Field | Definition |
|---|---|
| **Goal** | Make project discovery feel like a premium architectural portfolio. |
| **Exact scope** | One-column large-image project cards; concise metadata; compact optional filters; clear filter reset; stable URL or state behaviour; remove administrative selector dominance. |
| **Probable pages or component groups** | `/projects`, project index, project card, filters/selector and route-state handling. |
| **Dependencies** | PR 6 cards/media; PR 7 controls. |
| **Acceptance criteria** | Images lead; filters fit at 360 px without horizontal overflow; all projects remain discoverable; filter state is understandable; cards expose only selection-relevant facts. |
| **Testing checklist** | Filter combinations; empty state; Back/refresh; target widths; keyboard; image performance. |
| **Non-goals** | Project-detail rewrite, new project taxonomy, desktop portfolio redesign unrelated to shared cards. |
| **Effort** | Medium |
| **Risk** | Medium |

### PR 10: Refine project detail hierarchy, gallery and enquiry

| Field | Definition |
|---|---|
| **Goal** | Make representative project pages the strongest proof and preserve project context into enquiry. |
| **Exact scope** | Larger hero/gallery; visible core facts; concise brief/constraint/response; collapsed detailed specification; accessible gallery; related projects; previous/next and all-projects routes; context-aware CTA. |
| **Probable pages or component groups** | Project-page template, facts, narrative, gallery, related projects, previous/next controls and CTA. |
| **Dependencies** | PRs 1, 7 and 9. |
| **Acceptance criteria** | Core facts and design response are visible; extended detail is optional; gallery is fully operable; return routes are clear; the enquiry displays the selected project. |
| **Testing checklist** | Representative project pages; gallery interactions; route continuity; screen reader; target widths; image payload. |
| **Non-goals** | Rewriting all project copy, new photography, product-page changes. |
| **Effort** | Medium to large |
| **Risk** | Medium |

### PR 11: Create the reusable mobile service-page pattern

| Field | Definition |
|---|---|
| **Goal** | Establish one concise service-page composition before migrating residential and custom content. |
| **Exact scope** | Service hero, fit summary, project proof, principles/constraints, three-stage process, investment drivers, guide gateway and enquiry placement; disclosure rules; content-field mapping. |
| **Probable pages or component groups** | New or refactored service-page shell and shared service sections. |
| **Dependencies** | PRs 6, 7 and 10. |
| **Acceptance criteria** | Pattern supports no more than six major sections before enquiry; visible and disclosed content roles are explicit; project proof appears early; one content source supports responsive layout. |
| **Testing checklist** | Fixture page at target widths and desktop; heading order; disclosure; CTA routing; content-model compatibility. |
| **Non-goals** | Migrating live service pages in the same PR, deleting guide content, adding new service claims. |
| **Effort** | Medium |
| **Risk** | Medium |

### PR 12: Migrate the residential service page

| Field | Definition |
|---|---|
| **Goal** | Turn `/pergolas-auckland` into a concise residential decision journey. |
| **Exact scope** | Apply the service pattern; reduce repeated forms/materials/edges/process/cost text; retain two or three projects; place technical detail in disclosure or linked guides; provide early and final enquiry routes. |
| **Probable pages or component groups** | Residential service page and content configuration. |
| **Dependencies** | PR 11; Phase 1 forms. |
| **Acceptance criteria** | The page answers fit, proof, process and investment drivers before enquiry; repeated input instructions appear once; no more than six major sections precede the final enquiry; existing useful guides remain linked. |
| **Testing checklist** | Content review; target widths; CTA/form context; accordions; internal links; desktop regression. |
| **Non-goals** | Custom page, product pages, rewriting guide articles. |
| **Effort** | Medium |
| **Risk** | Low to medium |

### PR 13: Migrate the custom service page

| Field | Definition |
|---|---|
| **Goal** | Distinguish complex custom conditions through evidence rather than another long general service page. |
| **Exact scope** | Apply the service pattern; foreground junctions, levels, restricted supports, drainage or architectural constraints; retain three relevant projects; shorten repeated service education; preserve custom source context in enquiry. |
| **Probable pages or component groups** | Custom service page and content configuration. |
| **Dependencies** | PR 11 and project pattern. |
| **Acceptance criteria** | Visitors can understand why the custom route exists without self-diagnosing before entry; built evidence supports each major condition; duplicated residential content is removed or linked. |
| **Testing checklist** | Content comparison against residential; target widths; enquiry context; accordions; project links. |
| **Non-goals** | New engineering claims, full professional capability page, product migration. |
| **Effort** | Medium |
| **Risk** | Low to medium |

### PR 14: Refine product index and mobile comparison

| Field | Definition |
|---|---|
| **Goal** | Help visitors compare major forms and roof approaches without a repetitive card catalogue or wide table. |
| **Exact scope** | Image-led index; concise category explanation; mobile comparison cards or stacked rows; integrated options reduced to a secondary gateway; clear links to built evidence. |
| **Probable pages or component groups** | `/products`, product cards and comparison component. |
| **Dependencies** | PR 6 shared cards/media. |
| **Acceptance criteria** | Major options are distinguishable within the first few screens; no horizontal comparison table is required; card copy stays concise; accessories do not compete with primary roof decisions. |
| **Testing checklist** | 360 px layout; keyboard and touch; link checks; desktop regression; image performance. |
| **Non-goals** | Individual product-page migration, pricing, ecommerce behaviour. |
| **Effort** | Medium |
| **Risk** | Medium |

### PR 15: Create the reusable product-detail pattern

| Field | Definition |
|---|---|
| **Goal** | Define a consistent concise structure for individual product pages. |
| **Exact scope** | Outcome and fit summary; major constraints; one built project; key trade-offs; collapsed specification/FAQ; limited related options; product-aware CTA. |
| **Probable pages or component groups** | Product-page template, specification, related options, project evidence and CTA. |
| **Dependencies** | PRs 1, 6, 7 and 10. |
| **Acceptance criteria** | The first layer answers what, fit, constraints, proof and next action; secondary technical content is available but not dominant; context is preserved into enquiry. |
| **Testing checklist** | Fixture product; heading hierarchy; accordion; CTA context; target widths; desktop regression. |
| **Non-goals** | Migrating all product content, changing product taxonomy or claims. |
| **Effort** | Medium |
| **Risk** | Medium |

### PR 16: Migrate product pages to the shared pattern

| Field | Definition |
|---|---|
| **Goal** | Apply the approved product pattern consistently without one oversized content rewrite. |
| **Exact scope** | Migrate product pages in logical batches. Recommended batch one: core roof forms and roofing approaches. Recommended batch two: integrated blinds, lighting, heating and adjacent options. |
| **Probable pages or component groups** | Existing product routes and content entries. |
| **Dependencies** | PR 15. |
| **Acceptance criteria** | Every migrated page meets the same visible-content, disclosure, proof and CTA rules; no page-specific fork is introduced without documented need. |
| **Testing checklist** | Representative page per batch; link and context checks; content parity; target widths; desktop regression. |
| **Non-goals** | New products, broad copywriting campaign, guide-hub changes. |
| **Effort** | Large overall, but should be delivered as two or more medium PRs |
| **Risk** | Medium |

### PR 17: Refine the commercial journey

| Field | Definition |
|---|---|
| **Goal** | Make commercial credibility and brief submission visible early. |
| **Exact scope** | Place commercial case evidence directly after the hero; shorten operational explanations; consolidate responsibility/process content; provide an early `Share a commercial brief` action; retain commercial context through submission. |
| **Probable pages or component groups** | Commercial page, case-study cards, process/responsibility block and commercial form entry. |
| **Dependencies** | Phase 1; PRs 6, 7 and 10. |
| **Acceptance criteria** | Commercial visitors see relevant cases and delivery capability before long text; all CTAs stay commercial; detailed FAQs are disclosed; the form can accept supported plans/files. |
| **Testing checklist** | Commercial route checks; target widths; form context/upload; accordion; heading order; desktop regression. |
| **Non-goals** | Professional page, new commercial service claims, CRM workflow changes. |
| **Effort** | Medium |
| **Risk** | Medium |

### PR 18: Create the professional capability journey

| Field | Definition |
|---|---|
| **Goal** | Give architects, designers and builders concise evidence before asking for a brief. |
| **Exact scope** | New or repurposed capability page using existing content: collaboration model, drawings/specifications, consultant and engineering interfaces, responsibilities, three projects and plan/brief CTA. |
| **Probable pages or component groups** | Professional route/page, navigation entry, project cards and professional enquiry. |
| **Dependencies** | Phase 1; shared service/project components. |
| **Acceptance criteria** | Professional route is discoverable; capability evidence is visible; no unsupported service claim is introduced; plan/brief context and files carry into submission. |
| **Testing checklist** | Navigation; target widths; CTA and upload; heading hierarchy; internal links; screen reader. |
| **Non-goals** | Separate professional microsite, new document portal, commercial-page rewrite. |
| **Effort** | Medium |
| **Risk** | Low to medium |

### PR 19: Simplify guide hub and reduce guide prominence

| Field | Definition |
|---|---|
| **Goal** | Preserve educational value while preventing guide content from dominating high-intent mobile journeys. |
| **Exact scope** | Guide hub with chapter summaries and concise titles; descriptions disclosed where useful; conversion pages limited to cost, fixed-roof comparison and all-guides link; preserve semantic content and internal links. |
| **Probable pages or component groups** | Guide hub, guide cards, homepage/service/product guide gateways and guide navigation. |
| **Dependencies** | Homepage and page-group migrations should be stable. |
| **Acceptance criteria** | All guides remain reachable; high-intent pages show no more than two direct guide links plus all-guides; no large guide card grid appears immediately before a primary conversion action. |
| **Testing checklist** | Internal-link crawl; heading hierarchy; disclosure accessibility; analytics event checks; target widths. |
| **Non-goals** | Deleting guides, rewriting all articles, making SEO claims without measurement. |
| **Effort** | Medium |
| **Risk** | Medium |

### PR 20: Complete real-device and assistive-technology validation

| Field | Definition |
|---|---|
| **Goal** | Resolve issues that cannot be verified through code inspection or emulation. |
| **Exact scope** | Test the primary journey on representative iOS and Android devices at or near 430 px, 390 px and 360 px; keyboard and screen-reader testing; fix bounded issues in navigation, focus, overflow, gallery, disclosure and forms. |
| **Probable pages or component groups** | Header, homepage, projects, service pages, commercial, guides and contact. |
| **Dependencies** | Relevant implementation phases complete. |
| **Acceptance criteria** | No horizontal overflow; no obscured controls; predictable focus; usable galleries without swipe; accessible validation and success; reduced motion respected. |
| **Testing checklist** | Documented device matrix; task scripts; issue log; before/after evidence; automated scan plus manual confirmation. |
| **Non-goals** | New visual direction, major copy changes, unrelated features. |
| **Effort** | Medium |
| **Risk** | Low to medium |

### PR 21: Validate analytics, performance and post-release outcomes

| Field | Definition |
|---|---|
| **Goal** | Confirm data quality, record performance and create an evidence-based optimisation backlog. |
| **Exact scope** | Production event verification; baseline and post-release comparison; Core Web Vitals and image payload review; release annotations; qualified-enquiry linkage where available; bounded performance fixes; documented findings. |
| **Probable pages or component groups** | Analytics utilities, image loading, route events and measurement documentation. |
| **Dependencies** | Major phases released and sufficient baseline instrumentation available. |
| **Acceptance criteria** | Events can be reconciled with form submissions; no personal information enters analytics; performance regressions are identified and corrected; future refinements are tied to observed behaviour. |
| **Testing checklist** | Production analytics debug; submission reconciliation; performance lab and field data review; route segmentation; release annotation. |
| **Non-goals** | New analytics vendor, unsupported causal claims, broad redesign based on early data. |
| **Effort** | Small to medium |
| **Risk** | Low |

---

## 6. Homepage target structure

The target homepage uses one semantic sequence. Desktop may arrange the same components differently through grid, spacing and image layout. Mobile may use concise summaries, alternative crops, card stacking, accordions and control placement. It must not receive a duplicate page body.

| Order | Section | Purpose | Required content | Remove or relocate | Visual treatment | CTA behaviour | Mobile-specific considerations | Relationship to desktop |
|---:|---|---|---|---|---|---|---|---|
| **1** | Header and navigation | Provide clear access to portfolio, audience routes and enquiry. | Logo; Projects; Home; Pergola options; Commercial; Architects/designers/builders; neutral or contextual start action. | Ambiguous catalogue language; hard-coded residential action on non-residential pages. | Compact header with calm menu trigger and no crowded secondary actions. | Header action reflects page context or stays neutral. | Test target size, focus, scroll lock and viewport-height constraints. | Same route configuration and menu content, with responsive presentation. |
| **2** | Hero and immediate proof | Establish category, premium positioning, place and next step. | Bespoke fixed-roof pergolas; Auckland; one strong project image; review rating; design and installation responsibility; one primary CTA; projects link. | Detailed list of what to submit; extra explanatory sentences; equal-weight button pair. | Image-led first screen with mobile art direction and restrained overlay or adjacent copy. | One primary `Start your project`; one text-style `View projects`. | Preserve ridge, roof edge and relationship to the house. Keep first action visible without an excessively tall text stack. | Same semantic proposition and proof. Desktop may use wider composition. |
| **3** | Signature project | Prove design quality immediately. | Large image; location/title; dimensions or area; material/roof approach; one constraint and response; project link. | Long brief, complete specification and multiple CTAs. | Near-full-width exterior first, followed by optional interior/detail image. | `View project` is primary for the section. Enquiry remains secondary or follows project view. | Keep facts to three or four short items. | Same project and facts. Desktop may display more narrative beside the image. |
| **4** | Audience pathways | Help visitors choose by audience, not technical diagnosis. | Home; Commercial; Architects/designers/builders. A short note that complex conditions are resolved within the relevant route. | Equal residential/custom route cards; lengthy pathway introductions; four decorative images. | Text-led but concise, using two primary groups and a professional link. | Each route is a clear link with preserved audience context where it leads to enquiry. | Avoid a tall grid of similar cards. | Same routes and labels. Desktop may arrange as columns. |
| **5** | Selected projects | Provide variety and encourage portfolio exploration. | Three projects showing residential, contemporary/custom and commercial variety; concise metadata; all-projects link. | Second selected-work block; repeated lead image; long card descriptions. | One large card per row or controlled horizontal sequence with visible next control. | Card opens project; all-projects link follows the set. | Same image should not recur elsewhere on the homepage. | Same project set. Desktop may display multiple columns. |
| **6** | Pergola decision snapshot | Explain only the major design decisions. | Four forms or silhouettes; three roof/material approaches; one sentence about integrated options. | Full product-card stacks; detailed technical descriptions; separate full integrated-options section. | Compact visual selector or stacked comparison. Diagrams may replace repetitive photos. | `Explore pergola options` leads to Products. | No horizontal table at 360 px. Detail remains on product pages. | Same structured data. Desktop may show a broader comparison. |
| **7** | Process and client proof | Reduce risk and explain responsibility. | Three visible stages; written scope before work; one-team design and installation; review rating; one concise review. | Five full steps; separate assurances block; three full reviews; repeated warranty caveats. | Balanced proof block with concise stages and optional detail. | `How the process works` may disclose detail; no competing enquiry button if the final enquiry follows immediately. | Accordion detail must be semantic. | Same process content. Desktop may keep more stages visible if still concise. |
| **8** | Final enquiry and compact guide gateway | Give one confident next step while supporting unresolved research. | Primary project-start action; commercial/professional alternative; three useful inputs; cost guide; fixed roof versus louvres; all-guides link; clear next-step expectation. | Four equivalent CTAs; repeated instructions; expanded guide cards; unsupported response promise. | Calm final panel with one dominant action and quieter links. | Context-aware primary CTA. Secondary audience route is visually subordinate. | Make required and optional input expectations explicit before the tap. | Same enquiry and guide links. Desktop may place links beside the action. |
| **9** | Footer | Confirm legitimacy and provide utility. | Auckland address; phone; email; review proof; core routes; social link; legal links. | Repeated full site navigation and oversized link groups. | Compact utility footer with tap-to-call and email. | Direct contact remains available without competing with primary page CTA. | Targets must remain separated and readable. | Same content, responsive grouping. |

---

## 7. Reusable page patterns

### 7.1 Service pages

**Recommended order**

1. Service hero and concise fit statement  
2. Two or three completed projects  
3. Three design principles or site conditions  
4. Three-stage process and responsibility  
5. Investment drivers and relevant guide links  
6. Enquiry  

**Remain visible**

- Service outcome and audience
- Auckland scope
- Two or three project examples
- Main suitability conditions
- Three-stage process
- Written-scope and one-team responsibility
- High-level investment drivers
- Primary enquiry action

**Use accordions or linked pages**

- Detailed roof and material explanations
- Edge conditions
- Engineering and consent detail
- Full cost checklist
- Extended programme and warranty language
- FAQs
- Repeated technical caveats

**Image placement**

- One strong service hero
- Project proof before extended explanation
- One diagnostic detail image only where it communicates a condition better than copy

**CTA placement**

- First CTA after initial project proof
- Final enquiry after no more than six major sections
- Guide links remain secondary

**Proof requirement**

- At least two relevant built projects with dimensions, material or roof approach and one design response

**Maximum major sections before enquiry**

- **6**

### 7.2 Product pages

**Recommended order**

1. Product hero and decision summary  
2. Where it fits and what must be resolved  
3. One built project  
4. Key trade-offs or options  
5. Technical detail and FAQ disclosure  
6. Product-aware enquiry  

**Remain visible**

- Product name in plain language
- Visual form or material
- Suitable conditions
- Most important constraint
- One built example
- Main trade-off
- CTA

**Use accordions or linked pages**

- Full specifications
- Secondary options
- Detailed material variants
- Repeated installation explanations
- FAQs
- Related guide content

**Image placement**

- Full geometry first
- Built project second
- Material/junction detail only where useful
- Diagram where fall, ridge or interface is difficult to understand photographically

**CTA placement**

- One CTA after built proof
- Final CTA after technical disclosure
- Both preserve product context

**Proof requirement**

- One project that clearly demonstrates the product in use

**Maximum major sections before enquiry**

- **5**, excluding the hero

### 7.3 Project pages

**Recommended order**

1. Project hero and concise facts  
2. Brief, constraint and response  
3. Gallery  
4. Technical detail disclosure  
5. Related projects and previous/next  
6. Project-aware enquiry  

**Remain visible**

- Project name and location
- Residential or commercial
- Dimensions or covered area
- Roof form or approach
- Completion year
- One concise constraint and response
- Large imagery
- All-projects route

**Use accordions**

- Complete material specification
- Engineering detail
- Extended narrative
- Secondary construction facts

**Image placement**

- Large exterior or whole-form hero
- Gallery sequence: exterior, interior, relationship to house/site, material/detail
- Do not place several paragraphs between every image

**CTA placement**

- One contextual CTA after core proof or gallery
- Related projects and previous/next remain browsing actions, not equal conversion buttons

**Proof requirement**

- The page itself is the proof. Facts and imagery must remain specific.

**Maximum major sections before enquiry**

- **5**, excluding navigation

### 7.4 Commercial pages

**Recommended order**

1. Commercial proposition and brief action  
2. Three or four commercial cases  
3. Operational fit and design response  
4. Roles, responsibilities and consultant coordination  
5. Three-stage delivery process  
6. Commercial enquiry  

**Remain visible**

- Commercial audience and project types
- Operational continuity and circulation considerations
- Relevant cases
- Design and installation responsibility
- Documentation or consultant coordination
- Brief-submission action

**Use accordions**

- Detailed risk examples
- Handover documentation
- Extended programme notes
- FAQs
- Full technical scope boundaries

**Image placement**

- Occupied commercial use and circulation
- Evening lighting or hospitality use where relevant
- One detail that demonstrates robustness or integration

**CTA placement**

- Early `Share a commercial brief`
- Final commercial form or route
- Never use a residential preselection

**Proof requirement**

- At least three commercial cases with useful differences in setting or operation

**Maximum major sections before enquiry**

- **6**

### 7.5 Guide pages and guide hub

**Recommended guide hub order**

1. Concise purpose  
2. Three chapter groups  
3. Guide titles, with descriptions disclosed or kept brief  
4. One relevant project or service route  
5. Quiet enquiry link  

**Recommended guide-page order**

1. Question and concise answer  
2. Main guidance  
3. Relevant project or product evidence  
4. Related guide links  
5. Enquiry or service route  

**Remain visible**

- Clear question or topic
- Concise answer
- Chapter or guide title
- Relevant route to projects, products or enquiry

**Use accordions**

- Extended examples
- Technical caveats
- Definitions
- Secondary FAQs

**Image placement**

- Only where the image explains a decision
- Prefer diagrams for roof comparison, fall or interface
- Avoid generic decorative project images inserted only to break text

**CTA placement**

- Secondary to the guide's answer
- Contextual to the subject
- Do not place a large guide grid after the CTA

**Proof requirement**

- Link guidance to a built project or clearly named service/product where relevant

**Maximum major sections before enquiry**

- **4** on individual guides
- The hub may contain all chapters but should not expose every full description initially

### 7.6 Enquiry pages

**Recommended order**

1. Context and what happens next  
2. Required first-layer fields  
3. Optional project detail disclosure  
4. Files, privacy and submit  
5. Accessible success state  

**Remain visible**

- Enquiry type
- Source project or product where present
- Required versus optional explanation
- Name
- One valid contact route, according to business requirements
- Site location or suburb
- Desired outcome or brief
- Privacy statement
- Submit action
- Next-step expectation

**Use progressive disclosure**

- Dimensions
- Roof form preference
- Material preference
- integrated options
- timing
- access or constraints
- additional stakeholders
- plans and images where not immediately necessary

**Image placement**

- No decorative image is required
- A small selected-project thumbnail may be shown when it confirms preserved context

**CTA placement**

- One submit action
- Direct phone or email as a secondary alternative
- No guide grid inside the form flow

**Proof requirement**

- Review rating or one-team responsibility may appear near the form, but should not extend the page materially

**Maximum major sections before submit**

- **3**, excluding success state

---

## 8. Copy-reduction rules

### 8.1 First-layer content limits

These are editing guardrails, not rigid truncation rules. Exceptions require a clear decision or trust reason.

| Content type | Target mobile first-layer length |
|---|---:|
| Hero support copy | 20 to 45 words |
| Section introduction | 30 to 60 words |
| Standard paragraph | 35 to 75 words, normally no more than three sentences |
| Project-card description | 20 to 40 words |
| Product-card description | 20 to 40 words |
| Audience-pathway description | 15 to 30 words |
| Accordion summary | 15 to 35 words |
| CTA label | Usually 2 to 5 words |
| Heading | Prefer 2 to 7 words; avoid sentence-length headings unless the sentence itself is the key answer |
| Technical caveat | One concise visible sentence, with detail disclosed or linked |

### 8.2 What must remain visible

- Bespoke fixed-roof positioning
- Auckland design and installation
- One-team responsibility
- Review proof
- Strong completed-project evidence
- Main suitability conditions
- Three-stage process
- Written scope before work
- High-level investment drivers
- Project-specific limitations that prevent a false expectation
- Required and optional form states
- What happens after enquiry
- Direct phone and email

### 8.3 What should be shortened

- Hero submission instructions
- Section introductions that preview every card
- Project narratives repeated on listing pages
- Repeated statements about architecture-first design
- Product definitions followed by separate fit, benefit and outcome paragraphs
- Process steps that each contain several explanatory sentences
- Review blocks containing full long testimonials
- Commercial operational explanations that repeat across case studies
- Guide-card descriptions

### 8.4 What should move to linked pages

- Full roof-material comparisons
- Detailed cost checklists
- Consent and engineering education
- Extended warranty terms
- Complete technical specifications
- Full project narratives where a summary already links to a project page
- Comprehensive guide descriptions
- Secondary integrated-option explanations
- General educational content that does not change the current page decision

### 8.5 What belongs in accordions

- Detailed project specifications
- Technical constraints and caveats
- Secondary process stages or stage detail
- FAQs
- Full material and interface explanations
- Handover and documentation detail
- Optional form questions
- Extended guide descriptions
- Less common edge cases

### 8.6 Content that should appear only once per page

- Request for suburb, photographs and rough dimensions
- Site-specific disclaimer
- Design and installation responsibility
- Written-scope assurance
- Programme qualification
- Warranty qualification
- Full process
- Review rating
- Guide gateway
- Final enquiry instructions

### 8.7 Targeted examples from the current experience

| Current pattern | Roadmap treatment |
|---|---|
| Hero includes proposition, two CTAs, proof and detailed submission instructions. | Keep proposition, proof, one primary CTA and a projects link. Move submission detail to the enquiry entry. |
| Featured project includes a full paragraph, facts, constraint, response and multiple actions. | Keep large image, three facts, one concise response and one project link. |
| Residential and custom appear as separate equal pathways. | Use Home as the audience route. Explain custom conditions within the home journey and preserve a direct custom route where useful. |
| Forms, roof materials and integrated options each receive a full homepage section. | Combine them into one decision snapshot and link to Products. |
| Selected projects appear twice. | Keep one varied project set. |
| Process and project-specific assurances are separate. | Merge them into three visible stages plus concise assurance detail. |
| Three guide cards appear before the final conversion. | Keep cost, fixed roof versus louvres and all-guides as compact links. |
| Service pages repeat instructions to provide suburb, dimensions and photographs. | State these once immediately before the form. |
| Product pages repeat definition, fit, specification, trade-offs, related decisions and FAQ at equal weight. | Keep fit, constraints, built proof and main trade-off visible. Disclose the rest. |
| Commercial content repeats responsibility and operational risk across several sections. | Consolidate the responsibility model and use cases to demonstrate the rest. |

### 8.8 Editing rules for technical caveats

- Keep a caveat visible when hiding it could create a false expectation about suitability, cost, consent, programme or warranty.
- State the practical consequence first.
- Avoid repeating `site-specific` in multiple sections.
- Put detailed conditions behind a clearly named disclosure such as `Engineering and consent detail`.
- Do not use caveats as a substitute for a clear next-step assessment.
- Do not promise a price range, consent outcome or programme until supported by the brief and current business operations.

### 8.9 Enquiry instruction rules

- State useful first inputs once.
- Separate required from optional.
- Do not ask visitors to choose technical details they may not understand.
- Use plain labels such as `Roof approach`, not ambiguous terminology.
- Explain what Sanctuary will do with the information.
- State response expectations only when operationally supportable.
- Avoid repeated low-pressure reassurance around every CTA. One clear statement near the form is sufficient.

---

## 9. Image and media rules

### 9.1 Mobile hero requirements

- The pergola must read as a structure within one glance.
- Preserve at least two of the following: roof apex or fall, outer roof edge, support line, relationship to the house, open edge or occupied exterior context.
- Avoid a crop that shows only ceiling lining, lighting or furniture and could be mistaken for an interior room.
- Keep the focal subject clear behind or beside any text.
- Use Next.js image handling and the existing media pipeline. Add focal-point or mobile-source fields only where the current content model cannot produce a reliable crop.
- The first image should be sized for its rendered container, not downloaded at an unnecessarily large desktop dimension.
- The hero should contribute to first-screen impact without pushing the primary action below an excessive text stack.

### 9.2 Preferred mobile aspect ratios

| Use | Preferred treatment |
|---|---|
| Homepage or service hero | Approximately 4:5, 5:6 or an art-directed crop based on the composition |
| Project listing card | 4:5 preferred for a strong architectural card |
| Signature project feature | 4:5 or 3:4 on narrow screens, with complete roof geometry retained |
| Project-page hero | 4:3, 3:2 or a composition-specific crop with near-full-width presentation |
| Gallery image | Preserve useful source ratio where possible; avoid forcing every image into one crop if detail is lost |
| Material/detail image | 1:1 or 4:3 where the junction remains legible |
| Diagrams | Use the ratio needed for labels and geometry, with no horizontal overflow |

Aspect ratio is subordinate to architectural legibility. Do not crop a roof form merely to satisfy a component ratio.

### 9.3 Project-card image scale

- Use one large card per row at 360 px and 390 px unless a controlled carousel clearly previews the next item.
- Image area should dominate card copy.
- Keep metadata to the minimum needed to choose.
- Avoid three-column desktop card logic compressed into narrow cards.
- Do not use tiny thumbnails for the primary portfolio route.

### 9.4 Crop rules

- Store or expose focal point where supported.
- Review every hero and signature card at all three target widths.
- Use `object-position` or art-directed sources rather than accepting centre crop by default.
- Preserve building junctions and roof edges because they communicate design quality.
- Avoid cropping all support posts if support resolution is part of the story.
- Do not overlay important text on visually complex material detail.

### 9.5 Gallery behaviour

- Swipe may be supported but must not be the only control.
- Provide visible previous and next controls with at least 44 by 44 CSS pixel targets.
- Expose current position and total image count.
- Provide concise accessible names that include the project and image purpose where useful.
- Preserve focus when the image changes.
- Respect reduced motion.
- Do not autoplay.
- Keep captions concise and only where they add evidence.
- Lazy-load images that are not initially visible while avoiding layout shift.

### 9.6 Material-detail imagery

Use detail imagery where it shows:

- roof-to-house junction
- acrylic or solid-roof transition
- ridge, fall or perimeter treatment
- gutter, flashing or drainage integration
- timber lining and finish
- blind integration
- lighting or heating integration
- restricted support condition

Do not add close-up images that lack scale, context or a clear design point.

### 9.7 When diagrams are better than photographs

Prefer a simple diagram or annotated section for:

- comparing roof forms
- showing roof fall or ridge
- explaining a box perimeter
- showing daylight or weather direction
- identifying a junction or drainage path
- illustrating blind or service integration
- explaining a constrained support position

Diagrams should be visually restrained, use the existing brand system and have text alternatives or adjacent explanations.

### 9.8 Image repetition limits

- Do not repeat the same image on one page.
- On the homepage, a project should normally appear once. A signature project may appear in the hero and featured section only if different images serve different purposes.
- Avoid using the same three projects across homepage, service and product intros when other suitable evidence exists.
- A project card and its related-project appearance should not use the same crop within the same page.
- Track repeated source-image usage in content review, not only component review.

### 9.9 Where no new imagery is needed

No additional imagery is required for:

- process steps
- assurances
- guide gateway
- enquiry instructions
- form fields
- privacy
- footer
- most FAQs

These areas need hierarchy, concision and disclosure rather than decoration.

### 9.10 Image accessibility

- Informative images require concise alternatives describing the architectural evidence, not marketing language.
- Decorative images use empty alternatives.
- Gallery controls must announce purpose and state.
- Do not repeat a long caption verbatim in the alternative text.
- Diagrams need equivalent text explaining the same decision.
- Avoid placing essential text inside images.
- Ensure text over images meets contrast requirements across responsive crops.

---

## 10. Conversion and form requirements

### 10.1 Issues to correct before broader visual work

**Verified**

- The global header CTA routes to a residential enquiry from the commercial page.
- Product CTAs do not visibly preserve the selected product.
- Project CTAs do not visibly preserve the selected project.
- Residential instructions request photographs while the parsed primary residential form did not expose a corresponding upload field.
- `Roof direction` labels material or roof-approach choices inaccurately.
- Form depth and required fields vary by entry route.
- A `Website` spam-protection field appears in parsed form content and must be confirmed hidden from users and assistive technology.
- Process and testimonial content appeared twice in the parsed homepage structure and must be checked for inactive responsive duplication.

**Inferred**

- `Estimate` wording may create an expectation of immediate pricing that the subsequent process cannot always meet.
- Long optional design fields may look like required homework.
- Multiple equal-weight CTA choices may reduce confidence about the intended next step.

**Test required**

- Error announcement, focus movement, success state, file-error handling and Back behaviour.
- Whether hidden responsive variants remain in the accessibility tree in the rendered application.

### 10.2 CTA hierarchy

| Level | Use | Visual rule | Examples |
|---|---|---|---|
| **Primary** | The one intended next action for the section or page | Highest contrast and emphasis; normally one per section | `Start your project`, `Share a commercial brief`, `Send plans or a brief` |
| **Secondary** | A credible alternative route | Lower emphasis, outline or restrained treatment | `View projects`, `Explore pergola options` |
| **Text link** | Supporting research or navigation | No button weight unless required for target size | `Read the cost guide`, `All planning guides`, `All projects` |

Rules:

- Do not display two primary buttons in one section.
- Do not use a sticky CTA before the visitor has seen enough proof unless the page is already high intent.
- CTA labels should describe the action, not imply an unsupported outcome.
- Prefer `Start your project` or `Request an initial assessment` over `Get an estimate` unless an estimate is genuinely the immediate deliverable.
- Project and product CTAs should acknowledge context, such as `Discuss a project like this` or `Ask about this pergola option`, while the form displays the exact selected item.

### 10.3 Destination continuity

Create a single route-building and parsing contract. The implementation may use query parameters, route state or an equivalent existing pattern, but it must survive refresh and be included in submission.

Recommended non-personal context fields:

- `enquiry_type`: `residential`, `commercial`, `professional` or unset
- `source_path`
- `source_component`: for example `header`, `hero`, `project_cta`, `product_cta`, `final_cta`
- `source_project`: canonical project slug or ID
- `source_product`: canonical product slug or ID
- `entry_path` or existing landing-page property where supported
- campaign parameters only through the existing analytics convention

Requirements:

- Validate values against known types or slugs.
- Do not place names, phone numbers, email addresses, messages or uploaded-file information in URLs or analytics.
- Display recognised project or product context above the form.
- Ignore unknown context values safely.
- Preserve browser Back behaviour.
- Use one utility or component contract rather than hand-built query strings across pages.

### 10.4 Audience preservation

- Commercial source content must preselect commercial.
- Professional source content must preselect professional.
- Residential source content may preselect residential.
- Direct `/contact` may remain neutral.
- A project page should inherit residential or commercial type from project metadata where reliable. If metadata is ambiguous, show the project context and let the visitor choose the audience type.
- Product pages normally default to residential only if the product is explicitly residential. Otherwise retain product context and use a neutral type selection.
- Context should be editable by the visitor.

### 10.5 Required versus optional questions

The form should begin with the smallest set needed for a useful response. Final operational requirements must be confirmed with Sanctuary before changing validation.

**Recommended residential first layer**

- Name
- At least one valid contact method
- Suburb or site location
- Desired outcome or short project brief

**Recommended commercial first layer**

- Name
- Organisation
- At least one valid contact method
- Site location
- Project stage or short brief

**Recommended professional first layer**

- Name
- Practice or organisation
- At least one valid contact method
- Site or project location
- Short brief or document upload

**Optional detail, progressively disclosed**

- Approximate dimensions
- Preferred roof approach
- Pergola form
- Integrated blinds, lighting or heating
- Timing
- Site access or constraints
- Stakeholders
- Plans, sketches and photographs
- Additional message

Optional controls must not look required. Avoid asking visitors to make technical selections that Sanctuary is better placed to assess.

### 10.6 Uploads

- Use one shared upload component and backend contract where possible.
- Only advertise uploads supported by the submission endpoint.
- State accepted file types and size limits next to the control.
- Support plans and common image formats where the existing backend permits.
- Provide progress or clear completion state for larger files.
- Associate file errors with the control and announce them.
- Do not send file names or contents to analytics.
- Allow submission without files unless the business explicitly requires them for that audience.
- If uploads are deferred, remove copy that instructs the visitor to attach files.

### 10.7 Validation

- Validate after meaningful interaction or submission, not on every initial keystroke.
- Provide an error summary linked to each invalid field.
- Use clear language that explains how to fix the problem.
- Associate errors through semantic attributes.
- Move focus to the error summary on failed submission while preserving entered values.
- Do not rely on colour alone.
- Use correct input modes and autocomplete attributes.
- Server-side validation remains authoritative.
- Unknown query context must not create a validation failure.

### 10.8 Success state

The success state must:

- Confirm that the enquiry was received.
- Restate the enquiry type and selected project/product where present.
- Explain the next step and response method.
- Include a response timeframe only if Sanctuary can consistently meet it.
- Offer direct phone or email for urgent operational needs without creating alarm.
- Announce success to assistive technology.
- Prevent accidental duplicate submission.
- Preserve analytics and submission ID according to the existing privacy model.
- Avoid redirecting immediately to a generic page that loses context.

### 10.9 Privacy language

- Place a concise privacy statement beside the submit action.
- Link to the full privacy policy.
- Explain file handling where uploads are enabled.
- Do not include personal or brief content in analytics.
- Avoid adding consent checkboxes unless legally or operationally required.
- Preserve existing compliance requirements.

### 10.10 Analytics events

Use the existing analytics system. Do not introduce a new vendor solely for this roadmap.

Recommended event set, adapted to current naming conventions:

| Event | Trigger | Non-personal properties |
|---|---|---|
| `cta_select` | Major CTA activation | path, component, label, enquiry type, project/product slug where present |
| `enquiry_form_view` | Form becomes meaningfully visible | path, preselected type, source component |
| `enquiry_form_start` | First valid user interaction | type, source path, project/product context |
| `enquiry_optional_detail_open` | Optional detail is disclosed | type, section name |
| `enquiry_upload_complete` | Supported file upload completes | type, file category only, not name |
| `enquiry_validation_error` | Submission is blocked | type, field category or error count, no entered value |
| `enquiry_submit` | Valid submission sent | type, source, project/product context |
| `enquiry_success` | Server confirms receipt | type, source, project/product context |
| `project_view` | Project page viewed | project slug, project type |
| `project_gallery_engage` | Gallery control used | project slug, control type |
| `guide_select` | Guide opened from a conversion page | source page, guide slug |
| `guide_return_to_conversion` | Visitor returns to project/service/enquiry in the same session where supported | guide slug, destination category |

Analytics implementation must be documented, deduplicated and verified in production.

---

## 11. Mobile accessibility and touch checklist

Use this checklist in every relevant PR. Items marked **Real device** or **Assistive technology** require direct testing.

### Touch targets and spacing

- [ ] Interactive targets are at least 44 by 44 CSS pixels.
- [ ] Primary actions are preferably 48 CSS pixels high or greater where the design allows.
- [ ] Adjacent small controls have enough separation to prevent accidental activation.
- [ ] Full card click areas do not contain conflicting nested interactive elements.
- [ ] Controls remain usable at 200 percent zoom where applicable.
- [ ] **Real device:** Thumb reach and accidental-tap risk are checked on 360 px and 390 px devices.

### Focus management

- [ ] Every interactive element has a visible focus style.
- [ ] Focus order follows visual and semantic order.
- [ ] Opening a menu, modal or selector moves focus appropriately.
- [ ] Closing it returns focus to the trigger.
- [ ] Accordion activation does not unexpectedly move focus.
- [ ] Form errors move focus to an error summary while preserving values.
- [ ] Success state receives an appropriate announcement or focus.
- [ ] **Assistive technology:** Focus and announcements are verified with a screen reader.

### Mobile menu

- [ ] The trigger has an accessible name and state.
- [ ] Focus is contained when the menu functions as a modal.
- [ ] Background scroll is prevented without trapping the page after close.
- [ ] Escape or an equivalent supported close mechanism works.
- [ ] Route labels are unambiguous.
- [ ] Commercial and professional routes are discoverable.
- [ ] Menu height works in landscape and short viewports.
- [ ] **Real device:** iOS Safari viewport and scroll behaviour are tested.

### Accordions and progressive disclosure

- [ ] Trigger is a semantic button.
- [ ] `aria-expanded` and controlled-region relationship are correct.
- [ ] Heading hierarchy remains valid.
- [ ] Hidden content is not focusable.
- [ ] Deep links or Back behaviour remain predictable where accordions affect route state.
- [ ] Content remains available without relying on animation.
- [ ] **Assistive technology:** Expanded state and content relationship are announced correctly.

### Galleries and swipe interactions

- [ ] Previous and next controls are visible.
- [ ] Swipe is optional, not required.
- [ ] Current position and total count are available.
- [ ] Control labels include enough context.
- [ ] Focus does not disappear when slides change.
- [ ] Autoplay is not used.
- [ ] Reduced motion is respected.
- [ ] Captions and alternatives do not duplicate excessively.
- [ ] **Real device:** Touch, pinch and page-scroll conflicts are tested.
- [ ] **Assistive technology:** Slide changes and controls are understandable.

### Contrast and visual states

- [ ] Text over images meets contrast requirements for every responsive crop.
- [ ] Muted metadata remains readable.
- [ ] Outlined and disabled controls remain distinguishable.
- [ ] Selected filters and form options are not indicated by colour alone.
- [ ] Focus styles meet contrast requirements.
- [ ] **Real device:** Outdoor or high-brightness readability is spot checked where possible.

### Heading hierarchy and semantics

- [ ] One clear page-level heading is present.
- [ ] Section headings do not skip levels for visual styling.
- [ ] Card headings use appropriate semantic levels.
- [ ] Accordions preserve heading meaning.
- [ ] Reordered mobile layouts do not create a confusing DOM sequence.
- [ ] Landmark regions are used consistently.

### Forms

- [ ] Every field has a persistent visible label.
- [ ] Required and optional states are explicit.
- [ ] Grouped choices use fieldset and legend or an equivalent semantic pattern.
- [ ] `Roof approach` or another accurate label replaces `Roof direction`.
- [ ] Correct input type, input mode and autocomplete are used.
- [ ] Error text is associated with fields.
- [ ] Error summary links work.
- [ ] Upload status and errors are announced.
- [ ] Spam-protection fields are not visible, focusable or announced.
- [ ] Success is announced.
- [ ] **Real device:** Mobile keyboard and autofill behaviour are tested.
- [ ] **Assistive technology:** Full submission is completed with a screen reader.

### Reduced motion

- [ ] Motion respects `prefers-reduced-motion`.
- [ ] Smooth scrolling is disabled or reduced where requested.
- [ ] Menu and accordion content remains understandable without transition.
- [ ] Gallery changes do not rely on large animated movement.
- [ ] No essential state change is communicated only through motion.

### Hidden responsive duplicates

- [ ] One semantic instance is used wherever possible.
- [ ] Inactive duplicate variants are removed from layout and accessibility tree.
- [ ] IDs are unique across responsive states.
- [ ] Hidden content is not focusable.
- [ ] Analytics observers do not count hidden duplicate elements.
- [ ] Process and testimonial sections identified in the audit are specifically checked.

### Browser Back and route behaviour

- [ ] Closing a selector does not unexpectedly navigate away.
- [ ] Filter state behaves predictably on Back and refresh.
- [ ] Enquiry context survives refresh.
- [ ] Returning from contact restores a sensible page position where supported.
- [ ] Modal or overlay history entries are intentional.
- [ ] **Real device:** Safari and Chrome Back gestures are tested.

### Horizontal overflow

- [ ] No component exceeds the viewport at 360 px.
- [ ] Long CTA labels wrap safely or are shortened.
- [ ] Comparison content stacks rather than forcing a wide table.
- [ ] Filter chips wrap or use an accessible alternative.
- [ ] Project facts and metadata wrap without truncating essential meaning.
- [ ] File names do not force overflow.
- [ ] **Real device:** Zoom, long content values and dynamic browser chrome are tested.

---

## 12. Measurement plan

### 12.1 Baseline before major releases

Capture the longest reliable pre-change period available, ideally at least four complete weeks where traffic and campaign conditions are comparable. Do not invent or backfill unavailable data.

Record by mobile device category and relevant route:

- Sessions and engaged sessions
- Homepage primary and secondary CTA selection
- Project-index views
- Project-card selection
- Project-detail engagement
- Service-page entry and depth where existing analytics support it
- Enquiry-form views
- Enquiry-form starts
- Validation errors
- Enquiry submissions
- Confirmed successful submissions
- Commercial and professional route usage
- Guide selections from conversion pages
- Return from guides to projects, service or enquiry where measurable
- Core Web Vitals and representative page payload
- Qualified enquiry count where CRM or manual classification can be joined without violating privacy

### 12.2 Primary outcome

**Mobile qualified enquiry conversion**

Use the most reliable operational definition available:

`mobile enquiries accepted as relevant or qualified / eligible mobile sessions`

If CRM linkage is unavailable, use successful mobile enquiry completion as an interim metric and document that it is not the same as lead quality.

### 12.3 Supporting funnel metrics

| Metric | Purpose |
|---|---|
| Homepage primary CTA rate | Indicates whether first-screen clarity and hierarchy improved. |
| Project discovery rate | Shows whether visitors are using built evidence. |
| Project-to-enquiry rate | Tests whether project context supports conversion. |
| Form view-to-start rate | Identifies initial form friction. |
| Form start-to-success rate | Identifies field, validation or upload friction. |
| Validation error rate | Highlights confusing or technically problematic fields. |
| Optional-detail expansion | Shows whether progressive fields are useful without blocking the first layer. |
| Commercial/professional route rate | Confirms discoverability of non-residential pathways. |
| Guide exit rate | Shows whether guide links distract from high-intent journeys. |
| Guide return-to-conversion rate | Shows whether guides assist rather than divert. |
| Direct contact use | Captures phone/email preference, especially for professional and commercial visitors. |

### 12.4 Performance measures

Track at minimum:

- Largest Contentful Paint
- Interaction to Next Paint
- Cumulative Layout Shift
- Hero and initial project image payload
- Total page transfer for homepage, projects index and representative project/service pages
- JavaScript added by galleries, menus and form logic
- Image request count and responsive source selection

Use production field data where available and lab testing for release checks. Do not claim improvement from lab data alone.

### 12.5 Release measurement rules

- Add release annotations by PR or phase.
- Do not compare partial weeks where weekday mix materially differs.
- Segment commercial and professional traffic from residential where possible.
- Note campaigns, seasonality or major traffic-source changes.
- Avoid simultaneous unrelated changes to the same funnel.
- Do not A/B test unless traffic volume can support a useful result.
- Use sequential release comparison and qualitative testing where sample size is limited.
- Treat early directional movement as a signal, not proof.

### 12.6 Qualitative testing

Run short task-based sessions after the homepage, project and enquiry phases.

Recommended participant mix:

- Residential homeowners at early and active planning stages
- Design-conscious homeowners
- At least one commercial decision-maker
- At least one architect, designer or builder

Core tasks:

1. Explain what Sanctuary offers after viewing the first screen.
2. Find a project relevant to a stated brief.
3. Explain whether Sanctuary seems suitable and why.
4. Locate the likely process and investment drivers.
5. Start an appropriate enquiry.
6. Identify what will happen after submission.
7. For professional or commercial participants, send or locate the route for a brief or plans.

Record comprehension, hesitation, mistaken taps, abandoned tasks and remembered evidence. Do not lead participants toward expected routes.

---

## 13. Codex goal template

Copy the following template into a new Codex task and complete every field.

```md
# Goal: [Concise outcome-based title]

## Roadmap reference

- Document: `docs/mobile-ux-roadmap.md`
- Phase: [Phase number and name]
- Recommended PR: [PR number and title]

## Objective

[One clear customer or system outcome.]

## Problem being solved

[State the verified issue or inferred risk from the roadmap. Mark it as Verified, Inferred or Test required.]

## Exact scope

- [Behaviour or component included]
- [Pages or routes included]
- [Content or analytics change included]
- [Tests and documentation included]

## Files or page groups to inspect

Inspect the repository and identify the actual implementation before editing. Likely areas:

- [Route or page group]
- [Shared component group]
- [Form, analytics or content source]
- [Tests]

List the actual files found in the PR description. Do not invent new parallel components until existing ones have been assessed.

## Required behaviour

1. [Required behaviour]
2. [Required behaviour]
3. [Required behaviour]

## Design constraints

- Preserve Sanctuary's premium architectural positioning.
- Use the existing Next.js, React and Tailwind conventions.
- Preserve one responsive website and shared content source.
- Do not create duplicate mobile pages or duplicate full mobile content.
- Do not introduce unrelated desktop changes.
- Use existing components where they meet the roadmap contract.

## Responsive requirements

- Verify at approximately 430 px, 390 px and 360 px.
- [Image, wrapping, layout or overflow requirement]
- [Desktop regression requirement]

## Accessibility requirements

- [Keyboard and focus behaviour]
- [Semantic state and labels]
- [Screen-reader requirement]
- [Reduced-motion requirement where relevant]
- [Touch-target requirement]

## Analytics requirements

- Preserve existing analytics.
- [Required event or property]
- Do not send personal information, form values or file names to analytics.

## Acceptance criteria

- [Binary, testable criterion]
- [Binary, testable criterion]
- [Binary, testable criterion]

## Tests

- [Unit test]
- [Integration or end-to-end test]
- [Manual responsive test]
- [Accessibility test]
- [Analytics or performance check]

## Non-goals

- [Excluded feature or page]
- [Excluded redesign]
- [Excluded later roadmap phase]

## Required implementation notes

- Follow existing repository conventions.
- Keep the change small enough for one focused PR.
- Document any assumption that could not be verified.
- Do not silently broaden scope. Record newly discovered issues as follow-up items.
- Include before and after evidence for visible mobile changes.

## Expected PR output

- Code and tests for the scoped outcome
- Updated documentation where behaviour or analytics contracts change
- PR description containing:
  - roadmap reference
  - actual files changed
  - test evidence
  - screenshots at 430 px, 390 px and 360 px where visual
  - accessibility checks
  - analytics checks where relevant
  - explicit confirmation of non-goals
```

---

## 14. First recommended Codex goal

```md
# Goal: Fix enquiry routing and preserve source context

Use `docs/mobile-ux-roadmap.md`, Phase 1 and PR 1, as the authoritative brief.

## Objective

Ensure every major Sanctuary CTA opens the correct enquiry type and preserves the page, component, project or product that led the visitor to contact.

## Scope

1. Inspect the existing header, CTA/link helpers, contact route, enquiry form, project pages, product pages, commercial page, professional entry route and analytics utilities.
2. Create or consolidate one central enquiry-link/context utility using existing repository conventions.
3. Support validated non-personal context for:
   - enquiry type: residential, commercial or professional
   - source path
   - source component
   - project slug or ID
   - product slug or ID
4. Correct the global header so commercial content cannot route to residential. Preserve professional and residential context where known. Keep direct `/contact` neutral.
5. Read recognised context on the contact page, show the selected audience/project/product clearly and include it in the submitted payload.
6. Extend existing analytics properties where supported, without adding a new vendor or sending personal information.

## Acceptance criteria

- A header or CTA opened from the commercial page produces a commercial enquiry state.
- A professional CTA produces a professional enquiry state.
- Residential routes remain residential where explicitly selected.
- Project and product CTAs display and submit the selected item.
- Direct `/contact` remains neutral.
- Unknown or malformed context values fail safely.
- Refresh and browser Back preserve predictable behaviour.
- No name, email, phone, message, file name or other personal information is added to URLs or analytics.
- Existing submission and analytics behaviour continues to work.

## Tests

- Unit tests for context building and parsing.
- Integration tests for residential, commercial, professional, project, product and neutral contact routes.
- Form-payload verification.
- Refresh and browser Back checks.
- Manual checks at 430 px, 390 px and 360 px.
- Existing analytics smoke test.

## Non-goals

- Do not redesign the form.
- Do not change upload behaviour or required fields.
- Do not restructure the homepage.
- Do not introduce the shared mobile component system.
- Do not rewrite CTA copy beyond what is required to correct routing clarity.
- Do not make unrelated desktop changes.

Open one focused PR with the roadmap reference, actual files inspected, test evidence and any follow-up issues discovered outside scope.
```
