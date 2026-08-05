# Sanctuary Pergolas Project-Led Visual Finder Homepage Prototype

## Product, UX and implementation specification

**Repository:** `velt-design/sanctuary`  
**Document path:** `docs/sanctuary-project-led-visual-finder-homepage-prototype.md`  
**Production route:** `/`
**Retired comparison route:** `/home-project-finder`
**Status:** Production homepage specification and promotion history
**Date:** 2 August 2026  
**Primary surface:** Sanctuary Pergolas marketing website  
**Live homepage:** `/` uses the approved project finder after prototype approval
**Related comparison route:** `/home-guided`

---

## 1. Purpose

Create a new experimental Sanctuary Pergolas homepage that combines:

1. the visual impact, credibility and immediate clarity of the current homepage;
2. the relevance and qualification benefits of the guided homepage;
3. a faster, lower-friction mobile journey than a mandatory multi-step questionnaire.

The prototype should lead with an exceptional completed project, help visitors recognise the closest project direction in one visual choice, and provide optional deeper guidance through a short **Build your brief** interaction.

The finished experience should feel like an architectural design conversation, not a quiz, configurator or generic lead-generation funnel.

This is a focused homepage prototype. It is not a full-site redesign.

---

## 2. Core concept

The homepage should follow this principle:

> Show the quality first, help users recognise their project second, then offer deeper guidance only when it is useful.

The page should therefore move through three levels of engagement:

### Level 1: Understand Sanctuary

A strong hero immediately explains what Sanctuary designs and builds, shows the quality of a real completed project and provides a direct enquiry path.

### Level 2: Recognise the project direction

A one-step visual project finder asks visitors to choose the closest starting point:

- a refined deck cover;
- a complete outdoor room;
- a bespoke or difficult-site solution.

The selected direction reveals relevant project evidence and the most appropriate Sanctuary pathway.

### Level 3: Refine the brief

Visitors who need more guidance can optionally select the priorities that matter most. The page converts those choices into a concise plain-language project brief that can be carried into an enquiry.

The deeper interaction must be optional. No visitor should need to complete it before viewing work, understanding the service or starting an enquiry.

---

## 3. Product hypothesis

A project-led homepage with one required visual choice and an optional brief builder will outperform both existing concepts by:

- preserving a strong premium first impression;
- communicating Sanctuary's offer before asking the visitor to interact;
- giving uncertain visitors a simple way to recognise their project;
- providing relevant completed work immediately after one choice;
- reducing the mobile content density of the current homepage;
- reducing the interaction commitment of the guided homepage;
- improving enquiry quality when visitors choose to refine their brief;
- maintaining a visible fast path for high-intent visitors.

---

## 4. Primary objectives

The prototype must:

1. explain Sanctuary's offer within the opening mobile viewport;
2. create a premium, project-led first impression;
3. make the first meaningful interaction understandable without instructions;
4. provide a useful result after one selection;
5. show relevant completed-project evidence before asking for an enquiry;
6. allow visitors to continue without using the project finder;
7. allow interested visitors to build a concise project brief;
8. preserve selected context through the enquiry journey;
9. remain clear and comfortable from 320 px mobile widths upward;
10. use existing shared design, content, analytics and enquiry systems.

---

## 5. Success outcomes

A first-time mobile visitor should be able to:

- understand that Sanctuary designs and builds custom fixed-roof pergolas in Auckland;
- see a high-quality completed project;
- identify the closest project direction in one tap;
- see two relevant built examples;
- understand the recommended service pathway;
- either explore that pathway, start an enquiry or refine the brief;
- send useful project context without completing a long form or questionnaire.

A high-intent visitor should be able to start an enquiry directly from the hero or selected result without completing the optional brief builder.

---

## 6. Target audiences

### Primary

- Auckland homeowners considering a covered deck, patio or pool area;
- homeowners planning a complete outdoor room;
- homeowners with unusual geometry, difficult connections, changing levels or restricted post locations.

### Secondary

- architects, designers and builders;
- commercial and hospitality clients.

The first prototype should optimise the primary residential journey. Commercial and professional routes must remain visible through the global navigation and a quiet secondary pathway, but they do not need to become additional top-level finder choices in this prototype.

This constraint prevents the first interaction from becoming too broad.

---

## 7. Experience principles

### 7.1 Clarity before interaction

The hero must explain the offer before presenting a question.

### 7.2 Recognition before specification

Ask visitors to recognise the kind of space they want, not select roof materials or technical systems.

### 7.3 One useful choice

The first interaction must produce an immediate result. Do not require three selections before showing relevant value.

### 7.4 Progressive depth

The Build your brief interaction should appear only after a project direction has been selected.

### 7.5 Evidence before claims

Use completed projects to support every project direction and recommendation.

### 7.6 Optionality without clutter

Provide a fast enquiry path and a project-browsing path, but keep one visually dominant action at each stage.

### 7.7 Premium through control

Use generous imagery, precise typography, concise copy and restrained motion. Do not add playful quiz graphics, decorative badges or excessive card chrome.

### 7.8 Honest guidance

The experience identifies a useful starting point. It must not imply that a few selections determine the final design, structure, roof system or price.

---

## 8. Prototype route and release strategy

Create the experimental route:

`/home-project-finder`

The route must:

- use `robots: { index: false, follow: false }`;
- be excluded from the sitemap;
- use a self-contained preview title and description;
- retain the normal global header and footer;
- keep `/` unchanged and canonical;
- avoid redirects or metadata changes to the live homepage;
- use production data and shared components where practical;
- be removable without affecting the live route.

Do not promote the prototype to `/` until it has passed the acceptance criteria and has been compared with the current and guided versions.

---

## 9. Recommended page structure

1. Global header
2. Project-led hero
3. Compact proof rail
4. Visual project finder
5. Selected pathway response
6. Optional Build your brief interaction
7. Relevant project evidence
8. Focused conversion close
9. Global footer

The selected pathway response, brief builder and project evidence may form one responsive interactive region rather than three visually disconnected sections.

The prototype should not retain the current homepage's full capability grid, duplicate audience pathways and generic process section. Those would reintroduce the content density this concept is intended to reduce.

---

# 10. Detailed section specification

## 10.1 Global header

Use the existing shared marketing header.

Requirements:

- preserve the Sanctuary brand mark and mobile menu;
- retain a visible route to `Start your project`;
- do not create a prototype-specific header component;
- do not add another dominant CTA beside the hero primary action;
- ensure the menu remains operable with the prototype state in the URL.

The desktop header CTA may remain. On mobile, the global menu should retain its existing enquiry route.

---

## 10.2 Project-led hero

### Purpose

Immediately establish:

- what Sanctuary does;
- the quality and character of the work;
- that the page is based on completed projects;
- the primary exploratory action, with a secondary enquiry action on desktop only.

### Recommended content

**Eyebrow**

`Fixed-roof pergola design and build in Auckland`

**H1**

`Outdoor spaces designed around the way you live.`

**Supporting copy**

`Custom pergolas and outdoor rooms, designed around the house, the site and how the space will be used.`

**Primary action**

`Find your project direction`

This scrolls to the visual project finder.

**Secondary action**

`Start your project`

This remains a desktop action. It is hidden on mobile so the first viewport has
one clear next step: finding a project direction.

### Hero image

Use one exceptional completed-project image with:

- strong mobile cropping;
- clear architectural character;
- visible evidence of use;
- enough tonal control for readable white copy;
- no generic stock imagery;
- no render if a suitable completed project photograph exists.

Recommended initial project:

`Warkworth Outdoor Room`

Codex must inspect the governed project image data and choose the most effective mobile crop rather than assuming the current hero image is final.

### Project attribution

Show a quiet completed-project attribution:

- project name;
- location;
- relevant project type or roof form;
- link to the project page.

### Mobile behavior

- hero and fixed mobile header should together occupy at least the opening viewport;
- headline, copy and actions must fit comfortably at 320 px width and short viewport heights;
- stack actions at small widths;
- avoid placing the project attribution below the fold when practical;
- maintain a visible image focal point behind the copy.

---

## 10.3 Compact proof rail

### Purpose

Provide early credibility without creating three large stacked mobile blocks.

### Content

Use three concise proof items:

1. live Google rating and review count;
2. `Design and build` with one accountable team through installation;
3. `Built project evidence` across residential and selected commercial work.

### Requirements

- use live review data rather than hard-coded review numbers;
- keep the mobile treatment compact;
- use one horizontal or tightly stacked composition without large empty card heights;
- preserve readable links and 44 px touch targets;
- avoid marketing claims that cannot be supported by existing content.

---

## 10.4 Visual project finder

### Section heading

**Eyebrow**

`Find your starting point`

**H2**

`Which project feels closest to what you want to create?`

**Guidance**

`Choose the closest direction. You can refine it or change it later.`

### Choices

Use three large visual options.

#### Option 1

**Label**

`A refined deck cover`

**Description**

`Reliable shelter over a deck or patio, with light, shade and connection to the house considered carefully.`

**Value**

`cover`

**Initial project image candidate**

`Dairy Flat Estate`

#### Option 2

**Label**

`A complete outdoor room`

**Description**

`A more integrated space for dining, entertaining, cooking, relaxing or poolside use.`

**Value**

`outdoor-room`

**Initial project image candidate**

`Warkworth Outdoor Room`

#### Option 3

**Label**

`A bespoke or difficult-site solution`

**Description**

`For unusual geometry, restricted posts, changing levels, difficult roof connections or wider project coordination.`

**Value**

`bespoke`

**Initial project image candidate**

`Tindalls Bay Pavilion`

### Interaction model

- the three options behave as a single-select radio group;
- selecting an option updates the URL and reveals the relevant response below;
- the selection must not immediately navigate away;
- the selected option remains visibly selected;
- users can change the selection without resetting the rest of the page manually;
- changing the project direction clears priorities that are incompatible with the new direction;
- browser Back and Forward must restore valid state;
- refresh must preserve valid query state;
- invalid query values must be removed safely.

### URL contract

Use:

`/home-project-finder?project=cover`

`/home-project-finder?project=outdoor-room`

`/home-project-finder?project=bespoke`

When priorities are selected, append validated closed values using repeated or comma-separated parameters according to repository conventions.

Do not place free text, names, email addresses, phone numbers or enquiry messages in the URL.

---

## 10.5 Selected pathway response

The response must appear immediately after one selection and provide a meaningful payoff before the optional brief builder.

### Shared response structure

1. selected direction summary;
2. pathway heading;
3. short explanation;
4. one primary action to the relevant service page;
5. one secondary action to refine the brief;
6. two relevant completed-project previews.

### Cover response

**Eyebrow**

`Your closest starting point`

**Heading**

`Residential pergola planning`

**Explanation**

`Start with a refined fixed-roof pergola designed around shelter, daylight, shade and the connection to the house.`

**Primary action**

`Explore residential pergolas`

**Destination**

`/pergolas-auckland`

### Outdoor room response

**Eyebrow**

`Your closest starting point`

**Heading**

`A complete outdoor room`

**Explanation**

`Start with a more integrated space where roofing, layout, lighting, furniture and key features can be considered together.`

**Primary action**

`Explore outdoor rooms`

**Destination**

`/outdoor-rooms-auckland`

### Bespoke response

**Eyebrow**

`Your closest starting point`

**Heading**

`Bespoke pergola design`

**Explanation**

`Start with a design-led pathway for difficult connections, structure, levels, geometry or coordination with a wider project.`

**Primary action**

`Explore bespoke pergolas`

**Destination**

`/custom-pergolas-auckland`

### Secondary action

Use:

`Refine what matters`

This opens or reveals the Build your brief interaction.

### Escape actions

Also provide `View all projects` as a quiet text link. Do not offer a direct
enquiry from this early recommendation state.

---

## 10.6 Build your brief

### Purpose

Give visitors optional value in exchange for a small amount of interaction and create useful enquiry context.

### Opening copy

**Eyebrow**

`Optional next step`

**H3**

`What matters most for this project?`

**Guidance**

`Choose up to three priorities. We will turn them into a short starting brief.`

### Shared priorities

Use a maximum of six visible priorities.

1. **Keep natural light**  
   `Add shelter without making the adjoining interior or deck feel dark.`  
   Value: `daylight`

2. **Create more shade and comfort**  
   `Reduce direct sun and make the space more comfortable through warmer weather.`  
   Value: `shade`

3. **Use the space more often**  
   `Create reliable shelter for everyday dining, relaxing or changing weather.`  
   Value: `everyday-use`

4. **Plan for cooking or entertaining**  
   `Allow for furniture, lighting, services, a kitchen, fireplace or gathering space.`  
   Value: `entertaining`

5. **Keep the structure open**  
   `Protect views, circulation and key areas from unnecessary posts or visual weight.`  
   Value: `open-structure`

6. **Coordinate with a wider project**  
   `Work with renovations, drawings, consultants, builders or other trades.`  
   Value: `coordination`

### Selection rules

- zero to three priorities may be selected;
- priorities use native checkbox semantics;
- the selected count is visible;
- selecting a fourth priority should not silently remove an earlier choice;
- show a concise message asking the user to remove one selection;
- users can clear all priorities;
- the brief remains optional;
- no submit button is required merely to generate the summary.

### Contextual weighting

All six priorities may be visible, but the order should respond to the selected project direction.

Recommended ordering:

- `cover`: daylight, shade, everyday-use, open-structure, entertaining, coordination;
- `outdoor-room`: everyday-use, entertaining, daylight, shade, coordination, open-structure;
- `bespoke`: open-structure, coordination, daylight, everyday-use, shade, entertaining.

Do not hide priorities solely because they are less common.

---

## 10.7 Generated brief summary

### Purpose

Convert abstract selections into a clear, useful statement.

### Structure

**Eyebrow**

`Your starting brief`

**Heading example**

`A complete outdoor room for entertaining, regular use and an open connection to the garden.`

**Supporting statement**

`This is an early direction, not a final design. The roof, structure and details still depend on the measured site and project requirements.`

### Generation rules

The summary should be produced from controlled templates, not generative free text.

It must include:

- the selected project direction;
- up to three selected priorities;
- a plain-language sentence;
- a short uncertainty statement;
- no unsupported technical recommendation;
- no price estimate;
- no promise that a specific roof type will be suitable.

### Actions

**Primary**

`Explore the recommended service`

This links to the relevant service page while preserving the prototype source
and selected context. The brief panel does not introduce an enquiry CTA before
the visitor sees service or built-project evidence.

**Quiet**

`Change priorities`

---

## 10.8 Enquiry context

The enquiry journey should receive closed, validated values including:

- `source_experience: project-finder-home-v1`
- `source_path: /home-project-finder`
- `source_component: hero | project_finder | brief_summary | project_card`
- `project_direction: cover | outdoor-room | bespoke`
- `project_priorities: validated closed list`
- the last project opened from the finder when a later enquiry begins;
- residential enquiry type.

The visible enquiry form should summarise the selected direction and priorities in plain language.

Do not place personal information in analytics events or URL parameters.

Reuse the existing enquiry-context helpers rather than creating a parallel attribution system.

---

## 10.9 Relevant project evidence

Show two governed completed projects for each project direction.

### Cover

Initial candidates:

- Dairy Flat Estate
- Mt Maunganui Box or St Heliers Townhouse

### Outdoor room

Initial candidates:

- Warkworth Outdoor Room
- Riverhead Gable Pavilion

### Bespoke

Initial candidates:

- Tindalls Bay Pavilion
- Ardmore Box Carport or another governed difficult-site example

Codex must inspect `apps/marketing/data/projects.ts` and select projects based on communication purpose, image quality and factual fit.

### Project card requirements

Each preview should include:

- project image;
- project title;
- location;
- one short reason it is relevant;
- `View project` as the sole card action.

The view link carries only validated finder direction, priority and project-slug
context. Project-detail enquiry actions use it later without displaying a
premature reference-selection control.

Avoid long project descriptions on the homepage.

### Mobile layout

- stack project previews vertically;
- use a controlled 4:3 or similar image ratio;
- do not use a horizontal carousel;
- keep the project actions easy to tap;
- avoid placing two full paragraphs beneath each image.

---

## 10.10 Focused conversion close

The closing section should reflect the selected state when one exists.

### No selection

**Heading**

`Not sure which direction fits?`

**Copy**

`Sanctuary can review the site, intended use and the relationship to the house before the design direction is fixed.`

**Primary action**

`Start your project`

### Selection exists

**Heading example**

`Ready to discuss your outdoor room?`

**Copy**

Use one concise sentence that reflects the selected direction and, when available, the selected priorities.

**Primary action**

`Send your brief`

**Secondary action**

`Call Sanctuary`

Use the existing validated phone link and contact behavior.

---

# 11. Mobile design requirements

## 11.1 General

The prototype is mobile-first and must be reviewed as a complete mobile experience, not only as responsive desktop sections.

Requirements:

- no horizontal overflow;
- no fixed-width content that clips at 320 px;
- all interactive targets at least 44 by 44 CSS pixels;
- no hidden essential actions on hover;
- no global smooth scrolling;
- no scroll-jacking;
- no mandatory horizontal carousels;
- no full-screen modal for the brief builder;
- preserve native browser Back, Forward and scroll behavior.

## 11.2 Small mobile: 320 to 360 px

- use a compact hero composition;
- keep the H1 within approximately four lines;
- stack hero actions;
- use finder images around 140 to 160 px high;
- keep each finder choice concise enough to compare within a reasonable scroll;
- reduce decorative labels before reducing essential copy;
- ensure selected-state styling does not rely on color alone;
- keep the generated brief actions full width.

## 11.3 Standard mobile: 375 to 430 px

- finder images may increase to approximately 160 to 190 px;
- preserve visible separation between the three directions;
- avoid large blank regions between interaction states;
- keep the selected response closely connected to the chosen card;
- allow project imagery to remain prominent without making the page excessively long.

## 11.4 Tablet and desktop

- move the three project choices to a three-column layout when there is enough width for readable text;
- use two columns for selected response and supporting image or project evidence where useful;
- keep the optional brief builder visually secondary to the selected pathway result;
- avoid stretching body copy across wide columns;
- preserve the same state and content model as mobile.

---

# 12. Visual direction

The prototype should feel:

- architectural;
- calm;
- tactile;
- specific;
- premium;
- image-led;
- direct;
- restrained.

Use:

- the existing Sanctuary type system;
- Foundation UI spacing, container and motion tokens;
- the existing olive and burgundy brand accents where appropriate;
- clear line-weight hierarchy;
- large project imagery;
- subtle selected states;
- restrained borders;
- real project metadata.

Avoid:

- generic rounded SaaS cards;
- pill-heavy interfaces;
- playful quiz styling;
- illustrated icons as a substitute for project imagery;
- excessive gradients;
- animated counters;
- gamified progress;
- decorative swipe instructions;
- multiple competing solid buttons;
- generic lifestyle claims without project evidence.

---

# 13. Copy standards

Copy must:

- use customer language before technical terminology;
- remain concise on mobile;
- distinguish a deck cover, outdoor room and difficult-site solution clearly;
- describe outcomes without overselling;
- use project evidence for credibility;
- avoid implying that the prototype determines the final solution;
- avoid unsupported superlatives;
- avoid filler such as `transform your lifestyle`;
- avoid em dashes in customer-facing copy;
- preserve Sanctuary's premium but approachable tone.

Headings should be useful when read alone.

Option labels should describe recognisable project outcomes rather than internal service categories.

---

# 14. Interaction and motion

Use restrained motion only to clarify state changes.

Recommended behavior:

- selected card changes background, border and text treatment;
- response enters with a short fade and small vertical movement;
- pointer selection may scroll the response heading into a comfortable position;
- keyboard selection should move focus to the response heading without unexpected scrolling;
- opening the brief builder should preserve the selected response above it;
- generated summary updates in place;
- respect `prefers-reduced-motion`;
- remove non-essential transforms and smooth scrolling when reduced motion is enabled.

Do not animate large background images or create scroll-linked effects.

---

# 15. Accessibility requirements

The prototype must:

- contain one H1;
- use logical heading order;
- expose the finder as a labelled single-select group;
- use correct `aria-checked` state;
- provide roving keyboard behavior if the existing radio pattern is reused;
- use native checkboxes for priorities;
- announce selection results and generated brief changes through a polite live region;
- move focus predictably after keyboard actions;
- provide visible focus styles on all controls;
- retain usable contrast in selected and inverse states;
- provide meaningful image alt text;
- avoid duplicate IDs;
- remain usable at 200 percent zoom;
- provide a concise no-JavaScript fallback with direct links to the three service pathways;
- keep global navigation accessible throughout the flow.

---

# 16. Performance requirements

The initial opening should load only what is required for:

- the header;
- hero;
- compact proof;
- three finder choices.

Requirements:

- use `next/image`;
- give the hero image high fetch priority;
- lazy-load below-fold project images;
- use accurate responsive `sizes`;
- avoid loading all optional brief or project imagery before it is needed where practical;
- avoid layout shift when the response appears;
- reserve image dimensions;
- avoid new heavy client libraries;
- reuse existing utilities and components;
- keep state logic local and bounded.

Prototype targets under repeatable production conditions:

- LCP at or below 2.5 seconds on a representative mobile connection;
- CLS at or below 0.1;
- first project-selection response visible within 300 ms after input;
- no horizontal overflow;
- no hydration or client runtime errors.

Performance scores should be compared with the current homepage rather than judged only against an isolated synthetic threshold.

---

# 17. Analytics and experiment measurement

Use consent-aware analytics and closed non-personal values.

Recommended events:

- `project_finder_home_view`
- `project_finder_start_click`
- `project_direction_select`
- `project_direction_change`
- `project_result_view`
- `brief_builder_open`
- `brief_priority_select`
- `brief_priority_remove`
- `brief_summary_view`
- `project_view_click`
- `project_audience_path_click`
- `project_pathway_click`
- `project_finder_direct_enquiry_click`

Recommended properties:

- `homepage_variant: project_finder_home_v1`
- `source_path`
- `viewport_category`
- `project_direction`
- `project_priorities`
- `selected_project`
- `source_component`
- `step_number`

Do not include:

- name;
- email;
- phone;
- free-text message;
- address;
- uploaded file names;
- unvalidated query values.

### Primary experiment measures

Compare with `/` and `/home-guided` on:

- hero CTA engagement;
- percentage selecting a project direction;
- percentage viewing a project;
- percentage opening the brief builder;
- brief completion rate;
- service-page continuation;
- direct enquiry starts;
- completed enquiry rate;
- enquiry context completeness;
- mobile abandonment before first result.

Do not promote the prototype based only on finder interaction rate. The key outcome is qualified enquiry progression.

---

# 18. Technical implementation guidance

## 18.1 Recommended ownership

Suggested structure:

```text
apps/marketing/app/page.tsx
apps/marketing/app/home-project-finder/route.ts
apps/marketing/app/_home-project-finder/ProjectFinderHomepage.tsx
apps/marketing/app/_home-project-finder/routeContract.ts
apps/marketing/app/_home-project-finder/ProjectFinder.tsx
apps/marketing/app/_home-project-finder/ProjectFinderResult.tsx
apps/marketing/app/_home-project-finder/BuildBrief.tsx
apps/marketing/app/_home-project-finder/BriefSummary.tsx
apps/marketing/app/_home-project-finder/projectFinderModel.ts
apps/marketing/app/_home-project-finder/projectFinderContent.ts
apps/marketing/app/_home-project-finder/projectFinderMedia.ts
apps/marketing/app/_home-project-finder/ProjectFinderTracker.tsx
apps/marketing/app/_home-project-finder/projectFinderHomepage.module.css
apps/marketing/app/_home-project-finder/*.test.tsx
apps/marketing/app/home-project-finder/route.test.ts
playwright/marketing.home-project-finder.spec.ts
```

Align names with repository conventions after inspection, but keep one clear route owner and one bounded feature area.

## 18.2 Reuse requirements

Reuse where appropriate:

- Foundation UI primitives;
- global header and footer;
- project data from `apps/marketing/data/projects.ts`;
- Google review data helpers;
- enquiry-context utilities;
- analytics consent handling;
- shared motion and focus tokens;
- existing validated guided-journey context patterns;
- project card and image conventions where they remain suitable.

Do not copy project data, review data or enquiry attribution into route-local static objects.

## 18.3 State model

State should contain only validated closed values:

```ts
type ProjectDirection = 'cover' | 'outdoor-room' | 'bespoke';

type ProjectPriority =
  | 'daylight'
  | 'shade'
  | 'everyday-use'
  | 'entertaining'
  | 'open-structure'
  | 'coordination';

type ProjectFinderState = {
  project?: ProjectDirection;
  priorities?: ProjectPriority[];
};
```

Rules:

- maximum three priorities;
- remove duplicates;
- discard invalid values;
- clear incompatible state when project direction changes;
- serialize deterministically;
- restore from valid URL state;
- preserve browser history;
- never serialize free text.

## 18.4 Server and client boundaries

- metadata and route parsing should remain server-owned;
- interactive state may be client-owned;
- initial valid state should be parsed before hydration;
- avoid rendering all possible result branches in hidden DOM;
- load only the active response and relevant project evidence;
- provide a no-JavaScript fallback.

---

# 19. No-JavaScript fallback

When JavaScript is unavailable, show:

- the project-led hero;
- compact proof;
- a concise heading explaining the three starting points;
- direct links to:
  - `/pergolas-auckland`
  - `/outdoor-rooms-auckland`
  - `/custom-pergolas-auckland`
- a direct `Start your project` link;
- the global footer.

Do not attempt to recreate the optional brief builder without JavaScript.

---

# 20. QA matrix

Test at minimum:

- 320 x 568
- 320 x 700
- 360 x 400 for 200 percent zoom behavior
- 360 x 800
- 375 x 812
- 390 x 844
- 414 x 896
- 430 x 932
- 768 x 1024
- 1024 x 768
- 1440 x 900

Test:

- initial route;
- each project direction;
- zero, one, two and three priorities;
- attempt to select a fourth priority;
- changing project direction after priorities exist;
- reset;
- browser Back and Forward;
- refresh;
- invalid and duplicate query values;
- direct service-page continuation;
- direct enquiry continuation;
- project-reference continuation;
- mobile menu opening and closing;
- reduced motion;
- keyboard-only operation;
- VoiceOver and TalkBack behavior;
- no-JavaScript fallback;
- analytics consent granted and denied;
- image loading and alt text;
- 200 percent zoom;
- no horizontal overflow;
- no duplicate IDs;
- no client page errors.

---

# 21. Acceptance criteria

The prototype is complete when:

## Product and content

- the opening viewport clearly explains what Sanctuary does;
- the hero uses a governed completed-project image;
- the three project directions are distinct and understandable;
- one selection produces a useful response;
- relevant project evidence appears before the main enquiry close;
- the brief builder is optional;
- generated brief language is controlled and honest;
- the direct enquiry route remains available.

## Mobile experience

- the full experience is usable from 320 px upward;
- no page state creates horizontal overflow;
- all controls meet minimum target size;
- finder cards remain comparable on small screens;
- image-led choices do not create excessive card heights;
- the page does not require a carousel;
- the selected response remains clearly connected to the choice;
- the page is materially shorter and less repetitive than the current homepage.

## Interaction

- valid URL state restores on refresh;
- Back and Forward restore the correct state;
- invalid values are safely removed;
- a fourth priority is prevented clearly;
- changing direction updates dependent state correctly;
- keyboard and pointer behavior are predictable;
- reduced-motion preferences are respected.

## Accessibility

- one H1;
- logical headings;
- correct radio and checkbox semantics;
- visible focus;
- useful live announcements;
- usable at 200 percent zoom;
- usable no-JavaScript fallback;
- no duplicate IDs;
- appropriate contrast;
- meaningful alt text.

## Conversion and data

- all primary actions preserve validated source attribution;
- selected direction and priorities reach the enquiry form;
- the last project viewed from finder evidence reaches a later project enquiry;
- analytics are consent-aware;
- analytics contain no personal or free-text data;
- the prototype can be compared cleanly with the current and guided routes.

## Engineering quality

- lint passes;
- typecheck passes;
- marketing tests pass;
- build passes;
- new Playwright coverage passes;
- existing homepage and guided-homepage tests remain green;
- no database or environment change is introduced without explicit need;
- `/` remains unchanged and indexable;
- `/home-project-finder` remains noindex and absent from the sitemap.

---

# 22. Recommended implementation sequence

## Phase 1: Route and static composition

- create the protected noindex route;
- reuse the current hero and proof foundations;
- implement the static three-choice finder;
- select governed project media;
- add baseline responsive tests.

## Phase 2: Project-direction interaction

- implement validated URL state;
- add selected responses;
- add relevant project evidence;
- support Back, Forward, refresh and reset;
- add accessibility behavior and analytics.

## Phase 3: Build your brief

- add up-to-three priority selection;
- add controlled brief summary generation;
- connect context to the existing enquiry flow;
- add fourth-selection handling and state cleanup.

## Phase 4: Refinement and comparison

- complete mobile spacing and image-crop review;
- run physical iOS and Android checks;
- validate VoiceOver and TalkBack;
- compare performance with `/` and `/home-guided`;
- prepare a review summary with screenshots and measured funnel events.

Keep each phase bounded. Avoid unrelated site-wide redesign or copy changes.

---

# 23. Non-goals

Do not:

- replace the live homepage during prototype implementation;
- rebuild the global navigation;
- redesign all service landing pages;
- create a price calculator;
- ask users to select technical roof systems;
- add a chatbot;
- add free-text AI generation;
- add a full project configurator;
- create separate pages for every priority combination;
- create new project claims not supported by repository data;
- change enquiry forms beyond the context needed for this prototype;
- add global smooth scrolling or scroll-linked animation;
- introduce a new design system;
- duplicate existing project, review or analytics infrastructure.

---

# 24. Final design intent

The prototype should feel like Sanctuary begins the design conversation by showing strong work and helping the visitor identify the right level of project.

It should not feel like the visitor has arrived at a quiz.

The desired sequence is:

> See the quality. Understand the offer. Recognise the project. Refine the priorities when useful. Continue with relevant evidence and a clear next step.

---

# 25. Approved targeted refinement addendum

The post-launch refinement keeps the three residential project directions as
the only finder cards. It adds a quiet secondary line for commercial clients
and architects, designers and builders, including the no-JavaScript fallback;
these links must not read as a fourth finder choice.

Recommended residential service links preserve the closed `project` and up to
three canonical `priorities`. The matching service page repeats the saved brief,
links back to the exact finder state and carries the same governed context into
its embedded form and shared header enquiry action. Wrong-route, duplicate and
arbitrary values render no continuation layer. Service-page canonicals remain
unchanged.

At 320-430px, each direction is a compact horizontal comparison row with a
small project image and complete readable label and explanation. At 768-900px,
the three cards use full-width horizontal rows rather than premature narrow
columns. All controls keep the existing touch-target, focus and overflow
contracts.

Only the hero is initial high-priority media. Direction and evidence images
remain lazy and use responsive size hints matched to their rendered geometry.
Generated brief copy uses one concise grammatical sentence with direction-led
priority order.

Analytics distinguish `project_result_view`, `project_view_click` and
`project_audience_path_click`. Removing the visible reference action also
retires its dedicated event rather than leaving a dead analytics contract.
`project_result_view` fires once for a newly viewed direction and must not fire
again when only priorities change. All event properties remain closed,
non-personal and consent-gated.

---

# 26. Approved visual refinement and informed-lead addendum

This addendum supersedes earlier CTA and sizing guidance where the two conflict.
The live homepage remains the visual benchmark; only its already-absent mobile
hero enquiry action is asserted, not redesigned.

The finder hero uses the same immersive editorial proportions as the homepage.
On desktop it fills the opening viewport beneath the overlay header. At 900px
and below the solid header plus hero fill the viewport, except where a short
viewport needs additional height to keep the copy and project attribution
readable. Mobile exposes only `Find your project direction`; the desktop hero
may retain its established enquiry action.

The proof rail adopts the homepage's ruled three-part composition, display-type
figures and restrained uppercase detail. The three directions remain the only
finder choices. They use independent image-led editorial cards on desktop,
compact complete comparison rows at 320-430px, and full-width landscape rows at
768-900px. Commercial and professional routes remain a quiet line beneath them.

The selected result is one bordered recommendation with a single primary service
action, optional priority refinement and a quiet all-projects escape. The brief
summary continues to the recommended service rather than enquiry. Relevant work
uses a restrained section heading, explanatory copy and two elevated project
cards with `View project` as their only action. The page's direct enquiry close
appears only after this built evidence and only after a direction is selected.

Opening a governed project preserves the closed direction, up to three canonical
priorities and that project slug. Finder-origin visitors do not see the normal
project-introduction enquiry CTA; after reading the case study, the final project
CTA and shared header carry the preserved context into enquiry. Related project
links update the validated project slug while retaining direction and priorities.
Invalid, duplicate, missing or mismatched values are discarded. Project
canonicals remain unchanged and no visitor-entered text is added to URLs.

---

# 27. Approved production promotion

Production promotion was approved on 2 August 2026. This section supersedes
the prototype-only route and non-promotion constraints above; those constraints
remain the historical development guardrail rather than the current routing
contract.

The project finder is the sole renderer for `/`, owned by
`apps/marketing/app/_home-project-finder/`. The root is indexable and
self-canonical, retains the approved homepage title, description, Open Graph
identity and WebSite/WebPage schema, and remains listed once in the sitemap.
The superseded `apps/marketing/app/_home/` implementation and its duplicate
browser suite are retired. `/home-project-finder` permanently redirects to `/`,
preserves valid query parameters, carries `X-Robots-Tag: noindex, nofollow` and
is not listed in the sitemap.

Production analytics use `homepage_variant: project_finder_home_v2` and
`source_path: /`. Enquiry continuation deliberately retains
`source_experience: project-finder-home-v1` as the stable journey schema. The
shared header enquiry is measured by the finder owner, while both shared header
and footer canonicalise Next's optimized `/index` alias to `/` before building
enquiry context.

The final no-structure refinement keeps the approved visible sequence intact.
At 320px, tall phones retain the full-viewport hero instead of falling back to
a fixed 568px opening. Once the root hero has scrolled, its header becomes fully
opaque so underlying proof and card headings cannot show through; other hero
routes retain their existing header treatment. The production browser owner is
`playwright/marketing.home-project-finder.spec.ts`, including the 320-1440
journey matrix, redirect/indexing checks, image-loading contract, continuation,
consent-aware analytics and repeatable CLS, first-result and production-LCP
budgets.

---

# 28. Approved in-place customer-journey refinement

The 3 August 2026 customer-journey refinement supersedes the first-layer choice
and quiet audience-link details in sections 25 and 26. It does not create a new
homepage version. The sole production renderer remains `/`, owned by
`apps/marketing/app/_home-project-finder/`, with `project_finder_home_v2` as its
analytics variant and `project-finder-home-v1` as the stable enquiry schema.
The hero, proof rail, choice cards, tailored result, relevant built work and
evidence-first enquiry close remain the visible sequence.

The first layer is exactly `Simple cover`, `Custom design` and `Commercial /
Professional`. `Simple cover` recommends acrylic roof pergolas, uses governed
Dairy Flat and St Heliers evidence, and uses the dedicated pitched acrylic
product image `pitched-01.webp` for immediate product recognition. It continues to
`/simple-pergolas-auckland`. That destination is a distinct, noindex conversion
page; `/acrylic-roof-pergolas-auckland` remains the unchanged indexable acrylic
research owner. `Custom design` recommends the custom design
path, uses the Mt Maunganui Box hero image and governed Tindalls Bay and
Warkworth evidence. Its result leads with `Explore projects` to `/projects` and
retains the attributed `/custom-pergolas-auckland` pathway as the quiet
`Explore custom pergolas` action. Both residential paths retain the optional
controlled-priority brief. The Commercial / Professional first-layer choice
uses the second Lilliput Mini Golf image to show an occupied venue beneath the
structure.

`Commercial / Professional` reveals a second image-led radio group in the same
finder: `Extending a Venue`, `Builder or Contractor`, and `Architects and
Designers`. A parent selection alone is not a result. Each child selection
reveals and scrolls to its tailored result, two relevant existing projects and
an evidence-first close. Venue work continues to
`/commercial-pergolas-auckland` with commercial enquiry attribution; builder,
contractor, architect and designer work continues to
`/architects-designers-builders` with professional attribution. The destination
commercial and professional destination pages remain unchanged.

Canonical URL state accepts one first-layer `project`; residential selections
may add up to three `priorities`, while the commercial/professional parent may
add exactly one `professional_path`. Incompatible, duplicate, unknown and excess
values fail closed. Push-state selection, Back, Forward, refresh, reset and the
shared header and footer enquiries stay synchronized. Pointer selection scrolls
to the next
decision or result; keyboard selection moves focus to its heading. Both radio
groups keep roving-arrow, Home and End behavior. The JavaScript-disabled
fallback exposes all five final destinations directly.

Analytics remain consent-gated and non-personal. In addition to the established
direction, result, project, pathway, brief and enquiry events, the nested branch
uses `professional_path_select` and `professional_path_change` with one of three
closed values. The commercial/professional parent does not emit a result view;
the completed child result does. Responsive verification covers both choice
layers and all five results from 320 to 1440 pixels, including overflow, touch
targets, history, focus, attribution and no-JavaScript access.

---

# 29. Approved cinematic opening refinement

The 3 August 2026 cinematic refinement changes the opening of the existing
production homepage in place. It does not add a route, homepage variant, content
owner or alternate implementation. `/` remains owned by
`apps/marketing/app/_home-project-finder/`; `project_finder_home_v2` and the
stable `project-finder-home-v1` enquiry schema do not change. The proof rail,
finder, all five results, built evidence, URL/history behavior and destination
pages remain as approved in section 28.

The server-rendered first paint includes a fixed charcoal welcome veil with no
visible or operable shared header. `WELCOME TO` is oversized muted grey and
`SANCTUARY PERGOLAS` is oversized white. The veil waits for the existing
priority Warkworth hero image to decode, exits after a 1.4-second fallback if
decoding does not resolve, holds long enough to avoid a cached-image flash, and
uses no fade when `prefers-reduced-motion: reduce` is active. It is visual only,
does not capture focus and is removed from the JavaScript-disabled rendering.

After the veil, the first viewport is the existing hero project image only,
beneath the transparent shared header. The visible desktop header enquiry action
is withheld. One bottom-centred bold open chevron advances the native document
scroll. It has no stem, circle, label, background or other enclosing shape; its
invisible hit area remains at least 56 pixels wide and its heavier stroke remains
legible over both responsive crops. A restrained periodic downward nudge makes
the chevron discoverable without adding decorative chrome; reduced-motion users
receive the static mark. Through 760px the priority picture uses the
portrait `warkworth-gable-02.jpg`; larger widths retain the existing wide project
image. The hero remains sticky while the first forward wheel gesture, upward
touch swipe, Page Down, Space or Arrow Down reveals the existing shade, eyebrow,
H1, support and Warkworth project attribution. The next equivalent gesture, or
the second matching chevron, uses the established `project_finder_start_click`
event and advances to the inner question-and-three-choices wrapper. The landing
uses the actual fixed-header bottom and visual viewport: it centres the complete
wrapper when it fits, and otherwise aligns its top eight pixels beneath the
header for natural continuation. It does not target the outer section padding.
Input returns to native document
scrolling at that boundary, reverse scrolling is not intercepted and reduced
motion uses immediate movement. No hero enquiry CTA is rendered.

On touch devices, the first forward movement of an active swipe is cancelled
before the distance threshold is reached, preventing native momentum from
carrying one gesture through both hero stages. The welcome veil also suppresses
touch panning until it has left. One touch sequence can therefore reveal only
one stage; advancing again requires a new touch start.

The shared header stays transparent at mobile and desktop widths while either
hero stage is active, and becomes opaque only after the hero journey boundary.
Its normal route-aware project action returns at that boundary. The story remains
complete at the short 360x400 matrix size, while 320x568, 390x844 and 1440x900
retain the full cinematic scale. The staged owner reserves its full scroll
geometry from first paint, so revealing content does not shift downstream
layout. JavaScript-disabled visitors see the complete hero story immediately,
the shared header remains available and the direct five-destination fallback is
unchanged.

At 760px and below, the first three project directions are text-only ruled rows
with oversized direction titles and no rendered card image. This refinement is
limited to the initial starting-point group: the nested commercial/professional
pathway cards remain image-led, and tablet/desktop retain the existing imagery.
Mobile-only spacing contracts enough for the complete opening to fit common
phone heights while preserving every description and the full control target.

---

# 30. Simple cover direct destination

The `Simple cover` first-layer card now opens `/simple-pergolas-auckland`
directly. It no longer requires visitors to view the intermediate homepage
recommendation before reaching the dedicated simple acrylic pergola page.
Canonical saved finder state such as `/?project=cover` remains supported.
