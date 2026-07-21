# Acrylic Roof Pergolas Auckland

## Implementation brief

### Objective

Create and implement a new SEO and conversion landing page for Sanctuary Pergolas at:

`/acrylic-roof-pergolas-auckland`

The page should convert qualified Auckland homeowners into initial estimate enquiries.

The visitor is likely already considering a roofed pergola. The page should help them decide:

- Whether acrylic is suitable
- Which tint may suit the site
- How the roof may affect daylight
- How summer brightness and comfort should be considered
- How rainwater, drainage and house connections are approached
- Which pergola form may suit
- What affects pricing
- What information Sanctuary needs for an initial estimate

### Core strategic idea

Customers want weather protection without unnecessarily sacrificing the natural light entering their outdoor area and home.

The page should show that Sanctuary considers the complete pergola system, not just the acrylic sheet:

- Orientation
- Roof pitch
- Pergola depth
- Tint
- Adjoining windows and doors
- Frame proportions
- House connection
- Flashing
- Gutters and drainage
- Prevailing weather
- Ventilation
- Blinds
- Mixed roofing

### Business positioning

Sanctuary Pergolas is an Auckland-based architectural design-and-build company creating bespoke aluminium pergolas.

The page should feel:

- Premium
- Architectural
- Calm
- Specific
- Practical
- Confident without hype

Do not position Sanctuary as:

- A cheap patio-cover installer
- A kitset retailer
- A generic builder
- A commodity roofing supplier
- A one-size-fits-all pergola company

### Primary keyword

`acrylic roof pergolas Auckland`

### Related search language

Use naturally where relevant:

- acrylic pergolas Auckland
- acrylic roof pergola Auckland
- clear roof pergola Auckland
- clear acrylic pergola roof
- covered pergolas Auckland
- pergola with clear roof Auckland
- aluminium pergola with acrylic roof
- weatherproof pergola Auckland

Do not force exact-match phrases where they reduce readability.

## Repository inspection required before coding

Before making changes, inspect the current repository and identify:

- The `apps/marketing` application structure
- Root marketing layout
- Homepage composition
- Existing pergola product pages
- Existing project index and project-detail patterns
- Typography and spacing tokens
- Container and section patterns
- Button and CTA components
- Card and comparison patterns
- FAQ or accordion patterns
- Current contact and estimate flow
- Enquiry API
- Attachment upload flow
- Attribution handling
- Metadata helpers
- Sitemap implementation
- Image conventions
- Marketing tests and build scripts

Prefer reuse over new code.

Only introduce a new component when no current component or pattern is appropriate.

## Page role within the website

The homepage already introduces the product range broadly.

Existing pergola pages explain individual roof forms.

This page should become the material-led decision page for acrylic roofing. It should:

- Go deeper on clear, tinted and opal acrylic
- Explain daylight, glare, heat and weather considerations
- Connect acrylic selection to pergola design
- Link naturally to existing pergola styles and completed projects
- Avoid repeating full product-page descriptions
- Lead consistently to an initial estimate enquiry

## Required page composition

Use the approved copy in `02_PAGE_COPY.md`.

The expected order is:

1. Hero
2. Opening problem and solution
3. Acrylic roofing benefits
4. Clear, light grey, dark grey and opal comparison
5. Heat, glare and summer comfort
6. Rain, drainage and house integration
7. Pergola design options
8. Why Sanctuary
9. Relevant completed projects
10. Process
11. Price guidance
12. Consent and engineering
13. FAQ
14. Final CTA
15. Estimate form
16. Sticky mobile CTA

## Visual direction

Do not create a new visual language.

Reuse the existing Sanctuary marketing design system, including:

- Global header and footer
- Typography
- Container widths
- Section spacing
- Button styles
- Border language
- Image treatment
- Project-card treatment
- Form styling
- Mobile navigation behaviour

The page should feel editorial and architectural rather than like a generic SEO template.

Recommended composition:

- Strong project image in the hero
- Generous introduction with short paragraphs
- Scannable benefit grid
- Four-option tint comparison
- Editorial image-and-copy sections for comfort and weather detailing
- Compact pergola-form cards linked to existing pages
- Project proof presented with real Sanctuary imagery
- Clear process steps
- Restrained price explanation
- FAQ near the conversion section
- Final estimate form with supporting project image or material detail

## Rendering direction

- Prefer Server Components for page content.
- Use Client Components only for necessary interaction.
- Do not make the entire page a client component.
- Keep essential comparison and FAQ content available in rendered HTML.
- Do not hide important information behind hover interactions.
- Respect reduced-motion preferences.
- Avoid autoplay hero video.
- Avoid forced scroll resets.

## Project content

Use verified existing Sanctuary project content where possible.

Do not render public placeholder cards.

If suitable project facts are incomplete:

- Use only confirmed fields
- Omit unsupported detail
- Add a source-code TODO
- List the missing item in the final implementation summary

Project examples should collectively demonstrate:

1. Retaining daylight with clear acrylic
2. Softer light using light grey or opal
3. Mixed acrylic and solid or timber roofing
4. Attached or freestanding integration
5. A considered response to stronger direct sun

Do not force five examples if fewer verified examples provide stronger proof.

## Internal links

Verify every destination against the current repository.

Link naturally to:

- Pergola styles or product index
- Mono-pitched pergolas
- Gable pergolas
- Hip-roof pergolas
- Box-perimeter pergolas
- Completed projects
- Relevant acrylic-roof project case studies
- Outdoor blinds
- Acrylic infill panels
- Contact or estimate route

Do not invent route paths.

## Form requirements

Reuse the current enquiry processing, attribution and secure upload architecture.

Do not create a second lead-processing system.

The page form should:

- Require phone number
- Use persistent visible labels
- Start dimensions blank or unknown
- Avoid selecting a tint or style by default
- Accept project photos and plans if supported by the existing secure upload flow
- Preserve entered content after validation or network errors
- Show clear field-level errors
- Show accessible success and failure states
- Include a privacy-policy link
- Avoid exposing internal database identifiers
- Avoid returning sensitive internal errors

If the existing form is too large or duplicated, extract only the smallest safe reusable component needed for this page. Do not perform a broad form refactor unless essential.

## SEO requirements

Implement:

- Target route
- Approved title tag
- Approved meta description
- Self-referencing canonical
- Open Graph title
- Open Graph description
- Suitable Open Graph image
- Sitemap inclusion
- One H1
- Logical heading hierarchy
- Natural internal links
- FAQ structured data only when it exactly matches visible FAQ content

Do not add review schema unless eligibility and displayed review data are confirmed.

## Scope control

Do not:

- Redesign the global site
- Modify the staff portal
- Change costing logic
- Change unrelated APIs
- Refactor unrelated pages
- Introduce a new design system
- Introduce a CMS
- Add dependencies without a clear implementation need
- Rewrite approved copy without a strong rendering, accuracy or accessibility reason
- Publish unsupported claims
- Publish visible placeholders
- Change existing URLs unnecessarily

## Definition of done

The task is complete only when:

- The route is implemented
- The approved copy is present
- Existing visual patterns are reused
- Metadata and sitemap are complete
- Internal links are verified
- The form works through the existing enquiry system
- Responsive behaviour has been checked
- Accessibility has been checked
- Relevant repository tests and build commands pass
- No unsupported claims were introduced
- No unrelated changes remain in the diff
- Remaining approval items are clearly reported
