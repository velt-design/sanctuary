# Codex task prompt

Implement a new Sanctuary Pergolas marketing landing page at:

`/acrylic-roof-pergolas-auckland`

Use these files as the authoritative handoff:

- `docs/landing-pages/acrylic-roof-pergolas-auckland/00_README.md`
- `docs/landing-pages/acrylic-roof-pergolas-auckland/01_IMPLEMENTATION_BRIEF.md`
- `docs/landing-pages/acrylic-roof-pergolas-auckland/02_PAGE_COPY.md`
- `docs/landing-pages/acrylic-roof-pergolas-auckland/03_CONTENT_GOVERNANCE.md`
- `docs/landing-pages/acrylic-roof-pergolas-auckland/04_ACCEPTANCE_CRITERIA.md`

Complete the implementation rather than only proposing it.

## Required working method

Before writing code, inspect the current repository and identify the existing marketing patterns that should be reused, including:

- App and route structure
- Root layout
- Homepage
- Pergola product pages
- Project pages and project data
- Typography and spacing
- Containers and section patterns
- Buttons and CTA patterns
- Cards and comparison patterns
- FAQ or accordion patterns
- Contact or estimate form
- Enquiry API
- Attachment upload flow
- Attribution handling
- Metadata helpers
- Sitemap implementation
- Tests and build scripts

Then briefly state the intended implementation approach and proceed.

## Core requirements

- Use the existing Sanctuary marketing visual system.
- Reuse current components wherever practical.
- Keep static content server rendered.
- Use Client Components only where interaction requires them.
- Use the approved page copy.
- Preserve New Zealand English.
- Do not use em dashes in public copy.
- Verify every internal link against the repository.
- Reuse the existing enquiry, attribution and upload architecture.
- Require phone number.
- Do not prefill dimensions.
- Do not preselect a pergola form or acrylic tint.
- Add approved metadata, canonical and sitemap inclusion.
- Add FAQ structured data only if it exactly matches visible FAQ content.
- Use verified Sanctuary project imagery and facts.
- Render only approved project examples.
- Make the page responsive and accessible.
- Ensure the mobile sticky CTA does not obstruct controls.
- Avoid forced scroll behaviour.
- Avoid unnecessary JavaScript.
- Avoid unrelated changes.

## Accuracy constraints

Do not invent or infer:

- Acrylic manufacturer
- Acrylic product
- Acrylic thickness
- UV figures
- Heat or solar figures
- Warranty
- Lifespan
- Weatherproofing guarantees
- Wind ratings
- Engineering claims
- Consent conclusions
- Prices
- Lead times
- Service limits
- Review counts
- Customer quotations
- Project details

If a required item is unapproved:

1. Omit it cleanly from the public page.
2. Add a source-code TODO where appropriate.
3. List it in the final implementation summary.

Do not render visible placeholder text.

## Scope constraints

Do not:

- Redesign the marketing site
- Modify the staff portal
- Modify costing logic
- Create a new lead-processing system
- Refactor unrelated pages
- Introduce a CMS
- Build a speculative landing-page framework
- Add a dependency without a clear need
- Rewrite the approved copy without a strong accuracy, accessibility or rendering reason

## Verification

Before finishing:

1. Review the complete page against the existing Sanctuary marketing site.
2. Check mobile, tablet, desktop and large desktop layouts.
3. Check heading hierarchy, labels, keyboard behaviour and focus states.
4. Check metadata, canonical, sitemap and structured data.
5. Submit the form through the supported local or test workflow.
6. Confirm no unsupported claim was introduced.
7. Review the Git diff for unrelated changes.
8. Run the repository-relevant marketing lint, typecheck, tests and production build.
9. Capture screenshots or provide screenshot paths for representative breakpoints.

## Final response

Return:

- Implementation summary
- Files changed
- Existing components reused
- New components and why they were needed
- Tests and builds run, with exact results
- Responsive and accessibility checks completed
- Screenshot paths
- Remaining approval items or TODOs
- Assumptions made
- Pre-existing issues encountered
