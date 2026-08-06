# Design Booklets

Status: Current project-linked implementation, with a session-only standalone fallback.

Owner surface: authenticated standalone Portal route at `/staff/design-booklets`.

## Purpose

The Design Booklet Workbench assembles a customer-facing landscape concept booklet from a fixed cover and review page plus a user-composed sequence of image and drawing pages. New project booklets start with the approved page structure and neutral empty media surfaces; Toni's plan and renders are isolated to the standalone and QA fixture.

Project-linked replacement images are stored in the private
`design-booklet-assets` bucket and previewed through short-lived signed URLs.
The portal production CSP must retain `https://*.supabase.co` in `img-src`;
`connect-src` permission alone does not allow an `<img>` to display the saved
asset after its local blob preview is replaced.

This surface remains a specialist standalone route:

- it is protected by the existing staff route authentication;
- it is not linked from portal navigation;
- authenticated rendering omits the normal portal sidebar, rail, mobile header, and drawer;
- its visual system is route-owned and follows the existing customer-document vocabulary rather than the operational portal UI;
- it has no task, Drafting Queue, Design Workbench, costing, or quote integration.

The Project Overview's `Open booklet workbench` action passes the existing app
project ID in `?projectId=`. The route loads one active booklet draft and its
private images for that project, provides a clear return action to the same
Project Detail route, and autosaves booklet choices after edits.

Opening `/staff/design-booklets` without a project ID preserves the session-only
Toni fixture behavior for safe standalone and QA use.

## Page Model

The cover is always page one and the review page is always last. They cannot be removed or reordered. The middle `contentPages` sequence may contain any mix of image and drawing pages; staff can add, remove, and reorder either type. Page numbers and the total page count are derived from that sequence, so the booklet may contain only the two fixed pages or up to 24 middle pages.

The fixed cover contains the customer name, booklet title, selected roof form, selected roofing choice, and a full-page image. Staff can replace and refocus the image. A middle image page is a full-bleed image with only the small `Concept image` header and customer/page footer overlaid. Its image can be replaced, assigned one of nine focal positions, given a browser-preview screen-reader description, or used as the cover. The generated PDF is not currently a tagged PDF, so that description is not embedded in the download.

Each drawing page keeps four reusable drawing slots and exposes one of four layouts:

- one large drawing;
- two equal drawings;
- one large drawing plus two smaller drawings;
- a four-drawing grid.

Changing to a layout with fewer drawings hides rather than discards the other slots. Visible drawings can be reordered. Each image is shown without full-bleed cropping and has an uppercase technical caption underneath in the form `01 / PLAN`. Captions use `Plan`, `Section`, `Elevation`, or `Isometric`, or an 80-character custom title.

Every drawing page is presented as an architectural concept sheet. Staff can edit its sheet title, revision, issue date, and each visible drawing caption; the sheet number is derived automatically as `A-01`, `A-02`, and so on. Sheet titles are normalized to uppercase when edited, loaded from a saved draft, previewed, and exported. The drawing field starts near the top rule and occupies most of the sheet; there is no separate running logo or architectural-package header. A restrained bottom title block is the sole identity and information area, with Sanctuary identity, the uppercase sheet title and number, customer, project, governed roof-form and roofing labels, revision, issue date, fixed concept status, and secondary booklet pagination. The fixed status is `Concept design — not for construction`; no scale, approval, consent, performance, or construction claim is inferred. Older schema-v2 drafts remain readable because missing drawing-page metadata is normalized to safe defaults when loaded.

Drawing preview is PDF-authoritative. Selecting a drawing page prepares the current complete booklet PDF and renders that exact PDF page to a browser canvas with PDF.js. Download reuses the same cached Blob rather than generating a second artifact, so the inspected drawing sheet and downloaded bytes cannot diverge. Draft changes invalidate the artifact, and PDF generations are serialized because project exports share the stable private `exports/latest.pdf` path.

The final `Review the concept` page has fixed, approved review prompts and call to action. Staff can replace and refocus its closing image, but cannot edit the copy in the workbench.

Toni's default booklet contains five pages:

1. cover using render 3;
2. image page using render 1;
3. image page using render 2;
4. one-large drawing page using the plan;
5. review page using render 3.

## Project Persistence And Render Ownership

Each project has at most one active row in `project_design_booklets`. A new
project booklet starts from the approved five-page structure with solid-colour
media placeholders, while the customer name is initialized from the linked
contact (falling back to the project name). The draft retains the schema-v2
contract and uses an optimistic `revision` so a stale browser cannot silently
overwrite a newer save. The optional per-source `useDefaultAsset` field declares
standalone default eligibility. Every project-linked draft, including an older
saved schema-v2 draft, is normalized to neutral media sources while its uploaded
project assets remain authoritative.

Replacement PNG/JPEG files are resized in the browser to a maximum 4096-pixel
edge and encoded as JPEG before a direct signed upload to the private
`design-booklet-assets` bucket. The staff API prepares the project-scoped
upload, verifies and normalizes the stored bytes, and only then upserts
`project_design_booklet_assets`. Upload failures remain visible and are never
recorded as saved metadata.

Project PDF generation loads the saved draft and private assets server-side.
The generated PDF is written to the project's private `exports/latest.pdf`
object and the route returns a ten-minute signed download URL. This avoids
passing all full-resolution images through one function request and avoids
returning potentially large PDF bytes through the function response. The
session-only route retains the original authenticated multipart renderer for
fixtures and isolated use.

`buildDesignBookletRenderModel()` is the shared owner of page order, stable page keys, labels, numbering, and count for the browser preview and PDF. The drawing-layout definitions, image focal positions, title resolution, and fixed review copy are also shared. Render and review pages remain responsive HTML previews; drawing pages deliberately cross the browser/PDF boundary and display the generated PDF page itself.

`presentation.ts` owns the merged browser/PDF visual contract. It keeps the artifact inside a compact `3.8cqw` frame in the preview, equal to `31.99pt` on the canonical landscape A4 canvas; assigns Instrument Sans to display roles and Inter to body roles; bottom-anchors the cover story so title wrapping grows upward from a stable lower composition; leaves the cover image unshaded; fixes the review page at a 45% image / 55% story split; and defines the drawing canvas plus architectural title-block geometry. Drawing sheets use a tighter 20pt inset, begin the drawing field 18pt below the sheet edge, reserve only a compact caption band, and finish with a 93pt title block. The browser scales the shared point model from the booklet container while `pdf-lib` consumes the same geometry and font roles directly, so responsive preview sizing does not change the exported composition.

On desktop, the route chrome presents a compact control rail beside a wider preview workspace. The normal five-page workflow fits at 1920×1080 and 1440×900 without scrolling the rail or page list: booklet details are progressively disclosed, page rows expose contextual reorder/remove controls, and one `Add page` menu owns both page types. Only the selected-page editor may scroll when expanded details, advanced controls, or larger drawing layouts need more room. The preview owns the remaining viewport and fits the complete A4 page without document or preview scrolling at common desktop sizes. At 960px and below, the preview moves above the controls and the page returns to a single-column flow. This shell is route-owned and does not alter the shared page renderer or PDF geometry.

Every media surface has an explicit `empty`, `loading`, `ready`, or `error` display state. Empty new-project slots use a neutral solid colour, loading surfaces expose a spinner and status text, and failed images remain actionable instead of becoming silent broken-image icons. PDF preparation and download remain unavailable while media replacement or display readiness is unresolved.

There is no email delivery, customer sending, audit event, task creation, or
workflow automation.

### Production status

On 2026-07-31, exact migration
`20260731_000001_project_design_booklets.sql` was applied to the positively
identified `SP-Staff-Portal-DB` project after a successful rollback rehearsal
and confirmation of a completed physical backup. The exact SHA-256 was
`3af810d27c9406f2ba125cb74c0af6c09386b0ce703ba5bd2539c431d646a14e`.
Postflight verified both RLS-enabled tables, six policies, eight authenticated
table grants, zero anonymous grants, both timestamp triggers, and the private
bucket contract. No booklet, asset, or Storage object row was created by the
deployment. The date-only migration ledger was left untouched; no blanket
push, migration-up, or repair command was used.

## Content Ownership

`apps/marketing/data/products.ts` remains the canonical owner of generic roof-form and material wording. `apps/marketing/lib/designBookletContent.ts` selects existing content without strengthening it. The server-only Portal adapter at `apps/portal/lib/designBooklets/marketingContent.ts` exposes only the roof-form names and material labels needed in the booklet.

The first material choices use the public labels from `generalRoofPreference`:

- Acrylic roofing
- Solid or lined roofing
- Combination roofing

The review-page wording is fixed in `apps/portal/lib/designBooklets/pageModel.ts` and is the explicitly approved exception to the marketing-owned cover labels. Changes to that customer-facing copy require business approval.

Do not turn the `timber` intake key into a customer-facing "timber roof" claim. Do not add warranty, waterproofing, all-weather, performance percentage, timing, pricing, consent, span, or similar claims. New generic roof-form or material wording belongs in the governed marketing owner first; the booklet adapter should only select it.

## Runtime Owners

- `apps/portal/app/staff/design-booklets/**`: workbench, page composer, A4 HTML preview, PDF-authoritative drawing preview, media display states, cached PDF artifact owner, and route-owned styling.
- `apps/portal/lib/designBooklets/types.ts`: schema-v2 draft and page contracts.
- `apps/portal/lib/designBooklets/pageModel.ts`: shared page resolution, drawing layouts, focal positions, review copy, and composition helpers.
- `apps/portal/lib/designBooklets/defaults.ts`: Toni standalone asset catalogue plus neutral project-draft factory.
- `apps/portal/lib/designBooklets/request.ts`: multipart draft and image validation.
- `apps/portal/lib/designBooklets/pdf.ts`: landscape PDF renderer over the shared page model.
- `apps/portal/lib/designBooklets/pdfDrawingTitleBlock.ts`: architectural drawing-sheet title-block painter shared by every PDF drawing layout.
- `apps/portal/lib/designBooklets/marketingContent.ts`: narrow marketing-content adapter.
- `apps/portal/lib/designBooklets/projectPersistence.ts`: auth-bound project draft, private asset, and signed PDF owner.
- `apps/portal/lib/designBooklets/projectPdf.ts`: saved-asset PDF assembly and private signed export owner.
- `apps/portal/lib/designBooklets/projectClient.ts`: browser-to-staff-API and signed-upload adapter.
- `apps/portal/lib/designBooklets/imageCompression.ts`: bounded browser image resizing and JPEG compression.
- `apps/portal/app/api/staff/v1/design-booklets/pdf/route.ts`: authenticated PDF download.
- `apps/portal/app/api/staff/v1/projects/[projectId]/design-booklet/**`: project snapshot/save, signed asset upload/complete/copy, and signed PDF publication.
- `apps/portal/public/images/design-booklets/toni/**`: bundled Toni plan and renders.
- `apps/portal/app/qa/design-booklet-workbench-fixture/page.tsx`: credential-free QA mirror when `ENABLE_PORTAL_QA_FIXTURES=1`.
- `apps/portal/app/api/qa/design-booklet-workbench/pdf/route.ts`: gated QA download using the production parser and renderer.

The PDF is rendered server-side with `pdf-lib`, the Sanctuary customer-artifact palette, and the same local Instrument Sans display and Inter body assets used by the browser artifact. The workbench loads those fonts without changing the workspace package manifests.

## Image And PDF Limits

Vercel Functions currently enforce a 4.5 MB request and response payload ceiling,
so project-linked media never crosses the function as a request body. The
browser sends only small JSON to the staff API, uploads the compressed image
directly to its signed private Storage destination, and receives only a signed
URL for the generated PDF.

The project and standalone paths retain a 15 MB source-image limit. The project
path additionally:

- resizes images to a maximum 4096-pixel edge and targets a 3 MB browser upload;
- verifies and re-encodes stored images server-side with a 50-megapixel decode cap;
- allows at most 48 custom image records per project;
- keeps Storage private, project-folder scoped, and authenticated through short-lived signed URLs;
- stores only one generated `latest.pdf` export per project;
- serializes browser-requested PDF generations and reuses one artifact for drawing preview and download.

The standalone multipart server additionally:

- rejects a declared multipart request above 128 MiB before parsing its body, leaving 8 MiB of headroom over the file-total allowance for the draft and multipart framing;
- accepts PNG and JPEG only, decodes each upload, and verifies that its bytes match its declared media type;
- normalizes EXIF orientation before an uploaded image reaches the PDF renderer;
- limits all custom uploads in one request to 120 MB;
- limits each custom upload to 12,000 pixels on either side and 50 megapixels;
- allows at most 24 middle content pages;
- limits customer name to 80 characters, booklet title to 120, drawing-page titles to 80, revisions to 12, image descriptions to 240, and custom drawing titles to 80;
- requires drawing-page issue dates to be valid ISO calendar dates;
- rejects invalid or duplicate identifiers, duplicate file fields, unreferenced uploads, unsupported schema values, and malformed page or drawing-slot data.

Oversize requests return `413`; other invalid requests return `400`. API
responses are private and no-store.

## Verification

Focused checks:

```bash
node node_modules/vitest/vitest.mjs run apps/marketing/lib/designBookletContent.test.ts apps/portal/lib/designBooklets apps/portal/app/staff/design-booklets apps/portal/app/api/staff/v1/design-booklets "apps/portal/app/api/staff/v1/projects/[projectId]/design-booklet" apps/portal/app/api/qa/design-booklet-workbench apps/portal/components/layout/PortalShell.test.tsx apps/portal/proxy.test.ts test/project-design-booklets-migration.test.ts
node node_modules/@playwright/test/cli.js test playwright/portal.design-booklet-workbench.spec.ts --project=portal-fixture --workers=1
```

For deterministic PDF evidence, set `DESIGN_BOOKLET_OUTPUT_DIR=output/pdf` while running `apps/portal/lib/designBooklets/pdf.test.ts`. This writes the neutral five-page new-project booklet, the default five-page Toni booklet, and a six-page drawing-layout fixture. Render all three with Poppler and inspect every page. Browser visual QA should inspect every default page, mixed add/remove/reorder behavior, all drawing layouts, image focal positions, editable page and drawing titles, uppercase title normalization, `01 / PLAN` captions, the absence of a separate drawing-page running header, the sole bottom architectural title block, the PDF-canvas ready state, preview/download artifact reuse, media empty/loading/error states, and desktop plus narrow layouts on the gated fixture.

## Explicit Non-goals

- task creation or project workflow automation;
- Design Workbench or drawing geometry reuse;
- a reusable template administration UI or multiple saved booklet versions;
- sending, approval links, customer portal access, or automation;
- quote, pricing, costing, timing, performance, or warranty content.
