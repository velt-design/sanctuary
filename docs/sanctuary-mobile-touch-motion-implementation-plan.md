# Sanctuary Pergolas Mobile Touch and Motion Implementation Plan

> **Status:** Proposed implementation brief, reconciled with current `main`
>
> **Repository:** `velt-design/sanctuary`
>
> **Recommended repository path:** `docs/mobile-touch-motion-implementation-plan.md`
>
> **Reviewed repository head:** `b7b8e7d527d20aed7d132057f9218d6a188d4c67`
>
> **Identified production UI release:** `f207a1e975421a42b3b6734be5a84bae1134b7da`
>
> **Review date:** 26 July 2026
>
> **Target widths:** approximately 430 px, 390 px and 360 px, plus short mobile viewports
>
> **Programme model:** three phases, four required pull requests and one conditional remediation pull request

## Document purpose and authority

This document converts the completed Sanctuary Pergolas Mobile Touch and Motion Experience Review into an implementation sequence for small Codex goals and pull requests.

It is additive to:

- `docs/marketing-ui-foundation.md`
- `docs/mobile-ux-roadmap-v2.md`
- `docs/mobile-ux-phase-5-validation.md`

It does not reopen the completed structural mobile work. The information architecture, responsive page composition, enquiry context, content ownership and project-led customer journey remain governed by those documents.

This document is authoritative for the touch and motion programme. A pull request that needs to depart from its scope, interaction ownership, motion values or sequencing must update this document first or include a narrowly reasoned amendment in the same pull request.

Existing repository work already uses the label **Phase 6** for release parity, commercial framing and accessible native project-gallery controls. This plan therefore uses **TM1**, **TM2** and **TM3** to avoid conflicting phase names.

## Evidence states

- **Verified repository:** Confirmed in current `main`, current tests or repository evidence.
- **Verified production:** Confirmed by the identified production release and recorded production checks.
- **Inferred:** A likely experiential effect derived from implementation, without direct physical-device proof.
- **Physical-device validation required:** Requires real iOS Safari, Android Chrome, VoiceOver, TalkBack or device frame-pacing evidence.

## Current implementation reconciliation

The roadmap starts from the following current state and must not duplicate completed work.

| Current state | Evidence status | Planning consequence |
|---|---|---|
| `apps/marketing/styles/tokens.css` owns colour, spacing and shell values but no shared marketing motion durations, easing curves or press tokens. | Verified repository | TM1 must establish the motion vocabulary before broad consumer adoption. |
| Foundation buttons, text links, editorial cards, disclosures and gallery controls have focus and hover treatment, but no coherent shared pressed-state contract. | Verified repository | Immediate touch acknowledgement is the first implementation priority. |
| The mobile project-detail gallery remains a native horizontal strip with mixed image proportions, native momentum and scroll snap. | Verified repository and production | It must remain native. It is not to be rebuilt as `ResponsiveGallery` or another JavaScript carousel. |
| Phase 6 added mobile Previous and Next controls, live `Image n of total` status, keyboard navigation, reduced-motion handling and current-position tracking to the native project strip. | Verified repository and production | Future work may tokenise and validate these controls, but must not reimplement or remove them. |
| Current project-gallery position tracking schedules one requestAnimationFrame from `onScroll`, then reads the gallery and every figure with `getBoundingClientRect()` to find the closest centre. | Verified repository; physical cost unverified | TM3 must trace this path during real native swipes. If it causes repeated layout work or frame misses, the conditional remediation PR may cache geometry on resize instead of rereading every figure during scroll. |
| Product-detail pages still use `ResponsiveGallery`, which renders one active image and changes it after a qualifying pointer-up gesture. | Verified repository | TM2 targets this controlled gallery because it is the clearest remaining finger-to-content gap. |
| The shared mobile header has focus containment, inert closed state, reversible fixed-body scroll locking, Escape handling and route/history cleanup. | Verified repository and automated production evidence | Preserve this contract. Any lock changes require real-device failure evidence. |
| The project navigator sheet uses a different root/body overflow-lock model from the shared header. | Verified repository | Compare both models on physical devices before consolidating them. |
| `ScrollReset` resets path changes to the top and separately reveals hash targets. It does not explicitly distinguish ordinary navigation from browser history restoration. | Verified repository | Back and Forward scroll position must be tested before any history-aware change. |
| The production 12-route by three-width Chromium matrix records zero horizontal overflow, zero measured CLS, no long tasks, no broken viewport images and no primary control below 44 px. | Verified production lab evidence | The programme must preserve these results, while recognising they do not prove physical touch quality. |
| Physical iOS Safari, Android Chrome, VoiceOver and TalkBack evidence is still blocked in the existing validation record. | Physical-device validation required | TM3 is a completion gate, not optional polish. |

---

# 1. Executive implementation summary

## Implementation objective

Improve the physical quality of the mobile website so that important controls acknowledge touch immediately, movement uses one calm and precise vocabulary, the controlled product gallery responds more directly to the finger, and navigation or overlay changes preserve useful context without introducing frame or layout regressions.

## Why this is a bounded refinement

The current responsive foundation is structurally sound:

- vertical scrolling remains browser-native
- project-detail gallery movement remains native
- responsive disclosures use one semantic tree
- shared navigation has mature focus and locking behaviour
- image containers reserve geometry
- primary mobile routes have zero measured CLS in current production automation
- the current production release identifies its deployed code revision

The main remaining problems are interaction consistency, tactile acknowledgement and unverified real-device behaviour. A visual redesign, separate mobile site, new animation framework or scroll system would add risk without addressing the highest-value gaps.

## Recommended programme

- **Three phases:** TM1, TM2 and TM3
- **Four required pull requests:** TM-01 through TM-04
- **One conditional remediation pull request:** TM-05, opened only when TM-04 reproduces a defined device failure
- **Maximum planned pull requests:** five

## Highest-risk area

The highest implementation risk is **controlled product-gallery gesture refinement**. It must add finger-follow movement without stealing vertical scrolling, increasing initial image payload, creating duplicate accessible content or turning the gallery into a heavy carousel system.

The highest validation risk is **browser history and overlay scroll restoration**. An incorrect fix can create double restoration, page jumps or stale locks even when ordinary route navigation appears correct.

## Expected user-facing outcome

After completion:

- a tap is visibly acknowledged at finger-down
- controls feel related rather than independently animated
- menus and panels enter calmly and leave faster
- product images follow deliberate horizontal movement before release
- vertical page scrolling remains reliable through gallery areas
- native project-gallery swiping remains natural
- Back and Forward return to useful route, filter and reading context
- reduced-motion users receive immediate state feedback without animated travel
- no new layout shift, long task or initial payload regression is introduced

---

# 2. Governing implementation principles

Every phase and pull request must follow these rules.

1. **Native scrolling first.** Do not intercept ordinary vertical scrolling or replace browser momentum. Native project-gallery scrolling remains authoritative.

2. **Acknowledge touch before adding decorative motion.** A control must react at finger-down. Route progress, page replacement or network completion is not a substitute for local touch feedback.

3. **Use transforms, opacity, colour and border changes before layout animation.** Do not animate height, width, grid tracks, margins or content-driven layout for this programme.

4. **No spring, bounce or exaggerated scale.** Sanctuary movement must remain calm, precise, restrained and architectural.

5. **Exits are shorter than entrances.** Panels may take up to 220 ms to enter and should leave within 150 to 160 ms.

6. **Do not scale large architectural cards.** Large cards and project imagery use surface, border or opacity feedback. Small solid controls may use the governed press scale.

7. **Reduced motion is a first-class contract.** Autonomous transitions resolve to zero duration. Direct manipulation may remain spatially connected while the finger is down, but post-release travel is removed.

8. **Shared tokens before route-local values.** New motion values must come from `apps/marketing/styles/tokens.css`. A route-local exception requires a documented reason and a contract-test exemption.

9. **Preserve semantic and focus ownership.** CSS motion must not replace native control semantics, focus indicators, selected states, disabled states, live regions or error announcements.

10. **Measure before changing performance-sensitive surfaces.** Fixed blur, footer/header synchronisation, scroll restoration and overlay locking change only after reproducible evidence.

11. **No desktop regression.** Shared component changes must be tested at desktop. Mobile-only behaviour should be contained with capability or width queries where appropriate.

12. **No speculative abstraction.** Reuse current owners. Do not introduce a generic motion component, animation provider, carousel framework or overlay framework unless at least two verified owners require the same behaviour and the abstraction reduces rather than expands scope.

13. **No hidden payload trade.** Adjacent gallery readiness must not preload all images or increase initial product-detail image transfer before the gallery approaches the viewport.

14. **One pull request, one user outcome.** Motion governance, consumer adoption, gallery architecture, physical validation and history restoration remain separately reviewable.

15. **Production completion requires release identity.** Preview and production checks must record `X-Sanctuary-Release` and verify the intended revision rather than relying only on visual similarity.

---

# 3. Target Foundation UI motion system

## 3.1 Token owner

The canonical tokens must live in:

`apps/marketing/styles/tokens.css`

The root marketing layout already imports this file before the main global and component styles. Foundation primitives, shared chrome and route adapters can therefore consume one inherited contract without duplicating values in page modules.

Do not place the canonical values only inside `.marketingPage`, because the shared header, footer, project surfaces and contact route sit outside that class boundary.

## 3.2 Canonical token set

```css
:root {
  --motion-duration-instant: 80ms;
  --motion-duration-short: 160ms;
  --motion-duration-panel-enter: 220ms;
  --motion-duration-panel-exit: 150ms;

  --motion-ease-standard: cubic-bezier(.2, 0, 0, 1);
  --motion-ease-enter: cubic-bezier(.16, 1, .3, 1);
  --motion-ease-exit: cubic-bezier(.4, 0, .7, .2);

  --motion-press-scale: .992;
  --motion-press-opacity: .82;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-duration-instant: 0ms;
    --motion-duration-short: 0ms;
    --motion-duration-panel-enter: 0ms;
    --motion-duration-panel-exit: 0ms;
    --motion-press-scale: 1;
    --motion-press-opacity: .86;
  }
}
```

The reduced-motion opacity remains below `1` so a pressed control still acknowledges touch immediately. Motion is removed, not feedback.

## 3.3 Token use

| Token | Use |
|---|---|
| `--motion-duration-instant` | Finger-down acknowledgement and release of small control states |
| `--motion-duration-short` | Disclosure icon rotation, button colour, border changes, gallery settle, route-progress completion and small state changes |
| `--motion-duration-panel-enter` | Mobile menu entrance, project navigator sheet entrance and route-progress transform |
| `--motion-duration-panel-exit` | Mobile menu exit, project navigator sheet exit and temporary state departure |
| `--motion-ease-standard` | Ordinary colour, border, opacity and small transform changes |
| `--motion-ease-enter` | Decelerating menu, panel and controlled-gallery arrival |
| `--motion-ease-exit` | Faster menu and panel departure |
| `--motion-press-scale` | Small solid buttons only |
| `--motion-press-opacity` | Quiet text controls, icon controls and reduced-motion press feedback |

## 3.4 Existing hard-coded value migration

The first two pull requests should migrate only the governed interaction owners. They must not attempt a repository-wide animation cleanup.

| Current value or curve | Initial governed replacements |
|---|---|
| `160ms ease` in Foundation buttons, text links, editorial cards, disclosure icons and gallery buttons | `var(--motion-duration-short) var(--motion-ease-standard)` |
| `180ms ease` and `160ms ease` in the mobile menu | Enter uses `var(--motion-duration-panel-enter) var(--motion-ease-enter)`; exit uses `var(--motion-duration-panel-exit) var(--motion-ease-exit)` |
| `220ms cubic-bezier(.22,.61,.36,1)` in the project navigator sheet | Enter uses the panel-enter tokens; exit uses the panel-exit tokens |
| `160ms ease` in project-gallery controls | Short and standard tokens |
| `180ms ease` in contact actions and selectable labels | Short and standard tokens |
| `360ms cubic-bezier(.22,.61,.36,1)` on route-progress transform | Panel-enter duration and standard easing; completion remains short |
| Route entry `280ms cubic-bezier(.22,1,.36,1)` | Keep as a restrained documented exception in TM1, or migrate to panel-enter only if automated and desktop comparison shows no visible regression |
| Persistent `.page-layer { will-change: transform, opacity; }` | Remove. Retain `will-change` only on short-lived, actually transformed elements such as the two-pixel progress bar |

Long desktop header palette transitions and legacy start-viewer motion are not part of automatic token migration. They are inspected in TM3 and changed only if device or trace evidence proves a customer-facing problem.

## 3.5 Feedback mode by interaction

| Interaction | Press feedback | Must not do |
|---|---|---|
| Small solid button | Scale to `--motion-press-scale`, plus a governed darker or lighter surface | Bounce, spring or change box dimensions |
| Secondary button | Border and surface change, optional governed scale | Move adjacent content |
| Text link | Opacity and underline/border emphasis | Translate the arrow far enough to suggest animation for its own sake |
| Mobile menu link | Quiet surface or opacity change | Scale the full menu row |
| Editorial or project card | Surface, border or media-overlay opacity | Scale the full card or image frame |
| Disclosure summary | Quiet surface or rule emphasis, icon remains short | Animate content height |
| Gallery control | Surface, border or opacity, optional small-control scale | Move status text or gallery geometry |
| Radio or checkbox card | Surface and border response, selected state remains stronger | Animate dimensions |
| Text input, select or textarea | Preserve native focus and active cursor feedback | Add scale or content movement |
| File-selector button | Surface and opacity response | Replace the native file picker |
| Footer link | Opacity or underline emphasis | Add route-like movement |

## 3.6 Hover capability rule

Hover-only effects that change imagery, arrows or surfaces must be contained within:

```css
@media (hover: hover) and (pointer: fine) {
  /* hover-only treatment */
}
```

Pressed states must remain outside this query so coarse-pointer devices receive immediate feedback.

## 3.7 Motion contract guard

TM-01 must add a small repository contract test for the governed shared files.

Recommended owner:

`test/marketing-motion-contract.test.ts`

The test should:

- assert the canonical tokens and reduced-motion overrides exist in `tokens.css`
- assert Foundation shared owners reference the tokens rather than literal durations or cubic-bezier values
- permit `0ms` and the existing `.01ms` reduced-motion compatibility value where explicitly required
- require an inline `motion-contract-exempt` comment with a reason for any future literal value in a governed file
- begin with Foundation and interaction modules in TM-01
- add header, project-gallery control and route-adapter owners to the governed list in TM-02

The guard must not scan unrelated portal CSS or legacy marketing viewer code.

---

# 4. Phased implementation roadmap

## Phase TM1: Tactile foundation and motion governance

### Objective

Create one shared motion vocabulary and make all primary shared and route-adapted touch targets acknowledge finger-down without changing layout or page structure.

### User outcome

Buttons, links, cards, menu rows, disclosure summaries, gallery controls, form choices and footer actions feel immediate and related rather than silent or mechanically inconsistent.

### Exact scope

TM1 is delivered through TM-01 and TM-02:

1. Add canonical motion and press tokens.
2. Add the motion contract guard.
3. Migrate Foundation buttons, text links, editorial cards, disclosure summaries and controlled-gallery buttons.
4. Add restrained pressed states to those Foundation owners.
5. Gate Foundation hover-only effects to fine pointers.
6. Remove the persistent page-layer `will-change` hint.
7. Adopt the same tokens and press principles in the shared mobile header, current native project-gallery controls, project actions, project cards, product cards, homepage route adapters, service and SEO disclosures, contact controls, file controls and footer links.
8. Tokenise route-progress visual transitions without changing its 150 ms show delay or JS state model.
9. Preserve all focus, selected, disabled, live-region and analytics behaviour.

### Shared components affected

- `apps/marketing/styles/tokens.css`
- `apps/marketing/app/globals.css`
- `apps/marketing/components/marketing-foundation/foundation.module.css`
- `apps/marketing/components/marketing-foundation/Interactions.module.css`
- `apps/marketing/styles/header.css`
- `apps/marketing/app/projects/ProjectGallery.module.css`
- `apps/marketing/app/projects/projects.css`
- `apps/marketing/components/products/product-pages.module.css`
- `apps/marketing/app/home-v2/home-v2.module.css`
- `apps/marketing/app/pergolas-auckland/pergolas-auckland.css`
- `apps/marketing/components/seo-landing/seo-landing.css`
- `apps/marketing/app/contact/contact.css`
- `apps/marketing/components/SiteFooter.tsx`, only for class adoption where needed
- motion contract and focused Playwright tests

### Dependencies

- Current `main` including Phase 6 project-gallery controls
- Current Foundation UI contract
- No third-party packages

### Non-goals

- No product-gallery architecture change
- No native project-gallery behaviour change
- No scroll restoration change
- No body-lock refactor
- No fixed-blur removal without evidence
- No new route or page transition
- No copy, content or layout changes

### Acceptance criteria

- Every governed primary control has a visible `:active` state.
- Press feedback begins on pointer-down and does not wait for click or route completion.
- No active state changes the target bounding box or surrounding layout.
- Large cards do not scale.
- Hover-only image or arrow effects do not persist on coarse-pointer devices.
- All migrated transition durations and easing curves use shared tokens.
- Reduced motion resolves governed autonomous transition durations to zero.
- Reduced-motion pressed states remain visibly distinguishable through immediate surface, border or opacity changes.
- Existing focus-visible, selected, disabled and loading states remain stronger than transient pressed states.
- The route-progress delay remains 150 ms, and fast navigations that complete before the delay do not flash the bar.
- `.page-layer` no longer has a persistent `will-change` declaration.
- Desktop screenshots and interaction tests remain stable.

### Automated tests

- New motion contract test
- Foundation component and interaction Vitest suites
- `playwright/marketing.foundation.spec.ts`
- `playwright/marketing.shared-header.spec.ts`
- `playwright/marketing.home-v2.spec.ts`
- `playwright/marketing.projects.spec.ts`
- `playwright/marketing.products.spec.ts`
- `playwright/marketing.contact.spec.ts`
- `playwright/marketing.mobile-content-density.spec.ts`
- `playwright/marketing.phase-four.spec.ts`
- `playwright/marketing.phase-five.spec.ts`
- marketing TypeScript, production build and repository policy checks

### Physical-device tests

A limited smoke test is required before TM1 is marked deployed:

- one physical iPhone Safari
- one physical Android Chrome device
- tap Foundation primary and secondary actions
- tap one project card, one disclosure, the menu trigger, one menu row, one gallery control, one form choice and the submit button
- confirm no sticky hover state, page jump or exaggerated scaling

The complete physical matrix remains TM3.

### Accessibility tests

- keyboard focus order unchanged
- focus-visible remains visible during and after active-state testing
- selected and disabled states remain distinguishable
- reduced-motion computed durations are `0s`
- no accessible name, role or live-region change
- 200 percent zoom does not clip a scaled small control

### Performance tests

- no new JavaScript is required for press states
- no increase in initial script or image requests
- existing 12-route matrix remains at zero measured CLS
- no new long task is recorded
- compare route paint and memory trace before and after removing page-layer `will-change`

### Rollout requirements

- Each PR receives a protected preview.
- Preview response identity must match the PR head.
- TM-01 may deploy independently after its focused regression suite passes.
- TM-02 deploys only after all governed route families pass at 430, 390 and 360 px.
- Production smoke checks confirm computed press states, reduced motion and exact `X-Sanctuary-Release`.

### Effort

Medium across two pull requests.

### Implementation risk

Low. Most changes are CSS-only and reuse current semantic owners.

### Rollback strategy

Revert the affected pull request. No data, content or API migration is involved. If one consumer proves problematic, revert only its token adoption while retaining the shared token definitions and contract test.

---

## Phase TM2: Controlled product-gallery interaction refinement

### Objective

Make the controlled product gallery follow deliberate horizontal finger movement while preserving vertical scrolling, accessible controls, one current status and bounded image loading.

### User outcome

A product image begins moving with the finger after horizontal intent is clear, then settles precisely to the current or adjacent image. Vertical page gestures continue naturally through the gallery.

### Exact scope

1. Preserve `ResponsiveGallery` as the shared controlled product-gallery owner.
2. Keep its labelled region, Previous and Next controls, `Image n of total` status, Arrow keys, Home, End and focus retention.
3. Add a small internal gesture state machine:
   - `idle`
   - `pending-intent`
   - `dragging-horizontal`
   - `settling`
4. On pointer-down, record pointer ID, coordinates and gallery width. Do not change the active item yet.
5. Use an approximately 8 px intent threshold:
   - if vertical distance wins, cancel the gallery gesture and leave page scrolling native
   - if horizontal distance wins by a clear ratio, capture the pointer and begin direct manipulation
6. Update a CSS transform variable through one requestAnimationFrame-batched path. Do not call React state setters on every pointer move.
7. Use the existing 48 px minimum commit threshold, with an optional width-relative threshold only when tests show it improves consistency across 360 to 430 px.
8. On release:
   - commit to the adjacent image when the threshold is met
   - otherwise return to the current image
   - settle within `--motion-duration-short`
   - use no spring, bounce, elastic overshoot or exaggerated scaling
9. On `pointercancel`, loss of pointer capture, resize or item change, return safely to the current image.
10. Render no more than previous, current and next visual frames when adjacent readiness is active.
11. Activate adjacent readiness only when an IntersectionObserver reports the gallery within a bounded preload margin, or when the visitor first interacts with it.
12. Before the gallery approaches the viewport, retain the current one-active-image request contract.
13. Keep only the active slide in the accessibility tree. Adjacent visual frames use empty alternative text and `aria-hidden`, and contain no focusable content.
14. In reduced-motion mode:
   - retain direct finger-follow while the finger is down because it is user-controlled spatial feedback
   - remove autonomous post-release travel
   - update the active image immediately after threshold resolution
15. Do not alter the native project-detail gallery.

### Shared components affected

- `apps/marketing/components/marketing-foundation/ResponsiveGallery.tsx`
- `apps/marketing/components/marketing-foundation/Interactions.module.css`
- `apps/marketing/components/marketing-foundation/Interactions.test.tsx`
- `apps/marketing/components/products/ProductDetailPage.tsx`, only if near-viewport activation cannot remain internal to `ResponsiveGallery`
- `playwright/marketing.products.spec.ts`
- `playwright/marketing.foundation.spec.ts`
- performance evidence helpers where required

### Dependencies

- TM1 motion tokens and active-state contract
- Existing product catalogue and `Figure` ratio ownership
- Existing `touch-action: pan-y` contract, unless pointer testing proves a narrower change is required

### Non-goals

- No thumbnails
- No fullscreen viewer
- No autoplay
- No infinite cloned rail beyond the bounded previous/current/next frames
- No native project-gallery change
- No third-party carousel or motion package
- No eager loading of the complete product gallery
- No caption redesign

### Acceptance criteria

- A deliberate horizontal gesture visibly moves content before pointer-up.
- A normal vertical gesture scrolls the page and does not change gallery position.
- A short horizontal gesture below the commit threshold returns to the current image.
- `pointercancel` returns cleanly with no stale transform or captured pointer.
- A committed gesture updates the status exactly once.
- Previous, Next, Arrow Left, Arrow Right, Home and End continue working.
- Focus remains on the operated button or gallery region.
- Only the active image and caption are exposed to assistive technology.
- No more than three gallery images are mounted after adjacent readiness activates.
- Adjacent images are not requested during initial load while the gallery remains outside the preload margin.
- Reduced motion removes post-release travel.
- No layout shift occurs when adjacent frames mount or the active image changes.
- The active image frame keeps its governed ratio and focal position.

### Automated tests

Unit and component tests:

- pending horizontal intent
- vertical intent cancellation
- horizontal intent capture
- below-threshold release
- committed next and previous gesture
- pointer cancellation
- resize during gesture
- reduced-motion release
- button and keyboard focus retention
- adjacent accessibility-tree exclusion

Playwright tests:

- touch-enabled Chromium at 430, 390 and 360 px
- deliberate horizontal swipe
- vertical swipe through gallery
- diagonal gesture
- short cancelled gesture
- repeated next/previous controls
- reduced motion
- keyboard operation
- image request timing before and after near-viewport activation
- no overflow, no nested vertical scroller and no CLS

### Physical-device tests

Required before production completion:

- iOS Safari at small and large mobile classes
- Android Chrome at small and large mobile classes
- slow drag, fast drag, short drag, diagonal drag and vertical page swipe
- direction change before release
- repeated gallery operation after fast vertical scrolling
- browser edge gesture proximity
- image readiness on a cold network session

### Accessibility tests

- VoiceOver announces one carousel region, current position and active image content
- TalkBack announces the same logical state
- inactive visual frames are skipped
- button names remain contextual
- status updates are polite and not repeated excessively
- reduced motion behaves as specified

### Performance tests

- initial product-detail image request count and image bytes do not increase before the gallery enters the preload margin
- compressed route script increase is recorded and should remain below 10 KB unless a larger change is explicitly justified
- no pointer handler creates a task over 50 ms
- pointer move updates are requestAnimationFrame-batched
- no sustained sequence of three or more frames above 32 ms during repeated 60 Hz swipes in the physical trace
- CLS remains at the current zero target and must not exceed 0.1

### Rollout requirements

- Protected preview with exact release identity
- Current product route matrix at desktop, tablet, 430, 390 and 360 px
- Before and after image-request evidence
- Physical iOS and Android sign-off before production deployment
- Production smoke on at least gable, blinds and heater product variants

### Effort

Medium to large in one focused pull request.

### Implementation risk

Medium. Gesture arbitration, image readiness and accessibility-tree ownership require careful coordination.

### Rollback strategy

Revert TM-03 to the current one-active-image implementation. Product data, route structure, controls and analytics remain unchanged, so rollback is code-only and low operational risk.

---

## Phase TM3: Physical-device validation and bounded continuity fixes

### Objective

Validate the cumulative touch system on real devices, close the evidence gap and make only narrow fixes supported by reproduced failures or traces.

### User outcome

Scrolling, overlays, galleries, Back and Forward, form states and route feedback behave predictably on real Safari and Chrome rather than only in emulated Chromium.

### Exact scope

TM3 is delivered through TM-04 and, only when required, TM-05.

TM-04 records evidence without changing customer interaction code:

- physical iPhone Safari at small and large mobile classes
- physical Android Chrome at small and large mobile classes
- VoiceOver and TalkBack
- dated keyboard-only desktop pass
- rapid vertical scroll and direction reversals
- menu and project navigator opening from non-zero scroll
- browser Back and Forward
- native project-gallery swipes, controls, snap, image decoding and the rAF geometry-reading current-index path
- controlled product-gallery gestures
- disclosures opened near viewport edges
- contact mobile keyboard, autofill, file selection, validation, failure, retry and success states
- fixed header blur, project trigger blur and footer/header synchronisation traces
- route progress and page-entry continuity

TM-05 is opened only if TM-04 reproduces one highest-severity failure in one of two predefined lanes.

**Lane A, history and overlay continuity:**

- Back or Forward loses useful scroll context
- menu or project navigator opening or closing visibly moves the document
- a stale body or root lock remains after route, history or breakpoint change

**Lane B, native project-gallery frame continuity:**

- the rAF current-index path causes repeatable layout-driven frame misses during native swiping
- current-position updates visibly lag or oscillate because each scroll frame rereads all figure geometry
- a cold adjacent image repeatedly produces an active blank frame despite the existing lazy-loading contract

Only one lane may be implemented in TM-05. If both lanes fail, amend this plan and split them into separate PRs rather than combining history, locking and gallery performance. If neither lane fails, TM-05 is not opened and the programme completes after four pull requests.

Performance issues involving fixed blur or footer/header synchronisation are documented in TM-04. They do not share TM-05 unless the same trace proves they are the direct cause of the selected reproduced failure. Otherwise they enter the deferred measured-performance backlog as separate work.

### Shared components affected

TM-04:

- new `docs/mobile-touch-motion-validation.md`
- new artifacts under `artifacts/mobile-touch-motion/`
- Playwright or trace helpers only where they do not change product behaviour

Conditional TM-05, Lane A:

- `apps/marketing/components/ScrollReset.tsx`
- `apps/marketing/components/Header.tsx`
- `apps/marketing/app/projects/ProjectNavigator.tsx`
- the minimum shared scroll-lock utility only if both overlay owners need the same verified fix
- `apps/marketing/styles/header.css`
- `apps/marketing/app/projects/projects.css`

Conditional TM-05, Lane B:

- `apps/marketing/app/projects/ProjectGallery.tsx`
- `apps/marketing/app/projects/ProjectGallery.module.css`
- `apps/marketing/app/projects/projects.css`, only if required

Both lanes use focused browser tests and the physical validation record.

### Dependencies

- TM1 and TM2 deployed to an identified production release
- access to required physical devices and assistive technologies
- explicit production submission authority for a real success-state test, or a clearly labelled intercepted/test-environment alternative

### Non-goals

- No speculative blur removal
- No broad footer rewrite
- No global history manager
- No global smooth scrolling
- No performance cleanup unrelated to a trace
- No analytics-debug remediation inside this programme
- No new project-gallery architecture

### Acceptance criteria

- Every required physical and assistive-technology run has a date, tester, device, OS, browser or AT version and result.
- No Chromium emulation result is labelled as physical-device proof.
- Opening and closing the menu or project sheet from non-zero scroll causes no visible page jump.
- No stale lock remains after Escape, navigation, Back, Forward, rotation or desktop breakpoint change.
- Back from a project detail returns to the expected collection state and useful reading position.
- Back and Forward through filter changes preserve the expected query state and scroll context.
- Native project-gallery touch remains native and does not move the document sideways.
- Product-gallery vertical gestures remain reliable.
- No repeated frame or interaction-latency failure remains unexplained.
- Any code fix is limited to the reproduced owner and is retested across every affected route and device.

### Automated tests

- existing Phase 5 12-route matrix
- shared header focus and lock tests
- project navigator focus and lock tests
- new explicit scroll-position assertions for Back and Forward
- route progress click and popstate tests
- product and project gallery regression suites
- reduced-motion lanes
- production release-identity and cache-busted parity checks

### Physical-device tests

The full matrix is defined in section 7.

### Accessibility tests

- VoiceOver and TalkBack for menu, one disclosure, native project gallery, controlled product gallery, form error summary, file input and success state
- manual keyboard-only pass across the same primary journeys
- 200 percent zoom where supported
- reduced motion on physical devices where available

### Performance tests

- scroll and gesture traces on physical iOS and Android
- no task over 50 ms attributable to the new interaction handlers
- no repeated forced-layout sequence attributable to project-gallery current-index calculation
- no sustained three-frame sequence over 32 ms at 60 Hz during repeated gestures
- note high-refresh results separately and do not generalise them to 120 Hz unless actually tested
- compare fixed blur and footer/header state work only through before and after traces
- preserve current route transfer and CLS budgets

### Rollout requirements

- TM-04 may merge as documentation and evidence without production deployment.
- Conditional TM-05 requires protected preview, exact release identity and all affected physical-device retests before production.
- The final production record must identify the deployed commit.

### Effort

Medium for evidence collection. Conditional remediation is small to medium if one owner is affected.

### Implementation risk

Low for TM-04. Medium for TM-05 because history, lock or native-scroll measurement changes can regress otherwise stable interaction behaviour.

### Rollback strategy

TM-04 has no product rollback. TM-05 is reverted as one bounded continuity change. Lane A must not retain a partially shared lock helper if either owner is reverted. Lane B must restore the current Phase 6 project-gallery implementation in full.

---

# 5. Pull-request plan

## PR TM-01: Establish the Foundation motion and pressed-state contract

### Single user outcome

Shared Foundation controls acknowledge touch immediately and use one restrained motion vocabulary.

### Exact implementation scope

- Add the canonical tokens and reduced-motion values to `apps/marketing/styles/tokens.css`.
- Migrate only Foundation shared owners:
  - Button
  - TextLink
  - EditorialCard
  - Disclosure summary and icon
  - controlled-gallery buttons
- Add restrained active states.
- Gate Foundation hover-only effects to fine pointers.
- Remove persistent `.page-layer` `will-change` from `apps/marketing/app/globals.css`.
- Add `test/marketing-motion-contract.test.ts` for the Foundation governed files.
- Document the token contract in `docs/marketing-ui-foundation.md`.

### Probable files and components

- `apps/marketing/styles/tokens.css`
- `apps/marketing/app/globals.css`
- `apps/marketing/components/marketing-foundation/foundation.module.css`
- `apps/marketing/components/marketing-foundation/Interactions.module.css`
- `apps/marketing/components/marketing-foundation/Primitives.test.tsx`
- `apps/marketing/components/marketing-foundation/Interactions.test.tsx`
- `test/marketing-motion-contract.test.ts`
- `playwright/marketing.foundation.spec.ts`
- `docs/marketing-ui-foundation.md`

### Important technical decisions

- CSS owns pressed feedback. Do not add React pointer state to links or buttons.
- Large editorial cards do not scale.
- Reduced motion removes transitions and scale but retains immediate surface feedback.
- Existing route adapters continue inheriting Foundation behaviour without route-specific copies.

### Acceptance criteria

- Canonical token block exists once.
- Foundation governed files contain no unapproved literal transition durations or easing curves.
- Primary and secondary buttons show active feedback without geometry change.
- Text links show immediate feedback without moving layout.
- Editorial cards use surface or opacity feedback only.
- Disclosure bodies remain native and unanimated in height.
- Gallery controls retain focus, disabled and reduced-motion states.
- Desktop visuals remain stable.

### Unit tests

- motion contract token and governed-source assertions
- Disclosure state and focus regression
- ResponsiveGallery control and status regression
- component rendering tests remain green

### Playwright tests

- computed normal, active, focus-visible and reduced-motion styles in the Foundation catalogue
- pointer-down screenshot at 390 px
- bounding-box equality before and during active state
- no sticky hover under mobile emulation

### Performance evidence

- no script increase
- no new image request
- compare route paint and memory after removing page-layer `will-change`
- no new CLS or long task

### Physical-device validation

One iOS and one Android Foundation control smoke before production closure.

### Accessibility validation

Focus, selected, disabled and reduced-motion states remain distinct. No accessible tree change.

### Non-goals

No header, footer, project, product, contact or route-adapter migration. No gallery gesture change. No history change.

### Dependencies

Current Foundation UI and Phase 6 baseline.

### Effort

Medium.

### Risk

Low.

### Review notes

Review the token names, active-state subtlety and contract-test boundaries before debating route-specific adoption. This PR deliberately leaves some literal values outside its governed file set.

---

## PR TM-02: Adopt the tactile contract across shared chrome and route adapters

### Single user outcome

The same immediate, restrained touch response is present across the customer journey rather than only inside Foundation examples.

### Exact implementation scope

- Apply shared tokens and active-state principles to:
  - mobile menu trigger and menu links
  - route progress visuals
  - existing native project-gallery controls
  - project cards, actions, selector trigger and sheet controls
  - product cards and product disclosure adapters
  - homepage route adapters and disclosures
  - residential and SEO landing disclosures
  - contact buttons, audience cards, checks, file-selector button and file removal
  - footer links and review action
- Gate applicable hover-only effects to fine pointers.
- Add the migrated files to the motion contract guard.
- Keep the current Phase 6 project-gallery behaviour unchanged.
- Keep route-progress JS timings and click/popstate model unchanged.

### Probable files and components

- `apps/marketing/styles/header.css`
- `apps/marketing/app/globals.css`
- `apps/marketing/app/projects/ProjectGallery.module.css`
- `apps/marketing/app/projects/projects.css`
- `apps/marketing/components/products/product-pages.module.css`
- `apps/marketing/app/home-v2/home-v2.module.css`
- `apps/marketing/app/pergolas-auckland/pergolas-auckland.css`
- `apps/marketing/components/seo-landing/seo-landing.css`
- `apps/marketing/app/contact/contact.css`
- `apps/marketing/components/SiteFooter.tsx`
- `test/marketing-motion-contract.test.ts`
- relevant Playwright suites

### Important technical decisions

- Do not create a universal React `TouchTarget` component.
- Each semantic owner keeps its current markup and state ownership.
- Shared tokens unify values; local selectors retain context-appropriate feedback mode.
- Header and project-sheet locking are not changed in this PR.
- Route progress remains delayed so fast navigation does not flash, while the tapped target supplies immediate acknowledgement.

### Acceptance criteria

- Every primary customer-facing button, linked card, menu row, disclosure summary, gallery control, form choice and footer action has a visible active state.
- No active state conflicts with `aria-current`, checked, disabled, sending, success or error states.
- Menu enter and exit use distinct governed durations.
- Project navigator enter and exit use the same panel vocabulary without changing its lock behaviour.
- Route-progress transform and opacity use tokens.
- Existing Phase 6 native project-gallery controls and live status remain intact.
- No route layout, copy, destination, analytics attribute or enquiry context changes.

### Unit tests

- motion contract expanded-owner assertions
- existing Header, project, product and contact component tests
- no new stateful pointer code expected

### Playwright tests

- 430, 390 and 360 px active-state sampling across primary routes
- short viewport menu
- reduced motion
- desktop hover and focus regression
- contact selected, sending and disabled state regression
- native project-gallery control and status regression
- existing 12-route Phase 5 matrix

### Performance evidence

- zero new JS for tactile states
- no increase in initial requests
- no CLS regression
- no long task regression
- route progress does not flash for navigation completed before its existing delay

### Physical-device validation

One iOS and one Android journey smoke across homepage, project, product and contact before production closure.

### Accessibility validation

- keyboard focus remains visible
- checked and selected states remain stronger than pressed states
- reduced motion removes transitions
- file-selector and remove controls retain names and target sizes

### Non-goals

No controlled-gallery finger-follow, scroll restoration, lock refactor, blur removal, footer observer rewrite or broad desktop motion change.

### Dependencies

TM-01 merged.

### Effort

Medium.

### Risk

Low to medium because the file set is broad, although behaviour remains CSS-owned.

### Review notes

Review by interaction family, not by stylesheet. Reject any route-local duration or easing that duplicates a shared token without a documented exemption.

---

## PR TM-03: Connect the controlled product gallery to the finger

### Single user outcome

Product imagery follows a deliberate horizontal gesture before release while vertical page scrolling remains native.

### Exact implementation scope

Implement the TM2 gesture state machine, bounded adjacent frames, near-viewport readiness, accessibility-tree exclusion, reduced-motion release and request-timing tests exactly as defined in section 4.

### Probable files and components

- `apps/marketing/components/marketing-foundation/ResponsiveGallery.tsx`
- `apps/marketing/components/marketing-foundation/Interactions.module.css`
- `apps/marketing/components/marketing-foundation/Interactions.test.tsx`
- `apps/marketing/components/products/ProductDetailPage.tsx`, only if required
- `playwright/marketing.foundation.spec.ts`
- `playwright/marketing.products.spec.ts`
- focused performance artifact helpers

### Important technical decisions

- Pointer movement updates a CSS variable through requestAnimationFrame, not React state per move.
- Horizontal intent is established before pointer capture.
- Vertical intent cancels without `preventDefault`.
- No more than previous, current and next visual frames exist.
- The active slide remains the only accessible slide.
- Reduced motion keeps direct manipulation but removes autonomous settle travel.
- Native project gallery is untouched.

### Acceptance criteria

All TM2 phase acceptance criteria pass, including image-request timing and physical diagonal-gesture tests.

### Unit tests

Full gesture-state and accessibility set defined in TM2.

### Playwright tests

Touch, vertical, diagonal, cancel, reduced-motion, keyboard, focus, request timing, CLS and target-width matrix.

### Performance evidence

- before and after product-detail script bytes
- initial image request count
- near-view adjacent request count
- pointer-handler long tasks
- layout shift
- physical frame trace

### Physical-device validation

Required on both iOS Safari and Android Chrome before production deployment.

### Accessibility validation

VoiceOver and TalkBack on one representative product page, plus keyboard and reduced motion.

### Non-goals

No project-gallery change, no fullscreen, no thumbnails, no complete-gallery preload and no third-party package.

### Dependencies

TM-01 and TM-02 merged.

### Effort

Medium to large.

### Risk

Medium.

### Review notes

The review must focus on gesture arbitration, DOM and request bounds, and accessibility ownership. Visual polish alone is not sufficient approval.

---

## PR TM-04: Record the physical touch and motion validation matrix

### Single user outcome

The cumulative mobile experience is proven on real devices, with failures documented precisely rather than inferred from emulation.

### Exact implementation scope

- Add `docs/mobile-touch-motion-validation.md`.
- Record all device, browser, assistive-technology and task-script results from section 7.
- Store screenshots, recordings and exported traces under `artifacts/mobile-touch-motion/physical/`.
- Record exact production release identity.
- Add or adjust non-product test helpers only when required to collect repeatable evidence.
- Do not change customer interaction code in this PR.

### Probable files and components

- `docs/mobile-touch-motion-validation.md`
- `docs/testing-and-qa.md`
- `artifacts/mobile-touch-motion/physical/**`
- Playwright support helpers, only when evidence collection requires them

### Important technical decisions

- A blocked run is not a pass.
- Chromium emulation is supporting evidence only.
- Device frame and latency claims include exact device and refresh conditions.
- Any failure receives route, step, expected, observed and evidence filename.

### Acceptance criteria

- D1 through D4, A1 through A3 and all touch-motion task scripts have dated results.
- Every blocked result has an owner and required access or device.
- Production release identity is recorded.
- History, locks, native project gallery, controlled product gallery, disclosures and form states are explicitly covered.
- Fixed blur and footer/header work are traced and classified as pass, fail or inconclusive.

### Unit tests

None required unless support helpers are added.

### Playwright tests

Existing automated baseline rerun to accompany physical evidence.

### Performance evidence

Physical trace and recording set defined in section 7.

### Physical-device validation

This PR is the physical-device validation owner.

### Accessibility validation

VoiceOver, TalkBack and dated manual keyboard pass.

### Non-goals

No customer-facing fix, no speculative refactor, no analytics submission and no broad performance cleanup.

### Dependencies

TM-01 through TM-03 deployed to an identified production release.

### Effort

Medium.

### Risk

Low product risk, medium scheduling and evidence risk.

### Review notes

Do not merge with unresolved blank results. Use `Blocked`, `Pass`, `Fail` or `Inconclusive`, never optimistic language.

---

## PR TM-05, conditional: Resolve one verified mobile continuity defect

### Opening condition

Open this PR only when TM-04 identifies one highest-severity reproduced failure in an allowed lane. Select exactly one lane for the PR.

**Lane A, history and overlay continuity:**

- Back or Forward loses the prior useful scroll context
- opening or closing the menu or project sheet moves the document
- a stale root or body lock survives Escape, navigation, history or breakpoint change

**Lane B, native project-gallery frame continuity:**

- the current rAF plus `getBoundingClientRect()` loop causes repeatable frame misses
- current-position state visibly lags or oscillates during native swiping
- the existing lazy sequence repeatedly presents an undecoded active image on a verified device and network condition

If neither lane is reproduced, record TM-05 as not required and complete the programme after TM-04. If both lanes fail, update this roadmap and create separate PRs. Do not combine them.

### Single user outcome

The single highest-severity verified continuity failure is removed without changing unrelated interaction architecture.

### Exact implementation scope

#### Lane A scope

- Make `ScrollReset` distinguish ordinary route navigation from history traversal only where the reproduced failure requires it.
- Preserve valid fragment navigation and responsive disclosure reveal.
- Consolidate header and project-navigator fixed-body locking only if both owners reproduce the same failure.
- Preserve destination navigation ownership by the router.
- Add explicit tests for scroll position before navigation, after Back, after Forward and after overlay close.

#### Lane B scope

- Preserve native project-gallery scrolling, mixed frame heights, controls, status, keyboard behaviour and current snap.
- Move repeated figure geometry measurement out of the scroll-frame path.
- Cache figure centre or offset data on mount, image-set change and ResizeObserver notification.
- During scroll, derive the nearest index from `scrollLeft` and cached values, using a bounded search rather than reading every figure rectangle.
- Change lazy or adjacent image readiness only when the reproduced blank-frame evidence requires it, and never preload the complete gallery.
- Retain reduced-motion behaviour and current production semantics.

Fixed-blur or footer/header changes may enter this PR only if the same trace proves they directly cause the selected failure. Otherwise they remain deferred.

### Probable files and components

Lane A:

- `apps/marketing/components/ScrollReset.tsx`
- `apps/marketing/components/Header.tsx`
- `apps/marketing/app/projects/ProjectNavigator.tsx`
- minimal shared scroll-lock utility, only if verified necessary
- `apps/marketing/styles/header.css`
- `apps/marketing/app/projects/projects.css`
- shared header, project and phase-five Playwright suites

Lane B:

- `apps/marketing/app/projects/ProjectGallery.tsx`
- `apps/marketing/app/projects/ProjectGallery.module.css`
- `apps/marketing/app/projects/projects.css`, only if required
- `playwright/marketing.projects.spec.ts`
- physical trace evidence

### Important technical decisions

Lane A:

- Do not set `history.scrollRestoration = 'manual'` globally without a reproduced cross-route need and comprehensive coverage.
- Do not create an overlay history entry merely to make Android Back close an overlay unless product ownership explicitly approves that browser behaviour.
- Cleanup restores the exact prior inline style and scroll position.

Lane B:

- Native touch and browser momentum remain authoritative.
- Scroll handling must not call React state setters more than once per animation frame.
- Geometry is recomputed on resize or content change, not for every figure on every scroll frame.
- Do not replace the strip with `ResponsiveGallery`.

### Acceptance criteria

- The selected TM-04 failure no longer occurs.
- All unchanged interaction contracts remain intact.
- Lane A: ordinary path navigation still starts at the expected top or valid fragment; Back and Forward restore useful context; no stale lock remains.
- Lane B: native swiping, mixed heights, controls, live status and keyboard operation remain; the verified frame or position defect is removed; no complete-gallery preload is introduced.
- Every affected device, assistive technology and automated lane is retested.

### Unit tests

- Lane A: lock acquisition, duplicate request protection and exact cleanup if a helper is introduced; ScrollReset navigation-mode tests if changed.
- Lane B: cached geometry refresh, nearest-index calculation, resize update and cleanup tests where practical.

### Playwright tests

- Lane A: non-zero scroll overlays, Back and Forward positions, filter history, fragments, breakpoint and Escape cleanup.
- Lane B: native scroll, position updates, controls, edge state, resize, reduced motion, mixed heights and request bounds.

### Performance evidence

- Before and after trace for the selected failure.
- No new long task, CLS or transfer regression.
- Lane B must show the per-scroll geometry-read sequence is removed or no longer contributes measurable frame misses.

### Physical-device validation

Required on every device that reproduced the selected failure, plus one opposite-platform control device.

### Accessibility validation

Focus, announcements and reading context remain predictable after the selected change.

### Non-goals

No combined history and gallery fix, no broad blur cleanup, no footer rewrite, no route animation and no global navigation redesign.

### Dependencies

TM-04 failure evidence.

### Effort

Small to medium.

### Risk

Medium.

### Review notes

The PR description must name Lane A or Lane B, quote the exact TM-04 failure ID and attach before and after evidence. A hypothetical benefit is not sufficient scope justification.

---

# 6. Interaction ownership matrix

| Interaction | Current owner | Future owner | Current timing or behaviour | Planned timing or behaviour | Affected routes | Phase and PR | Tests | Risk |
|---|---|---|---|---|---|---|---|---|
| Foundation buttons | `Primitives.tsx`, `foundation.module.css` | Same | 160 ms colour transitions, hover and focus, no shared press contract | Shared tokens, small-control press scale and surface feedback | All Foundation consumers | TM1, TM-01 | Foundation unit and browser suite | Low |
| Text links | `Primitives.tsx`, `foundation.module.css` | Same | Arrow moves on hover, no deliberate touch-down state | Instant opacity or underline feedback; hover gated to fine pointer | All Foundation consumers | TM1, TM-01 | Foundation browser styles | Low |
| Editorial cards | `Patterns/Primitives`, `foundation.module.css` | Same | Surface hover and focus, no press state | Surface or media-overlay press feedback, never whole-card scale | Homepage, projects and Foundation consumers | TM1, TM-01 | Foundation and homepage/project suites | Low |
| Disclosure summaries | `Disclosure.tsx`, `Interactions.module.css`, route adapters | Shared state remains in `Disclosure`; route adapters keep layout | Native immediate open/close; icon uses 160 or 180 ms route values | Native body movement remains immediate; shared short icon and summary feedback | Homepage, projects, products, service, guides | TM1, TM-01 and TM-02 | Interaction, density and route suites | Low |
| Controlled-gallery buttons | `ResponsiveGallery.tsx`, `Interactions.module.css` | Same | 160 ms border/background, hover/focus | Shared tokens and immediate press feedback | Product details, Foundation fixture | TM1, TM-01 | Interaction and product suites | Low |
| Controlled product gallery | `ResponsiveGallery.tsx` | Same | One active image; 48 px pointer-up threshold; no drag-follow | Bounded adjacent track, horizontal intent, finger-follow, short settle | All ten product details | TM2, TM-03 | Unit, product Playwright, physical device | Medium |
| Native project gallery | `ProjectGallery.tsx`, `ProjectGallery.module.css`, `projects.css` | Same route owner | Native horizontal strip plus deployed controls, live position, keyboard operation and rAF geometry reads during scroll | Remains native; adopts tokens; snap, decode and current-index cost are validated in TM3; cached geometry only if a trace justifies Lane B | Project details | TM1/TM3, TM-02/TM-04/TM-05 conditional | Project suite and physical traces | Medium until device trace |
| Mobile menu | `Header.tsx`, `header.css` | Same | 180 ms transform, 160 ms opacity, fixed-body lock and focus containment | Tokenised 220 ms enter, 150 ms exit, immediate trigger and row feedback | All public routes | TM1, TM-02 | Shared header, short viewport, physical | Low |
| Project navigator sheet | `ProjectNavigator.tsx`, `projects.css` | Same unless verified shared lock is needed | 220 ms sheet movement, root/body overflow lock | Tokenised panel timing; lock unchanged until TM3 evidence | Project details | TM1/TM3, TM-02/TM-05 conditional | Project suite and device lock tests | Medium if lock changes |
| Route progress | `RouteProgress.tsx`, `globals.css` | Same | 150 ms show delay; 360 ms transform; click and popstate tracking | Show delay retained; visual timings tokenised; local press supplies immediate acknowledgement | All marketing routes | TM1, TM-02 | Route navigation and reduced-motion tests | Low |
| Route entry | `app/template.tsx`, `AnimatedRouteTemplate.tsx`, `globals.css` | Same | 280 ms opacity from .96 to 1; persistent parent `will-change` | Restrained entry retained initially; persistent parent hint removed | All marketing routes | TM1, TM-01 | No-JS, route and paint comparison | Low |
| Form submit states | `ContactEnquiryForm.tsx`, embedded form owner, route CSS | Existing form owners | Sending label, disabled state, live status, error and success focus | Tokenised press and state transitions; semantic state ownership unchanged | Contact and embedded forms | TM1, TM-02 | Contact and phase-four suites | Low |
| File controls | Contact and embedded form owners | Same | Native file input and selected-file removal | Native picker retained; selector button and remove control receive governed press feedback | Contact and embedded forms | TM1, TM-02 | File validation and device picker tests | Low |
| Footer links | `SiteFooter.tsx` | Same | Large targets and hover utility classes, no shared press state | Immediate opacity or underline feedback using tokens | All routes with footer | TM1, TM-02 | Footer target, contrast and active-state checks | Low |
| Scroll restoration | `ScrollReset.tsx` | Same unless verified helper needed | Path reset and fragment reveal; history mode not explicit | No change until physical evidence; conditional history-aware fix | All routes, especially projects and contact | TM3, TM-04/TM-05 | Back, Forward, fragments and scroll position | Medium |
| Footer/header synchronisation | `FooterHeaderSync.tsx`, `header.css` | Same unless trace proves change | rAF-throttled geometry reads and body class toggles | Validate only; measured fix becomes separate backlog unless it causes the TM-05 continuity failure | All routes with footer | TM3, TM-04 | Scroll traces and production regression | Medium if changed |
| Fixed header blur | `header.css` | Same | Fixed 16 px backdrop blur on solid header | Validate on devices; no speculative removal | All public routes | TM3, TM-04 | Frame and raster traces | Medium if changed |

---

# 7. Testing and evidence plan

## 7.1 Evidence storage

Use:

- `artifacts/mobile-touch-motion/tm-01/`
- `artifacts/mobile-touch-motion/tm-02/`
- `artifacts/mobile-touch-motion/tm-03/`
- `artifacts/mobile-touch-motion/physical/`
- `docs/mobile-touch-motion-validation.md`

Every artifact set must record:

- commit SHA
- production or preview origin
- viewport
- reduced-motion state
- browser or device
- date
- test command or manual task ID

## 7.2 Automated viewport matrix

Every relevant PR must cover:

| Class | Viewport |
|---|---|
| Large mobile | 430 x 932 |
| Standard mobile | 390 x 844 |
| Small mobile | 360 x 800 |
| Short mobile | 360 x 480 or closest stable fixture |
| Tablet control | 768 x 1024 |
| Desktop regression | 1440 x 1000 |

## 7.3 Physical-device and assistive-technology matrix

| Run | Device requirement | Browser or AT | Required tasks |
|---|---|---|---|
| D1 | Physical iPhone near 360 to 390 px CSS width | Safari, touch | TTM1 to TTM8 |
| D2 | Physical larger iPhone near 430 px CSS width | Safari, touch | TTM1 to TTM8 |
| D3 | Physical Android near 360 to 390 px CSS width | Chrome, touch | TTM1 to TTM8 |
| D4 | Physical larger Android near 430 px CSS width | Chrome, touch | TTM1 to TTM8 |
| A1 | One representative physical iPhone | VoiceOver and Safari | TTM2, TTM4, TTM5, TTM6, TTM8 |
| A2 | One representative physical Android | TalkBack and Chrome | TTM2, TTM4, TTM5, TTM6, TTM8 |
| A3 | Desktop | Keyboard-only current Chromium | All applicable tasks |

Record exact model, OS, browser version, display-size setting and refresh mode. Do not infer CSS width from device marketing name alone.

## 7.4 Touch and motion task scripts

### TTM1: Vertical scroll quality

1. Open the homepage from a cold tab.
2. Scroll slowly, then rapidly.
3. Reverse direction twice.
4. Stop, wait and restart.
5. Repeat on a long guide, project detail and contact page.
6. Record any delayed header response, hitch, content jump or accidental horizontal movement.

Pass: native momentum remains intact, no scroll-jacking appears, and no repeatable frame hitch is attributable to the implemented changes.

### TTM2: Mobile menu and short viewport

1. Scroll to a non-zero position.
2. Press and hold the menu trigger briefly, then release.
3. Confirm immediate pressed feedback.
4. Open and close normally.
5. Repeat with Escape or the supported AT action.
6. Open at a 360 x 480 class viewport and reach every link.
7. Navigate to another route and use Back.
8. Rotate or cross the desktop breakpoint once.

Pass: background scroll is locked only while open, prior reading position returns after dismissal, destination navigation does not restore the old page position, and no stale lock remains.

### TTM3: Primary touch acknowledgement

Sample at least:

- Foundation primary and secondary button
- text link
- editorial card
- project card
- menu row
- disclosure summary
- native project-gallery control
- controlled product-gallery control
- form audience card
- checkbox or add-on row
- file-selector button
- submit button
- footer link

Pass: each acknowledges finger-down without layout change, bounce or sticky hover.

### TTM4: Disclosures near viewport edges

1. Position a summary near the bottom third of the viewport.
2. Open and close it.
3. Repeat on homepage, product, residential service, commercial or professional and project detail.
4. Test reduced motion.
5. Test with VoiceOver or TalkBack.

Pass: summary state is announced, focus remains useful, body content appears without a large animated event and the page does not jump unexpectedly.

### TTM5: Native project gallery

1. Open Warkworth project detail.
2. Swipe slowly and rapidly through at least three images.
3. Try a diagonal gesture.
4. Reverse direction before release.
5. Operate Previous and Next.
6. Use Arrow keys, Home and End.
7. Observe image decoding on a cold connection.
8. Capture the current-index scroll handler and look for repeated layout reads or position lag.
9. Repeat with reduced motion.

Pass: touch movement remains native, captions move with images, mixed heights remain top-aligned, position and edge state remain correct, vertical page movement is not accidentally triggered, no blank frame is reproducible and current-index tracking does not create a repeatable frame hitch.

### TTM6: Controlled product gallery

1. Open gable product detail.
2. Perform a slow horizontal drag.
3. Perform a short drag below threshold.
4. Perform a vertical page swipe beginning over the image.
5. Perform a diagonal gesture.
6. Reverse direction before release.
7. Trigger pointer cancellation by interrupting or changing browser state where possible.
8. Use controls and keyboard.
9. Repeat with reduced motion.
10. Repeat on blinds and heater product variants.

Pass: deliberate horizontal movement follows the finger, vertical gestures remain native, cancelled gestures reset, status and focus are correct, and adjacent frames are not duplicated to assistive technology.

### TTM7: Route and browser history continuity

1. Open `/projects` and apply a filter.
2. Scroll to a later project card.
3. Open the project detail.
4. Use browser Back and Forward.
5. Repeat through a product detail and contact transition.
6. Repeat from a menu destination.
7. Test valid fragment links to a form or disclosed section.

Pass: route, filter and useful reading context return predictably, ordinary new navigation reaches the expected top or fragment, and route progress does not remain stuck.

### TTM8: Contact interaction states

1. Open direct contact with no preselection.
2. Select an audience.
3. Exercise mobile keyboard and autofill.
4. Choose files and remove one.
5. Submit with required fields missing.
6. Correct fields and exercise an intercepted or approved retry failure.
7. Complete one authorised success run if permission exists.
8. Repeat the key states with VoiceOver and TalkBack.

Pass: selection, validation, file state, sending, failure, retry and success are immediate, announced and stable, with no duplicate submission or lost values.

## 7.5 Objective performance checks

| Measure | Required check | Programme threshold |
|---|---|---|
| Layout shift | Existing route matrix plus interaction CLS observation | Target `0`; hard limit `0.1` |
| Long tasks | PerformanceObserver and device trace | No new task over 50 ms attributable to programme handlers |
| Finger-down latency | Pointer-down to first visible state in trace or high-frame-rate recording | Visible by the next rendered frame in lab; no physical result over 100 ms without investigation |
| Gallery drag latency | Input event to transform update | requestAnimationFrame-batched; no sustained visible lag |
| Frame pacing | Repeated scroll and gallery gestures | No sustained run of three or more frames over 32 ms at 60 Hz |
| Image requests | Initial product detail and near-view gallery | No adjacent requests before preload margin; maximum three controlled-gallery frames after activation |
| Image decoding | Cold project and product gallery interaction | No reproducible blank active frame after a committed movement |
| Initial transfer | Product detail before and after TM-03 | No image-byte increase before gallery near-view activation |
| Script transfer | Product detail before and after TM-03 | Record exact delta; target under 10 KB compressed increase |
| Route feedback | Fast and slow internal navigation | No progress flash before existing delay; slower navigation receives progress plus immediate local press feedback |
| Scroll work | Header, project trigger, native project current-index path and footer synchronisation traces | No repeated forced layout or trace-proven customer hitch introduced by programme work |

## 7.6 Production verification

For each deployed implementation PR:

1. Record exact `X-Sanctuary-Release`.
2. Run normal and cache-busted requests across affected route families.
3. Confirm the response release matches the intended merge commit.
4. Run focused browser tests against production.
5. Intercept form requests unless a real submission is explicitly authorised.
6. Store results in the PR evidence directory and validation document.

---

# 8. Acceptance criteria for the complete programme

The programme is complete only when all of the following are true:

- Every primary touch target in the governed journey acknowledges finger-down.
- Pressed states do not change layout geometry.
- No whole architectural card scales.
- No spring, bounce, elastic overshoot or exaggerated scale is introduced.
- Governed durations and easing curves use shared tokens.
- The motion contract guard passes.
- Hover-only effects are restricted to hover-capable fine pointers where required.
- Reduced-motion durations resolve to zero and immediate non-motion feedback remains.
- The native project gallery remains a native horizontal scroller.
- Existing Phase 6 project-gallery controls, status, keyboard and reduced-motion contracts remain.
- The controlled product gallery moves with deliberate horizontal finger movement.
- Vertical gestures beginning over the controlled gallery continue scrolling the page.
- Short, cancelled and diagonal gallery gestures behave predictably.
- No more than three controlled-gallery visual frames are mounted after near-view activation.
- Initial product-detail image transfer does not increase because of adjacent preloading.
- Back and Forward restore useful route, filter and reading context.
- Menu and project-sheet locking does not move the page or leave stale styles.
- Existing target-width tests pass at 430, 390 and 360 px.
- Short viewport, tablet and desktop regression tests pass.
- Current accessibility contracts remain intact.
- VoiceOver, TalkBack and manual keyboard evidence is dated and recorded.
- The 12-route production matrix retains zero overflow and target-size failures.
- No measurable CLS, long-task, initial-transfer or script regression exceeds the programme thresholds.
- Physical-device results are not substituted with emulation.
- The final production deployment is independently identified by release SHA.
- Any unresolved result is recorded as an owned backlog item rather than described as a pass.

---

# 9. Deferred backlog

The following work must not block or expand this programme unless a specific physical trace moves it into a separately approved implementation brief:

- broad image-quality or image-format redesign
- full progressive low-quality to high-quality image strategy
- fullscreen image viewer
- thumbnails or gallery overview modes
- additional native project-gallery features beyond current controls and validation
- decorative section reveal animation
- parallax or scroll-linked image movement
- broad desktop motion redesign
- global navigation restructuring
- replacement of the current header visual design
- global smooth scrolling
- third-party animation or carousel libraries
- broad fixed-blur removal without trace evidence
- broad `FooterHeaderSync` rewrite without trace evidence
- unrelated Phase 5 production analytics-debug reconciliation
- real production enquiry submission without explicit authority
- Lighthouse Windows temporary-profile cleanup issue
- unrelated page copy, SEO, content-density or information-architecture changes
- portal motion or responsiveness work
- legacy viewer and `/start` animation cleanup unless a current customer-facing mobile defect is separately proven

---

# 10. Recommended first Codex goal

```text
Implement PR TM-01 from `docs/mobile-touch-motion-implementation-plan.md` as the authoritative brief.

Add the shared marketing motion and press tokens to `apps/marketing/styles/tokens.css`, migrate only the Foundation Button, TextLink, EditorialCard, Disclosure and controlled-gallery control styles to those tokens, add restrained pressed states and fine-pointer hover gating, remove the persistent `.page-layer` will-change hint, and add the scoped marketing motion contract plus focused Foundation tests.

Preserve semantic markup, focus, reduced motion, current gallery behaviour, route progress logic, page layouts, copy, analytics and desktop composition. Do not touch route-specific consumers, product-gallery gesture architecture, native project-gallery behaviour, scroll restoration or overlay locking. Run the roadmap’s TM-01 unit, Playwright, build, type and performance checks and report exact before-and-after evidence.
```
