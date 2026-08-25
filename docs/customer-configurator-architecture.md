# Sanctuary "Your Pergola" Customer Configurator
## Master Architecture and Implementation Specification

> **Status:** Strategic target and active implementation roadmap. Not current behavior.
> **Repository:** `velt-design/sanctuary`
> **Reviewed branch:** `main`
> **Reviewed commit:** `f7a1436c298215a0f1562a6dc2d54ac03e2792a3`
> **Review date:** 16 August 2026
> **Recommended repository path:** `docs/customer-configurator-architecture.md`
> **Primary audience:** Product owner, senior engineer, AI coding agents, reviewers and QA operators
> **Product name in the interface:** **Your pergola**

This document is the source of truth for the customer-facing persistent pergola configurator. It defines the product experience, package boundaries, data contract, geometry pipeline, persistence, website integration, enquiry handoff, portal continuation, implementation sequence and release gates.

## Read First

- This document defines the strategic target and approved PR sequence; it does not claim the target is already implemented.
- For a code change, read the relevant current owner docs named by that PR before editing.
- Gate 0 applies to PRs that touch workbench, geometry, or costing inputs; PR 1 is contract-only and its Gate 0 legacy audit answer is N/A.
- Keep each PR bounded to its stated scope, non-goals, acceptance criteria, and completion gate.

Normative terms are used deliberately:

- **MUST** identifies a non-negotiable architectural or product requirement.
- **SHOULD** identifies the recommended default, requiring a documented reason to depart.
- **MAY** identifies a permitted but optional capability.
- **V1** means the first production release, not an internal proof of concept.

---

# 1. Executive decision

Sanctuary should build the configurator.

The correct product is not a standalone online calculator and not a simplified copy of the staff portal. It is a persistent customer design object that travels through the marketing website, lets visitors shape their project visually, and reaches Sanctuary as structured design intent.

The target flow is:

```text
Browse Sanctuary
    v
Start or update "Your pergola"
    v
View the same solved pergola in 3D, elevation and plan
    v
Continue browsing with choices preserved
    v
Submit the configuration with the enquiry
    v
Existing website intake creates contact, project and enquiry
    v
Staff open the immutable customer intent in the portal
    v
Staff confirm site, construction and commercial assumptions
    v
Continue in the Design Workbench and existing costing/quote workflows
```

## 1.1 Authoritative architecture decision

The implementation MUST introduce two reusable package boundaries:

1. **`@sp/configurator`**
   A pure, universal package owning the versioned customer design-intent contract, parsing, normalization, migrations, customer-safe defaults, geometry adapters, interaction anchors, summaries and presentation accessory derivation.

2. **`@sp/geometry-viewer`**
   A read-only presentation package consuming `@sp/geometry` solved outputs. It owns shared scene rendering, camera modes, bounds, materials, a customer-safe top-projection renderer and viewer fallbacks. It does not own geometry, persistence, portal tools or customer product policy.

The marketing app MUST own the website-specific experience:

- the global lightweight state provider;
- the closed dock;
- the large dialog;
- customer controls;
- route eligibility;
- overlay coordination;
- browser persistence;
- contextual website actions;
- enquiry attachment;
- analytics.

The portal MUST own:

- staff review;
- import into the object-first Design Workbench;
- construction assumptions;
- costing;
- quotes;
- technical tools;
- project persistence after handoff.

## 1.2 Non-negotiable source-of-truth rule

There MUST be one authored customer-intent model and one solved physical geometry path.

```text
CustomerPergolaConfiguration
        v
@sp/configurator adapter
        v
@sp/geometry
        v
Solved geometry artifact
   /          v           \
Plan      Elevation       3D
```

The following are prohibited:

- a CSS-only pergola model that independently calculates member positions;
- a marketing-only geometry engine;
- separate plan, elevation and 3D dimension logic;
- copying staff calculator types into the public contract;
- deriving portal geometry from screenshots or rendered meshes;
- treating a customer configuration as engineered, priced or construction-ready.

## 1.3 Product scope decision

V1 will support one pergola configuration with:

- pitched, gable, hip and box-perimeter forms;
- length, projection and approximate clear height;
- attached or freestanding placement;
- simplified house and site context;
- black, white or other frame finish intent;
- acrylic, solid timber-sarking and combination roof intent;
- acrylic tint;
- one governed combination-roof pattern;
- edge-based blinds or fixed acrylic infills;
- integrated downlight intent;
- heating interest captured for staff review;
- fixed 3D, orthographic elevation and plan;
- a separate interactive 3D explore mode;
- device-local persistence across routes and return visits;
- enquiry and portal handoff.

V1 will not provide public pricing for the general configurator.

## 1.4 Delivery effort

This is a medium-large product programme, but the repository already contains much of the difficult geometry and portal infrastructure.

A realistic agent-assisted effort is:

| Milestone | Outcome | Focused engineering effort |
|---|---|---:|
| Architecture foundation | Contracts, adapter and shared viewer boundary | 15-25 engineer-days |
| Internal integrated prototype | Dock, dialog, persistence and three views | 15-25 engineer-days |
| Production V1 | Public controls, site context, comfort options, enquiry handoff and hardening | 25-40 engineer-days |
| Website-wide contextual layer | Product/project actions, similarity and refinement | 10-20 engineer-days |

For one experienced engineer directing AI coding agents, a credible planning range is:

- **4-6 weeks** for a strong internal prototype;
- **8-12 weeks** for a production V1 through enquiry;
- **10-16 weeks** for the full programme described in this document, including portal continuation and contextual website actions.

These are planning ranges, not promises. WebGL/mobile QA, shared-viewer extraction and intake migration are the main schedule variables. AI agents reduce implementation time but do not remove architecture review, regression testing or physical-device validation.

---

# 2. Product principles

## 2.1 The configurator is a design conversation

The public interface should ask customers about outcomes and visible design decisions. It should not reproduce staff terminology merely because those fields exist in the calculator.

Use:

- "Attached to the house"
- "Freestanding"
- "Clear acrylic"
- "Solid roof with timber ceiling"
- "Add a blind to this edge"
- "Approximate clear height"

Do not expose:

- flashing bands;
- gutter ownership;
- downpipe elbows;
- pile depth;
- rafter profile overrides;
- quote discounts;
- costing classifications;
- structural member selection.

## 2.2 Customer intent, Sanctuary resolution

The customer selects meaningful intent. Sanctuary resolves construction.

Every preview and handoff MUST retain this distinction:

> Concept configuration. Final structure, connections, drainage, approvals and product selections are confirmed by Sanctuary.

A successful geometry solve means that a concept can be rendered. It does not mean:

- structurally adequate;
- consent-exempt;
- buildable on the supplied site;
- eligible for a published price;
- approved by Sanctuary.

## 2.3 One configuration follows the visitor

The saved object should gradually become "their pergola". A visitor should be able to:

- start on the homepage;
- change the roof on a product page;
- browse projects;
- return to the dialog;
- close the browser;
- come back later;
- submit the same configuration.

Persistence is a product capability, not a hidden technical detail. The dialog should say **Saved on this device** after a successful write.

## 2.4 The preview must remain calm and legible

The default 3D view is composed and mostly fixed. The visitor should not accidentally rotate the model while trying to change a control.

Full orbit and pinch zoom belong in the separate **Explore in 3D** mode.

## 2.5 Truth before visual spectacle

When the configuration cannot be solved or WebGL is unavailable:

- keep all customer choices;
- keep the form usable;
- show a plan or textual fallback;
- explain that Sanctuary will review the combination;
- never substitute a visually convincing but unrelated model.

## 2.6 No essential information lives only in the model

A blind, roof, dimension or site choice must also be represented in labelled controls and a textual configuration summary. The canvas is an enhancement, not the only way to understand or operate the feature.

## 2.7 Performance is part of the brand

The global dock must not cause the ordinary marketing site to pay the full Three.js, React Three Fiber or geometry cost before the visitor opens the configurator.

## 2.8 Contextual actions are typed transactions

"Use this roof" and "Use this project as a starting point" must apply typed, reviewed patches. They must never parse marketing copy to infer a configuration.

## 2.9 The original customer intent is immutable after submission

Staff work creates a derivative project design. It must not rewrite what the customer originally submitted.

---

# 3. Verified current-repository capabilities

The following findings are verified against the reviewed commit.

## 3.1 Capability map

| Area | Current capability | Relevant owners |
|---|---|---|
| Geometry source of truth | `@sp/geometry` owns normalized physical geometry, assemblies, viewer scenes, plan/section models, top projections, validation and takeoff | `packages/geometry/**` |
| Public geometry solve | `solvePergolaGeometry()` accepts a neutral `PergolaGeometryInput` and returns configuration, assembly, validation, viewer scene, top projection, plan, section and takeoff | `packages/geometry/src/solvePergolaGeometry.ts` |
| Supported families | Mono, gable, box, hip and hip-corner are represented in the geometry contracts and solver path | `packages/geometry/src/contracts.ts`, `solvePergolaGeometry.ts` |
| Project geometry | `solveProject()` accepts one project house plus multiple pergolas, while retaining a transitional per-pergola house-context seam | `packages/geometry/src/solveProject.ts` |
| House geometry | Package contracts support house footprints, presets, custom polygons, position, storeys, roof intent, eaves, decks, openings and attachment strategies | `packages/geometry/src/contracts.ts`, `houseModel.ts`, `footprints.ts` |
| 3D scene contract | `ViewerSceneModel` represents members, roof planes, cladding, flashings and detailed house solids in deterministic layers | `packages/geometry/src/viewer.ts` |
| Plan source | A scene-first top projection provides canonical object shapes and parity checks; a separate plan view model also exists | `packages/geometry/src/topProjection.ts`, `plan.ts` |
| Section source | A technical YZ section view model exists | `packages/geometry/src/section.ts` |
| Object-first workbench | The current Design Workbench already targets one `WorkbenchProjectModel` feeding one solved project artifact consumed by Plan and 3D | `docs/design-workbench-architecture.md`, `apps/portal/lib/drawings/state/**` |
| Portal 3D viewer | React Three Fiber viewer supports scene rendering, bounds, selection, orbit controls, perspective and top orthographic mode | `apps/portal/components/drawings/viewports/Geometry3DViewport/**` |
| Portal Plan editor | Canvas-based Plan viewport consumes package top-projection shapes and owns editing, snapping, direct manipulation and CAD tooling | `apps/portal/components/drawings/viewports/PlanViewport/**` |
| Camera presets | Existing portal camera state includes iso, front, right, top and custom presets | `Geometry3DViewport/interaction/cameraState.ts` |
| Staff configuration | Calculator has structured sections for site, structure, lighting, blinds, infills, allowances, flashings and overrides | `apps/portal/app/staff/calculator/**` |
| Public calculator | The Simple Cover calculator has a narrow public input model, public-safe server result, responsive UI and enquiry continuation | `apps/marketing/components/simple-cover-calculator/**`, `apps/marketing/lib/simpleCoverCalculator.ts` |
| Browser handoff | Existing Simple Cover state is strictly parsed and stored in `sessionStorage` | `apps/marketing/lib/simpleCoverHandoff.ts` |
| Enquiry intake | A successful enquiry already creates contact, project, enquiry request and a draft estimate | `apps/marketing/app/api/enquiry/route.ts`, `apps/marketing/lib/enquiryIntake.ts` |
| Intake security | Same-origin checks, body limits, sanitization, honeypot, UUID idempotency, rate limiting and private attachment verification already exist | `apps/marketing/app/api/enquiry/route.ts`, `marketingPublicRequest.ts` |
| Marketing design system | Instrument Sans/Inter, square geometry, fine rules, no shadows and olive action treatment are documented | `docs/marketing-ui-foundation.md` |
| Mobile programme | The repository has explicit 360, 390 and 430px responsive evidence and established no-overflow/CLS/target checks | `docs/mobile-ux-roadmap-v2.md`, Playwright suites |
| Performance gates | Mobile Lighthouse requires at least 0.90 performance, 0.95 accessibility, 0.95 best practices and 1.00 SEO | `.lighthouserc.mobile.json` |
| Repo governance | Package boundaries, changed-file architecture reports and hotspot decomposition are already enforced or reported | `package.json`, `docs/file-decomposition-and-ownership.md` |

## 3.2 Existing architecture that should be reused

### `@sp/geometry`

This package is already the correct physical source of truth. The customer configurator should call `solvePergolaGeometry()` through a public-intent adapter.

For V1, one pergola is sufficient. Future multi-pergola support should move to `solveProject()` rather than creating another orchestration path.

### Object-first Design Workbench

The workbench's declared target architecture already aligns with the configurator:

```text
WorkbenchProjectModel
  -> geometry solve
  -> WorkbenchSolvedGeometryArtifact
  -> Plan / 3D / future Section / Snap / Diagnostics
```

The customer configurator should not import the workbench model directly, but its submitted intent should have one explicit import adapter into that model.

### Viewer scene

The scene model is suitable for reuse. It already carries enough geometry to render:

- posts;
- beams;
- rafters;
- joiners;
- gutters;
- roof cladding;
- roof planes;
- flashings;
- house walls, roofs, openings, eaves and solids.

### Scene-first top projection

The public plan should consume `GeometryTopProjectionViewModel`, not rebuild rafters and posts with route-local CSS. A read-only SVG or canvas renderer may differ from the staff Plan editor, but the shape data must be the same.

### Existing enquiry transaction

The configurator should extend the existing enquiry transaction. It should not create another lead endpoint, another contact pipeline or another project-creation flow.

## 3.3 Current conflicts and migration seams

### Conflict A: marketing does not currently carry the 3D stack

The marketing app has no current dependency on:

- `@sp/geometry`;
- Three.js;
- React Three Fiber;
- Drei.

The portal does. Adding these to the initial marketing bundle would be unacceptable. The solution is subpath exports and dynamic loading, not avoiding package reuse.

### Conflict B: the portal 3D component is not a customer viewer

`Geometry3DViewport` mixes:

- scene rendering;
- CAD selection;
- hover;
- diagnostics;
- measurement probes;
- section cuts;
- layer visibility;
- project-health telemetry;
- staff camera controls.

It must not be copied into marketing. Shared renderers and camera primitives should be extracted; the portal and marketing apps should compose different shells.

### Conflict C: the public Simple plan is a parallel simplified model

The current Simple Cover plan manually calculates and draws members in marketing code. It is appropriate for that bounded legacy calculator, but it must not become the new configurator architecture.

The general configurator plan must use `@sp/geometry` top projection.

### Conflict D: current public persistence is same-tab only

`simple-cover-handoff.v1` uses `sessionStorage`. The new experience requires `localStorage`, migrations, cross-tab synchronization and return-visit behavior.

### Conflict E: accessories are commercial/configuration concepts, not solved scene objects

Blinds, infills, lighting and heaters are not currently complete first-class objects in the shared solved scene. Their staff pricing/configuration models exist, but their customer visual representation needs a new presentation-layer contract derived from solved geometry anchors.

This must not become another independent pergola model.

### Conflict F: some workbench types still import calculator-owned value unions

The public package must not deepen this coupling. It should depend on `@sp/geometry` and its own customer contract, not `apps/portal/lib/types/calculator.ts`.

Where a value is truly shared across products, move the neutral enum to an appropriate package in a focused migration rather than importing an app-local type.

### Conflict G: project-level house solving remains transitional

`solveProject()` still calls per-pergola geometry solves and checks house-context consistency. V1 has one pergola, so it can use the stable `solvePergolaGeometry()` entry. Multi-pergola public design should wait until the project-level shared-house path is fully canonical.

### Conflict H: current "front" and "right" views are perspective presets

The customer's **Elevation** view should be true orthographic front/side projection. A shared camera contract must add orthographic front and orthographic side modes rather than relabelling a slightly elevated perspective camera as an elevation.

### Conflict I: the website already has competing fixed layers

Verified current layers include:

- header around `z-index: 2000`;
- legacy project overlays around `3000-4000`;
- consent banner at `5000`;
- skip link at `6000`;
- a mobile menu with its own portal and scroll lock.

The marketing UI foundation explicitly avoided adding a generic global sticky action because these controls can collide on short viewports. The configurator requires an overlay coordinator and measured bottom occupancy.

### Conflict J: general enquiry pricing currently synthesizes calculator defaults

The existing enquiry route can build a generic calculator snapshot and draft estimate from a few public fields. A rich customer configuration must not be presented as fully priced or construction-resolved through those generic defaults.

For V1, the configuration handoff is design intent. Existing indicative budget behavior may remain for existing forms, but the configurator must not silently convert its complete-looking model into a final price.

---

# 4. Target UX

## 4.1 Global experience states

The experience has four primary states:

1. **Dormant**
   - No configuration exists.
   - On an eligible route, the empty dock appears after the visitor scrolls approximately 120px or interacts with the page.
   - It does not compete with the first hero frame.

2. **Configured**
   - A valid local configuration exists.
   - The dock appears immediately on eligible routes after hydration.
   - It displays the concise configuration summary.

3. **Configuring**
   - The large dialog is open.
   - The dock is hidden.
   - Page background is inert and scroll-locked.
   - Choices auto-save.

4. **Exploring**
   - The interactive 3D view occupies the dialog.
   - Configuration controls are temporarily hidden.
   - A clear **Back to configure** action returns to the same state.

## 4.2 Closed dock

### Recommended visual treatment

The dock is a thin architectural project strip, not a rounded SaaS pill.

```text
+---------------------------------------------------------+
| YOUR PERGOLA   Gable * 5.5 x 4.2 m * Mixed roof   Edit |
+---------------------------------------------------------+
```

Design:

- warm-white surface;
- 1px charcoal border;
- square corners or maximum 2px radius;
- no drop shadow;
- Instrument Sans label and Inter details;
- olive reserved for the action/active state;
- no thumbnail or live canvas;
- restrained pressed state;
- minimum 48px interactive height.

### Empty state

```text
YOUR PERGOLA                         Start designing
```

### Configured state

Summary order:

1. form;
2. length x projection;
3. roof;
4. optional count badge for selected comfort items.

Examples:

- `Pitched * 6.0 x 3.5 m * Clear acrylic`
- `Gable * 5.5 x 4.2 m * Timber + acrylic`
- `Box perimeter * 8.0 x 3.2 m * Opal acrylic * 2 options`

### Dimensions

Desktop:

- width: `min(600px, calc(100vw - 48px))`;
- height: 56px;
- bottom: 20-24px;
- horizontally centered.

Mobile:

- left/right: 12px;
- height: 54-58px;
- bottom: `12px + env(safe-area-inset-bottom) + occupiedBottomInset`;
- text truncates before the action;
- action retains a minimum 48px target.

## 4.3 Desktop dialog

Recommended outer size:

- width: `min(96vw, 1600px)`;
- height: `min(92dvh, 1050px)`;
- centered;
- square fine-rule frame;
- dimmed backdrop;
- no decorative shadow beyond a minimal separation treatment where required for contrast.

### Layout

```text
+---------------------------------------------------------------+
| Your pergola                Saved on this device          x   |
+-----------------------------------------------------------------+
|                                                               |
|                         MODEL VIEW                            |
|                                                               |
|                    [3D] [Elevation] [Plan]                    |
|                                             Explore in 3D     |
+-----------------------------------------------------------------+
| Structure      Roof      Comfort      Site                    |
| ---------                                                     |
| Form      Gable        Length 5.5m       Projection 4.2m     |
| Height    2.4m         Attached           Black frame         |
+---------------------------------------------------------------+
```

Proportions:

- header: 56-64px;
- viewer: 62-66% of remaining height;
- controls: 34-38%;
- the control category row is sticky within the control area;
- control content scrolls independently;
- the model does not scroll away while editing.

### View controls

`3D / Elevation / Plan` sit inside or immediately below the viewer. They are not mixed with the configuration categories.

This establishes:

- **view tabs:** how the customer is looking;
- **control tabs:** what the customer is changing.

### Desktop close behavior

The dialog closes through:

- explicit close button;
- Escape;
- backdrop click.

Close must be safe because the configuration is auto-saved. Focus returns to the control that opened it.

## 4.4 Mobile dialog

At 430, 390 and 360px the dialog becomes full-screen:

- `100dvw x 100dvh`;
- safe-area aware;
- no wasted outside gutter;
- explicit close/minimize button;
- no backdrop-click dismissal.

Default portrait proportions:

- header: 56px;
- viewer: 52-56% of remaining viewport;
- controls: 44-48%;
- controls scroll independently.

When the software keyboard opens:

- the global dock remains hidden;
- viewer compresses to approximately 30-36% or collapses to a compact preview header;
- the active input stays visible;
- controls retain at least one full field and its validation text above the keyboard;
- the dialog uses `visualViewport` rather than assuming `100vh`.

Mobile landscape may switch to:

- 58-62% viewer on the left;
- 38-42% controls on the right.

A draggable split divider is deferred. Fixed responsive proportions are more predictable for V1.

## 4.5 Configuration categories

The customer categories are:

1. **Structure**
2. **Roof**
3. **Comfort**
4. **Site**

### Structure

- form;
- length;
- projection;
- approximate clear height;
- attached/freestanding;
- frame finish.

### Roof

- roof system;
- acrylic tint where relevant;
- governed combination-roof layout;
- short daylight/shade explanation.

### Comfort

- edge treatments;
- blinds;
- fixed acrylic infills;
- integrated downlights;
- dimming;
- heating interest.

### Site

- house footprint preset;
- one/two-storey;
- house roof form;
- deck/ground/elevated;
- attachment side;
- likely connection or "Not sure".

## 4.6 Default 3D configuration mode

The default 3D mode uses:

- a composed isometric perspective;
- automatic fit to the complete house/pergola scene;
- no pan;
- no accidental orbit;
- optional restrained zoom buttons;
- deterministic re-fit when family or site context changes substantially.

The model should feel stable as controls change.

## 4.7 Elevation mode

Elevation is a true orthographic view.

V1 provides:

- front elevation;
- side elevation through a compact sub-control.

It does not use the existing technical section model as the main customer elevation. The section model may support future technical overlays but is not the same customer task.

## 4.8 Plan mode

Plan uses a read-only architectural SVG generated from the canonical top projection.

It should show:

- pergola outline;
- posts and primary members;
- roof direction where relevant;
- house footprint;
- selected edge treatments;
- length and projection dimensions;
- selected edge highlight.

It should not show staff construction annotations, profile IDs or diagnostics.

## 4.9 Explore in 3D

**Explore in 3D** opens a presentation mode with:

- orbit;
- pinch/wheel zoom;
- reset view;
- fit model;
- optional front, side and top quick views;
- clear gesture instruction;
- **Back to configure**.

V1 does not include:

- object editing;
- member selection;
- measurement probes;
- section cuts;
- debug layers;
- structural diagnostics;
- individual light placement.

## 4.10 Edge selection

Comfort options use stable semantic edges.

In 3D or plan:

- tapping/clicking an eligible edge highlights it;
- a compact chooser identifies `Front`, `Left`, `Right` or `Rear`;
- the selected edge's treatment appears in the control area.

There must also be a complete non-graphical edge list. Pointer selection cannot be the only path.

When attached to a house, the hosted edge is not offered for a blind unless the eventual product model explicitly supports that condition.

## 4.11 Saving feedback

No primary Save button is required for local state.

The header status uses:

- `Saving...`
- `Saved on this device`
- `Couldn't save on this device`

The state should only announce meaningful transitions; it must not repeatedly interrupt screen-reader users during slider changes.

## 4.12 Loading and solve states

### First open

1. dialog shell appears immediately;
2. existing summary and controls render;
3. lightweight plan placeholder or cached top projection appears;
4. geometry/viewer chunk loads;
5. 3D fades in without resizing the layout.

### Incomplete input

Show the last valid preview with a clear **Preview updating when dimensions are complete** status, but never submit stale derived geometry as current.

### Invalid or unsupported combination

Keep the customer intent and show:

> This combination needs Sanctuary review. Your choices are still saved.

The affected controls remain editable. Plan/text summary remains available where possible.

### WebGL unavailable

- Plan becomes the default view.
- 3D and interactive explore are disabled with an explanation.
- The configurator and enquiry remain fully usable.
- No repeated context-creation loop occurs.

### WebGL context loss

- attempt one controlled remount;
- if it fails, dispose the renderer and switch to fallback;
- retain all intent state.

## 4.13 No-JavaScript behavior

Without JavaScript:

- the marketing website remains fully readable;
- the dock does not appear;
- enquiry forms retain their existing POST fallback;
- no customer choices are placed in a GET URL;
- no essential route content is hidden.

---

# 5. Public configuration model

## 5.1 Ownership rule

The public contract describes customer intent only.

It must not be an alias of:

- `CalculatorInputs`;
- `CalculatorModuleInputs`;
- `WorkbenchProjectModel`;
- `RawGeometryModuleInput`;
- `SiteInputsV1`.

Those are downstream or internal contracts.

## 5.2 Recommended V1 contract

The following shape is normative in meaning. Exact TypeScript organization may vary only where package style requires it.

```ts
export type CustomerPergolaConfigurationV1 = {
  schemaVersion: 'customer_pergola_configuration.v1';
  configurationId: string;       // client-generated UUID; not a secret
  revision: number;
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  source: {
    kind:
      | 'blank'
      | 'simple_cover_import'
      | 'product_seed'
      | 'project_seed';
    sourcePath: string | null;
    sourceSlug: string | null;
  };
  intent: {
    pergola: CustomerPergolaIntentV1;
    site: CustomerSiteIntentV1;
  };
};

export type CustomerPergolaIntentV1 = {
  id: 'pergola-1';
  family: 'mono' | 'gable' | 'hip' | 'box';
  dimensions: {
    lengthMm: number;
    projectionMm: number;
    clearHeightMm: number;
  };
  placement: {
    mode: 'attached' | 'freestanding';
    attachmentSide: 'rear' | 'front' | 'left' | 'right';
    connectionIntent:
      | 'unsure'
      | 'soffit'
      | 'fascia'
      | 'wall'
      | 'none';
  };
  frame: {
    finish: 'black' | 'white' | 'other';
    otherColourName: string | null;
  };
  roof: CustomerRoofIntentV1;
  edgeTreatments: CustomerEdgeTreatmentV1[];
  lighting: {
    downlights: 'none' | 'subtle' | 'standard' | 'bright';
    dimmerRequested: boolean;
    ledStripInterest: boolean;
  };
  heatingInterest: 'none' | 'interested';
};

export type CustomerRoofIntentV1 =
  | {
      system: 'acrylic';
      tint: 'clear' | 'light_grey' | 'dark_grey' | 'opal';
    }
  | {
      system: 'solid_timber_sarking';
      ceilingIntent: 'natural_timber';
    }
  | {
      system: 'mixed';
      tint: 'clear' | 'light_grey' | 'dark_grey' | 'opal';
      layout:
        | 'central_skylight_narrow'
        | 'central_skylight_standard'
        | 'central_skylight_wide';
    };

export type CustomerEdgeIdV1 =
  | 'front'
  | 'left'
  | 'right'
  | 'rear';

export type CustomerEdgeTreatmentV1 = {
  edgeId: CustomerEdgeIdV1;
  treatment:
    | { kind: 'none' }
    | {
        kind: 'blind';
        fabric: 'mesh' | 'fine_mesh' | 'clear_pvc';
        operation: 'manual' | 'motorised';
      }
    | {
        kind: 'fixed_acrylic';
        tint: 'clear' | 'opal';
      };
};

export type CustomerSiteIntentV1 = {
  level: 'ground' | 'deck' | 'elevated' | 'unsure';
  house: {
    present: boolean;
    footprint:
      | 'straight'
      | 'l_left'
      | 'l_right'
      | 'recess_left'
      | 'recess_right';
    storeys: 'one' | 'two' | 'unsure';
    roofForm: 'hipped' | 'gable' | 'mono' | 'flat' | 'unsure';
  };
};
```

## 5.3 Contract invariants

The parser and normalizer MUST enforce:

- exactly one pergola in V1;
- integer millimetres;
- bounded dimensions;
- a non-empty UUID configuration ID;
- monotonic positive revision;
- bounded custom colour name;
- no unknown executable values;
- one treatment per edge;
- unique edge IDs;
- `connectionIntent: none` when freestanding;
- no hosted-edge treatment when the edge is structurally attached;
- mixed layout only for a mixed roof;
- no arbitrary URLs;
- no contact information;
- no uploaded media;
- no price;
- no costing reference other than an explicitly isolated legacy Simple reference during migration.

Recommended public bounds:

| Field | Minimum | Maximum | Step |
|---|---:|---:|---:|
| Length | 1,500mm | 15,000mm | 100mm |
| Projection | 1,500mm | 10,000mm | 100mm |
| Clear height | 2,000mm | 5,000mm | 50mm |

The UI may use a narrower recommended range while accepting bounded manual input. Large dimensions should produce **Custom review** messaging rather than pretending to be standard.

## 5.4 Direct, derived, hidden and staff-only matrix

| Concept | Customer direct control | Automatically derived | Hidden but preserved | Staff-only |
|---|---|---|---|---|
| Pergola form | Pitched, gable, hip, box perimeter | Geometry family mapping | Source seed | Hip-corner and multi-module composition in V1 |
| Length/projection | Yes | Area, member layout, view fit | Integer-mm canonical value | Final site-measured dimensions |
| Clear height | Approximate | Representative member positions | Customer-entered value | Final ledger/eave/post heights |
| Attached/freestanding | Yes | Default post arrangement | Attachment side and intent | Exact host edge, bracket/ledger strategy |
| House connection | Soffit/fascia/wall/not sure | Geometry connection mapping | Customer confidence | Structural fixings, flashing and tieback |
| Frame finish | Black/white/other | Presentation palette | Other-colour name | Powdercoat procurement, surcharge and specification |
| Roof system | Acrylic/solid timber-sarking/mixed | Geometry roof material/mode | Customer roof intent | Exact panel product, roof-above system, trays and flashings |
| Acrylic tint | Clear/light grey/dark grey/opal | Presentation material | Selected tint | Supplier confirmation and performance claims |
| Mixed layout | Three central-skylight widths | Bay count/pattern | Intent enum | Raw bay editing and detailed transitions |
| Pitch | No direct V1 control | Family/site default | None | Exact pitch, fall envelope and drainage |
| Post count | No | Suggested representative layout | None | Final structural/support design |
| Rafter count/spacing | No | Geometry solver | None | Override and engineering |
| Gable end framing | No | Representative default | None | End-frame mode, tie beam and strut details |
| Gutters/downpipes | No | Representative visual where solved | None | Ownership, type, outlets, joins, elbows and discharge |
| Blinds | Edge, fabric and operation intent | Indicative edge plane | Intent selection | Ziptrak/Omni, panelization, limits, pelmet and exact dimensions |
| Fixed infills | Edge and tint | Indicative panel geometry | Intent selection | Supports, panel orientation, stock takeoff and opening confirmation |
| Downlights | None/subtle/standard/bright, dimmer | Indicative count and positions | Customer intensity | Exact fitting, driver count, circuit and electrical scope |
| LED strip | Interest only in V1 | None | Interest | Product, position, driver and electrical design |
| Heaters | Interest only in V1 | None | Interest | Product, output, clearance, position and electrical scope |
| House footprint | Five simple presets | Raw house input | Chosen preset | Custom polygon, openings, decks and exact position |
| Storeys | One/two/not sure | Representative wall/eave height | Selection | Exact house/eave geometry |
| House roof form | Hipped/gable/mono/flat/not sure | Geometry roof intent mapping | Selection | Exact ridge/open-end composition |
| Level | Ground/deck/elevated/not sure | Preview base treatment | Selection | Access, footing, piles/slab/deck brackets and approvals |
| Pricing | No general V1 price | None | None | Costing classification, published config, allowances and discount |
| Approvals | No | None | None | Engineering, building consent and exemptions |
| Site difficulty | No | None | None | Access, ground, travel and logistics |
| Structural overrides | No | Package defaults for concept | None | Every profile override |
| Flashings/additional aluminium | No | None | None | All calculator controls |
| Quote discount | No | None | None | Staff-only |

## 5.5 Control-copy decisions

Use these labels:

- `Pergola form`
- `Length`
- `Projection`
- `Approximate clear height`
- `Attached to the house`
- `Freestanding`
- `What would it likely attach to?`
- `Frame colour`
- `Roof`
- `Acrylic tint`
- `Skylight width`
- `Edge options`
- `Integrated downlights`
- `Dimming`
- `Interested in heating`
- `House shape`
- `House height`
- `Outdoor area level`

Avoid staff labels such as:

- `postCutHeightM`;
- `houseConnectionType`;
- `mixedAcrylicBaysMain`;
- `extrusionColour`;
- `postConnectionType`.

## 5.6 Compatibility behavior

When a customer changes one selection and another becomes incompatible:

- do not silently submit stale derived geometry;
- keep meaningful intent where possible;
- show a review note;
- offer a clear fix.

Example:

> Integrated downlights for this roof will be confirmed by Sanctuary.

The raw technical defaults supplied to `@sp/geometry` are transient. They are not persisted as customer choices.

---

# 6. Domain and data architecture

## 6.1 Sources of truth

| Layer | Source of truth |
|---|---|
| Customer authored intent | `CustomerPergolaConfigurationV1` |
| Physical concept geometry | `@sp/geometry` solved artifact |
| Presentation accessories | Deterministic derivation from customer intent plus solved geometry anchors |
| Local persistence | Versioned local-storage envelope |
| Submitted original | Immutable server `customer_configurations` record |
| Staff design | Workbench project model derived from the submitted original |
| Pricing | Existing `@sp/costing` and calculator/commercial boundaries |
| Quote | Existing quote persistence |

## 6.2 Package exports

Recommended `@sp/configurator` subpaths:

```text
@sp/configurator/core
  contracts
  defaults
  parser
  normalize
  migrations
  summaries
  controlled option catalogues

@sp/configurator/geometry
  customerConfigurationToPergolaGeometryInputV1
  customerSiteToRawHouseInputV1
  solveCustomerConfigurationV1
  interaction-anchor mapping
  accessory-scene derivation
  customer-safe diagnostics

@sp/configurator/handoff
  server-safe submitted envelope parser
  canonical summary
  persistence payload builder
  workbench import provenance contract
```

The lightweight marketing provider MUST import only `@sp/configurator/core`. Geometry code is dynamically imported after the dialog opens.

## 6.3 Solved configurator artifact

```ts
export type ConfiguratorSolvedArtifactV1 =
  | {
      status: 'ready' | 'review_required';
      configuration: CustomerPergolaConfigurationV1;
      geometryInput: PergolaGeometryInput;
      geometry: {
        config: GeometryConfig;
        assembly: Assembly3D;
        viewerScene: ViewerSceneModel;
        topProjection: GeometryTopProjectionViewModel;
        section: GeometrySectionViewModel;
        validation: GeometryValidationReport;
      };
      interactionAnchors: CustomerInteractionAnchorsV1;
      presentationScene: CustomerPresentationSceneV1;
      messages: CustomerSafeConfiguratorMessageV1[];
    }
  | {
      status: 'incomplete' | 'invalid' | 'unsupported';
      configuration: CustomerPergolaConfigurationV1;
      messages: CustomerSafeConfiguratorMessageV1[];
      lastReadyArtifact?: ConfiguratorSolvedArtifactV1;
    };
```

`review_required` means the concept can render but contains assumptions. It does not mean failed geometry.

## 6.4 Interaction anchors belong near geometry

Edge and light positions must not be re-created in marketing code.

Add a geometry-neutral builder, preferably in `@sp/geometry`, that derives:

```ts
type PergolaInteractionAnchors = {
  edges: Array<{
    id: 'front' | 'left' | 'right' | 'rear';
    centerline: Line3;
    outwardNormal: Vector3;
    bottomZ: number;
    topZ: number;
    hosted: boolean;
  }>;
  lightingRuns: Array<{
    id: string;
    centerline: Line3;
    kind: 'rafter' | 'perimeter';
  }>;
};
```

The configurator package maps these physical anchors to customer semantics.

## 6.5 Presentation scene

Accessories that do not alter the primary structure should be a presentation layer:

```ts
type CustomerPresentationSceneV1 = {
  base: ViewerSceneModel;
  layers: CustomerPresentationLayerV1[];
};
```

Initial accessory object types:

- `blind_panel`;
- `fixed_infill_panel`;
- `downlight_marker`;
- `selected_edge_highlight`.

Rules:

- every accessory object references an interaction anchor ID;
- no accessory object defines independent pergola dimensions;
- if its anchor disappears, it becomes unresolved and is not rendered;
- an unresolved accessory remains in customer intent and produces a review message;
- future accessories that affect physical structure must migrate into `@sp/geometry`.

## 6.6 Presentation attributes

Frame finish and acrylic tint are visual/customer attributes rather than primary geometry.

The viewer receives a material resolver:

```ts
resolveCustomerMaterial({
  sceneObject,
  configuration,
  selected,
  hovered,
  viewMode
})
```

It should not mutate package geometry.

## 6.7 UI state is separate

Do not place transient interface state in the durable configuration.

Separate UI state includes:

- dialog open/closed;
- active category tab;
- active view;
- selected edge;
- explore camera;
- draft input text before commit;
- current focus;
- loading state.

The active tab/view MAY be stored in `sessionStorage` as a convenience. The modal-open state and camera orbit MUST not persist across visits.

---

# 7. Geometry and view architecture

## 7.1 Geometry pipeline

```mermaid
flowchart TD
  A[CustomerPergolaConfigurationV1] --> B[@sp/configurator/core normalize]
  B --> C[@sp/configurator/geometry adapter]
  C --> D[PergolaGeometryInput + RawHouseInput]
  D --> E[@sp/geometry solvePergolaGeometry]
  E --> F[Assembly3D]
  E --> G[ViewerSceneModel]
  E --> H[GeometryTopProjectionViewModel]
  E --> I[Validation]
  F --> J[Interaction anchors]
  G --> K[Presentation scene]
  J --> K
  A --> K
  H --> L[Read-only plan SVG]
  K --> M[Fixed 3D]
  K --> N[Orthographic elevation]
  K --> O[Interactive 3D]
```

## 7.2 Geometry adapter responsibilities

The adapter owns:

- family mapping;
- numeric unit conversion;
- representative roof pitch;
- representative support defaults;
- connection mapping;
- house preset mapping;
- mixed-roof bay derivation;
- customer-safe warnings;
- stable IDs.

It does not own:

- member solving;
- roof planes;
- house roof construction;
- top projection;
- pricing;
- engineering.

## 7.3 Family mapping

| Public family | Geometry family |
|---|---|
| `mono` | `mono` |
| `gable` | `gable` |
| `hip` | `hip` |
| `box` | `box` |

`hip_corner` is deferred because its irregular perimeter, edge semantics and customer input model require a separate release.

## 7.4 Roof mapping

| Public roof | Geometry input |
|---|---|
| Acrylic | material `acrylic` |
| Solid timber-sarking | material/mode representing current timber roof system |
| Mixed | material `mixed`, with governed bay counts derived from layout |
| Open/no roof | Deferred until it is a first-class shared geometry path |

The adapter must use package capability detection rather than assuming every family supports every roof.

## 7.5 Mixed-roof decision

V1 does not expose raw acrylic bay counts.

It exposes three central-skylight widths. The adapter converts them to a deterministic bay count based on solved/derived rafter bays.

If current geometry cannot guarantee the physical location of acrylic bays, PR 2 must add a package-owned deterministic mixed-roof pattern contract before V1 exposes the control. Marketing must not simulate the pattern independently.

## 7.6 House mapping

The public house presets map to `RawHouseInput` through package footprint helpers.

V1 uses:

- one house;
- one simple footprint preset;
- representative position adjacent to the attachment edge;
- representative storey/eave dimensions;
- selected roof form.

The exact house polygon and relationship can be refined in the portal. Customer house geometry is context, not a survey.

PR 2 Slice 2 keeps runtime identity explicit: `customerConfigurationToPergolaGeometryInputV1()` requires caller-supplied `projectId` and `estimateId` context and never aliases public configuration/pergola IDs into those fields. `clearHeightMm` remains the representative minimum clearance and exact post-cut height; mono derives only its higher reference side from the representative pitch. Mixed roof returns `mixed_roof_placement_unavailable` until canonical bay placement exists. Attached intent without a present house returns `attached_house_required`; freestanding intent retains any site-house choice in customer intent but omits unplaceable host geometry and returns `freestanding_house_context_unplaced`. Current freestanding box intent returns `freestanding_box_unavailable` rather than reaching the attached-only solver.

## 7.7 Plan renderer

Create a read-only `TopProjectionSvg` that consumes `GeometryTopProjectionViewModel`.

It owns:

- scale-to-fit;
- line hierarchy;
- neutral house fill;
- pergola members;
- dimensions;
- selected edge;
- accessory overlays;
- accessible title/description;
- deterministic SVG serialization.

It does not own:

- drag;
- snapping;
- selection handles;
- editing tools;
- compatibility fallbacks;
- CAD diagnostics.

The portal Plan editor remains portal-owned.

## 7.8 Elevation renderer

The shared 3D viewer adds camera modes:

```ts
type CustomerCameraMode =
  | 'iso_fixed'
  | 'front_orthographic'
  | 'side_orthographic'
  | 'top_orthographic'
  | 'orbit';
```

Orthographic front/side views use the same scene and material resolver as 3D. They are not separate geometry models.

## 7.9 Shared viewer extraction

Create `@sp/geometry-viewer` by extracting cohesive, behavior-preserving pieces from the portal:

Shared:

- scene object dispatch;
- object geometry builders;
- safe resource disposal;
- scene bounds;
- camera state primitives;
- camera fit;
- base materials;
- base lights;
- renderer reset;
- context-loss handling;
- read-only object rendering.

Portal-only:

- measurements;
- section cuts;
- diagnostics panel;
- layer debugger;
- workbench selection semantics;
- object focus tools;
- cross-viewport CAD hover;
- project health telemetry;
- technical labels.

Marketing-only:

- customer material palette;
- edge targeting;
- customer summary;
- explore instructions;
- view/category controls;
- accessory presentation objects.

The extraction PR must preserve portal behavior before marketing consumes it.

## 7.10 Trust and messaging

Map technical states to customer-safe states:

| Technical condition | Customer state |
|---|---|
| Valid solve | Preview ready |
| Valid solve with assumptions/warnings | Preview ready; Sanctuary will confirm details |
| Missing required customer input | Complete the highlighted choices |
| Unsupported combination | Sanctuary review required |
| Invalid geometry | Preview unavailable for this combination; choices retained |
| WebGL failure | 3D unavailable; plan and configuration remain available |

Never expose stack traces, profile IDs, source IDs or package diagnostics publicly.

---

# 8. Persistence architecture

## 8.1 Storage keys

```text
sanctuary.pergola-config.v1
sanctuary.pergola-config-ui.v1       // optional session-only preferences
```

The design configuration uses `localStorage`.

The UI preference key should use `sessionStorage` or remain memory-only.

## 8.2 Storage envelope

```ts
type StoredCustomerPergolaConfigurationEnvelopeV1 = {
  storageVersion: 'sanctuary.pergola-config.v1';
  savedAt: string;
  document: CustomerPergolaConfigurationV1;
};
```

The stored document must be canonicalized before writing.

## 8.3 Store implementation

Use one root-level external store:

- initialized after hydration;
- exposed through a React provider;
- read with `useSyncExternalStore` or an equivalent stable subscription contract;
- debounced local write after committed changes;
- immediate flush on `pagehide`;
- cross-tab synchronization through the `storage` event;
- revision conflict resolution by `updatedAt` plus revision;
- no server dependency for normal editing.

## 8.4 Persistence behavior

### Route changes

The root marketing layout persists the provider, so ordinary App Router navigation retains state without re-reading storage.

### Back/Forward

Configuration state is not encoded in URL history. Back/Forward changes the page, not the current pergola. Contextual actions should update the store without pushing a fake browser entry.

### Refresh

The canonical local document is restored after hydration.

### Return visit

A valid stored document restores the configured dock immediately.

### Reset

Use an explicit confirmation:

> Start a new pergola? Your saved configuration on this device will be replaced.

A reset:

- creates a new `configurationId`;
- resets revision;
- retains no previous design fields;
- may retain non-design attribution outside the config store;
- does not delete a server-submitted record.

### Storage unavailable

Keep the configuration in memory and show:

> Your choices are available for this visit but could not be saved on this device.

## 8.5 Schema migration

Every persisted version needs:

- strict parser;
- migration fixture;
- canonical serializer;
- downgrade behavior;
- corrupt-data test.

Migration rules:

1. Read raw value.
2. Detect exact storage version.
3. Parse through an allowlist.
4. Apply sequential migrations.
5. Normalize.
6. Write the current canonical version once.
7. Preserve an unknown future-version value without overwriting it.
8. Offer reset/recovery rather than silently destroying it.

## 8.6 Existing Simple Cover handoff

During transition:

- if no general configuration exists;
- and a valid `simple-cover-handoff.v1` exists;
- and the visitor opens **Your pergola**;

offer or perform a one-way import of:

- width;
- projection;
- pitched form;
- acrylic roof;
- attachment intent;
- ground/elevated level.

Do not migrate the public price as a general-configurator price.

The existing authenticated `calculationRef` remains valid only for the exact frozen Simple configuration. The general configurator must discard or isolate it as soon as any material configuration choice changes.

## 8.7 Functional-storage classification

The local configuration is functional product state, not analytics or remarketing. It may operate without optional analytics/marketing consent.

It must:

- contain no PII;
- not be read for advertising;
- not be sent until the user submits an enquiry;
- be described in privacy documentation as local functional storage.

---

# 9. Website integration architecture

## 9.1 Root mounting

Recommended layout composition:

```tsx
<ConsentProvider>
  <MarketingOverlayProvider>
    <ConfiguratorProvider>
      <Header />
      <Main />
      <Footer />
      <ConfiguratorDock />
      <ConfiguratorDialog />
    </ConfiguratorProvider>
  </MarketingOverlayProvider>
</ConsentProvider>
```

The exact DOM order may change to preserve portals and landmarks. The provider hierarchy is normative.

## 9.2 Route eligibility

The dock should appear on public project-discovery routes:

- homepage;
- residential/custom/commercial/professional service routes;
- projects and project details;
- products and product details;
- guides where relevant;
- contact;
- Simple pathway after migration.

It should be absent on:

- `/quote/**`;
- `/invoice/**`;
- `/staff/**`;
- `/admin/**`;
- `/pricebook/**`;
- noindex experiment/foundation routes;
- confirmation/success routes;
- legal/privacy pages unless a configured visitor specifically reopens it through navigation;
- portal-mode routes.

Route policy belongs in one tested function:

```ts
getConfiguratorRoutePolicy(pathname): {
  enabled: boolean;
  initialDockVisibility: 'immediate' | 'after_engagement' | 'hidden';
  reason: string;
}
```

## 9.3 Contextual action contract

```ts
type ConfiguratorContextActionV1 =
  | {
      kind: 'apply_patch';
      source: 'product';
      sourceSlug: string;
      patch: CustomerConfigurationPatchV1;
    }
  | {
      kind: 'use_seed';
      source: 'project';
      sourceSlug: string;
      seed: CustomerConfigurationSeedV1;
    };
```

Contextual actions must:

- be allowlisted and typed;
- show the effect before replacing major choices;
- preserve site context unless the action explicitly owns it;
- announce success;
- open the dock summary;
- never infer data from body copy.

## 9.4 Data ownership for seeds

Do not enlarge the already large product catalogue file with configurator behavior.

Create:

```text
apps/marketing/data/configuratorProductPatches.ts
apps/marketing/data/configuratorProjectSeeds.ts
```

Each map is keyed by canonical existing slug and tested against the source catalogue.

Examples:

```ts
productPatches['gable'] = {
  pergola: { family: 'gable' }
};

productPatches['drop-down-blinds'] = {
  suggestedAction: 'open_edge_treatment'
};
```

Project seeds may include:

- family;
- dimensions;
- roof;
- frame finish;
- selected comfort options.

They should not seed:

- exact house geometry;
- approval status;
- engineering;
- footings;
- construction profiles.

## 9.5 V1 website actions

V1 supports a limited set:

- `Use this pergola form`
- `Try this roof`
- `Add blinds to your pergola`
- `Open Your pergola`

These should begin on core product pages after the base configurator is stable.

## 9.6 Later website actions

V2:

- `Use this project as a starting point`
- `Similar to your pergola`
- project compatibility badges;
- guide recommendations based on configuration;
- comparison against current project.

Similarity should use closed normalized facets, not AI-generated free-text similarity in the request path.

Possible scoring facets:

- family;
- roof system;
- attached/freestanding;
- area band;
- frame finish;
- selected comfort options.

---

# 10. Enquiry-to-portal handoff

## 10.1 Use the existing intake

The existing `/api/enquiry` path already performs:

- origin validation;
- body-size control;
- validation/sanitization;
- honeypot;
- rate limiting;
- attachment verification;
- contact creation;
- project creation;
- enquiry request creation;
- draft estimate creation;
- attribution/conversion recording;
- autoresponder delivery.

The configurator must extend this path rather than create a parallel API.

## 10.2 Browser submission payload

The enhanced enquiry POST adds:

```ts
customerConfiguration: {
  configurationId: string;
  revision: number;
  schemaVersion: 'customer_pergola_configuration.v1';
  document: unknown; // parsed again server-side
}
```

Do not add the configuration to:

- the URL;
- query parameters;
- analytics;
- hidden GET fields;
- attachment filenames.

## 10.3 Server validation

Before persistence:

1. enforce a bounded body contribution, recommended maximum 64KB;
2. parse with `@sp/configurator/handoff`;
3. canonicalize;
4. solve again server-side;
5. generate a customer-safe summary;
6. generate validation/review flags;
7. remove any client-supplied derived geometry;
8. ignore client-supplied prices;
9. reject executable/unknown data;
10. continue the ordinary enquiry if the optional configuration is malformed only when the customer is clearly informed that the configuration could not be attached.

Preferred behavior for the enhanced form is to return `422` and allow retry without losing local choices.

## 10.4 Durable database record

Add an immutable table:

```text
customer_configurations
```

Recommended fields:

| Field | Purpose |
|---|---|
| `id uuid` | Private server record ID |
| `configuration_id uuid` | Client non-secret design ID |
| `revision integer` | Submitted local revision |
| `schema_version text` | Exact public contract |
| `submission_id uuid` | Existing intake idempotency identity |
| `project_id uuid` | Existing created project |
| `enquiry_request_id uuid` | Existing enquiry |
| `intent jsonb` | Canonical customer intent |
| `summary jsonb` | Safe searchable summary |
| `solve_status text` | Ready/review-required/invalid |
| `geometry_contract_version text` | Provenance |
| `geometry_hash text` | Reproducibility/integrity |
| `source_path text` | Canonical route |
| `source_kind text` | Blank/product/project/Simple import |
| `created_at timestamptz` | Immutable submission time |
| `imported_to_workbench_at timestamptz null` | Audit only |
| `imported_workbench_revision_id uuid null` | Derived design provenance |

Security:

- no public browser table access;
- service-route write only;
- portal server read only;
- immutable after creation except bounded import audit fields;
- no direct public fetch by ID.

## 10.5 Atomic intake migration

Extend the existing `marketing_enquiry_intake` RPC with optional canonical configuration parameters so that:

- project;
- enquiry request;
- configuration record;

are created in one database transaction.

Do not perform a best-effort second browser request after lead creation.

The route must remain thin. This feature should also extract configuration validation/persistence into a named server domain module rather than growing the existing route hotspot.

Recommended files:

```text
apps/marketing/lib/customerConfigurationSubmission.server.ts
apps/marketing/lib/customerConfigurationIntake.server.ts
apps/marketing/lib/customerConfigurationSummary.server.ts
```

## 10.6 Draft estimate behavior

The existing enquiry path creates a draft estimate with generic calculator inputs.

For a configurator submission:

- preserve current operational project/intake behavior;
- record `customerConfigurationId` and provenance;
- label all unresolved construction assumptions;
- do not claim that the estimate is workbench-solved;
- do not automatically produce a general public configurator price;
- do not let representative geometry defaults become frozen customer instructions.

A later explicit staff action may create/update the working design.

## 10.7 Portal customer-configuration card

The project page should show:

```text
Customer configuration
Gable * 5.5 x 4.2 m * Mixed roof
Submitted 16 Aug 2026
Needs confirmation: house connection, footing, exact height

[Open configuration]  [Start workbench design]
```

The card reads through a server-owned portal query. It must not read marketing local storage.

## 10.8 Workbench import adapter

Create:

```text
apps/portal/lib/customerConfigurations/importToWorkbench.ts
```

Responsibilities:

- map one public house intent to one or more object-first house forms;
- map the pergola to `PergolaObjectModel`;
- apply world position;
- create a snap-derived or unresolved host relationship;
- copy customer finish/roof/accessory intent into appropriate project metadata;
- retain warnings;
- assign source provenance;
- produce a reviewable draft;
- never auto-save over existing staff work.

The import result should be:

```ts
type CustomerConfigurationWorkbenchImportResult =
  | {
      ok: true;
      draft: ObjectFirstWorkbenchDraftVNext;
      warnings: CustomerConfigurationImportWarning[];
      provenance: {
        customerConfigurationId: string;
        revision: number;
        importedAt: string;
      };
    }
  | {
      ok: false;
      reason: string;
    };
```

## 10.9 Original versus derivative

The immutable record remains the original.

The imported workbench draft is a derivative. Staff may change it without changing the submitted record.

The portal should always be able to display:

- submitted intent;
- current staff design;
- differences, later if useful.

## 10.10 Thumbnail decision

V1 does not require a WebGL screenshot.

Preferred later implementation:

- generate deterministic SVG plan from canonical top projection;
- optionally rasterize server-side for email/project cards;
- store privately;
- regenerate from intent rather than trust a client data URI.

The closed dock should remain text-first.

---

# 11. Component and package boundaries

## 11.1 Recommended file tree

```text
packages/
  configurator/
    package.json
    src/
      core/
        contracts.ts
        defaults.ts
        parser.ts
        normalize.ts
        migrations.ts
        summary.ts
        options.ts
        patches.ts
      geometry/
        adapter.ts
        houseAdapter.ts
        solve.ts
        anchors.ts
        mixedRoof.ts
        accessoryScene.ts
        customerMessages.ts
      handoff/
        submission.ts
        persistence.ts
        provenance.ts
      index.ts

  geometry-viewer/
    package.json
    src/
      core/
        bounds.ts
        camera.ts
        materials.ts
        resourceDisposal.ts
        sceneFilters.ts
      react/
        SceneCanvas.tsx
        OrthographicSceneCanvas.tsx
        SceneObjectNode.tsx
        renderers/
      svg/
        TopProjectionSvg.ts
        serializeTopProjection.ts
      index.ts

apps/marketing/
  components/
    pergola-configurator/
      ConfiguratorProvider.tsx
      ConfiguratorDock.tsx
      ConfiguratorDialog.tsx
      ConfiguratorHeader.tsx
      ConfiguratorViewer.tsx
      ConfiguratorViewTabs.tsx
      ConfiguratorCategoryTabs.tsx
      ConfiguratorExploreView.tsx
      controls/
        StructureControls.tsx
        RoofControls.tsx
        ComfortControls.tsx
        SiteControls.tsx
      edge/
        EdgeSelector.tsx
        EdgeTreatmentEditor.tsx
      states/
        ViewerFallback.tsx
        ConfiguratorStatus.tsx
      *.module.css
    overlays/
      MarketingOverlayProvider.tsx

  lib/
    pergola-configurator/
      store.ts
      storage.ts
      routePolicy.ts
      analytics.ts
      contextActions.ts
      legacySimpleImport.ts

  data/
    configuratorProductPatches.ts
    configuratorProjectSeeds.ts

  app/api/enquiry/
    route.ts                 // remains request/response owner
  lib/
    customerConfigurationSubmission.server.ts
    customerConfigurationIntake.server.ts

apps/portal/
  lib/customerConfigurations/
    getCustomerConfiguration.ts
    importToWorkbench.ts
    importWarnings.ts
  components/projects/
    CustomerConfigurationCard.tsx
```

## 11.2 `@sp/configurator` rules

It MUST:

- be universal TypeScript;
- expose exact subpath exports;
- be independently typechecked/tested;
- use `@sp/geometry` for geometry;
- have no React dependency in core;
- have no browser global in core;
- have no Supabase dependency;
- have no service-role code;
- have no public pricing policy;
- have no import from either app.

## 11.3 `@sp/geometry-viewer` rules

It MUST:

- accept solved scene/top-projection contracts;
- not call the geometry solver;
- not store customer state;
- not know about Supabase;
- not know about calculator pricing;
- not import portal app files;
- expose a client-only React entry separately from server-safe SVG utilities;
- support resource disposal and context loss;
- preserve portal rendering parity during extraction.

## 11.4 Marketing rules

Marketing owns customer language and behavior. It does not own geometry semantics.

The global provider imports only lightweight contract/parser code before the dialog opens.

## 11.5 Portal rules

Portal owns staff orchestration and may import:

- `@sp/configurator/handoff`;
- `@sp/geometry`;
- `@sp/geometry-viewer`.

Portal must not depend on marketing route components or content structure.

## 11.6 Costing boundary

The public configurator client must not import `@sp/costing` for general project pricing.

Server/staff flows may later map validated customer intent into costing through explicit adapters. That is a separate commercial rollout with its own provenance and tests.

## 11.7 Hotspot discipline

The repo's decomposition guardrail applies.

Agents must not add the feature inline to:

- `Geometry3DViewport/index.tsx`;
- the existing enquiry route;
- the large product catalogue;
- the calculator client;
- the root layout.

Extract named owners with focused tests.

Behavior-preserving extraction and new behavior should be separate PRs where practical.

---

# 12. Responsive and mobile behavior

## 12.1 Governed viewports

Automated coverage:

- 360 x representative height;
- 390 x 844;
- 430 x representative height;
- 768;
- 1024;
- 1440 desktop.

Physical release coverage:

- current iOS Safari;
- current Android Chrome;
- at least one lower/mid-tier mobile GPU.

## 12.2 Mobile dock rules

The dock:

- never covers the focused form field;
- hides when a software keyboard is detected;
- hides while mobile navigation is open;
- lifts above the consent banner where enough viewport remains;
- otherwise hides until consent is resolved;
- never produces horizontal overflow;
- remains inside safe areas;
- uses a 48px minimum action target.

## 12.3 Mobile controls

- Numeric controls combine a labelled text/number input with optional stepper/range.
- Range gestures are never the only path.
- Category tabs scroll horizontally only when all labels cannot fit; active tab remains visible.
- Each control has one concise helper, not staff-level explanation.
- Error text appears adjacent to the control.
- Edge treatment cards use one column at 360/390 and may use two at 430 where legible.

## 12.4 Scroll ownership

When dialog is open:

- body is locked once;
- dialog shell does not scroll;
- control region scrolls;
- explore view manages its own pointer gestures;
- closing restores the exact page scroll position;
- Back navigation is not hijacked to simulate closing unless an explicit product decision adds history integration later.

V1 uses Escape/close, not synthetic history entries.

## 12.5 Orientation

On orientation change:

- preserve active configuration;
- preserve active tab/view;
- refit camera;
- do not preserve a stale pixel camera position;
- remeasure `visualViewport`;
- avoid a flash of the dock behind the dialog.

---

# 13. Accessibility

## 13.1 Dialog semantics

Use a proven accessible dialog primitive, with Radix Dialog acceptable because the dependency already exists.

Requirements:

- labelled title;
- concise description;
- focus trap;
- background inert;
- Escape close;
- focus restoration;
- visible close button;
- no focusable hidden canvas controls;
- no nested modal conflict.

## 13.2 Tabs

Both tab groups use correct ARIA tab semantics or a simpler labelled button group where tab-panel behavior does not justify tabs.

Keyboard:

- Arrow keys move between tabs;
- Home/End supported;
- focus and selection behavior documented;
- active state not communicated by colour alone.

## 13.3 Canvas alternative

The viewer region contains:

- accessible name;
- text summary;
- model status;
- **Skip model preview** link;
- a non-graphical list of selected edges/options.

The plan SVG includes `<title>` and `<desc>`.

## 13.4 Edge selection

Keyboard/screen-reader users operate a labelled list:

```text
Front edge - Blind, mesh, motorised
Left edge - Open
Right edge - Fixed clear acrylic
```

Graphical highlighting mirrors this state.

## 13.5 Announcements

Use a polite live region for:

- configuration loaded;
- meaningful option applied;
- save failed;
- 3D fallback;
- contextual patch applied.

Do not announce every slider increment or every frame redraw.

## 13.6 Targets and contrast

- primary controls: minimum 48px height;
- secondary/icon controls: minimum 44 x 44px;
- visible focus;
- text contrast meets WCAG AA;
- selected state uses border/label/icon, not colour alone;
- reduced-motion mode retains immediate state feedback.

## 13.7 Reduced motion

When `prefers-reduced-motion: reduce`:

- dialog appears without translation;
- viewer fades are removed;
- camera transitions become immediate;
- dock pressed scaling is disabled;
- no auto-orbit;
- no animated model morph.

## 13.8 Error recovery

Errors are associated with fields and summarized where more than one blocks progress.

A failed 3D renderer is not a form validation error and must not move focus away from the customer's active control.

---

# 14. Overlay coordination

## 14.1 New owner

Create `MarketingOverlayProvider`.

It owns shared knowledge of:

- consent banner open and measured height;
- mobile menu open;
- configurator dialog/explore open;
- route-level fullscreen gallery/sheet;
- bottom occupied inset;
- virtual keyboard;
- body scroll-lock owner.

## 14.2 Priority model

Recommended semantic priority:

1. ordinary content;
2. header;
3. configurator dock;
4. route-local non-modal overlay;
5. modal backdrop/dialog;
6. consent decision;
7. skip link/focus emergency control.

Initial token mapping can preserve current values:

```css
--z-header: 2000;
--z-configurator-dock: 2200;
--z-route-overlay: 3000;
--z-configurator-dialog: 4500;
--z-consent: 5000;
--z-skip-link: 6000;
```

Visibility coordination matters more than stacking increasingly large numbers.

## 14.3 Bottom occupancy

The consent banner should publish or expose its measured height through `ResizeObserver`.

The dock uses:

```css
bottom:
  calc(
    var(--configurator-dock-gap)
    + env(safe-area-inset-bottom)
    + var(--marketing-bottom-occupied, 0px)
  );
```

If the combined occupied region leaves insufficient content height, the dock hides.

## 14.4 Mutual exclusion

Rules:

- opening the configurator closes the mobile menu;
- opening mobile navigation hides the dock;
- opening a route fullscreen gallery hides the dock;
- the dock never appears over another modal;
- explore mode is part of the configurator dialog, not a second independent modal;
- consent remains operable above the dialog when legally required;
- only one component owns body position-based scroll lock.

## 14.5 Software keyboard

Detect through:

- focused editable element;
- `visualViewport.height` change;
- viewport offset.

The dock hides. The dialog adjusts its internal layout. Do not rely on user-agent sniffing.

## 14.6 Migration strategy

PR 5 should establish the provider and integrate:

- consent;
- header mobile menu;
- configurator.

Legacy route overlays may publish a temporary closed custom event or data attribute. They should migrate to the provider in later focused PRs rather than blocking V1.

---

# 15. Performance strategy

## 15.1 Bundle boundary

Initial public routes must not load:

- Three.js;
- React Three Fiber;
- Drei;
- the full geometry solver;
- shared 3D renderers.

The root provider imports only:

- compact contracts;
- parser/normalizer;
- storage;
- dock UI.

Use dynamic imports for:

- geometry adapter/solver;
- plan renderer where appropriate;
- 3D viewer;
- explore mode.

## 15.2 Package subpaths

Avoid a barrel that accidentally imports heavy code.

Example:

```ts
import { parseStoredConfiguration } from '@sp/configurator/core';

const { solveCustomerConfigurationV1 } =
  await import('@sp/configurator/geometry');

const { CustomerSceneCanvas } =
  await import('@sp/geometry-viewer/react');
```

## 15.3 Rendering strategy

React Three Fiber settings:

- `frameloop="demand"`;
- DPR capped to approximately 1.5;
- no real-time shadows in V1;
- restrained ambient and directional lights;
- no post-processing;
- no environment-map dependency for first render;
- invalidate only on scene/camera/interaction change;
- unmount and dispose when dialog closes;
- renderer context loss handled;
- geometry/material reuse within a scene.

## 15.4 Solve scheduling

Initial approach:

- commit numeric values on input blur/Enter or slider release;
- debounce continuous updates by approximately 100-150ms;
- use React transition for non-blocking UI;
- cache normalized solve by deterministic input signature.

Measure solve duration.

Move solve to a Web Worker only if representative p95 main-thread solve exceeds 50ms or produces visible interaction delay. Do not add a worker before evidence.

## 15.5 Open sequence

Performance target:

1. dialog shell visible within 100ms;
2. controls and textual summary immediately;
3. plan/placeholder within 400ms;
4. 3D interactive within 1.5 seconds p75 on the agreed mid-tier mobile profile after network transfer;
5. later opens materially faster from cache.

## 15.6 Global budgets

Recommended incremental budgets:

| Metric | Budget |
|---|---:|
| Initial configurator provider+dock JS | <=30KB gzip beyond existing shared runtime |
| Three/R3F/geometry in initial route chunk | 0 |
| Viewer feature chunk | Track and gate; initial ceiling 450KB gzip |
| Added CLS on ordinary route | <=0.01 |
| Added pre-interaction long task | None >50ms attributable to configurator |
| Loaded configuration update | p95 <=100ms for representative V1 fixtures |
| Mobile Lighthouse performance | Retain repository gate >=0.90 |
| Accessibility | Retain repository gate >=0.95 |
| SEO | Retain repository gate 1.00 |

The viewer chunk ceiling is a starting guard, not a target. Report actual composition.

## 15.7 Preloading

Preload the heavy chunk only on clear intent:

- pointer hover over dock on fine pointers;
- keyboard focus on dock;
- touch pointer-down;
- after the dialog shell opens.

Do not preload on every page view.

## 15.8 Model complexity

V1 supports:

- one pergola;
- one representative house;
- bounded openings/detail;
- no landscaping/furniture;
- no photoreal materials;
- no imported mesh assets.

This preserves mobile reliability.

## 15.9 Fallback and cleanup

After close:

- cancel pending solve;
- disconnect observers;
- dispose geometries/materials;
- clear pointer capture;
- restore scroll;
- keep only the small intent store in memory.

---

# 16. Security and privacy boundaries

## 16.1 Public client

The browser may hold:

- customer design intent;
- non-secret UUID;
- source slug/path;
- UI state.

It must not hold:

- service keys;
- private Supabase credentials;
- costing configuration;
- material costs;
- staff pricing;
- internal project IDs before intake;
- signed staff APIs;
- engineering decisions.

## 16.2 Local storage

The configuration contains no:

- name;
- email;
- phone;
- address;
- message;
- precise geolocation;
- uploaded image;
- ad-click identifier.

Contact data remains in the existing enquiry form and intake contract.

## 16.3 Server trust

The server trusts neither:

- the local configuration;
- its derived summary;
- its solved geometry;
- its configuration ID as authorization;
- its price;
- its source label.

It reparses and re-solves.

## 16.4 Free text

The only proposed V1 free text is an optional other-colour name.

It must be:

- single-line;
- control-character stripped;
- bounded, recommended 80 characters;
- displayed as text only;
- excluded from analytics.

## 16.5 URL policy

No configuration JSON, dimensions, configuration ID, contact data or price goes into the URL in V1.

Future share links require a separately designed opaque, expiring or revocable server token.

## 16.6 Intake protections

Reuse existing:

- same-origin enforcement;
- request size limit;
- UUID submission idempotency;
- honeypot;
- rate limit;
- validation;
- attachment verification;
- attribution gates.

Increase request limits only after measuring the canonical config size. Do not broadly relax the existing 128KB body boundary.

## 16.7 Logging

Do not log:

- full configuration JSON;
- custom colour text;
- customer contact + configuration in the same unstructured log;
- opaque calculation references;
- renderer diagnostics containing identifiers.

Safe logs may contain:

- schema version;
- solve status;
- controlled family/roof enum;
- bounded error code;
- request correlation ID.

## 16.8 Pricing isolation

No public field can select:

- costing version;
- multiplier;
- labour rate;
- discount;
- approval allowance;
- material cost;
- blind price rule.

The general configurator is not a pricing authority.

---

# 17. Analytics

## 17.1 Consent model

Configurator analytics are optional analytics-category tracking.

Events:

- emit only after analytics is enabled;
- are not backfilled;
- use closed allowlists;
- contain no exact dimensions;
- contain no configuration ID;
- contain no free text;
- contain no contact data;
- contain no rendered image.

Functional local persistence is independent of analytics consent.

## 17.2 Event contract

Recommended events:

| Event | Trigger | Allowed properties |
|---|---|---|
| `pergola_configurator_dock_view` | First eligible dock impression per route/session | route group, state empty/configured, viewport category |
| `pergola_configurator_open` | Dialog opened | source component, state, viewport category |
| `pergola_configurator_first_interaction` | First committed design change | source component, section |
| `pergola_configurator_view_change` | 3D/elevation/plan | view, viewport category |
| `pergola_configurator_section_change` | Structure/roof/comfort/site | section |
| `pergola_configurator_option_change` | Governed option changed | section, option key, allowlisted option value |
| `pergola_configurator_edge_change` | Edge treatment committed | edge enum, treatment enum |
| `pergola_configurator_explore_open` | Interactive 3D entered | viewport category |
| `pergola_configurator_review_required` | Customer-visible review state | closed reason code |
| `pergola_configurator_context_apply` | Product/project action applied | source type, canonical slug, patch kind |
| `pergola_configurator_reset` | Confirmed reset | prior state configured/empty |
| `pergola_configurator_enquiry_attach` | Valid config attached to accepted enquiry | family, roof, option-count band |
| `pergola_configurator_handoff_import` | Staff imports to workbench | first-party operational audit, not browser analytics |

## 17.3 Dimension privacy

Use bands where measurement is useful:

- area band: `<15`, `15-25`, `25-35`, `35-50`, `50+`;
- length band;
- projection band.

Do not emit raw millimetres.

## 17.4 Funnel

Primary funnel:

```text
Eligible dock impression
-> Configurator open
-> First interaction
-> Preview ready
-> Contextual continuation or enquiry CTA
-> Form start
-> Accepted enquiry with configuration
-> Staff workbench import
```

The existing submission UUID remains the accepted-enquiry reconciliation identity. Do not add a second persistent browser identifier.

## 17.5 Tracking register

Update `docs/security-privacy-quality.md` with the new event owner and exact allowlist before production.

---

# 18. V1 scope

## 18.1 V1 product release

V1 includes:

### Global shell

- eligible-route dock;
- empty/configured states;
- device-local persistence;
- large responsive dialog;
- autosave status;
- reset;
- overlay coordination.

### Views

- fixed isometric 3D;
- front and side orthographic elevation;
- read-only plan;
- interactive 3D explore;
- WebGL fallback.

### Structure

- pitched;
- gable;
- hip;
- box perimeter;
- length;
- projection;
- approximate clear height;
- attached/freestanding;
- attachment intent;
- black/white/other finish.

### Roof

- acrylic;
- solid timber-sarking;
- combination;
- clear/light grey/dark grey/opal acrylic;
- narrow/standard/wide central skylight layout.

### Comfort

- front/left/right/rear semantic edge selection;
- mesh/fine-mesh/clear-PVC blind intent;
- manual/motorised intent;
- fixed clear/opal acrylic infill intent;
- downlight intensity;
- dimmer request;
- LED strip interest;
- heater interest.

### Site

- straight/L-left/L-right/recess-left/recess-right house;
- one/two-storey/not sure;
- hipped/gable/mono/flat/not sure roof;
- ground/deck/elevated/not sure;
- attachment side.

### Handoff

- server validation and solve;
- immutable configuration record;
- existing enquiry/project creation;
- portal card;
- explicit import to workbench;
- provenance and warnings.

### Context

- initial actions on core pergola-form, roof and blind pages.

## 18.2 V1 release exclusions

- general public price;
- automatic quote;
- multi-pergola;
- multiple house masses;
- custom house polygon;
- hip-corner pergola;
- open/no-cover pergola until package support is explicit;
- direct manipulation of dimensions in plan/3D;
- individual post movement;
- exact blind panelization;
- individual light placement;
- heater placement;
- slat-screen placement;
- furniture/landscaping;
- photorealistic rendering;
- sunlight simulation;
- AR;
- shareable public links;
- account/cloud synchronization;
- construction drawings;
- consent/engineering determination.

## 18.3 Definition of minimum compelling

The release is compelling only when a visitor can:

1. open the dock;
2. create a recognizably different pitched/gable/hip/box pergola;
3. change dimensions and roof;
4. see those changes in plan, elevation and 3D;
5. add a blind or fixed infill to a specific edge;
6. close and browse elsewhere;
7. return later with the same choices;
8. submit the configuration;
9. have staff open it in the portal without redrawing from scratch.

A prototype that stops before persistence and handoff is not the finished product.

---

# 19. Deferred capabilities

## V1.1

- broader product-page contextual actions;
- project seeds for a small curated set;
- deterministic plan thumbnail in portal/email;
- LED strip visualization;
- gable-end infill;
- improved accessory panelization;
- richer configuration comparison before applying a seed.

## V2

- `Use this project as a starting point` across all governed projects;
- `Similar to your pergola`;
- multiple pergolas through `solveProject`;
- hip-corner;
- open pergola;
- custom house polygon;
- direct manipulation in public plan;
- per-light placement;
- heater placement and clearance visualization;
- slat screens;
- cross-device save through an explicit customer account or signed share token;
- configuration revision history;
- staff/customer difference view.

## V3

- public pricing for eligible governed configurations;
- account collaboration;
- AR placement;
- sun/shade study;
- photoreal material mode;
- downloadable concept booklet;
- multi-zone outdoor-room composition;
- external design-professional handoff.

Every deferred commercial capability requires a separate source-of-truth and provenance review.

---

# 20. PR-by-PR implementation roadmap

The programme uses eleven bounded PRs. Each agent must read this document and the named owner documents before coding.

## PR 1 - Public configuration contract

### Objective

Create `@sp/configurator/core` as the canonical public design-intent boundary.

### Implementation status

Implemented and merged through PR #53 on 18 August 2026. Current code lives under `packages/configurator/src/core/**`, and later geometry, storage, UI, enquiry and portal work remains absent.

Gate 0 record: legacy audit rows N/A; remove/build-on legacy N/A; Phase 2 costing-input or `inputs.modules` dependencies none; consolidated existing functions/types N/A. This PR introduces a new public intent boundary and imports no workbench, geometry or costing input contract.

### Scope

- package scaffolding;
- exact V1 contracts;
- defaults;
- parser;
- normalization;
- serializer;
- summary;
- migrations framework;
- option catalogues;
- patch/seed contract;
- package typecheck/test integration.

### Likely files

```text
packages/configurator/**
package.json
package-lock.json
scripts/package-boundary-guard.mjs
```

### Dependencies

None beyond existing workspace conventions.

### Non-goals

- geometry;
- React;
- storage;
- viewer;
- portal;
- enquiry.

### Acceptance criteria

- strict parser rejects malformed and unknown executable content;
- canonical fixture round-trips;
- exactly one V1 pergola enforced;
- dimensions and custom text bounded;
- no app imports;
- package can be imported in Node and browser tests;
- documentation names direct/derived/staff-only ownership.

### Tests

- parser table;
- invariant tests;
- default fixture;
- serialization determinism;
- future-version preservation;
- migration harness.

### Risks

- accidentally reproducing calculator schema;
- importing app-owned enums;
- barrel pulling future heavy code.

### Completion gate

`npm run typecheck`, package tests, package-boundary guard and architecture review pass.

Focused verification command: `npm run test:configurator`.

### Effort

2-4 focused engineer-days.

---

## PR 2 - Geometry adapter and solved artifact

### Objective

Map public intent into `@sp/geometry` without duplicating physical logic.

### Scope

- `@sp/configurator/geometry`;
- family/roof/connection mapping;
- public house adapter;
- representative defaults;
- customer-safe messages;
- solve artifact;
- interaction-anchor builder in `@sp/geometry`;
- deterministic mixed-roof mapping or explicit capability block.

### Likely files

```text
packages/configurator/src/geometry/**
packages/geometry/src/interactionAnchors.ts
packages/geometry/src/index.ts
packages/geometry/src/**/*.test.ts
docs/costing-and-geometry.md
```

### Dependencies

PR 1.

### Non-goals

- viewer;
- accessories;
- pricing;
- portal import.

### Acceptance criteria

- one configuration produces one `PergolaGeometryInput`;
- all V1 families have representative fixtures;
- attached/freestanding house behavior is correct;
- plan, scene and assembly come from the same solve;
- anchor IDs remain stable across non-geometric finish changes;
- unsupported combinations return customer-safe codes;
- no marketing calculation of member positions.

### Tests

Fixture matrix:

- four families;
- three roof systems;
- attached/freestanding;
- five house presets sampled;
- one/two-storey;
- dimension boundaries.

### Risks

- representative defaults implying structural certainty;
- mixed-roof location not canonical;
- house context drift.

### Completion gate

Geometry package tests, configurator tests, portal workbench geometry tests and typecheck pass.

### Effort

4-7 focused engineer-days.

---

## PR 3 - Shared read-only geometry viewer extraction

### Objective

Extract reusable rendering without changing portal behavior.

### Scope

- create `@sp/geometry-viewer`;
- move/copy shared geometry builders and renderers;
- scene object dispatch;
- camera/bounds;
- disposal/context handling;
- preserve portal wrapper;
- add orthographic front/side camera primitives;
- add server-safe top-projection SVG serializer.

### Likely files

```text
packages/geometry-viewer/**
apps/portal/components/drawings/viewports/Geometry3DViewport/**
apps/portal/package.json
package-lock.json
```

### Dependencies

PR 2 contracts useful but marketing does not yet consume them.

### Non-goals

- redesign portal viewer;
- remove staff tools;
- customer dialog;
- customer materials.

### Acceptance criteria

- portal 3D screenshots/fixtures show no unintended geometry change;
- staff selection/measurement/section tools still work;
- shared package renders all current scene object types;
- top projection SVG is deterministic;
- front/side orthographic fit works;
- shared package has no imports from the portal app;
- extraction follows byte-for-byte move discipline where applicable.

### Tests

- renderer unit tests;
- portal workbench browser fixtures;
- camera pure tests;
- context-loss/disposal tests;
- top-projection SVG snapshots;
- bundle report.

### Risks

Highest-risk extraction in the programme:

- visual regression;
- event propagation change;
- disposal bugs;
- bundle duplication;
- package client/server boundary errors.

### Completion gate

Portal workbench suite, fixture Playwright, portal build, package typecheck and a reviewed before/after evidence set pass.

### Effort

7-12 focused engineer-days.

---

## PR 4 - Lightweight marketing store, persistence and dock

### Objective

Establish website-wide state without loading geometry or Three.js.

### Scope

- root configurator provider;
- local external store;
- localStorage envelope;
- cross-tab synchronization;
- route policy;
- empty/configured dock;
- save status;
- reset;
- Simple handoff import adapter;
- no dialog yet.

### Likely files

```text
apps/marketing/components/pergola-configurator/ConfiguratorProvider.tsx
apps/marketing/components/pergola-configurator/ConfiguratorDock.tsx
apps/marketing/lib/pergola-configurator/**
apps/marketing/app/layout.tsx
```

### Dependencies

PR 1.

### Non-goals

- geometry loading;
- dialog;
- contextual actions;
- analytics beyond test hooks.

### Acceptance criteria

- initial route JS contains no Three/R3F/geometry solver;
- dock appears according to route policy;
- configured dock restores across refresh and route navigation;
- corrupt storage does not crash;
- cross-tab newest revision wins;
- reset is explicit;
- no CLS/horizontal overflow at target widths.

### Tests

- store unit tests;
- storage/migration tests;
- route policy tests;
- Playwright route navigation and refresh;
- 360/390/430 layout;
- bundle assertion.

### Risks

- hydration flash;
- stale storage;
- root-layout regression;
- dock conflict with existing controls.

### Completion gate

Marketing tests/build, bundle evidence, mobile screenshots and no-overflow/CLS checks pass.

### Effort

4-6 focused engineer-days.

---

## PR 5 - Overlay coordinator and accessible dialog shell

### Objective

Create the safe global interaction shell before loading the viewer.

### Scope

- `MarketingOverlayProvider`;
- consent occupancy;
- mobile-nav state integration;
- virtual keyboard handling;
- scroll-lock ownership;
- dialog using accessible primitive;
- header/category/view shell;
- responsive proportions;
- focus restore;
- dock/dialog mutual exclusion.

### Likely files

```text
apps/marketing/components/overlays/**
apps/marketing/components/pergola-configurator/ConfiguratorDialog.tsx
apps/marketing/components/Header.tsx
apps/marketing/components/ConsentBanner.tsx
apps/marketing/app/globals.css or focused CSS modules/tokens
```

### Dependencies

PR 4.

### Non-goals

- real geometry;
- controls beyond fixtures;
- route overlay full migration.

### Acceptance criteria

- no nested scroll lock;
- mobile menu and configurator cannot remain open together;
- consent remains operable;
- dock lifts/hides correctly;
- Escape and close restore focus/scroll;
- background inert;
- keyboard does not cover focused control;
- reduced motion works.

### Tests

- dialog accessibility tests;
- keyboard focus-cycle tests;
- consent open/closed;
- mobile menu open/close;
- virtual viewport fixture;
- Back/refresh;
- 360/390/430 short-height tests.

### Risks

- breaking header scroll restoration;
- consent accessibility;
- z-index escalation;
- iOS body-lock behavior.

### Completion gate

Focused header/consent tests, marketing browser suite and physical iOS scroll-lock smoke pass.

### Effort

4-7 focused engineer-days.

---

## PR 6 - Three solved views and interactive explore

### Objective

Render the same solved artifact in plan, elevation and 3D.

### Scope

- dynamic geometry/3D imports;
- solve controller;
- loading states;
- top-projection SVG;
- fixed iso;
- front/side orthographic;
- view tabs;
- explore mode;
- context-loss fallback;
- plan/text fallback;
- performance instrumentation.

### Likely files

```text
apps/marketing/components/pergola-configurator/ConfiguratorViewer.tsx
apps/marketing/components/pergola-configurator/ConfiguratorExploreView.tsx
apps/marketing/components/pergola-configurator/states/**
packages/geometry-viewer/**
```

### Dependencies

PRs 2, 3 and 5.

### Non-goals

- full customer controls;
- accessories;
- portal handoff.

### Acceptance criteria

- one fixture appears consistently in all views;
- dimension changes update all views from one solve;
- default 3D does not orbit;
- explore supports orbit/zoom/reset;
- elevation is orthographic;
- WebGL failure leaves plan and controls;
- no initial-route heavy bundle;
- renderer disposes on close.

### Tests

- shared artifact parity tests;
- mocked WebGL failure/context loss;
- Playwright view switching;
- camera tests;
- performance traces;
- reduced motion;
- touch gestures.

### Risks

- mobile GPU/context limits;
- viewer chunk size;
- solve/render race;
- stale scene during rapid changes.

### Completion gate

Target performance budgets and real iOS/Android viewer smoke pass.

### Effort

5-8 focused engineer-days.

---

## PR 7 - Structure and roof controls

### Objective

Deliver the primary design conversation.

### Scope

- structure controls;
- roof controls;
- numeric commit behavior;
- family capability rules;
- finish/tint presentation;
- mixed-roof governed layout;
- customer-safe review states;
- summary updates.

### Likely files

```text
apps/marketing/components/pergola-configurator/controls/StructureControls.tsx
apps/marketing/components/pergola-configurator/controls/RoofControls.tsx
packages/configurator/src/core/options.ts
packages/configurator/src/geometry/mixedRoof.ts
```

### Dependencies

PR 6.

### Non-goals

- site presets;
- comfort accessories;
- pricing.

### Acceptance criteria

- all V1 families selectable;
- all V1 roof systems truthful;
- changing form/roof does not corrupt the document;
- model/plan/elevation update;
- invalid values preserve last valid preview with clear status;
- finish/tint never alter physical geometry hash;
- controls remain usable at 360px.

### Tests

- transition/state-machine tests;
- family/roof matrix;
- numeric input keyboard tests;
- visual fixtures;
- summary tests.

### Risks

- too many equal-weight controls;
- mixed-roof false precision;
- hidden incompatible state.

### Completion gate

Product review approves terminology and every combination has an explicit supported/review-required outcome.

### Effort

5-8 focused engineer-days.

---

## PR 8 - Site context and house integration

### Objective

Let the customer understand the pergola relative to a simplified house.

### Scope

- Site tab;
- footprint presets;
- storeys;
- house roof form;
- level;
- attachment side;
- connection intent;
- house/pergola positioning;
- camera refit.

### Likely files

```text
apps/marketing/components/pergola-configurator/controls/SiteControls.tsx
packages/configurator/src/geometry/houseAdapter.ts
packages/configurator/src/core/contracts.ts
```

### Dependencies

PR 7.

### Non-goals

- custom house polygon;
- openings/decks editing;
- direct plan manipulation;
- exact site model.

### Acceptance criteria

- attached/freestanding visibly distinct;
- every public house preset solves or returns a bounded review state;
- house remains invariant when pergola dimensions change;
- attachment side maps correctly;
- changing storeys refits view;
- site choices persist and reach summary.

### Tests

- house preset matrix;
- spatial invariance;
- rotation/side tests;
- mobile site control tests;
- attached/freestanding screenshots.

### Risks

- customer interpreting house as measured;
- legacy house-context seam;
- camera jumps.

### Completion gate

Geometry and product review confirm representative status and correct attachment semantics.

### Effort

5-8 focused engineer-days.

---

## PR 9 - Comfort options and accessory presentation

### Objective

Add the most valuable visible accessories without creating independent geometry.

### Scope

- edge selector;
- blind intent;
- fixed infill;
- downlight intensity/dimmer;
- LED/heater interest;
- accessory scene layer;
- plan/elevation/3D representation;
- unresolved-anchor messages.

### Likely files

```text
packages/configurator/src/geometry/accessoryScene.ts
apps/marketing/components/pergola-configurator/edge/**
apps/marketing/components/pergola-configurator/controls/ComfortControls.tsx
packages/geometry-viewer/src/react/renderers/customer/**
packages/geometry-viewer/src/svg/**
```

### Dependencies

PRs 2, 6 and 8.

### Non-goals

- blind system selection;
- panelization;
- product pricing;
- exact lighting design;
- heater visualization.

### Acceptance criteria

- one treatment per edge;
- graphical and list selection stay synchronized;
- blind/infill appears in all views;
- lighting count/positions are explicitly indicative;
- no accessory renders without a solved anchor;
- customer intent remains if an anchor becomes unavailable;
- staff-only choices remain hidden.

### Tests

- anchor/accessory deterministic tests;
- edge conflict tests;
- keyboard edge selection;
- screen-reader labels;
- visual fixtures;
- family/attachment compatibility.

### Risks

- accessory visuals implying exact product;
- plane z-fighting;
- inaccessible canvas-only interaction.

### Completion gate

Product owner accepts indicative visual language and accessibility review passes.

### Effort

7-10 focused engineer-days.

---

## PR 10 - Enquiry persistence and portal continuation

### Objective

Carry the exact validated intent into the existing project pipeline.

### Scope

- server submission parser;
- server re-solve;
- database migration/table/RPC extension;
- immutable record;
- enquiry payload integration;
- draft-estimate provenance;
- portal query/card;
- workbench import adapter;
- import warnings;
- idempotency.

### Likely files

```text
packages/configurator/src/handoff/**
apps/marketing/lib/customerConfiguration*.server.ts
apps/marketing/app/api/enquiry/route.ts
supabase/migrations/**
apps/portal/lib/customerConfigurations/**
apps/portal/components/projects/CustomerConfigurationCard.tsx
```

### Dependencies

PRs 1, 2, 8 and 9.

### Non-goals

- automatic pricing;
- automatic quote;
- overwriting existing workbench;
- customer account.

### Acceptance criteria

- accepted enquiry creates one configuration atomically;
- idempotent replay creates no duplicate;
- malformed config never reaches DB;
- full raw config absent from logs/analytics;
- portal card shows safe summary;
- import creates a derivative object-first draft;
- original remains immutable;
- source/warnings are visible;
- no repricing occurs as a side effect.

### Tests

- parser/server parity;
- API route tests;
- DB contract/migration tests;
- idempotent replay;
- RLS/access tests;
- portal import fixtures;
- existing enquiry regression;
- existing Simple cover regression.

### Risks

- large route hotspot;
- transaction migration;
- calculator/workbench source confusion;
- generic draft price implying certainty.

### Completion gate

Staging end-to-end evidence shows browser configuration -> enquiry -> project -> portal card -> workbench draft with exact provenance.

### Effort

7-12 focused engineer-days.

---

## PR 11 - Contextual actions, analytics and production hardening

### Objective

Integrate the configurator into the website and close production quality.

### Scope

- typed product patches;
- limited project seeds;
- apply/replace confirmation;
- consent-gated analytics;
- performance budget scripts;
- Lighthouse route;
- accessibility matrix;
- physical devices;
- fallback evidence;
- documentation updates;
- remove prototype flags where approved.

### Likely files

```text
apps/marketing/data/configuratorProductPatches.ts
apps/marketing/data/configuratorProjectSeeds.ts
apps/marketing/lib/pergola-configurator/analytics.ts
relevant product/project adapters
playwright/marketing.pergola-configurator.spec.ts
.lighthouserc*.json or dedicated config
docs/security-privacy-quality.md
```

### Dependencies

PR 10.

### Non-goals

- full similarity engine;
- all project seeds;
- pricing;
- V2 functionality.

### Acceptance criteria

- contextual actions are typed and reversible;
- no silent overwrite;
- analytics uses exact allowlist;
- no PII/raw dimensions/config IDs;
- initial routes retain bundle/Lighthouse gates;
- target mobile/desktop matrix passes;
- real iOS/Android and keyboard/screen-reader checks recorded;
- release identity verified in production.

### Tests

- seed-key parity with product/project catalogues;
- context action transitions;
- analytics rejection tests;
- complete Playwright journey;
- Lighthouse;
- bundle report;
- manual device/AT checklist.

### Risks

- scope creep across many routes;
- product metadata drift;
- tracking privacy;
- performance regression.

### Completion gate

One production release is verified against the exact repository SHA with all V1 acceptance criteria closed.

### Effort

5-10 focused engineer-days.

---

# 21. Testing and acceptance matrix

## 21.1 Test layers

| Capability | Unit | Package integration | Component | Playwright | Physical/manual |
|---|---|---|---|---|---|
| Contract/parser | Required | Required | - | Corrupt-storage path | - |
| Migrations | Required | Required | - | Return visit | - |
| Geometry adapter | Required | Required with `@sp/geometry` | - | Representative UI fixtures | Geometry review |
| Mixed roof | Required | Required | Visual | All families | Product review |
| Shared 3D renderer | Pure helpers | Portal parity | Required | Portal + marketing | iOS/Android GPU |
| Plan SVG | Snapshot | Top-projection parity | Required | View switch | Print/zoom legibility |
| Elevation | Camera tests | Scene parity | Required | Front/side | Visual review |
| Persistence | Required | - | Required | Routes/refresh/cross-tab | Private browsing behavior |
| Dock | - | - | Required | All target widths | Short viewport |
| Dialog/focus | - | - | Required | Keyboard/Escape/restore | VoiceOver/TalkBack |
| Overlay coordinator | State tests | - | Required | Consent/menu/gallery | iOS body lock |
| Edge accessories | Required | Anchor parity | Required | Mouse/touch/keyboard | Visual product review |
| WebGL fallback | Required mocks | - | Required | Context fail/loss | Disabled WebGL/device |
| Enquiry handoff | Parser | API/DB | Form | Full journey | Staging project review |
| Portal import | Required | Workbench solve | Card | Portal fixture | Staff workflow review |
| Analytics | Allowlist tests | Consent | - | Enabled/disabled | DebugView reconciliation |
| Performance | Bundle test | - | - | Trace/Lighthouse | Mid-tier device |

## 21.2 Geometry fixture matrix

Minimum canonical fixtures:

- mono/acrylic/attached;
- mono/mixed/attached;
- mono/timber/freestanding;
- gable/acrylic/attached;
- gable/mixed/freestanding;
- hip/acrylic/freestanding;
- hip/timber/attached where supported;
- box/acrylic/attached;
- box/mixed/freestanding where supported;
- single-storey straight house;
- two-storey straight house;
- L-left and L-right;
- recess-left and recess-right;
- each attachment side;
- minimum/typical/large dimensions;
- one blind edge;
- three blind edges;
- fixed infill;
- lighting;
- incompatible/unresolved accessory.

Each fixture asserts:

- deterministic normalized intent;
- expected solve status;
- finite scene bounds;
- non-empty top projection;
- stable interaction edge IDs;
- no orphan accessory;
- no NaN/Infinity;
- plan/3D use the same dimension source.

## 21.3 Browser journeys

### Journey A - New mobile visitor

1. Open homepage at 390px.
2. Scroll until empty dock appears.
3. Open.
4. Choose gable.
5. Set dimensions.
6. Change roof to mixed.
7. Add front blind.
8. Close.
9. Open a project.
10. Reopen and confirm state.
11. Refresh.
12. Submit enquiry.
13. Verify accepted request carries configuration.

### Journey B - Returning visitor

1. Seed valid local storage.
2. Open a product page.
3. Confirm configured dock appears immediately.
4. Apply a roof patch.
5. Navigate Back/Forward.
6. Confirm configuration unchanged.
7. Reset with confirmation.

### Journey C - Desktop keyboard

1. Tab to dock.
2. Enter opens dialog.
3. Operate tabs and fields without pointer.
4. Select an edge through list.
5. Open/close Explore.
6. Escape closes.
7. Focus returns to dock.
8. Page scroll returns exactly.

### Journey D - Overlay collision

1. Consent banner open.
2. Confirm dock lift/hide behavior.
3. Open mobile menu.
4. Confirm dock hidden.
5. Close menu.
6. Open configurator.
7. Confirm one scroll lock.
8. Trigger software keyboard.
9. Confirm active field visible.

### Journey E - WebGL failure

1. Mock `getContext` failure.
2. Open dialog.
3. Confirm plan and controls.
4. Confirm 3D unavailable message.
5. Change dimensions.
6. Submit configuration.

### Journey F - Portal continuation

1. Submit known configuration.
2. Verify one contact/project/enquiry/config record.
3. Open portal project.
4. View immutable summary.
5. Import into workbench.
6. Confirm geometry and warnings.
7. Confirm original record unchanged.
8. Confirm no automatic repricing.

## 21.4 Responsive acceptance

At 360, 390 and 430px:

- no horizontal overflow;
- no hidden close button;
- no view/category tab inaccessible;
- no control target below 44px;
- no fixed dock over consent or keyboard;
- no dialog content under safe area;
- no unscrollable control region;
- zero unexpected CLS;
- plan labels remain legible or intentionally simplify.

## 21.5 Accessibility acceptance

Required before V1:

- automated axe/Playwright pass;
- desktop keyboard pass;
- VoiceOver Safari smoke;
- TalkBack Chrome smoke;
- reduced-motion pass;
- 200% browser zoom desktop;
- text resize/mobile test;
- colour contrast;
- focus visibility;
- canvas alternative;
- no essential gesture-only task.

## 21.6 Performance acceptance

Before production:

- initial bundle comparison on homepage/projects/product/contact;
- viewer chunk report;
- Lighthouse mobile/desktop;
- modal-open trace;
- representative solve trace;
- context-loss cleanup;
- no memory growth after ten open/close cycles;
- no ordinary-route network request for Three/geometry before intent.

---

# 22. Risks and architectural guardrails

## 22.1 Red-line guardrails

An implementation must be rejected if it:

1. creates a marketing-only geometry model;
2. imports portal calculator state into the public client;
3. copies `Geometry3DViewport` wholesale;
4. places Three.js in the initial global marketing bundle;
5. stores PII in the configurator local-storage document;
6. places config data in the URL;
7. submits client-derived geometry or price as authoritative;
8. auto-prices a rich configuration through generic defaults;
9. writes staff edits back into the immutable customer submission;
10. adds another uncoordinated global z-index/scroll lock;
11. makes edge selection canvas-only;
12. hides a failed solve behind an unrelated fallback model;
13. expands existing hotspot files without named extraction;
14. asks an AI agent to implement the whole programme in one PR.

## 22.2 Primary risks

### Risk: viewer extraction breaks portal CAD behavior

Mitigation:

- extraction-only PR;
- before/after fixture evidence;
- portal browser suite;
- no redesign during move;
- preserve event/camera semantics.

### Risk: customer preview appears construction-accurate

Mitigation:

- concept label;
- no technical profiles/dimensions beyond authored footprint;
- customer-safe review messages;
- staff confirmation list;
- no engineering language.

### Risk: mixed roof looks more specific than solver capability

Mitigation:

- only expose governed pattern after package-owned deterministic panel mapping;
- otherwise show mixed material as a broad zone and mark review required;
- no marketing-only bay placement.

### Risk: accessories become a second geometry system

Mitigation:

- derive every object from package interaction anchors;
- no independent pergola dimensions;
- unresolved accessories do not fabricate anchors;
- migrate structural accessories into geometry when required.

### Risk: initial website performance regresses

Mitigation:

- core/geometry/viewer subpath split;
- bundle assertion;
- dynamic import;
- intent preload only;
- no dock thumbnail canvas.

### Risk: overlay conflict on mobile

Mitigation:

- coordinator;
- measured bottom inset;
- one scroll lock;
- virtual viewport;
- short-height tests;
- real iOS validation.

### Risk: local state migration loses customer work

Mitigation:

- strict sequential migrations;
- future-version preservation;
- one canonical serializer;
- fixtures;
- explicit recovery/reset.

### Risk: intake stores untrusted data

Mitigation:

- server parser;
- server re-solve;
- atomic RPC;
- size bounds;
- safe summary;
- immutable record;
- no direct browser table access.

### Risk: portal import bypasses staff review

Mitigation:

- explicit import action;
- warnings;
- immutable source;
- derivative draft;
- no automatic save over existing work;
- no automatic pricing.

### Risk: contextual actions overwrite a customer project

Mitigation:

- transaction preview;
- preserve site context;
- confirm major changes;
- typed patches;
- undo last contextual action in-session.

### Risk: AI agents expand scope or create forks

Mitigation:

- one PR/slice at a time;
- every prompt references this document and exact PR;
- agents must report package boundaries touched;
- changed-file architecture and decomposition commands run before handoff;
- no opportunistic redesign;
- reviewers compare against red-line guardrails.

## 22.3 Agent operating protocol

Every implementation agent should receive:

```text
Implement only PR <n> from docs/customer-configurator-architecture.md.

Before coding, read:
- docs/customer-configurator-architecture.md
- docs/costing-and-geometry.md
- docs/design-workbench-architecture.md
- docs/marketing-ui-foundation.md
- docs/file-decomposition-and-ownership.md

Do not implement later PRs.
Do not redesign unrelated routes.
Do not copy package-owned logic into an app.
Add focused tests.
Report any architecture conflict before choosing a workaround.
Run the named completion gates.
```

Agents must end each PR with:

- files changed;
- source-of-truth boundaries preserved;
- tests run;
- visual/performance evidence;
- deferred issues;
- exact next PR dependency.

---

# 23. Final recommended target architecture

## 23.1 Package and runtime diagram

```mermaid
flowchart LR
  subgraph Marketing["apps/marketing"]
    Pages[Projects / Products / Guides / Services]
    Dock[Your pergola dock]
    Dialog[Configurator dialog]
    Store[Lightweight configurator store]
    Overlay[Marketing overlay coordinator]
    Enquiry[Existing enquiry form]
  end

  subgraph ConfigPkg["@sp/configurator"]
    Core[Core contract / parser / migrations]
    Adapter[Geometry adapter]
    Accessories[Accessory presentation derivation]
    Handoff[Handoff parser / summary / provenance]
  end

  subgraph GeometryPkg["@sp/geometry"]
    Solve[solvePergolaGeometry]
    Scene[ViewerSceneModel]
    Projection[Top projection]
    Anchors[Interaction anchors]
  end

  subgraph ViewerPkg["@sp/geometry-viewer"]
    Plan[TopProjection SVG]
    Elevation[Orthographic scene]
    ThreeD[Fixed + orbit 3D]
  end

  subgraph Intake["Existing server intake"]
    Route[/api/enquiry]
    RPC[marketing_enquiry_intake RPC]
    ConfigDB[(customer_configurations)]
    ProjectDB[(contact / project / enquiry)]
  end

  subgraph Portal["apps/portal"]
    Card[Customer configuration card]
    Import[Import adapter]
    Workbench[Object-first Design Workbench]
    Costing[Existing calculator / @sp/costing]
    Quote[Quotes]
  end

  Pages --> Dock
  Pages --> Store
  Dock --> Dialog
  Dialog --> Store
  Overlay --> Dock
  Overlay --> Dialog
  Store --> Core
  Core --> Adapter
  Adapter --> Solve
  Solve --> Scene
  Solve --> Projection
  Solve --> Anchors
  Scene --> Accessories
  Anchors --> Accessories
  Projection --> Plan
  Accessories --> Elevation
  Accessories --> ThreeD
  Store --> Enquiry
  Enquiry --> Route
  Route --> Handoff
  Handoff --> RPC
  RPC --> ConfigDB
  RPC --> ProjectDB
  ConfigDB --> Card
  Card --> Import
  Import --> Workbench
  Workbench -. explicit staff commercial workflow .-> Costing
  Costing --> Quote
```

## 23.2 Source-of-truth diagram

```text
CUSTOMER AUTHORED TRUTH
CustomerPergolaConfigurationV1
        |
        +--- locally persisted, no PII
        |
        v
PHYSICAL CONCEPT TRUTH
@sp/geometry solved artifact
        |
        +--- ViewerSceneModel
        +--- TopProjection
        +--- Interaction Anchors
        +-- Validation
        |
        v
PRESENTATION
Plan / Elevation / Fixed 3D / Explore 3D / Accessory overlays
        |
        v
IMMUTABLE SUBMITTED TRUTH
customer_configurations record
        |
        v explicit import
STAFF DESIGN TRUTH
Object-first Workbench project model
        |
        v explicit commercial workflow
COMMERCIAL TRUTH
@sp/costing -> estimate -> quote
```

## 23.3 Final decision summary

| Decision | Chosen direction |
|---|---|
| Product identity | Persistent **Your pergola** design object |
| Closed UI | Fine-rule architectural dock |
| Expanded UI | Large dialog; viewer above, controls below |
| Mobile | Full-screen, approximately 55/45 viewer-controls |
| Views | Fixed 3D, orthographic elevation, top-projection plan |
| Interactive camera | Separate Explore in 3D mode |
| Customer model | New versioned public-intent contract |
| Geometry | Existing `@sp/geometry` only |
| Plan | Canonical top projection |
| Shared rendering | New `@sp/geometry-viewer` extraction |
| Staff calculator controls | Curated; not copied publicly |
| Accessories | Presentation layers derived from solved anchors |
| Persistence | Versioned localStorage, no PII |
| Website actions | Typed patches/seeds only |
| Enquiry | Extend existing atomic intake |
| Server trust | Reparse and re-solve |
| Portal | Immutable source + explicit workbench import |
| Pricing | No general public V1 pricing |
| Performance | No Three/geometry in initial global bundle |
| Overlay | One marketing overlay coordinator |
| Delivery | Eleven bounded PRs with explicit gates |

---

# Appendix A - Repository evidence map

The architecture was derived from these current owners:

```text
packages/geometry/src/contracts.ts
packages/geometry/src/solvePergolaGeometry.ts
packages/geometry/src/solveProject.ts
packages/geometry/src/viewer.ts
packages/geometry/src/topProjection.ts
packages/geometry/src/plan.ts
packages/geometry/src/section.ts
packages/geometry/src/normalize.ts

docs/costing-and-geometry.md
docs/design-workbench-architecture.md
docs/marketing-ui-foundation.md
docs/mobile-ux-roadmap-v2.md
docs/security-privacy-quality.md
docs/file-decomposition-and-ownership.md

apps/portal/lib/drawings/state/workbenchSolvedModel.ts
apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts
apps/portal/lib/drawings/state/projectPergolaRenderArtifacts.ts
apps/portal/components/drawings/viewports/Geometry3DViewport/**
apps/portal/components/drawings/viewports/PlanViewport/**
apps/portal/lib/types/calculator.ts
apps/portal/app/staff/calculator/calculatorConfigurationSections.ts
apps/portal/app/staff/calculator/calculatorStructureFields.ts
apps/portal/app/staff/calculator/calculatorSiteFields.ts
apps/portal/app/staff/calculator/calculatorLightingUi.ts
apps/portal/app/staff/calculator/calculatorBlindUi.ts

apps/marketing/app/layout.tsx
apps/marketing/app/globals.css
apps/marketing/components/Header.tsx
apps/marketing/components/ConsentProvider.tsx
apps/marketing/components/ConsentBanner.tsx
apps/marketing/components/marketingRouteChrome.ts
apps/marketing/components/simple-cover-calculator/SimpleCoverCalculator.tsx
apps/marketing/lib/simpleCoverCalculator.ts
apps/marketing/lib/simpleCoverHandoff.ts
apps/marketing/lib/simpleCoverAnalytics.ts
apps/marketing/app/api/enquiry/route.ts
apps/marketing/lib/enquiryIntake.ts
apps/marketing/lib/enquiryPricingSnapshot.ts
apps/marketing/data/projects.ts
apps/marketing/data/products.ts

.lighthouserc.mobile.json
package.json
```

# Appendix B - Review checklist for every PR

- [ ] Does the PR preserve one customer-intent contract?
- [ ] Does all physical geometry still come from `@sp/geometry`?
- [ ] Does it avoid importing app-local calculator types into public packages?
- [ ] Does the initial marketing route avoid heavy geometry/3D code?
- [ ] Does it preserve portal workbench behavior?
- [ ] Does it avoid public pricing or construction certainty?
- [ ] Does it retain all customer choices through errors?
- [ ] Does it work without pointer-only interaction?
- [ ] Does it coordinate consent, navigation, overlays and keyboard?
- [ ] Does it keep PII out of local state, URLs and analytics?
- [ ] Does the server reparse and re-solve submitted intent?
- [ ] Does portal work create a derivative rather than mutate the original?
- [ ] Are focused tests and explicit evidence included?
- [ ] Has the agent stayed within the named PR scope?
