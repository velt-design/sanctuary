# Design Booklets

Status: Current first-round implementation.

Owner surface: authenticated standalone Portal route at `/staff/design-booklets`.

## Purpose

The Design Booklet Workbench assembles a customer-facing concept booklet from a plan, three renders, one roof-form template, and one roofing-choice template. The first bundled example is Toni's pitched pergola with combination roofing.

This surface is deliberately standalone:

- it is protected by the existing staff route authentication;
- it is not linked from portal navigation;
- authenticated rendering omits the normal portal sidebar, rail, mobile header, and drawer;
- its visual system is route-owned and follows the existing customer-document vocabulary rather than the operational portal UI;
- it has no project, task, Drafting Queue, Design Workbench, costing, quote, or Project Overview integration.

The parent staff layout still mounts the portal's existing ambient `DbGate`, but the booklet route and its API make no database or workflow calls.

## Current Booklet

The preview and PDF contain six A4 landscape pages:

1. cover;
2. current design overview;
3. feature render;
4. concept plan;
5. selected roof form as an image-led marketing-style feature;
6. selected roofing choice as one material section or, for combination roofing, separate acrylic and COLORSTEEL/timber-ceiling sections.

The initial render order is Toni render 3, render 1, then render 2. Staff can replace the plan or any render with a local PNG/JPEG, reorder the renders, or assign a new cover. Customer name, booklet title, roof form, and roofing choice are editable.

All edits remain in browser memory. PDF generation accepts the current draft and files in one authenticated request and returns a download. There is no persistence, shared-storage upload, email delivery, audit event, or workflow automation.

## Content Ownership

`apps/marketing/data/products.ts` remains the canonical owner of generic roof-form and material guidance. `apps/marketing/lib/designBookletContent.ts` selects existing strings without strengthening them; the short roofing-section labels are presentation labels, while their explanatory sentences stay governed by the marketing product owner. The server-only Portal adapter at `apps/portal/lib/designBooklets/marketingContent.ts` exposes only the small serializable model required by the booklet.

The first material choices use the public labels from `generalRoofPreference`:

- Acrylic roofing
- Solid or lined roofing
- Combination roofing

Do not turn the `timber` intake key into a customer-facing "timber roof" claim. Do not add warranty, waterproofing, all-weather, performance percentage, timing, pricing, consent, span, or similar claims. New generic wording belongs in the governed marketing owner first; the booklet adapter should only select it.

## Runtime Owners

- `apps/portal/app/staff/design-booklets/**`: workbench, A4 HTML preview, and route-owned styling.
- `apps/portal/lib/designBooklets/**`: draft contract, Toni defaults, request validation, default-asset loading, PDF renderer, and marketing adapter.
- `apps/portal/app/api/staff/v1/design-booklets/pdf/route.ts`: authenticated PDF download.
- `apps/portal/public/images/design-booklets/toni/**`: bundled first-round Toni plan and renders.
- `apps/portal/public/images/design-booklets/reference/**`: stable route-owned copies of matching imagery from the governed marketing asset set.
- `apps/portal/app/qa/design-booklet-workbench-fixture/page.tsx`: credential-free QA mirror when `ENABLE_PORTAL_QA_FIXTURES=1`.
- `apps/portal/app/api/qa/design-booklet-workbench/pdf/route.ts`: gated QA download using the production parser and renderer.

The PDF is rendered server-side with `pdf-lib`, embedded Inter fonts, the Sanctuary customer-artifact palette, and the same six-page order as the HTML preview. The landscape layouts use the marketing website's image-led hero, split editorial, product-feature and material-story rhythms while remaining route-owned. Roof-form and roofing reference images are copied from the marketing public asset set so browser and server-side PDF rendering use the same stable files. Instrument Sans is loaded locally for the workbench and browser preview without changing workspace package manifests.

## Verification

Focused checks:

```bash
node node_modules/vitest/vitest.mjs run apps/marketing/lib/designBookletContent.test.ts apps/portal/lib/designBooklets apps/portal/app/staff/design-booklets apps/portal/app/api/staff/v1/design-booklets apps/portal/app/api/qa/design-booklet-workbench apps/portal/components/layout/PortalShell.test.tsx apps/portal/proxy.test.ts
node node_modules/@playwright/test/cli.js test playwright/portal.design-booklet-workbench.spec.ts --project=portal-fixture --workers=1
```

For deterministic PDF evidence, set `DESIGN_BOOKLET_OUTPUT_DIR=output/pdf` while running `apps/portal/lib/designBooklets/pdf.test.ts`, render the result with Poppler, and inspect all six pages. Browser visual QA should inspect all page buttons plus desktop and narrow layouts on the gated fixture.

## Explicit Non-goals

- project-record association or task creation;
- Design Workbench or drawing geometry reuse;
- template persistence or a reusable template administration UI;
- database migrations or shared storage;
- sending, approval links, customer portal access, or automation;
- quote, pricing, costing, timing, performance, or warranty content.
