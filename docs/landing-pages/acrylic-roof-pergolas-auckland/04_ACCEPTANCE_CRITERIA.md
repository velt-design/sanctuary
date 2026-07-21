# Acceptance criteria

Implementation is complete only when the applicable items below are satisfied.

## Repository and scope

- [ ] Codex inspected the current marketing architecture before coding.
- [ ] Changes are limited to the marketing page and directly required shared code.
- [ ] No staff-portal or costing code was changed.
- [ ] No unrelated refactor remains in the diff.
- [ ] No dependency was added without a clear need.
- [ ] Existing components were reused where appropriate.
- [ ] Any new reusable component has a clear purpose beyond avoiding a small amount of duplication.

## Route and rendering

- [ ] The page exists at `/acrylic-roof-pergolas-auckland`.
- [ ] The production route returns successfully.
- [ ] Essential content is server rendered.
- [ ] The entire page was not made a Client Component.
- [ ] The page works without hover-only interactions.
- [ ] There is no forced scroll reset.
- [ ] Reduced-motion preferences are respected.

## Copy

- [ ] The rendered copy closely matches `02_PAGE_COPY.md`.
- [ ] There is one H1.
- [ ] Heading hierarchy is logical.
- [ ] New Zealand English is used.
- [ ] No em dashes appear in public copy.
- [ ] No private customer identities appear.
- [ ] No private correspondence is reproduced.
- [ ] No invented quotation or testimonial appears.
- [ ] No unsupported technical figure appears.
- [ ] No unapproved price appears.
- [ ] No unapproved warranty appears.
- [ ] No unapproved timeframe appears.
- [ ] No unverified project detail appears.
- [ ] No visible placeholder appears.

## SEO

- [ ] The approved title tag is present.
- [ ] The approved meta description is present.
- [ ] The canonical is self-referencing.
- [ ] Open Graph title and description are present.
- [ ] The Open Graph image is appropriate and verified.
- [ ] The route is included in the current sitemap system.
- [ ] The primary keyword appears naturally.
- [ ] Related search language is used only where natural.
- [ ] Internal links point to verified existing routes.
- [ ] FAQ structured data, if used, exactly matches visible FAQ content.
- [ ] No review or aggregate-rating schema was added without confirmed eligibility.

## Visual design

- [ ] Existing global header is reused.
- [ ] Existing global footer is reused.
- [ ] Existing typography is reused.
- [ ] Existing spacing tokens are reused.
- [ ] Existing container patterns are reused.
- [ ] Existing button styles are reused.
- [ ] The page feels consistent with the current homepage and product pages.
- [ ] The page does not look like a generic SEO template.
- [ ] Tint comparison is easy to scan.
- [ ] Project proof is visually prominent.
- [ ] CTA hierarchy is consistent.
- [ ] Images use the current Sanctuary image treatment.

## Responsive behaviour

Check at representative widths, including:

- [ ] Small mobile
- [ ] Large mobile
- [ ] Tablet
- [ ] Standard desktop
- [ ] Large desktop

At each width confirm:

- [ ] No horizontal overflow.
- [ ] No text clipping.
- [ ] No overlapping content.
- [ ] Cards stack or reflow correctly.
- [ ] Comparison content remains understandable.
- [ ] Images retain appropriate aspect ratios.
- [ ] Form labels remain visible.
- [ ] Sticky CTA does not cover important controls.
- [ ] Safe-area insets are handled on mobile.
- [ ] Header, form, cookie controls and sticky CTA do not conflict.

## Accessibility

- [ ] All meaningful images have descriptive alt text.
- [ ] Decorative images have empty alt text.
- [ ] Links and buttons have clear accessible names.
- [ ] Form inputs have persistent labels.
- [ ] Required fields are identified programmatically.
- [ ] Error messages are associated with fields.
- [ ] Success and failure states are announced appropriately.
- [ ] Keyboard navigation works.
- [ ] Focus states are visible.
- [ ] Accordions, if used, are keyboard accessible.
- [ ] Colour is not the only way acrylic options are identified.
- [ ] Heading levels are not selected for visual styling alone.

## Form and enquiry flow

- [ ] Existing enquiry processing is reused.
- [ ] Existing attribution is retained.
- [ ] Existing secure upload flow is reused where supported.
- [ ] Phone number is required.
- [ ] Dimensions begin blank or unknown.
- [ ] No pergola form is preselected.
- [ ] No acrylic tint is preselected.
- [ ] Upload limits shown to users match actual limits.
- [ ] File validation matches the backend.
- [ ] Entered values remain after validation errors.
- [ ] Entered values remain after network errors where practical.
- [ ] The submit action has a clear loading state.
- [ ] The approved success message is used.
- [ ] The approved error message is used.
- [ ] Internal database errors are not returned publicly.
- [ ] Internal IDs are not exposed to visitors.
- [ ] Privacy Policy is linked near submission.

## Project content

- [ ] Every displayed project exists in the repository or approved source.
- [ ] Every displayed project image is approved for use.
- [ ] Pergola form is verified.
- [ ] Acrylic tint or product is verified.
- [ ] Customer challenge is verified or omitted.
- [ ] Design response is verified or written only from approved project content.
- [ ] Project link is verified.
- [ ] No placeholder project card is rendered.

## Performance

- [ ] Hero image uses the current optimised image approach.
- [ ] Image dimensions or aspect ratios prevent layout shift.
- [ ] Responsive image sizes are set appropriately.
- [ ] Non-critical images are lazy loaded.
- [ ] No autoplay video is introduced.
- [ ] No unnecessary client-side bundle is introduced.
- [ ] No avoidable duplicate data request is introduced.
- [ ] No console errors or hydration warnings occur.

## Verification commands

Discover the correct commands from the current repository.

Run the relevant equivalents of:

- [ ] Marketing lint
- [ ] Marketing typecheck
- [ ] Marketing tests
- [ ] Marketing production build

If a command is unavailable or fails for a pre-existing reason:

- Report the exact command.
- Report the exact result.
- Distinguish new failures from existing failures.
- Do not claim the check passed.

## Final Codex response

Codex must return:

- [ ] Concise implementation summary
- [ ] Files changed
- [ ] Existing components reused
- [ ] New components created and why
- [ ] Tests and builds run with results
- [ ] Visual checks performed
- [ ] Screenshots or screenshot paths at representative breakpoints
- [ ] Unresolved claims or placeholders
- [ ] Assumptions made
- [ ] Any pre-existing issues encountered
