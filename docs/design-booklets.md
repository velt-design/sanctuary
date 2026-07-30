# Design Booklets

Status: Current session-only implementation.

Owner surface: authenticated standalone Portal route at `/staff/design-booklets`.

## Purpose

The Design Booklet Workbench assembles a customer-facing landscape concept booklet from a fixed cover and review page plus a user-composed sequence of image and drawing pages. The bundled starting point uses Toni's plan and three renders.

This surface is deliberately standalone:

- it is protected by the existing staff route authentication;
- it is not linked from portal navigation;
- authenticated rendering omits the normal portal sidebar, rail, mobile header, and drawer;
- its visual system is route-owned and follows the existing customer-document vocabulary rather than the operational portal UI;
- it has no project, task, Drafting Queue, Design Workbench, costing, quote, or Project Overview integration.

The parent staff layout still mounts the portal's existing ambient `DbGate`, but the booklet route and its API make no database or workflow calls.

## Workbench Layout Contract

At desktop widths the route is a viewport-height, two-pane workbench. A persistent control rail on the left owns booklet details, page composition, and the selected-page editor; only this rail scrolls. The preview workspace on the right owns the remaining width and height. Its stage fits one complete `297 / 210` landscape A4 page inside the available canvas, preserving all four page edges without browser zoom, clipping, or a fixed pixel-width preview.

At widths up to 960px the preview moves above the controls and the document becomes normally scrollable. The preview still preserves the exact landscape A4 ratio, controls remain reachable, and the route must not introduce horizontal document overflow. The compact mobile header keeps the primary PDF action available.

The cover image is presented without a darkening overlay. Its brand remains at the top, while the eyebrow, booklet title, details rule, customer, design direction, and footer form one lower-page story. The browser page typography scales from the A4 page container rather than from the browser viewport so changing workbench size cannot change line wrapping independently of the PDF composition.

## Page Model

The cover is always page one and the review page is always last. They cannot be removed or reordered. The middle `contentPages` sequence may contain any mix of image and drawing pages; staff can add, remove, and reorder either type. Page numbers and the total page count are derived from that sequence, so the booklet may contain only the two fixed pages or up to 24 middle pages.

The fixed cover contains the customer name, booklet title, selected roof form, selected roofing choice, and a full-page image. Staff can replace and refocus the image. A middle image page is a full-bleed image with only the small `Concept image` header and customer/page footer overlaid. Its image can be replaced, assigned one of nine focal positions, given a browser-preview screen-reader description, or used as the cover. The generated PDF is not currently a tagged PDF, so that description is not embedded in the download.

Each drawing page keeps four reusable drawing slots and exposes one of four layouts:

- one large drawing;
- two equal drawings;
- one large drawing plus two smaller drawings;
- a four-drawing grid.

Changing to a layout with fewer drawings hides rather than discards the other slots. Visible drawings can be reordered. Each image is shown without full-bleed cropping and has a clean caption underneath. Captions use `Plan`, `Section`, `Elevation`, or `Isometric`, or an 80-character custom title.

The final `Review the concept` page has fixed, approved review prompts and call to action. Staff can replace and refocus its closing image, but cannot edit the copy in the workbench.

Toni's default booklet contains five pages:

1. cover using render 3;
2. image page using render 1;
3. image page using render 2;
4. one-large drawing page using the plan;
5. review page using render 3.

## Session And Render Ownership

All edits and replacement-image object URLs remain in browser memory. Reloading the route restores the Toni defaults. PDF generation posts the current schema-v2 draft and only its renderable custom files in one authenticated request, returns a private no-store download, and does not save the draft or files.

`buildDesignBookletRenderModel()` is the shared owner of page order, stable page keys, labels, numbering, and count for the browser preview and PDF. The drawing-layout definitions, image focal positions, title resolution, and fixed review copy are also shared. The HTML and `pdf-lib` renderers remain separate presentation implementations over that model.

Preview and download parity is therefore a maintained visual contract: page order, content, focal positions, captions, numbering, page ratio, and the lower cover composition must agree. Changes to either renderer require rendering the PDF and visually comparing every page with its browser preview; passing text or page-count assertions alone is insufficient.

There is no persistence, shared-storage upload, email delivery, audit event, project association, or workflow automation.

## Content Ownership

`apps/marketing/data/products.ts` remains the canonical owner of generic roof-form and material wording. `apps/marketing/lib/designBookletContent.ts` selects existing content without strengthening it. The server-only Portal adapter at `apps/portal/lib/designBooklets/marketingContent.ts` exposes only the roof-form names and material labels needed on the cover.

The first material choices use the public labels from `generalRoofPreference`:

- Acrylic roofing
- Solid or lined roofing
- Combination roofing

The review-page wording is fixed in `apps/portal/lib/designBooklets/pageModel.ts` and is the explicitly approved exception to the marketing-owned cover labels. Changes to that customer-facing copy require business approval.

Do not turn the `timber` intake key into a customer-facing "timber roof" claim. Do not add warranty, waterproofing, all-weather, performance percentage, timing, pricing, consent, span, or similar claims. New generic roof-form or material wording belongs in the governed marketing owner first; the booklet adapter should only select it.

## Runtime Owners

- `apps/portal/app/staff/design-booklets/**`: workbench, page composer, A4 HTML preview, and route-owned styling.
- `apps/portal/lib/designBooklets/types.ts`: schema-v2 draft and page contracts.
- `apps/portal/lib/designBooklets/pageModel.ts`: shared page resolution, drawing layouts, focal positions, review copy, and composition helpers.
- `apps/portal/lib/designBooklets/defaults.ts`: Toni asset catalogue and default draft.
- `apps/portal/lib/designBooklets/request.ts`: multipart draft and image validation.
- `apps/portal/lib/designBooklets/pdf.ts`: landscape PDF renderer over the shared page model.
- `apps/portal/lib/designBooklets/marketingContent.ts`: narrow marketing-content adapter.
- `apps/portal/app/api/staff/v1/design-booklets/pdf/route.ts`: authenticated PDF download.
- `apps/portal/public/images/design-booklets/toni/**`: bundled Toni plan and renders.
- `apps/portal/app/qa/design-booklet-workbench-fixture/page.tsx`: credential-free QA mirror when `ENABLE_PORTAL_QA_FIXTURES=1`.
- `apps/portal/app/api/qa/design-booklet-workbench/pdf/route.ts`: gated QA download using the production parser and renderer.

The PDF is rendered server-side with `pdf-lib`, embedded Inter fonts, and the Sanctuary customer-artifact palette. Instrument Sans is loaded locally for the workbench and browser preview without changing the workspace package manifests.

## Request And PDF Limits

The client and server enforce the same 15 MB per-image limit. The server additionally:

- rejects a declared multipart request above 128 MiB before parsing its body, leaving 8 MiB of headroom over the file-total allowance for the draft and multipart framing;
- accepts PNG and JPEG only, decodes each upload, and verifies that its bytes match its declared media type;
- normalizes EXIF orientation before an uploaded image reaches the PDF renderer;
- limits all custom uploads in one request to 120 MB;
- limits each custom upload to 12,000 pixels on either side and 50 megapixels;
- allows at most 24 middle content pages;
- limits customer name to 80 characters, booklet title to 120, image descriptions to 240, and custom drawing titles to 80;
- rejects invalid or duplicate identifiers, duplicate file fields, unreferenced uploads, unsupported schema values, and malformed page or drawing-slot data.

Oversize requests return `413`; other invalid requests return `400`. Successful PDFs and error responses are private and no-store.

## Verification

Focused checks:

```bash
node node_modules/vitest/vitest.mjs run apps/marketing/lib/designBookletContent.test.ts apps/portal/lib/designBooklets apps/portal/app/staff/design-booklets apps/portal/app/api/staff/v1/design-booklets apps/portal/app/api/qa/design-booklet-workbench apps/portal/components/layout/PortalShell.test.tsx apps/portal/proxy.test.ts
node node_modules/@playwright/test/cli.js test playwright/portal.design-booklet-workbench.spec.ts --project=portal-fixture --workers=1
```

For deterministic PDF evidence, set `DESIGN_BOOKLET_OUTPUT_DIR=output/pdf` while running `apps/portal/lib/designBooklets/pdf.test.ts`. This writes the default five-page Toni booklet and a six-page drawing-layout fixture. Render both with Poppler and inspect every page. Browser visual QA should inspect every default page, mixed add/remove/reorder behavior, all drawing layouts, image focal positions, a custom drawing title, PDF parity, and the gated fixture at 1920×1080, 1440×900, 1366×768, a narrower tablet width, and mobile width.

## Explicit Non-goals

- project-record association or task creation;
- Design Workbench or drawing geometry reuse;
- draft persistence or a reusable template administration UI;
- database migrations or shared storage;
- sending, approval links, customer portal access, or automation;
- quote, pricing, costing, timing, performance, or warranty content.
